"use client";

import { useRef } from "react";
import { useFrame, useThree } from "@react-three/fiber/webgpu";

import type { HeroGateController, HeroGateState } from "@/lib/hero-gate";

/** Maximum frame delta that counts toward warmup completion. */
const SETTLED_DELTA = 0.04;
/** Consecutive smooth frames before the scene counts as warmed up. */
const SETTLED_STREAK = 12;
/** Maximum warmup duration before the scene is revealed. */
const WARMUP_BUDGET = 8;
/** Two frames confirm the selected pose reached WebGPU presentation. */
const POSE_CONFIRMATION_FRAMES = 2;
/** Run before intro consumers in the update phase. */
const HANDOFF_PRIORITY = 100;

/** R3F's state type is shared with WebGL, but this module uses its WebGPU entry. */
function getRenderCallCount(renderer: { info: unknown }): number {
  return (renderer.info as { calls: number }).calls;
}

/**
 * Warms the scene behind the loading overlay.
 *
 * It measures frame pacing after assets resolve and confirms the selected pose
 * before allowing the overlay to exit. Demand rendering continues until each
 * phase completes.
 */
export function WarmupProbe({
  gate,
  replayIntro,
  maxFps = 0,
}: {
  gate: HeroGateController;
  replayIntro: boolean;
  /** Match the canvas render job; zero means both remain uncapped. */
  maxFps?: number;
}) {
  const invalidate = useThree((state) => state.invalidate);
  const elapsed = useRef(0);
  const streak = useRef(0);
  const confirmationFrames = useRef(0);
  const confirmingState = useRef<HeroGateState | null>(null);
  const lastRenderCall = useRef(0);
  const frameRate = maxFps > 0 ? { fps: maxFps } : {};

  useFrame(
    ({ renderer }, delta) => {
      const gateState = gate.getState();

      if (
        gateState === "priming-final" &&
        confirmingState.current !== gateState
      ) {
        // Confirm the final pose before the overlay continues fading.
        confirmingState.current = gateState;
        confirmationFrames.current = POSE_CONFIRMATION_FRAMES;
        lastRenderCall.current = getRenderCallCount(renderer);
        invalidate();
        return;
      }

      if (gateState !== "warming") return;

      elapsed.current += delta;
      streak.current = delta <= SETTLED_DELTA ? streak.current + 1 : 0;

      if (streak.current < SETTLED_STREAK && elapsed.current < WARMUP_BUDGET) {
        invalidate();
        return;
      }

      gate.warmupFinished(replayIntro);
      if (gate.getState() === "priming-intro") {
        // IntroClock applies time zero before the renderer submits the scene.
        confirmingState.current = "priming-intro";
        confirmationFrames.current = POSE_CONFIRMATION_FRAMES;
        lastRenderCall.current = getRenderCallCount(renderer);
        invalidate();
      }
    },
    { phase: "update", priority: HANDOFF_PRIORITY, ...frameRate },
  );

  useFrame(
    ({ renderer }) => {
      if (confirmationFrames.current === 0) return;

      if (gate.getState() !== confirmingState.current) {
        confirmationFrames.current = 0;
        confirmingState.current = null;
        return;
      }

      // Finish-phase callbacks still run at the display's refresh rate when
      // the render job is capped. Only count a confirmation when Three's
      // monotonic render-call counter proves that the selected pose was
      // actually submitted during this scheduler frame.
      const renderCall = getRenderCallCount(renderer);
      if (renderCall === lastRenderCall.current) {
        invalidate();
        return;
      }
      lastRenderCall.current = renderCall;

      confirmationFrames.current -= 1;
      if (confirmationFrames.current > 0) {
        invalidate();
        return;
      }

      // Reveal after WebGPU submits the selected pose twice.
      confirmingState.current = null;
      gate.poseRendered();
    },
    { phase: "finish", ...frameRate },
  );

  return null;
}
