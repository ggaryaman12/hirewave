import { expect, test } from '@playwright/test';
import crypto from 'crypto';
import { db } from '../../lib/db';
import { compareOutput } from '../../lib/judge/compare';
import { gradeSubmission } from '../../lib/judge/grade';
import { submitSolution, runSamples } from '../../lib/judge/submit';
import type { JudgeRunFn, JudgeRunResult } from '../../lib/judge/types';

const okEcho: JudgeRunFn = async (input) => ({
  status: 'ok',
  stdout: input.stdin,
  stderr: '',
  exitCode: 0,
  signal: null,
  runtimeMs: 1,
  memoryKb: 1024,
});

function runResult(overrides: Partial<JudgeRunResult>): JudgeRunResult {
  return { status: 'ok', stdout: '', stderr: '', exitCode: 0, signal: null, runtimeMs: 1, memoryKb: null, ...overrides };
}

async function createProblem(slug: string, testCases: { input: string; expected: string; isSample?: boolean }[], comparison = 'whitespace') {
  return db.dsaProblem.create({
    data: {
      slug,
      title: 'Echo Problem',
      difficulty: 'easy',
      statementMd: 'Echo the input.',
      comparison,
      status: 'published',
      testCases: {
        create: testCases.map((testCase, index) => ({
          input: testCase.input,
          expected: testCase.expected,
          isSample: testCase.isSample ?? false,
          sortOrder: index,
        })),
      },
    },
  });
}

test.describe('DSA judge (Slice 1)', () => {
  test('compareOutput handles whitespace, exact, and float policies', () => {
    expect(compareOutput('5\n', '5\n\n', 'whitespace')).toBe(true);
    expect(compareOutput('a b ', 'a b', 'whitespace')).toBe(true);
    expect(compareOutput('5\n', '5\n\n', 'exact')).toBe(false);
    expect(compareOutput('1.0000001', '1.0000002', 'float', 1e-5)).toBe(true);
    expect(compareOutput('1.0', '1.2', 'float', 1e-5)).toBe(false);
    expect(compareOutput('3 hello', '3 world', 'float')).toBe(false);
  });

  test('gradeSubmission returns accepted when all cases pass', async () => {
    const result = await gradeSubmission(
      { language: 'echo', source: 'x', timeLimitMs: 2000, memoryLimitMb: 256, comparison: 'whitespace' },
      [{ input: 'a', expected: 'a' }, { input: 'b', expected: 'b' }],
      okEcho,
    );
    expect(result.verdict).toBe('accepted');
    expect(result.passedCount).toBe(2);
    expect(result.failingCase).toBeNull();
  });

  test('gradeSubmission reports wrong_answer at the first failing case', async () => {
    const result = await gradeSubmission(
      { language: 'echo', source: 'x', timeLimitMs: 2000, memoryLimitMb: 256, comparison: 'whitespace' },
      [{ input: 'a', expected: 'a' }, { input: 'b', expected: 'WRONG' }],
      okEcho,
    );
    expect(result.verdict).toBe('wrong_answer');
    expect(result.passedCount).toBe(1);
    expect(result.failingCase).toBe(1);
  });

  test('gradeSubmission maps TLE and compile error statuses', async () => {
    const tle = await gradeSubmission(
      { language: 'echo', source: 'x', timeLimitMs: 1000, memoryLimitMb: 256, comparison: 'whitespace' },
      [{ input: 'a', expected: 'a' }],
      async () => runResult({ status: 'tle' }),
    );
    expect(tle.verdict).toBe('tle');

    const ce = await gradeSubmission(
      { language: 'echo', source: 'x', timeLimitMs: 1000, memoryLimitMb: 256, comparison: 'whitespace' },
      [{ input: 'a', expected: 'a' }, { input: 'b', expected: 'b' }],
      async () => runResult({ status: 'compile_error', stderr: 'syntax error' }),
    );
    expect(ce.verdict).toBe('compile_error');
    expect(ce.results).toHaveLength(1); // short-circuits on compile error
  });

  test('submitSolution persists a verdict and never leaks hidden test data', async () => {
    const slug = `echo-${crypto.randomBytes(4).toString('hex')}`;
    await createProblem(slug, [
      { input: 'hello', expected: 'hello', isSample: true },
      { input: 'secret-hidden', expected: 'secret-hidden' },
    ]);

    const result = await submitSolution({ slug, language: 'echo', source: 'print(input())', run: okEcho });
    expect(result).not.toBeNull();
    expect(result?.verdict).toBe('accepted');
    expect(result?.passedCount).toBe(2);

    // Per-test results must carry only index/status/timing, no inputs/expected.
    const serialized = JSON.stringify(result?.results);
    expect(serialized).not.toContain('secret-hidden');
    expect(result?.results[0]).not.toHaveProperty('input');
    expect(result?.results[0]).not.toHaveProperty('expected');

    const submission = await db.dsaSubmission.findFirstOrThrow({ where: { id: result?.submissionId } });
    expect(submission.verdict).toBe('accepted');
  });

  test('submitSolution returns wrong_answer when output mismatches', async () => {
    const slug = `wa-${crypto.randomBytes(4).toString('hex')}`;
    await createProblem(slug, [{ input: 'a', expected: 'DIFFERENT' }]);
    const result = await submitSolution({ slug, language: 'echo', source: 'x', run: okEcho });
    expect(result?.verdict).toBe('wrong_answer');
    expect(result?.failingCase).toBe(0);
  });

  test('runSamples returns sample details for the candidate', async () => {
    const slug = `samples-${crypto.randomBytes(4).toString('hex')}`;
    await createProblem(slug, [
      { input: 'a', expected: 'a', isSample: true },
      { input: 'hidden', expected: 'hidden' },
    ]);
    const result = await runSamples({ slug, language: 'echo', source: 'x', run: okEcho });
    expect(result?.sampleCount).toBe(1);
    expect(result?.results[0].status).toBe('accepted');
    expect(result?.results[0].input).toBe('a');
  });

  test('idempotent submit: same key returns the same submission and judges once', async () => {
    const slug = `idem-${crypto.randomBytes(4).toString('hex')}`;
    await createProblem(slug, [{ input: 'a', expected: 'a' }]);

    let runCount = 0;
    const countingRun: JudgeRunFn = async (input) => {
      runCount += 1;
      return { status: 'ok', stdout: input.stdin, stderr: '', exitCode: 0, signal: null, runtimeMs: 1, memoryKb: 1024 };
    };

    const key = crypto.randomUUID();
    const first = await submitSolution({ slug, language: 'echo', source: 'x', idempotencyKey: key, run: countingRun });
    const second = await submitSolution({ slug, language: 'echo', source: 'x', idempotencyKey: key, run: countingRun });

    // Same attempt -> same submission, judged exactly once (no double Judge0 run).
    expect(first?.submissionId).toBe(second?.submissionId);
    expect(first?.verdict).toBe('accepted');
    expect(runCount).toBe(1);

    const rows = await db.dsaSubmission.count({ where: { idempotencyKey: key } });
    expect(rows).toBe(1);

    const stored = await db.dsaSubmission.findFirstOrThrow({ where: { idempotencyKey: key } });
    expect(stored.status).toBe('done');
  });
});
