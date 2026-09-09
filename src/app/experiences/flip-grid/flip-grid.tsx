"use client";

import {
  Canvas,
  useFrame,
  useGPUStorage,
  useLocalNodes,
  useThree,
  useUniforms,
  type CreatorState,
} from "@react-three/fiber/webgpu";
import { folder, useControls } from "leva";
import { useCallback, useMemo, useRef, type RefObject } from "react";
import {
  clamp,
  cos,
  dot,
  exp,
  float,
  Fn,
  hash,
  instancedArray,
  instanceIndex,
  length,
  max,
  positionLocal,
  select,
  sin,
  struct,
  transformNormalToView,
  vec2,
  vec3,
} from "three/tsl";
import {
  ACESFilmicToneMapping,
  Vector2,
  type Node,
  type PointLight,
  type WebGPURenderer,
} from "three/webgpu";

import type { EnvPreset } from "@/app/home/components/canvas/studio-env";
import { useWebGPU } from "@/lib/use-webgpu";

import { Environment } from "./environment";
import { tileSurface } from "./tile-surface";
import { AWAY, useSweepCursor } from "./use-sweep-cursor";

/**
 * A grid of tiles that flip to gold as the cursor sweeps them, and hold that
 * pose for a few seconds before falling back.
 *
 * The whole experience: a canvas, the environment the gold reflects, the
 * simulation, and the Leva panel that tunes it. Drop `<FlipGrid />` into any
 * box and it fills it. The root element is also what the cursor is measured
 * against.
 *
 * This is the payoff of the compute lesson. Every piece of it is taught on
 * its own under `src/app/experiences/compute/`: the persistent buffer, the
 * cursor as a uniform, the hashed per instance variation, the swept segment.
 * Here they are together. The gold itself is in `tile-surface.ts` so that
 * this file can be about the simulation.
 *
 * The whole simulation lives on the GPU. A storage buffer holds one `Tile`
 * struct per instance, flip angle, angular velocity, and the hold timer, a
 * compute pass integrates it, and the vertex stage reads the angle back out.
 * The CPU writes five floats a frame (dt plus two pointer positions) no matter
 * how many tiles there are.
 *
 * That is the whole argument for the WebGPU path. Per-instance state is what
 * a stateless version can't have: with the flip angle derived from cursor
 * distance every frame, there is nowhere to put a timer, so "stay flipped for
 * three seconds" is unrepresentable. Doing it on WebGL means either ~1800
 * matrix writes per frame from JavaScript or a ping-pong float-texture dance.
 *
 * The wiring is the same three hooks as the grain gradient. `useUniforms`
 * takes the Leva values as they are and makes a named uniform per key under
 * the `flipGrid` scope of the fiber store, keeping the values in sync on
 * every render, so a slider drag is a value write and never touches the
 * graph. `useGPUStorage` registers the tile buffer. `useLocalNodes` builds
 * the graph once, reading the scope back out of the store.
 */

/**
 * Per-instance simulation state.
 *
 * Only genuinely stateful fields live here. Per-tile mass is derived from a
 * hash of the instance index instead: deterministic, free, and it needs no
 * init pass, which means the zero-filled buffer three allocates is already a
 * valid starting state.
 */
const Tile = struct(
  {
    /** Flip angle in radians. 0 rests dark side out, π shows the gold. */
    angle: "float",
    angVel: "float",
    /** Seconds left before this tile is allowed to fall back. */
    hold: "float",
  },
  "Tile",
);

/**
 * three's TSL types tag every node with its GLSL type. Struct members come back
 * as untyped nodes, so these name the shapes we know those reads produce and
 * keep the casts in one place.
 */
type FloatNode = Node<"float">;
type Vec2Node = Node<"vec2">;

/**
 * Every tunable, as the Leva panel hands them back. The defaults and what each
 * one does are documented on the panel schema in `FlipGrid`.
 */
type Config = {
  cols: number;
  rows: number;
  fill: number;
  thickness: number;
  radius: number;
  hold: number;
  stiffness: number;
  damping: number;
  massJitter: number;
  front: string;
  back: string;
  edge: string;
  roughness: number;
  flakeCells: number;
  flakeStrength: number;
  flakeRoughness: number;
  toneJitter: number;
  roughJitter: number;
  tiltJitter: number;
  curvature: number;
  envPreset: EnvPreset;
  ground: string;
  sky: string;
  keyIntensity: number;
  kickIntensity: number;
  fillIntensity: number;
  envIntensity: number;
  cursorLight: number;
  cursorLightHeight: number;
  cursorLightColor: string;
};

function Scene({
  config,
  /** The element whose bounds map the cursor into the scene. */
  bounds,
}: {
  config: Config;
  bounds: RefObject<HTMLElement | null>;
}) {
  const { cols, rows } = config;
  const count = cols * rows;
  const { viewport } = useThree();
  // `useThree` types `renderer` as the WebGL/WebGPU union even on the /webgpu
  // entry, and `compute` only exists on the WebGPU one.
  // See pmndrs/react-three-fiber#3851.
  const renderer = useThree((s) => s.renderer) as unknown as WebGPURenderer;

  // One cell spans whichever axis needs more coverage, so the grid always
  // overfills rather than leaving a margin.
  const step = Math.max(viewport.width / cols, viewport.height / rows);

  // The cursor uniforms are the same two objects on every render. The hook
  // compares by identity, so it never resets them, and the frame loop below
  // is their only writer. A fresh `new Vector2` here would put the cursor
  // back at infinity on every slider tick.
  const sweep = useMemo(
    () => ({
      pointer: new Vector2(AWAY, AWAY),
      pointerPrev: new Vector2(AWAY, AWAY),
    }),
    [],
  );

  // Scoped, because uniforms resolve against the primary store. On the site
  // this canvas shares one renderer with the hero, and unscoped names would
  // collide with it. The same nodes come back through the registered scope
  // type inside the builder.
  const u = useUniforms(
    {
      // Sizes in world units, so the shader never has to know the viewport.
      step,
      tile: step * config.fill,
      radius: step * config.radius,
      thickness: config.thickness,
      hold: config.hold,
      stiffness: config.stiffness,
      damping: config.damping,
      massJitter: config.massJitter,
      dt: 0,
      pointer: sweep.pointer,
      pointerPrev: sweep.pointerPrev,
      // The gold. Hex strings become Colors on the way in.
      front: config.front,
      back: config.back,
      edge: config.edge,
      roughness: config.roughness,
      flakeCells: config.flakeCells,
      flakeStrength: config.flakeStrength,
      flakeRoughness: config.flakeRoughness,
      toneJitter: config.toneJitter,
      roughJitter: config.roughJitter,
      tiltJitter: config.tiltJitter,
      curvature: config.curvature,
    },
    "flipGrid",
  );

  // Zero-filled at allocation, which is exactly "flat, still, not held".
  // `instancedArray` accepts a struct type at runtime but isn't typed for one
  // yet; the buffer it hands back behaves as a flat float array either way.
  const tiles = useMemo(
    () => instancedArray(count, Tile as unknown as "float"),
    [count],
  );
  // Registered at the root with a prefixed key rather than in a "flipGrid"
  // scope, because r3f names scoped storage `scope.name`, and three builds the
  // WGSL struct name off that, so the dot lands in an identifier and the shader
  // fails to parse. Scoped uniforms use `scope_name`, which is fine; it's only
  // the storage path that differs. See pmndrs/react-three-fiber#3848.
  //
  // The builder below closes over `tiles` rather than reading it back from the
  // store: root entries are never removed on unmount, so after a resolution
  // remount the store would still hand back the old, wrongly sized buffer.
  useGPUStorage(() => ({ flipGridTiles: tiles }));

  // `useLocalNodes` re-runs its creator whenever the creator's identity
  // changes, and this component re-renders on every slider tick. An inline
  // arrow would rebuild the whole graph each time, and the compute node with
  // it: three keys compute pipelines by node id, so every rebuild is a fresh
  // pipeline. Memoised on the per-mount values, the graph is built once.
  const build = useCallback(
    ({ uniforms }: CreatorState) => {
      const u = uniforms.flipGrid;

      /** This instance's cell centre, in world units. */
      const cellCentre = () => {
        const ix = float(instanceIndex.mod(cols));
        const iy = float(instanceIndex.div(cols));
        return vec2(ix.sub((cols - 1) / 2), iy.sub((rows - 1) / 2)).mul(u.step);
      };

      /**
       * Distance to the segment the cursor swept this frame, not to where it
       * happens to be right now.
       *
       * This canvas runs at a throttled framerate, so a fast sweep moves the
       * pointer several cells between samples. Testing against the point
       * leaves gaps in the trail; testing against the segment fills them in,
       * for the cost of one dot product.
       */
      const distanceToSweep = (p: Vec2Node) => {
        const a = u.pointer;
        const ab = u.pointerPrev.sub(a);
        const t = clamp(dot(p.sub(a), ab).div(max(dot(ab, ab), 1e-6)), 0, 1);
        return length(p.sub(a.add(ab.mul(t))));
      };

      /**
       * The integrator. One invocation per tile, every frame, on the GPU.
       *
       * The same integrator as the persist demo's fountain, with a spring in
       * place of gravity and a struct in place of two buffers.
       */
      const update = Fn(() => {
        const tile = tiles.element(instanceIndex);
        const angle = tile.get("angle") as FloatNode;
        const angVel = tile.get("angVel") as FloatNode;
        const hold = tile.get("hold") as FloatNode;

        // Pinned full while the cursor is on the tile, draining once it
        // leaves. Counting down rather than storing an absolute deadline keeps
        // the shader free of a clock and immune to float drift over a long
        // session.
        const held = select(
          distanceToSweep(cellCentre()).lessThan(u.radius),
          u.hold,
          hold.sub(u.dt).max(0),
        ) as FloatNode;
        hold.assign(held);

        const target = select(held.greaterThan(0), float(Math.PI), float(0));

        // Heavier tiles accelerate more slowly into the flip and overshoot
        // more on arrival, so a sweep breaks up into a ripple instead of a
        // wavefront.
        const mass = float(1).add(hash(instanceIndex).mul(u.massJitter));

        angVel.addAssign(
          target.sub(angle).mul(u.stiffness).div(mass).mul(u.dt),
        );
        // Exponential decay rather than a bare multiply, so damping means the
        // same thing whatever framerate this canvas ends up running at.
        angVel.mulAssign(exp(u.damping.mul(u.dt).negate()));
        angle.addAssign(angVel.mul(u.dt));
      })().compute(count);

      // Read-only here: three forces storage access to `read` outside the
      // compute stage, so one node serves both without any juggling.
      const angle = tiles.element(instanceIndex).get("angle") as FloatNode;
      const c = cos(angle);
      const s = sin(angle);

      /** Rotation about X, per component. Three lines, and the shader stays flat. */
      const spin = (v: Node<"vec3">) =>
        vec3(v.x, v.y.mul(c).sub(v.z.mul(s)), v.y.mul(s).add(v.z.mul(c)));

      const local = positionLocal.mul(
        vec3(u.tile, u.tile, u.tile.mul(u.thickness)),
      );

      const surface = tileSurface(u);

      return {
        update,
        positionNode: spin(local).add(vec3(cellCentre(), 0)),
        // The normal has to turn with the tile or the lighting won't sell the
        // flip. `normalNode` is read in view space, so the rotated local
        // normal goes through the model-normal matrix on the way out.
        normalNode: transformNormalToView(spin(surface.normal)),
        colorNode: surface.colorNode,
        metalnessNode: surface.metalnessNode,
        roughnessNode: surface.roughnessNode,
      };
    },
    [cols, rows, count, tiles],
  );

  const nodes = useLocalNodes(build);

  const { pointer, warped } = useSweepCursor(bounds);
  const cursorLight = useRef<PointLight>(null);

  useFrame(({ delta }) => {
    // The largest timestep the spring integrator is allowed to see. A
    // backgrounded tab or a long frame hitch would otherwise hand it a delta
    // big enough to explode a semi-implicit Euler step.
    u.dt.value = Math.min(delta, 1 / 20);

    // On a teleport the segment collapses to a point, so nothing between the
    // old and new cursor positions gets swept.
    u.pointerPrev.value.copy(warped.current ? pointer.current : u.pointer.value);
    warped.current = false;
    u.pointer.value.copy(pointer.current);

    // A specular highlight that travels is one of the strongest metal cues
    // there is. A static one reads as a painted-on shine. Parked far away the
    // light simply stops reaching the grid, so it needs no separate on/off.
    const light = cursorLight.current;
    if (light) {
      light.position.set(
        pointer.current.x,
        pointer.current.y,
        config.cursorLightHeight,
      );
    }

    // `useFrame` runs in the scheduler's update phase, ahead of this canvas's
    // render, so the vertex stage always reads angles the compute pass just
    // wrote.
    renderer.compute(nodes.update);
  });

  return (
    <>
      {/* Deliberately dim. The environment map is doing the lighting now; these
          only keep the dark front faces from crushing to black. */}
      <ambientLight intensity={0.12} />
      <directionalLight position={[2, 3, 6]} intensity={0.5} color="#fff4e0" />

      <pointLight
        ref={cursorLight}
        intensity={config.cursorLight}
        color={config.cursorLightColor}
        distance={0}
        decay={1.6}
      />

      <instancedMesh
        args={[undefined, undefined, count]}
        // Instance transforms live in the shader, so the CPU-side bounding
        // volume is meaningless here.
        frustumCulled={false}
      >
        {/* A unit box, scaled in the vertex stage, so the thickness slider is
            a uniform write rather than a geometry rebuild. */}
        <boxGeometry args={[1, 1, 1]} />
        <meshStandardNodeMaterial
          positionNode={nodes.positionNode}
          normalNode={nodes.normalNode}
          colorNode={nodes.colorNode}
          metalnessNode={nodes.metalnessNode}
          roughnessNode={nodes.roughnessNode}
        />
      </instancedMesh>
    </>
  );
}

export function FlipGrid() {
  const bounds = useRef<HTMLDivElement>(null);

  // Namespaced, because Leva's store is global and every demo shares it. The
  // panel is a DOM overlay, so it is entirely indifferent to how many canvases
  // are on the page. A folder per demo is all it takes to keep them apart.
  const controls = useControls("flip grid", {
    grid: folder({
      // Grid resolution. Changing either remounts the scene, see the key below.
      cols: { value: 56, min: 8, max: 120, step: 1 },
      rows: { value: 32, min: 6, max: 80, step: 1 },
      // Tile edge as a fraction of the cell, so a hairline gutter shows through.
      fill: { value: 0.82, min: 0.3, max: 1, step: 0.01 },
      // Tile depth as a fraction of the tile edge. This is what sells the flip.
      thickness: { value: 0.09, min: 0.01, max: 0.5, step: 0.005 },
    }),
    cursor: folder({
      // Flip radius around the cursor, in cells.
      radius: { value: 3.2, min: 0.5, max: 12, step: 0.1 },
      // Seconds a tile stays flipped after the cursor has moved off it.
      hold: { value: 3, min: 0, max: 10, step: 0.1 },
    }),
    spring: folder({
      // Angular spring driving the flip. Damping below ~2·sqrt(stiffness)
      // overshoots.
      stiffness: { value: 60, min: 5, max: 300, step: 1 },
      damping: { value: 9, min: 0.5, max: 60, step: 0.5 },
      // Upper bound on the per-instance mass multiplier. 0 makes every tile
      // identical.
      massJitter: { value: 1.4, min: 0, max: 6, step: 0.05 },
    }),
    faces: folder({
      // Front (resting), back (the metal), and the four edges. The front is
      // darker than it looks like it needs to be: a studio bright enough to
      // make gold glow also lights the resting faces, and these are meant to
      // disappear.
      front: "#0a0a0d",
      // Gold reflectance. `Gold.mtlx`'s base_color, (1.059, 0.773, 0.307)
      // linear, which is what physically-based gold actually is: paler and
      // less orange than the colour most people reach for.
      back: "#f6cd76",
      edge: "#6b5a33",
      // Base roughness of the metal face. 0 is a mirror; the flakes add the rest.
      roughness: { value: 0.13, min: 0, max: 1, step: 0.01 },
    }),
    surface: folder({
      // Fine normal perturbation, standing in for the microfacet structure a
      // real metal surface has. Without it a flat tile reflects exactly one
      // direction of the environment and reads as paint. See `tile-surface.ts`.
      // Grain facets across a tile. Aim for a few pixels each.
      flakeCells: { value: 12, min: 1, max: 32, step: 1 },
      flakeStrength: { value: 0.09, min: 0, max: 2, step: 0.01 },
      // How far the grain pushes roughness around per facet.
      flakeRoughness: { value: 0.18, min: 0, max: 1, step: 0.01 },
      // Per-tile brightness spread, so neighbours aren't identical.
      toneJitter: { value: 0.3, min: 0, max: 1, step: 0.01 },
      // Per-tile roughness spread.
      roughJitter: { value: 0.18, min: 0, max: 1, step: 0.01 },
      // Per-tile lean, in normal-space units (~0.3 is a few degrees). Without
      // it every settled tile faces the same way, reflects the same direction
      // of a distant environment, and the grid resolves to one flat colour.
      tiltJitter: { value: 0.12, min: 0, max: 1.5, step: 0.01 },
      // How much each tile domes across its own face. This is the curvature a
      // flat plate doesn't have, and it's what turns a single reflected sample
      // into a highlight gradient. 0 makes the tiles genuinely flat, and
      // genuinely plastic-looking.
      curvature: { value: 0.18, min: 0, max: 2.5, step: 0.01 },
    }),
    environment: folder({
      // Which environment to reflect. Outdoor's hard horizon suits flat tiles.
      envPreset: { value: "outdoor", options: ["outdoor", "studio"] },
      // Intensities are linear radiance, so >1 is expected.
      ground: "#2a2018",
      sky: "#6f83ad",
      keyIntensity: { value: 55, min: 0, max: 120, step: 0.5 },
      kickIntensity: { value: 2.2, min: 0, max: 60, step: 0.1 },
      fillIntensity: { value: 0.5, min: 0, max: 10, step: 0.1 },
      // Multiplier applied to the environment as a whole.
      envIntensity: { value: 1, min: 0, max: 4, step: 0.05 },
    }),
    cursorLight: folder({
      // A light that rides the cursor, so the metal has something moving to
      // catch.
      cursorLight: { value: 9, min: 0, max: 60, step: 0.5 },
      cursorLightHeight: { value: 3.5, min: 0.2, max: 20, step: 0.1 },
      cursorLightColor: "#fff2d8",
    }),
  });

  // Leva types a select as plain `string`, so the union has to be restored on
  // the way out. Narrowing the one field beats casting the whole object.
  const config: Config = {
    ...controls,
    envPreset: controls.envPreset as EnvPreset,
  };

  // No WebGPU, no experience. The shell around this decides what to show instead.
  if (useWebGPU() !== "yes") return null;

  return (
    // This element is what the cursor is measured against. The canvas itself
    // takes no pointer events, so the listeners sit on the window and map the
    // cursor through this box's bounds.
    <div ref={bounds} className="absolute inset-0">
      <Canvas
        orthographic
        camera={{ position: [0, 0, 10], zoom: 1 }}
        dpr={[1, 2]}
        renderer={{
          alpha: true,
          antialias: true,
          // r3f already defaults to this; stated explicitly because the scene
          // depends on it. The environment is HDR on purpose, softboxes sit well
          // above 1 so a mirror-flat tile has something with range to reflect,
          // and without a tone map every one of them clips to flat white.
          toneMapping: ACESFilmicToneMapping,
        }}
        style={{ pointerEvents: "none" }}
      >
        <Environment
          preset={config.envPreset}
          ground={config.ground}
          sky={config.sky}
          keyIntensity={config.keyIntensity}
          kickIntensity={config.kickIntensity}
          fillIntensity={config.fillIntensity}
          intensity={config.envIntensity}
        />
        {/* Remounting on a resolution change is deliberate: the storage buffer is
            sized to cols × rows, and tearing it down is far simpler to reason
            about than resizing it in place. */}
        <Scene
          key={`${config.cols}x${config.rows}`}
          config={config}
          bounds={bounds}
        />
      </Canvas>
    </div>
  );
}
