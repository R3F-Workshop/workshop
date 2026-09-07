"use client";

import dynamic from "next/dynamic";

// `@react-three/fiber/webgpu` touches browser globals at module scope, so the
// experience can never be in the server render graph. Import from this file
// and drop `<FlipGrid />` into any shell.
export const FlipGrid = dynamic(
  () => import("./flip-grid").then((m) => m.FlipGrid),
  { ssr: false },
);
