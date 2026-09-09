"use client";

import { useCallback, useMemo } from "react";
import {
  ACESFilmicToneMapping,
  ConeGeometry,
  SRGBColorSpace,
  type Node,
} from "three/webgpu";
import {
  color,
  Fn,
  int,
  mix,
  mx_cell_noise_float,
  mx_fractal_noise_float,
  mx_worley_noise_float,
  normalLocal,
  positionLocal,
  sin,
  smoothstep,
  time,
  uniform,
} from "three/tsl";
import { mergeVertices } from "three/examples/jsm/utils/BufferGeometryUtils.js";
import {
  Canvas,
  useFrame,
  useLocalNodes,
  useNodes,
  useUniforms,
} from "@react-three/fiber/webgpu";
import { RoundedBoxGeometry } from "@react-three/drei/webgpu";
import { useControls } from "leva";

import { Stage, STAGE_CAMERA } from "@/app/experiences/stage";

import { SwitchingMesh } from "./switching-mesh";
import { WobbleControls } from "./wobble-controls";

/**
 * TSL materials, four of four: wobble.
 *
 * Step three plus vertex displacement and a frame loop that ordinary React
 * can pause. The builder gains one `Fn`, `wobble`, that pushes each vertex
 * along its normal by a sine of its height. `Fn` takes its inputs as an
 * object, so one function is called three times with three different
 * `phase` uniforms and the result of each call goes into the record as a
 * `positionNode`.
 *
 * Two kinds of uniform live in this file. Leva owns amplitude, frequency and
 * speed, and they arrive through `useUniforms`, which resets a value whenever
 * React re-renders with a new one. The three phases are owned by the frame
 * loop, so they are plain `uniform(0)` calls inside the builder, where React
 * never touches them again. A phase made through the hook would snap back
 * to zero on every slider drag.
 *
 * Each mesh advances its own phase in its own `useFrame`, and each job has a
 * name. `WobbleControls`, rendered outside the Canvas, reaches those names
 * through the scheduler and pauses or resumes them one at a time. Speed is
 * read off the uniform's `.value` on the CPU, so Leva stays the only writer
 * of that number and the loop only ever reads it.
 *
 * `positionNode` moves vertices past the bounds the CPU computed, so the
 * meshes turn frustum culling off. A displacement can only move the vertices
 * a geometry has, so the cone is subdivided, and the octahedron in the
 * switcher has six, so it breathes rather than ripples. The box is rounded
 * because the displacement follows `normalLocal` and a hard edge has a
 * different normal on each side, which would tear the seam open. The
 * normals are not recomputed, so the lighting still describes the
 * undisplaced surface, which reads fine at these amplitudes.
 */

function Subject() {
  const { roughness, ...values } = useControls("tsl materials · wobble", {
    colorA: "#c8a060",
    colorB: "#2b4a9e",
    frequency: { value: 2, min: 0.2, max: 8, step: 0.1 },
    speed: { value: 0.4, min: 0, max: 3, step: 0.05 },
    octaves: { value: 3, min: 1, max: 8, step: 1 },
    lacunarity: { value: 2, min: 1, max: 4, step: 0.1 },
    gain: { value: 0.5, min: 0.1, max: 0.9, step: 0.05 },
    contrast: { value: 1.5, min: 0.5, max: 6, step: 0.1 },
    wobbleAmplitude: { value: 0.12, min: 0, max: 0.4, step: 0.01 },
    wobbleFrequency: { value: 6, min: 0, max: 20, step: 0.5 },
    wobbleSpeed: { value: 2, min: 0, max: 8, step: 0.1 },
    // CPU only. A material property, not a uniform.
    roughness: { value: 0.4, min: 0, max: 1, step: 0.01 },
  });
  const u = useUniforms(values, "tslWobble");

  const nodes = useNodes(({ uniforms }) => {
    const u = uniforms.tslWobble;

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

    // The displacement. A sine wave up the local y axis, offset by a phase,
    // pushes each vertex along its own normal. Object inputs, because that
    // is the form three's types know how to name.
    const wobble = Fn(({ phase }: { phase: Node<"float"> }) =>
      positionLocal.add(
        normalLocal.mul(
          sin(positionLocal.y.mul(u.wobbleFrequency).add(phase)).mul(u.wobbleAmplitude),
        ),
      ),
    );

    // Loop owned, so made here and never through the hook. Each mesh's frame
    // job advances one of these and nothing else writes them.
    const spherePhase = uniform(0);
    const boxPhase = uniform(0);
    const pyramidPhase = uniform(0);

    return {
      fractal: mix(u.colorA, u.colorB, fractal),
      worley: mix(u.colorA, u.colorB, worley),
      cell: mix(u.colorA, u.colorB, cell),
      spherePosition: wobble({ phase: spherePhase }),
      boxPosition: wobble({ phase: boxPhase }),
      pyramidPosition: wobble({ phase: pyramidPhase }),
      spherePhase,
      boxPhase,
      pyramidPhase,
    };
  }, "tslWobble");

  useFrame(
    ({ delta }) => {
      nodes.spherePhase.value += delta * u.wobbleSpeed.value;
    },
    { id: "tslWobble:sphere" },
  );

  return (
    <SwitchingMesh frustumCulled={false}>
      <meshStandardNodeMaterial
        colorNode={nodes.fractal}
        positionNode={nodes.spherePosition}
        roughness={roughness}
      />
    </SwitchingMesh>
  );
}

function Box() {
  // A reader with nothing to add, so `useLocalNodes` rather than a second
  // `useNodes`. The creator sees the scope the subject staged in this same
  // render, and it hands back the loop-owned phase and the speed dial next
  // to the graph, so the frame job below reads them off one record. The
  // scope-name form, `useNodes("tslWobble")`, would not do here: it reads
  // the committed store, which the subject fills in a layout effect after
  // this render, and the first frame would find no phase to advance.
  const nodes = useLocalNodes(
    useCallback(({ nodes, uniforms }) => {
      const shared = nodes.tslWobble;
      const u = uniforms.tslWobble;
      return {
        colorNode: shared.worley,
        positionNode: shared.boxPosition,
        phase: shared.boxPhase,
        speed: u.wobbleSpeed,
      };
    }, []),
  );

  useFrame(
    ({ delta }) => {
      nodes.phase.value += delta * nodes.speed.value;
    },
    { id: "tslWobble:box" },
  );

  return (
    <mesh
      castShadow
      receiveShadow
      frustumCulled={false}
      position={[-2.4, 0.6, 0]}
      rotation-y={0.35}
    >
      {/* Rounded, because a hard edge has two normals. A plain box would
          push each face in its own direction and tear open at every seam. */}
      <RoundedBoxGeometry args={[1.2, 1.2, 1.2]} radius={0.12} smoothness={4} />
      <meshStandardNodeMaterial
        colorNode={nodes.colorNode}
        positionNode={nodes.positionNode}
        roughness={0.55}
      />
    </mesh>
  );
}

function Pyramid() {
  // The same shape as the box, with a local graph wrapped around the colour.
  const nodes = useLocalNodes(
    useCallback(({ nodes, uniforms }) => {
      const shared = nodes.tslWobble;
      const u = uniforms.tslWobble;
      // The cone is 1.4 tall and centred, so local y runs from -0.7 to 0.7.
      // This puts 0 at the base and 1 at the apex.
      const height = positionLocal.y.div(1.4).add(0.5);
      // The shared cells at the base, fading to a fixed chalk near the apex.
      return {
        colorNode: mix(shared.cell, color("#f1ede4"), height.pow(3)),
        positionNode: shared.pyramidPosition,
        phase: shared.pyramidPhase,
        speed: u.wobbleSpeed,
      };
    }, []),
  );

  useFrame(
    ({ delta }) => {
      nodes.phase.value += delta * nodes.speed.value;
    },
    { id: "tslWobble:pyramid" },
  );

  // The same seam problem as the box, solved the other way. A cone's four
  // faces each carry their own copy of the edge vertices with their own flat
  // normal, so displacing along `normalLocal` pulls the faces apart. Dropping
  // the normals, merging the copies, and recomputing gives one shared vertex
  // and one averaged normal per edge, so the faces move together.
  const geometry = useMemo(() => {
    const cone = new ConeGeometry(0.9, 1.4, 4, 16);
    cone.deleteAttribute("normal");
    cone.deleteAttribute("uv");
    const merged = mergeVertices(cone);
    merged.computeVertexNormals();
    cone.dispose();
    return merged;
  }, []);

  return (
    <mesh
      castShadow
      receiveShadow
      frustumCulled={false}
      position={[2.4, 0.7, 0]}
      rotation-y={Math.PI / 4}
      geometry={geometry}
    >
      <meshStandardNodeMaterial
        colorNode={nodes.colorNode}
        positionNode={nodes.positionNode}
        roughness={0.55}
      />
    </mesh>
  );
}

export function MaterialsWobble() {
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
      {/* DOM, outside the Canvas, reaching the jobs above by name. */}
      <WobbleControls />
    </div>
  );
}
