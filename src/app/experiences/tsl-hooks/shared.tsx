"use client";

import {
  Canvas,
  useFrame,
  useLocalNodes,
  useUniforms,
  type CreatorState,
} from "@react-three/fiber/webgpu";
import { useControls } from "leva";
import { useRef } from "react";
import { float, mix, normalView, sin, uv } from "three/tsl";
import type { Color, Mesh, UniformNode } from "three/webgpu";

import { DepthAttachmentSync } from "@/components/depth-attachment-sync";
import { useWebGPU } from "@/lib/use-webgpu";

/**
 * TSL hooks, two of four: shared uniforms.
 *
 * One scope, one writer, three readers. `Dials` declares the `hooksShared`
 * scope from Leva and writes one more value into it every frame. `Orb`,
 * `Slab` and `Ring` never see Leva or the frame loop. Each builds its own
 * material from the scope, and each uses the values differently. Move a
 * slider, or just watch the pulse, and all three follow, because there is
 * exactly one copy of each number and it lives in the store.
 *
 * The frame write is the part worth reading twice. `pulse` is declared as 0
 * and overwritten in `useFrame` through the node the hook hands back. A
 * re-render puts the 0 back for an instant, and the next frame's write lands
 * before anything draws, so it costs nothing. The only rule is that the
 * frame loop must write it every frame. A value written once and then left
 * alone would be reset by the next slider drag. For a vector, pass the same
 * object every render and mutate it instead; the flip grid's cursor does
 * that.
 *
 * The readers use the builder form of `useLocalNodes`. The other way to read
 * a scope is `useUniforms("hooksShared")`, which hands the nodes back for
 * use outside a builder.
 */

/** The scope, as the store hands it back. */
type Shared = {
  base: UniformNode<"color", Color>;
  tip: UniformNode<"color", Color>;
  /** How strongly the rim picks up the tip colour. */
  sheen: UniformNode<"float", number>;
  /** 0..1, written every frame by `Dials`. */
  pulse: UniformNode<"float", number>;
};

function Dials() {
  const { rate, ...values } = useControls("tsl hooks · shared", {
    base: "#22222a",
    tip: "#ffd9a0",
    sheen: { value: 0.7, min: 0, max: 1, step: 0.01 },
    // CPU only. Not every dial has to be a uniform.
    rate: { value: 1.2, min: 0, max: 6, step: 0.05 },
  });

  const u = useUniforms({ ...values, pulse: 0 }, "hooksShared") as unknown as Shared;

  const t = useRef(0);
  useFrame((_, delta) => {
    t.current += delta;
    u.pulse.value = Math.sin(t.current * rate) * 0.5 + 0.5;
  });

  return null;
}

function orbBuild({ uniforms }: CreatorState) {
  const u = uniforms.scope("hooksShared") as unknown as Shared;
  // Rim: bright where the surface turns away from the eye.
  const rim = float(1).sub(normalView.z.abs()).pow(2);
  return {
    colorNode: mix(u.base, u.tip, rim.mul(u.sheen)),
    emissiveNode: u.tip.mul(u.pulse).mul(0.35),
  };
}

function slabBuild({ uniforms }: CreatorState) {
  const u = uniforms.scope("hooksShared") as unknown as Shared;
  // Bands across the face that slide with the pulse.
  const band = sin(uv().y.mul(18).add(u.pulse.mul(Math.PI))).step(0.2);
  return { colorNode: mix(u.base, u.tip, band.mul(u.sheen)) };
}

function ringBuild({ uniforms }: CreatorState) {
  const u = uniforms.scope("hooksShared") as unknown as Shared;
  // The whole ring breathes between the two colours.
  return { colorNode: mix(u.base, u.tip, u.pulse.mul(u.sheen)) };
}

function Orb() {
  const nodes = useLocalNodes(orbBuild);
  return (
    <mesh position={[-2.3, 0, 0]}>
      <icosahedronGeometry args={[0.9, 4]} />
      <meshStandardNodeMaterial {...nodes} roughness={0.35} />
    </mesh>
  );
}

function Slab() {
  const nodes = useLocalNodes(slabBuild);
  const ref = useRef<Mesh>(null);
  useFrame((_, delta) => {
    if (ref.current) ref.current.rotation.y += delta * 0.4;
  });
  return (
    <mesh ref={ref}>
      <boxGeometry args={[1.3, 1.6, 1.3]} />
      <meshStandardNodeMaterial {...nodes} roughness={0.5} />
    </mesh>
  );
}

function Ring() {
  const nodes = useLocalNodes(ringBuild);
  const ref = useRef<Mesh>(null);
  useFrame((_, delta) => {
    if (ref.current) ref.current.rotation.x += delta * 0.5;
  });
  return (
    <mesh ref={ref} position={[2.3, 0, 0]}>
      <torusGeometry args={[0.75, 0.28, 32, 96]} />
      <meshStandardNodeMaterial {...nodes} roughness={0.3} metalness={0.2} />
    </mesh>
  );
}

export function HooksShared() {
  // No WebGPU, no experience. The shell around this decides what to show instead.
  if (useWebGPU() !== "yes") return null;

  return (
    <div className="absolute inset-0">
      <Canvas
        camera={{ position: [0, 0, 8], fov: 35 }}
        dpr={[1, 2]}
        forceEven
        renderer={{ alpha: false, antialias: true }}
      >
        <DepthAttachmentSync />
        <color attach="background" args={["#08080a"]} />
        <ambientLight intensity={0.5} color="#b8c4ee" />
        <directionalLight position={[4, 6, 3]} intensity={2} color="#ffd9a0" />
        {/* The writer renders first. The store is filled synchronously in that
            render, so the readers never see an empty scope. */}
        <Dials />
        <Orb />
        <Slab />
        <Ring />
      </Canvas>
    </div>
  );
}
