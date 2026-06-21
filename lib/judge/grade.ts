import { compareOutput } from '@/lib/judge/compare';
import { JudgeRunStatus, Verdict } from '@/lib/constants';
import { getLanguageDef } from '@/lib/languages';
import type { ComparisonPolicy, GradeResult, JudgeRunFn, TestCaseResult } from '@/lib/judge/types';

export type GradeProblem = {
  language: string;
  source: string;
  timeLimitMs: number;
  memoryLimitMb: number;
  comparison: ComparisonPolicy;
  floatEpsilon?: number | null;
};

export type GradeTestCase = { input: string; expected: string };

function runStatusToVerdict(status: JudgeRunStatus): Verdict {
  switch (status) {
    case JudgeRunStatus.TLE:
      return Verdict.TLE;
    case JudgeRunStatus.MLE:
      return Verdict.MLE;
    case JudgeRunStatus.RUNTIME_ERROR:
      return Verdict.RUNTIME_ERROR;
    case JudgeRunStatus.COMPILE_ERROR:
      return Verdict.COMPILE_ERROR;
    case JudgeRunStatus.ERROR:
      return Verdict.ERROR;
    default:
      return Verdict.ACCEPTED;
  }
}

// Runs a submission against every test case and returns a single verdict plus
// per-test results. Verdict = first failing case's status, else accepted.
export async function gradeSubmission(
  problem: GradeProblem,
  testCases: GradeTestCase[],
  run: JudgeRunFn,
): Promise<GradeResult> {
  // Slower runtimes (interpreted/JVM) get wall-clock headroom so a correct
  // solution isn't falsely TLE'd. Factor comes from the language registry.
  const timeFactor = getLanguageDef(problem.language)?.timeFactor ?? 1;
  const timeLimitMs = Math.round(problem.timeLimitMs * timeFactor);
  const results: TestCaseResult[] = [];

  let verdict: Verdict = Verdict.ACCEPTED;
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
    if (runResult.status !== JudgeRunStatus.OK) {
      caseStatus = runStatusToVerdict(runResult.status);
    } else if (compareOutput(testCase.expected, runResult.stdout, problem.comparison, problem.floatEpsilon ?? undefined)) {
      caseStatus = Verdict.ACCEPTED;
    } else {
      caseStatus = Verdict.WRONG_ANSWER;
    }

    results.push({ index, status: caseStatus, runtimeMs: runResult.runtimeMs, memoryKb: runResult.memoryKb });

    if (caseStatus === Verdict.ACCEPTED) {
      passedCount += 1;
      continue;
    }

    // First failure decides the verdict; compile errors short-circuit immediately.
    verdict = caseStatus;
    failingCase = index;
    message = caseStatus === Verdict.COMPILE_ERROR && runResult.stderr ? runResult.stderr.slice(0, 2000) : null;
    if (caseStatus === Verdict.COMPILE_ERROR) break;
    break;
  }

  return {
    verdict: testCases.length === 0 ? Verdict.ERROR : verdict,
    passedCount,
    totalCount: testCases.length,
    runtimeMs: maxRuntimeMs,
    memoryKb: maxMemoryKb,
    failingCase,
    message,
    results,
  };
}
