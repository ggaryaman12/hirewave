import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { db } from '@/lib/db';
import { getLatestFiles, getSessionByToken } from '@/lib/sessions';
import { sandboxCapabilityGaps, sandboxCapabilityStatuses } from '@/lib/sandbox/capabilities';
import { persistSandboxSnapshots } from '@/lib/sandbox/evidence';
import { getSandboxProvider } from '@/lib/sandbox/provider';
import { createSandboxRunId } from '@/lib/sandbox/run-id';
import { createWorkspaceManifest } from '@/lib/sandbox/workspace-manifest';
import type {
  SandboxCommandResult,
  SandboxExecutionMetadata,
  SandboxOutputChunk,
  SandboxProviderMetadata,
} from '@/lib/sandbox/types';
import { logSessionEvent } from '@/lib/telemetry';
import { validateWorkspacePath } from '@/lib/workspace-paths';

const DEFAULT_COMMAND_OUTPUT_LIMIT_CHARS = 20_000;
const TRUNCATION_MARKER_ALLOWANCE_CHARS = 80;

const commandSchema = z.object({
  command: z.string().min(1).max(200),
});

function toPositiveInt(value: string | undefined, fallback: number) {
  const parsed = Number(value || fallback);
  return Number.isFinite(parsed) && parsed > 0 ? Math.floor(parsed) : fallback;
}

function commandOutputLimitChars() {
  return toPositiveInt(process.env.SANDBOX_COMMAND_OUTPUT_LIMIT, DEFAULT_COMMAND_OUTPUT_LIMIT_CHARS);
}

function fallbackOutputChunks(output: string): SandboxOutputChunk[] {
  return [{ stream: 'system', content: output }];
}

function capOutputChunks(outputChunks: SandboxOutputChunk[], outputLimitChars: number) {
  const totalLength = outputChunks.reduce((sum, chunk) => sum + chunk.content.length, 0);
  if (totalLength <= outputLimitChars) return outputChunks;

  let remaining = outputLimitChars;
  const capped: SandboxOutputChunk[] = [];
  for (const chunk of outputChunks) {
    if (remaining <= 0) break;
    if (chunk.content.length <= remaining) {
      capped.push(chunk);
      remaining -= chunk.content.length;
      continue;
    }

    capped.push({
      ...chunk,
      content: chunk.content.slice(0, remaining),
      truncated: true,
    });
    remaining = 0;
  }

  capped.push({ stream: 'system', content: `[output truncated after ${outputLimitChars} chars]` });
  return capped;
}

function outputStreamKinds(outputChunks: SandboxOutputChunk[]) {
  return Array.from(new Set(outputChunks.map((chunk) => chunk.stream))).sort((a, b) => a.localeCompare(b));
}

function capCommandOutput(output: string, execution: SandboxExecutionMetadata, outputChunks = fallbackOutputChunks(output)) {
  const routeOutputLimitChars = commandOutputLimitChars();
  const providerOutputLimitChars =
    typeof execution.outputLimitChars === 'number' && execution.outputLimitChars > 0
      ? execution.outputLimitChars
      : undefined;
  const outputLimitChars = Math.min(providerOutputLimitChars ?? routeOutputLimitChars, routeOutputLimitChars);
  const outputChars = typeof execution.outputChars === 'number' ? execution.outputChars : output.length;
  const alreadyTruncatedWithinLimit =
    execution.outputTruncated === true &&
    (providerOutputLimitChars ?? outputLimitChars) <= routeOutputLimitChars &&
    output.length <= outputLimitChars + TRUNCATION_MARKER_ALLOWANCE_CHARS;

  if (alreadyTruncatedWithinLimit) {
    return {
      output,
      outputChunks,
      execution: {
        ...execution,
        outputChars,
        outputLimitChars,
        outputTruncated: true,
      },
    };
  }

  if (output.length <= outputLimitChars) {
    return {
      output,
      outputChunks,
      execution: {
        ...execution,
        outputChars,
        outputLimitChars,
        outputTruncated: execution.outputTruncated === true,
      },
    };
  }

  const cappedOutput = [
    output.slice(0, outputLimitChars).trimEnd(),
    `[output truncated after ${outputLimitChars} chars]`,
  ]
    .filter(Boolean)
    .join('\n');

  return {
    output: cappedOutput,
    outputChunks: capOutputChunks(outputChunks, outputLimitChars),
    execution: {
      ...execution,
      outputChars,
      outputLimitChars,
      outputTruncated: true,
    },
  };
}

function capCommandResultOutput(result: SandboxCommandResult): SandboxCommandResult {
  const capped = capCommandOutput(result.output, result.execution, result.outputChunks);
  return {
    ...result,
    output: capped.output,
    outputChunks: capped.outputChunks,
    execution: capped.execution,
  };
}

function summarizeSnapshots(
  snapshots: {
    path: string;
    language: string;
    content: string;
  }[],
) {
  return snapshots.map((snapshot) => ({
    path: snapshot.path,
    language: snapshot.language,
    contentLength: snapshot.content.length,
  }));
}

function sandboxMetadataPayload(metadata: SandboxProviderMetadata) {
  const capabilityStatuses = sandboxCapabilityStatuses(metadata.capabilities);

  return {
    sandboxProviderId: metadata.id,
    sandboxProviderKind: metadata.kind,
    sandboxExecutionMode: metadata.executionMode,
    sandboxIsolationLevel: metadata.isolationLevel,
    sandboxNetworkAccess: metadata.networkAccess,
    sandboxNetworkPolicyMode: metadata.networkPolicy.mode,
    sandboxNetworkOutboundAccess: metadata.networkPolicy.outboundAccess,
    sandboxNetworkAllowedHosts: metadata.networkPolicy.allowedHosts,
    sandboxNetworkBlockedByDefault: metadata.networkPolicy.blockedByDefault,
    sandboxReadinessStatus: metadata.capabilities.readiness,
    sandboxCapabilityStatuses: capabilityStatuses,
    sandboxCapabilityGaps: sandboxCapabilityGaps(capabilityStatuses),
    sandboxFilesystemPersistence: metadata.filesystemPersistence,
    sandboxCleanupPolicy: metadata.cleanupPolicy,
    sandboxCommandPolicyMode: metadata.commandPolicy.mode,
    sandboxAllowedCommands: metadata.commandPolicy.allowedCommands,
    sandboxBlockedByDefault: metadata.commandPolicy.blockedByDefault,
    sandboxEnvironmentPolicyMode: metadata.environmentPolicy.mode,
    sandboxExposedEnvKeys: metadata.environmentPolicy.exposedEnvKeys,
    sandboxSecretsExposed: metadata.environmentPolicy.secretsExposed,
    sandboxResourceLimits: metadata.resourceLimits,
  };
}

function commandErrorMessage(error: unknown) {
  return error instanceof Error ? error.message : 'Unknown sandbox provider error';
}

export async function POST(request: NextRequest, { params }: { params: { sessionToken: string } }) {
  const session = await getSessionByToken(params.sessionToken);
  if (!session) return NextResponse.json({ error: 'Session not found' }, { status: 404 });
  const sessionId = session.id;

  if (['submitted', 'expired', 'report_ready'].includes(session.status)) {
    return NextResponse.json({ error: 'Session is closed' }, { status: 409 });
  }

  const { command } = commandSchema.parse(await request.json());
  const sandboxProvider = getSandboxProvider();
  const configuredProviderMetadata = sandboxProvider.metadata();
  const isTestCommand = sandboxProvider.isTestCommand(command);
  const started = await db.commandRun.create({
    data: {
      sessionId: session.id,
      command,
      status: 'running',
      output: '',
    },
  });

  const files = await getLatestFiles(session.id);
  const workspaceSummary = createWorkspaceManifest(files);

  await logSessionEvent({
    sessionId: session.id,
    type: isTestCommand ? 'test_run_started' : 'command_started',
    actor: 'runner',
    payload: {
      commandRunId: started.id,
      command,
      ...sandboxMetadataPayload(configuredProviderMetadata),
      ...workspaceSummary,
    },
  });

  async function finishFailedCommand(input: {
    output: string;
    errorMessage: string;
    skippedReason: 'provider_error' | 'invalid_workspace_file_path';
    durationMs: number;
  }) {
    const sandboxRunId = createSandboxRunId(configuredProviderMetadata.id);
    const execution = {
      sandboxRunId,
      durationMs: input.durationMs,
      timedOut: false,
      cleanupStatus: 'not_applicable' as const,
      outputChars: input.output.length,
      outputTruncated: false,
      skippedReason: input.skippedReason,
    };
    const capped = capCommandOutput(input.output, execution);
    const failed = await db.commandRun.update({
      where: { id: started.id },
      data: {
        status: 'failed',
        output: capped.output,
        exitCode: 1,
        finishedAt: new Date(),
      },
    });
    const failurePayload = {
      commandRunId: failed.id,
      command,
      output: capped.output,
      outputChunks: capped.outputChunks,
      outputChunkCount: capped.outputChunks.length,
      outputStreamKinds: outputStreamKinds(capped.outputChunks),
      exitCode: 1,
      ...sandboxMetadataPayload(configuredProviderMetadata),
      ...workspaceSummary,
      sandboxRunId: capped.execution.sandboxRunId,
      snapshotCount: 0,
      persistedSnapshotCount: 0,
      durationMs: capped.execution.durationMs,
      timedOut: capped.execution.timedOut,
      cleanupStatus: capped.execution.cleanupStatus,
      cleanupError: capped.execution.cleanupError,
      outputChars: capped.execution.outputChars,
      outputLimitChars: capped.execution.outputLimitChars,
      outputTruncated: capped.execution.outputTruncated,
      skippedReason: capped.execution.skippedReason,
      errorMessage: input.errorMessage,
      snapshots: [],
      passed: 0,
      failed: 0,
      total: 0,
    };

    await logSessionEvent({
      sessionId,
      type: 'command_output',
      actor: 'runner',
      payload: failurePayload,
    });

    await logSessionEvent({
      sessionId,
      type: isTestCommand ? 'test_run_finished' : 'command_finished',
      actor: 'runner',
      payload: failurePayload,
    });

    return NextResponse.json({
      commandRun: {
        id: failed.id,
        command: failed.command,
        status: failed.status,
        output: failed.output,
        exitCode: failed.exitCode,
        startedAt: failed.startedAt.toISOString(),
        finishedAt: failed.finishedAt?.toISOString() || null,
        sandbox: {
          providerId: configuredProviderMetadata.id,
          providerKind: configuredProviderMetadata.kind,
          executionMode: configuredProviderMetadata.executionMode,
          isolationLevel: configuredProviderMetadata.isolationLevel,
          networkAccess: configuredProviderMetadata.networkAccess,
          networkPolicy: configuredProviderMetadata.networkPolicy,
          capabilities: configuredProviderMetadata.capabilities,
          filesystemPersistence: configuredProviderMetadata.filesystemPersistence,
          cleanupPolicy: configuredProviderMetadata.cleanupPolicy,
          commandPolicy: configuredProviderMetadata.commandPolicy,
          snapshotCount: 0,
          persistedSnapshotCount: 0,
          execution: capped.execution,
        },
        outputChunks: capped.outputChunks,
        testResults: [],
      },
    });
  }

  const invalidFiles = files.flatMap((file) => {
    const workspacePath = validateWorkspacePath(file.path);
    return workspacePath.ok ? [] : [{ path: file.path, reason: workspacePath.reason }];
  });
  if (invalidFiles.length) {
    const errorMessage = `Unsafe workspace file path${invalidFiles.length === 1 ? '' : 's'}: ${invalidFiles
      .map((file) => `${file.path} (${file.reason})`)
      .join(', ')}`;
    return finishFailedCommand({
      output: [`$ ${command}`, 'Workspace validation failed before sandbox provider execution.', errorMessage].join('\n'),
      errorMessage,
      skippedReason: 'invalid_workspace_file_path',
      durationMs: 0,
    });
  }

  const providerStartedAt = Date.now();
  const result = await sandboxProvider.runCommand({
    sessionId: session.id,
    command,
    files,
    workspaceManifest: workspaceSummary,
  }).catch(async (error) => {
    const errorMessage = commandErrorMessage(error);
    return finishFailedCommand({
      output: [`$ ${command}`, 'Sandbox provider failed before command completed.', errorMessage].join('\n'),
      errorMessage,
      skippedReason: 'provider_error',
      durationMs: Date.now() - providerStartedAt,
    });
  });

  if (result instanceof NextResponse) return result;
  const commandResult = capCommandResultOutput(result);
  const snapshotSummary = summarizeSnapshots(commandResult.snapshots);

  const finished = await db.commandRun.update({
    where: { id: started.id },
    data: {
      status: commandResult.status,
      output: commandResult.output,
      exitCode: commandResult.exitCode,
      finishedAt: new Date(),
    },
  });

  if (commandResult.tests.length) {
    await db.testResult.createMany({
      data: commandResult.tests.map((test) => ({
        commandRunId: finished.id,
        sessionId: session.id,
        name: test.name,
        status: test.status,
        message: test.message,
      })),
    });
  }

  const persistedSnapshots = await persistSandboxSnapshots({
    sessionId: session.id,
    commandRunId: finished.id,
    providerId: commandResult.provider.id,
    providerKind: commandResult.provider.kind,
    snapshots: commandResult.snapshots,
  });

  await logSessionEvent({
    sessionId: session.id,
    type: 'command_output',
    actor: 'runner',
    payload: {
      commandRunId: finished.id,
      output: commandResult.output,
      outputChunks: commandResult.outputChunks,
      outputChunkCount: commandResult.outputChunks.length,
      outputStreamKinds: outputStreamKinds(commandResult.outputChunks),
      ...sandboxMetadataPayload(commandResult.provider),
      ...workspaceSummary,
      sandboxRunId: commandResult.execution.sandboxRunId,
      snapshotCount: commandResult.snapshots.length,
      persistedSnapshotCount: persistedSnapshots.length,
      durationMs: commandResult.execution.durationMs,
      timedOut: commandResult.execution.timedOut,
      cleanupStatus: commandResult.execution.cleanupStatus,
      cleanupError: commandResult.execution.cleanupError,
      timeoutMs: commandResult.execution.timeoutMs,
      outputChars: commandResult.execution.outputChars,
      outputLimitChars: commandResult.execution.outputLimitChars,
      outputTruncated: commandResult.execution.outputTruncated,
      skippedReason: commandResult.execution.skippedReason,
      snapshots: snapshotSummary,
    },
  });

  await logSessionEvent({
    sessionId: session.id,
    type: isTestCommand ? 'test_run_finished' : 'command_finished',
    actor: 'runner',
    payload: {
      commandRunId: finished.id,
      command,
      exitCode: commandResult.exitCode,
      outputChunkCount: commandResult.outputChunks.length,
      outputStreamKinds: outputStreamKinds(commandResult.outputChunks),
      ...sandboxMetadataPayload(commandResult.provider),
      ...workspaceSummary,
      sandboxRunId: commandResult.execution.sandboxRunId,
      snapshotCount: commandResult.snapshots.length,
      persistedSnapshotCount: persistedSnapshots.length,
      durationMs: commandResult.execution.durationMs,
      timedOut: commandResult.execution.timedOut,
      cleanupStatus: commandResult.execution.cleanupStatus,
      cleanupError: commandResult.execution.cleanupError,
      timeoutMs: commandResult.execution.timeoutMs,
      outputChars: commandResult.execution.outputChars,
      outputLimitChars: commandResult.execution.outputLimitChars,
      outputTruncated: commandResult.execution.outputTruncated,
      skippedReason: commandResult.execution.skippedReason,
      snapshots: snapshotSummary,
      passed: commandResult.tests.filter((test) => test.status === 'passed').length,
      failed: commandResult.tests.filter((test) => test.status === 'failed').length,
      total: commandResult.tests.length,
    },
  });

  const testResults = await db.testResult.findMany({ where: { commandRunId: finished.id } });

  return NextResponse.json({
    commandRun: {
      id: finished.id,
      command: finished.command,
      status: finished.status,
      output: finished.output,
      outputChunks: commandResult.outputChunks,
      exitCode: finished.exitCode,
      startedAt: finished.startedAt.toISOString(),
      finishedAt: finished.finishedAt?.toISOString() || null,
      sandbox: {
        providerId: commandResult.provider.id,
        providerKind: commandResult.provider.kind,
        executionMode: commandResult.provider.executionMode,
        isolationLevel: commandResult.provider.isolationLevel,
        networkAccess: commandResult.provider.networkAccess,
        networkPolicy: commandResult.provider.networkPolicy,
        capabilities: commandResult.provider.capabilities,
        filesystemPersistence: commandResult.provider.filesystemPersistence,
        cleanupPolicy: commandResult.provider.cleanupPolicy,
        commandPolicy: commandResult.provider.commandPolicy,
        snapshotCount: commandResult.snapshots.length,
        persistedSnapshotCount: persistedSnapshots.length,
        execution: commandResult.execution,
      },
      testResults,
    },
  });
}
