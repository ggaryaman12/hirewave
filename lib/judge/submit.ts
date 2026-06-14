import { db } from '@/lib/db';
import { toJson } from '@/lib/json';
import { compareOutput } from '@/lib/judge/compare';
import { gradeSubmission } from '@/lib/judge/grade';
import { getJudgeProvider } from '@/lib/judge/provider';
import { parseSignature, wrapSource } from '@/lib/judge/harness';
import type { ComparisonPolicy, JudgeRunFn, Verdict } from '@/lib/judge/types';

// Function-mode problems (signatureJson set) wrap the candidate's function with a
// hidden per-language driver before judging. stdin/stdout problems pass through.
function effectiveSource(signatureJson: string | null, language: string, source: string) {
  const signature = parseSignature(signatureJson);
  if (!signature) return source;
  return wrapSource(language, signature, source);
}

function resolveRun(run?: JudgeRunFn): JudgeRunFn {
  if (run) return run;
  const provider = getJudgeProvider();
  return (input) => provider.run(input);
}

async function loadProblem(slug: string) {
  return db.dsaProblem.findUnique({
    where: { slug },
    include: { testCases: { orderBy: { sortOrder: 'asc' } } },
  });
}

// Submit against ALL test cases. Returns a sanitized result: per-test pass/fail
// and timing only — hidden inputs/expected outputs are never returned.
export async function submitSolution(input: {
  slug: string;
  language: string;
  source: string;
  sessionId?: string;
  run?: JudgeRunFn;
}) {
  const problem = await loadProblem(input.slug);
  if (!problem) return null;

  const grade = await gradeSubmission(
    {
      language: input.language,
      source: effectiveSource(problem.signatureJson, input.language, input.source),
      timeLimitMs: problem.timeLimitMs,
      memoryLimitMb: problem.memoryLimitMb,
      comparison: problem.comparison as ComparisonPolicy,
      floatEpsilon: problem.floatEpsilon,
    },
    problem.testCases.map((testCase) => ({ input: testCase.input, expected: testCase.expected })),
    resolveRun(input.run),
  );

  const submission = await db.dsaSubmission.create({
    data: {
      problemId: problem.id,
      sessionId: input.sessionId,
      language: input.language,
      source: input.source,
      verdict: grade.verdict,
      passedCount: grade.passedCount,
      totalCount: grade.totalCount,
      runtimeMs: grade.runtimeMs,
      memoryKb: grade.memoryKb,
      failingCase: grade.failingCase,
      message: grade.message,
      resultsJson: toJson(grade.results),
    },
  });

  return {
    submissionId: submission.id,
    verdict: grade.verdict,
    passedCount: grade.passedCount,
    totalCount: grade.totalCount,
    runtimeMs: grade.runtimeMs,
    memoryKb: grade.memoryKb,
    failingCase: grade.failingCase,
    message: grade.message,
    // Only index + status + timing. No hidden inputs/outputs.
    results: grade.results,
  };
}

// Run against SAMPLE cases only. Samples are public, so inputs/expected/actual
// can be returned for the candidate to see.
export async function runSamples(input: {
  slug: string;
  language: string;
  source: string;
  run?: JudgeRunFn;
}) {
  const problem = await loadProblem(input.slug);
  if (!problem) return null;

  const run = resolveRun(input.run);
  const samples = problem.testCases.filter((testCase) => testCase.isSample);
  const comparison = problem.comparison as ComparisonPolicy;
  const wrapped = effectiveSource(problem.signatureJson, input.language, input.source);
  const results = [];

  for (let index = 0; index < samples.length; index += 1) {
    const sample = samples[index];
    const runResult = await run({
      language: input.language,
      source: wrapped,
      stdin: sample.input,
      timeLimitMs: problem.timeLimitMs,
      memoryLimitMb: problem.memoryLimitMb,
    });
    const passed =
      runResult.status === 'ok' && compareOutput(sample.expected, runResult.stdout, comparison, problem.floatEpsilon ?? undefined);
    const status: Verdict = runResult.status !== 'ok'
      ? (runResult.status === 'tle' ? 'tle' : runResult.status === 'compile_error' ? 'compile_error' : runResult.status === 'runtime_error' ? 'runtime_error' : 'error')
      : passed ? 'accepted' : 'wrong_answer';

    results.push({
      index,
      status,
      input: sample.input,
      expected: sample.expected,
      stdout: runResult.stdout,
      stderr: runResult.stderr.slice(0, 2000),
      runtimeMs: runResult.runtimeMs,
    });
  }

  return { sampleCount: samples.length, results };
}
