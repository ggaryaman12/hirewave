# Market Research

Date: 2026-05-03

## Research summary

The technical assessment market has split into two tracks.

Traditional platforms are adding AI assistance, AI proctoring, AI-generated assessments, and richer scorecards to existing coding-test/interview products. Newer AI-native products are starting from the opposite premise: AI is part of the job, so the assessment should measure how candidates plan with AI, supervise AI, verify generated code, debug failures, and communicate tradeoffs.

The wedge for Hirewave should not be "another coding test with a chatbot." The wedge should be an evidence-first assessment record: a live engineering workspace, built-in AI assistant, full process telemetry, and structured reports that explain how a candidate worked, not only whether tests passed.

## Industry study takeaways

The industry signal is clear: AI coding tools are now part of normal engineering work, while hiring teams still need defensible, comparable evidence. A modern assessment platform should therefore allow AI, control the environment, and judge the candidate's supervision of the tool rather than pretending AI does not exist.

Practical implications for Hirewave:

- The platform should show the work trace, not only a final score: files opened, edits, commands, test runs, AI prompts/responses, timing, retries, and final diff.
- The default assessment format should be realistic repo work with multiple failure modes, because one-shot algorithm answers are easier to fake and less predictive of AI-era engineering.
- The scoring rubric should separate code correctness from AI collaboration. A candidate can pass tests while showing weak judgment, or fail some tests while showing strong debugging and supervision.
- The reviewer experience should be evidence-cited. Every dimension score needs links back to telemetry, code, terminal output, or AI transcript.
- Integrity should come from controlled tooling, transparent logging, and challenge design first. Proctoring can be a later enterprise add-on, not the core trust mechanism.
- Candidate experience matters commercially: no account creation, clear rules, clear AI policy, visible timer, and no surprise surveillance in the MVP.
- The buying wedge should be reviewer efficiency and confidence: "send one link, get a replayable engineering work sample and structured follow-up questions."

## Direct inspiration

| Product | What it offers | Notable public positioning | Pricing observed | Lessons for Hirewave |
| --- | --- | --- | --- | --- |
| ArcEval / hire.vizuara.ai | AI-native engineering assessments, sandboxed terminal, real AI assistant, 8-dimension reports, templates across full-stack/backend/frontend/data/DevOps, no candidate account setup | "Hire engineers who think with AI"; captures prompts, responses, commands, edits, and decisions | Starter $149/mo for 50 assessments; Growth $499/mo for 250; Enterprise custom | Closest category reference. We should borrow the category insight, not the exact product. Compete on deeper evidence, better reviewer workflow, extensible sandbox providers, and serious SaaS architecture. |

ArcEval's public page is unusually aligned with our target: it explicitly says candidates work in a sandboxed terminal with a real AI coding assistant, every prompt/response/command is recorded, and the report scores 8 AI-collaboration dimensions. It also lists "Fix the Broken Checkout Flow" as a sample full-stack challenge, which matches our seed challenge direction.

## Competitor table

| Product | Category | Current AI posture | Strengths | Gaps/opportunities for us |
| --- | --- | --- | --- | --- |
| HackerRank | Incumbent technical screening/interview platform | AI-assisted IDE, AI proctoring, identity verification, scorecard/evaluation assistance, AI interviewer support | Huge question library, ATS integrations, enterprise trust, high-volume screening | Legacy test framing; AI features can feel bolted on. Opportunity: process-native AI collaboration scoring and richer session evidence. |
| CodeSignal | Skills platform spanning hiring, learning, education | AI interview agents, AI-powered recommendations, AI proctoring, AI interview creation, in-session AI assistance | Broad validated-skills platform, credits model, compliance posture | Broad platform dilutes deep engineering-workflow specificity. Opportunity: narrower product that feels like real engineering work. |
| CoderPad | Collaborative coding interviews and take-home projects | AI Assist lets candidates/interviewers use models in the pad; prompt history/code edits are reviewable | Developer-friendly collaborative IDE, 99+ interview languages/frameworks, code playback, live interview muscle | More interview-pad oriented than async AI-collaboration evaluation. Opportunity: async evidence packet and telemetry-first scoring. |
| Codility | Screening and structured technical interviews | Cody AI assistant; AI-control messaging; proctoring/plagiarism | Large task library, structured enterprise hiring features, studies/compliance | Traditional invite/test model. Opportunity: real-world repo tasks and AI supervision rubric. |
| Qualified | Developer assessments and code-pairing | Public docs emphasize performance-oriented real-environment assessments; AI posture less prominent in reviewed docs | Developer-friendly IDE and unit-test based assessments | Less clearly AI-native. Opportunity: own AI collaboration analytics. |
| TestGorilla | Broad skills testing platform | AI resume scoring, conversational AI interviews, auto-scored coding tests | Huge general skills library, candidate management, integrations, SOC 2/GDPR posture | Broad HR suite, less deep engineering workflow. Opportunity: specialist engineering signal. |
| Karat | Human-led technical interviewing service | Positions around human + technology and insights into how engineers solve problems/collaborate with AI | Trust, trained interviewers, enterprise process, fairness positioning | Services-heavy and likely expensive. Opportunity: async scalable product for teams that still want evidence. |
| Interviewing.io | Interview practice/interview marketplace | More mock/live human interview network than assessment SaaS | Strong candidate-side trust and realistic interviewer practice | Not a hiring-team SaaS assessment workflow. Opportunity: employer evidence packet and standardized async review. |
| InterviewLM | AI-native technical assessments | Secure AI-enabled sandboxes, every AI prompt logged, file/command/code evolution tracking, AI collaboration scoring | Directly targets AI collaboration, anti-cheating controls, role/seniority configuration | Claimed controls are strong; opportunity is credible MVP execution, transparent evidence, and extensible challenge authoring. |
| DevMesh | AI-native engineer assessments | Evaluates orchestration of AI agents, includes real-time assessment transcript and stakeholder simulation | Focus on ambiguous problems and agent orchestration | Looks early/narrow. Opportunity: broader practical engineering workflow and data model. |
| Exterview / EX Code | Agentic coding intelligence | Agent monitoring, advanced cloud IDE, intervention tracking, 28 AI-powered assessments | Enterprise/compliance posture, production-system categories, integrations | Enterprise-heavy. Opportunity: faster self-serve team adoption. |
| Tandem AI | AI-native technical interview platform | AI-assisted planning evaluation, full workflow capture, structured AI collaboration scoring | Strong focus on ambiguous planning before coding | Appears lightweight/early. Opportunity: deeper coding workspace, telemetry, and reports. |
| DEVCalcine | AI-era coding assessments | Multi-service environments, built-in AI assistant, prompt engineering analysis, playback/proctoring | Clear production-like task and multi-service message | Claims are broad. Opportunity: evidence-first, less proctoring-heavy candidate experience. |
| Saffron, CodeSubmit, Codeaid, HireVue coding | Adjacent AI/technical assessment products | AI-ready or AI-resilient messaging; varies by product | Confirms category heat | Differentiation needs to be narrow, credible, and workflow-deep. |

## Feature comparison

| Capability | Traditional incumbents | AI-native newcomers | Hirewave target |
| --- | --- | --- | --- |
| Candidate AI allowed | Increasingly optional/configurable | Core assumption | Core assumption |
| Built-in AI assistant | Added to IDE/interview room | Core product surface | Core surface, proxied and logged |
| Prompt/response capture | Emerging | Core | Core append-only telemetry |
| File/command/test telemetry | Often code playback and test results | Varies, usually claimed | Full event stream with typed event model |
| Realistic repo tasks | Some project/multi-file support | Core message | Core challenge format |
| Sandboxed execution | Mature in incumbents, varied in startups | Claimed | MVP simulated/local; provider abstraction for E2B/Daytona/CodeSandbox/Docker |
| Reviewer report | Scorecards, plagiarism, replays | AI-collaboration reports | Evidence-cited structured JSON plus human-review UI |
| Candidate no-account flow | Common for invite links | Common | Required |
| Candidate comparison | Common in mature platforms | Often basic | Required for dashboard |
| Anti-cheating | Proctoring, plagiarism, identity | Controlled AI, network restrictions, behavior flags | Controlled environment plus transparent integrity signals, not hostile surveillance in MVP |
| Enterprise compliance | Strong in incumbents | Strong claims by some | Later; design for audit logs, retention, RBAC now |

## Pricing observations

- ArcEval: $149/mo Starter for 50 assessments and $499/mo Growth for 250 assessments; enterprise custom.
- HackerRank: public work pricing showed Starter at $165/mo billed annually and Pro at $375/mo billed annually, with extra attempts around $20 and enterprise custom pricing.
- CodeSignal: public pricing showed Build at $99/mo monthly or $79/mo annual, Grow at $599/mo monthly or $479/mo annual, credits-based usage, and enterprise custom.
- CoderPad: public pricing showed a free plan with 2 tests/interviews per month, Starter at $120/mo monthly or $80/mo annual, Team at $400/mo, and overage around $25 per test/interview.
- Codility: public pricing showed Starter at $1200/year for 120 invites and Scale at $600/mo or $6000/year for 25 invites/month, with custom enterprise.
- TestGorilla: public pricing is credit-based and broad; technical assessment features include built-in IDE, code playback, automated scoring, debugging challenges, and custom coding challenges in paid tiers.
- Karat, Exterview, DevMesh, Tandem AI, and DEVCalcine were primarily demo/contact-sales oriented in reviewed public pages.

Implication: a self-serve MVP can credibly start around the ArcEval/CoderPad/CodeSignal SMB band if it has real workflow value. But pricing is a later decision; right now the product must prove evidence quality.

## What modern technical assessment platforms offer

- Multi-file coding environments and collaborative IDEs.
- Prebuilt and custom challenge libraries.
- Auto-scoring via tests, rubrics, plagiarism signals, and AI-assisted scorecards.
- Proctoring, ID verification, focus/tab tracking, and fraud indicators.
- ATS integrations and team review workflows.
- Code playback and timeline-style review.
- AI-generated tests/questions and AI interview agents.
- Increasing support for in-assessment AI assistants.

## What they are still missing

- A normalized process trace that makes AI collaboration auditable across tools and sessions.
- Evidence-cited evaluation that avoids generic AI praise.
- Strong separation between "allowed AI" and "candidate outsourced all judgment."
- Challenge design that resists one-shot prompting because it requires reading, testing, debugging, and sequencing.
- A humane candidate experience that does not rely on invasive proctoring as the main trust mechanism.
- Transparent sandbox isolation posture for smaller teams.
- Reviewer UX that combines transcript, code diff, command log, tests, timing, and score evidence in one packet.

## How AI-assisted interviews differ from traditional coding tests

Traditional tests ask: can the candidate produce the expected answer under constrained tooling?

AI-assisted assessments ask:

- Can the candidate turn ambiguous work into a concrete plan?
- Can they prompt with enough context to get useful output?
- Can they inspect AI output instead of accepting it blindly?
- Can they run tests, interpret failures, and revise?
- Can they manage time between reading, coding, asking, debugging, and explaining?
- Can they retain architectural judgment while using an assistant?

The assessment unit shifts from "final answer" to "work process plus final code."

## Telemetry needed to evaluate AI collaboration

Minimum event and artifact set:

- Session start/end, timer state, and submission state.
- File open/change/save snapshots and final diff.
- AI prompts, AI responses, model metadata, latency, and context references.
- Terminal commands, outputs, exit codes, and durations.
- Test runs, passed/failed counts, assertion failures, and rerun patterns.
- Candidate notes and self-explanations.
- Focus changes if available and disclosed.
- Error events, retries, and recovery.
- Time allocation by activity.

This telemetry should be append-only. Derived scores can be regenerated from raw events.

## Challenges hard to fake with a single prompt

- Multi-bug debugging where the first fix reveals later failures.
- Tasks requiring tests to be run and interpreted.
- Tasks with misleading AI traps, stale comments, or partial existing implementations.
- Repo navigation tasks requiring local context, not generic algorithm knowledge.
- Cross-layer bugs spanning frontend validation, API behavior, persistence, and error handling.
- Security or tenancy bugs where a superficial fix passes happy-path tests but fails isolation.
- Performance tasks that require measurement before and after changes.
- Backward-compatible migrations where old behavior must keep working.

## Automatic vs human-reviewed scoring

Automatically score:

- Test pass/fail and command outcomes.
- Time allocation and activity sequence.
- Prompt count, prompt specificity heuristics, and context references.
- Evidence extraction from event stream.
- Final diff size, touched files, and lint/type/test status.
- Risk flags such as no tests run, excessive copy-paste, or final submission with failing tests.

Human review should cover:

- Architecture judgment.
- Whether the solution is maintainable.
- Whether AI use was appropriately supervised.
- Tradeoff quality and communication.
- Seniority calibration.
- Edge cases not covered by tests.
- Hiring recommendation.

AI can draft the report, but the UI should present it as a review aid, not unquestionable truth.

## Security controls needed for untrusted code

- Per-session isolated filesystem, process namespace, and network policy.
- No access to platform secrets or server-side environment variables.
- Short-lived sandbox credentials.
- Resource limits: CPU, memory, disk, process count, wall-clock timeout.
- Network restrictions or allowlists for docs/package registries as needed.
- No candidate-provided code execution in the Next.js web process.
- Full sandbox lifecycle cleanup and stale-session reap jobs.
- Signed, expiring invite/session tokens.
- Rate limits on AI, telemetry, commands, and session creation.
- Audit logs for hiring-team access to candidate data.
- Data retention controls and candidate PII handling.

For production-grade untrusted code, microVM or dedicated sandbox providers are preferable to raw Docker on the same host. Docker may be acceptable for local development only when clearly labeled as non-production isolation.

## Credible anti-cheating without destroying candidate experience

- Make AI allowed, controlled, and logged.
- Provide the same in-product AI assistant to every candidate.
- Restrict external network access gradually rather than defaulting to invasive surveillance.
- Track focus/clipboard only if disclosed.
- Use challenge design that rewards investigation and verification.
- Use session replay and timeline evidence for review.
- Detect suspicious patterns, but avoid opaque automated rejection.
- Keep candidate accountless and low-friction.

## Smallest MVP that feels real

The smallest credible MVP is not a full cloud IDE. It is:

1. Hiring dashboard with seeded workspace and demo auth.
2. Assessment builder using challenge templates.
3. Invite link that starts an accountless candidate session.
4. Browser assessment room with file tree, Monaco-like editor or textarea MVP, terminal/test output panel, AI assistant chat, timer, and submit.
5. Simulated or local runner for the first seed challenge.
6. Append-only event telemetry for every meaningful action.
7. Evidence-based generated report from telemetry and final files.
8. Hiring report page with timeline, code, AI transcript, commands/tests, and scores.

This can be built in the current repo while preserving a provider interface for real sandboxes.

## Suggested differentiation

Hirewave should position around:

- "Evaluate AI supervision, not AI access."
- Full evidence packet: prompts, AI responses, commands, file edits, tests, time, final code.
- Realistic debugging and extension challenges that require iteration.
- Reviewer-grade reports with citations to telemetry.
- Sandbox provider abstraction from day one.
- Candidate-friendly, no-account flow.
- Honest anti-cheating: controlled tools and observable process instead of surveillance-first proctoring.

## Risks and skeptical counterarguments

- Incumbents can add similar AI reports quickly. Counter: win on depth of process telemetry and challenge design, not generic "AI score."
- AI-generated evaluation can be biased or generic. Counter: require evidence citation for every dimension and expose raw trace to reviewers.
- Real sandbox execution is expensive and operationally hard. Counter: start simulated/local, design adapter now, integrate E2B/Daytona/CodeSandbox after workflow proves valuable.
- Candidates may dislike being monitored. Counter: make monitoring transparent, role-relevant, and limited to the assessment workspace.
- Hiring teams may still want standard LeetCode-like filters. Counter: position as the second-stage high-signal assessment or a replacement for take-home projects, not the only top-of-funnel filter at first.
- Challenge leakage is inevitable. Counter: generate variants, use multi-step debug tasks, and evaluate process, not only final answer.

## Sources used

- ArcEval / Vizuara: https://hire.vizuara.ai/
- HackerRank pricing: https://www.hackerrank.com/work/pricing
- HackerRank AI features: https://support.hackerrank.com/hc/en-us/articles/35288933801491-HackerRank-s-AI-Features
- CodeSignal pricing: https://codesignal.com/pricing/
- CoderPad homepage: https://coderpad.io/
- CoderPad pricing: https://coderpad.io/pricing/
- Codility pricing: https://www.codility.com/pricing/
- Qualified: https://www.qualified.io/ and https://docs.qualified.io/for-teams/
- TestGorilla pricing: https://www.testgorilla.com/pricing/
- Karat: https://karat.com/
- InterviewLM: https://www.interviewlm.com/
- DevMesh: https://www.devmesh.live/
- Exterview EX Code: https://exterview.ai/coding-intelligence
- Tandem AI: https://www.tandemai.tech/
- DEVCalcine: https://devcalcine.com/
- CodeSandbox SDK: https://codesandbox.io/sdk
- E2B Sandbox docs: https://e2b.dev/docs/sdk-reference/code-interpreter-js-sdk/v2.3.0/sandbox
- Daytona sandboxes: https://www.daytona.io/docs/en/sandboxes/
- StackBlitz WebContainers browser support: https://developer.stackblitz.com/platform/webcontainers/browser-support
- StackBlitz WebContainers troubleshooting: https://developer.stackblitz.com/platform/webcontainers/troubleshooting-webcontainers
- GitHub Codespaces security: https://docs.github.com/en/codespaces/reference/security-in-github-codespaces
- Firecracker: https://github.com/firecracker-microvm/firecracker
- Stack Overflow Developer Survey 2025 AI: https://survey.stackoverflow.co/2025/ai
- JetBrains AI coding tools research 2026: https://blog.jetbrains.com/research/2026/04/which-ai-coding-tools-do-developers-actually-use-at-work/
- CoderPad State of Tech Hiring 2026: https://coderpad.io/survey-reports/coderpad-state-of-tech-hiring-2026/
- Claude Code docs: https://docs.anthropic.com/en/docs/agents-and-tools/claude-code/overview
- Cursor features: https://www.cursor.com/features
- GitHub Copilot coding agent docs: https://docs.github.com/copilot/concepts/coding-agent/enable-coding-agent
- OpenAI Codex docs: https://platform.openai.com/docs/codex
- Continue docs: https://docs.continue.dev/
- Aider: https://aider.chat/
