import type { Metadata } from "next";
import Link from "next/link";

import { InfoDialog, InfoSection } from "@/components/demos/info-dialog";

import { TakehomeGridDemo } from "./takehome-grid-demo";

export const metadata: Metadata = {
  title: "A directory, turning over — R3F v10 demo",
  description:
    "Six tiles that turn one at a time to show what you leave with. The same effect as the flip grid, built the opposite way: no instancing, no storage buffer, no compute pass.",
  // A work-in-progress demo for an unannounced workshop; shareable by link, not
  // something search should surface yet.
  robots: { index: false, follow: false },
};

export default function TakehomeGridDemoPage() {
  return (
    <main className="relative h-dvh w-full overflow-hidden bg-background">
      <TakehomeGridDemo />

      {/* Title plate. pointer-events-none so it never intercepts the cursor. */}
      <div className="pointer-events-none absolute top-5 left-5 z-30 max-w-[min(430px,calc(100vw-2.5rem))]">
        <div className="font-mono text-[11px] tracking-[0.13em] text-faint uppercase">
          Demo · made with R3F v10
        </div>
        <h1 className="mt-1.5 text-[22px] leading-[1.15] font-semibold tracking-[-0.03em] sm:text-[26px]">
          A directory, turning over
        </h1>
        <p className="mt-1.5 text-[13.5px] leading-[1.5] text-muted-foreground">
          The tiles are the other demos on this site.
        </p>
      </div>

      <InfoDialog
        title="A directory, turning over"
        subtitle="React Three Fiber v10 · WebGPU"
      >
        <InfoSection heading="The same effect, built the opposite way">
          <p>
            This looks like a sibling of the flip grid in the workshop
            page&apos;s &ldquo;Why now&rdquo; section, and it shares almost none
            of its machinery. That grid runs about 1800 tiles whose angle,
            angular velocity and hold timer all depend on what the cursor did
            before now. There is nowhere to keep 1800 pieces of evolving state
            except the GPU, so it keeps them in a storage buffer and integrates
            them in a compute pass.
          </p>
          <p>
            This one has six tiles on a fixed timeline. Every angle is a pure
            function of the tile&apos;s index and the clock — no history, so
            nothing to store. Six meshes and a loop.
          </p>
          <p>
            That contrast is the useful part. The heavy machinery is not the
            grown-up version of this; it is the answer to a different question,
            and reaching for it here would be more code that ran slower.
          </p>
        </InfoSection>

        <InfoSection heading="Turning about Y, not X">
          <p>
            Either axis puts the far face toward the camera. A half turn about X
            also arrives upside down, which means drawing every label flipped to
            compensate. About Y it lands the right way up, and{" "}
            <code>BoxGeometry</code>&apos;s own per-face UVs put the texture the
            right way round without any help.
          </p>
        </InfoSection>

        <InfoSection heading="The labels are drawn, not loaded">
          <p>
            Each name is rendered into a 2D canvas and handed over as a{" "}
            <code>CanvasTexture</code>. That is not just convenience — loading
            them would mean <code>useTexture</code>, which suspends, and a
            promise thrown inside a Canvas gets re-thrown past it by its own
            Suspense fallback. The root unmounts and takes the scene with it.
            Building the texture synchronously sidesteps it.
          </p>
        </InfoSection>

        <InfoSection heading="Try it">
          <p>
            Open the controls, top right. <strong>stagger</strong> to 0 turns
            the whole rank at once and loses the sense of things being handed
            over one by one. <strong>overshoot</strong> is what makes a tile
            arrive rather than stop; at 0 the motion goes lifeless.{" "}
            <strong>thickness</strong> upward makes the edge visible mid-turn,
            which is what stops the flip reading as a crossfade.
          </p>
        </InfoSection>

        <div className="mt-7 flex flex-wrap gap-x-5 gap-y-2 border-t border-border pt-5">
          <Link
            href="/demos"
            className="text-[13.5px] text-muted-foreground underline underline-offset-4 hover:text-foreground"
          >
            All demos →
          </Link>
          <Link
            href="/"
            className="text-[13.5px] text-muted-foreground underline underline-offset-4 hover:text-foreground"
          >
            The workshop this was built for
          </Link>
        </div>
      </InfoDialog>
    </main>
  );
}
