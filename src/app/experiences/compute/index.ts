"use client";

import dynamic from "next/dynamic";

// `@react-three/fiber/webgpu` touches browser globals at module scope, so the
// experiences can never be in the server render graph. Import from this file.
//
// Six small demos, one reason to use compute each, in lesson order. Every one
// stands alone. Read together they say: do the maths in parallel, keep the
// result, react to input, let results talk to each other, get an answer
// home, and then bake a whole landscape once. The flip grid is all of them
// at once.

export const ComputeParallel = dynamic(
  () => import("./parallel").then((m) => m.ComputeParallel),
  { ssr: false },
);

export const ComputePersist = dynamic(
  () => import("./persist").then((m) => m.ComputePersist),
  { ssr: false },
);

export const ComputeCursor = dynamic(
  () => import("./cursor").then((m) => m.ComputeCursor),
  { ssr: false },
);

export const ComputeNeighbors = dynamic(
  () => import("./neighbors").then((m) => m.ComputeNeighbors),
  { ssr: false },
);

export const ComputeReduce = dynamic(
  () => import("./reduce").then((m) => m.ComputeReduce),
  { ssr: false },
);

export const ComputeTerrain = dynamic(
  () => import("./terrain").then((m) => m.ComputeTerrain),
  { ssr: false },
);
