"use client";

import dynamic from "next/dynamic";

// `@react-three/fiber/webgpu` touches browser globals at module scope, so the
// experiences can never be in the server render graph. Import from this file.

export const MaterialsMix = dynamic(
  () => import("./mix").then((m) => m.MaterialsMix),
  { ssr: false },
);

export const MaterialsReaders = dynamic(
  () => import("./readers").then((m) => m.MaterialsReaders),
  { ssr: false },
);

export const MaterialsNoise = dynamic(
  () => import("./noise").then((m) => m.MaterialsNoise),
  { ssr: false },
);

export const MaterialsWobble = dynamic(
  () => import("./wobble").then((m) => m.MaterialsWobble),
  { ssr: false },
);
