"use client";

import dynamic from "next/dynamic";

// `@react-three/fiber/webgpu` touches browser globals at module scope, so the
// experience can never be in the server render graph. Import from this file
// and drop `<BlendingCube />` into any shell.
export const BlendingCube = dynamic(
  () => import("./blending-cube").then((m) => m.BlendingCube),
  { ssr: false },
);
