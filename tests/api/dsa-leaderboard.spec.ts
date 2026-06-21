import { expect, test } from '@playwright/test';
import crypto from 'crypto';
import { db } from '../../lib/db';
import { difficultyWeight, getLeaderboard } from '../../lib/dsa/leaderboard';

async function makeUser(name: string) {
  return db.user.create({
    data: { name, email: `lb-${crypto.randomBytes(5).toString('hex')}@test.local`, role: 'student' },
  });
}

async function makeProblem(difficulty: string) {
  return db.dsaProblem.create({
    data: {
      slug: `lb-${crypto.randomBytes(4).toString('hex')}`,
      title: 'P',
      difficulty,
      statementMd: 'x',
      status: 'published',
    },
  });
}

async function solve(userId: string, problemId: string) {
  await db.dsaProblemProgress.create({
    data: { userId, problemId, status: 'solved', attempts: 1, solvedAt: new Date() },
  });
}

test.describe('DSA leaderboard', () => {
  test('difficultyWeight maps easy/medium/hard and defaults unknown to medium', () => {
    expect(difficultyWeight('easy')).toBe(1);
    expect(difficultyWeight('Medium')).toBe(2);
    expect(difficultyWeight('HARD')).toBe(3);
    expect(difficultyWeight('whatever')).toBe(2);
  });

  test('ranks users by difficulty-weighted score and reports the caller rank', async () => {
    const [easy, medium, hard] = await Promise.all([makeProblem('easy'), makeProblem('medium'), makeProblem('hard')]);
    const alice = await makeUser('Alice'); // hard + medium = 3 + 2 = 5
    const bob = await makeUser('Bob'); //     easy = 1
    await solve(alice.id, hard.id);
    await solve(alice.id, medium.id);
    await solve(bob.id, easy.id);

    // Use the `me` lookup (full ranked list), robust to other rows in the shared db.
    const aliceView = (await getLeaderboard({ currentUserId: alice.id })).me;
    const bobView = (await getLeaderboard({ currentUserId: bob.id })).me;

    expect(aliceView?.score).toBe(5);
    expect(aliceView?.solvedCount).toBe(2);
    expect(bobView?.score).toBe(1);
    // Alice outranks Bob (higher score => lower rank number).
    expect((aliceView?.rank ?? 99) < (bobView?.rank ?? 0)).toBeTruthy();
  });

  test('limit caps the top list but the caller still gets their own entry', async () => {
    const problem = await makeProblem('easy');
    const users = await Promise.all(['U1', 'U2', 'U3'].map((n) => makeUser(n)));
    for (const u of users) await solve(u.id, problem.id);

    const { top, me } = await getLeaderboard({ limit: 1, currentUserId: users[2].id });
    expect(top.length).toBe(1);
    expect(me?.userId).toBe(users[2].id); // present even though outside top-1
  });
});
