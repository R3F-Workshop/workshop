"use client";

import { useRef } from "react";

import { PlaceholderScene } from "@/app/home/components/canvas/placeholder-scene";
import { SectionCanvas } from "@/app/home/components/canvas/section-canvas";

import { FLIP_GRID_SITE, type FlipGridConfig } from "./config";

/**
 * The flip grid slot as a section backdrop.
 *
 * Self-contained on purpose: it owns the positioned wrapper as well as the
 * canvas, because that wrapper *is* the element the finished scene measures
 * the cursor against (under a shared renderer, `renderer.domElement` is
 * whichever canvas drew last — see the note in the finished version).
 *
 * Starter: renders the placeholder. The finished scene is `./flip-grid.tsx`
 * (still fully working at /demos/flip-grid) — bring it back with
 * `<FlipGridEnvironment config={config} />` and
 * `<FlipGrid config={config} bounds={bounds} />`. The camera is orthographic
 * at zoom 1, so 1 unit ≈ 1 px — hence the placeholder's scale.
 */
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
