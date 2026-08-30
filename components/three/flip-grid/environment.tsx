"use client";

import { EnvironmentMap } from "@react-three/fiber/webgpu";
import { useEffect, useMemo } from "react";

import type { FlipGridConfig } from "./config";
import { createStudioEnvironment, ENV_PRESETS } from "../studio-env";

/**
 * Builds the environment the gold reflects and hands it to the scene.
 *
 * Rebuilt whenever a light changes — cheap in itself, 256×128 of CPU float
 * maths, but three re-runs PMREM on the result, so it is deliberately not on
 * the per-frame path.
 */
export function FlipGridEnvironment({ config }: { config: FlipGridConfig }) {
  const texture = useMemo(() => {
    const preset = ENV_PRESETS[config.envPreset];
    // The three intensities are positional slots, not fixed roles: key/kick/fill
    // in the studio, sun/haze/bounce outdoors.
    const [a, b, c] = preset.softboxes;
    return createStudioEnvironment({
      ...preset,
      ground: hexToLinear(config.ground),
      sky: hexToLinear(config.sky),
      softboxes: [
        { ...a, intensity: config.keyIntensity },
        { ...b, intensity: config.kickIntensity },
        { ...c, intensity: config.fillIntensity },
      ],
    });
  }, [
    config.envPreset,
    config.ground,
    config.sky,
    config.keyIntensity,
    config.kickIntensity,
    config.fillIntensity,
  ]);

  // The generator allocates a new DataTexture each time; the old one holds a
  // GPU allocation until it's told to let go.
  useEffect(() => () => texture.dispose(), [texture]);

  return (
    <EnvironmentMap map={texture} environmentIntensity={config.envIntensity} />
  );
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
