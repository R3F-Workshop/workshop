import type { Metadata } from "next";

import { ControlsToggle } from "@/app/demos/components/controls-toggle";
import { HooksSteps } from "@/app/demos/tsl-hooks/components/step-nav";

import { HooksShared } from "@/app/experiences/tsl-hooks";

export const metadata: Metadata = {
  title: "Shared uniforms — R3F v10 demo",
  description: "Several components sharing one scope of uniforms in the fiber store, including a value written every frame.",
  robots: { index: false, follow: false },
};

export default function HooksSharedDemoPage() {
  return (
    <main className="relative h-dvh w-full overflow-hidden bg-background">
      <HooksShared />
      <ControlsToggle />

      {/* Title plate. pointer-events-none so it never sits between the visitor
          and the scene. */}
      <div className="pointer-events-none absolute top-5 left-5 z-30 max-w-[min(440px,calc(100vw-2.5rem))]">
        <div className="font-mono text-[11px] tracking-[0.13em] text-faint uppercase">
          Demo · TSL hooks in R3F v10
        </div>
        <h1 className="mt-1.5 text-[22px] leading-[1.15] font-semibold tracking-[-0.03em] sm:text-[26px]">
          Shared uniforms
        </h1>
        <p className="mt-1.5 text-[13.5px] leading-[1.5] text-muted-foreground">
          One writer, three readers. The dials and a per-frame pulse go into one scope; three components with three materials read it. There is one copy of every number.
        </p>
        <HooksSteps current="/demos/tsl-hooks/shared" />
      </div>
    </main>
  );
}
