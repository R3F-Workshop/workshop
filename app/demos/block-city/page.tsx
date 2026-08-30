import type { Metadata } from "next";
import Link from "next/link";

import { InfoDialog, InfoSection } from "@/components/demos/info-dialog";

import { BlockCityDemo } from "./block-city-demo";

export const metadata: Metadata = {
  title: "A city that builds itself — R3F v10 demo",
  description:
    "A few hundred instanced blocks rising out of the ground in a wave and settling. Deterministic layout, per-tier window maps, and a frame loop that stops paying for itself once everything has landed.",
  // A work-in-progress demo for an unannounced workshop; shareable by link, not
  // something search should surface yet.
  robots: { index: false, follow: false },
};

export default function BlockCityDemoPage() {
  return (
    <main className="relative h-dvh w-full overflow-hidden bg-background">
      <BlockCityDemo />

      {/* Title plate. pointer-events-none so it never intercepts the cursor. */}
      <div className="pointer-events-none absolute top-5 left-5 z-30 max-w-[min(430px,calc(100vw-2.5rem))]">
        <div className="font-mono text-[11px] tracking-[0.13em] text-faint uppercase">
          Demo · made with R3F v10
        </div>
        <h1 className="mt-1.5 text-[22px] leading-[1.15] font-semibold tracking-[-0.03em] sm:text-[26px]">
          A city that builds itself
        </h1>
        <p className="mt-1.5 text-[13.5px] leading-[1.5] text-muted-foreground">
          Reload to watch it go up again.
        </p>
      </div>

      <InfoDialog
        title="A city that builds itself"
        subtitle="React Three Fiber v10 · WebGPU · instancing"
      >
        <InfoSection heading="One draw call per height band">
          <p>
            A few hundred buildings, in three <code>InstancedMesh</code> groups
            rather than three hundred meshes. The bands are not an optimisation
            though — they exist because the window map has to repeat a different
            number of times on a four-storey block than on a twenty-storey one,
            and repeat is a property of the texture, not of the instance. Band
            by height and the windows stay roughly square instead of stretching
            with the building.
          </p>
        </InfoSection>

        <InfoSection heading="The layout is a hash, not an array">
          <p>
            Every block&apos;s position, footprint, height, shade and start time
            come out of a deterministic sin-hash of its index. Nothing is stored
            and nothing is random: the same city comes back every reload, and
            changing one dial regenerates all of it without a seed to thread
            through.
          </p>
          <p>
            The patch is trimmed to an ellipse with a ragged edge. A rectangular
            one shows its corners as two hard diagonals against the sky, which
            reads as a slab rather than a skyline thinning into haze.
          </p>
        </InfoSection>

        <InfoSection heading="Blocks grow, they do not fly in">
          <p>
            Each block scales up from zero height with its base pinned to the
            ground, rather than translating up from below. At zero it is flat
            and invisible, so nothing has to be hidden under a floor — which
            matters here, because there is no floor. A lit ground plane would
            draw a hard horizon straight across the frame; without one the
            rooflines are the horizon, and the city thins out into the sky.
          </p>
          <p>
            The rise overshoots slightly and settles. That is most of the
            difference between a block that arrives and a block that stops.
          </p>
        </InfoSection>

        <InfoSection heading="It stops paying for itself">
          <p>
            Writing a few hundred instance matrices every frame is cheap but not
            free, and once the last block has landed there is nothing left to
            write. Each band watches for that and latches: from then on the only
            per-frame work is the drift, which is one rotation on a group.
          </p>
        </InfoSection>

        <InfoSection heading="Try it">
          <p>
            Open the controls, top right. <strong>build</strong> spreads the
            wave out; <strong>rise</strong> changes how long any one block
            takes, and the two together decide whether it reads as a wave or a
            scatter. <strong>centreBias</strong> at 0 gives an even field with
            no downtown in it. <strong>windowLight</strong> is what carries the
            time of day.
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
