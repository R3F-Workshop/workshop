"use client";

import { useEffect, useState } from "react";

/** WebGPU capability gate. */

export type GpuSupport = "checking" | "yes" | "no";

/** Structural, so we don't pull in @webgpu/types for a single call. */
type MinimalGpu = { requestAdapter(): Promise<unknown> };

let cached: GpuSupport | null = null;
let inflight: Promise<GpuSupport> | null = null;

async function detect(): Promise<GpuSupport> {
  // `navigator.gpu` is missing entirely on browsers without WebGPU, and present but adapterless on some that have it (blocklisted GPU.
  try {
    const gpu = (navigator as unknown as { gpu?: MinimalGpu }).gpu;
    const adapter = gpu ? await gpu.requestAdapter() : null;
    return adapter ? "yes" : "no";
  } catch {
    return "no";
  }
}

export function detectWebGPU(): Promise<GpuSupport> {
  if (cached) return Promise.resolve(cached);
  inflight ??= detect().then((result) => {
    cached = result;
    inflight = null;
    return result;
  });
  return inflight;
}

/** Reasons to skip 3D that we know without touching the GPU. */
function optedOut(): boolean {
  // Reduced motion drops to the poster tier outright: cheaper than rendering a frozen scene, and it's what the user asked for.
  return (
    window.matchMedia("(prefers-reduced-motion: reduce)").matches ||
    new URLSearchParams(window.location.search).has("no3d")
  );
}

export function useWebGPU(): GpuSupport {
  const [support, setSupport] = useState<GpuSupport>(cached ?? "checking");

  useEffect(() => {
    let alive = true;

    // Deliberately async even for the synchronous opt-outs: resolving in a microtask keeps this out of the effect body.
    (async () => (optedOut() ? "no" : detectWebGPU()))().then((result) => {
      if (alive) setSupport(result);
    });

    return () => {
      alive = false;
    };
  }, []);

  return support;
}
