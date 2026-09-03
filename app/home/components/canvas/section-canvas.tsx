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

import { DepthAttachmentSync } from "@/components/depth-attachment-sync";

import { useWebGPU } from "@/lib/use-webgpu";

/** A secondary canvas that shares the hero's WebGPU renderer. */

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
      // Timed out: the hero never came up, so there's no renderer to share.
      .catch(() => {});
    return () => {
      alive = false;
    };
  }, []);

  return ready;
}

const OnScreenContext = createContext(true);

/** Whether the enclosing `SectionCanvas` is near the viewport. */
export function useSectionOnScreen(): boolean {
  return useContext(OnScreenContext);
}

/** Skips this canvas's render pass while it is scrolled out of view. */
function IdleWhenHidden({ jobId, hidden }: { jobId: string; hidden: boolean }) {
  // The no-callback form of `useFrame` is the documented scheduler access.
  const { scheduler } = useFrame();

  useEffect(() => {
    if (!scheduler.getJobIds().includes(jobId)) return;

    if (hidden) scheduler.pauseJob(jobId);
    else scheduler.resumeJob(jobId);

    // Never leave it parked on unmount: the job outlives this effect.
    return () => {
      if (scheduler.getJobIds().includes(jobId)) scheduler.resumeJob(jobId);
    };
  }, [hidden, jobId, scheduler]);

  return null;
}

export function SectionCanvas({
  children,
  /** Section canvases are decoration: they don't need the primary's framerate. */
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
  /** Opt in to pointer events. */
  interactive?: boolean;
}) {
  const support = useWebGPU();
  const ready = usePrimaryReady();
  const mounted = support === "yes" && ready;

  // The render job needs a stable name to be pausable, and the scheduler takes the canvas id as the job id.
  const jobId = "section-" + useId().replace(/[^a-zA-Z0-9_-]/g, "");

  // r3f forwards the Canvas ref to the <canvas> element itself.
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [onScreen, setOnScreen] = useState(true);

  // Freeze the canvas once it scrolls away: same signal the hero uses, per canvas.
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
      // Sections are laid out on a fractional grid, so a bare getBoundingClientRect flaps between e.g. 148.4 and 148.6 as the page scrolls.
      forceEven
      // Interactive canvases keep it: R3F maps pointer coordinates through size.top/left, which goes stale the moment the page scrolls.
      resize={interactive ? undefined : { scroll: false }}
      renderer={{
        alpha: true,
        antialias: true,
        primaryCanvas: PRIMARY,
        // Draw after the hero and honor each scene's explicit frame-rate cap.
        scheduler: { after: PRIMARY, fps },
      }}
      // Backgrounds must never eat clicks or text selection.
      style={
        interactive
          ? { touchAction: "none", cursor: "grab" }
          : { pointerEvents: "none" }
      }
    >
      <IdleWhenHidden jobId={jobId} hidden={!onScreen} />
      <DepthAttachmentSync />
      <OnScreenContext.Provider value={onScreen}>
        {children}
      </OnScreenContext.Provider>
    </Canvas>
  );
}
