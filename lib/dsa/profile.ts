import { db } from '@/lib/db';

export type DifficultyStat = { solved: number; total: number };
export type TopicStat = { topicId: string; title: string; track: string; solved: number; total: number };
export type RecentSubmission = {
  id: string;
  title: string;
  slug: string;
  difficulty: string;
  verdict: string;
  language: string;
  createdAt: string;
};

export type ProfileStats = {
  solved: number;
  tried: number; // attempted but never accepted
  totalPublished: number;
  byDifficulty: Record<'easy' | 'medium' | 'hard', DifficultyStat>;
  topics: TopicStat[];
  strengths: TopicStat[];
  focusAreas: TopicStat[];
  totalSubmissions: number;
  acceptedSubmissions: number;
  acceptanceRate: number; // 0..1
  languages: { language: string; count: number }[];
  streakDays: number;
  rank: number;
  totalStudents: number;
  percentile: number;
  recent: RecentSubmission[];
};

const DIFFS = ['easy', 'medium', 'hard'] as const;

function dayKey(d: Date): string {
  return d.toISOString().slice(0, 10);
}

// Current streak: consecutive days (ending today or yesterday) with >=1 submission.
function computeStreak(dates: Date[]): number {
  if (dates.length === 0) return 0;
  const days = new Set(dates.map(dayKey));
  const today = new Date();
  let cursor = new Date(Date.UTC(today.getUTCFullYear(), today.getUTCMonth(), today.getUTCDate()));
  if (!days.has(dayKey(cursor))) {
    cursor.setUTCDate(cursor.getUTCDate() - 1);
    if (!days.has(dayKey(cursor))) return 0; // no activity today or yesterday
  }
  let streak = 0;
  while (days.has(dayKey(cursor))) {
    streak += 1;
    cursor.setUTCDate(cursor.getUTCDate() - 1);
  }
  return streak;
}

export async function getProfileStats(userId: string): Promise<ProfileStats> {
  const [progress, publishedByDiff, publishedByTopic, totalPublished, topicMeta, submissions, recent, solvedGroups] =
    await Promise.all([
      db.dsaProblemProgress.findMany({
        where: { userId },
        select: { status: true, problem: { select: { difficulty: true, topicId: true } } },
      }),
      db.dsaProblem.groupBy({ by: ['difficulty'], where: { status: 'published' }, _count: { _all: true } }),
      db.dsaProblem.groupBy({ by: ['topicId'], where: { status: 'published' }, _count: { _all: true } }),
      db.dsaProblem.count({ where: { status: 'published' } }),
      db.dsaTopic.findMany({ select: { id: true, title: true, track: { select: { title: true } } } }),
      db.dsaSubmission.findMany({ where: { userId }, select: { verdict: true, language: true, createdAt: true } }),
      db.dsaSubmission.findMany({
        where: { userId },
        orderBy: { createdAt: 'desc' },
        take: 12,
        select: { id: true, verdict: true, language: true, createdAt: true, problem: { select: { title: true, slug: true, difficulty: true } } },
      }),
      db.dsaProblemProgress.groupBy({ by: ['userId'], where: { status: 'solved' }, _count: { _all: true } }),
    ]);

  const solved = progress.filter((p) => p.status === 'solved');
  const tried = progress.filter((p) => p.status === 'attempted').length;

  // By difficulty.
  const diffTotals: Record<string, number> = {};
  for (const row of publishedByDiff) diffTotals[row.difficulty.toLowerCase()] = row._count._all;
  const byDifficulty = {} as Record<'easy' | 'medium' | 'hard', DifficultyStat>;
  for (const d of DIFFS) byDifficulty[d] = { solved: 0, total: diffTotals[d] ?? 0 };
  for (const p of solved) {
    const d = p.problem.difficulty.toLowerCase();
    if (d === 'easy' || d === 'medium' || d === 'hard') byDifficulty[d].solved += 1;
  }

  // By topic.
  const topicTotals = new Map<string, number>();
  for (const row of publishedByTopic) if (row.topicId) topicTotals.set(row.topicId, row._count._all);
  const topicSolved = new Map<string, number>();
  for (const p of solved) if (p.problem.topicId) topicSolved.set(p.problem.topicId, (topicSolved.get(p.problem.topicId) ?? 0) + 1);
  const topics: TopicStat[] = topicMeta
    .map((t) => ({ topicId: t.id, title: t.title, track: t.track?.title ?? '', solved: topicSolved.get(t.id) ?? 0, total: topicTotals.get(t.id) ?? 0 }))
    .filter((t) => t.total > 0)
    .sort((a, b) => b.solved / Math.max(1, b.total) - a.solved / Math.max(1, a.total));

  const attemptedTopics = topics.filter((t) => t.solved > 0);
  const strengths = [...attemptedTopics].sort((a, b) => b.solved / b.total - a.solved / a.total).slice(0, 4);
  const focusAreas = [...topics].sort((a, b) => a.solved / a.total - b.solved / b.total).slice(0, 4);

  // Submissions / acceptance / languages / streak.
  const totalSubmissions = submissions.length;
  const acceptedSubmissions = submissions.filter((s) => s.verdict === 'accepted').length;
  const acceptanceRate = totalSubmissions > 0 ? acceptedSubmissions / totalSubmissions : 0;
  const langMap = new Map<string, number>();
  for (const s of submissions) langMap.set(s.language, (langMap.get(s.language) ?? 0) + 1);
  const languages = [...langMap.entries()].map(([language, count]) => ({ language, count })).sort((a, b) => b.count - a.count);
  const streakDays = computeStreak(submissions.map((s) => s.createdAt));

  // Rank by solved count among all students with >=1 solve.
  const mySolved = solved.length;
  const totalStudents = solvedGroups.length;
  const ahead = solvedGroups.filter((g) => g._count._all > mySolved).length;
  const rank = mySolved > 0 ? ahead + 1 : totalStudents + 1;
  const percentile = totalStudents > 0 ? Math.max(1, Math.round((1 - (rank - 1) / Math.max(1, totalStudents)) * 100)) : 0;

  return {
    solved: mySolved,
    tried,
    totalPublished,
    byDifficulty,
    topics,
    strengths,
    focusAreas,
    totalSubmissions,
    acceptedSubmissions,
    acceptanceRate,
    languages,
    streakDays,
    rank,
    totalStudents,
    percentile,
    recent: recent.map((r) => ({
      id: r.id,
      title: r.problem.title,
      slug: r.problem.slug,
      difficulty: r.problem.difficulty,
      verdict: r.verdict,
      language: r.language,
      createdAt: r.createdAt.toISOString(),
    })),
  };
}
