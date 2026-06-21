import { expect, test } from 'vitest';
import { instrumentJs } from '@/lib/complexity/dynamic/instrument-js';

function runInProc(src: string): any {
  let captured = '';
  const log = (s: string) => { if (typeof s === 'string' && s.startsWith('__CX__')) captured = s.slice(6); };
  const fn = new Function('console', src + '\n; __cx_flush();');
  fn({ log });
  return JSON.parse(captured);
}

test('counts loop iterations as ops', () => {
  const code = `function f(a){let s=0;for(let i=0;i<a.length;i++){s+=a[i];}return s;}\nf([1,2,3,4,5]);`;
  const t = runInProc(instrumentJs(code));
  expect(t.ops).toBeGreaterThanOrEqual(5);
  expect(t.truncated).toBe(false);
});

test('records per-line hits', () => {
  const code = `function f(n){let s=0;\nfor(let i=0;i<n;i++){ s+=i; }\nreturn s;}\nf(3);`;
  const t = runInProc(instrumentJs(code));
  expect(Object.values(t.hits).some((v: any) => v >= 3)).toBe(true);
});

test('captures variables and a call stack array', () => {
  const code = `function f(a){let s=0;for(let i=0;i<a.length;i++){s+=a[i];}return s;}\nf([10,20,30]);`;
  const t = runInProc(instrumentJs(code));
  expect(Array.isArray(t.steps[0].callStack)).toBe(true);
  const withVars = t.steps.find((s: any) => s.variables && ('i' in s.variables || 's' in s.variables));
  expect(withVars).toBeTruthy();
});

test('recursion increases recursionDepth', () => {
  const code = `function fib(n){if(n<2)return n;return fib(n-1)+fib(n-2);}\nfib(4);`;
  const t = runInProc(instrumentJs(code));
  const maxDepth = Math.max(...t.steps.map((s: any) => s.recursionDepth));
  expect(maxDepth).toBeGreaterThanOrEqual(2);
});

test('line numbers stay aligned to original source', () => {
  // `return s;` is on original line 1; a step must report line 1, not a shifted line.
  const code = `function f(a){let s=0;for(let i=0;i<a.length;i++){s+=a[i];}return s;}\nf([1,2,3]);`;
  const t = runInProc(instrumentJs(code));
  expect(t.steps.some((s: any) => s.lineNumber === 1)).toBe(true);
});
