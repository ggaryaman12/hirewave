# Current Repo Audit

Date: 2026-05-03

## Executive summary

This repository is currently a polished Next.js marketing site for Hirewave. It is not yet a working assessment platform. There is one public route (`/`), no API routes, no database, no auth, no candidate session state, no assessment builder, no sandbox runtime, no AI proxy, no telemetry ingestion, and no report generation.

The existing landing work is useful as brand and marketing surface, but the product implementation should be added as a separate application layer: authenticated hiring dashboard routes, public candidate invite/session routes, a typed domain model, an append-only telemetry model, and provider abstractions for AI and sandbox execution.

## Skill note

The requested `init-project` skill was read from `/Users/aryamangupta/.codex/skills/init-project/SKILL.md`. That skill runs `npx @claude-flow/cli@latest init` and creates Claude-flow/Ruflo config files. I did not run it during the audit because it would add unrelated project scaffolding before the product architecture is chosen. The repo already contains a `.claude/` folder.

## Tech stack

| Area | Current state |
| --- | --- |
| Framework | Next.js 14.2.15 App Router |
| Runtime | Node.js v25.6.1 locally |
| Package manager | npm, confirmed by `package-lock.json` |
| Language | TypeScript with `strict: true` |
| UI | React 18, Tailwind CSS 3, Framer Motion, GSAP, Lenis, lucide-react |
| 3D/graphics deps | `three`, `@react-three/fiber`, `@react-three/drei`, `postprocessing`, though the current app appears to use custom orbital SVG/CSS components instead of an active R3F scene |
| Styling | Tailwind plus global CSS variables in `app/globals.css` |
| Routing | App Router, only `app/page.tsx` and `app/layout.tsx` |
| Deployment assumptions | Vercel linked through `.vercel/`; `main.md` says production deploy exists at `https://hirewave-blue.vercel.app` |
| Database | None |
| Auth | None |
| API routes/server actions | None found |
| Background jobs | None |
| External services | None wired in code |
| Tests | No test script and no test framework |
| Lint | `next lint` script exists, but no ESLint config exists, so lint prompts interactively |

## Repository map

```text
app/
  layout.tsx        Metadata and root HTML shell
  page.tsx          Renders <PageShell />
  globals.css       Theme tokens, paper background, utility classes

components/layout/
  page-shell.tsx    Client shell that gates the landing behind a cinematic intro
  smooth-scroll.tsx Lenis smooth-scroll wrapper

components/sections/
  navbar.tsx
  pinned-hero.tsx
  logos-marquee.tsx
  how-it-works.tsx
  horizontal-dimensions.tsx
  for-candidates-for-employers.tsx
  proof.tsx
  pricing.tsx
  faq.tsx
  final-cta.tsx
  footer.tsx
  dimensions.tsx       Unused alternate dimensions section
  intro-splash.tsx     Unused older intro component

components/ui/
  Motion, grid, marquee, orbital rings, counters, and visual primitives

brainstorm/
  Product, landing, design, tech, component, and roadmap notes from the original landing-page work

lib/
  utils.ts          `cn()` helper only
```

## Current implemented features

- Cinematic landing-page entry splash.
- Scroll-driven landing page with pinned hero, how-it-works motion, dimensions carousel, candidate/employer split, proof stats, pricing, FAQ, final CTA, and footer.
- Warm editorial visual system documented in `main.md` and `brainstorm/`.
- Responsive marketing sections with motion and reduced-motion CSS fallbacks.
- Static build for `/` succeeds.

## Current missing product features

- Hiring team sign-in.
- Workspace/organization model.
- Assessment CRUD.
- Challenge templates stored as data.
- Candidate invite links.
- Candidate start page without account creation.
- Timed assessment session.
- Browser coding workspace.
- AI assistant panel.
- Sandbox or command runner.
- File editing persistence.
- Event telemetry capture.
- Submission state.
- AI evaluation report generation.
- Hiring dashboard.
- Candidate comparison.
- Report/timeline/code-diff viewer.
- Security controls for untrusted code.
- Audit logs, retention policy, and PII handling.

## Existing architecture

The app is currently static-first:

- `app/page.tsx` delegates to a client component.
- `PageShell` holds local UI state only: the landing page is hidden until the intro CTA sets `entered = true`.
- All product claims and feature examples are static copy.
- All CTA routes are anchors or `#`, not real product flows.
- There is no persistence boundary, server boundary, or domain model.

This is acceptable for a launch page, but the product architecture should not be bolted into the landing page components. Product routes should live under route groups such as `(marketing)`, `(dashboard)`, `(candidate)`, and `api`.

## Command results

These were the Phase 0 baseline results before the MVP implementation.

Commands were run from `/Users/aryamangupta/Desktop/hirewave`.

| Command | Result |
| --- | --- |
| `npm install` | Succeeded. Repo already up to date. Reported 5 vulnerabilities: 1 moderate, 3 high, 1 critical. |
| `npm run lint` | Failed before linting. `next lint` opened the interactive ESLint setup prompt because no ESLint config exists. |
| `npx tsc --noEmit` | First run failed while `next build` was concurrently creating `.next/types`; rerun after build succeeded with exit code 0. |
| `npm test` | Failed because `test` script is missing. |
| `npm run build` | Succeeded. Static route `/` built at 119 kB route size and 207 kB first-load JS. |
| `PORT=3737 npm run dev` | Succeeded. Dev server became ready at `http://localhost:3737`. |
| `curl -I http://localhost:3737` | Returned `HTTP/1.1 200 OK`. |
| `npm audit --audit-level=moderate` | Failed due vulnerabilities in `next`, `postcss`, and `glob` chain through `eslint-config-next`. Audit suggests force upgrades that may be breaking. |

Post-MVP verification status:

- `npm run lint` passes.
- `npm run build` passes.
- `npm run typecheck` passes.
- `npm test` passes as a typecheck alias.
- `npx prisma validate` passes, with a Prisma v6 deprecation warning for `package.json#prisma`.
- `npm audit --audit-level=moderate` still fails with 8 reported vulnerabilities: 1 moderate, 6 high, and 1 critical across `next`, `postcss`, `glob`, and Prisma's `effect` dependency chain. The main fixes require dependency upgrades that should be handled in a separate dependency-hardening pass.

## Dead code and placeholders

- `components/sections/dimensions.tsx` exists but `PageShell` renders `HorizontalDimensions` instead.
- `components/sections/intro-splash.tsx` exists but `PageShell` renders `CinematicIntro` from `components/ui/motion-footer.tsx`.
- At Phase 0, visible landing CTAs and footer links used `href="#"`. Phase 5 wires the visible CTAs to `/dashboard`, `/dashboard/assessments/new`, `/invite/demo-invite`, and support/legal routes.
- Logo marquee companies are placeholder names.
- Proof claims such as "73% less hiring bias" are marketing placeholders without product evidence.
- FAQ claims ATS integrations, bias audits, candidate deletion, and stored submissions that do not exist in the product.
- `package.json` includes 3D/R3F dependencies that appear unused after the orbital-rings rewrite.

## Major risks

1. Product credibility risk: the site claims a complete AI-native assessment platform that is not implemented.
2. Security risk: future sandbox execution cannot run inside this Next.js process. It needs isolation, lifecycle cleanup, network policy, and no candidate access to server secrets.
3. Evaluation quality risk: AI-generated reports can become generic unless every score is grounded in captured telemetry and final code evidence.
4. Compliance risk: candidate telemetry, prompts, code, and reports are sensitive hiring records. The MVP needs explicit retention and access controls even before enterprise features.
5. Build hygiene risk: lint is not actually configured, tests are absent, and package audit has known vulnerable dependencies.
6. UX risk: the intro gate blocks the landing page until a click; that is fine for brand, but product routes should not inherit this pattern.
7. Architecture risk: putting dashboard/session logic into existing landing components would create a hard-to-maintain app.

## Immediate cleanup tasks

- Add a non-interactive ESLint config so `npm run lint` runs in CI/local shells.
- Add `typecheck` and `test` scripts.
- Upgrade Next.js within the 14.x line or to the chosen current stable version after checking compatibility.
- Remove or defer unused 3D dependencies if no R3F scene will be used.
- Move marketing page into a `(marketing)` route group or keep it isolated while adding product route groups.
- Replace fake CTAs with real product routes once MVP routes exist.
- Mark unsupported claims as future-facing or wire the underlying features.
- Add `.env.example`.
- Add README setup instructions; there is currently only `main.md` and brainstorm docs.

## Recommended product architecture

Use the current repo as a Next.js full-stack SaaS app:

- Frontend: App Router routes for marketing, dashboard, assessment builder, candidate room, and report viewer.
- Backend: Next.js route handlers/server actions for MVP CRUD, telemetry ingestion, AI proxy, report generation, and sandbox adapter calls.
- Persistence: start with Prisma + SQLite for local MVP speed, using a provider boundary that can move to Postgres/Neon/Supabase without changing UI contracts.
- Auth: start with a simple demo login for local MVP or NextAuth/Auth.js if production auth is in immediate scope. Keep candidate sessions invite-token based and accountless.
- Sandbox: define a provider interface immediately. Implement a simulated in-memory/local-file runner for MVP, then swap to E2B/Daytona/CodeSandbox/Docker later.
- AI: define a provider interface immediately. Implement an OpenAI-compatible API adapter controlled by env vars, plus a deterministic fallback evaluator for local demos.
- Telemetry: append-only `SessionEvent` records with typed event names and JSON payloads.
- Evaluation: evidence-first scoring from session events, final file snapshots, command/test runs, AI messages, and submission state.

## Reuse vs rewrite

Reuse:

- Brand name, core thesis, 8-dimension rubric language, and visual identity.
- Existing landing page as the marketing entry.
- Tailwind setup and visual primitives where they fit product UI.
- `lib/utils.ts`.
- `main.md` and `brainstorm/` as historical context.

Rewrite or isolate:

- Product flows should not reuse the scroll-driven landing shell.
- Claims in FAQ/pricing/proof should be revised once real product behavior exists.
- Candidate assessment room should use dense SaaS/tool UI, not landing-page cards.
- Server-side domain logic should be new and typed, not embedded in components.
- Sandbox/AI should be provider abstractions from day one, not direct calls inside route components.
