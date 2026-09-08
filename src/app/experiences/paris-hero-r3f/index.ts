"use client";

import dynamic from "next/dynamic";

export const ParisHeroR3f = dynamic(
  () => import("./paris-hero-r3f").then((m) => m.ParisHeroR3f),
  { ssr: false },
);
