"use client";

import dynamic from "next/dynamic";

// `@react-three/fiber/webgpu` touches browser globals at module scope, so the
// experiences can never be in the server render graph. Import from this file.
//
// Seven small demos, one hook idea each, in lesson order. After them come
// the grain gradient (Leva straight into `useUniforms`) and the flip grid
// steps (storage buffers and compute).

export const HooksUniform = dynamic(
  () => import("./uniform").then((m) => m.HooksUniform),
  { ssr: false },
);

export const HooksShared = dynamic(
  () => import("./shared").then((m) => m.HooksShared),
  { ssr: false },
);

export const HooksNodes = dynamic(
  () => import("./nodes").then((m) => m.HooksNodes),
  { ssr: false },
);

export const HooksCanvases = dynamic(
  () => import("./canvases").then((m) => m.HooksCanvases),
  { ssr: false },
);

export const HooksBuffers = dynamic(
  () => import("./buffers").then((m) => m.HooksBuffers),
  { ssr: false },
);

export const HooksTextures = dynamic(
  () => import("./textures").then((m) => m.HooksTextures),
  { ssr: false },
);

export const HooksStorage = dynamic(
  () => import("./storage").then((m) => m.HooksStorage),
  { ssr: false },
);
