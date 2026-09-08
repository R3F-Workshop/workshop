"use client";

import dynamic from "next/dynamic";

// `@react-three/fiber/webgpu` touches browser globals at module scope, so the
// experience can never be in the server render graph. Import from this file
// and drop `<TakehomeGrid />` into any shell.
export const TakehomeGrid = dynamic(
  () => import("./takehome-grid").then((m) => m.TakehomeGrid),
  { ssr: false },
);
