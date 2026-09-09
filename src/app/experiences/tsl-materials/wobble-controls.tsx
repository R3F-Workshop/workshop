"use client";

import { useCallback, useSyncExternalStore } from "react";
import { useFrame } from "@react-three/fiber/webgpu";

import { cn } from "@/lib/utils";

/**
 * Play and pause buttons for the three wobble jobs, rendered outside the
 * Canvas.
 *
 * `useFrame` with no callback registers nothing. It hands back the controls
 * object anyway, and the `scheduler` on it is the global one, so ordinary
 * React on the page side of the Canvas can reach every named job in it.
 * Each button subscribes to its job through `subscribeJobState` and reads
 * `isJobPaused` as the snapshot, which is exactly the pair
 * `useSyncExternalStore` wants, so a flip from anywhere re-renders the
 * button.
 *
 * The jobs register in layout effects inside the Canvas, so for a moment
 * after mount they do not exist. The scheduler treats an unknown id as not
 * paused and ignores a pause or resume for it, so the buttons need no guard
 * of their own.
 */

const JOBS = [
  { id: "tslWobble:sphere", label: "sphere" },
  { id: "tslWobble:box", label: "box" },
  { id: "tslWobble:pyramid", label: "pyramid" },
];

function JobButton({ id, label }: { id: string; label: string }) {
  const { scheduler } = useFrame();

  const paused = useSyncExternalStore(
    useCallback((onChange: () => void) => scheduler.subscribeJobState(id, onChange), [scheduler, id]),
    () => scheduler.isJobPaused(id),
    () => false,
  );

  return (
    <button
      type="button"
      onClick={() => (paused ? scheduler.resumeJob(id) : scheduler.pauseJob(id))}
      aria-pressed={paused}
      className={cn(
        "rounded-md border px-2 py-1 font-mono text-[10.5px] transition-colors",
        paused
          ? "border-foreground/40 text-foreground"
          : "border-border text-faint hover:border-foreground/25 hover:text-foreground",
      )}
    >
      {paused ? "play" : "pause"} {label}
    </button>
  );
}

export function WobbleControls() {
  return (
    <div className="pointer-events-auto absolute bottom-5 left-5 z-30 flex gap-2 rounded-lg bg-background/70 px-3 py-2 backdrop-blur-sm">
      {JOBS.map((job) => (
        <JobButton key={job.id} {...job} />
      ))}
    </div>
  );
}
