import { db } from '@/lib/db';
import { toJson } from '@/lib/json';
import { log, newCorrelationId } from '@/lib/log';
import { compareOutput } from '@/lib/judge/compare';
import { gradeSubmission } from '@/lib/judge/grade';
import { getJudgeProvider } from '@/lib/judge/provider';
import { parseSignature, wrapSource } from '@/lib/judge/harness';
import { parseDesignSpec, wrapDesignSource } from '@/lib/judge/harness/design';
import type { ComparisonPolicy, JudgeRunFn, Verdict } from '@/lib/judge/types';

type WrapInput = { signatureJson: string | null; designSpecJson: string | null };

// Wraps the candidate's code with the right hidden driver before judging:
//   design  (designSpecJson) -> operations driver (class + method calls)
//   function(signatureJson)  -> typed function driver
//   stdin/stdout             -> passes through unchanged
function effectiveSource(problem: WrapInput, language: string, source: string) {
  const design = parseDesignSpec(problem.designSpecJson);
  if (design) return wrapDesignSource(language, design, source);
  const signature = parseSignature(problem.signatureJson);
  if (signature) return wrapSource(language, signature, source);
  return source;
}

// Compiler stderr can include absolute temp paths (local dev judge); show just
// the source filename so errors read cleanly (Judge0 already does this).
function cleanCompilerOutput(stderr: string): string {
  return stderr.replace(/\/\S*?(main\.\w+)/g, '$1');
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

// Prisma unique-constraint violation (e.g. two requests racing on the same
// idempotencyKey). The loser of the create race reads back the winner's row.
function isUniqueViolation(err: unknown): boolean {
  return typeof err === 'object' && err !== null && (err as { code?: string }).code === 'P2002';
}

// Re-shape a stored submission row into the sanitized API result (idempotent
// replays and the live judge path return the same shape).
function formatStoredSubmission(row: {
  id: string;
  verdict: string;
  passedCount: number;
  totalCount: number;
  runtimeMs: number | null;
  memoryKb: number | null;
  failingCase: number | null;
  message: string | null;
  resultsJson: string | null;
}) {
  return {
    submissionId: row.id,
    verdict: row.verdict,
    passedCount: row.passedCount,
    totalCount: row.totalCount,
    runtimeMs: row.runtimeMs,
    memoryKb: row.memoryKb,
    failingCase: row.failingCase,
    message: row.message,
    results: row.resultsJson ? JSON.parse(row.resultsJson) : [],
  };
}

// Submit against ALL test cases. Returns a sanitized result: per-test pass/fail
// and timing only — hidden inputs/expected outputs are never returned.
//
// Phase-0 flow (synchronous, but structured for async):
//   1. Idempotency — a repeated attempt (same key) returns the existing row and
//      never re-judges, protecting the expensive Judge0 call.
//   2. Create the submission up front (status="running") — the judge() seam.
//      Today we grade inline; later this is where we'd enqueue judge(id).
//   3. judge — grade, persist verdict + status="done", update progress.
export async function submitSolution(input: {
  slug: string;
  language: string;
  source: string;
  sessionId?: string;
  userId?: string;
  idempotencyKey?: string;
  run?: JudgeRunFn;
}) {
  const problem = await loadProblem(input.slug);
  if (!problem) return null;

  // (1) Same attempt already seen -> return it, don't re-judge.
  if (input.idempotencyKey) {
    const existing = await db.dsaSubmission.findUnique({
      where: { idempotencyKey: input.idempotencyKey },
    });
    if (existing) return formatStoredSubmission(existing);
  }

  // (2) Create the row first so the lifecycle is durable and a concurrent
  // duplicate collides on the unique key instead of double-judging.
  let submission;
  try {
    submission = await db.dsaSubmission.create({
      data: {
        problemId: problem.id,
        sessionId: input.sessionId,
        userId: input.userId,
        language: input.language,
        source: input.source,
        status: 'running',
        idempotencyKey: input.idempotencyKey ?? null,
      },
    });
  } catch (err) {
    if (input.idempotencyKey && isUniqueViolation(err)) {
      const existing = await db.dsaSubmission.findUnique({
        where: { idempotencyKey: input.idempotencyKey },
      });
      if (existing) return formatStoredSubmission(existing);
    }
    throw err;
  }

  // (3) Judge it (the seam — later this moves behind a queue/worker).
  return judgeSubmission(problem, submission.id, input);
}

// Grades an already-created submission, persists the terminal result, and
// updates progress. Isolated so an async worker can call it directly later.
async function judgeSubmission(
  problem: NonNullable<Awaited<ReturnType<typeof loadProblem>>>,
  submissionId: string,
  input: { language: string; source: string; userId?: string; run?: JudgeRunFn },
) {
  const cid = newCorrelationId();
  const startedAt = Date.now();
  log('judge.start', { cid, submissionId, problemId: problem.id, language: input.language });

  let grade;
  try {
    grade = await gradeSubmission(
      {
        language: input.language,
        source: effectiveSource(problem, input.language, input.source),
        timeLimitMs: problem.timeLimitMs,
        memoryLimitMb: problem.memoryLimitMb,
        comparison: problem.comparison as ComparisonPolicy,
        floatEpsilon: problem.floatEpsilon,
      },
      problem.testCases.map((testCase) => ({ input: testCase.input, expected: testCase.expected })),
      resolveRun(input.run),
    );
  } catch (err) {
    // Infra failure (NOT a verdict) -> mark error and surface upstream.
    await db.dsaSubmission.update({ where: { id: submissionId }, data: { status: 'error' } });
    log('judge.error', {
      cid,
      submissionId,
      latencyMs: Date.now() - startedAt,
      error: err instanceof Error ? err.message : 'unknown',
    });
    throw err;
  }

  const message = grade.message ? cleanCompilerOutput(grade.message) : grade.message;
  await db.dsaSubmission.update({
    where: { id: submissionId },
    data: {
      status: 'done',
      verdict: grade.verdict,
      passedCount: grade.passedCount,
      totalCount: grade.totalCount,
      runtimeMs: grade.runtimeMs,
      memoryKb: grade.memoryKb,
      failingCase: grade.failingCase,
      message,
      resultsJson: toJson(grade.results),
    },
  });

  log('judge.done', {
    cid,
    submissionId,
    verdict: grade.verdict,
    passed: grade.passedCount,
    total: grade.totalCount,
    latencyMs: Date.now() - startedAt,
  });

  // Track per-student progress (solved / attempted). Best-effort: never let a
  // tracking failure break judging. Never downgrade a solved problem.
  if (input.userId) {
    try {
      const accepted = grade.verdict === 'accepted';
      const existing = await db.dsaProblemProgress.findUnique({
        where: { userId_problemId: { userId: input.userId, problemId: problem.id } },
      });
      const solved = accepted || existing?.status === 'solved';
      await db.dsaProblemProgress.upsert({
        where: { userId_problemId: { userId: input.userId, problemId: problem.id } },
        create: {
          userId: input.userId,
          problemId: problem.id,
          attempts: 1,
          status: accepted ? 'solved' : 'attempted',
          solvedAt: accepted ? new Date() : null,
        },
        update: {
          attempts: { increment: 1 },
          status: solved ? 'solved' : 'attempted',
          solvedAt: existing?.solvedAt ?? (accepted ? new Date() : null),
        },
      });
    } catch {
      /* progress tracking is best-effort */
    }
  }

  return {
    submissionId,
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
  const wrapped = effectiveSource(problem, input.language, input.source);
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

    // A compile error is a property of the SOURCE, not of any single test case —
    // surface it once, upfront, and stop (don't repeat it per sample).
    if (runResult.status === 'compile_error') {
      return { sampleCount: samples.length, compileError: cleanCompilerOutput(runResult.stderr).slice(0, 4000), results: [] };
    }

    const passed =
      runResult.status === 'ok' && compareOutput(sample.expected, runResult.stdout, comparison, problem.floatEpsilon ?? undefined);
    const status: Verdict = runResult.status !== 'ok'
      ? (runResult.status === 'tle' ? 'tle' : runResult.status === 'runtime_error' ? 'runtime_error' : 'error')
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

  return { sampleCount: samples.length, compileError: null as string | null, results };
}
