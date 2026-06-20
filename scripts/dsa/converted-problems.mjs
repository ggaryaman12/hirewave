// Imported competitive problems hand-converted to function-mode (LeetCode-style).
// We keep the original statement + attribution (CC BY) but reframe the freeform
// stdin/stdout into a single typed function, and GENERATE fresh tests from a JS
// reference (the dataset's batched/multi-query tests don't fit one call).
//
// Each entry upserts by slug, so it REPLACES the imported stdin version: kind
// becomes 'function', a signature + function stub appear, and it moves into the
// real-world track. Conversion is manual + 1-by-1 (only problems that map to a
// single function qualify).
import { randInt } from './lib/serialize.mjs';

const CC_BY = 'Adapted to function form from the DeepMind code_contests dataset (CC BY 4.0). Original problem: Codeforces.';

function randDigits(r, len) {
  let s = '';
  for (let i = 0; i < len; i += 1) s += String(randInt(r, 0, 9));
  return s;
}

export const CONVERTED_PROBLEMS = [
  {
    kind: 'function',
    slug: '1060-a-phone-numbers',
    title: 'Phone Numbers',
    track: 'real-world',
    topic: 'patterns',
    difficulty: 'easy',
    attribution: CC_BY,
    companyTags: [],
    categoryTags: ['greedy', 'strings'],
    hints: [
      'A phone number needs exactly 11 cards and must start with the digit 8.',
      'So each phone number costs one 8 plus ten other cards.',
      'The answer is limited by both the count of 8s and how many groups of 11 cards you have.',
    ],
    statementMd:
      "A phone number is a string of length 11 matching the pattern `8xxxxxxxxxx` (a leading `8` followed by ten digits).\n\nYou have a set of digit cards given as the string `digits` (each character is one card). Using each card in at most one phone number, return the maximum number of phone numbers you can form. You do not have to use every card, and the phone numbers need not be distinct.",
    constraintsMd: '- `1 <= digits.length <= 100`\n- Each character of `digits` is a decimal digit `0`-`9`.',
    signature: { functionName: 'maxPhoneNumbers', params: [{ name: 'digits', type: 'string' }], returnType: 'int' },
    reference: (digits) => {
      const eights = [...digits].filter((c) => c === '8').length;
      return Math.min(eights, Math.floor(digits.length / 11));
    },
    samples: [['0011223344556677889988'], ['00000000008'], ['31415926535']],
    generators: [(r) => [randDigits(r, randInt(r, 1, 30))]],
    hiddenCount: 22,
  },
];
