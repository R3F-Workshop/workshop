import type { Metadata } from "next";

import { ControlsToggle } from "@/app/demos/components/controls-toggle";
import { MaterialsSteps } from "@/app/demos/tsl-materials/components/step-nav";

import { MaterialsMix } from "@/app/experiences/tsl-materials";

export const metadata: Metadata = {
  title: "Mix — R3F v10 demo",
  description: "useUniforms and useNodes feeding one standard node material on the shared stage.",
  robots: { index: false, follow: false },
};

export default function MaterialsMixDemoPage() {
  return (
    <main className="relative h-dvh w-full overflow-hidden bg-background">
      <MaterialsMix />
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
            Mix
          </h1>
          <p className="mt-1.5 text-[13.5px] leading-[1.5] text-muted-foreground">
            Two colours and a blend become uniforms, useNodes mixes them once, and the material takes the graph as a prop.
          </p>
          <MaterialsSteps current="/demos/tsl-materials/mix" />
        </div>
      </div>
    </main>
  );
}
