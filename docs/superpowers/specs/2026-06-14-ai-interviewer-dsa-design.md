# AI Interviewer for DSA — Design Plan

Date: 2026-06-14
Status: Plan (not yet implemented)
Reuses: lib/ai (openai-compatible provider + tool-calling), agent loop pattern,
lib/judge (verdicts as signals), telemetry, evaluator pattern.

## Concept

A live, conversational AI interviewer that runs a DSA coding interview the way a
strong human interviewer does — and produces an evidence-based score. It does NOT
write the solution. It:

1. Presents/【clarifies the problem.
2. Asks for an approach + complexity BEFORE coding.
3. Watches the candidate's code + submission verdicts; gives graded hints (never
   the full answer) and nudges when stuck.
4. Probes edge cases, asks to run tests, discusses failures.
5. Asks follow-ups (optimize time/space, variations).
6. Emits a structured evaluation.

This is the natural fusion of the two systems already built: the **agent
tool-calling loop** (grounded, multi-step, coaching-only) + the **DSA judge**
(real verdicts as objective signal).

## Why it fits the existing architecture

| Need | Reuse |
| --- | --- |
| LLM with tools, multi-step | `generateOpenAiCompatibleToolResponse` + agent-loop pattern (Groq 70B, tool-capable) |
| Grounding tools | new read-only tools: `get_current_code`, `get_submission_results`, `get_problem` |
| Objective signal | DSA submissions: verdict, passed/total, attempts, time-to-AC |
| Transcript + events | telemetry (`SessionEvent`, `AiMessage`) |
| Scoring | evaluator pattern (deterministic + optional LLM-judge), new rubric version |
| No-solution boundary | same guardrail philosophy as the coaching assistant |

## Interaction model: phase-aware, hint-budgeted

The interviewer is a tool-using chat with a **phase** state machine in its system
prompt and a **hint budget**:

- `clarifying` → `approach` (must state plan + Big-O before coding is encouraged)
  → `coding` → `verifying` (run tests, discuss failures) → `followup` → `wrap`.
- Tools are READ-ONLY (it observes; it never edits the candidate's code or submits
  for them). It calls `get_current_code` / `get_submission_results` to ground hints.
- Graded hints: nudge → conceptual hint → targeted hint. Each hint is logged and
  counts against the score (more/earlier hints = lower independence).
- Two modes: **Practice** (hints free, unscored) and **Interview** (limited hints,
  scored, timed).

## Data model (additive)

```prisma
model DsaInterview {
  id          String   @id @default(cuid())
  problemId   String
  sessionId   String?            // optional link to a CandidateSession (assessment use)
  mode        String   @default("interview") // interview | practice
  phase       String   @default("clarifying")
  status      String   @default("active")    // active | submitted | report_ready
  hintsUsed   Int      @default(0)
  startedAt   DateTime @default(now())
  endedAt     DateTime?
  problem     DsaProblem @relation(fields: [problemId], references: [id])
  messages    DsaInterviewMessage[]
}

model DsaInterviewMessage {
  id           String   @id @default(cuid())
  interviewId  String
  role         String              // user | interviewer | tool
  content      String
  kind         String?             // hint | question | nudge | feedback
  metadataJson String?
  createdAt    DateTime @default(now())
  interview    DsaInterview @relation(fields: [interviewId], references: [id], onDelete: Cascade)
}
```

DSA submissions already carry `sessionId`; link interview submissions by storing
the interviewId on the submission metadata or via `sessionId`.

## Tools (read-only)

- `get_problem()` → statement, signature, difficulty, constraints.
- `get_current_code()` → candidate's current editor source (+ language).
- `get_submission_results()` → latest submissions: verdict, passed/total,
  failingCase index, runtime/memory, attempt count (NOT hidden inputs).
- `record_phase(phase)` → advance the interview phase (the only write; updates
  `DsaInterview.phase`).

## API

- `POST /api/dsa/interviews` `{problemId, mode}` → start, returns opening message.
- `POST /api/dsa/interviews/[id]/message` `{message}` → one interviewer turn
  (tool-loop, returns interviewer messages + phase + hintsUsed).
- `POST /api/dsa/interviews/[id]/finish` → generate report.

## Scoring: `dsa-interview-v1` rubric (new version)

Dimensions, each evidence-cited:
- **Problem Understanding** — clarifying questions, restating constraints.
- **Approach & Complexity** — proposed a correct plan + correct Big-O before coding.
- **Implementation** — reached Accepted; attempts; clean translation of plan.
- **Debugging & Verification** — used failures/test feedback to converge.
- **Communication** — clear reasoning in transcript.
- **Independence** — inverse of hint reliance (graded hints used, how early).
- **Optimization** — handled the follow-up (better time/space).

Signals: submission verdicts/attempts/time-to-AC (objective), transcript (LLM-judge
+ deterministic features: hintsUsed, phases reached, whether complexity stated).
Deterministic baseline + optional LLM-judge (reuse evaluator pattern; new rubric
version, `ai-collaboration-v1`/`ai-delegation-v1` untouched).

## Anti-gaming
- Hints are budgeted + logged; "just tell me the answer" → refused (boundary).
- Time-to-AC and attempt count are objective and hard to fake.
- The interviewer never submits or edits for the candidate.

## Slices
1. **Engine:** DsaInterview model + interviewer tool-loop (read-only tools) +
   phase machine + message API. Mockable provider for tests.
2. **Scoring:** `dsa-interview-v1` rubric + report (deterministic + LLM-judge).
3. **UI:** interview panel beside the `/dsa/[slug]` editor — chat, phase indicator,
   hint button (shows budget), Finish → report.
4. **Assessment integration:** interviewer-configured DSA interview as a Hirewave
   assessment type (interviewer picks problem + mode + limits), report in the
   hiring dashboard.

## Acceptance (Slice 1)
- Start an interview; interviewer greets + asks for approach before coding.
- Interviewer grounds hints via `get_current_code` / `get_submission_results`.
- Hints are graded + counted; it never reveals a full solution or submits.
- Phase advances; transcript + events persisted. typecheck + tests pass.
```
