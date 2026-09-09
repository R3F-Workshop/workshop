"use client";

import dynamic from "next/dynamic";

// `@react-three/fiber/webgpu` touches browser globals at module scope, so the
// experiences can never be in the server render graph. Import from this file.

export const PostOutputs = dynamic(
  () => import("./outputs").then((m) => m.PostOutputs),
  { ssr: false },
);
export const PostPipeline = dynamic(
  () => import("./pipeline").then((m) => m.PostPipeline),
  { ssr: false },
);
export const PostSsgi = dynamic(
  () => import("./ssgi").then((m) => m.PostSsgi),
  { ssr: false },
);
export const PostHaze = dynamic(
  () => import("./haze").then((m) => m.PostHaze),
  { ssr: false },
);
export const PostFsr = dynamic(() => import("./fsr").then((m) => m.PostFsr), {
  ssr: false,
});
