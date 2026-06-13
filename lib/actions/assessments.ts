'use server';

import { redirect } from 'next/navigation';
import { z } from 'zod';
import { requireHiringUser } from '@/lib/auth/demo-auth';
import { isDraftDifficulty } from '@/lib/challenge-builder/templates';
import {
  approveCustomChallengeDraft,
  createCustomChallengeDraft,
  ENTERPRISE_RUBRIC,
  ensureChallengeCatalog,
} from '@/lib/challenge-catalog';
import { db } from '@/lib/db';
import { toJson } from '@/lib/json';
import { generateToken, tokenHash } from '@/lib/tokens';

const assessmentSchema = z.object({
  title: z.string().min(3).max(120),
  role: z.string().min(2).max(80),
  seniority: z.string().min(2).max(40),
  durationMinutes: z.coerce.number().int().min(15).max(180),
  aiMode: z.enum(['allowed', 'required', 'disabled']),
  challengeId: z.string().min(1),
});

export async function createAssessmentAction(formData: FormData) {
  const { user, workspace } = await requireHiringUser();
  await ensureChallengeCatalog();

  const parsed = assessmentSchema.parse({
    title: formData.get('title'),
    role: formData.get('role'),
    seniority: formData.get('seniority'),
    durationMinutes: formData.get('durationMinutes'),
    aiMode: formData.get('aiMode'),
    challengeId: formData.get('challengeId'),
  });

  const challenge = await db.challenge.findUnique({
    where: { id: parsed.challengeId },
  });
  if (!challenge) {
    throw new Error('Selected challenge template does not exist.');
  }
  if (isDraftDifficulty(challenge.difficulty)) {
    throw new Error('Custom challenge drafts must be approved before creating an assessment.');
  }

  const assessment = await db.assessment.create({
    data: {
      workspaceId: workspace.id,
      challengeId: parsed.challengeId,
      createdById: user.id,
      title: parsed.title,
      role: parsed.role,
      seniority: parsed.seniority,
      durationMinutes: parsed.durationMinutes,
      aiMode: parsed.aiMode,
      allowedToolsJson: toJson(['Hirewave AI assistant', 'Terminal', 'Test runner', 'File editor']),
      rubricJson: challenge.rubricJson || toJson(ENTERPRISE_RUBRIC),
      status: 'active',
    },
  });

  const token = generateToken('inv');
  await db.inviteLink.create({
    data: {
      assessmentId: assessment.id,
      tokenHash: tokenHash(token),
      publicToken: token,
      label: 'Primary invite',
      status: 'active',
    },
  });

  redirect(`/dashboard/assessments/${assessment.id}`);
}

export async function createCustomChallengeDraftAction(formData: FormData) {
  await requireHiringUser('/dashboard/assessments/new');
  await ensureChallengeCatalog();

  const stack = String(formData.get('stack') || '')
    .split(',')
    .map((item) => item.trim())
    .filter(Boolean);
  const focusSkills = formData.getAll('focusSkills').map((item) => String(item));

  const challenge = await createCustomChallengeDraft({
    title: String(formData.get('title') || ''),
    role: String(formData.get('role') || ''),
    seniority: String(formData.get('seniority') || ''),
    taskType: String(formData.get('taskType') || ''),
    domain: String(formData.get('domain') || ''),
    durationMinutes: Number(formData.get('durationMinutes') || 60),
    stack,
    failureMode: String(formData.get('failureMode') || ''),
    focusSkills,
    context: String(formData.get('context') || ''),
  });

  redirect(`/dashboard/assessments/new?customChallengeId=${challenge.id}`);
}

export async function approveCustomChallengeDraftAction(formData: FormData) {
  await requireHiringUser('/dashboard/assessments/new');
  const challengeId = String(formData.get('challengeId') || '');
  if (!challengeId) {
    throw new Error('Missing custom challenge draft id.');
  }

  const challenge = await approveCustomChallengeDraft(challengeId);
  redirect(`/dashboard/assessments/new?customChallengeId=${challenge.id}`);
}
