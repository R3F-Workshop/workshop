"use client";

import { useMemo } from "react";
import {
  ACESFilmicToneMapping,
  PlaneGeometry,
  SRGBColorSpace,
  type Node,
} from "three/webgpu";
import {
  Fn,
  int,
  mx_fractal_noise_float,
  normalize,
  positionLocal,
  transformNormalToView,
  vec2,
  vec3,
  vertexStage,
} from "three/tsl";
import { Canvas, useNodes, useUniforms } from "@react-three/fiber/webgpu";
import { useControls } from "leva";

import { Stage, STAGE_CAMERA } from "@/app/experiences/stage";

/**
 * Terrain, one of five: vertex.
 *
 * The usual terrain shader. A flat plane, and a `positionNode` that replaces
 * each vertex's height with fractal noise read at its xz. The normal is not
 * free: the shader reads the noise twice more, one step over in x and one
 * in z, and crosses the differences. That is three noise evaluations per
 * vertex, every frame, for a landscape that is standing perfectly still.
 * Orbit the camera and nothing changes, but the GPU does it all again.
 *
 * The material is plain grey so the shape is the only thing on screen. The
 * dials are the same on every step of this lesson, so drag `frequency`
 * here and again on the later pages to see what moved.
 */

/** The terrain's edge, in world units. Six, so it sits inside the room. */
const WORLD = 6;
/** Vertices along one edge. The normal's finite difference is one of these. */
const SEGMENTS = 200;

/**
 * The plane and its material. The dials become uniforms, the uniforms feed
 * one graph, and the graph is the material's position and normal.
 */
function Ground() {
  const values = useControls("tsl terrain · noise", {
    frequency: { value: 0.5, min: 0.1, max: 1.5, step: 0.01 },
    octaves: { value: 5, min: 1, max: 8, step: 1 },
    lacunarity: { value: 2, min: 1.5, max: 3, step: 0.05 },
    gain: { value: 0.5, min: 0.2, max: 0.8, step: 0.01 },
    amplitude: { value: 1, min: 0, max: 2.5, step: 0.05 },
    offsetX: { value: 0, min: -10, max: 10, step: 0.05 },
    offsetZ: { value: 0, min: -10, max: 10, step: 0.05 },
  });
  useUniforms(values, "tslTerrain");

  const nodes = useNodes(({ uniforms }) => {
    const u = uniforms.tslTerrain;

    /** The noise at a world xz, mapped to roughly 0..1. */
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

    // The vertex's own height, then two neighbours one segment over, crossed
    // by hand into a normal. Both sit in `vertexStage` because a node that
    // feeds `normalNode` is otherwise built in the fragment stage, and the
    // fractal would run per pixel. Held to the vertex stage it is still
    // three evaluations of the fractal, per vertex, per frame.
    const step = WORLD / SEGMENTS;
    const xz = positionLocal.xz;
    const h = vertexStage(height({ xz }));
    const hx = height({ xz: xz.add(vec2(step, 0)) });
    const hz = height({ xz: xz.add(vec2(0, step)) });
    const normal = vertexStage(
      normalize(vec3(h.sub(hx).mul(u.amplitude), step, h.sub(hz).mul(u.amplitude))),
    );

    return {
      position: vec3(positionLocal.x, h.mul(u.amplitude), positionLocal.z),
      normal: transformNormalToView(normal),
    };
  }, "tslTerrain");

  // Laid flat in the geometry rather than on the mesh, so the material's
  // local xz is the world's and the noise reads world coordinates.
  const geometry = useMemo(() => {
    const g = new PlaneGeometry(WORLD, WORLD, SEGMENTS, SEGMENTS);
    g.rotateX(-Math.PI / 2);
    return g;
  }, []);

  return (
    <mesh geometry={geometry} castShadow receiveShadow>
      <meshStandardNodeMaterial
        positionNode={nodes.position}
        normalNode={nodes.normal}
        color="#9a9a96"
        roughness={0.9}
      />
    </mesh>
  );
}

export function TerrainVertex() {
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
          <Ground />
        </Stage>
      </Canvas>
    </div>
  );
}
