"use client";

import dynamic from "next/dynamic";

// `@react-three/fiber/webgpu` touches browser globals at module scope, so the
// experience can never be in the server render graph. Import from this file
// and drop `<Connectors />` into any shell.
export const Connectors = dynamic(
  () => import("./connectors").then((m) => m.Connectors),
  { ssr: false },
);
