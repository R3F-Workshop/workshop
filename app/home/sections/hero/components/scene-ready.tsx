"use client";

import { useRef } from "react";
import { useFrame } from "@react-three/fiber/webgpu";

/** Consecutive smooth frames before the scene counts as warmed up. */
const SETTLED_STREAK = 8;
/** A frame slower than this is still compiling something. */
const SETTLED_DELTA = 0.05;
/** Give up waiting and reveal whatever we have. */
const BUDGET = 6;

/**
 * Reports when the scene is actually on screen.
 *
 * Mount it inside the `<Suspense>` so it can't start counting until the
 * model and the font have loaded. The first frames after that are the shader
 * compile — long stalls — so it waits for a run of smooth ones. That is the
 * moment the loading screen can let go.
 */
export function SceneReady({ onReady }: { onReady: () => void }) {
  const streak = useRef(0);
  const elapsed = useRef(0);
  const done = useRef(false);

  useFrame((_, delta) => {
    if (done.current) return;
    elapsed.current += delta;
    streak.current = delta <= SETTLED_DELTA ? streak.current + 1 : 0;
    if (streak.current >= SETTLED_STREAK || elapsed.current >= BUDGET) {
      done.current = true;
      onReady();
    }
  });

  return null;
}
