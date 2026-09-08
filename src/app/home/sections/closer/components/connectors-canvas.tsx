"use client";

import { PlaceholderScene } from "@/app/home/components/canvas/placeholder-scene";
import { SectionCanvas } from "@/app/home/components/canvas/section-canvas";

/**
 * The backdrop to the closing CTA and the footer.
 *
 * Self-contained: it owns the positioned wrapper as well as the canvas. The
 * register button and footer links above must stay clickable, hence
 * `pointer-events: none` throughout.
 *
 * Starter: renders the placeholder. The finished rapier experience is
 * `app/experiences/connectors` (still fully working at /demos/connectors).
 * Replace this component's body with `<Connectors />` to bring it back.
 */
export function ConnectorsCanvas() {
  return (
    <div className="pointer-events-none absolute inset-0 z-10">
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
