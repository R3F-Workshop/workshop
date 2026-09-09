"use client";

import dynamic from "next/dynamic";

// `@react-three/fiber/webgpu` touches browser globals at module scope, so the
// experiences can never be in the server render graph. Import from this file.
//
// Five steps that take the compute terrain apart. The noise in the vertex
// stage, colour on top of it, the noise moved into a compute pass, trees
// that read the result, and an airplane that shares one value with the CPU.

export const TerrainVertex = dynamic(
  () => import("./vertex").then((m) => m.TerrainVertex),
  { ssr: false },
);

export const TerrainColor = dynamic(
  () => import("./color").then((m) => m.TerrainColor),
  { ssr: false },
);

export const TerrainCompute = dynamic(
  () => import("./compute").then((m) => m.TerrainCompute),
  { ssr: false },
);

export const TerrainTrees = dynamic(
  () => import("./trees").then((m) => m.TerrainTrees),
  { ssr: false },
);

export const TerrainAirplane = dynamic(
  () => import("./airplane").then((m) => m.TerrainAirplane),
  { ssr: false },
);
