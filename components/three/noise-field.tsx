"use client";

import { useFrame, useThree } from "@react-three/fiber/webgpu";
import { useMemo } from "react";
import * as THREE from "three/webgpu";
import {
  cos,
  float,
  fwidth,
  length,
  mix,
  mx_fractal_noise_float,
  mx_noise_float,
  screenCoordinate,
  sin,
  smoothstep,
  uniform,
  uv,
  vec2,
  vec3,
} from "three/tsl";

import { SectionCanvas } from "./section-canvas";

/**
 * The grain gradient behind the closing CTA, and the demo at
 * /demos/grain-gradient. Modelled on Paper Shaders' grain gradient — written in
 * TSL rather than ported, but following its structure, which gets two things
 * right that are easy to get wrong.
 *
 * **The grain does not animate.** It is a static field locked to pixels, so it
 * reads as a sheet of paper the shape moves underneath. Resampling it per frame
 * instead — the obvious way to build "film grain" — makes the whole thing look
 * like an x-ray or a noisy video feed. Nothing else about the effect survives
 * that mistake.
 *
 * **The grain is added to the shape, not painted over it.** Noise perturbs the
 * scalar field *before* the colour ramp reads it, so grain in a dark region
 * pushes that pixel up into the next band and takes on its colour. The practical
 * effect is that grain brightens as it nears a blob, as though the blob were
 * lighting it. An overlay cannot do that — it just sits there being dust.
 *
 * Two separate noise quantities do that work, as in the original:
 *  - `distort` displaces the field in both directions, roughening the bands.
 *  - `lift` is clamped positive, so it only ever brightens.
 *
 * Grayscale by default, and transparent: it lifts the black behind the type
 * rather than painting over it.
 *
 * Every dial is a TSL uniform rather than a constant folded into the graph, so
 * the demo's controls take effect without recompiling the shader on each drag.
 */

/** Gradient stops. Three is enough for a grayscale ramp to band visibly. */
const STOPS = 3;

export type GrainParams = {
  /** Band edge width. 0 = hard steps, 1 = smooth gradient. */
  softness: number;
  /** How far the grain displaces the field. Roughens the band edges. */
  intensity: number;
  /** Positive-only grain. This is the one that lights up near the blobs. */
  noise: number;
  /**
   * Device pixels per grain unit. Grain is keyed to screen coordinates, not
   * UVs, so it never scales with the shape — but on a retina display a value
   * of 1 is already sub-CSS-pixel and averages into a smooth sheen. Raise it
   * until it reads as grit.
   */
  grainSize: number;
  /** Peak alpha. The field is transparent so it lifts whatever is behind. */
  opacity: number;
  /** How fast the warp kneads the shape. The shape moves; the grain does not. */
  speed: number;
  /** Below 1 enlarges the blobs, above 1 shrinks them. */
  scale: number;
  /** Radians. */
  rotation: number;
  offsetX: number;
  offsetY: number;
  /** Ramp stops, darkest to lightest. */
  color1: string;
  color2: string;
  color3: string;
};

export const GRAIN_DEFAULTS: GrainParams = {
  softness: 0.5,
  intensity: 0.5,
  noise: 0.28,
  grainSize: 2,
  opacity: 0.62,
  speed: 1,
  scale: 1,
  rotation: 0,
  offsetX: 0,
  offsetY: 0,
  color1: "#22222a",
  color2: "#6e6e7a",
  color3: "#c8c8d4",
};

export function GrainField({ params }: { params: GrainParams }) {
  const { viewport } = useThree();

  const u = useMemo(
    () => ({
      time: uniform(0),
      aspect: uniform(1),
      softness: uniform(0),
      intensity: uniform(0),
      noise: uniform(0),
      grainSize: uniform(1),
      opacity: uniform(1),
      speed: uniform(1),
      scale: uniform(1),
      rotation: uniform(0),
      offset: uniform(new THREE.Vector2()),
      color1: uniform(new THREE.Color()),
      color2: uniform(new THREE.Color()),
      color3: uniform(new THREE.Color()),
    }),
    [],
  );

  u.aspect.value = viewport.width / viewport.height;
  u.softness.value = params.softness;
  u.intensity.value = params.intensity;
  u.noise.value = params.noise;
  u.grainSize.value = params.grainSize;
  u.opacity.value = params.opacity;
  u.speed.value = params.speed;
  u.scale.value = params.scale;
  u.rotation.value = params.rotation;
  u.offset.value.set(params.offsetX, params.offsetY);
  u.color1.value.set(params.color1);
  u.color2.value.set(params.color2);
  u.color3.value.set(params.color3);

  useFrame((state) => {
    u.time.value = state.elapsed;
  });

  const { colorNode, opacityNode } = useMemo(() => {
    // --- the shape ------------------------------------------------------
    //
    // Blob centres live in *frame* space — a fraction of the width and height,
    // independent of aspect — so the composition holds whether this is the
    // closer's wide band on a desktop, the same section stacked tall on a
    // phone, or a full-screen demo. Aspect correction happens per-blob below,
    // on the distance, which is what keeps them round without moving them.
    const centred = uv().sub(0.5);

    // Scale, rotate and offset the sample point rather than the blobs — one
    // transform instead of three, and it composes.
    const s = centred.mul(u.scale);
    const c = cos(u.rotation);
    const sn = sin(u.rotation);
    const q = vec2(
      s.x.mul(c).sub(s.y.mul(sn)),
      s.x.mul(sn).add(s.y.mul(c)),
    ).sub(u.offset);

    /** x scaled to match y's physical size, so distances are circular. */
    const round = vec2(u.aspect, 1);
    const t = u.time.mul(u.speed).mul(0.06);

    // Low-frequency warp bends the whole field; the blobs ride on it rather
    // than each being animated separately. Sampled in corrected space so the
    // noise itself doesn't stretch with the viewport.
    const warp = mx_fractal_noise_float(
      vec3(q.mul(round).mul(0.9), t),
      3,
      2,
      0.5,
      1,
    );

    // Warp is added *after* correction — adding it before would stretch the
    // wobble horizontally along with everything else.
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
    const shape = blob(-0.26, -0.1, 0.6, 0.34)
      .add(blob(0.24, 0.16, 0.56, 0.3))
      .add(blob(0.04, -0.52, 0.42, 0.26).mul(0.8))
      .clamp(0, 1);

    // --- the grain ------------------------------------------------------
    //
    // Keyed to screen coordinates and, critically, with no time term: this
    // field never changes. The shape slides underneath a fixed sheet.
    const g = screenCoordinate.xy.div(u.grainSize);
    const fine = mx_noise_float(vec3(g.mul(0.5), 0));
    const mid = mx_noise_float(vec3(g.mul(0.2), 0));

    // Very low frequencies, so grain density clumps and thins across the frame
    // instead of sitting at one uniform level.
    //
    // These are remapped to *positive* on purpose. The original builds its fbm
    // by summing value noise sampled 0..1, so the sums are one-sided and
    // subtracting them pushes the result down. Using signed fractal noise here
    // instead leaves the subtraction positive half the time, the grain fires
    // almost everywhere, and the frame washes out to flat grey — which is
    // exactly what the first attempt did. Amplitudes match theirs: three
    // octaves from 0.2 falling by 0.6 sum to ~0.39.
    const positive = (n: ReturnType<typeof mx_noise_float>, amp: number) =>
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

    /** Signed: roughens band edges in both directions. */
    const distort = fine.mul(mid).sub(cloudA).sub(cloudB);
    /**
     * Clamped positive, and mostly zero — the subtraction leaves only the
     * peaks standing. That sparseness is what makes it read as grain rather
     * than as a fog sitting over everything.
     */
    const lift = fine.mul(0.75).sub(cloudC).clamp(0, 1);

    // The whole point — grain enters the field the ramp reads, so it inherits
    // the colour and brightness of wherever it lands.
    const field = shape
      .add(distort.add(0.5).mul(u.intensity).mul(2).div(STOPS))
      .add(lift.mul(u.noise).mul(10).div(STOPS));

    // --- the ramp -------------------------------------------------------
    //
    // fwidth keeps the band edges from aliasing into stair-steps once softness
    // is low enough for them to read as hard.
    const aa = fwidth(field);
    const v = field.sub(float(0.5).div(STOPS)).clamp(0, 1);

    /** Fades the whole thing out at the bottom of the ramp. */
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

    const ramp = mix(mix(u.color1, u.color2, edge(0)), u.color3, edge(1));

    return {
      colorNode: ramp,
      // Not premultiplied — three does the blend, so the colour stays full
      // strength and coverage drives alpha alone.
      opacityNode: coverage.mul(u.opacity),
    };
  }, [u]);

  return (
    <mesh scale={[viewport.width, viewport.height, 1]}>
      <planeGeometry args={[1, 1]} />
      <meshBasicNodeMaterial
        colorNode={colorNode}
        opacityNode={opacityNode}
        transparent
      />
    </mesh>
  );
}

/**
 * The same field tuned to sit behind a plain section.
 *
 * The defaults were dialled in against the closing CTA, where a city poster and
 * a black gradient sat between the field and the page — the gradient did half
 * the work of holding it down. Under the instructors there is nothing but the
 * background, and at full strength the field washes the section out and takes
 * the bios with it.
 *
 * So: a third of the alpha, the top ramp stop pulled well back from white, and
 * the blobs enlarged so it reads as one slow drift across the section rather
 * than as several competing lumps behind four columns of text.
 */
export const GRAIN_SECTION: GrainParams = {
  ...GRAIN_DEFAULTS,
  opacity: 0.2,
  scale: 0.72,
  speed: 0.6,
  color2: "#4a4a54",
  color3: "#8a8a96",
};

/** In-page version: a secondary canvas behind a section. */
export function NoiseFieldCanvas({
  params = GRAIN_SECTION,
}: {
  params?: GrainParams;
}) {
  return (
    <SectionCanvas
      className="absolute inset-0"
      orthographic
      camera={{ position: [0, 0, 10], zoom: 1 }}
      // Only the shape moves now, and slowly — this does not need 60.
      fps={30}
    >
      <GrainField params={params} />
    </SectionCanvas>
  );
}
