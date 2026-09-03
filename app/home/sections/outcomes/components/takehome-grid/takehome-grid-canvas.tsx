"use client";

import { PlaceholderScene } from "@/app/home/components/canvas/placeholder-scene";
import { SectionCanvas } from "@/app/home/components/canvas/section-canvas";
import { TAKEHOME_GRID_SITE, type TakehomeGridConfig } from "./config";
import { TAKEHOME_CAMERA } from "./takehome-grid";

/** In-page version: a secondary canvas borrowing the hero's renderer. */
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
