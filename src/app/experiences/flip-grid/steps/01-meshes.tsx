"use client";

import { Canvas, useFrame, useThree } from "@react-three/fiber/webgpu";
import { folder, useControls } from "leva";
import { useEffect, useMemo, useRef, type RefObject } from "react";
import {
  ACESFilmicToneMapping,
  MeshStandardMaterial,
  Vector2,
  type Mesh,
} from "three/webgpu";

import { DepthAttachmentSync } from "@/components/depth-attachment-sync";
import { useWebGPU } from "@/lib/use-webgpu";

import { Environment } from "../environment";
import { AWAY, useSweepCursor } from "../use-sweep-cursor";

/**
 * The flip grid, step one of four: one mesh per tile, and the simulation in
 * plain JavaScript.
 *
 * This is the reference. Every later version does exactly this maths; what
 * moves is where the state lives and who runs the loop. Read the `useFrame`
 * body here first, because it is the thing that ends up as a compute shader
 * in `../flip-grid.tsx`, line for line.
 *
 * Each tile remembers three numbers: its flip angle, its angular velocity,
 * and a hold timer. Every frame, for every tile: measure the distance to the
 * segment the cursor just swept, top the timer up or let it drain, pick a
 * target angle from the timer, pull the angle toward it with a damped spring,
 * and write the result into `rotation.x`.
 *
 * What it costs: one `Mesh` per tile, so one matrix upload and three draws
 * (the box has three materials) per tile per frame. Fine at a few hundred.
 * Push `cols` and `rows` up and watch the frame time go. That is the reason
 * for step two.
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

/** Deterministic per-tile noise. The CPU stand-in for TSL's `hash(instanceIndex)`. */
function jitter(i: number) {
  const x = Math.sin(i * 12.9898 + 78.233) * 43758.5453;
  return x - Math.floor(x);
}

/**
 * Distance from a point to the segment the cursor swept this frame, not to
 * where it happens to be right now.
 *
 * A fast sweep moves the pointer several cells between frames. Testing
 * against the point leaves gaps in the trail; testing against the segment
 * fills them in, for the cost of one dot product.
 */
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
  const tile = step * config.fill;

  // The state. Three numbers per tile, and nothing else is remembered. Zero
  // is "flat, still, not held", so no initialisation pass is needed.
  const state = useMemo(
    () => ({
      angle: new Float32Array(count),
      angVel: new Float32Array(count),
      hold: new Float32Array(count),
    }),
    [count],
  );

  const meshes = useRef<(Mesh | null)[]>([]);

  // Three materials shared by every tile, in BoxGeometry's group order: the
  // four edges, then +z (the resting front, dark) and -z (the gold). Which
  // face is showing is the geometry's own business; the flip just turns it.
  const materials = useMemo(() => {
    const front = new MeshStandardMaterial({
      color: "#0a0a0d",
      roughness: 0.78,
      metalness: 0.12,
    });
    const back = new MeshStandardMaterial({
      color: "#f6cd76",
      roughness: 0.3,
      metalness: 1,
    });
    const edge = new MeshStandardMaterial({
      color: "#6b5a33",
      roughness: 0.38,
      metalness: 0.9,
    });
    return [edge, edge, edge, edge, front, back];
  }, []);
  useEffect(
    () => () => {
      for (const m of new Set(materials)) m.dispose();
    },
    [materials],
  );

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

    for (let i = 0; i < count; i++) {
      const cx = ((i % cols) - (cols - 1) / 2) * step;
      const cy = (Math.floor(i / cols) - (rows - 1) / 2) * step;

      // Pinned full while the cursor is on the tile, draining once it leaves.
      const swept = distanceToSegment(cx, cy, a.x, a.y, b.x, b.y) < radius;
      state.hold[i] = swept ? config.hold : Math.max(state.hold[i] - dt, 0);

      const target = state.hold[i] > 0 ? Math.PI : 0;

      // Heavier tiles accelerate more slowly into the flip and overshoot more
      // on arrival, so a sweep breaks up into a ripple instead of a wavefront.
      const mass = 1 + jitter(i) * config.massJitter;

      state.angVel[i] +=
        ((target - state.angle[i]) * config.stiffness) / mass * dt;
      // Exponential decay rather than a bare multiply, so damping means the
      // same thing whatever framerate this ends up running at.
      state.angVel[i] *= Math.exp(-config.damping * dt);
      state.angle[i] += state.angVel[i] * dt;

      const mesh = meshes.current[i];
      if (mesh) mesh.rotation.x = state.angle[i];
    }

    prev.current.copy(a);
  });

  return (
    <>
      {/* Deliberately dim. The environment map is doing the lighting; these
          only keep the dark front faces from crushing to black. */}
      <ambientLight intensity={0.12} />
      <directionalLight position={[2, 3, 6]} intensity={0.5} color="#fff4e0" />

      {Array.from({ length: count }, (_, i) => (
        <mesh
          key={i}
          ref={(el) => {
            meshes.current[i] = el;
          }}
          position={[
            ((i % cols) - (cols - 1) / 2) * step,
            (Math.floor(i / cols) - (rows - 1) / 2) * step,
            0,
          ]}
          scale={[tile, tile, tile * config.thickness]}
          material={materials}
        >
          <boxGeometry args={[1, 1, 1]} />
        </mesh>
      ))}
    </>
  );
}

export function FlipGridMeshes() {
  const bounds = useRef<HTMLDivElement>(null);

  // Namespaced, because Leva's store is global and every demo shares it.
  const config: Config = useControls("flip grid · meshes", {
    grid: folder({
      // Grid resolution. Changing either remounts the scene, see the key below.
      // Smaller than the finished grid on purpose: this version pays per mesh.
      cols: { value: 24, min: 4, max: 64, step: 1 },
      rows: { value: 14, min: 3, max: 36, step: 1 },
      // Tile edge as a fraction of the cell, so a hairline gutter shows through.
      fill: { value: 0.82, min: 0.3, max: 1, step: 0.01 },
      // Tile depth as a fraction of the tile edge. This is what sells the flip.
      thickness: { value: 0.09, min: 0.01, max: 0.5, step: 0.005 },
    }),
    cursor: folder({
      // Flip radius around the cursor, in cells.
      radius: { value: 2.2, min: 0.5, max: 12, step: 0.1 },
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
        {/* Remounting on a resolution change is deliberate: the state arrays
            are sized to cols × rows. */}
        <Scene
          key={`${config.cols}x${config.rows}`}
          config={config}
          bounds={bounds}
        />
      </Canvas>
    </div>
  );
}
