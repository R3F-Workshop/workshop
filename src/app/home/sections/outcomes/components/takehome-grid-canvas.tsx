"use client";

import { PlaceholderScene } from "@/app/home/components/canvas/placeholder-scene";
import { SectionCanvas } from "@/app/home/components/canvas/section-canvas";

/**
 * The card slot for the takehome grid.
 *
 * Opaque, like the other card slots. The label behind it would otherwise show
 * through.
 *
 * Starter: renders the placeholder. The finished experience is
 * `src/app/experiences/takehome-grid` (still fully working at /demos/takehome-grid).
 * Replace this component's body with `<TakehomeGrid />` to bring it back.
 */
export function TakehomeGridCanvas({
  camera = { position: [0, 0, 6], fov: 35 },
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
