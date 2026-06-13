# Routes And Features

Date: 2026-05-20

Detailed request/response contracts, telemetry side effects, sandbox metadata fields, and manual verification commands are maintained in `docs/07-api-reference.md`.

## Route Map

| Route | Audience | Purpose | Current behavior |
| --- | --- | --- | --- |
| `/` | Public | Marketing landing page | Presents Hirewave positioning and routes visible CTAs into product/demo flows. |
| `/dashboard` | Hiring team | Workspace dashboard | Demo-authenticated dashboard with assessment, session, and report counts. |
| `/dashboard/assessments/new` | Hiring team | Assessment builder | Creates an assessment from the seeded challenge and generates an invite link. |
| `/dashboard/assessments/[assessmentId]` | Hiring team | Assessment detail | Shows assessment metadata, invite URL, candidate sessions, and report links. |
| `/dashboard/reports/[sessionId]` | Hiring team | Evaluation report | Shows recommendation, fixed 8-dimension rubric scores, evidence, AI transcript with token usage, commands/tests, final split diff, important checkpoint timeline, final files, risk flags, and follow-up focus. |
| `/invite/[token]` | Candidate | Public assessment invite | Shows challenge details and starts a candidate session with name/email only. |
| `/session/[sessionToken]` | Candidate | Assessment room | Browser coding room with file tree, editor, candidate-facing split diff, timer, controlled terminal/test runner, AI assistant, telemetry, and submit. |
| `/session/[sessionToken]/complete` | Candidate | Completion page | Confirms submission without exposing hiring-team report routes. |
| `/api/auth/demo` | Hiring team | Demo auth | Sets demo hiring-team cookie and redirects to the requested internal route. |
| `/api/session/[sessionToken]/events` | Candidate session API | Telemetry ingestion | Logs allowed generic events: file opened, candidate note, focus change, and errors. |
| `/api/session/[sessionToken]/files` | Candidate session API | File persistence | Saves normalized relative file snapshots and logs `file_changed` / `file_saved`; rejects closed sessions, absolute paths, traversal paths, and reserved workspace roots. |
| `/api/session/[sessionToken]/commands` | Candidate session API | Command/test runner | Runs commands through the sandbox provider adapter, defaults to the simulated provider, supports MVP terminal commands (`npm test`, `ls`, `ls src`, `cat <path>`, `pwd`), stores command runs/test results, caps command output before DB/event/response persistence, validates persisted workspace paths before provider execution, and logs command/test telemetry with provider run ID, readiness status, capability statuses/gaps, command policy, environment policy, network policy, resource limits, provider policy, mounted workspace manifest and digest, snapshot, duration, timeout, cleanup status, stream-labeled output chunks, output-truncation, invalid-workspace, provider-error, manifest-mismatch, and unconfigured-external metadata; rejects closed sessions. |
| `/api/session/[sessionToken]/ai` | Candidate session API | AI assistant proxy | Stores user/assistant messages, applies low-signal/capability guardrails before provider calls, returns deterministic or Ollama-backed AI response, captures token usage, and logs AI telemetry; rejects closed sessions. |
| `/api/session/[sessionToken]/submit` | Candidate session API | Submission/report generation | Marks session submitted, logs `session_ended`, generates evaluation report, and returns candidate completion and hiring report URLs. |
| `/api/reports/[sessionId]/export` | Hiring team API | Report evidence export | Exports the same workspace-scoped report evidence as Markdown or JSON attachments for reviewer handoff and audit. |

## Feature Inventory

| Feature | Status | Notes |
| --- | --- | --- |
| Demo auth | Implemented | Cookie-based local hiring-team auth through `/api/auth/demo`. |
| Workspace model | Implemented | Users belong to workspaces through `WorkspaceMember`. |
| Assessment model | Implemented | Assessments belong to workspaces and are based on challenges. |
| Challenge templates | Implemented | `ensureChallengeCatalog()` seeds the checkout task plus curated real-project templates for webhook idempotency, permission leaks, inventory races, CSV partial failures, and AI guardrails. All use the fixed `ai-collaboration-v1` rubric. |
| Invite links | Implemented | Uses hashed invite token plus recoverable `publicToken` for MVP demo display. |
| Candidate no-account flow | Implemented | Candidates enter name/email from invite page. |
| Timed assessment room | Implemented | Timer is based on session expiry. |
| Browser editor | Implemented | Textarea-based MVP editor with debounced file saves. |
| File tree | Implemented | Candidate can switch among starter challenge files. |
| Candidate diff review | Implemented | Candidate `Changes` view compares starter code against current edits in a split diff per changed file. |
| Controlled terminal/test runner | Implemented | Candidates can type MVP sandbox commands through the provider adapter; `npm test` runs deterministic checkout checks for the checkout template and generic evidence checks for non-checkout/custom templates, while `ls`, `cat`, and `pwd` inspect the virtual workspace. |
| Sandbox provider adapter | Implemented foundation | `SANDBOX_PROVIDER=simulated` remains the default. `SANDBOX_PROVIDER=local-dev` is opt-in for local development, gated by `SANDBOX_LOCAL_DEV_ENABLED=true`, command allowlisting, timeout handling, output caps, stream-labeled output chunks, provider run IDs, required `SandboxRunCommandInput.workspaceManifest` metadata with SHA-256 digests from `createWorkspaceManifest`, fail-closed manifest validation, snapshot path validation, snapshot size/count caps, resource-limit metadata, temp workspace cleanup with explicit cleanup status evidence, readiness/capability metadata, environment policy metadata, network policy metadata, hidden no-network runner prep for the seeded checkout challenge, parsed test results, policy metadata, snapshot metadata, and runner-owned `FileSnapshot` persistence for accepted provider snapshots. Local-dev exposes only `NODE_ENV` and `PATH` to child commands and fails closed in production with `local_dev_production_blocked`. `SANDBOX_PROVIDER=external` and direct `e2b` / `daytona` / `codesandbox` aliases currently fail safely with `adapter_unconfigured`, `external_provider_unconfigured`, and `not_executed` metadata until a concrete adapter is implemented. Simulated reports `demo_only` readiness and `none` isolation; local-dev reports `local_dev_only`, `local_process`, `host_temp_directory`, host-inherited network, and network not blocked by default, so both are not production-ready isolation. |
| AI assistant | Implemented | Deterministic provider by default; optional Ollama provider uses `POST {OLLAMA_BASE_URL}/api/generate` with `{ model, system, prompt, stream: false }`; AI can suggest supported terminal commands but must not claim it ran commands or edited files. Low-signal and direct "run it for me" requests return local guardrails. |
| AI token usage | Implemented | Assistant turns store provider-measured Ollama token counts when available and estimated counts otherwise; candidate chat and hiring reports show total/input/output usage. |
| Telemetry | Implemented | Append-only `SessionEvent` rows capture session, file, command/test, AI, focus, note, and error events. |
| Submission | Implemented | Session submission generates report and closes write APIs. |
| Evaluation report | Implemented | Deterministic evidence-based report with fixed 8-dimension `ai-collaboration-v1` scoring, evidence, strengths, concerns, risk flags, follow-up questions, token usage, final split diff, important checkpoint timeline, non-checkout wording for custom/catalog templates, and `ai_overdelegation_risk` when broad AI takeover prompts appear without enough independent implementation or verification evidence. |
| Report exports | Implemented | Hiring-team report pages expose Markdown and JSON reviewer exports through `/api/reports/[sessionId]/export`, using the same evidence bundle as the browser report. |
| Diff evidence | Implemented | Final diffs are derived from starter `ChallengeFile` content and latest `FileSnapshot` rows; checkpoint timeline is derived from important `SessionEvent` rows only. |
| Custom task draft gate | Implemented foundation | Interviewers can generate a deterministic draft template. Drafts are blocked from assessment creation until validation checks workspace paths, brief/test presence, secret-like content, file count/size, allowed commands, and evidence checklist, then approval converts `Draft - ...` difficulty into `Custom - ...`. |
| API tests | Added | Manual `npm run test:api`; reuses dev SQLite DB. |
| E2E tests | Added | Manual `npm run test:e2e`; covers invite-to-report workflow. |
| Future hardening tests | Added | Skipped specs document upcoming production-grade expectations. |

## Current Data Flow

1. Hiring user visits `/dashboard`; demo auth creates/loads the local workspace.
2. Hiring user creates an assessment from the seeded challenge.
3. The app creates an `InviteLink` with a hashed token and visible public token.
4. Candidate opens `/invite/[token]`, enters name/email, and starts a session.
5. Starter `ChallengeFile` rows are copied into `FileSnapshot` rows for the session.
6. Candidate edits files, runs tests, asks AI, and submits.
7. Session APIs append telemetry and artifacts to SQLite. Candidate file saves and sandbox provider snapshots share the workspace path boundary; sandbox provider runs record the mounted workspace manifest plus SHA-256 digest and also persist changed/new provider snapshots as runner-owned `FileSnapshot` rows after rejecting unsafe paths and oversized or over-count snapshots. Reloaded session state reconstructs terminal stream chunks and sandbox metadata from persisted command events.
8. Submit generates `EvaluationReport` and `ScoreDimension` rows from telemetry, command/test data, sandbox provider metadata including readiness, capability gaps, cleanup status, environment policy, network policy, and resource limits, AI messages, token usage, final file snapshots, final diff evidence, and important checkpoint summaries.
9. Candidate sees `/session/[sessionToken]/complete`; hiring team reviews `/dashboard/reports/[sessionId]`.

Reports are positioned for enterprise-first review and compliance readiness: each score should remain auditable against raw evidence, strict scoring controls should preserve the fixed rubric basis, and rubric changes should be versioned instead of silently changing historical report meaning.

## Current Limitations

- Auth is demo-cookie based, not production auth.
- Tests and local runtime reuse the dev SQLite DB.
- The default sandbox provider is simulated and does not execute arbitrary untrusted shell commands.
- The local-dev provider is for developer-only experiments behind explicit environment config, not for candidate-facing production use.
- The AI provider can call the Yelo-hosted Ollama-compatible endpoint when `AI_PROVIDER=ollama`; deterministic remains the stable test/default provider.
- Provider token counts depend on the Ollama-compatible response fields; deterministic, guardrail, and fallback responses use estimated counts.
- There is no production RBAC beyond demo workspace scoping.
- There is no production-ready sandbox isolation, enforced candidate network policy, or per-session credential boundary.
- There is no rate limiting, audit log UI, retention policy, SSO, billing, ATS integration, or proctoring.
- The editor is a textarea MVP, not Monaco or a full IDE.
- Terminal command support is intentionally allowlisted until a real sandbox provider is added; the external provider path is configuration-only and fails closed today.
- Custom task approval is currently represented by challenge difficulty prefixes rather than a dedicated versioned lifecycle table. Enterprise challenge-library versioning remains future work.
- `npm audit --audit-level=moderate` reports dependency vulnerabilities that need a separate dependency-hardening milestone.

## Manual Test Commands

```bash
npx playwright install chromium
npm run test:api
npm run test:e2e
npm run test:all
```

Agents must not run these automatically. Run them only when the user explicitly asks.
