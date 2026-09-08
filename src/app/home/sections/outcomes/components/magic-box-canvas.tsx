"use client";

import { PlaceholderScene } from "@/app/home/components/canvas/placeholder-scene";
import { SectionCanvas } from "@/app/home/components/canvas/section-canvas";

/**
 * The card slot for the magic box.
 *
 * Starter: renders the placeholder. The finished experience is
 * `src/app/experiences/magic-box` (still fully working at /demos/magic-box).
 * Replace this component's body with `<MagicBox />` to bring it back.
 *
 * Stays `interactive` at 60fps because it is the one thing on the page you
 * can grab.
 */
export function MagicBoxCanvas({
  camera = { position: [-4.2, 2.0, 4.8], fov: 40 },
}: {
  camera?: { position: readonly [number, number, number]; fov: number };
} = {}) {
  return (
    <SectionCanvas interactive fps={60} camera={camera}>
      <color attach="background" args={["#0b0b0e"]} />
      <PlaceholderScene />
    </SectionCanvas>
  );
}
