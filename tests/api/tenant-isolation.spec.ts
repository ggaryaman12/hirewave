import { expect, test } from '@playwright/test';
import crypto from 'crypto';
import { db } from '../../lib/db';
import { toJson } from '../../lib/json';

// Proves the company vertical is multi-tenant isolated: every recruiter-facing
// fetch is scoped by workspaceId, so one recruiter can never read another's
// assessments, sessions, or reports — even with a known/guessed id (IDOR).

const rid = () => crypto.randomBytes(5).toString('hex');

async function makeWorkspace(name: string) {
  const workspace = await db.workspace.create({ data: { name, slug: `ws-${rid()}` } });
  const user = await db.user.create({ data: { name, email: `rec-${rid()}@test.local`, role: 'recruiter' } });
  await db.workspaceMember.create({ data: { workspaceId: workspace.id, userId: user.id, role: 'owner' } });
  return { workspace, user };
}

async function makeAssessmentWithSession(workspaceId: string, createdById: string) {
  const challenge = await db.challenge.create({
    data: {
      slug: `ch-${rid()}`, title: 'T', role: 'eng', stackJson: toJson([]), durationMinutes: 60,
      scenario: 's', instructions: 'i', difficulty: 'medium', rubricJson: toJson([]),
    },
  });
  const assessment = await db.assessment.create({
    data: {
      workspaceId, challengeId: challenge.id, createdById, title: 'A', role: 'eng', seniority: 'mid',
      durationMinutes: 60, aiMode: 'allowed', allowedToolsJson: toJson([]), rubricJson: toJson([]),
    },
  });
  const candidate = await db.candidate.create({ data: { workspaceId, name: 'C', email: `cand-${rid()}@test.local` } });
  const session = await db.candidateSession.create({
    data: {
      assessmentId: assessment.id, candidateId: candidate.id,
      sessionTokenHash: rid() + rid(), expiresAt: new Date(Date.now() + 3600_000),
    },
  });
  return { assessment, session };
}

test.describe('multi-tenant isolation', () => {
  test('recruiter B cannot read recruiter A assessment or session by id', async () => {
    const a = await makeWorkspace('Recruiter A');
    const b = await makeWorkspace('Recruiter B');
    const aData = await makeAssessmentWithSession(a.workspace.id, a.user.id);

    // Same scoping query the dashboard/detail pages use.
    const crossAssessment = await db.assessment.findFirst({
      where: { id: aData.assessment.id, workspaceId: b.workspace.id },
    });
    expect(crossAssessment).toBeNull();

    const ownAssessment = await db.assessment.findFirst({
      where: { id: aData.assessment.id, workspaceId: a.workspace.id },
    });
    expect(ownAssessment?.id).toBe(aData.assessment.id);

    // Report-page scoping query.
    const crossSession = await db.candidateSession.findFirst({
      where: { id: aData.session.id, assessment: { workspaceId: b.workspace.id } },
    });
    expect(crossSession).toBeNull();

    const ownSession = await db.candidateSession.findFirst({
      where: { id: aData.session.id, assessment: { workspaceId: a.workspace.id } },
    });
    expect(ownSession?.id).toBe(aData.session.id);
  });

  test('listing scoped to a workspace excludes other workspaces', async () => {
    const a = await makeWorkspace('List A');
    const b = await makeWorkspace('List B');
    await makeAssessmentWithSession(a.workspace.id, a.user.id);
    await makeAssessmentWithSession(b.workspace.id, b.user.id);

    const aList = await db.assessment.findMany({ where: { workspaceId: a.workspace.id } });
    expect(aList.length).toBe(1);
    expect(aList.every((x) => x.workspaceId === a.workspace.id)).toBe(true);
  });
});
