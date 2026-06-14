import { compareOutput } from '@/lib/judge/compare';
import type {
  ComparisonPolicy,
  GradeResult,
  JudgeRunFn,
  JudgeRunStatus,
  TestCaseResult,
  Verdict,
} from '@/lib/judge/types';

export type GradeProblem = {
  language: string;
  source: string;
  timeLimitMs: number;
  memoryLimitMb: number;
  comparison: ComparisonPolicy;
  floatEpsilon?: number | null;
};

export type GradeTestCase = { input: string; expected: string };

// Interpreted languages need more wall-clock headroom so a correct solution is
// not falsely TLE'd. Conservative multipliers.
const LANGUAGE_TIME_FACTOR: Record<string, number> = {
  python: 3,
  python3: 3,
  javascript: 2,
  node: 2,
  ruby: 3,
  java: 2,
};

function runStatusToVerdict(status: JudgeRunStatus): Verdict {
  switch (status) {
    case 'tle':
      return 'tle';
    case 'mle':
      return 'mle';
    case 'runtime_error':
      return 'runtime_error';
    case 'compile_error':
      return 'compile_error';
    case 'error':
      return 'error';
    default:
      return 'accepted';
  }
}

// Runs a submission against every test case and returns a single verdict plus
// per-test results. Verdict = first failing case's status, else accepted.
export async function gradeSubmission(
  problem: GradeProblem,
  testCases: GradeTestCase[],
  run: JudgeRunFn,
): Promise<GradeResult> {
  const timeFactor = LANGUAGE_TIME_FACTOR[problem.language.toLowerCase()] ?? 1;
  const timeLimitMs = Math.round(problem.timeLimitMs * timeFactor);
  const results: TestCaseResult[] = [];

  let verdict: Verdict = 'accepted';
  let failingCase: number | null = null;
  let message: string | null = null;
  let passedCount = 0;
  let maxRuntimeMs = 0;
  let maxMemoryKb: number | null = null;

  for (let index = 0; index < testCases.length; index += 1) {
    const testCase = testCases[index];
    const runResult = await run({
      language: problem.language,
      source: problem.source,
      stdin: testCase.input,
      timeLimitMs,
      memoryLimitMb: problem.memoryLimitMb,
    });

    maxRuntimeMs = Math.max(maxRuntimeMs, runResult.runtimeMs);
    if (runResult.memoryKb !== null) {
      maxMemoryKb = Math.max(maxMemoryKb ?? 0, runResult.memoryKb);
    }

    let caseStatus: Verdict;
    if (runResult.status !== 'ok') {
      caseStatus = runStatusToVerdict(runResult.status);
    } else if (compareOutput(testCase.expected, runResult.stdout, problem.comparison, problem.floatEpsilon ?? undefined)) {
      caseStatus = 'accepted';
    } else {
      caseStatus = 'wrong_answer';
    }

    results.push({ index, status: caseStatus, runtimeMs: runResult.runtimeMs, memoryKb: runResult.memoryKb });

    if (caseStatus === 'accepted') {
      passedCount += 1;
      continue;
    }

    // First failure decides the verdict; compile errors short-circuit immediately.
    verdict = caseStatus;
    failingCase = index;
    message = caseStatus === 'compile_error' && runResult.stderr ? runResult.stderr.slice(0, 2000) : null;
    if (caseStatus === 'compile_error') break;
    break;
  }

  return {
    verdict: testCases.length === 0 ? 'error' : verdict,
    passedCount,
    totalCount: testCases.length,
    runtimeMs: maxRuntimeMs,
    memoryKb: maxMemoryKb,
    failingCase,
    message,
    results,
  };
}
