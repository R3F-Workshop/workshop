"use client";

/*
Model generated with https://github.com/pmndrs/gltfjsx
Author: SDC PERFORMANCE™️ (https://sketchfab.com/Lambo_SC04)
License: CC-BY-4.0 (http://creativecommons.org/licenses/by/4.0/)
Source: https://sketchfab.com/3d-models/free-la-tour-eiffel-8553f94d06e24cb4b0fde1080f281674
Title: ( FREE ) La tour Eiffel
*/

import { Suspense, useRef } from "react";
import { useGLTF } from "@react-three/drei";
import { useFrame, type ThreeElements } from "@react-three/fiber/webgpu";
import type { Mesh } from "three";

/**
 * The tower, the simple way.
 *
 * `useGLTF` suspends while the file loads, so the pyramid we started from
 * stands in until it arrives and React swaps them. The glow is a plain
 * emissive colour on the material. That is all bloom needs: a post pass
 * picks up anything brighter than its threshold, and emissive is how a
 * surface gets there without a light hitting it.
 *
 * The model is 121 units tall with its base at the origin. At this scale it
 * is about 2.4 units, which suits a camera five or six units away.
 */
export function Tower({
  glow = 1,
  ...props
}: {
  /** Emissive strength. 0 is unlit iron, 1 is the night time glow. */
  glow?: number;
} & ThreeElements["group"]) {
  return (
    <Suspense fallback={<Pyramid {...props} />}>
      <Model glow={glow} {...props} />
    </Suspense>
  );
}

function Model({ glow, ...props }: { glow: number } & ThreeElements["group"]) {
  const { nodes } = useGLTF("/hero-demo/free__la_tour_eiffel.glb") as unknown as {
    nodes: Record<string, Mesh>;
  };

  return (
    <group {...props}>
      {/* Shared GLB buffers outlive this component, so do not dispose them. */}
      <group dispose={null} scale={0.02} rotation-y={Math.PI / 6}>
        {["Object_4", "Object_5", "Object_6"].map((name) => (
          <mesh key={name} geometry={nodes[name].geometry}>
            <meshStandardNodeMaterial
              color="#3a2a15"
              metalness={0.8}
              roughness={0.45}
              emissive="#ff9f3f"
              emissiveIntensity={0.55 * glow}
            />
          </mesh>
        ))}
      </group>
    </group>
  );
}

/** The starting point, and the fallback: a four sided cone is a pyramid. */
function Pyramid(props: ThreeElements["group"]) {
  const ref = useRef<Mesh>(null);

  useFrame((_, delta) => {
    if (ref.current) ref.current.rotation.y += delta * 0.5;
  });

  return (
    <group {...props}>
      <mesh ref={ref} position={[0, 0.95, 0]}>
        <coneGeometry args={[1.5, 1.9, 4]} />
        <meshStandardMaterial
          color="#96a0c8"
          flatShading
          metalness={0.35}
          roughness={0.4}
        />
      </mesh>
    </group>
  );
}

useGLTF.preload("/hero-demo/free__la_tour_eiffel.glb");
