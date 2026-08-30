"use client";

import { Canvas } from "@react-three/fiber/webgpu";

import { DepthAttachmentSync } from "./depth-attachment-sync";
import { LevaPanel } from "./leva-panel";
import { BOX_CAMERA, MagicBoxScene } from "./magic-box";
import { WebGPUGate } from "./webgpu-gate";

/**
 * The magic box on its own page, as the *primary* canvas.
 *
 * On the marketing page this scene is a secondary canvas borrowing the hero's
 * renderer. There is no hero here, so it owns the renderer itself — same scene,
 * different host. That is the whole reason `MagicBoxScene` is separate from
 * `MagicBoxCanvas`.
 *
 * `id="main"` because a secondary canvas looks for a primary by that name; this
 * page has none, but keeping the id consistent means the scene can be dropped
 * next to one later without surprises.
 */
export function MagicBoxStandalone() {
  return (
    <WebGPUGate>
      <LevaPanel />
      <Canvas
        id="main"
        renderer={{
          alpha: false,
          antialias: true,
          powerPreference: "high-performance",
        }}
        dpr={[1, 2]}
        // Odd/fractional drawing buffers desync the depth attachment from the
        // swap chain — see DepthAttachmentSync.
        forceEven
        camera={BOX_CAMERA}
        style={{ touchAction: "none", cursor: "grab" }}
      >
        <MagicBoxScene />
        <DepthAttachmentSync />
      </Canvas>
    </WebGPUGate>
  );
}
