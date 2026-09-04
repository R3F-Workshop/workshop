"use client";

import { useEffect, useRef } from "react";

import { WebGPUGate } from "@/app/demos/components/webgpu-gate";
import { mountPyramid } from "./pyramid";

/**
 * The React wrapper is the whole point of the comparison: one div, one
 * effect that mounts the vanilla scene and disposes it on unmount.
 *
 * No `next/dynamic` here. `three/webgpu` imports cleanly on the server; it is
 * only `@react-three/fiber/webgpu` that reaches for browser globals at import
 * time. The renderer itself is created inside the effect, which only runs in
 * the browser.
 */
function Mount() {
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!ref.current) return;
    return mountPyramid(ref.current);
  }, []);

  return <div ref={ref} className="absolute inset-0" />;
}

export function VanillaPyramid() {
  return (
    <WebGPUGate>
      <Mount />
    </WebGPUGate>
  );
}
