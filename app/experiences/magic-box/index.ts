"use client";

import dynamic from "next/dynamic";

// `@react-three/fiber/webgpu` touches browser globals at module scope, so the
// experience can never be in the server render graph. Import from this file
// and drop `<MagicBox />` into any shell.
export const MagicBox = dynamic(
  () => import("./magic-box").then((m) => m.MagicBox),
  { ssr: false },
);
