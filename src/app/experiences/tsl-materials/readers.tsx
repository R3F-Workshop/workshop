"use client";

import {
  ACESFilmicToneMapping,
  SRGBColorSpace,
} from "three/webgpu";
import { mix } from "three/tsl";
import { Canvas, useNodes, useUniforms } from "@react-three/fiber/webgpu";
import { useControls } from "leva";

import { Stage, STAGE_CAMERA } from "@/app/experiences/stage";

import { Box, Pyramid } from "./readers-meshes";
import { SwitchingMesh } from "./switching-mesh";

/**
 * TSL materials, two of four: readers.
 *
 * The subject from step one, unchanged, and two more meshes on the floor
 * beside it that never touch Leva. One graph, three materials. The box reads
 * the shared `surface` back through `useNodes` and uses it as is. The pyramid
 * builds a local graph around it with `useLocalNodes`. Both live in
 * `readers-meshes.tsx`, where the difference between registering a graph and
 * consuming one is the whole point.
 *
 * Order matters once. The subject renders first, so the scope is in the
 * store, filled synchronously in that render, before either reader asks for
 * it.
 */

function Subject() {
  const { roughness, ...values } = useControls("tsl materials · mix", {
    colorA: "#c8a060",
    colorB: "#2b4a9e",
    blend: { value: 0.5, min: 0, max: 1, step: 0.01 },
    // CPU only. A material property, not a uniform.
    roughness: { value: 0.4, min: 0, max: 1, step: 0.01 },
  });
  // Hex strings become colour uniforms. Numbers become float uniforms.
  useUniforms(values, "tslMix");

  const nodes = useNodes(({ uniforms }) => {
    const u = uniforms.tslMix;
    return { surface: mix(u.colorA, u.colorB, u.blend) };
  }, "tslMix");

  return (
    <SwitchingMesh>
      <meshStandardNodeMaterial colorNode={nodes.surface} roughness={roughness} />
    </SwitchingMesh>
  );
}

export function MaterialsReaders() {
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
          {/* The writer first. The readers below find the scope filled. */}
          <Subject />
          <Box />
          <Pyramid />
        </Stage>
      </Canvas>
    </div>
  );
}
