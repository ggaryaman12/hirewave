# Tech

## Stack

- **Next.js 14** (App Router, TypeScript).
- **Tailwind CSS** with custom `tailwind.config.ts` keyframes (border-beam, shimmer, marquee, meteor, spotlight, aurora, grid-move, ripple).
- **Framer Motion** for entrance choreography, `whileInView`, variants.
- **React Three Fiber** + **Drei** + **postprocessing** for the hero 3D scene.
- **lucide-react** for icons.

No backend yet. All routes are static. Fonts are system-stack today (no Google Font fetch on first iteration to keep setup dependency-free).

## Project layout

```
hirewave/
├── app/
│   ├── layout.tsx
│   ├── page.tsx          # landing page
│   └── globals.css
├── components/
│   ├── ui/               # magic UI primitives
│   ├── sections/         # landing page sections
│   └── three/            # R3F canvas + scene
├── lib/
│   └── utils.ts          # cn() and small helpers
├── brainstorm/           # this folder — read me
└── public/
```

## Performance notes

- `HeroScene` is a **client-only** component loaded via `next/dynamic` with `ssr: false` to avoid Three.js touching the server runtime.
- Marquee uses `will-change: transform` only while visible (set via Framer Motion's `onViewportEnter`). No layout thrash.
- All hover glows are pure CSS (no JS per-frame) except the 3D scene's `useFrame`.

## Dev

```sh
npm install
npm run dev   # http://localhost:3737
```

The `_setup.command` on the project root runs both steps in one double-click (macOS).

## Open questions (for a later session)

- Does the orb scene stay, or swap to a neural-graph particle mesh? The latter is more on-theme but costlier to animate.
- Do we want a Google Font (Geist or Inter variable) — adds a dependency but lifts the type.
- Should the candidate/employer split be two separate routes later (`/for-candidates`, `/for-employers`)?
