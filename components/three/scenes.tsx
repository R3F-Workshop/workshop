"use client";

import dynamic from "next/dynamic";

/**
 * The client-only boundary for everything 3D.
 *
 * `@react-three/fiber/webgpu` reaches for `localStorage` at module scope, so it
 * cannot appear anywhere in the server render graph — importing a scene
 * directly from a section breaks the build. Sections import from here instead;
 * this module only pulls in `next/dynamic`, and the scenes load client-side.
 *
 * It also keeps three.js out of the initial route bundle.
 */

export const TrackCanvas = dynamic(
  () => import("./track-object").then((m) => m.TrackCanvas),
  { ssr: false },
);

/** The "Why now" backdrop. Brings its own wrapper — see the component. */
export const FlipGridCanvas = dynamic(
  () => import("./flip-grid/flip-grid-canvas").then((m) => m.FlipGridCanvas),
  { ssr: false },
);

export const MagicBoxCanvas = dynamic(
  () => import("./magic-box-canvas").then((m) => m.MagicBoxCanvas),
  { ssr: false },
);

/** The same scene as its own primary canvas — see /demos/magic-box. */
export const MagicBoxStandalone = dynamic(
  () => import("./magic-box-standalone").then((m) => m.MagicBoxStandalone),
  { ssr: false },
);

/** The same field as its own primary canvas, with controls — /demos/grain-gradient. */
export const GrainGradientStandalone = dynamic(
  () =>
    import("./grain-gradient-standalone").then(
      (m) => m.GrainGradientStandalone,
    ),
  { ssr: false },
);

/**
 * The physics container behind the closing CTA and the footer. Brings its own
 * wrapper — see the component.
 */
export const ConnectorsCanvas = dynamic(
  () =>
    import("./connectors/connectors-canvas").then((m) => m.ConnectorsCanvas),
  { ssr: false },
);

/** The Overview slot: a skyline that builds itself. */
export const BlockCityCanvas = dynamic(
  () => import("./block-city/block-city-canvas").then((m) => m.BlockCityCanvas),
  { ssr: false },
);

/** The "demos" outcome card. Tiles that turn to name what you leave with. */
export const TakehomeGridCanvas = dynamic(
  () =>
    import("./takehome-grid/takehome-grid-canvas").then(
      (m) => m.TakehomeGridCanvas,
    ),
  { ssr: false },
);

/** The "ecosystem" outcome card. One box, gaining a capability at a time. */
export const BlendingCubeCanvas = dynamic(
  () =>
    import("./blending-cube/blending-cube-canvas").then(
      (m) => m.BlendingCubeCanvas,
    ),
  { ssr: false },
);
