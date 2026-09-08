import {
  cos,
  length,
  mx_fractal_noise_float,
  sin,
  smoothstep,
  time,
  uv,
  vec2,
  vec3,
} from "three/tsl";

import type { GrainUniforms } from "./uniforms";

/**
 * The shape: three soft blobs riding a low frequency warp, as a scalar field
 * from 0 to 1.
 *
 * Blob centres live in frame space, a fraction of the width and height
 * independent of aspect, so the composition holds whether this is a wide band
 * on a desktop, the same section stacked tall on a phone, or a full screen
 * demo. Aspect correction happens per blob on the distance, which keeps them
 * round without moving them.
 */
export function shapeNode(
  u: Pick<GrainUniforms, "aspect" | "speed" | "scale" | "rotation" | "offset">,
) {
  const centred = uv().sub(0.5);

  // Scale, rotate and offset the sample point rather than the blobs. One
  // transform instead of three, and it composes.
  const s = centred.mul(u.scale);
  const c = cos(u.rotation);
  const sn = sin(u.rotation);
  const q = vec2(
    s.x.mul(c).sub(s.y.mul(sn)),
    s.x.mul(sn).add(s.y.mul(c)),
  ).sub(u.offset);

  // x scaled to match y's physical size, so distances are circular.
  const round = vec2(u.aspect, 1);
  const t = time.mul(u.speed).mul(0.06);

  // Low frequency warp bends the whole field. The blobs ride on it rather
  // than each being animated separately. Sampled in corrected space so the
  // noise itself does not stretch with the viewport.
  const warp = mx_fractal_noise_float(
    vec3(q.mul(round).mul(0.9), t),
    3,
    2,
    0.5,
    1,
  );

  // Warp is added after correction. Adding it before would stretch the wobble
  // horizontally along with everything else.
  const blob = (cx: number, cy: number, r: number, w: number) =>
    smoothstep(
      r,
      0,
      length(
        q
          .sub(vec2(cx, cy))
          .mul(round)
          .add(vec2(warp.mul(w), warp.mul(w * 0.8))),
      ),
    );

  // Pushed out to the edges rather than centred. The headline sits in the
  // middle of the closing section, and a bright core behind white type costs
  // more than the shape gains.
  return blob(-0.26, -0.1, 0.6, 0.34)
    .add(blob(0.24, 0.16, 0.56, 0.3))
    .add(blob(0.04, -0.52, 0.42, 0.26).mul(0.8))
    .clamp(0, 1);
}
