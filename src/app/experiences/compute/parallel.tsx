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
import { useRef, useState } from "react";
import {
  acos,
  cos,
  float,
  Fn,
  fract,
  hash,
  instancedArray,
  instanceIndex,
  mix,
  pow,
  sin,
  vec3,
} from "three/tsl";
import {
  AdditiveBlending,
  type Color,
  type Group,
  type StorageBufferNode,
  type UniformNode,
  type WebGPURenderer,
} from "three/webgpu";

import { useWebGPU } from "@/lib/use-webgpu";

/**
 * Compute, one: parallel.
 *
 * There is no loop. A compute pass is one function run once per index, and
 * `instanceIndex` is the counter. The same million points are built two
 * ways below, from the same maths: `fillOnCpu` is a `for` loop over a
 * typed array, `build` is a `Fn` dispatched a million times. Read them side
 * by side, they are line for line the same.
 *
 * The difference is where the time goes. The CPU loop blocks the main
 * thread for as long as it takes, and the spinner in the corner stops with
 * it. The GPU version is a dispatch, the main thread is free a fraction of
 * a millisecond later, and the spinner never notices.
 *
 * Both write into the same storage buffer, so the sprites cannot tell which
 * one ran. The CPU path writes the buffer's backing array and flags it for
 * upload, which is the same `needsUpdate` any attribute uses. No per frame
 * work either way: the points are built once and then only drawn.
 */

//* Tunables and uniforms ======================================================

const COUNT = 1 << 20;
const TAU = Math.PI * 2;

type Uniforms = {
  /** Changes the fuzz radius, so every rebuild is visibly a rebuild. */
  seed: UniformNode<"float", number>;
  size: UniformNode<"float", number>;
  a: UniformNode<"color", Color>;
  b: UniformNode<"color", Color>;
};

/** Runs `fn` and returns how long the main thread spent inside it. */
//* CPU build ==================================================================

function timed(fn: () => void) {
  const t0 = performance.now();
  fn();
  return performance.now() - t0;
}

/** Deterministic per-index noise. The CPU stand-in for TSL's `hash(instanceIndex)`. */
function jitter(i: number) {
  const x = Math.sin(i * 12.9898 + 78.233) * 43758.5453;
  return x - Math.floor(x);
}

/** A fuzzy trefoil knot. Point i sits on the knot, pushed out by a random offset. */
function fillOnCpu(out: Float32Array, seed: number) {
  const fuzz = ((seed * 0.618) % 1) * 0.5 + 0.2;
  for (let i = 0; i < COUNT; i++) {
    const t = jitter(i);
    const b = jitter(i + 1);
    const c = jitter(i + 2);
    const w = jitter(i + 3);

    const a = t * TAU;
    const R = 2 + Math.cos(a * 2);
    const kx = R * Math.cos(a * 3);
    const ky = R * Math.sin(a * 3);
    const kz = Math.sin(a * 2);

    const r = fuzz * Math.cbrt(w);
    const theta = b * TAU;
    const phi = Math.acos(c * 2 - 1);
    out[i * 3] = kx * 0.9 + r * Math.sin(phi) * Math.cos(theta);
    out[i * 3 + 1] = ky * 0.9 + r * Math.sin(phi) * Math.sin(theta);
    out[i * 3 + 2] = kz * 0.9 + r * Math.cos(phi);
  }
}

//* GPU build ==================================================================

/**
 * The creator. `useLocalNodes` calls this once, on the first render, and
 * keeps what it returns for the life of the component. All the TSL lives
 * here: the compute pass and the material nodes that read what it wrote.
 *
 * It finds its inputs by name rather than by prop. `uniforms.scope` looks
 * up the values `useUniforms` registered under "computeParallel", and
 * `gpuStorage` holds the buffer `useGPUStorage` allocated. Both hooks run
 * before this does, so the names resolve. The casts are the price of that
 * lookup, the store is untyped and this file knows what it put in.
 *
 * `fill` is the pass. `Fn(() => {})()` builds the kernel, `.compute(COUNT)`
 * turns it into a dispatch of COUNT invocations. Nothing runs yet. The
 * result is a description the renderer executes when asked.
 */
function build({ uniforms, gpuStorage }: CreatorState) {
  const u = uniforms.scope("computeParallel") as unknown as Uniforms;
  const positions =
    gpuStorage.computeParallelPositions as unknown as StorageBufferNode<"vec3">;

  // `fillOnCpu`, with `i` become `instanceIndex` and `Math` become TSL.
  const fill = Fn(() => {
    const i = instanceIndex;
    const t = hash(i);
    const b = hash(i.add(1));
    const c = hash(i.add(2));
    const w = hash(i.add(3));

    const a = t.mul(TAU);
    const R = float(2).add(cos(a.mul(2)));
    const knot = vec3(R.mul(cos(a.mul(3))), R.mul(sin(a.mul(3))), sin(a.mul(2)));

    const fuzz = fract(u.seed.mul(0.618)).mul(0.5).add(0.2);
    const r = fuzz.mul(pow(w, 1 / 3));
    const theta = b.mul(TAU);
    const phi = acos(c.mul(2).sub(1));
    const offset = vec3(
      sin(phi).mul(cos(theta)),
      sin(phi).mul(sin(theta)),
      cos(phi),
    ).mul(r);

    positions.element(i).assign(knot.mul(0.9).add(offset));
  })().compute(COUNT);

  return {
    fill,
    positionNode: positions.element(instanceIndex),
    colorNode: mix(u.a, u.b, hash(instanceIndex.add(7))),
  };
}

//* Scene ======================================================================

/**
 * The scene. Registers the uniforms and the buffer the creator reads, builds
 * the nodes, and wires the two buttons to the two builds. The hook order is
 * deliberate: uniforms and storage first, so they exist by the time
 * `useLocalNodes` runs `build`.
 *
 * `onReport` sends a line up to the DOM overlay. That lives outside the
 * Canvas, because there is no HTML inside one.
 */
function Cloud({ onReport }: { onReport: (line: string) => void }) {
  const values = useControls("compute · parallel", {
    seed: { value: 1, min: 0, max: 100, step: 1 },
    size: { value: 0.008, min: 0.002, max: 0.03, step: 0.001 },
    a: "#3a5aff",
    b: "#ffd9a0",
  });
  const u = useUniforms(values, "computeParallel") as unknown as Uniforms;

  const { computeParallelPositions: positions } = useGPUStorage(() => ({
    computeParallelPositions: instancedArray(COUNT, "vec3"),
  })) as unknown as { computeParallelPositions: StorageBufferNode<"vec3"> };

  const nodes = useLocalNodes(build);

  // `useThree` types `renderer` as the WebGL/WebGPU union even on the /webgpu
  // entry, and `compute` only exists on the WebGPU one.
  const renderer = useThree((s) => s.renderer) as unknown as WebGPURenderer;

  const onCpu = () => {
    const ms = timed(() => {
      fillOnCpu(positions.value.array as Float32Array, u.seed.value);
      // One flag, and the array the loop just wrote is what the GPU draws next.
      positions.value.needsUpdate = true;
    });
    onReport(`CPU: ${ms.toFixed(0)} ms, main thread blocked`);
  };

  const onGpu = () => {
    const ms = timed(() => renderer.compute(nodes.fill));
    onReport(`GPU: dispatched in ${ms.toFixed(2)} ms, main thread free`);
  };

  useControls("compute · parallel", {
    "build on CPU": button(onCpu),
    "build on GPU": button(onGpu),
  });

  // The first build is the GPU one, on the first frame, once the renderer
  // is certainly ready. Not timed: the first dispatch also compiles the
  // pipeline, which is a one off and not what the buttons compare.
  const started = useRef(false);
  const group = useRef<Group>(null);
  useFrame(({ delta }) => {
    if (!started.current) {
      started.current = true;
      renderer.compute(nodes.fill);
      onReport("built on the GPU. Open the controls to rebuild either way");
    }
    if (group.current) group.current.rotation.y += delta * 0.15;
  });

  return (
    <group ref={group}>
      <sprite count={COUNT} frustumCulled={false}>
        <spriteNodeMaterial
          positionNode={nodes.positionNode}
          colorNode={nodes.colorNode}
          scaleNode={u.size}
          transparent
          opacity={0.18}
          depthWrite={false}
          blending={AdditiveBlending}
        />
      </sprite>
    </group>
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
export function ComputeParallel() {
  const [report, setReport] = useState("building on the GPU");

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
        <Cloud onReport={setReport} />
      </Canvas>

      {/* The tell. A CSS animation runs on the main thread's schedule, so it
          freezes for exactly as long as the CPU build does. */}
      <div className="pointer-events-none absolute right-16 bottom-5 z-30 flex items-center gap-3 font-mono text-[11px] tracking-[0.06em] text-faint">
        <span>{COUNT.toLocaleString()} points · {report}</span>
        <span className="size-4 animate-spin rounded-full border-2 border-foreground/20 border-t-foreground/80" />
      </div>
    </div>
  );
}
