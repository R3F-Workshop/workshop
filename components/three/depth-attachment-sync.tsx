"use client";

import { useFrame, useThree } from "@react-three/fiber/webgpu";
import { useEffect, useRef } from "react";

type Backend = { updateSize?: () => void };

/**
 * Works around a three.js multi-canvas bug. Drop one inside every
 * `<Canvas>` that shares the renderer — including the primary.
 *
 * `WebGPUBackend._getDefaultRenderPassDescriptor` builds the depth-stencil
 * attachment view once per canvas and caches it on the renderer's per-canvas
 * data, rebuilding only when the sample count changes. The colour attachment,
 * by contrast, is pulled fresh from `context.getCurrentTexture()` every frame,
 * and the swap chain resizes with the canvas element automatically. So after a
 * resize the two disagree and every pass fails validation:
 *
 *   The depth stencil attachment ... size (width: 380, height: 149) does not
 *   match the size of the other attachments' base plane (... height: 148).
 *
 * Normally `Renderer._onCanvasTargetResize` clears that cache, but the listener
 * is attached to one canvas target at a time and `setCanvasTarget` moves it on
 * every swap. With several canvases sharing a renderer, only whichever one is
 * active can hear its own resize — every other one resizes silently and then
 * renders against a stale depth view forever. The primary is no safer than the
 * secondaries here; it loses the listener as soon as a section canvas draws.
 *
 * `backend.updateSize()` drops the cached descriptor for whatever canvas target
 * is currently active. R3F sets ours at the `start` phase of our own scheduler
 * slot, so inside our `useFrame` the active target is this canvas — which makes
 * this the one place we can invalidate our own entry without disturbing anyone
 * else's.
 *
 * Remove once three rebuilds the depth view per frame, or scopes the resize
 * listener per canvas target.
 */
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
    // `state.renderer` is typed as the WebGL/WebGPU union even on the /webgpu
    // entry, and `backend` is internal to the WebGPU one.
    const backend = (state.renderer as unknown as { backend?: Backend })
      .backend;
    backend?.updateSize?.();
  });

  return null;
}
