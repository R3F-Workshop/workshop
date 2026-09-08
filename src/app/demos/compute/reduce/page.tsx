import type { Metadata } from "next";

import { ControlsToggle } from "@/app/demos/components/controls-toggle";
import { InfoDialog, InfoSection } from "@/app/demos/components/info-dialog";
import { ComputeSteps } from "@/app/demos/compute/components/step-nav";

import { ComputeReduce } from "@/app/experiences/compute";

export const metadata: Metadata = {
  title: "Reduce — compute demo",
  description:
    "Sixty thousand points binned into a histogram with atomicAdd, drawn straight from the bins, and read back to the CPU a frame late.",
  robots: { index: false, follow: false },
};

export default function ComputeReduceDemoPage() {
  return (
    <main className="relative h-dvh w-full overflow-hidden bg-background">
      <ComputeReduce />
      <ControlsToggle />

      {/* Title plate. pointer-events-none so it never sits between the visitor
          and the scene. */}
      <div className="pointer-events-none absolute top-5 left-5 z-30 max-w-[min(440px,calc(100vw-2.5rem))]">
        <div className="font-mono text-[11px] tracking-[0.13em] text-faint uppercase">
          Demo · compute, one reason at a time
        </div>
        <h1 className="mt-1.5 text-[22px] leading-[1.15] font-semibold tracking-[-0.03em] sm:text-[26px]">
          Getting an answer back
        </h1>
        <p className="mt-1.5 text-[13.5px] leading-[1.5] text-muted-foreground">
          Many in, few out. The bars are summed on the GPU and drawn from the sum. The number in the corner is the same sum, read back, and late.
        </p>
        <ComputeSteps current="/demos/compute/reduce" />
      </div>

      <InfoDialog title="Getting an answer back" subtitle="compute · reduce">
        <InfoSection heading="Atomics">
          <p>
            Thousands of invocations add to forty eight counters at once. A
            plain <code>+=</code> would lose most of the increments to races,
            so the buffer is declared atomic and the pass uses{" "}
            <code>atomicAdd</code>. A tiny second pass copies the counts into a
            float buffer, because a vertex stage cannot read atomics, and the
            bars draw from that. Nothing was read back to draw them.
          </p>
        </InfoSection>
        <InfoSection heading="The round trip">
          <p>
            The readout is the same bins fetched with{" "}
            <code>getArrayBufferAsync</code>. It is correct, and it arrives a
            frame or two after the dispatch it belongs to. The readout says how
            many. Pushing work to the GPU is nearly free. Pulling an answer
            back is a round trip, so it goes in an async request that never
            blocks the loop, and only one is in flight at a time.
          </p>
        </InfoSection>
        <InfoSection heading="Why it matters">
          <p>
            This is the asymmetry that decides where data should live. If the
            CPU needs a number every frame, keep it on the CPU. If it needs it
            occasionally and can wait, read it back. If it never needs it, the
            GPU owns it and the other five demos apply.
          </p>
        </InfoSection>
      </InfoDialog>
    </main>
  );
}
