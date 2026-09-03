import {
  BoxGeometry,
  BufferAttribute,
  BufferGeometry,
  SphereGeometry,
} from "three/webgpu";

/** The bodies that float in the container. */

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

/** The pmndrs mark, as a 3×3 grid of cubes. */
const LOGO_CELLS: [number, number][] = [
  [0, 1], // top middle
  [1, 1], // top right
  [1, 0], // right
  [0, 0], // centre
  [-1, 0], // left
  [0, -1], // bottom middle
];

const CELL = 240 / 280;

/** The classic Lusion connector: three bars through a common centre. */
const CROSS_BARS: [number, number, number][] = [
  [0.38, 1.27, 0.38],
  [1.27, 0.38, 0.38],
  [0.38, 0.38, 1.27],
];

/** Concatenate boxes into one geometry. three ships `mergeGeometries` in `three/examples/jsm/utils/BufferGeometryUtils`. */
function mergeBoxes(parts: BufferGeometry[]): BufferGeometry {
  // Non-indexed first, so the three attributes line up one-to-one and merging is a matter of concatenating arrays rather than rebasing an index buffer.
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

/** Dots, at three-quarters the reach of the other two. */
function buildDot(): Shape {
  const r = 0.75;
  const geometry = new SphereGeometry(r, 48, 32);
  geometry.computeBoundingSphere();
  return { geometry, colliders: [], ball: r };
}

/** Built once per kind and shared by every body. */
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

/** Roughly how far a body reaches from its centre: used to seed spawn spread. */
export function shapeRadius(kind: ShapeKind): number {
  const { geometry } = getShape(kind);
  return geometry.boundingSphere?.radius ?? 1;
}
