"use client";

import { useRef } from "react";

import { PlaceholderScene } from "@/app/home/components/canvas/placeholder-scene";
import { SectionCanvas } from "@/app/home/components/canvas/section-canvas";

import { CONNECTORS_SITE, type ConnectorsConfig } from "./config";

/** The backdrop to the closing CTA and the footer. */
export function ConnectorsCanvas({
  config = CONNECTORS_SITE,
}: {
  config?: ConnectorsConfig;
}) {
  const bounds = useRef<HTMLDivElement>(null);
  void config;

  return (
    <div ref={bounds} className="pointer-events-none absolute inset-0 z-10">
      <SectionCanvas
        className="absolute inset-0"
        camera={{ position: [0, 0, 15], fov: 26, near: 1, far: 40 }}
        fps={30}
      >
        <PlaceholderScene scale={2} />
      </SectionCanvas>
    </div>
  );
}
