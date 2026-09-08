/** Deterministic placement for the city: a seeded random and the sampler helpers. */

import { RingGeometry, type InstancedBufferAttribute } from "three/webgpu";

/** mulberry32: small, fast, good enough for placing boxes. */
export function makeRng(seed: number) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/**
 * A flat ring on the ground plane for the surface sampler to scatter over.
 * Nothing draws it. The hole is the keep-out around the tower.
 */
export function groundRing(clearing: number, radius: number) {
  return new RingGeometry(clearing, radius, 64, 16).rotateX(-Math.PI / 2);
}

/**
 * The sampler hands back one 4x4 matrix per point. Only the translation, the
 * last column, is used, so this reads it out as plain position tuples.
 */
export function samplePositions(samples: InstancedBufferAttribute, count: number) {
  const m = samples.array;
  return Array.from(
    { length: count },
    (_, i) =>
      [m[i * 16 + 12], m[i * 16 + 13], m[i * 16 + 14]] as [
        number,
        number,
        number,
      ],
  );
}
