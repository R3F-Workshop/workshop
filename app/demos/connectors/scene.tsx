"use client";

import { Canvas } from "@react-three/fiber/webgpu";
import type { RefObject } from "react";
import { ACESFilmicToneMapping } from "three/webgpu";

import type { ConnectorsConfig } from "@/components/three/connectors/config";
import { ConnectorsScene } from "@/components/three/connectors/connectors";
import { DepthAttachmentSync } from "@/components/three/depth-attachment-sync";

/**
 * The demo's own canvas.
 *
 * On the site this scene mounts inside a `SectionCanvas` and borrows the hero's
 * renderer. There is no hero here, so the demo declares a plain independent
 * canvas — same scene, its own renderer.
 *
 * The camera is the original's: 17.5° at fifteen units back. A long lens on a
 * near-orthographic framing is most of why the pile reads as a diorama rather
 * than as objects flying at you.
 */
export function ConnectorsDemoScene({
  config,
  bounds,
}: {
  config: ConnectorsConfig;
  bounds: RefObject<HTMLElement | null>;
}) {
  return (
    <Canvas
      camera={{ position: [0, 0, 15], fov: 17.5, near: 1, far: 40 }}
      dpr={[1, 2]}
      // Odd/fractional drawing buffers desync the depth attachment from the
      // swap chain — see DepthAttachmentSync.
      forceEven
      renderer={{
        alpha: false,
        antialias: true,
        // The environment is HDR on purpose — softboxes sit well above 1 so the
        // glass and the metal have something with range to bend — and without a
        // tone map every one of them clips to flat white.
        toneMapping: ACESFilmicToneMapping,
      }}
      // The cursor is read off `window`, not from R3F's pointer events, so the
      // canvas has no reason to take them. Keeping it out of the way also means
      // the info dialog and the controls button stay clickable over it.
      style={{ pointerEvents: "none" }}
    >
      <color attach="background" args={["#08080a"]} />
      <DepthAttachmentSync />
      <ConnectorsScene config={config} bounds={bounds} />
    </Canvas>
  );
}
