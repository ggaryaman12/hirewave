# Landing page spec

Sections, top to bottom. Each section names its hero moment — one thing the eye is supposed to lock onto.

## 1. Nav

Sticky, glass blur. Left: Hirewave wordmark with subtle gradient. Center: How it works · For candidates · For employers · Pricing. Right: Sign in · **Get started** (primary).

## 2. Hero — two-sided split

**Hero moment:** a slow-rotating 3D neural orb behind the headline.

- Headline: "**Hire for how they work with AI, not how they work without it.**"
- Sub: "Hirewave evaluates candidates across 8 dimensions of AI collaboration — the only signal that predicts 2026 performance."
- Dual CTA chips, side-by-side:
  - **I'm hiring →** (violet gradient)
  - **I'm looking →** (cyan gradient)
- Aurora background, spotlight, grid pattern underneath.
- On load: headline staggers in word-by-word (Framer Motion). Orb fades + starts rotating.

## 3. Logos marquee

"Trusted by teams hiring the next wave." Infinite marquee of placeholder company names rendered as lockup text. Dual row, opposing directions.

## 4. How it works — 3 steps, bento

Bento grid with 3 tiles:

1. **Candidates solve a real problem with an AI pair.** Animated terminal tile: lines of code typing out, AI responses streaming.
2. **Every keystroke is scored across 8 dimensions.** Radar chart with animating polygon.
3. **Employers get a ranked, audited shortlist.** Mock leaderboard with number tickers.

## 5. The 8 dimensions

Grid of 8 cards. Each card: icon, name, one-line explanation, hover-reveal BorderBeam.

## 6. For candidates / For employers — split

Full-width two-column. Left: candidate story with meteors accent. Right: employer story with ripple accent. Each column has its own CTA.

## 7. Proof — social / metrics

3 big NumberTicker stats:
- **10×** faster shortlisting
- **73%** less bias (claim with asterisk → "per internal audit, vs. resume-based screens")
- **8** behavioral dimensions scored

## 8. Pricing

Three tiers — Candidate (free), Team ($499/mo), Enterprise (talk to us). Middle tier has a subtle BorderBeam to mark it as featured.

## 9. FAQ (collapsible)

5–6 questions. Keep copy tight.

## 10. Final CTA

Big, full-bleed. "Start hiring for 2026." Single primary button. Ripple behind it.

## 11. Footer

Four columns. Small print about EEOC / bias-auditing commitments.

## Motion principles

- Entrance animations are **opt-in, not distraction**. Everything must be readable without motion.
- Use `whileInView` with `once: true` — users don't re-animate on re-scroll.
- Respect `prefers-reduced-motion`: collapse orb rotation, marquee, meteors, aurora.
- Time budget: anything above the fold must be visually "there" within 400 ms of mount.

## Copy voice

Confident, not smug. Short clauses. No "revolutionize", "unlock", "supercharge". Say what the thing does.
