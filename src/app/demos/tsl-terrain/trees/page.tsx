import type { Metadata } from "next";

import { ControlsToggle } from "@/app/demos/components/controls-toggle";
import { TerrainSteps } from "@/app/demos/tsl-terrain/components/step-nav";

import { TerrainTrees } from "@/app/experiences/tsl-terrain";

export const metadata: Metadata = {
  title: "Trees — TSL terrain demo",
  description:
    "Two thousand instanced cones placed on the baked heightmap by the GPU, dropped where the ground is wet, high or steep.",
  robots: { index: false, follow: false },
};

export default function TerrainTreesDemoPage() {
  return (
    <main className="relative h-dvh w-full overflow-hidden bg-background">
      <TerrainTrees />
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
            Two thousand readers
          </h1>
          <p className="mt-1.5 text-[13.5px] leading-[1.5] text-muted-foreground">
            Two thousand cones sample the same texture to find their footing, and scale to nothing where it is too wet, too high or too steep. None of them know what noise is.
          </p>
          <TerrainSteps current="/demos/tsl-terrain/trees" />
        </div>
      </div>
    </main>
  );
}
