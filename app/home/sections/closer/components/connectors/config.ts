import type { ShapeKind } from "./shapes";

/** Every tunable of the connectors container, in one place. */
export type ConnectorsConfig = {
  /** Which body to fill the container with. */
  shape: ShapeKind;
  /** Number of physics bodies. */
  count: number;
  /** Body size. 1 puts the logo at ~2.9 world units across. */
  scale: number;

  /** Strength of the pull home, per second. */
  pull: number;
  /** Anchor spacing as a fraction of the frame half-width. 0 pulls every body to one point. */
  spreadX: number;
  /** Where the bodies gather vertically, in world units from the centre. */
  centerY: number;
  /** Velocity bleed. */
  linearDamping: number;
  angularDamping: number;

  /** Radius of the invisible ball the cursor drags through the pile. */
  pointerRadius: number;

  /** Base colours the bodies are dealt from. */
  dark: string;
  light: string;
  /** The colour a third of them take. */
  accent: string;
  /** Light carried by each accent body, so the accent bounces onto its neighbours. */
  accentLight: number;

  /** Non-glass bodies. */
  roughness: number;
  metalness: number;

  /** One body is transmissive. 0 turns it into another opaque one. */
  glassThickness: number;
  glassRoughness: number;
  glassIor: number;

  /** Environment. */
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

/** The same container tuned to sit behind the closing CTA and the footer. */
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

/** The accents the demo page cycles on click, gold first. */
export const ACCENTS = ["#f6cd76", "#4060ff", "#20ffa0", "#ff4060"] as const;
