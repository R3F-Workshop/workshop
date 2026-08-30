"use client";

import { folder, useControls } from "leva";
import dynamic from "next/dynamic";

import { ControlsToggle } from "@/components/demos/controls-toggle";
import { BLOCK_CITY_DEFAULTS } from "@/components/three/block-city/config";
import { useWebGPU } from "@/lib/use-webgpu";

// `@react-three/fiber/webgpu` touches `localStorage` at module scope, so it can
// never appear in the server render graph.
const BlockCityScene = dynamic(
  () => import("./scene").then((m) => m.BlockCityScene),
  { ssr: false },
);

const d = BLOCK_CITY_DEFAULTS;

export function BlockCityDemo() {
  const support = useWebGPU();

  // Namespaced, because Leva's store is global and every demo shares it.
  const config = useControls("block city", {
    layout: folder({
      cols: { value: d.cols, min: 6, max: 48, step: 1 },
      rows: { value: d.rows, min: 6, max: 40, step: 1 },
      spacing: { value: d.spacing, min: 2, max: 8, step: 0.1 },
      jitter: { value: d.jitter, min: 0, max: 1, step: 0.02 },
      footprint: { value: d.footprint, min: 0.2, max: 1, step: 0.02 },
    }),
    skyline: folder({
      minHeight: { value: d.minHeight, min: 0.2, max: 4, step: 0.1 },
      maxHeight: { value: d.maxHeight, min: 1, max: 16, step: 0.1 },
      centreBias: { value: d.centreBias, min: 0, max: 1, step: 0.02 },
    }),
    build: folder({
      build: { value: d.build, min: 0.2, max: 8, step: 0.1 },
      rise: { value: d.rise, min: 0.1, max: 3, step: 0.05 },
      overshoot: { value: d.overshoot, min: 0, max: 3, step: 0.05 },
      drift: { value: d.drift, min: -8, max: 8, step: 0.1 },
    }),
    light: folder({
      base: { value: d.base },
      window: { value: d.window },
      windowLight: { value: d.windowLight, min: 0, max: 3, step: 0.02 },
      ambient: { value: d.ambient, min: 0, max: 2, step: 0.01 },
      keyIntensity: { value: d.keyIntensity, min: 0, max: 5, step: 0.05 },
      skyIntensity: { value: d.skyIntensity, min: 0, max: 3, step: 0.05 },
    }),
  });

  return (
    <>
      <ControlsToggle />
      <div className="absolute inset-0">
        {support === "yes" ? <BlockCityScene config={config} /> : null}
      </div>
    </>
  );
}
