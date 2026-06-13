# Hirewave — Project Context

> Read-me for any future session (human or agent). Captures **what we're building**, **why**, **current state**, and **what's next**.

---

## 1. The product

**Hirewave** is a two-sided, AI-native hiring platform. The thesis:

> Engineers who are 10× *with* AI are not the same people who were 10× *without* it. Static whiteboard interviews are measuring the wrong thing.

Hirewave evaluates candidates on **how they collaborate with AI** — not whether they can write code from memory — by dropping them into a sandboxed environment with an AI pair to solve a real, multi-step problem. Employers get a ranked, bias-audited shortlist scored across **8 behavioural dimensions**:

1. Problem decomposition
2. Prompt precision
3. Verification instinct
4. Hallucination detection
5. Iteration velocity
6. Context management
7. Override judgment
8. Communication

Users:
- **Candidates** — 45–90 min assessment, one universal passport, full per-dimension feedback.
- **Employers** — calibrated rubric, bias-audited, ATS push (Greenhouse / Ashby / Lever).

Closest reference is ArcEval (hire.vizuara.ai). Hirewave differs by: two-sided positioning, broader role taxonomy, cinematic scroll-driven landing.

---

## 2. Design language

Inspired by **giganticmedia.net** — cinematic, typographic, scroll-driven creative-agency aesthetic. **Not** a dark violet/cyan SaaS template.

### Palette (light, editorial)
| Token | Value | Use |
|---|---|---|
| `--background` / `--paper` | `hsl(32 36% 92%)` · warm paper cream | Page bg |
| `--foreground` / `--ink` | `#0a0a0a` · near-black | Primary text |
| Accent coral | `#f15a29` | Active state, CTAs, accent gradient |
| Accent indigo | `#1c1b6f` | Secondary accent |
| Accent rose | `#d12864` | Gradient mid-stop |
| Accent lime | `#c4e036` | Rare highlight |
| Accent amber | `#f2a65a` | Rare highlight |

Signature gradient: `coral → rose → indigo` (warm → cool).

Typography: Inter / Plus Jakarta Sans system stack. Display is heavy tracking, `-0.045em` on hero. Scale clamps up to `8.5rem` on hero headline.

Surfaces: `bg-white/45` with `border-black/10`, soft drop-shadow on hover. No hard drop shadows anywhere else — glow only via `0_18px_40px_-18px_rgba(241,90,41,0.35)`.

Background layers (in `app/globals.css`):
- `body::before` — three soft radial color clouds (coral / indigo / lime) at low opacity
- `body::after` — SVG fractal noise grain at `opacity: 0.06` + `mix-blend-mode: multiply` for paper texture

### Motion
- **Lenis** smooth-scroll for continuous buttery scroll (all sections feel pinned).
- **Framer Motion** for entrance choreography and scroll-driven `useTransform` mappings.
- **GSAP + ScrollTrigger** for magnetic buttons and the cinematic intro/footer.
- Easing: `cubic-bezier(0.22, 1, 0.36, 1)` ("expo-out").
- Respect `prefers-reduced-motion` via CSS override + Lenis early-return.

---

## 3. Stack

- **Next.js 14** App Router, TypeScript, static prerender (`/` is `○ Static`).
- **Tailwind CSS** + `tailwindcss-animate`.
- **Framer Motion** for scroll transforms, springs, `AnimatePresence`.
- **Lenis** (`lenis`) for smooth scroll.
- **GSAP + ScrollTrigger** (`gsap`) for magnetic buttons and cinematic intro.
- **lucide-react** for icons.
- No backend, no DB. Pure static landing.

Dev: `PORT=3737 npm run dev` (or `3000`). Build: `npm run build`. Deploy: `npx vercel --prod`.

---

## 4. Project layout

```
hirewave/
├── app/
│   ├── layout.tsx             # html shell, metadata
│   ├── page.tsx               # <PageShell />
│   └── globals.css            # light theme, nebula bg, noise grain, spin utils
├── components/
│   ├── layout/
│   │   ├── page-shell.tsx     # gates intro → main, wraps SmoothScroll
│   │   └── smooth-scroll.tsx  # Lenis provider (disabled under prefers-reduced-motion)
│   ├── sections/
│   │   ├── navbar.tsx                      # scroll-scaling logo, fade-in links
│   │   ├── pinned-hero.tsx                 # 220vh sticky, word-by-word scroll reveal + OrbitalRings
│   │   ├── logos-marquee.tsx               # dual-row marquee with fade edges
│   │   ├── how-it-works.tsx                # 320vh pinned spinner — 3 stops (Solve/Score/Ship) rotating
│   │   ├── horizontal-dimensions.tsx       # 180vh sticky, cards translate horizontally on scroll
│   │   ├── for-candidates-for-employers.tsx
│   │   ├── proof.tsx                       # 3 stats, scroll-tied y+scale
│   │   ├── pricing.tsx                     # 3 tiers, middle featured with coral glow
│   │   ├── faq.tsx                         # accordion
│   │   ├── final-cta.tsx                   # gradient panel
│   │   └── footer.tsx                      # 4 columns + legal
│   └── ui/
│       ├── motion-footer.tsx    # CinematicIntro (used as splash) + CinematicFooter (spare)
│       ├── orbital-rings.tsx    # concentric circles with 8 dim labels orbiting
│       ├── geometric-lines.tsx  # SVG diagonal sweep + arc, parallax on scroll
│       ├── section-bg.tsx       # scroll-driven bg color shift wrapper
│       ├── scroll-progress.tsx  # top bar coral→rose→indigo
│       ├── bento-grid.tsx       # (light-theme cards)
│       ├── marquee.tsx
│       ├── border-beam.tsx
│       ├── number-ticker.tsx
│       ├── ripple.tsx
│       ├── meteors.tsx
│       ├── spotlight.tsx
│       ├── aurora-background.tsx
│       ├── animated-gradient-text.tsx
│       ├── grid-pattern.tsx
│       └── shiny-button.tsx
├── lib/utils.ts
├── brainstorm/                  # original specs (PRODUCT, LANDING, DESIGN, COMPONENTS, TECH, ROADMAP)
├── public/
├── package.json
├── next.config.mjs
├── tailwind.config.ts
└── tsconfig.json
```

---

## 5. Page architecture (scroll flow)

```
PageShell  (client; gates on `entered` state)
│
├─  CinematicIntro         ← splash until user clicks any CTA
│     · Giant "HIREWAVE" stroked bg text
│     · "Ready to hire for 2026?" heading
│     · Magnetic-pill CTAs (I'm hiring / I'm looking / How it works / …)
│     · Diagonal marquee band, aurora glow, noise grain
│
└─  SmoothScroll (Lenis)
    ├─  ScrollProgress  (top gradient bar)
    ├─  Navbar           (logo scales in, links fade in as user scrolls past hero)
    ├─  PinnedHero       (220vh) — sticky, words reveal word-by-word on scrollYProgress,
    │                              OrbitalRings replaces the former R3F orb
    ├─  LogosMarquee
    ├─  HowItWorks       (320vh pinned) — spinner rotates 240° on scroll;
    │                                     3 stops (Solve/Score/Ship) light up coral when active;
    │                                     step cards cross-fade on the left
    ├─  HorizontalDimensions (180vh pinned) — 8 cards translate horizontally
    ├─  ForCandidatesForEmployers (2-column split, coral left · indigo right)
    ├─  Proof            (3 stats, NumberTicker, scroll-tied y+scale)
    ├─  Pricing          (3 tiers, Team tier featured)
    ├─  FAQ              (accordion)
    ├─  FinalCTA         (gradient panel)
    └─  Footer           (4 columns, legal)
```

Section heights: pinned sections (Hero, HowItWorks, HorizontalDimensions) consume viewport-multiples of vertical scroll while visual content stays sticky — the same pattern Gigantic uses via GSAP ScrollTrigger.

---

## 6. Deployment

Live at **https://hirewave-blue.vercel.app** (alias of `hirewave-fwlpxa0ul-ggaryaman12s-projects.vercel.app`).

- Vercel account: `ggaryaman12s-projects`
- Project: `hirewave`
- Region: `iad1` (Washington DC East)
- `/` route: `119 kB` / `207 kB` first-load JS, static prerender
- Redeploy: `npx vercel --prod` (project linked via `.vercel/`)
- Git not connected yet — connect at vercel.com for push-to-deploy.

Production build is clean. No SSR errors. `three`/`r3f`/`postprocessing` were removed because they weren't used after swapping the orb for OrbitalRings.

---

## 7. Known open items / next steps

Short list, ordered by impact:

1. **Wire a backend** — assessment flow is all UI copy. No auth, no candidate sandbox, no scoring pipeline.
2. **Footer** — current is standard 4-column. `CinematicFooter` (in `motion-footer.tsx`) is ready to swap in for a more cinematic close.
3. **Copy pass** — voice is confident but some sections are skeleton (FAQ, Pricing bullets). Tighten before any paid traffic.
4. **Responsive mobile polish** — pinned sections work but haven't been tuned for <640px. Spinner sizes with viewport but text cards may clip.
5. **Accessibility audit** — motion respects `prefers-reduced-motion`, but need to verify keyboard navigation on the accordion/FAQ and magnetic buttons.
6. **Perf** — Lenis + many `useScroll` + `useSpring` instances are fine on desktop; sample on mid-tier mobile before launch.
7. **Connect Git repo** — so Vercel auto-deploys on push. Also enables preview deployments.
8. **Favicon / OG image** — currently the Next.js default 404 favicon. Need a real one + proper OG card.
9. **Analytics** — none wired. Add Vercel Analytics or Plausible before launch.
10. **The 8-dimensions deep page** — currently the dimensions are a horizontal scroll on the landing. A dedicated `/rubric` page explaining each dimension in depth would help candidates.

Roadmap beyond landing (from `brainstorm/ROADMAP.md`): candidate sandbox runtime, scoring service, employer dashboard, ATS integrations, bias-audit report generator.

---

## 8. History snapshot (for context)

Evolution of the landing across the session:
- **v1**: dark theme (violet/cyan nebula) + R3F distorted orb + multi-section card layout (looked like ArcEval clone).
- **v2**: added intro splash, pinned hero with word-reveal scroll, horizontal dimensions, scroll progress bar.
- **v3** (current): complete theme swap to warm cream / editorial, dropped 3D orb for OrbitalRings spinner, replaced IntroSplash with CinematicIntro (GSAP magnetic buttons), HowItWorks became a pinned spinner-driven section with 3 rotating stops, Lenis for continuous smooth scroll, all sections restyled for light theme.

What the user explicitly steered away from:
- Default dark violet/cyan "AI SaaS" aesthetic.
- ArcEval-style card-grid feel.
- Any jarring/stuttering scroll — pinned sections must feel like one continuous canvas.
- Plain `whileInView` fade-ins on a section — prefer scroll-tied motion (spinner rotation, word reveal, card cross-fade).

What they explicitly asked for:
- Light theme, giganticmedia-style boldness.
- Cinematic intro with magnetic buttons instead of plain "Enter the experience".
- Spinner motion in every major section (done in PinnedHero and HowItWorks; HorizontalDimensions uses card translation).
- Continuous smooth scroll (Lenis).
- Self-hosted on a free tier (Vercel, done).
