/**
 * Tunables for the takehome grid.
 *
 * Split out of the component so the Leva dependency stays on the demo side of
 * the boundary — nothing under `components/` imports it.
 */

/**
 * What the tiles say.
 *
 * These are the real demo slugs, and that is the whole point of the card: the
 * things being handed over are the things the visitor has already scrolled
 * past. Adding a name here that isn't a demo yet would make the card a claim
 * rather than evidence, so the list grows when the demos do.
 */
export const TAKEHOME_NAMES = [
  "magic-box",
  "flip-grid",
  "grain-gradient",
  "blending-cube",
  "block-city",
  "connectors",
];

export type TakehomeGridConfig = {
  cols: number;
  rows: number;

  /** Tile width in world units; height follows from `aspect`. */
  tile: number;
  aspect: number;
  gap: number;
  /** Tile depth as a fraction of its height — the edge you see mid-turn. */
  thickness: number;

  /** Seconds between one tile starting its turn and the next. */
  stagger: number;
  /** Seconds a single tile takes to turn. */
  turn: number;
  /** Seconds the full grid stays revealed before it closes again. */
  hold: number;
  /** Seconds the whole grid takes to turn back. */
  close: number;
  /** How far past the landing the turn overshoots, 0 for none. */
  overshoot: number;

  /** The resting face — dark, so the reveal is a change in value not hue. */
  front: string;
  /** The revealed face. */
  back: string;
  /** The type on the revealed face. */
  ink: string;
  edge: string;

  ambient: number;
  keyIntensity: number;
};

export const TAKEHOME_GRID_DEFAULTS: TakehomeGridConfig = {
  cols: 3,
  rows: 2,

  tile: 1,
  aspect: 1.6,
  gap: 0.07,
  thickness: 0.11,

  stagger: 0.36,
  turn: 0.85,
  hold: 2.6,
  close: 0.75,
  overshoot: 1.35,

  front: "#2b2b34",
  back: "#e6e1d6",
  ink: "#14141a",
  edge: "#4a4a55",

  ambient: 0.55,
  keyIntensity: 2.2,
};

/**
 * The card slot is 190px tall and the tiles have to stay legible in it, so the
 * site preset runs the sequence slower and holds the reveal longer — the whole
 * point is that a visitor scrolling past sees the names, not the motion.
 */
export const TAKEHOME_GRID_SITE: TakehomeGridConfig = {
  ...TAKEHOME_GRID_DEFAULTS,
  stagger: 0.3,
  hold: 3.4,
  ambient: 0.6,
  keyIntensity: 1.9,
};
