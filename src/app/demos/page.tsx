import type { Metadata } from "next";
import Link from "next/link";

export const metadata: Metadata = {
  title: "Demos — Advanced React Three Fiber",
  robots: { index: false, follow: false },
};

/**
 * Standalone pieces pulled out of the marketing page so they can be shared,
 * poked at, and screenshotted on their own.
 */
const DEMOS = [
  {
    href: "/demos/paris-hero",
    title: "Paris hero",
    blurb:
      "The site's hero on its own: the tower over a generated Paris under a physical @pmndrs/sky atmosphere, FSR3 reconstruction, bloom, and a height fog that samples the sky for its color. Every knob live.",
    tags: ["FSR3", "@pmndrs/sky", "MRT post pipeline"],
  },
  {
    href: "/demos/magic-box",
    title: "Ten, written six ways",
    blurb:
      "A portal cube: six faces, six separate scenes, the numeral ten in six writing systems. Extruded from glyph outlines generated offline.",
    tags: ["MeshPortalMaterial", "ExtrudeGeometry", "multi-canvas"],
  },
  {
    href: "/demos/grain-gradient",
    title: "Grain gradient",
    blurb:
      "Drifting blobs under a static sheet of grain. The grain feeds the colour ramp rather than sitting over it, so it brightens as it nears a blob. Every dial is live.",
    tags: ["TSL", "static grain", "tunable"],
  },
  {
    href: "/demos/flip-grid",
    title: "A grid that flips to gold",
    blurb:
      "Tiles that flip as the cursor sweeps them and hold the pose before falling back. Angle, velocity and hold timer live in a storage buffer a compute pass integrates — the CPU writes five floats a frame however many tiles there are.",
    tags: ["compute shader", "storage buffer", "TSL struct"],
  },
  {
    href: "/demos/connectors",
    title: "A container with no walls",
    blurb:
      "A pile of bodies held together by a spring to the origin rather than by a box, shoved around by a kinematic cursor. After Lusion's connectors — with the pmndrs mark in place of their shape, and the glass done natively.",
    tags: ["Rapier", "transmission", "kinematic cursor"],
  },
  {
    href: "/demos/blending-cube",
    title: "One box, four imports",
    blurb:
      "A single mesh gaining one capability at a time — edges, contact shadows, metalness, and finally an environment to reflect. The fourth stage turns it black on purpose: metal has no colour of its own.",
    tags: ["drei", "generated IBL", "no re-renders"],
  },
  {
    href: "/demos/takehome-grid",
    title: "A directory, turning over",
    blurb:
      "Six tiles that turn one at a time to name the other demos on this site. The same effect as the flip grid, built the opposite way — no instancing, no storage buffer, no compute pass, because six tiles on a fixed timeline have no history to keep.",
    tags: ["CanvasTexture", "no GPU state", "the simple version"],
  },
  {
    href: "/demos/block-city",
    title: "A city that builds itself",
    blurb:
      "A few hundred instanced blocks rising out of the ground in a wave and settling. The layout is a hash of the instance index rather than an array, and the frame loop latches off once the last block lands.",
    tags: ["InstancedMesh", "deterministic layout", "emissive maps"],
  },
];

export default function DemosPage() {
  return (
    <main className="mx-auto max-w-[900px] px-5 py-16 sm:px-8 md:py-24">
      <div className="font-mono text-[11px] tracking-[0.13em] text-faint uppercase">
        Demos
      </div>
      <h1 className="mt-2 text-[32px] leading-[1.05] font-semibold tracking-[-0.035em] md:text-[42px]">
        Made with R3F v10
      </h1>
      <p className="mt-4 max-w-[620px] text-base leading-[1.65] text-muted-foreground">
        Pieces from the workshop site, running on their own. Each needs WebGPU —
        there is no WebGL fallback, by design.
      </p>

      <ul className="mt-10 grid gap-4">
        {DEMOS.map((d) => (
          <li key={d.href}>
            <Link
              href={d.href}
              className="block rounded-xl border border-border bg-card p-5 transition-colors hover:border-foreground/20 sm:p-6"
            >
              <div className="text-[19px] font-semibold tracking-[-0.02em]">
                {d.title}
              </div>
              <p className="mt-2 text-[15px] leading-[1.6] text-muted-foreground">
                {d.blurb}
              </p>
              <div className="mt-3.5 flex flex-wrap gap-2">
                {d.tags.map((t) => (
                  <span
                    key={t}
                    className="rounded-md border border-border px-2 py-1 font-mono text-[10.5px] text-faint"
                  >
                    {t}
                  </span>
                ))}
              </div>
            </Link>
          </li>
        ))}
      </ul>

      <Link
        href="/"
        className="mt-10 inline-block text-[14px] text-muted-foreground underline underline-offset-4 hover:text-foreground"
      >
        ← Back to the workshop
      </Link>
    </main>
  );
}
