import type { Metadata } from "next";
import Link from "next/link";

import { InfoDialog, InfoSection } from "@/components/demos/info-dialog";
import { MagicBoxStandalone } from "@/components/three/scenes";
import { TEN_GLYPHS } from "@/lib/ten-glyphs";

export const metadata: Metadata = {
  title: "Ten, written six ways — R3F v10 demo",
  description:
    "A portal cube built with React Three Fiber v10 on WebGPU. Each face opens onto its own scene holding the numeral ten in a different writing system.",
  // A work-in-progress demo for an unannounced workshop; shareable by link, not
  // something search should surface yet.
  robots: { index: false, follow: false },
};

export default function MagicBoxDemoPage() {
  return (
    <main className="relative h-dvh w-full overflow-hidden bg-background">
      <MagicBoxStandalone />

      {/* Title plate. pointer-events-none so it never intercepts a drag. */}
      <div className="pointer-events-none absolute top-5 left-5 z-30 max-w-[min(420px,calc(100vw-2.5rem))]">
        <div className="font-mono text-[11px] tracking-[0.13em] text-faint uppercase">
          Demo · made with R3F v10
        </div>
        <h1 className="mt-1.5 text-[22px] leading-[1.15] font-semibold tracking-[-0.03em] sm:text-[26px]">
          Ten, written six ways
        </h1>
        <p className="mt-1.5 text-[13.5px] leading-[1.5] text-muted-foreground">
          Drag to turn it. Every face opens onto its own scene.
        </p>
      </div>

      <InfoDialog
        title="Ten, written six ways"
        subtitle="React Three Fiber v10 · WebGPU · TSL"
      >
        <InfoSection heading="What you're looking at">
          <p>
            One cube, six faces, and behind each face a{" "}
            <em>genuinely separate 3D scene</em> — not a texture of one. The
            faces use drei&apos;s <code>MeshPortalMaterial</code>, which renders
            each scene through the face as though you were looking into a room.
            The rooms have their own walls, their own light, and their own
            object.
          </p>
          <p>
            Each holds the number ten in a different writing system, set in a
            typeface that suits it rather than one family throughout.
          </p>
        </InfoSection>

        <InfoSection heading="The six faces">
          <ul className="grid gap-1.5">
            {TEN_GLYPHS.map((g) => (
              <li key={g.id} className="flex gap-3">
                <span className="w-14 shrink-0 text-[17px] text-foreground">
                  {g.text}
                </span>
                <span>
                  <span className="text-foreground">{g.script}</span> — {g.note}
                </span>
              </li>
            ))}
          </ul>
        </InfoSection>

        <InfoSection heading="Where the letterforms come from">
          <p>
            No fonts are loaded at runtime. No single font covers Latin, CJK,
            Arabic and Devanagari, and shipping four to draw eight glyphs would
            be absurd — so a build script reads them once, offline, and emits the
            outlines as plain numbers. The browser turns those into{" "}
            <code>ExtrudeGeometry</code>: real 3D letterforms, bevels and all.
          </p>
          <p>
            Deciding which contours are holes turned out to be the interesting
            part. Nesting seems like the obvious test, but Cinzel&apos;s{" "}
            <strong>X</strong> is seven <em>overlapping</em> contours — the
            diagonals and each serif drawn separately — so nesting reports the
            whole glyph as holes. Winding direction survives that.
          </p>
        </InfoSection>

        <InfoSection heading="Why v10 matters here">
          <p>
            On the workshop&apos;s home page this same scene runs as a{" "}
            <em>secondary canvas</em>: it borrows the hero&apos;s
            <code> WebGPURenderer</code> rather than creating its own. v10 lets
            many canvases share one renderer and one GPU context, each keeping
            its own scene, camera and event handling. A canvas per section costs
            a swap chain instead of a context.
          </p>
          <p>
            Here there is no hero to borrow from, so the same scene owns the
            renderer itself. That is the only difference between the two.
          </p>
        </InfoSection>

        <InfoSection heading="Controls">
          <p>
            Drag to orbit — that&apos;s <code>camera-controls</code>, wired
            directly. Wheel-zoom is deliberately off so the page still scrolls.
            The box turns slowly on its own; the glyphs sway rather than tumble,
            because a numeral has to stay legible.
          </p>
          <p>
            Add <code>?debug</code> to the URL for a{" "}
            <a
              href="https://github.com/pmndrs/leva"
              className="text-foreground underline underline-offset-4"
              target="_blank"
              rel="noreferrer"
            >
              Leva
            </a>{" "}
            panel with the lighting, extrusion and material controls.
          </p>
        </InfoSection>

        <InfoSection heading="Built with">
          <p>
            <code>@react-three/fiber</code> v10 alpha,{" "}
            <code>@react-three/drei</code> v11 alpha, three.js r185, Next.js 16.
            Shaking this out turned up three upstream bugs in the alphas, all
            filed and patched.
          </p>
        </InfoSection>

        <div className="mt-7 border-t border-border pt-5">
          <Link
            href="/"
            className="text-[14px] text-foreground underline underline-offset-4"
          >
            The workshop this was built for →
          </Link>
        </div>
      </InfoDialog>
    </main>
  );
}
