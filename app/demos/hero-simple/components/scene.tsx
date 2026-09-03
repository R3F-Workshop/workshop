"use client";

import { useControls } from "leva";

import { HeroCanvas } from "@/app/home/sections/hero/components/hero-canvas";
import type { BeaconMode } from "@/app/home/sections/hero/components/stage";

/** `?hour=19.5` deep-links a time of day. */
function initialHour() {
  const raw = new URLSearchParams(window.location.search).get("hour");
  const parsed = raw === null ? NaN : Number(raw);
  return Number.isFinite(parsed) ? Math.min(24, Math.max(0, parsed)) : 18.6;
}

/** The simple hero with its six knobs. Everything else is baked in. */
export function HeroSimpleScene() {
  const { hour, autoRotate } = useControls("time", {
    // Solar hours, 0..24 (noon = 12). Real sun position for Paris on the
    // workshop date; sunset is a little before 18.5.
    hour: { value: initialHour(), min: 0, max: 24, step: 0.05 },
    autoRotate: true,
  });

  const { treeCount, houseCount } = useControls("city", {
    treeCount: { value: 3000, min: 0, max: 12000, step: 250 },
    houseCount: { value: 1200, min: 0, max: 6000, step: 100 },
  });

  const { beacon } = useControls("light", {
    // "on" runs the summit beacon in daylight too — the useFrame, on demand.
    beacon: {
      value: "night" as BeaconMode,
      options: ["night", "on", "off"] as BeaconMode[],
    },
  });

  const { bloom, strength } = useControls("post", {
    bloom: true,
    strength: { value: 0.45, min: 0, max: 3, step: 0.05 },
  });

  return (
    <HeroCanvas
      hour={hour}
      autoRotate={autoRotate}
      beacon={beacon}
      treeCount={treeCount}
      houseCount={houseCount}
      bloom={bloom}
      bloomStrength={strength}
    />
  );
}
