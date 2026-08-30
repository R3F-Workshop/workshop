# Workshop fallback — Paris mini-site

The workshop build of the Paris mini-site: Advanced React Three Fiber —
the PMNDRS workshop at Gobelins, Paris, September 8–9 2026.

## Branches

- **`main`** — the workshop *starting point*: same page structure, every
  canvas a placeholder, the finished pieces staged in `resources/` ready to
  paste back.
- **`final-version` (you are here)** — the complete site with the real hero
  and section scenes.

This repo is the production site with the production overhead removed: no
hidable-section machinery, no unfinished sections, no dev harnesses, no dead
code. What's left is the site as it ships plus the demo pages — the parts worth
teaching from. The live site's repo remains the source of truth for production.

Next.js 16 (App Router) · Tailwind v4 · shadcn/ui · React Three Fiber v10
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
`patches/` (wired up in `pnpm-workspace.yaml`); installing with npm silently
skips them and the build fails.

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
| `app/page.tsx` | The site. Server components throughout except the header and hero. |
| `components/hero/` | The hero shell: reveal choreography, the time-of-day dial and its replay spring. |
| `components/hero-demo/` | The real hero pipeline: tower canvas, lettering, buildings, terrain, lights, the MRT post graph (`fx.tsx`), probes. |
| `components/sections/` | One component per content section, all server-rendered. |
| `components/three/` | The section and demo scenes (TSL shaders), plus the shared multi-canvas infrastructure. |
| `lib/content.ts` | Every string on the site. |
| `lib/time-of-day.ts` | The cyclic sky/palette model shared by the DOM gradient and the 3D lighting. |
| `vendor/pmndrs-sky` | Vendored `@pmndrs/sky` build (`link:` dep). `pnpm sync:sky` re-copies it from a local sky checkout (`SKY_REPO`); the checked-in `dist/` means fresh clones need nothing. |

## The hero

A live R3F v10 WebGPU scene: the tower in a block city, with a time-of-day
dial driving sun position, sky, fog, window emissive, and the star field. The
CSS sky gradient stays in the DOM behind a transparent canvas; the wordmark is
extruded in-scene (`components/hero-demo/lettering.tsx`) so the tower can
occlude it. Post is a single MRT graph in `components/hero-demo/fx.tsx`
(bloom, AO, sky haze, FSR3 as the temporal resolver).

Without WebGPU the hero (and every scene) falls back to static posters —
`lib/use-webgpu.ts` is the one gate. `?no3d` forces the fallback.

## Things that look odd but are load-bearing

- `next.config.ts` aliases `three/addons/inspector/Inspector.js` to a stub —
  it breaks an import cycle in the R3F v10 alpha. Remove it and the build fails.
- The `AGENTS.md` block is written by `next dev`; commit it rather than
  fighting it.
- `pnpm-workspace.yaml` allows rapier 2.x to peer against R3F 10 — the range
  upstream is stale, not wrong; the patch repoints its imports at the WebGPU
  entry.
- Multi-canvas: every canvas shares one `WebGPURenderer` (the hero owns it as
  `id="main"`); `components/three/depth-attachment-sync.tsx` works around a
  three.js multi-canvas depth bug and belongs inside every `<Canvas>`.
