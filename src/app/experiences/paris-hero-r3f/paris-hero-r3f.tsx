"use client";

import { Canvas } from "@react-three/fiber/webgpu";

import { useWebGPU } from "@/lib/use-webgpu";

/**
 * The Paris hero in React Three Fiber, starting from nothing.
 *
 * Transparent, because on the site it sits over a CSS sky. It is the site's
 * primary canvas: `id="main"` is what every section canvas waits on before it
 * mounts, so keep that whatever the scene becomes.
 */
export function ParisHeroR3f() {
  // No WebGPU, no experience. The shell around this decides what to show instead.
  if (useWebGPU() !== "yes") return null;

  return (
    <div className="absolute inset-0">
      <Canvas
        id="main"
        camera={{ position: [0, 0.7, 5.2], fov: 40 }}
        dpr={[1, 2]}
        renderer={{ alpha: true, antialias: true }}
        style={{ pointerEvents: "none" }}
      >
        <ambientLight intensity={0.55} color="#b8c4ee" />
        <directionalLight position={[4, 6, 3]} intensity={2.2} color="#ffd9a0" />
      </Canvas>
    </div>
  );
}
