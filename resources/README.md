# Resources — the finished pieces, ready to paste back

Everything in this folder **compiles** — it is real, importable code kept out
of the page so the site boots as the starting point. The complete finished
site also lives on the **`final-version`** branch; this folder is the
grab-it-fast copy for live coding.

## What's here

| Path | What it is |
| --- | --- |
| `hero-demo/` | The full finished hero pipeline: `tower-canvas.tsx`, `lettering.tsx` (the in-scene PMNDRS wordmark), buildings, terrain, lights, stars, the MRT post graph (`fx.tsx`), probes. Powers `/demos/paris-hero` right now, so it is verified working at all times. |
| `hero/hero.tsx` | The finished hero shell: loading-gate choreography, staggered UI reveal, the time-dial replay spring. |
| `hero/tower-hero.tsx` | The bridge that mounts `TowerCanvas` as the site's primary canvas (`id="main"`), with the WebGPU fallback poster. |

## Kept in place, currently unused

These never left the app tree — they're wired-out, not deleted:

- `components/hero/time-dial.tsx` — the rotary time-of-day control.
- `components/loading-screen.tsx` + `lib/hero-gate.ts` — the loading gate
  that holds the page until the hero's shaders compile.

## Putting the finished hero back (the short version)

1. `git checkout final-version -- components/hero/hero.tsx components/hero/tower-hero.tsx`
   (or copy `resources/hero/*` over `components/hero/` and change their
   `@/resources/hero-demo/` imports back to `@/components/hero-demo/` — or
   just leave the imports pointing at `resources/`, it all compiles).
2. Re-add `<LoadingScreen />` above `<SiteHeader />` in `app/page.tsx`.
3. Delete `components/hero/pyramid-hero.tsx`.

## Putting a finished section scene back

Each section's `*-canvas.tsx` wrapper renders `PlaceholderScene`; its header
comment names the exact JSX to swap in. The finished scene files never moved
— they still power `/demos/*` — so it's a two-line change per wrapper. Or
take the finished wrapper wholesale:

```sh
git checkout final-version -- components/three/flip-grid/flip-grid-canvas.tsx
git checkout final-version -- components/three/block-city/block-city-canvas.tsx
git checkout final-version -- components/three/blending-cube/blending-cube-canvas.tsx
git checkout final-version -- components/three/takehome-grid/takehome-grid-canvas.tsx
git checkout final-version -- components/three/connectors/connectors-canvas.tsx
git checkout final-version -- components/three/scenes.tsx   # magic box slot
```

## The one rule

Whatever replaces the pyramid must keep a primary canvas with `id="main"` —
every `SectionCanvas` waits on `waitForPrimary("main")` before mounting, so a
page with no primary stays on its posters.
