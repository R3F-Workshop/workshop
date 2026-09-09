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
import { useRef, useState } from "react";
import {
  atomicAdd,
  atomicLoad,
  atomicStore,
  clamp,
  float,
  Fn,
  hash,
  instancedArray,
  instanceIndex,
  mix,
  positionLocal,
  sin,
  time,
  uint,
  vec2,
  vec3,
} from "three/tsl";
import type {
  StorageBufferNode,
  WebGPURenderer,
} from "three/webgpu";

import { useWebGPU } from "@/lib/use-webgpu";

/**
 * Compute, five: reduce.
 *
 * Many in, few out, and what it costs to bring the few home.
 *
 * Sixty thousand points wander along a line. A pass sorts them into bins
 * with `atomicAdd`, which is the only safe way for thousands of invocations
 * to add to the same handful of counters at once. A plain `+=` would lose
 * most of the increments to races. The bars under the points are drawn from
 * those bins directly, so the histogram is complete before the frame is,
 * and nothing was read back to do it.
 *
 * The number in the corner is the same bins, read back to the CPU with
 * `getArrayBufferAsync`. It is correct, and it is late: the promise resolves
 * a frame or two after the dispatch it belongs to, and the readout says by
 * how much. Pushing work to the GPU is close to free. Pulling an answer
 * back is a round trip, so it goes in an async request that never blocks
 * the loop, and only one is in flight at a time.
 *
 * That is why the buffers demo kept its heights on the CPU: the marker
 * needed the numbers every frame, and reading them back would have cost
 * more than the loop it replaced.
 */

//* Tunables and uniforms ======================================================

const COUNT = 65536;
const BINS = 48;
/** The line's length, in world units. */
const WIDTH = 8;

//* GPU build ==================================================================

/**
 * The creator, run once by `useLocalNodes`. Four passes come out of it,
 * meant to run in order every frame: `clear` zeroes the bins, `move`
 * wanders the points, `count` bins them with atomics, and `scale` copies
 * the counts into a float buffer the bars can read. The order matters and
 * it is the caller's job. A creator returns passes, it does not run them.
 *
 * Two materials read the result. `pointNode` places a sprite from the
 * positions buffer. `barNode` and `barColor` size and tint a bar from the
 * heights buffer, the float copy, because the atomic buffer is compute only.
 */
function build({ uniforms, gpuStorage }: CreatorState) {
  const u = uniforms.computeReduce;
  const positions =
    gpuStorage.computeReducePositions as unknown as StorageBufferNode<"vec2">;
  const bins = gpuStorage.computeReduceBins as unknown as StorageBufferNode<"uint">;
  const heights =
    gpuStorage.computeReduceHeights as unknown as StorageBufferNode<"float">;

  // Every counter back to zero. `atomicStore` rather than `assign`, because
  // the buffer is declared atomic and WGSL insists.
  const clear = Fn(() => {
    atomicStore(bins.element(instanceIndex), uint(0));
  })().compute(BINS);

  // Each point oscillates at its own rate and phase, so the crowd bunches
  // and spreads over time and the histogram has something to say.
  const move = Fn(() => {
    const rate = hash(instanceIndex.add(1)).mul(0.5).add(0.5).mul(u.drift);
    const phase = hash(instanceIndex).mul(Math.PI * 2);
    const x = sin(time.mul(rate).add(phase)).mul(0.45).add(0.5);
    positions.element(instanceIndex).assign(vec2(x, hash(instanceIndex.add(2))));
  })().compute(COUNT);

  // The reduction. Thousands of invocations, forty eight counters.
  const count = Fn(() => {
    const x = positions.element(instanceIndex).x;
    const bin = uint(clamp(x.mul(BINS), 0, BINS - 1));
    atomicAdd(bins.element(bin), uint(1));
  })().compute(COUNT);

  // Atomic buffers cannot be read from a vertex stage, so one tiny pass
  // copies the counts into a float buffer the bars can read. Scaled so that
  // an evenly spread line gives every bar a height of one.
  const scale = Fn(() => {
    const n = float(atomicLoad(bins.element(instanceIndex)));
    heights.element(instanceIndex).assign(n.div(COUNT / BINS));
  })().compute(BINS);

  const p = positions.element(instanceIndex);
  const h = heights.element(instanceIndex);
  const slot = float(instanceIndex).add(0.5).div(BINS).sub(0.5).mul(WIDTH);

  return {
    clear,
    move,
    count,
    scale,
    pointNode: vec3(p.x.sub(0.5).mul(WIDTH), p.y.mul(1.5).add(0.6), 0),
    barNode: vec3(
      positionLocal.x.add(slot),
      positionLocal.y.add(0.5).mul(h).sub(2.2),
      positionLocal.z,
    ),
    barColor: mix(u.base, u.tip, h.mul(0.5)),
  };
}

//* Scene ======================================================================

/**
 * The scene. Registers uniforms and the three buffers, builds the passes,
 * dispatches them in order, and keeps one readback in flight. The readback
 * is the demo's second half. `getArrayBufferAsync` returns a promise, the
 * loop must never wait on it, so the next request only goes out after the
 * last one has answered and the frame count between them is the latency.
 */
function Line({ onReport }: { onReport: (line: string) => void }) {
  const values = useControls("compute · reduce", {
    drift: { value: 0.6, min: 0, max: 3, step: 0.05 },
    base: "#22222a",
    tip: "#ffd9a0",
  });
  useUniforms(values, "computeReduce");

  const { computeReduceBins: bins } = useGPUStorage(() => ({
    computeReducePositions: instancedArray(COUNT, "vec2"),
    // Atomic, or `atomicAdd` will not compile against it.
    computeReduceBins: instancedArray(BINS, "uint").toAtomic(),
    computeReduceHeights: instancedArray(BINS, "float"),
  })) as unknown as { computeReduceBins: StorageBufferNode<"uint"> };

  const nodes = useLocalNodes(build);

  // `useThree` types `renderer` as the WebGL/WebGPU union even on the /webgpu
  // entry, and `compute` only exists on the WebGPU one.
  const renderer = useThree((s) => s.renderer) as unknown as WebGPURenderer;

  // One readback in flight at a time. `age` counts the frames between the
  // request and the answer, which is the latency the readout shows.
  const inflight = useRef(false);
  const age = useRef(0);

  useFrame(() => {
    renderer.compute(nodes.clear);
    renderer.compute(nodes.move);
    renderer.compute(nodes.count);
    renderer.compute(nodes.scale);

    age.current += 1;
    if (inflight.current) return;
    inflight.current = true;
    age.current = 0;
    const t0 = performance.now();
    renderer.getArrayBufferAsync(bins.value).then((buffer) => {
      const counts = new Uint32Array(buffer);
      let top = 0;
      for (let i = 1; i < counts.length; i++) if (counts[i] > counts[top]) top = i;
      onReport(
        `busiest bin ${top + 1} of ${BINS} holds ${counts[top].toLocaleString()} points · ` +
          `read back in ${(performance.now() - t0).toFixed(1)} ms, ${age.current} frame${age.current === 1 ? "" : "s"} late`,
      );
      inflight.current = false;
    });
  });

  return (
    <>
      <sprite count={COUNT} frustumCulled={false}>
        <spriteNodeMaterial
          positionNode={nodes.pointNode}
          scaleNode={float(0.018)}
          color="#cfe6ff"
          transparent
          opacity={0.5}
          depthWrite={false}
        />
      </sprite>

      <instancedMesh args={[undefined, undefined, BINS]} frustumCulled={false}>
        <boxGeometry args={[(WIDTH / BINS) * 0.8, 1, (WIDTH / BINS) * 0.8]} />
        <meshStandardNodeMaterial
          positionNode={nodes.barNode}
          colorNode={nodes.barColor}
          roughness={0.6}
        />
      </instancedMesh>
    </>
  );
}

//* Experience =================================================================

/**
 * The experience root. Owns the Canvas and the camera, fills whatever box
 * the shell mounts it in, and returns null without WebGPU because compute
 * has no WebGL fallback.
 *
 * The report state lives here, above the Canvas, because the text that
 * shows it and the component that writes it are on opposite sides of
 * the Canvas boundary.
 */
export function ComputeReduce() {
  const [report, setReport] = useState("waiting for the first readback");

  // No WebGPU, no experience. The shell around this decides what to show instead.
  if (useWebGPU() !== "yes") return null;

  return (
    <div className="absolute inset-0">
      <Canvas
        camera={{ position: [0, 0, 9], fov: 40 }}
        dpr={[1, 2]}
        renderer={{ alpha: false, antialias: true }}
      >
        <color attach="background" args={["#08080a"]} />
        <ambientLight intensity={0.5} color="#b8c4ee" />
        <directionalLight position={[4, 6, 3]} intensity={2} color="#fff4e0" />
        <Line onReport={setReport} />
      </Canvas>

      {/* The CPU's view of the same bins. Always a little behind the bars. */}
      <div className="pointer-events-none absolute right-16 bottom-5 z-30 max-w-[min(420px,calc(100vw-5rem))] text-right font-mono text-[11px] leading-relaxed tracking-[0.06em] text-faint">
        {report}
      </div>
    </div>
  );
}
