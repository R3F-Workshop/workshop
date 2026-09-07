<!-- BEGIN:nextjs-agent-rules -->

# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->

## Testing Principles

- Cover the common paths that represent the 80% of real usage. Add edge-case tests only when the edge case is important or guards against a meaningful regression.
- Test observable features and user stories, not implementation details. Test internals only when an exceptionally difficult case cannot be covered reliably through public behavior.

## Comments

Comments should be concise and relavant to explaining the algorithm or feature. It should not explain changes or a history of the codebase. Comments should serve as documentation. Use simple punctuation. Do not use semicolons or em dashes, for example.

# Const Policy

We want reduce top level const and inline anything that is an explicit hook we need tweak often. Always ask yourself if a const needs to exist before making it. Prefer to inline.

# Experiences

All 3D on this site is an experience: one self contained component under `app/experiences/<slug>/` that owns its own `<Canvas>`, renderer, camera, scene, loop, and any DOM overlay, and fills whatever box it is dropped into (`absolute inset-0`). It returns null without WebGPU. No config files, no shared scene wrappers, no props unless a shell truly needs one. Tunables are literals in the file.

Each folder has:

- `<slug>.tsx` exporting one PascalCase component. Everything lives here. A vanilla three.js experience keeps its three.js in a sibling `.ts` file and this file is a div plus an effect.
- `index.ts`, the `next/dynamic` `ssr: false` boundary. Shells import from the folder, never from the component file, because `@react-three/fiber/webgpu` cannot be in the server render graph.

Two shells drop an experience in and add nothing else:

- The demo shell, `app/demos/<slug>/page.tsx`. A server page with metadata, a title plate, optional `InfoDialog`, optional `ControlsToggle` when the experience uses Leva, and the component. Listed in `DEMOS` in `app/demos/page.tsx`.
- The section shell, `app/home/sections/<section>/components/<slug>-canvas.tsx`. On the starter it renders the placeholder. Bringing the finished version back is replacing its body with the component.

Leva knobs, when an experience has them, are a `useControls` call inline in the component with a folder named after the slug. Demo pages show the panel through `ControlsToggle`. The home page mounts `LevaPanel` hidden so a dropped in experience never spawns its own.

Use the `new-experience` skill to scaffold one.
