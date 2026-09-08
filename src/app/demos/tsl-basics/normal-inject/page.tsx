import type { Metadata } from "next";
import Link from "next/link";

import { ControlsToggle } from "@/app/demos/components/controls-toggle";
import { InfoDialog, InfoSection } from "@/app/demos/components/info-dialog";

import { NormalInject } from "@/app/experiences/tsl-basics";

export const metadata: Metadata = {
  title: "Injecting into a loaded material — R3F v10 demo",
  description:
    "The Khronos damaged helmet promoted to a node material, its normalNode replaced by a node that wraps materialNormal with a cursor ripple.",
  robots: { index: false, follow: false },
};

export default function NormalInjectDemoPage() {
  return (
    <main className="relative h-dvh w-full overflow-hidden bg-background">
      <NormalInject />
      <ControlsToggle />

      {/* Title plate. pointer-events-none so it never sits between the visitor
          and the scene. */}
      <div className="pointer-events-none absolute top-5 left-5 z-30 max-w-[min(440px,calc(100vw-2.5rem))]">
        <div className="font-mono text-[11px] tracking-[0.13em] text-faint uppercase">
          Demo · TSL basics in R3F v10
        </div>
        <h1 className="mt-1.5 text-[22px] leading-[1.15] font-semibold tracking-[-0.03em] sm:text-[26px]">
          Injecting into a loaded material
        </h1>
        <p className="mt-1.5 text-[13.5px] leading-[1.5] text-muted-foreground">
          The damaged helmet with the material the file gave it, normal map included. Its normalNode is swapped for one that takes materialNormal, the map the material already samples, and tilts it in rings around the cursor. Hover the helmet.
        </p>
      </div>

      <InfoDialog
        title="Injecting into a loaded material"
        subtitle="React Three Fiber v10 · WebGPU · TSL"
      >
        <InfoSection heading="Promote first">
          <p>
            The loader hands back a <code>MeshStandardMaterial</code>. It has no
            node slots. The WebGPU renderer converts it to a{" "}
            <code>MeshStandardNodeMaterial</code> the first time it draws it,
            which is why classic materials work at all under WebGPU. Doing that
            step yourself is one <code>&lt;meshStandardNodeMaterial&gt;</code>{" "}
            under the mesh and a <code>copy(loaded)</code> through its ref,
            which gives you a material with every property the file set and
            every node slot open.
          </p>
        </InfoSection>

        <InfoSection heading="Wrap, do not replace">
          <p>
            Each slot comes in a pair. <code>normalNode</code> is a prop here
            and overrides what the material would compute. <code>materialNormal</code> is what it
            would have computed, offered back as a node: the normal map
            sampled, unpacked and moved into view space. Build the new node out
            of the old one and the map keeps working. The same pair exists for
            colour, roughness, metalness, emissive and AO.
          </p>
        </InfoSection>

        <InfoSection heading="The cursor is a uniform">
          <p>
            <code>onPointerMove</code> on the mesh gives a world point. The
            handler moves it into the helmet&apos;s own space and writes it into a
            Vector3 that a uniform holds by reference, so the shader sees it on
            the next frame and React never re-renders. A second uniform eases
            toward 1 while hovering and back to 0 after, which is the fade.
          </p>
        </InfoSection>

        <InfoSection heading="Try it">
          <p>
            Open the controls, top right. <strong>inject</strong> off puts the
            material&apos;s own normal back, and the dents and panel lines are
            what the file&apos;s normal map was already doing.{" "}
            <strong>amplitude</strong> at 2 makes the tilt larger than the
            surface can honestly support, which is a good way to see that only
            the lighting moves.
          </p>
          <p>
            The model is the Khronos DamagedHelmet sample by theblueturtle_,
            CC BY-NC 4.0.
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
            href="/demos/tsl-hooks/uniform"
            className="text-[13.5px] text-muted-foreground underline underline-offset-4 hover:text-foreground"
          >
            The TSL hooks lesson
          </Link>
        </div>
      </InfoDialog>
    </main>
  );
}
