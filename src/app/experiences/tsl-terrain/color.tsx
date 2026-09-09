"use client";

import { useMemo } from "react";
import {
  ACESFilmicToneMapping,
  PlaneGeometry,
  SRGBColorSpace,
  type Node,
} from "three/webgpu";
import {
  float,
  Fn,
  int,
  mix,
  mx_fractal_noise_float,
  normalize,
  positionLocal,
  smoothstep,
  transformNormalToView,
  vec2,
  vec3,
  vertexStage,
} from "three/tsl";
import { Canvas, useNodes, useUniforms } from "@react-three/fiber/webgpu";
import { useControls } from "leva";

import { Stage, STAGE_CAMERA } from "@/app/experiences/stage";

/**
 * Terrain, two of five: color.
 *
 * The same plane and the same noise, with a `colorNode` on top. The colour
 * is a few bands over height and slope: sand near the water, grass above
 * it, rock where it gets steep, snow above the snow line. Two dials set
 * where the water and the snow begin, and a flat sheet sits at the water
 * line so the coast moves with the slider.
 *
 * The height the colour reads is the height the position wrote. One graph,
 * read twice. The fractal still runs three times per vertex, per frame,
 * and now a fourth reader is waiting in the wings.
 */

/** The terrain's edge, in world units. Six, so it sits inside the room. */
const WORLD = 6;
/** Vertices along one edge. The normal's finite difference is one of these. */
const SEGMENTS = 200;

/**
 * The plane, its material, and the water. The dials become uniforms, the
 * uniforms feed one graph, and the graph is the material's position,
 * normal and colour.
 */
function Landscape() {
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
    // feeds `normalNode` or `colorNode` is otherwise built in the fragment
    // stage, and the fractal would run per pixel. Held to the vertex stage
    // it is still three evaluations of the fractal, per vertex, per frame.
    const step = WORLD / SEGMENTS;
    const xz = positionLocal.xz;
    const h = vertexStage(height({ xz }));
    const hx = height({ xz: xz.add(vec2(step, 0)) });
    const hz = height({ xz: xz.add(vec2(0, step)) });
    const normal = vertexStage(
      normalize(vec3(h.sub(hx).mul(u.amplitude), step, h.sub(hz).mul(u.amplitude))),
    );

    // The bands. Grass turns to rock as the slope climbs, snow takes over
    // above the snow line, and sand takes over below the water line. Each
    // `smoothstep` is a soft edge a few hundredths wide.
    const slope = float(1).sub(normal.y);
    const rock = mix(vec3(0.24, 0.36, 0.14), vec3(0.32, 0.29, 0.26), smoothstep(0.25, 0.45, slope));
    const snowy = mix(rock, vec3(0.92, 0.94, 0.98), smoothstep(u.snow.sub(0.04), u.snow.add(0.04), h));
    const sandy = mix(vec3(0.72, 0.64, 0.42), snowy, smoothstep(u.water, u.water.add(0.04), h));

    return {
      position: vec3(positionLocal.x, h.mul(u.amplitude), positionLocal.z),
      normal: transformNormalToView(normal),
      color: sandy,
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

export function TerrainColor() {
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
          <Landscape />
        </Stage>
      </Canvas>
    </div>
  );
}
