"use client";

import { SectionCanvas } from "../section-canvas";
import { BlendingCubeScene, CUBE_CAMERA } from "./blending-cube";
import { BLENDING_CUBE_SITE, type BlendingCubeConfig } from "./config";

/**
 * In-page version: a secondary canvas borrowing the hero's renderer.
 *
 * Opaque, like the magic box and unlike the backdrop canvases — it sits in a
 * card slot with a label behind it, and compositing over that label would
 * leave text showing through the cube.
 */
export function BlendingCubeCanvas({
  config = BLENDING_CUBE_SITE,
  camera = CUBE_CAMERA,
}: {
  config?: BlendingCubeConfig;
  camera?: { position: readonly [number, number, number]; fov: number };
} = {}) {
  return (
    <SectionCanvas camera={camera} fps={30}>
      <color attach="background" args={["#0b0b0e"]} />
      <BlendingCubeScene config={config} />
    </SectionCanvas>
  );
}
