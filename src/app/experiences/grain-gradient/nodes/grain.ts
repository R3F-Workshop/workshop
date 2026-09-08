import {
  mx_fractal_noise_float,
  mx_noise_float,
  screenCoordinate,
  vec3,
} from "three/tsl";
import type { Node } from "three/webgpu";

import type { GrainUniforms } from "./uniforms";

/**
 * The grain: a static field locked to device pixels.
 *
 * It has no time term on purpose. Resampling it per frame, the obvious way to
 * build film grain, makes the whole thing look like an x-ray or a noisy video
 * feed. Held still it reads as a sheet of paper the shape moves underneath.
 *
 * Two quantities come out, as in the original:
 *  - `distort` is signed and roughens the band edges in both directions.
 *  - `lift` is clamped positive, so it only ever brightens.
 */
export function grainNodes(grainSize: GrainUniforms["grainSize"]) {
  const g = screenCoordinate.xy.div(grainSize);
  const fine = mx_noise_float(vec3(g.mul(0.5), 0));
  const mid = mx_noise_float(vec3(g.mul(0.2), 0));

  // Very low frequencies, so grain density clumps and thins across the frame
  // instead of sitting at one uniform level.
  //
  // These are remapped to positive on purpose. The original builds its fbm by
  // summing value noise sampled 0 to 1, so the sums are one sided and
  // subtracting them pushes the result down. Signed fractal noise here would
  // leave the subtraction positive half the time, the grain would fire almost
  // everywhere, and the frame would wash out to flat grey. Amplitudes match
  // theirs: three octaves from 0.2 falling by 0.6 sum to about 0.39.
  const positive = (n: Node<"float">, amp: number) =>
    n.mul(0.5).add(0.5).mul(amp);
  const cloudA = positive(
    mx_fractal_noise_float(vec3(g.mul(0.002), 0), 3, 2, 0.6, 1),
    0.39,
  );
  const cloudB = positive(
    mx_fractal_noise_float(vec3(g.mul(0.003), 0), 3, 2, 0.6, 1),
    0.39,
  );
  const cloudC = positive(
    mx_fractal_noise_float(vec3(g.mul(0.001), 0), 3, 2, 0.6, 1),
    0.78,
  );

  return {
    distort: fine.mul(mid).sub(cloudA).sub(cloudB),
    // Mostly zero. The subtraction leaves only the peaks standing, and that
    // sparseness is what makes it read as grain rather than as a fog sitting
    // over everything.
    lift: fine.mul(0.75).sub(cloudC).clamp(0, 1),
  };
}
