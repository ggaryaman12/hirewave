'use server';

import { redirect } from 'next/navigation';
import { z } from 'zod';
import { db } from '@/lib/db';
import { initializeSessionFiles } from '@/lib/sessions';
import { generateToken, tokenHash } from '@/lib/tokens';
import { logSessionEvent } from '@/lib/telemetry';

const candidateStartSchema = z.object({
  inviteToken: z.string().min(8),
  name: z.string().min(2).max(100),
  email: z.string().email().max(160),
});

export async function startCandidateSessionAction(formData: FormData) {
  const raw = {
    inviteToken: formData.get('inviteToken'),
    name: formData.get('name'),
    email: formData.get('email'),
  };
  const parsed = candidateStartSchema.safeParse(raw);

  if (!parsed.success) {
    const inviteToken = typeof raw.inviteToken === 'string' ? raw.inviteToken : '';
    redirect(`/invite/${encodeURIComponent(inviteToken)}?error=invalid_details`);
  }

  const invite = await db.inviteLink.findUnique({
    where: { tokenHash: tokenHash(parsed.data.inviteToken) },
    include: {
      assessment: {
        include: {
          workspace: true,
          challenge: true,
        },
      },
    },
  });

  if (!invite || invite.status !== 'active') {
    redirect(`/invite/${encodeURIComponent(parsed.data.inviteToken)}?error=invite_unavailable`);
  }

  if (invite.expiresAt && invite.expiresAt < new Date()) {
    redirect(`/invite/${encodeURIComponent(parsed.data.inviteToken)}?error=invite_expired`);
  }

  if (invite.maxUses && invite.useCount >= invite.maxUses) {
    redirect(`/invite/${encodeURIComponent(parsed.data.inviteToken)}?error=invite_full`);
  }

  const sessionToken = generateToken('sess');
  const now = new Date();
  const expiresAt = new Date(now.getTime() + invite.assessment.durationMinutes * 60 * 1000);

  const { session } = await db.$transaction(async (tx) => {
    const candidate = await tx.candidate.create({
      data: {
        workspaceId: invite.assessment.workspaceId,
        name: parsed.data.name,
        email: parsed.data.email,
      },
    });

    const createdSession = await tx.candidateSession.create({
      data: {
        assessmentId: invite.assessmentId,
        candidateId: candidate.id,
        inviteLinkId: invite.id,
        sessionTokenHash: tokenHash(sessionToken),
        status: 'started',
        startedAt: now,
        expiresAt,
      },
    });

    await tx.inviteLink.update({
      where: { id: invite.id },
      data: { useCount: { increment: 1 } },
    });

    return { session: createdSession };
  });

  await initializeSessionFiles({
    sessionId: session.id,
    challengeId: invite.assessment.challengeId,
  });

  await logSessionEvent({
    sessionId: session.id,
    type: 'session_started',
    actor: 'system',
    payload: {
      candidateEmail: parsed.data.email,
      assessmentId: invite.assessmentId,
      durationMinutes: invite.assessment.durationMinutes,
    },
  });

  redirect(`/session/${sessionToken}`);
}
