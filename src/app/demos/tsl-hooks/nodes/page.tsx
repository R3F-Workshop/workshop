import type { Metadata } from "next";

import { ControlsToggle } from "@/app/demos/components/controls-toggle";
import { HooksSteps } from "@/app/demos/tsl-hooks/components/step-nav";

import { HooksNodes } from "@/app/experiences/tsl-hooks";

export const metadata: Metadata = {
  title: "Shared nodes — R3F v10 demo",
  description: "useNodes registering a TSL function and a node graph that three materials share.",
  robots: { index: false, follow: false },
};

export default function HooksNodesDemoPage() {
  return (
    <main className="relative h-dvh w-full overflow-hidden bg-background">
      <HooksNodes />
      <ControlsToggle />

      {/* Title plate. pointer-events-none so it never sits between the visitor
          and the scene. */}
      <div className="pointer-events-none absolute top-5 left-5 z-30 max-w-[min(440px,calc(100vw-2.5rem))]">
        <div className="font-mono text-[11px] tracking-[0.13em] text-faint uppercase">
          Demo · TSL hooks in R3F v10
        </div>
        <h1 className="mt-1.5 text-[22px] leading-[1.15] font-semibold tracking-[-0.03em] sm:text-[26px]">
          Shared nodes
        </h1>
        <p className="mt-1.5 text-[13.5px] leading-[1.5] text-muted-foreground">
          Uniforms share values; useNodes shares graph. A palette function and a stripe graph are registered once, and three materials build themselves from them with different inputs.
        </p>
        <HooksSteps current="/demos/tsl-hooks/nodes" />
      </div>
    </main>
  );
}
