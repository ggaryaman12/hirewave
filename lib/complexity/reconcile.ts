import type { BigO, ComplexitySummary, EmpiricalFit, LineAnnotation } from '@/lib/complexity/types';

export function reconcile(args: {
  staticTime: BigO; staticSpace: BigO; lowConfidence: boolean;
  timeFit: EmpiricalFit; spaceFit: EmpiricalFit;
  annotations: LineAnnotation[]; suggestion?: string; recursive: boolean;
}): ComplexitySummary {
  const measuredTime = args.timeFit.bigO !== 'unknown' ? args.timeFit.bigO : args.staticTime;
  const measuredSpace = args.spaceFit.bigO !== 'unknown' ? args.spaceFit.bigO : args.staticSpace;

  let explanation: string;
  if (args.staticTime !== 'unknown' && args.staticTime !== measuredTime && args.timeFit.bigO !== 'unknown') {
    explanation = `Code structure looks ${args.staticTime}, but measured growth is ${measuredTime} — likely an early exit, a built-in sort, or data-dependent behavior.`;
  } else if (args.recursive) {
    explanation = `Recursive solution; measured growth across input sizes is ${measuredTime}.`;
  } else {
    explanation = `Operation count grows as ${measuredTime}; memory as ${measuredSpace}.`;
  }

  // Hotspots: top lines by hit share come from the caller (passed via annotations note),
  // here we approximate share from loop depth ranking.
  const ranked = [...args.annotations].sort((a, b) => Number(b.inLoop) - Number(a.inLoop)).slice(0, 5);
  const hotspots = ranked.map((a, i) => ({ line: a.line, share: Number((1 / (i + 1)).toFixed(2)) }));

  return {
    bigOTime: measuredTime,
    bigOSpace: measuredSpace,
    confidence: args.timeFit.confidence,
    staticGuess: { time: args.staticTime, space: args.staticSpace },
    explanation,
    hotspots,
    perLine: args.annotations,
    suggestion: args.suggestion,
  };
}
