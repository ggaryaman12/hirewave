# Roadmap — what comes after the landing page

The landing page is the storefront. The platform is where the work happens. Roughly three phases.

## Phase 1 — Landing (this repo, today)

- ✅ Marketing landing with the full story
- ✅ Two-sided hero
- ✅ 3D accent
- ✅ Pricing
- [ ] Waitlist form → email capture (needs a backend or Resend/Formspree)
- [ ] `/for-candidates` and `/for-employers` deep-dive pages
- [ ] Blog / changelog (MDX)

## Phase 2 — Authenticated MVP

- **Candidate onboarding**: create a passport, pick target roles, verify identity (lightly).
- **Assessment runner**: browser-native sandboxed terminal + AI assistant. The assistant is a model call routed through our proxy so we can record the full collaboration trace.
- **Scoring pipeline**: trace → 8-dimension rubric → score + evidence snippets.
- **Employer console**: post a role, pick/compose an assessment template, get ranked candidates with evidence.

Tech additions for this phase: Postgres (Neon), Prisma, NextAuth, Server Actions, Inngest or Trigger.dev for the scoring jobs, a terminal UI (xterm.js on the client, container runtime on the server — probably Modal or Fly Machines).

## Phase 3 — Network effects

- **Passport portability**: one assessment, reusable across employers the candidate opts in to.
- **Role-calibrated rubrics**: per-role weight tuning, learned from hire outcomes.
- **Bias audits**: published quarterly, per role, per demographic slice. This is table stakes for enterprise sales.
- **Integrations**: Greenhouse, Lever, Ashby (import open roles, push shortlists back).

## Business model sketch

- Candidates free forever.
- Employers: seat-based + per-assessment.
- Enterprise: compliance + SSO + audit dashboards.

## What not to build (yet)

- Native mobile apps.
- A separate "interview" product — the assessment is the interview.
- An ATS. Integrate with existing ones.
