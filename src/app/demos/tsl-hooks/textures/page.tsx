import type { Metadata } from "next";

import { ControlsToggle } from "@/app/demos/components/controls-toggle";
import { HooksSteps } from "@/app/demos/tsl-hooks/components/step-nav";

import { HooksTextures } from "@/app/experiences/tsl-hooks";

export const metadata: Metadata = {
  title: "Textures — R3F v10 demo",
  description: "useTextures and useRenderTarget: procedural and render target textures in the registry, read three ways.",
  robots: { index: false, follow: false },
};

export default function HooksTexturesDemoPage() {
  return (
    <main className="relative h-dvh w-full overflow-hidden bg-background">
      <HooksTextures />
      <ControlsToggle />

      {/* Title plate. pointer-events-none so it never sits between the visitor
          and the scene. */}
      <div className="pointer-events-none absolute top-5 left-5 z-30 max-w-[min(440px,calc(100vw-2.5rem))]">
        <div className="font-mono text-[11px] tracking-[0.13em] text-faint uppercase">
          Demo · TSL hooks in R3F v10
        </div>
        <h1 className="mt-1.5 text-[22px] leading-[1.15] font-semibold tracking-[-0.03em] sm:text-[26px]">
          Textures
        </h1>
        <p className="mt-1.5 text-[13.5px] leading-[1.5] text-muted-foreground">
          The registry does not care where a texture came from. A canvas drawing and a render target go in; a material map, a TSL sampler and a screen take them out.
        </p>
        <HooksSteps current="/demos/tsl-hooks/textures" />
      </div>
    </main>
  );
}
