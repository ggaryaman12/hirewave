# Implementation Plan

Date: 2026-05-03

## Goal

Turn Hirewave from a static landing page into a working AI-native assessment platform: hiring dashboard, assessment builder, candidate invite flow, browser coding room, telemetry capture, AI assistant logging, terminal/test runner, complex challenge catalog, custom task builder, submission, and evidence-based report.

This is now the canonical combined implementation plan. The earlier future challenge catalog and custom task builder plan is folded into this file so the product can be implemented in phases, while keeping one end-state architecture in view.

## Current implementation status - 2026-05-20

The current codebase implements the MVP vertical slice plus the first production-honesty upgrades from the later milestones:

- Milestones 1 through 6 are implemented as the local MVP: demo auth, Prisma/SQLite, assessment creation, invite/candidate session flow, browser workspace, controlled terminal, AI assistant logging, submission, and evidence-based reports.
- Milestone 6 now includes reviewer exports through `/api/reports/[sessionId]/export?format=markdown|json`, using the same evidence bundle as the browser report.
- Milestone 7 is implemented as a foundation only: simulated provider by default, local-dev provider for explicit local experiments, external provider placeholders that fail closed, persisted sandbox metadata, stream-labeled output chunks, workspace manifests, output caps, snapshot evidence, cleanup metadata, and production fail-closed local-dev behavior.
- Milestone 8 is implemented as a foundation only: curated complex templates, deterministic custom draft generation, validation issues, evidence checklist, draft approval gate, and blocking assessment creation from unapproved drafts.

Still future work:

- Real external sandbox adapter with production isolation.
- Monaco/xterm replacement for the textarea/terminal MVP.
- Dedicated versioned custom challenge lifecycle tables instead of difficulty-prefix draft/approved status.
- Full enterprise challenge library, RBAC, audit-log UI, retention/export controls, SSO, billing, ATS, and production compliance controls.

## Milestone 1 - Make current app production-clean

Likely files:

- Create `.eslintrc.json`
- Modify `package.json`
- Modify `package-lock.json`
- Create `README.md`
- Create `.env.example`
- Modify landing CTAs after product routes exist:
  - `components/sections/navbar.tsx`
  - `components/sections/final-cta.tsx`
  - `components/sections/footer.tsx`

Acceptance criteria:

- `npm run lint` runs non-interactively.
- `npm run typecheck` exists and passes.
- `npm run build` passes.
- README explains local setup.
- `.env.example` lists all required env vars.
- Fake core CTAs no longer point to `#` once dashboard/invite routes exist.

Test plan:

- `npm run lint`
- `npm run typecheck`
- `npm run build`
- `npm audit --audit-level=moderate` recorded; dependency upgrades handled intentionally.

Risks:

- Next.js 14.2.15 has audit findings. Upgrading immediately could create compatibility churn.
- ESLint may surface existing `any` and accessibility issues.

Rollback strategy:

- Revert script/config additions if lint setup blocks progress.
- Defer dependency upgrades to a separate security-hardening branch if build breaks.

## Milestone 2 - Core data model

Likely files:

- Create `prisma/schema.prisma`
- Create `prisma/seed.js`
- Create `lib/db.ts`
- Create `lib/auth/demo-auth.ts`
- Create `lib/data/challenges.ts`
- Modify `package.json`
- Modify `package-lock.json`
- Create local SQLite DB through `prisma db push` / seed

Acceptance criteria:

- Database schema includes User, Workspace, WorkspaceMember, Assessment, Challenge, ChallengeFile, Candidate, CandidateSession, SessionEvent, FileSnapshot, CommandRun, AiMessage, TestResult, EvaluationReport, ScoreDimension, InviteLink.
- Seed creates demo user, workspace, and "Debug the Broken Checkout Flow" challenge.
- App can read seeded workspace/challenge.
- Demo auth can set and read a hiring user cookie.

Test plan:

- `npx prisma generate`
- `npx prisma db push`
- `npm run db:seed`
- Add a minimal smoke script or route-level manual check if no test framework exists yet.

Risks:

- Prisma/SQLite adds local generated files and a DB file. DB file must be ignored.
- Serverless deployment needs Postgres later; SQLite is local MVP only.

Rollback strategy:

- Keep Prisma isolated in `lib/db.ts`.
- Remove generated DB file and schema if implementation needs to fall back to in-memory demo data.

## Milestone 3 - Assessment builder

Likely files:

- Create `app/dashboard/page.tsx`
- Create `app/dashboard/assessments/page.tsx`
- Create `app/dashboard/assessments/new/page.tsx`
- Create `app/dashboard/assessments/[assessmentId]/page.tsx`
- Create `app/api/assessments/route.ts`
- Create `app/api/assessments/[assessmentId]/route.ts`
- Create `components/product/app-shell.tsx`
- Create `components/product/assessment-form.tsx`
- Create `components/product/status-pill.tsx`
- Create `lib/assessments.ts`
- Create `lib/validation.ts`

Acceptance criteria:

- Hiring user can open dashboard.
- Assessment list has empty and populated states.
- New assessment form validates fields.
- User can create an active assessment from seeded challenge.
- Detail page shows invite link and assessment configuration.

Test plan:

- Manual browser flow: dashboard -> new assessment -> detail.
- API validation with `curl`.
- `npm run typecheck`
- `npm run build`

Risks:

- Building too many reusable components too early.
- Dashboard can become static mock if API/state is not wired.

Rollback strategy:

- Keep builder route independent; disable create form but keep list/detail if validation blocks progress.

## Milestone 4 - Candidate flow

Likely files:

- Create `app/invite/[token]/page.tsx`
- Create `app/session/[sessionToken]/page.tsx`
- Create `app/api/invites/[token]/route.ts`
- Create `app/api/candidate/start/route.ts`
- Create `lib/invites.ts`
- Create `lib/sessions.ts`
- Create `components/candidate/start-form.tsx`

Acceptance criteria:

- Invite link opens public candidate start page.
- Candidate can enter name/email.
- App creates Candidate and CandidateSession.
- Candidate is redirected to session room.
- Candidate does not need an account.
- Session has start/expires timestamps.

Test plan:

- Manual browser invite flow.
- `curl` candidate start endpoint with valid/invalid invite.
- Verify DB rows for candidate/session.

Risks:

- Token handling mistakes can expose sessions.
- Candidate form can accidentally depend on hiring auth.

Rollback strategy:

- Disable public route by revoking invite links if session tokens are wrong.
- Keep token helpers centralized for quick fix.

## Milestone 5 - Coding workspace MVP

Likely files:

- Create `components/candidate/assessment-room.tsx`
- Create `components/candidate/file-tree.tsx`
- Create `components/candidate/code-editor.tsx`
- Create `components/candidate/terminal-panel.tsx`
- Create `components/candidate/ai-assistant-panel.tsx`
- Create `components/candidate/timer.tsx`
- Create `app/api/session/[sessionToken]/state/route.ts`
- Create `app/api/session/[sessionToken]/files/route.ts`
- Create `app/api/session/[sessionToken]/events/route.ts`
- Create `app/api/session/[sessionToken]/commands/route.ts`
- Create `app/api/session/[sessionToken]/ai/route.ts`
- Create `lib/telemetry.ts`
- Create `lib/sandbox/provider.ts`
- Create `lib/sandbox/simulated-provider.ts`
- Create `lib/ai/provider.ts`
- Create `lib/ai/deterministic-provider.ts`

Acceptance criteria:

- Session room renders file tree, editor, terminal/test output, AI chat, timer, and submit button.
- Candidate can open and edit files.
- File events are logged.
- Candidate can run simulated tests.
- Command/test events and results are logged.
- Candidate can send AI messages.
- AI prompt and response events are logged.
- Timer displays remaining time.

Test plan:

- Manual candidate flow with edits, AI chat, tests.
- Inspect session report/debug data in dashboard or DB.
- `npm run typecheck`
- `npm run build`

Risks:

- Overbuilding editor before data flow works.
- Client state and DB snapshots can drift.
- Simulated runner can feel fake if outputs are generic.

Rollback strategy:

- Keep all workspace state in a single session state API.
- If file persistence is unstable, temporarily submit current client state with telemetry and report generation.

## Milestone 6 - Submission and report

Likely files:

- Create `app/api/session/[sessionToken]/submit/route.ts`
- Create `app/dashboard/assessments/[assessmentId]/sessions/[sessionId]/page.tsx`
- Create `components/product/report-viewer.tsx`
- Create `components/product/report-overview-tab.tsx`
- Create `components/product/report-timeline-tab.tsx`
- Create `components/product/report-analysis-tab.tsx`
- Create `components/product/report-narrative-tab.tsx`
- Create `components/product/report-files-tab.tsx`
- Create `components/product/report-score-breakdown.tsx`
- Create `components/product/report-growth-areas.tsx`
- Create `components/product/timeline-viewer.tsx`
- Create `components/product/file-snapshot-viewer.tsx`
- Create `components/product/ai-transcript.tsx`
- Create `components/product/command-history.tsx`
- Create `lib/evaluation/report-schema.ts`
- Create `lib/evaluation/generate-report.ts`
- Create `lib/evaluation/evidence.ts`
- Create `lib/evaluation/key-moments.ts`
- Create `lib/evaluation/session-narrative.ts`
- Create `lib/evaluation/growth-areas.ts`

Acceptance criteria:

- Candidate can submit.
- Session becomes submitted/report_ready.
- Report is generated from telemetry and final file snapshots.
- Dashboard report page shows overall recommendation, overall score, dimension scores, evidence, timeline, files, AI transcript, commands/tests, risk flags, and follow-up questions.
- Report has tabs for Overview, Timeline, Analysis, Narrative, and Files.
- Overview includes a plain-language candidate summary, hiring signal label, areas for growth, skill dimensions visualization, and score breakdown.
- Score breakdown shows every `ai-collaboration-v1` dimension with a numeric score, short evidence-backed explanation, and link or pointer to supporting session evidence.
- Timeline shows activity categories over time, prompt complexity trend, and activity distribution across planning, coding, debugging, prompting, reviewing, and testing.
- Analysis highlights key moments such as strengths, weaknesses, pivots, risk events, and AI-overdelegation with transcript links.
- Narrative records session metadata, chronological phases, quoted candidate/AI/interviewer moments, command/test evidence, and downloadable export/PDF path.
- Files tab shows final files, changed files, diffs, and any sandbox evidence caveats.
- Report does not contain generic praise without evidence.
- Report must explicitly flag when the candidate delegated the whole task to AI instead of decomposing, coding, debugging, or verifying independently.

Competitor-inspired report shape:

```text
Overview
  - Candidate identity, email, completed date, challenge title.
  - Overall score and decision label such as Strong Yes, Yes, Mixed, No, or Strong No.
  - Narrative summary explaining the candidate's real behavior.
  - Areas for Growth.
  - Skill Dimensions radar/spider chart.
  - Score Breakdown list with each rubric dimension and evidence snippet.

Timeline
  - Session timeline over minutes.
  - Activity distribution across planning, coding, debugging, prompting, reviewing, and testing.
  - Prompt complexity over time.

Analysis
  - Key Moments with type labels such as Strength, Weakness, Pivot, Risk, or Evidence Gap.
  - Each moment links back to transcript, command output, file diff, or timeline event.

Narrative
  - Session metadata.
  - Phase-by-phase explanation of what happened.
  - Short quoted examples from candidate prompts and AI/interviewer responses.
  - Downloadable report/PDF.

Files
  - Final files.
  - Diff from initial starter state.
  - Runner/sandbox-generated file caveats.
```

Low-engagement summary example to support:

```text
The candidate demonstrated minimal engagement with the challenge, effectively delegating problem-solving, design, and debugging tasks to the AI assistant. The candidate's first substantive interaction was a broad request for the AI to review the entire codebase, followed by a request to fix all assessment requirements. This produced little observable evidence of problem decomposition, first-principles reasoning, creative input, iterative development, or independent debugging. Architectural decisions and implementation details were largely handled by the AI. The prompts were high-level and lacked specificity, creating weak evidence for communication clarity on complex engineering tasks.

Areas for Growth:
- Problem Decomposition: Actively break down complex problems into smaller, manageable tasks.
- First-Principles Thinking: Engage with the underlying concepts and trade-offs behind system design choices.
- Active Problem Solving: Take ownership of coding, debugging, and integration instead of delegating entirely to AI.
- Communication Clarity: Write specific prompts with context, constraints, and intended verification.
- Iterative Development: Build incrementally, run tests, and refine after each step.
- Debugging Skills: Develop a methodical approach to identifying, diagnosing, and resolving bugs.
```

Test plan:

- Manual full flow: create assessment -> invite -> start -> edit -> ask AI -> run tests -> submit -> view report.
- Verify report JSON matches required schema.
- Verify report tabs render on a low-engagement session and a strong iterative session.
- Verify key moments link to raw transcript, command, file, or telemetry evidence.
- Verify score explanations never cite evidence that does not exist.
- Verify report export uses the same evidence as the browser view.
- `npm run typecheck`
- `npm run build`

Risks:

- AI report generation may be unavailable locally.
- Evidence extraction can be shallow in first pass.
- Fancy charts can hide weak evidence if the underlying scoring explanation is not strict.
- The report can accidentally punish AI use itself instead of punishing unverified delegation and lack of candidate reasoning.

Rollback strategy:

- Use deterministic report generator as fallback.
- Store raw telemetry even if report generation fails, allowing regeneration later.
- Render simple text/table report first if charts or PDF export lag behind.

## Milestone 7 - Real sandbox integration

Likely files:

- Add `components/candidate/monaco-editor.tsx` or replace the current textarea editor with Monaco.
- Add `components/candidate/xterm-terminal.tsx` for terminal rendering and streaming output.
- Add `components/candidate/diff-viewer.tsx` backed by Monaco diff editor or `diff2html`.
- Create `lib/sandbox/e2b-provider.ts` or `lib/sandbox/daytona-provider.ts`
- Modify `lib/sandbox/provider.ts`
- Modify `app/api/session/[sessionToken]/commands/route.ts`
- Modify `.env.example`
- Add sandbox lifecycle cleanup job/route later

Tooling direction:

- Use Monaco Editor for the browser code editor and diff-capable file review.
- Use xterm.js for the browser terminal UI.
- Use node-pty only inside a sandbox/container boundary when we need interactive shell behavior. Do not attach node-pty directly to the Hirewave web process for candidate commands.
- Keep WebContainers/Sandpack as optional JS/frontend-only acceleration paths, not the general backend/realtime/system-design runner.
- Use E2B, Daytona, CodeSandbox SDK, Docker-for-dev, or a Firecracker-style microVM path for real production execution.
- Support Claude Code, OpenCode, Aider, or Continue as pluggable AI-agent adapters only after the sandbox boundary and telemetry hooks are strong.

Acceptance criteria:

- Provider selected via env var.
- Real provider can create session, load files, run command, return output, snapshot files, and destroy session.
- Candidate can run project-level commands such as `npm install`, `npm test`, `npm run verify`, and approved service-specific commands through the provider policy.
- Complex tasks can define challenge-specific allowed commands and setup scripts without exposing arbitrary host shell access.
- Terminal output streams into the candidate room while still being persisted as structured command evidence.
- Monaco editor persists file edits and supports reviewer-friendly final diffs.
- AI-agent runs, if enabled, are labeled separately from candidate-authored edits and are captured in prompts, command output, file diffs, and final report evidence.
- Command telemetry records provider run ID, readiness status, capability statuses/gaps, environment policy, network policy, resource limits, and cleanup status for the provider attempt.
- Simulated provider remains available for local demos.
- No secrets are exposed to candidate browser.

Test plan:

- Provider-specific smoke test with one sandbox.
- Run challenge tests in provider.
- Run a multi-folder Node/Next challenge with backend and frontend dependencies.
- Verify `npm install`/dependency setup is cached or bounded by timeout/resource policy.
- Verify terminal streaming, command cancellation, timeout, and output truncation.
- Verify final snapshots distinguish candidate edits, AI-agent edits, and runner-generated files.
- Verify cleanup on submit/expiry.

Risks:

- Cost and lifecycle leaks.
- Network policy gaps.
- Command streaming complexity.
- Raw IDE embedding can hide evidence from Hirewave if not instrumented.
- Claude Code or other coding agents can blur who made a change unless edits and prompts are captured explicitly.
- Browser-only runtimes such as WebContainers are excellent for JS tasks but are not enough for Redis, MongoDB, native packages, Docker, or broad backend tasks.

Rollback strategy:

- Feature flag provider to `simulated`.
- Keep provider interface stable.
- Keep Monaco/xterm UI decoupled from the provider so the UI can run against simulated, local-dev, or real sandbox backends.
- Disable AI-agent adapters per assessment if telemetry, cost, or fairness controls are not ready.

## Milestone 8 - Complex challenge catalog and custom task builder

This milestone folds the future challenge catalog and custom task builder plan into the main implementation path. The goal is to move beyond the simple checkout task without turning Hirewave into a generic prompt generator.

Likely files:

- Modify `lib/challenge-catalog.ts`
- Modify `prisma/seed.js`
- Modify `app/dashboard/assessments/new/page.tsx`
- Modify `components/candidate/assessment-room.tsx`
- Modify `lib/sandbox/simulated-provider.ts`
- Modify `lib/sandbox/local-dev-provider.ts`
- Modify `lib/ai/provider.ts`
- Create `lib/challenge-builder/draft.ts`
- Create `lib/challenge-builder/validation.ts`
- Create `lib/challenge-builder/templates.ts`
- Create `components/product/challenge-template-picker.tsx`
- Create `components/product/custom-task-builder.tsx`
- Create `components/product/custom-task-preview.tsx`
- Add or update tests under `tests/api/challenge-catalog.spec.ts`, `tests/api/simulated-runner.spec.ts`, and `tests/e2e/assessment-flow.spec.ts`

Product stance:

- Keep the checkout challenge as the first simple seeded template.
- Add curated complex project-style templates before adding AI-generated custom tasks.
- Keep the fixed `ai-collaboration-v1` rubric for v1 reports unless we intentionally introduce a new rubric version.
- Custom task generation is different from custom rubric generation. Interviewers can define task type, domain, seniority, and constraints, but scoring controls stay versioned and reviewable.

Good Hirewave tasks should include:

- A real business/product scenario.
- Existing code with enough context to inspect.
- At least one failing behavior that must be proven with tests or command output.
- More than one possible path so the report can judge process, not only final output.
- Evidence hooks: files touched, terminal commands, AI prompts, test results, final diff, and explanation.
- Public and hidden checks that validate behavior without forcing one exact implementation.
- A bounded workspace that can run in the configured sandbox provider.

Weak tasks to avoid:

- Pure puzzles with no product context.
- Single-line bugs with no debugging signal.
- Tasks where AI can paste a full answer and no verification is needed.
- Multi-day take-homes without consistent scoring.
- Tasks requiring production secrets, external paid APIs, or unsafe network access.

Complexity levels:

| Level | Candidate time | Shape | Platform support |
| --- | ---: | --- | --- |
| Level 1 | 30 to 45 minutes | Narrow bug fix in 2 to 4 files | Current MVP/simulated runner can support |
| Level 2 | 60 to 90 minutes | Cross-module debugging or small feature | Needs richer templates and better runner checks |
| Level 3 | 2 to 4 hours | Real-project feature with integration boundary | Needs real sandbox, richer report, and stronger validation |
| Level 4 | Half-day to 1 day | Take-home style project slice | Later enterprise scope only |

Initial curated templates:

| Template | Role fit | Signal |
| --- | --- | --- |
| Real-time Notification System with Resilient Delivery | Full-stack/backend/realtime | Redis Pub/Sub trade-offs, WebSocket/SSE delivery, idempotency, rate limiting, duplicate connection bug |
| Robust Activity Log Ingestion and Deduplication | Backend/data platform | Schema validation, dedupe, partial failure, Mongo/Redis style reasoning |
| Personalized Content Feed with Smart Caching and A/B Hooks | Full-stack/product platform | Cache invalidation, ranking safety, experiment hooks, stale data |
| Webhook Idempotency and Order State | Backend/payments | Duplicate/out-of-order events, state machine boundaries, auditability |
| Multi-Tenant Permission Leak | SaaS/security-minded full-stack | Server-side authorization, workspace scoping, UI filtering is not enough |
| Inventory Reservation Race Condition | Backend/commerce | Atomic reservation, concurrent requests, payment failure rollback |
| CSV Import with Partial Failure Report | Product/backend | Valid-row persistence, invalid-row reporting, idempotent import |
| Background Job Retry and Dead Letter Handling | Backend/platform | Retry classification, backoff, final states, operational logs |
| Realtime Candidate Presence Bug | Full-stack/realtime | Heartbeat expiry, reconnects, stale session detection |
| AI Assistant Guardrail Regression | AI product/platform | Helpful coaching without direct solution dumping or fake command claims |
| Evidence Report Mismatch | AI platform/compliance | Report trust boundaries, workspace manifests, stale command evidence |
| File Snapshot Conflict Handling | Full-stack/product | Autosave versioning, terminal-generated snapshots, recoverable conflicts |

Custom task builder phases:

1. Curated template library
   - Add hand-authored templates.
   - Store as versioned seeded data.
   - Keep fixed rubric and existing assessment flow.

2. Template-based customizer
   - Let interviewer choose a base template and adjust role, seniority, duration, task framing, and follow-up questions.
   - Keep starter files, tests, and scoring rules mostly controlled.

3. AI-assisted draft generator
   - Generate draft challenge from interviewer requirements.
   - Require validation and human approval before publishing.
   - Keep generated tests deterministic and reviewable.

4. Enterprise challenge library
   - Workspace-owned approved challenge libraries.
   - Versioning, usage stats, pass rates, report quality signals, and reviewer feedback.
   - Clone/edit without changing historical assessment meaning.

Interviewer inputs:

- Role: frontend, backend, full-stack, platform, AI product, mobile, data, or security-minded engineering.
- Seniority: junior, mid-level, senior, staff.
- Task type: bug fix, feature extension, refactor, integration, migration, reliability incident, guardrail hardening, UI workflow, data import/export.
- Domain: commerce, hiring SaaS, payments, notifications, analytics, auth, permissions, AI assistant, realtime, or custom.
- Duration: 30 minutes, 60 minutes, 90 minutes, 2 hours, or 4 hours.
- Stack: TypeScript, React, Next.js, Node, Prisma, SQL, Python, Java, Go, or later supported stacks.
- Allowed AI behavior: coaching only, normal assistant, restricted assistant, or no assistant.
- Must-test skills: debugging, API design, database reasoning, UI state, concurrency, security boundary, observability, or communication.
- Constraints: no external network, no secrets, deterministic tests, bounded file count, expected command allowlist.

Builder output:

- Challenge title and slug.
- Candidate-facing scenario and BRIEF.md.
- Starter file tree.
- Public tests and hidden checks.
- Allowed commands.
- Expected signals mapped to `ai-collaboration-v1`.
- Suggested interviewer follow-up questions.
- Seed data or fixtures.
- Evidence checklist.
- Reviewer notes explaining likely strong and weak approaches.

Review gate:

1. Interviewer previews the candidate brief.
2. System validates starter files compile or parse.
3. System runs public and hidden tests in the selected provider.
4. System checks for secrets, unsafe paths, oversized files, and unsupported commands.
5. Human approves the task.
6. Only then can the task become an active challenge template.

Acceptance criteria:

- Assessment builder shows curated templates grouped by role, difficulty, duration, stack, and task type.
- Complex templates can include nested backend/frontend/test starter files and a candidate-facing BRIEF.md.
- Candidate room can display nested file paths clearly enough for project-style work.
- Runner can execute or simulate challenge-specific checks and produce evidence that reports can cite.
- Custom draft builder creates a reviewable draft, not an instantly published assessment.
- Draft validation reports compile/test/path/secret/command issues before approval.
- Published custom tasks are versioned so historical reports remain meaningful.

Test plan:

- API tests for seeded catalog completeness.
- API tests for custom draft creation and validation failures.
- Runner tests for at least one simple task and one complex project-style task.
- E2E test for selecting a curated template and creating an assessment.
- Report test proving complex-template evidence maps into score explanations and key moments.

Risks:

- Adding too many templates before sandbox quality improves can make the product feel broader than it really is.
- AI-generated tasks can be broken, unfair, or too vague without validation gates.
- Customization can silently change scoring meaning if task versions are not preserved.

Rollback strategy:

- Keep curated templates behind seeded catalog versions.
- Keep custom drafts in draft/review status until validation passes.
- Allow disabling advanced templates per workspace/provider readiness.

## Milestone 9 - Product polish

Likely files:

- Dashboard/report components under `components/product/`
- Candidate workspace components under `components/candidate/`
- Landing CTA files
- README/docs updates

Acceptance criteria:

- Product UI is coherent, dense, and SaaS-grade.
- Empty/loading/error states exist.
- Candidate cannot edit after submit.
- Dashboard shows meaningful candidate statuses.
- Report has reviewer-ready structure.
- Core CTAs route to product flows.

Test plan:

- Desktop and mobile browser pass.
- Full manual happy path.
- Error path checks: invalid invite, expired session, submit twice, API failure.
- `npm run lint`
- `npm run typecheck`
- `npm run build`

Risks:

- Polish can mask product gaps.
- Responsive candidate room is hard on small screens.

Rollback strategy:

- Prioritize desktop MVP for hiring-team demos.
- Keep mobile candidate view usable but not optimized for intense coding.

## First implementation slice

The first code slice should include milestones 1 through 6 in a constrained form:

- Demo auth, not enterprise auth.
- Prisma SQLite, not production Postgres.
- Seeded challenge, not full challenge authoring.
- Simulated runner, not real containers.
- Deterministic AI fallback with optional OpenAI-compatible provider.
- Evidence-based report generated synchronously on submit.

This produces the end-to-end workflow the product needs while leaving clear seams for production sandbox and auth upgrades.

## Unified phased build order

The platform should be built in phases, but the final target is one integrated product rather than separate disconnected efforts.

Phase 1 - Stabilize the MVP foundation:

- Keep demo auth, SQLite, deterministic AI fallback, and simulated runner honest.
- Make current candidate room, telemetry, report generation, and dashboard reliable.
- Preserve the existing provider boundaries for AI, sandbox, reporting, and challenge catalog.

Phase 2 - Upgrade the report experience:

- Implement the competitor-style report structure from Milestone 6.
- Add overview summary, areas for growth, skill radar, score breakdown, timeline analytics, key moments, narrative, files, and PDF/export.
- Make every score explanation cite transcript, command, test, file, or telemetry evidence.

Phase 3 - Add curated complex assessments:

- Add 3 to 5 hand-authored complex templates first.
- Include BRIEF.md, nested starter files, public checks, hidden checks, AI guidance, and report signal mapping.
- Use this to prove Hirewave supports realistic engineering work before opening custom generation.

Phase 4 - Strengthen terminal/editor/sandbox:

- Move editor to Monaco and terminal UI to xterm.js.
- Add real sandbox execution path for project commands such as `npm install`, `npm test`, `npm run verify`, and service-specific scripts.
- Keep node-pty, Claude Code, OpenCode, and similar agents behind sandbox boundaries and telemetry hooks.

Phase 5 - Add template-based custom builder:

- Let interviewers customize approved base templates.
- Keep tests, allowed commands, scoring signals, and validation controlled.
- Store versions so old reports do not change meaning.

Phase 6 - Add AI-assisted task generation:

- Generate draft tasks from interviewer requirements.
- Validate compile/test/path/secret/command safety.
- Require human approval before publishing.

Phase 7 - Enterprise challenge library:

- Workspace-owned approved task libraries.
- Versioning, usage analytics, pass-rate review, report-quality feedback, and reviewer notes.
- Stronger RBAC, audit trail, retention, and export controls.
