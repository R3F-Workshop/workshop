import {
  DataTexture,
  EquirectangularReflectionMapping,
  FloatType,
  LinearFilter,
  LinearSRGBColorSpace,
  RGBAFormat,
} from "three/webgpu";

/** A studio environment, generated rather than downloaded. */

export type Softbox = {
  /** Degrees, 0 is straight ahead (+Z, toward the camera). */
  azimuth: number;
  /** Degrees, 0 is the horizon. */
  elevation: number;
  /** Angular size in degrees. */
  width: number;
  height: number;
  /** Linear radiance. */
  intensity: number;
  color: [number, number, number];
};

export type StudioOptions = {
  ground: [number, number, number];
  sky: [number, number, number];
  softboxes: Softbox[];
  /** Softness of the softbox edges, 0..1 of their angular size. */
  falloff: number;
  /** How abruptly ground becomes sky. 0 is a slow gradient across the whole sphere: 1 is a hard line at elevation 0. */
  horizon: number;
};

const WIDTH = 256;
const HEIGHT = 128;
const DEG = Math.PI / 180;

/** Shortest angular distance between two angles, in radians. */
function angleDelta(a: number, b: number): number {
  let d = a - b;
  while (d > Math.PI) d -= Math.PI * 2;
  while (d < -Math.PI) d += Math.PI * 2;
  return d;
}

function smoothstep(edge0: number, edge1: number, x: number): number {
  const t = Math.min(1, Math.max(0, (x - edge0) / (edge1 - edge0 || 1e-6)));
  return t * t * (3 - 2 * t);
}

export function createStudioEnvironment(options: StudioOptions): DataTexture {
  const data = new Float32Array(WIDTH * HEIGHT * 4);

  // The mapping has to be three's, exactly.
  for (let y = 0; y < HEIGHT; y++) {
    const v = (y + 0.5) / HEIGHT;
    const elevation = (v - 0.5) * Math.PI;

    for (let x = 0; x < WIDTH; x++) {
      const u = (x + 0.5) / WIDTH;
      const azimuth = Math.PI / 2 - (u - 0.5) * Math.PI * 2;

      // Ground to sky.
      const band = Math.max(0.012, (1 - options.horizon) * 0.6);
      const t = smoothstep(-band, band, Math.sin(elevation));
      let r = options.ground[0] + (options.sky[0] - options.ground[0]) * t;
      let g = options.ground[1] + (options.sky[1] - options.ground[1]) * t;
      let b = options.ground[2] + (options.sky[2] - options.ground[2]) * t;

      for (const box of options.softboxes) {
        const halfW = box.width * 0.5 * DEG;
        const halfH = box.height * 0.5 * DEG;

        const da = Math.abs(angleDelta(azimuth, box.azimuth * DEG));
        const de = Math.abs(elevation - box.elevation * DEG);
        if (da > halfW || de > halfH) continue;

        // Soft edges on both axes, multiplied: a rectangle with a rolled edge, which is what an actual softbox reflects like.
        const soft = Math.max(1e-4, options.falloff);
        const fa = smoothstep(halfW, halfW * (1 - soft), da);
        const fe = smoothstep(halfH, halfH * (1 - soft), de);
        const k = fa * fe * box.intensity;

        r += box.color[0] * k;
        g += box.color[1] * k;
        b += box.color[2] * k;
      }

      const i = (y * WIDTH + x) * 4;
      data[i] = r;
      data[i + 1] = g;
      data[i + 2] = b;
      data[i + 3] = 1;
    }
  }

  const texture = new DataTexture(data, WIDTH, HEIGHT, RGBAFormat, FloatType);
  texture.mapping = EquirectangularReflectionMapping;
  // Float data is already linear: tagging it sRGB would double-correct it.
  texture.colorSpace = LinearSRGBColorSpace;
  texture.magFilter = LinearFilter;
  texture.minFilter = LinearFilter;
  texture.generateMipmaps = false;
  texture.needsUpdate = true;
  return texture;
}

/** Where the lights go is decided by the geometry, not by taste. */
export const STUDIO_DEFAULT: StudioOptions = {
  ground: [0.01, 0.01, 0.015],
  sky: [0.055, 0.065, 0.095],
  falloff: 0.75,
  // Studios don't have a skyline: the wash is meant to be even.
  horizon: 0.1,
  softboxes: [
    // Key: on-axis but deliberately not huge.
    {
      azimuth: 6,
      elevation: 14,
      width: 130,
      height: 100,
      intensity: 1.15,
      color: [1, 0.85, 0.6],
    },
    // Kick: tight and hot, off to the side.
    {
      azimuth: -52,
      elevation: 30,
      width: 30,
      height: 30,
      intensity: 26,
      color: [1, 0.87, 0.62],
    },
    // Rim: cool, behind, keeps fully-turned faces off pure black.
    {
      azimuth: 168,
      elevation: 18,
      width: 80,
      height: 60,
      intensity: 2.4,
      color: [0.62, 0.74, 1],
    },
  ],
};

/** Outdoors, which suits these tiles far better than a studio does. */
export const OUTDOOR_DEFAULT: StudioOptions = {
  // Warm dark earth below, deep sky above, meeting at a hard line.
  ground: [0.035, 0.028, 0.022],
  sky: [0.34, 0.44, 0.72],
  falloff: 0.5,
  horizon: 0.6,
  softboxes: [
    // Sun: small and fierce.
    {
      azimuth: 22,
      elevation: 27,
      width: 11,
      height: 11,
      intensity: 55,
      color: [1, 0.93, 0.78],
    },
    // Haze just above the skyline, which is what most of a settled tile sees.
    {
      azimuth: 10,
      elevation: 5,
      width: 150,
      height: 16,
      intensity: 1.5,
      color: [1, 0.88, 0.72],
    },
    // Bounce off the ground, warm and dim, for faces tipped downward.
    {
      azimuth: -20,
      elevation: -34,
      width: 140,
      height: 50,
      intensity: 0.5,
      color: [1, 0.78, 0.5],
    },
  ],
};

export const ENV_PRESETS = {
  outdoor: OUTDOOR_DEFAULT,
  studio: STUDIO_DEFAULT,
} as const;

export type EnvPreset = keyof typeof ENV_PRESETS;
