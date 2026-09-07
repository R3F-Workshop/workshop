/** Authored Paris layout shared by the tuning demo and the website hero. */
export const PARIS_CITY_DEFAULTS = {
  highRiseCount: 300,
  lowRiseCount: 10_000,
  treeCount: 20_000,
  treeShadows: false,
  river: true,
  park: true,
  haussmann: true,
} as const;

/** The homepage uses lighter density. Geography and layout stay unchanged. */
export const PARIS_HOMEPAGE_CITY_DEFAULTS = {
  ...PARIS_CITY_DEFAULTS,
  treeCount: 12_000,
} as const;

/** The demo's inexpensive dusk environment and aerial-depth treatment. */
export const PARIS_ATMOSPHERE_DEFAULTS = {
  skyEnabled: true,
  turbidity: 1,
  mirrorBelowHorizon: false,
  preset: "earth",
  quality: "medium",
  cubeSize: 256,
  haze: false,
  hazeStrength: 1,
  hazePolicy: "auto",
  apKmPerSlice: 8,
  skyFog: true,
  fogDensity: 0.3,
  fogHeight: 300,
  fogHorizonClamp: true,
} as const;
