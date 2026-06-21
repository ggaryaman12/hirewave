import { expect, test } from 'vitest';
import { analyzeComplexity } from '@/lib/complexity/analyze';

// Self-contained JS program reading "n" from stdin, doing n^2 work.
const quad = `const n=Number(require('fs').readFileSync(0,'utf8').trim());let c=0;for(let i=0;i<n;i++){for(let j=0;j<n;j++){c++;}}console.error(c);`;

test('measures quadratic program as O(n^2)', () => {
  const cases = [4, 8, 16, 24, 32, 40].map((n) => ({ stdin: String(n) }));
  const r = analyzeComplexity({ code: quad, lang: 'javascript', cases });
  expect(r.status).toBe('done');
  expect(r.summary.bigOTime).toBe('O(n^2)');
  expect(r.summary.confidence).toBeGreaterThan(0.8);
});
