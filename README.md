# Hirewave

AI-native technical assessment platform for evaluating how software-engineering candidates work with AI on realistic engineering tasks, not algorithm puzzles alone.

The repo now contains:

- Marketing landing page.
- Demo hiring dashboard.
- Assessment builder.
- Seeded challenge catalog with checkout, webhook, permission, inventory, CSV import, and AI guardrail templates.
- Controlled custom task draft builder for interviewer-defined task shape.
- Public candidate invite flow with no candidate account.
- Timed browser assessment room with file tree, editor, controlled terminal/test runner, and AI assistant.
- Append-only telemetry capture for files, commands/tests, AI messages, AI token usage, focus changes, start, and submit.
- Enterprise-first, evidence-based evaluation report page with the fixed 8-dimension `ai-collaboration-v1` rubric.
- API and Playwright E2E test files that are run manually on request.

## Stack

- Next.js 14 App Router
- TypeScript
- Tailwind CSS
- Prisma + SQLite for local MVP persistence
- Deterministic AI fallback, optional Yelo-hosted Ollama provider, and sandbox provider adapter with simulated default, opt-in local-dev execution, and safe external-provider placeholders

## Setup

```bash
npm install
cp .env.example .env
npx prisma generate
npx prisma migrate diff --from-empty --to-schema-datamodel prisma/schema.prisma --script | sqlite3 prisma/dev.db
npm run db:seed
npm run dev
```

Open:

- Landing: http://localhost:3000
- Dashboard: http://localhost:3000/dashboard
- Demo candidate invite: http://localhost:3000/invite/demo-invite

If you run on port `3737`, use:

```bash
PORT=3737 npm run dev
```

Then open:

- Dashboard: http://localhost:3737/dashboard
- Demo invite: http://localhost:3737/invite/demo-invite

## Verification

```bash
npm run lint
npm run typecheck
npm run test
npm run build
```

## Manual Test Suites

Install the browser once before running E2E tests:

```bash
npx playwright install chromium
```

Run test suites only when intentionally requested:

```bash
npm run test:api
npm run test:e2e
npm run test:all
```

Notes:

- `npm run test` currently aliases the TypeScript check until a dedicated test framework is added.
- `npm run test:api` seeds the reused dev SQLite DB, starts the app through Playwright, and verifies session API behavior.
- `npm run test:e2e` seeds the reused dev SQLite DB, starts the app through Playwright, and verifies invite-to-report browser behavior.
- `npm run test:all` runs typecheck, API tests, and E2E tests.
- Test suites intentionally leave candidate/session/report rows in the dev DB so evidence can be inspected in the dashboard.
- `prisma db push` failed in this local environment with a blank Prisma schema-engine error, so setup uses `prisma migrate diff | sqlite3` to create the SQLite schema. Runtime and seed still use Prisma Client.
- `npm audit --audit-level=moderate` currently reports dependency vulnerabilities in Next.js, PostCSS, Glob, and Prisma's `effect` chain. Treat dependency upgrades as a separate hardening milestone.
- Candidate file saves and sandbox evidence snapshots use the same workspace path boundary: relative file paths are normalized, while absolute paths, traversal paths, and reserved roots such as `.git`, `.hirewave`, and `node_modules` are rejected or skipped before they can enter reports or local-dev execution.
- The default sandbox provider is simulated and does not execute arbitrary untrusted shell commands. The controlled terminal currently supports `npm test`, `ls`, `ls src`, `cat <path>`, and `pwd`. Checkout templates use checkout-specific simulated checks; non-checkout/custom templates use generic evidence checks against the task brief and `src/solution-plan.ts`.
- Sandbox provider selection is behind `SANDBOX_PROVIDER`. Use `SANDBOX_PROVIDER=simulated` for deterministic demos. `SANDBOX_PROVIDER=local-dev` is available only for local development and returns a disabled result unless `SANDBOX_LOCAL_DEV_ENABLED=true`; allowed commands default to `npm test` and can be set with `SANDBOX_LOCAL_ALLOWED_COMMANDS`. `SANDBOX_PROVIDER=external` plus `SANDBOX_EXTERNAL_PROVIDER_ID=e2b|daytona|codesandbox` reserves the production-provider configuration path but returns `skippedReason=external_provider_unconfigured` until a real adapter is implemented; direct aliases `SANDBOX_PROVIDER=e2b`, `daytona`, or `codesandbox` behave the same. For the seeded checkout challenge, local-dev prepares a hidden no-network runner when no `package.json` exists, then parses test results back into the same evidence path. Changed provider snapshots are persisted as runner-owned file evidence after path normalization; unsafe, oversized, or over-count snapshots are skipped with explicit metadata through `SANDBOX_SNAPSHOT_CONTENT_LIMIT` and `SANDBOX_SNAPSHOT_FILE_LIMIT`, command output is capped by `SANDBOX_COMMAND_OUTPUT_LIMIT` before DB/event/response persistence, command output chunks are labeled as `system`, `stdout`, or `stderr` in telemetry/report metadata, and every run records the mounted workspace manifest with file count, total bytes, paths, languages, content lengths, per-file SHA-256 hashes, and an aggregate workspace digest. Providers validate the required manifest before execution and fail closed with `skippedReason=workspace_manifest_mismatch` if the digest no longer matches the file payload. Each provider result also includes a `sandboxRunId`, readiness status, capability statuses/gaps, cleanup status, environment policy, network policy, and resource limits so command telemetry and reports can trace evidence back to a concrete provider attempt, show whether the provider is demo-only, local-only, adapter-unconfigured, or production-ready, show whether cleanup was deleted, retained, failed, provider-managed, or not applicable, prove which environment keys were exposed and which network hosts were allowed, and record timeout/output/snapshot caps. Local-dev only passes `NODE_ENV` and `PATH` into child commands and does not expose app/database secrets. Command policy is reported by each provider: simulated uses a fixed MVP allowlist, local-dev uses exact commands from `SANDBOX_LOCAL_ALLOWED_COMMANDS`, and unconfigured external providers report `not_executed` with no isolation claim. Blocked commands close with `skippedReason=command_not_allowed`. If an unsafe historical workspace file is detected before execution, the route closes the command with `skippedReason=invalid_workspace_file_path`; if provider setup or execution throws, it closes the command with `skippedReason=provider_error`. Reports include command-policy, readiness, capability-gap, invalid-workspace, provider-error, unconfigured-external, output-stream, output-chunk, provider-run-id, mounted-workspace, workspace-digest, manifest-mismatch, cleanup-status, cleanup-failure, retained-workspace, environment-policy, exposed-env-key, secret-exposure, network-policy, unrestricted-network, and resource-limit counts plus sandbox risk flags. Provider reports also include execution mode, isolation level, network access, filesystem persistence, and cleanup policy. Simulated `none` isolation and local-dev `host_temp_directory` isolation are flagged as not production-isolated, and any non-`production_ready` provider evidence is flagged as not production-ready until a real provider exists.
- The AI provider is deterministic by default. Set `AI_PROVIDER=ollama`, `OLLAMA_BASE_URL=http://yeloai.yelo.solutions`, `OLLAMA_MODEL=minimax-m2.5:cloud`, and `AI_TIMEOUT_MS=30000` to use the Yelo-hosted Ollama-compatible endpoint. Restart the dev server after changing AI environment variables.
- Reports must remain audit-ready for enterprise-first review and compliance readiness: every score should cite telemetry, command/test output, AI messages, token usage, or final files, strict scoring controls should preserve the fixed `ai-collaboration-v1` basis, and rubric changes should create a new version rather than rewriting it.

## Key routes

- `/dashboard` - hiring dashboard
- `/dashboard/assessments/new` - create assessment
- `/dashboard/assessments/[assessmentId]` - assessment detail and candidate sessions
- `/invite/[token]` - public candidate start page
- `/session/[sessionToken]` - candidate assessment room
- `/session/[sessionToken]/complete` - public candidate completion page
- `/dashboard/reports/[sessionId]` - report viewer

## Docs

- `docs/00-current-repo-audit.md`
- `docs/01-market-research.md`
- `docs/02-product-requirements.md`
- `docs/03-technical-architecture.md`
- `docs/04-implementation-plan.md`
- `docs/05-routes-and-features.md`
- `docs/06-enterprise-ai-assessment-strategy.md`
- `docs/07-api-reference.md`
- `AGENTS.md`

## Production gaps

- Replace demo auth with real workspace auth.
- Move SQLite to Postgres.
- Replace the local-dev bridge with E2B, Daytona, CodeSandbox SDK, Docker-for-dev, or microVM-backed production sandbox execution.
- Add a real AI provider and report-generation queue.
- Add rate limits, audit logs, data retention, workspace RBAC hardening, and other compliance readiness controls.
- Add Playwright/API tests for the full invite-to-report flow.
