"use client";

import { Canvas } from "@react-three/fiber/webgpu";
import type { RefObject } from "react";
import { ACESFilmicToneMapping } from "three/webgpu";

import { DepthAttachmentSync } from "@/components/three/depth-attachment-sync";
import type { FlipGridConfig } from "@/components/three/flip-grid/config";
import { FlipGridEnvironment } from "@/components/three/flip-grid/environment";
import { FlipGrid } from "@/components/three/flip-grid/flip-grid";

/**
 * The demo's own canvas.
 *
 * On the site this scene mounts inside a `SectionCanvas`, which waits for the
 * hero to register as the primary and then borrows its renderer. There is no
 * hero here, so the demo declares a plain independent canvas — same scene, its
 * own renderer.
 */
export function FlipGridScene({
  config,
  bounds,
}: {
  config: FlipGridConfig;
  bounds: RefObject<HTMLElement | null>;
}) {
  return (
    <Canvas
      orthographic
      camera={{ position: [0, 0, 10], zoom: 1 }}
      dpr={[1, 2]}
      // Odd/fractional drawing buffers desync the depth attachment from the
      // swap chain — see DepthAttachmentSync.
      forceEven
      renderer={{
        alpha: true,
        antialias: true,
        // r3f already defaults to this; stated explicitly because the scene
        // depends on it. The environment is HDR on purpose — softboxes sit well
        // above 1 so a mirror-flat tile has something with range to reflect —
        // and without a tone map every one of them clips to flat white.
        toneMapping: ACESFilmicToneMapping,
      }}
      style={{ pointerEvents: "none" }}
    >
      <DepthAttachmentSync />
      <FlipGridEnvironment config={config} />
      {/* Remounting on a resolution change is deliberate: the storage buffer is
          sized to cols × rows, and tearing it down is far simpler to reason
          about than resizing it in place. */}
      <FlipGrid
        key={`${config.cols}x${config.rows}`}
        config={config}
        bounds={bounds}
      />
    </Canvas>
  );
}
