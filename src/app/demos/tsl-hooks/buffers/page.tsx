import type { Metadata } from "next";

import { ControlsToggle } from "@/app/demos/components/controls-toggle";
import { HooksSteps } from "@/app/demos/tsl-hooks/components/step-nav";

import { HooksBuffers } from "@/app/experiences/tsl-hooks";

export const metadata: Metadata = {
  title: "Buffers — R3F v10 demo",
  description: "useBuffers: an instanced attribute registered in the store, written every frame on the CPU, drawn in TSL and read back on the CPU.",
  robots: { index: false, follow: false },
};

export default function HooksBuffersDemoPage() {
  return (
    <main className="relative h-dvh w-full overflow-hidden bg-background">
      <HooksBuffers />
      <ControlsToggle />

      {/* Title plate. pointer-events-none so it never sits between the visitor
          and the scene. */}
      <div className="pointer-events-none absolute top-5 left-5 z-30 max-w-[min(440px,calc(100vw-2.5rem))]">
        <div className="font-mono text-[11px] tracking-[0.13em] text-faint uppercase">
          Demo · TSL hooks in R3F v10
        </div>
        <h1 className="mt-1.5 text-[22px] leading-[1.15] font-semibold tracking-[-0.03em] sm:text-[26px]">
          Buffers
        </h1>
        <p className="mt-1.5 text-[13.5px] leading-[1.5] text-muted-foreground">
          A CPU-owned array in the store, drawn as a thousand instances by the shader and read by the CPU for the marker. One flag per frame re-uploads it.
        </p>
        <HooksSteps current="/demos/tsl-hooks/buffers" />
      </div>
    </main>
  );
}
