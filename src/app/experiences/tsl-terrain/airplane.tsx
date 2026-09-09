"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import {
  ACESFilmicToneMapping,
  ConeGeometry,
  HalfFloatType,
  PlaneGeometry,
  SRGBColorSpace,
  StorageTexture,
  Vector2,
  type Group,
  type Node,
} from "three/webgpu";
import {
  float,
  Fn,
  hash,
  instanceIndex,
  int,
  max,
  mix,
  mx_fractal_noise_float,
  normalize,
  positionLocal,
  smoothstep,
  texture,
  textureStore,
  transformNormalToView,
  uvec2,
  vec2,
  vec3,
  vec4,
} from "three/tsl";
import {
  Canvas,
  useFrame,
  useGPUStorage,
  useNodes,
  useThree,
  useUniforms,
} from "@react-three/fiber/webgpu";
import { useControls } from "leva";

import { Stage, STAGE_CAMERA } from "@/app/experiences/stage";

/**
 * Terrain, five of five: airplane.
 *
 * The same bake, the same trees, and a third reader that shares one value
 * with the CPU. The airplane flies a circle the frame loop drives: where
 * it is and which way it faces are ordinary JavaScript, written into the
 * `planeXZ` uniform every frame. How high it is, the GPU decides. Its
 * altitude is the map sampled at that uniform, in the vertex shader, so it
 * follows the terrain without the CPU ever reading a height. The shadow
 * under it is a small quad whose vertices each sample the map at their own
 * spot, so it hugs the slope instead of floating flat.
 *
 * Nothing on the CPU knows how high the ground is. The counter still moves
 * only when a dial does.
 */

/** Texels along one edge of the map. */
const SIZE = 256;
/** The terrain's edge, in world units. Six, so it sits inside the room. */
const WORLD = 6;
/** Vertices along one edge of the ground. */
const SEGMENTS = 200;
const TREES = 2000;
/** The airplane's circuit radius. Inside the terrain, so it always has ground under it. */
const ORBIT = 2;

/**
 * The plane, the water, the trees, the airplane, and the map. Registers the
 * uniforms and the storage texture, builds the graph, and decides when to
 * bake. The airplane's circuit is ordinary CPU animation and shares the
 * same loop as the bake.
 */
function Landscape({ onBake }: { onBake: () => void }) {
  const values = useControls("tsl terrain · noise", {
    frequency: { value: 0.5, min: 0.1, max: 1.5, step: 0.01 },
    octaves: { value: 5, min: 1, max: 8, step: 1 },
    lacunarity: { value: 2, min: 1.5, max: 3, step: 0.05 },
    gain: { value: 0.5, min: 0.2, max: 0.8, step: 0.01 },
    amplitude: { value: 1, min: 0, max: 2.5, step: 0.05 },
    offsetX: { value: 0, min: -10, max: 10, step: 0.05 },
    offsetZ: { value: 0, min: -10, max: 10, step: 0.05 },
    water: { value: 0.42, min: 0, max: 1, step: 0.01 },
    snow: { value: 0.78, min: 0, max: 1, step: 0.01 },
  });
  // The count is fixed at the instanced mesh, shown here for the record.
  const { treeline, maxSlope } = useControls("tsl terrain · trees", {
    count: { value: TREES, disabled: true },
    treeline: { value: 0.72, min: 0, max: 1, step: 0.01 },
    maxSlope: { value: 0.36, min: 0, max: 1, step: 0.01 },
  });
  // Speed is CPU only. Clearance goes to the shader with everything else.
  const { speed, clearance } = useControls("tsl terrain · airplane", {
    speed: { value: 0.8, min: 0, max: 3, step: 0.05 },
    clearance: { value: 0.3, min: 0.05, max: 1, step: 0.05 },
  });

  // The same Vector2 on every render, so the hook never resets it.
  const planeXZ = useMemo(() => new Vector2(ORBIT, 0), []);
  useUniforms({ ...values, treeline, maxSlope, clearance, planeXZ }, "tslTerrain");

  // Height and normal, half float so the normal can go negative.
  useGPUStorage(() => {
    const t = new StorageTexture(SIZE, SIZE);
    t.type = HalfFloatType;
    return { tslTerrainMap: t };
  });

  const nodes = useNodes(({ uniforms, gpuStorage }) => {
    const u = uniforms.tslTerrain;
    // The store types every entry as the storage union. This one is a texture.
    const map = gpuStorage.tslTerrainMap as StorageTexture;

    /** World xz to a texel address in 0..1. The one convention everything shares. */
    const mapUv = (xz: Node<"vec2">) => xz.div(WORLD).add(0.5);

    /** The noise at a world xz, mapped to roughly 0..1. Only the bake calls it. */
    const height = Fn(({ xz }: { xz: Node<"vec2"> }) =>
      mx_fractal_noise_float(
        xz.mul(u.frequency).add(vec2(u.offsetX, u.offsetZ)),
        int(u.octaves),
        u.lacunarity,
        u.gain,
      )
        .mul(0.5)
        .add(0.5),
    );

    // One invocation per texel. Height, then a normal from two more samples
    // one texel over. It only runs when a dial moves.
    const bake = Fn(() => {
      const x = instanceIndex.mod(SIZE);
      const y = instanceIndex.div(SIZE);
      const xz = vec2(float(x), float(y)).add(0.5).div(SIZE).sub(0.5).mul(WORLD);
      const texel = WORLD / SIZE;
      const h = height({ xz });
      const hx = height({ xz: xz.add(vec2(texel, 0)) });
      const hz = height({ xz: xz.add(vec2(0, texel)) });
      const n = normalize(vec3(h.sub(hx).mul(u.amplitude), texel, h.sub(hz).mul(u.amplitude)));
      textureStore(map, uvec2(x, y), vec4(h, n)).toWriteOnly();
    })().compute(SIZE * SIZE);

    /** The baked sample at a world xz. Vertex stage safe, hence `level(0)`. */
    const sample = (xz: Node<"vec2">) => texture(map, mapUv(xz)).level(int(0));

    // The ground. Position and normal come straight out of the texture, and
    // the colour is a few bands over height and slope.
    const ground = sample(positionLocal.xz);
    const h = ground.r;
    const normal = ground.gba;
    const slope = float(1).sub(normal.y);
    const rock = mix(vec3(0.24, 0.36, 0.14), vec3(0.32, 0.29, 0.26), smoothstep(0.25, 0.45, slope));
    const snowy = mix(rock, vec3(0.92, 0.94, 0.98), smoothstep(u.snow.sub(0.04), u.snow.add(0.04), h));
    const sandy = mix(vec3(0.72, 0.64, 0.42), snowy, smoothstep(u.water, u.water.add(0.04), h));

    // A tree. Placed by a hash of its index, sized by another, and scaled to
    // nothing where the ground under it is wrong for a tree.
    const treeXZ = vec2(hash(instanceIndex), hash(instanceIndex.add(1)))
      .sub(0.5)
      .mul(WORLD * 0.96);
    const under = sample(treeXZ);
    const fits = smoothstep(u.water.add(0.02), u.water.add(0.06), under.r)
      .mul(float(1).sub(smoothstep(u.treeline.sub(0.06), u.treeline, under.r)))
      .mul(float(1).sub(smoothstep(u.maxSlope.sub(0.06), u.maxSlope.add(0.06), float(1).sub(under.b))));
    const treeScale = hash(instanceIndex.add(2)).mul(0.5).add(0.6).mul(fits);

    // The airplane's altitude. One sample, at the uniform the loop writes,
    // shared by every part. Over water it flies at the water line.
    const flying = sample(u.planeXZ);
    const altitude = max(flying.r, u.water).mul(u.amplitude).add(u.clearance);

    // The shadow samples per vertex around the airplane, so it hugs the
    // slope. Over water it rides the surface, like the airplane does.
    const shadowXZ = positionLocal.xz.add(u.planeXZ);
    const shadowY = max(sample(shadowXZ).r, u.water).mul(u.amplitude).add(0.015);

    return {
      bake,
      position: vec3(positionLocal.x, h.mul(u.amplitude), positionLocal.z),
      normal: transformNormalToView(normal),
      color: sandy,
      treePosition: positionLocal
        .mul(treeScale)
        .add(vec3(treeXZ.x, under.r.mul(u.amplitude), treeXZ.y)),
      treeColor: mix(vec3(0.1, 0.25, 0.1), vec3(0.2, 0.4, 0.15), hash(instanceIndex.add(3))),
      airplanePosition: positionLocal.add(vec3(0, altitude, 0)),
      shadowPosition: vec3(shadowXZ.x, shadowY, shadowXZ.y),
    };
  }, "tslTerrain");

  const renderer = useThree((s) => s.renderer);

  // Rebake only when a dial the bake reads has moved.
  const dirty = useRef(false);
  const { frequency, octaves, lacunarity, gain, amplitude, offsetX, offsetZ } = values;
  useEffect(() => {
    dirty.current = true;
  }, [frequency, octaves, lacunarity, gain, amplitude, offsetX, offsetZ]);

  const airplaneRef = useRef<Group>(null);
  const heading = useRef(0);

  useFrame(
    ({ delta }) => {
      if (dirty.current) {
        dirty.current = false;
        renderer.compute(nodes.bake);
        onBake();
      }

      // The circuit is CPU work: where the airplane is and which way it
      // faces. How high it is, the GPU decides.
      heading.current += (delta * speed) / ORBIT;
      const x = Math.cos(heading.current) * ORBIT;
      const z = Math.sin(heading.current) * ORBIT;
      planeXZ.set(x, z);
      if (airplaneRef.current) {
        airplaneRef.current.position.set(x, 0, z);
        airplaneRef.current.rotation.y = -(heading.current + Math.PI / 2);
      }
    },
    { phase: "update" },
  );

  // Laid flat in the geometry rather than on the mesh, so the material's
  // local xz is the world's and `mapUv` means the same thing everywhere.
  const geometry = useMemo(() => {
    const g = new PlaneGeometry(WORLD, WORLD, SEGMENTS, SEGMENTS);
    g.rotateX(-Math.PI / 2);
    return g;
  }, []);
  // Raised by half its height so the base, not the middle, meets the ground.
  const treeGeometry = useMemo(() => {
    const g = new ConeGeometry(0.04, 0.14, 5);
    g.translate(0, 0.07, 0);
    return g;
  }, []);
  const shadowGeometry = useMemo(() => {
    const g = new PlaneGeometry(0.6, 0.6, 12, 12);
    g.rotateX(-Math.PI / 2);
    return g;
  }, []);

  return (
    <>
      <mesh geometry={geometry} castShadow receiveShadow>
        <meshStandardNodeMaterial
          positionNode={nodes.position}
          normalNode={nodes.normal}
          colorNode={nodes.color}
          roughness={0.95}
        />
      </mesh>

      {/* Water is a flat sheet at the water line. It reads the same dial the
          colour does, so the coast moves with the slider. */}
      <mesh rotation-x={-Math.PI / 2} position-y={values.water * values.amplitude}>
        <planeGeometry args={[WORLD, WORLD]} />
        <meshStandardNodeMaterial color="#1a3f6a" roughness={0.15} transparent opacity={0.8} />
      </mesh>

      {/* Never culled: the CPU thinks every cone is at the origin, and the
          shader is the only thing that knows where they went. */}
      <instancedMesh
        args={[treeGeometry, undefined, TREES]}
        frustumCulled={false}
        castShadow
      >
        <meshStandardNodeMaterial
          positionNode={nodes.treePosition}
          colorNode={nodes.treeColor}
          roughness={0.9}
        />
      </instancedMesh>

      {/* Boxy on purpose. Every part is axis aligned in the group, so the
          altitude added in the shader is straight up for all of them. */}
      <group ref={airplaneRef}>
        <mesh>
          <boxGeometry args={[0.3, 0.06, 0.07]} />
          <meshStandardNodeMaterial positionNode={nodes.airplanePosition} color="#e8e4dc" roughness={0.5} />
        </mesh>
        <mesh>
          <boxGeometry args={[0.09, 0.013, 0.39]} />
          <meshStandardNodeMaterial positionNode={nodes.airplanePosition} color="#c8402a" roughness={0.5} />
        </mesh>
        <mesh position={[-0.13, 0.043, 0]}>
          <boxGeometry args={[0.05, 0.086, 0.013]} />
          <meshStandardNodeMaterial positionNode={nodes.airplanePosition} color="#c8402a" roughness={0.5} />
        </mesh>
      </group>

      <mesh geometry={shadowGeometry} frustumCulled={false}>
        <meshBasicNodeMaterial
          positionNode={nodes.shadowPosition}
          color="#000000"
          transparent
          opacity={0.35}
          depthWrite={false}
        />
      </mesh>
    </>
  );
}

/**
 * The experience root. The bake counter lives here so the overlay outside
 * the Canvas can show it. It is only a number: the map itself never leaves
 * the GPU.
 */
export function TerrainAirplane() {
  const [bakes, setBakes] = useState(0);

  return (
    <div className="absolute inset-0">
      <Canvas
        shadows
        camera={{ position: STAGE_CAMERA, fov: 40 }}
        dpr={[1, 2]}
        renderer={{
          antialias: true,
          // The studio environment is HDR, so the highlights need a tone map
          // to land somewhere other than flat white.
          toneMapping: ACESFilmicToneMapping,
          outputColorSpace: SRGBColorSpace,
        }}
      >
        <Stage>
          <Landscape onBake={() => setBakes((n) => n + 1)} />
        </Stage>
      </Canvas>

      {/* How often the noise has actually run. Drag a dial to move it. */}
      <div className="pointer-events-none absolute right-16 bottom-5 z-30 rounded-lg bg-background/70 px-3 py-2 font-mono text-[11px] tracking-[0.06em] text-faint backdrop-blur-sm">
        heightmap baked {bakes} time{bakes === 1 ? "" : "s"} · sampled every frame
      </div>
    </div>
  );
}
