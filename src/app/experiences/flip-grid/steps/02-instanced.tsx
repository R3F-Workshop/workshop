"use client";

import { Canvas, useFrame, useThree } from "@react-three/fiber/webgpu";
import { folder, useControls } from "leva";
import { useEffect, useMemo, useRef, type RefObject } from "react";
import {
  ACESFilmicToneMapping,
  Matrix4,
  MeshStandardMaterial,
  Quaternion,
  Vector2,
  Vector3,
  type InstancedMesh,
} from "three/webgpu";

import { DepthAttachmentSync } from "@/components/depth-attachment-sync";
import { useWebGPU } from "@/lib/use-webgpu";

import { Environment } from "../environment";
import { AWAY, useSweepCursor } from "../use-sweep-cursor";

/**
 * The flip grid, step two of four: one `InstancedMesh`, and the simulation
 * still in plain JavaScript.
 *
 * Diff this against `01-meshes.tsx`. The state and the loop are untouched.
 * What changes is the output: instead of writing `rotation.x` on a mesh, the
 * loop composes a matrix and writes it into the instance buffer, and the
 * whole grid draws in three calls instead of three per tile.
 *
 * It scales to the full grid, which is why the defaults are now the finished
 * version's. But look at what crosses to the GPU each frame: sixteen floats
 * per tile, a full transform, to carry one number that changed. At 1800
 * tiles that is 115 KB a frame, and the JavaScript loop on top. Step three
 * sends the one number instead.
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

  // The state. Unchanged from step one.
  const state = useMemo(
    () => ({
      angle: new Float32Array(count),
      angVel: new Float32Array(count),
      hold: new Float32Array(count),
    }),
    [count],
  );

  const mesh = useRef<InstancedMesh>(null);

  // Reused every frame rather than allocated per tile.
  const scratch = useMemo(
    () => ({
      matrix: new Matrix4(),
      position: new Vector3(),
      quaternion: new Quaternion(),
      scale: new Vector3(),
      axisX: new Vector3(1, 0, 0),
    }),
    [],
  );

  // Three materials in BoxGeometry's group order: the four edges, then +z
  // (the resting front, dark) and -z (the gold). A material array works on an
  // InstancedMesh exactly as it does on a Mesh: one instanced draw per group.
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
    const instanced = mesh.current;
    if (!instanced) return;

    // The largest timestep the spring is allowed to see. A backgrounded tab
    // or a long frame hitch would otherwise hand it a delta big enough to
    // explode a semi-implicit Euler step.
    const dt = Math.min(delta, 1 / 20);
    const radius = step * config.radius;
    const tile = step * config.fill;
    scratch.scale.set(tile, tile, tile * config.thickness);

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

      // The new part. A full transform per tile, to carry one angle.
      scratch.position.set(cx, cy, 0);
      scratch.quaternion.setFromAxisAngle(scratch.axisX, state.angle[i]);
      scratch.matrix.compose(
        scratch.position,
        scratch.quaternion,
        scratch.scale,
      );
      instanced.setMatrixAt(i, scratch.matrix);
    }

    // One flag, and the whole matrix buffer goes across the bus.
    instanced.instanceMatrix.needsUpdate = true;
    prev.current.copy(a);
  });

  return (
    <>
      {/* Deliberately dim. The environment map is doing the lighting; these
          only keep the dark front faces from crushing to black. */}
      <ambientLight intensity={0.12} />
      <directionalLight position={[2, 3, 6]} intensity={0.5} color="#fff4e0" />

      <instancedMesh
        ref={mesh}
        args={[undefined, undefined, count]}
        material={materials}
        // The grid always overfills the view, so culling has nothing to do.
        frustumCulled={false}
      >
        <boxGeometry args={[1, 1, 1]} />
      </instancedMesh>
    </>
  );
}

export function FlipGridInstanced() {
  const bounds = useRef<HTMLDivElement>(null);

  // Namespaced, because Leva's store is global and every demo shares it.
  const config: Config = useControls("flip grid · instanced", {
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
        {/* Remounting on a resolution change is deliberate: the state arrays
            and the instance buffer are sized to cols × rows. */}
        <Scene
          key={`${config.cols}x${config.rows}`}
          config={config}
          bounds={bounds}
        />
      </Canvas>
    </div>
  );
}
