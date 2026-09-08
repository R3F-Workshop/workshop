"use client";

import { useRef } from "react";
import { useFrame } from "@react-three/fiber/webgpu";
import type { Mesh } from "three";

/**
 * The stand-in every section canvas starts with: one slowly tumbling
 * icosahedron under two lights. Each canvas wrapper keeps its real camera,
 * background, and positioning — only this scene is the placeholder — so
 * replacing it during the workshop is a one-import change, and the finished
 * scenes on the `final-version` branch drop straight in.
 *
 * `scale` exists because the flip grid's canvas is orthographic with
 * 1 unit ≈ 1 px; everything else is fine at world scale.
 */
export function PlaceholderScene({ scale = 1 }: { scale?: number }) {
  const ref = useRef<Mesh>(null);

  useFrame(({ delta }) => {
    if (!ref.current) return;
    ref.current.rotation.x += delta * 0.25;
    ref.current.rotation.y += delta * 0.4;
  });

  return (
    <group scale={scale}>
      <ambientLight intensity={0.5} color="#b8c4ee" />
      <directionalLight position={[4, 6, 3]} intensity={2} color="#ffd9a0" />
      <mesh ref={ref}>
        <icosahedronGeometry args={[1, 0]} />
        <meshStandardMaterial
          color="#8a93b8"
          flatShading
          metalness={0.3}
          roughness={0.45}
        />
      </mesh>
    </group>
  );
}
