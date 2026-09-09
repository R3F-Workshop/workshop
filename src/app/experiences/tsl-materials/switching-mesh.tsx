"use client";

import { Suspense } from "react";
import type { Mesh } from "three/webgpu";
import { useGLTF } from "@react-three/drei/webgpu";
import { useControls } from "leva";

import { asset } from "@/lib/asset";

/**
 * One mesh, four geometries, the material supplied by the caller.
 *
 * The materials lesson is about what a node material does to a surface, so
 * the surface is the thing worth switching. The Leva select picks a geometry
 * and `children` is the material, declared by the experience as an ordinary
 * JSX child of the mesh.
 *
 * `frustumCulled` passes through to whichever mesh is showing. A material
 * whose `positionNode` moves vertices past the geometry's CPU-side bounds
 * needs it off, and only the caller knows whether its material does that.
 *
 * The helmet is the DamagedHelmet sample, by theblueturtle_, under
 * CC BY-NC 4.0. Only its geometry is used. The file's own material stays on
 * the loader's cached scene. It loads inside its own Suspense with the sphere
 * as the fallback, so the three primitives never wait on the network.
 */

type Shape = "sphere" | "octahedron" | "plane" | "helmet";

type MeshProps = {
  children: React.ReactNode;
  frustumCulled?: boolean;
};

const MODEL = asset("/models/DamagedHelmet.glb");

function Helmet({ children, frustumCulled }: MeshProps) {
  // The file has one node, named by its exporter, carrying one mesh. The
  // loader's `nodes` map is keyed by name, which the typings cannot know.
  const { nodes } = useGLTF(MODEL) as unknown as {
    nodes: { "node_damagedHelmet_-6514": Mesh };
  };
  const source = nodes["node_damagedHelmet_-6514"];

  // The node's quaternion stands the helmet up. Its extent is about 1.9 units
  // across, so 0.85 brings it to roughly 1.6, and the lift keeps the visor
  // clear of the floor.
  return (
    <mesh
      castShadow
      receiveShadow
      frustumCulled={frustumCulled}
      geometry={source.geometry}
      quaternion={source.quaternion}
      scale={0.85}
      position-y={0.95}
    >
      {children}
    </mesh>
  );
}

useGLTF.preload(MODEL);

function Primitive({ shape, children, frustumCulled }: MeshProps & { shape: Shape }) {
  if (shape === "octahedron")
    return (
      <mesh castShadow receiveShadow frustumCulled={frustumCulled} position-y={1.1}>
        <octahedronGeometry args={[1.1, 0]} />
        {children}
      </mesh>
    );

  if (shape === "plane")
    // Upright and leaned back a little so the default camera sees its face
    // rather than its edge.
    return (
      <mesh
        castShadow
        receiveShadow
        frustumCulled={frustumCulled}
        position-y={1.2}
        rotation={[-0.25, 0.35, 0]}
      >
        <planeGeometry args={[2.4, 2.4, 8, 8]} />
        {children}
      </mesh>
    );

  return (
    <mesh castShadow receiveShadow frustumCulled={frustumCulled} position-y={1}>
      <sphereGeometry args={[1, 64, 64]} />
      {children}
    </mesh>
  );
}

export function SwitchingMesh({ children, frustumCulled = true }: MeshProps) {
  const { geometry } = useControls("tsl materials · mesh", {
    geometry: {
      value: "sphere" as Shape,
      options: ["sphere", "octahedron", "plane", "helmet"] as Shape[],
    },
  });

  if (geometry === "helmet")
    return (
      <Suspense
        fallback={
          <Primitive shape="sphere" frustumCulled={frustumCulled}>
            {children}
          </Primitive>
        }
      >
        <Helmet frustumCulled={frustumCulled}>{children}</Helmet>
      </Suspense>
    );

  return (
    <Primitive shape={geometry} frustumCulled={frustumCulled}>
      {children}
    </Primitive>
  );
}
