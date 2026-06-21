import { expect, test } from '@playwright/test';
import { fitComplexity } from '../../lib/dsa/complexity/fit';

const SIZES = [1000, 2000, 4000, 8000, 16000];
// O(n) vs O(n log n) only separates over a wide n range (log factor barely moves
// otherwise) — empirical reality, so the n-log-n case samples larger sizes.
const WIDE_SIZES = [1000, 10000, 100000, 500000, 1000000];

function pts(growth: (n: number) => number, sizes = SIZES, overheadMs = 5) {
  return sizes.map((n) => ({ n, value: overheadMs + growth(n) / 1000 }));
}

test.describe('complexity curve fit', () => {
  test('identifies O(n)', () => {
    expect(fitComplexity(pts((n) => n)).label).toBe('O(n)');
  });

  test('identifies O(n^2)', () => {
    expect(fitComplexity(pts((n) => n * n)).label).toBe('O(n^2)');
  });

  test('identifies O(n log n)', () => {
    expect(fitComplexity(pts((n) => n * Math.log2(n), WIDE_SIZES)).label).toBe('O(n log n)');
  });

  test('identifies O(1) for flat cost', () => {
    expect(fitComplexity(SIZES.map((n) => ({ n, value: 7 }))).label).toBe('O(1)');
  });

  test('identifies O(log n)', () => {
    expect(fitComplexity(pts((n) => 50000 * Math.log2(n))).label).toBe('O(log n)');
  });

  test('returns low confidence with too few points', () => {
    const r = fitComplexity([{ n: 1000, value: 1 }, { n: 2000, value: 2 }]);
    expect(r.confidence).toBe(0);
  });

  test('confidence is high for a clean curve', () => {
    expect(fitComplexity(pts((n) => n)).confidence).toBeGreaterThan(0.95);
  });
});
