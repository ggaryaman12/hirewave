import { expect, test } from '@playwright/test';
import { LocalJudgeProvider } from '../../lib/judge/local-provider';
import { wrapDesignSource, type DesignSpec } from '../../lib/judge/harness/design';

// Verifies the design (OOD) harness end-to-end against the local multi-language
// provider with a real "bank system" implementation in each language.
const spec: DesignSpec = {
  className: 'BankSystem',
  constructorParams: [],
  methods: [
    { name: 'open', params: [{ name: 'id', type: 'int' }], returnType: 'void' },
    { name: 'deposit', params: [{ name: 'id', type: 'int' }, { name: 'amount', type: 'long' }], returnType: 'bool' },
    { name: 'transfer', params: [{ name: 'from', type: 'int' }, { name: 'to', type: 'int' }, { name: 'amount', type: 'long' }], returnType: 'bool' },
    { name: 'balance', params: [{ name: 'id', type: 'int' }], returnType: 'long' },
  ],
};

const stdin = [
  '', // no constructor args
  '8',
  'open 1',
  'open 2',
  'deposit 1 100',
  'transfer 1 2 30',
  'balance 1',
  'balance 2',
  'transfer 2 1 1000',
  'balance 2',
  '',
].join('\n');

// deposit->true, transfer->true, balance1->70, balance2->30, transfer(insufficient)->false, balance2->30
const expected = ['true', 'true', '70', '30', 'false', '30'].join('\n');

const solutions: Record<string, string> = {
  javascript: `class BankSystem {
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
  cpp: `class BankSystem {
public:
    unordered_map<int,long long> acc;
    BankSystem() {}
    void open(int id) { if (!acc.count(id)) acc[id] = 0; }
    bool deposit(int id, long long amount) { if (!acc.count(id)) return false; acc[id] += amount; return true; }
    bool transfer(int from, int to, long long amount) {
        if (!acc.count(from) || !acc.count(to)) return false;
        if (acc[from] < amount) return false;
        acc[from] -= amount; acc[to] += amount; return true;
    }
    long long balance(int id) { return acc.count(id) ? acc[id] : -1; }
};`,
  java: `class BankSystem {
    java.util.HashMap<Integer,Long> acc = new java.util.HashMap<>();
    public BankSystem() {}
    public void open(int id) { acc.putIfAbsent(id, 0L); }
    public boolean deposit(int id, long amount) { if (!acc.containsKey(id)) return false; acc.put(id, acc.get(id) + amount); return true; }
    public boolean transfer(int from, int to, long amount) {
        if (!acc.containsKey(from) || !acc.containsKey(to)) return false;
        if (acc.get(from) < amount) return false;
        acc.put(from, acc.get(from) - amount); acc.put(to, acc.get(to) + amount); return true;
    }
    public long balance(int id) { return acc.containsKey(id) ? acc.get(id) : -1; }
}`,
};

test.describe('Design (OOD) harness — bank system', () => {
  for (const language of ['javascript', 'cpp', 'java'] as const) {
    test(`${language}: replays operations and prints returns`, async () => {
      const provider = new LocalJudgeProvider();
      const source = wrapDesignSource(language, spec, solutions[language]);
      const result = await provider.run({ language, source, stdin, timeLimitMs: 5000, memoryLimitMb: 256 });
      expect(result.status, result.stderr).toBe('ok');
      expect(result.stdout.trim()).toBe(expected);
    });
  }
});
