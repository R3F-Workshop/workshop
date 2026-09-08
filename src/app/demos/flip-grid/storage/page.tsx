import type { Metadata } from "next";

import { ControlsToggle } from "@/app/demos/components/controls-toggle";
import { FlipGridSteps } from "@/app/demos/flip-grid/components/step-nav";

import { FlipGridStorage } from "@/app/experiences/flip-grid";

export const metadata: Metadata = {
  title: "Step 3: the angle in a storage buffer — R3F v10 demo",
  description: "The flip grid with its angle in a WebGPU storage buffer read by the vertex stage, still integrated on the CPU. Step three of the compute lesson.",
  robots: { index: false, follow: false },
};

export default function FlipGridStorageDemoPage() {
  return (
    <main className="relative h-dvh w-full overflow-hidden bg-background">
      <FlipGridStorage />
      <ControlsToggle />

      {/* Title plate. pointer-events-none so it never intercepts the cursor the
          grid is reading. */}
      <div className="pointer-events-none absolute top-5 left-5 z-30 max-w-[min(420px,calc(100vw-2.5rem))]">
        <div className="font-mono text-[11px] tracking-[0.13em] text-faint uppercase">
          Demo · the flip grid, built up
        </div>
        <h1 className="mt-1.5 text-[22px] leading-[1.15] font-semibold tracking-[-0.03em] sm:text-[26px]">
          Step 3: the angle in a storage buffer
        </h1>
        <p className="mt-1.5 text-[13.5px] leading-[1.5] text-muted-foreground">
          The vertex stage places and rotates every tile itself, reading its angle by instance index. The CPU still runs the loop, and uploads one float a tile.
        </p>
        <FlipGridSteps current="/demos/flip-grid/storage" />
      </div>
    </main>
  );
}
