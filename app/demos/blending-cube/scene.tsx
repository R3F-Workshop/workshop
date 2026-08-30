"use client";

import { Canvas } from "@react-three/fiber/webgpu";
import { ACESFilmicToneMapping } from "three/webgpu";

import {
  BlendingCubeScene,
  CUBE_CAMERA,
} from "@/components/three/blending-cube/blending-cube";
import type { BlendingCubeConfig } from "@/components/three/blending-cube/config";
import { DepthAttachmentSync } from "@/components/three/depth-attachment-sync";

/**
 * The demo's own canvas.
 *
 * On the site this scene mounts inside a `SectionCanvas` and borrows the hero's
 * renderer. There is no hero here, so the demo declares a plain independent one.
 */
export function BlendingCubeCanvasScene({
  config,
  onStage,
}: {
  config: BlendingCubeConfig;
  onStage?: (index: number) => void;
}) {
  return (
    <Canvas
      camera={CUBE_CAMERA}
      dpr={[1, 2]}
      // Odd/fractional drawing buffers desync the depth attachment from the
      // swap chain — see DepthAttachmentSync.
      forceEven
      renderer={{
        alpha: false,
        antialias: true,
        // Stated explicitly because the scene depends on it: the environment is
        // HDR, with softboxes well above 1 so the metal stage has something with
        // range to reflect, and without a tone map they clip to flat white.
        toneMapping: ACESFilmicToneMapping,
      }}
      style={{ pointerEvents: "none" }}
    >
      <DepthAttachmentSync />
      <color attach="background" args={["#08080a"]} />
      <BlendingCubeScene config={config} onStage={onStage} />
    </Canvas>
  );
}
