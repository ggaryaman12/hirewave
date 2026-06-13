# NVIDIA / OpenAI-Compatible AI Provider + Candidate Assistant Swap

Date: 2026-06-14
Status: Approved design, ready for implementation plan
Scope: Sub-project 0 (provider foundation) + candidate assistant swap

## Context

Hirewave has two AI touchpoints:

1. **Candidate AI assistant** (`lib/ai/provider.ts`) — coaching-only pair inside the
   assessment room. Today supports `deterministic` (regex templates) and `ollama`
   (Yelo-hosted `minimax-m2.5:cloud`). A rule-based guard (`lib/ai/input-guard.ts`)
   deliberately refuses to run commands or edit files. This is core to the product
   thesis: we measure how the *candidate* works, so the assistant must not do the work.
2. **Report evaluator** (`lib/evaluation/generate-report.ts`) — fully deterministic
   heuristic scorer. Out of scope here.

`.env.example` already declares `OPENAI_API_KEY`, `OPENAI_BASE_URL`, and
`AI_MODEL="gpt-4.1-mini"` but no code reads them — orphaned config.

NVIDIA Build (`build.nvidia.com`) exposes 100+ models through a single
OpenAI-compatible endpoint (`https://integrate.api.nvidia.com/v1`) with one free-tier
API key. This lets us add a real LLM provider with no vendor-specific SDK.

## Goal

Add a generic OpenAI-compatible provider so `AI_PROVIDER=openai-compatible` routes the
candidate assistant through NVIDIA-hosted `deepseek-ai/deepseek-v4-flash` (or any
OpenAI-compatible endpoint/model via env). Keep `deterministic` and `ollama` intact.
Assistant stays coaching-only. No agentic tool-calling in this slice.

This is the foundation that later sub-projects (LLM judge evaluator, challenge
generator, agent-delegation challenge type) build on.

## Non-goals (this slice)

- Streaming responses (next task, see "Follow-up").
- Tool / function calling (added with the evaluator sub-project).
- Changing the report evaluator.
- Making the candidate assistant agentic.

## Architecture

### New file: `lib/ai/openai-compatible-provider.ts`

Mirrors the structure and testability of `lib/ai/ollama-provider.ts`:

- Raw `fetch` to `${baseUrl}/chat/completions` (no `openai` npm dependency — matches the
  existing fetch-based ollama provider and keeps deps lean).
- Exported pure helpers for unit testing: config reader, request builder, response
  parser.
- POST body:
  ```json
  {
    "model": "<AI_MODEL>",
    "messages": [
      { "role": "system", "content": "<HIREWAVE system prompt>" },
      { "role": "user", "content": "<built prompt>" }
    ],
    "temperature": <AI_TEMPERATURE>,
    "top_p": <AI_TOP_P>,
    "max_tokens": <AI_MAX_TOKENS>,
    "chat_template_kwargs": { "thinking": <AI_THINKING>, "reasoning_effort": "<AI_REASONING_EFFORT>" },
    "stream": false
  }
  ```
- Auth: `Authorization: Bearer <AI_API_KEY>`.
- System prompt: reuse the existing Hirewave coaching prompt (currently
  `HIREWAVE_OLLAMA_SYSTEM_PROMPT`). Rename to a provider-neutral export
  (`HIREWAVE_ASSISTANT_SYSTEM_PROMPT`) and have the ollama provider import it, so both
  providers share one prompt.
- Prompt building: reuse the same context-assembly approach as the ollama provider
  (file context, command evidence, recent AI context, policy). Factor shared prompt
  helpers into a small shared module if duplication is meaningful; otherwise keep
  parallel but consistent.

### Config (environment)

Generic names, with fallbacks that wire up the currently-dead config:

| Var | Purpose | Fallback chain |
| --- | --- | --- |
| `AI_API_KEY` | bearer key (`nvapi-...`) | `NVIDIA_API_KEY` → `OPENAI_API_KEY` |
| `AI_BASE_URL` | OpenAI-compatible base URL | `OPENAI_BASE_URL` → `https://integrate.api.nvidia.com/v1` |
| `AI_MODEL` | model id | `deepseek-ai/deepseek-v4-flash` |
| `AI_REASONING_EFFORT` | `low`/`medium`/`high` | `low` |
| `AI_THINKING` | enable reasoning | `true` |
| `AI_TEMPERATURE` | sampling temp | `1` |
| `AI_TOP_P` | nucleus sampling | `0.95` |
| `AI_MAX_TOKENS` | output cap | `4096` |
| `AI_TIMEOUT_MS` | request timeout | reuse existing (`30000`) |

`.env` gets the real key (gitignored). `.env.example` gets placeholders only.

### Wiring

- `lib/ai/types.ts`: extend `AiProviderName` to
  `'deterministic' | 'ollama' | 'openai-compatible'`.
- `lib/ai/provider.ts`: add a third branch in `generateAiAssistantResponse` —
  `AI_PROVIDER=openai-compatible` (accept `nvidia` as an alias) calls the new provider.
  `deterministic` and `ollama` branches unchanged.
- `app/api/session/[sessionToken]/ai/route.ts`: unchanged. Guard, telemetry, and the
  existing provider-error fallback path already wrap the provider call.

## Response handling

- Candidate sees `choices[0].message.content` only.
- `choices[0].message.reasoning` / `reasoning_content` is captured into the assistant
  message `metadata` (`reasoning` field), **never returned to the candidate**.
  Rationale: chain-of-thought can leak coaching/evaluator logic (breaks the guard), but
  is valuable audit + future-judge evidence (AGENTS.md auditability).
- Token usage maps NVIDIA's `usage.prompt_tokens` / `usage.completion_tokens` into
  `buildTokenUsage({ providerPromptTokens, providerCompletionTokens })` so
  `tokenSource === 'provider'` (real counts, not estimated).
- `safetyFlags`: reuse existing `buildSafetyFlags` logic.
- Metadata also records: `provider: 'openai-compatible'`, configured model, base URL,
  finish reason, latency.

## Reliability (industry-readiness)

- AbortController timeout via `AI_TIMEOUT_MS`.
- One retry with short backoff on HTTP 429 / 5xx (free-tier rate limits).
- On final failure: throw — the route's existing `catch` writes `FALLBACK_AI_CONTENT`,
  logs `error_occurred` + `provider_error` safety flag, and the session continues. No
  new failure path needed.

## Guardrails / product boundaries (unchanged)

- `input-guard.ts` low-signal + capability-boundary checks run before the provider.
- Assistant remains coaching-only; no tools, no command execution, no file edits.
- `reasoning_effort` defaults `low` for the candidate surface (fast coaching, token
  efficiency is a scored rubric dimension; `high` reserved for the evaluator judge).

## Testing

- Tests keep `AI_PROVIDER=deterministic` (AGENTS.md requirement); no live AI in CI.
- New unit-style test with mocked `fetch` covering the new provider's pure helpers:
  request body shape (model, messages, reasoning kwargs), response parse (content +
  reasoning extraction), and token mapping (provider source). Follows the
  ollama-provider testability pattern.
- One manual live smoke call with the real key to confirm endpoint, model id, and
  reasoning fields, run only on explicit request.
- `npm run typecheck` and `npm run build` must pass.

## Security

- Real `AI_API_KEY` lives only in `.env` (gitignored). `.env.example` placeholder only.
- The dev key was shared in plaintext chat; rotate at build.nvidia.com after
  development/demos. Free-tier dev key = low blast radius.
- Never log the key; never echo it in responses or telemetry.

## Follow-up (next tasks, not this slice)

1. **Streaming** — SSE/ReadableStream from the AI route, incremental client render,
   assemble full message server-side for telemetry + reasoning capture. The
   industry-ready UX upgrade, layered on this proven base.
2. **LLM judge evaluator** — agentic, tool-calling, reuses this provider with
   `reasoning_effort: high`.
3. **Challenge generator** + **agent-delegation challenge type**.

## Acceptance criteria

- `AI_PROVIDER=openai-compatible` routes the candidate assistant through the configured
  OpenAI-compatible endpoint/model; live call returns coaching content.
- `deterministic` and `ollama` behavior unchanged.
- Reasoning captured in metadata, never shown to candidate.
- Token usage recorded with `tokenSource: 'provider'`.
- Guard still blocks low-signal and run/edit requests before the provider.
- Provider error falls back to the existing fallback message; session continues.
- Orphan `OPENAI_*` config is now read (as fallback) rather than dead.
- `npm run typecheck` + `npm run build` pass; new provider unit test passes.
