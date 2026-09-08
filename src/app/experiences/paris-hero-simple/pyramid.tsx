"use client";

import { useRef } from "react";
import { useFrame, type ThreeElements } from "@react-three/fiber/webgpu";
import type { Mesh } from "three";

/** The starting point: a four-sided cone is a pyramid, and `flatShading` keeps the facets crisp. */
export function Pyramid(props: ThreeElements["group"]) {
  const ref = useRef<Mesh>(null);

  useFrame(({ delta }) => {
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
