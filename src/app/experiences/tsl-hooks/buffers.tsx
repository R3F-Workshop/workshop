"use client";

import {
  Canvas,
  useBuffers,
  useFrame,
  useLocalNodes,
  useUniforms,
  type CreatorState,
} from "@react-three/fiber/webgpu";
import { useControls } from "leva";
import { useRef } from "react";
import { instancedBufferAttribute, mix, positionLocal, vec3 } from "three/tsl";
import {
  DynamicDrawUsage,
  InstancedBufferAttribute,
  type Color,
  type Mesh,
  type Node,
  type UniformNode,
} from "three/webgpu";

import { useWebGPU } from "@/lib/use-webgpu";

/**
 * TSL hooks, five: buffers.
 *
 * A buffer is data the CPU owns and the GPU reads as a vertex or instance
 * attribute. `useBuffers` puts one in the store by name, exactly like a
 * uniform, but where a uniform is one value, a buffer is one value per
 * vertex or per instance.
 *
 * `Field` declares two instanced attributes under `hooksBuffers`: an offset
 * per column, filled once, and a height per column, rewritten every frame.
 * `Columns` draws them without ever touching the geometry.
 * `instancedBufferAttribute` turns an attribute into a node, and the builder
 * binds it to the material at build time. `Marker` reads the same heights
 * array on the CPU and sits on the tallest column, which is the thing a
 * storage buffer cannot offer cheaply: the CPU still has the numbers.
 *
 * The frame write is the same shape as the shared uniform demo. The array
 * is the source of truth and `needsUpdate` re-uploads it, one float per
 * column per frame. This is the flip grid's storage step seen from the
 * attribute side. Compute, in the storage demo, is what happens when the
 * GPU owns the numbers instead.
 *
 * The grid is a fixed size on purpose. `useBuffers` runs its creator once
 * per scope and keeps the result, so a buffer sized from a slider would need
 * the scope torn down with it.
 */

const COLS = 32;
const ROWS = 32;
/** Column spacing, in world units. */
const PITCH = 0.22;

/** The attributes, as the store hands them back. */
type Buffers = {
  offsets: InstancedBufferAttribute;
  heights: InstancedBufferAttribute;
};

type Uniforms = {
  base: UniformNode<"color", Color>;
  tip: UniformNode<"color", Color>;
  amplitude: UniformNode<"float", number>;
};

function Field() {
  const { speed, ...values } = useControls("tsl hooks · buffers", {
    base: "#22222a",
    tip: "#ffd9a0",
    amplitude: { value: 1.2, min: 0, max: 3, step: 0.05 },
    // CPU only. Not every dial has to be a uniform.
    speed: { value: 1, min: 0, max: 4, step: 0.05 },
  });
  useUniforms(values, "hooksBuffers");

  // Runs once. The offsets never change; the heights are overwritten below.
  const { heights } = useBuffers(() => {
    const offsets = new Float32Array(COLS * ROWS * 3);
    for (let i = 0; i < COLS * ROWS; i++) {
      offsets[i * 3] = ((i % COLS) - (COLS - 1) / 2) * PITCH;
      offsets[i * 3 + 2] = (Math.floor(i / COLS) - (ROWS - 1) / 2) * PITCH;
    }
    const heights = new InstancedBufferAttribute(
      new Float32Array(COLS * ROWS),
      1,
    );
    heights.setUsage(DynamicDrawUsage);
    return { offsets: new InstancedBufferAttribute(offsets, 3), heights };
  }, "hooksBuffers");

  const t = useRef(0);
  useFrame(({ delta }) => {
    t.current += delta * speed;
    const h = heights.array as Float32Array;
    for (let i = 0; i < COLS * ROWS; i++) {
      const x = (i % COLS) / COLS - 0.5;
      const z = Math.floor(i / COLS) / ROWS - 0.5;
      const wave =
        Math.sin(x * 9 + t.current) * Math.cos(z * 7 - t.current * 0.7);
      h[i] = 0.15 + (wave * 0.5 + 0.5);
    }
    // One flag, and the array the loop just wrote is what the GPU draws next.
    heights.needsUpdate = true;
  });

  return null;
}

function columnsBuild({ buffers, uniforms }: CreatorState) {
  const b = buffers.scope("hooksBuffers") as unknown as Buffers;
  const u = uniforms.scope("hooksBuffers") as unknown as Uniforms;

  // The attributes as nodes. The builder registers them on the material, so
  // the geometry stays a plain box. three types the attribute node as an
  // untyped node, hence the casts; the second argument is what the shader
  // actually goes by.
  const offset = instancedBufferAttribute(b.offsets, "vec3") as Node<"vec3">;
  const height = (
    instancedBufferAttribute(b.heights, "float") as Node<"float">
  ).mul(u.amplitude);

  // A unit box with its base on the ground, stretched to its height and
  // moved to its column.
  const local = vec3(
    positionLocal.x,
    positionLocal.y.add(0.5).mul(height),
    positionLocal.z,
  );

  return {
    positionNode: local.add(offset),
    colorNode: mix(u.base, u.tip, height.mul(0.4)),
  };
}

function Columns() {
  const nodes = useLocalNodes(columnsBuild);
  return (
    <instancedMesh
      args={[undefined, undefined, COLS * ROWS]}
      // Instance transforms live in the shader, so the CPU-side bounding
      // volume is meaningless here.
      frustumCulled={false}
    >
      <boxGeometry args={[PITCH * 0.7, 1, PITCH * 0.7]} />
      <meshStandardNodeMaterial {...nodes} roughness={0.6} />
    </instancedMesh>
  );
}

function Marker() {
  // The reader form. Same attributes, same arrays, read on the CPU.
  //
  // One difference from a builder: a builder sees what the writer staged in
  // the same render, while the reader form is a subscription to the
  // committed store, which the writer fills in a layout effect. So the
  // first render, and the frame that may run before the re-render, see an
  // empty scope. Hence the guard.
  const { offsets, heights } = useBuffers("hooksBuffers") as unknown as Buffers;
  const u = useUniforms("hooksBuffers") as unknown as Uniforms;
  const ref = useRef<Mesh>(null);

  useFrame(() => {
    if (!heights || !u.amplitude) return;
    const h = heights.array as Float32Array;
    let top = 0;
    for (let i = 1; i < h.length; i++) if (h[i] > h[top]) top = i;
    ref.current?.position.set(
      offsets.getX(top),
      h[top] * u.amplitude.value + 0.12,
      offsets.getZ(top),
    );
  });

  return (
    <mesh ref={ref}>
      <sphereGeometry args={[0.08, 16, 16]} />
      <meshStandardMaterial
        color="#ffd9a0"
        emissive="#ffd9a0"
        emissiveIntensity={0.8}
      />
    </mesh>
  );
}

export function HooksBuffers() {
  // No WebGPU, no experience. The shell around this decides what to show instead.
  if (useWebGPU() !== "yes") return null;

  return (
    <div className="absolute inset-0">
      <Canvas
        camera={{ position: [0, 5, 8], fov: 35 }}
        dpr={[1, 2]}
        renderer={{ alpha: false, antialias: true }}
      >
        <color attach="background" args={["#08080a"]} />
        <ambientLight intensity={0.5} color="#b8c4ee" />
        <directionalLight position={[4, 6, 3]} intensity={2} color="#ffd9a0" />
        {/* The writer renders first, so the store is filled before the
            readers build. */}
        <Field />
        <Columns />
        <Marker />
      </Canvas>
    </div>
  );
}
