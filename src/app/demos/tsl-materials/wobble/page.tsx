import type { Metadata } from "next";

import { ControlsToggle } from "@/app/demos/components/controls-toggle";
import { MaterialsSteps } from "@/app/demos/tsl-materials/components/step-nav";

import { MaterialsWobble } from "@/app/experiences/tsl-materials";

export const metadata: Metadata = {
  title: "Wobble — R3F v10 demo",
  description: "A TSL Fn displacing three meshes through positionNode, with named frame jobs paused from outside the Canvas.",
  robots: { index: false, follow: false },
};

export default function MaterialsWobbleDemoPage() {
  return (
    <main className="relative h-dvh w-full overflow-hidden bg-background">
      <MaterialsWobble />
      <ControlsToggle />

      {/* Title plate. pointer-events-none so it never sits between the visitor
          and the scene. The stage walls are off-white, so the plate carries
          its own ground for contrast. */}
      <div className="pointer-events-none absolute top-5 left-5 z-30 max-w-[min(440px,calc(100vw-2.5rem))]">
        <div className="rounded-lg bg-background/70 px-4 py-3 backdrop-blur-sm">
          <div className="font-mono text-[11px] tracking-[0.13em] text-faint uppercase">
            Demo · TSL materials in R3F v10
          </div>
          <h1 className="mt-1.5 text-[22px] leading-[1.15] font-semibold tracking-[-0.03em] sm:text-[26px]">
            Wobble
          </h1>
          <p className="mt-1.5 text-[13.5px] leading-[1.5] text-muted-foreground">
            One Fn called three times with three loop-owned phase uniforms displaces the meshes through positionNode. The buttons at the bottom pause each named job from plain React outside the Canvas.
          </p>
          <MaterialsSteps current="/demos/tsl-materials/wobble" />
        </div>
      </div>
    </main>
  );
}
