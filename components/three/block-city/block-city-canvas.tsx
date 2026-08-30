"use client";

import { SectionCanvas } from "../section-canvas";
import { BlockCity, CITY_CAMERA } from "./block-city";
import { BLOCK_CITY_SITE, type BlockCityConfig } from "./config";

/**
 * In-page version: a secondary canvas borrowing the hero's renderer.
 *
 * Opaque, and it has to be. It sits in a `SceneSlot` over the concept poster,
 * which is a pale frame — left transparent, that poster shows through as the
 * sky and fights the dark city in front of it. The poster is a fallback for
 * when there is no WebGPU, not a backdrop for when there is.
 */
export function BlockCityCanvas({
  config = BLOCK_CITY_SITE,
}: {
  config?: BlockCityConfig;
} = {}) {
  return (
    <SectionCanvas className="absolute inset-0" camera={CITY_CAMERA} fps={30}>
      <color attach="background" args={["#0a0c14"]} />
      <BlockCity config={config} />
    </SectionCanvas>
  );
}
