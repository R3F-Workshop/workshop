"use client";

import { useRef } from "react";
import { useFrame, type ThreeElements } from "@react-three/fiber/webgpu";
import type { Mesh } from "three";

/**
 * The starting point: a four-sided cone is a pyramid, and `flatShading` keeps
 * the facets crisp. It spins, which is the first `useFrame` on the page.
 *
 * Once the real tower arrives this has a second job: it is the Suspense
 * fallback, so a hero stuck on the pyramid means "the model never loaded".
 */
export function Pyramid(props: ThreeElements["group"]) {
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
