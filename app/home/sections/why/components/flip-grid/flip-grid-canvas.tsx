"use client";

import { useRef } from "react";

import { PlaceholderScene } from "@/app/home/components/canvas/placeholder-scene";
import { SectionCanvas } from "@/app/home/components/canvas/section-canvas";

import { FLIP_GRID_SITE, type FlipGridConfig } from "./config";

/** The flip grid slot as a section backdrop. */
export function FlipGridCanvas({
  config = FLIP_GRID_SITE,
}: {
  config?: FlipGridConfig;
}) {
  const bounds = useRef<HTMLDivElement>(null);
  void config;

  return (
    <div ref={bounds} className="pointer-events-none absolute inset-0">
      <SectionCanvas
        className="absolute inset-0"
        orthographic
        camera={{ position: [0, 0, 10], zoom: 1 }}
        fps={40}
      >
        <PlaceholderScene scale={140} />
      </SectionCanvas>
    </div>
  );
}
