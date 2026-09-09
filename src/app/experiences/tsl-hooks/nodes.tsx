"use client";

import {
  Canvas,
  useFrame,
  useLocalNodes,
  useNodes,
  useUniforms,
  type CreatorState,
} from "@react-three/fiber/webgpu";
import { useControls } from "leva";
import { useRef } from "react";
import { cos, Fn, positionLocal, sin, time, uv, vec3 } from "three/tsl";
import type { Mesh, Node } from "three/webgpu";

import { useWebGPU } from "@/lib/use-webgpu";

/**
 * TSL hooks, three of four: shared nodes.
 *
 * Uniforms share values. `useNodes` shares graph. `Library` registers two
 * things under the `hooksNodes` scope: `palette`, a TSL `Fn` that turns a
 * number into a colour, and `stripes`, a node graph that reads the local
 * position. Neither is a material. `Bars`, `Ball` and `Sheet` each build
 * their own material out of them in `useLocalNodes`, feeding them different
 * inputs.
 *
 * A node registered this way is symbolic. `stripes` mentions
 * `positionLocal`, but that resolves per material at build time, so one
 * graph serves three meshes with three geometries. The palette is a
 * function, so it can be called with anything: a height, a stripe, a time.
 *
 * Registering happens once. `useNodes` runs its builder the first time the
 * scope is seen and reuses the result after; a hot reload rebuilds it. The
 * scope is a plain object in the store, so a function survives in it as well
 * as a node does. r3f's node type only knows objects, hence the one cast.
 *
 * With the previous demo this is the whole store: values under `uniforms`,
 * graph under `nodes`, and any component on any canvas that shares the
 * renderer can read both.
 */

function Library() {
  const params = useControls("tsl hooks · nodes", {
    hueShift: { value: 0, min: 0, max: 1, step: 0.01 },
    bands: { value: 5, min: 1, max: 20, step: 1 },
    speed: { value: 0.6, min: 0, max: 4, step: 0.05 },
  });
  useUniforms(params, "hooksNodes");

  useNodes(({ uniforms }) => {
    const u = uniforms.hooksNodes;

    // Inigo Quilez's cosine palette, with the phase offset per channel so
    // the three curves fan out into a full spectrum. Object inputs, because
    // that is the form three's types know how to name.
    const palette = Fn(({ t }: { t: Node<"float"> }) =>
      vec3(0.5).add(
        vec3(0.5).mul(
          cos(
            vec3(0, 0.33, 0.67)
              .add(t)
              .add(u.hueShift)
              .mul(Math.PI * 2),
          ),
        ),
      ),
    );

    const stripes = sin(positionLocal.y.mul(u.bands).add(time.mul(u.speed)))
      .mul(0.5)
      .add(0.5);

    return { palette: palette as unknown as Node, stripes };
  }, "hooksNodes");

  return null;
}

function barsBuild({ nodes }: CreatorState) {
  const lib = nodes.hooksNodes;
  return { colorNode: lib.palette({ t: lib.stripes }) };
}

function ballBuild({ nodes, uniforms }: CreatorState) {
  const lib = nodes.hooksNodes;
  const u = uniforms.hooksNodes;
  // A gradient by height, drifting through the palette over time.
  return {
    colorNode: lib.palette({
      t: positionLocal.y.mul(0.4).add(time.mul(u.speed).mul(0.1)),
    }),
  };
}

function sheetBuild({ nodes }: CreatorState) {
  const lib = nodes.hooksNodes;
  // The palette laid out flat, with the stripes wobbling it.
  return {
    colorNode: lib.palette({ t: uv().x.add(lib.stripes.mul(0.15)) }),
  };
}

function Bars() {
  const nodes = useLocalNodes(barsBuild);
  const ref = useRef<Mesh>(null);
  useFrame(({ delta }) => {
    if (ref.current) ref.current.rotation.y += delta * 0.3;
  });
  return (
    <mesh ref={ref} position={[-2.3, 0, 0]}>
      <boxGeometry args={[1, 2, 1]} />
      <meshStandardNodeMaterial {...nodes} roughness={0.6} />
    </mesh>
  );
}

function Ball() {
  const nodes = useLocalNodes(ballBuild);
  return (
    <mesh>
      <icosahedronGeometry args={[1, 4]} />
      <meshStandardNodeMaterial {...nodes} roughness={0.35} />
    </mesh>
  );
}

function Sheet() {
  const nodes = useLocalNodes(sheetBuild);
  return (
    <mesh position={[2.3, 0, 0]} rotation={[0, -0.4, 0]}>
      <planeGeometry args={[1.8, 2.2]} />
      <meshStandardNodeMaterial {...nodes} roughness={0.8} />
    </mesh>
  );
}

export function HooksNodes() {
  // No WebGPU, no experience. The shell around this decides what to show instead.
  if (useWebGPU() !== "yes") return null;

  return (
    <div className="absolute inset-0">
      <Canvas
        camera={{ position: [0, 0, 8], fov: 35 }}
        dpr={[1, 2]}
        renderer={{ alpha: false, antialias: true }}
      >
        <color attach="background" args={["#08080a"]} />
        <ambientLight intensity={0.6} color="#b8c4ee" />
        <directionalLight position={[4, 6, 3]} intensity={2} color="#fff4e0" />
        {/* The library renders first. The store is filled synchronously in
            that render, so the readers never see an empty scope. */}
        <Library />
        <Bars />
        <Ball />
        <Sheet />
      </Canvas>
    </div>
  );
}
