import { expect, test } from '@playwright/test';
import { db } from '../../lib/db';
import { submitSolution } from '../../lib/judge/submit';

// Live smoke test against a real Judge0 engine (public CE or self-hosted).
// Skipped unless JUDGE0_LIVE=1, so the normal deterministic suite stays offline.
//
//   JUDGE_PROVIDER=judge0 JUDGE0_URL=https://ce.judge0.com JUDGE0_LIVE=1 \
//     npx playwright test tests/api/judge0-live.spec.ts
test.describe('Judge0 live execution', () => {
  test.skip(process.env.JUDGE0_LIVE !== '1', 'set JUDGE0_LIVE=1 with a real JUDGE0_URL');

  test('a seeded problem reference solution is Accepted end-to-end', async () => {
    const problem = await db.dsaProblem.findUnique({ where: { slug: 'sum-of-two-numbers' } });
    expect(problem, 'run npm run db:seed first').toBeTruthy();

    const reference = JSON.parse(problem!.referenceSolutionJson || '{}') as { language?: string; source?: string };
    expect(reference.source, 'problem needs a reference solution').toBeTruthy();

    const result = await submitSolution({
      slug: 'sum-of-two-numbers',
      language: reference.language || 'python',
      source: reference.source!,
    });

    expect(result?.verdict).toBe('accepted');
    expect(result?.passedCount).toBe(result?.totalCount);
  });

  test('a wrong solution is not Accepted', async () => {
    const result = await submitSolution({
      slug: 'sum-of-two-numbers',
      language: 'python',
      source: 'print(0)',
    });

    expect(result?.verdict).not.toBe('accepted');
  });
});
