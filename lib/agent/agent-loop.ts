import { db } from '@/lib/db';
import {
  generateOpenAiCompatibleToolResponse,
  getOpenAiCompatibleAgentConfig,
} from '@/lib/ai/openai-compatible-provider';
import type { OpenAiCompatibleConfig } from '@/lib/ai/openai-compatible-provider';
import type { AiChatMessage, AiToolCall, AiToolChatResult } from '@/lib/ai/types';
import type { WorkspaceFile } from '@/lib/sandbox/types';
import { logSessionEvent } from '@/lib/telemetry';
import { toJson } from '@/lib/json';
import { AGENT_SYSTEM_PROMPT, AGENT_TOOLS } from '@/lib/agent/tools';
import { runAgentCommand } from '@/lib/agent/command-runner';
import { createProposal } from '@/lib/agent/proposals';

const DEFAULT_MAX_STEPS = 6;

export type AgentChallengeContext = {
  title: string;
  role: string;
  instructions: string;
};

type ToolGenerator = (input: {
  messages: AiChatMessage[];
  tools: typeof AGENT_TOOLS;
  config?: OpenAiCompatibleConfig;
}) => Promise<AiToolChatResult>;

export type AgentTurnResult = {
  assistantMessages: { id: string; content: string }[];
  proposalIds: string[];
  stopReason: 'answered' | 'awaiting_approval' | 'step_limit';
};

function buildUserContent(input: {
  challenge: AgentChallengeContext;
  files: WorkspaceFile[];
  candidateMessage: string;
}) {
  const fileList = input.files.map((file) => `- ${file.path}`).join('\n') || '- (no files)';
  return [
    `Challenge: ${input.challenge.title}`,
    `Role: ${input.challenge.role}`,
    '',
    'Instructions:',
    input.challenge.instructions,
    '',
    'Workspace files (use run_command / read_file to inspect):',
    fileList,
    '',
    `Candidate request: ${input.candidateMessage}`,
  ].join('\n');
}

async function executeToolCall(input: {
  sessionId: string;
  call: AiToolCall;
  files: WorkspaceFile[];
  aiMessageId: string;
}): Promise<{ content: string; proposalId?: string }> {
  const { call } = input;

  if (call.name === 'run_command') {
    const command = typeof call.args.command === 'string' ? call.args.command : '';
    const result = await runAgentCommand({ sessionId: input.sessionId, command, files: input.files });
    return { content: `exitCode=${result.exitCode ?? 'n/a'} status=${result.status}\n${result.output}` };
  }

  if (call.name === 'read_file') {
    const path = typeof call.args.path === 'string' ? call.args.path : '';
    const file = input.files.find((candidate) => candidate.path === path);
    await logSessionEvent({
      sessionId: input.sessionId,
      type: 'ai_agent_file_read',
      actor: 'ai',
      payload: { path, found: Boolean(file) },
    });
    return { content: file ? file.content : `File not found: ${path}` };
  }

  if (call.name === 'propose_edit') {
    const path = typeof call.args.path === 'string' ? call.args.path : '';
    const newContent = typeof call.args.newContent === 'string' ? call.args.newContent : '';
    const rationale = typeof call.args.rationale === 'string' ? call.args.rationale : undefined;
    const result = await createProposal({
      sessionId: input.sessionId,
      toolCallId: call.id,
      aiMessageId: input.aiMessageId,
      path,
      newContent,
      rationale,
    });
    if (!result.ok) {
      return { content: `Proposal rejected by system: ${result.reason}` };
    }
    return {
      content: `Proposal queued (id: ${result.proposal.id}) for ${result.proposal.path}. Awaiting candidate review.`,
      proposalId: result.proposal.id,
    };
  }

  return { content: `Unknown tool: ${call.name}` };
}

// Runs one candidate turn through the agent loop: inspect (read tools auto-run),
// propose edits (queued for approval). Stops when the agent answers, queues a
// proposal, or hits the step limit.
export async function runAgentTurn(input: {
  sessionId: string;
  candidateMessage: string;
  challenge: AgentChallengeContext;
  files: WorkspaceFile[];
  config?: OpenAiCompatibleConfig;
  generateTool?: ToolGenerator;
  maxSteps?: number;
}): Promise<AgentTurnResult> {
  const generate = input.generateTool || generateOpenAiCompatibleToolResponse;
  const config = input.config || getOpenAiCompatibleAgentConfig();
  const maxSteps = input.maxSteps || DEFAULT_MAX_STEPS;

  const messages: AiChatMessage[] = [
    { role: 'system', content: AGENT_SYSTEM_PROMPT },
    { role: 'user', content: buildUserContent(input) },
  ];

  const assistantMessages: { id: string; content: string }[] = [];
  const proposalIds: string[] = [];

  for (let step = 0; step < maxSteps; step += 1) {
    const result = await generate({ messages, tools: AGENT_TOOLS, config });

    const assistantRecord = await db.aiMessage.create({
      data: {
        sessionId: input.sessionId,
        role: 'assistant',
        content: result.content,
        model: result.model,
        metadataJson: toJson({
          provider: 'agent',
          mode: 'agent',
          toolCalls: result.toolCalls,
          finishReason: result.finishReason,
          reasoning: result.reasoning,
          usage: result.usage,
        }),
      },
    });

    if (result.content) {
      assistantMessages.push({ id: assistantRecord.id, content: result.content });
      await logSessionEvent({
        sessionId: input.sessionId,
        type: 'ai_agent_message',
        actor: 'ai',
        payload: { aiMessageId: assistantRecord.id, responseLength: result.content.length, usage: result.usage },
      });
    }

    if (!result.toolCalls.length) {
      return { assistantMessages, proposalIds, stopReason: 'answered' };
    }

    // Record the assistant turn (with tool calls) in history, then execute.
    messages.push({ role: 'assistant', content: result.content, toolCalls: result.toolCalls });

    let proposedThisStep = false;
    for (const call of result.toolCalls) {
      const executed = await executeToolCall({
        sessionId: input.sessionId,
        call,
        files: input.files,
        aiMessageId: assistantRecord.id,
      });
      if (executed.proposalId) {
        proposalIds.push(executed.proposalId);
        proposedThisStep = true;
      }
      messages.push({ role: 'tool', toolCallId: call.id, name: call.name, content: executed.content });
    }

    // Pause for candidate review once edits are queued.
    if (proposedThisStep) {
      return { assistantMessages, proposalIds, stopReason: 'awaiting_approval' };
    }
  }

  await logSessionEvent({
    sessionId: input.sessionId,
    type: 'ai_agent_step_limit_reached',
    actor: 'system',
    payload: { maxSteps },
  });

  return { assistantMessages, proposalIds, stopReason: 'step_limit' };
}
