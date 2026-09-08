"use client";

import { createInstances, useSurfaceSampler } from "@react-three/drei/webgpu";
import { useMemo, useRef } from "react";
import * as THREE from "three/webgpu";

import { groundRing, makeRng, samplePositions } from "./scatter";

/**
 * The smallest forest that is still one draw call. `useSurfaceSampler`
 * scatters points over a ring that is never drawn, and `Instances` turns the
 * list of `<Tree>` elements into one InstancedMesh: one geometry, one
 * material, N matrices. The simple hero's `Trees` adds per tree colour, a phase
 * attribute and a sway shader on top of exactly this.
 */

const [Forest, Tree] = createInstances();

/** The sampler sizes its buffer once, so remount with a `key` to change the count. */
export function SimpleTrees({
  count = 3000,
  radius = 150,
  clearing = 24,
}: {
  count?: number;
  radius?: number;
  /** Keep-out radius around the tower. */
  clearing?: number;
}) {
  // drei types the sampler ref as non null. The mesh is attached before the layout effect that reads it.
  const ground = useRef<THREE.Mesh>(null!);
  const ring = useMemo(() => groundRing(clearing, radius), [clearing, radius]);
  // Unit ball lifted onto its base. It spans two units, so half the height is the full tree.
  const ball = useMemo(
    () => new THREE.IcosahedronGeometry(1, 1).translate(0, 1, 0),
    [],
  );

  const samples = useSurfaceSampler(ground, count);

  const trees = useMemo(() => {
    const random = makeRng(0x85ebca6b);
    return samplePositions(samples, count).map((position) => ({
      position,
      height: THREE.MathUtils.lerp(0.7, 1.7, random()),
    }));
  }, [samples, count]);

  return (
    <>
      <mesh ref={ground} geometry={ring} visible={false} />

      <Forest
        limit={count}
        geometry={ball}
        receiveShadow
        // One mesh spanning the whole city: culling is all-or-nothing and never triggers while the city is in frame.
        frustumCulled={false}
      >
        <meshStandardMaterial color="#3d6330" roughness={0.95} metalness={0} />
        {trees.map((t, i) => (
          <Tree key={i} position={t.position} scale={[1, t.height, 1]} />
        ))}
      </Forest>
    </>
  );
}
