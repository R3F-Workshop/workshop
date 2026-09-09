import type { Metadata } from "next";

import { ControlsToggle } from "@/app/demos/components/controls-toggle";
import { TerrainSteps } from "@/app/demos/tsl-terrain/components/step-nav";

import { TerrainCompute } from "@/app/experiences/tsl-terrain";

export const metadata: Metadata = {
  title: "Compute — TSL terrain demo",
  description:
    "The noise moved into a compute pass that writes a storage texture once per dial change, sampled by the ground every frame.",
  robots: { index: false, follow: false },
};

export default function TerrainComputeDemoPage() {
  return (
    <main className="relative h-dvh w-full overflow-hidden bg-background">
      <TerrainCompute />
      <ControlsToggle />

      {/* Title plate. pointer-events-none so it never sits between the visitor
          and the scene. The plate has a ground of its own because the stage
          walls are off-white. */}
      <div className="pointer-events-none absolute top-5 left-5 z-30 max-w-[min(440px,calc(100vw-2.5rem))]">
        <div className="rounded-lg bg-background/70 px-4 py-3 backdrop-blur-sm">
          <div className="font-mono text-[11px] tracking-[0.13em] text-faint uppercase">
            Demo · terrain, one step at a time
          </div>
          <h1 className="mt-1.5 text-[22px] leading-[1.15] font-semibold tracking-[-0.03em] sm:text-[26px]">
            Bake it once
          </h1>
          <p className="mt-1.5 text-[13.5px] leading-[1.5] text-muted-foreground">
            The noise runs only when a dial moves, into a texture the ground samples every frame. Drag a slider and the counter adds one. Orbit and it adds none.
          </p>
          <TerrainSteps current="/demos/tsl-terrain/compute" />
        </div>
      </div>
    </main>
  );
}
