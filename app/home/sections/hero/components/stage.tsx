"use client";

import { useEffect, useMemo, useRef } from "react";
import { CameraControls, CameraControlsImpl } from "@react-three/drei";
import { Sky } from "@pmndrs/sky/react";

import { AutoRotate } from "./auto-rotate";
import { PARIS_LATITUDE, sun, WORKSHOP_DAY_OF_YEAR } from "./sun";
import { Beacon } from "./beacon";

/** Hosts the hero camera, sky, floor, and lights. */

/** Camera position and target. */
const FRAMING = [0, 23, 168, 0, 32, 0] as const;

// Dark blue ground reflectance keeps the horizon saturated.
const GROUND_ALBEDO = { x: 0.025, y: 0.075, z: 0.18 } as const;

/** When the summit beacon runs: with the sun, always, or never. */
export type BeaconMode = "night" | "on" | "off";

export function Stage({
  hour,
  autoRotate = true,
  autoRotateSpeed = 1,
  beacon = "night",
}: {
  hour: number;
  autoRotate?: boolean;
  autoRotateSpeed?: number;
  beacon?: BeaconMode;
}) {
  const light = useMemo(() => sun(hour), [hour]);
  const night = light.lightLevel > 0.5;
  const beaconOn = beacon === "on" || (beacon === "night" && night);

  const controls = useRef<CameraControlsImpl>(null);
  useEffect(() => {
    controls.current?.setLookAt(...FRAMING, false);
  }, []);

  return (
    <>
      {/* Only one camera: this takes over the Canvas's default. */}
      <CameraControls
        ref={controls}
        makeDefault
        minPolarAngle={Math.PI * 0.32}
        maxPolarAngle={Math.PI * 0.53}
        minDistance={90}
        maxDistance={260}
        mouseButtons={{
          left: CameraControlsImpl.ACTION.ROTATE,
          middle: CameraControlsImpl.ACTION.NONE,
          right: CameraControlsImpl.ACTION.NONE,
          wheel: CameraControlsImpl.ACTION.NONE,
        }}
        touches={{
          // One finger scrolls the page: two rotate.
          one: CameraControlsImpl.ACTION.NONE,
          two: CameraControlsImpl.ACTION.TOUCH_ROTATE,
          three: CameraControlsImpl.ACTION.NONE,
        }}
      />
      <AutoRotate speed={autoRotate ? autoRotateSpeed : 0} />

      <Sky
        preset="earth"
        quality="medium"
        cubeSize={256}
        timeOfDay={hour}
        latitude={PARIS_LATITUDE}
        dayOfYear={WORKSHOP_DAY_OF_YEAR}
        north="+Z"
        exposure={light.exposure}
        // A clear, saturated "bleu nuit" horizon.
        turbidity={0}
        groundAlbedo={GROUND_ALBEDO}
        sunDisc
        // Mirror the sky under the horizon: the ground disc ends a hair below the true horizon and this is what shows in the gap.
        mirrorBelowHorizon
      />

      {/* Direct sun. */}
      <directionalLight
        position={light.position}
        intensity={light.intensity}
        color={light.color}
      />

      {/* A cool key that casts the shadows, day and night. */}
      <directionalLight
        castShadow
        position={[-60, 90, -40]}
        intensity={0.6}
        color="#aac4ff"
        shadow-mapSize-width={2048}
        shadow-mapSize-height={2048}
        shadow-camera-near={1}
        shadow-camera-far={400}
        shadow-camera-left={-120}
        shadow-camera-right={120}
        shadow-camera-top={120}
        shadow-camera-bottom={-120}
        shadow-bias={-0.0005}
      />

      {/* Flat Paris. */}
      <mesh rotation-x={-Math.PI / 2} position-y={-0.05} receiveShadow>
        <circleGeometry args={[1500, 64]} />
        <meshStandardMaterial color="#131313" roughness={0.95} metalness={0} />
      </mesh>

      <Beacon on={beaconOn} />
    </>
  );
}
