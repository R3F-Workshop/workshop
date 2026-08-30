"use client";

import { folder, useControls } from "leva";
import dynamic from "next/dynamic";
import { useState } from "react";

import { ControlsToggle } from "@/components/demos/controls-toggle";
import { STAGE_CAPTIONS } from "@/components/three/blending-cube/blending-cube";
import {
  BLENDING_CUBE_DEFAULTS,
  type BlendingCubeConfig,
} from "@/components/three/blending-cube/config";
import { useWebGPU } from "@/lib/use-webgpu";

// `@react-three/fiber/webgpu` touches `localStorage` at module scope, so it can
// never appear in the server render graph.
const BlendingCubeCanvasScene = dynamic(
  () => import("./scene").then((m) => m.BlendingCubeCanvasScene),
  { ssr: false },
);

const d = BLENDING_CUBE_DEFAULTS;

/**
 * The interactive half of the demo page: the canvas, its controls, and the
 * caption that names whatever the cube just gained.
 *
 * The caption is the one thing that crosses back out of the frame loop, and it
 * only does so when the stage index actually changes — a handful of setState
 * calls a minute, not one per frame.
 */
export function BlendingCubeDemo() {
  const support = useWebGPU();
  const [stage, setStage] = useState(0);

  // Namespaced, because Leva's store is global and every demo shares it.
  const config: BlendingCubeConfig = useControls("blending cube", {
    timing: folder({
      stageSeconds: { value: d.stageSeconds, min: 0.6, max: 6, step: 0.1 },
      blendSeconds: { value: d.blendSeconds, min: 0.1, max: 3, step: 0.05 },
      spin: { value: d.spin, min: 0, max: 0.4, step: 0.005 },
      bounce: { value: d.bounce, min: 0, max: 0.5, step: 0.01 },
    }),
    colour: folder({
      plain: { value: d.plain },
      metal: { value: d.metal },
      edge: { value: d.edge },
      lineWidth: { value: d.lineWidth, min: 0.5, max: 6, step: 0.1 },
      floor: { value: d.floor },
      plinth: { value: d.plinth, min: 0.8, max: 6, step: 0.1 },
      plainRoughness: { value: d.plainRoughness, min: 0, max: 1, step: 0.01 },
      metalRoughness: { value: d.metalRoughness, min: 0, max: 1, step: 0.01 },
    }),
    light: folder({
      ambient: { value: d.ambient, min: 0, max: 2, step: 0.01 },
      keyIntensity: { value: d.keyIntensity, min: 0, max: 10, step: 0.1 },
      envIntensity: { value: d.envIntensity, min: 0, max: 4, step: 0.05 },
      shadowOpacity: { value: d.shadowOpacity, min: 0, max: 1, step: 0.01 },
      shadowBlur: { value: d.shadowBlur, min: 0, max: 8, step: 0.1 },
    }),
  });

  return (
    <>
      <ControlsToggle />

      <div className="absolute inset-0">
        {support === "yes" ? (
          <BlendingCubeCanvasScene config={config} onStage={setStage} />
        ) : null}
      </div>

      {/* Sits under the title plate, in the same mono the eyebrow uses, so it
          reads as a running commentary rather than a caption on an image. */}
      <div className="pointer-events-none absolute bottom-6 left-1/2 z-30 -translate-x-1/2">
        <div className="rounded-full border border-border bg-background/80 px-4 py-2 font-mono text-[12px] tracking-[0.08em] text-muted-foreground backdrop-blur-sm">
          {STAGE_CAPTIONS[stage] ?? STAGE_CAPTIONS[0]}
        </div>
      </div>
    </>
  );
}
