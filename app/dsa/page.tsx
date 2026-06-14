import Link from 'next/link';
import { ArrowRight, Code2, Layers } from 'lucide-react';
import { db } from '@/lib/db';
import { cn } from '@/lib/utils';

const DIFFICULTY_STYLES: Record<string, string> = {
  easy: 'bg-emerald-500/15 text-emerald-200',
  medium: 'bg-amber-500/15 text-amber-200',
  hard: 'bg-red-500/15 text-red-200',
};

function difficultyClass(difficulty: string) {
  return DIFFICULTY_STYLES[difficulty.toLowerCase()] ?? 'bg-white/10 text-white/60';
}

export default async function DsaPage() {
  const tracks = await db.dsaTrack.findMany({
    orderBy: { sortOrder: 'asc' },
    include: {
      topics: {
        orderBy: { sortOrder: 'asc' },
        include: {
          problems: {
            where: { status: 'published' },
            orderBy: { title: 'asc' },
          },
        },
      },
    },
  });

  // Only show tracks that have at least one published problem in any topic.
  const visibleTracks = tracks
    .map((track) => ({
      ...track,
      topics: track.topics.filter((topic) => topic.problems.length > 0),
    }))
    .filter((track) => track.topics.length > 0);

  const totalProblems = visibleTracks.reduce(
    (sum, track) => sum + track.topics.reduce((topicSum, topic) => topicSum + topic.problems.length, 0),
    0,
  );

  return (
    <div className="min-h-screen bg-[#111] text-paper">
      <header className="border-b border-white/10 bg-[#171717]">
        <div className="mx-auto flex max-w-5xl items-center justify-between px-6 py-6">
          <div>
            <p className="flex items-center gap-2 text-sm font-black">
              <Code2 className="h-4 w-4 text-[#f15a29]" />
              DSA practice
            </p>
            <p className="mt-1 text-xs text-white/45">
              {totalProblems} {totalProblems === 1 ? 'problem' : 'problems'} across {visibleTracks.length}{' '}
              {visibleTracks.length === 1 ? 'track' : 'tracks'}
            </p>
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-5xl px-6 py-8">
        {visibleTracks.length === 0 ? (
          <div className="rounded-xl border border-dashed border-white/15 bg-white/[0.03] p-12 text-center">
            <Layers className="mx-auto h-8 w-8 text-white/30" />
            <h2 className="mt-3 text-lg font-black">No problems published yet</h2>
            <p className="mx-auto mt-1 max-w-md text-sm text-white/50">
              Once problems are published they will appear here, grouped by track and topic.
            </p>
          </div>
        ) : (
          <div className="grid gap-8">
            {visibleTracks.map((track) => (
              <section key={track.id}>
                <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-[0.18em] text-white/40">
                  <Layers className="h-4 w-4" />
                  {track.title}
                </div>

                <div className="mt-4 grid gap-5">
                  {track.topics.map((topic) => (
                    <div key={topic.id} className="rounded-xl border border-white/10 bg-white/[0.03] p-5">
                      <h3 className="text-sm font-black text-white/80">{topic.title}</h3>
                      <div className="mt-3 grid gap-1.5">
                        {topic.problems.map((problem) => (
                          <Link
                            key={problem.id}
                            href={`/dsa/${problem.slug}`}
                            className="group flex items-center justify-between gap-3 rounded-lg border border-white/10 bg-[#151515] px-4 py-3 transition hover:border-[#f15a29]/40 hover:bg-white/[0.06]"
                          >
                            <span className="min-w-0 truncate text-sm font-bold text-white/85 group-hover:text-white">
                              {problem.title}
                            </span>
                            <span className="flex shrink-0 items-center gap-3">
                              <span
                                className={cn(
                                  'rounded-full px-2.5 py-0.5 text-[10px] font-black uppercase tracking-[0.12em]',
                                  difficultyClass(problem.difficulty),
                                )}
                              >
                                {problem.difficulty}
                              </span>
                              <ArrowRight className="h-4 w-4 text-white/30 group-hover:text-[#f15a29]" />
                            </span>
                          </Link>
                        ))}
                      </div>
                    </div>
                  ))}
                </div>
              </section>
            ))}
          </div>
        )}
      </main>
    </div>
  );
}
