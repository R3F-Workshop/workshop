import type { Metadata } from "next";
import Link from "next/link";

import { InfoDialog, InfoSection } from "@/components/demos/info-dialog";

import { BlendingCubeDemo } from "./blending-cube-demo";

export const metadata: Metadata = {
  title: "One box, four imports — R3F v10 demo",
  description:
    "A single mesh gaining one capability at a time: edges, contact shadows, metalness, and finally an environment to reflect. Built with React Three Fiber v10.",
  // A work-in-progress demo for an unannounced workshop; shareable by link, not
  // something search should surface yet.
  robots: { index: false, follow: false },
};

export default function BlendingCubeDemoPage() {
  return (
    <main className="relative h-dvh w-full overflow-hidden bg-background">
      <BlendingCubeDemo />

      {/* Title plate. pointer-events-none so it never intercepts the cursor. */}
      <div className="pointer-events-none absolute top-5 left-5 z-30 max-w-[min(420px,calc(100vw-2.5rem))]">
        <div className="font-mono text-[11px] tracking-[0.13em] text-faint uppercase">
          Demo · made with R3F v10
        </div>
        <h1 className="mt-1.5 text-[22px] leading-[1.15] font-semibold tracking-[-0.03em] sm:text-[26px]">
          One box, four imports
        </h1>
        <p className="mt-1.5 text-[13.5px] leading-[1.5] text-muted-foreground">
          Nothing is swapped out. Each stage only adds.
        </p>
      </div>

      <InfoDialog
        title="One box, four imports"
        subtitle="React Three Fiber v10 · WebGPU · drei"
      >
        <InfoSection heading="The same mesh the whole way through">
          <p>
            There is one <code>RoundedBox</code> on screen and it is never
            replaced. Every stage adds something around it — a drei component, a
            material property, a light — and the caption names whatever just
            arrived. That is the argument the card next to it makes: the
            ecosystem is not a set of things you rebuild, it is a set of things
            you reach for.
          </p>
        </InfoSection>

        <InfoSection heading="Why the metal goes black first">
          <p>
            Watch the fourth stage. <code>metalness</code> goes to 1 and the
            cube nearly disappears — because a fully metallic surface has no
            diffuse term. It has no colour of its own at all; it is only ever
            its reflection, and at that point there is nothing in the scene to
            reflect.
          </p>
          <p>
            The environment arrives in the fifth stage and the gold appears. The
            ordering is deliberate. &ldquo;Metal renders black without an
            environment&rdquo; is the single most common surprise when people
            first reach for a metallic material, and it is much easier to
            remember once you have watched it happen.
          </p>
        </InfoSection>

        <InfoSection heading="The environment is generated, not downloaded">
          <p>
            The HDR the cube reflects is rasterised at runtime — a ground-to-sky
            gradient with four soft-edged rectangles standing in for lights,
            written into an equirectangular float texture. They are spread around
            the azimuth, so a face is always sliding into or out of one as the
            cube turns. A still highlight reads as a gold-coloured
            surface; a travelling one reads as metal.
          </p>
          <p>
            It is the same generator the flip grid uses, retuned for a subject
            that rotates rather than a field of flat tiles.
          </p>
        </InfoSection>

        <InfoSection heading="Nothing here re-renders">
          <p>
            The whole loop runs by mutating refs inside <code>useFrame</code> —
            material colour, metalness, roughness, edge opacity, shadow opacity,
            and the scene&apos;s environment intensity. Driving it through React
            state would re-render the tree every frame for values that never
            reach the DOM.
          </p>
          <p>
            The one exception is the caption, which is DOM, and which updates
            only when the stage index changes.
          </p>
        </InfoSection>

        <InfoSection heading="Try it">
          <p>
            Open the controls, top right. <strong>envIntensity</strong> to 0
            holds the cube in the black-metal state permanently.{" "}
            <strong>metalRoughness</strong> upward turns the gold from polished
            to brushed, and past about 0.6 it stops reading as metal at all.{" "}
            <strong>stageSeconds</strong> slows the whole loop down if you want
            to sit on one stage.
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
