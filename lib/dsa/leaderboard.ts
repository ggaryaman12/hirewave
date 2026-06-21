import { db } from '@/lib/db';

// DSA leaderboard. Score = difficulty-weighted sum over a user's SOLVED problems
// (easy 1 / medium 2 / hard 3). Phase-0 simple aggregation in app code — fine at
// toy scale. Phase 2 (per Lesson 07) replaces this with a Redis sorted set
// maintained incrementally on each accepted submission.

export type LeaderboardEntry = {
  userId: string;
  name: string;
  score: number;
  solvedCount: number;
  rank: number;
};

const WEIGHTS: Record<string, number> = { easy: 1, medium: 2, hard: 3 };

export function difficultyWeight(difficulty: string): number {
  return WEIGHTS[difficulty.toLowerCase()] ?? 2; // unknown difficulty treated as medium
}

export async function getLeaderboard(options?: { limit?: number; currentUserId?: string }) {
  const limit = options?.limit ?? 50;

  const solved = await db.dsaProblemProgress.findMany({
    where: { status: 'solved' },
    select: {
      userId: true,
      user: { select: { name: true } },
      problem: { select: { difficulty: true } },
    },
  });

  const totals = new Map<string, { name: string; score: number; solvedCount: number }>();
  for (const row of solved) {
    const current = totals.get(row.userId) ?? { name: row.user.name, score: 0, solvedCount: 0 };
    current.score += difficultyWeight(row.problem.difficulty);
    current.solvedCount += 1;
    totals.set(row.userId, current);
  }

  const ranked: LeaderboardEntry[] = [...totals.entries()]
    .map(([userId, value]) => ({ userId, ...value, rank: 0 }))
    // Deterministic ordering: score desc, then more problems solved, then name.
    .sort((a, b) => b.score - a.score || b.solvedCount - a.solvedCount || a.name.localeCompare(b.name))
    .map((entry, index) => ({ ...entry, rank: index + 1 }));

  const top = ranked.slice(0, limit);
  const me = options?.currentUserId
    ? ranked.find((entry) => entry.userId === options.currentUserId) ?? null
    : null;

  return { top, me, totalRanked: ranked.length };
}
