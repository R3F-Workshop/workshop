import type { Metadata } from "next";

import { ControlsToggle } from "@/app/demos/components/controls-toggle";
import { InfoDialog, InfoSection } from "@/app/demos/components/info-dialog";
import { ComputeSteps } from "@/app/demos/compute/components/step-nav";

import { ComputeNeighbors } from "@/app/experiences/compute";

export const metadata: Metadata = {
  title: "Neighbors — compute demo",
  description:
    "A sheet of water simulated on two ping-pong storage textures. Every texel reads the four around it, which is the one thing a vertex or fragment shader cannot do.",
  robots: { index: false, follow: false },
};

export default function ComputeNeighborsDemoPage() {
  return (
    <main className="relative h-dvh w-full overflow-hidden bg-background">
      <ComputeNeighbors />
      <ControlsToggle />

      {/* Title plate. pointer-events-none so it never intercepts the touches
          the sheet is reading. */}
      <div className="pointer-events-none absolute top-5 left-5 z-30 max-w-[min(440px,calc(100vw-2.5rem))]">
        <div className="font-mono text-[11px] tracking-[0.13em] text-faint uppercase">
          Demo · compute, one reason at a time
        </div>
        <h1 className="mt-1.5 text-[22px] leading-[1.15] font-semibold tracking-[-0.03em] sm:text-[26px]">
          Texels that read their neighbours
        </h1>
        <p className="mt-1.5 text-[13.5px] leading-[1.5] text-muted-foreground">
          Touch the water. Every texel&apos;s next height comes from the four around it, so a drop spreads.
        </p>
        <ComputeSteps current="/demos/compute/neighbors" />
      </div>

      <InfoDialog title="Texels that read their neighbours" subtitle="compute · neighbors">
        <InfoSection heading="The thing only compute can do">
          <p>
            Every demo before this had each index minding its own element. A
            wave needs each texel to read the four beside it, and a vertex or
            fragment shader sees only its own vertex or pixel. Compute can read
            anywhere.
          </p>
        </InfoSection>
        <InfoSection heading="Ping-pong">
          <p>
            A pass cannot read a texture it is also writing: a neighbour may
            already hold next frame&apos;s value by the time you look. So there
            are two textures. One pass reads A and writes B, the next reads B
            and writes A. Both run every frame, so the answer is always in A
            and the material only samples A. The other common shape is one
            pass a frame and swapping which texture is which.
          </p>
        </InfoSection>
        <InfoSection heading="Two heights in one texel">
          <p>
            Red is the height now, green is the height a frame ago. The next
            height is the neighbour average, pulled by momentum from the
            previous one, times a damping. Keeping the previous value beside
            the current one is what lets one texture carry a second order
            simulation. The textures are half float, because eight bit clamps
            to 0..1 and a wave has to go negative.
          </p>
        </InfoSection>
      </InfoDialog>
    </main>
  );
}
