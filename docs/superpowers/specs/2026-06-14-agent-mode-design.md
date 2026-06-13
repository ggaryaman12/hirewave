# Agent Mode — AI Agent with Tool Use + Propose-and-Approve

Date: 2026-06-14
Status: Approved design, implementing
Depends on: NVIDIA / OpenAI-compatible provider (shipped)

## Context

Today's candidate assistant is coaching-only (`lib/ai/input-guard.ts` + system
prompt). It cannot run commands or edit files — by design, because the
`ai-collaboration-v1` rubric scores how the *candidate* works.

Agent mode is a NEW, opt-in challenge mode where the AI agent can run read
commands and propose file edits, and the candidate steers and approves them.
We measure delegation quality (task specification, diff review rigor,
verification, correction). Coaching mode is untouched; the two coexist and the
interviewer picks per assessment.

`Assessment.aiMode` is currently `allowed | required | disabled`. Agent mode adds
`agent`. `Assessment.allowedToolsJson` already exists to hold the tool list.
`FileSnapshot.source` and `SessionEvent.actor` already exist and carry the
candidate-vs-agent attribution we need.

## Interaction model: propose-and-approve

- Agent runs **read** tools on its own (`run_command` on a read-only allowlist,
  `read_file`).
- Agent **proposes** edits (`propose_edit`) — never applies them. Each proposal
  becomes a pending diff.
- Candidate **approves** (edit applied, attributed to the agent) or **rejects**
  (reason fed back to the agent). The agent can never approve its own edits.
- Everything is attributed (`ai_agent` vs `candidate`) so the future rubric can
  score the human's steering and review.

## Decomposition

- **Slice 1 (this spec): engine + data model + attribution.** Tool-calling in the
  provider, the agent loop, read-tool execution, pending proposals, approve/reject,
  schema + migration, telemetry. API-tested. No UI.
- **Slice 2: candidate room UI** — agent panel, proposed diffs, approve/reject.
- **Slice 3: `ai-delegation-v1` rubric + evaluator branch.**

---

## Slice 1 design

### Provider: tool-calling

Extend `lib/ai/openai-compatible-provider.ts` with a tool-aware call (additive;
the coaching path is unchanged):

- New `generateOpenAiCompatibleToolResponse({ request, tools, messages, config, fetchImpl })`
  that sends OpenAI-format `tools` + `tool_choice: 'auto'` and a full `messages`
  array (system, user, prior assistant/tool turns).
- Parse `choices[0].message.tool_calls` (array of `{ id, function: { name, arguments } }`)
  and `content`. Return a structured result:
  `{ content, toolCalls: [{ id, name, args }], finishReason, usage, reasoning }`.
- Reuse existing config/auth/timeout/retry and token mapping.

Model note: tool-calling needs a capable model (llama-3.3-70b / deepseek), not
8B. Agent mode reads its model from the same env; recommended backend is Groq
70B (fast, tool-capable). Coaching mode keeps its own model.

### Agent tools (`lib/agent/tools.ts`)

Three tools, declared in OpenAI function-schema form:

| Tool | Args | Behavior |
| --- | --- | --- |
| `run_command` | `{ command }` | Read-only allowlist: `cat <path>`, `ls`, `ls src`, `pwd`, `npm test`. Executed through the existing sandbox provider (`lib/sandbox`). Output returned to the agent. Logged. |
| `read_file` | `{ path }` | Returns file content via the existing `lib/workspace-paths` boundary. Logged. |
| `propose_edit` | `{ path, newContent, rationale? }` | Validates path through `workspace-paths`. Does NOT write. Creates a pending `AgentProposal` with a computed diff (`lib/diff/text-diff`). Returns "proposal queued" to the agent. |

All commands go through the existing allowlist + path normalization. No writes
outside the workspace boundary; no secrets exposed to the agent.

### Agent loop (`lib/agent/agent-loop.ts`)

Bounded loop (max N steps, default 6):

1. Build messages: system (agent system prompt), challenge/workspace context
   (reuse `lib/ai/prompt` context), candidate message, prior turns.
2. Call the tool-aware provider.
3. If `tool_calls`:
   - `run_command` / `read_file` → execute, append tool result message, loop.
   - `propose_edit` → create pending `AgentProposal`, append tool result, and
     **stop the loop** (return to candidate to decide). Multiple proposals in one
     assistant turn are all queued.
4. If no tool calls → return the assistant content to the candidate.
5. On step-limit → return a "needs direction" message.

Each loop persists `AiMessage` rows (roles `assistant` / `tool`) with metadata,
mirroring the coaching path so telemetry/report code keeps working.

### Approval (`lib/agent/proposals.ts`)

- `approveProposal(sessionId, proposalId)` → writes the new file content as a
  `FileSnapshot` with `source: 'ai_agent'`, marks proposal `approved`, logs
  `candidate_edit_approved`. May resume the loop with a tool result.
- `rejectProposal(sessionId, proposalId, reason)` → marks `rejected`, logs
  `candidate_edit_rejected`, feeds the reason back as a tool result so the agent
  can revise.

### Data model

```prisma
// Assessment.aiMode now also accepts "agent" (string; no enum in schema).

model AgentProposal {
  id          String           @id @default(cuid())
  sessionId   String
  aiMessageId String?          // assistant turn that proposed it
  toolCallId  String
  path        String
  newContent  String
  diffJson    String           // unified diff / hunks for review
  rationale   String?
  status      String           @default("pending") // pending | approved | rejected
  decisionReason String?
  decidedAt   DateTime?
  createdAt   DateTime         @default(now())
  session     CandidateSession @relation(fields: [sessionId], references: [id], onDelete: Cascade)

  @@index([sessionId, status])
}
```

`CandidateSession` gains `proposals AgentProposal[]`. Migration applied with the
same `prisma migrate diff | sqlite3` flow the repo already uses; `prisma generate`
regenerates the client.

### Attribution / telemetry

New `SessionEvent` types (actor in parens):
- `ai_agent_command_run` (ai), `ai_agent_file_read` (ai),
  `ai_agent_edit_proposed` (ai), `candidate_edit_approved` (candidate),
  `candidate_edit_rejected` (candidate), `ai_agent_message` (ai),
  `ai_agent_step_limit_reached` (system).

Agent-applied files use `FileSnapshot.source = 'ai_agent'`; candidate saves keep
their existing source. This is the evidence Slice 3 scores.

### API (`app/api/session/[sessionToken]/agent/route.ts`)

Separate from the coaching `ai` route so coaching stays simple.
- `POST` `{ message }` → runs the loop, returns assistant messages + any new
  pending proposals (with diffs).
- `POST` `{ proposalId, decision: 'approve' | 'reject', reason? }` → approve/reject,
  returns updated proposal + resumed messages.
- Guarded: only when `assessment.aiMode === 'agent'`; otherwise 409. Closed-session
  checks mirror the coaching route. Provider errors fall back gracefully and are
  logged (no candidate-facing crash).

### Safety / boundaries

- Read-only command allowlist; reuse sandbox provider + its policy.
- All paths normalized via `workspace-paths`; traversal/reserved roots rejected.
- Agent cannot approve, submit, change the timer, or touch other sessions.
- Step limit + per-call timeout bound cost (free-tier aware).
- Secrets never passed into agent context.

### Testing (API-level, deterministic per AGENTS.md)

- Mocked tool-aware provider that emits scripted `tool_calls`:
  - `run_command`/`read_file` execute and feed results back; loop continues.
  - `propose_edit` creates a pending proposal and stops the loop; no file written.
  - approve → `FileSnapshot` with `source: 'ai_agent'` + `candidate_edit_approved`
    event; reject → proposal `rejected` + reason fed back.
  - attribution events present; agent route 409s when `aiMode !== 'agent'`.
- `npm run typecheck` + `npm run build` pass.

## Slice 2 (outline)

Candidate room (`components/candidate/assessment-room.tsx`): agent panel showing
agent commands + outputs and proposed diffs with Approve / Reject (+ reason)
controls; candidate can keep messaging to steer. Renders only when
`aiMode === 'agent'`.

## Slice 3 (outline)

New `ai-delegation-v1` rubric (separate version; `ai-collaboration-v1` unchanged
per AGENTS.md). Dimensions e.g. Task Specification, Agent Steering, Diff Review
Rigor, Verification, Correction/Override, Efficiency. `generate-report.ts`
branches on the assessment rubric/aiMode and scores from proposals, approve/reject
decisions, agent-vs-candidate attribution, and test evidence.

## Acceptance criteria (Slice 1)

- `aiMode='agent'` assessments expose the agent route; others 409.
- Agent runs read-only commands + reads files via existing sandbox/path boundaries.
- `propose_edit` never writes; it creates a pending `AgentProposal` with a diff.
- Approve writes a `FileSnapshot` (`source: 'ai_agent'`) and logs the decision;
  reject records the reason and feeds it back to the agent.
- All agent/candidate actions are attributed in events + snapshots.
- Coaching mode (`ai`/route, guard, deterministic, ollama) is unchanged.
- Tool-calling needs a capable model; documented, with Groq 70B recommended.
- typecheck + build pass; Slice 1 API tests pass.
