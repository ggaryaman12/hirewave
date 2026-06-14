import type { ComparisonPolicy } from '@/lib/judge/types';

// Output comparison is a top source of wrong verdicts, so it is pure + dedicated.

function normalizeWhitespace(value: string) {
  return value
    .replace(/\r\n/g, '\n')
    .split('\n')
    .map((line) => line.replace(/[ \t]+$/g, '')) // trailing spaces per line
    .join('\n')
    .replace(/\n+$/g, ''); // trailing blank lines
}

function tokenize(value: string) {
  return value.trim().split(/\s+/).filter(Boolean);
}

export function compareOutput(
  expected: string,
  actual: string,
  policy: ComparisonPolicy = 'whitespace',
  floatEpsilon = 1e-6,
): boolean {
  if (policy === 'exact') {
    return expected === actual;
  }

  if (policy === 'float') {
    const expectedTokens = tokenize(expected);
    const actualTokens = tokenize(actual);
    if (expectedTokens.length !== actualTokens.length) return false;

    for (let i = 0; i < expectedTokens.length; i += 1) {
      const expectedNum = Number(expectedTokens[i]);
      const actualNum = Number(actualTokens[i]);
      const bothNumeric = Number.isFinite(expectedNum) && Number.isFinite(actualNum);
      if (bothNumeric) {
        if (Math.abs(expectedNum - actualNum) > floatEpsilon) return false;
      } else if (expectedTokens[i] !== actualTokens[i]) {
        return false;
      }
    }
    return true;
  }

  // whitespace (default)
  return normalizeWhitespace(expected) === normalizeWhitespace(actual);
}
