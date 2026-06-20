import Link from 'next/link';
import { Activity, Award, Check, CircleDot, Code2, Flame, Percent, Target, Trophy } from 'lucide-react';
import { requireUser } from '@/lib/auth/session';
import { db } from '@/lib/db';
import { getProfileStats, type TopicStat } from '@/lib/dsa/profile';
import { parseCachedAnalysis } from '@/lib/dsa/ai-analysis';
import { AiAnalysisPanel } from '@/components/profile/ai-analysis-panel';
import { SignOutButton } from '@/components/profile/sign-out';

const DIFF_COLOR: Record<string, string> = {
  easy: 'text-emerald-300',
  medium: 'text-amber-300',
  hard: 'text-red-300',
};
const DIFF_BAR: Record<string, string> = {
  easy: 'bg-emerald-400',
  medium: 'bg-amber-400',
  hard: 'bg-red-400',
};

function verdictClass(v: string) {
  if (v === 'accepted') return 'text-emerald-300';
  if (v === 'tle' || v === 'mle') return 'text-amber-300';
  return 'text-red-300';
}

function pct(n: number, d: number) {
  return d > 0 ? Math.round((n / d) * 100) : 0;
}

export default async function ProfilePage() {
  const sessionUser = await requireUser();
  const [stats, dbUser] = await Promise.all([
    getProfileStats(sessionUser.id),
    db.user.findUnique({ where: { id: sessionUser.id }, include: { studentProfile: true } }),
  ]);
  const cached = parseCachedAnalysis(dbUser?.studentProfile?.aiAnalysisJson);
  const name = dbUser?.name || 'Student';
  const initial = name.charAt(0).toUpperCase();

  return (
    <div className="min-h-screen bg-[#111] text-paper">
      <header className="border-b border-white/10 bg-[#171717]">
        <div className="mx-auto flex max-w-5xl items-center justify-between gap-4 px-6 py-5">
          <div className="flex items-center gap-4">
            <div className="grid h-14 w-14 place-items-center rounded-full bg-gradient-to-br from-[#f15a29] to-[#d12864] text-xl font-black text-white">
              {initial}
            </div>
            <div>
              <h1 className="text-lg font-black">{name}</h1>
              <p className="text-xs text-white/45">{dbUser?.email}</p>
              <p className="mt-1 inline-flex items-center gap-1.5 text-[11px] font-bold text-white/60">
                <Trophy className="h-3 w-3 text-[#f15a29]" />
                {stats.solved > 0 ? `Rank #${stats.rank} of ${stats.totalStudents} · top ${100 - stats.percentile + 1}%` : 'Unranked — solve a problem to rank'}
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <Link href="/dsa" className="inline-flex items-center gap-2 rounded-md bg-[#f15a29] px-3 py-2 text-xs font-black text-white">
              <Code2 className="h-3.5 w-3.5" /> Practice
            </Link>
            <SignOutButton />
          </div>
        </div>
      </header>

      <main className="mx-auto grid max-w-5xl gap-6 px-6 py-8 lg:grid-cols-3">
        {/* Left column */}
        <div className="grid gap-6 lg:col-span-2">
          {/* Stat cards */}
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            <Stat icon={Check} label="Solved" value={`${stats.solved}`} sub={`/ ${stats.totalPublished}`} />
            <Stat icon={Percent} label="Acceptance" value={`${Math.round(stats.acceptanceRate * 100)}%`} sub={`${stats.acceptedSubmissions}/${stats.totalSubmissions}`} />
            <Stat icon={Flame} label="Streak" value={`${stats.streakDays}`} sub="days" />
            <Stat icon={CircleDot} label="Tried" value={`${stats.tried}`} sub="unsolved" />
          </div>

          {/* Difficulty breakdown */}
          <Section title="By difficulty" icon={Award}>
            <div className="grid gap-3">
              {(['easy', 'medium', 'hard'] as const).map((d) => {
                const s = stats.byDifficulty[d];
                return (
                  <div key={d}>
                    <div className="flex items-center justify-between text-xs">
                      <span className={`font-black uppercase tracking-wider ${DIFF_COLOR[d]}`}>{d}</span>
                      <span className="font-mono text-white/55">{s.solved} / {s.total}</span>
                    </div>
                    <div className="mt-1.5 h-2 overflow-hidden rounded-full bg-white/10">
                      <div className={`h-full rounded-full ${DIFF_BAR[d]}`} style={{ width: `${pct(s.solved, s.total)}%` }} />
                    </div>
                  </div>
                );
              })}
            </div>
          </Section>

          {/* Topic proficiency */}
          <Section title="Topic proficiency" icon={Target}>
            {stats.topics.length === 0 ? (
              <p className="text-sm text-white/45">No topics yet.</p>
            ) : (
              <div className="grid gap-2.5 sm:grid-cols-2">
                {stats.topics.map((t) => (
                  <TopicBar key={t.topicId} t={t} />
                ))}
              </div>
            )}
          </Section>

          {/* Recent activity */}
          <Section title="Recent activity" icon={Activity}>
            {stats.recent.length === 0 ? (
              <p className="text-sm text-white/45">No submissions yet. <Link href="/dsa" className="font-bold text-[#f15a29]">Start practicing.</Link></p>
            ) : (
              <div className="grid gap-1.5">
                {stats.recent.map((r) => (
                  <Link
                    key={r.id}
                    href={`/dsa/${r.slug}`}
                    className="flex items-center justify-between gap-3 rounded-lg border border-white/10 bg-white/[0.03] px-3 py-2 hover:border-[#f15a29]/40"
                  >
                    <span className="min-w-0 truncate text-sm font-bold text-white/85">{r.title}</span>
                    <span className="flex shrink-0 items-center gap-3 text-[11px]">
                      <span className="font-mono text-white/40">{r.language}</span>
                      <span className={`font-black uppercase tracking-wider ${verdictClass(r.verdict)}`}>{r.verdict.replace('_', ' ')}</span>
                    </span>
                  </Link>
                ))}
              </div>
            )}
          </Section>
        </div>

        {/* Right column */}
        <div className="grid content-start gap-6">
          <AiAnalysisPanel initial={cached} />

          <Section title="Languages" icon={Code2}>
            {stats.languages.length === 0 ? (
              <p className="text-sm text-white/45">No submissions yet.</p>
            ) : (
              <div className="flex flex-wrap gap-2">
                {stats.languages.map((l) => (
                  <span key={l.language} className="rounded-full border border-white/10 bg-white/[0.04] px-2.5 py-1 text-xs font-bold text-white/70">
                    {l.language} <span className="text-white/40">{l.count}</span>
                  </span>
                ))}
              </div>
            )}
          </Section>

          {stats.focusAreas.length > 0 && (
            <Section title="Focus areas" icon={Target}>
              <div className="grid gap-2.5">
                {stats.focusAreas.map((t) => (
                  <TopicBar key={t.topicId} t={t} />
                ))}
              </div>
            </Section>
          )}
        </div>
      </main>
    </div>
  );
}

function Stat({ icon: Icon, label, value, sub }: { icon: React.ComponentType<{ className?: string }>; label: string; value: string; sub?: string }) {
  return (
    <div className="rounded-xl border border-white/10 bg-white/[0.03] p-4">
      <Icon className="h-4 w-4 text-[#f15a29]" />
      <p className="mt-2 text-2xl font-black">{value} {sub && <span className="text-sm font-bold text-white/35">{sub}</span>}</p>
      <p className="text-[10px] font-bold uppercase tracking-[0.16em] text-white/40">{label}</p>
    </div>
  );
}

function Section({ title, icon: Icon, children }: { title: string; icon: React.ComponentType<{ className?: string }>; children: React.ReactNode }) {
  return (
    <section className="rounded-xl border border-white/10 bg-white/[0.02] p-5">
      <h3 className="mb-4 flex items-center gap-2 text-xs font-black uppercase tracking-[0.16em] text-white/45">
        <Icon className="h-4 w-4" /> {title}
      </h3>
      {children}
    </section>
  );
}

function TopicBar({ t }: { t: TopicStat }) {
  const p = pct(t.solved, t.total);
  return (
    <div>
      <div className="flex items-center justify-between text-xs">
        <span className="min-w-0 truncate font-bold text-white/75">{t.title}</span>
        <span className="ml-2 shrink-0 font-mono text-white/45">{t.solved}/{t.total}</span>
      </div>
      <div className="mt-1 h-1.5 overflow-hidden rounded-full bg-white/10">
        <div className="h-full rounded-full bg-[#f15a29]" style={{ width: `${p}%` }} />
      </div>
    </div>
  );
}
