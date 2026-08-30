"use client";

import {
  memo,
  useCallback,
  useMemo,
  useRef,
  useState,
  type RefObject,
} from "react";
import { useFrame, useLocalNodes } from "@react-three/fiber/webgpu";
import {
  attribute,
  cos,
  exp,
  float,
  Fn,
  If,
  positionLocal,
  sin,
  uniform,
  vec3,
} from "three/tsl";
import * as THREE from "three/webgpu";

import {
  HAUSSMANN_RADIUS,
  inPark,
  inRiverCorridor,
  inRiverWater,
  inTowerClearing,
  TOWER_CLEARING_RADIUS,
} from "./geography";
import { INTRO_COMPLETE } from "./intro";

/**
 * Faraz's block city, ported from `threejs-conf-pmndrs/src/Buildings.tsx`.
 *
 * The distribution maths is his, unchanged — that is the authored look. What
 * changed is the cost of drawing it, which is where the demo's framerate went:
 *
 * 1. Trees were `<sphereGeometry args={[1]} />`. That default is 32×16 segments
 *    — 960 triangles — times 20,000 instances, for ~19.2 M triangles of
 *    shrubbery. They are ~8px on screen. Now an icosahedron at detail 1 (80
 *    tris), a ~12× reduction that is invisible at this size.
 * 2. His tree loop computed `spread` and `height` and then never applied them —
 *    `dummy.scale.set(...)` was commented out, so every tree was an identical
 *    unit sphere. The variation was written and thrown away; now it is applied.
 * 3. Trees cast shadows into a 2048² map. 20,000 shadow-casting spheres buy
 *    nothing at this scale — they receive, they no longer cast.
 *
 * Note on `frustumCulled`: he had it off, and it stays off. Each of these is a
 * *single* instanced mesh whose bounding sphere spans the whole 400-unit city,
 * so culling is all-or-nothing and never triggers while the city is in frame.
 * Turning it on would look like a fix and do nothing. Real culling here would
 * mean splitting into LOD rings, which is a bigger change than this port.
 */

/**
 * Deterministic PRNG (mulberry32), replacing the original's `Math.random()`.
 *
 * Two reasons. The React Compiler's `react-hooks/purity` rule rejects impure
 * calls during render and it is right to — these run inside `useMemo`, so a
 * dropped memo silently reshuffles the entire city. And more practically: every
 * stage of this demo is measured against the previous one, which is meaningless
 * if the scene is a different random city each reload. Same seed, same Paris.
 */
function makeRng(seed: number) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const CITY_SEED = 0x9e3779b9;
const TREE_SEED = 0x85ebca6b;

type BuildingsProps = {
  count?: number;
  lowRiseCount?: number;
  treeCount?: number;
  innerRadius?: number;
  outerRadius?: number;
  /** Trees cast shadows. Off by default — see the note above. */
  treeShadows?: boolean;
  /** Carve the river corridor out of the scatter (see geography.ts). */
  river?: boolean;
  /** Keep the park rectangle building-free (trees stay). */
  park?: boolean;
  /**
   * Stylized Haussmann blocks in the near ring instead of cubes. When on,
   * the cube scatter starts at HAUSSMANN_RADIUS and the ring below it is
   * filled by <HaussmannRing/>; when off, cubes fill all the way in as
   * before.
   */
  haussmann?: boolean;
  /** Render-time clock shared with the tower lettering. */
  introClock: RefObject<number>;
};

/** Builds a stable radial delay without consuming the scatter RNG. */
function buildDelay(x: number, z: number, outerRadius: number, phase = 0) {
  const radial = THREE.MathUtils.clamp(Math.hypot(x, z) / outerRadius, 0, 1);
  const jitter =
    Math.sin(x * 12.9898 + z * 78.233) * 43758.5453 -
    Math.floor(Math.sin(x * 12.9898 + z * 78.233) * 43758.5453);
  return 0.35 + radial * 1.55 + jitter * 0.24 + phase;
}

/** Animates each instance from its radial delay on the GPU. */
function useBuildPosition(
  clock: RefObject<number>,
  ground: number,
  motion: "spring" | "tree" = "spring",
) {
  const [uTime] = useState(() => uniform(clock.current));

  useFrame(() => {
    if (uTime.value !== clock.current) uTime.value = clock.current;
  });

  // `useLocalNodes` memoizes on the creator's identity, so an inline arrow
  // rebuilds the whole TSL graph on every render — and a fresh `positionNode`
  // makes R3F flag `material.needsUpdate`, which costs a full WGSL recompile
  // of every instanced mesh. Keep the creator stable.
  const createPositionNodes = useCallback(() => {
    return {
      positionNode: Fn(() => {
        const verticalGrowth = float(1).toVar();
        const lateralGrowth = float(1).toVar();

        // Skip the animation branch after the intro completes.
        If(uTime.lessThan(INTRO_COMPLETE), () => {
          const elapsed = uTime
            .sub(attribute("introDelay", "float"))
            .max(0);

          if (motion === "tree") {
            // Smoothstep grows trees from their base without overshoot.
            const t = elapsed.div(1.15).clamp(0, 1);
            const eased = t.mul(t).mul(float(3).sub(t.mul(2)));
            verticalGrowth.assign(eased.max(0.001));
            lateralGrowth.assign(eased.max(0.001));
          } else {
            const frequency = 10.5;
            const damping = 4.6;
            const wave = cos(elapsed.mul(frequency)).add(
              sin(elapsed.mul(frequency)).mul(damping / frequency),
            );
            verticalGrowth.assign(
              float(1)
                .sub(exp(elapsed.mul(-damping)).mul(wave))
                .max(0.001),
            );
          }
        });

        if (motion === "tree") {
          // Scale around each tree base after the instance matrix is applied.
          const origin = vec3(attribute<"vec3">("introOrigin", "vec3"));
          return vec3(
            origin.x.add(positionLocal.x.sub(origin.x).mul(lateralGrowth)),
            origin.y.add(positionLocal.y.sub(origin.y).mul(verticalGrowth)),
            origin.z.add(positionLocal.z.sub(origin.z).mul(lateralGrowth)),
          );
        }

        return vec3(
          positionLocal.x,
          float(ground).add(
            positionLocal.y.sub(ground).mul(verticalGrowth),
          ),
          positionLocal.z,
        );
      })(),
    };
  }, [uTime, ground, motion]);

  return useLocalNodes(createPositionNodes).positionNode;
}

/**
 * Builds a ref callback that uploads a fixed set of instance matrices.
 *
 * Memoize the result. React detaches and re-attaches a ref whose identity
 * changed on *every* commit, so an inline callback here re-uploads every
 * matrix and re-runs `computeBoundingSphere` — a per-instance
 * `Matrix4.fromArray` + `Sphere.union` loop — each time the scene re-renders.
 * Dragging the time dial re-renders per frame, which turned ~22k static
 * placements into ~500 KB/frame of `queue.writeBuffer` traffic and the single
 * hottest leaf on the main thread.
 */
function instanceMatrixRef(matrices: THREE.Matrix4[]) {
  return (mesh: THREE.InstancedMesh | null) => {
    if (!mesh) return;
    matrices.forEach((matrix, i) => mesh.setMatrixAt(i, matrix));
    mesh.instanceMatrix.needsUpdate = true;
    mesh.computeBoundingSphere();
  };
}

/**
 * Memoized: every prop here is fixed for the life of the canvas, so the city
 * has no reason to reconcile when the scene above it re-renders. Dragging the
 * time dial re-renders that scene every frame, and this subtree — four
 * instanced meshes plus the Haussmann ring — is the bulk of the JSX in it.
 */
export const Buildings = memo(function Buildings({
  count = 300,
  lowRiseCount = 10000,
  treeCount = 20000,
  innerRadius = 12,
  outerRadius = 400,
  treeShadows = false,
  river = true,
  park = true,
  haussmann = true,
  introClock,
}: BuildingsProps) {
  const meshRef = useRef<THREE.InstancedMesh>(null);
  const treeRef = useRef<THREE.InstancedMesh>(null);

  const instances = useMemo(() => {
    const random = makeRng(CITY_SEED);
    const dummy = new THREE.Object3D();
    const matrices: THREE.Matrix4[] = [];
    const delays: number[] = [];

    const spanRadius = (bias: number) => {
      const angle = random() * Math.PI * 2;
      const t = Math.pow(random(), bias);
      const radius = innerRadius + t * (outerRadius - innerRadius);
      return {
        radius,
        x: Math.cos(angle) * radius,
        z: Math.sin(angle) * radius,
      };
    };

    // Rejection test shared by the scatter loops: geography wins over the
    // random draw. Attempt caps keep a mis-tuned exclusion from spinning the
    // loop forever; in practice the corridors reject a few percent.
    const excluded = (x: number, z: number, radius: number) =>
      (river && inRiverCorridor(x, z)) ||
      (park && inPark(x, z, 2)) ||
      (park && inTowerClearing(x, z, 3)) ||
      (haussmann && radius < HAUSSMANN_RADIUS);

    // Tall / landmark high-rises: sparse and confined to the far distance.
    // They only spawn in the outer band of the ring so the foreground stays
    // low-rise and the skyline rises up behind it.
    const highRiseStart = innerRadius + (outerRadius - innerRadius) * 0.55;
    for (let i = 0, attempts = 0; i < count && attempts < count * 8; attempts++) {
      const angle = random() * Math.PI * 2;
      const radius =
        highRiseStart +
        Math.pow(random(), 0.5) * (outerRadius - highRiseStart);
      const x = Math.cos(angle) * radius;
      const z = Math.sin(angle) * radius;
      if (excluded(x, z, radius)) continue;
      i++;
      const distanceFactor =
        (radius - innerRadius) / (outerRadius - innerRadius);
      const sizeScale = THREE.MathUtils.lerp(1, 2.4, distanceFactor);
      const width = THREE.MathUtils.lerp(1.5, 8, random()) * sizeScale;
      const depth = THREE.MathUtils.lerp(1.5, 8, random()) * sizeScale;
      const height =
        THREE.MathUtils.lerp(10, 30, Math.pow(random(), 1.2)) *
        THREE.MathUtils.lerp(0.8, 1.6, distanceFactor);

      dummy.position.set(x, height / 2, z);
      dummy.scale.set(width, height, depth);
      dummy.rotation.y = random() * Math.PI * 2;
      dummy.updateMatrix();
      matrices.push(dummy.matrix.clone());
      delays.push(buildDelay(x, z, outerRadius));
    }

    // Haussmann-style low-rise: dense carpet of small, uniform-height blocks.
    for (
      let i = 0, attempts = 0;
      i < lowRiseCount && attempts < lowRiseCount * 8;
      attempts++
    ) {
      const { radius, x, z } = spanRadius(0.85);
      if (excluded(x, z, radius)) continue;
      i++;
      const distanceFactor =
        (radius - innerRadius) / (outerRadius - innerRadius);
      const sizeScale = THREE.MathUtils.lerp(0.5, 2, distanceFactor);
      const width = THREE.MathUtils.lerp(1.2, 3.5, random()) * sizeScale;
      const depth = THREE.MathUtils.lerp(1.2, 3.5, random()) * sizeScale;
      // Fairly consistent low height with slight variation, like Paris blocks.
      const height =
        THREE.MathUtils.lerp(2, 4, random()) *
        THREE.MathUtils.lerp(0.6, 1.4, distanceFactor);

      dummy.position.set(x, height / 2, z);
      dummy.scale.set(width, height, depth);
      dummy.rotation.y = random() * Math.PI * 2;
      dummy.updateMatrix();
      matrices.push(dummy.matrix.clone());
      delays.push(buildDelay(x, z, outerRadius));
    }

    return { matrices, delays: new Float32Array(delays) };
  }, [count, lowRiseCount, innerRadius, outerRadius, river, park, haussmann]);

  const trees = useMemo(() => {
    const random = makeRng(TREE_SEED);
    const dummy = new THREE.Object3D();
    const matrices: THREE.Matrix4[] = [];
    const delays: number[] = [];
    const origins: number[] = [];

    // Trees frame the park and river while leaving the tower clearing open.
    for (
      let i = 0, attempts = 0;
      i < treeCount && attempts < treeCount * 8;
      attempts++
    ) {
      const angle = random() * Math.PI * 2;
      const t = Math.pow(random(), 0.85);
      const radius = innerRadius + t * (outerRadius - innerRadius);
      const x = Math.cos(angle) * radius;
      const z = Math.sin(angle) * radius;
      if (
        (river && inRiverWater(x, z)) ||
        (park && inTowerClearing(x, z, 4))
      ) {
        continue;
      }
      i++;

      const distanceFactor =
        (radius - innerRadius) / (outerRadius - innerRadius);
      const sizeScale = THREE.MathUtils.lerp(0.6, 2, distanceFactor);
      const height = THREE.MathUtils.lerp(1, 3, random()) * sizeScale;
      const spread = THREE.MathUtils.lerp(0.5, 1.1, random()) * sizeScale;

      // Geometry is a unit-radius ball centred on its origin, so lift by half
      // the (scaled) height to sit it on the ground.
      dummy.position.set(x, height / 2, z);
      // Applied, unlike in the original — this is the variation the loop above
      // was already paying to compute.
      dummy.scale.set(spread, height * 0.5, spread);
      dummy.rotation.y = random() * Math.PI * 2;
      dummy.updateMatrix();
      matrices.push(dummy.matrix.clone());
      delays.push(buildDelay(x, z, outerRadius, 0.38));
      origins.push(x, 0, z);
    }

    return {
      matrices,
      delays: new Float32Array(delays),
      origins: new Float32Array(origins),
    };
  }, [treeCount, innerRadius, outerRadius, river, park]);

  const blockPosition = useBuildPosition(introClock, -0.5);
  const treePosition = useBuildPosition(introClock, -1, "tree");

  const setMatrices = useMemo(() => {
    const upload = instanceMatrixRef(instances.matrices);
    return (mesh: THREE.InstancedMesh | null) => {
      if (!mesh) return;
      meshRef.current = mesh;
      upload(mesh);
    };
  }, [instances]);

  const setTreeMatrices = useMemo(() => {
    const upload = instanceMatrixRef(trees.matrices);
    return (mesh: THREE.InstancedMesh | null) => {
      if (!mesh) return;
      treeRef.current = mesh;
      upload(mesh);
    };
  }, [trees]);

  return (
    <>
      {/* Counts come from the *placed* matrices, not the requested totals —
          rejection sampling can come up short, and unset instances would
          render as identity-matrix unit cubes at the origin. */}
      <instancedMesh
        key={`blocks-${instances.matrices.length}`}
        ref={setMatrices}
        args={[undefined, undefined, instances.matrices.length]}
        castShadow
        receiveShadow
        frustumCulled={false}
      >
        <boxGeometry args={[1, 1, 1]}>
          <instancedBufferAttribute
            attach="attributes-introDelay"
            args={[instances.delays, 1]}
          />
        </boxGeometry>
        {/* `color` prop deliberately unused, as in the original: the materials
            are white and the near-black defaults are dead. Keeping his rendered
            look, not his intended one — Stage 1 relights this anyway. */}
        <meshStandardNodeMaterial
          color="white"
          roughness={0.85}
          metalness={0.1}
          positionNode={blockPosition}
        />
      </instancedMesh>

      <instancedMesh
        key={`trees-${trees.matrices.length}`}
        ref={setTreeMatrices}
        args={[undefined, undefined, trees.matrices.length]}
        castShadow={treeShadows}
        receiveShadow
        frustumCulled={false}
      >
        {/* 80 triangles, against the 960 of the default sphere. */}
        <icosahedronGeometry args={[1, 1]}>
          <instancedBufferAttribute
            attach="attributes-introDelay"
            args={[trees.delays, 1]}
          />
          <instancedBufferAttribute
            attach="attributes-introOrigin"
            args={[trees.origins, 3]}
          />
        </icosahedronGeometry>
        <meshStandardNodeMaterial
          color="white"
          roughness={0.95}
          metalness={0}
          positionNode={treePosition}
        />
      </instancedMesh>

      {haussmann && (
        <HaussmannRing
          river={river}
          park={park}
          outerRadius={outerRadius}
          introClock={introClock}
        />
      )}
    </>
  );
});

/**
 * The near ring, stylized: Paris-block bodies with mansard-ish roofs where
 * the cube carpet used to run right up to the tower. Two instanced meshes
 * sharing one placement pass — cream bodies, slate roof frustums — arranged
 * on concentric rings facing the tower, the way Haussmann blocks wrap their
 * arrondissement. Beyond HAUSSMANN_RADIUS the cubes take over again.
 *
 * The roof geometry is a 4-segment cylinder rotated 45° so its square cross
 * section matches the unit box footprint: radius √2/2 puts the corners at
 * the box corners, and the smaller top radius gives the mansard taper.
 */
function HaussmannRing({
  river,
  park,
  outerRadius,
  introClock,
}: {
  river: boolean;
  park: boolean;
  outerRadius: number;
  introClock: RefObject<number>;
}) {
  const placements = useMemo(() => {
    const random = makeRng(0xc0ffee11);
    const dummy = new THREE.Object3D();
    const bodies: THREE.Matrix4[] = [];
    const roofs: THREE.Matrix4[] = [];
    const bodyDelays: number[] = [];
    const roofDelays: number[] = [];

    const INNER = park ? TOWER_CLEARING_RADIUS + 4 : 16;
    for (let ringR = INNER; ringR < HAUSSMANN_RADIUS; ringR += 9) {
      // Blocks are ~4.5 wide; a 6.5-unit arc step leaves street gaps.
      const n = Math.floor((Math.PI * 2 * ringR) / 6.5);
      for (let i = 0; i < n; i++) {
        const angle = (i / n) * Math.PI * 2 + random() * 0.06;
        const radius = ringR + (random() - 0.5) * 2.5;
        const x = Math.cos(angle) * radius;
        const z = Math.sin(angle) * radius;
        if (river && inRiverCorridor(x, z)) continue;
        if (park && inPark(x, z, 2)) continue;

        // Facades face the tower: tangential width, radial depth.
        const width = 4.2 + random() * 1.6;
        const depth = 3.2 + random() * 1.2;
        const height = 3.4 + random() * 1.2;
        const roofHeight = height * 0.4;
        const rotation = -angle + Math.PI / 2;

        dummy.position.set(x, height / 2, z);
        dummy.scale.set(width, height, depth);
        dummy.rotation.set(0, rotation, 0);
        dummy.updateMatrix();
        bodies.push(dummy.matrix.clone());
        const delay = buildDelay(x, z, outerRadius);
        bodyDelays.push(delay);

        dummy.position.set(x, height + roofHeight / 2, z);
        dummy.scale.set(width, roofHeight, depth);
        dummy.rotation.set(0, rotation, 0);
        dummy.updateMatrix();
        roofs.push(dummy.matrix.clone());
        roofDelays.push(delay + 0.12);
      }
    }

    return {
      bodies,
      roofs,
      bodyDelays: new Float32Array(bodyDelays),
      roofDelays: new Float32Array(roofDelays),
    };
  }, [river, park, outerRadius]);

  const bodyPosition = useBuildPosition(introClock, -0.5);
  const roofPosition = useBuildPosition(introClock, -0.5);

  const roofGeometry = useMemo(() => {
    const geometry = new THREE.CylinderGeometry(0.34, Math.SQRT1_2, 1, 4, 1);
    geometry.rotateY(Math.PI / 4);
    return geometry;
  }, []);

  const setBodyMatrices = useMemo(
    () => instanceMatrixRef(placements.bodies),
    [placements],
  );
  const setRoofMatrices = useMemo(
    () => instanceMatrixRef(placements.roofs),
    [placements],
  );

  return (
    <>
      <instancedMesh
        key={`hausbody-${placements.bodies.length}`}
        ref={setBodyMatrices}
        args={[undefined, undefined, placements.bodies.length]}
        castShadow
        receiveShadow
        frustumCulled={false}
      >
        <boxGeometry args={[1, 1, 1]}>
          <instancedBufferAttribute
            attach="attributes-introDelay"
            args={[placements.bodyDelays, 1]}
          />
        </boxGeometry>
        <meshStandardNodeMaterial
          color="#cfc5b4"
          roughness={0.9}
          metalness={0.05}
          positionNode={bodyPosition}
        />
      </instancedMesh>
      <instancedMesh
        key={`hausroof-${placements.roofs.length}`}
        ref={setRoofMatrices}
        args={[undefined, undefined, placements.roofs.length]}
        castShadow
        receiveShadow
        frustumCulled={false}
        geometry={roofGeometry}
      >
        <instancedBufferAttribute
          attach="geometry-attributes-introDelay"
          args={[placements.roofDelays, 1]}
        />
        <meshStandardNodeMaterial
          color="#46505c"
          roughness={0.75}
          metalness={0.15}
          flatShading
          positionNode={roofPosition}
        />
      </instancedMesh>
    </>
  );
}
