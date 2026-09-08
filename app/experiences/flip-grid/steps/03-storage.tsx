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
  cos,
  float,
  instancedArray,
  instanceIndex,
  normalLocal,
  positionLocal,
  select,
  sin,
  transformNormalToView,
  vec2,
  vec3,
} from "three/tsl";
import {
  ACESFilmicToneMapping,
  Vector2,
  type Color,
  type Node,
  type UniformNode,
} from "three/webgpu";

import { DepthAttachmentSync } from "@/components/depth-attachment-sync";
import { useWebGPU } from "@/lib/use-webgpu";

import { Environment } from "../environment";
import { AWAY, useSweepCursor } from "../use-sweep-cursor";

/**
 * The flip grid, step three of four: the angle lives in a storage buffer and
 * the vertex stage does the placing, but the CPU still runs the integrator.
 *
 * Diff this against `02-instanced.tsx`. The loop is the same loop. Two
 * things change around it:
 *
 * The angle array is now the backing store of a GPU buffer. `instancedArray`
 * over a typed array wraps the array you were already writing, so the loop
 * doesn't change at all; one flag at the end re-uploads it. Angular velocity
 * and the hold timer stay in plain arrays, because nothing on the GPU reads
 * them. Yet.
 *
 * The instance matrix is gone. A node material places and rotates every tile
 * in the vertex stage, reading its angle out of the buffer by `instanceIndex`
 * and its cell centre from the same index. The per-frame upload drops from
 * sixteen floats per tile to one.
 *
 * What is left is the JavaScript loop itself, and that is what step four
 * moves. Read `spin`, `cellCentre` and the material nodes here carefully:
 * they carry over to the finished version untouched.
 */

/** The dials. Their defaults live on the Leva schema at the bottom of the file. */
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
};

/** What the vertex stage reads besides the angle, as the store hands them back. */
type StorageUniforms = {
  /** Cell pitch and tile edge, in world units. */
  step: UniformNode<"float", number>;
  tile: UniformNode<"float", number>;
  /** Tile depth as a fraction of its edge. */
  thickness: UniformNode<"float", number>;
  /** The resting face, the metal, and the four edges. */
  front: UniformNode<"color", Color>;
  back: UniformNode<"color", Color>;
  edge: UniformNode<"color", Color>;
};

/** Deterministic per-tile noise. The CPU stand-in for TSL's `hash(instanceIndex)`. */
function jitter(i: number) {
  const x = Math.sin(i * 12.9898 + 78.233) * 43758.5453;
  return x - Math.floor(x);
}

/** Distance from a point to the segment the cursor swept this frame. */
function distanceToSegment(
  px: number,
  py: number,
  ax: number,
  ay: number,
  bx: number,
  by: number,
) {
  const abx = bx - ax;
  const aby = by - ay;
  const t = Math.min(
    Math.max(
      ((px - ax) * abx + (py - ay) * aby) / Math.max(abx * abx + aby * aby, 1e-6),
      0,
    ),
    1,
  );
  return Math.hypot(px - (ax + abx * t), py - (ay + aby * t));
}

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

  // One cell spans whichever axis needs more coverage, so the grid always
  // overfills rather than leaving a margin.
  const step = Math.max(viewport.width / cols, viewport.height / rows);

  // What the vertex stage needs to know besides the angle. Plain values in,
  // one named uniform per key under the `flipGridStorage` scope of the fiber
  // store, kept in sync on every render. A slider drag is a value write and
  // never touches the graph. Hex strings become Colors on the way in.
  useUniforms(
    {
      step,
      tile: step * config.fill,
      thickness: config.thickness,
      front: "#0a0a0d",
      back: "#f6cd76",
      edge: "#6b5a33",
    },
    "flipGridStorage",
  );

  // The angle, as a storage buffer. Handing `instancedArray` a typed array
  // makes that array the buffer's backing store, so the loop below keeps
  // writing plain JavaScript numbers into it. Zero-filled is "flat".
  const angles = useMemo(
    () => instancedArray(new Float32Array(count), "float"),
    [count],
  );
  // Registered at the root with a prefixed key rather than in a scope, because
  // r3f names scoped storage `scope.name` and three builds the WGSL identifier
  // off that. See pmndrs/react-three-fiber#3848.
  useGPUStorage(() => ({ flipGridStorageAngles: angles }));

  // The other two fields stay on the CPU. Only the angle is drawn.
  const state = useMemo(
    () => ({
      angle: angles.value.array as Float32Array,
      angVel: new Float32Array(count),
      hold: new Float32Array(count),
    }),
    [angles, count],
  );

  // Memoised, so the graph is built once per mount rather than on every
  // slider tick. See the note on `useLocalNodes` in `../flip-grid.tsx`. The
  // uniforms come back out of the store; the buffer comes from the closure.
  const build = useCallback(
    ({ uniforms }: CreatorState) => {
      const u = uniforms.scope("flipGridStorage") as unknown as StorageUniforms;

      /** This instance's cell centre, in world units. The loop's `cx, cy`, in TSL. */
      const cellCentre = () => {
        const ix = float(instanceIndex.mod(cols));
        const iy = float(instanceIndex.div(cols));
        return vec2(ix.sub((cols - 1) / 2), iy.sub((rows - 1) / 2)).mul(u.step);
      };

      // This is the read. One float, by instance index, from the buffer the
      // CPU wrote a moment ago.
      const angle = angles.element(instanceIndex);
      const c = cos(angle);
      const s = sin(angle);

      /** Rotation about X, per component. The quaternion from step two, unrolled. */
      const spin = (v: Node<"vec3">) =>
        vec3(v.x, v.y.mul(c).sub(v.z.mul(s)), v.y.mul(s).add(v.z.mul(c)));

      // A unit box, scaled here, so the thickness slider is a uniform write
      // rather than a geometry rebuild.
      const local = positionLocal.mul(
        vec3(u.tile, u.tile, u.tile.mul(u.thickness)),
      );

      // Which face a fragment belongs to, from the unrotated normal. The
      // material array from steps one and two, as one material with a select.
      const isFront = normalLocal.z.greaterThan(0.5);
      const isBack = normalLocal.z.lessThan(-0.5);

      return {
        positionNode: spin(local).add(vec3(cellCentre(), 0)),
        // The normal has to turn with the tile or the lighting won't sell the
        // flip. `normalNode` is read in view space, so the rotated local
        // normal goes through the model-normal matrix on the way out.
        normalNode: transformNormalToView(spin(normalLocal)),
        colorNode: select(isFront, u.front, select(isBack, u.back, u.edge)),
        metalnessNode: float(
          select(isFront, float(0.12), select(isBack, float(1), float(0.9))),
        ),
        roughnessNode: float(
          select(isFront, float(0.78), select(isBack, float(0.3), float(0.38))),
        ),
      };
    },
    [cols, rows, angles],
  );

  const nodes = useLocalNodes(build);

  const { pointer, warped } = useSweepCursor(bounds);
  const prev = useRef(new Vector2(AWAY, AWAY));

  useFrame((_, delta) => {
    // The largest timestep the spring is allowed to see. A backgrounded tab
    // or a long frame hitch would otherwise hand it a delta big enough to
    // explode a semi-implicit Euler step.
    const dt = Math.min(delta, 1 / 20);
    const radius = step * config.radius;

    // On a teleport the segment collapses to a point, so nothing between the
    // old and new cursor positions gets swept.
    const a = pointer.current;
    const b = warped.current ? a : prev.current;
    warped.current = false;

    // Unchanged from step one. Every line of this becomes a line of the
    // compute shader in step four.
    for (let i = 0; i < count; i++) {
      const cx = ((i % cols) - (cols - 1) / 2) * step;
      const cy = (Math.floor(i / cols) - (rows - 1) / 2) * step;

      const swept = distanceToSegment(cx, cy, a.x, a.y, b.x, b.y) < radius;
      state.hold[i] = swept ? config.hold : Math.max(state.hold[i] - dt, 0);

      const target = state.hold[i] > 0 ? Math.PI : 0;

      const mass = 1 + jitter(i) * config.massJitter;

      state.angVel[i] +=
        ((target - state.angle[i]) * config.stiffness) / mass * dt;
      state.angVel[i] *= Math.exp(-config.damping * dt);
      state.angle[i] += state.angVel[i] * dt;
    }

    // One flag, and the array the loop just wrote is the buffer the vertex
    // stage reads next. One float per tile across the bus, not sixteen.
    angles.value.needsUpdate = true;
    prev.current.copy(a);
  });

  return (
    <>
      {/* Deliberately dim. The environment map is doing the lighting; these
          only keep the dark front faces from crushing to black. */}
      <ambientLight intensity={0.12} />
      <directionalLight position={[2, 3, 6]} intensity={0.5} color="#fff4e0" />

      <instancedMesh
        args={[undefined, undefined, count]}
        // Instance transforms live in the shader now, so the CPU-side bounding
        // volume is meaningless here.
        frustumCulled={false}
      >
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

export function FlipGridStorage() {
  const bounds = useRef<HTMLDivElement>(null);

  // Namespaced, because Leva's store is global and every demo shares it.
  const config: Config = useControls("flip grid · storage", {
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
      // Upper bound on the per-tile mass multiplier. 0 makes every tile
      // identical.
      massJitter: { value: 1.4, min: 0, max: 6, step: 0.05 },
    }),
  });

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
        // Odd/fractional drawing buffers desync the depth attachment from the
        // swap chain, see DepthAttachmentSync.
        forceEven
        renderer={{
          alpha: true,
          antialias: true,
          // The environment is HDR, so without a tone map its softboxes clip
          // to flat white.
          toneMapping: ACESFilmicToneMapping,
        }}
        style={{ pointerEvents: "none" }}
      >
        <DepthAttachmentSync />
        <Environment />
        {/* Remounting on a resolution change is deliberate: the storage buffer
            is sized to cols × rows. */}
        <Scene
          key={`${config.cols}x${config.rows}`}
          config={config}
          bounds={bounds}
        />
      </Canvas>
    </div>
  );
}
