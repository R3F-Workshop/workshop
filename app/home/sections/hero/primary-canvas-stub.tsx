"use client";

import { Canvas } from "@react-three/fiber/webgpu";

import { useWebGPU } from "@/lib/use-webgpu";

/**
 * A primary canvas that draws nothing.
 *
 * Every `SectionCanvas` waits on a canvas with `id="main"` to borrow its
 * renderer. The vanilla hero has no React Three Fiber canvas to offer, so this
 * two pixel one stands in. Delete it together with the vanilla hero when the
 * R3F hero takes over, since that one declares `id="main"` itself.
 */
export function PrimaryCanvasStub() {
  if (useWebGPU() !== "yes") return null;

  return (
    <Canvas
      id="main"
      dpr={1}
      renderer={{ alpha: true }}
      style={{
        position: "fixed",
        bottom: 0,
        left: 0,
        width: 2,
        height: 2,
        opacity: 0,
        pointerEvents: "none",
      }}
    />
  );
}
