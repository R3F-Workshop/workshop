"use client";

import {
  createInstances,
  InstancedAttribute,
  OrbitControls,
  useSurfaceSampler,
} from "@react-three/drei/webgpu";
import { Canvas } from "@react-three/fiber/webgpu";
import { useControls } from "leva";
import { useEffect, useMemo, useRef } from "react";
import {
  attribute,
  mix,
  positionGeometry,
  positionLocal,
  sin,
  time,
  uniform,
  vec3,
} from "three/tsl";
import * as THREE from "three/webgpu";

import { DepthAttachmentSync } from "@/components/depth-attachment-sync";
import { useWebGPU } from "@/lib/use-webgpu";
import { hash } from "./hash";
import { makeTerrain } from "./terrain";

/**
 * A forest on a hill, the drei way.
 *
 * Three drei pieces do the work. `useSurfaceSampler` scatters points over the
 * terrain mesh, weighted by a per vertex `weight` attribute so the clearing in
 * the middle stays empty. `Instances` turns a list of `<Tree>` elements into
 * one InstancedMesh and one draw call. `InstancedAttribute` adds a per instance
 * `phase` float that the wind shader reads with `attribute("phase")`.
 *
 * The only shader is the sway. It lives in the material's `positionNode` and
 * runs after the instance transform, so it reads `positionGeometry` for the
 * raw cone height and bends the tip, never the base.
 */

/** `createInstances` gives a typed pair, so `<Tree phase={...}>` type checks. */
const [Forest, Tree] = createInstances<{ phase: number }>();

function Scene({
  count,
  clearing,
  wind,
}: {
  count: number;
  clearing: number;
  wind: number;
}) {
  // drei types the sampler ref as non null. The mesh is attached before the layout effect that reads it.
  const ground = useRef<THREE.Mesh>(null!);
  const terrain = useMemo(() => makeTerrain(clearing), [clearing]);
  // Lifted so the base sits at y equals zero and the shader's height ramp runs from ground to tip.
  const cone = useMemo(
    () => new THREE.ConeGeometry(1, 1, 7, 1).translate(0, 0.5, 0),
    [],
  );

  // The sampler reads the ground mesh in a layout effect, after the ref is set. It hands back one matrix per point.
  const samples = useSurfaceSampler(ground, count, undefined, "weight");

  const trees = useMemo(() => {
    const dark = new THREE.Color("#1d3a1e");
    const light = new THREE.Color("#6f9a3c");
    const m = samples.array as Float32Array;
    return Array.from({ length: count }, (_, i) => ({
      // Translation lives in the last column of the matrix. Sink a little so trees on slopes never float.
      position: [m[i * 16 + 12], m[i * 16 + 13] - 0.2, m[i * 16 + 14]] as [
        number,
        number,
        number,
      ],
      spread: THREE.MathUtils.lerp(0.7, 1.3, hash(i, 1)),
      height: THREE.MathUtils.lerp(2, 5, hash(i, 2) ** 1.5),
      turn: hash(i, 3) * Math.PI * 2,
      color: dark.clone().lerp(light, hash(i, 4)),
      phase: hash(i, 5) * Math.PI * 2,
    }));
  }, [samples, count]);

  const shader = useMemo(() => {
    const strength = uniform(0.35);
    // Zero at the base and one at the tip, squared so the trunk barely moves.
    const lean = positionGeometry.y.mul(positionGeometry.y);
    const sway = sin(time.mul(1.6).add(attribute("phase", "float")))
      .mul(strength)
      .mul(lean);
    return {
      strength,
      positionNode: positionLocal.add(vec3(sway, 0, sway.mul(0.4))),
      // Shade toward the base. Instance color multiplies in on top of this.
      colorNode: mix(vec3(0.45), vec3(1), positionGeometry.y),
    };
  }, []);

  useEffect(() => {
    shader.strength.value = wind;
  }, [shader, wind]);

  return (
    <>
      <hemisphereLight args={["#cfe2ff", "#3a4a2a", 0.9]} />
      <directionalLight
        position={[60, 80, 30]}
        intensity={2.2}
        castShadow
        shadow-mapSize={[2048, 2048]}
        shadow-camera-near={10}
        shadow-camera-far={300}
        shadow-camera-left={-100}
        shadow-camera-right={100}
        shadow-camera-top={100}
        shadow-camera-bottom={-100}
        shadow-bias={-0.0004}
      />

      <mesh ref={ground} geometry={terrain} receiveShadow>
        <meshStandardMaterial color="#4c5c36" roughness={1} metalness={0} />
      </mesh>

      {/* One InstancedMesh. `limit` sizes the buffers, the children fill them. */}
      <Forest
        limit={count}
        geometry={cone}
        castShadow
        receiveShadow
        frustumCulled={false}
      >
        <meshStandardNodeMaterial
          positionNode={shader.positionNode}
          colorNode={shader.colorNode}
          roughness={0.95}
          metalness={0}
        />
        <InstancedAttribute name="phase" defaultValue={0} />
        {trees.map((t, i) => (
          <Tree
            key={i}
            position={t.position}
            scale={[t.spread, t.height, t.spread]}
            rotation-y={t.turn}
            color={t.color}
            phase={t.phase}
          />
        ))}
      </Forest>

      <OrbitControls
        target={[0, 0, 0]}
        autoRotate
        autoRotateSpeed={0.4}
        enablePan={false}
        minDistance={30}
        maxDistance={140}
        maxPolarAngle={Math.PI * 0.46}
      />
    </>
  );
}

export function DreiTrees() {
  const support = useWebGPU();

  const { count, clearing, wind } = useControls("drei-trees", {
    count: { value: 3000, min: 100, max: 8000, step: 100 },
    clearing: { value: 16, min: 0, max: 40, step: 1 },
    wind: { value: 0.35, min: 0, max: 1.5, step: 0.05 },
  });

  // No WebGPU, no experience. The shell around this decides what to show instead.
  if (support !== "yes") return null;

  return (
    <div className="absolute inset-0">
      <Canvas
        shadows
        camera={{ position: [0, 24, 62], fov: 40, near: 0.5, far: 500 }}
        dpr={[1, 2]}
        forceEven
        renderer={{ alpha: false, antialias: true }}
      >
        <DepthAttachmentSync />
        <color attach="background" args={["#c9d6e4"]} />
        <fog attach="fog" args={["#c9d6e4", 70, 220]} />
        {/* The sampler sizes its buffer once, so a new count or terrain is a new scene. */}
        <Scene
          key={`${count}:${clearing}`}
          count={count}
          clearing={clearing}
          wind={wind}
        />
      </Canvas>
    </div>
  );
}
