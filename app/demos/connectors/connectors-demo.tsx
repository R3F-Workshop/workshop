"use client";

import { folder, useControls } from "leva";
import dynamic from "next/dynamic";
import { useRef, useState } from "react";

import { ControlsToggle } from "@/components/demos/controls-toggle";
import {
  ACCENTS,
  CONNECTORS_DEFAULTS,
  type ConnectorsConfig,
} from "@/components/three/connectors/config";
import type { ShapeKind } from "@/components/three/connectors/shapes";
import { useWebGPU } from "@/lib/use-webgpu";

// `@react-three/fiber/webgpu` touches `localStorage` at module scope, so it can
// never appear in the server render graph.
const ConnectorsDemoScene = dynamic(
  () => import("./scene").then((m) => m.ConnectorsDemoScene),
  { ssr: false },
);

const d = CONNECTORS_DEFAULTS;

/**
 * The interactive half of the demo page: the canvas, its controls, and the
 * element the cursor is measured against.
 *
 * Click anywhere to cycle the accent, which is the original's one interaction
 * beyond the cursor. It lives here rather than on the canvas because the canvas
 * doesn't take pointer events — the click is caught by this wrapper instead.
 */
export function ConnectorsDemo() {
  const bounds = useRef<HTMLDivElement>(null);
  const support = useWebGPU();
  const [accent, setAccent] = useState(0);

  // Namespaced, because Leva's store is global and every demo shares it.
  const config = useControls("connectors", {
    bodies: folder({
      shape: { value: d.shape, options: ["logo", "dot", "cross"] },
      count: { value: d.count, min: 3, max: 40, step: 1 },
      scale: { value: d.scale, min: 0.15, max: 1.6, step: 0.01 },
    }),
    container: folder({
      pull: { value: d.pull, min: 0, max: 1.5, step: 0.01 },
      spreadX: { value: d.spreadX, min: 0, max: 1, step: 0.01 },
      centerY: { value: d.centerY, min: -4, max: 4, step: 0.05 },
      linearDamping: { value: d.linearDamping, min: 0, max: 20, step: 0.1 },
      angularDamping: { value: d.angularDamping, min: 0, max: 20, step: 0.1 },
      pointerRadius: { value: d.pointerRadius, min: 0.1, max: 4, step: 0.05 },
    }),
    surface: folder({
      dark: d.dark,
      light: d.light,
      accentLight: { value: d.accentLight, min: 0, max: 20, step: 0.1 },
      roughness: { value: d.roughness, min: 0, max: 1, step: 0.01 },
      metalness: { value: d.metalness, min: 0, max: 1, step: 0.01 },
    }),
    glass: folder({
      glassThickness: { value: d.glassThickness, min: 0, max: 4, step: 0.05 },
      glassRoughness: { value: d.glassRoughness, min: 0, max: 1, step: 0.01 },
      glassIor: { value: d.glassIor, min: 1, max: 2.4, step: 0.01 },
    }),
    environment: folder({
      keyIntensity: { value: d.keyIntensity, min: 0, max: 60, step: 0.1 },
      kickIntensity: { value: d.kickIntensity, min: 0, max: 60, step: 0.1 },
      fillIntensity: { value: d.fillIntensity, min: 0, max: 10, step: 0.1 },
      envIntensity: { value: d.envIntensity, min: 0, max: 4, step: 0.05 },
    }),
  });

  // Leva types a select as plain `string`, so the union has to be restored on
  // the way out. Narrowing the one field beats casting the whole object. The
  // accent isn't a Leva control at all — it's the click, so it's merged in here.
  const scene: ConnectorsConfig = {
    ...config,
    shape: config.shape as ShapeKind,
    accent: ACCENTS[accent],
  };

  return (
    <>
      <ControlsToggle />
      <div
        ref={bounds}
        onClick={() => setAccent((i) => (i + 1) % ACCENTS.length)}
        className="absolute inset-0"
      >
        {support === "yes" ? (
          <ConnectorsDemoScene config={scene} bounds={bounds} />
        ) : null}
      </div>
    </>
  );
}
