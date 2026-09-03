/** Tunables for the blending cube. */

export type BlendingCubeConfig = {
  /** Seconds a stage holds before it starts blending into the next. */
  stageSeconds: number;
  /** Seconds the crossfade itself takes. */
  blendSeconds: number;

  /** Turns per second of the idle spin. */
  spin: number;
  /** How far the cube dips and squashes as each stage lands, in units. */
  bounce: number;

  /** The bare box, before anything is added to it. */
  plain: string;
  /** What it becomes once there is an environment to reflect. */
  metal: string;
  edge: string;
  lineWidth: number;
  /** The plane the cube stands on, and the thing the contact shadow darkens. */
  floor: string;
  /** Radius of that plane. */
  plinth: number;

  /** Roughness at each end of the material blend. */
  plainRoughness: number;
  metalRoughness: number;

  ambient: number;
  keyIntensity: number;
  envIntensity: number;

  shadowOpacity: number;
  shadowBlur: number;
};

export const BLENDING_CUBE_DEFAULTS: BlendingCubeConfig = {
  stageSeconds: 2.2,
  blendSeconds: 0.9,

  spin: 0.055,
  bounce: 0.14,

  plain: "#8a8a93",
  metal: "#c9a862",
  edge: "#f2ede3",
  lineWidth: 1.6,
  // Light enough that a dark pool of contact shadow has something to darken.
  floor: "#3a3a46",
  plinth: 2.1,

  plainRoughness: 0.85,
  // Low enough that the softboxes come back as distinct reflections rather than averaging into one wash.
  metalRoughness: 0.14,

  // Keep enough ambient light to reveal the box before the key light arrives.
  ambient: 0.35,
  keyIntensity: 2.6,
  envIntensity: 1.15,

  shadowOpacity: 0.8,
  shadowBlur: 1.6,
};

/** The card slot is 190px tall and sits third in a row, so the cube reads as a thumbnail rather than a subject: slower, dimmer. */
export const BLENDING_CUBE_SITE: BlendingCubeConfig = {
  ...BLENDING_CUBE_DEFAULTS,
  stageSeconds: 2.6,
  spin: 0.04,
  ambient: 0.3,
  keyIntensity: 2.2,
  envIntensity: 0.95,
  shadowOpacity: 0.45,
  plinth: 1.5,
};
