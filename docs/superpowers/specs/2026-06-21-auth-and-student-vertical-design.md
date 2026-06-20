# Auth + Two Verticals (Companies / Students) — Architecture

Date: 2026-06-21
Branch: `feat/dsa-leetcode-workspace` (auth work may move to its own branch)

## Goal

Turn the app into a two-sided platform on top of real authentication:

1. **Company vertical** (existing) — recruiters create assessments, invite
   candidates, read reports. Lives under `/dashboard`.
2. **Student vertical** (new) — students sign up, practice DSA, track progress
   on a personal profile (solved/tried counts, per-topic strength, AI analysis),
   compete on a leaderboard, and see truthful time/space complexity of their
   submissions.

Decisions (locked): **Auth.js v5 (NextAuth)**; **email+password + GitHub OAuth**;
**empirical** complexity (measure + curve fit, not LLM guess); Phase 1 =
**auth + roles + migrate the demo flow**.

## Decomposition (build order)

1. **Auth & accounts foundation** (this spec, built first).
2. **Student vertical + profile** — dashboard, progress, per-topic strength, AI
   analysis.
3. **DSA leaderboard** — rankings separate from company assessments.
4. **Real complexity analysis** — empirical time/space per submission.

Each later phase gets its own spec → plan → build. The data model below is added
now so later phases don't churn the schema.

## Data model (Prisma)

Added now (Phase 1):

- `User` (extend existing): `passwordHash String?`, `role String @default("student")`
  (`student` | `recruiter` | `admin`), `image String?`, `emailVerified DateTime?`.
  Existing `memberships` / `assessments` relations unchanged.
- Auth.js adapter models: `Account`, `Session`, `VerificationToken` (standard
  shapes) + relations on `User`.
- `DsaSubmission.userId String?` + relation — links a submission to a logged-in
  student. The existing anonymous / `sessionId` path keeps working.
- `DsaProblemProgress` — per-student per-problem status:
  - `id`, `userId`, `problemId`, `status` (`attempted` | `solved`),
    `attempts Int @default(0)`, `solvedAt DateTime?`, `createdAt`, `updatedAt`
  - `@@unique([userId, problemId])`, indexes on `userId` and `status`.
  - Derivation: any accepted submission ⇒ `solved`; else any submission ⇒
    `attempted` (UI "tried"); no row ⇒ unattempted (no tag).

Named now, built later: `StudentProfile` (phase 2), `ComplexityAnalysis`
(phase 4).

## Auth core (Phase 1)

- **Config** (`lib/auth/config.ts` + root `auth.ts`): Auth.js v5 with
  - Credentials provider — verify email + bcrypt password hash.
  - GitHub OAuth provider.
  - `@auth/prisma-adapter` for user/account persistence.
  - **JWT session strategy** (required so the Credentials provider works).
  - `callbacks.jwt` / `callbacks.session` inject `userId` + `role` into the
    session object.
- **Routes**: `app/api/auth/[...nextauth]/route.ts` (handlers);
  `app/api/auth/signup/route.ts` — zod-validated, bcrypt-hashes the password,
  creates a `role=student` user, rejects duplicate email (409).
- **Pages**: `/login` and `/signup` (Tailwind, matches existing dark theme).
- **Middleware** (`middleware.ts`): protect `/dashboard` (recruiter+) and
  `/profile` (any authed user); unauthenticated → `/login?next=...`.
- **Helpers** (`lib/auth/session.ts`): `getСurrentUser()`, `requireUser(role?)`
  — server-side guards used by pages/route handlers.

## Migrate the demo flow (no breakage)

- `lib/auth/demo-auth.ts#requireHiringUser` is rewritten to use `auth()` +
  workspace membership instead of the `hirewave_demo_user` cookie.
- Seed a **real demo recruiter** (email + bcrypt password, a workspace
  membership) so `/dashboard`, assessment creation, and the assessment-flow e2e
  keep working.
- `/api/auth/demo` becomes a **dev-only** convenience that signs the seeded
  recruiter in through Auth.js (guarded by `NODE_ENV !== 'production'`).
- **Untouched:** the candidate invite / `CandidateSession` token flow stays
  anonymous — taking an assessment via an invite link is not account auth.

## Routing / role gating

- `student` → `/profile` (phase 2) + `/dsa` (practice). Submitting while logged
  in records progress.
- `recruiter` / `admin` → `/dashboard`.
- Home `/` routes by role when authed, else marketing/login.

## Security

- `bcryptjs` (pure JS, no native build) for password hashing.
- `AUTH_SECRET`, `AUTH_GITHUB_ID`, `AUTH_GITHUB_SECRET` in env (+ `.env.example`).
- httpOnly + secure + sameSite cookies (Auth.js defaults).
- zod validation on signup/login; generic error on bad credentials (no user
  enumeration); duplicate-email → 409.
- Basic in-memory rate limit on signup/login routes.

## Progress wiring (Phase 1)

`submitSolution` (or the submit route) accepts the authenticated `userId` and,
when present, upserts `DsaProblemProgress`: `attempts += 1`; if verdict
`accepted` and not already solved, set `status='solved'` + `solvedAt`. Anonymous
submissions skip this. The `/dsa` list shows a per-problem tag
(solved / tried / none) when the student is logged in.

## Error handling

- Auth failures return Auth.js standard errors; signup duplicate → 409; OAuth
  account-link conflicts handled by the adapter.
- Progress upsert is best-effort and wrapped so a tracking failure never breaks
  judging.

## Testing / verification

- Playwright API: signup (creates student), login (sets session), session
  carries `role`, role-gating (student blocked from `/dashboard`, recruiter
  reaches it), duplicate-email 409, progress upsert on accepted submit.
- Migrate `tests/e2e/assessment-flow.spec.ts` to authenticate as the seeded
  recruiter; confirm it still passes.
- `tsc` clean; existing DSA judge/harness suites stay green.

## Out of scope (Phase 1)

Student profile UI, per-topic strength, AI analysis, leaderboard, complexity
analysis (later phases). Email verification flow + password reset (later;
`emailVerified` column exists for forward-compat).

## Risks

- Auth.js v5 + Credentials + Prisma adapter requires JWT sessions (DB sessions
  don't work with Credentials) — handled in config.
- SQLite is fine for dev; production scale would move to Postgres (no code change
  beyond datasource).
