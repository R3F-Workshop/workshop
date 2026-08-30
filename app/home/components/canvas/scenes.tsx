"use client";

import dynamic from "next/dynamic";

/**
 * The client-only boundary for the home page's 3D.
 *
 * `@react-three/fiber/webgpu` reaches for `localStorage` at module scope, so it
 * cannot appear anywhere in the server render graph — importing a scene
 * directly from a section breaks the build. Sections import from here instead;
 * this module only pulls in `next/dynamic`, and the scenes load client-side.
 * (The demo pages carry their own boundaries — see `standalone.tsx` next to
 * each demo's `page.tsx`.)
 *
 * It also keeps three.js out of the initial route bundle.
 */

/** The "Why now" backdrop. Brings its own wrapper — see the component. */
export const FlipGridCanvas = dynamic(
  () =>
    import("@/app/home/sections/why/components/flip-grid/flip-grid-canvas").then(
      (m) => m.FlipGridCanvas,
    ),
  { ssr: false },
);

export const MagicBoxCanvas = dynamic(
  () =>
    import("@/app/home/sections/outcomes/components/magic-box/magic-box").then(
      (m) => m.MagicBoxCanvas,
    ),
  { ssr: false },
);

/**
 * The physics container behind the closing CTA and the footer. Brings its own
 * wrapper — see the component.
 */
export const ConnectorsCanvas = dynamic(
  () =>
    import(
      "@/app/home/sections/closer/components/connectors/connectors-canvas"
    ).then((m) => m.ConnectorsCanvas),
  { ssr: false },
);

/** The Overview slot: a skyline that builds itself. */
export const BlockCityCanvas = dynamic(
  () =>
    import(
      "@/app/home/sections/overview/components/block-city/block-city-canvas"
    ).then((m) => m.BlockCityCanvas),
  { ssr: false },
);

/** The "demos" outcome card. Tiles that turn to name what you leave with. */
export const TakehomeGridCanvas = dynamic(
  () =>
    import(
      "@/app/home/sections/outcomes/components/takehome-grid/takehome-grid-canvas"
    ).then((m) => m.TakehomeGridCanvas),
  { ssr: false },
);

/** The "ecosystem" outcome card. One box, gaining a capability at a time. */
export const BlendingCubeCanvas = dynamic(
  () =>
    import(
      "@/app/home/sections/outcomes/components/blending-cube/blending-cube-canvas"
    ).then((m) => m.BlendingCubeCanvas),
  { ssr: false },
);
