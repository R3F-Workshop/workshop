"use client";

import dynamic from "next/dynamic";

// `@react-three/fiber/webgpu` touches browser globals at module scope, so the
// experiences can never be in the server render graph. Import from this file.

export const NormalInject = dynamic(
  () => import("./normal-inject").then((m) => m.NormalInject),
  { ssr: false },
);
