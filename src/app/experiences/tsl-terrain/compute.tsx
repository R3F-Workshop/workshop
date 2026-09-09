"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import {
  ACESFilmicToneMapping,
  HalfFloatType,
  PlaneGeometry,
  SRGBColorSpace,
  StorageTexture,
  type Node,
} from "three/webgpu";
import {
  float,
  Fn,
  instanceIndex,
  int,
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
 * Terrain, three of five: compute.
 *
 * The same plane, the same bands, and the noise has left the vertex stage.
 * It runs once, in a compute pass, into a storage texture: the height in
 * red, the normal in green, blue and alpha. The pass is dispatched only
 * when a dial that feeds it changes. The counter in the corner is how many
 * times that has happened. The ground now samples the texture with plain
 * `texture()`, the same node a loaded image would use, and reads the
 * answer instead of computing it.
 *
 * Drag a slider and the counter moves by one. Orbit the camera and it does
 * not move at all, because a still landscape costs nothing to keep.
 *
 * One convention holds it together: a world xz maps to a texel through
 * `mapUv`, and both the bake and the sampler go through it.
 */

/** Texels along one edge of the map. */
const SIZE = 256;
/** The terrain's edge, in world units. Six, so it sits inside the room. */
const WORLD = 6;
/** Vertices along one edge of the ground. */
const SEGMENTS = 200;

/**
 * The plane, its material, the water, and the map. Registers the uniforms
 * and the storage texture, builds the graph, and decides when to bake. An
 * effect on the dials that feed the bake sets a dirty flag, and the loop
 * clears it with one dispatch, so dragging a slider costs one bake per
 * change rather than one per frame.
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
  useUniforms(values, "tslTerrain");

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
    // one texel over. The same three evaluations the vertex stage made, and
    // now they only run when a dial moves.
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

    // The ground. Position and normal come straight out of the texture. A
    // texture read is cheap enough to do again per fragment for the colour,
    // which the fractal never was.
    const ground = sample(positionLocal.xz);
    const h = ground.r;
    const normal = ground.gba;
    const slope = float(1).sub(normal.y);
    const rock = mix(vec3(0.24, 0.36, 0.14), vec3(0.32, 0.29, 0.26), smoothstep(0.25, 0.45, slope));
    const snowy = mix(rock, vec3(0.92, 0.94, 0.98), smoothstep(u.snow.sub(0.04), u.snow.add(0.04), h));
    const sandy = mix(vec3(0.72, 0.64, 0.42), snowy, smoothstep(u.water, u.water.add(0.04), h));

    return {
      bake,
      position: vec3(positionLocal.x, h.mul(u.amplitude), positionLocal.z),
      normal: transformNormalToView(normal),
      color: sandy,
    };
  }, "tslTerrain");

  const renderer = useThree((s) => s.renderer);

  // Rebake only when a dial the bake reads has moved. The uniforms were
  // written by `useUniforms` during this render, so the loop can dispatch
  // against them on the next frame. Water and snow are not in the list:
  // they only colour, and colour is sampled every frame anyway.
  const dirty = useRef(false);
  const { frequency, octaves, lacunarity, gain, amplitude, offsetX, offsetZ } = values;
  useEffect(() => {
    dirty.current = true;
  }, [frequency, octaves, lacunarity, gain, amplitude, offsetX, offsetZ]);

  useFrame(
    () => {
      if (!dirty.current) return;
      dirty.current = false;
      renderer.compute(nodes.bake);
      onBake();
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
    </>
  );
}

/**
 * The experience root. The bake counter lives here so the overlay outside
 * the Canvas can show it. It is only a number: the map itself never leaves
 * the GPU.
 */
export function TerrainCompute() {
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
