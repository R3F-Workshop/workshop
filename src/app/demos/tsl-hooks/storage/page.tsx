import type { Metadata } from "next";

import { ControlsToggle } from "@/app/demos/components/controls-toggle";
import { HooksSteps } from "@/app/demos/tsl-hooks/components/step-nav";

import { HooksStorage } from "@/app/experiences/tsl-hooks";

export const metadata: Metadata = {
  title: "Storage — R3F v10 demo",
  description: "useGPUStorage with a StorageTexture written by a compute pass and sampled by materials.",
  robots: { index: false, follow: false },
};

export default function HooksStorageDemoPage() {
  return (
    <main className="relative h-dvh w-full overflow-hidden bg-background">
      <HooksStorage />
      <ControlsToggle />

      {/* Title plate. pointer-events-none so it never sits between the visitor
          and the scene. */}
      <div className="pointer-events-none absolute top-5 left-5 z-30 max-w-[min(440px,calc(100vw-2.5rem))]">
        <div className="font-mono text-[11px] tracking-[0.13em] text-faint uppercase">
          Demo · TSL hooks in R3F v10
        </div>
        <h1 className="mt-1.5 text-[22px] leading-[1.15] font-semibold tracking-[-0.03em] sm:text-[26px]">
          Storage
        </h1>
        <p className="mt-1.5 text-[13.5px] leading-[1.5] text-muted-foreground">
          Data the GPU owns. A compute pass writes every texel of a storage texture each frame, and two materials sample it. The CPU sends three numbers and one dispatch.
        </p>
        <HooksSteps current="/demos/tsl-hooks/storage" />
      </div>
    </main>
  );
}
