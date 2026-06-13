import { db } from '@/lib/db';
import { getSandboxProvider } from '@/lib/sandbox/provider';
import { createWorkspaceManifest } from '@/lib/sandbox/workspace-manifest';
import type { WorkspaceFile } from '@/lib/sandbox/types';
import { logSessionEvent } from '@/lib/telemetry';
import { isAllowedAgentCommand } from '@/lib/agent/tools';

const MAX_AGENT_OUTPUT_CHARS = 6000;

export type AgentCommandResult = {
  command: string;
  allowed: boolean;
  status: 'succeeded' | 'failed' | 'blocked';
  exitCode: number | null;
  output: string;
};

function capOutput(output: string) {
  if (output.length <= MAX_AGENT_OUTPUT_CHARS) return output;
  return `${output.slice(0, MAX_AGENT_OUTPUT_CHARS)}\n[output truncated]`;
}

// Runs a read-only command on behalf of the agent through the existing sandbox
// provider, persists it as a CommandRun, and records agent attribution.
export async function runAgentCommand(input: {
  sessionId: string;
  command: string;
  files: WorkspaceFile[];
}): Promise<AgentCommandResult> {
  const command = input.command.trim();

  if (!isAllowedAgentCommand(command)) {
    await logSessionEvent({
      sessionId: input.sessionId,
      type: 'ai_agent_command_run',
      actor: 'ai',
      payload: { command, blocked: true, reason: 'command_not_allowed' },
    });
    return {
      command,
      allowed: false,
      status: 'blocked',
      exitCode: null,
      output: `Command not allowed for the agent. Allowed: npm test, ls, ls src, pwd, cat <path>.`,
    };
  }

  const provider = getSandboxProvider();
  const manifest = createWorkspaceManifest(input.files);
  const commandRun = await db.commandRun.create({
    data: { sessionId: input.sessionId, command, status: 'running', output: '' },
  });

  try {
    const result = await provider.runCommand({
      sessionId: input.sessionId,
      command,
      files: input.files,
      workspaceManifest: manifest,
    });
    const output = capOutput(result.output);

    await db.commandRun.update({
      where: { id: commandRun.id },
      data: {
        status: result.status,
        output,
        exitCode: result.exitCode,
        finishedAt: new Date(),
      },
    });

    if (result.tests.length) {
      await db.testResult.createMany({
        data: result.tests.map((test) => ({
          commandRunId: commandRun.id,
          sessionId: input.sessionId,
          name: test.name,
          status: test.status,
          message: test.message,
          durationMs: test.durationMs ?? null,
        })),
      });
    }

    await logSessionEvent({
      sessionId: input.sessionId,
      type: 'ai_agent_command_run',
      actor: 'ai',
      payload: {
        commandRunId: commandRun.id,
        command,
        exitCode: result.exitCode,
        status: result.status,
        sandboxProviderId: result.provider.id,
        sandboxProviderKind: result.provider.kind,
        sandboxRunId: result.execution.sandboxRunId,
      },
    });

    return { command, allowed: true, status: result.status, exitCode: result.exitCode, output };
  } catch (error) {
    const message = error instanceof Error ? error.message : 'sandbox error';
    await db.commandRun.update({
      where: { id: commandRun.id },
      data: { status: 'failed', output: message, exitCode: null, finishedAt: new Date() },
    });
    await logSessionEvent({
      sessionId: input.sessionId,
      type: 'ai_agent_command_run',
      actor: 'ai',
      payload: { commandRunId: commandRun.id, command, status: 'failed', error: message },
    });
    return { command, allowed: true, status: 'failed', exitCode: null, output: `Command failed: ${message}` };
  }
}
