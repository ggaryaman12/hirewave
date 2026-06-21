import { expect, test } from 'vitest';
import { fitCurve } from '@/lib/complexity/fit';

const mk = (f: (n: number) => number) => [8, 16, 32, 64, 128, 256].map((n) => ({ n, ops: f(n) }));

test('linear data -> O(n)', () => {
  expect(fitCurve(mk((n) => 3 * n + 5)).bigO).toBe('O(n)');
});
test('quadratic data -> O(n^2)', () => {
  expect(fitCurve(mk((n) => n * n)).bigO).toBe('O(n^2)');
});
test('n log n distinguished from n', () => {
  expect(fitCurve(mk((n) => n * Math.log2(n))).bigO).toBe('O(n log n)');
});
test('confidence within 0..1', () => {
  const f = fitCurve(mk((n) => n));
  expect(f.confidence).toBeGreaterThan(0);
  expect(f.confidence).toBeLessThanOrEqual(1);
});
