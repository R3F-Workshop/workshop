"use client";

import {
  Canvas,
  useFrame,
  useGPUStorage,
  useLocalNodes,
  useThree,
  useUniforms,
  type CreatorState,
} from "@react-three/fiber/webgpu";
import { useControls } from "leva";
import { useEffect, useMemo, useRef, useState } from "react";
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
  HalfFloatType,
  PlaneGeometry,
  StorageTexture,
  Vector2,
  type Group,
  type Node,
  type UniformNode,
  type WebGPURenderer,
} from "three/webgpu";

import { useWebGPU } from "@/lib/use-webgpu";

/**
 * Compute, six: terrain.
 *
 * The usual terrain shader evaluates its noise in the vertex stage, which
 * means every vertex, every frame, whether or not anything changed. Add
 * trees that need the height under them and a plane that needs the height
 * ahead of it, and the same noise is being evaluated three times over, per
 * frame, for a landscape that is standing perfectly still.
 *
 * Here the noise runs once, in a compute pass, into a storage texture: the
 * height in red, the normal in green, blue and alpha. The pass is dispatched
 * only when a Leva dial that feeds it changes. The counter in the corner is
 * how many times that has happened. Everything else in the scene samples
 * the texture with plain `texture()`, the same node a loaded image would
 * use, and reads the answer instead of computing it.
 *
 * Three things read it, and none of them know what noise is. The ground
 * displaces and shades from it. Three thousand trees place themselves on
 * it, and drop out where it is too wet, too high or too steep. The plane
 * flies a circle the CPU drives, but its altitude is the texture sampled at
 * its own position, so it follows the terrain without the CPU ever seeing a
 * height. Its shadow samples per vertex and hugs the slope.
 *
 * One convention holds it together: a world xz maps to a texel through
 * `mapUv`, and both the bake and every sampler go through it.
 */

//* Tunables and uniforms ======================================================

const SIZE = 256;
/** The terrain's edge, in world units. */
const WORLD = 14;
const TREES = 3000;
/** The plane's circuit radius. */
const ORBIT = 4.5;

type Uniforms = {
  frequency: UniformNode<"float", number>;
  octaves: UniformNode<"float", number>;
  lacunarity: UniformNode<"float", number>;
  gain: UniformNode<"float", number>;
  amplitude: UniformNode<"float", number>;
  offsetX: UniformNode<"float", number>;
  offsetZ: UniformNode<"float", number>;
  /** Heights below this, as a fraction of the map, are under water. */
  water: UniformNode<"float", number>;
  snow: UniformNode<"float", number>;
  /** Height above the ground the plane keeps. */
  clearance: UniformNode<"float", number>;
  /** Where the plane is, written by the loop. */
  planeXZ: UniformNode<"vec2", Vector2>;
};

/** World xz to a texel address in 0..1. The one convention everything shares. */
const mapUv = (xz: Node<"vec2">) => xz.div(WORLD).add(0.5);

//* GPU build ==================================================================

/**
 * The creator, run once by `useLocalNodes`. One pass, `bake`, writes the
 * map. Everything else it returns is a read: node graphs that go through
 * `sample` and feed five materials. Building them in one place is what
 * keeps them on one convention, and it is why the plane, the trees, and the
 * ground never disagree about how high the terrain is.
 *
 * `noiseAt` is only called inside `bake`. If a material called it, the
 * noise would be back in the vertex stage, every vertex every frame, and
 * the demo would have nothing to say.
 */
function build({ uniforms, gpuStorage }: CreatorState) {
  const u = uniforms.scope("computeTerrain") as unknown as Uniforms;
  const map = gpuStorage.computeTerrainMap as unknown as StorageTexture;

  /** The noise, mapped to roughly 0..1. Only the bake calls it. */
  const noiseAt = (xz: Node<"vec2">) =>
    mx_fractal_noise_float(
      xz.mul(u.frequency).add(vec2(u.offsetX, u.offsetZ)),
      int(u.octaves),
      u.lacunarity,
      u.gain,
    )
      .mul(0.5)
      .add(0.5);

  // One invocation per texel. Height, then a normal from two more samples
  // one texel over. Three noise evaluations per texel, and it only runs when
  // a dial moves.
  const bake = Fn(() => {
    const x = instanceIndex.mod(SIZE);
    const y = instanceIndex.div(SIZE);
    const xz = vec2(float(x), float(y)).add(0.5).div(SIZE).sub(0.5).mul(WORLD);
    const texel = WORLD / SIZE;
    const h = noiseAt(xz);
    const hx = noiseAt(xz.add(vec2(texel, 0)));
    const hz = noiseAt(xz.add(vec2(0, texel)));
    const n = normalize(
      vec3(h.sub(hx).mul(u.amplitude), texel, h.sub(hz).mul(u.amplitude)),
    );
    textureStore(map, uvec2(x, y), vec4(h, n)).toWriteOnly();
  })().compute(SIZE * SIZE);

  /** The baked sample at a world xz. Vertex stage safe, hence `level(0)`. */
  const sample = (xz: Node<"vec2">) => texture(map, mapUv(xz)).level(int(0));

  // The ground. Position and normal come straight out of the texture, and
  // the colour is a few bands over height and slope.
  const ground = sample(positionLocal.xz);
  const height = ground.r;
  const normal = ground.gba;
  const slope = float(1).sub(normal.y);
  const rock = mix(vec3(0.24, 0.36, 0.14), vec3(0.32, 0.29, 0.26), smoothstep(0.25, 0.45, slope));
  const snowy = mix(rock, vec3(0.92, 0.94, 0.98), smoothstep(u.snow.sub(0.04), u.snow.add(0.04), height));
  const sandy = mix(vec3(0.72, 0.64, 0.42), snowy, smoothstep(u.water, u.water.add(0.04), height));

  // A tree. Placed by a hash of its index, sized by another, and scaled to
  // nothing where the ground under it is wrong for a tree.
  const treeXZ = vec2(hash(instanceIndex), hash(instanceIndex.add(1)))
    .sub(0.5)
    .mul(WORLD * 0.96);
  const under = sample(treeXZ);
  const fits = smoothstep(u.water.add(0.02), u.water.add(0.06), under.r)
    .mul(float(1).sub(smoothstep(u.snow.sub(0.06), u.snow, under.r)))
    .mul(float(1).sub(smoothstep(0.3, 0.42, float(1).sub(under.b))));
  const treeScale = hash(instanceIndex.add(2)).mul(0.5).add(0.6).mul(fits);

  // The plane's altitude. One sample, at a uniform, shared by every part.
  const flying = sample(u.planeXZ);
  const altitude = max(flying.r, u.water).mul(u.amplitude).add(u.clearance);

  // The shadow samples per vertex around the plane, so it hugs the slope.
  const shadowXZ = positionLocal.xz.add(u.planeXZ);

  return {
    bake,
    groundPosition: vec3(positionLocal.x, height.mul(u.amplitude), positionLocal.z),
    groundNormal: transformNormalToView(normal),
    groundColor: sandy,
    treePosition: positionLocal
      .mul(treeScale)
      .add(vec3(treeXZ.x, under.r.mul(u.amplitude), treeXZ.y)),
    treeColor: mix(vec3(0.1, 0.25, 0.1), vec3(0.2, 0.4, 0.15), hash(instanceIndex.add(3))),
    planePosition: positionLocal.add(vec3(0, altitude, 0)),
    shadowPosition: vec3(
      shadowXZ.x,
      sample(shadowXZ).r.mul(u.amplitude).add(0.03),
      shadowXZ.y,
    ),
  };
}

//* Scene ======================================================================

/**
 * The scene. Registers the uniforms and the map, builds the nodes, and
 * decides when to bake. An effect on the dials that feed the bake sets a
 * dirty flag, and the loop clears it with one dispatch, so dragging a
 * slider costs one bake per change rather than one per frame. The plane's
 * circuit is ordinary CPU animation and shares the same loop.
 */
function Landscape({ onBake }: { onBake: () => void }) {
  const { speed, ...values } = useControls("compute · terrain", {
    frequency: { value: 0.22, min: 0.05, max: 0.6, step: 0.01 },
    octaves: { value: 5, min: 1, max: 8, step: 1 },
    lacunarity: { value: 2, min: 1.5, max: 3, step: 0.05 },
    gain: { value: 0.5, min: 0.2, max: 0.8, step: 0.01 },
    amplitude: { value: 2.4, min: 0, max: 5, step: 0.05 },
    offsetX: { value: 0, min: -10, max: 10, step: 0.05 },
    offsetZ: { value: 0, min: -10, max: 10, step: 0.05 },
    water: { value: 0.42, min: 0, max: 1, step: 0.01 },
    snow: { value: 0.78, min: 0, max: 1, step: 0.01 },
    clearance: { value: 0.6, min: 0.1, max: 2, step: 0.05 },
    // CPU only. The plane's speed around its circuit.
    speed: { value: 1.2, min: 0, max: 4, step: 0.05 },
  });

  // The same Vector2 on every render, so the hook never resets it.
  const planeXZ = useMemo(() => new Vector2(ORBIT, 0), []);
  useUniforms({ ...values, planeXZ }, "computeTerrain");

  // Height and normal, half float so the normal can go negative.
  useGPUStorage(() => {
    const t = new StorageTexture(SIZE, SIZE);
    t.type = HalfFloatType;
    return { computeTerrainMap: t };
  });

  const nodes = useLocalNodes(build);

  // `useThree` types `renderer` as the WebGL/WebGPU union even on the /webgpu
  // entry, and `compute` only exists on the WebGPU one.
  const renderer = useThree((s) => s.renderer) as unknown as WebGPURenderer;

  // Rebake only when a dial the bake reads has moved. The uniforms were
  // written by `useUniforms` during this render, so the loop can dispatch
  // against them on the next frame.
  const dirty = useRef(false);
  const { frequency, octaves, lacunarity, gain, amplitude, offsetX, offsetZ } = values;
  useEffect(() => {
    dirty.current = true;
  }, [frequency, octaves, lacunarity, gain, amplitude, offsetX, offsetZ]);

  const plane = useRef<Group>(null);
  const heading = useRef(0);

  useFrame(({ delta }) => {
    if (dirty.current) {
      dirty.current = false;
      renderer.compute(nodes.bake);
      onBake();
    }

    // The circuit is CPU work: where the plane is and which way it faces.
    // How high it is, the GPU decides.
    heading.current += (delta * speed) / ORBIT;
    const x = Math.cos(heading.current) * ORBIT;
    const z = Math.sin(heading.current) * ORBIT;
    planeXZ.set(x, z);
    if (plane.current) {
      plane.current.position.set(x, 0, z);
      plane.current.rotation.y = -(heading.current + Math.PI / 2);
    }
  });

  // Laid flat in the geometry rather than on the mesh, so the material's
  // local xz is the world's and `mapUv` means the same thing everywhere.
  const groundGeometry = useMemo(() => {
    const g = new PlaneGeometry(WORLD, WORLD, SIZE, SIZE);
    g.rotateX(-Math.PI / 2);
    return g;
  }, []);
  const shadowGeometry = useMemo(() => {
    const g = new PlaneGeometry(1.4, 1.4, 12, 12);
    g.rotateX(-Math.PI / 2);
    return g;
  }, []);

  return (
    <>
      <mesh geometry={groundGeometry}>
        <meshStandardNodeMaterial
          positionNode={nodes.groundPosition}
          normalNode={nodes.groundNormal}
          colorNode={nodes.groundColor}
          roughness={0.95}
        />
      </mesh>

      {/* Water is a flat sheet at the water line. It reads the same dial the
          bake does, so the coast moves with the slider. */}
      <mesh rotation-x={-Math.PI / 2} position-y={values.water * values.amplitude}>
        <planeGeometry args={[WORLD, WORLD]} />
        <meshStandardMaterial
          color="#1a3f6a"
          roughness={0.15}
          transparent
          opacity={0.8}
        />
      </mesh>

      <instancedMesh args={[undefined, undefined, TREES]} frustumCulled={false}>
        <coneGeometry args={[0.09, 0.32, 5]} />
        <meshStandardNodeMaterial
          positionNode={nodes.treePosition}
          colorNode={nodes.treeColor}
          roughness={0.9}
        />
      </instancedMesh>

      {/* Boxy on purpose. Every part is axis aligned in the group, so the
          altitude added in the shader is straight up for all of them. */}
      <group ref={plane}>
        <mesh>
          <boxGeometry args={[0.7, 0.14, 0.16]} />
          <meshStandardNodeMaterial positionNode={nodes.planePosition} color="#e8e4dc" roughness={0.5} />
        </mesh>
        <mesh>
          <boxGeometry args={[0.2, 0.03, 0.9]} />
          <meshStandardNodeMaterial positionNode={nodes.planePosition} color="#c8402a" roughness={0.5} />
        </mesh>
        <mesh position={[-0.3, 0.1, 0]}>
          <boxGeometry args={[0.12, 0.2, 0.03]} />
          <meshStandardNodeMaterial positionNode={nodes.planePosition} color="#c8402a" roughness={0.5} />
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

//* Experience =================================================================

/**
 * The experience root. Owns the Canvas and the camera, fills whatever box
 * the shell mounts it in, and returns null without WebGPU because compute
 * has no WebGL fallback.
 *
 * The bake counter lives here so the overlay outside the Canvas can show
 * it. It is only a number: the map itself never leaves the GPU.
 */
export function ComputeTerrain() {
  const [bakes, setBakes] = useState(0);

  // No WebGPU, no experience. The shell around this decides what to show instead.
  if (useWebGPU() !== "yes") return null;

  return (
    <div className="absolute inset-0">
      <Canvas
        camera={{ position: [0, 8, 12], fov: 42 }}
        dpr={[1, 2]}
        renderer={{ alpha: false, antialias: true }}
      >
        <color attach="background" args={["#08080a"]} />
        <hemisphereLight args={["#b8c4ee", "#2a2418", 0.6]} />
        <directionalLight position={[6, 9, 4]} intensity={2.4} color="#fff4e0" />
        <Landscape onBake={() => setBakes((n) => n + 1)} />
      </Canvas>

      {/* How often the noise has actually run. Drag a dial to move it. */}
      <div className="pointer-events-none absolute right-16 bottom-5 z-30 font-mono text-[11px] tracking-[0.06em] text-faint">
        heightmap baked {bakes} time{bakes === 1 ? "" : "s"} · sampled every frame
      </div>
    </div>
  );
}
