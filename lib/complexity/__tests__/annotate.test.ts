import { expect, test } from 'vitest';
import { analyzeStaticJs } from '@/lib/complexity/static/parse-js';
import { annotateLines } from '@/lib/complexity/static/annotate';

test('inner loop body line marked ~n^2 and inLoop', () => {
  const code = `function f(a){\n  let c=0;\n  for(let i=0;i<a.length;i++){\n    for(let j=0;j<a.length;j++){\n      c++;\n    }\n  }\n  return c;\n}`;
  const base = analyzeStaticJs(code);
  const { annotations } = annotateLines(code, base);
  const inner = annotations.find((a) => a.line === 5)!;
  expect(inner.inLoop).toBe(true);
  expect(inner.timeFactor).toBe('O(n^2)');
});

test('array allocation gives O(n) space', () => {
  const code = `function f(n){\n  const out=[];\n  for(let i=0;i<n;i++){ out.push(i); }\n  return out;\n}`;
  const base = analyzeStaticJs(code);
  const { guessSpace } = annotateLines(code, base);
  expect(guessSpace).toBe('O(n)');
});
