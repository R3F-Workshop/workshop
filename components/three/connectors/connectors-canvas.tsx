"use client";

import { useRef } from "react";

import { PlaceholderScene } from "@/components/three/placeholder-scene";
import { SectionCanvas } from "@/components/three/section-canvas";

import { CONNECTORS_SITE, type ConnectorsConfig } from "./config";

/**
 * The backdrop to the closing CTA and the footer.
 *
 * Self-contained: it owns the positioned wrapper as well as the canvas,
 * because the finished physics scene measures the cursor against that wrapper
 * (read off `window`, never R3F pointer events — the register button and
 * footer links above must stay clickable, hence `pointer-events: none`
 * throughout).
 *
 * Starter: renders the placeholder. The finished rapier scene is
 * `./connectors.tsx` (still fully working at /demos/connectors) — swap in
 * `<ConnectorsScene config={config} bounds={bounds} />` to bring it back.
 */
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
