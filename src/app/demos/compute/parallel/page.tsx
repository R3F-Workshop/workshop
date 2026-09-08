import type { Metadata } from "next";

import { ControlsToggle } from "@/app/demos/components/controls-toggle";
import { InfoDialog, InfoSection } from "@/app/demos/components/info-dialog";
import { ComputeSteps } from "@/app/demos/compute/components/step-nav";

import { ComputeParallel } from "@/app/experiences/compute";

export const metadata: Metadata = {
  title: "Parallel — compute demo",
  description:
    "A million points built twice from the same maths, once in a for loop and once in a compute pass. The spinner shows which one blocked the page.",
  robots: { index: false, follow: false },
};

export default function ComputeParallelDemoPage() {
  return (
    <main className="relative h-dvh w-full overflow-hidden bg-background">
      <ComputeParallel />
      <ControlsToggle />

      {/* Title plate. pointer-events-none so it never sits between the visitor
          and the scene. */}
      <div className="pointer-events-none absolute top-5 left-5 z-30 max-w-[min(440px,calc(100vw-2.5rem))]">
        <div className="font-mono text-[11px] tracking-[0.13em] text-faint uppercase">
          Demo · compute, one reason at a time
        </div>
        <h1 className="mt-1.5 text-[22px] leading-[1.15] font-semibold tracking-[-0.03em] sm:text-[26px]">
          There is no loop
        </h1>
        <p className="mt-1.5 text-[13.5px] leading-[1.5] text-muted-foreground">
          A million points from one function. Open the controls and build them on the CPU, then on the GPU. Watch the spinner.
        </p>
        <ComputeSteps current="/demos/compute/parallel" />
      </div>

      <InfoDialog title="There is no loop" subtitle="compute · parallel">
        <InfoSection heading="Same maths, twice">
          <p>
            <code>fillOnCpu</code> is a <code>for</code> loop over a typed array.{" "}
            <code>build</code> is a TSL <code>Fn</code> dispatched a million
            times, with <code>instanceIndex</code> where the loop counter was.
            They are the same lines. Both write the same storage buffer, so the
            sprites cannot tell which one ran.
          </p>
        </InfoSection>
        <InfoSection heading="Where the time goes">
          <p>
            The CPU build blocks the main thread for as long as it takes, and
            the CSS spinner in the corner stops with it. The GPU build is a
            dispatch: the main thread is free a fraction of a millisecond later
            and the work happens somewhere else. That is the whole argument for
            compute, before any of the clever parts.
          </p>
        </InfoSection>
        <InfoSection heading="Nothing per frame">
          <p>
            The points are built once and then only drawn. Compute is not
            always a per frame thing. Sometimes it is a faster way to fill a
            buffer.
          </p>
        </InfoSection>
      </InfoDialog>
    </main>
  );
}
