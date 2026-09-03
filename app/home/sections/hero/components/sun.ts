import { solarPosition } from "@pmndrs/sky";
import * as THREE from "three/webgpu";

/**
 * The one number everything reads.
 *
 * The dial gives a *solar* hour (noon = 12); this turns it into where the
 * sun is over Paris and
 * how dark it is. The sky, the sun light, the tower glow, the spotlights and
 * the stars all derive from the same call, so they can never disagree about
 * whether it is night.
 */

export const PARIS_LATITUDE = 48.8566;
/** 2026-09-08, day one of the workshop. The sun's arc is seasonal. */
export const WORKSHOP_DAY_OF_YEAR = 251;

export interface Sun {
  /** Where to put a directional light so it shines from the sun. */
  position: [number, number, number];
  /** Degrees above the horizon. Negative after sunset. */
  elevation: number;
  /** 0 in daylight, 1 once the sun is well below the horizon. */
  lightLevel: number;
  /** Direct sunlight strength. Zero at night. */
  intensity: number;
  /** Warms toward orange as the sun drops. */
  color: THREE.Color;
  /** Sky exposure: low in daylight, lifted at night so the city still reads. */
  exposure: number;
}

const smoothstep = (t: number) => t * t * (3 - 2 * t);
const clamp01 = (v: number) => THREE.MathUtils.clamp(v, 0, 1);

export function sun(
  hour: number,
  {
    latitude = PARIS_LATITUDE,
    dayOfYear = WORKSHOP_DAY_OF_YEAR,
  }: { latitude?: number; dayOfYear?: number } = {},
): Sun {
  const { elevation, azimuth } = solarPosition({
    timeOfDay: hour,
    latitude,
    dayOfYear,
  });

  // +Z is north, which is also what the Sky is told below.
  const position = new THREE.Vector3()
    .setFromSphericalCoords(
      200,
      THREE.MathUtils.degToRad(90 - elevation),
      THREE.MathUtils.degToRad(azimuth),
    )
    .toArray() as [number, number, number];

  // Fade from late golden hour through civil twilight.
  const lightLevel = smoothstep(clamp01((6 - elevation) / 10));
  const warmth = clamp01((24 - elevation) / 20);
  const color = new THREE.Color("#fff6e8").lerp(
    new THREE.Color("#ff9c63"),
    warmth,
  );

  // Hold a low daytime exposure, then lift it through dusk and dawn.
  const daylight = smoothstep(clamp01((8 - Math.abs(hour - 12)) / 3));
  const exposure = THREE.MathUtils.lerp(40, 6, daylight);

  return {
    position,
    elevation,
    lightLevel,
    intensity: 5.5 * (1 - lightLevel),
    color,
    exposure,
  };
}
