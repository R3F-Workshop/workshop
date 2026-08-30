/**
 * Every tunable of the flip grid, in one place.
 *
 * The demo page drives these from Leva; the site will import the defaults and
 * pass an override or two. Splitting them out of the component keeps the Leva
 * dependency on the demo side of the boundary — nothing under `components/`
 * imports it.
 */
export type FlipGridConfig = {
  /** Grid resolution. Changing either remounts the scene — see `flip-grid.tsx`. */
  cols: number;
  rows: number;

  /** Tile edge as a fraction of the cell, so a hairline gutter shows through. */
  fill: number;
  /** Tile depth as a fraction of the tile edge. This is what sells the flip. */
  thickness: number;

  /** Flip radius around the cursor, in cells. */
  radius: number;
  /** Seconds a tile stays flipped after the cursor has moved off it. */
  hold: number;

  /** Angular spring driving the flip. Damping below ~2·sqrt(stiffness) overshoots. */
  stiffness: number;
  damping: number;
  /** Upper bound on the per-instance mass multiplier. 0 makes every tile identical. */
  massJitter: number;

  /** Face colours: front (resting), back (the metal), and the four edges. */
  front: string;
  /**
   * Gold reflectance. The default is `Gold.mtlx`'s base_color — (1.059, 0.773,
   * 0.307) linear — which is what physically-based gold actually is: paler and
   * less orange than the colour most people reach for.
   */
  back: string;
  edge: string;

  /** Base roughness of the metal face. 0 is a mirror; the flakes add the rest. */
  roughness: number;

  /**
   * Fine normal perturbation, standing in for the microfacet structure a real
   * metal surface has. Without it a flat tile reflects exactly one direction of
   * the environment and reads as paint. See `flip-grid.tsx`.
   */
  /** Grain facets across a tile. Aim for a few pixels each — see flip-grid.tsx. */
  flakeCells: number;
  flakeStrength: number;
  /** How far the grain pushes roughness around per facet. */
  flakeRoughness: number;
  /** Per-tile brightness spread, so neighbours aren't identical. */
  toneJitter: number;
  /** Per-tile roughness spread. */
  roughJitter: number;
  /**
   * Per-tile lean, in normal-space units (~0.3 is a few degrees). Without it
   * every settled tile faces the same way, reflects the same direction of a
   * distant environment, and the grid resolves to one flat colour.
   */
  tiltJitter: number;
  /**
   * How much each tile domes across its own face. This is the curvature a flat
   * plate doesn't have, and it's what turns a single reflected sample into a
   * highlight gradient. 0 makes the tiles genuinely flat — and genuinely
   * plastic-looking.
   */
  curvature: number;

  /** Which environment to reflect. Outdoor's hard horizon suits flat tiles. */
  envPreset: "outdoor" | "studio";
  /** Environment. Intensities are linear radiance, so >1 is expected. */
  ground: string;
  sky: string;
  keyIntensity: number;
  kickIntensity: number;
  fillIntensity: number;
  /** Multiplier applied to the environment as a whole. */
  envIntensity: number;

  /** A light that rides the cursor, so the metal has something moving to catch. */
  cursorLight: number;
  cursorLightHeight: number;
  cursorLightColor: string;
};

export const FLIP_GRID_DEFAULTS: FlipGridConfig = {
  cols: 56,
  rows: 32,

  fill: 0.82,
  thickness: 0.09,

  radius: 3.2,
  hold: 3,

  stiffness: 60,
  damping: 9,
  massJitter: 1.4,

  // Darker than it looks like it needs to be: a studio bright enough to make
  // gold glow also lights the resting faces, and these are meant to disappear.
  front: "#0a0a0d",
  back: "#f6cd76",
  edge: "#6b5a33",

  roughness: 0.13,

  flakeCells: 12,
  flakeStrength: 0.09,
  flakeRoughness: 0.18,
  toneJitter: 0.3,
  roughJitter: 0.18,
  tiltJitter: 0.12,
  curvature: 0.18,

  envPreset: "outdoor",
  ground: "#2a2018",
  sky: "#6f83ad",
  keyIntensity: 55,
  kickIntensity: 2.2,
  fillIntensity: 0.5,
  envIntensity: 1,

  cursorLight: 9,
  cursorLightHeight: 3.5,
  cursorLightColor: "#fff2d8",
};

/**
 * The same effect tuned to sit behind body copy.
 *
 * A demo page can afford a full-strength backdrop; a section can't. The copy
 * has to stay the thing you read, so the resting tiles go nearly black, the
 * gold comes down out of highlight range, and the cursor light — a nice touch
 * on its own, a distraction under a paragraph — is switched off.
 *
 * Tuned as *config* rather than by wrapping the canvas in a low opacity. Fading
 * the whole layer would lift the dark tiles toward the page background as much
 * as it dims the gold, which flattens exactly the contrast the effect is made
 * of.
 */
export const FLIP_GRID_SITE: FlipGridConfig = {
  ...FLIP_GRID_DEFAULTS,
  front: "#08080a",
  edge: "#3f351f",
  // Enough to read as gold, not enough to pull the eye off the text. The lede
  // sits in muted-foreground, so the ceiling here is set by what that stays
  // legible against, not by what looks best in isolation.
  back: "#c9a862",
  keyIntensity: 14,
  kickIntensity: 0.8,
  fillIntensity: 0.3,
  envIntensity: 0.4,
  // Fewer, softer facets: grain that reads as noise at this brightness.
  flakeStrength: 0.06,
  toneJitter: 0.22,
  cursorLight: 0,
};
