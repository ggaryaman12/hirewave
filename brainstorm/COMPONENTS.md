# Component inventory

## Magic UI primitives (`components/ui/`)

All are inspired by patterns popularised via 21st.dev / Magic UI / Aceternity. Rebuilt in-repo so we own them.

| Component | Role | Key props |
|---|---|---|
| `Spotlight` | Radial gradient glow that follows mount position. Used behind the hero. | `fill`, `className` |
| `BorderBeam` | An animated arc of light that sweeps around a container's border. | `size`, `duration`, `colorFrom`, `colorTo` |
| `AnimatedGradientText` | Inline text with a shifting multi-stop gradient. | children |
| `Meteors` | Deterministic shower of shooting stars. | `number` |
| `Marquee` | Infinite horizontal scroll, pause-on-hover, reversible. | `reverse`, `pauseOnHover`, `className` |
| `BentoGrid`, `BentoCard` | Grid-based feature cards with hover glow + background slot. | `name`, `description`, `className`, `background` |
| `GridPattern` | SVG grid, fades at edges with a radial mask. | `strokeDasharray`, `className` |
| `NumberTicker` | Counts up to a target number on first view. | `value`, `direction`, `duration` |
| `Ripple` | Concentric expanding circles. Used behind the final CTA. | `mainCircleSize`, `numCircles` |
| `AuroraBackground` | Soft animated aurora blobs. | children |
| `ShinyButton` | Button with a shimmer sweep. | children |

## Sections (`components/sections/`)

- `Navbar` — sticky glass nav.
- `Hero` — two-sided headline + 3D scene.
- `LogosMarquee` — dual-row marquee.
- `HowItWorks` — bento of 3 steps.
- `Dimensions` — 8-card grid.
- `ForCandidatesForEmployers` — two-column split.
- `Proof` — big number stats.
- `Pricing` — 3 tiers.
- `FAQ` — collapsible.
- `FinalCTA` — ripple-backed CTA.
- `Footer` — 4 columns.

## 3D (`components/three/`)

- `HeroScene` — React Three Fiber canvas. Contains a distorted icosahedron (the "orb") with an environment map, a subtle particle field, and a slow Y-axis rotation. Mouse parallax reads `mousePos` from an internal hook. Respects `prefers-reduced-motion`.
