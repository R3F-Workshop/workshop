import { float, fwidth, mix, smoothstep } from "three/tsl";
import type { Node } from "three/webgpu";

import type { GrainUniforms } from "./uniforms";

/** Gradient stops. Three is enough for a grayscale ramp to band visibly. */
const STOPS = 3;

/**
 * The ramp: adds the grain into the shape, then reads the sum through a
 * stepped colour ramp.
 *
 * This is the whole point. Grain enters the field the ramp reads, so it
 * inherits the colour and brightness of wherever it lands. Grain in a dark
 * region pushes that pixel up into the next band and takes on its colour,
 * which is why it brightens as it nears a blob, as though the blob were
 * lighting it. An overlay painted on afterwards cannot do that.
 */
export function rampNodes(
  {
    shape,
    distort,
    lift,
  }: { shape: Node<"float">; distort: Node<"float">; lift: Node<"float"> },
  u: Pick<
    GrainUniforms,
    "intensity" | "noise" | "softness" | "opacity" | "color1" | "color2" | "color3"
  >,
) {
  const field = shape
    .add(distort.add(0.5).mul(u.intensity).mul(2).div(STOPS))
    .add(lift.mul(u.noise).mul(10).div(STOPS));

  // fwidth keeps the band edges from aliasing into stair steps once softness
  // is low enough for them to read as hard.
  const aa = fwidth(field);
  const v = field.sub(float(0.5).div(STOPS)).clamp(0, 1);

  // Fades the whole thing out at the bottom of the ramp.
  const coverage = smoothstep(
    0,
    u.softness.add(aa.mul(2)),
    v.mul(STOPS).clamp(0, 1),
  );

  const mixer = v.mul(STOPS - 1);
  const edge = (i: number) =>
    smoothstep(
      float(0.5).sub(u.softness.mul(0.5)).sub(aa),
      float(0.5).add(u.softness.mul(0.5)).add(aa),
      mixer.sub(i).clamp(0, 1),
    );

  return {
    colorNode: mix(mix(u.color1, u.color2, edge(0)), u.color3, edge(1)),
    // Not premultiplied. three does the blend, so the colour stays full
    // strength and coverage drives alpha alone.
    opacityNode: coverage.mul(u.opacity),
  };
}
