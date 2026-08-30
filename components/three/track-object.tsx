"use client";

import { useFrame } from "@react-three/fiber/webgpu";
import { useRef } from "react";
import type { Mesh } from "three/webgpu";

import { SectionCanvas } from "./section-canvas";

/**
 * Placeholder objects for the Day 2 track cards.
 *
 * Deliberately abstract — the three tracks aren't named yet, so a shape that
 * suggested a subject would be a lie. Each card gets a different solid so they
 * read as three distinct things rather than one repeated asset.
 */

type TrackShape = "knot" | "ico" | "octa";

const TRACK_SHAPES: TrackShape[] = ["knot", "ico", "octa"];

function Geometry({ shape }: { shape: TrackShape }) {
  if (shape === "knot")
    return <torusKnotGeometry args={[0.58, 0.19, 140, 26]} />;
  if (shape === "ico") return <icosahedronGeometry args={[0.92, 0]} />;
  return <octahedronGeometry args={[0.98, 0]} />;
}

function Solid({ shape }: { shape: TrackShape }) {
  const ref = useRef<Mesh>(null);

  useFrame((state) => {
    const mesh = ref.current;
    if (!mesh) return;
    mesh.rotation.x = state.elapsed * 0.17;
    mesh.rotation.y = state.elapsed * 0.24;
  });

  return (
    <mesh ref={ref}>
      <Geometry shape={shape} />
      {/* Dark metal so it sits in the palette rather than on top of it. */}
      <meshStandardNodeMaterial
        color="#43434c"
        metalness={0.92}
        roughness={0.26}
      />
    </mesh>
  );
}

/** Canvas + scene, so `scenes.tsx` has a single client-only module to load. */
export function TrackCanvas({ index }: { index: number }) {
  return (
    <SectionCanvas
      className="absolute inset-0"
      camera={{ position: [0, 0, 3.1], fov: 42 }}
      fps={30}
    >
      <TrackObject shape={TRACK_SHAPES[index % TRACK_SHAPES.length]} />
    </SectionCanvas>
  );
}

function TrackObject({ shape }: { shape: TrackShape }) {
  return (
    <>
      <ambientLight intensity={0.55} />
      {/* Key from upper right, cool rim from below left — enough shape
          definition to read without an environment map. */}
      <directionalLight position={[3, 4, 5]} intensity={2.8} color="#ffffff" />
      <directionalLight
        position={[-4, -2, 1.5]}
        intensity={1.9}
        color="#8f8fb4"
      />
      <Solid shape={shape} />
    </>
  );
}
