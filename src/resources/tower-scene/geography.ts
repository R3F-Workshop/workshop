import * as THREE from "three/webgpu";

/**
 * The city's shared geography: where the river runs and where the park sits.
 *
 * One module, consulted by everyone — the terrain meshes build *from* these
 * definitions and the building/tree scatter rejects *against* them, so the
 * riverbed and the "don't build in the river" test can never drift apart.
 *
 * Everything is in city units (the pre-`worldScale` space the buildings use:
 * tower at origin, city radius ~400). At the default worldScale 5 one unit is
 * ~5 m, so the river's 24-unit width reads as ~120 m — a slightly narrowed
 * Seine — and its ~55-unit closest approach to the tower is ~280 m, about
 * right for the real embankment.
 */

/** Half-width of the water surface. */
export const RIVER_HALF_WIDTH = 12;
/** Extra keep-out beyond the water for buildings (embankment). */
export const RIVER_BUILDING_MARGIN = 6;
/** Trees may stand on the bank but not in the water. */
export const RIVER_TREE_MARGIN = 1.5;

/** Open area around the tower. */
export const TOWER_CLEARING_RADIUS = 34;

export function inTowerClearing(x: number, z: number, margin = 0): boolean {
  return Math.hypot(x, z) < TOWER_CLEARING_RADIUS + margin;
}

/**
 * Seine-ish arc: crosses the whole city on the tower's -z side with a gentle
 * bend, closest to the tower near the middle. Control points chosen so the
 * curve stays smooth and never kinks toward the origin.
 */
export const RIVER_CONTROL_POINTS: THREE.Vector3[] = [
  new THREE.Vector3(-430, 0, -150),
  new THREE.Vector3(-230, 0, -105),
  new THREE.Vector3(-60, 0, -68),
  new THREE.Vector3(90, 0, -48),
  new THREE.Vector3(250, 0, -95),
  new THREE.Vector3(430, 0, -180),
];

export const riverCurve = new THREE.CatmullRomCurve3(
  RIVER_CONTROL_POINTS,
  false,
  "catmullrom",
  0.5,
);

/**
 * Flat polyline approximation of the curve for cheap distance queries. 128
 * segments over ~900 units keeps the chord error far below a building's
 * footprint, which is all the rejection test needs.
 */
const RIVER_SAMPLES: THREE.Vector2[] = riverCurve
  .getSpacedPoints(128)
  .map((p) => new THREE.Vector2(p.x, p.z));

/** Distance from (x, z) to the river centreline. */
export function distanceToRiver(x: number, z: number): number {
  let best = Infinity;
  for (let i = 0; i < RIVER_SAMPLES.length - 1; i++) {
    const a = RIVER_SAMPLES[i];
    const b = RIVER_SAMPLES[i + 1];
    const abx = b.x - a.x;
    const aby = b.y - a.y;
    const apx = x - a.x;
    const apy = z - a.y;
    const lenSq = abx * abx + aby * aby;
    const t = lenSq > 0 ? Math.max(0, Math.min(1, (apx * abx + apy * aby) / lenSq)) : 0;
    const dx = apx - abx * t;
    const dy = apy - aby * t;
    const d = dx * dx + dy * dy;
    if (d < best) best = d;
  }
  return Math.sqrt(best);
}

export function inRiverWater(x: number, z: number): boolean {
  return distanceToRiver(x, z) < RIVER_HALF_WIDTH + RIVER_TREE_MARGIN;
}

export function inRiverCorridor(x: number, z: number): boolean {
  return distanceToRiver(x, z) < RIVER_HALF_WIDTH + RIVER_BUILDING_MARGIN;
}

/**
 * Champ-de-Mars-ish park: an axis-aligned strip running away from the tower
 * on the +z side (opposite bank from the river). Real thing is ~780 × 220 m;
 * this is ~600 × 190 m at default scale — trimmed so the far end doesn't eat
 * too much of the city carpet.
 */
export const PARK = {
  minX: -19,
  maxX: 19,
  minZ: 10,
  maxZ: 130,
};

export function inPark(x: number, z: number, margin = 0): boolean {
  return (
    x > PARK.minX - margin &&
    x < PARK.maxX + margin &&
    z > PARK.minZ - margin &&
    z < PARK.maxZ + margin
  );
}

/** Outer edge of the Haussmann block ring. */
export const HAUSSMANN_RADIUS = 70;
