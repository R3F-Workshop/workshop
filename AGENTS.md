<!-- BEGIN:nextjs-agent-rules -->

# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->

## Purpose and authority

This is the Next.js workshop site. Its 3D pieces are self-contained experiences used by standalone demos and home-page sections. The active rules in this file describe this repository.

`AGENTS.react-three-examples.md` is an inactive reference copied from the sibling example gallery. Consult it for investigated R3F, Drei, Three.js, and WebGPU edge cases. Its Vite commands, gallery structure, test harness, paths, stack pins, review workflow, and changelog do not apply here. Verify version-sensitive claims against this repository before adopting them.

## Commands and completion checks

- Use pnpm only. npm does not apply the patched dependency configuration.
- `pnpm dev` starts Next.js development on port 3000.
- `pnpm exec tsc --noEmit` type-checks the project.
- `pnpm lint` runs ESLint.
- `pnpm build` creates the production build.
- `pnpm start` runs the production build.

For substantive changes, type-check, lint, and build. A compiler is not visual verification. Open the affected page in a WebGPU browser, confirm the console is clean, and exercise changed controls, pointer behavior, and transitions. For shell or fallback work, also verify `?no3d`. For shared-renderer work, verify the affected secondary canvas while resizing and scrolling away and back.

## Stack pins and compatibility

- Next.js 16.3.0 with the App Router.
- React and React DOM 19.2.8.
- `@react-three/fiber` 10.0.0-alpha.5.
- `@react-three/drei` 11.0.0-alpha.7.
- Three.js 0.185.1 with `@types/three` 0.185.4.
- `@react-three/rapier` 2.2.0 with a local WebGPU-entry patch and an allowed v10 peer range.
- Leva 0.10.x, camera-controls 3.1.x, Tailwind 4, and TypeScript strict mode.
- `@pmndrs/sky` uses the published package from the npm registry.

Treat `package.json`, `pnpm-lock.yaml`, and `pnpm-workspace.yaml` as authoritative. Alpha APIs move quickly. Read installed source and declarations before applying advice from another version.

Every patch, alias, pin, or vendored workaround needs a concise reason and removal condition. Do not remove the Rapier patch without validating the behavior it protects.

## Testing principles

- Cover the common paths that represent most real usage. Add edge-case tests when they protect an important regression.
- Test observable features and user stories, not implementation details. Test internals only when public behavior cannot cover the case reliably.
- Scope verification to the changed experience first. Interactions must be exercised, not merely rendered in their default state.
- Multi-canvas behavior requires explicit checks of secondary canvases.

## Code and comments

- JavaScript and TypeScript statements use semicolon endings.
- Prefer compact conditionals without braces when the body remains clearly readable.
- Avoid top-level constants unless they clarify ownership or avoid repeated work. Inline frequently tuned hook values when that is easier to read.
- Comments document current behavior, reasoning, algorithms, and non-obvious ownership. They do not narrate change history.
- Say each concept once. Put implementation detail beside the code it explains.
- Use simple punctuation in comments. Do not use semicolons or em dashes in prose comments.
- Use `//* Section =========================================` for major concepts in long files. Prefer top-level boundaries, but a long algorithm may use them for distinct phases. Short files do not need section markers.

Import order runs from fundamental to local:

1. React and Next.js.
2. `three/webgpu`, `three/tsl`, then Three.js addons.
3. `@react-three/fiber/webgpu`.
4. Drei, Rapier, Sky, Leva, and other 3D ecosystem packages.
5. Other third-party packages.
6. Project aliases under `@/`.
7. Parent-relative imports.
8. Sibling-relative imports.

Blank lines between tiers are optional. Do not churn a file solely to change import grouping.

## Types

- Derive JSX-facing props from `ThreeElements` or the component that receives them.
- Hand-write domain, simulation, and concrete TSL node types when they describe produced values rather than JSX props.
- Keep local-only types in the file.
- Put app-owned types shared across files in an appropriate `src/types/<context>.d.ts` using declarations, not exports and imports.
- Before adding a cast, check whether the installed typings already express the value. When unavoidable, keep the cast narrow and explain the actual type gap.
- Do not use `ReturnType<typeof uniform>`. The overload set discards the specific type inferred by the call.

## Experiences

All 3D on this site is an experience under `src/app/experiences/<slug>/`. An experience owns its Canvas, renderer configuration, camera, scene, frame loop, and DOM overlay. It fills the box where it is mounted with `absolute inset-0` and returns null without WebGPU.

Each experience folder has:

- `<slug>.tsx`, exporting one PascalCase experience component.
- `index.ts`, providing the `next/dynamic` boundary with `ssr: false`.
- Optional sibling files split by meaningful scene role when the experience is complex.

A vanilla Three.js experience keeps its imperative scene in a sibling `.ts` file. Its React component owns the canvas and one effect that mounts and disposes the scene.

Shells import from the experience folder, never directly from its component file. This keeps `@react-three/fiber/webgpu` out of the server render graph.

Two shell types mount experiences:

- `src/app/demos/<slug>/page.tsx` is a server page with metadata, a title plate, optional `InfoDialog`, optional `ControlsToggle`, and the experience. Public demos are listed in `DEMOS`; focused teaching subroutes may remain intentionally unlisted.
- `src/app/home/sections/<section>/components/<slug>-canvas.tsx` renders a starter placeholder or drops in the completed experience.

No config files or shared scene wrappers unless the experience genuinely needs one. Avoid props unless a shell or coordinating owner truly supplies the value. Keep tunables near the code they affect.

Use the `new-experience` skill to scaffold an experience.

## Controls and ownership

- Place controls at the nearest stable owner of their values.
- Values configuring the Canvas or coordinating sibling systems may remain at the experience root.
- Values consumed by one Canvas child should live with that child, especially when they feed uniforms.
- Do not drill Leva values through components that do not consume them.
- Shared values live at the nearest common parent. Repeated instances receive ordinary data props rather than separate Leva registrations.
- Prefix Leva folders with the experience slug.
- Do not write per-frame values back into Leva. Use uniforms or refs.
- In a named Leva folder, `button()` receives the raw store getter. Read sibling values by their fully qualified path.
- Add controls and diagnostics when they expose the main concept, support a workshop exercise, or provide necessary demo tooling. Avoid speculative controls and plumbing that outweighs their teaching value.

## React Three Fiber

Import Canvas and Fiber hooks from `@react-three/fiber/webgpu`. Do not mix Fiber entry points.

Prefer Drei's `@react-three/drei/webgpu` entry when it exports the helper. Drei's WebGPU entry does not export `CameraControls` or `CameraControlsImpl`, so those are explicit exceptions imported from `@react-three/drei`.

### Scene structure

- Build R3F scene graphs declaratively in JSX.
- Prefer an intrinsic over `<primitive>` when an intrinsic owns the same instance cleanly.
- Map small, legible data arrays instead of repeating near-identical JSX.
- Imperative Three.js is valid when JSX cannot express the lifecycle clearly, a resource is genuinely shared, or the experience intentionally teaches vanilla Three.js.
- Keep imperative ownership and disposal visible.
- Broad geometry or material sharing should prompt consideration of instancing.

### Resource hooks

Use the v10 hook matching the resource:

- `useLocalNodes` for component-local TSL graphs.
- `useNodes` for intentionally shared or create-once graphs.
- `useUniforms` for values React owns.
- `useBuffers` and `useGPUStorage` for GPU resources.
- `useTexture` and `useLoader` for loaded assets.

Keep `useMemo` for CPU-side geometry, materials, textures, or objects derived from changing runtime inputs, and for documented gaps in the installed alpha. Depend on stable members returned from a hook rather than a fresh wrapper or loader array.

### Frame loop

- Destructure every `FrameState` field the callback uses, such as `useFrame(({ delta, elapsed, renderer }) => {})`.
- `delta` and `elapsed` are seconds. `time` is the RAF timestamp in milliseconds.
- Do not use the legacy second callback parameter or `state.clock`.
- `useFrame(() => {})` is correct when no frame state is needed.
- Prefer scheduler options such as `phase`, `before`, `after`, `order`, and `fps` over numeric priorities.
- Compute belongs in the `update` phase.
- A callback in the `render` phase takes over rendering for its root. Keep it synchronous and never await inside it.
- Use returned pause and resume controls instead of ad-hoc frame-loop booleans.
- `state.pointer` starts at `(0, 0)` before the first pointer event.
- WebGPU viewport and scissor coordinates use a top-left origin. Reassert mutable viewport and scissor state in each custom-render frame when another renderer job may reset it.

### Renderer and camera

- Configure WebGPU constructor options through the Canvas `renderer` prop.
- Use `state.renderer`; `gl` is a deprecated alias.
- Set tone mapping and output color space deliberately. Fiber and vanilla Three.js have different defaults.
- Fiber aims a generated default camera at the origin unless an explicit rotation suppresses that behavior.
- Shadow names map by behavior: `basic` is `BasicShadowMap`, `percentage` is `PCFShadowMap`, and `variance` is `VSMShadowMap`. `soft` is deprecated.

Name refs for what they contain, such as `meshRef`, `controlsRef`, and `boundsRef`. Use `React.ComponentRef<typeof Component>` for forwarded third-party component refs. Accept `React.RefObject<T | null>` when a component must read `.current`; a forwarded-only ref may remain `React.Ref<T>`.

## TSL and WebGPU

- Import Three.js renderer classes from `three/webgpu` and shader nodes from `three/tsl`.
- JavaScript conditions in a node builder run once at build time. Use TSL `If`, `Loop`, or `select` for runtime GPU decisions.
- Keep `Fn()` wrappers where `.toVar()` or `.assign()` requires an active node stack.
- Prefer built-ins such as `time` and `cameraPosition` over hand-driven equivalents.
- Use `useUniforms` for React-owned values. Create a plain `uniform()` inside a create-once node owner for frame-loop-owned values, otherwise React reconciliation can reset animation state.
- `uniform(threeObject)` retains the live object reference.
- Return flat records from `useNodes`.
- Use identifier-safe, globally meaningful scope names for shared resources.
- Use uint loops when combining a loop index with `instanceIndex`.
- Set `frustumCulled={false}` when `positionNode` moves geometry outside CPU-side bounds.
- Remember that `factor.mix(a, b)` means `mix(a, b, factor)`.
- Use ordinary scene fog for ordinary fog. Only custom fog needs a TSL graph.
- WebGPU clipping uses `ClippingGroup`. Material `clippingPlanes` is a WebGL path.
- Bare `Node` fields and destructured `Fn` parameters can lose fluent typed math. Use the narrow concrete node type required by the operation and explain the type gap.
- Prefer generic type parameters for `attribute`, `uniformArray`, and buffer creators rather than widening string arguments.

## Compute and post-processing

- Build compute kernels once with `Fn(() => {})().compute(count)`.
- Own buffers through `useBuffers` and storage textures through `useGPUStorage`.
- Dispatch one-time idempotent compute from an effect, simulations from `useFrame` in the `update` phase, and event-driven compute from event handlers.
- Use Fiber's `useRenderPipeline`, not WebGL-only `@react-three/postprocessing`.
- Keep dynamic pass values in uniforms or documented writable fields.
- Inspect a pass implementation before replacing a field or passing a uniform through its factory. Some factories wrap values again and some graphs capture constructor fields.
- Structural graph swaps require `renderPipeline.needsUpdate = true`.
- Configure MRT in the pipeline setup callback.
- Guard pass records read during React effects because they may not exist on the first component render.
- Set offscreen samples to zero when a pass samples or copies depth.

## React and ecosystem gotchas

- Keep an environment and node materials that require first-build IBL behind a shared Suspense gate.
- Loader results are cached and shared. Mutate a loaded scene only in an effect with symmetric cleanup.
- StrictMode replays effects. Creation, connection, cleanup, and disposal must remain symmetric and safe when repeated.
- Renderer-construction-time configuration belongs in the Canvas renderer factory, not a later effect.
- Use `useLayoutEffect` for imperative state that must exist before the first rendered frame.
- A callback ref does not trigger a render. Mirror a mounted instance into state when another component must react to it.
- Prefer explicit animation clip names.
- Drei v11 alpha.7 `useGLTF` accepts the options object form.
- Canvas-level `onPointerMissed` is the reliable click-away API. Per-object misses are not click-only.
- Disable Rapier auto-colliders when child meshes should not each receive a collider.
- Set `colorSpace={SRGBColorSpace}` explicitly on attached texture children used as color maps.
- Hover that must update under a still pointer while the camera moves needs frame-driven event updates.
- Sized or textured WebGPU particles use sprites with `PointsNodeMaterial`; native point primitives remain one pixel.
- DOM elements such as `<audio>` stay outside Canvas.
- Avoid persistent prototype patches in this single-page application. Install and remove an unavoidable patch symmetrically.
- `onBeforeRender` and `onAfterRender` work as normal JSX assignments.

## Shared renderer and multiple canvases

The home page uses one primary WebGPU renderer across multiple Canvas roots.

- Register the primary renderer with its stable root name.
- Secondary canvases wait for the primary and borrow it through `renderer.primaryCanvas`.
- Use root scheduler constraints to make data dependencies explicit.
- Scheduling and idling are per render job.
- A shared renderer's `renderer.domElement` belongs to the primary canvas. DOM listeners for a secondary canvas need an explicit per-canvas target.
- Keep the depth-attachment synchronization workaround until targeted browser verification proves the installed Fiber version makes it redundant.
- Never nest a finished experience inside another Canvas.
