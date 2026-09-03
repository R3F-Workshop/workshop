"use client";

import { Suspense } from "react";
import { Canvas } from "@react-three/fiber/webgpu";

import { DepthAttachmentSync } from "@/components/depth-attachment-sync";
import { Content } from "./content";
import { PostFx } from "./post-fx";
import { Pyramid } from "./pyramid";
import { SceneReady } from "./scene-ready";
import { Stage, type BeaconMode } from "./stage";

/** This canvas's id. */
const PRIMARY = "main";

export interface HeroCanvasProps {
  /** Time of day, 0–24. */
  hour: number;
  autoRotate?: boolean;
  /** The summit beacon: with the sun (default), always on, or off. */
  beacon?: BeaconMode;
  bloom?: boolean;
  bloomStrength?: number;
  treeCount?: number;
  houseCount?: number;
  /** Fires once the scene has rendered a few smooth frames. */
  onReady?: () => void;
}

/** The hero scene: a renderer, a scene, a camera, a loop, a resize observer and an event system, in one tag. */
export function HeroCanvas({
  hour,
  autoRotate = true,
  beacon = "night",
  bloom = true,
  bloomStrength = 0.45,
  treeCount,
  houseCount,
  onReady,
}: HeroCanvasProps) {
  return (
    <Canvas
      id={PRIMARY}
      shadows
      dpr={[1, 2]}
      // Odd/fractional drawing buffers desync the depth attachment from the swap chain: see DepthAttachmentSync.
      forceEven
      camera={{ fov: 30, near: 1, far: 3000, position: [0, 23, 168] }}
      // Transparent so the CSS sky behind it holds the frame until the first frame lands.
      renderer={{ alpha: true, antialias: true, powerPreference: "high-performance" }}
      // Drag rotates: a one-finger touch still scrolls the page.
      style={{ touchAction: "pan-y" }}
    >
      <DepthAttachmentSync />

      <Suspense fallback={<Pyramid position={[0, 12, 0]} scale={11} />}>
        <Stage hour={hour} autoRotate={autoRotate} beacon={beacon} />
        <Content hour={hour} treeCount={treeCount} houseCount={houseCount} />
        {onReady && <SceneReady onReady={onReady} />}
      </Suspense>

      <PostFx bloom={bloom} strength={bloomStrength} />
    </Canvas>
  );
}
