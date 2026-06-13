import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { db } from '@/lib/db';
import { getLatestFiles, getSessionByToken } from '@/lib/sessions';
import { logSessionEvent } from '@/lib/telemetry';
import { runAgentTurn } from '@/lib/agent/agent-loop';
import { approveProposal, listProposals, rejectProposal, serializeProposal } from '@/lib/agent/proposals';

const messageSchema = z.object({ message: z.string().min(1).max(4000) });
const decisionSchema = z.object({
  proposalId: z.string().min(1),
  decision: z.enum(['approve', 'reject']),
  reason: z.string().max(2000).optional(),
});

const AGENT_FALLBACK_CONTENT =
  'The AI agent is temporarily unavailable. Your request was saved; try again, or inspect the failing files and tests directly while the provider recovers.';

function errorMessage(error: unknown) {
  return error instanceof Error ? error.message : 'Agent request failed';
}

async function pendingProposalsPayload(sessionId: string) {
  const proposals = await listProposals(sessionId);
  return proposals.filter((proposal) => proposal.status === 'pending').map(serializeProposal);
}

export async function POST(request: NextRequest, { params }: { params: { sessionToken: string } }) {
  const session = await getSessionByToken(params.sessionToken);
  if (!session) return NextResponse.json({ error: 'Session not found' }, { status: 404 });

  if (session.assessment.aiMode !== 'agent') {
    return NextResponse.json({ error: 'Agent mode is not enabled for this assessment' }, { status: 409 });
  }

  if (['submitted', 'expired', 'report_ready'].includes(session.status)) {
    return NextResponse.json({ error: 'Session is closed' }, { status: 409 });
  }

  const body = await request.json();

  // --- Approve / reject a pending proposal (no provider call) ---
  const decision = decisionSchema.safeParse(body);
  if (decision.success) {
    const result =
      decision.data.decision === 'approve'
        ? await approveProposal({ sessionId: session.id, proposalId: decision.data.proposalId })
        : await rejectProposal({
            sessionId: session.id,
            proposalId: decision.data.proposalId,
            reason: decision.data.reason,
          });

    if (!result.ok) {
      const status = result.reason === 'not_found' ? 404 : 409;
      return NextResponse.json({ error: `Proposal ${result.reason}` }, { status });
    }

    return NextResponse.json({
      proposal: serializeProposal(result.proposal),
      pendingProposals: await pendingProposalsPayload(session.id),
    });
  }

  // --- New agent turn ---
  const { message } = messageSchema.parse(body);

  const userMessage = await db.aiMessage.create({
    data: { sessionId: session.id, role: 'user', content: message, model: null },
  });
  await logSessionEvent({
    sessionId: session.id,
    type: 'ai_prompt_sent',
    actor: 'candidate',
    payload: { aiMessageId: userMessage.id, promptLength: message.length, mode: 'agent' },
  });

  const files = await getLatestFiles(session.id);
  const challenge = {
    title: session.assessment.challenge.title,
    role: session.assessment.role,
    instructions: [session.assessment.challenge.scenario, session.assessment.challenge.instructions]
      .filter(Boolean)
      .join('\n\n'),
  };

  try {
    const turn = await runAgentTurn({
      sessionId: session.id,
      candidateMessage: message,
      challenge,
      files: files.map((file) => ({ path: file.path, content: file.content, language: file.language })),
    });

    return NextResponse.json({
      assistantMessages: turn.assistantMessages,
      pendingProposals: await pendingProposalsPayload(session.id),
      stopReason: turn.stopReason,
    });
  } catch (error) {
    await logSessionEvent({
      sessionId: session.id,
      type: 'error_occurred',
      actor: 'system',
      payload: { source: 'agent_provider', message: 'Agent provider request failed', error: errorMessage(error) },
    });

    const fallback = await db.aiMessage.create({
      data: {
        sessionId: session.id,
        role: 'assistant',
        content: AGENT_FALLBACK_CONTENT,
        model: 'agent-provider-error-fallback',
        metadataJson: JSON.stringify({ provider: 'fallback', mode: 'agent', safetyFlags: ['provider_error'] }),
      },
    });

    return NextResponse.json({
      assistantMessages: [{ id: fallback.id, content: AGENT_FALLBACK_CONTENT }],
      pendingProposals: await pendingProposalsPayload(session.id),
      stopReason: 'answered',
    });
  }
}
