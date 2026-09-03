"use client";

import { PlaceholderScene } from "@/app/home/components/canvas/placeholder-scene";
import { SectionCanvas } from "@/app/home/components/canvas/section-canvas";
import { CITY_CAMERA } from "./block-city";
import { BLOCK_CITY_SITE, type BlockCityConfig } from "./config";

/** In-page version: a secondary canvas borrowing the hero's renderer. */
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
