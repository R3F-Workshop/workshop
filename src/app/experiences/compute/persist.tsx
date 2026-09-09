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
import { button, useControls } from "leva";
import { useRef } from "react";
import {
  abs,
  clamp,
  cos,
  Fn,
  hash,
  If,
  instancedArray,
  instanceIndex,
  length,
  mix,
  normalize,
  positionLocal,
  sin,
  time,
  uint,
  vec3,
} from "three/tsl";
import type {
  Node,
  StorageBufferNode,
  WebGPURenderer,
} from "three/webgpu";

import { useWebGPU } from "@/lib/use-webgpu";

/**
 * Compute, two: persist.
 *
 * State the CPU never sees. Every particle has a position and a velocity,
 * and both live in storage buffers the GPU owns. Two compute passes touch
 * them: `init` runs once and hands every particle a launch, `update` runs
 * every frame and integrates gravity, the floor, and the relaunch.
 *
 * The CPU's whole part, per frame, is two lines in `useFrame`: write the
 * timestep into a uniform and dispatch `update`. Nothing else crosses the
 * bus, however many particles there are. That is the entire reason this
 * demo exists. A vertex shader can compute a position from time, but it
 * cannot remember where the particle was last frame, so it cannot bounce.
 *
 * The buffers are plain `instancedArray`s of `vec3`, put in the store with
 * `useGPUStorage` so the builder finds them by name, the same way the
 * storage texture demo does. The material reads the same buffers by
 * `instanceIndex` to place and colour each instance.
 */

//* Tunables and uniforms ======================================================

const COUNT = 32768;

//* GPU build ==================================================================

/**
 * The creator, run once by `useLocalNodes`. Two passes and a material come
 * out of it. `init` and `update` write the buffers, `positionNode` and
 * `colorNode` read them, and all four hold the same `positions` and
 * `velocities` handles, found in the store by the names `useGPUStorage`
 * gave them. That is the point: the passes and the material agree on the
 * data because they share the nodes, not because anything is copied.
 *
 * `launch` is a plain JavaScript function that returns a TSL node. Calling
 * it inside `init` and again inside `update` pastes the same graph into
 * both kernels. That is how a formula is shared between passes, with a
 * helper that builds nodes, not a GPU function call.
 */
function build({ uniforms, gpuStorage }: CreatorState) {
  const u = uniforms.computePersist;
  const positions =
    gpuStorage.computePersistPositions as unknown as StorageBufferNode<"vec3">;
  const velocities =
    gpuStorage.computePersistVelocities as unknown as StorageBufferNode<"vec3">;

  // A launch velocity: up, with a random lean inside the cone. Three hashes
  // of one seed, so a different seed is a different launch.
  const launch = (seed: Node<"uint">) => {
    const angle = hash(seed).mul(Math.PI * 2);
    const lean = hash(seed.add(1)).mul(u.spread);
    const speed = hash(seed.add(2)).mul(0.4).add(0.8).mul(u.speed);
    return normalize(vec3(sin(angle).mul(lean), 1, cos(angle).mul(lean))).mul(
      speed,
    );
  };

  // Once. Each particle launched some time ago, so the fountain is already
  // flowing on the first frame rather than firing all at once.
  const init = Fn(() => {
    const p = positions.element(instanceIndex);
    const v = velocities.element(instanceIndex);
    const v0 = launch(instanceIndex);
    const t0 = hash(instanceIndex.add(3)).mul(2);
    const fall = vec3(0, u.gravity.mul(t0), 0);
    v.assign(v0.sub(fall));
    p.assign(v0.mul(t0).sub(fall.mul(t0).mul(0.5)));
  })().compute(COUNT);

  // Every frame. Semi-implicit Euler, a floor, and a relaunch once a
  // particle has bounced itself to a stop.
  const update = Fn(() => {
    const p = positions.element(instanceIndex);
    const v = velocities.element(instanceIndex);

    v.y.subAssign(u.gravity.mul(u.dt));
    p.addAssign(v.mul(u.dt));

    If(p.y.lessThan(u.floor).and(v.y.lessThan(0)), () => {
      p.y.assign(u.floor);
      v.assign(vec3(v.x.mul(0.8), v.y.mul(u.bounce.negate()), v.z.mul(0.8)));
    });

    // Spent: on the floor with no bounce left. Back to the nozzle with a
    // fresh seed, so it does not repeat its last arc.
    const spent = p.y
      .lessThan(u.floor.add(0.05))
      .and(abs(v.y).lessThan(u.gravity.mul(0.05)));
    If(spent, () => {
      p.assign(vec3(0));
      v.assign(launch(instanceIndex.add(uint(time.mul(1000)))));
    });
  })().compute(COUNT);

  // Read-only here. The vertex stage places each instance from the same
  // buffer the pass above just wrote.
  const heat = clamp(length(velocities.element(instanceIndex)).div(u.speed), 0, 1);

  return {
    init,
    update,
    positionNode: positionLocal.mul(u.size).add(positions.element(instanceIndex)),
    colorNode: mix(u.cool, u.hot, heat),
  };
}

//* Scene ======================================================================

/**
 * The scene. Registers uniforms and buffers, builds the nodes, and drives
 * the simulation from `useFrame`. Dispatch happens in the frame loop rather
 * than an effect because `renderer.compute` needs an initialised renderer,
 * and only the loop guarantees one.
 *
 * `floor` and `dt` are uniforms with no Leva dial. They are spread in next
 * to the controls so the creator finds them in the same scope.
 */
function Fountain() {
  const values = useControls("compute · persist", {
    gravity: { value: 9.8, min: 0, max: 30, step: 0.1 },
    speed: { value: 7, min: 1, max: 15, step: 0.1 },
    spread: { value: 0.35, min: 0, max: 1.5, step: 0.01 },
    bounce: { value: 0.5, min: 0, max: 0.95, step: 0.01 },
    size: { value: 0.03, min: 0.005, max: 0.1, step: 0.001 },
    cool: "#2a3a6a",
    hot: "#ffd9a0",
  });
  const u = useUniforms(
    { ...values, floor: -2, dt: 0 },
    "computePersist",
  );

  // Allocated once. The CPU never reads them back.
  useGPUStorage(() => ({
    computePersistPositions: instancedArray(COUNT, "vec3"),
    computePersistVelocities: instancedArray(COUNT, "vec3"),
  }));

  const nodes = useLocalNodes(build);

  // `init` runs on the first frame and again after reset. A ref rather than
  // an effect, because the renderer is only guaranteed ready inside the loop.
  const started = useRef(false);
  useControls("compute · persist", {
    reset: button(() => {
      started.current = false;
    }),
  });

  // `useThree` types `renderer` as the WebGL/WebGPU union even on the /webgpu
  // entry, and `compute` only exists on the WebGPU one.
  const renderer = useThree((s) => s.renderer) as unknown as WebGPURenderer;

  useFrame(({ delta }) => {
    // Capped, so a hidden tab coming back cannot hand the integrator a step
    // big enough to fire every particle through the floor.
    u.dt.value = Math.min(delta, 1 / 30);
    if (!started.current) {
      renderer.compute(nodes.init);
      started.current = true;
    }
    renderer.compute(nodes.update);
  });

  return (
    <instancedMesh
      args={[undefined, undefined, COUNT]}
      // Instance transforms live in the shader, so the CPU-side bounding
      // volume is meaningless here.
      frustumCulled={false}
    >
      <icosahedronGeometry args={[1, 0]} />
      <meshStandardNodeMaterial
        positionNode={nodes.positionNode}
        colorNode={nodes.colorNode}
        roughness={0.5}
      />
    </instancedMesh>
  );
}

//* Experience =================================================================

/**
 * The experience root. Owns the Canvas and the camera, fills whatever box
 * the shell mounts it in, and returns null without WebGPU because compute
 * has no WebGL fallback.
 */
export function ComputePersist() {
  // No WebGPU, no experience. The shell around this decides what to show instead.
  if (useWebGPU() !== "yes") return null;

  return (
    <div className="absolute inset-0">
      <Canvas
        camera={{ position: [0, 1, 10], fov: 40 }}
        dpr={[1, 2]}
        renderer={{ alpha: false, antialias: true }}
      >
        <color attach="background" args={["#08080a"]} />
        <ambientLight intensity={0.5} color="#b8c4ee" />
        <directionalLight position={[4, 6, 3]} intensity={2} color="#fff4e0" />
        <Fountain />
        <mesh position={[0, -2, 0]} rotation-x={-Math.PI / 2}>
          <circleGeometry args={[6, 64]} />
          <meshStandardMaterial color="#111116" roughness={0.9} />
        </mesh>
      </Canvas>
    </div>
  );
}
