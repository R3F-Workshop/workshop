# Workshop fallback — Paris mini-site

The workshop build of the Paris mini-site: Advanced React Three Fiber —
the PMNDRS workshop at Gobelins, Paris, September 8–9 2026.

## Branches

- **`main` (you are here)** — the *starting point*. The full page structure,
  header, footer, sections, and multi-canvas plumbing are real; every canvas
  renders a dead-simple placeholder (the hero is a spinning pyramid under the
  pmndrs mark) designed to be replaced during the workshop. The finished
  pieces sit in [`src/resources/`](src/resources/README.md) ready to paste back, and
  `/demos/*` still runs every finished scene.
- **`final-version`** — the complete site with the real hero and section
  scenes. `git switch final-version` to see it, or
  `git checkout final-version -- <path>` to pull any file into your working
  tree.

This repo is the production site with the production overhead removed: no
hidable-section machinery, no unfinished sections, no dev harnesses, no dead
code. The live site's repo remains the source of truth for production.

Next.js 16 (App Router) · Tailwind v4 · Radix UI · React Three Fiber v10
alpha (`@react-three/fiber/webgpu`) · drei 11 alpha (patched) · three r185.

## Install

```sh
corepack enable          # pnpm is pinned via packageManager
pnpm install
pnpm dev                 # http://localhost:3000
pnpm build
pnpm lint
```

**pnpm, not npm.** The repo carries pnpm patches for drei and rapier in
`tooling/patches/` (wired up in `pnpm-workspace.yaml`); installing with npm
silently skips them and the build fails.

## Routes

| Route | What it is |
| --- | --- |
| `/` | The site: header, live 3D hero, seven content sections. |
| `/demos` | Index of the standalone scene pages (not linked from the nav). |
| `/demos/*` | Eight scenes, each with Leva controls (`?debug`) and a teaching write-up. |
| `/attendees` | Access-code gate for the attendee guide. |
| `/attendees/[code]` | The guide — `generateStaticParams` + `dynamicParams: false`, so only the real codes exist as routes. |

## Where things are

| Path | What it is |
| --- | --- |
| `src/app/page.tsx` | The `/` route; composes the home sections. |
| `src/app/home/sections/<x>/` | One folder per section with its component and section-only components. |
| `src/app/home/components/` | Components shared only by home sections, including the multi-canvas plumbing. |
| `src/app/demos/<x>/` | Each demo page with its own components. |
| `src/resources/` | The finished hero pipeline and shell, compiling and importable. See `src/resources/README.md`. |
| `src/components/` | Site-wide UI, brand, and shared canvas helpers. |
| `src/lib/` | Site content, utilities, browser gates, and shared models. |
| `tooling/` | Maintenance scripts, pnpm patches, and the vendored `@pmndrs/sky` build. |

## The hero

On `main` the hero is the placeholder: a spinning pyramid under the pmndrs
mark, kept to the smallest possible primary canvas. The finished hero (on
`final-version`, and live at `/demos/paris-hero`) is a full R3F v10 WebGPU
scene: the tower in a block city, a time-of-day dial driving sun position,
sky, fog, window emissive, and the star field; the wordmark extruded in-scene
(`src/resources/tower-scene/lettering.tsx`) so the tower can occlude it; post as a
single MRT graph in `src/resources/tower-scene/fx.tsx` (bloom, AO, sky haze, FSR3
as the temporal resolver).

Without WebGPU the hero (and every scene) falls back to static posters —
`src/lib/use-webgpu.ts` is the one gate. `?no3d` forces the fallback.

## Things that look odd but are load-bearing

- `next.config.ts` aliases `three/addons/inspector/Inspector.js` to a stub —
  it breaks an import cycle in the R3F v10 alpha. Remove it and the build fails.
- The `AGENTS.md` block is written by `next dev`; commit it rather than
  fighting it.
- `pnpm-workspace.yaml` allows rapier 2.x to peer against R3F 10 — the range
  upstream is stale, not wrong; the patch repoints its imports at the WebGPU
  entry.
- Multi-canvas: every canvas shares one `WebGPURenderer` (the hero owns it as
  `id="main"`); `src/components/depth-attachment-sync.tsx` works around a
  three.js multi-canvas depth bug and belongs inside every `<Canvas>`.
