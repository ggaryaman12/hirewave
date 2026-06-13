# Hirewave Agent Instructions

These rules apply to automated agents and human contributors working in this repo.

## Test-First Workflow

- For every feature, bug fix, refactor, or behavior change, write or update the relevant test first.
- Prefer the smallest test that proves the intended behavior.
- For product workflows, cover the behavior at the right level:
  - API tests for route handlers, database side effects, telemetry, and report generation.
  - Playwright E2E tests for candidate and hiring-team browser flows.
  - Future skipped tests for planned hardening work that is not implemented yet.
- Do not write production code first and backfill tests afterward unless the user explicitly approves an exception.

## Manual Test Execution Rule

- Do not run API or E2E tests automatically on every prompt.
- Run tests only when the user explicitly asks for tests/checks to run.
- If tests are not run, the final response must say: `not run by request`.
- When reporting skipped test execution, list the exact commands the user can run manually.

## When The User Authorizes Tests

- Run targeted tests first:
  - `npm run test:api` for route handler and DB-side behavior.
  - `npm run test:e2e` for invite-to-report browser behavior.
- Run broader checks only when useful:
  - `npm run typecheck`
  - `npm run lint`
  - `npm run build`
  - `npm run test:all`
- If a test fails, debug the first failing behavior before broad rewrites.

## Current Test Setup

- `npm test` intentionally remains a typecheck alias.
- `npm run test:api` seeds the reused dev SQLite DB and runs API tests.
- `npm run test:e2e` seeds the reused dev SQLite DB and runs Playwright browser tests.
- `npm run test:all` runs typecheck, API tests, and E2E tests.
- Tests reuse the dev DB and intentionally leave candidate/session/report rows inspectable in the dashboard.

## Product Boundaries

- The MVP uses demo auth, SQLite, deterministic or Ollama-backed AI, and a simulated runner.
- Do not claim real sandbox isolation, production RBAC, real AI scoring, SSO, billing, ATS integration, or proctoring until those features exist.
- Keep product routes separate from the motion-heavy landing page components.
- Candidate flows must not require account creation.
- Hiring-team reports must remain evidence-based: every score should cite telemetry, command/test output, AI messages, or final files.
- Scoring uses the fixed versioned `ai-collaboration-v1` 8-dimension rubric: Problem Decomposition, First-Principles Thinking, Creative Problem Solving, Iteration Quality, Debugging with AI, Architecture Decisions, Communication Clarity, and Token Efficiency.
- Treat the product direction as enterprise-first and compliance readiness oriented; do not claim completed enterprise compliance until the relevant controls exist.
- Preserve auditability and strict scoring controls: do not change historical report meaning silently; introduce a new rubric version for scoring-control changes and keep evidence links reviewable.
- Keep test runs deterministic by using `AI_PROVIDER=deterministic` unless the user explicitly asks to test Ollama connectivity or live AI behavior.
