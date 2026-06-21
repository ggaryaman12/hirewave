import { expect, test } from 'vitest';
import { analyzeStaticJs } from '@/lib/complexity/static/parse-js';

test('single loop -> O(n), depth 1', () => {
  const r = analyzeStaticJs(`function f(a){let s=0;for(let i=0;i<a.length;i++){s+=a[i];}return s;}`);
  expect(r.maxLoopDepth).toBe(1);
  expect(r.guessTime).toBe('O(n)');
  expect(r.recursive).toBe(false);
});

test('nested loop -> O(n^2), depth 2', () => {
  const r = analyzeStaticJs(`function f(a){let c=0;for(let i=0;i<a.length;i++){for(let j=0;j<a.length;j++){c++;}}return c;}`);
  expect(r.maxLoopDepth).toBe(2);
  expect(r.guessTime).toBe('O(n^2)');
});

test('halving loop -> O(log n)', () => {
  const r = analyzeStaticJs(`function f(n){let k=0;for(let i=1;i<n;i*=2){k++;}return k;}`);
  expect(r.guessTime).toBe('O(log n)');
});

test('self recursion flagged', () => {
  const r = analyzeStaticJs(`function fib(n){if(n<2)return n;return fib(n-1)+fib(n-2);}`);
  expect(r.recursive).toBe(true);
});

test('nested loop with map lookup suggests hash map', () => {
  const r = analyzeStaticJs(`function f(a){for(let i=0;i<a.length;i++){for(let j=0;j<a.length;j++){if(a[i]+a[j]===0)return [i,j];}}return [];}`);
  expect(r.suggestion).toMatch(/hash|map/i);
});
