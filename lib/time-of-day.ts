/**
 * Cyclic time-of-day values shared by the dial, CSS sky, and 3D atmosphere.
 * Inputs are fractions of a 24-hour solar day and wrap at midnight.
 */

export type Phase = "NIGHT" | "DUSK" | "GOLDEN" | "DAY";

type RGB = [number, number, number];

interface Palette {
  /** CSS gradient stops, top → bottom. */
  skyTop: RGB;
  skyMid: RGB;
  skyBottom: RGB;
  /** Sun elevation in degrees above the horizon; negative is below. */
  sunElevation: number;
  /** Compass bearing in degrees from north at 0 to east at 90. */
  sunAzimuth: number;
  sunColor: RGB;
  sunIntensity: number;
  ambientColor: RGB;
  ambientIntensity: number;
  /** Emissive strength of building windows. */
  windowLight: number;
  /** Star field opacity. */
  starOpacity: number;
  /** Base colour of the city blocks. */
  cityColor: RGB;
  towerColor: RGB;
}

export interface TodKeyframe extends Palette {
  phase: Phase;
}

const DAY_HOURS = 24;

/** Wraps an hour into [0, 24). */
const wrapHours = (h: number) => ((h % DAY_HOURS) + DAY_HOURS) % DAY_HOURS;

/** Named solar intervals shared by the dial and phase labels. */
export const SOLAR_ZONES = [
  {
    label: "Dawn",
    phase: "DUSK",
    startHour: 3.24,
    endHour: 4.05,
    color: "#c4b5fd",
  },
  {
    label: "Morning golden hour",
    phase: "GOLDEN",
    startHour: 4.05,
    endHour: 4.78,
    color: "#fde68a",
  },
  {
    label: "Evening golden hour",
    phase: "GOLDEN",
    startHour: 19.29,
    endHour: 20.02,
    color: "#f59e0b",
  },
  {
    label: "Dusk",
    phase: "DUSK",
    startHour: 20.02,
    endHour: 20.84,
    color: "#a78bfa",
  },
] as const satisfies ReadonlyArray<{
  label: string;
  phase: Phase;
  startHour: number;
  endHour: number;
  color: string;
}>;

/** Daylight spans the gap between the golden hour zones. */
const DAY_START = SOLAR_ZONES[1].endHour;
const DAY_END = SOLAR_ZONES[2].startHour;

/** Returns the named zone containing the hour. */
export const zoneAt = (hour: number) => {
  const h = wrapHours(hour);
  return (
    SOLAR_ZONES.find((zone) => h >= zone.startHour && h < zone.endHour) ?? null
  );
};

/** Returns the phase containing the solar hour. */
export function phaseFor(hour: number): Phase {
  const h = wrapHours(hour);
  const zone = zoneAt(h);
  if (zone) return zone.phase;
  return h >= DAY_START && h < DAY_END ? "DAY" : "NIGHT";
}

/** Cyclic palette keyframes in solar-hour order. */
const KEYFRAMES: (Palette & { hour: number })[] = [
  {
    // Deep night from 22:12 through 02:12.
    hour: 2.2,
    skyTop: [7, 11, 24],
    skyMid: [11, 18, 38],
    skyBottom: [0, 0, 0],
    sunElevation: -14,
    sunAzimuth: 20,
    sunColor: [150, 170, 220],
    sunIntensity: 0.35,
    ambientColor: [30, 40, 70],
    ambientIntensity: 0.35,
    windowLight: 1,
    starOpacity: 1,
    cityColor: [16, 17, 22],
    towerColor: [78, 82, 100],
  },
  {
    // Dawn twilight.
    hour: 3.65,
    skyTop: [20, 26, 56],
    skyMid: [30, 38, 74],
    skyBottom: [5, 7, 15],
    sunElevation: -3,
    sunAzimuth: 42,
    sunColor: [170, 165, 205],
    sunIntensity: 0.9,
    ambientColor: [45, 52, 90],
    ambientIntensity: 0.5,
    windowLight: 0.72,
    starOpacity: 0.5,
    cityColor: [26, 28, 38],
    towerColor: [96, 98, 120],
  },
  {
    // Morning golden hour with cooler tones.
    hour: 4.42,
    skyTop: [54, 50, 92],
    skyMid: [132, 96, 96],
    skyBottom: [20, 16, 26],
    sunElevation: 4,
    sunAzimuth: 55,
    sunColor: [255, 184, 136],
    sunIntensity: 2.1,
    ambientColor: [92, 78, 94],
    ambientIntensity: 0.62,
    windowLight: 0.3,
    starOpacity: 0.08,
    cityColor: [56, 50, 56],
    towerColor: [126, 116, 122],
  },
  {
    // Hold the daylight palette across the middle hours.
    hour: 8,
    skyTop: [76, 124, 184],
    skyMid: [143, 178, 214],
    skyBottom: [26, 36, 48],
    sunElevation: 26,
    sunAzimuth: 90,
    sunColor: [255, 246, 232],
    sunIntensity: 2.5,
    ambientColor: [150, 175, 205],
    ambientIntensity: 0.82,
    windowLight: 0,
    starOpacity: 0,
    cityColor: [96, 102, 116],
    towerColor: [150, 152, 168],
  },
  {
    hour: 13,
    skyTop: [82, 132, 192],
    skyMid: [150, 185, 220],
    skyBottom: [28, 38, 50],
    sunElevation: 62,
    sunAzimuth: 175,
    sunColor: [255, 250, 240],
    sunIntensity: 2.6,
    ambientColor: [158, 182, 210],
    ambientIntensity: 0.85,
    windowLight: 0,
    starOpacity: 0,
    cityColor: [100, 106, 120],
    towerColor: [154, 156, 172],
  },
  {
    hour: 18,
    skyTop: [76, 124, 184],
    skyMid: [143, 178, 214],
    skyBottom: [26, 36, 48],
    sunElevation: 26,
    sunAzimuth: 265,
    sunColor: [255, 246, 232],
    sunIntensity: 2.5,
    ambientColor: [150, 175, 205],
    ambientIntensity: 0.82,
    windowLight: 0,
    starOpacity: 0,
    cityColor: [96, 102, 116],
    towerColor: [150, 152, 168],
  },
  {
    // Evening golden hour.
    hour: 19.66,
    skyTop: [59, 47, 86],
    skyMid: [140, 90, 83],
    skyBottom: [22, 15, 24],
    sunElevation: 4,
    sunAzimuth: 300,
    sunColor: [255, 176, 118],
    sunIntensity: 2.1,
    ambientColor: [96, 74, 86],
    ambientIntensity: 0.62,
    windowLight: 0.3,
    starOpacity: 0.08,
    cityColor: [58, 48, 52],
    towerColor: [128, 114, 116],
  },
  {
    hour: 20.43,
    skyTop: [20, 26, 56],
    skyMid: [27, 34, 68],
    skyBottom: [5, 7, 15],
    sunElevation: -3,
    sunAzimuth: 312,
    sunColor: [190, 150, 190],
    sunIntensity: 0.9,
    ambientColor: [45, 52, 90],
    ambientIntensity: 0.5,
    windowLight: 0.72,
    starOpacity: 0.5,
    cityColor: [26, 28, 38],
    towerColor: [96, 98, 120],
  },
  {
    hour: 22.2,
    skyTop: [7, 11, 24],
    skyMid: [11, 18, 38],
    skyBottom: [0, 0, 0],
    sunElevation: -14,
    sunAzimuth: 340,
    sunColor: [150, 170, 220],
    sunIntensity: 0.35,
    ambientColor: [30, 40, 70],
    ambientIntensity: 0.35,
    windowLight: 1,
    starOpacity: 1,
    cityColor: [16, 17, 22],
    towerColor: [78, 82, 100],
  },
];

const lerp = (a: number, b: number, t: number) => a + (b - a) * t;

const lerpRGB = (a: RGB, b: RGB, t: number): RGB => [
  lerp(a[0], b[0], t),
  lerp(a[1], b[1], t),
  lerp(a[2], b[2], t),
];

/** Interpolates bearings across the shortest arc. */
const lerpAngle = (a: number, b: number, t: number) => {
  const delta = ((((b - a) % 360) + 540) % 360) - 180;
  const angle = a + delta * t;
  return ((angle % 360) + 360) % 360;
};

/** Smooths keyframe joins. */
const smoothstep = (t: number) => t * t * (3 - 2 * t);

export const rgbToCss = (c: RGB) =>
  `rgb(${Math.round(c[0])} ${Math.round(c[1])} ${Math.round(c[2])})`;

/** Returns the keyframes and eased position for an hour. */
function segmentAt(hour: number) {
  const h = wrapHours(hour);
  // Use the segment that wraps midnight by default.
  let i = KEYFRAMES.length - 1;
  for (let k = 0; k < KEYFRAMES.length - 1; k++) {
    if (h >= KEYFRAMES[k].hour && h < KEYFRAMES[k + 1].hour) {
      i = k;
      break;
    }
  }
  const a = KEYFRAMES[i];
  const b = KEYFRAMES[(i + 1) % KEYFRAMES.length];
  return {
    a,
    b,
    f: smoothstep(wrapHours(h - a.hour) / wrapHours(b.hour - a.hour)),
  };
}

/** Returns the cyclic palette at a day fraction. */
export function todAt(t: number): TodKeyframe {
  const hour = wrapHours(t * DAY_HOURS);
  const { a, b, f } = segmentAt(hour);

  return {
    phase: phaseFor(hour),
    skyTop: lerpRGB(a.skyTop, b.skyTop, f),
    skyMid: lerpRGB(a.skyMid, b.skyMid, f),
    skyBottom: lerpRGB(a.skyBottom, b.skyBottom, f),
    sunElevation: lerp(a.sunElevation, b.sunElevation, f),
    sunAzimuth: lerpAngle(a.sunAzimuth, b.sunAzimuth, f),
    sunColor: lerpRGB(a.sunColor, b.sunColor, f),
    sunIntensity: lerp(a.sunIntensity, b.sunIntensity, f),
    ambientColor: lerpRGB(a.ambientColor, b.ambientColor, f),
    ambientIntensity: lerp(a.ambientIntensity, b.ambientIntensity, f),
    windowLight: lerp(a.windowLight, b.windowLight, f),
    starOpacity: lerp(a.starOpacity, b.starOpacity, f),
    cityColor: lerpRGB(a.cityColor, b.cityColor, f),
    towerColor: lerpRGB(a.towerColor, b.towerColor, f),
  };
}

/** The CSS backdrop behind the canvas, matching the doc's three-stop gradient. */
export function skyGradient(tod: TodKeyframe) {
  return `linear-gradient(180deg, ${rgbToCss(tod.skyTop)} 0%, ${rgbToCss(
    tod.skyMid,
  )} 48%, ${rgbToCss(tod.skyBottom)} 100%)`;
}
