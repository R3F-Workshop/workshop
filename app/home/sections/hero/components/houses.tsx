"use client";

import { useLayoutEffect, useMemo, useRef } from "react";
import * as THREE from "three/webgpu";

import { makeRng, scatterOnDisc } from "./scatter";

/** The same shape as `Trees` with a box instead of a ball and a height that varies. */
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
  const ref = useRef<THREE.InstancedMesh>(null);

  const placed = useMemo(() => {
    const random = makeRng(seed);
    const points = scatterOnDisc(count, radius, clearing, random);
    const dummy = new THREE.Object3D();
    const matrices: THREE.Matrix4[] = [];
    const colors: THREE.Color[] = [];
    const cream = new THREE.Color("#d8cfbf");
    const slate = new THREE.Color("#8d8a84");

    for (let i = 0; i < count; i++) {
      const x = points[i * 2];
      const z = points[i * 2 + 1];
      // Taller toward the edge, so the near ring stays low and the skyline rises behind it.
      const distance = Math.hypot(x, z) / radius;
      const height = 2.5 + random() ** 1.6 * 9 * (0.5 + distance);
      const width = THREE.MathUtils.lerp(2.5, 5, random());
      const depth = THREE.MathUtils.lerp(2.5, 5, random());
      dummy.position.set(x, height / 2, z);
      dummy.scale.set(width, height, depth);
      dummy.rotation.y = random() * Math.PI * 2;
      dummy.updateMatrix();
      matrices.push(dummy.matrix.clone());
      colors.push(cream.clone().lerp(slate, random()));
    }
    return { matrices, colors };
  }, [count, radius, clearing, seed]);

  useLayoutEffect(() => {
    const mesh = ref.current;
    if (!mesh) return;
    placed.matrices.forEach((m, i) => mesh.setMatrixAt(i, m));
    placed.colors.forEach((c, i) => mesh.setColorAt(i, c));
    mesh.instanceMatrix.needsUpdate = true;
    if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true;
  }, [placed]);

  return (
    <instancedMesh
      key={count}
      ref={ref}
      args={[undefined, undefined, count]}
      castShadow
      receiveShadow
      frustumCulled={false}
    >
      <boxGeometry args={[1, 1, 1]} />
      <meshStandardMaterial color="white" roughness={0.85} metalness={0.05} />
    </instancedMesh>
  );
}
