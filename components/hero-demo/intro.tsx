"use client";

import { useEffect, useRef, type RefObject } from "react";
import { useFrame, useThree } from "@react-three/fiber/webgpu";

import type { HeroGateController } from "@/lib/hero-gate";

/**
 * Shared clock for the hero entrance.
 * Rendered time and a capped step keep the animation stable.
 */
export const INTRO_COMPLETE = 6.2;
export const LETTER_CHAIN_START = 2.65;
/** The letter chain is past halfway and beginning to settle. */
export const UI_REVEAL_START = 3.72;
/** Delay playback briefly after the start pose renders. */
const INTRO_START_BEAT = 0.3;

const MAX_DT = 1 / 20;
/** Run after gate handoff and before intro clock consumers. */
const INTRO_CLOCK_PRIORITY = 50;

export function IntroClock({
  clock,
  enabled,
  gate,
  onUiReveal,
}: {
  clock: RefObject<number>;
  enabled: boolean;
  /** Coordinates warmup, pose confirmation, overlay exit, and playback. */
  gate?: HeroGateController;
  onUiReveal?: () => void;
}) {
  const invalidate = useThree((state) => state.invalidate);
  const cueSent = useRef(false);
  const beatElapsed = useRef(0);
  // Replay only when mounted during the initial gate sequence.
  const eligibleForPlayback = useRef(
    !gate ||
      gate.getState() === "warming" ||
      gate.getState() === "priming-intro" ||
      gate.getState() === "priming-final" ||
      gate.getState() === "revealing-intro" ||
      gate.getState() === "revealing-final",
  );

  useEffect(() => {
    clock.current = enabled && !gate ? 0 : INTRO_COMPLETE;
    cueSent.current = !enabled;
    if (!enabled) onUiReveal?.();
    // Apply the current pose on the next frame.
    invalidate();
  }, [clock, enabled, gate, invalidate, onUiReveal]);

  useFrame(
    (_, delta) => {
      const revealUi = () => {
        if (cueSent.current) return;
        cueSent.current = true;
        onUiReveal?.();
      };

      if (!enabled) {
        clock.current = INTRO_COMPLETE;
        revealUi();
        if (gate?.getState() === "playing") gate.introFinished();
        return;
      }

      if (gate) {
        const state = gate.getState();

        if (state === "warming") {
          // Hold the final pose while the scene warms behind the overlay.
          clock.current = INTRO_COMPLETE;
          return;
        }

        if (state === "priming-intro" || state === "revealing-intro") {
          // Hold the intro at zero until the overlay exits.
          clock.current = 0;
          beatElapsed.current = 0;
          cueSent.current = false;
          return;
        }

        if (state === "armed" && eligibleForPlayback.current) {
          clock.current = 0;
          beatElapsed.current += Math.min(delta, MAX_DT);
          if (beatElapsed.current >= INTRO_START_BEAT) gate.beatElapsed();
          return;
        }

        if (state !== "playing" || !eligibleForPlayback.current) {
          clock.current = INTRO_COMPLETE;
          revealUi();
          if (state === "armed" || state === "playing") gate.bypass();
          return;
        }
      }

      clock.current = Math.min(
        INTRO_COMPLETE,
        clock.current + Math.min(delta, MAX_DT),
      );

      if (clock.current >= UI_REVEAL_START) revealUi();
      if (clock.current >= INTRO_COMPLETE) gate?.introFinished();
    },
    { phase: "update", priority: INTRO_CLOCK_PRIORITY },
  );

  return null;
}
