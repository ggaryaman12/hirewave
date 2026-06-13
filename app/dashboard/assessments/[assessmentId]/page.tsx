import Link from 'next/link';
import { Copy, ExternalLink, UserRound } from 'lucide-react';
import { ProductShell } from '@/components/product/app-shell';
import { StatusPill } from '@/components/product/status-pill';
import { requireHiringUser } from '@/lib/auth/demo-auth';
import { db } from '@/lib/db';
import { parseJson } from '@/lib/json';

export default async function AssessmentDetailPage({ params }: { params: { assessmentId: string } }) {
  const { workspace } = await requireHiringUser(`/dashboard/assessments/${params.assessmentId}`);
  const assessment = await db.assessment.findFirst({
    where: { id: params.assessmentId, workspaceId: workspace.id },
    include: {
      challenge: { include: { files: { orderBy: { sortOrder: 'asc' } } } },
      inviteLinks: { orderBy: { createdAt: 'desc' } },
      sessions: {
        orderBy: { createdAt: 'desc' },
        include: {
          candidate: true,
          evaluationReport: true,
          commandRuns: true,
          aiMessages: true,
        },
      },
    },
  });

  if (!assessment) {
    return (
      <ProductShell title="Assessment not found">
        <p className="text-sm text-black/60">This assessment does not exist in the current workspace.</p>
      </ProductShell>
    );
  }

  const invite = assessment.inviteLinks[0];
  const invitePath = invite?.publicToken ? `/invite/${invite.publicToken}` : null;
  const inviteUrl = invitePath ? `http://localhost:3737${invitePath}` : 'No invite link available';

  return (
    <ProductShell
      title={assessment.title}
      subtitle={`${assessment.role} · ${assessment.seniority} · ${assessment.durationMinutes} minutes`}
      action={
        invitePath ? (
          <Link
            href={invitePath}
            className="inline-flex h-10 items-center gap-2 rounded-md bg-[#111] px-4 text-sm font-bold text-paper hover:bg-black"
          >
            Open invite <ExternalLink className="h-4 w-4" />
          </Link>
        ) : null
      }
    >
      <div className="grid gap-6 lg:grid-cols-[0.8fr_1.2fr]">
        <section className="rounded-xl border border-black/10 bg-white/60 p-6">
          <div className="flex items-center justify-between gap-3">
            <div>
              <p className="text-xs font-bold uppercase tracking-[0.18em] text-black/45">Candidate link</p>
              <p className="mt-2 break-all font-mono text-sm text-black/75">{inviteUrl}</p>
            </div>
            <Copy className="h-5 w-5 text-black/35" />
          </div>

          <div className="mt-6 rounded-lg border border-black/10 bg-[#f7f0e7] p-4">
            <h2 className="font-black">{assessment.challenge.title}</h2>
            <p className="mt-2 text-sm leading-6 text-black/65">{assessment.challenge.scenario}</p>
            <div className="mt-4 flex flex-wrap gap-2">
              {parseJson<string[]>(assessment.challenge.stackJson, []).map((item) => (
                <span key={item} className="rounded-full bg-white px-3 py-1 text-xs font-bold text-black/60">
                  {item}
                </span>
              ))}
            </div>
          </div>

          <div className="mt-6 grid gap-3 text-sm">
            <Detail label="AI mode" value={assessment.aiMode} />
            <Detail label="Allowed tools" value={parseJson<string[]>(assessment.allowedToolsJson, []).join(', ')} />
            <Detail label="Starter files" value={`${assessment.challenge.files.length} files`} />
          </div>
        </section>

        <section className="rounded-xl border border-black/10 bg-white/60 p-6">
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-black">Candidate sessions</h2>
            <StatusPill status={assessment.status} />
          </div>

          {assessment.sessions.length === 0 ? (
            <div className="mt-5 rounded-lg border border-dashed border-black/15 p-8 text-center">
              <UserRound className="mx-auto h-8 w-8 text-black/30" />
              <h3 className="mt-3 font-black">No candidates yet</h3>
              <p className="mt-1 text-sm text-black/55">Share the invite link to create the first accountless candidate session.</p>
            </div>
          ) : (
            <div className="mt-5 grid gap-3">
              {assessment.sessions.map((session) => (
                <Link
                  key={session.id}
                  href={session.evaluationReport ? `/dashboard/reports/${session.id}` : '#'}
                  className="rounded-lg border border-black/10 bg-[#f7f0e7] p-4 hover:bg-white"
                >
                  <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
                    <div>
                      <p className="font-bold">{session.candidate.name}</p>
                      <p className="text-sm text-black/55">{session.candidate.email}</p>
                    </div>
                    <div className="flex flex-wrap items-center gap-2">
                      <StatusPill status={session.status} />
                      <span className="rounded-full bg-white px-3 py-1 text-xs font-bold text-black/55">
                        {session.aiMessages.length} AI messages
                      </span>
                      <span className="rounded-full bg-white px-3 py-1 text-xs font-bold text-black/55">
                        {session.commandRuns.length} commands
                      </span>
                    </div>
                  </div>
                </Link>
              ))}
            </div>
          )}
        </section>
      </div>
    </ProductShell>
  );
}

function Detail({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-start justify-between gap-3 border-t border-black/10 pt-3">
      <span className="font-bold text-black/55">{label}</span>
      <span className="max-w-[60%] text-right text-black/75">{value}</span>
    </div>
  );
}
