import Link from 'next/link';
import { ArrowRight, Clock, FileCode2, PlusCircle, Users } from 'lucide-react';
import { ProductShell } from '@/components/product/app-shell';
import { StatusPill } from '@/components/product/status-pill';
import { requireHiringUser } from '@/lib/auth/demo-auth';
import { ensureChallengeCatalog } from '@/lib/challenge-catalog';
import { db } from '@/lib/db';

export default async function DashboardPage() {
  const { workspace } = await requireHiringUser();
  await ensureChallengeCatalog();

  const assessments = await db.assessment.findMany({
    where: { workspaceId: workspace.id },
    orderBy: { createdAt: 'desc' },
    include: {
      challenge: true,
      inviteLinks: true,
      sessions: {
        include: {
          candidate: true,
          evaluationReport: true,
        },
        orderBy: { createdAt: 'desc' },
      },
    },
  });

  const totalSessions = assessments.reduce((sum, assessment) => sum + assessment.sessions.length, 0);
  const submitted = assessments.reduce(
    (sum, assessment) => sum + assessment.sessions.filter((session) => ['submitted', 'report_ready'].includes(session.status)).length,
    0,
  );

  return (
    <ProductShell
      title="Hiring dashboard"
      subtitle={`${workspace.name} · AI-native engineering assessment workspace`}
      action={
        <Link
          href="/dashboard/assessments/new"
          className="inline-flex h-10 items-center gap-2 rounded-md bg-[#111] px-4 text-sm font-bold text-paper hover:bg-black"
        >
          <PlusCircle className="h-4 w-4" />
          New assessment
        </Link>
      }
    >
      <div className="grid gap-4 md:grid-cols-3">
        <Metric icon={FileCode2} label="Assessments" value={String(assessments.length)} />
        <Metric icon={Users} label="Candidate sessions" value={String(totalSessions)} />
        <Metric icon={Clock} label="Submitted" value={String(submitted)} />
      </div>

      <section className="mt-8">
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-black">Assessments</h2>
          <Link href="/dashboard/assessments/new" className="text-sm font-bold text-[#d12864] hover:text-[#111]">
            Create from template
          </Link>
        </div>

        {assessments.length === 0 ? (
          <div className="mt-4 rounded-xl border border-dashed border-black/15 bg-white/45 p-10 text-center">
            <h3 className="text-xl font-black">Create the first assessment</h3>
            <p className="mx-auto mt-2 max-w-lg text-sm text-black/60">
              Start from the curated challenge catalog or draft a controlled custom task. It creates an invite link and a candidate workflow with telemetry.
            </p>
            <Link
              href="/dashboard/assessments/new"
              className="mt-5 inline-flex items-center gap-2 rounded-md bg-[#111] px-4 py-2.5 text-sm font-bold text-paper"
            >
              Create assessment <ArrowRight className="h-4 w-4" />
            </Link>
          </div>
        ) : (
          <div className="mt-4 grid gap-4">
            {assessments.map((assessment) => (
              <Link
                key={assessment.id}
                href={`/dashboard/assessments/${assessment.id}`}
                className="group rounded-xl border border-black/10 bg-white/55 p-5 transition hover:-translate-y-0.5 hover:bg-white"
              >
                <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
                  <div>
                    <div className="flex flex-wrap items-center gap-2">
                      <h3 className="text-lg font-black">{assessment.title}</h3>
                      <StatusPill status={assessment.status} />
                    </div>
                    <p className="mt-2 text-sm text-black/60">
                      {assessment.role} · {assessment.seniority} · {assessment.durationMinutes} min · {assessment.challenge.title}
                    </p>
                  </div>
                  <div className="grid grid-cols-3 gap-2 text-center md:w-72">
                    <MiniMetric label="Invites" value={String(assessment.inviteLinks.length)} />
                    <MiniMetric label="Sessions" value={String(assessment.sessions.length)} />
                    <MiniMetric
                      label="Reports"
                      value={String(assessment.sessions.filter((session) => session.evaluationReport).length)}
                    />
                  </div>
                </div>
              </Link>
            ))}
          </div>
        )}
      </section>
    </ProductShell>
  );
}

function Metric({
  icon: Icon,
  label,
  value,
}: {
  icon: React.ComponentType<{ className?: string }>;
  label: string;
  value: string;
}) {
  return (
    <div className="rounded-xl border border-black/10 bg-white/55 p-5">
      <div className="flex items-center justify-between">
        <span className="text-sm font-semibold text-black/55">{label}</span>
        <Icon className="h-4 w-4 text-black/40" />
      </div>
      <p className="mt-4 text-3xl font-black">{value}</p>
    </div>
  );
}

function MiniMetric({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg border border-black/10 bg-[#f7f0e7] px-3 py-2">
      <p className="text-lg font-black">{value}</p>
      <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-black/45">{label}</p>
    </div>
  );
}
