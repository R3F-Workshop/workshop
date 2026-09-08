"use client";

import {
  createInstances,
  InstancedAttribute,
  useSurfaceSampler,
} from "@react-three/drei/webgpu";
import { useMemo, useRef } from "react";
import {
  attribute,
  mix,
  positionGeometry,
  positionLocal,
  sin,
  time,
  vec3,
} from "three/tsl";
import * as THREE from "three/webgpu";

import { makeRng } from "./scatter";

/**
 * Every tree is one instance of one mesh: one geometry, one material, N
 * matrices, one draw call. drei does the bookkeeping. `useSurfaceSampler`
 * scatters points over a flat ring that is never drawn, and the ring's hole is
 * the keep-out around the tower. `Instances` turns the list of `<Tree>`
 * elements into the InstancedMesh, and `InstancedAttribute` gives each tree a
 * `phase` float that the sway shader reads with `attribute("phase")`.
 */

/** `createInstances` gives a typed pair, so `<Tree phase={...}>` type checks. */
const [Forest, Tree] = createInstances<{ phase: number }>();

export function Trees({
  count = 3000,
  radius = 150,
  clearing = 24,
  seed = 0x85ebca6b,
}: {
  count?: number;
  radius?: number;
  /** Keep-out radius around the tower. */
  clearing?: number;
  seed?: number;
}) {
  // The sampler sizes its buffer once, so a new count or a new ring is a new forest.
  return (
    <SampledTrees
      key={`${count}:${radius}:${clearing}`}
      count={count}
      radius={radius}
      clearing={clearing}
      seed={seed}
    />
  );
}

function SampledTrees({
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
  const ring = useMemo(
    () =>
      new THREE.RingGeometry(clearing, radius, 64, 16).rotateX(-Math.PI / 2),
    [clearing, radius],
  );
  // Unit ball lifted onto its base, so the shader's height ramp runs from the ground up.
  const ball = useMemo(
    () => new THREE.IcosahedronGeometry(1, 1).translate(0, 1, 0),
    [],
  );

  // One matrix per point, in the ring's local space. Only the translation is used.
  const samples = useSurfaceSampler(ground, count);

  const trees = useMemo(() => {
    const random = makeRng(seed);
    const dark = new THREE.Color("#22381f");
    const light = new THREE.Color("#4d7a3a");
    const m = samples.array as Float32Array;
    return Array.from({ length: count }, (_, i) => ({
      position: [m[i * 16 + 12], m[i * 16 + 13], m[i * 16 + 14]] as [
        number,
        number,
        number,
      ],
      spread: THREE.MathUtils.lerp(0.8, 1.5, random()),
      height: THREE.MathUtils.lerp(1.4, 3.4, random()),
      turn: random() * Math.PI * 2,
      color: dark.clone().lerp(light, random()),
      phase: random() * Math.PI * 2,
    }));
  }, [samples, count, seed]);

  const shader = useMemo(() => {
    // Zero at the base and one at the crown, squared so the base holds still.
    const height = positionGeometry.y.mul(0.5);
    const lean = height.mul(height);
    const sway = sin(time.mul(1.2).add(attribute("phase", "float")))
      .mul(0.12)
      .mul(lean);
    return {
      // Runs after the instance transform, so the offset is in world units.
      positionNode: positionLocal.add(vec3(sway, 0, sway.mul(0.4))),
      // Shade toward the base. Instance color multiplies in on top of this.
      colorNode: mix(vec3(0.6), vec3(1), height),
    };
  }, []);

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
        <meshStandardNodeMaterial
          positionNode={shader.positionNode}
          colorNode={shader.colorNode}
          roughness={0.95}
          metalness={0}
        />
        <InstancedAttribute name="phase" defaultValue={0} />
        {trees.map((t, i) => (
          <Tree
            key={i}
            position={t.position}
            // The ball spans two units, so half the height is the full tree.
            scale={[t.spread, t.height * 0.5, t.spread]}
            rotation-y={t.turn}
            color={t.color}
            phase={t.phase}
          />
        ))}
      </Forest>
    </>
  );
}
