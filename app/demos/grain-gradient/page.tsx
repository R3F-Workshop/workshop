import type { Metadata } from "next";
import Link from "next/link";

import { InfoDialog, InfoSection } from "@/components/demos/info-dialog";
import { GrainGradientStandalone } from "@/components/three/scenes";

export const metadata: Metadata = {
  title: "Grain gradient — R3F v10 demo",
  description:
    "A grain gradient written in TSL and rendered on WebGPU. Drifting blobs under a static sheet of grain that brightens as it nears them.",
  robots: { index: false, follow: false },
};

export default function GrainGradientDemoPage() {
  return (
    <main className="relative h-dvh w-full overflow-hidden bg-background">
      <GrainGradientStandalone />

      <div className="pointer-events-none absolute top-5 left-5 z-30 max-w-[min(430px,calc(100vw-2.5rem))]">
        <div className="font-mono text-[11px] tracking-[0.13em] text-faint uppercase">
          Demo · made with R3F v10
        </div>
        <h1 className="mt-1.5 text-[22px] leading-[1.15] font-semibold tracking-[-0.03em] sm:text-[26px]">
          Grain gradient
        </h1>
        <p className="mt-1.5 text-[13.5px] leading-[1.5] text-muted-foreground">
          Every dial is live. This is the background of the closing section,
          pulled out to tune.
        </p>
      </div>

      <InfoDialog title="Grain gradient" subtitle="TSL · WebGPU · static grain">
        <InfoSection heading="The grain doesn't move">
          <p>
            It is a static field locked to pixels, so it reads as a sheet of
            paper that the shape slides underneath. Resampling it every frame —
            the obvious way to build &ldquo;film grain&rdquo; — turns the whole
            thing into an x-ray or a noisy video feed, and nothing else about
            the effect survives that. Only the blobs are animated.
          </p>
        </InfoSection>

        <InfoSection heading="The grain is added to the shape, not over it">
          <p>
            Noise perturbs the scalar field <em>before</em> the colour ramp
            reads it. So grain landing in a dark region pushes that pixel up
            into the next band and takes on its colour — which is why the grain
            appears to brighten as it nears a blob, as though the blob were
            lighting it. An overlay can&apos;t do that; it just sits there being
            dust.
          </p>
          <p>
            Two noise quantities do the work. One is signed and roughens the
            band edges in both directions. The other is clamped positive, so it
            only ever brightens — and it is built by subtracting a one-sided fbm
            from fine noise, which leaves it mostly at zero. That sparseness is
            what makes it read as grain rather than fog.
          </p>
        </InfoSection>

        <InfoSection heading="Dials worth reaching for">
          <ul className="grid gap-1.5">
            {[
              ["softness", "Band edge width. 0 is hard steps, 1 is a smooth gradient."],
              ["intensity", "How far grain displaces the field. Roughens the edges of the bands."],
              ["noise", "The positive-only grain — the one that lights up near the blobs."],
              ["grainSize", "Device pixels per grain unit. At 1 it's sub-pixel on retina and averages into a sheen."],
              ["opacity", "Peak alpha. The field is transparent so it lifts whatever is behind."],
              ["speed", "Moves the blobs. The grain stays put regardless."],
              ["scale / rotation / offset", "Moves the field rather than the blobs. One transform, composes."],
            ].map(([k, v]) => (
              <li key={k} className="flex gap-3">
                <code className="w-[9.5rem] shrink-0 text-[12.5px] text-foreground">
                  {k}
                </code>
                <span>{v}</span>
              </li>
            ))}
          </ul>
        </InfoSection>

        <InfoSection heading="Why it's all uniforms">
          <p>
            Every parameter is a TSL <code>uniform</code> rather than a constant
            folded into the shader graph. Constants would mean rebuilding and
            recompiling the shader on every drag of a slider; uniforms make the
            controls immediate. It costs a little more setup and is the right
            trade the moment anything is tunable.
          </p>
        </InfoSection>

        <InfoSection heading="Where it runs">
          <p>
            On the workshop page this same field is a <em>secondary canvas</em>{" "}
            behind the closing call to action, borrowing the hero&apos;s
            <code> WebGPURenderer</code> and running at 30fps. Here it owns the
            renderer and takes the full frame. Same component, different host.
          </p>
          <p>
            Modelled on{" "}
            <a
              href="https://shaders.paper.design"
              className="text-foreground underline underline-offset-4"
              target="_blank"
              rel="noreferrer"
            >
              Paper Shaders
            </a>
            &apos; grain gradient — read the source, then written in TSL rather
            than ported.
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
