"use client";

import dynamic from "next/dynamic";

// `@react-three/fiber/webgpu` touches browser globals at module scope, so the
// experience can never be in the server render graph. Import from this file
// and drop `<ParisTower />` into any shell.
export const ParisTower = dynamic(
  () => import("./paris-tower").then((m) => m.ParisTower),
  { ssr: false },
);
