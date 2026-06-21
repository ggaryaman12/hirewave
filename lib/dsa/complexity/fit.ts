// Empirical complexity inference: given (inputSize n, measured cost) points,
// fit each candidate complexity class and pick the best-fitting one. "Cost" is
// runtime (ms) for time complexity or peak memory (kb) for space complexity.
//
// Method (same idea as big-o-calculator / pberkes' big_O): for each class with
// growth function f(n), do an ordinary least-squares fit cost ≈ a·f(n) + b and
// score it by R². The constant b absorbs fixed overhead (process startup, base
// memory); a must be ≥ 0 (cost can't shrink as n grows). Highest R² wins, ties
// break toward the simpler (lower) class.

export type ComplexityClass = 'O(1)' | 'O(log n)' | 'O(n)' | 'O(n log n)' | 'O(n^2)' | 'O(n^3)';

type ClassDef = { label: ComplexityClass; f: (n: number) => number };

// Ordered simplest -> most complex (used for tie-breaking).
const CLASSES: ClassDef[] = [
  { label: 'O(1)', f: () => 1 },
  { label: 'O(log n)', f: (n) => Math.log2(Math.max(2, n)) },
  { label: 'O(n)', f: (n) => n },
  { label: 'O(n log n)', f: (n) => n * Math.log2(Math.max(2, n)) },
  { label: 'O(n^2)', f: (n) => n * n },
  { label: 'O(n^3)', f: (n) => n * n * n },
];

export type FitResult = { label: ComplexityClass; confidence: number };

// Ordinary least squares for y = a*x + b. Returns slope a, intercept b, and R².
function leastSquares(xs: number[], ys: number[]): { a: number; b: number; r2: number } {
  const n = xs.length;
  const sx = xs.reduce((s, v) => s + v, 0);
  const sy = ys.reduce((s, v) => s + v, 0);
  const sxx = xs.reduce((s, v) => s + v * v, 0);
  const sxy = xs.reduce((s, v, i) => s + v * ys[i], 0);
  const denom = n * sxx - sx * sx;
  if (denom === 0) return { a: 0, b: sy / n, r2: 0 };
  const a = (n * sxy - sx * sy) / denom;
  const b = (sy - a * sx) / n;
  const meanY = sy / n;
  let ssTot = 0;
  let ssRes = 0;
  for (let i = 0; i < n; i += 1) {
    const pred = a * xs[i] + b;
    ssTot += (ys[i] - meanY) ** 2;
    ssRes += (ys[i] - pred) ** 2;
  }
  const r2 = ssTot === 0 ? 1 : 1 - ssRes / ssTot;
  return { a, b, r2 };
}

const EPS = 0; // strict best R²; exact ties keep the earlier (simpler) class
const FLAT_THRESHOLD = 0.15; // relative spread below which cost is "constant"

export function fitComplexity(points: { n: number; value: number }[]): FitResult {
  const clean = points.filter((p) => Number.isFinite(p.n) && Number.isFinite(p.value) && p.n > 0);
  if (clean.length < 3) return { label: 'O(n)', confidence: 0 };

  // O(1) is the baseline (cost ≈ mean): least-squares can't score it (constant x
  // is degenerate, and R² is defined relative to the mean). Detect it directly —
  // if cost barely changes as n grows, it's constant.
  const ys = clean.map((p) => p.value);
  const mean = ys.reduce((s, v) => s + v, 0) / ys.length;
  const spread = (Math.max(...ys) - Math.min(...ys)) / (mean || 1);
  if (spread < FLAT_THRESHOLD) {
    return { label: 'O(1)', confidence: Math.max(0, Math.min(1, 1 - spread / FLAT_THRESHOLD)) };
  }

  // Otherwise fit the growth classes (skip O(1)) and take the best R².
  let best: { label: ComplexityClass; r2: number } | null = null;
  for (const cls of CLASSES) {
    if (cls.label === 'O(1)') continue;
    const xs = clean.map((p) => cls.f(p.n));
    const { a, r2 } = leastSquares(xs, ys);
    // A growing cost can't have a negative coefficient on the growth term.
    const score = a < 0 ? r2 - 1 : r2;
    if (!best || score > best.r2 + EPS) best = { label: cls.label, r2: score };
  }
  if (!best) return { label: 'O(n)', confidence: 0 };
  return { label: best.label, confidence: Math.max(0, Math.min(1, best.r2)) };
}
