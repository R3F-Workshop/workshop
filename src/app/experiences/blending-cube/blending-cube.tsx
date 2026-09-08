"use client";

import { ContactShadows, Edges, RoundedBox } from "@react-three/drei/webgpu";
import { Canvas, EnvironmentMap, useFrame } from "@react-three/fiber/webgpu";
import { useEffect, useMemo, useRef, useState } from "react";
import * as THREE from "three/webgpu";

import { createStudioEnvironment, type StudioOptions } from "@/app/home/components/canvas/studio-env";
import { useWebGPU } from "@/lib/use-webgpu";

/**
 * One box, gaining a capability at a time.
 *
 * The whole experience: a canvas, the scene inside it, and the caption under
 * it. Drop `<BlendingCube />` into any box and it fills it.
 *
 * The card this sits in claims the ecosystem is the multiplier, so the demo is
 * the same mesh throughout. Nothing is swapped out, only added, and each stage
 * is named after the thing that was actually added.
 *
 * The fourth and fifth stages are the point of the whole loop. `metalness = 1`
 * arrives first and the cube goes nearly black, because a metal has no diffuse
 * term and there is nothing yet for it to reflect. The environment arrives
 * after and the gold appears.
 *
 * Everything animates by mutating refs inside `useFrame`. Driving it through
 * React state would re-render the tree sixty times a second for values that
 * never touch the DOM.
 */

/** Seconds a stage holds, and how long the crossfade into the next one takes. */
const STAGE_SECONDS = 2.2;
const BLEND_SECONDS = 0.9;

const STAGES = [
  // The plane is set dressing, not a stage. A contact shadow needs a surface
  // to land on, and naming it here keeps the first caption honest.
  { caption: "RoundedBox + plane", edges: 0, shadow: 0, metal: 0, env: 0 },
  { caption: "+ Edges", edges: 1, shadow: 0, metal: 0, env: 0 },
  { caption: "+ ContactShadows", edges: 1, shadow: 1, metal: 0, env: 0 },
  { caption: "+ metalness", edges: 1, shadow: 1, metal: 1, env: 0 },
  { caption: "+ Environment", edges: 1, shadow: 1, metal: 1, env: 1 },
];

const SIZE = 1.35;
// Small on purpose. The rounding is what lets the metal stage work, but a
// twelve-edge box outline can never sit flush on a rounded surface. Keeping
// the radius tight shrinks that mismatch to about a pixel while still giving
// the edges a band of turning normals to catch the softboxes with.
const RADIUS = 0.05;

/**
 * A tab left in the background accumulates no frames, but `delta` still counts
 * the wall clock. Without this the loop jumps several stages on return.
 */
const MAX_DT = 1 / 20;

/**
 * Lit for a subject that turns: boxes spread around the azimuth so a rotating
 * face is always sliding into or out of one, which is what makes the metal
 * stage read as metal rather than as a flat gold swatch.
 *
 * A cube face is flat: it samples exactly one direction and returns exactly
 * one colour. A near-black sky and three quarters of the cube is a silhouette.
 * A bright even sky and every face comes back the same mid value, which reads
 * as tan plastic. What works is a dark sky with several small, bright, well
 * separated sources.
 */
const CUBE_ENV: StudioOptions = {
  ground: [0.015, 0.015, 0.02],
  sky: [0.055, 0.062, 0.085],
  falloff: 0.8,
  horizon: 0.3,
  softboxes: [
    // Key, behind the camera, because that is where a flat face pointing at
    // the camera sends its reflect vector. The camera sits near azimuth 51.
    { azimuth: 48, elevation: 24, width: 26, height: 22, intensity: 30, color: [1, 0.91, 0.74] },
    // Kick, small and hot, well off to the side. The travelling glint that
    // arrives as a face swings past is what separates metal from gold paint.
    { azimuth: -60, elevation: 32, width: 14, height: 18, intensity: 60, color: [1, 0.88, 0.64] },
    // Rim, cool, behind the subject, so faces turned away from the key come
    // back blue grey rather than black.
    { azimuth: 182, elevation: 26, width: 30, height: 24, intensity: 18, color: [0.62, 0.74, 1] },
    // Fill, low and opposite the kick, catching the faces that would otherwise
    // sit in the gap between the other three as the cube turns.
    { azimuth: 128, elevation: -6, width: 24, height: 18, intensity: 14, color: [1, 0.86, 0.7] },
  ],
};

/** Smoothstep, the same easing the rest of the site uses for reveals. */
function ease(t: number) {
  const x = Math.min(Math.max(t, 0), 1);
  return x * x * (3 - 2 * x);
}

function Scene({ onStage }: { onStage: (index: number) => void }) {
  const group = useRef<THREE.Group>(null);
  const mesh = useRef<THREE.Mesh>(null);
  const shadow = useRef<THREE.Group>(null);
  // Typed as the ref drei declares, but what lands here is the `Line2` that
  // `Edges` renders. `EdgesRef` describes only the imperative handle.
  const edges = useRef<THREE.Object3D>(null);

  const clock = useRef(0);
  const stage = useRef(-1);

  const texture = useMemo(() => createStudioEnvironment(CUBE_ENV), []);
  useEffect(() => () => texture.dispose(), [texture]);

  const edgeGeometry = useMemo(
    () => new THREE.BoxGeometry(SIZE, SIZE, SIZE),
    [],
  );
  useEffect(() => () => edgeGeometry.dispose(), [edgeGeometry]);

  // Reused each frame so the loop allocates nothing.
  const plain = useMemo(() => new THREE.Color("#8a8a93"), []);
  const metal = useMemo(() => new THREE.Color("#c9a862"), []);

  useFrame(({ scene, delta }) => {
    clock.current += Math.min(delta, MAX_DT);

    const span = STAGES.length * STAGE_SECONDS;
    const t = clock.current % span;
    const index = Math.floor(t / STAGE_SECONDS);
    const local = t - index * STAGE_SECONDS;

    if (index !== stage.current) {
      stage.current = index;
      onStage(index);
    }

    // Hold, then blend into the next stage over the tail of the slot. The last
    // stage blends back to the first, so the loop closes without a cut.
    const from = STAGES[index];
    const to = STAGES[(index + 1) % STAGES.length];
    const k = ease((local - (STAGE_SECONDS - BLEND_SECONDS)) / BLEND_SECONDS);
    const mix = (a: number, b: number) => a + (b - a) * k;

    const edgeAmt = mix(from.edges, to.edges);
    const shadowAmt = mix(from.shadow, to.shadow);
    const metalAmt = mix(from.metal, to.metal);
    const envAmt = mix(from.env, to.env);

    // A squash that peaks just after each stage lands, so the addition has a
    // beat rather than simply appearing.
    const pulse = Math.exp(-(((local / STAGE_SECONDS) * 7) ** 2));
    const squash = 0.14 * pulse;

    const g = group.current;
    if (g) {
      g.rotation.y = clock.current * 0.055 * Math.PI * 2;
      g.position.y = -squash * 0.5;
      g.scale.set(1 + squash * 0.5, 1 - squash, 1 + squash * 0.5);
    }

    const material = mesh.current?.material as
      THREE.MeshStandardMaterial | undefined;
    if (material) {
      material.color.copy(plain).lerp(metal, metalAmt);
      material.metalness = metalAmt;
      // Low enough at the metal end that the softboxes come back as distinct
      // reflections rather than averaging into one wash.
      material.roughness = 0.85 + (0.14 - 0.85) * metalAmt;
    }

    // Mutated straight on the scene rather than through `EnvironmentMap`'s
    // prop, which would mean a React render per frame.
    scene.environmentIntensity = 1.15 * envAmt;

    const line = edges.current as
      (THREE.Object3D & { material?: THREE.Material }) | null;
    if (line?.material) {
      line.material.transparent = true;
      line.material.opacity = edgeAmt;
      line.visible = edgeAmt > 0.01;
    }

    if (shadow.current) {
      shadow.current.visible = shadowAmt > 0.01;
      shadow.current.traverse((o) => {
        const m = (o as THREE.Mesh).material as THREE.Material | undefined;
        if (m && "opacity" in m) m.opacity = 0.8 * shadowAmt;
      });
    }
  });

  return (
    <>
      <EnvironmentMap map={texture} environmentIntensity={0} />

      {/* Enough to read the box's form before the key light arrives, and no
          more. The point of stage three is that the light is missing until then. */}
      <ambientLight intensity={0.35} />
      <directionalLight position={[2.4, 3.4, 2.2]} intensity={2.6} color="#fff2dc" />

      <group ref={group}>
        {/* Rounded, and that is the whole reason the metal stage works at all.
            A flat face has one normal: it samples one direction and comes back
            one flat value, so a hard-edged metal cube reads as tan paint no
            matter what the environment does. The rounding gives each edge a
            band of continuously turning normals, which sweeps across the
            softboxes as the cube spins, and a moving highlight is what the eye
            reads as metal. */}
        <RoundedBox ref={mesh} args={[SIZE, SIZE, SIZE]} radius={RADIUS} smoothness={6}>
          <meshStandardMaterial color="#8a8a93" roughness={0.85} metalness={0} />
          {/* Given the ideal box rather than the rounded mesh. `EdgesGeometry`
              on a rounded box finds no sharp edges at all, so it would draw
              nothing. This traces the twelve edges the box would have had. */}
          <Edges ref={edges as never} geometry={edgeGeometry} color="#f2ede3" lineWidth={1.6} />
        </RoundedBox>
      </group>

      {/* A contact shadow is a dark pool, and a dark pool on a black background
          is nothing at all. Something has to be lit underneath the cube for the
          shadow stage to read as a change. A disc rather than a plane, since a
          square floor puts its far edge across the frame as a hard diagonal. */}
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, -0.68, 0]}>
        <circleGeometry args={[2.1, 96]} />
        <meshStandardMaterial color="#3a3a46" roughness={0.95} metalness={0} />
      </mesh>

      <group ref={shadow} position={[0, -0.672, 0]}>
        <ContactShadows opacity={0.8} blur={1.6} scale={3.4} far={2.2} resolution={256} color="#000000" />
      </group>
    </>
  );
}

export function BlendingCube() {
  const [stage, setStage] = useState(0);

  // No WebGPU, no experience. The shell around this decides what to show instead.
  if (useWebGPU() !== "yes") return null;

  return (
    <div className="absolute inset-0">
      <Canvas
        camera={{ position: [3.9, 2.7, 4.8], fov: 30 }}
        dpr={[1, 2]}
        renderer={{
          alpha: false,
          antialias: true,
          // The environment is HDR, with softboxes well above 1 so the metal
          // stage has something with range to reflect. Without a tone map they
          // clip to flat white.
          toneMapping: THREE.ACESFilmicToneMapping,
        }}
        style={{ pointerEvents: "none" }}
      >
        <color attach="background" args={["#08080a"]} />
        <Scene onStage={setStage} />
      </Canvas>

      {/* The one thing that crosses back out of the frame loop, and only when
          the stage index changes. */}
      <div className="pointer-events-none absolute bottom-6 left-1/2 z-30 -translate-x-1/2">
        <div className="rounded-full border border-border bg-background/80 px-4 py-2 font-mono text-[12px] tracking-[0.08em] text-muted-foreground backdrop-blur-sm">
          {STAGES[stage].caption}
        </div>
      </div>
    </div>
  );
}
