"use client";

import { folder, useControls } from "leva";
import dynamic from "next/dynamic";

import { ControlsToggle } from "@/components/demos/controls-toggle";
import { TAKEHOME_GRID_DEFAULTS } from "@/components/three/takehome-grid/config";
import { useWebGPU } from "@/lib/use-webgpu";

// `@react-three/fiber/webgpu` touches `localStorage` at module scope, so it can
// never appear in the server render graph.
const TakehomeGridScene = dynamic(
  () => import("./scene").then((m) => m.TakehomeGridScene),
  { ssr: false },
);

const d = TAKEHOME_GRID_DEFAULTS;

export function TakehomeGridDemo() {
  const support = useWebGPU();

  // Namespaced, because Leva's store is global and every demo shares it.
  // `tile` is not exposed: it is the unit the rest of the layout is measured
  // in, and the fit-to-frame scale makes changing it a no-op.
  const config = useControls("takehome grid", {
    grid: folder({
      cols: { value: d.cols, min: 1, max: 4, step: 1 },
      rows: { value: d.rows, min: 1, max: 3, step: 1 },
      aspect: { value: d.aspect, min: 0.8, max: 3.5, step: 0.05 },
      gap: { value: d.gap, min: 0, max: 0.4, step: 0.01 },
      thickness: { value: d.thickness, min: 0.02, max: 0.5, step: 0.005 },
    }),
    timing: folder({
      stagger: { value: d.stagger, min: 0, max: 1.5, step: 0.02 },
      turn: { value: d.turn, min: 0.2, max: 3, step: 0.05 },
      hold: { value: d.hold, min: 0.2, max: 8, step: 0.1 },
      close: { value: d.close, min: 0.2, max: 3, step: 0.05 },
      overshoot: { value: d.overshoot, min: 0, max: 3, step: 0.05 },
    }),
    colour: folder({
      front: { value: d.front },
      back: { value: d.back },
      ink: { value: d.ink },
      edge: { value: d.edge },
      ambient: { value: d.ambient, min: 0, max: 2, step: 0.01 },
      keyIntensity: { value: d.keyIntensity, min: 0, max: 6, step: 0.05 },
    }),
  });

  return (
    <>
      <ControlsToggle />
      <div className="absolute inset-0">
        {support === "yes" ? (
          <TakehomeGridScene config={{ ...config, tile: d.tile }} />
        ) : null}
      </div>
    </>
  );
}
