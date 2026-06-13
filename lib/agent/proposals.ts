import { db } from '@/lib/db';
import { buildFileDiff } from '@/lib/diff/text-diff';
import { toJson } from '@/lib/json';
import { logSessionEvent } from '@/lib/telemetry';
import { validateWorkspacePath } from '@/lib/workspace-paths';

export type ProposalDecision = 'approve' | 'reject';

async function latestSnapshotForPath(sessionId: string, path: string) {
  return db.fileSnapshot.findFirst({
    where: { sessionId, path },
    orderBy: { version: 'desc' },
  });
}

export function serializeProposal(proposal: {
  id: string;
  path: string;
  newContent: string;
  diffJson: string;
  rationale: string | null;
  status: string;
  decisionReason: string | null;
  createdAt: Date;
  decidedAt: Date | null;
}) {
  return {
    id: proposal.id,
    path: proposal.path,
    rationale: proposal.rationale,
    status: proposal.status,
    decisionReason: proposal.decisionReason,
    diff: (() => {
      try {
        return JSON.parse(proposal.diffJson);
      } catch {
        return null;
      }
    })(),
    createdAt: proposal.createdAt.toISOString(),
    decidedAt: proposal.decidedAt ? proposal.decidedAt.toISOString() : null,
  };
}

// Queues a proposed edit (from the agent's propose_edit tool). Never writes the
// file; the candidate must approve it. Returns a result the loop can feed back
// to the agent as a tool result.
export async function createProposal(input: {
  sessionId: string;
  toolCallId: string;
  aiMessageId?: string;
  path: string;
  newContent: string;
  rationale?: string;
}) {
  const workspacePath = validateWorkspacePath(input.path);
  if (!workspacePath.ok) {
    return { ok: false as const, reason: workspacePath.reason };
  }

  const latest = await latestSnapshotForPath(input.sessionId, workspacePath.path);
  const diff = buildFileDiff({
    path: workspacePath.path,
    language: latest?.language || 'text',
    originalContent: latest?.content || '',
    currentContent: input.newContent,
  });

  const proposal = await db.agentProposal.create({
    data: {
      sessionId: input.sessionId,
      aiMessageId: input.aiMessageId,
      toolCallId: input.toolCallId,
      path: workspacePath.path,
      newContent: input.newContent,
      diffJson: toJson(diff),
      rationale: input.rationale,
      status: 'pending',
    },
  });

  await logSessionEvent({
    sessionId: input.sessionId,
    type: 'ai_agent_edit_proposed',
    actor: 'ai',
    payload: {
      proposalId: proposal.id,
      path: proposal.path,
      additions: diff.additions,
      deletions: diff.deletions,
    },
  });

  return { ok: true as const, proposal };
}

export async function approveProposal(input: { sessionId: string; proposalId: string }) {
  const proposal = await db.agentProposal.findFirst({
    where: { id: input.proposalId, sessionId: input.sessionId },
  });
  if (!proposal) return { ok: false as const, reason: 'not_found' };
  if (proposal.status !== 'pending') return { ok: false as const, reason: 'already_decided' };

  const latest = await latestSnapshotForPath(input.sessionId, proposal.path);

  // Apply the agent's edit, attributed to the agent (source: 'ai_agent').
  const snapshot = await db.fileSnapshot.create({
    data: {
      sessionId: input.sessionId,
      path: proposal.path,
      content: proposal.newContent,
      language: latest?.language || 'text',
      version: (latest?.version || 0) + 1,
      source: 'ai_agent',
    },
  });

  const updated = await db.agentProposal.update({
    where: { id: proposal.id },
    data: { status: 'approved', decidedAt: new Date() },
  });

  await logSessionEvent({
    sessionId: input.sessionId,
    type: 'candidate_edit_approved',
    actor: 'candidate',
    payload: { proposalId: proposal.id, path: proposal.path, version: snapshot.version, source: 'ai_agent' },
  });

  return { ok: true as const, proposal: updated, snapshot };
}

export async function rejectProposal(input: { sessionId: string; proposalId: string; reason?: string }) {
  const proposal = await db.agentProposal.findFirst({
    where: { id: input.proposalId, sessionId: input.sessionId },
  });
  if (!proposal) return { ok: false as const, reason: 'not_found' };
  if (proposal.status !== 'pending') return { ok: false as const, reason: 'already_decided' };

  const updated = await db.agentProposal.update({
    where: { id: proposal.id },
    data: { status: 'rejected', decisionReason: input.reason, decidedAt: new Date() },
  });

  await logSessionEvent({
    sessionId: input.sessionId,
    type: 'candidate_edit_rejected',
    actor: 'candidate',
    payload: { proposalId: proposal.id, path: proposal.path, reason: input.reason || null },
  });

  return { ok: true as const, proposal: updated };
}

export async function listProposals(sessionId: string) {
  return db.agentProposal.findMany({
    where: { sessionId },
    orderBy: { createdAt: 'asc' },
  });
}
