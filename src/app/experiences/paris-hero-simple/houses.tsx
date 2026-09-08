"use client";

import { createInstances, useSurfaceSampler } from "@react-three/drei/webgpu";
import { useMemo, useRef } from "react";
import * as THREE from "three/webgpu";

import { groundRing, makeRng, samplePositions } from "./scatter";

/**
 * The same shape as `Trees` with a box instead of a ball and a height that
 * varies. Nothing moves, so there is no custom attribute and no shader, just
 * the sampler for placement and `Instances` for the one draw call.
 */

const [Town, House] = createInstances();

export function Houses({
  count = 1200,
  radius = 150,
  clearing = 30,
  seed = 0x9e3779b9,
}: {
  count?: number;
  radius?: number;
  /** Keep-out radius around the tower, a little wider than the trees'. */
  clearing?: number;
  seed?: number;
}) {
  // The sampler sizes its buffer once, so a new count or a new ring is a new town.
  return (
    <SampledHouses
      key={`${count}:${radius}:${clearing}`}
      count={count}
      radius={radius}
      clearing={clearing}
      seed={seed}
    />
  );
}

function SampledHouses({
  count,
  radius,
  clearing,
  seed,
}: {
  count: number;
  radius: number;
  clearing: number;
  seed: number;
}) {
  // drei types the sampler ref as non null. The mesh is attached before the layout effect that reads it.
  const ground = useRef<THREE.Mesh>(null!);
  const ring = useMemo(() => groundRing(clearing, radius), [clearing, radius]);
  // Unit box lifted onto its base, so scale y is the full height.
  const block = useMemo(
    () => new THREE.BoxGeometry(1, 1, 1).translate(0, 0.5, 0),
    [],
  );

  const samples = useSurfaceSampler(ground, count);

  const houses = useMemo(() => {
    const random = makeRng(seed);
    const cream = new THREE.Color("#d8cfbf");
    const slate = new THREE.Color("#8d8a84");
    return samplePositions(samples, count).map((position) => {
      const [x, , z] = position;
      // Taller toward the edge, so the near ring stays low and the skyline rises behind it.
      const distance = Math.hypot(x, z) / radius;
      return {
        position,
        width: THREE.MathUtils.lerp(2.5, 5, random()),
        height: 2.5 + random() ** 1.6 * 9 * (0.5 + distance),
        depth: THREE.MathUtils.lerp(2.5, 5, random()),
        turn: random() * Math.PI * 2,
        color: cream.clone().lerp(slate, random()),
      };
    });
  }, [samples, count, radius, seed]);

  return (
    <>
      <mesh ref={ground} geometry={ring} visible={false} />

      <Town
        limit={count}
        geometry={block}
        castShadow
        receiveShadow
        frustumCulled={false}
      >
        <meshStandardMaterial color="white" roughness={0.85} metalness={0.05} />
        {houses.map((h, i) => (
          <House
            key={i}
            position={h.position}
            scale={[h.width, h.height, h.depth]}
            rotation-y={h.turn}
            color={h.color}
          />
        ))}
      </Town>
    </>
  );
}
