"use client";

import dynamic from "next/dynamic";

// `@react-three/fiber/webgpu` touches browser globals at module scope, so the
// experience can never be in the server render graph. Import from this file
// and drop `<BlockCity />` into any shell.
export const BlockCity = dynamic(
  () => import("./block-city").then((m) => m.BlockCity),
  { ssr: false },
);
