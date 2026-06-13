# Product Requirements

Date: 2026-05-03
Product name: Hirewave

## Product thesis

Hirewave is an AI-native technical assessment platform for hiring software engineers. It evaluates how candidates solve realistic engineering tasks with an AI assistant, not how well they solve memorized problems without the tools they will use on the job.

The product record is the candidate's full work process: prompts, AI responses, commands, file edits, test runs, timing, failures, retries, final code, and reviewer-facing interpretation.

The enterprise-first wedge is auditability: every scored claim must tie back to evidence, scoring must be controlled through a fixed versioned `ai-collaboration-v1` rubric, and the platform should be compliance-ready before it claims production-grade enterprise controls.

## Industry-study-backed platform criteria

Industry research and competitor movement point to the same product shape: AI is becoming a normal engineering tool, but hiring teams still need consistency, integrity, and evidence. Hirewave should be designed as a work-sample evidence system, not a quiz engine.

What the platform should show:

| Surface | What it must show | Why it matters |
| --- | --- | --- |
| Session timeline | Start/end, file opens, edits, commands, tests, AI messages, errors, retries, submission | Shows how the candidate moved through the problem instead of only what they submitted. |
| Code evidence | Starter files, final files, snapshots, changed files, final diff | Lets evaluators separate meaningful fixes from superficial edits. |
| AI collaboration evidence | Prompts, model responses, context given, whether advice was verified or ignored | Measures the skill hiring teams now care about: supervising AI without outsourcing judgment. |
| Verification loop | Commands run, test output, failures, reruns, final test status | Reveals debugging discipline and whether the candidate trusted code without evidence. |
| Time allocation | Reading, editing, AI usage, testing, idle/blocked periods where available | Helps calibrate seniority and efficiency. |
| Evaluation report | Recommendation, score, dimension cards, evidence, concerns, follow-up questions | Makes the assessment reviewable and defensible. |
| Integrity signals | Controlled AI assistant, disclosed logging, invite/session expiry, suspicious pattern flags | Builds trust without making the candidate experience hostile. |
| Comparison dashboard | Candidate status, scores, key risks, report links | Turns raw sessions into hiring workflow value. |

Hiring decision criteria use the fixed 8-dimension `ai-collaboration-v1` rubric:

- Problem decomposition: did the candidate break the work into tractable steps?
- First-principles thinking: did they reason about the domain or only pattern-match?
- Creative problem solving: did they use the assistant to explore useful alternatives without losing judgment?
- Iteration quality: did they revise based on evidence?
- Debugging with AI: did they isolate failures and verify, reject, or adapt AI output appropriately?
- Architecture decisions: did they preserve boundaries, data flow, and maintainability?
- Communication clarity: did notes/prompts explain intent and tradeoffs?
- Token efficiency: did they give the assistant enough context without wasting tokens or hiding signal?

The product should avoid pure pass/fail framing. The core output is a recommendation plus a traceable evidence packet, with the hiring team able to drill into every claim.

## Core personas

### Hiring manager / recruiter

Jobs:

- Create a role-specific assessment quickly.
- Send a candidate link without needing engineering setup.
- Understand which candidates deserve engineering interview time.
- Compare candidates consistently.
- Export or share a defensible evaluation packet.

Success criteria:

- Can create and share an assessment in under 10 minutes.
- Can see status for invited, started, submitted, and reviewed candidates.
- Can understand the recommendation without reading the full trace.

### Engineering interviewer / evaluator

Jobs:

- Inspect the candidate's actual work process.
- Review final code, diffs, tests, terminal output, and AI transcript.
- Validate or override the AI-generated report.
- Prepare follow-up interview questions.

Success criteria:

- Can see why a score was given.
- Can jump from each dimension score to supporting evidence.
- Can identify whether the candidate blindly accepted AI output.

### Candidate

Jobs:

- Open a link and start without creating an account.
- Understand the task, time limit, and allowed tools.
- Work in a realistic environment with files, terminal/tests, and AI assistant.
- Submit confidently.

Success criteria:

- No install required for MVP.
- No account required.
- Clear timer and submission state.
- Candidate can use AI normally inside the platform.

### Admin / workspace owner

Jobs:

- Manage workspace members and access.
- Configure defaults for AI mode, allowed tools, challenge templates, and data retention.
- Review audit history and candidate data policy.

Success criteria:

- Clear workspace-level settings.
- No candidate data exposed to unauthorized users.
- Later: SSO, SCIM, retention controls, and billing.

## Core workflows

1. Company creates workspace.
2. Hiring team creates assessment.
3. Hiring team selects or generates challenge.
4. Hiring team configures duration, AI mode, allowed tools, role, seniority, and scoring rubric.
5. System generates a shareable candidate link.
6. Candidate enters details without account creation.
7. Candidate starts assessment in browser.
8. Candidate works in sandbox with terminal, editor, tests, and AI assistant.
9. System captures telemetry.
10. Assessment ends automatically or candidate submits.
11. Scoring engine generates report.
12. Hiring team reviews report, timeline, code diff, AI transcript, commands, and test results.
13. Hiring team compares candidates.

## MVP scope

The MVP should be buildable in this repo without solving production-grade sandbox orchestration on day one.

### Must include

- Hiring-team auth foundation. For the first local MVP, a demo login is acceptable if the auth boundary is isolated and replaceable.
- Workspace/organization data model.
- Assessment creation and list view.
- Challenge templates seeded in code/data.
- Candidate invite link.
- Candidate start page with name/email form and no account creation.
- Timed assessment session.
- Browser-based coding workspace.
- File tree.
- File editor.
- AI assistant panel with logged messages.
- Command/test runner simulation or local-development runner.
- Event telemetry capture.
- Assessment submission.
- Evidence-based evaluation report generation.
- Hiring dashboard.
- Candidate report page.
- README and `.env.example`.

### First seed challenge

Title: Debug the Broken Checkout Flow

Role: Full-stack Engineer

Duration: 60 minutes

Stack: React, Node.js, simplified mock DB for MVP; later PostgreSQL.

Scenario:

An e-commerce checkout has bugs across frontend validation, API error handling, database transaction logic, and payment flow. The candidate must inspect existing code, use tests, ask AI for help if desired, fix issues, and submit.

For MVP, this can be represented as a small virtual file system and simulated tests. The workflow must still include reading code, editing files, running tests, debugging, iterating, and submitting.

## Non-MVP / later

- Full enterprise SSO.
- Multi-language sandbox fleet.
- Live interviewer mode.
- Proctoring.
- Browser video recording.
- ATS integrations.
- Custom billing.
- On-prem deployment.
- Advanced plagiarism detection.
- Challenge marketplace.
- Candidate passport portability.
- Bias-audit dashboards.
- Report exports and signed PDF packets.

## Functional requirements

### Auth and workspace

- A hiring user can sign in to a demo workspace.
- A workspace contains users, assessments, candidates, sessions, and reports.
- Candidate invite links must not require candidate accounts.
- Candidate access is limited to a single session token.

### Assessment builder

- Hiring user can create an assessment from a challenge template.
- Required fields: title, role, seniority, duration, AI mode, allowed tools, fixed rubric version, challenge template.
- The assessment detail page shows invite link and candidate submissions.
- Empty states must guide users to create the first assessment.

### Challenge templates

- Template includes title, role, duration, stack, instructions, starter files, hidden/public test definitions, fixed rubric version, and suggested follow-up questions.
- MVP can seed templates in local data.
- Later versions move templates into DB with authoring UI.

### Candidate flow

- Candidate opens `/invite/[token]`.
- Candidate sees assessment title, duration, rules, AI policy, and privacy note.
- Candidate enters name and email.
- System creates a `CandidateSession`.
- Candidate starts `/session/[sessionToken]`.
- Timer begins at session start.
- Candidate can submit before the timer ends.
- If timer expires, session auto-submits.

### Assessment room

Layout:

- Top bar: title, timer, session status, submit button.
- Left: file tree.
- Center: code editor.
- Bottom or right: terminal/test output.
- Right: AI assistant chat.

MVP behavior:

- File tree loads starter files.
- Candidate can edit files.
- Every meaningful file edit is logged.
- Run tests command produces deterministic output based on current file content.
- AI assistant logs user messages and assistant responses.
- Submit freezes the session and generates a report.

### Telemetry

Must log:

- `session_started`
- `session_ended`
- `file_opened`
- `file_changed`
- `file_saved`
- `command_started`
- `command_output`
- `command_finished`
- `ai_prompt_sent`
- `ai_response_received`
- `test_run_started`
- `test_run_finished`
- `candidate_note_added`
- `focus_changed` if available and disclosed
- `error_occurred`

Each event includes session ID, timestamp, event type, actor, and JSON payload.

### Evaluation report

Report schema:

```json
{
  "overallRecommendation": "strong_yes | yes | maybe | no | strong_no",
  "overallScore": 0,
  "summary": "",
  "dimensionScores": [
    {
      "dimension": "",
      "score": 0,
      "evidence": [],
      "strengths": [],
      "concerns": [],
      "followUpQuestions": []
    }
  ],
  "timelineSummary": "",
  "codeQualitySummary": "",
  "aiUsageSummary": "",
  "riskFlags": [],
  "nextInterviewFocus": []
}
```

Dimensions for `ai-collaboration-v1`:

- Problem decomposition
- First-principles thinking
- Creative problem solving
- Iteration quality
- Debugging with AI
- Architecture decisions
- Communication clarity
- Token efficiency

Every dimension must cite telemetry or code evidence. If evidence is missing, the report should say so and score conservatively.

## Non-functional requirements

- Product UI should feel like a serious early-stage SaaS, not a marketing page.
- Keep product routes fast and dense; avoid landing-page motion in tools.
- Do not expose AI provider keys to the browser.
- Do not execute candidate code in the Next.js process.
- Use typed domain objects and validation.
- Keep MVP storage swappable from local/demo to Postgres.
- Keep sandbox provider swappable.
- Keep AI provider swappable.
- Make all state transitions explicit: invited, started, submitted, report_ready.

## MVP acceptance criteria

- A hiring user can open the dashboard.
- A hiring user can create an assessment from "Debug the Broken Checkout Flow."
- The app generates a candidate link.
- Candidate can open the link without account creation.
- Candidate can start a timed session.
- Candidate can edit starter files.
- Candidate can send AI assistant messages and see logged responses.
- Candidate can run tests/commands and see output.
- The app records telemetry for file edits, AI messages, commands, tests, start, and submit.
- Candidate can submit.
- Hiring user can open the report page and see recommendation, dimension scores, evidence, timeline, final files, AI transcript, commands, and test results.
- App builds cleanly.

## Product principles

- Evidence over opinion.
- AI allowed, AI supervised.
- Realistic engineering work over algorithm puzzles alone.
- Candidate flow must be low-friction.
- Reviewers must be able to audit every score.
- Enterprise claims require strict scoring controls, versioned rubrics, and compliance-ready evidence retention.
- The platform should not pretend simulated execution is production sandboxing.

## Skeptical scope decisions

- A full cloud IDE is too large for the first pass. Start with an embedded browser workspace and a sandbox provider interface.
- Real containers are not required for the first vertical slice. They are required before charging for real untrusted-code execution.
- Proctoring should not be in the MVP. Controlled AI plus telemetry gives better candidate experience and enough signal for the first product wedge.
- Do not build a candidate passport yet. The employer assessment workflow must work first.
- Do not build ATS integrations yet. A shareable report URL is enough for early design partners.
