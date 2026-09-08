import * as THREE from "three/webgpu";

/**
 * A hilly square with a `weight` attribute that drops to zero inside the
 * clearing. The surface sampler reads `weight` per face, so this one float per
 * vertex is the whole area mask.
 */
export function makeTerrain(clearing: number) {
  const geometry = new THREE.PlaneGeometry(160, 160, 96, 96);
  geometry.rotateX(-Math.PI / 2);
  const position = geometry.attributes.position;
  const weight = new Float32Array(position.count);
  for (let i = 0; i < position.count; i++) {
    const x = position.getX(i);
    const z = position.getZ(i);
    // Three sine bands at different scales read as rolling hills without any noise texture.
    const hills =
      Math.sin(x * 0.045) * Math.cos(z * 0.04) * 5 +
      Math.sin(x * 0.11 + 1.7) * Math.sin(z * 0.09 + 0.6) * 2 +
      Math.sin(x * 0.31 + z * 0.27) * 0.5;
    // The clearing is a shallow bowl, so the slopes lead the eye to it.
    const r = Math.hypot(x, z);
    const bowl = Math.max(0, 1 - r / (clearing + 12)) ** 2 * 3;
    position.setY(i, hills - bowl);
    // The sampler weights each face by its three corner weights, so the edge of the clearing is soft.
    weight[i] = THREE.MathUtils.smoothstep(r, clearing, clearing + 5);
  }
  geometry.setAttribute("weight", new THREE.BufferAttribute(weight, 1));
  geometry.computeVertexNormals();
  return geometry;
}
