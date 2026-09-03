"use client";

import { useFrame, useThree } from "@react-three/fiber/webgpu";
import { useEffect, useRef } from "react";

type Backend = { updateSize?: () => void };

/** Works around a three.js multi-canvas bug. */
export function DepthAttachmentSync() {
  const width = useThree((s) => s.size.width);
  const height = useThree((s) => s.size.height);
  const dpr = useThree((s) => s.viewport.dpr);
  const stale = useRef(true);

  useEffect(() => {
    stale.current = true;
  }, [width, height, dpr]);

  useFrame((state) => {
    if (!stale.current) return;
    stale.current = false;
    // `state.renderer` is typed as the WebGL/WebGPU union even on the /webgpu entry, and `backend` is internal to the WebGPU one.
    const backend = (state.renderer as unknown as { backend?: Backend })
      .backend;
    backend?.updateSize?.();
  });

  return null;
}
