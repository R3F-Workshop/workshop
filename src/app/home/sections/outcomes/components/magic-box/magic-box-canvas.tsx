"use client";

import { PlaceholderScene } from "@/app/home/components/canvas/placeholder-scene";
import { SectionCanvas } from "@/app/home/components/canvas/section-canvas";

/** Same framing the finished box uses — see BOX_CAMERA in magic-box.tsx. */
const CAMERA = { position: [-4.2, 2.0, 4.8] as const, fov: 40 };

/**
 * In-page slot for the magic box: a secondary canvas borrowing the hero's
 * renderer.
 *
 * Starter: renders the placeholder. The finished scene is `./magic-box.tsx`
 * (still fully working at /demos/magic-box) — its own `MagicBoxCanvas` export
 * is the drop-in replacement: repoint the dynamic import in `./scenes.tsx`
 * back at it and delete this file. It keeps `interactive` + 60fps because it
 * is the one thing on the page you can grab.
 */
export function MagicBoxCanvas({
  camera = CAMERA,
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
