# Design system

## Palette

Dark-first. All values are the CSS variables in `app/globals.css`.

- `--background`: near-black with a hint of blue (`222 47% 4%`)
- `--foreground`: off-white (`210 40% 98%`)
- `--muted-foreground`: cool gray (`215 20% 65%`)
- `--border`: faint violet-gray (`240 15% 18%`)

Accents (used for gradients and highlights):
- **violet** `#8b5cf6`
- **cyan** `#06b6d4`
- **fuchsia** `#d946ef`
- **emerald** `#10b981`
- **amber** `#f59e0b`

The gradient signature used across the site is `violet → fuchsia → cyan`, sometimes with emerald as a fourth stop for special moments.

## Type

- Display: Inter with heavy tracking, -0.04em letter spacing for headlines.
- Body: Inter.
- Mono: system ui-monospace stack for code fragments.

Scale: 4xl → 7xl for the hero headline (clamp for fluid scaling), 3xl for section titles, xl for card titles, base for body.

## Spacing and rhythm

- Section vertical padding: `py-24 md:py-32`.
- Content max-width: 1280 px (`container` in tailwind.config).
- Gap between cards in bento: 1rem mobile, 1.5rem desktop.

## Elevation

No drop shadows. Glow only — box-shadow with accent color at ~10% alpha, radial, around focused elements. The BorderBeam and Spotlight primitives are the two ways "glow" manifests.

## Motion

- Easing: `cubic-bezier(0.22, 1, 0.36, 1)` — the "expo-out" feel.
- Entrance duration: 600–800 ms.
- Loop durations: orb rotation ~40 s, marquee 30 s, aurora 60 s, meteors 5 s.
- Respect `prefers-reduced-motion`.
