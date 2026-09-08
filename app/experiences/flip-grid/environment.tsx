"use client";

import { EnvironmentMap } from "@react-three/fiber/webgpu";
import { useEffect, useMemo } from "react";

import {
  createStudioEnvironment,
  ENV_PRESETS,
  type EnvPreset,
} from "@/app/home/components/canvas/studio-env";

/**
 * The environment the gold reflects.
 *
 * Metal is nothing but its reflection: a fully metallic surface has no
 * diffuse term, so gold with nothing to reflect renders black. This builds a
 * small HDR equirect at runtime and hands it to the scene as image based
 * lighting. Every version of the flip grid mounts it, which is why it lives
 * in its own file.
 *
 * Rebuilt whenever a light changes. Cheap in itself, 256 by 128 of CPU float
 * maths, but three re-runs PMREM on the result, so it is deliberately not on
 * the per-frame path. The defaults match the flip grid panel, so the lesson
 * steps can mount it with no props.
 */
export function Environment({
  preset = "outdoor",
  ground = "#2a2018",
  sky = "#6f83ad",
  keyIntensity = 55,
  kickIntensity = 2.2,
  fillIntensity = 0.5,
  intensity = 1,
}: {
  /** Outdoor's hard horizon suits flat tiles. */
  preset?: EnvPreset;
  ground?: string;
  sky?: string;
  /** Linear radiance, so values well above 1 are expected. */
  keyIntensity?: number;
  kickIntensity?: number;
  fillIntensity?: number;
  /** Multiplier on the environment as a whole. */
  intensity?: number;
}) {
  const texture = useMemo(() => {
    const options = ENV_PRESETS[preset];
    // The three intensities are positional slots, not fixed roles: key/kick/fill
    // in the studio, sun/haze/bounce outdoors.
    const [a, b, c] = options.softboxes;
    return createStudioEnvironment({
      ...options,
      ground: hexToLinear(ground),
      sky: hexToLinear(sky),
      softboxes: [
        { ...a, intensity: keyIntensity },
        { ...b, intensity: kickIntensity },
        { ...c, intensity: fillIntensity },
      ],
    });
  }, [preset, ground, sky, keyIntensity, kickIntensity, fillIntensity]);

  // The generator allocates a new DataTexture each time; the old one holds a
  // GPU allocation until it's told to let go.
  useEffect(() => () => texture.dispose(), [texture]);

  return <EnvironmentMap map={texture} environmentIntensity={intensity} />;
}

/** sRGB hex to the linear triplet the environment builder works in. */
function hexToLinear(hex: string): [number, number, number] {
  const n = parseInt(hex.replace("#", ""), 16);
  const toLinear = (c: number) =>
    c <= 0.04045 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4);
  return [
    toLinear(((n >> 16) & 255) / 255),
    toLinear(((n >> 8) & 255) / 255),
    toLinear((n & 255) / 255),
  ];
}
