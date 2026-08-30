"use client";

import { folder, useControls } from "leva";
import dynamic from "next/dynamic";
import { useRef } from "react";

import { ControlsToggle } from "@/components/demos/controls-toggle";
import {
  FLIP_GRID_DEFAULTS,
  type FlipGridConfig,
} from "@/components/three/flip-grid/config";
import { useWebGPU } from "@/lib/use-webgpu";

// `@react-three/fiber/webgpu` touches `localStorage` at module scope, so it can
// never appear in the server render graph.
const FlipGridScene = dynamic(
  () => import("./scene").then((m) => m.FlipGridScene),
  { ssr: false },
);

const d = FLIP_GRID_DEFAULTS;

/**
 * The interactive half of the demo page: the canvas, its controls, and the
 * element the cursor is measured against.
 *
 * The copy around it stays a server component — only this needs to be a client
 * one, because Leva's store is a hook.
 */
export function FlipGridDemo() {
  const bounds = useRef<HTMLDivElement>(null);
  const support = useWebGPU();

  // Namespaced, because Leva's store is global and every demo shares it. The
  // panel is a DOM overlay, so it is entirely indifferent to how many canvases
  // are on the page — a folder per demo is all it takes to keep them apart.
  const config = useControls("flip grid", {
    grid: folder({
      cols: { value: d.cols, min: 8, max: 120, step: 1 },
      rows: { value: d.rows, min: 6, max: 80, step: 1 },
      fill: { value: d.fill, min: 0.3, max: 1, step: 0.01 },
      thickness: { value: d.thickness, min: 0.01, max: 0.5, step: 0.005 },
    }),
    cursor: folder({
      radius: { value: d.radius, min: 0.5, max: 12, step: 0.1 },
      hold: { value: d.hold, min: 0, max: 10, step: 0.1 },
    }),
    spring: folder({
      stiffness: { value: d.stiffness, min: 5, max: 300, step: 1 },
      damping: { value: d.damping, min: 0.5, max: 60, step: 0.5 },
      massJitter: { value: d.massJitter, min: 0, max: 6, step: 0.05 },
    }),
    faces: folder({
      front: d.front,
      back: d.back,
      edge: d.edge,
      roughness: { value: d.roughness, min: 0, max: 1, step: 0.01 },
    }),
    surface: folder({
      flakeCells: { value: d.flakeCells, min: 1, max: 32, step: 1 },
      flakeStrength: { value: d.flakeStrength, min: 0, max: 2, step: 0.01 },
      flakeRoughness: { value: d.flakeRoughness, min: 0, max: 1, step: 0.01 },
      toneJitter: { value: d.toneJitter, min: 0, max: 1, step: 0.01 },
      roughJitter: { value: d.roughJitter, min: 0, max: 1, step: 0.01 },
      tiltJitter: { value: d.tiltJitter, min: 0, max: 1.5, step: 0.01 },
      curvature: { value: d.curvature, min: 0, max: 2.5, step: 0.01 },
    }),
    environment: folder({
      envPreset: { value: d.envPreset, options: ["outdoor", "studio"] },
      ground: d.ground,
      sky: d.sky,
      keyIntensity: { value: d.keyIntensity, min: 0, max: 120, step: 0.5 },
      kickIntensity: { value: d.kickIntensity, min: 0, max: 60, step: 0.1 },
      fillIntensity: { value: d.fillIntensity, min: 0, max: 10, step: 0.1 },
      envIntensity: { value: d.envIntensity, min: 0, max: 4, step: 0.05 },
    }),
    cursorLight: folder({
      cursorLight: { value: d.cursorLight, min: 0, max: 60, step: 0.5 },
      cursorLightHeight: {
        value: d.cursorLightHeight,
        min: 0.2,
        max: 20,
        step: 0.1,
      },
      cursorLightColor: d.cursorLightColor,
    }),
  });

  // Leva types a select as plain `string`, so the union has to be restored on
  // the way out. Narrowing the one field beats casting the whole object.
  const scene: FlipGridConfig = {
    ...config,
    envPreset: config.envPreset as FlipGridConfig["envPreset"],
  };

  return (
    <>
      <ControlsToggle />
      <div ref={bounds} className="absolute inset-0">
        {support === "yes" ? (
          <FlipGridScene config={scene} bounds={bounds} />
        ) : null}
      </div>
    </>
  );
}
