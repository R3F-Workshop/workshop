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
import { useMemo, useRef } from "react";
import {
  clamp,
  exp,
  float,
  Fn,
  If,
  instanceIndex,
  int,
  ivec2,
  length,
  mix,
  normalize,
  positionLocal,
  texture,
  textureLoad,
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
  Vector3,
  type WebGPURenderer,
} from "three/webgpu";

import { useWebGPU } from "@/lib/use-webgpu";

/**
 * Compute, four: neighbors.
 *
 * Invocations reading what other invocations wrote. Every demo so far had
 * each index minding its own element. Here each texel's next height depends
 * on the four texels around it, and that one change is the thing a vertex or
 * fragment shader cannot do at all: they see their own vertex, their own
 * pixel, nothing else.
 *
 * It comes with a rule. A pass cannot read a texture it is also writing,
 * because a neighbour may already hold next frame's value by the time you
 * read it. So there are two textures. A pass reads A and writes B, the next
 * reads B and writes A. Ping-pong. Both passes run every frame so the answer
 * always ends up in A, and the material only ever samples A. The common
 * alternative is one pass a frame and swapping which texture is which.
 *
 * The texel holds two heights, now and a frame ago, in its red and green
 * channels. That is the whole wave equation: the next height is the average
 * of the neighbours, pulled by where it was last frame, times a damping.
 * Storing the previous height beside the current one is what lets one
 * texture carry a second order simulation.
 *
 * The storage textures are half float. The default eight bit texture clamps
 * to 0..1, and a wave needs to go negative.
 */

//* Tunables and uniforms ======================================================

const SIZE = 256;
/** The sheet's edge, in world units. */
const WORLD = 8;

//* GPU build ==================================================================

/**
 * The creator, run once by `useLocalNodes`. `step` is a factory: hand it a
 * source and a destination and it returns a pass that reads one and writes
 * the other. Calling it twice, with the textures swapped, is the whole
 * ping-pong. `splash` is a JavaScript boolean read while the kernel is
 * built, so the drop code is compiled into the first pass and absent from
 * the second. That is the difference between an `if` and a TSL `If`.
 *
 * The material samples texture A with `texture()`, the same node a loaded
 * image would use. Once a storage texture has been written it is just a
 * texture, and the rest of the scene need not know how it was made.
 */
function build({ uniforms, gpuStorage }: CreatorState) {
  const u = uniforms.computeNeighbors;
  const a = gpuStorage.computeNeighborsA as unknown as StorageTexture;
  const b = gpuStorage.computeNeighborsB as unknown as StorageTexture;

  /** One step of the wave, from one texture into the other. */
  const step = (from: StorageTexture, into: StorageTexture, splash: boolean) =>
    Fn(() => {
      const x = instanceIndex.mod(SIZE);
      const y = instanceIndex.div(SIZE);
      const fx = float(x);
      const fy = float(y);

      // Neighbours are clamped to the edge, so the border reflects rather
      // than reads off the end of the texture.
      const at = (dx: number, dy: number) =>
        textureLoad(
          from,
          ivec2(int(clamp(fx.add(dx), 0, SIZE - 1)), int(clamp(fy.add(dy), 0, SIZE - 1))),
        ).r;

      const here = textureLoad(from, ivec2(int(x), int(y)));
      const now = here.r;
      const before = here.g;

      // Discrete wave equation. The neighbour average pulls the height
      // toward its surroundings, the previous height carries momentum.
      const around = at(-1, 0).add(at(1, 0)).add(at(0, -1)).add(at(0, 1)).mul(0.25);
      const next = now
        .mul(2)
        .sub(before)
        .add(around.sub(now).mul(u.speed.mul(4)))
        .mul(u.damping)
        .toVar();

      // The drop only lands in the first pass, so it is added once a frame.
      if (splash) {
        If(u.drop.z.greaterThan(0), () => {
          const d = length(vec2(fx, fy).sub(u.drop.xy));
          next.subAssign(
            u.drop.z.mul(exp(d.mul(d).div(u.spread.mul(u.spread)).negate())),
          );
        });
      }

      textureStore(into, uvec2(x, y), vec4(next, now, 0, 1)).toWriteOnly();
    })().compute(SIZE * SIZE);

  // Finite differences over A for the normal. Sampled in the vertex stage,
  // so `level(0)` is explicit.
  const texel = 1 / SIZE;
  const uv = positionLocal.xz.div(WORLD).add(0.5);
  const h = (offset: [number, number]) =>
    texture(a, uv.add(vec2(offset[0], offset[1]))).level(int(0)).r;
  const height = h([0, 0]);
  const slope = vec3(
    h([-texel, 0]).sub(h([texel, 0])),
    texel * 2,
    h([0, -texel]).sub(h([0, texel])),
  ).mul(vec3(u.amplitude, 1, u.amplitude));

  return {
    toB: step(a, b, true),
    toA: step(b, a, false),
    positionNode: vec3(positionLocal.x, height.mul(u.amplitude), positionLocal.z),
    normalNode: transformNormalToView(normalize(slope)),
    colorNode: mix(u.deep, u.crest, clamp(height.mul(2).add(0.5), 0, 1)),
  };
}

//* Scene ======================================================================

/**
 * The scene. Allocates the two textures, builds the passes, and runs both
 * every frame. Rain is a CPU decision written into the `drop` uniform, and
 * the pointer writes the same uniform, so the GPU sees one source of drops
 * and does not care where they came from.
 */
function Sheet() {
  const { rain, ...values } = useControls("compute · neighbors", {
    spread: { value: 3, min: 1, max: 12, step: 0.5 },
    damping: { value: 0.995, min: 0.9, max: 1, step: 0.001 },
    speed: { value: 0.35, min: 0.05, max: 0.5, step: 0.01 },
    amplitude: { value: 0.6, min: 0, max: 4, step: 0.05 },
    deep: "#0b1a3a",
    crest: "#cfe6ff",
    // CPU only. Whether the loop drops random stones.
    rain: true,
  });

  // The same Vector3 on every render, so the hook never resets it.
  const drop = useMemo(() => new Vector3(0, 0, 0), []);
  useUniforms({ ...values, drop }, "computeNeighbors");

  // Two, for the ping-pong. Half float, because the default clamps to 0..1.
  useGPUStorage(() => {
    const make = () => {
      const t = new StorageTexture(SIZE, SIZE);
      t.type = HalfFloatType;
      return t;
    };
    return { computeNeighborsA: make(), computeNeighborsB: make() };
  });

  const nodes = useLocalNodes(build);

  // `useThree` types `renderer` as the WebGL/WebGPU union even on the /webgpu
  // entry, and `compute` only exists on the WebGPU one.
  const renderer = useThree((s) => s.renderer) as unknown as WebGPURenderer;

  const untilRain = useRef(0);
  useFrame(({ delta }) => {
    if (rain) {
      untilRain.current -= delta;
      if (untilRain.current <= 0) {
        untilRain.current = 0.4 + Math.random() * 1.2;
        drop.set(Math.random() * SIZE, Math.random() * SIZE, 0.4 + Math.random() * 0.4);
      }
    }
    // Two half steps, A to B then B to A, so A always holds the latest.
    renderer.compute(nodes.toB);
    renderer.compute(nodes.toA);
    // The drop was consumed by `toB`. Zero it or it lands every frame.
    drop.z = 0;
  });

  // Laid flat in the geometry rather than on the mesh, so the material's
  // local xz is the ground and the height maths stays in one space. The uv
  // keeps its v axis pointing the other way from local z, hence the flip in
  // the handlers.
  const geometry = useMemo(() => {
    const g = new PlaneGeometry(WORLD, WORLD, SIZE, SIZE);
    g.rotateX(-Math.PI / 2);
    return g;
  }, []);
  const texelAt = (uv: { x: number; y: number }, strength: number) =>
    drop.set(uv.x * SIZE, (1 - uv.y) * SIZE, strength);

  return (
    <mesh
      geometry={geometry}
      // The sheet is also the pointer target. Its uv maps straight onto the
      // texture, so a touch is a texel address.
      onPointerMove={(e) => e.uv && texelAt(e.uv, 0.08)}
      onPointerDown={(e) => e.uv && texelAt(e.uv, 1)}
    >
      <meshStandardNodeMaterial
        positionNode={nodes.positionNode}
        normalNode={nodes.normalNode}
        colorNode={nodes.colorNode}
        roughness={0.25}
        metalness={0.1}
      />
    </mesh>
  );
}

//* Experience =================================================================

/**
 * The experience root. Owns the Canvas and the camera, fills whatever box
 * the shell mounts it in, and returns null without WebGPU because compute
 * has no WebGL fallback.
 */
export function ComputeNeighbors() {
  // No WebGPU, no experience. The shell around this decides what to show instead.
  if (useWebGPU() !== "yes") return null;

  return (
    <div className="absolute inset-0">
      <Canvas
        camera={{ position: [0, 6, 7], fov: 40 }}
        dpr={[1, 2]}
        renderer={{ alpha: false, antialias: true }}
      >
        <color attach="background" args={["#08080a"]} />
        <ambientLight intensity={0.4} color="#b8c4ee" />
        <directionalLight position={[3, 6, 2]} intensity={2.5} color="#fff4e0" />
        <Sheet />
      </Canvas>
    </div>
  );
}
