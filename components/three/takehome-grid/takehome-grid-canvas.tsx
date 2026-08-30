"use client";

import { PlaceholderScene } from "../placeholder-scene";
import { SectionCanvas } from "../section-canvas";
import { TAKEHOME_GRID_SITE, type TakehomeGridConfig } from "./config";
import { TAKEHOME_CAMERA } from "./takehome-grid";

/**
 * In-page version: a secondary canvas borrowing the hero's renderer.
 *
 * Opaque, like the other card slots — the label behind it would otherwise
 * show through.
 *
 * Starter: renders the placeholder. The finished scene is
 * `./takehome-grid.tsx` (still fully working at /demos/takehome-grid) — swap
 * in `<TakehomeGrid config={config} />` to bring it back.
 */
export function TakehomeGridCanvas({
  config = TAKEHOME_GRID_SITE,
}: {
  config?: TakehomeGridConfig;
} = {}) {
  void config;
  return (
    <SectionCanvas camera={TAKEHOME_CAMERA} fps={30}>
      <color attach="background" args={["#0b0b0e"]} />
      <PlaceholderScene />
    </SectionCanvas>
  );
}
