"use client";

import { useFrame, useThree } from "@react-three/fiber/webgpu";
import { useLayoutEffect, useRef } from "react";

type Backend = { updateSize?: () => void };
type Sizable = {
  backend?: Backend;
  setPixelRatio: (dpr: number) => void;
  setSize: (width: number, height: number, updateStyle?: boolean) => void;
};
type Internal = { actualRenderer?: Sizable; isSecondary?: boolean };

/** Works around a three.js multi-canvas bug, and an R3F v10 alpha 4 one. */
export function DepthAttachmentSync() {
  const width = useThree((s) => s.size.width);
  const height = useThree((s) => s.size.height);
  const dpr = useThree((s) => s.viewport.dpr);
  const get = useThree((s) => s.get);
  const stale = useRef(true);

  // Alpha 4 sizes only the canvas target when there is one, so a primary canvas with an id never sizes the renderer itself and its depth and resolve attachments stay at the default 300x150. Done before the first frame so the portal passes never see the mismatch.
  useLayoutEffect(() => {
    const state = get();
    const internal = state.internal as unknown as Internal;
    if (internal.isSecondary) return;
    const renderer =
      internal.actualRenderer ?? (state.renderer as unknown as Sizable);
    if (dpr > 0) renderer.setPixelRatio(dpr);
    renderer.setSize(width, height, false);
    stale.current = true;
  }, [get, width, height, dpr]);

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
