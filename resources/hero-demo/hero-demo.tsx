"use client";

import dynamic from "next/dynamic";
import { useCallback, useState } from "react";

import { ControlsToggle } from "@/components/demos/controls-toggle";
import type { PerfSample } from "./perf-probe";

/**
 * `@react-three/fiber/webgpu` touches `localStorage` at module scope, so nothing
 * 3D can appear in the server render graph — same client-only boundary the rest
 * of the site uses via `components/three/scenes.tsx`.
 */
const HeroDemoScene = dynamic(
  () => import("./scene").then((m) => m.HeroDemoScene),
  { ssr: false },
);

const EMPTY: PerfSample = {
  fps: 0,
  ms: 0,
  drawCalls: 0,
  triangles: 0,
  hasControls: false,
  cameraPos: [0, 0, 0],
  target: [0, 0, 0],
  distance: 0,
  near: 0,
  far: 0,
};

const vec = (v: [number, number, number]) => v.join(", ");

/**
 * The tower scene with the full Leva surface, dressed as a demo page: the
 * panel sits behind the site's standard `ControlsToggle` (Leva mounts exactly
 * once, top-right, one click away) instead of being always-up lab chrome.
 *
 * The perf readout stays — it's part of what this page teaches (the pipeline
 * budget) and it doubles as the liveness/framing diagnostic that debugged the
 * camera more than once. Positioned under the page title, out of the way of
 * the info button (bottom-left) and the controls button (top-right).
 */
export function HeroDemo() {
  const [perf, setPerf] = useState<PerfSample>(EMPTY);
  const onSample = useCallback((s: PerfSample) => setPerf(s), []);

  return (
    <>
      <div className="absolute inset-0">
        <HeroDemoScene onSample={onSample} />
      </div>

      <ControlsToggle />

      <div className="pointer-events-none absolute top-[7.5rem] left-5 z-20 font-mono text-[11px] leading-relaxed tracking-[0.06em] text-white/60 sm:top-[8.5rem]">
        <div className="tabular-nums">
          {perf.fps} fps · {perf.ms.toFixed(2)} ms
        </div>
        {/* `renderer.info` reports the last pass, so under the post pipeline
            this is the present quad, not the scene. Kept as a liveness signal. */}
        <div className="tabular-nums text-white/40">
          {perf.drawCalls.toLocaleString()} draws ·{" "}
          {perf.triangles.toLocaleString()} tris <span>(final pass)</span>
        </div>
        <div className="mt-1.5 text-white/40">
          controls:{" "}
          <span className={perf.hasControls ? "text-white/60" : "text-red-400"}>
            {perf.hasControls ? "yes" : "NONE"}
          </span>
        </div>
        <div className="tabular-nums text-white/40">
          cam [{vec(perf.cameraPos)}]
        </div>
        <div className="tabular-nums text-white/40">
          tgt [{vec(perf.target)}] · dist {perf.distance}
        </div>
        <div className="tabular-nums text-white/40">
          near {perf.near} · far {perf.far}
        </div>
      </div>
    </>
  );
}
