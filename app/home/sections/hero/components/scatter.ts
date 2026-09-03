/**
 * Deterministic scatter for the city.
 *
 * Seeded rather than `Math.random()` for two reasons: the React Compiler's
 * purity rule is right that a random call inside `useMemo` is a bug waiting to
 * happen (a dropped memo reshuffles the whole city), and a city that is the
 * same on every reload is the only kind you can compare screenshots of.
 */

/** mulberry32 — small, fast, good enough for placing boxes. */
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
 * `count` points spread evenly over a disc of `radius`, leaving a `clearing`
 * around the origin for the tower. Returns flat `[x, z, x, z, …]`.
 */
export function scatterOnDisc(
  count: number,
  radius: number,
  clearing: number,
  random: () => number,
): Float32Array {
  const points = new Float32Array(count * 2);
  let placed = 0;
  while (placed < count) {
    // sqrt keeps the density even; without it the middle is crowded.
    const r = radius * Math.sqrt(random());
    if (r < clearing) continue;
    const angle = random() * Math.PI * 2;
    points[placed * 2] = Math.cos(angle) * r;
    points[placed * 2 + 1] = Math.sin(angle) * r;
    placed++;
  }
  return points;
}
