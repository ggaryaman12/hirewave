// Pure transform: one raw DeepMind `code_contests` row -> a normalized problem
// record ready for the DB. No I/O, no prisma — unit-testable in isolation.
//
// Dataset: https://huggingface.co/datasets/deepmind/code_contests (CC BY 4.0).
// CC BY REQUIRES attribution; every record carries an `attribution` string.

export type RawTests = { input?: string[]; output?: string[] };
export type RawRow = {
  name?: string;
  description?: string;
  source?: number; // code_contests source enum
  difficulty?: number;
  cf_rating?: number;
  public_tests?: RawTests;
  private_tests?: RawTests;
  generated_tests?: RawTests;
};

export type NormalizedTestCase = { input: string; expected: string; isSample: boolean };
export type NormalizedProblem = {
  slug: string;
  title: string;
  statementMd: string;
  difficulty: string;
  comparison: 'whitespace' | 'float';
  floatEpsilon: number | null;
  attribution: string;
  sourceUrl: string | null;
  testCases: NormalizedTestCase[];
};

export type TransformOptions = { maxHiddenCases?: number; maxSampleCases?: number };

// code_contests `source` enum -> human label. (UNKNOWN=0, CODECHEF=1,
// CODEFORCES=2, HACKEREARTH=3, CODEJAM=4, ATCODER=5, AIZU=6.)
const SOURCE_LABEL: Record<number, string> = {
  0: 'Unknown source',
  1: 'CodeChef',
  2: 'Codeforces',
  3: 'HackerEarth',
  4: 'Google Code Jam',
  5: 'AtCoder',
  6: 'Aizu Online Judge',
};

// code_contests `difficulty` is a coarse band; map to our three buckets.
function mapDifficulty(row: RawRow): string {
  const rating = row.cf_rating ?? 0;
  if (rating && rating < 1200) return 'easy';
  if (rating && rating < 1900) return 'medium';
  if (rating) return 'hard';
  const d = row.difficulty ?? 0;
  if (d <= 5) return 'easy';
  if (d <= 9) return 'medium';
  return 'hard';
}

export function slugify(name: string): string {
  return name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 80) || 'problem';
}

// Float comparison if the statement mentions an error tolerance.
function inferComparison(description: string): { comparison: 'whitespace' | 'float'; floatEpsilon: number | null } {
  if (/(10\s*\^\s*-?\d|1e-?\d|absolute or relative error|relative error|absolute error)/i.test(description)) {
    return { comparison: 'float', floatEpsilon: 1e-6 };
  }
  return { comparison: 'whitespace', floatEpsilon: null };
}

function pairTests(tests: RawTests | undefined, isSample: boolean, limit: number): NormalizedTestCase[] {
  if (!tests?.input || !tests?.output) return [];
  const n = Math.min(tests.input.length, tests.output.length, limit);
  const out: NormalizedTestCase[] = [];
  for (let i = 0; i < n; i += 1) {
    out.push({ input: tests.input[i] ?? '', expected: (tests.output[i] ?? '').replace(/\s+$/, ''), isSample });
  }
  return out;
}

// Returns null for rows that cannot become a valid problem (skip + log upstream).
export function transformRow(row: RawRow, options: TransformOptions = {}): NormalizedProblem | null {
  const name = (row.name ?? '').trim();
  const description = (row.description ?? '').trim();
  if (!name || !description) return null;

  const maxSample = options.maxSampleCases ?? 3;
  const maxHidden = options.maxHiddenCases ?? 50;

  const samples = pairTests(row.public_tests, true, maxSample);
  const hidden = [
    ...pairTests(row.private_tests, false, maxHidden),
    ...pairTests(row.generated_tests, false, maxHidden),
  ].slice(0, maxHidden);

  const testCases = [...samples, ...hidden];
  if (testCases.length === 0) return null; // unusable without tests

  const { comparison, floatEpsilon } = inferComparison(description);
  const sourceLabel = SOURCE_LABEL[row.source ?? 0] ?? 'Unknown source';

  return {
    slug: slugify(name),
    title: name,
    statementMd: description,
    difficulty: mapDifficulty(row),
    comparison,
    floatEpsilon,
    attribution: `Imported from the DeepMind code_contests dataset (CC BY 4.0). Original problem: ${sourceLabel}.`,
    sourceUrl: null,
    testCases,
  };
}
