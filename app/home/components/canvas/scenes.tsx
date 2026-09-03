"use client";

import dynamic from "next/dynamic";

/** The client-only boundary for the home page's 3D. */

/** The "Why now" backdrop. */
export const FlipGridCanvas = dynamic(
  () =>
    import("@/app/home/sections/why/components/flip-grid/flip-grid-canvas").then(
      (m) => m.FlipGridCanvas,
    ),
  { ssr: false },
);

export const MagicBoxCanvas = dynamic(
  () =>
    import(
      "@/app/home/sections/outcomes/components/magic-box/magic-box-canvas"
    ).then((m) => m.MagicBoxCanvas),
  { ssr: false },
);

/** The physics container behind the closing CTA and the footer. */
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

/** The "demos" outcome card. */
export const TakehomeGridCanvas = dynamic(
  () =>
    import(
      "@/app/home/sections/outcomes/components/takehome-grid/takehome-grid-canvas"
    ).then((m) => m.TakehomeGridCanvas),
  { ssr: false },
);

/** The "ecosystem" outcome card. */
export const BlendingCubeCanvas = dynamic(
  () =>
    import(
      "@/app/home/sections/outcomes/components/blending-cube/blending-cube-canvas"
    ).then((m) => m.BlendingCubeCanvas),
  { ssr: false },
);
