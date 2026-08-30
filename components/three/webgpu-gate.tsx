"use client";

import type { ReactNode } from "react";

import { useWebGPU } from "@/lib/use-webgpu";

/**
 * The gate a standalone demo sits behind.
 *
 * Sections use `SceneSlot` instead, which keeps a poster underneath and fades a
 * scene in over it. A demo page has nothing but the scene, so when WebGPU is
 * missing it needs to say so rather than show an empty screen.
 *
 * Note `useWebGPU` also reports "no" for `prefers-reduced-motion`, which is
 * deliberate — every demo here animates continuously.
 */
export function WebGPUGate({ children }: { children: ReactNode }) {
  const support = useWebGPU();

  if (support === "checking") {
    return <div className="absolute inset-0 bg-background" />;
  }

  if (support === "no") {
    return (
      <div className="absolute inset-0 grid place-items-center px-6">
        <div className="max-w-[430px] text-center">
          <div className="font-mono text-[11px] tracking-[0.13em] text-faint uppercase">
            WebGPU required
          </div>
          <p className="mt-3 text-[15px] leading-[1.6] text-muted-foreground">
            These demos render through <code>WebGPURenderer</code> with no WebGL
            fallback, by design. Try a current Chrome, Edge, or Safari with
            hardware acceleration on — and note that reduced-motion settings
            also disable them, since they animate continuously.
          </p>
        </div>
      </div>
    );
  }

  return <>{children}</>;
}
