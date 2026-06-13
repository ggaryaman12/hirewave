# API Reference

Date: 2026-05-20
Product: Hirewave

This document records the current MVP API contract implemented by the Next.js route handlers. It is intentionally honest about the local demo boundary: hiring-team auth is demo-cookie based, candidates use accountless invite/session tokens, command execution defaults to a deterministic simulated runner, and no endpoint should be presented as production SSO, production RBAC, proctoring, billing, ATS integration, or real sandbox isolation.

## Authentication And Access

| Surface | Access model | Notes |
| --- | --- | --- |
| Hiring-team pages and `/api/auth/demo` | Demo HTTP-only cookie | `/api/auth/demo` creates or loads the demo user/workspace and sets the local hiring-team cookie. |
| Candidate invite and session APIs | Public invite/session token | Candidates do not create accounts. The session token is the session boundary. |
| Report routes | Demo hiring-team page access | Report pages are hiring-team product routes; completion pages do not expose report URLs to candidates. |

Common API errors:

| Status | Meaning |
| --- | --- |
| `400` | Validation failed, including unsafe workspace file paths. |
| `404` | Session or route target was not found. |
| `409` | Candidate session is closed (`submitted`, `expired`, or `report_ready`) and no longer accepts file, AI, or command writes. |

## Demo Auth

### `GET /api/auth/demo`

Creates or loads the demo hiring user, ensures the demo workspace and default challenge exist, sets the demo auth cookie, and redirects to a safe internal route.

Query parameters:

| Name | Required | Description |
| --- | --- | --- |
| `next` | No | Internal redirect target. Absolute URLs and protocol-relative URLs are ignored and replaced with `/dashboard`. |

Response:

- `302` redirect to `next` or `/dashboard`.
- Sets the demo auth cookie for 30 days.

## Candidate Session APIs

All candidate session APIs use:

```text
/api/session/[sessionToken]/...
```

The server resolves `[sessionToken]` through its hashed token value and returns `404` when the token is unknown.

### `POST /api/session/[sessionToken]/events`

Appends generic candidate/session telemetry.

Request body:

```json
{
  "type": "file_opened",
  "payload": {
    "path": "src/cart.ts"
  }
}
```

Allowed event types:

| Type | Actor written by API | Purpose |
| --- | --- | --- |
| `file_opened` | `candidate` | Candidate opened a file in the workspace. |
| `candidate_note_added` | `candidate` | Candidate added a note. |
| `focus_changed` | `candidate` | Browser focus/state changed. |
| `error_occurred` | `system` | Client or platform error event. |

Response:

```json
{
  "eventId": "evt_id"
}
```

### `POST /api/session/[sessionToken]/files`

Saves a candidate file snapshot after server-side workspace path validation.

Request body:

```json
{
  "path": "src/cart.ts",
  "content": "export function validateCart() { ... }",
  "language": "typescript"
}
```

Path rules:

- Relative workspace paths only.
- Absolute paths, traversal paths, empty paths, and reserved roots such as `.git`, `.hirewave`, and `node_modules` are rejected.
- Closed sessions return `409`.

Response:

```json
{
  "snapshot": {
    "id": "snapshot_id",
    "path": "src/cart.ts",
    "version": 2,
    "createdAt": "2026-05-18T00:00:00.000Z"
  }
}
```

### `POST /api/session/[sessionToken]/commands`

Runs a command through the configured sandbox provider adapter and stores command/test evidence.

Request body:

```json
{
  "command": "npm test"
}
```

Default MVP commands:

| Command | Behavior |
| --- | --- |
| `npm test` | Runs deterministic checkout tests for the checkout template, or generic evidence checks for non-checkout/custom templates. |
| `ls` | Lists the virtual workspace root. |
| `ls src` | Lists the virtual `src` directory. |
| `cat <path>` | Prints a validated workspace file. |
| `pwd` | Prints the virtual workspace path. |

Provider selection:

| Environment | Behavior |
| --- | --- |
| `SANDBOX_PROVIDER=simulated` or unset | Default deterministic provider; no arbitrary untrusted code execution. |
| `SANDBOX_PROVIDER=local-dev` with `SANDBOX_LOCAL_DEV_ENABLED=true` | Local development-only host temp workspace with exact command allowlist. |
| `SANDBOX_PROVIDER=external`, `e2b`, `daytona`, or `codesandbox` | Configuration placeholder that fails closed with `external_provider_unconfigured` until a real adapter exists. |

Response shape:

```json
{
  "commandRun": {
    "id": "command_id",
    "command": "npm test",
    "status": "succeeded",
    "output": "$ npm test\nResult: 4/4 passed",
    "outputChunks": [
      {
        "stream": "system",
        "content": "$ npm test\nResult: 4/4 passed"
      }
    ],
    "exitCode": 0,
    "startedAt": "2026-05-18T00:00:00.000Z",
    "finishedAt": "2026-05-18T00:00:01.000Z",
    "sandbox": {
      "providerId": "simulated",
      "providerKind": "simulated",
      "executionMode": "simulated",
      "isolationLevel": "none",
      "networkAccess": "none",
      "networkPolicy": {
        "mode": "none",
        "outboundAccess": "none",
        "allowedHosts": [],
        "blockedByDefault": true
      },
      "capabilities": {
        "readiness": "demo_only",
        "realCodeExecution": "not_supported",
        "productionIsolation": "not_supported",
        "commandPolicy": "supported",
        "networkPolicy": "supported",
        "environmentPolicy": "supported",
        "resourceLimits": "supported",
        "workspaceSnapshots": "supported",
        "cleanupEvidence": "not_applicable"
      },
      "filesystemPersistence": "virtual",
      "cleanupPolicy": "not_applicable",
      "commandPolicy": {
        "mode": "simulated_allowlist",
        "allowedCommands": ["npm test", "ls", "ls src", "pwd"],
        "blockedByDefault": true
      },
      "snapshotCount": 0,
      "persistedSnapshotCount": 0,
      "execution": {
        "sandboxRunId": "simulated:run_id",
        "durationMs": 42,
        "timedOut": false,
        "cleanupStatus": "not_applicable",
        "outputChars": 32,
        "outputLimitChars": 20000,
        "outputTruncated": false
      }
    },
    "testResults": [
      {
        "name": "rejects missing quantities",
        "status": "passed",
        "message": "Missing quantity is rejected"
      }
    ]
  }
}
```

Telemetry side effects:

- Creates a `CommandRun` row.
- Creates `TestResult` rows when provider output includes tests.
- Logs `command_started` or `test_run_started`.
- Logs `command_output`.
- Logs `command_finished` or `test_run_finished`.
- Includes provider run ID, readiness status, capability statuses/gaps, command policy, environment policy, network policy, resource limits, mounted workspace manifest/digest, cleanup status, output stream labels, output truncation, skipped reason, and snapshot persistence metadata.

Important skipped reasons:

| Reason | Meaning |
| --- | --- |
| `command_not_allowed` | Provider policy rejected the command. |
| `invalid_workspace_file_path` | Historical file snapshots failed workspace path validation before provider execution. |
| `workspace_manifest_mismatch` | Provider received files that did not match the required manifest digest. |
| `local_dev_production_blocked` | The local-dev provider was selected in production and refused to run host commands. |
| `external_provider_unconfigured` | External provider path is selected but no real adapter exists yet. |
| `provider_error` | Provider setup or execution failed before normal completion. |

### `POST /api/session/[sessionToken]/ai`

Stores the candidate prompt, applies local guardrails, calls the configured AI provider when allowed, stores the assistant response, and logs AI telemetry.

Request body:

```json
{
  "message": "How should I approach the failing checkout tests?"
}
```

Provider behavior:

| Environment | Behavior |
| --- | --- |
| `AI_PROVIDER=deterministic` or unset | Stable deterministic assistant for tests and demos. |
| `AI_PROVIDER=ollama` | Calls `{OLLAMA_BASE_URL}/api/generate` with `{ model, system, prompt, stream: false }`. |

Guardrail behavior:

- Low-signal prompts return an input-clarifier response without a provider call.
- Requests asking the assistant to run commands or directly complete the assignment return a capability-boundary response.
- Provider failures are logged and return a fallback assistant response so the session can continue.
- Candidate requests for evaluation, grades, hiring recommendations, secrets, tokens, or credentials are tagged in safety metadata.

Response:

```json
{
  "messages": [
    {
      "id": "user_message_id",
      "role": "user",
      "content": "How should I approach the failing checkout tests?",
      "createdAt": "2026-05-18T00:00:00.000Z",
      "tokenUsage": null
    },
    {
      "id": "assistant_message_id",
      "role": "assistant",
      "content": "Start in the Terminal / tests panel with `npm test`...",
      "createdAt": "2026-05-18T00:00:01.000Z",
      "tokenUsage": {
        "promptTokens": 100,
        "completionTokens": 50,
        "totalTokens": 150,
        "tokenSource": "estimated"
      }
    }
  ]
}
```

### `POST /api/session/[sessionToken]/submit`

Closes the candidate session and generates the evidence-backed evaluation report.

Request body:

```json
{}
```

Behavior:

- If the report already exists, the endpoint is idempotent and returns the existing completion/report URLs.
- Otherwise, the session status becomes `submitted`, `submittedAt` is set, `session_ended` telemetry is logged, and `generateEvaluationReport` creates `EvaluationReport` and `ScoreDimension` rows.
- Reports use the fixed `ai-collaboration-v1` 8-dimension rubric unless a future rubric version is intentionally introduced.

Response:

```json
{
  "completionUrl": "/session/session_token/complete",
  "reportUrl": "/dashboard/reports/session_id",
  "reportId": "report_id"
}
```

## Report Export APIs

### `GET /api/reports/[sessionId]/export`

Exports the same evidence used by the hiring-team report view. This route requires the demo hiring-team cookie and workspace-scopes the session lookup before returning data.

Query parameters:

| Name | Required | Values | Description |
| --- | --- | --- | --- |
| `format` | No | `markdown`, `json` | Defaults to `markdown`. Unsupported values return `400`. |

Response:

- `200` attachment with `Content-Disposition`.
- `text/markdown; charset=utf-8` for reviewer narrative export.
- `application/json; charset=utf-8` for structured audit/export use.
- `404` when the session has no generated report in the current workspace.

The JSON export includes candidate metadata, assessment metadata, parsed report JSON, AI messages, command runs/test results, diff evidence, and final files. The Markdown export includes summary, risk flags, areas for growth, score breakdown, key moments, narrative phases, commands, AI transcript, changed files, and final file inventory.

## Report Evidence Contract

The report generator currently aggregates:

- Candidate/session metadata.
- File snapshots and final diff evidence.
- AI prompt/response counts, token usage, guardrail/fallback mix, and AI transcript.
- Broad takeover prompts such as asking the assistant to review/fix the whole codebase are surfaced through `ai_overdelegation_risk` when independent implementation or verification evidence is weak.
- Command/test rows and stream-labeled command output.
- Sandbox provider IDs, run IDs, readiness statuses, capability statuses/gaps, execution modes, isolation levels, network policies, environment policies, resource limits, cleanup statuses, workspace manifest paths/digests, and skipped reasons.
- Important checkpoint events only, not every raw telemetry event.
- Reloaded candidate sessions reconstruct command `outputChunks` and sandbox metadata from persisted `command_output` / finished command events, so a browser refresh does not hide provider evidence already captured for the run.

Sandbox metadata is audit context, not a score by itself. Non-production provider evidence must remain visibly labeled through `sandbox_not_production_ready` and `sandbox_not_production_isolated` risk flags until a real production provider exists.

## Manual Verification

Run these only when explicitly authorized:

```bash
npm run typecheck
npm run test:api
npm run test:e2e
npm run build
```

Use `AI_PROVIDER=deterministic` for deterministic local checks unless intentionally testing Ollama connectivity or live AI behavior.
