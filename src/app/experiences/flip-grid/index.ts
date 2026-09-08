"use client";

import dynamic from "next/dynamic";

// `@react-three/fiber/webgpu` touches browser globals at module scope, so the
// experience can never be in the server render graph. Import from this file
// and drop `<FlipGrid />` into any shell.
export const FlipGrid = dynamic(
  () => import("./flip-grid").then((m) => m.FlipGrid),
  { ssr: false },
);

// The three versions that lead up to it, for the compute lesson. Each is the
// same grid built one step further from the CPU. See `steps/`.
export const FlipGridMeshes = dynamic(
  () => import("./steps/01-meshes").then((m) => m.FlipGridMeshes),
  { ssr: false },
);

export const FlipGridInstanced = dynamic(
  () => import("./steps/02-instanced").then((m) => m.FlipGridInstanced),
  { ssr: false },
);

export const FlipGridStorage = dynamic(
  () => import("./steps/03-storage").then((m) => m.FlipGridStorage),
  { ssr: false },
);
