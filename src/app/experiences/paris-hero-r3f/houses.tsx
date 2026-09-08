"use client";

import {
  createInstances,
  InstancedAttribute,
  useSurfaceSampler,
} from "@react-three/drei/webgpu";
import {
  useFrame,
  useLocalNodes,
  useUniforms,
  type CreatorState,
} from "@react-three/fiber/webgpu";
import { useMemo, useRef } from "react";
import { attribute, positionLocal, smoothstep } from "three/tsl";
import * as THREE from "three/webgpu";

import { groundRing, makeRng, samplePositions } from "./scatter";

/**
 * The town, growing in.
 *
 * Same placement as the simple hero's houses, plus an entrance, and the
 * entrance never touches the instance buffers. Each house carries two
 * instanced attributes that are written once and never change: `birth`, its
 * place on a 0 to 1 timeline, and `origin`, the point on the ground it grows
 * from. One `progress` uniform moves along that timeline and the vertex
 * shader does the rest. The CPU writes one float a frame, however many houses
 * there are.
 */

/** Typed so `<House birth origin>` checks, and so a stray instance cannot join another mesh. */
const [Town, House] = createInstances<{
  birth: number;
  origin: [number, number, number];
}>();

type TownUniforms = { progress: THREE.UniformNode<"float", number> };

/**
 * Scales each house about its own base as its moment on the timeline passes.
 *
 * `positionLocal` here already has the instance matrix applied, so it is in
 * the town's space. Subtract the house's origin, scale what is left, add the
 * origin back.
 */
function createGrowNodes({ uniforms }: CreatorState) {
  const { progress } = uniforms.scope("town") as unknown as TownUniforms;
  const birth = attribute<"float">("birth", "float");
  const origin = attribute<"vec3">("origin", "vec3");

  // Each house takes 0.15 of the timeline to arrive, starting at its birth.
  const t = smoothstep(birth, birth.add(0.15), progress);

  // Back out easing. Overshoots to about 1.1 and settles, so a house pops up
  // rather than fading in.
  const u = t.sub(1);
  const pop = u.mul(u).mul(u).mul(2.7).add(u.mul(u).mul(1.7)).add(1);

  return { positionNode: origin.add(positionLocal.sub(origin).mul(pop)) };
}

export function Houses({
  count = 1200,
  radius = 150,
  clearing = 30,
  seed = 0x9e3779b9,
  duration = 3,
}: {
  count?: number;
  radius?: number;
  /** Keep out radius around the tower, a little wider than the trees'. */
  clearing?: number;
  seed?: number;
  /** Seconds for the whole town to arrive. Remount to replay. */
  duration?: number;
}) {
  // The sampler sizes its buffer once, so a new count or a new ring is a new town.
  return (
    <SampledHouses
      key={`${count}:${radius}:${clearing}`}
      count={count}
      radius={radius}
      clearing={clearing}
      seed={seed}
      duration={duration}
    />
  );
}

function SampledHouses({
  count,
  radius,
  clearing,
  seed,
  duration,
}: {
  count: number;
  radius: number;
  clearing: number;
  seed: number;
  duration: number;
}) {
  // drei types the sampler ref as non null. The mesh is attached before the layout effect that reads it.
  const ground = useRef<THREE.Mesh>(null!);
  const ring = useMemo(() => groundRing(clearing, radius), [clearing, radius]);
  // Unit box lifted onto its base, so scale y is the full height.
  const block = useMemo(
    () => new THREE.BoxGeometry(1, 1, 1).translate(0, 0.5, 0),
    [],
  );

  const samples = useSurfaceSampler(ground, count);

  const houses = useMemo(() => {
    const random = makeRng(seed);
    const cream = new THREE.Color("#d8cfbf");
    const slate = new THREE.Color("#8d8a84");
    return samplePositions(samples, count).map((position) => {
      const [x, , z] = position;
      // Taller toward the edge, so the near ring stays low and the skyline rises behind it.
      const distance = Math.hypot(x, z) / radius;
      return {
        position,
        width: THREE.MathUtils.lerp(2.5, 5, random()),
        height: 2.5 + random() ** 1.6 * 9 * (0.5 + distance),
        depth: THREE.MathUtils.lerp(2.5, 5, random()),
        turn: random() * Math.PI * 2,
        color: cream.clone().lerp(slate, random()),
        // Mostly by distance, so the town spreads out from the tower, with
        // enough jitter that no ring arrives all at once. Scaled to leave
        // room for the last house's 0.15 window before the timeline ends.
        birth: (distance * 0.7 + random() * 0.3) * 0.85,
      };
    });
  }, [samples, count, radius, seed]);

  // Starts over on remount: the hook sees 0 against the old value and resets it.
  const { progress } = useUniforms(
    { progress: 0 },
    "town",
  ) as unknown as TownUniforms;

  // The one write per frame.
  useFrame(({ delta }) => {
    progress.value = Math.min(1, progress.value + delta / duration);
  });

  const { positionNode } = useLocalNodes(createGrowNodes);

  return (
    <>
      <mesh ref={ground} geometry={ring} visible={false} />

      <Town
        limit={count}
        geometry={block}
        castShadow
        receiveShadow
        frustumCulled={false}
      >
        {/* Instance colour still multiplies in on top of this. */}
        <meshStandardNodeMaterial
          color="white"
          roughness={0.85}
          metalness={0.05}
          positionNode={positionNode}
        />
        {/* One float and one vec3 per instance, copied off the props below. */}
        <InstancedAttribute name="birth" defaultValue={0} />
        <InstancedAttribute name="origin" defaultValue={[0, 0, 0]} />
        {houses.map((h, i) => (
          <House
            key={i}
            position={h.position}
            origin={h.position}
            scale={[h.width, h.height, h.depth]}
            rotation-y={h.turn}
            color={h.color}
            birth={h.birth}
          />
        ))}
      </Town>
    </>
  );
}
