# Founder Sales Deck Outline

Audience: enterprise engineering and talent leaders  
Length: 8-10 slides  
Goal: explain why Hirewave exists, why now, how the product works, and why it is differentiated

## Slide 1 - Hirewave

Headline: Evidence-backed AI collaboration assessments for engineering hiring.

Key points:

- Enterprise-first assessment platform for realistic AI-assisted engineering work.
- Built around process telemetry, not only final answers.
- Simple workflow: Create a Challenge, Share One Link, Get AI-Scored Reports.

## Slide 2 - The Hiring Problem Has Changed

Headline: AI changed engineering work, but hiring signals did not catch up.

Key points:

- Candidates already use AI in real software work.
- Traditional coding tests mostly measure isolated problem solving.
- Hiring teams need to know how candidates decompose problems, prompt AI, verify output, debug, and communicate decisions.

## Slide 3 - Existing Platforms Leave A Gap

Headline: HackerRank and Codility test code output. Hirewave tests AI-assisted engineering process.

Comparison:

| Buyer question | Traditional coding test | Hirewave |
| --- | --- | --- |
| Can they solve a bounded exercise? | Strong fit | Supported, but not the main wedge |
| How did they use AI? | Usually limited | Captured in transcript and telemetry |
| Did they verify AI output? | Hard to know | Commands, tests, retries, and final files are visible |
| Can reviewers defend the score? | Depends on platform/report | Evidence-backed dimension scoring |

## Slide 4 - Product Workflow

Headline: Three steps for hiring teams.

Flow:

1. Create a Challenge.
2. Share One Link.
3. Get AI-Scored Reports.

Product proof:

- Current MVP routes support assessment creation, candidate invite, accountless candidate session, AI assistant, simulated tests, submission, and report review.
- Candidate flow does not require account creation.

## Slide 5 - What Hirewave Captures

Headline: Full process telemetry becomes the assessment record.

Evidence captured in the MVP:

- AI prompts and responses.
- File opens, edits, and saves.
- Command/test runs.
- Session timing and retries.
- Final file snapshots.
- Report evidence, strengths, concerns, risk flags, and next interview focus.

## Slide 6 - The Fixed V1 Rubric

Headline: One versioned rubric keeps reports comparable and auditable.

Rubric version: `ai-collaboration-v1`

Dimensions:

- Problem Decomposition.
- First-Principles Thinking.
- Creative Problem Solving.
- Iteration Quality.
- Debugging with AI.
- Architecture Decisions.
- Communication Clarity.
- Token Efficiency.

Buyer value:

- Comparable reports across candidates.
- Stable audit trail.
- Avoids custom-rubric sprawl in v1.

## Slide 7 - Report Experience

Headline: Not a black-box score. A reviewer-ready evidence packet.

Report sections:

- Overall recommendation and score.
- Dimension scores with evidence.
- Timeline, code quality, and AI usage summaries.
- AI transcript.
- Commands and tests.
- Final files.
- Risk flags and next interview focus.

Positioning:

- The report informs hiring teams. It does not replace human review or final hiring judgment.

## Slide 8 - Enterprise Direction

Headline: Designed for the controls enterprise buyers will ask for.

Current MVP:

- Demo auth.
- SQLite.
- Deterministic or Ollama-backed AI provider.
- Simulated runner.
- Evidence-backed report UI.

Target direction:

- Production authentication and workspace RBAC.
- SSO.
- Real sandbox isolation and network policy.
- Audit history.
- Retention controls.
- Provider/model metadata on reports.
- Exportable evidence packets.

## Slide 9 - Why Now

Headline: AI usage is becoming a hiring signal.

Key points:

- Engineering teams are normalizing AI-assisted development.
- Interview processes need to evaluate judgment, verification, and collaboration with AI.
- The strongest moat is not owning a foundation model. It is a validated assessment system with proprietary work-sample traces and human-reviewed scoring outcomes.

## Slide 10 - Ask

Headline: Partner with design customers to validate enterprise AI collaboration assessment.

Ask options:

- Run pilot assessments for one engineering role.
- Compare report usefulness against existing coding-test workflow.
- Co-design enterprise controls required for procurement.
- Provide reviewer feedback to improve scoring consistency and report clarity.

## Speaker Notes

- Lead with the enterprise buyer's risk: AI is now in the workflow, but hiring teams lack defensible evidence about how candidates use it.
- Keep differentiation specific: realistic AI-assisted engineering work, full process telemetry, evidence-backed reports.
- Be explicit that production enterprise controls are target roadmap items, not current MVP claims.
