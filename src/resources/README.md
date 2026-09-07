# Resources — the finished pieces, ready to paste back

Everything in this folder **compiles** — it is real, importable code kept out
of the page so the site boots as the starting point. The complete finished
site also lives on the **`final-version`** branch; this folder is the
grab-it-fast copy for live coding.

## What's here

| Path | What it is |
| --- | --- |
| `tower-scene/` | The full finished hero pipeline: `tower-canvas.tsx`, `lettering.tsx` (the in-scene PMNDRS wordmark), buildings, terrain, lights, stars, the MRT post graph (`fx.tsx`), probes. Powers `/demos/paris-hero` right now (its Leva shell lives in `src/app/demos/paris-hero/components/`), so it is verified working at all times. |
| `hero/hero.tsx` | The finished hero shell: loading-gate choreography, staggered UI reveal, the time-dial replay spring. |
| `hero/tower-hero.tsx` | The bridge that mounts `TowerCanvas` as the site's primary canvas (`id="main"`), with the WebGPU fallback poster. |

## Kept in place, currently unused

These never left the app tree — they're wired-out, not deleted:

- `src/app/home/sections/hero/time-dial.tsx` — the rotary time-of-day control.
- `src/app/home/components/loading-screen.tsx` + `src/lib/hero-gate.ts` — the loading gate
  that holds the page until the hero's shaders compile.

## Putting the finished hero back (the short version)

1. Copy `src/resources/hero/*` into `src/app/home/sections/hero/`. The
   `@/resources/tower-scene/` imports already resolve.
2. Re-add `<LoadingScreen />` above `<SiteHeader />` in `src/app/page.tsx`.
3. Delete `src/app/home/sections/hero/pyramid-hero.tsx`.

## Putting a finished section scene back

Each section's `*-canvas.tsx` wrapper renders `PlaceholderScene`; its header
comment names the exact JSX to swap in. The finished scene files never moved
— they still power `/demos/*` — so it's a two-line change per wrapper. Or
take the finished wrapper wholesale:

```sh
git show final-version:app/home/sections/why/components/flip-grid/flip-grid-canvas.tsx > src/app/home/sections/why/components/flip-grid/flip-grid-canvas.tsx
git show final-version:app/home/sections/overview/components/block-city/block-city-canvas.tsx > src/app/home/sections/overview/components/block-city/block-city-canvas.tsx
git show final-version:app/home/sections/outcomes/components/blending-cube/blending-cube-canvas.tsx > src/app/home/sections/outcomes/components/blending-cube/blending-cube-canvas.tsx
git show final-version:app/home/sections/outcomes/components/takehome-grid/takehome-grid-canvas.tsx > src/app/home/sections/outcomes/components/takehome-grid/takehome-grid-canvas.tsx
git show final-version:app/home/sections/closer/components/connectors/connectors-canvas.tsx > src/app/home/sections/closer/components/connectors/connectors-canvas.tsx
git show final-version:app/home/components/canvas/scenes.tsx > src/app/home/components/canvas/scenes.tsx
```

## The one rule

Whatever replaces the pyramid must keep a primary canvas with `id="main"` —
every `SectionCanvas` waits on `waitForPrimary("main")` before mounting, so a
page with no primary stays on its posters.
