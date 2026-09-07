"use client";

import dynamic from "next/dynamic";

export const ParisHeroSimple = dynamic(
  () => import("./paris-hero-simple").then((m) => m.ParisHeroSimple),
  { ssr: false },
);
