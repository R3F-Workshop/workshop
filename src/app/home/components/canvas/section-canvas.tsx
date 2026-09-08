"use client";

import { Canvas, useFrame, waitForPrimary } from "@react-three/fiber/webgpu";
import {
  createContext,
  useContext,
  useEffect,
  useId,
  useRef,
  useState,
  type ReactNode,
} from "react";


import { useWebGPU } from "@/lib/use-webgpu";

/**
 * A secondary canvas.
 *
 * v10 lets every canvas share one `WebGPURenderer`: the hero declares
 * `id="main"` and owns it, everything below points at it with
 * `renderer={{ primaryCanvas: "main" }}`. So a canvas per section costs a swap
 * chain, not a GPU context — which is why the old shared-canvas-plus-`View`
 * design is gone.
 *
 * Two gates before anything mounts:
 *  - WebGPU is available at all (else the caller shows a poster);
 *  - the primary has registered, since a secondary with no renderer to borrow
 *    is an error rather than a fallback.
 */

const PRIMARY = "main";

/** Resume this far outside the viewport, so scrolling in never meets a frozen frame. */
const WAKE_MARGIN = "160px";

function usePrimaryReady(): boolean {
  const [ready, setReady] = useState(false);

  useEffect(() => {
    let alive = true;
    waitForPrimary(PRIMARY, 15_000)
      .then(() => {
        if (alive) setReady(true);
      })
      // Timed out — the hero never came up, so there's no renderer to share.
      // Staying unmounted leaves the poster in place, which is the right answer.
      .catch(() => {});
    return () => {
      alive = false;
    };
  }, []);

  return ready;
}

const OnScreenContext = createContext(true);

/**
 * Whether the enclosing `SectionCanvas` is near the viewport. The canvas's
 * render job is already skipped while this is false; scenes that burn CPU in
 * `useFrame` regardless of rendering (physics, most of all) should read this
 * and stand down too.
 */
export function useSectionOnScreen(): boolean {
  return useContext(OnScreenContext);
}

/**
 * Skips this canvas's render pass while it is scrolled out of view.
 *
 * Job-level for the same reason the hero idles that way (see
 * `useIdleWhenHidden` in tower-hero): `frameloop` writes to the scheduler
 * singleton the whole page shares, so pausing one canvas's job is the only
 * per-canvas idle there is. Only the render job pauses — `useFrame` updates
 * keep their rhythm, so nothing has to reconcile a paused clock on the way
 * back in.
 */
function IdleWhenHidden({ jobId, hidden }: { jobId: string; hidden: boolean }) {
  // The no-callback form of `useFrame` is the documented scheduler access.
  const { scheduler } = useFrame();

  useEffect(() => {
    if (!scheduler.getJobIds().includes(jobId)) return;

    if (hidden) scheduler.pauseJob(jobId);
    else scheduler.resumeJob(jobId);

    // Never leave it parked on unmount — the job outlives this effect.
    return () => {
      if (scheduler.getJobIds().includes(jobId)) scheduler.resumeJob(jobId);
    };
  }, [hidden, jobId, scheduler]);

  return null;
}

export function SectionCanvas({
  children,
  /** Section canvases are decoration; they don't need the primary's framerate. */
  fps = 30,
  className,
  camera,
  orthographic,
  interactive = false,
}: {
  children: ReactNode;
  fps?: number;
  className?: string;
  camera?: Record<string, unknown>;
  orthographic?: boolean;
  /** Opt in to pointer events. Only for canvases the visitor is meant to grab. */
  interactive?: boolean;
}) {
  const support = useWebGPU();
  const ready = usePrimaryReady();
  const mounted = support === "yes" && ready;

  // The render job needs a stable name to be pausable, and the scheduler
  // takes the canvas id as the job id. `useId` guarantees uniqueness across
  // instances; strip React's delimiters so it stays a clean DOM id too.
  const jobId = "section-" + useId().replace(/[^a-zA-Z0-9_-]/g, "");

  // r3f forwards the Canvas ref to the <canvas> element itself.
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [onScreen, setOnScreen] = useState(true);

  // Freeze the canvas once it scrolls away — same signal the hero uses, per
  // canvas. On a page of decorated sections, whatever is off screen is most
  // of them.
  useEffect(() => {
    const el = canvasRef.current;
    if (!el) return;
    const observer = new IntersectionObserver(
      ([entry]) => setOnScreen(entry.isIntersecting),
      { rootMargin: WAKE_MARGIN },
    );
    observer.observe(el);
    return () => observer.disconnect();
  }, [mounted]);

  if (!mounted) return null;

  return (
    <Canvas
      ref={canvasRef}
      id={jobId}
      className={className}
      orthographic={orthographic}
      camera={camera}
      dpr={[1, 1.75]}
      // Sections are laid out on a fractional grid, so a bare
      // getBoundingClientRect flaps between e.g. 148.4 and 148.6 as the page
      // scrolls, and each flip reconfigures the swap chain for nothing.
      // Snapping to even integers makes the measured size stable. Since these
      // canvases are pointer-events: none, re-measuring on scroll buys nothing
      // to begin with. The experiences fill integer sized boxes and skip this.
      forceEven
      // Interactive canvases keep it: R3F maps pointer coordinates through
      // size.top/left, which goes stale the moment the page scrolls.
      resize={interactive ? undefined : { scroll: false }}
      renderer={{
        alpha: true,
        antialias: true,
        primaryCanvas: PRIMARY,
        // Draw after the hero and honor each scene's explicit frame-rate cap.
        scheduler: { after: PRIMARY, fps },
      }}
      // Backgrounds must never eat clicks or text selection. Where a scene
      // needs the cursor it reads it from the window instead. Interactive
      // canvases also claim the drag, so the page doesn't scroll under them.
      style={
        interactive
          ? { touchAction: "none", cursor: "grab" }
          : { pointerEvents: "none" }
      }
    >
      <IdleWhenHidden jobId={jobId} hidden={!onScreen} />
      <OnScreenContext.Provider value={onScreen}>
        {children}
      </OnScreenContext.Provider>
    </Canvas>
  );
}
