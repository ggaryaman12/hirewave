import { analyzeStaticJs } from '@/lib/complexity/static/parse-js';
import { annotateLines } from '@/lib/complexity/static/annotate';
import { runInstrumented } from '@/lib/complexity/dynamic/run';
import { deriveSize } from '@/lib/complexity/dynamic/size';
import { fitCurve } from '@/lib/complexity/fit';
import { reconcile } from '@/lib/complexity/reconcile';
import type { ComplexitySummary, SimStep } from '@/lib/complexity/types';

const MAX_CASES = 24;

export function analyzeComplexity(input: { code: string; runnable?: string; lang: string; cases: { stdin: string }[] }):
  { summary: ComplexitySummary; steps: SimStep[]; status: 'done' | 'failed' } {

  const stat = analyzeStaticJs(input.code);
  const { annotations, guessSpace } = annotateLines(input.code, stat);

  // Sample up to MAX_CASES, spread across the size range.
  const sized = input.cases.map((c) => ({ n: deriveSize(c.stdin), stdin: c.stdin })).sort((a, b) => a.n - b.n);
  const step = Math.max(1, Math.floor(sized.length / MAX_CASES));
  const sample = sized.filter((_, i) => i % step === 0).slice(0, MAX_CASES);

  const timePts: { n: number; ops: number }[] = [];
  const spacePts: { n: number; ops: number }[] = [];
  let smallestSteps: SimStep[] = [];
  let smallestN = Infinity;

  for (const c of sample) {
    const t = runInstrumented(input.runnable ?? input.code, c.stdin);
    if (!t.ok || t.ops === 0) continue;
    timePts.push({ n: c.n, ops: t.ops });
    spacePts.push({ n: c.n, ops: Object.keys(t.hits).length }); // proxy: distinct active lines ~ allocation breadth
    if (c.n < smallestN) { smallestN = c.n; smallestSteps = t.steps; }
  }

  // Clip captured steps to user-code lines so the simulator stays aligned.
  const userLines = input.code.split('\n').length;
  smallestSteps = smallestSteps.filter(s => s.lineNumber <= userLines);

  if (timePts.length < 3) {
    // Fall back to static-only.
    const summary: ComplexitySummary = {
      bigOTime: stat.guessTime, bigOSpace: guessSpace, confidence: 0.2,
      staticGuess: { time: stat.guessTime, space: guessSpace },
      explanation: 'Not enough runnable samples to measure; showing structural estimate only.',
      hotspots: [], perLine: annotations, suggestion: stat.suggestion,
    };
    return { summary, steps: smallestSteps, status: 'failed' };
  }

  const timeFit = fitCurve(timePts);
  const spaceFit = fitCurve(spacePts);
  const summary = reconcile({
    staticTime: stat.guessTime, staticSpace: guessSpace, lowConfidence: stat.lowConfidence,
    timeFit, spaceFit, annotations, suggestion: stat.suggestion, recursive: stat.recursive,
  });
  // Prefer measured space label only when it grows; otherwise keep static space heuristic.
  if (spaceFit.bigO === 'O(1)' || spaceFit.bigO === 'unknown') summary.bigOSpace = guessSpace;
  return { summary, steps: smallestSteps, status: 'done' };
}
