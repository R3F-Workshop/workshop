import type { Metadata } from "next";

import { ControlsToggle } from "@/app/demos/components/controls-toggle";
import { InfoDialog, InfoSection } from "@/app/demos/components/info-dialog";
import { ComputeSteps } from "@/app/demos/compute/components/step-nav";

import { ComputePersist } from "@/app/experiences/compute";

export const metadata: Metadata = {
  title: "Persist — compute demo",
  description:
    "A fountain whose positions and velocities live in storage buffers. The CPU writes one timestep a frame and never sees a particle.",
  robots: { index: false, follow: false },
};

export default function ComputePersistDemoPage() {
  return (
    <main className="relative h-dvh w-full overflow-hidden bg-background">
      <ComputePersist />
      <ControlsToggle />

      {/* Title plate. pointer-events-none so it never sits between the visitor
          and the scene. */}
      <div className="pointer-events-none absolute top-5 left-5 z-30 max-w-[min(440px,calc(100vw-2.5rem))]">
        <div className="font-mono text-[11px] tracking-[0.13em] text-faint uppercase">
          Demo · compute, one reason at a time
        </div>
        <h1 className="mt-1.5 text-[22px] leading-[1.15] font-semibold tracking-[-0.03em] sm:text-[26px]">
          State the CPU never sees
        </h1>
        <p className="mt-1.5 text-[13.5px] leading-[1.5] text-muted-foreground">
          Thirty thousand particles with a position and a velocity each. Per frame the CPU writes one number, the timestep, and dispatches.
        </p>
        <ComputeSteps current="/demos/compute/persist" />
      </div>

      <InfoDialog title="State the CPU never sees" subtitle="compute · persist">
        <InfoSection heading="Two passes">
          <p>
            <code>init</code> runs once and hands every particle a launch.{" "}
            <code>update</code> runs every frame: gravity, the floor, and a
            relaunch when a particle has bounced itself to a stop. Both read and
            write the same two <code>instancedArray</code> buffers.
          </p>
        </InfoSection>
        <InfoSection heading="The whole frame loop">
          <p>
            <code>u.dt.value = delta</code> and{" "}
            <code>renderer.compute(update)</code>. That is all the CPU does,
            however many particles there are. A vertex shader can compute a
            position from time, but it cannot remember where the particle was
            last frame, so it cannot bounce. Memory is the reason.
          </p>
        </InfoSection>
        <InfoSection heading="Try it">
          <p>
            <strong>bounce</strong> up to 0.9 and the floor turns into a
            trampoline. <strong>reset</strong> re-dispatches <code>init</code>.
          </p>
        </InfoSection>
      </InfoDialog>
    </main>
  );
}
