import { expect, test } from '@playwright/test';
import crypto from 'crypto';
import { db } from '../../lib/db';
import { getProfileStats } from '../../lib/dsa/profile';

const rid = () => crypto.randomBytes(5).toString('hex');

test.describe('profile stats', () => {
  test('computes solved/tried/acceptance/difficulty for a user', async () => {
    const user = await db.user.create({ data: { name: 'S', email: `ps-${rid()}@test.local`, role: 'student' } });
    const track = await db.dsaTrack.create({ data: { slug: `t-${rid()}`, title: 'T' } });
    const topic = await db.dsaTopic.create({ data: { trackId: track.id, title: 'Topic' } });

    async function prob(difficulty: string) {
      return db.dsaProblem.create({
        data: { slug: `p-${rid()}`, title: 'P', difficulty, statementMd: 'x', status: 'published', topicId: topic.id },
      });
    }
    const easy = await prob('easy');
    const medium = await prob('medium');
    await prob('hard'); // untouched

    // easy solved, medium attempted-only.
    await db.dsaProblemProgress.create({ data: { userId: user.id, problemId: easy.id, status: 'solved', attempts: 2, solvedAt: new Date() } });
    await db.dsaProblemProgress.create({ data: { userId: user.id, problemId: medium.id, status: 'attempted', attempts: 3 } });

    // submissions: 2 accepted (cpp), 2 wrong (cpp), 1 wrong (java) => acceptance 2/5.
    for (let i = 0; i < 2; i += 1) await db.dsaSubmission.create({ data: { problemId: easy.id, userId: user.id, language: 'cpp', source: 'x', verdict: 'accepted', totalCount: 1, passedCount: 1 } });
    for (let i = 0; i < 2; i += 1) await db.dsaSubmission.create({ data: { problemId: medium.id, userId: user.id, language: 'cpp', source: 'x', verdict: 'wrong_answer', totalCount: 1 } });
    await db.dsaSubmission.create({ data: { problemId: medium.id, userId: user.id, language: 'java', source: 'x', verdict: 'wrong_answer', totalCount: 1 } });

    const stats = await getProfileStats(user.id);

    expect(stats.solved).toBe(1);
    expect(stats.tried).toBe(1);
    expect(stats.byDifficulty.easy.solved).toBe(1);
    expect(stats.byDifficulty.medium.solved).toBe(0);
    expect(stats.totalSubmissions).toBe(5);
    expect(stats.acceptedSubmissions).toBe(2);
    expect(Math.round(stats.acceptanceRate * 100)).toBe(40);
    const cpp = stats.languages.find((l) => l.language === 'cpp');
    expect(cpp?.count).toBe(4);
    expect(stats.streakDays).toBeGreaterThanOrEqual(1); // submissions created today
    expect(stats.recent.length).toBe(5);
  });
});
