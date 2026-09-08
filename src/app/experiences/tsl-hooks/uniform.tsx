"use client";

import {
  Canvas,
  useFrame,
  useLocalNodes,
  useUniforms,
} from "@react-three/fiber/webgpu";
import { useControls } from "leva";
import { useRef } from "react";
import { mix, positionLocal, sin, time } from "three/tsl";
import type { Color, Mesh, UniformNode } from "three/webgpu";

import { useWebGPU } from "@/lib/use-webgpu";

/**
 * TSL hooks, one of four: a uniform.
 *
 * The smallest useful shape of the v10 hooks. One mesh, one material, four
 * dials.
 *
 * A uniform is a value the CPU owns and the GPU reads: a number, a colour, a
 * vector. A node is a piece of the shader graph. The fiber store holds both,
 * by name, under a scope, and two hooks are the whole API here:
 *
 *  - `useUniforms(values, scope)` takes plain values and makes one named
 *    uniform per key. Hex strings become Colors. On every render it compares
 *    and writes the values, so a slider drag changes a number on the GPU and
 *    never touches the graph.
 *  - `useLocalNodes(builder)` runs a builder with the whole root state,
 *    `uniforms`, `nodes`, `buffers`, `gpuStorage`, `camera` and the rest,
 *    and returns whatever the builder returns. Here that is one node for the
 *    material, built from the scope the line above just filled.
 *
 * The builder is written inline, which is the natural first shape and the
 * one to read. It has a cost worth knowing: `useLocalNodes` memoises on the
 * builder's identity, and an inline arrow is a new function every render,
 * so this component rebuilds its graph on every slider tick. The material
 * does not recompile, three keys it by structure, so for one mesh nobody
 * notices. The next demo hoists the builder and says when that matters.
 *
 * `time` is a TSL built in, so the bands drift with no CPU work per frame.
 * The rotation is ordinary `useFrame` on the mesh, which is where CPU
 * per-frame work belongs.
 *
 * Open the controls and change a colour. Nothing recompiles, because nothing
 * about the graph changed. Only a number did.
 */

/** The dials the shader reads, as the store hands them back. */
type Uniforms = {
  base: UniformNode<"color", Color>;
  tip: UniformNode<"color", Color>;
  /** Bands along the knot's local y axis. */
  bands: UniformNode<"float", number>;
  speed: UniformNode<"float", number>;
};

function Knot() {
  // Namespaced, because Leva's store is global and every demo shares it.
  const params = useControls("tsl hooks · uniform", {
    base: "#22222a",
    tip: "#ffd9a0",
    bands: { value: 6, min: 1, max: 24, step: 1 },
    speed: { value: 1, min: 0, max: 5, step: 0.05 },
  });

  // The Leva object goes in as it is. The keys are the uniform names.
  useUniforms(params, "hooksUniform");

  // The store is filled synchronously by the line above, so the builder
  // never sees a missing uniform. The cast restores the types the store
  // drops.
  const { colorNode } = useLocalNodes(({ uniforms }) => {
    const u = uniforms.scope("hooksUniform") as unknown as Uniforms;
    // A sine along local y, sliding with time, mapped to 0..1.
    const band = sin(positionLocal.y.mul(u.bands).add(time.mul(u.speed)))
      .mul(0.5)
      .add(0.5);
    return { colorNode: mix(u.base, u.tip, band) };
  });

  const ref = useRef<Mesh>(null);
  useFrame(({ delta }) => {
    if (!ref.current) return;
    ref.current.rotation.x += delta * 0.25;
    ref.current.rotation.y += delta * 0.4;
  });

  return (
    <mesh ref={ref}>
      <torusKnotGeometry args={[1, 0.32, 200, 32]} />
      <meshStandardNodeMaterial
        colorNode={colorNode}
        roughness={0.4}
        metalness={0.1}
      />
    </mesh>
  );
}

export function HooksUniform() {
  // No WebGPU, no experience. The shell around this decides what to show instead.
  if (useWebGPU() !== "yes") return null;

  return (
    <div className="absolute inset-0">
      <Canvas
        camera={{ position: [0, 0, 6], fov: 35 }}
        dpr={[1, 2]}
        renderer={{ alpha: false, antialias: true }}
      >
        <color attach="background" args={["#08080a"]} />
        <ambientLight intensity={0.5} color="#b8c4ee" />
        <directionalLight position={[4, 6, 3]} intensity={2} color="#ffd9a0" />
        <Knot />
      </Canvas>
    </div>
  );
}
