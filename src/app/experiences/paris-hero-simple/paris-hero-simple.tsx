"use client";

import { Canvas } from "@react-three/fiber/webgpu";
import { useControls } from "leva";
import { Suspense } from "react";

import { useWebGPU } from "@/lib/use-webgpu";
import { Content } from "./content";
import { PostFx } from "./post-fx";
import { Pyramid } from "./pyramid";
import { Stage, type BeaconMode } from "./stage";

/**
 * The Paris hero, the simple version. About seven hundred lines across this
 * folder, one file per beat of the morning: the canvas, the tower, the stage,
 * two instanced meshes, a sky driven by one number, a useFrame on the beacon,
 * and a post box with bloom in it. The wordmark and the stars ship ready made.
 *
 * `hour` is the one number. It goes through `sun.ts` and comes out as a sun
 * position, a light level and an exposure that the sky, the direct light, the
 * tower glow, the beacon and the stars all read.
 *
 * Transparent, so the CSS sky behind it holds the frame until the first frame
 * lands. `id="main"` makes it the site's primary canvas, which every section
 * canvas waits on before it mounts.
 */

/** `?hour=19.5` deep links a time of day. Solar hours, noon is 12. */
function initialHour() {
  const raw = new URLSearchParams(window.location.search).get("hour");
  const parsed = raw === null ? NaN : Number(raw);
  return Number.isFinite(parsed) ? Math.min(24, Math.max(0, parsed)) : 18.6;
}

export function ParisHeroSimple() {
  const support = useWebGPU();

  const { hour, autoRotate } = useControls("time", {
    hour: { value: initialHour(), min: 0, max: 24, step: 0.05 },
    autoRotate: true,
  });

  const { treeCount, houseCount } = useControls("city", {
    treeCount: { value: 3000, min: 0, max: 12000, step: 250 },
    houseCount: { value: 1200, min: 0, max: 6000, step: 100 },
  });

  const { beacon } = useControls("light", {
    // "on" runs the summit beacon in daylight too: the useFrame, on demand.
    beacon: {
      value: "night" as BeaconMode,
      options: ["night", "on", "off"] as BeaconMode[],
    },
  });

  const { bloom, strength } = useControls("post", {
    bloom: true,
    strength: { value: 0.45, min: 0, max: 3, step: 0.05 },
  });

  // No WebGPU, no experience. The shell around this decides what to show instead.
  if (support !== "yes") return null;

  return (
    <div className="absolute inset-0">
      <Canvas
        id="main"
        shadows
        dpr={[1, 2]}
        camera={{ fov: 30, near: 1, far: 3000, position: [0, 23, 168] }}
        renderer={{ alpha: true, antialias: true, powerPreference: "high-performance" }}
        // Drag rotates. A one finger touch still scrolls the page.
        style={{ touchAction: "pan-y" }}
      >

        <Suspense fallback={<Pyramid position={[0, 12, 0]} scale={11} />}>
          <Stage hour={hour} autoRotate={autoRotate} beacon={beacon} />
          <Content hour={hour} treeCount={treeCount} houseCount={houseCount} />
        </Suspense>

        <PostFx bloom={bloom} strength={strength} />
      </Canvas>
    </div>
  );
}
