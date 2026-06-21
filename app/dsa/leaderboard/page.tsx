import Link from 'next/link';
import { ArrowLeft, Trophy } from 'lucide-react';
import { getCurrentUser } from '@/lib/auth/session';
import { getLeaderboard, type LeaderboardEntry } from '@/lib/dsa/leaderboard';
import { cn } from '@/lib/utils';

function rankBadge(rank: number) {
  if (rank === 1) return 'bg-amber-400/20 text-amber-300';
  if (rank === 2) return 'bg-slate-300/20 text-slate-200';
  if (rank === 3) return 'bg-orange-500/20 text-orange-300';
  return 'bg-white/5 text-white/50';
}

function Row({ entry, isMe }: { entry: LeaderboardEntry; isMe: boolean }) {
  return (
    <div
      className={cn(
        'flex items-center gap-4 px-5 py-3 text-sm',
        isMe ? 'bg-[#f15a29]/10' : 'odd:bg-white/[0.02]',
      )}
    >
      <span
        className={cn(
          'flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-xs font-black',
          rankBadge(entry.rank),
        )}
      >
        {entry.rank}
      </span>
      <span className="flex-1 truncate font-semibold">
        {entry.name}
        {isMe && <span className="ml-2 text-[10px] font-black uppercase tracking-wider text-[#f15a29]">You</span>}
      </span>
      <span className="w-20 text-right text-white/50">{entry.solvedCount} solved</span>
      <span className="w-16 text-right font-black tabular-nums">{entry.score}</span>
    </div>
  );
}

export default async function LeaderboardPage() {
  const user = await getCurrentUser();
  const { top, me, totalRanked } = await getLeaderboard({ limit: 50, currentUserId: user?.id });
  const meInTop = me ? top.some((entry) => entry.userId === me.userId) : false;

  return (
    <div className="min-h-screen bg-[#111] text-paper">
      <header className="border-b border-white/10 bg-[#171717]">
        <div className="mx-auto flex max-w-3xl items-center justify-between px-6 py-6">
          <div>
            <p className="flex items-center gap-2 text-sm font-black">
              <Trophy className="h-4 w-4 text-[#f15a29]" />
              Leaderboard
            </p>
            <p className="mt-1 text-xs text-white/45">
              {totalRanked} {totalRanked === 1 ? 'solver' : 'solvers'} · score = easy 1 / medium 2 / hard 3
            </p>
          </div>
          <Link
            href="/dsa"
            className="inline-flex items-center gap-1.5 rounded-md border border-white/10 px-3 py-1.5 text-xs font-bold text-white/70 hover:bg-white/10 hover:text-white"
          >
            <ArrowLeft className="h-3.5 w-3.5" /> Problems
          </Link>
        </div>
      </header>

      <main className="mx-auto max-w-3xl px-6 py-8">
        {top.length === 0 ? (
          <div className="rounded-xl border border-white/10 bg-[#171717] px-6 py-16 text-center">
            <Trophy className="mx-auto h-8 w-8 text-white/20" />
            <p className="mt-3 text-sm text-white/50">No one has solved a problem yet. Be the first.</p>
            <Link
              href="/dsa"
              className="mt-4 inline-flex items-center gap-1.5 rounded-md bg-[#f15a29] px-4 py-2 text-xs font-black text-black"
            >
              Start solving
            </Link>
          </div>
        ) : (
          <div className="overflow-hidden rounded-xl border border-white/10 bg-[#171717]">
            <div className="flex items-center gap-4 border-b border-white/10 px-5 py-2 text-[10px] font-black uppercase tracking-wider text-white/35">
              <span className="w-7 text-center">#</span>
              <span className="flex-1">Solver</span>
              <span className="w-20 text-right">Solved</span>
              <span className="w-16 text-right">Score</span>
            </div>
            {top.map((entry) => (
              <Row key={entry.userId} entry={entry} isMe={entry.userId === me?.userId} />
            ))}
            {me && !meInTop && (
              <>
                <div className="px-5 py-1 text-center text-white/30">···</div>
                <Row entry={me} isMe />
              </>
            )}
          </div>
        )}
      </main>
    </div>
  );
}
