import type { Metadata } from "next";
import Link from "next/link";

import { InfoDialog, InfoSection } from "@/app/demos/components/info-dialog";

import { VanillaPyramid } from "@/app/experiences/vanilla-pyramid";

export const metadata: Metadata = {
  title: "The pyramid, in vanilla three.js — R3F v10 demo",
  description:
    "The starter's spinning pyramid built with three.js alone: renderer, scene, camera, loop, resize, and the raycaster ceremony for hover and click.",
  robots: { index: false, follow: false },
};

export default function VanillaPyramidPage() {
  return (
    <main className="relative h-dvh w-full overflow-hidden bg-background">
      <VanillaPyramid />

      <div className="pointer-events-none absolute top-5 left-5 z-30 max-w-[min(430px,calc(100vw-2.5rem))]">
        <div className="font-mono text-[11px] tracking-[0.13em] text-faint uppercase">
          Demo · vanilla three.js
        </div>
        <h1 className="mt-1.5 text-[22px] leading-[1.15] font-semibold tracking-[-0.03em] sm:text-[26px]">
          The pyramid, by hand
        </h1>
        <p className="mt-1.5 text-[13.5px] leading-[1.5] text-muted-foreground">
          Hover it, click it. Then count the lines.
        </p>
      </div>

      <InfoDialog title="The pyramid, by hand" subtitle="three.js · WebGPURenderer · Raycaster">
        <InfoSection heading="What it is">
          <p>
            The same pyramid the site starts with, built without React Three
            Fiber: a <code>WebGPURenderer</code>, a scene, a camera, three
            lights, one mesh, an animation loop, and a resize observer. All of
            it lives in <code>pyramid.ts</code>; the React file around it is a
            div and an effect.
          </p>
        </InfoSection>

        <InfoSection heading="The raycaster ceremony">
          <p>
            A <code>Raycaster</code>, a <code>Vector2</code> for the pointer,
            a conversion from pixels to normalized device coordinates on every
            move, <code>setFromCamera</code> and <code>intersectObject</code>,
            a hovered flag so the colour only changes when the answer changes,
            and a click that does the same and toggles an active flag. It is
            not wrong. It is what the browser gives you. Remember the shape of
            it.
          </p>
        </InfoSection>

        <div className="mt-7 flex flex-wrap gap-x-5 gap-y-2 border-t border-border pt-5">
          <Link
            href="/demos"
            className="text-[14px] text-foreground underline underline-offset-4"
          >
            All demos →
          </Link>
          <Link
            href="/"
            className="text-[14px] text-muted-foreground underline underline-offset-4"
          >
            The starter it copies
          </Link>
        </div>
      </InfoDialog>
    </main>
  );
}
