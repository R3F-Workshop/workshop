# Workshop fallback — Paris mini-site

The workshop build of the Paris mini-site: Advanced React Three Fiber —
the PMNDRS workshop at Gobelins, Paris, September 8–9 2026.

## Branches

- **`main` (you are here)** — the *starting point*. The full page structure,
  header, footer, sections, and multi-canvas plumbing are real; every canvas
  renders a dead-simple placeholder (the hero is a spinning pyramid under the
  pmndrs mark) designed to be replaced during the workshop. The finished
  pieces sit in [`resources/`](resources/README.md) ready to paste back, and
  the standalone demo pages live in the [demos repo](https://github.com/R3F-Workshop/demos).
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

**Use pnpm.** The repo carries a rapier patch in `patches/` (wired up in
`pnpm-workspace.yaml`). Installing with npm skips it.

## Routes

| Route | What it is |
| --- | --- |
| `/` | The site: header, live 3D hero, seven content sections. |
| `/demos` | Index of the standalone scene pages (not linked from the nav). Only the simple hero is left here. |
| `/demos/hero-simple` | The simple hero with Leva controls (`?debug`) and a teaching write-up. The other eight demos live in the [demos repo](https://github.com/R3F-Workshop/demos). |
| `/attendees` | Access-code gate for the attendee guide. |
| `/attendees/[code]` | The guide — `generateStaticParams` + `dynamicParams: false`, so only the real codes exist as routes. |

## Where things are

| Path | What it is |
| --- | --- |
| `app/page.tsx` | The `/` route; composes the home sections. |
| `app/home/sections/<x>/` | One folder per section: its component, plus a `components/` folder for anything only it uses — each section's scene slot lives with it (block-city under overview, flip-grid under why, …). |
| `app/home/sections/hero/` | The hero shell, the time dial, and `components/` — the simple hero: one file per lesson beat (Canvas, tower, stage, trees, houses, wordmark, stars, `sun.ts`, spotlights, `post-fx.tsx`). |
| `app/home/components/` | Shared by home sections only: the section shell, reveal, loading screen (wired out), and `canvas/` (SectionCanvas, the scenes.tsx client boundary, PlaceholderScene, camera rig, studio env). |
| `app/demos/hero-simple/` | The one demo page still here. The other eight moved to the demos repo, each with a copy of its scene; the originals stay in the section folders that own them. |
| `resources/` | The *pro* hero pipeline (`tower-scene/`) and shell, compiling and importable — see `resources/README.md`. A copy powers the Paris hero demo in the demos repo. The simple hero on `/` and `/demos/hero-simple` does not use it. |
| `components/` | True globals: shadcn `ui/`, the brand logo, header, footer, DepthAttachmentSync, LevaPanel. |
| `lib/content.ts` | Every string on the site. |
| `lib/time-of-day.ts` | The cyclic sky/palette model shared by the DOM gradient and the 3D lighting. |
| `vendor/pmndrs-sky` | `@pmndrs/sky` as a packed tarball (`file:` dep), since it is not on npm yet. Replace the `.tgz` and bump the path in `package.json` to update it. |

## The hero

On `main` the hero is the placeholder: a spinning pyramid under the pmndrs
mark, kept to the smallest possible primary canvas. The finished hero (on
`final-version`, and in the demos repo as the Paris hero) is a full R3F v10 WebGPU
scene: the tower in a block city, a time-of-day dial driving sun position,
sky, fog, window emissive, and the star field; the wordmark extruded in-scene
(`resources/tower-scene/lettering.tsx`) so the tower can occlude it; post as a
single MRT graph in `resources/tower-scene/fx.tsx` (bloom, AO, sky haze, FSR3
as the temporal resolver).

Without WebGPU the hero (and every scene) falls back to static posters —
`lib/use-webgpu.ts` is the one gate. `?no3d` forces the fallback.

## Things that look odd but are load-bearing

- The `AGENTS.md` block is written by `next dev`; commit it rather than
  fighting it.
- `pnpm-workspace.yaml` allows rapier 2.x to peer against R3F 10 — the range
  upstream is stale, not wrong; the patch repoints its imports at the WebGPU
  entry.
- Multi-canvas: every canvas shares one `WebGPURenderer` (the hero owns it as
  `id="main"`); `components/depth-attachment-sync.tsx` works around a
  three.js multi-canvas depth bug and belongs inside every `<Canvas>`.
