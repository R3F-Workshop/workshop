"use client";

import { useRef } from "react";

import { SectionCanvas } from "@/components/three/section-canvas";

import { FLIP_GRID_SITE, type FlipGridConfig } from "./config";
import { FlipGridEnvironment } from "./environment";
import { FlipGrid } from "./flip-grid";

/**
 * The flip grid as a section backdrop.
 *
 * Self-contained on purpose: it owns the positioned wrapper as well as the
 * canvas, because that wrapper *is* the element the cursor is measured against.
 * Handing `FlipGrid` a `renderer.domElement` instead would give it the hero's
 * canvas — under a shared renderer that's whichever canvas rendered last — and
 * the cursor would map against the wrong rectangle. Sections shouldn't have to
 * know that, so the pairing lives here.
 */
export function FlipGridCanvas({
  config = FLIP_GRID_SITE,
}: {
  config?: FlipGridConfig;
}) {
  const bounds = useRef<HTMLDivElement>(null);

  return (
    <div ref={bounds} className="pointer-events-none absolute inset-0">
      <SectionCanvas
        className="absolute inset-0"
        orthographic
        camera={{ position: [0, 0, 10], zoom: 1 }}
        fps={40}
      >
        <FlipGridEnvironment config={config} />
        <FlipGrid
          key={`${config.cols}x${config.rows}`}
          config={config}
          bounds={bounds}
        />
      </SectionCanvas>
    </div>
  );
}
