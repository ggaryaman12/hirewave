export type BigO =
  | 'O(1)' | 'O(log n)' | 'O(n)' | 'O(n log n)'
  | 'O(n^2)' | 'O(n^3)' | 'O(2^n)' | 'unknown';

export interface LineAnnotation {
  line: number;          // 1-based, aligned to editor
  executed: string;      // human, e.g. "~n times"
  timeFactor: BigO;      // structural contribution
  spaceImpact: 'none' | 'O(1)' | 'O(n)' | 'O(n^2)';
  note: string;
  inLoop: boolean;
  inRecursion: boolean;
}

export interface StaticResult {
  guessTime: BigO;
  guessSpace: BigO;
  lowConfidence: boolean;   // an unknown loop bound sat on a hot path
  annotations: LineAnnotation[];
  recursive: boolean;
  maxLoopDepth: number;
  suggestion?: string;
}

export interface Telemetry {
  ops: number;                       // total counter ticks
  hits: Record<number, number>;      // line -> tick count
  steps: SimStep[];                  // capped at MAX_STEPS
  truncated: boolean;
  ok: boolean;                       // false on runtime error / timeout
}

export interface SimStep {
  idx: number;
  lineNumber: number;
  recursionDepth: number;
  callStack: string[];                  // function names, innermost last
  variables: Record<string, string>;    // captured in-scope vars (<=12), stringified
  note?: string;
}

export interface EmpiricalFit {
  bigO: BigO;
  confidence: number;     // 0..1 (best R², penalised by ratio variance)
  points: { n: number; ops: number }[];
}

export interface ComplexitySummary {
  bigOTime: BigO;
  bigOSpace: BigO;
  confidence: number;
  staticGuess: { time: BigO; space: BigO };
  explanation: string;
  hotspots: { line: number; share: number }[];
  perLine: LineAnnotation[];
  suggestion?: string;
}
