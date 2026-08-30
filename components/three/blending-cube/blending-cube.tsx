"use client";

import { ContactShadows, Edges, RoundedBox } from "@react-three/drei/webgpu";
import { EnvironmentMap, useFrame } from "@react-three/fiber/webgpu";
import { useEffect, useMemo, useRef } from "react";
import * as THREE from "three/webgpu";

import { createStudioEnvironment, type StudioOptions } from "../studio-env";
import type { BlendingCubeConfig } from "./config";

/**
 * One box, gaining a capability at a time.
 *
 * The card this sits in claims the ecosystem is the multiplier, so the demo is
 * the same mesh throughout — nothing is swapped out, only added — and each
 * stage is named after the thing that was actually added.
 *
 * The fourth and fifth stages are the point of the whole loop. `metalness = 1`
 * arrives first and the cube goes nearly black, because a metal has no diffuse
 * term and there is nothing yet for it to reflect; the environment arrives
 * after and the gold appears. That ordering is deliberate — it is the same
 * lesson the flip grid's gold cost a day to learn, in six seconds.
 *
 * Everything animates by mutating refs inside `useFrame`. Driving it through
 * React state would re-render the tree sixty times a second for values that
 * never touch the DOM.
 */

type Stage = {
  caption: string;
  edges: number;
  shadow: number;
  metal: number;
  env: number;
};

const STAGES: Stage[] = [
  // The plane is set dressing, not a stage — but a contact shadow needs a
  // surface to land on, and naming it here keeps the first caption honest.
  { caption: "RoundedBox + plane", edges: 0, shadow: 0, metal: 0, env: 0 },
  { caption: "+ Edges", edges: 1, shadow: 0, metal: 0, env: 0 },
  { caption: "+ ContactShadows", edges: 1, shadow: 1, metal: 0, env: 0 },
  { caption: "+ metalness", edges: 1, shadow: 1, metal: 1, env: 0 },
  { caption: "+ Environment", edges: 1, shadow: 1, metal: 1, env: 1 },
];

export const STAGE_CAPTIONS = STAGES.map((s) => s.caption);

const SIZE = 1.35;
// Small on purpose. The rounding is what lets the metal stage work, but a
// twelve-edge box outline can never sit flush on a rounded surface — the two
// shapes simply differ at every corner. Keeping the radius tight shrinks that
// mismatch to about a pixel while still giving the edges a band of turning
// normals to catch the softboxes with.
const RADIUS = 0.05;

/** Shared framing. The cube is small in frame so the shadow has room to read. */
export const CUBE_CAMERA = { position: [3.9, 2.7, 4.8], fov: 30 } as const;

/**
 * A tab left in the background accumulates no frames, but `delta` still counts
 * the wall clock — without this the loop jumps several stages on return.
 */
const MAX_DT = 1 / 20;

/**
 * Lit for a subject that turns, rather than for the flip grid's flat tiles:
 * three boxes spread around the azimuth so a rotating face is always sliding
 * into or out of one, which is what makes the metal stage read as metal rather
 * than as a flat gold swatch.
 */
const CUBE_ENV: StudioOptions = {
  // A cube face is flat: it samples exactly one direction and returns exactly
  // one colour. So the whole look is decided by how much the environment varies
  // between the three directions the visible faces happen to point.
  //
  // Both failure modes are easy to hit. A near-black sky and three quarters of
  // the cube is a silhouette. A bright even sky and every face comes back the
  // same mid value — which reads as tan plastic, not gold. What works is a dark
  // sky with several small, bright, well-separated sources: each face returns a
  // distinctly different value, and a face crossing one flares as it goes.
  ground: [0.015, 0.015, 0.02],
  sky: [0.055, 0.062, 0.085],
  falloff: 0.8,
  horizon: 0.3,
  softboxes: [
    // Key — behind the camera, because that is where a flat face pointing at
    // the camera sends its reflect vector. The camera sits near azimuth 51°.
    {
      azimuth: 48,
      elevation: 24,
      width: 26,
      height: 22,
      intensity: 30,
      color: [1, 0.91, 0.74],
    },
    // Kick — small and hot, well off to the side. The travelling glint that
    // arrives as a face swings past is what separates metal from gold paint.
    {
      azimuth: -60,
      elevation: 32,
      width: 14,
      height: 18,
      intensity: 60,
      color: [1, 0.88, 0.64],
    },
    // Rim — cool, behind the subject, so faces turned away from the key come
    // back blue-grey rather than black.
    {
      azimuth: 182,
      elevation: 26,
      width: 30,
      height: 24,
      intensity: 18,
      color: [0.62, 0.74, 1],
    },
    // Fill — low and opposite the kick, catching the faces that would otherwise
    // sit in the gap between the other three as the cube turns.
    {
      azimuth: 128,
      elevation: -6,
      width: 24,
      height: 18,
      intensity: 14,
      color: [1, 0.86, 0.7],
    },
  ],
};

/** Smoothstep, the same easing the rest of the site uses for reveals. */
function ease(t: number) {
  const x = Math.min(Math.max(t, 0), 1);
  return x * x * (3 - 2 * x);
}

export function BlendingCubeScene({
  config,
  onStage,
}: {
  config: BlendingCubeConfig;
  /** Fires when the stage index changes, for a caption in the DOM. */
  onStage?: (index: number) => void;
}) {
  const group = useRef<THREE.Group>(null);
  const mesh = useRef<THREE.Mesh>(null);
  const key = useRef<THREE.DirectionalLight>(null);
  const shadow = useRef<THREE.Group>(null);
  // Typed as the ref drei declares, but what lands here is the `Line2` that
  // `Edges` renders — `EdgesRef` describes only the imperative handle.
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
  const plain = useMemo(() => new THREE.Color(), []);
  const metal = useMemo(() => new THREE.Color(), []);

  useFrame((state, delta) => {
    clock.current += Math.min(delta, MAX_DT);

    const { stageSeconds, blendSeconds } = config;
    const span = STAGES.length * stageSeconds;
    const t = clock.current % span;
    const index = Math.floor(t / stageSeconds);
    const local = t - index * stageSeconds;

    if (index !== stage.current) {
      stage.current = index;
      onStage?.(index);
    }

    // Hold, then blend into the next stage over the tail of the slot. The last
    // stage blends back to the first, so the loop closes without a cut.
    const from = STAGES[index];
    const to = STAGES[(index + 1) % STAGES.length];
    const k = ease((local - (stageSeconds - blendSeconds)) / blendSeconds);
    const mix = (a: number, b: number) => a + (b - a) * k;

    const edgeAmt = mix(from.edges, to.edges);
    const shadowAmt = mix(from.shadow, to.shadow);
    const metalAmt = mix(from.metal, to.metal);
    const envAmt = mix(from.env, to.env);

    // A squash that peaks just after each stage lands, so the addition has a
    // beat rather than simply appearing.
    const pulse = Math.exp(-(((local / stageSeconds) * 7) ** 2));
    const squash = config.bounce * pulse;

    const g = group.current;
    if (g) {
      g.rotation.y = clock.current * config.spin * Math.PI * 2;
      g.position.y = -squash * 0.5;
      g.scale.set(1 + squash * 0.5, 1 - squash, 1 + squash * 0.5);
    }

    const material = mesh.current?.material as
      THREE.MeshStandardMaterial | undefined;
    if (material) {
      plain.set(config.plain);
      metal.set(config.metal);
      material.color.copy(plain).lerp(metal, metalAmt);
      material.metalness = metalAmt;
      material.roughness =
        config.plainRoughness +
        (config.metalRoughness - config.plainRoughness) * metalAmt;
    }

    if (key.current) key.current.intensity = config.keyIntensity;

    // Mutated straight on the scene rather than through `EnvironmentMap`'s
    // prop, which would mean a React render per frame. The component's own
    // effect only runs on re-render, so it never fights this.
    state.scene.environmentIntensity = config.envIntensity * envAmt;

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
        if (m && "opacity" in m) m.opacity = config.shadowOpacity * shadowAmt;
      });
    }
  });

  return (
    <>
      <EnvironmentMap map={texture} environmentIntensity={0} />

      <ambientLight intensity={config.ambient} />
      <directionalLight
        ref={key}
        position={[2.4, 3.4, 2.2]}
        intensity={config.keyIntensity}
        color="#fff2dc"
      />

      <group ref={group}>
        {/* Rounded, and that is the whole reason the metal stage works at all.
            A flat face has one normal: it samples one direction and comes back
            one flat value, so a hard-edged metal cube reads as tan paint no
            matter what the environment does. The rounding gives each edge a
            band of continuously-turning normals, which sweeps across the
            softboxes as the cube spins — and a moving highlight is what the eye
            reads as metal. */}
        <RoundedBox
          ref={mesh}
          args={[SIZE, SIZE, SIZE]}
          radius={RADIUS}
          smoothness={6}
        >
          <meshStandardMaterial
            color={config.plain}
            roughness={config.plainRoughness}
            metalness={0}
          />
          {/* Given the ideal box rather than the rounded mesh. `EdgesGeometry`
              on a rounded box finds no sharp edges at all — the rounding
              replaces every 90° corner with a fan of shallow ones — so it would
              draw nothing. This traces the twelve edges the box would have had,
              which sits about 0.02 units proud of the surface at the corners
              and is invisible at this scale. */}
          <Edges
            ref={edges as never}
            geometry={edgeGeometry}
            color={config.edge}
            lineWidth={config.lineWidth}
          />
        </RoundedBox>
      </group>

      {/* The plane earns its place: a contact shadow is a dark pool, and a dark
          pool on a black background is nothing at all. Something has to be lit
          underneath the cube for the shadow stage to read as a change. */}
      {/* A disc rather than a plane. A square floor puts its far edge across the
          frame as a hard diagonal, which reads as a tilted wall; a disc ends in
          an ellipse that looks like a plinth, which is what it is. */}
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, -0.68, 0]}>
        <circleGeometry args={[config.plinth, 96]} />
        <meshStandardMaterial
          color={config.floor}
          roughness={0.95}
          metalness={0}
        />
      </mesh>

      <group ref={shadow} position={[0, -0.672, 0]}>
        <ContactShadows
          opacity={config.shadowOpacity}
          blur={config.shadowBlur}
          scale={3.4}
          far={2.2}
          resolution={256}
          color="#000000"
        />
      </group>
    </>
  );
}
