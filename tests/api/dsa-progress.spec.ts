import { expect, test } from '@playwright/test';
import crypto from 'crypto';
import { db } from '../../lib/db';
import { submitSolution } from '../../lib/judge/submit';
import type { JudgeRunFn } from '../../lib/judge/types';

const okEcho: JudgeRunFn = async (input) => ({
  status: 'ok', stdout: input.stdin, stderr: '', exitCode: 0, signal: null, runtimeMs: 1, memoryKb: 1024,
});

async function makeUser() {
  return db.user.create({ data: { name: 'P', email: `prog-${crypto.randomBytes(5).toString('hex')}@test.local`, role: 'student' } });
}
async function makeProblem() {
  const slug = `prog-${crypto.randomBytes(4).toString('hex')}`;
  await db.dsaProblem.create({
    data: {
      slug, title: 'Echo', difficulty: 'easy', statementMd: 'echo', comparison: 'whitespace', status: 'published',
      testCases: { create: [{ input: 'a', expected: 'a', isSample: true, sortOrder: 0 }, { input: 'b', expected: 'b', sortOrder: 1 }] },
    },
  });
  return slug;
}

test.describe('DSA progress tracking', () => {
  test('accepted submission marks the problem solved for the user', async () => {
    const user = await makeUser();
    const slug = await makeProblem();
    const result = await submitSolution({ slug, language: 'echo', source: 'x', userId: user.id, run: okEcho });
    expect(result?.verdict).toBe('accepted');

    const problem = await db.dsaProblem.findUniqueOrThrow({ where: { slug } });
    const progress = await db.dsaProblemProgress.findUnique({ where: { userId_problemId: { userId: user.id, problemId: problem.id } } });
    expect(progress?.status).toBe('solved');
    expect(progress?.attempts).toBe(1);
    expect(progress?.solvedAt).not.toBeNull();
  });

  test('wrong submission records attempted; later accepted upgrades to solved', async () => {
    const user = await makeUser();
    const slug = await makeProblem();
    // Wrong run: outputs nothing -> wrong_answer.
    const wrongRun: JudgeRunFn = async () => ({ status: 'ok', stdout: 'WRONG', stderr: '', exitCode: 0, signal: null, runtimeMs: 1, memoryKb: null });
    await submitSolution({ slug, language: 'echo', source: 'x', userId: user.id, run: wrongRun });
    const problem = await db.dsaProblem.findUniqueOrThrow({ where: { slug } });
    let progress = await db.dsaProblemProgress.findUnique({ where: { userId_problemId: { userId: user.id, problemId: problem.id } } });
    expect(progress?.status).toBe('attempted');
    expect(progress?.attempts).toBe(1);

    await submitSolution({ slug, language: 'echo', source: 'x', userId: user.id, run: okEcho });
    progress = await db.dsaProblemProgress.findUnique({ where: { userId_problemId: { userId: user.id, problemId: problem.id } } });
    expect(progress?.status).toBe('solved');
    expect(progress?.attempts).toBe(2);
  });

  test('anonymous submission records no progress', async () => {
    const slug = await makeProblem();
    const result = await submitSolution({ slug, language: 'echo', source: 'x', run: okEcho });
    expect(result?.verdict).toBe('accepted');
    const problem = await db.dsaProblem.findUniqueOrThrow({ where: { slug } });
    const count = await db.dsaProblemProgress.count({ where: { problemId: problem.id } });
    expect(count).toBe(0);
  });
});
