"use client";

import { useRef } from "react";

import { SectionCanvas } from "@/components/three/section-canvas";

import { CONNECTORS_SITE, type ConnectorsConfig } from "./config";
import { ConnectorsScene } from "./connectors";

/**
 * The connectors container as the backdrop to the closing CTA and the footer.
 *
 * Self-contained like `FlipGridCanvas`, and for the same reason: it owns the
 * positioned wrapper as well as the canvas, because that wrapper *is* the
 * element the cursor is measured against. Under a shared renderer
 * `gl.domElement` is whichever canvas drew last, so a scene that looked the
 * canvas up would map the cursor against the wrong rectangle.
 *
 * `pointer-events: none` throughout — the register button and the footer links
 * sit on top of this and have to stay clickable, which is why the cursor is read
 * off `window` rather than from R3F's pointer events.
 */
export function ConnectorsCanvas({
  config = CONNECTORS_SITE,
}: {
  config?: ConnectorsConfig;
}) {
  const bounds = useRef<HTMLDivElement>(null);

  return (
    <div ref={bounds} className="pointer-events-none absolute inset-0 z-10">
      <SectionCanvas
        className="absolute inset-0"
        // Wider than the demo page's framing. The band behind the CTA is short
        // and very wide, and at the demo's 17.5° the pile fills it top to bottom
        // and crowds the headline.
        camera={{ position: [0, 0, 15], fov: 26, near: 1, far: 40 }}
        fps={30}
      >
        <ConnectorsScene config={config} bounds={bounds} />
      </SectionCanvas>
    </div>
  );
}
