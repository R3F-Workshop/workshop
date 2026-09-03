"use client";

import { useEffect, useRef } from "react";
import { useFrame, useThree } from "@react-three/fiber/webgpu";
import type { CameraControlsImpl } from "@react-three/drei";
import * as THREE from "three/webgpu";

export interface PerfSample {
  fps: number;
  /** Mean CPU frame time over the sample window, ms. */
  ms: number;
  drawCalls: number;
  triangles: number;
  /** Diagnostics: see the note below on why these are here. */
  hasControls: boolean;
  cameraPos: [number, number, number];
  target: [number, number, number];
  distance: number;
  near: number;
  far: number;
}

const r2 = (v: number) => Math.round(v * 100) / 100;

/** Frame-time, geometry and camera-state readout, sampled once a second. */
export function PerfProbe({ onSample }: { onSample: (s: PerfSample) => void }) {
  const renderer = useThree((state) => state.renderer);
  const camera = useThree((state) => state.camera);
  const controls = useThree((state) => state.controls) as CameraControlsImpl;
  const frames = useRef(0);
  const accum = useRef(0);
  const report = useRef(onSample);

  useEffect(() => {
    report.current = onSample;
  }, [onSample]);

  useFrame((_, delta) => {
    frames.current += 1;
    accum.current += delta;

    if (accum.current < 1) return;

    const info = (renderer as { info?: { render?: Record<string, number> } })
      .info;

    const cam = camera as THREE.PerspectiveCamera;
    const tgt = controls?.getTarget?.(new THREE.Vector3());

    report.current({
      fps: Math.round(frames.current / accum.current),
      ms: Number(((accum.current / frames.current) * 1000).toFixed(2)),
      drawCalls: info?.render?.drawCalls ?? 0,
      triangles: info?.render?.triangles ?? 0,
      hasControls: Boolean(controls),
      cameraPos: [r2(cam.position.x), r2(cam.position.y), r2(cam.position.z)],
      target: tgt ? [r2(tgt.x), r2(tgt.y), r2(tgt.z)] : [0, 0, 0],
      distance: r2(controls?.distance ?? 0),
      near: r2(cam.near ?? 0),
      far: r2(cam.far ?? 0),
    });

    frames.current = 0;
    accum.current = 0;
  });

  return null;
}
