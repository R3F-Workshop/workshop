"use client";

import { PlaceholderScene } from "@/app/home/components/canvas/placeholder-scene";
import { SectionCanvas } from "@/app/home/components/canvas/section-canvas";

/**
 * The card slot for the blending cube.
 *
 * Starter: renders the placeholder. The finished experience is
 * `app/experiences/blending-cube` (still fully working at /demos/blending-cube).
 * Replace this component's body with `<BlendingCube />` to bring it back.
 */
export function BlendingCubeCanvas({
  camera = { position: [3.9, 2.7, 4.8], fov: 30 },
}: {
  camera?: { position: readonly [number, number, number]; fov: number };
} = {}) {
  return (
    <SectionCanvas camera={camera} fps={30}>
      <color attach="background" args={["#0b0b0e"]} />
      <PlaceholderScene />
    </SectionCanvas>
  );
}
