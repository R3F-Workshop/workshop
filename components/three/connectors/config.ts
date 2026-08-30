import type { ShapeKind } from "./shapes";

/**
 * Every tunable of the connectors container, in one place.
 *
 * Same split as the flip grid: the demo page drives these from Leva, the site
 * imports a preset. Keeping them out of the components means nothing under
 * `components/three/connectors/` imports leva.
 */
export type ConnectorsConfig = {
  /** Which body to fill the container with. */
  shape: ShapeKind;
  /** How many. The last one is glass, so this includes it. */
  count: number;
  /** Body size. 1 puts the logo at ~2.9 world units across. */
  scale: number;

  /**
   * Strength of the pull home, per second.
   *
   * This is the whole container. There are no walls: gravity is off and every
   * body has an impulse applied toward where it belongs, proportional to how far
   * out it has drifted — a spring. Bodies pile up against each other rather than
   * against a box, and that is what looks alive. Where "home" is depends on
   * `spreadX`: the origin for everything, or a slot each.
   */
  pull: number;
  /**
   * How far apart the bodies are anchored across the frame, as a fraction of its
   * half-width. 0 is the original — every body pulled to the same point, one
   * pile. Above 0 they get a slot each and the pile becomes a band.
   *
   * This is what makes the shape fit its frame, and it is the one place the
   * physics deviates from the original. A full screen wants the pile; the strip
   * behind the footer is five times wider than it is tall, and a single pile in
   * the middle of it is a smudge with dead space either side. Weakening the
   * sideways pull spreads them too, but where they end up is then down to
   * whatever the opening scramble happened to do — some loads band nicely, some
   * clump in two lumps. A slot each is the same look, every load.
   *
   * The bodies still collide, and the cursor still ploughs through them. They
   * just find their way back to a spread rather than to a heap.
   */
  spreadX: number;
  /** Where the bodies gather vertically, in world units from the centre. */
  centerY: number;
  /** Velocity bleed. Low values make the pile keep sloshing after a shove. */
  linearDamping: number;
  angularDamping: number;

  /** Radius of the invisible ball the cursor drags through the pile. */
  pointerRadius: number;

  /** Base colours the bodies are dealt from. */
  dark: string;
  light: string;
  /** The colour a third of them take. Cycled by clicking on the demo page. */
  accent: string;
  /** Light carried by each accent body, so the accent bounces onto its neighbours. */
  accentLight: number;

  /** Non-glass bodies. Gold wants low roughness; a matte plastic wants ~0.7. */
  roughness: number;
  metalness: number;

  /** One body is transmissive. 0 turns it into another opaque one. */
  glassThickness: number;
  glassRoughness: number;
  glassIor: number;

  /** Environment. Intensities are linear radiance, so >1 is expected. */
  keyIntensity: number;
  kickIntensity: number;
  fillIntensity: number;
  envIntensity: number;
};

export const CONNECTORS_DEFAULTS: ConnectorsConfig = {
  shape: "logo",
  count: 10,
  scale: 0.46,

  pull: 0.2,
  spreadX: 0,
  centerY: 0,
  linearDamping: 4,
  angularDamping: 1,

  pointerRadius: 1,

  dark: "#3b3b42",
  light: "#e9e7e2",
  accent: "#f6cd76",
  accentLight: 3.5,

  roughness: 0.28,
  metalness: 0.35,

  glassThickness: 0.9,
  glassRoughness: 0.06,
  glassIor: 1.5,

  keyIntensity: 4,
  kickIntensity: 14,
  fillIntensity: 0.8,
  envIntensity: 1,
};

/**
 * The same container tuned to sit behind the closing CTA and the footer.
 *
 * Two changes carry most of it. `spreadX` gives each body a slot across the
 * width, so instead of one pile in the middle of a very wide strip they settle
 * into a band that fills it. And the band sits low — `centerY` puts it under the
 * register button and across the footer rule, because bodies gathered on the
 * origin gather directly behind "Add the workshop to your conference ticket",
 * which is the one place on the page nothing should be.
 *
 * The rest is quieting it down: more bodies but smaller, a dimmer environment,
 * and the accent light almost off. Tuned as config rather than by fading the
 * canvas, for the same reason the flip grid is — dropping opacity lifts the dark
 * bodies toward the page background as much as it dims the bright ones, and the
 * contrast is the effect.
 */
export const CONNECTORS_SITE: ConnectorsConfig = {
  ...CONNECTORS_DEFAULTS,
  count: 16,
  scale: 0.44,
  spreadX: 0.82,
  centerY: -2,
  dark: "#232329",
  light: "#8e8b85",
  accent: "#a98d52",
  accentLight: 1,
  keyIntensity: 2,
  kickIntensity: 3.5,
  fillIntensity: 0.4,
  envIntensity: 0.45,
};

/**
 * The accents the demo page cycles on click, gold first.
 *
 * The last three are the Lusion original's, kept deliberately — the click-to-
 * recolour is half of what that demo is remembered for.
 */
export const ACCENTS = ["#f6cd76", "#4060ff", "#20ffa0", "#ff4060"] as const;
