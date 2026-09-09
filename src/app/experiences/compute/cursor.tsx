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
import { useControls } from "leva";
import { useMemo } from "react";
import {
  exp,
  float,
  Fn,
  hash,
  instancedArray,
  instanceIndex,
  length,
  mix,
  positionLocal,
  smoothstep,
  vec2,
  vec3,
} from "three/tsl";
import {
  Vector3,
  type StorageBufferNode,
  type WebGPURenderer,
} from "three/webgpu";

import { useWebGPU } from "@/lib/use-webgpu";

/**
 * Compute, three: cursor.
 *
 * One uniform in, ten thousand reactions out. The cursor is the cheapest
 * thing you have: three floats, written once a frame. Compute is what turns
 * it into a response per cell.
 *
 * Each cell keeps one number, `lift`, in a storage buffer. The pass measures
 * the cell's distance to the cursor, turns that into a target, and eases
 * `lift` toward it. The easing is why the buffer has to persist: a cell
 * remembers how lifted it was last frame, which is what makes the trail
 * linger after the cursor has gone. Without state the grid would snap.
 *
 * `jitter` scales each cell's ease rate by a hash of its index. At zero the
 * cursor drags a clean wavefront. Turned up, neighbours respond at different
 * speeds and the same sweep breaks into a ripple. One line, and it is the
 * difference between a tool and a material.
 *
 * The cursor arrives the ordinary R3F way: `onPointerMove` on the ground
 * plane hands back a world point, and the loop copies it into the uniform.
 */

//* Tunables and uniforms ======================================================

const COLS = 96;
const ROWS = 96;
/** Cell spacing, in world units. */
const PITCH = 0.12;
/** Parking spot for the cursor when it is off the ground. */
const AWAY = 1e6;

//* GPU build ==================================================================

/**
 * The creator, run once by `useLocalNodes`. One pass eases every cell's
 * `lift` toward the cursor, and the material reads the same buffer to
 * stretch and tint each box. Compute writes, the vertex stage reads, and
 * the buffer is the only thing between them.
 *
 * `centre` is called twice, once inside the kernel and once outside it for
 * the material. Each call builds its own copy of the maths, so the pass and
 * the vertex stage agree on where a cell sits without sharing a variable.
 */
function build({ uniforms, gpuStorage }: CreatorState) {
  const u = uniforms.computeCursor;
  const lifts =
    gpuStorage.computeCursorLift as unknown as StorageBufferNode<"float">;

  /** This cell's centre on the ground, in world units. */
  const centre = () => {
    const ix = float(instanceIndex.mod(COLS));
    const iz = float(instanceIndex.div(COLS));
    return vec2(ix.sub((COLS - 1) / 2), iz.sub((ROWS - 1) / 2)).mul(PITCH);
  };

  const update = Fn(() => {
    const lift = lifts.element(instanceIndex);
    const d = length(centre().sub(u.pointer.xz));
    // 1 under the cursor, falling to 0 at the radius.
    const target = float(1).sub(smoothstep(0, u.radius, d));
    // Exponential ease, so the feel is the same at any framerate. The hash
    // makes each cell its own speed.
    const rate = u.rate.mul(float(1).add(hash(instanceIndex).mul(u.jitter)));
    const k = float(1).sub(exp(rate.mul(u.dt).negate()));
    lift.addAssign(target.sub(lift).mul(k));
  })().compute(COLS * ROWS);

  // Read-only here. A unit box with its base on the ground, stretched by
  // its lift and moved to its cell.
  const lift = lifts.element(instanceIndex);
  const tall = lift.mul(u.height).add(0.04);
  const c = centre();

  return {
    update,
    positionNode: vec3(
      positionLocal.x.add(c.x),
      positionLocal.y.add(0.5).mul(tall),
      positionLocal.z.add(c.y),
    ),
    colorNode: mix(u.base, u.tip, lift),
  };
}

//* Scene ======================================================================

/**
 * The scene. Registers uniforms and the lift buffer, builds the nodes, and
 * dispatches `update` every frame. The pointer never touches React state.
 * The handlers write into a `Vector3` the uniform holds by reference, so a
 * mouse move costs nothing on the React side and the GPU sees the new value
 * on its next frame.
 */
function Grid() {
  const values = useControls("compute · cursor", {
    radius: { value: 1.2, min: 0.2, max: 4, step: 0.05 },
    rate: { value: 6, min: 0.5, max: 30, step: 0.5 },
    jitter: { value: 0, min: 0, max: 4, step: 0.05 },
    height: { value: 0.8, min: -1, max: 2, step: 0.05 },
    base: "#22222a",
    tip: "#ffd9a0",
  });

  // The same Vector3 on every render. The hook compares by identity, so it
  // never resets it, and the pointer handlers below are its only writers.
  const pointer = useMemo(() => new Vector3(AWAY, 0, AWAY), []);
  const u = useUniforms(
    { ...values, pointer, dt: 0 },
    "computeCursor",
  );

  // Zero-filled at allocation, which is exactly "flat".
  useGPUStorage(() => ({
    computeCursorLift: instancedArray(COLS * ROWS, "float"),
  }));

  const nodes = useLocalNodes(build);

  // `useThree` types `renderer` as the WebGL/WebGPU union even on the /webgpu
  // entry, and `compute` only exists on the WebGPU one.
  const renderer = useThree((s) => s.renderer) as unknown as WebGPURenderer;

  useFrame(({ delta }) => {
    u.dt.value = Math.min(delta, 1 / 20);
    renderer.compute(nodes.update);
  });

  return (
    <>
      <instancedMesh
        args={[undefined, undefined, COLS * ROWS]}
        // Instance transforms live in the shader, so the CPU-side bounding
        // volume is meaningless here.
        frustumCulled={false}
      >
        <boxGeometry args={[PITCH * 0.7, 1, PITCH * 0.7]} />
        <meshStandardNodeMaterial
          positionNode={nodes.positionNode}
          colorNode={nodes.colorNode}
          roughness={0.6}
        />
      </instancedMesh>

      {/* The ground is also the pointer target. `e.point` is already in
          world units, so it goes straight into the uniform. */}
      <mesh
        rotation-x={-Math.PI / 2}
        position-y={-0.01}
        onPointerMove={(e) => pointer.copy(e.point)}
        onPointerLeave={() => pointer.set(AWAY, 0, AWAY)}
      >
        <planeGeometry args={[COLS * PITCH + 4, ROWS * PITCH + 4]} />
        <meshStandardMaterial color="#0e0e12" roughness={0.9} />
      </mesh>
    </>
  );
}

//* Experience =================================================================

/**
 * The experience root. Owns the Canvas and the camera, fills whatever box
 * the shell mounts it in, and returns null without WebGPU because compute
 * has no WebGL fallback.
 */
export function ComputeCursor() {
  // No WebGPU, no experience. The shell around this decides what to show instead.
  if (useWebGPU() !== "yes") return null;

  return (
    <div className="absolute inset-0">
      <Canvas
        camera={{ position: [0, 9, 7], fov: 40 }}
        dpr={[1, 2]}
        renderer={{ alpha: false, antialias: true }}
      >
        <color attach="background" args={["#08080a"]} />
        <ambientLight intensity={0.5} color="#b8c4ee" />
        <directionalLight position={[4, 6, 3]} intensity={2} color="#fff4e0" />
        <Grid />
      </Canvas>
    </div>
  );
}
