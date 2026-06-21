import { db } from '@/lib/db';
import { JudgeRunStatus } from '@/lib/constants';
import { parseSignature, wrapSource } from '@/lib/judge/harness';
import { getJudgeProvider } from '@/lib/judge/provider';
import type { JudgeRunFn } from '@/lib/judge/types';
import { fitComplexity, type ComplexityClass } from '@/lib/dsa/complexity/fit';
import { generateScaledInput, hasScalableParam } from '@/lib/dsa/complexity/generate';

// Empirical complexity of a submission: run the user's actual code through the
// judge against generated inputs of increasing size, measure runtime + memory,
// and fit the growth curve. No AI — pure measurement. Adaptive sizing: keep
// doubling n until a run is slow enough to give signal (or hits the cap / errors),
// so an O(n²) algo stops at small n while an O(n) algo scales up.

const START_N = 1000;
const MAX_N = 1_000_000;
const TARGET_MS = 250; // once a run takes this long, we have enough signal
const MAX_POINTS = 7;

export type ComplexitySample = { n: number; ms: number; kb: number };
export type ComplexityResult = {
  time: ComplexityClass;
  space: ComplexityClass;
  timeConfidence: number;
  spaceConfidence: number;
  samples: ComplexitySample[];
  generatedAt: string;
};

export async function analyzeSubmissionComplexity(
  submissionId: string,
  run?: JudgeRunFn,
): Promise<ComplexityResult | null> {
  const sub = await db.dsaSubmission.findUnique({ where: { id: submissionId }, include: { problem: true } });
  if (!sub) return null;

  // Cache: same code already measured.
  if (sub.complexityJson) {
    try {
      return JSON.parse(sub.complexityJson) as ComplexityResult;
    } catch {
      /* fall through and recompute */
    }
  }

  const sig = parseSignature(sub.problem.signatureJson);
  if (!sig || !hasScalableParam(sig)) return null; // only function problems with a sizeable input

  const runFn: JudgeRunFn = run ?? ((input) => getJudgeProvider().run(input));
  const wrapped = wrapSource(sub.language, sig, sub.source);

  const samples: ComplexitySample[] = [];
  let n = START_N;
  for (let i = 0; i < MAX_POINTS; i += 1) {
    const stdin = generateScaledInput(sig, n);
    if (!stdin) break;
    const r = await runFn({
      language: sub.language,
      source: wrapped,
      stdin,
      timeLimitMs: sub.problem.timeLimitMs,
      memoryLimitMb: sub.problem.memoryLimitMb,
    });
    if (r.status !== JudgeRunStatus.OK) break; // TLE / error at this size -> stop scaling up
    samples.push({ n, ms: r.runtimeMs, kb: r.memoryKb ?? 0 });
    if (r.runtimeMs >= TARGET_MS || n >= MAX_N) break;
    n *= 2;
  }

  if (samples.length < 3) return null; // not enough signal to fit

  const time = fitComplexity(samples.map((s) => ({ n: s.n, value: s.ms })));
  const hasMem = samples.some((s) => s.kb > 0);
  const space = hasMem
    ? fitComplexity(samples.map((s) => ({ n: s.n, value: s.kb })))
    : { label: 'O(1)' as ComplexityClass, confidence: 0 };

  const result: ComplexityResult = {
    time: time.label,
    space: space.label,
    timeConfidence: time.confidence,
    spaceConfidence: space.confidence,
    samples,
    generatedAt: new Date().toISOString(),
  };

  await db.dsaSubmission.update({ where: { id: submissionId }, data: { complexityJson: JSON.stringify(result) } });
  return result;
}
