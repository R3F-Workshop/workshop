"use client";

import { Canvas } from "@react-three/fiber/webgpu";

import {
  BlockCity,
  CITY_CAMERA,
} from "@/components/three/block-city/block-city";
import type { BlockCityConfig } from "@/components/three/block-city/config";
import { DepthAttachmentSync } from "@/components/three/depth-attachment-sync";

/**
 * The demo's own canvas. On the site this scene borrows the hero's renderer via
 * `SectionCanvas`; there is no hero here, so it declares an independent one.
 */
export function BlockCityScene({ config }: { config: BlockCityConfig }) {
  return (
    <Canvas
      camera={CITY_CAMERA}
      dpr={[1, 2]}
      // Odd/fractional drawing buffers desync the depth attachment from the
      // swap chain — see DepthAttachmentSync.
      forceEven
      renderer={{ alpha: false, antialias: true }}
      style={{ pointerEvents: "none" }}
    >
      <DepthAttachmentSync />
      <color attach="background" args={["#0a0c14"]} />
      {/* Remounting on a layout change is deliberate: the block set is
          generated once and the instance buffers are sized to it. */}
      <BlockCity
        key={`${config.cols}x${config.rows}-${config.spacing}`}
        config={config}
      />
    </Canvas>
  );
}
