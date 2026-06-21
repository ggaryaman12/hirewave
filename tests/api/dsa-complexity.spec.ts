import { expect, test } from '@playwright/test';
import crypto from 'crypto';
import { db } from '../../lib/db';
import { generateScaledInput, hasScalableParam } from '../../lib/dsa/complexity/generate';
import { analyzeSubmissionComplexity } from '../../lib/dsa/complexity';
import type { JudgeRunFn } from '../../lib/judge/types';

const intArraySig = { functionName: 'f', params: [{ name: 'a', type: 'int[]' }], returnType: 'long' };

async function makeFunctionSubmission(sig: object, source = 'function f(a){ return 0; }') {
  const problem = await db.dsaProblem.create({
    data: {
      slug: `cx-${crypto.randomBytes(4).toString('hex')}`,
      title: 'Cx',
      difficulty: 'easy',
      statementMd: 'x',
      status: 'published',
      kind: 'function',
      signatureJson: JSON.stringify(sig),
      timeLimitMs: 2000,
      memoryLimitMb: 256,
    },
  });
  const sub = await db.dsaSubmission.create({
    data: { problemId: problem.id, language: 'javascript', source, status: 'done', verdict: 'accepted' },
  });
  return sub;
}

test.describe('complexity input generation', () => {
  test('scales the first array param to n; one space-separated line', () => {
    const input = generateScaledInput(intArraySig as never, 5);
    expect(input).not.toBeNull();
    expect((input as string).trim().split(/\s+/).length).toBe(5);
  });

  test('reports non-scalable signatures', () => {
    const scalarOnly = { functionName: 'g', params: [{ name: 'x', type: 'int' }], returnType: 'int' };
    expect(hasScalableParam(scalarOnly as never)).toBe(false);
    expect(generateScaledInput(scalarOnly as never, 100)).toBeNull();
  });
});

test.describe('complexity orchestration', () => {
  test('linear runtime + memory -> O(n), cached on second call', async () => {
    const sub = await makeFunctionSubmission(intArraySig);

    let runCount = 0;
    // Runtime/memory proportional to input size (token count grows with n).
    const linearRun: JudgeRunFn = async (input) => {
      runCount += 1;
      const size = input.stdin.length;
      return { status: 'ok', stdout: '0', stderr: '', exitCode: 0, signal: null, runtimeMs: Math.round(size / 300), memoryKb: size };
    };

    const result = await analyzeSubmissionComplexity(sub.id, linearRun);
    expect(result).not.toBeNull();
    expect(result?.time).toBe('O(n)');
    expect(result?.space).toBe('O(n)');
    expect(result!.samples.length).toBeGreaterThanOrEqual(3);
    const firstRunCount = runCount;
    expect(firstRunCount).toBeGreaterThanOrEqual(3);

    // Second call hits the cached complexityJson -> no new judge runs.
    const again = await analyzeSubmissionComplexity(sub.id, linearRun);
    expect(again?.time).toBe('O(n)');
    expect(runCount).toBe(firstRunCount);
  });

  test('returns null for a problem with no scalable input', async () => {
    const sub = await makeFunctionSubmission({ functionName: 'g', params: [{ name: 'x', type: 'int' }], returnType: 'int' });
    const run: JudgeRunFn = async () => ({ status: 'ok', stdout: '0', stderr: '', exitCode: 0, signal: null, runtimeMs: 1, memoryKb: 1 });
    expect(await analyzeSubmissionComplexity(sub.id, run)).toBeNull();
  });
});
