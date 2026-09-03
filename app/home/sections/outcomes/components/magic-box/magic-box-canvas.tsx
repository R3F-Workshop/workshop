"use client";

import { PlaceholderScene } from "@/app/home/components/canvas/placeholder-scene";
import { SectionCanvas } from "@/app/home/components/canvas/section-canvas";

/** Same framing the finished box uses: see BOX_CAMERA in magic-box.tsx. */
const CAMERA = { position: [-4.2, 2.0, 4.8] as const, fov: 40 };

/** In-page slot for the magic box: a secondary canvas borrowing the hero's renderer. */
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
