import type { Color, UniformNode, Vector2 } from "three/webgpu";

/**
 * The dials the shader reads.
 *
 * Every one is a uniform rather than a constant folded into the graph, so a
 * drag on a slider changes a value on the GPU instead of recompiling the
 * shader. The node files take these as arguments and know nothing about where
 * they come from. The component fills them from Leva through `useUniforms`.
 */
export type GrainUniforms = {
  /** Width over height of the box. Blob centres live in frame space, this keeps them round. */
  aspect: UniformNode<"float", number>;
  /** Band edge width. 0 is hard steps, 1 is a smooth gradient. */
  softness: UniformNode<"float", number>;
  /** How far the grain displaces the field. Roughens the band edges. */
  intensity: UniformNode<"float", number>;
  /** Positive only grain. This is the one that lights up near the blobs. */
  noise: UniformNode<"float", number>;
  /**
   * Device pixels per grain unit. Grain is keyed to screen coordinates, not
   * UVs, so it never scales with the shape. On a retina display a value of 1
   * is already sub CSS pixel and averages into a smooth sheen. Raise it until
   * it reads as grit.
   */
  grainSize: UniformNode<"float", number>;
  /** Peak alpha. The field is transparent so it lifts whatever is behind. */
  opacity: UniformNode<"float", number>;
  /** How fast the warp kneads the shape. The shape moves, the grain does not. */
  speed: UniformNode<"float", number>;
  /** Below 1 enlarges the blobs, above 1 shrinks them. */
  scale: UniformNode<"float", number>;
  /** Radians. */
  rotation: UniformNode<"float", number>;
  offset: UniformNode<"vec2", Vector2>;
  /** Ramp stops, darkest to lightest. */
  color1: UniformNode<"color", Color>;
  color2: UniformNode<"color", Color>;
  color3: UniformNode<"color", Color>;
};
