"use client";

import { useEffect, useRef, useState } from "react";

import { Logo } from "@/components/brand/logo";
import { heroReady } from "@/lib/hero-ready";

/** Minimum display time, so it never flashes. */
const MIN_SHOW_MS = 800;
/** Maximum wait before giving up on a stalled canvas. */
const MAX_WAIT_MS = 12_000;
/** Transition fallback for browsers that omit the event. */
const FADE_FALLBACK_MS = 750;

/** Covers the page until the hero has rendered. */
export function LoadingScreen() {
  const [gone, setGone] = useState(() => heroReady.get());
  const rootRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const root = rootRef.current;
    if (!root) return;

    const shownAt = performance.now();
    let fadeTimer: number | undefined;
    let fallbackTimer: number | undefined;

    const dismiss = () => {
      if (fadeTimer !== undefined) return;
      const wait = Math.max(0, MIN_SHOW_MS - (performance.now() - shownAt));
      fadeTimer = window.setTimeout(() => {
        root.dataset.state = "done";
        fallbackTimer = window.setTimeout(() => setGone(true), FADE_FALLBACK_MS);
      }, wait);
    };

    const unsubscribe = heroReady.subscribe(dismiss);
    if (heroReady.get()) dismiss();
    const backstop = window.setTimeout(dismiss, MAX_WAIT_MS);

    return () => {
      unsubscribe();
      window.clearTimeout(backstop);
      window.clearTimeout(fadeTimer);
      window.clearTimeout(fallbackTimer);
    };
  }, []);

  if (gone) return null;

  return (
    <div
      ref={rootRef}
      data-loading-screen
      data-state="loading"
      role="status"
      aria-label="Loading"
      onTransitionEnd={(event) => {
        if (
          event.target === event.currentTarget &&
          event.propertyName === "opacity"
        ) {
          setGone(true);
        }
      }}
    >
      <div className="loading-logo-stage text-foreground">
        <Logo color="currentColor" className="loading-logo size-12" />
      </div>
    </div>
  );
}
