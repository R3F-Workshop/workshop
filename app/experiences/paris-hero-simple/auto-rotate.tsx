"use client";

import type { CameraControlsImpl } from "@react-three/drei";
import { useFrame, useThree } from "@react-three/fiber/webgpu";
import { MathUtils } from "three/webgpu";

/** Drifts the default `CameraControls` around its target. drei's `<CameraControls>` has no `autoRotate` prop (OrbitControls does). */
export function AutoRotate({ speed = 1 }: { speed?: number }) {
  const controls = useThree((state) => state.controls) as CameraControlsImpl | null;

  useFrame((_, delta) => {
    if (!controls || speed === 0) return;
    controls.rotate(MathUtils.degToRad(speed) * delta, 0, false);
  });

  return null;
}
