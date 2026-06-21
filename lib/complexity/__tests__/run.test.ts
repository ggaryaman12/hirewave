import { expect, test } from 'vitest';
import { runInstrumented } from '@/lib/complexity/dynamic/run';

test('runs instrumented JS via node and returns ops', () => {
  const code = `const n=Number(require('fs').readFileSync(0,'utf8').trim());let s=0;for(let i=0;i<n;i++){s+=i;}console.error(s);`;
  const t = runInstrumented(code, '100');
  expect(t.ok).toBe(true);
  expect(t.ops).toBeGreaterThanOrEqual(100);
});

test('timeout -> ok false', () => {
  const code = `while(true){}`;
  const t = runInstrumented(code, '', 800);
  expect(t.ok).toBe(false);
});
