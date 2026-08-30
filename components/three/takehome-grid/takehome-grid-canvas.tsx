"use client";

import { SectionCanvas } from "../section-canvas";
import { TAKEHOME_GRID_SITE, type TakehomeGridConfig } from "./config";
import { TAKEHOME_CAMERA, TakehomeGrid } from "./takehome-grid";

/**
 * In-page version: a secondary canvas borrowing the hero's renderer.
 *
 * Opaque, like the other card slots — the label behind it would otherwise show
 * through the tiles.
 */
export function TakehomeGridCanvas({
  config = TAKEHOME_GRID_SITE,
}: {
  config?: TakehomeGridConfig;
} = {}) {
  return (
    <SectionCanvas camera={TAKEHOME_CAMERA} fps={30}>
      <color attach="background" args={["#0b0b0e"]} />
      <TakehomeGrid config={config} />
    </SectionCanvas>
  );
}
