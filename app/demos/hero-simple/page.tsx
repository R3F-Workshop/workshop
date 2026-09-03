import type { Metadata } from "next";
import Link from "next/link";

import { InfoDialog, InfoSection } from "@/app/demos/components/info-dialog";

import { HeroSimpleDemo } from "./components/hero-simple-demo";

export const metadata: Metadata = {
  title: "Paris hero, the simple version — R3F v10 demo",
  description:
    "The workshop's hero as it is built during the day: the tower over an instanced city under a physical sky, a wordmark in the scene, and one bloom pass. About seven hundred lines.",
  robots: { index: false, follow: false },
};

export default function HeroSimpleDemoPage() {
  return (
    <main className="relative h-dvh w-full overflow-hidden bg-background">
      <HeroSimpleDemo />

      <div className="pointer-events-none absolute top-5 left-5 z-30 max-w-[min(430px,calc(100vw-2.5rem))]">
        <div className="font-mono text-[11px] tracking-[0.13em] text-faint uppercase">
          Demo · made with R3F v10
        </div>
        <h1 className="mt-1.5 text-[22px] leading-[1.15] font-semibold tracking-[-0.03em] text-white sm:text-[26px]">
          Paris hero, the simple version
        </h1>
        <p className="mt-1.5 text-[13.5px] leading-[1.5] text-white/60">
          The hero you build on day one. Drag to orbit; the first load compiles
          the shaders.
        </p>
      </div>

      <InfoDialog title="The simple hero" subtitle="WebGPU · @pmndrs/sky · one bloom pass">
        <InfoSection heading="What it is">
          <p>
            Every file under{" "}
            <code>app/home/sections/hero/components/</code> is one beat of the
            morning: the Canvas, the tower component, the stage, two instanced
            meshes, a sky driven by one number, a <code>useFrame</code> on the
            spotlights, and a <code>PostFx</code> box with bloom in it. The
            wordmark and the stars are shipped ready-made.
          </p>
        </InfoSection>

        <InfoSection heading="One number">
          <p>
            <code>hour</code> goes through <code>sun.ts</code> and comes out as
            a sun position, a light level, and an exposure. The sky, the direct
            light, the tower&apos;s glow, the floodlights and the stars all read
            that. Drag <code>time/hour</code> and watch them agree.
          </p>
        </InfoSection>

        <InfoSection heading="What the pro version adds">
          <p>
            The same scene pass, with more stages on it: ambient occlusion,
            sky-coloured height fog, FSR3 reconstruction from a lower render
            resolution, and a full-resolution lettering pass with authored
            depth. Plus a river, a park, a Haussmann ring, real constellations
            and a six-second launch. It is all at <code>/demos/paris-hero</code>{" "}
            and in <code>resources/tower-scene/</code>.
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
            href="/demos/paris-hero"
            className="text-[14px] text-muted-foreground underline underline-offset-4"
          >
            The pro version
          </Link>
        </div>
      </InfoDialog>
    </main>
  );
}
