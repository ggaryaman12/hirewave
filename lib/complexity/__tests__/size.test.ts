import { expect, test } from 'vitest';
import { deriveSize } from '@/lib/complexity/dynamic/size';

test('counts integers in stdin', () => {
  expect(deriveSize('5\n1 2 3 4 5')).toBe(6); // all numeric tokens
});
test('falls back to byte length when no numbers', () => {
  expect(deriveSize('abcd')).toBe(4);
});
