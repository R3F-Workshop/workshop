"use client";

import { Canvas } from "@react-three/fiber/webgpu";

import { DepthAttachmentSync } from "@/components/three/depth-attachment-sync";
import type { TakehomeGridConfig } from "@/components/three/takehome-grid/config";
import {
  TAKEHOME_CAMERA,
  TakehomeGrid,
} from "@/components/three/takehome-grid/takehome-grid";

/**
 * The demo's own canvas. On the site this scene borrows the hero's renderer via
 * `SectionCanvas`; there is no hero here, so it declares an independent one.
 */
export function TakehomeGridScene({ config }: { config: TakehomeGridConfig }) {
  return (
    <Canvas
      camera={TAKEHOME_CAMERA}
      dpr={[1, 2]}
      // Odd/fractional drawing buffers desync the depth attachment from the
      // swap chain — see DepthAttachmentSync.
      forceEven
      renderer={{ alpha: false, antialias: true }}
      style={{ pointerEvents: "none" }}
    >
      <DepthAttachmentSync />
      <color attach="background" args={["#08080a"]} />
      {/* Remounting on a grid-size change is deliberate: the label textures are
          built per tile, and rebuilding the rank is simpler to reason about
          than reconciling them in place. */}
      <TakehomeGrid key={`${config.cols}x${config.rows}`} config={config} />
    </Canvas>
  );
}
