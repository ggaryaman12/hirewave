# Hirewave

Hirewave is an AI-native technical assessment platform built to evaluate how software engineering candidates collaborate with AI on realistic product and code tasks rather than only solving algorithm-style questions.[cite:3]
The repository combines a marketing site, recruiter dashboard, assessment builder, invite-based candidate flow, browser assessment workspace, telemetry capture pipeline, and evidence-based report generation into a single Next.js application.[cite:3]

## Product purpose

The project is centered on enterprise-style hiring workflows where a recruiter or interviewer creates an assessment, invites a candidate through a tokenized link, observes the resulting work evidence, and reviews a structured report generated from rubric-based evaluation.[cite:3]
The design direction shown across the repo also indicates this is both a product prototype and a demo-ready sales artifact, because the codebase includes polished landing-page sections, seeded demo data, dashboard screens, and sales/demo documentation alongside the app logic.[cite:2]

## Core experience

The main user journeys visible in the repository are a public landing page, a dashboard for assessments and reports, an invite flow without requiring a candidate account, and a timed browser assessment room for completing tasks.[cite:2][cite:3]
The candidate workspace is intentionally opinionated: it includes a file tree, code editor, controlled terminal and test runner, and an AI assistant, which reinforces that the platform measures practical AI-assisted engineering behavior in a constrained environment.[cite:3]

## Assessment model

The repository includes both seeded challenge templates and a controlled custom task draft builder, suggesting the platform supports standardized assessments as well as interviewer-defined tasks.[cite:3]
The available challenge areas referenced in the repo and docs include practical backend and product engineering themes such as checkout, webhooks, permissions, inventory, CSV import, AI guardrails, and future plans for challenge catalog expansion and DSA support.[cite:3][cite:2]

## Evaluation strategy

Hirewave records append-only telemetry for files, terminal commands and tests, AI messages, AI token usage, focus changes, session start, and submission events so the final evaluation can be tied to observable evidence instead of only final output quality.[cite:3]
Its reports are described as enterprise-first and evidence-based, and the README states that evaluation uses a fixed eight-dimension rubric named `ai-collaboration-v1`, which implies a standardized scoring framework for judging candidate behavior with AI assistance.[cite:3]

## Technical architecture

The application stack uses Next.js 14 App Router, TypeScript, Tailwind CSS, Prisma, and SQLite for the local MVP, giving the project a fast iteration path for product UI plus structured persistence for assessments, sessions, evidence, and reports.[cite:3]
Directory structure and file placement indicate a modular architecture: `app/` holds routes, `components/` contains landing, candidate, product, and shared UI pieces, `lib/` centralizes business logic such as AI providers, evaluation, sandboxing, auth, telemetry, and actions, while `prisma/`, `scripts/`, and `tests/` support data, automation, and quality checks.[cite:2]

## AI and sandbox approach

The AI layer is intentionally designed with fallbacks and provider abstraction, including deterministic behavior for predictable demos, optional Ollama integration, and provider interfaces under `lib/ai` and `lib/sandbox` for future runtime flexibility.[cite:2][cite:3]
The sandbox model prioritizes safety and controllability over unrestricted execution: the default provider is simulated, local development execution is opt-in, command support is restricted, unsafe paths are normalized or rejected, and external provider modes are scaffolded but not yet fully implemented.[cite:3]

## Routes and surfaced modules

The route tree shows clear product segmentation, including APIs under `app/api`, recruiter-facing screens under `app/dashboard`, invite pages under `app/invite/[token]`, and active candidate session routes under `app/session/[sessionToken]`.[cite:2]
Component organization further suggests a split between marketing presentation and core product workflows, with dedicated folders for layout, candidate experiences, dashboard/report widgets, content sections, and reusable animated UI primitives.[cite:2]

## Persistence and lifecycle

The local environment uses Prisma with SQLite and a seeded dev database, which makes the repo runnable as a self-contained MVP and supports reproducible demos and tests.[cite:3][cite:2]
The project lifecycle described in the README emphasizes setup, local verification, seeded demo usage, manual API and E2E testing, and preserving generated rows in the development database so evidence can still be inspected in the dashboard after test execution.[cite:3]

## Product maturity signals

The codebase appears beyond a raw prototype because it includes implementation planning docs, architecture docs, API reference material, future roadmap documents, docx exports, Playwright coverage, and a dedicated demo recording script.[cite:2]
At the same time, several parts are still intentionally staged for future hardening, including dependency upgrades, production sandbox adapters, and broader execution support, which makes the current repo best understood as a polished MVP or pre-production product foundation.[cite:3]

## Working understanding

From this repository alone, Hirewave can be understood as a hiring platform for AI-era engineering roles: it helps teams design realistic technical tasks, let candidates complete them in a controlled AI-enabled workspace, collect granular behavioral evidence, and generate structured reports that make hiring decisions more evidence-driven.[cite:3]
The strongest theme across the project is not just “testing code,” but measuring judgment, workflow quality, tool usage, and AI collaboration patterns in a way that mirrors actual engineering work.[cite:3]
