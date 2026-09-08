import {
  dot,
  float,
  fract,
  hash,
  instanceIndex,
  normalize,
  normalLocal,
  select,
  sin,
  uv,
  vec2,
  vec3,
} from "three/tsl";
import type { Color, Node, UniformNode } from "three/webgpu";

/**
 * The gold. Everything that makes a tile read as stamped metal rather than
 * paint, as pure TSL with no React and no compute in it.
 *
 * Kept apart from the flip grid so that file can be about the simulation.
 * The surface knows nothing about angles: it works in the box's own local
 * frame and hands back an unrotated normal, and the caller spins that along
 * with the vertices. It takes the uniforms it reads as an argument and knows
 * nothing about where they come from.
 */

/** The surface dials, as uniform nodes. The flip grid fills them from Leva. */
export type SurfaceUniforms = {
  /** The resting face, the metal, and the four edges. */
  front: UniformNode<"color", Color>;
  back: UniformNode<"color", Color>;
  edge: UniformNode<"color", Color>;
  /** Base roughness of the metal face. 0 is a mirror; the flakes add the rest. */
  roughness: UniformNode<"float", number>;
  /** Grain facets across a tile. Aim for a few pixels each. */
  flakeCells: UniformNode<"float", number>;
  flakeStrength: UniformNode<"float", number>;
  /** How far the grain pushes roughness around per facet. */
  flakeRoughness: UniformNode<"float", number>;
  /** Per-tile brightness spread, so neighbours aren't identical. */
  toneJitter: UniformNode<"float", number>;
  /** Per-tile roughness spread. */
  roughJitter: UniformNode<"float", number>;
  /** Per-tile lean, in normal-space units. */
  tiltJitter: UniformNode<"float", number>;
  /** How much each tile domes across its own face. */
  curvature: UniformNode<"float", number>;
};

/**
 * Cheap 2D value hash, the classic sin/fract trick.
 *
 * Not a good hash in any statistical sense, but grain doesn't need one, and it
 * costs three instructions against a texture fetch and a mip chain.
 */
const hash2 = (p: Node<"vec2">) =>
  fract(sin(dot(p, vec2(127.1, 311.7))).mul(43758.5453));

/**
 * The material nodes for one tile, in the box's local frame.
 *
 * Which face of the box a fragment belongs to is decided from the unrotated
 * normal, the geometry's own identity, independent of where the flip has got
 * to. That is the whole point of using a box: the gold doesn't fade in, it
 * arrives, because you are now looking at a different face.
 */
export function tileSurface(u: SurfaceUniforms) {
  const isFront = normalLocal.z.greaterThan(0.5);
  const isBack = normalLocal.z.lessThan(-0.5);

  /**
   * Per-tile tone, so neighbours aren't stamped from the same die.
   *
   * Real sheet metal varies: alloy, age, how it caught the polish. Even a few
   * percent stops a grid of identical values from reading as printed.
   */
  const toneJitter = hash(instanceIndex.add(4919))
    .sub(0.5)
    .mul(u.toneJitter);
  const gold = u.back.mul(float(1).add(toneJitter));

  const colorNode = select(
    isFront,
    u.front,
    select(isBack, gold, u.edge),
  ) as Node<"vec3">;
  const metalnessNode = float(
    select(isFront, float(0.12), select(isBack, float(1), float(0.9))),
  );

  /**
   * Grain, generated rather than sampled.
   *
   * The imperfection maps shipped with the MaterialX gold are 1k, and a tile
   * is about 20px on screen. Whatever the repeat, they land on mip 5 or 6
   * and average to flat before they ever reach the surface. That is why the
   * gold read as plastic: the "microfacets" were a no-op, and every tile was
   * showing nothing but a clean dome gradient.
   *
   * Detail only survives if it sits at a frequency the tile can resolve, a
   * handful of cells across, so a few pixels each. A hash lattice gives
   * exactly that, costs three ALU ops, and can't be mipped away. The maps are
   * still the right tool when a surface is large on screen; this one isn't.
   */
  const cellId = uv()
    .mul(u.flakeCells)
    .floor()
    // Shift the lattice per instance, or every tile wears identical facets.
    .add(vec2(float(instanceIndex.mod(29)), float(instanceIndex.mod(31))));

  const grainX = hash2(cellId).sub(0.5);
  const grainY = hash2(cellId.add(vec2(19.7, 7.3))).sub(0.5);
  // Per-facet roughness too. Uniform roughness is its own tell, it's what
  // makes a surface look moulded rather than worked.
  const grainRough = hash2(cellId.add(vec2(3.1, 41.9)));

  /**
   * A few degrees of per-tile lean, on top of the per-fragment flakes.
   *
   * Under an orthographic camera a distant environment doesn't care where a
   * tile is, only which way it faces. A grid of perfectly flat tiles with
   * identical normals reflects one identical direction and settles into one
   * identical colour, which is what makes it read as a painted swatch rather
   * than a hundred small mirrors. Tilting each plate slightly is what real
   * stamped metal does anyway, and it's what breaks the grid up.
   */
  const tilt = vec2(hash(instanceIndex.add(31)), hash(instanceIndex.add(77)))
    .sub(0.5)
    .mul(u.tiltJitter);

  /**
   * A gentle dome across each tile, the single thing that makes this read as
   * metal rather than as gold paint.
   *
   * A perfectly flat face has one normal, samples one direction, and comes
   * back one colour; the choice is then between a mirror finish (binary: a
   * tile either catches the key or goes black) and a rough one (everything
   * averages to the same flat cream). Neither looks like metal. A curved face
   * sweeps its normal across the environment and picks up a gradient, bright
   * falling to dark within the same tile, which is exactly why a rounded
   * object reads as gold and a flat swatch of the same material doesn't. Two
   * lines of maths stand in for the curvature.
   */
  const dome = uv().sub(0.5).mul(2).mul(u.curvature);

  const perturbed = normalize(
    vec3(
      dome.x.add(grainX.mul(u.flakeStrength)).add(tilt.x),
      dome.y.add(grainY.mul(u.flakeStrength)).add(tilt.y),
      // Sign follows the face, so the perturbation leans out of whichever
      // side we're looking at rather than into it.
      select(isBack, float(-1), float(1)),
    ),
  );
  const normal = select(
    isFront.or(isBack),
    perturbed,
    normalLocal,
  ) as Node<"vec3">;

  // Roughness varies three ways: per facet, per tile, and by face. A single
  // roughness across a whole surface is one of the reliable tells of CG.
  const goldRoughness = u.roughness
    .add(grainRough.mul(u.flakeRoughness))
    .add(hash(instanceIndex.add(7717)).sub(0.5).mul(u.roughJitter));

  const roughnessNode = float(
    select(isFront, float(0.78), select(isBack, goldRoughness, float(0.38))),
  ).clamp(0.03, 1);

  return {
    colorNode,
    metalnessNode,
    roughnessNode,
    /** Local, unrotated. Spin it with the vertices before it goes to view. */
    normal,
  };
}
