"use client";

import { useCallback, useMemo, useRef } from "react";
import { useFrame, useLocalNodes, useUniforms } from "@react-three/fiber/webgpu";
import * as TSL from "three/tsl";
import * as THREE from "three/webgpu";

/** Where the beams start: just under the summit of the 66-unit tower. */
const SUMMIT = 63;
/** Beam length and the width of its far end, world units. */
const BEAM_LENGTH = 150;
const BEAM_FLARE = 9;
/** Beams point a little below the horizon so they rake the city. */
const TILT = THREE.MathUtils.degToRad(12);

/**
 * The summit beacon: two opposed fake-volumetric beams sweeping the city.
 *
 * The cone is shaded the way drei's `<SpotLight volumetric>` does it, ported
 * to TSL: linear fade along the beam, times a falloff on the view-space
 * normal so the tube's silhouette edges vanish and its core stays bright —
 * a hard cylinder becomes a soft shaft of light. Additive, no depth write,
 * double-sided. Inside each beam rides a real `spotLight` aimed down its
 * axis, so the houses light up where the beam lands.
 *
 * All of the motion is one line in `useFrame`: the group turns by `delta`.
 * A ref holds the real group, the loop mutates it, nothing re-renders.
 * `on` is a uniform the shader multiplies by — flipping it never recompiles.
 */
function makeBeamOpacity(strength: THREE.UniformNode<"float", number>) {
  const along = TSL.positionLocal.y.div(BEAM_LENGTH).clamp(0, 1);
  const distanceFade = TSL.oneMinus(along);
  const angleFade = TSL.pow(TSL.abs(TSL.normalView.z), 4.0);
  return distanceFade.mul(angleFade).mul(0.6).mul(strength);
}

export function Beacon({
  on,
  speed = 0.5,
}: {
  on: boolean;
  /** Radians per second. Multiplied by `delta`. */
  speed?: number;
}) {
  const spin = useRef<THREE.Group>(null);

  useFrame((_, delta) => {
    if (spin.current) spin.current.rotation.y += delta * speed;
  });

  const knobs = useUniforms({ strength: on ? 1 : 0 }, "heroBeacon") as unknown as {
    strength: THREE.UniformNode<"float", number>;
  };
  const createNodes = useCallback(
    () => ({ opacityNode: makeBeamOpacity(knobs.strength) }),
    [knobs.strength],
  );
  const beam = useLocalNodes(createNodes);

  const geometry = useMemo(() => {
    // High radial segmentation on purpose: the falloff shades by interpolated
    // silhouette normals, and a coarse tube shows facets.
    const g = new THREE.CylinderGeometry(BEAM_FLARE, 0.6, BEAM_LENGTH, 64, 8, true);
    // Hub at the origin, beam extending along +y, then rolled flat below.
    g.translate(0, BEAM_LENGTH / 2, 0);
    return g;
  }, []);

  const targets = useMemo(
    () => [new THREE.Object3D(), new THREE.Object3D()],
    [],
  );

  return (
    <group ref={spin} position={[0, SUMMIT, 0]}>
      {[1, -1].map((side, i) => (
        <group key={side}>
          <mesh
            geometry={geometry}
            // +y rolled to ±x, then tilted a little toward the ground.
            rotation-z={-side * (Math.PI / 2 + TILT)}
          >
            <meshBasicNodeMaterial
              color="#ffeec2"
              transparent
              blending={THREE.AdditiveBlending}
              side={THREE.DoubleSide}
              depthWrite={false}
              opacityNode={beam.opacityNode}
            />
          </mesh>

          {/* The light inside the beam. Its target is a child of the same
              spinning group, parked at the beam's far end. */}
          <primitive
            object={targets[i]}
            position={[
              side * Math.cos(TILT) * BEAM_LENGTH,
              -Math.sin(TILT) * BEAM_LENGTH,
              0,
            ]}
          />
          <spotLight
            target={targets[i]}
            color="#ffe2b0"
            intensity={on ? 9000 : 0}
            angle={0.14}
            penumbra={0.5}
            distance={BEAM_LENGTH * 2}
            // Stylised throw: a physical falloff would never reach the city.
            decay={1}
          />
        </group>
      ))}
    </group>
  );
}
