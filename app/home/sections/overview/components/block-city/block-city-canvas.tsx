"use client";

import { PlaceholderScene } from "@/app/home/components/canvas/placeholder-scene";
import { SectionCanvas } from "@/app/home/components/canvas/section-canvas";
import { CITY_CAMERA } from "./block-city";
import { BLOCK_CITY_SITE, type BlockCityConfig } from "./config";

/**
 * In-page version: a secondary canvas borrowing the hero's renderer.
 *
 * Starter: renders the placeholder where the block city goes. The finished
 * scene is `./block-city.tsx` (still fully working at /demos/block-city) —
 * swap `PlaceholderScene` for `<BlockCity config={config} />` to bring it
 * back. It wants the opaque `#0a0c14` background kept: the poster underneath
 * is pale and would show through as the sky.
 */
export function BlockCityCanvas({
  config = BLOCK_CITY_SITE,
}: {
  config?: BlockCityConfig;
} = {}) {
  void config;
  return (
    <SectionCanvas className="absolute inset-0" camera={CITY_CAMERA} fps={30}>
      <color attach="background" args={["#0a0c14"]} />
      <PlaceholderScene />
    </SectionCanvas>
  );
}
