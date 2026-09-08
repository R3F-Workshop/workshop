"use client";

import dynamic from "next/dynamic";

// The renderer is created inside an effect, so this could import directly.
// It goes through `dynamic` anyway so every experience is dropped in the same way.
export const VanillaPyramid = dynamic(
  () => import("./vanilla-pyramid").then((m) => m.VanillaPyramid),
  { ssr: false },
);
