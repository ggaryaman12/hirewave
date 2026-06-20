# DSA Workspace — Production LeetCode-style Judge

Date: 2026-06-20
Branch: `feat/dsa-leetcode-workspace`

## Goal

Turn the existing DSA practice area into a real, production-grade coding-judge
workspace comparable to LeetCode / NeetCode / HackerRank: a real problem bank
with real (large, correct) test suites, a real in-browser code editor with
correctly-configured per-language boilerplate, and working "Run" and "Submit"
backed by a real execution engine.

## Decisions (locked)

- **Problem model:** function-mode (LeetCode-style). The candidate writes only a
  function body; a hidden per-language driver parses typed stdin, calls the
  function, prints the canonical result. Reuses the existing
  `lib/judge/harness` (cpp/java/js) and `signatureJson`/`getAllBoilerplates`.
- **Languages:** C++, Java, JavaScript (Python removed from UI — no harness).
- **Editor:** Monaco (`@monaco-editor/react`).
- **Execution engine (run/submit):** public Judge0 CE (`https://ce.judge0.com`)
  with base64 encoding + retry/backoff (CE is shared + rate-limited).
- **Test data — two sources:**
  1. *In-repo, works now:* original-statement problems with a JS reference
     solution + input generators. A local generator script executes the
     reference over sample/random/edge inputs and emits test cases in the
     harness IO format. Legally clean, large suites (40–60 cases), fully
     reproducible in-sandbox.
  2. *Bulk, runs on your machine:* CC-BY dataset import pipeline
     (DeepMind `code_contests`). `download.py` (HuggingFace, run locally —
     **the build sandbox cannot reach huggingface.co**) → `transform.ts`
     (pure, unit-tested) → `load.ts` (idempotent upsert, `status:'review'`).
     Every imported problem stores `attribution` + `sourceUrl` (CC BY requires
     attribution). Imported problems are stdin/stdout (no signature).

## Architecture

### Data model (Prisma — minimal change)

Reuse `DsaTrack/DsaTopic/DsaProblem/DsaTestCase/DsaSubmission`. No new columns
required: boilerplate is derived from `signatureJson` at request time via
`getAllBoilerplates`, so it is never stored. `attribution`/`sourceUrl` already
exist for the import path.

### Execution engine

- `lib/judge/local-provider.ts` — upgrade to a real multi-language provider for
  **dev/test/verification only** (compiles cpp via `g++`, java via `javac`,
  runs js via `node`, each in a temp dir with a wall-clock timeout). Not used in
  production server requests. Enables end-to-end harness verification in-sandbox
  without Judge0.
- `lib/judge/judge0-provider.ts` — harden: `base64_encoded=true`, retry with
  exponential backoff on HTTP 429/5xx and Judge0 "in queue/processing" states,
  bounded attempts, clear error surfacing.
- `lib/judge/provider.ts`, `grade.ts`, `compare.ts`, `submit.ts`, `harness/*` —
  unchanged in contract. `submit` already wraps function-mode sources via
  `effectiveSource`.

### Test generation (in-repo bank)

- `scripts/dsa/problems/*.mjs` — one module per problem: `{ meta, signature,
  reference(args)->result, generators[] }`. `reference` is plain JS.
- `scripts/dsa/generate.mjs` — for each problem: seeded-RNG generators produce
  inputs; `reference` computes outputs; both serialized to the harness IO
  convention (`signature.ts` doc). Emits `scripts/dsa/generated/<slug>.json`
  with sample + hidden cases. Hidden cases capped (~50) to respect CE limits.
- `prisma/seed-dsa.js` — extended to seed these function-mode problems
  (`signatureJson` set, generated test cases, `status:'published'`). Existing
  stdin/stdout originals remain.

### API + UI

- `app/dsa/[slug]/page.tsx` — payload gains `functionName`, `signature` (parsed),
  `boilerplates: {cpp,java,javascript}`, `languages`. Still sanitized: only
  sample cases reach the client.
- `components/dsa/problem-workspace.tsx` — replace `<textarea>` with Monaco;
  per-language source state seeded from boilerplate; switching language swaps to
  that language's buffer (preserving edits); drop Python. Run/Submit endpoints
  unchanged.
- `app/api/dsa/problems/[slug]/run|submit` — unchanged contract; validate
  language ∈ {cpp,java,javascript}.

### Import pipeline (bulk, later)

`scripts/import-dataset/{download.py, transform.ts, load.ts, README.md}`.
`transform.ts` is pure and unit-tested (statement sanitize to supported markdown
subset, IO → test cases, comparison policy inference, attribution string).

## Error handling

- Judge0 unreachable / rate-limited → retry/backoff, then a clear `error`
  verdict with a human message (UI already renders `message`).
- Generator: a problem whose reference throws or whose generated case fails a
  self-check aborts the build (bad tests must never reach the DB).
- Import: malformed rows skipped with a logged reason; never partial-write a
  problem.

## Testing / verification

- Unit (Playwright, existing runner): `compare`, `grade`, `submit` (present);
  add `harness` wrap-output assertions, `generate` serialization, `transform`.
- **Solvability gate:** a script runs every seeded problem's reference solution
  through the multi-language local provider against its full generated suite and
  asserts `accepted`. Proves statements, signatures, generators, harness, and
  expected outputs are mutually consistent for all 3 languages.
- Manual: `npm run db:seed`, `next dev`, open `/dsa`, solve a problem, Run +
  Submit (CE smoke when network permits).

## Out of scope

Contests, leaderboards, DSA auth/accounts, Python, custom-input Run box
(may follow), self-hosted Judge0 (documented, not default).

## Constraints / risks

- Build sandbox network blocks huggingface.co → bulk import is documented +
  runnable by the user, not executed here.
- Public CE has no SLA; backoff mitigates but heavy concurrent load needs
  self-hosted Judge0 (compose file already present).
