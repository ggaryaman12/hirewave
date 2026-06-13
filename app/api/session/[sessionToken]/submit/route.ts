import { NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { generateEvaluationReport } from '@/lib/evaluation/generate-report';
import { getSessionByToken } from '@/lib/sessions';
import { logSessionEvent } from '@/lib/telemetry';

export async function POST(_: Request, { params }: { params: { sessionToken: string } }) {
  const session = await getSessionByToken(params.sessionToken);
  if (!session) return NextResponse.json({ error: 'Session not found' }, { status: 404 });

  if (session.evaluationReport) {
    return NextResponse.json({
      completionUrl: `/session/${params.sessionToken}/complete`,
      reportUrl: `/dashboard/reports/${session.id}`,
      reportId: session.evaluationReport.id,
    });
  }

  const submittedAt = new Date();
  await db.candidateSession.update({
    where: { id: session.id },
    data: {
      status: 'submitted',
      submittedAt,
    },
  });

  await logSessionEvent({
    sessionId: session.id,
    type: 'session_ended',
    actor: 'system',
    payload: {
      reason: 'candidate_submitted',
      submittedAt: submittedAt.toISOString(),
    },
  });

  const report = await generateEvaluationReport(session.id);

  return NextResponse.json({
    completionUrl: `/session/${params.sessionToken}/complete`,
    reportUrl: `/dashboard/reports/${session.id}`,
    reportId: report.id,
  });
}
