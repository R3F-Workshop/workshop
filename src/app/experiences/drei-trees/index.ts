"use client";

import dynamic from "next/dynamic";

export const DreiTrees = dynamic(
  () => import("./drei-trees").then((m) => m.DreiTrees),
  { ssr: false },
);
