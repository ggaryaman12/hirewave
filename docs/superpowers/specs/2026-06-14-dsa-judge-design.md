# DSA Judge — Real Code-Execution Problems (LeetCode/HackerRank-style)

Date: 2026-06-14
Status: Approved direction, slicing
Depends on: existing lib/sandbox provider abstraction

## Context

Hirewave today scores AI-collaboration on realistic tasks. This epic adds a
classic DSA practice + assessment surface: a catalog of problems with hidden
test cases, a real multi-language code-execution judge, and verdicts
(Accepted / Wrong Answer / TLE / RE / CE), organized into Striver A2Z and Love
Babbar style topic tracks.

## Content policy (non-negotiable)

We do NOT scrape or rehost LeetCode / GeeksforGeeks / CodeChef / takeuforward
statement text — copyrighted + ToS-protected. The public sheets are curated
**lists** (topic, title, difficulty, source link); that structure is usable as a
roadmap. Therefore:

- Ingest the **sheet structure** (track → topic → problem title, difficulty,
  source URL) as our catalog skeleton.
- Primary problem source: **DeepMind code_contests** (statements + verified
  input/output test cases under **CC BY 4.0**; code Apache-2.0; sub-sources
  Codeforces, Description2Code (MIT), CodeNet (Apache-2.0)). Redistributable
  WITH attribution — gives real problems + real tests immediately. We curate a
  subset and tag it into the sheet tracks. Store attribution per problem.
- Gaps (interview-specific problems not in the dataset): **LLM-generate original
  statement + reference solution + tests**, human-reviewed (Slice 3).
- **Link out** to the original source for reference; never rehost LeetCode/GFG/
  CodeChef statement text.

## Correctness-first judge

Execution engine: **Judge0** (self-hosted), which wraps `isolate` — the sandbox
lineage used by competitive judges. Gives pinned language runtimes, deterministic
CPU-time + wall-time + memory limits, stdin/stdout capture, and exit signals for
RE detection. Our `lib/sandbox` already abstracts providers; the judge is a
parallel `lib/judge` provider so it can be mocked in tests and swapped per env.

Judging correctness rules:
- Compare program stdout to expected output with a normalization policy
  (trailing whitespace per line + trailing newlines trimmed; exact otherwise).
  Optional `comparison: 'exact' | 'whitespace' | 'float'` per problem; float uses
  an epsilon.
- A submission runs against ALL test cases; verdict is the first failing case's
  status, or Accepted if all pass. Per-test results retained.
- Time/memory limits per problem (with language multipliers, e.g. interpreted
  languages get a higher factor) so a correct solution is not wrongly TLE'd.
- Reference solution required per problem; test outputs are produced by running
  the reference solution through the SAME judge (not hand-typed) to guarantee the
  expected output matches the runtime — this is what prevents "wrong judgements".

## Decomposition

- **Slice 1 (this spec): engine + data model + verdicts.** Schema, judge provider
  interface, Judge0 client, a deterministic in-process judge for tests, submission
  flow + verdict computation + per-test results, API. No problem-authoring UI.
- **Slice 2: problem UI** — statement, language picker, code editor, Run (samples)
  vs Submit (all tests), verdict + per-test panel; track/topic browser.
- **Slice 3: catalog** — ingest sheet structure into Tracks/Topics/Problems
  (title, difficulty, source link), then LLM-generate original statements + tests
  with a reference-solution-verified pipeline + human review gate.

---

## Slice 1 design

### Data model

```prisma
model DsaTrack {       // e.g. "Striver A2Z", "Love Babbar 450"
  id        String  @id @default(cuid())
  slug      String  @unique
  title     String
  source    String?         // attribution URL of the sheet
  sortOrder Int     @default(0)
  topics    DsaTopic[]
}

model DsaTopic {       // e.g. "Arrays", "Binary Search", "Graphs"
  id        String  @id @default(cuid())
  trackId   String
  title     String
  sortOrder Int     @default(0)
  track     DsaTrack  @relation(fields: [trackId], references: [id], onDelete: Cascade)
  problems  DsaProblem[]
}

model DsaProblem {
  id            String  @id @default(cuid())
  topicId       String
  slug          String  @unique
  title         String
  difficulty    String           // easy | medium | hard
  statementMd   String           // ORIGINAL statement (ours)
  constraintsMd String?
  sourceUrl     String?          // link out to original for reference
  inputFormat   String?
  outputFormat  String?
  comparison    String  @default("whitespace") // exact | whitespace | float
  floatEpsilon  Float?
  timeLimitMs   Int     @default(2000)
  memoryLimitMb Int     @default(256)
  referenceSolutionJson String?  // {language, source} used to generate outputs
  status        String  @default("draft")       // draft | review | published
  topic         DsaTopic  @relation(fields: [topicId], references: [id], onDelete: Cascade)
  testCases     DsaTestCase[]
  submissions   DsaSubmission[]
}

model DsaTestCase {
  id         String  @id @default(cuid())
  problemId  String
  input      String
  expected   String
  isSample   Boolean @default(false)   // sample = shown + usable by Run
  sortOrder  Int     @default(0)
  problem    DsaProblem @relation(fields: [problemId], references: [id], onDelete: Cascade)
}

model DsaSubmission {
  id            String  @id @default(cuid())
  problemId     String
  sessionId     String?          // optional link to a CandidateSession
  language      String
  source        String
  verdict       String           // accepted | wrong_answer | tle | mle | runtime_error | compile_error | judging | error
  passedCount   Int     @default(0)
  totalCount    Int     @default(0)
  runtimeMs     Int?
  memoryKb      Int?
  failingCase   Int?
  message       String?
  resultsJson   String?          // per-test [{index, status, runtimeMs, memoryKb}]
  createdAt     DateTime @default(now())
  problem       DsaProblem @relation(fields: [problemId], references: [id], onDelete: Cascade)

  @@index([problemId, createdAt])
}
```

### Judge provider (`lib/judge/`)

- `types.ts`: `JudgeLanguage`, `JudgeRunInput {language, source, stdin, timeLimitMs, memoryLimitMb}`,
  `JudgeRunResult {status: 'ok'|'tle'|'mle'|'runtime_error'|'compile_error'|'error', stdout, stderr, exitCode, signal, runtimeMs, memoryKb}`.
- `provider.ts`: `getJudgeProvider()` by `JUDGE_PROVIDER` env → `judge0` | `local`.
- `judge0-provider.ts`: client for a self-hosted Judge0 (`JUDGE0_URL`, `JUDGE0_TOKEN`);
  maps our languages to Judge0 language ids; submits with CPU+wall+memory limits;
  polls/awaits; maps Judge0 status ids to our `JudgeRunResult.status`.
- `local-provider.ts`: deterministic in-process executor for tests/dev — supports
  a tiny safe subset (e.g. echo/identity + a JS `node -e` runner behind an opt-in
  flag) so the submission pipeline is testable WITHOUT external infra. Never used
  for real judging in prod.

### Verdict computation (`lib/judge/grade.ts`)

`gradeSubmission(problem, testCases, runFn)`:
- Run each test case via the provider with the problem's limits + language factor.
- Map run status → per-test status; compare stdout to expected via the problem's
  comparison policy (`compareOutput(expected, actual, policy, epsilon)`).
- Verdict = compile_error if compile failed; else first failing test's status;
  else accepted. Aggregate passedCount/totalCount, max runtime/memory, failingCase.
- Persist `DsaSubmission` + resultsJson.

### Output comparison (`lib/judge/compare.ts`)

- `exact`: byte-equal.
- `whitespace` (default): trim trailing spaces per line + trailing newlines, then
  compare.
- `float`: tokenize, compare numerically within `floatEpsilon`, non-numbers exact.
Pure + unit-tested — this is a top source of wrong verdicts, so it gets dedicated
tests.

### Test-output integrity

A problem cannot be `published` unless every test case's `expected` was produced
by running its `referenceSolution` through the judge (a verify step), guaranteeing
expected outputs match real runtime behavior. Slice 1 ships the verify helper;
Slice 3 uses it in the authoring pipeline.

### API

- `POST /api/dsa/problems/[slug]/run` `{language, source}` → runs SAMPLE cases only,
  returns per-sample results (no persistence or lightweight).
- `POST /api/dsa/problems/[slug]/submit` `{language, source, sessionId?}` → grades
  against ALL test cases, persists `DsaSubmission`, returns verdict + per-test
  (hidden-case inputs/outputs are NOT returned, only pass/fail + index).

### Testing (deterministic, AGENTS.md)

- `compare.ts` unit tests (whitespace/exact/float edge cases).
- `grade.ts` with a stubbed `runFn`: all-pass → accepted; one mismatch →
  wrong_answer + failingCase; a tle status → tle; compile_error short-circuits.
- API submit test using the local provider on a trivial echo problem: AC and WA
  paths; verify hidden expected outputs are not leaked in the response.
- typecheck + build pass.

## Slice 2 (outline)

Problem page: statement (markdown), constraints, samples, language dropdown, code
editor (textarea now; Monaco later), Run (samples) + Submit (verdict + per-test
status list, runtime/memory). Track/topic browser with difficulty + solved state.

## Slice 3 (outline)

Sheet ingestion: parse the Striver A2Z / Love Babbar structure (track → topic →
title, difficulty, source URL) into the catalog as draft problems (links only).
Then an LLM pipeline generates an ORIGINAL statement + reference solution + test
cases per problem; outputs are produced by running the reference solution through
the judge (integrity step); a human review gate publishes. No third-party
statement text is copied.

## Acceptance criteria (Slice 1)

- Schema migrated; problems/test cases/submissions persist.
- Judge provider interface with Judge0 client (real) + local provider (tests).
- Submit grades all test cases and returns a correct verdict with per-test results.
- Output comparison handles exact/whitespace/float correctly (unit-tested).
- Hidden test inputs/expected never leak through the API.
- Published-problem integrity check (expected == reference-solution output) exists.
- typecheck + build pass; Slice 1 tests pass.
```
