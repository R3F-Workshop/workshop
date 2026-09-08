"use client";

import {
  Canvas,
  useFrame,
  useLocalNodes,
  useUniforms,
  waitForPrimary,
  type CreatorState,
} from "@react-three/fiber/webgpu";
import { useControls } from "leva";
import { useEffect, useRef, useState } from "react";
import { mix, positionLocal, sin } from "three/tsl";
import type { Color, Mesh, UniformNode } from "three/webgpu";

import { DepthAttachmentSync } from "@/components/depth-attachment-sync";
import { useWebGPU } from "@/lib/use-webgpu";

/**
 * TSL hooks, four of four: across canvases.
 *
 * Two canvases, one renderer, one store. The left canvas declares itself
 * primary with `id`, and the right one borrows its renderer with
 * `renderer.primaryCanvas`. That is how the whole site works: the hero owns
 * the renderer and every section canvas points at it, so a canvas per
 * section costs a swap chain, not a GPU context.
 *
 * The part this demo is for: the store is the primary's. Every hook from the
 * last three demos resolves against it, whichever canvas the component is
 * in. `Dials` runs in the left canvas and declares the scope. `Right` runs
 * in the other canvas and reads it, and it follows the sliders and the pulse
 * with no wiring between the two. On the site that is a Leva panel in the
 * hero driving a material in a section three screens down.
 *
 * The secondary waits for the primary to register before it mounts. A
 * secondary with no renderer to borrow is an error rather than a fallback,
 * which is why `waitForPrimary` gates it here and in `SectionCanvas`.
 */

const PRIMARY = "hooksPrimary";

type Shared = {
  base: UniformNode<"color", Color>;
  tip: UniformNode<"color", Color>;
  bands: UniformNode<"float", number>;
  /** 0..1, written every frame by `Dials`. */
  pulse: UniformNode<"float", number>;
};

function Dials() {
  const { rate, ...values } = useControls("tsl hooks · canvases", {
    base: "#22222a",
    tip: "#ffd9a0",
    bands: { value: 6, min: 1, max: 24, step: 1 },
    rate: { value: 1.2, min: 0, max: 6, step: 0.05 },
  });

  const u = useUniforms({ ...values, pulse: 0 }, "hooksCanvases") as unknown as Shared;

  const t = useRef(0);
  useFrame((_, delta) => {
    t.current += delta;
    u.pulse.value = Math.sin(t.current * rate) * 0.5 + 0.5;
  });

  return null;
}

/** One graph, built by whichever canvas asks for it. */
function build({ uniforms }: CreatorState) {
  const u = uniforms.scope("hooksCanvases") as unknown as Shared;
  const band = sin(positionLocal.y.mul(u.bands).add(u.pulse.mul(Math.PI)))
    .mul(0.5)
    .add(0.5);
  return { colorNode: mix(u.base, u.tip, band) };
}

function Spinning({ children }: { children: React.ReactNode }) {
  const ref = useRef<Mesh>(null);
  useFrame((_, delta) => {
    if (!ref.current) return;
    ref.current.rotation.x += delta * 0.25;
    ref.current.rotation.y += delta * 0.4;
  });
  return <mesh ref={ref}>{children}</mesh>;
}

function Left() {
  const { colorNode } = useLocalNodes(build);
  return (
    <Spinning>
      <torusKnotGeometry args={[0.9, 0.3, 200, 32]} />
      <meshStandardNodeMaterial colorNode={colorNode} roughness={0.4} />
    </Spinning>
  );
}

function Right() {
  const { colorNode } = useLocalNodes(build);
  return (
    <Spinning>
      <icosahedronGeometry args={[1.2, 0]} />
      <meshStandardNodeMaterial colorNode={colorNode} roughness={0.4} flatShading />
    </Spinning>
  );
}

function Lights() {
  return (
    <>
      <ambientLight intensity={0.5} color="#b8c4ee" />
      <directionalLight position={[4, 6, 3]} intensity={2} color="#ffd9a0" />
    </>
  );
}

function usePrimaryReady(): boolean {
  const [ready, setReady] = useState(false);

  useEffect(() => {
    let alive = true;
    waitForPrimary(PRIMARY, 15_000)
      .then(() => {
        if (alive) setReady(true);
      })
      // Timed out: the primary never came up, so there is nothing to borrow.
      .catch(() => {});
    return () => {
      alive = false;
    };
  }, []);

  return ready;
}

export function HooksCanvases() {
  const support = useWebGPU();
  const ready = usePrimaryReady();

  // No WebGPU, no experience. The shell around this decides what to show instead.
  if (support !== "yes") return null;

  return (
    <div className="absolute inset-0 flex">
      <div className="relative flex-1">
        <Canvas
          id={PRIMARY}
          camera={{ position: [0, 0, 6], fov: 35 }}
          dpr={[1, 2]}
          forceEven
          renderer={{ alpha: false, antialias: true }}
        >
          <DepthAttachmentSync />
          <color attach="background" args={["#08080a"]} />
          <Lights />
          <Dials />
          <Left />
        </Canvas>
      </div>
      <div className="relative flex-1 border-l border-border">
        {ready ? (
          <Canvas
            camera={{ position: [0, 0, 6], fov: 35 }}
            dpr={[1, 2]}
            forceEven
            renderer={{
              alpha: false,
              antialias: true,
              primaryCanvas: PRIMARY,
              // Draw after the primary, so the pulse it wrote is what we read.
              scheduler: { after: PRIMARY },
            }}
          >
            <DepthAttachmentSync />
            <color attach="background" args={["#0c0c10"]} />
            <Lights />
            <Right />
          </Canvas>
        ) : null}
      </div>
    </div>
  );
}
