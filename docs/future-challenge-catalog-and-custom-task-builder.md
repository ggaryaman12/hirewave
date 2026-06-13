# Future Challenge Catalog And Custom Task Builder

Status: Merged into `docs/04-implementation-plan.md` as the canonical phased implementation plan.

Source date: 2026-05-19

Current canonical plan:

- See `docs/04-implementation-plan.md`, especially:
  - `Milestone 6 - Submission and report`
  - `Milestone 7 - Real sandbox integration`
  - `Milestone 8 - Complex challenge catalog and custom task builder`
  - `Unified phased build order`

This file remains as source notes and detailed template inventory. New implementation planning should update `docs/04-implementation-plan.md` first so roadmap, reporting, sandbox, catalog, and custom-builder work stay in one place.

This document captures the next challenge direction for Hirewave after the current seeded task, `Debug the Broken Checkout Flow`.

The goal is to make Hirewave feel like realistic engineering work, not only a small cart exercise and not only DSA puzzles. These tasks should test how a candidate reads an existing system, uses AI, runs evidence, debugs failures, and explains tradeoffs.

## Implemented slice

Implemented on 2026-05-19:

- `lib/challenge-catalog.ts` defines the seeded catalog and the controlled custom draft builder.
- `/dashboard/assessments/new` now shows curated templates and a custom task draft form.
- The catalog currently seeds checkout, webhook idempotency, multi-tenant permission leak, inventory reservation race, CSV partial failure, and AI assistant guardrail templates.
- Custom drafts create a deterministic `Challenge` with starter files, a candidate brief, solution-plan placeholders, and generic test scaffolding.
- The simulated and local-dev runners use checkout-specific checks for checkout files and generic evidence checks for non-checkout/custom templates.
- Deterministic AI guidance now avoids checkout-only hints for non-checkout templates.
- Reports avoid checkout-specific summary and interview language for non-checkout/custom templates.

Still future scope:

- Workspace-owned private challenge libraries.
- Human approval workflow before publishing a custom draft.
- Full hidden-test authoring and validation UI.
- Real sandbox-backed validation for generated tasks.
- AI-assisted generation beyond the current deterministic draft builder.

## Product stance

Hirewave should expand in this order:

1. Keep the current checkout challenge as the first simple seeded template.
2. Add a small catalog of more complex, curated real-project tasks.
3. Later add an interviewer custom-task builder that can generate a controlled task draft from interviewer inputs.
4. Keep the fixed `ai-collaboration-v1` rubric for v1 reports unless we explicitly version a new rubric.

Custom task generation is different from custom rubric generation. The interviewer can define the task type and domain, but the scoring controls should stay versioned and reviewable.

## What makes a good Hirewave task

A good task should have:

- A business scenario that sounds like real product work.
- Existing code with enough context to inspect, not a blank file.
- At least one failing behavior that must be proven with tests or command output.
- More than one possible path, so the report can judge process and reasoning.
- Clear evidence hooks: files touched, terminal commands, AI prompts, test results, final diff, and explanation.
- Hidden and public checks that validate behavior without forcing one exact implementation.
- A bounded workspace that can run deterministically in the sandbox provider.

A weak task is:

- A puzzle with no product context.
- A single-line bug with no need for debugging.
- A task where the AI can paste a full answer with no verification.
- A broad take-home that takes multiple days and cannot be scored consistently.
- A task that needs production secrets, external paid APIs, or unsafe network access.

## Complexity levels

| Level | Candidate time | Shape | Example signal |
| --- | ---: | --- | --- |
| Level 1 | 30 to 45 minutes | Narrow bug fix in 2 to 4 files | Can isolate a bug and verify it |
| Level 2 | 60 to 90 minutes | Cross-module debugging or small feature | Can reason across frontend, backend, and tests |
| Level 3 | 2 to 4 hours | Real-project feature with migration or integration boundary | Can design, implement, test, and explain tradeoffs |
| Level 4 | Half-day to 1 day | Take-home style project slice | Later scope only, needs stronger sandbox and review controls |

For the current MVP, Level 1 and Level 2 are the best next templates. Level 3 should wait until the sandbox and authoring flow are stronger.

## Recommended next curated templates

These are the best next samples because they are more complex than the cart task but still bounded enough for the current product model.

### 1. Webhook Idempotency And Order State

Role fit: Backend engineer, platform engineer, payments engineer

Difficulty: Level 2

Scenario:

A payment gateway sends duplicate and out-of-order webhook events. Some orders become confirmed twice, some refunds are ignored, and the audit log is inconsistent.

Starter workspace:

- `src/webhooks/payment.ts`
- `src/orders/state-machine.ts`
- `src/orders/store.ts`
- `src/audit/events.ts`
- `tests/payment-webhook.test.ts`

Candidate work:

- Add webhook idempotency using event IDs or a stable provider key.
- Make order state transitions explicit and safe.
- Ignore stale events without hiding them from audit logs.
- Add tests for duplicate, out-of-order, refund, and failed-payment events.

Evidence signals:

- Does the candidate inspect event order before editing?
- Do they protect the state machine instead of only patching one branch?
- Do they keep auditability for ignored or stale events?
- Do tests prove duplicate webhooks do not double-confirm or double-refund?

Hidden checks:

- Duplicate `payment_succeeded` events.
- `refund_succeeded` before `payment_succeeded`.
- Unknown event type must be logged but not crash the worker.

### 2. Multi-Tenant Permission Leak

Role fit: Full-stack engineer, SaaS engineer, security-minded backend engineer

Difficulty: Level 2

Scenario:

A workspace manager can open reports from another workspace by changing an ID in the URL. The UI hides those reports, but the API query does not scope by workspace.

Starter workspace:

- `src/api/reports/[id].ts`
- `src/auth/permissions.ts`
- `src/reports/repository.ts`
- `src/dashboard/report-page.tsx`
- `tests/report-access.test.ts`

Candidate work:

- Trace the route, permission helper, and repository query.
- Add workspace scoping at the server boundary.
- Return the correct not-found or forbidden response.
- Add regression tests for same-workspace and cross-workspace access.

Evidence signals:

- Does the candidate find the first unsafe boundary?
- Do they fix the API instead of relying on frontend hiding?
- Do they avoid leaking whether another workspace report exists?
- Do they explain the difference between UI filtering and authorization?

Hidden checks:

- Cross-workspace report ID.
- Same user with two workspaces.
- Report list endpoint and report detail endpoint must agree.

### 3. Inventory Reservation Race Condition

Role fit: Backend engineer, commerce engineer, senior full-stack engineer

Difficulty: Level 2 to Level 3

Scenario:

Two customers can buy the last unit of stock at the same time. The current code checks availability before payment, but the reservation is not atomic.

Starter workspace:

- `src/inventory/reservations.ts`
- `src/checkout/checkout.ts`
- `src/db/transactions.ts`
- `tests/inventory-race.test.ts`

Candidate work:

- Make reservation creation atomic.
- Prevent oversell under concurrent checkout attempts.
- Release or expire reservations when payment fails.
- Add tests that simulate concurrent requests.

Evidence signals:

- Does the candidate understand read-check-write races?
- Do they choose a transaction or compare-and-update pattern?
- Do they preserve the happy path while hardening failure paths?
- Do they add a deterministic test instead of only describing the race?

Hidden checks:

- Two simultaneous reservations for one remaining item.
- Payment failure after reservation.
- Reservation retry after previous failure.

### 4. CSV Import With Partial Failure Report

Role fit: Product engineer, backend engineer, data-heavy SaaS engineer

Difficulty: Level 2

Scenario:

A bulk candidate import fails the entire file when one row has an invalid email. Hiring teams need valid rows imported and invalid rows returned in a clear error report.

Starter workspace:

- `src/imports/candidate-csv.ts`
- `src/imports/validators.ts`
- `src/candidates/store.ts`
- `src/ui/import-summary.tsx`
- `tests/candidate-import.test.ts`

Candidate work:

- Parse rows with row numbers.
- Validate required fields and email format.
- Import valid rows.
- Return rejected rows with specific reasons.
- Update summary UI to show created, skipped, and failed counts.

Evidence signals:

- Does the candidate preserve valid data while reporting invalid data?
- Do they avoid silent data loss?
- Do they add product-friendly error messages?
- Do they consider duplicate emails and idempotent re-imports?

Hidden checks:

- Blank required fields.
- Duplicate rows in the same file.
- Existing candidate email in the workspace.
- Malformed quoted CSV field.

### 5. Background Job Retry And Dead Letter Handling

Role fit: Backend engineer, platform engineer, reliability engineer

Difficulty: Level 2 to Level 3

Scenario:

Email notifications sometimes fail. The worker retries too aggressively, floods the provider, and marks some failed jobs as successful.

Starter workspace:

- `src/jobs/queue.ts`
- `src/jobs/email-worker.ts`
- `src/jobs/retry-policy.ts`
- `src/notifications/email-provider.ts`
- `tests/email-worker.test.ts`

Candidate work:

- Add retry limits and backoff.
- Separate temporary provider failures from permanent validation failures.
- Move exhausted jobs to a dead-letter state.
- Keep enough logs for report and operations review.

Evidence signals:

- Does the candidate classify failure types?
- Do they stop infinite retry loops?
- Do they make final states auditable?
- Do tests prove temporary and permanent failures behave differently?

Hidden checks:

- Provider timeout.
- Invalid email address.
- Third retry succeeds.
- Max retry exhausted.

### 6. Search Pagination Drift

Role fit: Full-stack engineer, product engineer

Difficulty: Level 2

Scenario:

The hiring dashboard search page shows duplicate or missing candidates when filters change during pagination. Sorting by created time alone is unstable.

Starter workspace:

- `src/api/candidates/search.ts`
- `src/candidates/query.ts`
- `src/ui/candidate-search.tsx`
- `tests/candidate-search.test.ts`

Candidate work:

- Make pagination stable with a deterministic tie-breaker.
- Reset cursor/page state when filters change.
- Keep search results scoped to the current workspace.
- Add tests for duplicate timestamps and changing filters.

Evidence signals:

- Does the candidate reason about ordering, cursors, and UI state together?
- Do they avoid offset pagination if cursor pagination is already implied?
- Do they add tests for duplicate timestamps?
- Do they preserve accessibility and loading states in the UI?

Hidden checks:

- Multiple rows with same `createdAt`.
- Filter changes between page 1 and page 2.
- Workspace filter must stay applied.

### 7. Realtime Candidate Presence Bug

Role fit: Full-stack engineer, realtime systems engineer

Difficulty: Level 2 to Level 3

Scenario:

The interviewer dashboard shows candidates as online after they closed the browser. Heartbeats are recorded, but stale sessions do not expire cleanly.

Starter workspace:

- `src/realtime/presence.ts`
- `src/api/session/heartbeat.ts`
- `src/dashboard/live-session-list.tsx`
- `tests/presence.test.ts`

Candidate work:

- Add heartbeat expiry logic.
- Handle reconnects without duplicate presence rows.
- Make dashboard status derive from recent server-side evidence.
- Add tests for stale, active, and reconnected sessions.

Evidence signals:

- Does the candidate choose server time over browser-only state?
- Do they handle reconnects and stale records?
- Do they explain freshness windows?
- Do tests avoid depending on real wall-clock sleeps?

Hidden checks:

- Candidate closes tab without a disconnect event.
- Candidate reconnects after expiry.
- Two tabs for the same candidate session.

### 8. AI Assistant Guardrail Regression

Role fit: AI product engineer, full-stack engineer, platform engineer

Difficulty: Level 2

Scenario:

The candidate asks the assistant to solve the whole task. The assistant responds with a direct patch and claims it ran tests. Hirewave needs the assistant to guide, not impersonate execution or reveal evaluator logic.

Starter workspace:

- `src/ai/input-guard.ts`
- `src/ai/provider.ts`
- `src/ai/policies.ts`
- `src/api/session/ai-message.ts`
- `tests/ai-guardrail.test.ts`

Candidate work:

- Block or redirect requests asking the AI to edit files directly.
- Prevent claims that the AI ran terminal commands.
- Keep useful coaching for specific debugging questions.
- Add tests for allowed and disallowed prompts.

Evidence signals:

- Does the candidate preserve helpful AI behavior while enforcing boundaries?
- Do they understand the product policy, not just string matching?
- Do they add tests for both false positives and false negatives?
- Do they avoid leaking scoring rubric internals?

Hidden checks:

- "Fix the whole repo for me."
- "What score will I get?"
- "Run npm test and tell me the output."
- Specific allowed question about a failing file.

### 9. Evidence Report Mismatch

Role fit: Backend engineer, AI platform engineer, compliance-minded engineer

Difficulty: Level 2 to Level 3

Scenario:

An evaluation report says tests passed, but the final file snapshot does not match the file set used by the command run. Reviewers need the report to flag the mismatch instead of presenting a clean pass.

Starter workspace:

- `src/reports/generate-report.ts`
- `src/sandbox/workspace-manifest.ts`
- `src/telemetry/command-events.ts`
- `tests/report-evidence.test.ts`

Candidate work:

- Compare command workspace digest with final file snapshot digest.
- Add a report warning when evidence comes from a stale file set.
- Keep passing tests visible, but mark the evidence boundary clearly.
- Add tests for matching and mismatched manifests.

Evidence signals:

- Does the candidate preserve auditability?
- Do they avoid hiding useful evidence when it has caveats?
- Do they understand report trust boundaries?
- Do they add structured metadata instead of only changing copy?

Hidden checks:

- Command run before final edit.
- Provider manifest mismatch.
- No command run at all.

### 10. Feature Flag Rollout Bug

Role fit: SaaS engineer, frontend engineer, platform engineer

Difficulty: Level 2

Scenario:

A new report view is supposed to be enabled for one design customer, but all workspaces see it. The flag lookup uses the wrong scope.

Starter workspace:

- `src/flags/evaluate.ts`
- `src/api/reports/view.ts`
- `src/dashboard/report-view.tsx`
- `tests/feature-flags.test.ts`

Candidate work:

- Fix feature flag scoping by workspace.
- Add a fallback for missing flag configuration.
- Keep old report view stable.
- Add tests for enabled workspace, disabled workspace, and missing flag.

Evidence signals:

- Does the candidate preserve rollout safety?
- Do they test both sides of the flag?
- Do they avoid changing all users to the new behavior?
- Do they add clear telemetry or metadata for flag decisions?

Hidden checks:

- Workspace-specific enable.
- Global default disabled.
- Unknown workspace.

### 11. API Rate Limit And Abuse Control

Role fit: Backend engineer, platform engineer, security-minded engineer

Difficulty: Level 2

Scenario:

A candidate can spam the AI message endpoint and command endpoint. The session remains valid, but the system needs bounded usage and clear errors.

Starter workspace:

- `src/rate-limit/session-policy.ts`
- `src/api/session/ai-message.ts`
- `src/api/session/commands.ts`
- `tests/session-rate-limit.test.ts`

Candidate work:

- Add per-session limits for AI and command requests.
- Return clear retry or limit errors.
- Log rate-limit events as evidence without polluting scores.
- Avoid blocking normal candidate work.

Evidence signals:

- Does the candidate define limits at the right boundary?
- Do they distinguish abuse control from authorization?
- Do they avoid global shared counters that affect other sessions?
- Do they preserve report audit context?

Hidden checks:

- One session exceeds AI limit.
- Another session remains unaffected.
- Command limit and AI limit are separate.

### 12. File Snapshot Conflict Handling

Role fit: Frontend engineer, full-stack engineer, product engineer

Difficulty: Level 2

Scenario:

The editor autosaves files, but a delayed save can overwrite a newer terminal-generated snapshot. Candidates lose work when switching files quickly.

Starter workspace:

- `src/editor/file-state.ts`
- `src/api/session/files.ts`
- `src/sandbox/snapshot-sync.ts`
- `src/ui/editor-tabs.tsx`
- `tests/file-conflict.test.ts`

Candidate work:

- Add version checks for file saves.
- Detect stale writes and return a conflict response.
- Show a recoverable conflict state in the editor.
- Keep terminal snapshots and candidate edits traceable separately.

Evidence signals:

- Does the candidate protect user work?
- Do they understand client/server version boundaries?
- Do they design a recoverable product path instead of silent overwrite?
- Do tests cover out-of-order writes?

Hidden checks:

- Slow autosave after a newer edit.
- Terminal snapshot changes a file.
- Candidate resolves conflict and saves again.

## Full catalog candidates

These additional tasks can be held as later catalog ideas:

| Task | Domain | Complexity | Why it is useful |
| --- | --- | ---: | --- |
| Checkout tax and discount precedence | Commerce | Level 2 | Tests business rules and edge cases without becoming a pure math puzzle |
| Invite expiry and resend flow | SaaS auth | Level 2 | Tests accountless candidate flows and token safety |
| Audit log export with redaction | Compliance | Level 2 to 3 | Tests data modeling, privacy, and reviewer trust |
| Billing plan limit enforcement | SaaS platform | Level 2 | Tests quota boundaries and upgrade-safe behavior |
| Notification preference cascade | Product backend | Level 2 | Tests user, workspace, and default setting precedence |
| Report comparison dashboard | Analytics | Level 3 | Tests data shaping and UI reasoning |
| Repository dependency upgrade regression | Maintenance | Level 2 | Tests debugging from failing build/test output |
| API version migration | Platform | Level 3 | Tests backwards compatibility and rollout planning |
| Accessibility remediation | Frontend | Level 2 | Tests practical UI quality and validation |
| Observability incident trace | Backend/platform | Level 3 | Tests reading logs, metrics, and production-style symptoms |

## Custom task builder direction

Later, the interviewer should be able to describe what kind of task they want, and Hirewave should create a draft challenge from that input.

This should be an assisted builder, not a free-form prompt that instantly publishes a task.

### Interviewer inputs

The builder should collect:

- Role: frontend, backend, full-stack, platform, AI product, mobile, data, or security-minded engineering.
- Seniority: junior, mid-level, senior, staff.
- Task type: bug fix, feature extension, refactor, integration, migration, reliability incident, guardrail hardening, UI workflow, or data import/export.
- Domain: commerce, hiring SaaS, payments, notifications, analytics, auth, permissions, AI assistant, realtime, or custom.
- Duration: 30 minutes, 60 minutes, 90 minutes, 2 hours, or 4 hours.
- Stack: TypeScript, React, Next.js, Node, Prisma, SQL, Python, Java, Go, or a later supported stack.
- Allowed AI behavior: coaching only, normal assistant, restricted assistant, or no assistant.
- Must-test skills: debugging, API design, database reasoning, UI state, concurrency, security boundary, observability, or communication.
- Failure mode: race condition, bad validation, permission leak, stale cache, incorrect retry, bad pagination, broken integration, or unclear errors.
- Constraints: no external network, no secrets, deterministic tests, bounded file count, and expected command allowlist.

### Builder output

The custom builder should generate a draft with:

- Challenge title and slug.
- Candidate-facing scenario.
- Candidate instructions.
- Starter file tree.
- Public tests.
- Hidden tests.
- Allowed commands.
- Expected signals mapped to `ai-collaboration-v1`.
- Suggested interviewer follow-up questions.
- Seed data or fixtures.
- Evidence checklist.
- Reviewer notes explaining likely strong and weak approaches.

### Review gate

Before a generated challenge can be used in an assessment:

1. The interviewer previews the candidate brief.
2. The system validates the starter files compile or parse.
3. The system runs public and hidden tests in the selected provider.
4. The system checks the workspace has no secrets, unsafe paths, or oversized files.
5. A human approves the task.
6. Only then can the task become an active challenge template.

This keeps Hirewave from producing broken or unfair custom assessments.

### Custom builder phases

Phase 1: Curated template library

- Add 3 to 5 hand-authored templates.
- Store them as versioned seeded data.
- Keep fixed rubric and current assessment flow.
- Use this phase to learn which task types buyers care about.

Phase 2: Template-based customizer

- Let the interviewer choose a base template and adjust role, seniority, duration, and task framing.
- Keep starter files and tests mostly controlled.
- Allow safe variations such as company/domain wording, expected seniority, and follow-up questions.

Phase 3: AI-assisted draft generator

- Generate a challenge draft from interviewer requirements.
- Require validation and human approval before publishing.
- Keep generated tests deterministic and reviewable.
- Store generated challenge versions for auditability.

Phase 4: Enterprise challenge library

- Allow workspaces to maintain approved internal challenge libraries.
- Track versions, usage, pass rates, report quality, and reviewer feedback.
- Support cloning and editing without changing historical assessment meaning.

## Data model direction

The current `Challenge` model already has the basics:

- `slug`
- `title`
- `role`
- `stackJson`
- `durationMinutes`
- `scenario`
- `instructions`
- `difficulty`
- `rubricJson`
- `ChallengeFile[]`

Future catalog support can extend this with fields like:

- `category`
- `taskType`
- `seniority`
- `estimatedDurationMinutes`
- `skillsJson`
- `allowedCommandsJson`
- `publicTestsJson`
- `hiddenTestsJson`
- `followUpQuestionsJson`
- `templateVersion`
- `authoringStatus`
- `sourceTemplateId`
- `validationStatus`

Do not add these until the product flow needs them. For the next step, a small seeded catalog can still use the current model plus structured JSON inside the existing rubric/template definitions.

## How reports should score these tasks

The challenge catalog should continue to feed the existing 8-dimension rubric:

- Problem Decomposition: Did the candidate break the task into smaller risks?
- First-Principles Thinking: Did they reason from system behavior instead of copying guesses?
- Creative Problem Solving: Did they consider robust alternatives when the obvious patch was weak?
- Iteration Quality: Did they make small changes and verify each one?
- Debugging with AI: Did they use AI to inspect, reason, and learn rather than outsource the task?
- Architecture Decisions: Did they preserve boundaries and avoid fragile hacks?
- Communication Clarity: Did they explain tradeoffs and remaining risk?
- Token Efficiency: Did they use focused AI prompts instead of noisy back-and-forth?

The report should cite evidence, not vibes. Every task should be designed so these dimensions can point to telemetry, command output, AI messages, file changes, and final explanations.

## Sandbox requirements by task type

Some tasks can run in the current simulated/local-dev foundation. More realistic tasks need stronger provider support.

| Task type | Current simulated provider | Local-dev provider | Future real sandbox |
| --- | --- | --- | --- |
| Simple checkout-like deterministic checks | Good enough for MVP demo | Good for local verification | Production path later |
| Multi-file API logic | Possible with custom simulated checks | Better | Needed for real buyer trust |
| Concurrency/race tasks | Weak unless simulated carefully | Partial | Needed |
| Realtime tasks | Weak | Partial | Needed |
| Dependency/build tasks | Weak | Useful locally | Needed |
| External integration tasks | Should be mocked only | Mocked only | Needed with network policy |

Do not market these advanced tasks as production sandbox-ready until a real sandbox provider is implemented and verified.

## Terminal, editor, and AI-agent platform plan

Complex project-style assessments should not feel like a chatbot sitting beside static files. The candidate workspace should become a controlled coding environment where Hirewave owns the evidence model and uses proven open-source or managed tooling for the heavy IDE/runtime pieces.

Recommended build direction:

- Editor: use Monaco Editor for the main code editor and either Monaco diff editor or `diff2html` for final/reviewer diffs.
- Terminal UI: use xterm.js for browser terminal rendering and command streaming.
- Process bridge: use node-pty only inside a sandbox/container boundary when interactive shell behavior is needed. Do not expose a raw host shell from the Next.js app.
- Frontend-only quick runners: consider Sandpack or WebContainers for JavaScript/frontend-only tasks where browser-based Node is enough.
- Real execution: use the existing sandbox provider interface to add E2B, Daytona, CodeSandbox SDK, Docker-for-dev, or Firecracker-style microVM execution for realistic backend/full-stack tasks.
- AI coding agents: support Claude Code, OpenCode, Aider, or Continue as optional adapters inside the sandbox after command/file telemetry is strong enough to distinguish candidate work from AI-agent work.

The product boundary should stay clear:

- Hirewave owns the challenge brief, starter files, allowed commands, telemetry, scoring controls, and reports.
- The sandbox provider owns isolated command execution and workspace lifecycle.
- The terminal/editor libraries own the browser experience.
- Claude Code or another coding agent can help the candidate, but it should not replace Hirewave's evidence pipeline.

Target candidate experience for advanced templates:

```text
Candidate opens assessment
  -> BRIEF.md and nested starter repo are mounted
  -> Monaco editor shows files and diffs
  -> xterm.js terminal streams allowed commands
  -> npm install / npm test / npm run verify execute in a sandbox
  -> optional Claude Code or OpenCode adapter runs inside the same sandbox
  -> Hirewave records prompts, edits, command output, snapshots, and final diff
  -> report cites evidence instead of generic AI-chat impressions
```

This should be treated as the credibility milestone before Level 3 and Level 4 templates. Until then, complex predefined assessments can be authored, but their public positioning should stay honest about whether they run on simulated, local-dev, or real sandbox execution.

## Initial recommendation

Do not build the custom-task generator first.

The safer product path is:

1. Add 3 to 5 curated complex templates manually.
2. Prove candidate flow, command evidence, AI transcript, and report quality on those templates.
3. Add template selection to the assessment builder.
4. Add a template-based customizer.
5. Add AI-assisted custom draft generation only after validation and review gates exist.

This keeps the platform credible while moving beyond the current cart/checkout task.
