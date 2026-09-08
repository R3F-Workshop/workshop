"use client";

import { useEffect, useRef } from "react";

import { useWebGPU } from "@/lib/use-webgpu";
import { mountPyramid } from "./pyramid";

/**
 * The starter's pyramid in vanilla three.js. All of the three.js lives in
 * `pyramid.ts`. React owns the canvas element, the same one `<Canvas>` would
 * make for you, and one effect mounts the scene into it and disposes the
 * three.js resources on unmount.
 *
 * Editing `pyramid.ts` does not hot reload. Refresh the page.
 */
export function VanillaPyramid() {
  const ref = useRef<HTMLCanvasElement>(null);
  const support = useWebGPU();

  useEffect(() => {
    if (support !== "yes" || !ref.current) return;
    return mountPyramid(ref.current);
  }, [support]);

  // No WebGPU, no experience. The shell around this decides what to show instead.
  if (support !== "yes") return null;

  return <canvas ref={ref} className="absolute inset-0 block size-full" />;
}
