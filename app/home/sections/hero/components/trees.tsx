"use client";

import { useLayoutEffect, useMemo, useRef } from "react";
import * as THREE from "three/webgpu";

import { makeRng, scatterOnDisc } from "./scatter";

/**
 * Every tree is one instance of one mesh: one geometry, one material, N
 * matrices, one draw call. The GPU draws the same thing N times and the
 * matrices say where.
 *
 * An icosahedron at detail 1 is 80 triangles. The default sphere is 960, and
 * at this distance a tree is a few pixels — nobody can tell.
 */
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
  const ref = useRef<THREE.InstancedMesh>(null);

  const placed = useMemo(() => {
    const random = makeRng(seed);
    const points = scatterOnDisc(count, radius, clearing, random);
    const dummy = new THREE.Object3D();
    const matrices: THREE.Matrix4[] = [];
    const colors: THREE.Color[] = [];
    const dark = new THREE.Color("#22381f");
    const light = new THREE.Color("#4d7a3a");

    for (let i = 0; i < count; i++) {
      const height = THREE.MathUtils.lerp(1.4, 3.4, random());
      const spread = THREE.MathUtils.lerp(0.8, 1.5, random());
      // Unit ball centred on its origin: lift by half the height to sit it down.
      dummy.position.set(points[i * 2], height / 2, points[i * 2 + 1]);
      dummy.scale.set(spread, height * 0.5, spread);
      dummy.rotation.y = random() * Math.PI * 2;
      dummy.updateMatrix();
      matrices.push(dummy.matrix.clone());
      colors.push(dark.clone().lerp(light, random()));
    }
    return { matrices, colors };
  }, [count, radius, clearing, seed]);

  // The mesh exists after mount, not during render — so the matrices go in
  // from a layout effect. And the flag everyone forgets: `needsUpdate`.
  useLayoutEffect(() => {
    const mesh = ref.current;
    if (!mesh) return;
    placed.matrices.forEach((m, i) => mesh.setMatrixAt(i, m));
    placed.colors.forEach((c, i) => mesh.setColorAt(i, c));
    mesh.instanceMatrix.needsUpdate = true;
    if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true;
  }, [placed]);

  return (
    // `args` is the constructor, so a new count means a new mesh — the key
    // makes that explicit instead of hoping R3F rebuilds it.
    <instancedMesh
      key={count}
      ref={ref}
      args={[undefined, undefined, count]}
      receiveShadow
      // One mesh spanning the whole city: culling is all-or-nothing and never
      // triggers while the city is in frame.
      frustumCulled={false}
    >
      <icosahedronGeometry args={[1, 1]} />
      <meshStandardMaterial color="white" roughness={0.95} metalness={0} />
    </instancedMesh>
  );
}
