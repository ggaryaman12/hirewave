import { expect, test } from 'vitest';
import { deriveSize } from '@/lib/complexity/dynamic/size';

test('returns count for multiple integers', () => {
  expect(deriveSize('5\n1 2 3 4 5')).toBe(6); // all numeric tokens
});
test('returns numeric value for a single integer', () => {
  expect(deriveSize('40')).toBe(40);
  expect(deriveSize('-5')).toBe(5);
  expect(deriveSize('0')).toBe(0);
});
test('falls back to byte length when no numbers', () => {
  expect(deriveSize('abcd')).toBe(4);
});
