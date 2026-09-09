import type { Metadata } from "next";

import { ControlsToggle } from "@/app/demos/components/controls-toggle";
import { TerrainSteps } from "@/app/demos/tsl-terrain/components/step-nav";

import { TerrainAirplane } from "@/app/experiences/tsl-terrain";

export const metadata: Metadata = {
  title: "Airplane — TSL terrain demo",
  description:
    "An airplane whose circuit the CPU drives and whose altitude the vertex shader samples from the baked map, with a shadow that hugs the slope.",
  robots: { index: false, follow: false },
};

export default function TerrainAirplaneDemoPage() {
  return (
    <main className="relative h-dvh w-full overflow-hidden bg-background">
      <TerrainAirplane />
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
            One value, shared
          </h1>
          <p className="mt-1.5 text-[13.5px] leading-[1.5] text-muted-foreground">
            The CPU flies the circuit and writes one uniform. The shader samples the map there for the altitude, and the shadow samples per vertex. The CPU never reads a height.
          </p>
          <TerrainSteps current="/demos/tsl-terrain/airplane" />
        </div>
      </div>
    </main>
  );
}
