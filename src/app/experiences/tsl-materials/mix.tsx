"use client";

import {
  ACESFilmicToneMapping,
  SRGBColorSpace,
} from "three/webgpu";
import { mix } from "three/tsl";
import { Canvas, useNodes, useUniforms } from "@react-three/fiber/webgpu";
import { useControls } from "leva";

import { Stage, STAGE_CAMERA } from "@/app/experiences/stage";

import { SwitchingMesh } from "./switching-mesh";

/**
 * TSL materials, one of four: mix.
 *
 * The smallest thing. The stage, one switching mesh, one standard node
 * material whose colour is a graph instead of a value. Three hooks carry the
 * whole idea. `useUniforms` turns the Leva values into uniforms and files
 * them under the `tslMix` scope. `useNodes` runs its builder once, the first
 * time the scope is seen, and hands the graph back on every render after.
 * The material takes the graph as its `colorNode` prop, the same way it would
 * take a colour.
 *
 * `roughness` never becomes a uniform. It is a plain material property, so
 * it goes straight onto the JSX. Not every dial has to be a node.
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
    // Fiber alpha.5 types require `uniforms.scope("tslMix")` here. This
    // workshop patches the declarations to match the runtime's dot access.
    return { surface: mix(u.colorA, u.colorB, u.blend) };
  }, "tslMix");

  return (
    <SwitchingMesh>
      <meshStandardNodeMaterial colorNode={nodes.surface} roughness={roughness} />
    </SwitchingMesh>
  );
}

export function MaterialsMix() {
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
          <Subject />
        </Stage>
      </Canvas>
    </div>
  );
}
