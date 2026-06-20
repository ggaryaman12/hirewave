// Function-mode problem bank. Original statements. Each problem provides a plain
// JS `reference` (ground truth), explicit `samples` (public), and `generators`
// (seeded) used to synthesize hidden cases. Only judge-SAFE problems live here:
// every input must map to exactly one correct output, so exact/whitespace/float
// comparison is valid.
import { randArray, randInt } from './lib/serialize.mjs';

const EASY = 'easy';
const MEDIUM = 'medium';

// shuffle in place with seeded rng
function shuffle(r, arr) {
  for (let i = arr.length - 1; i > 0; i -= 1) {
    const j = Math.floor(r() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr;
}
function distinctSortedArray(r, len, lo, hi) {
  const set = new Set();
  while (set.size < len && set.size <= hi - lo) set.add(randInt(r, lo, hi));
  return [...set].sort((a, b) => a - b);
}
function randString(r, len, alphabet) {
  let s = '';
  for (let i = 0; i < len; i += 1) s += alphabet[Math.floor(r() * alphabet.length)];
  return s;
}
const LOWER = 'abcdefghijklmnopqrstuvwxyz';

export const TRACKS = [
  {
    slug: 'core-patterns',
    title: 'Core Patterns',
    source: 'Original Hirewave problem bank',
    sortOrder: 0,
    topics: [
      { key: 'arrays', title: 'Arrays & Hashing', sortOrder: 0 },
      { key: 'searching', title: 'Binary Search', sortOrder: 1 },
      { key: 'strings', title: 'Strings', sortOrder: 2 },
      { key: 'math', title: 'Math', sortOrder: 3 },
      { key: 'matrix', title: 'Matrix', sortOrder: 4 },
    ],
  },
];

export const PROBLEMS = [
  // ---- Arrays & Hashing -------------------------------------------------
  {
    slug: 'has-pair-with-sum',
    title: 'Pair With Target Sum',
    track: 'core-patterns',
    topic: 'arrays',
    difficulty: EASY,
    statementMd:
      'Given an array of integers `nums` and an integer `target`, determine whether **two distinct positions** `i` and `j` exist such that `nums[i] + nums[j] == target`.\n\nReturn `true` if such a pair exists, otherwise `false`.',
    constraintsMd: '- `1 <= nums.length <= 10^4`\n- `-10^9 <= nums[i], target <= 10^9`',
    signature: { functionName: 'hasPairWithSum', params: [{ name: 'nums', type: 'int[]' }, { name: 'target', type: 'int' }], returnType: 'bool' },
    reference: (nums, target) => {
      const seen = new Set();
      for (const x of nums) {
        if (seen.has(target - x)) return true;
        seen.add(x);
      }
      return false;
    },
    samples: [
      [[2, 7, 11, 15], 9],
      [[3, 2, 4], 6],
      [[1, 1], 3],
    ],
    generators: [
      (r) => { const a = randArray(r, randInt(r, 2, 8), -20, 20); const hit = r() < 0.6; const t = hit ? a[0] + a[a.length - 1] : randInt(r, 100, 200); return [a, t]; },
    ],
    hiddenCount: 25,
  },
  {
    slug: 'maximum-subarray-sum',
    title: 'Maximum Subarray Sum',
    track: 'core-patterns',
    topic: 'arrays',
    difficulty: MEDIUM,
    statementMd:
      'Given a non-empty integer array `nums`, find the contiguous subarray (containing at least one element) with the largest sum and return that sum.',
    constraintsMd: '- `1 <= nums.length <= 10^5`\n- `-10^4 <= nums[i] <= 10^4`',
    signature: { functionName: 'maxSubarraySum', params: [{ name: 'nums', type: 'int[]' }], returnType: 'long' },
    reference: (nums) => {
      let best = nums[0];
      let cur = nums[0];
      for (let i = 1; i < nums.length; i += 1) {
        cur = Math.max(nums[i], cur + nums[i]);
        best = Math.max(best, cur);
      }
      return best;
    },
    samples: [
      [[-2, 1, -3, 4, -1, 2, 1, -5, 4]],
      [[1]],
      [[-3, -1, -2]],
    ],
    generators: [
      (r) => [randArray(r, randInt(r, 1, 12), -9, 9)],
    ],
    hiddenCount: 25,
  },
  {
    slug: 'second-largest',
    title: 'Second Largest Element',
    track: 'core-patterns',
    topic: 'arrays',
    difficulty: EASY,
    statementMd:
      'Given an array `nums` that contains at least two **distinct** values, return the second largest distinct value in the array.',
    constraintsMd: '- `2 <= nums.length <= 10^5`\n- The array contains at least two distinct values.',
    signature: { functionName: 'secondLargest', params: [{ name: 'nums', type: 'int[]' }], returnType: 'int' },
    reference: (nums) => {
      const d = [...new Set(nums)].sort((a, b) => b - a);
      return d[1];
    },
    samples: [
      [[3, 1, 4, 1, 5, 9, 2, 6]],
      [[10, 20]],
      [[7, 7, 3]],
    ],
    generators: [
      (r) => { let a = distinctSortedArray(r, randInt(r, 2, 8), -30, 30); a = shuffle(r, [...a, ...a.slice(0, randInt(r, 0, 2))]); return [a]; },
    ],
    hiddenCount: 20,
  },
  {
    slug: 'reverse-array',
    title: 'Reverse an Array',
    track: 'core-patterns',
    topic: 'arrays',
    difficulty: EASY,
    statementMd: 'Given an integer array `nums`, return a new array containing the same elements in reverse order.',
    constraintsMd: '- `0 <= nums.length <= 10^5`\n- `-10^9 <= nums[i] <= 10^9`',
    signature: { functionName: 'reverseArray', params: [{ name: 'nums', type: 'int[]' }], returnType: 'int[]' },
    reference: (nums) => [...nums].reverse(),
    samples: [
      [[1, 2, 3, 4, 5]],
      [[42]],
      [[]],
    ],
    generators: [
      (r) => [randArray(r, randInt(r, 0, 10), -50, 50)],
    ],
    hiddenCount: 18,
  },
  {
    slug: 'move-zeroes',
    title: 'Move Zeroes',
    track: 'core-patterns',
    topic: 'arrays',
    difficulty: EASY,
    statementMd:
      'Given an integer array `nums`, return an array where all `0` values are moved to the end while the relative order of the non-zero elements is preserved.',
    constraintsMd: '- `0 <= nums.length <= 10^5`\n- `-10^9 <= nums[i] <= 10^9`',
    signature: { functionName: 'moveZeroes', params: [{ name: 'nums', type: 'int[]' }], returnType: 'int[]' },
    reference: (nums) => {
      const nz = nums.filter((x) => x !== 0);
      const zeros = nums.length - nz.length;
      return [...nz, ...Array(zeros).fill(0)];
    },
    samples: [
      [[0, 1, 0, 3, 12]],
      [[0, 0, 1]],
      [[1, 2, 3]],
    ],
    generators: [
      (r) => [Array.from({ length: randInt(r, 0, 10) }, () => (r() < 0.4 ? 0 : randInt(r, -9, 9)))],
    ],
    hiddenCount: 18,
  },
  {
    slug: 'count-distinct',
    title: 'Count Distinct Elements',
    track: 'core-patterns',
    topic: 'arrays',
    difficulty: EASY,
    statementMd: 'Given an integer array `nums`, return the number of distinct values it contains.',
    constraintsMd: '- `0 <= nums.length <= 10^5`\n- `-10^9 <= nums[i] <= 10^9`',
    signature: { functionName: 'countDistinct', params: [{ name: 'nums', type: 'int[]' }], returnType: 'int' },
    reference: (nums) => new Set(nums).size,
    samples: [
      [[1, 2, 2, 3, 3, 3]],
      [[5, 5, 5]],
      [[]],
    ],
    generators: [
      (r) => [randArray(r, randInt(r, 0, 12), -6, 6)],
    ],
    hiddenCount: 18,
  },
  {
    slug: 'majority-element',
    title: 'Majority Element',
    track: 'core-patterns',
    topic: 'arrays',
    difficulty: MEDIUM,
    statementMd:
      'Given an array `nums` that is guaranteed to contain a majority element (a value appearing **strictly more than** `n / 2` times), return that element.',
    constraintsMd: '- `1 <= nums.length <= 10^5`\n- A majority element always exists.',
    signature: { functionName: 'majorityElement', params: [{ name: 'nums', type: 'int[]' }], returnType: 'int' },
    reference: (nums) => {
      let count = 0;
      let candidate = nums[0];
      for (const x of nums) {
        if (count === 0) candidate = x;
        count += x === candidate ? 1 : -1;
      }
      return candidate;
    },
    samples: [
      [[3, 2, 3]],
      [[2, 2, 1, 1, 1, 2, 2]],
      [[9]],
    ],
    generators: [
      (r) => {
        const n = randInt(r, 1, 11);
        const maj = randInt(r, -9, 9);
        const majCount = Math.floor(n / 2) + 1;
        const arr = Array(majCount).fill(maj);
        while (arr.length < n) { let v = randInt(r, -9, 9); if (v === maj) v = maj + 1; arr.push(v); }
        return [shuffle(r, arr)];
      },
    ],
    hiddenCount: 20,
  },

  // ---- Binary Search ----------------------------------------------------
  {
    slug: 'binary-search-index',
    title: 'Binary Search',
    track: 'core-patterns',
    topic: 'searching',
    difficulty: EASY,
    statementMd:
      'Given a **sorted** array of distinct integers `nums` (ascending) and an integer `target`, return the index of `target` in `nums`, or `-1` if it is not present.',
    constraintsMd: '- `0 <= nums.length <= 10^5`\n- `nums` is sorted ascending with distinct values.\n- `-10^9 <= nums[i], target <= 10^9`',
    signature: { functionName: 'search', params: [{ name: 'nums', type: 'int[]' }, { name: 'target', type: 'int' }], returnType: 'int' },
    reference: (nums, target) => {
      let lo = 0;
      let hi = nums.length - 1;
      while (lo <= hi) {
        const mid = (lo + hi) >> 1;
        if (nums[mid] === target) return mid;
        if (nums[mid] < target) lo = mid + 1; else hi = mid - 1;
      }
      return -1;
    },
    samples: [
      [[-1, 0, 3, 5, 9, 12], 9],
      [[-1, 0, 3, 5, 9, 12], 2],
      [[], 1],
    ],
    generators: [
      (r) => { const a = distinctSortedArray(r, randInt(r, 0, 10), -40, 40); const hit = a.length > 0 && r() < 0.6; const t = hit ? a[randInt(r, 0, a.length - 1)] : randInt(r, 41, 80); return [a, t]; },
    ],
    hiddenCount: 22,
  },

  // ---- Strings ----------------------------------------------------------
  {
    slug: 'is-palindrome',
    title: 'Valid Palindrome',
    track: 'core-patterns',
    topic: 'strings',
    difficulty: EASY,
    statementMd:
      'Given a string `s` consisting only of lowercase English letters, return `true` if `s` reads the same forwards and backwards, otherwise `false`.',
    constraintsMd: '- `1 <= s.length <= 10^5`\n- `s` contains only lowercase English letters.',
    signature: { functionName: 'isPalindrome', params: [{ name: 's', type: 'string' }], returnType: 'bool' },
    reference: (s) => s === [...s].reverse().join(''),
    samples: [
      ['racecar'],
      ['hello'],
      ['a'],
    ],
    generators: [
      (r) => {
        const half = randString(r, randInt(r, 1, 5), LOWER);
        if (r() < 0.5) { const mid = r() < 0.5 ? randString(r, 1, LOWER) : ''; return [half + mid + [...half].reverse().join('')]; }
        return [randString(r, randInt(r, 1, 9), 'abc')];
      },
    ],
    hiddenCount: 20,
  },
  {
    slug: 'count-vowels',
    title: 'Count Vowels',
    track: 'core-patterns',
    topic: 'strings',
    difficulty: EASY,
    statementMd:
      'Given a string `s` of lowercase English letters, return the number of vowels (`a`, `e`, `i`, `o`, `u`) it contains.',
    constraintsMd: '- `1 <= s.length <= 10^5`\n- `s` contains only lowercase English letters.',
    signature: { functionName: 'countVowels', params: [{ name: 's', type: 'string' }], returnType: 'int' },
    reference: (s) => [...s].filter((c) => 'aeiou'.includes(c)).length,
    samples: [
      ['programming'],
      ['xyz'],
      ['aeiou'],
    ],
    generators: [
      (r) => [randString(r, randInt(r, 1, 12), LOWER)],
    ],
    hiddenCount: 18,
  },
  {
    slug: 'valid-anagram',
    title: 'Valid Anagram',
    track: 'core-patterns',
    topic: 'strings',
    difficulty: EASY,
    statementMd:
      'Given two strings `s` and `t` of lowercase English letters, return `true` if `t` is an anagram of `s` (the same letters with the same frequencies), otherwise `false`.',
    constraintsMd: '- `1 <= s.length, t.length <= 10^5`\n- Both strings contain only lowercase English letters.',
    signature: { functionName: 'isAnagram', params: [{ name: 's', type: 'string' }, { name: 't', type: 'string' }], returnType: 'bool' },
    reference: (s, t) => {
      if (s.length !== t.length) return false;
      const sorted = (x) => [...x].sort().join('');
      return sorted(s) === sorted(t);
    },
    samples: [
      ['anagram', 'nagaram'],
      ['rat', 'car'],
      ['a', 'a'],
    ],
    generators: [
      (r) => { const s = randString(r, randInt(r, 1, 7), 'abcd'); if (r() < 0.5) return [s, shuffle(r, [...s]).join('')]; return [s, randString(r, s.length, 'abcd')]; },
    ],
    hiddenCount: 20,
  },

  // ---- Math -------------------------------------------------------------
  {
    slug: 'gcd-two-numbers',
    title: 'Greatest Common Divisor',
    track: 'core-patterns',
    topic: 'math',
    difficulty: EASY,
    statementMd: 'Given two positive integers `a` and `b`, return their greatest common divisor.',
    constraintsMd: '- `1 <= a, b <= 10^9`',
    signature: { functionName: 'gcd', params: [{ name: 'a', type: 'int' }, { name: 'b', type: 'int' }], returnType: 'int' },
    reference: (a, b) => { while (b) { [a, b] = [b, a % b]; } return a; },
    samples: [
      [12, 18],
      [7, 13],
      [100, 10],
    ],
    generators: [
      (r) => [randInt(r, 1, 1000), randInt(r, 1, 1000)],
    ],
    hiddenCount: 18,
  },
  {
    slug: 'nth-fibonacci',
    title: 'Nth Fibonacci Number',
    track: 'core-patterns',
    topic: 'math',
    difficulty: EASY,
    statementMd:
      'Return the `n`-th Fibonacci number, where `F(0) = 0`, `F(1) = 1`, and `F(n) = F(n-1) + F(n-2)` for `n >= 2`.',
    constraintsMd: '- `0 <= n <= 90`\n- The answer fits in a 64-bit signed integer.',
    signature: { functionName: 'fib', params: [{ name: 'n', type: 'int' }], returnType: 'long' },
    reference: (n) => {
      let a = 0n;
      let b = 1n;
      for (let i = 0; i < n; i += 1) { [a, b] = [b, a + b]; }
      return a; // BigInt -> serialized via String()
    },
    samples: [
      [0],
      [10],
      [20],
    ],
    generators: [
      (r) => [randInt(r, 0, 90)],
    ],
    hiddenCount: 20,
  },
  {
    slug: 'array-average',
    title: 'Array Average',
    track: 'core-patterns',
    topic: 'math',
    difficulty: EASY,
    statementMd:
      'Given a non-empty integer array `nums`, return the average (arithmetic mean) of its elements as a floating-point number. Answers within `1e-6` of the expected value are accepted.',
    constraintsMd: '- `1 <= nums.length <= 10^5`\n- `-10^6 <= nums[i] <= 10^6`',
    signature: { functionName: 'average', params: [{ name: 'nums', type: 'int[]' }], returnType: 'double' },
    comparison: 'float',
    floatEpsilon: 1e-6,
    reference: (nums) => nums.reduce((s, x) => s + x, 0) / nums.length,
    samples: [
      [[1, 2, 3, 4]],
      [[5]],
      [[-2, 2]],
    ],
    generators: [
      (r) => [randArray(r, randInt(r, 1, 10), -100, 100)],
    ],
    hiddenCount: 18,
  },

  // ---- Matrix -----------------------------------------------------------
  {
    slug: 'transpose-matrix',
    title: 'Transpose Matrix',
    track: 'core-patterns',
    topic: 'matrix',
    difficulty: MEDIUM,
    statementMd:
      'Given a matrix of integers with `R` rows and `C` columns, return its transpose: a matrix with `C` rows and `R` columns where element `(i, j)` becomes `(j, i)`.',
    constraintsMd: '- `1 <= R, C <= 1000`\n- `-10^9 <= matrix[i][j] <= 10^9`',
    signature: { functionName: 'transpose', params: [{ name: 'matrix', type: 'int[][]' }], returnType: 'int[][]' },
    reference: (m) => {
      const R = m.length;
      const C = m[0].length;
      const out = Array.from({ length: C }, () => Array(R).fill(0));
      for (let i = 0; i < R; i += 1) for (let j = 0; j < C; j += 1) out[j][i] = m[i][j];
      return out;
    },
    samples: [
      [[[1, 2, 3], [4, 5, 6]]],
      [[[1]]],
      [[[1, 2], [3, 4], [5, 6]]],
    ],
    generators: [
      (r) => { const R = randInt(r, 1, 4); const C = randInt(r, 1, 4); return [Array.from({ length: R }, () => randArray(r, C, -9, 9))]; },
    ],
    hiddenCount: 18,
  },
  {
    slug: 'matrix-row-sums',
    title: 'Matrix Row Sums',
    track: 'core-patterns',
    topic: 'matrix',
    difficulty: EASY,
    statementMd: 'Given a matrix of integers, return an array containing the sum of each row, in order.',
    constraintsMd: '- `1 <= R, C <= 1000`\n- `-10^6 <= matrix[i][j] <= 10^6`',
    signature: { functionName: 'rowSums', params: [{ name: 'matrix', type: 'int[][]' }], returnType: 'int[]' },
    reference: (m) => m.map((row) => row.reduce((s, x) => s + x, 0)),
    samples: [
      [[[1, 2, 3], [4, 5, 6]]],
      [[[0]]],
      [[[-1, 1], [10, -10]]],
    ],
    generators: [
      (r) => { const R = randInt(r, 1, 4); const C = randInt(r, 1, 4); return [Array.from({ length: R }, () => randArray(r, C, -50, 50))]; },
    ],
    hiddenCount: 18,
  },
];
