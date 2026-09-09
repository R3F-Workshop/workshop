# TSL lessons: three demo groups

Three new step-by-step lessons under `/demos/`, each a folder of small experiences that build on the previous one, in the shape of the existing `tsl-hooks` and `compute` lessons. Every lesson step is its own experience file, its own demo page, and a chip in a shared `StepNav`.

Ground rules for every demo in this spec:

- Node builders are written inline inside the hook call. No module level `build()` functions. `useLocalNodes` creators are wrapped in `useCallback` when they close over props.
- Demo pages are shells only: metadata, the experience, `ControlsToggle`, a title plate, the step nav.
- Leva folders are prefixed with the lesson slug and the step, e.g. `tsl materials · mix`.
- Every experience owns its Canvas and mounts the shared `Stage`. No WebGPU gate, no `?no3d` fallback, no defensive production guards. The audience has WebGPU. Write the clean version that works.
- Each step is a copy of the previous step plus one idea. Repetition between files is deliberate.

## The shared stage

`src/app/experiences/stage/stage.tsx`, imported by experience components only (never by a page shell). It is a Canvas child, not a Canvas, so each experience still owns renderer and camera configuration.

`<Stage>` renders:

- `CameraControls` from `@react-three/drei` (the documented non-webgpu exception), `makeDefault`, orbit only, polar clamp so the camera never goes under the floor, distance clamp 3 to 14, default look-at on `[0, 1, 0]`.
- A room: a 12 unit floor and two 6 unit walls meeting in the back corner, matte off-white, `receiveShadow`. The open sides show the environment.
- A key `directionalLight` with `castShadow`, 2048 shadow map, frustum sized to the room, plus a low `hemisphereLight` fill.
- The generated studio environment from `home/components/canvas/studio-env` through Fiber's `EnvironmentMap`, as IBL and as the visible background (blurred). No network fetch.
- `children`, placed by the caller. Subjects sit on the floor at `y = 0`.

Experiences use `<Canvas shadows camera={{ position: [4, 3, 6], fov: 40 }} dpr={[1, 2]} renderer={{ antialias: true }}>` and set tone mapping and output color space explicitly. `stage.tsx` also exports that camera position so the four files do not drift.

No props on `Stage` beyond `children`. If the terrain lesson needs a bigger room it scales its own content down instead.

## Lesson 1: TSL materials (`/demos/tsl-materials/*`)

Folder `src/app/experiences/tsl-materials/`. One `index.ts` with four dynamic exports. Steps nav at `src/app/demos/tsl-materials/components/step-nav.tsx`.

Shared file `switching-mesh.tsx`: `<SwitchingMesh>` owns the Leva `geometry` select in folder `tsl materials · mesh` with options `sphere`, `octahedron`, `plane`, `helmet`. It resolves the geometry (sphere radius 1 at y 1, octahedron, a 2.4 unit plane tilted to face the camera, the DamagedHelmet geometry from `public/models/DamagedHelmet.glb` via `useGLTF` inside its own Suspense) and renders one `<mesh castShadow receiveShadow>` with `children` as the material. The helmet's own material is not carried over. Only its geometry is the point.

### 1 mix (`mix.tsx`)

The smallest thing. Stage, one `SwitchingMesh`, one `meshStandardNodeMaterial`.

- Leva `tsl materials · mix`: `colorA`, `colorB`, `blend` 0..1, `roughness`.
- `useUniforms({ colorA, colorB, blend }, "tslMix")`.
- `useNodes(({ uniforms }) => { const u = uniforms.scope("tslMix"); return { surface: mix(u.colorA, u.colorB, u.blend) }; }, "tslMix")` written inline in the `Subject` component.
- `<SwitchingMesh><meshStandardNodeMaterial colorNode={nodes.surface} roughness={roughness} /></SwitchingMesh>`.

Teaches: `useUniforms` turns Leva values into uniforms, `useNodes` builds a graph once and hands it back, the material takes the node as a prop.

### 2 readers (`readers.tsx`)

Same `Subject` as step 1, unchanged. Two new meshes in a sibling file `readers-meshes.tsx`, both on the floor beside the subject:

- `Box`: calls `useNodes` with the same `"tslMix"` scope. Because the scope already exists its builder never runs, and the hook hands back the subject's `{ surface }`, which the box uses as its `colorNode` directly. Shows a second component reading a registered graph. Comment explains the builder only runs the first time the scope is seen, so the reader's builder never runs while the subject is mounted.
- `Pyramid`: `useLocalNodes` with a creator that reads both `uniforms.scope("tslMix")` and `nodes.scope("tslMix")`, and mixes the shared `surface` with a third fixed color by `positionLocal.y`. Shows the scopes are available inside every creator, and that a local graph can wrap a shared one.

Teaches: one graph, three materials, and the difference between registering with `useNodes` and consuming with `useLocalNodes`.

As built: the store commits a scope in a layout effect after the writer's render, so the scope-name read form `useNodes("tslMix")` sees an empty scope during the first render and a frame job that captured it would read undefined. Step 2's box therefore passes the same builder as the subject (the creator path reads through the staged scope). In steps 3 and 4 the box uses `useLocalNodes` with a comment explaining this, since its frame job needs the phase uniform on the first frame.

### 3 noise (`noise.tsx`)

Copy of step 2. The `tslMix` scope becomes `tslNoise` and the builder returns three animated patterns instead of a flat mix, each from a different MaterialX noise node so the three meshes look different:

- `fractal`: `mx_fractal_noise_float(positionLocal.mul(frequency).add(time.mul(speed)), octaves, lacunarity, gain)` remapped to 0..1, used as the blend for the subject.
- `worley`: `mx_worley_noise_float` for the box.
- `cell`: `mx_cell_noise_float` for the pyramid.
- Leva `tsl materials · noise`: `frequency`, `speed`, `octaves`, `lacunarity`, `gain`, `contrast`, plus the two colors.

Each pattern feeds `mix(colorA, colorB, pattern)`. The readers change only which key they read. Teaches: `time` as a built in, MaterialX noise inputs, and that the same scope can carry several graphs.

### 4 wobble (`wobble.tsx`)

Copy of step 3 plus vertex displacement and a frame loop you can control from outside the Canvas.

- Inside the `tslWobble` `useNodes` builder: `const wobble = Fn(({ phase }) => positionLocal.add(normalLocal.mul(sin(positionLocal.y.mul(u.frequency).add(phase)).mul(u.amplitude))))`. One `Fn`, called three times with three different phase uniforms.
- The three phase uniforms are plain `uniform(0)` created inside the builder, because the frame loop owns them. Leva owns `amplitude`, `frequency`, `speed` through `useUniforms`.
- Each mesh has its own `useFrame(({ delta }) => { phase.value += delta * speed }, { id: "tslWobble:sphere" })`, likewise `:box` and `:pyramid`. `frustumCulled={false}` on all three since `positionNode` moves them. Displacement along `normalLocal` tears flat-shaded seams open, so the box is drei's `RoundedBoxGeometry` and the pyramid is a cone run through `mergeVertices` with recomputed normals. Leva keys are `wobbleAmplitude`, `wobbleFrequency`, `wobbleSpeed` so they do not collide with the noise dials.
- `wobble-controls.tsx`: a DOM panel rendered by the experience outside the Canvas. It calls `useFrame()` with no callback to get `scheduler`, and shows three play/pause buttons wired to `scheduler.pauseJob(id)`, `resumeJob(id)`, `isJobPaused(id)`, subscribing through `scheduler.subscribeJobState` with `useSyncExternalStore` so the buttons re-render when a job flips.

Teaches: `Fn` with object inputs, `positionNode`, loop-owned uniforms versus React-owned uniforms, named jobs, and controlling the frame loop from ordinary React.

## Lesson 2: terrain (`/demos/tsl-terrain/*`)

Folder `src/app/experiences/tsl-terrain/`. The existing `compute/terrain` demo taken apart into five steps, so the compute pass arrives as the answer to a problem the first two steps show. The terrain is 6 units wide so it sits in the room. Every step keeps the same noise dials so a visitor can drag `frequency` on each page and see what changed.

### 1 vertex (`vertex.tsx`)

A `PlaneGeometry(6, 6, 200, 200)` laid flat. The noise runs in the vertex shader.

- Leva `tsl terrain · noise`: `frequency`, `octaves`, `lacunarity`, `gain`, `amplitude`, `offsetX`, `offsetZ`. All through `useUniforms` into scope `tslTerrain`.
- `useNodes(({ uniforms }) => { const height = Fn(({ xz }) => mx_fractal_noise_float(...)); ... }, "tslTerrain")` returns `positionNode` (local y replaced by height times amplitude) and `normalNode` built from two more `height` samples one step over. Comment counts the cost: three noise evaluations per vertex, every frame, for a still landscape.
- Material is a plain grey `meshStandardNodeMaterial` so the shape is the only thing on screen.

### 2 color (`color.tsx`)

Copy of step 1. The builder also returns `colorNode`: sand, grass, rock, snow bands over height and slope with `smoothstep`, and Leva `water` and `snow` levels. A flat water sheet at the water line. Teaches: reading the same height twice, once for position and once for color, in one graph.

### 3 compute (`compute.tsx`)

Copy of step 2 with the noise moved into a compute pass.

- `useGPUStorage` registers a 256 by 256 half float `StorageTexture` `tslTerrainMap`.
- The `useNodes` builder returns `bake`, a `Fn(() => {...})().compute(SIZE * SIZE)` that writes height and normal per texel, and the ground's `positionNode`, `normalNode`, `colorNode` now sample the texture with `texture(map, uv).level(int(0))`.
- An effect on the noise dials sets a dirty ref. `useFrame` in the `update` phase dispatches `renderer.compute(nodes.bake)` once when dirty.
- A counter outside the Canvas shows how many bakes have run. Dragging a slider adds one. Orbiting the camera adds none.

Teaches: the same graph, run once instead of per vertex per frame, and the difference between compute dispatch and per frame sampling.

### 4 trees (`trees.tsx`)

Copy of step 3 plus an `instancedMesh` of 2000 cones whose `positionNode` samples the map at a hashed xz and drops to zero scale where the ground is under water, above the snow line, or too steep. Leva `tsl terrain · trees`: `count` is fixed, `treeline` and `maxSlope` are uniforms. Teaches: a second consumer of the baked texture that never evaluates noise, placed entirely on the GPU. The comment contrasts this with drei's `useSurfaceSampler`, which needs CPU geometry the bake never produces.

### 5 airplane (`airplane.tsx`)

Copy of step 4 plus the boxy airplane. The step is named airplane throughout, never plane, because the geometric plane is the subject of step 1. The CPU drives its circuit in `useFrame` and writes `planeXZ` into a uniform. Its altitude is the map sampled at that uniform in the vertex shader, and a shadow quad samples per vertex and hugs the slope. Leva `speed` and `clearance`. Teaches: CPU and GPU sharing one value, the CPU never reading a height.

## Lesson 3: post processing (`/demos/tsl-post/*`)

Folder `src/app/experiences/tsl-post/`. Steps 1, 2, 3 and 5 use the Stage with the Eiffel tower from `public/hero-demo/free__la_tour_eiffel.glb` on a low cylinder pedestal, scaled to about 2.5 units tall. Shared `tower.tsx` loads it once with a plain bronze standard material. Step 4 is the sky example and does not use the room.

### 1 outputs (`outputs.tsx`)

- `useRenderPipeline` setup callback calls `scenePass.setMRT(mrt({ output, normal: normalView, emissive }))`.
- Leva `tsl post · outputs`: `view` select with `beauty`, `normal`, `depth`, `emissive`, `uv`. The select maps to an integer stored through `useUniforms` as `view`.
- The main callback sets `renderPipeline.outputNode` to a `Fn` that picks with a `select` chain on the uniform, so changing the select never rebuilds the pipeline. Depth comes from `scenePass.getViewZNode()` remapped to 0..1 with a `depthRange` slider.

Teaches: MRT, texture nodes off the scene pass, and a runtime GPU condition versus a JavaScript one. The pass renders without MSAA because the graph samples its depth, so an FXAA pass closes the chain.

### 2 pipeline (`pipeline.tsx`)

Same scene. A typical chain: `ao()` from `GTAONode` multiplied into the beauty, `bloom()` on the emissive attachment, a hand written vignette `Fn` on `uv()` distance, then `renderOutput` for tone mapping and color space. Leva `tsl post · pipeline`: `ao` toggle, `aoRadius`, `bloom` toggle, `bloomStrength`, `vignette` strength, `fxaa` toggle, `toneMapping` select (ACES, AgX, Neutral, none), `exposure`. Toggles change graph structure and trigger `rebuild()`. Sliders write into pass fields or uniforms without a rebuild. Comments mark which is which.

### 3 ssgi (`ssgi.tsx`)

The room gets a red side wall and a blue side wall, and two small emissive slabs on the floor near the tower. `ssgi()` from `SSGINode` with `denoise()` after it, following the wiring in `paris-tower/fx.tsx`. Leva `tsl post · ssgi`: `enabled` toggle to compare, `giIntensity`, `aoIntensity`, `radius`, `sliceCount`, `stepCount`, `temporal` toggle, `showGI` to view the GI buffer alone. Teaches: what screen space GI adds, why it needs normals and depth, and its cost dials. TRAA closes the chain with a `velocity` attachment on the MRT, in both branches of the `enabled` toggle, because the rotating sample pattern needs a temporal resolver to settle.

### 4 haze (`haze.tsx`)

A port of `SebH-TSL-Sky/examples/vanilla/07-space-to-ground.html` to R3F: the `Sky` component from `@pmndrs/sky/react` at planet scale, the cinematic descent from 400 km to 300 m, hand off to free flight, exposure keyed to altitude, and the haze post process through `sky.applyHaze(passes.scenePass.getTextureNode(), { scenePass, policy })` in `useRenderPipeline`. `sky.update(camera, { planetCenter })` and `sky.updateAerialPerspective()` run in `useFrame`. Leva `tsl post · haze`: `sunElevation`, `sunAzimuth`, `hazeStrength`, `hazePolicy` select (`auto`, `ap`, `raymarch`), `haze` toggle, `autoExposure`, `exposure`, and a `restart descent` button. Teaches: aerial perspective as a post pass that reads scene depth. FXAA after the tone map smooths the mountain edges.

### 5 fsr (`fsr.tsx`)

The room and tower, with motion: the pedestal turns slowly, a chrome sphere orbits the tower, and `CameraControls` auto rotates. `upscale()` from `@pmndrs/upscaler` on the scene pass color, depth and `velocity` MRT attachment, with the unjittered projection bound as `fx.tsx` does. Leva `tsl post · fsr`: `enabled` toggle, `quality` select (native AA, quality, balanced, performance, ultra performance), `sharpness`, `path` select (`bilinear`, `spatial`, `temporal`), and `debugView` select over the upscaler's `DebugView` enum: none, motion vectors, disocclusion, depth, accumulation age, locks, exposure. A corner readout shows render resolution versus display resolution. Teaches: what the upscaler consumes and what each of its internal buffers means.

## Pages, listing, and verification

- Pages at `src/app/demos/tsl-materials/<step>/page.tsx`, `tsl-terrain/<step>`, `tsl-post/<step>`, each with the lesson's `StepNav`.
- Three `DEMOS` entries, each linking to step 1 of a lesson, in the same voice as the existing entries.
- Every step is type checked, linted, built, and opened in headless WebGPU Chrome with a clean console, its Leva controls exercised, and a screenshot taken. The wobble buttons, the bake counter, the pipeline toggles, and the FSR debug views are exercised specifically.

## Build order

1. Stage and `SwitchingMesh`.
2. The three lessons in parallel, one agent each, each building its steps in order and reusing the previous step's file.
3. A verification pass over all fifteen pages, then fixes.
