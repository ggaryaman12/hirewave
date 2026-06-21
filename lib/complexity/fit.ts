import type { BigO, EmpiricalFit } from '@/lib/complexity/types';

const MODELS: { bigO: BigO; f: (n: number) => number }[] = [
  { bigO: 'O(1)', f: () => 1 },
  { bigO: 'O(log n)', f: (n) => Math.log2(Math.max(2, n)) },
  { bigO: 'O(n)', f: (n) => n },
  { bigO: 'O(n log n)', f: (n) => n * Math.log2(Math.max(2, n)) },
  { bigO: 'O(n^2)', f: (n) => n * n },
  { bigO: 'O(n^3)', f: (n) => n * n * n },
  { bigO: 'O(2^n)', f: (n) => Math.pow(2, Math.min(n, 30)) },
];

// R² of ops ≈ c·model(n) via least squares through origin on (model, ops).
function rSquared(xs: number[], ys: number[]): number {
  const sxx = xs.reduce((a, x) => a + x * x, 0);
  const sxy = xs.reduce((a, x, i) => a + x * ys[i], 0);
  if (sxx === 0) return 0;
  const c = sxy / sxx;
  const meanY = ys.reduce((a, y) => a + y, 0) / ys.length;
  const ssTot = ys.reduce((a, y) => a + (y - meanY) ** 2, 0);
  const ssRes = ys.reduce((a, y, i) => a + (y - c * xs[i]) ** 2, 0);
  return ssTot === 0 ? 1 : Math.max(0, 1 - ssRes / ssTot);
}

// Ratio variance: ops/model should be flat for the true model. Lower = better.
function ratioVar(xs: number[], ys: number[]): number {
  const ratios = ys.map((y, i) => (xs[i] === 0 ? 0 : y / xs[i]));
  const mean = ratios.reduce((a, r) => a + r, 0) / ratios.length;
  if (mean === 0) return Infinity;
  const v = ratios.reduce((a, r) => a + (r - mean) ** 2, 0) / ratios.length;
  return v / (mean * mean); // coefficient of variation²
}

export function fitCurve(points: { n: number; ops: number }[]): EmpiricalFit {
  const pts = points.filter((p) => Number.isFinite(p.n) && Number.isFinite(p.ops)).sort((a, b) => a.n - b.n);
  if (pts.length < 3) return { bigO: 'unknown', confidence: 0, points: pts };
  const ys = pts.map((p) => p.ops);
  let best = { bigO: 'unknown' as BigO, score: -Infinity, conf: 0 };
  for (const m of MODELS) {
    const xs = pts.map((p) => m.f(p.n));
    const r2 = rSquared(xs, ys);
    const cv = ratioVar(xs, ys);
    const score = r2 - 0.5 * Math.min(1, cv); // penalise non-flat ratios (n vs n log n tie-break)
    if (score > best.score) best = { bigO: m.bigO, score, conf: r2 };
  }
  return { bigO: best.bigO, confidence: Number(best.conf.toFixed(3)), points: pts };
}
