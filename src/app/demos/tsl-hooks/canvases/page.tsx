import type { Metadata } from "next";

import { ControlsToggle } from "@/app/demos/components/controls-toggle";
import { HooksSteps } from "@/app/demos/tsl-hooks/components/step-nav";

import { HooksCanvases } from "@/app/experiences/tsl-hooks";

export const metadata: Metadata = {
  title: "Across canvases — R3F v10 demo",
  description: "Sharing uniforms between a primary canvas and a secondary one that borrows its renderer.",
  robots: { index: false, follow: false },
};

export default function HooksCanvasesDemoPage() {
  return (
    <main className="relative h-dvh w-full overflow-hidden bg-background">
      <HooksCanvases />
      <ControlsToggle />

      {/* Title plate. pointer-events-none so it never sits between the visitor
          and the scene. */}
      <div className="pointer-events-none absolute top-5 left-5 z-30 max-w-[min(440px,calc(100vw-2.5rem))]">
        <div className="font-mono text-[11px] tracking-[0.13em] text-faint uppercase">
          Demo · TSL hooks in R3F v10
        </div>
        <h1 className="mt-1.5 text-[22px] leading-[1.15] font-semibold tracking-[-0.03em] sm:text-[26px]">
          Across canvases
        </h1>
        <p className="mt-1.5 text-[13.5px] leading-[1.5] text-muted-foreground">
          Two canvases, one renderer, one store. The left declares the scope and writes the pulse; the right borrows the renderer and reads them, with no wiring between the two. This is how the sections of the site work.
        </p>
        <HooksSteps current="/demos/tsl-hooks/canvases" />
      </div>
    </main>
  );
}
