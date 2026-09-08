import type { Metadata } from "next";

import { ControlsToggle } from "@/app/demos/components/controls-toggle";
import { FlipGridSteps } from "@/app/demos/flip-grid/components/step-nav";

import { FlipGridInstanced } from "@/app/experiences/flip-grid";

export const metadata: Metadata = {
  title: "Step 2: one instanced mesh — R3F v10 demo",
  description: "The flip grid as one InstancedMesh with a JavaScript integrator writing instance matrices. Step two of the compute lesson.",
  robots: { index: false, follow: false },
};

export default function FlipGridInstancedDemoPage() {
  return (
    <main className="relative h-dvh w-full overflow-hidden bg-background">
      <FlipGridInstanced />
      <ControlsToggle />

      {/* Title plate. pointer-events-none so it never intercepts the cursor the
          grid is reading. */}
      <div className="pointer-events-none absolute top-5 left-5 z-30 max-w-[min(420px,calc(100vw-2.5rem))]">
        <div className="font-mono text-[11px] tracking-[0.13em] text-faint uppercase">
          Demo · the flip grid, built up
        </div>
        <h1 className="mt-1.5 text-[22px] leading-[1.15] font-semibold tracking-[-0.03em] sm:text-[26px]">
          Step 2: one instanced mesh
        </h1>
        <p className="mt-1.5 text-[13.5px] leading-[1.5] text-muted-foreground">
          Same loop, same state. The output is a matrix per tile instead of a mesh. Scales to the full grid, at sixteen floats a tile a frame.
        </p>
        <FlipGridSteps current="/demos/flip-grid/instanced" />
      </div>
    </main>
  );
}
