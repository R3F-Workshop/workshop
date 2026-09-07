/**
 * Tunables for the block city.
 *
 * Split out of the component so the Leva dependency stays on the demo side of
 * the boundary — nothing under `components/` imports it.
 */

export type BlockCityConfig = {
  /** Cells across and deep. The patch is trimmed to an ellipse inside this. */
  cols: number;
  rows: number;
  /** Distance between cell centres, before jitter. */
  spacing: number;
  /** How far a block may wander from its cell, as a fraction of spacing. */
  jitter: number;

  minHeight: number;
  maxHeight: number;
  /** Taller toward the middle, like a real skyline. 0 for an even field. */
  centreBias: number;
  footprint: number;

  /** Seconds the whole build takes, first block to last. */
  build: number;
  /** Seconds any single block takes to rise. */
  rise: number;
  /** How far a block overshoots its height before settling. 0 for none. */
  overshoot: number;

  /** Degrees per second of the slow drift once it has settled. */
  drift: number;

  base: string;
  window: string;
  windowLight: number;

  ambient: number;
  keyIntensity: number;
  skyIntensity: number;
};

export const BLOCK_CITY_DEFAULTS: BlockCityConfig = {
  cols: 26,
  rows: 20,
  spacing: 4.1,
  jitter: 0.5,

  minHeight: 0.8,
  maxHeight: 6.2,
  centreBias: 0.55,
  footprint: 0.62,

  build: 2.6,
  rise: 0.75,
  overshoot: 1.15,

  drift: 1.4,

  base: "#3d445a",
  window: "#ffbe78",
  windowLight: 0.16,

  ambient: 0.62,
  keyIntensity: 2.8,
  skyIntensity: 1.0,
};

/**
 * The Overview slot is a wide, short card beside body copy, so the city reads
 * as a photograph of a skyline rather than as a scene you are in: dimmer, and
 * drifting slowly enough that it never competes with the text next to it.
 */
export const BLOCK_CITY_SITE: BlockCityConfig = {
  ...BLOCK_CITY_DEFAULTS,
  drift: 0.9,
  ambient: 0.55,
  keyIntensity: 2.4,
  windowLight: 0.14,
};
