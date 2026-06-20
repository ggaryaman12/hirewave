// Slice 3: Problem bank seed for the DSA judge.
//
// CommonJS module (matches prisma/seed.js style). Exposes seedDsa(prisma) which
// is idempotent: tracks/topics are find-or-created by a stable identity and
// problems are upserted by their unique slug.
//
// IMPORTANT: every `expected` output below is hand-traced against the matching
// reference solution. The judge treats these as ground truth, so a wrong
// expected value would produce a wrong verdict. Comparison policy is
// 'whitespace' (see lib/judge/compare.ts), which trims trailing whitespace and
// trailing blank lines, so outputs do not need a trailing newline.
//
// All problem statements are ORIGINAL. No third-party problem text is copied.

const TRACKS = [
  {
    slug: 'striver-a2z',
    title: 'Striver A2Z',
    source:
      'https://takeuforward.org/strivers-a2z-dsa/strivers-a2z-dsa-course-sheet-2/',
    sortOrder: 0,
    topics: [
      { key: 'arrays', title: 'Arrays', sortOrder: 0 },
      { key: 'searching', title: 'Searching', sortOrder: 1 },
      { key: 'strings', title: 'Strings', sortOrder: 2 },
      { key: 'math', title: 'Math', sortOrder: 3 },
    ],
  },
  {
    slug: 'love-babbar-450',
    title: 'Love Babbar 450',
    source: 'https://codolio.com/question-tracker/sheet/love-babbar-sheet',
    sortOrder: 1,
    topics: [
      { key: 'arrays', title: 'Arrays', sortOrder: 0 },
      { key: 'strings', title: 'Strings', sortOrder: 1 },
      { key: 'recursion', title: 'Recursion', sortOrder: 2 },
    ],
  },
];

// Reference solutions are stored as a JSON string in DsaProblem.referenceSolutionJson.
function refSolution(language, source) {
  return JSON.stringify({ language, source });
}

// Helper to keep test-case authoring terse and consistent.
function tc(input, expected, isSample, sortOrder) {
  return { input, expected, isSample, sortOrder };
}

// Each problem names its track + topic via trackSlug/topicKey so we can resolve
// the topicId after tracks/topics are created.
const PROBLEMS = [
  // ----------------------------------------------------------------------
  // 1. Sum of Two Numbers  (Striver A2Z -> Math)
  // ----------------------------------------------------------------------
  {
    trackSlug: 'striver-a2z',
    topicKey: 'math',
    sortOrder: 0,
    slug: 'sum-of-two-numbers',
    title: 'Sum of Two Numbers',
    difficulty: 'easy',
    statementMd:
      'You are given two integers, `a` and `b`. Print their arithmetic sum `a + b`.\n\nThis is a warm-up problem to confirm your standard-input/standard-output setup works.',
    constraintsMd: '- -10^9 <= a, b <= 10^9',
    inputFormat: 'A single line containing two space-separated integers `a` and `b`.',
    outputFormat: 'A single line containing the integer `a + b`.',
    comparison: 'whitespace',
    timeLimitMs: 1000,
    memoryLimitMb: 256,
    referenceSolution: refSolution(
      'python',
      'a, b = map(int, input().split())\nprint(a + b)\n',
    ),
    testCases: [
      // Samples
      tc('2 3\n', '5', true, 0), // 2 + 3 = 5
      tc('-4 10\n', '6', true, 1), // -4 + 10 = 6
      // Hidden
      tc('0 0\n', '0', false, 2), // 0 + 0 = 0
      tc('1000000000 1000000000\n', '2000000000', false, 3), // 1e9 + 1e9 = 2e9
      tc('-1000000000 -7\n', '-1000000007', false, 4), // -1e9 + (-7)
      tc('123456 -123456\n', '0', false, 5), // cancels to 0
    ],
  },

  // ----------------------------------------------------------------------
  // 2. GCD of Two Numbers  (Striver A2Z -> Math)
  // ----------------------------------------------------------------------
  {
    trackSlug: 'striver-a2z',
    topicKey: 'math',
    sortOrder: 1,
    slug: 'gcd-of-two-numbers',
    title: 'GCD of Two Numbers',
    difficulty: 'easy',
    statementMd:
      'Given two positive integers `a` and `b`, print their greatest common divisor: the largest positive integer that divides both `a` and `b` exactly.',
    constraintsMd: '- 1 <= a, b <= 10^9',
    inputFormat: 'A single line with two space-separated positive integers `a` and `b`.',
    outputFormat: 'A single line containing gcd(a, b).',
    comparison: 'whitespace',
    timeLimitMs: 1000,
    memoryLimitMb: 256,
    referenceSolution: refSolution(
      'python',
      'import math\na, b = map(int, input().split())\nprint(math.gcd(a, b))\n',
    ),
    testCases: [
      // Samples
      tc('12 18\n', '6', true, 0), // gcd(12,18): 12=2^2*3, 18=2*3^2 -> 2*3=6
      tc('7 13\n', '1', true, 1), // coprime primes -> 1
      // Hidden
      tc('100 10\n', '10', false, 2), // 10 divides both
      tc('17 17\n', '17', false, 3), // equal -> itself
      tc('1000000000 2\n', '2', false, 4), // 1e9 is even -> gcd 2
      tc('48 36\n', '12', false, 5), // gcd(48,36)=12
    ],
  },

  // ----------------------------------------------------------------------
  // 3. Reverse an Array  (Striver A2Z -> Arrays)
  // ----------------------------------------------------------------------
  {
    trackSlug: 'striver-a2z',
    topicKey: 'arrays',
    sortOrder: 0,
    slug: 'reverse-an-array',
    title: 'Reverse an Array',
    difficulty: 'easy',
    statementMd:
      'You are given an array of `n` integers. Print the same elements in reverse order, separated by single spaces, on one line.',
    constraintsMd:
      '- 1 <= n <= 10^5\n- -10^9 <= each element <= 10^9',
    inputFormat:
      'The first line contains the integer `n`. The second line contains `n` space-separated integers.',
    outputFormat: 'A single line with the `n` integers in reverse order, space-separated.',
    comparison: 'whitespace',
    timeLimitMs: 1000,
    memoryLimitMb: 256,
    referenceSolution: refSolution(
      'python',
      'n = int(input())\narr = input().split()\nprint(" ".join(arr[::-1]))\n',
    ),
    testCases: [
      // Samples
      tc('5\n1 2 3 4 5\n', '5 4 3 2 1', true, 0), // reversed
      tc('1\n42\n', '42', true, 1), // single element
      // Hidden
      tc('4\n-1 -2 -3 -4\n', '-4 -3 -2 -1', false, 2),
      tc('3\n10 10 20\n', '20 10 10', false, 3), // duplicates ok
      tc('6\n0 0 0 1 2 3\n', '3 2 1 0 0 0', false, 4),
      tc('2\n1000000000 -1000000000\n', '-1000000000 1000000000', false, 5),
    ],
  },

  // ----------------------------------------------------------------------
  // 4. Second Largest in Array  (Striver A2Z -> Arrays)
  // ----------------------------------------------------------------------
  {
    trackSlug: 'striver-a2z',
    topicKey: 'arrays',
    sortOrder: 1,
    slug: 'second-largest-in-array',
    title: 'Second Largest in Array',
    difficulty: 'easy',
    statementMd:
      'You are given an array of `n` integers. Print the second largest *distinct* value in the array. If no such value exists (every element is equal, or `n` is 1), print `-1`.',
    constraintsMd:
      '- 1 <= n <= 10^5\n- -10^9 <= each element <= 10^9',
    inputFormat:
      'The first line contains `n`. The second line contains `n` space-separated integers.',
    outputFormat:
      'A single line with the second largest distinct value, or `-1` if it does not exist.',
    comparison: 'whitespace',
    timeLimitMs: 1000,
    memoryLimitMb: 256,
    referenceSolution: refSolution(
      'python',
      'n = int(input())\narr = list(map(int, input().split()))\nuniq = sorted(set(arr))\nprint(uniq[-2] if len(uniq) >= 2 else -1)\n',
    ),
    testCases: [
      // Samples
      tc('5\n3 1 4 1 5\n', '4', true, 0), // distinct sorted: 1,3,4,5 -> 2nd largest 4
      tc('1\n7\n', '-1', true, 1), // single element -> -1
      // Hidden
      tc('4\n2 2 2 2\n', '-1', false, 2), // all equal -> no 2nd distinct
      tc('3\n5 5 4\n', '4', false, 3), // distinct: 4,5 -> 2nd largest 4
      tc('6\n-1 -2 -3 -4 -5 -6\n', '-2', false, 4), // distinct sorted ...,-2,-1 -> 2nd largest -2
      tc('5\n10 20 20 30 30\n', '20', false, 5), // distinct: 10,20,30 -> 2nd largest 20
    ],
  },

  // ----------------------------------------------------------------------
  // 5. Maximum Subarray Sum (Kadane)  (Striver A2Z -> Arrays)
  // ----------------------------------------------------------------------
  {
    trackSlug: 'striver-a2z',
    topicKey: 'arrays',
    sortOrder: 2,
    slug: 'maximum-subarray-sum',
    title: 'Maximum Subarray Sum',
    difficulty: 'medium',
    statementMd:
      'You are given an array of `n` integers. A subarray is a contiguous (non-empty) slice of the array. Print the maximum possible sum over all non-empty subarrays.',
    constraintsMd:
      '- 1 <= n <= 10^5\n- -10^9 <= each element <= 10^9',
    inputFormat:
      'The first line contains `n`. The second line contains `n` space-separated integers.',
    outputFormat: 'A single line with the maximum subarray sum.',
    comparison: 'whitespace',
    timeLimitMs: 1500,
    memoryLimitMb: 256,
    referenceSolution: refSolution(
      'python',
      'n = int(input())\narr = list(map(int, input().split()))\nbest = cur = arr[0]\nfor x in arr[1:]:\n    cur = max(x, cur + x)\n    best = max(best, cur)\nprint(best)\n',
    ),
    testCases: [
      // Samples
      tc('5\n-2 1 -3 4 -1\n', '4', true, 0),
      // trace: best subarray is [4] = 4. ([4,-1]=3 < 4)
      tc('4\n1 2 3 4\n', '10', true, 1), // whole array = 10
      // Hidden
      tc('5\n-5 -4 -3 -2 -1\n', '-1', false, 2), // all negative -> max single element -1
      tc('1\n-7\n', '-7', false, 3), // single element
      tc('9\n-2 1 -3 4 -1 2 1 -5 4\n', '6', false, 4),
      // classic: subarray [4,-1,2,1] = 6
      tc('6\n5 -2 3 -1 2 -4\n', '7', false, 5),
      // trace: 5,-2->3,+3->6,-1->5,+2->7,-4->3 ; best=7 (subarray 5,-2,3,-1,2)
    ],
  },

  // ----------------------------------------------------------------------
  // 6. Binary Search  (Striver A2Z -> Searching)
  // ----------------------------------------------------------------------
  {
    trackSlug: 'striver-a2z',
    topicKey: 'searching',
    sortOrder: 0,
    slug: 'binary-search-index',
    title: 'Binary Search',
    difficulty: 'easy',
    statementMd:
      'You are given a sorted (non-decreasing) array of `n` distinct integers and a target value `x`. Print the 0-based index of `x` in the array, or `-1` if `x` is not present.',
    constraintsMd:
      '- 1 <= n <= 10^5\n- The array is sorted in strictly increasing order.\n- -10^9 <= each element, x <= 10^9',
    inputFormat:
      'The first line contains two integers `n` and `x`. The second line contains `n` space-separated integers in increasing order.',
    outputFormat: 'A single line with the 0-based index of `x`, or `-1`.',
    comparison: 'whitespace',
    timeLimitMs: 1000,
    memoryLimitMb: 256,
    referenceSolution: refSolution(
      'python',
      'import bisect\nfirst = input().split()\nn, x = int(first[0]), int(first[1])\narr = list(map(int, input().split()))\ni = bisect.bisect_left(arr, x)\nprint(i if i < n and arr[i] == x else -1)\n',
    ),
    testCases: [
      // Samples
      tc('5 3\n1 2 3 4 5\n', '2', true, 0), // value 3 at index 2
      tc('5 6\n1 2 3 4 5\n', '-1', true, 1), // 6 absent -> -1
      // Hidden
      tc('1 7\n7\n', '0', false, 2), // single element match at 0
      tc('6 10\n2 4 6 8 10 12\n', '4', false, 3), // 10 at index 4
      tc('6 1\n2 4 6 8 10 12\n', '-1', false, 4), // 1 < min -> -1
      tc('7 -3\n-9 -5 -3 0 4 8 11\n', '2', false, 5), // -3 at index 2
    ],
  },

  // ----------------------------------------------------------------------
  // 7. Check Palindrome  (Love Babbar 450 -> Strings)
  // ----------------------------------------------------------------------
  {
    trackSlug: 'love-babbar-450',
    topicKey: 'strings',
    sortOrder: 0,
    slug: 'check-palindrome-string',
    title: 'Check Palindrome',
    difficulty: 'easy',
    statementMd:
      'You are given a single string `s` containing only lowercase English letters. Print `YES` if `s` reads the same forwards and backwards, otherwise print `NO`.',
    constraintsMd:
      '- 1 <= length of s <= 10^5\n- `s` contains only the characters a-z.',
    inputFormat: 'A single line containing the string `s`.',
    outputFormat: 'Print `YES` if `s` is a palindrome, otherwise `NO`.',
    comparison: 'whitespace',
    timeLimitMs: 1000,
    memoryLimitMb: 256,
    referenceSolution: refSolution(
      'python',
      's = input().strip()\nprint("YES" if s == s[::-1] else "NO")\n',
    ),
    testCases: [
      // Samples
      tc('racecar\n', 'YES', true, 0), // palindrome
      tc('hello\n', 'NO', true, 1), // not a palindrome
      // Hidden
      tc('a\n', 'YES', false, 2), // single char
      tc('abba\n', 'YES', false, 3), // even-length palindrome
      tc('abca\n', 'NO', false, 4), // not palindrome
      tc('madam\n', 'YES', false, 5), // odd-length palindrome
    ],
  },

  // ----------------------------------------------------------------------
  // 8. Count Vowels  (Love Babbar 450 -> Strings)
  // ----------------------------------------------------------------------
  {
    trackSlug: 'love-babbar-450',
    topicKey: 'strings',
    sortOrder: 1,
    slug: 'count-vowels-in-string',
    title: 'Count Vowels',
    difficulty: 'easy',
    statementMd:
      'You are given a single string `s` of lowercase English letters. Print the number of vowels in `s`. The vowels are `a`, `e`, `i`, `o`, and `u`.',
    constraintsMd:
      '- 1 <= length of s <= 10^5\n- `s` contains only the characters a-z.',
    inputFormat: 'A single line containing the string `s`.',
    outputFormat: 'A single line with the count of vowels in `s`.',
    comparison: 'whitespace',
    timeLimitMs: 1000,
    memoryLimitMb: 256,
    referenceSolution: refSolution(
      'python',
      's = input().strip()\nprint(sum(1 for c in s if c in "aeiou"))\n',
    ),
    testCases: [
      // Samples
      tc('education\n', '5', true, 0), // e,u,a,i,o -> 5
      tc('rhythm\n', '0', true, 1), // no vowels
      // Hidden
      tc('aeiou\n', '5', false, 2), // all five vowels
      tc('banana\n', '3', false, 3), // a,a,a -> 3
      tc('xyz\n', '0', false, 4), // none
      tc('queueing\n', '5', false, 5),
      // 'queueing' = q,u,e,u,e,i,n,g -> vowels u,e,u,e,i = 5
    ],
  },
];

async function findOrCreateTrack(prisma, track) {
  let row = await prisma.dsaTrack.findUnique({ where: { slug: track.slug } });
  if (!row) {
    row = await prisma.dsaTrack.create({
      data: {
        slug: track.slug,
        title: track.title,
        source: track.source,
        sortOrder: track.sortOrder,
      },
    });
  } else {
    row = await prisma.dsaTrack.update({
      where: { id: row.id },
      data: { title: track.title, source: track.source, sortOrder: track.sortOrder },
    });
  }
  return row;
}

// Topics have no unique slug column, so identity is (trackId, title).
async function findOrCreateTopic(prisma, trackId, topic) {
  let row = await prisma.dsaTopic.findFirst({
    where: { trackId, title: topic.title },
  });
  if (!row) {
    row = await prisma.dsaTopic.create({
      data: { trackId, title: topic.title, sortOrder: topic.sortOrder },
    });
  } else {
    row = await prisma.dsaTopic.update({
      where: { id: row.id },
      data: { sortOrder: topic.sortOrder },
    });
  }
  return row;
}

async function seedDsa(prisma) {
  // topicIndex: trackSlug -> topicKey -> topicId
  const topicIndex = {};

  for (const track of TRACKS) {
    const trackRow = await findOrCreateTrack(prisma, track);
    topicIndex[track.slug] = {};
    for (const topic of track.topics) {
      const topicRow = await findOrCreateTopic(prisma, trackRow.id, topic);
      topicIndex[track.slug][topic.key] = topicRow.id;
    }
  }

  for (const problem of PROBLEMS) {
    const topicId = topicIndex[problem.trackSlug][problem.topicKey];
    if (!topicId) {
      throw new Error(
        `seedDsa: no topic for ${problem.trackSlug}/${problem.topicKey} (problem ${problem.slug})`,
      );
    }

    const data = {
      topicId,
      title: problem.title,
      difficulty: problem.difficulty,
      statementMd: problem.statementMd,
      constraintsMd: problem.constraintsMd,
      inputFormat: problem.inputFormat,
      outputFormat: problem.outputFormat,
      comparison: problem.comparison,
      floatEpsilon: problem.floatEpsilon ?? null,
      timeLimitMs: problem.timeLimitMs,
      memoryLimitMb: problem.memoryLimitMb,
      referenceSolutionJson: problem.referenceSolution,
      sourceUrl: null,
      attribution: 'Original problem authored for the Hirewave DSA bank.',
      // Legacy stdin/stdout originals are superseded by the function-mode bank
      // (seed-dsa-fn). Kept as 'draft' so the published experience is uniformly
      // LeetCode-style function problems.
      status: 'draft',
    };

    const problemRow = await prisma.dsaProblem.upsert({
      where: { slug: problem.slug },
      update: data,
      create: { slug: problem.slug, ...data },
    });

    // Replace test cases on every run so edits to expected outputs take effect.
    await prisma.dsaTestCase.deleteMany({ where: { problemId: problemRow.id } });
    for (const t of problem.testCases) {
      await prisma.dsaTestCase.create({
        data: {
          problemId: problemRow.id,
          input: t.input,
          expected: t.expected,
          isSample: t.isSample,
          sortOrder: t.sortOrder,
        },
      });
    }
  }
}

module.exports = { seedDsa };
