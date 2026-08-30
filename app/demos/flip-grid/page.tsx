import type { Metadata } from "next";

import { InfoDialog, InfoSection } from "@/components/demos/info-dialog";

import { FlipGridDemo } from "./flip-grid-demo";

export const metadata: Metadata = {
  title: "A grid that flips to gold — R3F v10 demo",
  description:
    "A field of tiles whose flip angle, velocity and hold timer live in a WebGPU storage buffer, integrated by a compute pass. Built with React Three Fiber v10 and TSL.",
  // A work-in-progress demo for an unannounced workshop; shareable by link, not
  // something search should surface yet.
  robots: { index: false, follow: false },
};

export default function FlipGridDemoPage() {
  return (
    <main className="relative h-dvh w-full overflow-hidden bg-background">
      <FlipGridDemo />

      {/* Title plate. pointer-events-none so it never intercepts the cursor the
          grid is reading. */}
      <div className="pointer-events-none absolute top-5 left-5 z-30 max-w-[min(420px,calc(100vw-2.5rem))]">
        <div className="font-mono text-[11px] tracking-[0.13em] text-faint uppercase">
          Demo · made with R3F v10
        </div>
        <h1 className="mt-1.5 text-[22px] leading-[1.15] font-semibold tracking-[-0.03em] sm:text-[26px]">
          A grid that flips to gold
        </h1>
        <p className="mt-1.5 text-[13.5px] leading-[1.5] text-muted-foreground">
          Sweep the cursor across it. Tiles hold the pose before falling back.
        </p>
      </div>

      <InfoDialog
        title="A grid that flips to gold"
        subtitle="React Three Fiber v10 · WebGPU · TSL"
        className="hidden"
      >
        <InfoSection heading="The state lives on the GPU">
          <p>
            Each tile owns three numbers — its flip angle, its angular velocity,
            and a countdown for how long it stays flipped. They live in a WebGPU
            storage buffer as a TSL <code>struct</code>, one per instance, and a
            compute pass integrates them every frame.
          </p>
          <p>
            The CPU writes five floats per frame no matter how many tiles there
            are: the timestep, and the cursor&apos;s position now and last
            frame. Nothing else crosses the boundary.
          </p>
          <p>
            That is the whole reason this needs WebGPU. With nowhere to keep
            per-instance state, the flip angle has to be derived from cursor
            distance every frame — and then there is nowhere to put a timer, so
            &ldquo;stay flipped for three seconds&rdquo; simply cannot be
            expressed.
          </p>
        </InfoSection>

        <InfoSection heading="The cursor is a swept segment, not a point">
          <p>
            This canvas runs at a throttled framerate, so a quick sweep moves
            the pointer several cells between samples. Testing each tile against
            where the cursor <em>is</em> leaves gaps — a dotted trail. Each tile
            instead measures its distance to the segment the cursor travelled
            since the last frame, which fills them in for the cost of one dot
            product.
          </p>
        </InfoSection>

        <InfoSection heading="Flipping is a spring, and mass is free">
          <p>
            Tiles don&apos;t animate to a pose, they&apos;re pulled there. An
            angular spring accelerates each tile toward 0 or π and damps as it
            arrives, so heavier tiles lag into the flip and overshoot on
            landing.
          </p>
          <p>
            That mass isn&apos;t stored anywhere. It&apos;s hashed from the
            instance index — deterministic, free, and needing no initialisation
            pass, which means the zero-filled buffer the GPU hands back is
            already a valid starting state.
          </p>
        </InfoSection>

        <InfoSection heading="Why it reads as metal">
          <p>
            Metal is nothing but its reflection: a fully metallic surface has no
            diffuse term, so gold with no environment renders black. The
            environment here is generated at runtime rather than downloaded — an
            HDR equirectangular texture — and the material samples it properly,
            with fresnel and roughness, rather than faking a gradient.
          </p>
          <p>
            The harder problem is that a flat tile has <em>one</em> normal. It
            samples one direction and comes back one flat colour, whatever the
            material does. Mirror-smooth it goes binary — catch the light or go
            black; rough, every tile averages to the same beige. What makes a
            rounded object read as gold is curvature, so each tile domes
            slightly across its own face and picks up a gradient instead of a
            value.
          </p>
          <p>
            On top of that: a hash lattice of facets perturbing normal and
            roughness, and a little per-tile variation in lean, tone and polish.
            Detail has to sit at a frequency the tile can resolve — a texture
            map fine enough to matter just mipmaps away at this size.
          </p>
        </InfoSection>

        <InfoSection heading="Try it">
          <p>
            Open the controls, top right. <strong>curvature</strong> to 0 is the
            quickest way to see the point — the gold immediately flattens into
            paint. <strong>envPreset</strong> swaps the outdoor sky for a studio;
            watch the tonal spread between neighbouring tiles collapse, because a
            hard horizon is what gives each tile something different to reflect.{" "}
            <strong>hold</strong> and <strong>damping</strong> change the feel of
            the trail more than anything else.
          </p>
        </InfoSection>
      </InfoDialog>
    </main>
  );
}
