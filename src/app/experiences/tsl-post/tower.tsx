"use client";

/*
Model generated with https://github.com/pmndrs/gltfjsx
Author: SDC PERFORMANCE™️ (https://sketchfab.com/Lambo_SC04)
License: CC-BY-4.0 (http://creativecommons.org/licenses/by/4.0/)
Source: https://sketchfab.com/3d-models/free-la-tour-eiffel-8553f94d06e24cb4b0fde1080f281674
Title: ( FREE ) La tour Eiffel
*/

import { Suspense } from "react";
import { MathUtils, type Mesh } from "three/webgpu";
import { useGLTF } from "@react-three/drei/webgpu";

import { asset } from "@/lib/asset";

/**
 * The subject of the post processing lesson: the Eiffel tower on a low
 * pedestal, in plain bronze. Nothing about it is post processing. It is here
 * so every step has the same thing to look at, with enough thin detail to
 * show what each pass does to edges, and a faint warm emissive so the
 * emissive attachment is never empty.
 */

const MODEL_URL = asset("/hero-demo/free__la_tour_eiffel.glb");
const TOWER_MESHES = ["Object_4", "Object_5", "Object_6"] as const;
/** The model is 121 units tall. This lands it at about 2.5 units. */
const MODEL_SCALE = 2.5 / 121;

function TowerModel() {
  // Drei types the graph loosely. These three meshes are the whole model.
  const { nodes } = useGLTF(MODEL_URL) as unknown as {
    nodes: Record<(typeof TOWER_MESHES)[number], Mesh>;
  };

  return (
    // Shared GLB buffers outlive this component, so nothing here disposes them.
    <group
      dispose={null}
      scale={MODEL_SCALE}
      rotation-y={MathUtils.degToRad(30)}
    >
      {TOWER_MESHES.map((name) => (
        <mesh
          key={name}
          castShadow
          receiveShadow
          geometry={nodes[name].geometry}
        >
          <meshStandardNodeMaterial
            color="#b07a48"
            metalness={0.35}
            roughness={0.45}
            emissive="#3a2210"
            emissiveIntensity={0.5}
          />
        </mesh>
      ))}
    </group>
  );
}

export function Tower() {
  return (
    <group>
      {/* The pedestal. Its top is at y 0.2, where the tower stands. */}
      <mesh position-y={0.1} castShadow receiveShadow>
        <cylinderGeometry args={[1.05, 1.15, 0.2, 48]} />
        <meshStandardNodeMaterial color="#8d8781" roughness={0.65} />
      </mesh>
      <group position-y={0.2}>
        <Suspense fallback={null}>
          <TowerModel />
        </Suspense>
      </group>
    </group>
  );
}

useGLTF.preload(MODEL_URL);
