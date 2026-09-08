"use client";

import { PlaceholderScene } from "@/app/home/components/canvas/placeholder-scene";
import { SectionCanvas } from "@/app/home/components/canvas/section-canvas";

/**
 * The Overview slot for the block city.
 *
 * Starter: renders the placeholder. The finished experience is
 * `src/app/experiences/block-city` (still fully working at /demos/block-city).
 * Replace this component's body with `<BlockCity />` to bring it back. It
 * paints its own opaque `#0a0c14` background, which matters here: the poster
 * underneath is pale and would show through as the sky.
 */
export function BlockCityCanvas({
  camera = { position: [0, 8.5, 66], fov: 26 },
}: {
  camera?: { position: readonly [number, number, number]; fov: number };
} = {}) {
  return (
    <SectionCanvas className="absolute inset-0" camera={camera} fps={30}>
      <color attach="background" args={["#0a0c14"]} />
      <PlaceholderScene />
    </SectionCanvas>
  );
}
