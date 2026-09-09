"use client";

import { useCallback } from "react";
import {
  ACESFilmicToneMapping,
  SRGBColorSpace,
  type Node,
} from "three/webgpu";
import {
  color,
  int,
  mix,
  mx_cell_noise_float,
  mx_fractal_noise_float,
  mx_worley_noise_float,
  positionLocal,
  smoothstep,
  time,
} from "three/tsl";
import {
  Canvas,
  useLocalNodes,
  useNodes,
  useUniforms,
} from "@react-three/fiber/webgpu";
import { useControls } from "leva";

import { Stage, STAGE_CAMERA } from "@/app/experiences/stage";

import { SwitchingMesh } from "./switching-mesh";

/**
 * TSL materials, three of four: noise.
 *
 * Step two with the flat blend replaced by three animated patterns. The
 * builder still runs once and still returns a record, but now the record
 * holds three graphs, one per mesh, each from a different MaterialX noise:
 * fractal for the subject, Worley for the box, cell for the pyramid. One
 * scope can carry as many graphs as a file wants to register.
 *
 * `time` is a built in. The renderer advances it every frame, so the
 * patterns drift without a frame loop or a uniform of this file's own. The
 * three noises share one sample point, local position scaled by `frequency`
 * and pushed along by `time`, so the dials move all three at once.
 *
 * The readers are the same two meshes as step two, both on `useLocalNodes`
 * now, since neither adds anything to the store. The box passes the `worley`
 * key straight through. The pyramid wraps the `cell` key in a local graph.
 * Neither cares how the pattern was made.
 */

function Subject() {
  const { roughness, ...values } = useControls("tsl materials · noise", {
    colorA: "#c8a060",
    colorB: "#2b4a9e",
    frequency: { value: 2, min: 0.2, max: 8, step: 0.1 },
    speed: { value: 0.4, min: 0, max: 3, step: 0.05 },
    octaves: { value: 3, min: 1, max: 8, step: 1 },
    lacunarity: { value: 2, min: 1, max: 4, step: 0.1 },
    gain: { value: 0.5, min: 0.1, max: 0.9, step: 0.05 },
    contrast: { value: 1.5, min: 0.5, max: 6, step: 0.1 },
    // CPU only. A material property, not a uniform.
    roughness: { value: 0.4, min: 0, max: 1, step: 0.01 },
  });
  useUniforms(values, "tslNoise");

  const nodes = useNodes(({ uniforms }) => {
    const u = uniforms.tslNoise;

    // One sample point for all three noises: local position at the dial's
    // frequency, sliding along every axis with time.
    const p = positionLocal.mul(u.frequency).add(time.mul(u.speed));

    // A contrast curve around the midpoint. 1 leaves a pattern alone and
    // higher values push it toward two flat colours. smoothstep also clamps
    // the result back into 0..1.
    const shape = (pattern: Node<"float">) =>
      smoothstep(0, 1, pattern.sub(0.5).mul(u.contrast).add(0.5));

    // Fractal noise sums octaves of gradient noise and comes back roughly
    // -1..1, so it is remapped before shaping. The octave count is a loop
    // bound on the GPU, so it goes in as an int node.
    const fractal = shape(
      mx_fractal_noise_float(p, int(u.octaves), u.lacunarity, u.gain).mul(0.5).add(0.5),
    );
    // Worley is the distance to the nearest of a set of jittered points and
    // is already 0..1. Cell noise is one flat random value per unit cell.
    const worley = shape(mx_worley_noise_float(p, 1));
    const cell = shape(mx_cell_noise_float(p));

    return {
      fractal: mix(u.colorA, u.colorB, fractal),
      worley: mix(u.colorA, u.colorB, worley),
      cell: mix(u.colorA, u.colorB, cell),
    };
  }, "tslNoise");

  return (
    <SwitchingMesh>
      <meshStandardNodeMaterial colorNode={nodes.fractal} roughness={roughness} />
    </SwitchingMesh>
  );
}

function Box() {
  // A reader with nothing to add, so `useLocalNodes` rather than a second
  // `useNodes`. The creator sees the scope the subject staged in this same
  // render and hands back the one key the box wants. The scope-name form,
  // `useNodes("tslNoise")`, would not do here: it reads the committed store,
  // which the subject fills in a layout effect after this render, so a
  // sibling would see an empty scope until it re-rendered.
  const nodes = useLocalNodes(
    useCallback(({ nodes }) => {
      const shared = nodes.tslNoise;
      return { colorNode: shared.worley };
    }, []),
  );

  return (
    <mesh castShadow receiveShadow position={[-2.4, 0.6, 0]} rotation-y={0.35}>
      <boxGeometry args={[1.2, 1.2, 1.2]} />
      <meshStandardNodeMaterial colorNode={nodes.colorNode} roughness={0.55} />
    </mesh>
  );
}

function Pyramid() {
  const nodes = useLocalNodes(
    useCallback(({ nodes }) => {
      const shared = nodes.tslNoise;
      // The cone is 1.4 tall and centred, so local y runs from -0.7 to 0.7.
      // This puts 0 at the base and 1 at the apex.
      const height = positionLocal.y.div(1.4).add(0.5);
      // The shared cells at the base, fading to a fixed chalk near the apex.
      return {
        colorNode: mix(shared.cell, color("#f1ede4"), height.pow(3)),
      };
    }, []),
  );

  return (
    <mesh castShadow receiveShadow position={[2.4, 0.7, 0]} rotation-y={Math.PI / 4}>
      <coneGeometry args={[0.9, 1.4, 4]} />
      <meshStandardNodeMaterial colorNode={nodes.colorNode} roughness={0.55} />
    </mesh>
  );
}

export function MaterialsNoise() {
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
