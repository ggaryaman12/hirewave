import { expect, test } from '@playwright/test';
import { slugify, transformRow, type RawRow } from '../../scripts/import-dataset/transform';

const baseRow: RawRow = {
  name: 'A. Watermelon',
  description: 'Pete and Billy want to split a watermelon...',
  source: 2,
  cf_rating: 800,
  public_tests: { input: ['8\n'], output: ['YES\n'] },
  private_tests: { input: ['2\n', '3\n'], output: ['NO\n', 'NO\n'] },
  generated_tests: { input: ['100\n'], output: ['YES\n'] },
};

test.describe('code_contests transform (pure)', () => {
  test('slugify normalizes titles', () => {
    expect(slugify('A. Watermelon')).toBe('a-watermelon');
    expect(slugify('!!!')).toBe('problem');
  });

  test('maps a valid row to a normalized problem with attribution', () => {
    const p = transformRow(baseRow)!;
    expect(p).not.toBeNull();
    expect(p.slug).toBe('a-watermelon');
    expect(p.title).toBe('A. Watermelon');
    expect(p.difficulty).toBe('easy'); // cf_rating 800 < 1200
    expect(p.attribution).toContain('CC BY 4.0');
    expect(p.attribution).toContain('Codeforces');
  });

  test('flags public tests as samples, private/generated as hidden', () => {
    const p = transformRow(baseRow)!;
    const samples = p.testCases.filter((t) => t.isSample);
    const hidden = p.testCases.filter((t) => !t.isSample);
    expect(samples).toHaveLength(1);
    expect(hidden).toHaveLength(3); // 2 private + 1 generated
    expect(samples[0].expected).toBe('YES'); // trailing whitespace trimmed
  });

  test('infers float comparison from error-tolerance wording', () => {
    const p = transformRow({ ...baseRow, description: 'Print the area with absolute or relative error 1e-6.' })!;
    expect(p.comparison).toBe('float');
    expect(p.floatEpsilon).toBe(1e-6);
  });

  test('caps hidden cases', () => {
    const many = Array.from({ length: 80 }, (_, i) => `${i}\n`);
    const p = transformRow({ ...baseRow, private_tests: { input: many, output: many } }, { maxHiddenCases: 10 })!;
    expect(p.testCases.filter((t) => !t.isSample).length).toBe(10);
  });

  test('returns null for unusable rows', () => {
    expect(transformRow({ name: 'x', description: '' })).toBeNull();
    expect(transformRow({ name: 'x', description: 'has text', public_tests: {}, private_tests: {} })).toBeNull();
  });
});
