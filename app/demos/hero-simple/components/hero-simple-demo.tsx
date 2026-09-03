"use client";

import dynamic from "next/dynamic";

import { ControlsToggle } from "@/app/demos/components/controls-toggle";
import { WebGPUGate } from "@/app/demos/components/webgpu-gate";

// `@react-three/fiber/webgpu` touches `localStorage` at module scope, so it can never appear in the server render graph.
const HeroSimpleScene = dynamic(
  () => import("./scene").then((m) => m.HeroSimpleScene),
  { ssr: false },
);

export function HeroSimpleDemo() {
  return (
    <>
      <ControlsToggle />
      <div className="absolute inset-0">
        <WebGPUGate>
          <HeroSimpleScene />
        </WebGPUGate>
      </div>
    </>
  );
}
