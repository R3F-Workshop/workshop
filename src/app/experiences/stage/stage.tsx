"use client";

import { useEffect, useMemo, useRef } from "react";
import { EnvironmentMap } from "@react-three/fiber/webgpu";
import { CameraControls, CameraControlsImpl } from "@react-three/drei";

import {
  createStudioEnvironment,
  STUDIO_DEFAULT,
} from "@/app/home/components/canvas/studio-env";

/**
 * The shared stage for the TSL lessons.
 *
 * A Canvas child, not a Canvas, so every experience still owns its renderer,
 * camera and frame loop. What it provides is the room the subjects stand in:
 * orbit controls aimed at head height, a floor with two walls meeting in the
 * back corner, a shadow casting key with a soft fill, and a generated studio
 * environment that lights the metals and shows through the open sides as a
 * blurred backdrop. Subjects sit on the floor at y 0.
 */

/** Where every lesson camera starts. Exported so the experiences do not drift. */
export const STAGE_CAMERA = [4, 3, 6] as const;

export function Stage({ children }: { children?: React.ReactNode }) {
  // The controls take over the Canvas camera, so the look-at is set here
  // rather than through the camera prop. Once, without a transition.
  const controlsRef = useRef<CameraControlsImpl>(null);
  useEffect(() => {
    controlsRef.current?.setLookAt(...STAGE_CAMERA, 0, 1, 0, false);
  }, []);

  // The studio wash is brighter than the tile grid's so the backdrop reads as
  // a lit room instead of a black void. The softboxes are the defaults, which
  // is what gives the metals something with range to reflect.
  const environment = useMemo(
    () =>
      createStudioEnvironment({
        ...STUDIO_DEFAULT,
        ground: [0.05, 0.045, 0.04],
        sky: [0.16, 0.18, 0.23],
      }),
    [],
  );
  useEffect(() => () => environment.dispose(), [environment]);

  return (
    <>
      <CameraControls
        ref={controlsRef}
        makeDefault
        // The floor is at y 0 and the target at y 1, so this keeps the camera
        // above the floor even at the far distance.
        minPolarAngle={0.05}
        maxPolarAngle={Math.PI * 0.49}
        minDistance={3}
        maxDistance={14}
        mouseButtons={{
          left: CameraControlsImpl.ACTION.ROTATE,
          middle: CameraControlsImpl.ACTION.NONE,
          right: CameraControlsImpl.ACTION.NONE,
          wheel: CameraControlsImpl.ACTION.DOLLY,
        }}
        touches={{
          one: CameraControlsImpl.ACTION.TOUCH_ROTATE,
          two: CameraControlsImpl.ACTION.TOUCH_DOLLY,
          three: CameraControlsImpl.ACTION.NONE,
        }}
      />

      <EnvironmentMap
        map={environment}
        background
        backgroundBlurriness={0.6}
        backgroundIntensity={0.8}
        environmentIntensity={0.7}
      />

      {/* The key. The frustum covers the whole floor with a margin so nothing
          on the stage walks out of the shadow map. */}
      <directionalLight
        castShadow
        position={[5, 8, 4]}
        intensity={2.4}
        color="#fff4e6"
        shadow-mapSize-width={2048}
        shadow-mapSize-height={2048}
        shadow-camera-near={1}
        shadow-camera-far={30}
        shadow-camera-left={-9}
        shadow-camera-right={9}
        shadow-camera-top={9}
        shadow-camera-bottom={-9}
        shadow-bias={-0.0002}
        shadow-normalBias={0.02}
      />
      {/* A low fill so the shadowed sides of the room and the subject keep
          some shape. */}
      <hemisphereLight
        args={["#d9dfeb", "#6e665e"]}
        intensity={0.35}
      />

      {/* The room. Floor at y 0, walls along the back and the left, so the
          camera's default framing sees the corner and the open sides show the
          environment. */}
      <mesh rotation-x={-Math.PI / 2} receiveShadow>
        <planeGeometry args={[12, 12]} />
        <meshStandardNodeMaterial color="#e6e2da" roughness={0.95} metalness={0} />
      </mesh>
      <mesh position={[0, 3, -6]} receiveShadow>
        <planeGeometry args={[12, 6]} />
        <meshStandardNodeMaterial color="#e6e2da" roughness={0.95} metalness={0} />
      </mesh>
      <mesh position={[-6, 3, 0]} rotation-y={Math.PI / 2} receiveShadow>
        <planeGeometry args={[12, 6]} />
        <meshStandardNodeMaterial color="#e6e2da" roughness={0.95} metalness={0} />
      </mesh>

      {children}
    </>
  );
}
