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
import { useRef } from "react";
import {
  cos,
  float,
  Fn,
  instanceIndex,
  sin,
  texture,
  textureStore,
  uint,
  uvec2,
  vec2,
  vec3,
  vec4,
} from "three/tsl";
import {
  StorageTexture,
  type Mesh,
  type WebGPURenderer,
} from "three/webgpu";

import { useWebGPU } from "@/lib/use-webgpu";

/**
 * TSL hooks, seven: storage.
 *
 * Storage is data the GPU owns. The CPU allocates it and never sees the
 * numbers again; a compute pass writes them and the vertex or fragment
 * stage reads them, all without a byte crossing the bus. `useGPUStorage`
 * puts it in the store by name, like a buffer, so any component can find
 * it.
 *
 * Here the storage is a texture. `Plasma` allocates a 256 by 256
 * `StorageTexture`, and every frame a compute pass runs once per texel,
 * writing a colour with `textureStore`. `Sheet` and `Ball` sample it with
 * plain `texture()`, the same node a loaded image would use. The CPU's whole
 * part is three uniforms and one `renderer.compute` call a frame.
 *
 * The flip grid does the same thing with a storage buffer of structs, where
 * each element is one tile's state. A storage texture is the same idea with
 * a 2D address and a sampler on the way out, which is what makes it the
 * right shape for anything image-like: a heightmap, a flow field, a
 * simulation grid.
 *
 * Registered at the root with a prefixed key rather than in a scope: r3f
 * names scoped storage `scope.name`, and three builds the shader identifier
 * off that. See pmndrs/react-three-fiber#3848.
 */

const SIZE = 256;

function plasmaBuild({ uniforms, gpuStorage }: CreatorState) {
  const u = uniforms.hooksStorage;
  const field = gpuStorage.hooksStorageField as unknown as StorageTexture;

  // One invocation per texel. The index unrolls to a pixel address. The
  // `uint` casts are for the types only; the maths is already unsigned.
  const update = Fn(() => {
    const x = uint(instanceIndex.mod(SIZE));
    const y = uint(instanceIndex.div(SIZE));
    const p = vec2(float(x), float(y)).div(SIZE).sub(0.5).mul(u.scale);

    // Three sines at different angles, the classic plasma, mapped to 0..1.
    const v = sin(p.x.add(u.t))
      .add(sin(p.y.mul(1.3).sub(u.t.mul(0.7))))
      .add(sin(p.x.add(p.y).add(u.t.mul(0.5))))
      .div(3)
      .mul(0.5)
      .add(0.5);

    // The cosine palette from the shared nodes demo.
    const rgb = vec3(0.5).add(
      vec3(0.5).mul(
        cos(vec3(0, 0.33, 0.67).add(v).add(u.hue).mul(Math.PI * 2)),
      ),
    );

    textureStore(field, uvec2(x, y), vec4(rgb, 1)).toWriteOnly();
  })().compute(SIZE * SIZE);

  return { update };
}

function Plasma() {
  const { speed, ...values } = useControls("tsl hooks · storage", {
    scale: { value: 6, min: 1, max: 24, step: 0.5 },
    hue: { value: 0, min: 0, max: 1, step: 0.01 },
    // CPU only. It scales the clock before the clock becomes a uniform.
    speed: { value: 1, min: 0, max: 4, step: 0.05 },
  });
  const u = useUniforms({ ...values, t: 0 }, "hooksStorage");

  // Allocated once, never read back.
  useGPUStorage(() => ({ hooksStorageField: new StorageTexture(SIZE, SIZE) }));

  const { update } = useLocalNodes(plasmaBuild);

  // `useThree` types `renderer` as the WebGL/WebGPU union even on the /webgpu
  // entry, and `compute` only exists on the WebGPU one.
  const renderer = useThree((s) => s.renderer) as unknown as WebGPURenderer;

  useFrame(({ delta }) => {
    u.t.value += delta * speed;
    // Runs in the update phase, ahead of the render, so the samplers below
    // read the texels this pass just wrote.
    renderer.compute(update);
  });

  return null;
}

function sampleBuild({ gpuStorage }: CreatorState) {
  const field = gpuStorage.hooksStorageField as unknown as StorageTexture;
  // The same node a loaded image would use.
  return { colorNode: texture(field) };
}

function Sheet() {
  const nodes = useLocalNodes(sampleBuild);
  return (
    <mesh position={[-1.6, 0, 0]}>
      <planeGeometry args={[2.6, 2.6]} />
      <meshBasicNodeMaterial {...nodes} />
    </mesh>
  );
}

function Ball() {
  const nodes = useLocalNodes(sampleBuild);
  const ref = useRef<Mesh>(null);
  useFrame(({ delta }) => {
    if (ref.current) ref.current.rotation.y += delta * 0.3;
  });
  return (
    <mesh ref={ref} position={[1.9, 0, 0]}>
      <sphereGeometry args={[1.1, 64, 64]} />
      <meshStandardNodeMaterial {...nodes} roughness={0.4} />
    </mesh>
  );
}

export function HooksStorage() {
  // No WebGPU, no experience. The shell around this decides what to show instead.
  if (useWebGPU() !== "yes") return null;

  return (
    <div className="absolute inset-0">
      <Canvas
        camera={{ position: [0, 0, 7], fov: 35 }}
        dpr={[1, 2]}
        renderer={{ alpha: false, antialias: true }}
      >
        <color attach="background" args={["#08080a"]} />
        <ambientLight intensity={0.6} color="#b8c4ee" />
        <directionalLight position={[4, 6, 3]} intensity={2} color="#fff4e0" />
        {/* The owner renders first, so the storage is registered before the
            samplers build. */}
        <Plasma />
        <Sheet />
        <Ball />
      </Canvas>
    </div>
  );
}
