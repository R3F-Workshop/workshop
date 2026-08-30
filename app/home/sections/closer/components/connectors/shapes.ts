import {
  BoxGeometry,
  BufferAttribute,
  BufferGeometry,
  SphereGeometry,
} from "three/webgpu";

/**
 * The bodies that float in the container.
 *
 * Two halves that have to agree: a `BufferGeometry` to draw and a list of
 * colliders for Rapier. Deriving both from the same cell list is the point — a
 * collider that doesn't match its mesh is the classic way one of these scenes
 * ends up looking haunted, with shapes bouncing off nothing.
 *
 * Every shape is generated. The Lusion original ships a `.glb` of its connector;
 * building ours in code means no asset to load, no loader on the critical path,
 * and — for the cross — a silhouette that is theirs in spirit without being
 * their file.
 */

export type ShapeKind = "logo" | "dot" | "cross";

/** A box collider: half-extents, then the offset of its centre from the body. */
export type Collider = {
  half: [number, number, number];
  at: [number, number, number];
};

export type Shape = {
  geometry: BufferGeometry;
  colliders: Collider[];
  /** A ball collider instead, when the shape is a sphere. */
  ball?: number;
};

/**
 * The pmndrs mark, as a 3×3 grid of cubes.
 *
 * Read off `components/brand/logo.tsx`: in that 800-unit viewBox the squares are
 * 240 wide on a 280 pitch, at columns 0/280/560 and the same rows. Six cells are
 * filled — the three `<rect>`s, plus the three the `<path>` traces as a single
 * polygon. Normalising by the pitch puts the cells on integer coordinates and
 * leaves the square 240/280 across, which is where `CELL` comes from.
 *
 * Listed here in scene space: x right, y up, centre of the mark at the origin.
 */
const LOGO_CELLS: [number, number][] = [
  [0, 1], // top middle
  [1, 1], // top right
  [1, 0], // right
  [0, 0], // centre
  [-1, 0], // left
  [0, -1], // bottom middle
];

const CELL = 240 / 280;

/**
 * The classic Lusion connector: three bars through a common centre.
 *
 * An homage rather than a copy — the same three-axis cross, built from boxes
 * instead of lifted from their model. The proportions are the collider
 * half-extents from the pmndrs example (0.38 × 1.27), which is the part of that
 * file that is really just a description of the shape.
 */
const CROSS_BARS: [number, number, number][] = [
  [0.38, 1.27, 0.38],
  [1.27, 0.38, 0.38],
  [0.38, 0.38, 1.27],
];

/**
 * Concatenate boxes into one geometry.
 *
 * three ships `mergeGeometries` in `three/examples/jsm/utils/BufferGeometryUtils`,
 * but that module imports from `three` while this page renders through
 * `three/webgpu` — two separate builds, so its `BufferGeometry` is a different
 * class from the one the renderer expects (same reason `camera-rig.tsx` hands
 * `camera-controls` the WebGPU classes by hand). Boxes are uniform enough that
 * doing it here is shorter than the import is risky.
 */
function mergeBoxes(parts: BufferGeometry[]): BufferGeometry {
  // Non-indexed first, so the three attributes line up one-to-one and merging
  // is a matter of concatenating arrays rather than rebasing an index buffer.
  const flat = parts.map((p) => p.toNonIndexed());
  const merged = new BufferGeometry();

  for (const name of ["position", "normal", "uv"] as const) {
    const size = name === "uv" ? 2 : 3;
    const total = flat.reduce(
      (n, g) => n + (g.getAttribute(name).array as Float32Array).length,
      0,
    );
    const out = new Float32Array(total);
    let offset = 0;
    for (const g of flat) {
      const src = g.getAttribute(name).array as Float32Array;
      out.set(src, offset);
      offset += src.length;
    }
    merged.setAttribute(name, new BufferAttribute(out, size));
  }

  merged.computeBoundingSphere();
  for (const g of flat) g.dispose();
  for (const g of parts) g.dispose();
  return merged;
}

function box(
  half: [number, number, number],
  at: [number, number, number] = [0, 0, 0],
): BufferGeometry {
  const g = new BoxGeometry(half[0] * 2, half[1] * 2, half[2] * 2);
  g.translate(at[0], at[1], at[2]);
  return g;
}

function buildLogo(): Shape {
  const half: [number, number, number] = [CELL / 2, CELL / 2, CELL / 2];
  const colliders: Collider[] = LOGO_CELLS.map(([x, y]) => ({
    half,
    at: [x, y, 0],
  }));
  return {
    geometry: mergeBoxes(colliders.map((c) => box(c.half, c.at))),
    colliders,
  };
}

function buildCross(): Shape {
  return {
    geometry: mergeBoxes(CROSS_BARS.map((h) => box(h))),
    colliders: CROSS_BARS.map((half) => ({ half, at: [0, 0, 0] })),
  };
}

/**
 * Dots, at three-quarters the reach of the other two.
 *
 * A sphere that spans the same width as the logo is a far heavier object on
 * screen — the mark is mostly the gaps between its cubes, and a solid ball of
 * that size at the same `scale` swamps the frame. 0.75 lands them at roughly the
 * same visual weight, so switching shape doesn't also mean re-tuning the scale.
 */
function buildDot(): Shape {
  const r = 0.75;
  const geometry = new SphereGeometry(r, 48, 32);
  geometry.computeBoundingSphere();
  return { geometry, colliders: [], ball: r };
}

/**
 * Built once per kind and shared by every body.
 *
 * A dozen bodies on screen, all the same shape, so handing them one geometry
 * rather than one each saves a dozen uploads of identical vertices. Nothing here
 * is mutated, and the module outlives every scene that reads it, so there is
 * nothing to dispose.
 */
const cache = new Map<ShapeKind, Shape>();

export function getShape(kind: ShapeKind): Shape {
  let shape = cache.get(kind);
  if (!shape) {
    shape =
      kind === "logo"
        ? buildLogo()
        : kind === "cross"
          ? buildCross()
          : buildDot();
    cache.set(kind, shape);
  }
  return shape;
}

/** Roughly how far a body reaches from its centre — used to seed spawn spread. */
export function shapeRadius(kind: ShapeKind): number {
  const { geometry } = getShape(kind);
  return geometry.boundingSphere?.radius ?? 1;
}
