import type { Metadata } from "next";

import { ControlsToggle } from "@/app/demos/components/controls-toggle";
import { TerrainSteps } from "@/app/demos/tsl-terrain/components/step-nav";

import { TerrainVertex } from "@/app/experiences/tsl-terrain";

export const metadata: Metadata = {
  title: "Vertex — TSL terrain demo",
  description:
    "A flat plane displaced by fractal noise in the vertex shader, with a normal from two more samples, every vertex every frame.",
  robots: { index: false, follow: false },
};

export default function TerrainVertexDemoPage() {
  return (
    <main className="relative h-dvh w-full overflow-hidden bg-background">
      <TerrainVertex />
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
            Noise in the vertex stage
          </h1>
          <p className="mt-1.5 text-[13.5px] leading-[1.5] text-muted-foreground">
            The usual terrain shader. Every vertex evaluates the noise three times, every frame, for a landscape that never moves.
          </p>
          <TerrainSteps current="/demos/tsl-terrain/vertex" />
        </div>
      </div>
    </main>
  );
}
