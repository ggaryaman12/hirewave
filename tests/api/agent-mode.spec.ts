import { expect, test } from '@playwright/test';
import { NextRequest } from 'next/server';
import crypto from 'crypto';
import { POST as postAgent } from '../../app/api/session/[sessionToken]/agent/route';
import { db } from '../../lib/db';
import { tokenHash } from '../../lib/tokens';
import { runAgentTurn } from '../../lib/agent/agent-loop';
import { runAgentCommand } from '../../lib/agent/command-runner';
import { approveProposal, createProposal, rejectProposal } from '../../lib/agent/proposals';
import type { AiToolCall, AiToolChatResult } from '../../lib/ai/types';
import { createCandidateSessionFixture, getSeededAssessment, uniqueTestEmail } from '../helpers/session-fixtures';

function toolResult(overrides: Partial<AiToolChatResult> = {}): AiToolChatResult {
  return {
    content: '',
    toolCalls: [],
    model: 'mock-agent-model',
    usage: {
      promptChars: 10,
      responseChars: 0,
      includedFiles: [],
      promptTokens: 3,
      completionTokens: 2,
      totalTokens: 5,
      tokenSource: 'estimated',
    },
    ...overrides,
  };
}

function call(name: string, args: Record<string, unknown>): AiToolCall {
  return { id: `call_${name}_${crypto.randomBytes(3).toString('hex')}`, name, args };
}

// Scripts a multi-step tool generator: returns the next queued result per call.
function scriptedGenerator(results: AiToolChatResult[]) {
  let index = 0;
  return async () => results[index++] ?? toolResult({ content: 'done' });
}

const agentChallenge = {
  title: 'Debug the Broken Checkout Flow',
  role: 'Full-stack Engineer',
  instructions: 'Fix cart validation and related checkout logic.',
};

async function createAgentSessionFixture(emailPrefix: string) {
  const seeded = await getSeededAssessment();
  const now = new Date();
  const assessment = await db.assessment.create({
    data: {
      workspaceId: seeded.workspaceId,
      challengeId: seeded.challengeId,
      createdById: seeded.createdById,
      title: 'Agent Mode Screen',
      role: seeded.role,
      seniority: seeded.seniority,
      durationMinutes: seeded.durationMinutes,
      aiMode: 'agent',
      allowedToolsJson: JSON.stringify(['Hirewave AI agent', 'Terminal', 'Test runner', 'File editor']),
      rubricJson: seeded.rubricJson,
    },
  });
  const candidate = await db.candidate.create({
    data: { workspaceId: seeded.workspaceId, name: 'Agent Candidate', email: uniqueTestEmail(emailPrefix) },
  });
  const sessionToken = `test_agent_${crypto.randomBytes(16).toString('hex')}`;
  const session = await db.candidateSession.create({
    data: {
      assessmentId: assessment.id,
      candidateId: candidate.id,
      sessionTokenHash: tokenHash(sessionToken),
      status: 'started',
      startedAt: now,
      expiresAt: new Date(now.getTime() + 90 * 60 * 1000),
    },
  });
  await db.fileSnapshot.createMany({
    data: seeded.challenge.files.map((file) => ({
      sessionId: session.id,
      path: file.path,
      content: file.content,
      language: file.language,
      version: 1,
      source: 'starter',
    })),
  });
  return { assessment, session, sessionToken };
}

test.describe('Agent mode (Slice 1)', () => {
  test('runs read tools then queues a proposal without writing the file', async () => {
    const { session } = await createCandidateSessionFixture({ email: uniqueTestEmail('agent-loop') });
    const files = await db.fileSnapshot.findMany({ where: { sessionId: session.id } });
    const targetPath = files.find((file) => file.path.endsWith('cart.ts'))?.path || files[0].path;

    const generateTool = scriptedGenerator([
      toolResult({ toolCalls: [call('run_command', { command: `cat ${targetPath}` })] }),
      toolResult({ toolCalls: [call('propose_edit', { path: targetPath, newContent: '// agent edit\n', rationale: 'tighten validation' })] }),
    ]);

    const result = await runAgentTurn({
      sessionId: session.id,
      candidateMessage: 'Please fix the cart validation.',
      challenge: agentChallenge,
      files: files.map((file) => ({ path: file.path, content: file.content, language: file.language })),
      generateTool,
    });

    expect(result.stopReason).toBe('awaiting_approval');
    expect(result.proposalIds).toHaveLength(1);

    const proposals = await db.agentProposal.findMany({ where: { sessionId: session.id } });
    expect(proposals).toHaveLength(1);
    expect(proposals[0].status).toBe('pending');

    // propose_edit must NOT have written a file snapshot yet.
    const agentSnapshots = await db.fileSnapshot.findMany({ where: { sessionId: session.id, source: 'ai_agent' } });
    expect(agentSnapshots).toHaveLength(0);

    const events = await db.sessionEvent.findMany({ where: { sessionId: session.id } });
    const types = events.map((event) => event.type);
    expect(types).toContain('ai_agent_command_run');
    expect(types).toContain('ai_agent_edit_proposed');

    const commandRuns = await db.commandRun.findMany({ where: { sessionId: session.id } });
    expect(commandRuns.some((run) => run.command === `cat ${targetPath}`)).toBeTruthy();
  });

  test('returns a final answer when the agent emits content with no tool calls', async () => {
    const { session } = await createCandidateSessionFixture({ email: uniqueTestEmail('agent-answer') });
    const files = await db.fileSnapshot.findMany({ where: { sessionId: session.id } });

    const result = await runAgentTurn({
      sessionId: session.id,
      candidateMessage: 'What is the plan?',
      challenge: agentChallenge,
      files: files.map((file) => ({ path: file.path, content: file.content, language: file.language })),
      generateTool: scriptedGenerator([toolResult({ content: 'Here is the plan: inspect cart, then payment.' })]),
    });

    expect(result.stopReason).toBe('answered');
    expect(result.assistantMessages).toHaveLength(1);
    expect(result.assistantMessages[0].content).toContain('plan');
    expect(result.proposalIds).toHaveLength(0);
  });

  test('approve applies the edit as an ai_agent snapshot; reject records the reason', async () => {
    const { session } = await createCandidateSessionFixture({ email: uniqueTestEmail('agent-decide') });
    const files = await db.fileSnapshot.findMany({ where: { sessionId: session.id } });
    const targetPath = files[0].path;

    const created = await createProposal({
      sessionId: session.id,
      toolCallId: 'call_x',
      path: targetPath,
      newContent: '// approved agent content\n',
      rationale: 'fix',
    });
    expect(created.ok).toBeTruthy();
    if (!created.ok) return;

    const approved = await approveProposal({ sessionId: session.id, proposalId: created.proposal.id });
    expect(approved.ok).toBeTruthy();

    const snapshot = await db.fileSnapshot.findFirst({
      where: { sessionId: session.id, path: targetPath, source: 'ai_agent' },
      orderBy: { version: 'desc' },
    });
    expect(snapshot?.content).toBe('// approved agent content\n');

    const refetched = await db.agentProposal.findUniqueOrThrow({ where: { id: created.proposal.id } });
    expect(refetched.status).toBe('approved');

    const approvedEvents = await db.sessionEvent.findMany({
      where: { sessionId: session.id, type: 'candidate_edit_approved' },
    });
    expect(approvedEvents).toHaveLength(1);

    // Now a reject path on a fresh proposal.
    const second = await createProposal({
      sessionId: session.id,
      toolCallId: 'call_y',
      path: targetPath,
      newContent: '// rejected content\n',
    });
    if (!second.ok) return;
    const rejected = await rejectProposal({
      sessionId: session.id,
      proposalId: second.proposal.id,
      reason: 'wrong approach',
    });
    expect(rejected.ok).toBeTruthy();

    const refetched2 = await db.agentProposal.findUniqueOrThrow({ where: { id: second.proposal.id } });
    expect(refetched2.status).toBe('rejected');
    expect(refetched2.decisionReason).toBe('wrong approach');
  });

  test('run_command blocks commands outside the read-only allowlist', async () => {
    const { session } = await createCandidateSessionFixture({ email: uniqueTestEmail('agent-block') });
    const result = await runAgentCommand({ sessionId: session.id, command: 'rm -rf src', files: [] });
    expect(result.status).toBe('blocked');
    expect(result.allowed).toBeFalsy();

    const blockedEvent = await db.sessionEvent.findFirst({
      where: { sessionId: session.id, type: 'ai_agent_command_run' },
    });
    expect(JSON.parse(blockedEvent?.payloadJson || '{}').blocked).toBe(true);
  });

  test('agent route returns 409 when the assessment is not in agent mode', async () => {
    const { sessionToken } = await createCandidateSessionFixture({ email: uniqueTestEmail('agent-409') });
    const response = await postAgent(
      new NextRequest(`http://127.0.0.1/api/session/${sessionToken}/agent`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ message: 'help' }),
      }),
      { params: { sessionToken } },
    );
    expect(response.status).toBe(409);
  });

  test('agent route approves a pending proposal in agent mode', async () => {
    const { session, sessionToken } = await createAgentSessionFixture('agent-route-approve');
    const files = await db.fileSnapshot.findMany({ where: { sessionId: session.id } });
    const created = await createProposal({
      sessionId: session.id,
      toolCallId: 'call_route',
      path: files[0].path,
      newContent: '// route approved\n',
    });
    if (!created.ok) return;

    const response = await postAgent(
      new NextRequest(`http://127.0.0.1/api/session/${sessionToken}/agent`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ proposalId: created.proposal.id, decision: 'approve' }),
      }),
      { params: { sessionToken } },
    );

    expect(response.status).toBe(200);
    const body = await response.json();
    expect(body.proposal.status).toBe('approved');
    expect(body.pendingProposals).toHaveLength(0);

    const snapshot = await db.fileSnapshot.findFirst({
      where: { sessionId: session.id, source: 'ai_agent' },
    });
    expect(snapshot).toBeTruthy();
  });
});
