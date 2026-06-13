# Technical Architecture

Date: 2026-05-20

## Architecture stance

Hirewave should evolve from a static Next.js landing page into a full-stack SaaS app with clear provider boundaries.

The MVP should use the current Next.js repo, but product code must be isolated from the scroll-heavy marketing shell. The first implementation should favor a working vertical slice over a perfect cloud IDE: persisted assessments, accountless candidate sessions, browser editor, logged AI chat, simulated command/test runner, telemetry, submission, and evidence-based report.

The scoring contract is enterprise-first: reports use the fixed versioned `ai-collaboration-v1` 8-dimension rubric, preserve evidence links for auditability, and avoid claiming compliance features until retention, access controls, and audit-log UI exist.

## Frontend architecture

Recommended route groups:

```text
app/
  (marketing)/
    page.tsx
  (dashboard)/
    dashboard/
      page.tsx
      assessments/
        page.tsx
        new/page.tsx
        [assessmentId]/page.tsx
        [assessmentId]/sessions/[sessionId]/page.tsx
  (candidate)/
    invite/[token]/page.tsx
    session/[sessionToken]/page.tsx
  api/
    auth/
    assessments/
    candidate/
    telemetry/
    ai/
    runner/
    reports/
```

For the first MVP, the existing `app/page.tsx` can remain the landing page and product routes can be added alongside it.

### Hiring dashboard

Responsibilities:

- Workspace overview.
- Assessment list and statuses.
- Candidate/submission counts.
- Recent reports, evidence status, and risk flags.
- Empty state for first assessment.

### Assessment builder

Responsibilities:

- Select challenge template.
- Configure title, role, seniority, duration, AI mode, allowed tools, and the fixed rubric version.
- Create invite link.
- Show validation errors and loading state.

### Candidate assessment room

Responsibilities:

- Accountless session token access.
- Timer and submit flow.
- File tree.
- Code editor.
- Terminal/test output.
- AI assistant panel.
- Telemetry event capture.
- Disabled/submitted state.

MVP editor can be a high-quality controlled textarea with monospace styling. Next step should be Monaco Editor once persistence and telemetry are stable.

### Timeline/replay viewer

Responsibilities:

- Chronological event list.
- Filters by file, AI, command/test, error, note.
- Links from report evidence to raw events.
- Later: playback with file state reconstruction.

### Report viewer

Responsibilities:

- Overall recommendation.
- Dimension scores and evidence.
- Final files and diff.
- AI transcript.
- Command/test history.
- Risk flags.
- Suggested follow-up questions.

## Backend architecture

### Auth

MVP:

- Demo hiring-team sign-in via signed HTTP-only cookie.
- Seeded demo user and workspace.
- Candidate sessions use invite/session tokens only.

Production path:

- Replace demo auth with Auth.js/NextAuth or Clerk/Supabase Auth.
- Workspace RBAC for owner/admin/member/reviewer.
- SSO later.

### Workspaces

Workspace owns assessments, challenges, candidates, sessions, reports, and members.

### Assessments

Assessment is the hiring-team configured instance of a challenge template. It contains duration, role/seniority, AI mode, allowed tools, fixed scoring rubric version, and invite links.

### Challenges

Challenge is reusable content: instructions, starter files, tests, hidden checks, rubric version, role metadata.

### Candidate sessions

Candidate session is the single accountless work session. It starts from an invite link, records timing, owns telemetry, file snapshots, commands, AI messages, and final report. Candidate-saved file paths are normalized at the server boundary and unsafe paths are rejected before they become `FileSnapshot` rows or sandbox inputs.

### Telemetry events

Telemetry is append-only. Mutating session state should never overwrite raw events. Reports should cite event IDs or timestamps.

### AI proxy

All AI requests go through server route handlers:

- Inject challenge/session context.
- Call configured AI provider.
- Log prompt and response.
- Enforce rate limits.
- Hide provider keys from browser.

### Sandbox adapter

All command/test/file execution goes through a provider interface. The current implementation defaults to deterministic simulated tests against session file content, with an opt-in local-dev provider for non-production experiments and an external-provider placeholder for the future E2B/Daytona/CodeSandbox path. The external placeholder records `not_executed` metadata and `skippedReason=external_provider_unconfigured`; it must not be treated as production isolation. Local-dev is additionally fail-closed in `NODE_ENV=production` with `skippedReason=local_dev_production_blocked`, even if explicitly enabled. For the seeded checkout challenge, local-dev can prepare a hidden no-network runner when no `package.json` exists, then parse the runner's JSON test results back into the shared `TestResult` path. Command telemetry includes sandbox provider metadata, provider run ID, readiness status, capability statuses/gaps, command policy, environment policy, network policy, resource limits, execution mode, isolation level, network access, filesystem persistence, cleanup policy, cleanup status, mounted workspace manifest, snapshot summaries, duration, timeout data, output size, stream-labeled output chunks, and truncation data so reports can cite the execution boundary used for evidence without allowing unbounded command logs or overstated isolation claims. `createWorkspaceManifest` in `lib/sandbox/workspace-manifest.ts` is the provider-contract source for mounted workspace metadata; every `SandboxRunCommandInput` carries this manifest alongside the file list. The mounted workspace manifest records file count, total bytes, per-file path/language/content length, per-file SHA-256 content hashes, and an aggregate workspace digest for the exact files passed to a command. Providers validate the manifest before execution and fail closed with `skippedReason=workspace_manifest_mismatch` when the manifest and file payload diverge. Each `SandboxExecutionMetadata` includes a `sandboxRunId` and `cleanupStatus` so future external adapters can map Hirewave telemetry to provider-side execution attempts and prove whether workspace cleanup was deleted, retained, failed, provider-managed, or not applicable. Provider metadata includes `capabilities` with `readiness` plus statuses for real code execution, production isolation, command policy, network policy, environment policy, resource limits, workspace snapshots, and cleanup evidence. Provider metadata also includes an `environmentPolicy` with mode, exposed environment key names, and a `secretsExposed` boolean; local-dev intentionally passes only `NODE_ENV` and `PATH` to child commands. Provider metadata also includes a structured `networkPolicy` with outbound access, allowed hosts, and blocked-by-default status, plus resource limits for command timeout, output cap, snapshot file count, snapshot content bytes, and future CPU/memory caps. The command route caps provider output before writing `CommandRun`, `command_output`, finished telemetry, or API responses. Accepted changed/new provider snapshots use the same workspace path boundary as candidate files and are persisted as runner-owned `FileSnapshot` rows, while unsafe paths and snapshots beyond size/count limits are skipped with explicit metadata so final diffs do not silently use unsafe or partial file content. Reloaded candidate sessions reconstruct terminal stream chunks and sandbox metadata from persisted command events, so refreshes do not erase already-captured provider evidence. If a command is blocked by provider policy, the API records `skippedReason=command_not_allowed`; if unsafe historical workspace files are detected before provider execution, it records `skippedReason=invalid_workspace_file_path`; if provider setup or execution throws, it uses `skippedReason=provider_error`. These outcomes are surfaced as report audit metadata and sandbox risk flags, including `sandbox_not_production_isolated` for `none` and `host_temp_directory` isolation and `sandbox_not_production_ready` for any provider evidence whose readiness is not `production_ready`.

### Scoring engine

For MVP, scoring can be a deterministic evidence extractor plus optional AI report generation. If no AI key exists, return a conservative deterministic report so demos still work.

## Database model

The MVP can use Prisma with SQLite locally and migrate to Postgres later. IDs should be string UUID/CUID values. JSON columns are acceptable for rubric config, event payloads, starter files, and report bodies where schema evolves quickly.

### User

| Field | Type | Notes |
| --- | --- | --- |
| id | string | primary |
| name | string | |
| email | string | unique |
| createdAt | datetime | |
| updatedAt | datetime | |

### Workspace

| Field | Type | Notes |
| --- | --- | --- |
| id | string | primary |
| name | string | |
| slug | string | unique |
| createdAt | datetime | |
| updatedAt | datetime | |

### WorkspaceMember

| Field | Type | Notes |
| --- | --- | --- |
| id | string | primary |
| workspaceId | string | FK |
| userId | string | FK |
| role | enum | owner, admin, member, reviewer |
| createdAt | datetime | |

### Assessment

| Field | Type | Notes |
| --- | --- | --- |
| id | string | primary |
| workspaceId | string | FK |
| challengeId | string | FK |
| title | string | |
| role | string | e.g. Full-stack Engineer |
| seniority | string | junior/mid/senior/staff |
| durationMinutes | int | |
| aiMode | enum | allowed, required, disabled |
| allowedTools | json | |
| rubric | json | fixed `ai-collaboration-v1` dimensions and weights |
| status | enum | draft, active, archived |
| createdById | string | FK User |
| createdAt | datetime | |
| updatedAt | datetime | |

### Challenge

| Field | Type | Notes |
| --- | --- | --- |
| id | string | primary |
| slug | string | unique |
| title | string | |
| role | string | |
| stack | json | |
| durationMinutes | int | |
| scenario | text | |
| instructions | text | |
| difficulty | string | |
| rubric | json | |
| createdAt | datetime | |
| updatedAt | datetime | |

### ChallengeFile

| Field | Type | Notes |
| --- | --- | --- |
| id | string | primary |
| challengeId | string | FK |
| path | string | |
| language | string | |
| content | text | |
| isReadonly | boolean | default false |
| sortOrder | int | |

### Candidate

| Field | Type | Notes |
| --- | --- | --- |
| id | string | primary |
| workspaceId | string | FK |
| name | string | |
| email | string | |
| createdAt | datetime | |

### CandidateSession

| Field | Type | Notes |
| --- | --- | --- |
| id | string | primary |
| assessmentId | string | FK |
| candidateId | string | FK |
| inviteLinkId | string | FK |
| sessionTokenHash | string | hashed token |
| status | enum | created, started, submitted, expired, report_ready |
| startedAt | datetime nullable | |
| submittedAt | datetime nullable | |
| expiresAt | datetime | |
| lastEventAt | datetime nullable | |
| createdAt | datetime | |
| updatedAt | datetime | |

### SessionEvent

| Field | Type | Notes |
| --- | --- | --- |
| id | string | primary |
| sessionId | string | FK |
| type | enum/string | typed event name |
| actor | enum | candidate, system, ai, runner |
| payload | json | event-specific |
| occurredAt | datetime | append-only timestamp |

### FileSnapshot

| Field | Type | Notes |
| --- | --- | --- |
| id | string | primary |
| sessionId | string | FK |
| path | string | |
| content | text | |
| language | string | |
| version | int | |
| source | enum | starter, candidate, system |
| createdAt | datetime | |

### CommandRun

| Field | Type | Notes |
| --- | --- | --- |
| id | string | primary |
| sessionId | string | FK |
| command | string | |
| status | enum | running, succeeded, failed |
| output | text | |
| exitCode | int nullable | |
| startedAt | datetime | |
| finishedAt | datetime nullable | |

### AiMessage

| Field | Type | Notes |
| --- | --- | --- |
| id | string | primary |
| sessionId | string | FK |
| role | enum | user, assistant, system |
| content | text | |
| model | string nullable | |
| metadata | json nullable | latency, token counts, provider |
| createdAt | datetime | |

### TestResult

| Field | Type | Notes |
| --- | --- | --- |
| id | string | primary |
| commandRunId | string | FK |
| sessionId | string | FK |
| name | string | |
| status | enum | passed, failed, skipped |
| message | text nullable | |
| durationMs | int nullable | |
| createdAt | datetime | |

### EvaluationReport

| Field | Type | Notes |
| --- | --- | --- |
| id | string | primary |
| sessionId | string | unique FK |
| overallRecommendation | enum | strong_yes, yes, maybe, no, strong_no |
| overallScore | float | |
| summary | text | |
| reportJson | json | full schema |
| generatedBy | string | provider/model or deterministic |
| createdAt | datetime | |
| updatedAt | datetime | |

### ScoreDimension

| Field | Type | Notes |
| --- | --- | --- |
| id | string | primary |
| reportId | string | FK |
| dimension | string | |
| score | int | 1-5 |
| evidence | json | event/file references |
| strengths | json | |
| concerns | json | |
| followUpQuestions | json | |

### InviteLink

| Field | Type | Notes |
| --- | --- | --- |
| id | string | primary |
| assessmentId | string | FK |
| tokenHash | string | hashed token |
| label | string nullable | |
| maxUses | int nullable | |
| useCount | int | default 0 |
| expiresAt | datetime nullable | |
| status | enum | active, revoked, expired |
| createdAt | datetime | |

## Telemetry event model

All events share this envelope:

```ts
type SessionEventEnvelope = {
  id: string;
  sessionId: string;
  type: SessionEventType;
  actor: 'candidate' | 'system' | 'ai' | 'runner';
  occurredAt: string;
  payload: Record<string, unknown>;
};
```

Event types:

```ts
type SessionEventType =
  | 'session_started'
  | 'session_ended'
  | 'file_opened'
  | 'file_changed'
  | 'file_saved'
  | 'command_started'
  | 'command_output'
  | 'command_finished'
  | 'sandbox_snapshot_saved'
  | 'ai_prompt_sent'
  | 'ai_response_received'
  | 'test_run_started'
  | 'test_run_finished'
  | 'candidate_note_added'
  | 'focus_changed'
  | 'error_occurred';
```

Important payload examples:

- `file_changed`: `{ path, version, patchSummary, contentLength }`
- `command_started`: `{ commandRunId, command, sandboxProviderId, sandboxProviderKind, sandboxExecutionMode, sandboxIsolationLevel, sandboxNetworkAccess, sandboxNetworkPolicyMode, sandboxNetworkOutboundAccess, sandboxNetworkAllowedHosts, sandboxNetworkBlockedByDefault, sandboxReadinessStatus, sandboxCapabilityStatuses, sandboxCapabilityGaps, sandboxFilesystemPersistence, sandboxCleanupPolicy, sandboxEnvironmentPolicyMode, sandboxExposedEnvKeys, sandboxSecretsExposed, sandboxResourceLimits, sandboxCommandPolicyMode, sandboxAllowedCommands, sandboxBlockedByDefault }`
- `command_output`: `{ commandRunId, output, outputChunks, outputChunkCount, outputStreamKinds, sandboxProviderId, sandboxProviderKind, snapshotCount, persistedSnapshotCount, durationMs, timedOut, cleanupStatus, cleanupError?, outputChars, outputLimitChars, outputTruncated, skippedReason?, sandboxReadinessStatus, sandboxCapabilityStatuses, sandboxCapabilityGaps, sandboxNetworkPolicyMode, sandboxNetworkOutboundAccess, sandboxNetworkAllowedHosts, sandboxNetworkBlockedByDefault, sandboxEnvironmentPolicyMode, sandboxExposedEnvKeys, sandboxSecretsExposed, sandboxResourceLimits }`
- `command_finished`: `{ commandRunId, exitCode, sandboxProviderId, sandboxProviderKind, sandboxExecutionMode, sandboxIsolationLevel, sandboxNetworkAccess, sandboxNetworkPolicyMode, sandboxNetworkOutboundAccess, sandboxNetworkAllowedHosts, sandboxNetworkBlockedByDefault, sandboxReadinessStatus, sandboxCapabilityStatuses, sandboxCapabilityGaps, sandboxFilesystemPersistence, sandboxCleanupPolicy, sandboxEnvironmentPolicyMode, sandboxExposedEnvKeys, sandboxSecretsExposed, sandboxResourceLimits, sandboxCommandPolicyMode, sandboxAllowedCommands, sandboxBlockedByDefault, snapshotCount, persistedSnapshotCount, durationMs, timedOut, cleanupStatus, cleanupError?, outputChars, outputLimitChars, outputChunkCount, outputStreamKinds, outputTruncated, skippedReason?, errorMessage? }`
- `sandbox_snapshot_saved`: `{ commandRunId, sandboxProviderId, sandboxProviderKind, savedSnapshotCount, skippedSnapshotCount, snapshots, skippedSnapshots }`, where skipped snapshots can cite `unsafe_path`, `content_limit_exceeded`, or `file_limit_exceeded`.
- `ai_prompt_sent`: `{ aiMessageId, promptLength, referencedFiles }`
- `ai_response_received`: `{ aiMessageId, model, responseLength, latencyMs }`
- `test_run_finished`: `{ commandRunId, passed, failed, total, sandboxProviderId, sandboxProviderKind, sandboxExecutionMode, sandboxIsolationLevel, sandboxNetworkAccess, sandboxNetworkPolicyMode, sandboxNetworkOutboundAccess, sandboxNetworkAllowedHosts, sandboxNetworkBlockedByDefault, sandboxReadinessStatus, sandboxCapabilityStatuses, sandboxCapabilityGaps, sandboxFilesystemPersistence, sandboxCleanupPolicy, sandboxEnvironmentPolicyMode, sandboxExposedEnvKeys, sandboxSecretsExposed, sandboxResourceLimits, sandboxCommandPolicyMode, sandboxAllowedCommands, sandboxBlockedByDefault, snapshotCount, persistedSnapshotCount, durationMs, timedOut, cleanupStatus, cleanupError?, outputChars, outputLimitChars, outputChunkCount, outputStreamKinds, outputTruncated, skippedReason?, errorMessage? }`
- `focus_changed`: `{ state: "focused" | "blurred" }`

## Sandbox abstraction

Provider interface:

```ts
export interface SandboxProvider {
  id: string;
  kind: 'simulated' | 'local-dev' | 'external';
  metadata(): {
    id: string;
    kind: 'simulated' | 'local-dev' | 'external';
    executionMode: 'simulated' | 'local_process' | 'external_process' | 'not_executed';
    isolationLevel: 'none' | 'host_temp_directory' | 'isolated_container' | 'external_microvm';
    networkAccess: 'none' | 'host_inherited' | 'disabled' | 'restricted' | 'unrestricted';
    networkPolicy: {
      mode: 'none' | 'host_inherited' | 'deny_all' | 'allowlist' | 'provider_managed' | 'unrestricted';
      outboundAccess: 'none' | 'host_inherited' | 'disabled' | 'restricted' | 'unrestricted';
      allowedHosts: string[];
      blockedByDefault: boolean;
    };
    capabilities: {
      readiness: 'demo_only' | 'local_dev_only' | 'adapter_unconfigured' | 'configured_non_production' | 'production_ready' | 'unknown';
      realCodeExecution: 'supported' | 'partial' | 'provider_managed' | 'not_supported' | 'not_applicable' | 'unknown';
      productionIsolation: 'supported' | 'partial' | 'provider_managed' | 'not_supported' | 'not_applicable' | 'unknown';
      commandPolicy: 'supported' | 'partial' | 'provider_managed' | 'not_supported' | 'not_applicable' | 'unknown';
      networkPolicy: 'supported' | 'partial' | 'provider_managed' | 'not_supported' | 'not_applicable' | 'unknown';
      environmentPolicy: 'supported' | 'partial' | 'provider_managed' | 'not_supported' | 'not_applicable' | 'unknown';
      resourceLimits: 'supported' | 'partial' | 'provider_managed' | 'not_supported' | 'not_applicable' | 'unknown';
      workspaceSnapshots: 'supported' | 'partial' | 'provider_managed' | 'not_supported' | 'not_applicable' | 'unknown';
      cleanupEvidence: 'supported' | 'partial' | 'provider_managed' | 'not_supported' | 'not_applicable' | 'unknown';
    };
    filesystemPersistence: 'none' | 'virtual' | 'ephemeral_temp_directory' | 'provider_snapshot';
    cleanupPolicy: 'not_applicable' | 'delete_after_run' | 'manual_retention' | 'provider_managed';
    environmentPolicy: {
      mode: 'none' | 'minimal_allowlist' | 'provider_managed';
      exposedEnvKeys: string[];
      secretsExposed: boolean;
    };
    resourceLimits: {
      executionTimeoutMs: number;
      outputLimitChars: number;
      snapshotFileLimit: number;
      snapshotContentLimit: number;
      memoryLimitMb: number | null;
      cpuLimitMs: number | null;
    };
    commandPolicy: {
      mode: 'simulated_allowlist' | 'exact_allowlist' | 'provider_defined';
      allowedCommands: string[];
      blockedByDefault: boolean;
    };
  };
  isTestCommand(command: string): boolean;
  runCommand(input: SandboxRunCommandInput): Promise<SandboxCommandResult>;
  snapshot(input: SandboxSnapshotInput): Promise<WorkspaceFile[]>;
}
```

`SandboxCommandResult` includes the merged `output` string plus `outputChunks`, an ordered list of `{ stream: 'system' | 'stdout' | 'stderr', content, truncated? }` chunks. The merged string remains the compact UI/DB field, while chunks preserve stream provenance for audit and future real sandbox providers.

Provider options:

| Provider | Fit | Pros | Cons | MVP decision |
| --- | --- | --- | --- | --- |
| Simulated runner | First MVP | Fast, safe, no infra, deterministic demos | Not real execution | Implement first |
| Local child process | Development only | Real commands locally | Unsafe for untrusted code, OS-dependent, inherits host network | Implemented as opt-in `local-dev`; never production |
| E2B | AI code execution/sandboxes | Secure isolated Linux sandbox, file and command APIs | Cost, account/API dependency, network policy needs review | Strong first production candidate |
| Daytona | Full composable computers for agents | Dedicated kernel/filesystem/network, snapshots, firewall controls | More infra surface, account/API dependency | Strong for advanced cloud IDE path |
| CodeSandbox SDK | Programmatic dev environments | Isolated environments, microVM snapshots, fast restore | Account/API dependency, beta/product maturity | Good candidate for JS/full-stack challenges |
| Docker | Self-hosted development | Familiar and cheap | Shared host kernel; not enough alone for hostile untrusted code | Local/non-production only |
| StackBlitz WebContainers | Browser-only JS/Node | No server sandbox cost, instant browser UX | Browser/cross-origin limits, JS/WASM only, no native addons | Useful for frontend-only later, not general backend MVP |

## AI assistant abstraction

Provider interface:

```ts
export interface AiProvider {
  sendMessage(input: {
    context: AssessmentAiContext;
    messages: AiChatMessage[];
  }): Promise<AiProviderResponse>;

  streamResponse?(input: {
    context: AssessmentAiContext;
    messages: AiChatMessage[];
  }): AsyncIterable<AiStreamChunk>;

  summarizeSession(input: SessionEvidenceBundle): Promise<SessionSummary>;

  evaluateSession(input: SessionEvidenceBundle): Promise<EvaluationReportJson>;
}
```

MVP providers:

- `deterministic`: local fallback for demos and tests.
- `openai-compatible`: uses `AI_PROVIDER`, `AI_MODEL`, `OPENAI_API_KEY`, and optional `OPENAI_BASE_URL`.

Rules:

- Never hardcode secrets.
- Log user prompt before provider call and assistant response after provider call.
- Include bounded context: challenge instructions, current file list, selected file, command/test history summary, and last N chat messages.
- Keep raw telemetry separate from derived summaries.

## Evaluation engine

Inputs:

- Assessment config and rubric.
- Challenge instructions.
- Final files and diff.
- Session events.
- Command runs and test results.
- AI messages.
- Timing metrics.

Output dimensions for `ai-collaboration-v1`:

- Problem decomposition
- First-principles thinking
- Creative problem solving
- Iteration quality
- Debugging with AI
- Architecture decisions
- Communication clarity
- Token efficiency

Each dimension includes:

- Score 1-5.
- Evidence from telemetry.
- Strengths.
- Concerns.
- Interviewer follow-up questions.

Scoring rules:

- Missing evidence lowers confidence.
- Passing tests alone is not enough for high score.
- High AI usage is not bad by itself; unverified AI usage is the concern.
- Running tests after AI-generated edits supports iteration quality and debugging with AI.
- Repeated failed commands without changed strategy reduces debugging/iteration scores.
- Rubric version changes must generate a new rubric version and preserve the original report basis for audit review.

## Security architecture

MVP:

- Candidate invite tokens are random and stored hashed.
- Session tokens are random and stored hashed.
- Candidate sessions expire.
- Candidate cannot access dashboard routes.
- AI API keys are server-only.
- Simulated runner executes no untrusted code.
- Telemetry route validates session token.

Production path:

- Sandbox isolation via E2B/Daytona/CodeSandbox/microVM provider.
- Per-session credentials scoped to one sandbox.
- Network egress restrictions or allowlists.
- No platform secrets in sandbox environment.
- Resource limits and command timeouts.
- Rate limiting on auth, AI, telemetry, runner, and report endpoints.
- Abuse prevention for session creation and AI calls.
- Audit logs for report views and data exports.
- Signed invite links or hashed opaque tokens.
- Session expiry and cleanup jobs.
- Data retention settings.
- Candidate PII minimization and deletion path.
- Encryption at rest/in transit through platform provider and database.

## Scalability architecture

MVP can generate reports synchronously after submit. Production should move report generation and sandbox cleanup to background jobs.

Recommended future components:

- Event ingestion route optimized for append-only writes.
- Event queue or background jobs for report generation.
- Object storage for large logs, file snapshots, and command output.
- Sandbox lifecycle reaper for expired sessions.
- AI rate limiter and per-workspace usage meter.
- Report regeneration queue when rubric or model changes.
- Materialized summaries for dashboard lists.
- Audit log table for team access.

## MVP implementation sequence

1. Add package/build hygiene: ESLint config, scripts, README, env example.
2. Add Prisma schema and seed data.
3. Add demo auth and workspace bootstrap.
4. Add dashboard and assessment creation.
5. Add invite/session creation.
6. Add candidate room with editor, AI panel, command/test panel, telemetry.
7. Add submit and report generation.
8. Add report viewer.
9. Replace fake landing CTAs with product routes.
