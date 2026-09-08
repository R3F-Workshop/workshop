"use client";

import dynamic from "next/dynamic";

// `@react-three/fiber/webgpu` touches browser globals at module scope, so the
// experience can never be in the server render graph. Import from this file
// and drop `<GrainGradient />` into any shell.
export const GrainGradient = dynamic(
  () => import("./grain-gradient").then((m) => m.GrainGradient),
  { ssr: false },
);
