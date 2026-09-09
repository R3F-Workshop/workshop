import type { Metadata } from "next";

import { ControlsToggle } from "@/app/demos/components/controls-toggle";
import { PostSteps } from "@/app/demos/tsl-post/components/step-nav";

import { PostSsgi } from "@/app/experiences/tsl-post";

export const metadata: Metadata = {
  title: "SSGI — R3F v10 demo",
  description:
    "Screen space global illumination and a denoiser, with its cost dials.",
  robots: { index: false, follow: false },
};

export default function PostSsgiDemoPage() {
  return (
    <main className="relative h-dvh w-full overflow-hidden bg-background">
      <PostSsgi />
      <ControlsToggle />

      {/* Title plate. pointer-events-none so it never sits between the visitor
          and the scene. */}
      <div className="pointer-events-none absolute top-5 left-5 z-30 max-w-[min(440px,calc(100vw-2.5rem))]">
        <div className="rounded-lg bg-background/70 px-4 py-3 backdrop-blur-sm">
          <div className="font-mono text-[11px] tracking-[0.13em] text-faint uppercase">
            Demo · TSL post processing in R3F v10
          </div>
          <h1 className="mt-1.5 text-[22px] leading-[1.15] font-semibold tracking-[-0.03em] sm:text-[26px]">
            SSGI
          </h1>
          <p className="mt-1.5 text-[13.5px] leading-[1.5] text-muted-foreground">
            Screen space GI gathers bounced light from what is on screen, guided by depth and normals, then a denoiser smooths it along the same surfaces. Two coloured walls and two lit slabs give it colour to carry.
          </p>
          <PostSteps current="/demos/tsl-post/ssgi" />
        </div>
      </div>
    </main>
  );
}
