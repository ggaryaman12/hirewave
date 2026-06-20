import { expect, test } from '@playwright/test';
import { LocalJudgeProvider } from '../../lib/judge/local-provider';
import { wrapSource } from '../../lib/judge/harness';
import type { Signature } from '../../lib/judge/harness';

// Verifies the function harness end-to-end against the multi-language LOCAL
// provider (real g++ / javac / node on the host). No Judge0 required. Proves the
// per-language driver parses typed stdin and serializes the return value.
test.describe('Function harness (local multi-language provider)', () => {
  const sig: Signature = {
    functionName: 'twoSum',
    params: [
      { name: 'nums', type: 'int[]' },
      { name: 'target', type: 'int' },
    ],
    returnType: 'int[]',
  };
  const stdin = '2 7 11 15\n9\n';
  const expected = '0 1';

  const solutions: Record<string, string> = {
    javascript: `function twoSum(nums, target) {
  const m = {};
  for (let i = 0; i < nums.length; i++) {
    if (m[target - nums[i]] !== undefined) return [m[target - nums[i]], i];
    m[nums[i]] = i;
  }
  return [];
}`,
    cpp: `vector<int> twoSum(vector<int> nums, int target) {
    unordered_map<int,int> m;
    for (int i = 0; i < (int)nums.size(); i++) {
        if (m.count(target - nums[i])) return {m[target - nums[i]], i};
        m[nums[i]] = i;
    }
    return {};
}`,
    java: `class Solution {
    public int[] twoSum(int[] nums, int target) {
        Map<Integer,Integer> m = new HashMap<>();
        for (int i = 0; i < nums.length; i++) {
            if (m.containsKey(target - nums[i])) return new int[]{m.get(target - nums[i]), i};
            m.put(nums[i], i);
        }
        return new int[0];
    }
}`,
  };

  for (const language of ['javascript', 'cpp', 'java'] as const) {
    test(`${language}: driver parses input and serializes return`, async () => {
      const provider = new LocalJudgeProvider();
      const source = wrapSource(language, sig, solutions[language]);
      const result = await provider.run({ language, source, stdin, timeLimitMs: 5000, memoryLimitMb: 256 });
      expect(result.status, result.stderr).toBe('ok');
      expect(result.stdout.trim()).toBe(expected);
    });
  }

  test('compile error is reported', async () => {
    const provider = new LocalJudgeProvider();
    const result = await provider.run({ language: 'cpp', source: 'int main(){ this is not c++ }', stdin: '', timeLimitMs: 5000, memoryLimitMb: 256 });
    expect(result.status).toBe('compile_error');
  });
});
