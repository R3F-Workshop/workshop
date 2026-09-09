# Workshop fallback — Paris mini-site

The workshop build of the Paris mini-site: Advanced React Three Fiber —
the PMNDRS workshop at Gobelins, Paris, September 8–9 2026.

**Live:** https://r3f-workshop.github.io/workshop/ — the demos and the site,
published from `main` by GitHub Pages.

## Branches

- **`main` (you are here)** — the *starting point*. The full page structure,
  header, footer, sections, and multi-canvas plumbing are real; every canvas
  renders a dead-simple placeholder (the hero is a spinning pyramid under the
  pmndrs mark) designed to be replaced during the workshop. The finished
  pieces sit in `src/app/experiences/paris-tower/` ready to paste back, and
  `/demos/*` still runs every finished scene.
- **`final-version`** — the complete site with the real hero and section
  scenes. `git switch final-version` to see it, or
  `git checkout final-version -- <path>` to pull any file into your working
  tree.

This repo is the production site with the production overhead removed: no
hidable-section machinery, no unfinished sections, no dev harnesses, no dead
code. The live site's repo remains the source of truth for production.

Next.js 16 (App Router) · Tailwind v4 · shadcn/ui · React Three Fiber v10
alpha (`@react-three/fiber/webgpu`) · drei 11 alpha · three r185.

## Install

```sh
corepack enable          # pnpm is pinned via packageManager
pnpm install
pnpm dev                 # http://localhost:3000
pnpm build
pnpm lint
```

**pnpm, not npm.** The repo carries a pnpm patch for Rapier in
`tooling/patches/` (wired up in `pnpm-workspace.yaml`); installing with npm silently
skips it and the build fails.

## Deploy

Every push to `main` runs `.github/workflows/pages.yml`, which builds a static
export and publishes it to https://r3f-workshop.github.io/workshop/. The
workflow sets `STATIC_EXPORT` and `NEXT_PUBLIC_BASE_PATH`, and only then does
`next.config.ts` switch to `output: "export"` under the `/workshop` base path.
Public asset URLs go through `src/lib/asset.ts` so they pick up that prefix;
`next/link` handles routes on its own. Dev, plain builds, and Vercel are
unaffected.

## Routes

| Route | What it is |
| --- | --- |
| `/` | The site: header, live 3D hero, seven content sections. |
| `/demos` | Index of the standalone scene pages. |
| `/resources` | Links for the stack: three.js, R3F, pmndrs, glTF tooling, courses and community. |
| `/demos/*` | Standalone scenes with optional Leva controls and teaching write-ups. |
| `/attendees` | Access-code gate for the attendee guide. |
| `/attendees/[code]` | The guide — `generateStaticParams` + `dynamicParams: false`, so only the real codes exist as routes. |

## Where things are

| Path | What it is |
| --- | --- |
| `src/app/page.tsx` | The `/` route; composes the home sections. |
| `src/app/home/sections/<x>/` | One folder per section: its component, plus a `components/` folder for anything only it uses — each section's scene slot lives with it (block-city under overview, flip-grid under why, …). |
| `src/app/home/sections/hero/` | The starter hero shell and pyramid scene, plus the time dial kept ready to wire back in. |
| `src/app/home/components/` | Shared by home sections only: the section shell, reveal, loading screen (wired out), and `canvas/` (SectionCanvas, the scenes.tsx client boundary, PlaceholderScene, camera rig, studio env). |
| `src/app/demos/<x>/` | Each demo page with its own components; the finished heavy scenes live in the section folders that own them. |
| `src/app/experiences/paris-tower/` | The finished hero pipeline and shell (`site-hero.tsx`, `site-tower-hero.tsx`), compiling and importable. Powers `/demos/paris-hero`. |
| `components/` | True globals: shadcn `ui/`, the brand logo, header, footer, LevaPanel. |
| `src/lib/content.ts` | Every string on the site. |
| `src/lib/time-of-day.ts` | The cyclic sky/palette model shared by the DOM gradient and the 3D lighting. |
| `tooling/` | Maintenance scripts and the pnpm patch. |

## The hero

On `main` the hero is the placeholder: a spinning pyramid under the pmndrs
mark, kept to the smallest possible primary canvas. The finished hero (on
`final-version`, and live at `/demos/paris-hero`) is a full R3F v10 WebGPU
scene: the tower in a block city, a time-of-day dial driving sun position,
sky, fog, window emissive, and the star field; the wordmark extruded in-scene
(`src/app/experiences/paris-tower/lettering.tsx`) so the tower can occlude it; post as a
single MRT graph in `src/app/experiences/paris-tower/fx.tsx` (bloom, AO, sky haze, FSR3
as the temporal resolver).

Without WebGPU the hero (and every scene) falls back to static posters —
`src/lib/use-webgpu.ts` is the one gate. `?no3d` forces the fallback.

## Things that look odd but are load-bearing

- The `AGENTS.md` block is written by `next dev`; commit it rather than
  fighting it.
- `pnpm-workspace.yaml` allows rapier 2.x to peer against R3F 10 — the range
  upstream is stale, not wrong; the patch repoints its imports at the WebGPU
  entry.
- Multi-canvas: every canvas shares one `WebGPURenderer` (the hero owns it as
  `id="main"`). Fiber keeps each canvas's depth attachment in step with its
  swap chain itself in `10.0.0-alpha.5`. Earlier alphas needed a helper inside
  every `<Canvas>` for that; see pmndrs/react-three-fiber#3847 and #3905.
