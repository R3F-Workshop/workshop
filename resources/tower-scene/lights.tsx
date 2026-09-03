"use client";

import { Environment } from "@react-three/drei";
import type { ColorRepresentation } from "three";


export function Lights({
  shadowRadius = 60,
  environment = true,
  sunlight = true,
  sunColor = "#fff6e8",
  sunIntensity = 0,
  sunPosition = [25, 35, 20],
}: {
  shadowRadius?: number;
  environment?: boolean;
  /** Warm direct light synchronized with the visible atmospheric sun. */
  sunColor?: ColorRepresentation;
  sunIntensity?: number;
  sunPosition?: [number, number, number];
  /** Faraz's hand-placed moonlight + ambient + hemisphere fill. */
  sunlight?: boolean;
}) {
  return (
    <>
      {/* Night sky cubemap, image-based lighting only: the sky itself is the scene background. */}
      {environment && (
        <Environment
          files={["px.png", "nx.png", "py.png", "ny.png", "pz.png", "nz.png"]}
          path="/hero-demo/sky_81_cubemap_2k/"
          environmentIntensity={0.12}
          blur={0.5}
        />
      )}

      {sunlight && (
        <>
          {/* Cool ambient fill so shadows stay a deep blue rather than black */}
          <ambientLight color="#33456b" intensity={0.12} />

          {/* Sky/ground bounce to lift the scene subtly */}
          <hemisphereLight
            color="#3a4d80"
            groundColor="#0a0f1c"
            intensity={0.1}
          />
        </>
      )}

      {/* Warm direct sunlight for the painted tower. */}
      <directionalLight
        position={sunPosition}
        intensity={sunIntensity}
        color={sunColor}
      />

      {/* Daylight fill for camera facing latticework. */}
      <directionalLight
        position={[12, 24, 35]}
        intensity={sunIntensity * 0.2}
        color="#ffd3b0"
      />

      {/* Moonlight key light casting soft cool shadows. */}
      <directionalLight
        castShadow
        position={[-25, 40, -20]}
        intensity={0.6}
        color="#aac4ff"
        shadow-mapSize-width={2048}
        shadow-mapSize-height={2048}
        shadow-camera-near={1}
        shadow-camera-far={150}
        shadow-camera-left={-shadowRadius}
        shadow-camera-right={shadowRadius}
        shadow-camera-top={shadowRadius}
        shadow-camera-bottom={-shadowRadius}
        shadow-bias={-0.0005}
      />
    </>
  );
}
