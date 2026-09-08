import type { Metadata } from "next";
import Link from "next/link";

import { ControlsToggle } from "@/app/demos/components/controls-toggle";
import { InfoDialog, InfoSection } from "@/app/demos/components/info-dialog";
import { DreiTrees } from "@/app/experiences/drei-trees";

export const metadata: Metadata = {
  title: "A forest, the drei way — R3F v10 demo",
  description:
    "Thousands of trees scattered over a hill with drei's surface sampler, drawn as one InstancedMesh through drei's Instances, swaying in a TSL shader that reads a per instance attribute.",
  robots: { index: false, follow: false },
};

export default function DreiTreesDemoPage() {
  return (
    <main className="relative h-dvh w-full overflow-hidden bg-background">
      <DreiTrees />
      <ControlsToggle />

      <div className="pointer-events-none absolute top-5 left-5 z-30 max-w-[min(430px,calc(100vw-2.5rem))]">
        <div className="font-mono text-[11px] tracking-[0.13em] text-black/50 uppercase">
          Demo · made with R3F v10
        </div>
        <h1 className="mt-1.5 text-[22px] leading-[1.15] font-semibold tracking-[-0.03em] text-black sm:text-[26px]">
          A forest, the drei way
        </h1>
        <p className="mt-1.5 text-[13.5px] leading-[1.5] text-black/55">
          One draw call. Drag to orbit, open the controls to change the count.
        </p>
      </div>

      <InfoDialog
        title="A forest, the drei way"
        subtitle="Instances · useSurfaceSampler · InstancedAttribute"
      >
        <InfoSection heading="Three imports">
          <p>
            <code>useSurfaceSampler</code> scatters points over the terrain
            mesh. <code>Instances</code> turns a list of{" "}
            <code>&lt;Tree&gt;</code> elements into one{" "}
            <code>InstancedMesh</code>, so the whole forest is a single draw
            call. <code>InstancedAttribute</code> adds a per tree{" "}
            <code>phase</code> float that the wind shader reads with{" "}
            <code>attribute(&quot;phase&quot;)</code>.
          </p>
        </InfoSection>

        <InfoSection heading="Where the trees are allowed">
          <p>
            The terrain carries a <code>weight</code> attribute, one float per
            vertex, that is zero inside the clearing and one outside with a
            short ramp between. The sampler weights every face by its three
            corners, so nothing lands in the middle and the edge is soft rather
            than a hard circle. Any mask you can paint into a vertex attribute
            works the same way: paths, water, a footprint.
          </p>
        </InfoSection>

        <InfoSection heading="What the shader sees">
          <p>
            The sway lives in the material&apos;s <code>positionNode</code>. It
            runs after the instance transform, so it reads{" "}
            <code>positionGeometry</code> for the raw cone height, zero at the
            base and one at the tip, and bends only the tip. The same node
            feeds the shadow pass, so the shadows sway too. The instance
            colour multiplies in on top of a height ramp that darkens the
            base.
          </p>
        </InfoSection>

        <InfoSection heading="What it costs">
          <p>
            Every frame, <code>Instances</code> walks its children, composes a
            matrix for each and uploads the buffer. That is the price of
            writing instances as JSX. For a static scene the <code>frames</code>{" "}
            prop caps it. For tens of thousands of moving things you write to
            the buffer yourself, which is what the Paris hero does.
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
            href="/demos/hero-simple"
            className="text-[13.5px] text-muted-foreground underline underline-offset-4 hover:text-foreground"
          >
            The hand written version
          </Link>
        </div>
      </InfoDialog>
    </main>
  );
}
