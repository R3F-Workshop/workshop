"use client";

import { useRef } from "react";
import { Canvas, useFrame } from "@react-three/fiber/webgpu";
import type { Mesh } from "three";

import { DepthAttachmentSync } from "@/components/three/depth-attachment-sync";
import { useWebGPU } from "@/lib/use-webgpu";

/**
 * This canvas's id. It matters: the hero is the site's *primary* canvas — it
 * owns the shared `WebGPURenderer`, and every `SectionCanvas` below waits on
 * `waitForPrimary("main")` before mounting. Whatever scene replaces the
 * pyramid must keep declaring `id="main"` or the rest of the page stays on
 * its posters.
 */
const PRIMARY = "main";

/** The starting point: replace me with something worth looking at. */
function Pyramid() {
  const ref = useRef<Mesh>(null);

  useFrame((_, delta) => {
    if (ref.current) ref.current.rotation.y += delta * 0.5;
  });

  return (
    // A four-sided cone is a pyramid. `flatShading` keeps the facets crisp.
    <mesh ref={ref} position={[0, -0.4, 0]}>
      <coneGeometry args={[1.5, 1.9, 4]} />
      <meshStandardMaterial
        color="#96a0c8"
        flatShading
        metalness={0.35}
        roughness={0.4}
      />
    </mesh>
  );
}

/**
 * The placeholder hero scene. Deliberately the smallest possible primary
 * canvas: transparent, one mesh, two lights. The finished pipeline this
 * stands in for lives in `resources/hero-demo/` (and on the `final-version`
 * branch) — see `resources/README.md` for how to bring it back.
 */
export function PyramidHero() {
  const support = useWebGPU();

  // No WebGPU: stay unmounted. The CSS sky behind this layer holds the frame,
  // and with no primary canvas the section canvases keep their posters too —
  // the same degradation story as the finished site.
  if (support !== "yes") return null;

  return (
    <Canvas
      id={PRIMARY}
      camera={{ position: [0, 0.7, 5.2], fov: 40 }}
      dpr={[1, 2]}
      renderer={{ alpha: true, antialias: true }}
      style={{ pointerEvents: "none" }}
    >
      <DepthAttachmentSync />
      <ambientLight intensity={0.55} color="#b8c4ee" />
      <directionalLight position={[4, 6, 3]} intensity={2.2} color="#ffd9a0" />
      <directionalLight position={[-5, 2, -4]} intensity={0.6} color="#6d7dc4" />
      <Pyramid />
    </Canvas>
  );
}
