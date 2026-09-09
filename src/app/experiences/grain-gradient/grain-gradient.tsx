"use client";

import {
  Canvas,
  useLocalNodes,
  useThree,
  useUniforms,
  type CreatorState,
} from "@react-three/fiber/webgpu";
import { useControls } from "leva";

import { useWebGPU } from "@/lib/use-webgpu";

import { grainNodes } from "./nodes/grain";
import { rampNodes } from "./nodes/ramp";
import { shapeNode } from "./nodes/shape";

/**
 * A grain gradient, the one at /demos/grain-gradient.
 *
 * Modelled on Paper Shaders' grain gradient, written in TSL rather than
 * ported. This is the shape a pasted in shader takes on this site.
 *
 * The shader lives in `nodes/`. Each file is a plain function that takes the
 * uniforms it reads as arguments and returns nodes. Nothing in there knows
 * about React, Leva, or the fiber store, so it can be lifted out and dropped
 * into any other project.
 *
 * This file is the wiring, and it is three hooks in a row:
 *
 *  1. `useControls` gives an object of plain numbers, hex strings, and one
 *     `{ x, y }` from the vector control. The keys are the uniform names.
 *  2. `useUniforms` takes that object as is and makes a named uniform node per
 *     key under the `grainGradient` scope of the fiber store. Hex strings
 *     become Colors and `{ x, y }` becomes a Vector2. It keeps the nodes in
 *     sync with the object on every render, so a drag on a slider changes a
 *     value on the GPU and never touches the graph.
 *  3. `useLocalNodes` runs `createGrainNodes`, which reads the scope back out
 *     of the store and hands the nodes to the shader functions.
 *
 * The store is filled synchronously in step 2, before step 3 runs in the same
 * render, so the builder never sees a missing uniform. There is no effect, no
 * ready flag, and nothing to wait for. The builder is a module level function
 * with no closure, which is what lets `useLocalNodes` memoize it once.
 *
 * Grayscale by default, and transparent: it lifts the black behind the type
 * rather than painting over it. The Leva folder is namespaced because Leva's
 * store is global, and whatever hosts the experience decides whether the
 * panel is visible.
 */

function createGrainNodes({ uniforms }: CreatorState) {
  const u = uniforms.grainGradient;
  const shape = shapeNode(u);
  const { distort, lift } = grainNodes(u.grainSize);
  return rampNodes({ shape, distort, lift }, u);
}

function GrainField() {
  const params = useControls("grain gradient", {
    softness: { value: 0.5, min: 0, max: 1, step: 0.01 },
    intensity: { value: 0.5, min: 0, max: 1, step: 0.01 },
    noise: { value: 0.28, min: 0, max: 1, step: 0.01 },
    grainSize: { value: 2, min: 0.5, max: 8, step: 0.25 },
    opacity: { value: 0.62, min: 0, max: 1, step: 0.01 },
    speed: { value: 1, min: 0, max: 5, step: 0.05 },
    scale: { value: 1, min: 0.2, max: 4, step: 0.05 },
    rotation: { value: 0, min: 0, max: Math.PI * 2, step: 0.01 },
    offset: { value: { x: 0, y: 0 }, min: -1.5, max: 1.5, step: 0.01 },
    color1: "#22222a",
    color2: "#6e6e7a",
    color3: "#c8c8d4",
  });
  const { viewport } = useThree();

  // The Leva object goes in as is. Anything else can ride along, here the
  // aspect from the viewport, which updates on resize the same way a slider does.
  useUniforms(
    { ...params, aspect: viewport.width / viewport.height },
    "grainGradient",
  );

  const { colorNode, opacityNode } = useLocalNodes(createGrainNodes);

  return (
    <mesh scale={[viewport.width, viewport.height, 1]}>
      <planeGeometry args={[1, 1]} />
      <meshBasicNodeMaterial
        colorNode={colorNode}
        opacityNode={opacityNode}
        transparent
      />
    </mesh>
  );
}

export function GrainGradient() {
  // No WebGPU, no experience. The shell around this decides what to show instead.
  if (useWebGPU() !== "yes") return null;

  return (
    <div className="absolute inset-0">
      <Canvas
        // Opaque. The field is transparent so it can lift a section behind it,
        // but on its own there is nothing behind it to lift.
        renderer={{ alpha: false, antialias: false }}
        dpr={[1, 2]}
        orthographic
        camera={{ position: [0, 0, 10], zoom: 1 }}
      >
        <color attach="background" args={["#08080a"]} />
        <GrainField />
      </Canvas>
    </div>
  );
}
