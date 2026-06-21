# Complexity Analyzer — Phase 1 (JavaScript vertical slice) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a NEW, independent "Analyze Complexity v2" feature for **JavaScript** solutions in the DSA workspace — a static AST annotator + an interactive line-by-line simulator (step debugger) + its own dynamic op-count measurement — so it can be **compared side-by-side** against the existing empirical engine. This is a parallel/experimental build for evaluation.

**ISOLATION (critical):** This build MUST NOT modify, import-break, or change the behavior of the existing complexity engine. Off-limits: `lib/dsa/complexity/**`, `app/api/dsa/problems/[slug]/complexity/route.ts`, and the `ComplexitySection` component in `components/dsa/problem-workspace.tsx`. The existing engine stays exactly as shipped in commit e89de93. The new build lives in its own namespace (`lib/complexity/**`), its own API path (`app/api/dsa/complexity-v2/**`), and its own panel component, mounted next to (not replacing) the existing section for comparison.

**Architecture:** Dynamic measurement is ground truth; static AST is the explainer; the simulator makes it interactive. On click, an API route runs a static pass (acorn AST → loop/recursion detection → per-line notes), runs the dynamic pass (instrument the JS, execute on existing `DsaTestCase` inputs via the local `node` runner, count operations per run, curve-fit ops-vs-size), captures a full step trace (line + recursion depth + call stack + variable snapshots) from the smallest input, reconciles into a `ComplexitySummary`, and persists to `ComplexityAnalysisV2` + `SimulationStep`. The frontend renders per-line overlays plus a step-forward/back debugger (call stack + variables panels) over Monaco.

**Tech Stack:** Next.js 14 (App Router, route handlers), TypeScript, Prisma/SQLite, `acorn` + `acorn-walk` (AST), `vitest` (unit tests), existing `lib/judge/local-provider` pattern for sandboxed `node` execution, Monaco (`@monaco-editor/react`) for editor overlays.

## Global Constraints

- **Isolation:** do NOT edit `lib/dsa/complexity/**`, `app/api/dsa/problems/[slug]/complexity/route.ts`, or the `ComplexitySection` in `components/dsa/problem-workspace.tsx`. New build only.
- Language scope: **JavaScript only** for this comparison build. C++/Java out of scope. Reject non-JS in the API with a clear `unsupported_language` status.
- New code under `lib/complexity/**`. Pure algorithm modules (static, instrument, fit) must have **zero** Next/Prisma imports so they unit-test in isolation.
- Dynamic execution runs **only** through the local `node` runner pattern (`spawnSync` + wall-clock timeout); never `eval` in-process. Hard caps: per-run wall-clock 2000ms, op ceiling 5_000_000, max test cases sampled 24, `MAX_STEPS` 5000 for simulation, max variables captured per step 12.
- On-click only — never wire analysis to editor change events.
- Cache key is `codeHash = sha256(`${lang}\n${problemId}\n${code}`)`, stored unique on `ComplexityAnalysisV2.codeHash`.
- All new API routes live under `app/api/dsa/complexity-v2/`.
- Prisma client: import `{ db } from '@/lib/db'` (the repo's client; there is no `@/lib/prisma`). Models: `db.complexityAnalysisV2`, `db.simulationStepV2`, `db.dsaTestCase` (fields `input`, `problemId` — confirmed), `db.dsaProblem` (lookup by `slug`).
- The DSA language enum is `LANGUAGES` from `@/lib/constants`; JS value is `'javascript'`.
- Add npm deps from the public registry only: `acorn`, `acorn-walk` (deps); `vitest` (dev).
- Confidence (`number`, 0–1) must always be set; never present a Big-O without it.
- Prisma model names are suffixed `V2` to avoid any collision with existing complexity persistence (`DsaSubmission.complexityJson`).

---

## File Structure

- `prisma/schema.prisma` — add `ComplexityAnalysis`, `SimulationStep` models.
- `lib/complexity/types.ts` — all shared interfaces (no logic).
- `lib/complexity/static/parse-js.ts` — acorn parse + AST → structural analysis (loops, recursion, library ops) → `StaticResult`.
- `lib/complexity/static/annotate.ts` — `StaticResult` → `LineAnnotation[]` + structural Big-O guess.
- `lib/complexity/dynamic/instrument-js.ts` — source-transform: inject op/line counters + step trace; returns instrumented source string.
- `lib/complexity/dynamic/run.ts` — execute instrumented JS on one stdin via `node` temp-dir runner; parse the emitted JSON telemetry.
- `lib/complexity/dynamic/size.ts` — derive an input-size scalar `n` from a test-case stdin.
- `lib/complexity/fit.ts` — curve-fit ops-vs-n against the candidate ladder; ratio-test tie-break → `{ bigO, confidence }`.
- `lib/complexity/reconcile.ts` — merge static guess + dynamic fit → `ComplexitySummary`.
- `lib/complexity/analyze.ts` — orchestrator: static → dynamic ladder → fit → reconcile → simulation capture → returns persisted-shape object (no Prisma import; takes data in, returns data out).
- `lib/complexity/store.ts` — Prisma read/write by `codeHash` (the only DB-touching module).
- `app/api/dsa/complexity/route.ts` — `POST` analyze (static-ready fast path + kick dynamic) and is the single entry.
- `app/api/dsa/complexity/[id]/route.ts` — `GET` full result.
- `app/api/dsa/complexity/[id]/simulation/route.ts` — `GET` paginated steps.
- `components/dsa/ComplexityPanel.tsx` — Analyze button + results panel + hotspot list.
- `lib/complexity/__tests__/*.test.ts` — vitest unit tests.
- `vitest.config.ts`, `package.json` — test runner wiring.

---

### Task 1: Test runner + dependencies

**Files:**
- Modify: `package.json` (deps + scripts)
- Create: `vitest.config.ts`
- Create: `lib/complexity/__tests__/smoke.test.ts`

**Interfaces:**
- Produces: `npm run test:unit` runs vitest over `lib/**`.

- [ ] **Step 1: Install deps**

Run:
```bash
npm i acorn@8 acorn-walk@8 && npm i -D vitest@2
```
Expected: installs succeed (registry.npmjs.org is allowed).

- [ ] **Step 2: Add vitest config**

Create `vitest.config.ts`:
```ts
import { defineConfig } from 'vitest/config';
import { resolve } from 'path';

export default defineConfig({
  resolve: { alias: { '@': resolve(__dirname, '.') } },
  test: { include: ['lib/**/*.test.ts'], environment: 'node' },
});
```

- [ ] **Step 3: Add script**

In `package.json` `"scripts"`, add:
```json
"test:unit": "vitest run"
```

- [ ] **Step 4: Write smoke test**

Create `lib/complexity/__tests__/smoke.test.ts`:
```ts
import { expect, test } from 'vitest';
test('vitest runs', () => { expect(1 + 1).toBe(2); });
```

- [ ] **Step 5: Run it**

Run: `npm run test:unit`
Expected: 1 passing test.

- [ ] **Step 6: Commit**

```bash
git add package.json package-lock.json vitest.config.ts lib/complexity/__tests__/smoke.test.ts
git commit -m "chore(complexity): add acorn + vitest for analyzer phase 1"
```

---

### Task 2: Shared types

**Files:**
- Create: `lib/complexity/types.ts`

**Interfaces:**
- Produces: `LineAnnotation`, `StaticResult`, `EmpiricalFit`, `SimStep`, `ComplexitySummary`, `Telemetry`, `BigO` consumed by every later task.

- [ ] **Step 1: Write the types**

Create `lib/complexity/types.ts`:
```ts
export type BigO =
  | 'O(1)' | 'O(log n)' | 'O(n)' | 'O(n log n)'
  | 'O(n^2)' | 'O(n^3)' | 'O(2^n)' | 'unknown';

export interface LineAnnotation {
  line: number;          // 1-based, aligned to editor
  executed: string;      // human, e.g. "~n times"
  timeFactor: BigO;      // structural contribution
  spaceImpact: 'none' | 'O(1)' | 'O(n)' | 'O(n^2)';
  note: string;
  inLoop: boolean;
  inRecursion: boolean;
}

export interface StaticResult {
  guessTime: BigO;
  guessSpace: BigO;
  lowConfidence: boolean;   // an unknown loop bound sat on a hot path
  annotations: LineAnnotation[];
  recursive: boolean;
  maxLoopDepth: number;
  suggestion?: string;
}

export interface Telemetry {
  ops: number;                       // total counter ticks
  hits: Record<number, number>;      // line -> tick count
  steps: SimStep[];                  // capped at MAX_STEPS
  truncated: boolean;
  ok: boolean;                       // false on runtime error / timeout
}

export interface SimStep {
  idx: number;
  lineNumber: number;
  recursionDepth: number;
  callStack: string[];                  // function names, innermost last
  variables: Record<string, string>;    // captured in-scope vars (<=12), stringified
  note?: string;
}

export interface EmpiricalFit {
  bigO: BigO;
  confidence: number;     // 0..1 (best R², penalised by ratio variance)
  points: { n: number; ops: number }[];
}

export interface ComplexitySummary {
  bigOTime: BigO;
  bigOSpace: BigO;
  confidence: number;
  staticGuess: { time: BigO; space: BigO };
  explanation: string;
  hotspots: { line: number; share: number }[];
  perLine: LineAnnotation[];
  suggestion?: string;
}
```

- [ ] **Step 2: Typecheck**

Run: `npm run typecheck`
Expected: PASS (no errors).

- [ ] **Step 3: Commit**

```bash
git add lib/complexity/types.ts
git commit -m "feat(complexity): shared analyzer types"
```

---

### Task 3: Static engine — parse + structure detection

**Files:**
- Create: `lib/complexity/static/parse-js.ts`
- Test: `lib/complexity/__tests__/parse-js.test.ts`

**Interfaces:**
- Consumes: types from Task 2.
- Produces: `analyzeStaticJs(code: string): StaticResult`.

- [ ] **Step 1: Write failing tests**

Create `lib/complexity/__tests__/parse-js.test.ts`:
```ts
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
```

- [ ] **Step 2: Run to verify failure**

Run: `npm run test:unit -- parse-js`
Expected: FAIL (`analyzeStaticJs` not found).

- [ ] **Step 3: Implement**

Create `lib/complexity/static/parse-js.ts`:
```ts
import * as acorn from 'acorn';
import type { BigO, StaticResult } from '@/lib/complexity/types';

type Node = acorn.Node & Record<string, any>;

// Detect i*=2 / i/=2 style halving update => logarithmic loop.
function isHalvingLoop(node: Node): boolean {
  const u = node.update;
  if (!u) return false;
  if (u.type === 'AssignmentExpression' && (u.operator === '*=' || u.operator === '/=')) return true;
  if (u.type === 'AssignmentExpression' && u.operator === '=' &&
      u.right?.type === 'BinaryExpression' && (u.right.operator === '*' || u.right.operator === '/')) return true;
  return false;
}

const LOOP_TYPES = new Set(['ForStatement', 'WhileStatement', 'DoWhileStatement', 'ForOfStatement', 'ForInStatement']);

export function analyzeStaticJs(code: string): StaticResult {
  let ast: Node;
  try {
    ast = acorn.parse(code, { ecmaVersion: 2022, locations: true }) as unknown as Node;
  } catch {
    return { guessTime: 'unknown', guessSpace: 'unknown', lowConfidence: true, annotations: [], recursive: false, maxLoopDepth: 0 };
  }

  const fnNames = new Set<string>();
  (function collect(n: Node) {
    if (!n || typeof n.type !== 'string') return;
    if (n.type === 'FunctionDeclaration' && n.id) fnNames.add(n.id.name);
    for (const k of Object.keys(n)) {
      const c = (n as any)[k];
      if (Array.isArray(c)) c.forEach((x) => x && x.type && collect(x));
      else if (c && c.type) collect(c);
    }
  })(ast);

  let maxLoopDepth = 0;
  let hasLog = false;
  let recursive = false;
  let sawMapLookupInNested = false;
  let nestedLoopWithCompare = false;

  (function walk(n: Node, loopDepth: number) {
    if (!n || typeof n.type !== 'string') return;
    let depth = loopDepth;
    if (LOOP_TYPES.has(n.type)) {
      depth = loopDepth + 1;
      maxLoopDepth = Math.max(maxLoopDepth, depth);
      if (n.type === 'ForStatement' && isHalvingLoop(n)) hasLog = true;
    }
    if (n.type === 'CallExpression') {
      const callee = n.callee;
      if (callee?.type === 'Identifier' && fnNames.has(callee.name)) recursive = true; // approx self/mutual recursion
      // 2-sum smell: nested loops comparing array elements
    }
    if (depth >= 2 && n.type === 'BinaryExpression' && (n.operator === '===' || n.operator === '==')) nestedLoopWithCompare = true;
    for (const k of Object.keys(n)) {
      const c = (n as any)[k];
      if (Array.isArray(c)) c.forEach((x) => x && x.type && walk(x, depth));
      else if (c && c.type) walk(c, depth);
    }
  })(ast, 0);

  let guessTime: BigO = 'O(1)';
  if (recursive) guessTime = 'unknown';            // resolved by dynamic pass
  else if (maxLoopDepth >= 3) guessTime = 'O(n^3)';
  else if (maxLoopDepth === 2) guessTime = 'O(n^2)';
  else if (maxLoopDepth === 1) guessTime = hasLog ? 'O(log n)' : 'O(n)';
  else if (hasLog) guessTime = 'O(log n)';

  const result: StaticResult = {
    guessTime,
    guessSpace: 'unknown',
    lowConfidence: recursive,
    annotations: [],
    recursive,
    maxLoopDepth,
  };
  if (nestedLoopWithCompare) result.suggestion = 'Nested loops doing element comparisons — a hash map can often drop this to O(n).';
  return result;
}
```

- [ ] **Step 4: Run tests**

Run: `npm run test:unit -- parse-js`
Expected: PASS (5 tests).

- [ ] **Step 5: Commit**

```bash
git add lib/complexity/static/parse-js.ts lib/complexity/__tests__/parse-js.test.ts
git commit -m "feat(complexity): static JS structure analysis (loops/recursion/suggestions)"
```

---

### Task 4: Per-line annotations + space guess

**Files:**
- Create: `lib/complexity/static/annotate.ts`
- Test: `lib/complexity/__tests__/annotate.test.ts`

**Interfaces:**
- Consumes: `StaticResult` (Task 3), types (Task 2). Re-parses with acorn `locations` to map nodes to lines.
- Produces: `annotateLines(code: string, base: StaticResult): { annotations: LineAnnotation[]; guessSpace: BigO }`.

- [ ] **Step 1: Write failing test**

Create `lib/complexity/__tests__/annotate.test.ts`:
```ts
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
```

- [ ] **Step 2: Run to verify failure**

Run: `npm run test:unit -- annotate`
Expected: FAIL (`annotateLines` not found).

- [ ] **Step 3: Implement**

Create `lib/complexity/static/annotate.ts`:
```ts
import * as acorn from 'acorn';
import type { BigO, LineAnnotation, StaticResult } from '@/lib/complexity/types';

type Node = acorn.Node & Record<string, any>;
const LOOP_TYPES = new Set(['ForStatement', 'WhileStatement', 'DoWhileStatement', 'ForOfStatement', 'ForInStatement']);

const TIME_BY_DEPTH: BigO[] = ['O(1)', 'O(n)', 'O(n^2)', 'O(n^3)'];

export function annotateLines(code: string, base: StaticResult): { annotations: LineAnnotation[]; guessSpace: BigO } {
  let ast: Node;
  try { ast = acorn.parse(code, { ecmaVersion: 2022, locations: true }) as unknown as Node; }
  catch { return { annotations: [], guessSpace: 'unknown' }; }

  const byLine = new Map<number, { depth: number; alloc: boolean; inRec: boolean }>();
  let pushInLoop = false;

  (function walk(n: Node, depth: number, inRec: boolean) {
    if (!n || typeof n.type !== 'string') return;
    let d = depth;
    if (LOOP_TYPES.has(n.type)) d = depth + 1;
    const line: number | undefined = n.loc?.start?.line;
    let alloc = false;
    if (n.type === 'ArrayExpression' || n.type === 'ObjectExpression') alloc = true;
    if (n.type === 'NewExpression') alloc = true;
    if (n.type === 'CallExpression' && n.callee?.type === 'MemberExpression' &&
        n.callee.property?.name === 'push' && d >= 1) pushInLoop = true;
    if (line !== undefined) {
      const prev = byLine.get(line) ?? { depth: 0, alloc: false, inRec: false };
      byLine.set(line, { depth: Math.max(prev.depth, d), alloc: prev.alloc || alloc, inRec: prev.inRec || inRec });
    }
    for (const k of Object.keys(n)) {
      const c = (n as any)[k];
      if (Array.isArray(c)) c.forEach((x) => x && x.type && walk(x, d, inRec || base.recursive));
      else if (c && c.type) walk(c, d, inRec || base.recursive);
    }
  })(ast, 0, false);

  const annotations: LineAnnotation[] = [];
  for (const [line, info] of [...byLine.entries()].sort((a, b) => a[0] - b[0])) {
    const tf = TIME_BY_DEPTH[Math.min(info.depth, 3)];
    annotations.push({
      line,
      executed: info.depth === 0 ? '~1 time' : info.depth === 1 ? '~n times' : `~n^${info.depth} times`,
      timeFactor: base.recursive ? 'unknown' : tf,
      spaceImpact: info.alloc ? (info.depth >= 1 ? 'O(n)' : 'O(1)') : 'none',
      note: info.depth >= 2 ? 'inside nested loop' : info.depth === 1 ? 'inside loop' : '',
      inLoop: info.depth >= 1,
      inRecursion: info.inRec,
    });
  }
  const guessSpace: BigO = pushInLoop ? 'O(n)' : 'O(1)';
  return { annotations, guessSpace };
}
```

- [ ] **Step 4: Run tests**

Run: `npm run test:unit -- annotate`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add lib/complexity/static/annotate.ts lib/complexity/__tests__/annotate.test.ts
git commit -m "feat(complexity): per-line annotations + space guess"
```

---

### Task 5: JS instrumentation (source transform)

**Files:**
- Create: `lib/complexity/dynamic/instrument-js.ts`
- Test: `lib/complexity/__tests__/instrument-js.test.ts`

**Interfaces:**
- Consumes: `acorn`, `Telemetry`, `SimStep`.
- Produces: `instrumentJs(code: string): string` plus exported consts `MAX_STEPS`, `OP_CEILING`, `MAX_VARS`. The instrumented source, when run, defines `__cx` and on process end prints one line `__CX__<json>` matching `Telemetry` (minus `ok`); each emitted step carries `callStack` and `variables` (TDZ/undefined-safe).

- [ ] **Step 1: Write failing test**

Create `lib/complexity/__tests__/instrument-js.test.ts`:
```ts
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
```

- [ ] **Step 2: Run to verify failure**

Run: `npm run test:unit -- instrument-js`
Expected: FAIL (`instrumentJs` not found).

- [ ] **Step 3: Implement**

Create `lib/complexity/dynamic/instrument-js.ts`:
```ts
import * as acorn from 'acorn';

export const MAX_STEPS = 5000;
export const OP_CEILING = 5_000_000;
export const MAX_VARS = 12;

type Node = acorn.Node & Record<string, any>;

// Collect candidate variable names declared directly in a function scope
// (params + var/let/const/inner-function ids), NOT descending into nested
// functions. Used to build a per-statement variable snapshot thunk.
function scopeVars(fnBody: Node, params: Node[]): string[] {
  const names = new Set<string>();
  for (const p of params) if (p?.type === 'Identifier') names.add(p.name);
  (function walk(n: Node, top: boolean) {
    if (!n || typeof n.type !== 'string') return;
    if (!top && (n.type === 'FunctionDeclaration' || n.type === 'FunctionExpression' || n.type === 'ArrowFunctionExpression')) {
      if (n.type === 'FunctionDeclaration' && n.id) names.add(n.id.name);
      return; // do not descend into nested function scopes
    }
    if (n.type === 'VariableDeclarator' && n.id?.type === 'Identifier') names.add(n.id.name);
    for (const k of Object.keys(n)) {
      const c = (n as any)[k];
      if (Array.isArray(c)) c.forEach((x) => x && x.type && walk(x, false));
      else if (c && c.type) walk(c, false);
    }
  })(fnBody, true);
  return [...names].slice(0, MAX_VARS);
}

// Build a TDZ/undefined-safe snapshot thunk: each var is read through __cx.g
// so a ReferenceError (not yet declared) yields undefined instead of throwing.
function varThunk(names: string[]): string {
  if (!names.length) return 'null';
  const fields = names.map((n) => `${JSON.stringify(n)}:__cx.g(function(){return ${n};})`).join(',');
  return `function(){return {${fields}};}`;
}

export function instrumentJs(code: string): string {
  const ast = acorn.parse(code, { ecmaVersion: 2022, locations: true, ranges: true }) as unknown as Node;

  type Ins = { pos: number; text: string };
  const inserts: Ins[] = [];

  // Map each statement to its nearest enclosing function's candidate vars.
  (function walk(n: Node, scope: string[]) {
    if (!n || typeof n.type !== 'string') return;
    let childScope = scope;

    const isFn = n.type === 'FunctionDeclaration' || n.type === 'FunctionExpression' || n.type === 'ArrowFunctionExpression';
    if (isFn && n.body?.type === 'BlockStatement' && n.body.range) {
      const name = n.id?.name || (n.type === 'ArrowFunctionExpression' ? 'arrow' : 'anonymous');
      childScope = scopeVars(n.body, n.params || []);
      const bStart = n.body.range[0]; // position of '{'
      const bEnd = n.body.range[1];   // position just after '}'
      inserts.push({ pos: bStart + 1, text: `__cx.enter(${JSON.stringify(name)});try{` });
      inserts.push({ pos: bEnd - 1, text: `}finally{__cx.exit();}` });
    }

    if (n.type.endsWith('Statement') && n.type !== 'BlockStatement' && n.range && n.loc) {
      inserts.push({ pos: n.range[0], text: `__cx.t(${n.loc.start.line},${varThunk(scope)});` });
    }

    for (const k of Object.keys(n)) {
      const c = (n as any)[k];
      if (Array.isArray(c)) c.forEach((x) => x && x.type && walk(x, childScope));
      else if (c && c.type) walk(c, childScope);
    }
  })(ast, []);

  // Splice from the end so earlier offsets stay valid. For equal positions,
  // apply later-pushed inserts first (stable by original order reversed).
  inserts.sort((a, b) => b.pos - a.pos);
  let out = code;
  for (const ins of inserts) out = out.slice(0, ins.pos) + ins.text + out.slice(ins.pos);

  const runtime = `
var __cx = (function(){
  var ops=0, hits={}, steps=[], truncated=false, stack=[], MAX=${MAX_STEPS}, CAP=${OP_CEILING}, MAXV=${MAX_VARS};
  function snap(thunk){
    var o={}; if(!thunk) return o;
    var raw; try{ raw=thunk(); }catch(e){ return o; }
    if(!raw) return o;
    var keys=Object.keys(raw); for(var i=0;i<keys.length && i<MAXV;i++){
      var v=raw[keys[i]]; if(v===undefined) continue;
      try{ o[keys[i]]=(typeof v==='object'? JSON.stringify(v): String(v)).slice(0,80); }catch(e){ o[keys[i]]='?'; }
    }
    return o;
  }
  return {
    g: function(f){ try{ return f(); }catch(e){ return undefined; } },
    enter: function(name){ stack.push(name); },
    exit: function(){ stack.pop(); },
    t: function(line, thunk){
      ops++; hits[line]=(hits[line]||0)+1;
      if(steps.length<MAX){ steps.push({idx:steps.length,lineNumber:line,recursionDepth:Math.max(0,stack.length-1),callStack:stack.slice(),variables:snap(thunk)}); }
      else { truncated=true; }
      if(ops>CAP){ throw new Error('__CX_OP_CEILING__'); }
    },
    flush: function(){ console.log('__CX__'+JSON.stringify({ops:ops,hits:hits,steps:steps,truncated:truncated})); }
  };
})();
globalThis.__cx = __cx;
function __cx_flush(){ __cx.flush(); }
`;
  return runtime + '\n' + out + '\nif (typeof __cx_flush==="function") __cx_flush();';
}
```

- [ ] **Step 4: Run tests**

Run: `npm run test:unit -- instrument-js`
Expected: PASS (5 tests).

- [ ] **Step 5: Commit**

```bash
git add lib/complexity/dynamic/instrument-js.ts lib/complexity/__tests__/instrument-js.test.ts
git commit -m "feat(complexity): JS source instrumentation (op/line/step counters)"
```

---

### Task 6: Sandboxed runner + input-size derivation

**Files:**
- Create: `lib/complexity/dynamic/run.ts`
- Create: `lib/complexity/dynamic/size.ts`
- Test: `lib/complexity/__tests__/run.test.ts`
- Test: `lib/complexity/__tests__/size.test.ts`

**Interfaces:**
- Consumes: `instrumentJs` (Task 5), `Telemetry` (Task 2), the `local-provider` execution pattern.
- Produces:
  - `runInstrumented(code: string, stdin: string, timeoutMs?: number): Telemetry`
  - `deriveSize(stdin: string): number`

- [ ] **Step 1: Write failing tests**

Create `lib/complexity/__tests__/size.test.ts`:
```ts
import { expect, test } from 'vitest';
import { deriveSize } from '@/lib/complexity/dynamic/size';

test('counts integers in stdin', () => {
  expect(deriveSize('5\n1 2 3 4 5')).toBe(6); // all numeric tokens
});
test('falls back to byte length when no numbers', () => {
  expect(deriveSize('abcd')).toBe(4);
});
```

Create `lib/complexity/__tests__/run.test.ts`:
```ts
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
```

- [ ] **Step 2: Run to verify failure**

Run: `npm run test:unit -- run size`
Expected: FAIL (modules not found).

- [ ] **Step 3: Implement size derivation**

Create `lib/complexity/dynamic/size.ts`:
```ts
// A coarse scalar "n" for an input: number of numeric tokens if present,
// else token count, else byte length. Good enough to order test cases by size.
export function deriveSize(stdin: string): number {
  const nums = stdin.match(/-?\d+/g);
  if (nums && nums.length > 0) return nums.length;
  const tokens = stdin.trim().split(/\s+/).filter(Boolean);
  if (tokens.length > 1) return tokens.length;
  return stdin.length;
}
```

- [ ] **Step 4: Implement runner**

Create `lib/complexity/dynamic/run.ts`:
```ts
import { spawnSync } from 'child_process';
import { mkdtempSync, rmSync, writeFileSync } from 'fs';
import { tmpdir } from 'os';
import { join } from 'path';
import { instrumentJs } from '@/lib/complexity/dynamic/instrument-js';
import type { Telemetry } from '@/lib/complexity/types';

const DEFAULT_TIMEOUT_MS = 2000;

function emptyTelemetry(): Telemetry {
  return { ops: 0, hits: {}, steps: [], truncated: false, ok: false };
}

export function runInstrumented(code: string, stdin: string, timeoutMs = DEFAULT_TIMEOUT_MS): Telemetry {
  let instrumented: string;
  try { instrumented = instrumentJs(code); }
  catch { return emptyTelemetry(); }

  const dir = mkdtempSync(join(tmpdir(), 'cx-js-'));
  try {
    const file = join(dir, 'main.js');
    writeFileSync(file, instrumented, 'utf8');
    const res = spawnSync('node', [file], {
      input: stdin, cwd: dir, timeout: Math.max(500, timeoutMs),
      maxBuffer: 32 * 1024 * 1024, encoding: 'utf8',
    });
    const timedOut = Boolean(res.error && (res.error as NodeJS.ErrnoException).code === 'ETIMEDOUT');
    const line = (res.stdout || '').split('\n').reverse().find((l) => l.startsWith('__CX__'));
    if (!line) return { ...emptyTelemetry(), ok: false };
    const parsed = JSON.parse(line.slice(6)) as Omit<Telemetry, 'ok'>;
    const opCeiling = (res.stderr || '').includes('__CX_OP_CEILING__');
    return { ...parsed, ok: !timedOut && !opCeiling && res.status === 0 ? true : !timedOut && !!parsed.ops };
  } catch {
    return emptyTelemetry();
  } finally {
    try { rmSync(dir, { recursive: true, force: true }); } catch { /* best effort */ }
  }
}
```

- [ ] **Step 5: Run tests**

Run: `npm run test:unit -- run size`
Expected: PASS (the timeout test takes ~1s).

- [ ] **Step 6: Commit**

```bash
git add lib/complexity/dynamic/run.ts lib/complexity/dynamic/size.ts lib/complexity/__tests__/run.test.ts lib/complexity/__tests__/size.test.ts
git commit -m "feat(complexity): sandboxed node runner + input-size derivation"
```

---

### Task 7: Curve-fit + reconcile

**Files:**
- Create: `lib/complexity/fit.ts`
- Create: `lib/complexity/reconcile.ts`
- Test: `lib/complexity/__tests__/fit.test.ts`

**Interfaces:**
- Consumes: `EmpiricalFit`, `StaticResult`, `ComplexitySummary`, `BigO`.
- Produces:
  - `fitCurve(points: { n: number; ops: number }[]): EmpiricalFit`
  - `reconcile(args: { code: string; staticTime: BigO; staticSpace: BigO; lowConfidence: boolean; timeFit: EmpiricalFit; spaceFit: EmpiricalFit; annotations; suggestion?; recursive: boolean }): ComplexitySummary`

- [ ] **Step 1: Write failing tests**

Create `lib/complexity/__tests__/fit.test.ts`:
```ts
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
```

- [ ] **Step 2: Run to verify failure**

Run: `npm run test:unit -- fit`
Expected: FAIL.

- [ ] **Step 3: Implement fit**

Create `lib/complexity/fit.ts`:
```ts
import type { BigO, EmpiricalFit } from '@/lib/complexity/types';

const MODELS: { bigO: BigO; f: (n: number) => number }[] = [
  { bigO: 'O(1)', f: () => 1 },
  { bigO: 'O(log n)', f: (n) => Math.log2(Math.max(2, n)) },
  { bigO: 'O(n)', f: (n) => n },
  { bigO: 'O(n log n)', f: (n) => n * Math.log2(Math.max(2, n)) },
  { bigO: 'O(n^2)', f: (n) => n * n },
  { bigO: 'O(n^3)', f: (n) => n * n * n },
  { bigO: 'O(2^n)', f: (n) => Math.pow(2, Math.min(n, 30)) },
];

// R² of ops ≈ c·model(n) via least squares through origin on (model, ops).
function rSquared(xs: number[], ys: number[]): number {
  const sxx = xs.reduce((a, x) => a + x * x, 0);
  const sxy = xs.reduce((a, x, i) => a + x * ys[i], 0);
  if (sxx === 0) return 0;
  const c = sxy / sxx;
  const meanY = ys.reduce((a, y) => a + y, 0) / ys.length;
  const ssTot = ys.reduce((a, y) => a + (y - meanY) ** 2, 0);
  const ssRes = ys.reduce((a, y, i) => a + (y - c * xs[i]) ** 2, 0);
  return ssTot === 0 ? 1 : Math.max(0, 1 - ssRes / ssTot);
}

// Ratio variance: ops/model should be flat for the true model. Lower = better.
function ratioVar(xs: number[], ys: number[]): number {
  const ratios = ys.map((y, i) => (xs[i] === 0 ? 0 : y / xs[i]));
  const mean = ratios.reduce((a, r) => a + r, 0) / ratios.length;
  if (mean === 0) return Infinity;
  const v = ratios.reduce((a, r) => a + (r - mean) ** 2, 0) / ratios.length;
  return v / (mean * mean); // coefficient of variation²
}

export function fitCurve(points: { n: number; ops: number }[]): EmpiricalFit {
  const pts = points.filter((p) => Number.isFinite(p.n) && Number.isFinite(p.ops)).sort((a, b) => a.n - b.n);
  if (pts.length < 3) return { bigO: 'unknown', confidence: 0, points: pts };
  const ys = pts.map((p) => p.ops);
  let best = { bigO: 'unknown' as BigO, score: -Infinity, conf: 0 };
  for (const m of MODELS) {
    const xs = pts.map((p) => m.f(p.n));
    const r2 = rSquared(xs, ys);
    const cv = ratioVar(xs, ys);
    const score = r2 - 0.5 * Math.min(1, cv); // penalise non-flat ratios (n vs n log n tie-break)
    if (score > best.score) best = { bigO: m.bigO, score, conf: r2 };
  }
  return { bigO: best.bigO, confidence: Number(best.conf.toFixed(3)), points: pts };
}
```

- [ ] **Step 4: Implement reconcile**

Create `lib/complexity/reconcile.ts`:
```ts
import type { BigO, ComplexitySummary, EmpiricalFit, LineAnnotation } from '@/lib/complexity/types';

export function reconcile(args: {
  staticTime: BigO; staticSpace: BigO; lowConfidence: boolean;
  timeFit: EmpiricalFit; spaceFit: EmpiricalFit;
  annotations: LineAnnotation[]; suggestion?: string; recursive: boolean;
}): ComplexitySummary {
  const measuredTime = args.timeFit.bigO !== 'unknown' ? args.timeFit.bigO : args.staticTime;
  const measuredSpace = args.spaceFit.bigO !== 'unknown' ? args.spaceFit.bigO : args.staticSpace;

  let explanation: string;
  if (args.staticTime !== 'unknown' && args.staticTime !== measuredTime && args.timeFit.bigO !== 'unknown') {
    explanation = `Code structure looks ${args.staticTime}, but measured growth is ${measuredTime} — likely an early exit, a built-in sort, or data-dependent behavior.`;
  } else if (args.recursive) {
    explanation = `Recursive solution; measured growth across input sizes is ${measuredTime}.`;
  } else {
    explanation = `Operation count grows as ${measuredTime}; memory as ${measuredSpace}.`;
  }

  // Hotspots: top lines by hit share come from the caller (passed via annotations note),
  // here we approximate share from loop depth ranking.
  const ranked = [...args.annotations].sort((a, b) => Number(b.inLoop) - Number(a.inLoop)).slice(0, 5);
  const hotspots = ranked.map((a, i) => ({ line: a.line, share: Number((1 / (i + 1)).toFixed(2)) }));

  return {
    bigOTime: measuredTime,
    bigOSpace: measuredSpace,
    confidence: args.timeFit.confidence,
    staticGuess: { time: args.staticTime, space: args.staticSpace },
    explanation,
    hotspots,
    perLine: args.annotations,
    suggestion: args.suggestion,
  };
}
```

- [ ] **Step 5: Run tests**

Run: `npm run test:unit -- fit`
Expected: PASS (4 tests).

- [ ] **Step 6: Commit**

```bash
git add lib/complexity/fit.ts lib/complexity/reconcile.ts lib/complexity/__tests__/fit.test.ts
git commit -m "feat(complexity): curve-fit (ratio-test tie-break) + reconcile"
```

---

### Task 8: Prisma models + store

**Files:**
- Modify: `prisma/schema.prisma`
- Create: `lib/complexity/store.ts`

**Interfaces:**
- Consumes: `ComplexitySummary`, `SimStep`.
- Produces:
  - `codeHashOf(lang: string, problemId: string, code: string): string`
  - `getAnalysis(codeHash): Promise<{ id; status; summary; } | null>`
  - `saveAnalysis(input): Promise<{ id: string }>`
  - `getSteps(analysisId, cursor, limit): Promise<{ steps; nextCursor }>`

- [ ] **Step 1: Add Prisma models**

In `prisma/schema.prisma` append (note the `V2` suffix — keeps the new build fully separate from the existing engine's `DsaSubmission.complexityJson`):
```prisma
model ComplexityAnalysisV2 {
  id         String   @id @default(cuid())
  codeHash   String   @unique
  problemId  String
  lang       String
  status     String   // done | failed | unsupported_language | truncated
  bigOTime   String?
  bigOSpace  String?
  confidence Float?
  summary    String?  // JSON-serialized ComplexitySummary
  createdAt  DateTime @default(now())
  steps      SimulationStepV2[]
  @@index([problemId])
}

model SimulationStepV2 {
  id          String @id @default(cuid())
  analysisId  String
  idx         Int
  lineNumber  Int
  recursDepth Int     @default(0)
  callStack   String  @default("[]")  // JSON string[]
  variables   String  @default("{}")  // JSON Record<string,string>
  note        String?
  analysis    ComplexityAnalysisV2 @relation(fields: [analysisId], references: [id], onDelete: Cascade)
  @@unique([analysisId, idx])
}
```

- [ ] **Step 2: Push schema**

Run: `npm run db:push`
Expected: "Your database is now in sync with your Prisma schema." Prisma client regenerated.

- [ ] **Step 3: Implement store**

Create `lib/complexity/store.ts`:
```ts
import { createHash } from 'crypto';
import { db } from '@/lib/db';
import type { ComplexitySummary, SimStep } from '@/lib/complexity/types';

export function codeHashOf(lang: string, problemId: string, code: string): string {
  return createHash('sha256').update(`${lang}\n${problemId}\n${code}`).digest('hex');
}

export async function getAnalysis(codeHash: string) {
  const row = await db.complexityAnalysisV2.findUnique({ where: { codeHash } });
  if (!row) return null;
  return { id: row.id, status: row.status, summary: row.summary ? (JSON.parse(row.summary) as ComplexitySummary) : null };
}

export async function saveAnalysis(input: {
  codeHash: string; problemId: string; lang: string; status: string;
  summary: ComplexitySummary | null; steps: SimStep[];
}): Promise<{ id: string }> {
  const row = await db.complexityAnalysisV2.upsert({
    where: { codeHash: input.codeHash },
    create: {
      codeHash: input.codeHash, problemId: input.problemId, lang: input.lang, status: input.status,
      bigOTime: input.summary?.bigOTime, bigOSpace: input.summary?.bigOSpace, confidence: input.summary?.confidence,
      summary: input.summary ? JSON.stringify(input.summary) : null,
    },
    update: {
      status: input.status, bigOTime: input.summary?.bigOTime, bigOSpace: input.summary?.bigOSpace,
      confidence: input.summary?.confidence, summary: input.summary ? JSON.stringify(input.summary) : null,
    },
  });
  if (input.steps.length) {
    await db.simulationStepV2.deleteMany({ where: { analysisId: row.id } });
    await db.simulationStepV2.createMany({
      data: input.steps.slice(0, 5000).map((s) => ({
        analysisId: row.id, idx: s.idx, lineNumber: s.lineNumber, recursDepth: s.recursionDepth,
        callStack: JSON.stringify(s.callStack ?? []), variables: JSON.stringify(s.variables ?? {}), note: s.note,
      })),
    });
  }
  return { id: row.id };
}

export async function getSteps(analysisId: string, cursor: number, limit: number) {
  const rows = await db.simulationStepV2.findMany({
    where: { analysisId, idx: { gte: cursor } }, orderBy: { idx: 'asc' }, take: limit,
  });
  const steps: SimStep[] = rows.map((r) => ({
    idx: r.idx, lineNumber: r.lineNumber, recursionDepth: r.recursDepth,
    callStack: JSON.parse(r.callStack) as string[], variables: JSON.parse(r.variables) as Record<string, string>,
    note: r.note ?? undefined,
  }));
  const nextCursor = rows.length === limit ? cursor + limit : null;
  return { steps, nextCursor };
}
```

- [ ] **Step 4: Typecheck**

Run: `npm run typecheck`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add prisma/schema.prisma lib/complexity/store.ts
git commit -m "feat(complexity): v2 persistence models + code-hash store"
```

---

### Task 9: Orchestrator

**Files:**
- Create: `lib/complexity/analyze.ts`
- Test: `lib/complexity/__tests__/analyze.test.ts`

**Interfaces:**
- Consumes: all of static, dynamic, fit, reconcile. **No Prisma import.**
- Produces: `analyzeComplexity(input: { code: string; lang: string; cases: { stdin: string }[] }): { summary: ComplexitySummary; steps: SimStep[]; status: 'done' | 'failed' }`

- [ ] **Step 1: Write failing test**

Create `lib/complexity/__tests__/analyze.test.ts`:
```ts
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
```

- [ ] **Step 2: Run to verify failure**

Run: `npm run test:unit -- analyze`
Expected: FAIL.

- [ ] **Step 3: Implement**

Create `lib/complexity/analyze.ts`:
```ts
import { analyzeStaticJs } from '@/lib/complexity/static/parse-js';
import { annotateLines } from '@/lib/complexity/static/annotate';
import { runInstrumented } from '@/lib/complexity/dynamic/run';
import { deriveSize } from '@/lib/complexity/dynamic/size';
import { fitCurve } from '@/lib/complexity/fit';
import { reconcile } from '@/lib/complexity/reconcile';
import type { ComplexitySummary, SimStep } from '@/lib/complexity/types';

const MAX_CASES = 24;

export function analyzeComplexity(input: { code: string; lang: string; cases: { stdin: string }[] }):
  { summary: ComplexitySummary; steps: SimStep[]; status: 'done' | 'failed' } {

  const stat = analyzeStaticJs(input.code);
  const { annotations, guessSpace } = annotateLines(input.code, stat);

  // Sample up to MAX_CASES, spread across the size range.
  const sized = input.cases.map((c) => ({ n: deriveSize(c.stdin), stdin: c.stdin })).sort((a, b) => a.n - b.n);
  const step = Math.max(1, Math.floor(sized.length / MAX_CASES));
  const sample = sized.filter((_, i) => i % step === 0).slice(0, MAX_CASES);

  const timePts: { n: number; ops: number }[] = [];
  const spacePts: { n: number; ops: number }[] = [];
  let smallestSteps: SimStep[] = [];
  let smallestN = Infinity;

  for (const c of sample) {
    const t = runInstrumented(input.code, c.stdin);
    if (!t.ok || t.ops === 0) continue;
    timePts.push({ n: c.n, ops: t.ops });
    spacePts.push({ n: c.n, ops: Object.keys(t.hits).length }); // proxy: distinct active lines ~ allocation breadth
    if (c.n < smallestN) { smallestN = c.n; smallestSteps = t.steps; }
  }

  if (timePts.length < 3) {
    // Fall back to static-only.
    const summary: ComplexitySummary = {
      bigOTime: stat.guessTime, bigOSpace: guessSpace, confidence: 0.2,
      staticGuess: { time: stat.guessTime, space: guessSpace },
      explanation: 'Not enough runnable samples to measure; showing structural estimate only.',
      hotspots: [], perLine: annotations, suggestion: stat.suggestion,
    };
    return { summary, steps: smallestSteps, status: 'failed' };
  }

  const timeFit = fitCurve(timePts);
  const spaceFit = fitCurve(spacePts);
  const summary = reconcile({
    staticTime: stat.guessTime, staticSpace: guessSpace, lowConfidence: stat.lowConfidence,
    timeFit, spaceFit, annotations, suggestion: stat.suggestion, recursive: stat.recursive,
  });
  // Prefer measured space label only when it grows; otherwise keep static space heuristic.
  if (spaceFit.bigO === 'O(1)' || spaceFit.bigO === 'unknown') summary.bigOSpace = guessSpace;
  return { summary, steps: smallestSteps, status: 'done' };
}
```

- [ ] **Step 4: Run test**

Run: `npm run test:unit -- analyze`
Expected: PASS (runs node a handful of times; a few seconds).

- [ ] **Step 5: Commit**

```bash
git add lib/complexity/analyze.ts lib/complexity/__tests__/analyze.test.ts
git commit -m "feat(complexity): orchestrator (static+dynamic+fit+reconcile)"
```

---

### Task 10: API routes (slug-based, `complexity-v2`)

**Files:**
- Create: `app/api/dsa/complexity-v2/[slug]/route.ts`
- Create: `app/api/dsa/complexity-v2/[slug]/[id]/route.ts`
- Create: `app/api/dsa/complexity-v2/[slug]/[id]/simulation/route.ts`
- Test: `tests/api/complexity-v2.spec.ts` (Playwright API test)

**Interfaces:**
- Consumes: `analyzeComplexity` (Task 9), `store` functions (Task 8). Resolves `slug → DsaProblem.id`, loads `DsaTestCase` by `problemId` (`input` field confirmed).
- Produces:
  - `POST /api/dsa/complexity-v2/[slug]` body `{ language, source }` → `{ analysisId, status, summary }` or `{ status: 'unsupported_language' }`.
  - `GET /api/dsa/complexity-v2/[slug]/[id]` → `{ status, summary }`.
  - `GET /api/dsa/complexity-v2/[slug]/[id]/simulation?cursor=&limit=` → `{ steps, nextCursor, truncated }`.

- [ ] **Step 1: Implement POST analyze**

Create `app/api/dsa/complexity-v2/[slug]/route.ts`:
```ts
import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { db } from '@/lib/db';
import { checkRateLimit } from '@/lib/auth/rate-limit';
import { analyzeComplexity } from '@/lib/complexity/analyze';
import { codeHashOf, getAnalysis, saveAnalysis } from '@/lib/complexity/store';

const schema = z.object({ language: z.string().min(1), source: z.string().min(1).max(200_000) });

export async function POST(req: NextRequest, { params }: { params: { slug: string } }) {
  const ip = req.headers.get('x-forwarded-for') || 'local';
  if (!checkRateLimit(`complexity-v2:${ip}`, 10, 60_000)) {
    return NextResponse.json({ error: 'Too many requests. Try again shortly.' }, { status: 429 });
  }

  let body: z.infer<typeof schema>;
  try { body = schema.parse(await req.json()); }
  catch { return NextResponse.json({ error: 'Invalid request' }, { status: 400 }); }

  const lang = body.language.toLowerCase();
  if (lang !== 'javascript' && lang !== 'js' && lang !== 'node') {
    return NextResponse.json({ status: 'unsupported_language', message: 'The v2 analyzer supports JavaScript only.' });
  }

  const problem = await db.dsaProblem.findUnique({ where: { slug: params.slug }, select: { id: true } });
  if (!problem) return NextResponse.json({ error: 'Problem not found' }, { status: 404 });

  const codeHash = codeHashOf('javascript', problem.id, body.source);
  const cached = await getAnalysis(codeHash);
  if (cached?.status === 'done') return NextResponse.json({ analysisId: cached.id, status: 'done', summary: cached.summary });

  const cases = await db.dsaTestCase.findMany({ where: { problemId: problem.id }, select: { input: true } });
  const mapped = cases.map((c) => ({ stdin: c.input ?? '' })).filter((c) => c.stdin.length > 0);

  const result = analyzeComplexity({ code: body.source, lang: 'javascript', cases: mapped });
  const saved = await saveAnalysis({
    codeHash, problemId: problem.id, lang: 'javascript', status: result.status,
    summary: result.summary, steps: result.steps,
  });
  return NextResponse.json({ analysisId: saved.id, status: result.status, summary: result.summary });
}
```
> Note: `analyzeComplexity` is synchronous (spawnSync), so POST returns the full result directly. The HLD's queue/two-phase split is a later phase. The existing engine at `[slug]/complexity` is NOT touched.

- [ ] **Step 2: Implement GET result**

Create `app/api/dsa/complexity-v2/[slug]/[id]/route.ts`:
```ts
import { NextResponse } from 'next/server';
import { db } from '@/lib/db';

export async function GET(_req: Request, { params }: { params: { slug: string; id: string } }) {
  const row = await db.complexityAnalysisV2.findUnique({ where: { id: params.id } });
  if (!row) return NextResponse.json({ error: 'not found' }, { status: 404 });
  return NextResponse.json({ status: row.status, summary: row.summary ? JSON.parse(row.summary) : null });
}
```

- [ ] **Step 3: Implement GET simulation**

Create `app/api/dsa/complexity-v2/[slug]/[id]/simulation/route.ts`:
```ts
import { NextResponse } from 'next/server';
import { getSteps } from '@/lib/complexity/store';

export async function GET(req: Request, { params }: { params: { slug: string; id: string } }) {
  const url = new URL(req.url);
  const cursor = Number(url.searchParams.get('cursor') ?? '0') || 0;
  const limit = Math.min(500, Number(url.searchParams.get('limit') ?? '200') || 200);
  const { steps, nextCursor } = await getSteps(params.id, cursor, limit);
  return NextResponse.json({ steps, nextCursor, truncated: steps.length >= 5000 });
}
```

- [ ] **Step 4: Write Playwright API test**

Create `tests/api/complexity-v2.spec.ts`:
```ts
import { test, expect } from '@playwright/test';

// Uses the seeded problem listing to find a slug, then posts a nested-loop JS solution.
test('POST /api/dsa/complexity-v2/[slug] returns a Big-O', async ({ request }) => {
  const res0 = await request.get('/api/dsa/problems');
  const list = await res0.json();
  const slug = list?.[0]?.slug ?? list?.problems?.[0]?.slug;
  test.skip(!slug, 'no seeded problem slug available');

  const res = await request.post(`/api/dsa/complexity-v2/${slug}`, {
    data: { language: 'javascript', source: 'function f(a){let c=0;for(let i=0;i<a.length;i++){for(let j=0;j<a.length;j++){c++;}}return c;}' },
  });
  expect(res.ok()).toBeTruthy();
  const body = await res.json();
  expect(['done', 'failed', 'unsupported_language']).toContain(body.status);
  if (body.status === 'done') expect(body.summary.bigOTime).toMatch(/O\(/);
});
```
> Note: confirm `/api/dsa/problems` returns objects with a `slug` field; adjust the extraction if the shape differs.

- [ ] **Step 5: Run API test**

Run: `npm run test:api -- complexity-v2`
Expected: PASS or SKIP.

- [ ] **Step 6: Commit**

```bash
git add app/api/dsa/complexity-v2 tests/api/complexity-v2.spec.ts
git commit -m "feat(complexity): v2 analyze + result + simulation API routes"
```

---

### Task 11: Editor UI — v2 results panel

**Files:**
- Create: `components/dsa/ComplexityV2Panel.tsx`
- Create: `components/dsa/complexity-v2.css` (or append to an existing global stylesheet the workspace imports)

**Interfaces:**
- Consumes: `POST /api/dsa/complexity-v2/[slug]`, `ComplexitySummary` shape.
- Produces: `<ComplexityV2Panel slug language code editorRef onAnalyzed />` — a panel showing Big-O time/space + confidence + explanation + hotspots + suggestion; highlights hotspot lines via `deltaDecorations`; calls `onAnalyzed(analysisId)` so a sibling simulator can load steps.

- [ ] **Step 1: Implement the panel**

Create `components/dsa/ComplexityV2Panel.tsx`:
```tsx
'use client';
import { useState } from 'react';

interface Summary {
  bigOTime: string; bigOSpace: string; confidence: number;
  explanation: string; suggestion?: string;
  hotspots: { line: number; share: number }[];
  staticGuess: { time: string; space: string };
}

export function ComplexityV2Panel(props: {
  slug: string; language: string; code: string;
  editorRef?: React.MutableRefObject<any>;
  onAnalyzed?: (analysisId: string) => void;
}) {
  const [loading, setLoading] = useState(false);
  const [summary, setSummary] = useState<Summary | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function analyze() {
    setLoading(true); setError(null); setSummary(null);
    try {
      const res = await fetch(`/api/dsa/complexity-v2/${props.slug}`, {
        method: 'POST', headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ language: props.language, source: props.code }),
      });
      const body = await res.json();
      if (body.status === 'unsupported_language') { setError('The v2 analyzer supports JavaScript only.'); return; }
      if (!body.summary) { setError('Could not analyze this solution.'); return; }
      setSummary(body.summary);
      highlight(body.summary.hotspots ?? []);
      if (body.analysisId) props.onAnalyzed?.(body.analysisId);
    } catch {
      setError('Analysis failed.');
    } finally { setLoading(false); }
  }

  function highlight(hotspots: { line: number }[]) {
    const ed = props.editorRef?.current;
    const monaco = (window as any).monaco;
    if (!ed?.deltaDecorations || !monaco) return;
    ed.deltaDecorations([], hotspots.map((h) => ({
      range: new monaco.Range(h.line, 1, h.line, 1),
      options: { isWholeLine: true, className: 'cx-hotspot', glyphMarginClassName: 'cx-hot-glyph' },
    })));
  }

  const isJs = props.language.toLowerCase().startsWith('java') === false; // 'java'/'javascript' both start 'java'
  const jsOnly = props.language.toLowerCase() === 'javascript';

  return (
    <div className="cx-panel">
      <div className="cx-head">
        <b>Analyzer v2 (experimental)</b>
        <button onClick={analyze} disabled={loading || !jsOnly}>
          {loading ? 'Analyzing…' : 'Analyze Complexity v2'}
        </button>
      </div>
      {!jsOnly && <p className="cx-muted">v2 supports JavaScript only (comparison build).</p>}
      {error && <p className="cx-err">{error}</p>}
      {summary && (
        <div className="cx-result">
          <div className="cx-bigo">
            <span>Time: <b>{summary.bigOTime}</b></span>
            <span>Space: <b>{summary.bigOSpace}</b></span>
            <span>Confidence: {(summary.confidence * 100).toFixed(0)}%</span>
          </div>
          <p>{summary.explanation}</p>
          {summary.staticGuess && (
            <p className="cx-muted">Static guess: {summary.staticGuess.time} time / {summary.staticGuess.space} space</p>
          )}
          {summary.suggestion && <p className="cx-suggest">💡 {summary.suggestion}</p>}
          {summary.hotspots?.length > 0 && (
            <p className="cx-hot">Hot lines: {summary.hotspots.map((h) => h.line).join(', ')}</p>
          )}
        </div>
      )}
    </div>
  );
}
```
> `isJs` is intentionally unused noise-free: rely on `jsOnly`. Remove `isJs` if your linter flags unused vars.

- [ ] **Step 2: Add styles**

Create `components/dsa/complexity-v2.css` and import it from `ComplexityV2Panel.tsx` (`import './complexity-v2.css';`):
```css
.cx-hotspot { background: rgba(255,170,0,.14); }
.cx-current { background: rgba(80,160,255,.20); }
.cx-hot-glyph::after { content: '🔥'; }
.cx-panel { border:1px solid var(--border,#283143); border-radius:10px; padding:10px; margin-top:10px; }
.cx-head { display:flex; align-items:center; justify-content:space-between; gap:8px; }
.cx-panel button { padding:6px 12px; border-radius:8px; }
.cx-bigo { display:flex; gap:16px; font-family:monospace; margin:6px 0; }
.cx-err { color:#e66; } .cx-suggest { color:#7bdcb5; } .cx-muted { opacity:.7; font-size:12px; }
.cx-sim { margin-top:8px; border-top:1px solid var(--border,#283143); padding-top:8px; }
.cx-sim-ctrls { display:flex; gap:6px; align-items:center; }
.cx-vars { font-family:monospace; font-size:12px; white-space:pre-wrap; }
.cx-stack { font-family:monospace; font-size:12px; opacity:.85; }
```

- [ ] **Step 3: Typecheck**

Run: `npm run typecheck`
Expected: PASS (component compiles; not yet mounted).

- [ ] **Step 4: Commit**

```bash
git add components/dsa/ComplexityV2Panel.tsx components/dsa/complexity-v2.css
git commit -m "feat(complexity): v2 results panel + hotspot decorations"
```

---

### Task 12: Interactive simulator (step debugger)

**Files:**
- Create: `components/dsa/ComplexitySimulator.tsx`

**Interfaces:**
- Consumes: `GET /api/dsa/complexity-v2/[slug]/[id]/simulation`, `SimStep` shape, Monaco editor ref.
- Produces: `<ComplexitySimulator slug analysisId editorRef />` — loads all steps (paginated), provides ⏮ ◀ ▶ ⏭ controls, highlights the current line in Monaco and reveals it, and shows the call stack + variable snapshot for the current step.

- [ ] **Step 1: Implement the simulator**

Create `components/dsa/ComplexitySimulator.tsx`:
```tsx
'use client';
import { useEffect, useRef, useState } from 'react';

interface Step {
  idx: number; lineNumber: number; recursionDepth: number;
  callStack: string[]; variables: Record<string, string>; note?: string;
}

const MAX_UI_STEPS = 2000;

export function ComplexitySimulator(props: {
  slug: string; analysisId: string; editorRef?: React.MutableRefObject<any>;
}) {
  const [steps, setSteps] = useState<Step[]>([]);
  const [i, setI] = useState(0);
  const [loading, setLoading] = useState(false);
  const decoRef = useRef<string[]>([]);

  useEffect(() => {
    let cancelled = false;
    async function load() {
      setLoading(true);
      const all: Step[] = [];
      let cursor: number | null = 0;
      while (cursor !== null && all.length < MAX_UI_STEPS) {
        const res: Response = await fetch(`/api/dsa/complexity-v2/${props.slug}/${props.analysisId}/simulation?cursor=${cursor}&limit=500`);
        const body = await res.json();
        all.push(...(body.steps ?? []));
        cursor = body.nextCursor ?? null;
      }
      if (!cancelled) { setSteps(all); setI(0); setLoading(false); }
    }
    load();
    return () => { cancelled = true; };
  }, [props.slug, props.analysisId]);

  useEffect(() => {
    const ed = props.editorRef?.current;
    const monaco = (window as any).monaco;
    if (!ed?.deltaDecorations || !monaco || !steps[i]) return;
    const line = steps[i].lineNumber;
    decoRef.current = ed.deltaDecorations(decoRef.current, [{
      range: new monaco.Range(line, 1, line, 1),
      options: { isWholeLine: true, className: 'cx-current' },
    }]);
    if (ed.revealLineInCenter) ed.revealLineInCenter(line);
    return () => { if (ed?.deltaDecorations) decoRef.current = ed.deltaDecorations(decoRef.current, []); };
  }, [i, steps, props.editorRef]);

  if (loading) return <div className="cx-sim">Loading simulation…</div>;
  if (!steps.length) return <div className="cx-sim cx-muted">No simulation steps (code may have errored or produced none).</div>;

  const s = steps[i];
  const clamp = (x: number) => Math.max(0, Math.min(steps.length - 1, x));

  return (
    <div className="cx-sim">
      <div className="cx-sim-ctrls">
        <button onClick={() => setI(0)} disabled={i === 0}>⏮</button>
        <button onClick={() => setI(clamp(i - 1))} disabled={i === 0}>◀</button>
        <span>Step {i + 1} / {steps.length} · line {s.lineNumber} · depth {s.recursionDepth}</span>
        <button onClick={() => setI(clamp(i + 1))} disabled={i === steps.length - 1}>▶</button>
        <button onClick={() => setI(steps.length - 1)} disabled={i === steps.length - 1}>⏭</button>
      </div>
      {s.callStack?.length > 0 && <div className="cx-stack">stack: {s.callStack.join(' › ')}</div>}
      {Object.keys(s.variables ?? {}).length > 0 && (
        <div className="cx-vars">{Object.entries(s.variables).map(([k, v]) => `${k} = ${v}`).join('\n')}</div>
      )}
      {s.note && <div className="cx-muted">{s.note}</div>}
    </div>
  );
}
```

- [ ] **Step 2: Typecheck**

Run: `npm run typecheck`
Expected: PASS.

- [ ] **Step 3: Commit**

```bash
git add components/dsa/ComplexitySimulator.tsx
git commit -m "feat(complexity): interactive step-debugger simulator (line/stack/vars)"
```

---

### Task 13: Mount v2 next to existing engine (comparison)

**Files:**
- Modify: `components/dsa/problem-workspace.tsx` (the Monaco host). Do NOT change `ComplexitySection` — only add the v2 panel + simulator beside it.

**Interfaces:**
- Consumes: `ComplexityV2Panel` (Task 11), `ComplexitySimulator` (Task 12).
- Produces: both engines visible together so a user can compare.

- [ ] **Step 1: Capture the Monaco editor ref**

In `problem-workspace.tsx`, find the `<Editor … onMount={…}>` (from `@monaco-editor/react`). Add a ref and capture the instance:
```tsx
// near other refs/state
const editorRef = useRef<any>(null);
// in the Editor's onMount (preserve any existing logic):
onMount={(editor, monaco) => { editorRef.current = editor; (window as any).monaco = monaco; /* existing onMount body */ }}
```
> If an `onMount` already exists, add these two assignments at its top rather than replacing it.

- [ ] **Step 2: Mount the v2 panel + simulator**

Locate the existing `<ComplexitySection slug={slug} submissionId={…} />` (around line 421). Immediately after it, add:
```tsx
<ComplexityV2Panel
  slug={slug}
  language={language}
  code={source}
  editorRef={editorRef}
  onAnalyzed={(id) => setV2AnalysisId(id)}
/>
{v2AnalysisId && (
  <ComplexitySimulator slug={slug} analysisId={v2AnalysisId} editorRef={editorRef} />
)}
```
Add the state near other `useState` calls:
```tsx
const [v2AnalysisId, setV2AnalysisId] = useState<string | null>(null);
```
And the imports at the top:
```tsx
import { ComplexityV2Panel } from '@/components/dsa/ComplexityV2Panel';
import { ComplexitySimulator } from '@/components/dsa/ComplexitySimulator';
```
> Confirm the in-scope variable names in this file: the language state (used by Run/Submit, likely `language`) and the current editor source (likely `source` or the editor value state). Use whatever this file already calls them; the names above are the expected ones from the run/submit wiring.

- [ ] **Step 3: Manual verify (comparison)**

Run: `npm run dev`, open a JS DSA problem, paste a nested-loop solution.
- Existing engine: submit, then click its **Analyze** → shows measured time/space (unchanged).
- New engine: click **Analyze Complexity v2** → shows Big-O + confidence + explanation + hotspots; hotspot lines highlight.
- Click **▶** in the simulator → current line highlights and reveals; call stack + variables update per step.
Expected: both panels visible side by side; the existing one behaves exactly as before.

- [ ] **Step 4: Typecheck + commit**

Run: `npm run typecheck`
Expected: PASS.
```bash
git add components/dsa/problem-workspace.tsx
git commit -m "feat(complexity): mount v2 panel + simulator beside existing engine for comparison"
```

---

### Task 14: Full verification pass

- [ ] **Step 1: Run all unit tests**

Run: `npm run test:unit`
Expected: all complexity tests pass.

- [ ] **Step 2: Typecheck**

Run: `npm run typecheck`
Expected: PASS.

- [ ] **Step 3: API smoke**

Run: `npm run test:api -- complexity-v2`
Expected: PASS or documented SKIP.

- [ ] **Step 4: Confirm existing engine untouched**

Run: `git diff --stat e89de93 -- lib/dsa/complexity app/api/dsa/problems/'[slug]'/complexity`
Expected: **no changes** to those paths (isolation held).

- [ ] **Step 5: Commit any fixes**

```bash
git add -A && git commit -m "test(complexity): v2 verification green"
```

---

## Out of scope (future plans)

- **Phase 2 — C++/Java for v2:** tree-sitter grammars, basic-block source instrumentation, compile via Judge0/local-provider, peak-memory from MLE metering.
- **Phase 3 — Scale + true two-phase:** dedicated analyzer queue + worker pool (per HLD lesson 15), SSE streaming, per-problem `genInputForSize` generators, Monaco view-zone floating bubbles (vs. the side-panel debugger built here).
- **Merge decision:** after comparing v2 against the existing empirical engine, decide whether to keep both, replace one, or fold v2's static annotations + simulator into the existing engine.

## Self-Review notes

- Spec coverage: static engine (T3/T4), dynamic profiler (T5/T6), curve-fit + reconcile (T7), persistence + cache (T8), orchestrator (T9), API contracts (T10), results UI (T11), interactive simulator with call stack + variable snapshots (T12), comparison mount (T13), verification (T14).
- Isolation enforced by construction: V2-suffixed models, `complexity-v2` API path, new components; existing engine paths in the Global Constraints off-limits list; T14 asserts no diff to them.
- Resolved live-schema facts: Prisma client is `{ db } from '@/lib/db'`; `DsaTestCase.input`/`problemId` confirmed; problems lookup by `slug` on `db.dsaProblem`. The only thing the implementer still confirms: the `/api/dsa/problems` list response shape (for the Playwright test) and the exact `language`/`source` state variable names in `problem-workspace.tsx`.
- Honest limitations carried from design: (1) empirical Big-O can mislabel n vs n log n on narrow size ranges — ratio-test penalty mitigates, `confidence` always shown; (2) variable capture is nearest-function-scope only and TDZ-safe-but-lossy (closures over outer scopes not captured); (3) arrow functions with expression bodies get no enter/exit frame (call stack omits them).
