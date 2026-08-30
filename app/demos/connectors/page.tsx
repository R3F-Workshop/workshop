import type { Metadata } from "next";
import Link from "next/link";

import { InfoDialog, InfoSection } from "@/components/demos/info-dialog";

import { ConnectorsDemo } from "./connectors-demo";

export const metadata: Metadata = {
  title: "A container with no walls — R3F v10 demo",
  description:
    "Rapier bodies held in a pile by a spring to the origin rather than by a box, shoved around by a kinematic cursor. After Lusion's connectors, rebuilt on React Three Fiber v10 and WebGPU.",
  // A work-in-progress demo for an unannounced workshop; shareable by link, not
  // something search should surface yet.
  robots: { index: false, follow: false },
};

export default function ConnectorsDemoPage() {
  return (
    <main className="relative h-dvh w-full overflow-hidden bg-background">
      <ConnectorsDemo />

      {/* Title plate. pointer-events-none so it never intercepts the cursor the
          scene is reading — or the click that cycles the accent. */}
      <div className="pointer-events-none absolute top-5 left-5 z-30 max-w-[min(430px,calc(100vw-2.5rem))]">
        <div className="font-mono text-[11px] tracking-[0.13em] text-faint uppercase">
          Demo · made with R3F v10
        </div>
        <h1 className="mt-1.5 text-[22px] leading-[1.15] font-semibold tracking-[-0.03em] sm:text-[26px]">
          A container with no walls
        </h1>
        <p className="mt-1.5 text-[13.5px] leading-[1.5] text-muted-foreground">
          Push the pile around. Click anywhere to change the accent.
        </p>
      </div>

      <InfoDialog
        title="A container with no walls"
        subtitle="React Three Fiber v10 · WebGPU · Rapier"
      >
        <InfoSection heading="There is no container">
          <p>
            Gravity is off. Every frame each body takes an impulse toward the
            origin scaled by how far out it has drifted — a spring to the middle
            — and the pile is that spring fighting the bodies&apos; own
            collisions. Nothing bounds the scene: no floor, no walls, no invisible
            box. Turn <code>pull</code> down to zero and everything simply leaves.
          </p>
          <p>
            <code>spreadX</code> is the one dial that isn&apos;t in the original.
            Above zero, each body springs to its own slot across the frame rather
            than to the shared centre, and the pile becomes a band. That is how
            this runs on the workshop page, where it has to fill a strip five
            times wider than it is tall without sitting behind the headline.
          </p>
          <p>
            It is worth knowing why this is the right shape for the effect. A box
            gives you a corner for things to wedge into and a wall for them to go
            still against. A spring has neither, so the pile is never quite
            settled — nudge it and it redistributes rather than sliding back to
            the same arrangement.
          </p>
        </InfoSection>

        <InfoSection heading="The cursor is a body">
          <p>
            It has no mesh and no forces. It is a kinematic ball that simply
            cannot be overlapped, so driving it through the pile displaces
            whatever is in the way and the physics works out the rest. Kinematic
            rather than dynamic because the cursor must be unmoved by what it
            hits — a dynamic body would get shoved back by the pile it is
            supposed to be shoving.
          </p>
          <p>
            Its target is eased rather than snapped. Teleport a kinematic body
            across the scene and it sweeps nothing on the way: it appears on the
            far side, and whatever it should have pushed is either untouched or
            fired off at whatever velocity resolving the overlap implies.
          </p>
          <p>
            The cursor is read off <code>window</code>, not from R3F&apos;s
            pointer events. On the workshop page this scene sits behind the
            closing call to action, so the canvas takes no pointer events at all
            and the register button stays clickable through it.
          </p>
        </InfoSection>

        <InfoSection heading="The bodies are generated, not loaded">
          <p>
            The default shape is the pmndrs mark: six cubes on the 3×3 grid its
            SVG describes, read straight off the same coordinates{" "}
            <code>components/brand/logo.tsx</code> draws. One geometry is built
            for all of them, and the collider set is derived from the same cell
            list — a collider that disagrees with its mesh is how these scenes
            end up looking haunted, with shapes bouncing off nothing.
          </p>
          <p>
            The cross in the shape switch is the original&apos;s silhouette,
            rebuilt from three boxes rather than lifted from its model — an
            homage with no asset to download. Dots are there because sphere
            colliders are the cheapest thing Rapier has, and a pile of them
            behaves noticeably differently: nothing to interlock, so it packs
            instead of tangling.
          </p>
        </InfoSection>

        <InfoSection heading="What changed on the way to WebGPU">
          <p>
            The original leans on{" "}
            <code>MeshTransmissionMaterial</code> and{" "}
            <code>@react-three/postprocessing</code>, and both are WebGL. The
            glass here is a plain <code>meshPhysicalNodeMaterial</code> with{" "}
            <code>transmission: 1</code>, because three does real transmission
            natively under WebGPU — the drei material exists to work around its
            absence in WebGL, so on this renderer it is solving a problem that
            isn&apos;t there. The N8AO pass is simply gone; against a dark page
            it was doing far less than it does over the original&apos;s flat
            background.
          </p>
          <p>
            Rapier itself needed one nudge:{" "}
            <code>@react-three/rapier</code> still declares a peer on R3F v9 and
            imports <code>useFrame</code> from the default entry, which on v10 is
            the WebGL build. It is patched to reach for{" "}
            <code>@react-three/fiber/webgpu</code> instead — not for correctness,
            since v10 shares its context across entries deliberately, but to keep
            a second copy of the reconciler and of three out of the bundle.
          </p>
        </InfoSection>

        <InfoSection heading="Dials worth reaching for">
          <ul className="grid gap-1.5">
            {[
              ["shape", "logo, dots, or the classic cross. Changes the colliders too."],
              ["pull", "The spring to the origin. Low values let the pile drift wide; high ones jam it into a knot."],
              ["linearDamping", "How fast a shove bleeds off. Below ~2 the pile keeps sloshing for seconds."],
              ["pointerRadius", "How much of the pile the cursor moves at once."],
              ["metalness", "At 1 the bodies are nothing but reflection — worth trying with the environment turned up."],
              ["glassThickness", "How far light bends through the one transmissive body. 0 makes it a window."],
              ["kickIntensity", "The hot off-axis softbox. This is the glint that reads as polish."],
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

        <InfoSection heading="Where it runs">
          <p>
            On the workshop page this same scene is a <em>secondary canvas</em>{" "}
            spanning the closing call to action and the footer, borrowing the
            hero&apos;s <code>WebGPURenderer</code> and running at 30fps with
            fewer, smaller, dimmer bodies. Here it owns the renderer and takes
            the full frame. Same component, different host and a different
            preset.
          </p>
          <p>
            After{" "}
            <a
              href="https://lusion.co/"
              className="text-foreground underline underline-offset-4"
              target="_blank"
              rel="noreferrer"
            >
              Lusion
            </a>
            &apos;s connectors, by way of{" "}
            <a
              href="https://github.com/pmndrs/examples/tree/main/examples/lusion-connectors"
              className="text-foreground underline underline-offset-4"
              target="_blank"
              rel="noreferrer"
            >
              pmndrs/examples
            </a>
            .
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
