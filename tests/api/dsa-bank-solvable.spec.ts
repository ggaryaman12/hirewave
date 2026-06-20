import { readFileSync, readdirSync } from 'fs';
import { join } from 'path';
import { expect, test } from '@playwright/test';
import { LocalJudgeProvider } from '../../lib/judge/local-provider';
import { wrapSource } from '../../lib/judge/harness';
import { parseSignature } from '../../lib/judge/harness';
import { compareOutput } from '../../lib/judge/compare';
import type { ComparisonPolicy } from '../../lib/judge/types';

// Solvability gate: every generated problem's JS reference, run through the real
// harness + local provider against its FULL test suite, must produce the seeded
// expected output for every case. Proves harness parse/serialize agrees with the
// generator's serialization for every type shape in the bank.

const GEN_DIR = join(__dirname, '../../scripts/dsa/generated');

type GenProblem = {
  slug: string;
  signatureJson: string;
  comparison: ComparisonPolicy;
  floatEpsilon: number | null;
  timeLimitMs: number;
  memoryLimitMb: number;
  testCases: { input: string; expected: string }[];
};

function loadProblems(): GenProblem[] {
  return readdirSync(GEN_DIR)
    .filter((f) => f.endsWith('.json') && f !== 'index.json' && f !== 'tracks.json')
    .map((f) => JSON.parse(readFileSync(join(GEN_DIR, f), 'utf8')) as GenProblem)
    .filter((p) => Boolean(p.signatureJson)); // function-mode only; design covered separately
}

test.describe('DSA bank solvability (JS reference, full suites)', () => {
  // Reference functions live in the ESM problem definitions; load once.
  let references: Record<string, (...args: unknown[]) => unknown>;

  test.beforeAll(async () => {
    type FnProblem = { slug: string; reference: (...args: unknown[]) => unknown };
    const core = (await import('../../scripts/dsa/problems.mjs')) as { PROBLEMS: FnProblem[] };
    const rw = (await import('../../scripts/dsa/realworld-problems.mjs')) as { RW_FUNCTION_PROBLEMS: FnProblem[] };
    references = Object.fromEntries(
      [...core.PROBLEMS, ...rw.RW_FUNCTION_PROBLEMS].map((p) => [p.slug, p.reference]),
    );
  });

  for (const problem of loadProblems()) {
    test(`${problem.slug}: all cases pass`, async () => {
      const sig = parseSignature(problem.signatureJson);
      expect(sig, `signature for ${problem.slug}`).not.toBeNull();
      const ref = references[problem.slug];
      expect(ref, `reference for ${problem.slug}`).toBeTruthy();

      // Reconstruct candidate-equivalent JS source from the reference.
      const userCode = `const ${sig!.functionName} = ${ref.toString()};`;
      const source = wrapSource('javascript', sig!, userCode);
      const provider = new LocalJudgeProvider();

      for (const tc of problem.testCases) {
        const run = await provider.run({
          language: 'javascript',
          source,
          stdin: tc.input,
          timeLimitMs: problem.timeLimitMs,
          memoryLimitMb: problem.memoryLimitMb,
        });
        expect(run.status, `${problem.slug} run on input <<${tc.input}>> stderr: ${run.stderr}`).toBe('ok');
        const ok = compareOutput(tc.expected, run.stdout, problem.comparison, problem.floatEpsilon ?? undefined);
        expect(ok, `${problem.slug} input <<${tc.input}>> expected <<${tc.expected}>> got <<${run.stdout}>>`).toBe(true);
      }
    });
  }
});
