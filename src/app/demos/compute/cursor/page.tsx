import type { Metadata } from "next";

import { ControlsToggle } from "@/app/demos/components/controls-toggle";
import { InfoDialog, InfoSection } from "@/app/demos/components/info-dialog";
import { ComputeSteps } from "@/app/demos/compute/components/step-nav";

import { ComputeCursor } from "@/app/experiences/compute";

export const metadata: Metadata = {
  title: "Cursor — compute demo",
  description:
    "A grid of nine thousand cells that rise toward the cursor and remember it. One uniform in, one reaction per cell out.",
  robots: { index: false, follow: false },
};

export default function ComputeCursorDemoPage() {
  return (
    <main className="relative h-dvh w-full overflow-hidden bg-background">
      <ComputeCursor />
      <ControlsToggle />

      {/* Title plate. pointer-events-none so it never intercepts the cursor the
          grid is reading. */}
      <div className="pointer-events-none absolute top-5 left-5 z-30 max-w-[min(440px,calc(100vw-2.5rem))]">
        <div className="font-mono text-[11px] tracking-[0.13em] text-faint uppercase">
          Demo · compute, one reason at a time
        </div>
        <h1 className="mt-1.5 text-[22px] leading-[1.15] font-semibold tracking-[-0.03em] sm:text-[26px]">
          One cursor, nine thousand reactions
        </h1>
        <p className="mt-1.5 text-[13.5px] leading-[1.5] text-muted-foreground">
          Move over the grid. Each cell eases toward the cursor and remembers how far it got, so the trail lingers.
        </p>
        <ComputeSteps current="/demos/compute/cursor" />
      </div>

      <InfoDialog title="One cursor, nine thousand reactions" subtitle="compute · cursor">
        <InfoSection heading="The cheapest input there is">
          <p>
            The cursor is three floats in a uniform, written once a frame by
            an ordinary <code>onPointerMove</code>. Compute is what turns that
            into a response per cell: distance, target, ease.
          </p>
        </InfoSection>
        <InfoSection heading="Why it needs a buffer">
          <p>
            Each cell keeps one number, its lift, and eases it toward the target
            rather than jumping. That ease is memory. Without a buffer to hold
            last frame&apos;s lift the grid would snap to the cursor and snap
            back, and there would be no trail.
          </p>
        </InfoSection>
        <InfoSection heading="Try it">
          <p>
            <strong>jitter</strong> at 0 drags a clean wavefront. Turn it up
            and each cell eases at its own hashed speed, so the same sweep
            breaks into a ripple. One line, and the grid stops feeling like a
            tool and starts feeling like a material. <strong>height</strong>{" "}
            below zero sinks the cells instead.
          </p>
        </InfoSection>
      </InfoDialog>
    </main>
  );
}
