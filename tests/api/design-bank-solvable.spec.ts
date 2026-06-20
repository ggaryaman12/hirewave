import { readFileSync } from 'fs';
import { join } from 'path';
import { expect, test } from '@playwright/test';
import { LocalJudgeProvider } from '../../lib/judge/local-provider';
import { wrapDesignSource, parseDesignSpec } from '../../lib/judge/harness/design';
import { compareOutput } from '../../lib/judge/compare';
import type { ComparisonPolicy } from '../../lib/judge/types';

// Solvability gate for the design (OOD) bank: independent JS class solutions run
// through the design harness against each problem's FULL generated suite must
// reproduce every seeded expected output. Confirms generator/simulate agrees
// with the design driver across void/int/long/bool returns + constructor args.
const GEN_DIR = join(__dirname, '../../scripts/dsa/generated');

const SOLUTIONS: Record<string, string> = {
  'design-bank-system': `class BankSystem {
  constructor() { this.acc = new Map(); }
  open(id) { if (!this.acc.has(id)) this.acc.set(id, 0); }
  deposit(id, amount) { if (!this.acc.has(id)) return false; this.acc.set(id, this.acc.get(id) + amount); return true; }
  transfer(from, to, amount) {
    if (!this.acc.has(from) || !this.acc.has(to)) return false;
    if (this.acc.get(from) < amount) return false;
    this.acc.set(from, this.acc.get(from) - amount);
    this.acc.set(to, this.acc.get(to) + amount);
    return true;
  }
  balance(id) { return this.acc.has(id) ? this.acc.get(id) : -1; }
}`,
  'design-lru-cache': `class LRUCache {
  constructor(capacity) { this.cap = capacity; this.m = new Map(); }
  get(key) { if (!this.m.has(key)) return -1; const v = this.m.get(key); this.m.delete(key); this.m.set(key, v); return v; }
  put(key, value) { if (this.m.has(key)) this.m.delete(key); this.m.set(key, value); if (this.m.size > this.cap) this.m.delete(this.m.keys().next().value); }
}`,
  'design-rate-limiter': `class RateLimiter {
  constructor(limit, window) { this.limit = limit; this.window = window; this.log = []; }
  allow(t) { const cutoff = t - this.window; const recent = this.log.filter((x) => x > cutoff).length; if (recent < this.limit) { this.log.push(t); return true; } return false; }
}`,
};

type GenProblem = {
  designSpecJson: string;
  comparison: ComparisonPolicy;
  floatEpsilon: number | null;
  timeLimitMs: number;
  memoryLimitMb: number;
  testCases: { input: string; expected: string }[];
};

const provider = new LocalJudgeProvider();

for (const [slug, solution] of Object.entries(SOLUTIONS)) {
  test(`${slug} (javascript): all operation sequences accepted`, async () => {
    const problem = JSON.parse(readFileSync(join(GEN_DIR, `${slug}.json`), 'utf8')) as GenProblem;
    const spec = parseDesignSpec(problem.designSpecJson);
    expect(spec).not.toBeNull();
    const source = wrapDesignSource('javascript', spec!, solution);

    for (const tc of problem.testCases) {
      const run = await provider.run({
        language: 'javascript',
        source,
        stdin: tc.input,
        timeLimitMs: problem.timeLimitMs,
        memoryLimitMb: problem.memoryLimitMb,
      });
      expect(run.status, `${slug} stderr: ${run.stderr}`).toBe('ok');
      const ok = compareOutput(tc.expected, run.stdout, problem.comparison, problem.floatEpsilon ?? undefined);
      expect(ok, `${slug} input <<${tc.input}>> expected <<${tc.expected}>> got <<${run.stdout}>>`).toBe(true);
    }
  });
}
