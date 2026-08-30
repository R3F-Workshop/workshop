import type { Metadata } from "next";
import Link from "next/link";

import { InfoDialog, InfoSection } from "@/components/demos/info-dialog";
import { HeroDemo } from "@/components/hero-demo/hero-demo";

export const metadata: Metadata = {
  title: "Paris hero — R3F v10 demo",
  description:
    "The site's hero scene on its own: the Eiffel Tower over a generated Paris, a physical @pmndrs/sky atmosphere, FSR3 upscaling, bloom, and sky-sampled height fog — every knob live.",
  robots: { index: false, follow: false },
};

export default function ParisHeroDemoPage() {
  return (
    <main className="relative h-dvh w-full overflow-hidden bg-background">
      <HeroDemo />

      <div className="pointer-events-none absolute top-5 left-5 z-30 max-w-[min(430px,calc(100vw-2.5rem))]">
        <div className="font-mono text-[11px] tracking-[0.13em] text-faint uppercase">
          Demo · made with R3F v10
        </div>
        <h1 className="mt-1.5 text-[22px] leading-[1.15] font-semibold tracking-[-0.03em] text-white sm:text-[26px]">
          Paris hero
        </h1>
        <p className="mt-1.5 text-[13.5px] leading-[1.5] text-white/60">
          The hero scene with every dial exposed. First load compiles the
          pipeline&apos;s shaders — give it a few seconds.
        </p>
      </div>

      <InfoDialog title="Paris hero" subtitle="WebGPU · FSR3 · @pmndrs/sky">
        <InfoSection heading="One pass, one MRT">
          <p>
            The whole frame comes from a single scene render into a
            multi-render-target — color, emissive, packed normals, motion
            vectors — and a post graph composed in TSL on top of it: bloom
            from the emissive attachment, ambient occlusion, sky-sampled fog,
            then the temporal resolver. The original demo rasterized the city
            twice to get emissive on its own attachment; MRT exists precisely
            so you don&apos;t have to.
          </p>
        </InfoSection>

        <InfoSection heading="FSR3 is the only temporal resolver">
          <p>
            The scene renders at 1/1.5 resolution and AMD&apos;s FSR3
            reconstructs to display size from color, depth and motion vectors
            (<code>fsr</code> off falls back to TRAA at native res). Two
            temporal resolvers never stack — they ghost — so enabling FSR
            removes TRAA from the graph rather than feeding it.
          </p>
        </InfoSection>

        <InfoSection heading="A real atmosphere, and a cheap fog that borrows it">
          <p>
            The sky is <code>@pmndrs/sky</code> — Hillaire&apos;s atmosphere
            model at the real solar position for Paris on the workshop date.
            Drag <code>timeOfDay</code> and the sun moves like it should. The
            distance haze is deliberately <em>not</em> the physical
            aerial-perspective pass (its per-frame LUT cost is about half the
            frame): it&apos;s exponential height fog whose inscatter color is
            the baked sky cube sampled along each view ray, so the far city
            dissolves into whatever sky is actually behind it — sunset orange
            toward the sun, violet away from it — for the price of one cube
            sample.
          </p>
        </InfoSection>

        <InfoSection heading="Dials worth reaching for">
          <ul className="grid gap-1.5">
            {[
              ["sky/timeOfDay", "Hours, 0–24. Real solar position; dusk is ~20.5 in June."],
              ["tower/towerMode", "glow · metal · sparkle — sparkle is the hourly glitter as a fragment shader."],
              ["tower/beacon", "The summit's rotating double beam, faked with anglePower cones."],
              ["sky/fog/fogDensity", "Extinction per km. 0.3 is a veil; 2 swallows the city."],
              ["post/fsr/renderScale", "1 = native AA, 1.5 = Quality, 2 = Performance."],
              ["post/fsr/ssgi", "Screen-space GI replaces GTAO. Judge it against bloom-only."],
              ["world/worldScale", "Metres per unit. Watch the fog become physical as the city grows."],
            ].map(([k, v]) => (
              <li key={k} className="flex gap-3">
                <code className="w-[11rem] shrink-0 text-[12.5px] text-foreground">
                  {k}
                </code>
                <span>{v}</span>
              </li>
            ))}
          </ul>
        </InfoSection>

        <InfoSection heading="Where it runs">
          <p>
            The marketing page&apos;s hero is this exact scene with the knobs
            frozen at the values you see on load — one shared component, two
            prop sources. This page keeps the perf readout and the full panel
            because tuning it <em>is</em> the demo.
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
            The workshop this was built for
          </Link>
        </div>
      </InfoDialog>
    </main>
  );
}
