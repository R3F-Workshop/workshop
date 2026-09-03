# Resources — the pro pieces, ready to paste back

Everything in this folder **compiles** — it is real, importable code kept out
of the page. The page itself runs the *simple* hero
(`app/home/sections/hero/components/`, one file per lesson beat); this
folder is the full production pipeline it was cut down from. The complete finished
site also lives on the **`final-version`** branch; this folder is the
grab-it-fast copy for live coding.

## What's here

| Path | What it is |
| --- | --- |
| `tower-scene/` | The full finished hero pipeline: `tower-canvas.tsx`, `lettering.tsx` (the in-scene PMNDRS wordmark), buildings, terrain, lights, stars, the MRT post graph (`fx.tsx`), probes. A copy powers the Paris hero demo in the [demos repo](https://github.com/R3F-Workshop/demos), which is where it is exercised now. |
| `hero/hero.tsx` | The finished hero shell: loading-gate choreography, staggered UI reveal, the time-dial replay spring. |
| `hero/tower-hero.tsx` | The bridge that mounts `TowerCanvas` as the site's primary canvas (`id="main"`), with the WebGPU fallback poster. |

## Kept in place, currently unused

These never left the app tree — they're wired-out, not deleted:

- `app/home/sections/hero/time-dial.tsx` — the rotary time-of-day control.
- `app/home/components/loading-screen.tsx` + `lib/hero-gate.ts` — the loading gate
  that holds the page until the hero's shaders compile.

## Putting the finished hero back (the short version)

1. `git checkout final-version -- app/home/sections/hero/hero.tsx app/home/sections/hero/tower-hero.tsx`
   (or copy `resources/hero/*` over `app/home/sections/hero/` and change their
   `@/resources/tower-scene/` imports to
   `@/app/home/sections/hero/components/tower-scene/` — or just leave the
   imports pointing at `resources/`, it all compiles).
2. Re-add `<LoadingScreen />` above `<SiteHeader />` in `app/page.tsx`.
3. Delete `app/home/sections/hero/pyramid-hero.tsx`.

## Putting a finished section scene back

Each section's `*-canvas.tsx` wrapper renders `PlaceholderScene`; its header
comment names the exact JSX to swap in. The finished scene files never moved,
and copies run as the standalone demos in the demos repo, so it is a
two-line change per wrapper. Or
take the finished wrapper wholesale:

```sh
git checkout final-version -- app/home/sections/why/components/flip-grid/flip-grid-canvas.tsx
git checkout final-version -- app/home/sections/overview/components/block-city/block-city-canvas.tsx
git checkout final-version -- app/home/sections/outcomes/components/blending-cube/blending-cube-canvas.tsx
git checkout final-version -- app/home/sections/outcomes/components/takehome-grid/takehome-grid-canvas.tsx
git checkout final-version -- app/home/sections/closer/components/connectors/connectors-canvas.tsx
git checkout final-version -- app/home/components/canvas/scenes.tsx   # magic box slot
```

## The one rule

Whatever replaces the pyramid must keep a primary canvas with `id="main"` —
every `SectionCanvas` waits on `waitForPrimary("main")` before mounting, so a
page with no primary stays on its posters.
