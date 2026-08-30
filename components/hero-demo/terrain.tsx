"use client";

import { memo, useCallback, useMemo } from "react";
import { useLocalNodes } from "@react-three/fiber/webgpu";
import { useSky } from "@pmndrs/sky/react";
import * as TSL from "three/tsl";
import * as THREE from "three/webgpu";

import {
  PARK,
  RIVER_HALF_WIDTH,
  riverCurve,
  TOWER_CLEARING_RADIUS,
} from "./geography";

/** The slice of the `Sky` instance the water reflection reads. */
interface SkyWithBaker {
  baker?: { texture?: THREE.CubeTexture };
}

/**
 * Ground, river and park for the block city.
 *
 * The ground plane exists because without it the sky (and with
 * `mirrorBelowHorizon`, the *flipped* sky) is visible straight through the
 * city floor — the buildings sit on nothing. A dark disc big enough to reach
 * the horizon fixes both that and the free-floating look of the shadows.
 *
 * The river is a ribbon mesh swept along `geography.ts`'s spline — the same
 * curve the building scatter rejects against, so the banks always match.
 * Water is a node material: near-mirror roughness so it reflects the sky/IBL,
 * with a cheap animated noise shimmer in color and roughness so it reads as
 * moving water instead of smoked glass. No vertex displacement — at hero
 * distance the shimmer is what sells it, not silhouettes.
 */

const GROUND_COLOR = "#131313";
const PARK_COLOR = "#26381f";
const PATH_COLOR = "#716b60";
const WATER_COLOR = "#0a1622";

/** y-offsets: ground < park < water, all far apart enough not to z-fight. */
const GROUND_Y = -0.06;
const PARK_STRIP_Y = 0.03;
const PARK_Y = 0.04;
const PATH_Y = 0.055;
const WATER_Y = 0.12;

const RING_PATH_INNER = TOWER_CLEARING_RADIUS * 0.56;
const RING_PATH_OUTER = TOWER_CLEARING_RADIUS * 0.64;
const AXIS_PATH_WIDTH = 3.6;

function useRiverGeometry() {
  return useMemo(() => {
    // Sweep the curve into a flat ribbon: for each sample, offset left/right
    // along the horizontal normal. u across the width, v along the length.
    const SEGMENTS = 160;
    const points = riverCurve.getSpacedPoints(SEGMENTS);
    const positions = new Float32Array((SEGMENTS + 1) * 2 * 3);
    const uvs = new Float32Array((SEGMENTS + 1) * 2 * 2);
    const indices: number[] = [];

    const tangent = new THREE.Vector2();
    for (let i = 0; i <= SEGMENTS; i++) {
      const p = points[i];
      const ahead = points[Math.min(i + 1, SEGMENTS)];
      const behind = points[Math.max(i - 1, 0)];
      tangent.set(ahead.x - behind.x, ahead.z - behind.z).normalize();
      // Left-hand horizontal normal of the tangent.
      const nx = -tangent.y;
      const nz = tangent.x;

      const o = i * 6;
      positions[o + 0] = p.x + nx * RIVER_HALF_WIDTH;
      positions[o + 1] = 0;
      positions[o + 2] = p.z + nz * RIVER_HALF_WIDTH;
      positions[o + 3] = p.x - nx * RIVER_HALF_WIDTH;
      positions[o + 4] = 0;
      positions[o + 5] = p.z - nz * RIVER_HALF_WIDTH;

      const uo = i * 4;
      uvs[uo + 0] = 0;
      uvs[uo + 1] = i / SEGMENTS;
      uvs[uo + 2] = 1;
      uvs[uo + 3] = i / SEGMENTS;

      if (i < SEGMENTS) {
        // Wound so the face normal points +y — (v1-v0)×(v2-v0) up, with v0
        // the left-bank vertex. The first draft had these clockwise and the
        // whole river rendered face-down: perfectly present, never visible.
        const a = i * 2;
        indices.push(a, a + 2, a + 1, a + 1, a + 2, a + 3);
      }
    }

    const geometry = new THREE.BufferGeometry();
    geometry.setAttribute("position", new THREE.BufferAttribute(positions, 3));
    geometry.setAttribute("uv", new THREE.BufferAttribute(uvs, 2));
    geometry.setIndex(indices);
    geometry.computeVertexNormals();
    return geometry;
  }, []);
}

/**
 * The water's shader graph, consumed as node props on a JSX
 * `<meshStandardNodeMaterial>` below. A plain function rather than a hook so
 * `useLocalNodes` can own the caching: it re-runs the creator when the shared
 * TSL stores change (HMR included), which a bare `useMemo` never would.
 */
function makeWaterNodes(skyCube?: THREE.CubeTexture) {
  // Two octaves of scrolling noise as a shimmer field: ripple distortion
  // for the reflection below, plus a subtle brightness/roughness
  // modulation so the surface never reads as a static sheet.
  const p = TSL.positionWorld.xz.mul(0.35);
  const t = TSL.time.mul(0.35);
  const n1 = TSL.mx_noise_float(TSL.vec3(p.x, p.y, t));
  const n2 = TSL.mx_noise_float(
    TSL.vec3(p.x.mul(2.7).add(4.1), p.y.mul(2.7), t.mul(1.7)),
  );
  const shimmer = n1.mul(0.65).add(n2.mul(0.35));

  const colorNode = TSL.color(WATER_COLOR).mul(shimmer.mul(0.5).add(1.0));
  const roughnessNode = shimmer.mul(0.06).add(0.08).clamp(0.03, 0.2);

  // What actually makes it read as water at dusk: mirror the baked sky
  // cube in the surface. Reflect the view ray about the flat-up normal,
  // wobble it with the shimmer noise so the reflection ripples, clamp
  // just above the horizon (the cube is black below it — same story as
  // the fog), and Fresnel-weight so grazing looks like glass while
  // straight down stays dark river. Emissive is the honest channel for
  // an image-based term the light loop can't produce — and it flows into
  // the bloom attachment, so the sun's reflection blooms like the real
  // thing. Without this the river is an invisible black ribbon: there's
  // no SSR and the dusk sun alone gives the surface nothing to mirror.
  let emissiveNode = null;
  if (skyCube) {
    const view = TSL.normalize(TSL.positionWorld.sub(TSL.cameraPosition));
    // The reflected elevation is compressed toward the horizon (y × 0.3):
    // physically a steep look-down reflects the dark zenith, but night
    // water famously streaks low light sources across itself, and the
    // horizon band is where the dusk sky keeps all its color. Without the
    // compression the river reads as black from any elevated camera.
    const reflected = TSL.normalize(
      TSL.vec3(
        view.x.add(n1.mul(0.10)),
        view.y.negate().mul(0.3).max(0.02),
        view.z.add(n2.mul(0.10)),
      ),
    );
    const fresnel = TSL.pow(TSL.oneMinus(TSL.abs(view.y)), 4.0)
      .mul(0.6)
      .add(0.35);
    emissiveNode = TSL.cubeTexture(skyCube, reflected).rgb.mul(fresnel);
  }

  return { colorNode, roughnessNode, emissiveNode };
}

/** Memoized for the same reason as `Buildings`: its props never change. */
export const Terrain = memo(function Terrain({
  river = true,
  park = true,
}: {
  river?: boolean;
  park?: boolean;
}) {
  // Null when sky is disabled — the water then falls back to plain dark.
  const sky = useSky();
  const skyCube = (sky as SkyWithBaker | null)?.baker?.texture;
  const riverGeometry = useRiverGeometry();

  // The `useCallback` matters: `useLocalNodes` memoizes on creator identity,
  // so keying the creator on the cube texture is what rebuilds the graph when
  // the sky finishes its first bake (it arrives a frame after mount).
  const waterNodes = useLocalNodes(
    useCallback(() => makeWaterNodes(skyCube), [skyCube]),
  );

  return (
    <>
      {/* Reaches well past the city ring (radius 400) so the horizon line is
          ground meeting sky, not city floating in it. */}
      <mesh
        position={[0, GROUND_Y, 0]}
        rotation-x={-Math.PI / 2}
        receiveShadow
      >
        <circleGeometry args={[1400, 48]} />
        <meshStandardMaterial color={GROUND_COLOR} roughness={0.95} metalness={0} />
      </mesh>

      {park && (
        <>
          {/* The lawn and park strip form one connected landscape. */}
          <mesh
            position={[
              (PARK.minX + PARK.maxX) / 2,
              PARK_STRIP_Y,
              (PARK.minZ + PARK.maxZ) / 2,
            ]}
            rotation-x={-Math.PI / 2}
            receiveShadow
          >
            <planeGeometry
              args={[PARK.maxX - PARK.minX, PARK.maxZ - PARK.minZ]}
            />
            <meshStandardMaterial
              color={PARK_COLOR}
              roughness={1}
              metalness={0}
            />
          </mesh>

          <mesh
            position={[0, PARK_Y, 0]}
            rotation-x={-Math.PI / 2}
            receiveShadow
          >
            <circleGeometry args={[TOWER_CLEARING_RADIUS, 64]} />
            <meshStandardMaterial
              color={PARK_COLOR}
              roughness={1}
              metalness={0}
            />
          </mesh>

          {/* A ring and central path define the park layout. */}
          <mesh position={[0, PATH_Y, 0]} rotation-x={-Math.PI / 2}>
            <ringGeometry args={[RING_PATH_INNER, RING_PATH_OUTER, 64]} />
            <meshStandardMaterial
              color={PATH_COLOR}
              roughness={1}
              metalness={0}
            />
          </mesh>
          <mesh
            position={[
              0,
              PATH_Y,
              (PARK.maxZ + RING_PATH_OUTER) / 2,
            ]}
            rotation-x={-Math.PI / 2}
          >
            <planeGeometry
              args={[AXIS_PATH_WIDTH, PARK.maxZ - RING_PATH_OUTER]}
            />
            <meshStandardMaterial
              color={PATH_COLOR}
              roughness={1}
              metalness={0}
            />
          </mesh>
        </>
      )}

      {river && (
        <mesh position={[0, WATER_Y, 0]} geometry={riverGeometry}>
          <meshStandardNodeMaterial
            color={WATER_COLOR}
            roughness={0.06}
            metalness={0}
            // Belt-and-braces against winding mistakes: a flat ribbon costs
            // nothing to draw double-sided and can never vanish again.
            side={THREE.DoubleSide}
            colorNode={waterNodes.colorNode}
            roughnessNode={waterNodes.roughnessNode}
            emissiveNode={waterNodes.emissiveNode}
          />
        </mesh>
      )}
    </>
  );
});
