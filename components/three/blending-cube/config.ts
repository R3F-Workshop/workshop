/**
 * Tunables for the blending cube.
 *
 * Split out of the component so the Leva dependency stays on the demo side of
 * the boundary — nothing under `components/` imports it.
 */

export type BlendingCubeConfig = {
  /** Seconds a stage holds before it starts blending into the next. */
  stageSeconds: number;
  /** Seconds the crossfade itself takes. Must be < stageSeconds. */
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
  /** Radius of that plane. Smaller in a card slot, where it would otherwise
   *  arc across the frame behind the cube. */
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
  // Against the near-black background the shadow stage is otherwise invisible.
  floor: "#3a3a46",
  plinth: 2.1,

  plainRoughness: 0.85,
  // Low enough that the softboxes come back as distinct reflections rather than
  // averaging into one wash. Past about 0.4 the cube stops reading as metal.
  metalRoughness: 0.14,

  // Enough to read the box's form before the key light arrives, and no more —
  // the whole point of stage three is that the light is missing until then.
  ambient: 0.35,
  keyIntensity: 2.6,
  envIntensity: 1.15,

  shadowOpacity: 0.8,
  shadowBlur: 1.6,
};

/**
 * The card slot is 190px tall and sits third in a row, so the cube reads as a
 * thumbnail rather than a subject: slower, dimmer, and less contrasty than the
 * demo page, where it is the only thing on screen.
 */
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
