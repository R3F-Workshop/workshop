import type { Metadata } from "next";

import { ControlsToggle } from "@/app/demos/components/controls-toggle";
import { InfoDialog, InfoSection } from "@/app/demos/components/info-dialog";
import { ComputeSteps } from "@/app/demos/compute/components/step-nav";

import { ComputeTerrain } from "@/app/experiences/compute";

export const metadata: Metadata = {
  title: "Terrain — compute demo",
  description:
    "A heightmap baked once by a compute pass into a storage texture, then sampled by the ground, three thousand trees and a plane that follows the slope.",
  robots: { index: false, follow: false },
};

export default function ComputeTerrainDemoPage() {
  return (
    <main className="relative h-dvh w-full overflow-hidden bg-background">
      <ComputeTerrain />
      <ControlsToggle />

      {/* Title plate. pointer-events-none so it never sits between the visitor
          and the scene. */}
      <div className="pointer-events-none absolute top-5 left-5 z-30 max-w-[min(440px,calc(100vw-2.5rem))]">
        <div className="font-mono text-[11px] tracking-[0.13em] text-faint uppercase">
          Demo · compute, one reason at a time
        </div>
        <h1 className="mt-1.5 text-[22px] leading-[1.15] font-semibold tracking-[-0.03em] sm:text-[26px]">
          Bake it once
        </h1>
        <p className="mt-1.5 text-[13.5px] leading-[1.5] text-muted-foreground">
          The noise runs only when a dial moves. The ground, the trees and the plane all sample the result, and none of them know what noise is.
        </p>
        <ComputeSteps current="/demos/compute/terrain" />
      </div>

      <InfoDialog title="Bake it once" subtitle="compute · terrain">
        <InfoSection heading="The usual way, and its cost">
          <p>
            A typical terrain shader evaluates its noise in the vertex stage:
            every vertex, every frame, whether or not anything changed. Add
            trees that need the height under them and a plane that needs the
            height ahead of it, and the same fractal noise runs three times
            over, per frame, for a landscape that is standing still.
          </p>
        </InfoSection>
        <InfoSection heading="A storage texture instead">
          <p>
            Here the noise runs once, in a compute pass, into a half float
            storage texture: height in red, normal in green, blue and alpha.
            It is dispatched only when a Leva dial it reads has changed, and
            the counter in the corner says how many times that has been.
            Everything else samples it with plain <code>texture()</code>, the
            same node a loaded image would use.
          </p>
        </InfoSection>
        <InfoSection heading="Three readers">
          <p>
            The ground displaces and shades from it. Three thousand trees place
            themselves on it and scale to nothing where it is too wet, too high
            or too steep. The plane flies a circle the CPU drives, but its
            altitude is the texture sampled at its own position, so it follows
            the terrain without the CPU ever seeing a height. Its shadow samples
            per vertex and hugs the slope.
          </p>
          <p>
            One convention holds it together: a world xz maps to a texel
            through one function, and the bake and every sampler go through it.
          </p>
        </InfoSection>
      </InfoDialog>
    </main>
  );
}
