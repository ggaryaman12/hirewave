# Product Walkthrough Script

Audience: enterprise hiring leaders, engineering managers, recruiting operators  
Length: 3-5 minutes  
Demo path: `/dashboard` -> `/dashboard/assessments/new` -> `/dashboard/assessments/[assessmentId]` -> `/invite/[token]` -> `/session/[sessionToken]` -> `/dashboard/reports/[sessionId]`

## Positioning

Hirewave is an enterprise-first AI collaboration assessment platform. The product is not trying to be another algorithm test. It evaluates realistic AI-assisted engineering work: how a candidate decomposes a problem, asks AI for help, verifies output, debugs failures, changes code, and explains their choices.

The story is deliberately simple:

1. Create a Challenge.
2. Share One Link.
3. Get AI-Scored Reports.

Every score should be backed by session evidence: prompts, AI responses, commands, tests, file edits, final files, and timing.

## Demo Script

### 0:00-0:30 - Open the hiring dashboard

Open `/dashboard`.

Narration:

"This is the hiring team workspace. For the MVP, authentication is demo-cookie based, so this is not production SSO or enterprise RBAC yet. The important workflow is already visible: assessments, candidate sessions, and submitted reports."

Point out:

- "New assessment" action.
- Assessment count, candidate session count, submitted count.
- Existing assessment cards if seeded or previously created.

### 0:30-1:15 - Create a challenge

Click "New assessment" or open `/dashboard/assessments/new`.

Narration:

"The first step is Create a Challenge. In this MVP, the product uses a seeded challenge template, `Debug the Broken Checkout Flow`. The hiring team configures the role, seniority, duration, and AI mode. The important enterprise direction is a controlled, versioned assessment experience rather than ad hoc take-home prompts."

Show:

- Assessment title, role, seniority, duration.
- AI mode: "Allowed and logged", "Required", or "Disabled".
- Challenge template card with scenario and stack.

Click "Create assessment".

Do not claim custom rubric creation here. The approved v1 direction is a fixed, versioned `ai-collaboration-v1` rubric.

### 1:15-1:55 - Share one candidate link

After creation, open `/dashboard/assessments/[assessmentId]`.

Narration:

"The second step is Share One Link. The hiring team gets a candidate invite URL. The candidate does not need to create an account. The assessment detail page also shows sessions, AI message counts, command counts, and report availability."

Show:

- Candidate link.
- "Open invite" action.
- Challenge title, scenario, stack, allowed tools, starter file count.
- Empty or existing candidate sessions.

Open the invite link.

### 1:55-2:30 - Candidate starts without an account

On `/invite/[token]`, enter candidate name and email.

Narration:

"The candidate sees the assessment instructions and starts with only name and email. This keeps the candidate flow low-friction while still recording the work session for evaluator review."

Show:

- Duration.
- AI policy.
- "No candidate account".
- Notice that prompts, AI responses, file edits, commands, tests, timing, and final code are recorded.

Click "Start assessment".

### 2:30-3:30 - Candidate works with AI and tests

On `/session/[sessionToken]`, show the assessment room.

Narration:

"This is the AI-assisted engineering workspace. The candidate can inspect starter files, edit code, run the simulated test command, and ask the assistant for debugging help. The point is not only whether the final code works. The system captures the process: what they inspected, what they asked AI, whether they verified suggestions, and how they iterated."

Show:

- File tree.
- Textarea editor.
- Timer.
- "Run tests" action in Terminal / tests.
- AI assistant prompt and response area.
- Submit button.

Suggested demo actions:

- Open one or two files.
- Run tests once to show terminal output.
- Ask AI for a debugging plan or specific hint.
- Make a small edit if the prepared demo state supports it.
- Run tests again.
- Submit.

MVP limitation to state if asked:

"The current runner is simulated and deterministic. It is not a production sandbox for untrusted code execution yet."

### 3:30-4:45 - Review the AI-scored report

After submission, return to `/dashboard/assessments/[assessmentId]` and open `/dashboard/reports/[sessionId]`.

Narration:

"The third step is Get AI-Scored Reports. Hirewave produces an evidence-backed report rather than a black-box pass/fail result. The enterprise buyer can inspect the recommendation, dimension scores, evidence, transcript, commands, tests, final files, risk flags, and next interview focus."

Show:

- Overall recommendation and score.
- Timeline, code quality, and AI usage summaries.
- Dimension scores.
- Evidence, strengths, concerns, and follow-up questions.
- AI transcript.
- Commands and tests.
- Final files.
- Next interview focus.

Tie the report to the fixed rubric:

"The approved v1 rubric is `ai-collaboration-v1`, with eight dimensions: Problem Decomposition, First-Principles Thinking, Creative Problem Solving, Iteration Quality, Debugging with AI, Architecture Decisions, Communication Clarity, and Token Efficiency."

### 4:45-5:00 - Close with differentiation

Narration:

"HackerRank and Codility are strongest when you want controlled coding tests. Hirewave is for the new hiring question: how does this engineer work when AI is part of the workflow? The differentiator is full process telemetry and evidence-backed scoring for realistic AI-assisted engineering work."

Close honestly:

"This is an MVP. It currently uses demo auth, SQLite, a simulated runner, and deterministic or Ollama-backed AI. The enterprise path adds production auth, RBAC, SSO, real sandbox isolation, audit controls, retention, and compliance workflows without changing the core product story."

## Do Not Say

- "Production-ready enterprise security" before the target controls exist.
- "Real sandbox isolation" while the runner is simulated.
- "SSO/RBAC/compliance certified" while those are roadmap items.
- "Fully automated hiring decision" because reports should inform reviewers, not replace hiring judgment.
- "Custom rubric builder" for v1. The approved v1 direction is fixed and versioned.
