import { readFileSync } from 'fs';
import { join } from 'path';
import { expect, test } from '@playwright/test';
import { LocalJudgeProvider } from '../../lib/judge/local-provider';
import { wrapSource, parseSignature } from '../../lib/judge/harness';
import { compareOutput } from '../../lib/judge/compare';
import type { ComparisonPolicy } from '../../lib/judge/types';

// Cross-language solvability gate: real C++ and Java solutions (covering every
// harness type-shape in the bank) compiled + run against each problem's FULL
// generated suite. Proves candidates in any supported language receive correct
// verdicts against the seeded expected outputs.
const GEN_DIR = join(__dirname, '../../scripts/dsa/generated');

type GenProblem = {
  slug: string;
  signatureJson: string;
  comparison: ComparisonPolicy;
  floatEpsilon: number | null;
  timeLimitMs: number;
  memoryLimitMb: number;
  testCases: { input: string; expected: string }[];
};

// One correct solution per (problem, language) covering all type shapes:
// int/long/double/bool/string scalars, T[] and int[][] params + returns.
const SOLUTIONS: Record<string, { cpp: string; java: string }> = {
  'has-pair-with-sum': {
    cpp: `bool hasPairWithSum(vector<int> nums,int target){unordered_set<int> s;for(int x:nums){if(s.count(target-x))return true;s.insert(x);}return false;}`,
    java: `class Solution{ public boolean hasPairWithSum(int[] nums,int target){java.util.HashSet<Integer> s=new java.util.HashSet<>();for(int x:nums){if(s.contains(target-x))return true;s.add(x);}return false;}}`,
  },
  'maximum-subarray-sum': {
    cpp: `long long maxSubarraySum(vector<int> nums){long long best=nums[0],cur=nums[0];for(size_t i=1;i<nums.size();i++){cur=max((long long)nums[i],cur+nums[i]);best=max(best,cur);}return best;}`,
    java: `class Solution{ public long maxSubarraySum(int[] nums){long best=nums[0],cur=nums[0];for(int i=1;i<nums.length;i++){cur=Math.max((long)nums[i],cur+nums[i]);best=Math.max(best,cur);}return best;}}`,
  },
  'count-distinct': {
    cpp: `int countDistinct(vector<int> nums){return (int)unordered_set<int>(nums.begin(),nums.end()).size();}`,
    java: `class Solution{ public int countDistinct(int[] nums){java.util.HashSet<Integer> s=new java.util.HashSet<>();for(int x:nums)s.add(x);return s.size();}}`,
  },
  'reverse-array': {
    cpp: `vector<int> reverseArray(vector<int> nums){reverse(nums.begin(),nums.end());return nums;}`,
    java: `class Solution{ public int[] reverseArray(int[] nums){int[] r=new int[nums.length];for(int i=0;i<nums.length;i++)r[i]=nums[nums.length-1-i];return r;}}`,
  },
  'binary-search-index': {
    cpp: `int search(vector<int> nums,int target){int lo=0,hi=(int)nums.size()-1;while(lo<=hi){int mid=(lo+hi)/2;if(nums[mid]==target)return mid;if(nums[mid]<target)lo=mid+1;else hi=mid-1;}return -1;}`,
    java: `class Solution{ public int search(int[] nums,int target){int lo=0,hi=nums.length-1;while(lo<=hi){int mid=(lo+hi)/2;if(nums[mid]==target)return mid;if(nums[mid]<target)lo=mid+1;else hi=mid-1;}return -1;}}`,
  },
  'is-palindrome': {
    cpp: `bool isPalindrome(string s){string r(s.rbegin(),s.rend());return r==s;}`,
    java: `class Solution{ public boolean isPalindrome(String s){return s.equals(new StringBuilder(s).reverse().toString());}}`,
  },
  'count-vowels': {
    cpp: `int countVowels(string s){int c=0;for(char ch:s)if(ch=='a'||ch=='e'||ch=='i'||ch=='o'||ch=='u')c++;return c;}`,
    java: `class Solution{ public int countVowels(String s){int c=0;for(char ch:s.toCharArray())if("aeiou".indexOf(ch)>=0)c++;return c;}}`,
  },
  'valid-anagram': {
    cpp: `bool isAnagram(string s,string t){if(s.size()!=t.size())return false;sort(s.begin(),s.end());sort(t.begin(),t.end());return s==t;}`,
    java: `class Solution{ public boolean isAnagram(String s,String t){if(s.length()!=t.length())return false;char[] a=s.toCharArray(),b=t.toCharArray();java.util.Arrays.sort(a);java.util.Arrays.sort(b);return java.util.Arrays.equals(a,b);}}`,
  },
  'gcd-two-numbers': {
    cpp: `int gcd(int a,int b){while(b){int t=a%b;a=b;b=t;}return a;}`,
    java: `class Solution{ public int gcd(int a,int b){while(b!=0){int t=a%b;a=b;b=t;}return a;}}`,
  },
  'nth-fibonacci': {
    cpp: `long long fib(int n){long long a=0,b=1;for(int i=0;i<n;i++){long long t=a+b;a=b;b=t;}return a;}`,
    java: `class Solution{ public long fib(int n){long a=0,b=1;for(int i=0;i<n;i++){long t=a+b;a=b;b=t;}return a;}}`,
  },
  'array-average': {
    cpp: `double average(vector<int> nums){double s=0;for(int x:nums)s+=x;return s/nums.size();}`,
    java: `class Solution{ public double average(int[] nums){double s=0;for(int x:nums)s+=x;return s/nums.length;}}`,
  },
  'transpose-matrix': {
    cpp: `vector<vector<int>> transpose(vector<vector<int>> m){int R=m.size(),C=m[0].size();vector<vector<int>> o(C,vector<int>(R));for(int i=0;i<R;i++)for(int j=0;j<C;j++)o[j][i]=m[i][j];return o;}`,
    java: `class Solution{ public int[][] transpose(int[][] m){int R=m.length,C=m[0].length;int[][] o=new int[C][R];for(int i=0;i<R;i++)for(int j=0;j<C;j++)o[j][i]=m[i][j];return o;}}`,
  },
  'matrix-row-sums': {
    cpp: `vector<int> rowSums(vector<vector<int>> m){vector<int> o;for(auto&row:m){int s=0;for(int x:row)s+=x;o.push_back(s);}return o;}`,
    java: `class Solution{ public int[] rowSums(int[][] m){int[] o=new int[m.length];for(int i=0;i<m.length;i++){int s=0;for(int x:m[i])s+=x;o[i]=s;}return o;}}`,
  },
};

const provider = new LocalJudgeProvider();

for (const [slug, sols] of Object.entries(SOLUTIONS)) {
  for (const language of ['cpp', 'java'] as const) {
    test(`${slug} (${language}): all cases accepted`, async () => {
      const problem = JSON.parse(readFileSync(join(GEN_DIR, `${slug}.json`), 'utf8')) as GenProblem;
      const sig = parseSignature(problem.signatureJson);
      expect(sig).not.toBeNull();
      // cpp solutions are written as method bodies; wrap them in class Solution
      // to match the LeetCode-style harness (java entries already are).
      const raw = sols[language];
      const userCode = language === 'cpp' ? `class Solution {\npublic:\n${raw}\n};` : raw;
      const source = wrapSource(language, sig!, userCode);

      for (const tc of problem.testCases) {
        const run = await provider.run({
          language,
          source,
          stdin: tc.input,
          timeLimitMs: problem.timeLimitMs,
          memoryLimitMb: problem.memoryLimitMb,
        });
        expect(run.status, `${slug}/${language} input <<${tc.input}>> stderr: ${run.stderr}`).toBe('ok');
        const ok = compareOutput(tc.expected, run.stdout, problem.comparison, problem.floatEpsilon ?? undefined);
        expect(ok, `${slug}/${language} input <<${tc.input}>> expected <<${tc.expected}>> got <<${run.stdout}>>`).toBe(true);
      }
    });
  }
}
