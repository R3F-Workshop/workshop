"use client";

import { PlaceholderScene } from "@/app/home/components/canvas/placeholder-scene";
import { SectionCanvas } from "@/app/home/components/canvas/section-canvas";
import { CUBE_CAMERA } from "./blending-cube";
import { BLENDING_CUBE_SITE, type BlendingCubeConfig } from "./config";

/**
 * In-page version: a secondary canvas borrowing the hero's renderer.
 *
 * Opaque — it sits in a card slot with a label behind it, and compositing
 * over that label would leave text showing through.
 *
 * Starter: renders the placeholder. The finished scene is
 * `./blending-cube.tsx` (still fully working at /demos/blending-cube) — swap
 * in `<BlendingCubeScene config={config} />` to bring it back.
 */
export function BlendingCubeCanvas({
  config = BLENDING_CUBE_SITE,
  camera = CUBE_CAMERA,
}: {
  config?: BlendingCubeConfig;
  camera?: { position: readonly [number, number, number]; fov: number };
} = {}) {
  void config;
  return (
    <SectionCanvas camera={camera} fps={30}>
      <color attach="background" args={["#0b0b0e"]} />
      <PlaceholderScene />
    </SectionCanvas>
  );
}
