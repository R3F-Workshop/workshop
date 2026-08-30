"use client";

import { Canvas } from "@react-three/fiber/webgpu";
import { useControls } from "leva";

import { DepthAttachmentSync } from "./depth-attachment-sync";
import { LevaPanel } from "./leva-panel";
import { GRAIN_DEFAULTS, GrainField } from "./noise-field";
import { WebGPUGate } from "./webgpu-gate";

/**
 * The grain gradient on its own page, as the primary canvas, with every dial
 * exposed — the point of this one is tuning it.
 *
 * The controls live here rather than in `GrainField` on purpose. `useControls`
 * in the field itself would spawn a Leva store on the marketing page too, where
 * the same field runs as a section background and nobody wants a debug panel.
 * The field takes plain params; only this page decides where they come from.
 */
export function GrainGradientStandalone() {
  const params = useControls("grain gradient", {
    softness: { value: GRAIN_DEFAULTS.softness, min: 0, max: 1, step: 0.01 },
    intensity: { value: GRAIN_DEFAULTS.intensity, min: 0, max: 1, step: 0.01 },
    noise: { value: GRAIN_DEFAULTS.noise, min: 0, max: 1, step: 0.01 },
    grainSize: {
      value: GRAIN_DEFAULTS.grainSize,
      min: 0.5,
      max: 8,
      step: 0.25,
    },
    opacity: { value: GRAIN_DEFAULTS.opacity, min: 0, max: 1, step: 0.01 },
    speed: { value: GRAIN_DEFAULTS.speed, min: 0, max: 5, step: 0.05 },
    scale: { value: GRAIN_DEFAULTS.scale, min: 0.2, max: 4, step: 0.05 },
    rotation: {
      value: GRAIN_DEFAULTS.rotation,
      min: 0,
      max: Math.PI * 2,
      step: 0.01,
    },
    offsetX: { value: GRAIN_DEFAULTS.offsetX, min: -1.5, max: 1.5, step: 0.01 },
    offsetY: { value: GRAIN_DEFAULTS.offsetY, min: -1.5, max: 1.5, step: 0.01 },
    color1: GRAIN_DEFAULTS.color1,
    color2: GRAIN_DEFAULTS.color2,
    color3: GRAIN_DEFAULTS.color3,
  });

  return (
    <WebGPUGate>
      {/* Open by default here — a tuning page with a collapsed panel is a
          tuning page nobody tunes. */}
      <LevaPanel alwaysOpen />
      <Canvas
        id="main"
        // Opaque: on the marketing page this field lifts the section behind it,
        // but here there is nothing behind it to lift.
        renderer={{ alpha: false, antialias: false }}
        dpr={[1, 2]}
        forceEven
        orthographic
        camera={{ position: [0, 0, 10], zoom: 1 }}
      >
        <color attach="background" args={["#08080a"]} />
        <GrainField params={params} />
        <DepthAttachmentSync />
      </Canvas>
    </WebGPUGate>
  );
}
