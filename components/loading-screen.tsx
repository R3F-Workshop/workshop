"use client";

import { useEffect, useRef, useState } from "react";

import { Logo } from "@/components/brand/logo";
import {
  heroGate,
  heroGateCanRevealOverlay,
  heroGateOverlayHasExited,
} from "@/lib/hero-gate";

/** Minimum display time prevents dismissal during a logo flip. */
const MIN_SHOW_MS = 800;
/** Maximum wait before bypassing a stalled canvas. */
const MAX_WAIT_MS = 15_000;
/** Keep the counter responsive without re-rendering on every animation frame. */
const PROGRESS_TICK_MS = 100;
/** Hold the completed loading screen for one beat before its exit begins. */
const EXIT_BEAT_MS = 300;
/** Transition fallback for browsers that omit the event. */
const FADE_FALLBACK_MS = 750;

/**
 * Covers the page until the hero confirms its starting pose.
 *
 * It renders before hydration, locks scrolling, and releases intro playback
 * after its opacity transition finishes.
 */
export function LoadingScreen() {
  // Skip the overlay after the gate has completed.
  const [gone, setGone] = useState(() =>
    heroGateOverlayHasExited(heroGate.getState()),
  );
  const [progress, setProgress] = useState(0);
  const rootRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const root = rootRef.current;
    if (!root) return;

    const shownAt = performance.now();
    let fadeTimer: number | undefined;
    let exitBeatTimer: number | undefined;
    let fadeFallback: number | undefined;
    const progressTimer = window.setInterval(() => {
      const elapsed = performance.now() - shownAt;
      setProgress(Math.min(99, Math.floor((elapsed / MAX_WAIT_MS) * 100)));
    }, PROGRESS_TICK_MS);

    const dismiss = () => {
      if (fadeTimer !== undefined) return;
      window.clearInterval(progressTimer);
      setProgress(100);
      fadeTimer = window.setTimeout(
        () => {
          // Restore scrolling when the opacity transition starts.
          exitBeatTimer = window.setTimeout(() => {
            root.dataset.state = "done";
            fadeFallback = window.setTimeout(() => {
              heroGate.overlayExited();
              setGone(true);
            }, FADE_FALLBACK_MS);
          }, EXIT_BEAT_MS);
        },
        Math.max(0, MIN_SHOW_MS - (performance.now() - shownAt)),
      );
    };

    const syncGate = () => {
      const state = heroGate.getState();
      if (heroGateOverlayHasExited(state)) setGone(true);
      else if (heroGateCanRevealOverlay(state)) dismiss();
    };
    const stopWaiting = heroGate.subscribe(syncGate);
    syncGate();

    const backstop = window.setTimeout(() => heroGate.bypass(), MAX_WAIT_MS);

    return () => {
      stopWaiting();
      window.clearTimeout(backstop);
      window.clearTimeout(fadeTimer);
      window.clearTimeout(exitBeatTimer);
      window.clearTimeout(fadeFallback);
      window.clearInterval(progressTimer);
    };
  }, []);

  if (gone) return null;

  return (
    <div
      ref={rootRef}
      data-loading-screen
      data-state="loading"
      role="progressbar"
      aria-label="Loading"
      aria-valuemin={0}
      aria-valuemax={100}
      aria-valuenow={progress}
      onTransitionEnd={(event) => {
        if (
          event.target === event.currentTarget &&
          event.propertyName === "opacity"
        ) {
          // Start playback after the overlay reaches zero opacity.
          heroGate.overlayExited();
          setGone(true);
        }
      }}
    >
      <div className="flex flex-col items-center gap-7 text-foreground">
        <div className="loading-logo-stage">
          <Logo color="currentColor" className="loading-logo size-12" />
        </div>
        <div className="eyebrow min-w-[4ch] select-none text-center tabular-nums">
          {progress}%
        </div>
      </div>
    </div>
  );
}
