"use client";

import dynamic from "next/dynamic";

/**
 * This demo's client-only boundary — `@react-three/fiber/webgpu` cannot enter
 * the server render graph (it reads `localStorage` at module scope), so the
 * server-rendered page imports the scene through here.
 */
export const GrainGradientStandalone = dynamic(
  () =>
    import("./components/grain-gradient-standalone").then(
      (m) => m.GrainGradientStandalone,
    ),
  { ssr: false },
);
