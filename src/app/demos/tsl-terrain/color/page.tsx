import type { Metadata } from "next";

import { ControlsToggle } from "@/app/demos/components/controls-toggle";
import { TerrainSteps } from "@/app/demos/tsl-terrain/components/step-nav";

import { TerrainColor } from "@/app/experiences/tsl-terrain";

export const metadata: Metadata = {
  title: "Color — TSL terrain demo",
  description:
    "The vertex terrain with a colour node: sand, grass, rock and snow banded over height and slope, and a water sheet at the water line.",
  robots: { index: false, follow: false },
};

export default function TerrainColorDemoPage() {
  return (
    <main className="relative h-dvh w-full overflow-hidden bg-background">
      <TerrainColor />
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
            Bands over height and slope
          </h1>
          <p className="mt-1.5 text-[13.5px] leading-[1.5] text-muted-foreground">
            Sand, grass, rock and snow from the same height the position wrote. One graph, read twice, and the fractal still runs three times per vertex.
          </p>
          <TerrainSteps current="/demos/tsl-terrain/color" />
        </div>
      </div>
    </main>
  );
}
