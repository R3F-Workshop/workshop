"use client";

import { useRef, useState } from "react";
import { Billboard } from "@react-three/drei";
import { useFrame } from "@react-three/fiber/webgpu";
import { Text, useFont } from "@pmndrs/glyph/react";
import type { Text as TextObject } from "@pmndrs/glyph/three";
import { msdf } from "@pmndrs/glyph/three/msdf";

/**
 * The PMNDRS wordmark, threaded through the tower.
 *
 * Real geometry from `@pmndrs/glyph`. All six letters sit inside one
 * billboard at the tower's base, so the group always faces the camera — and
 * inside a camera-facing group, a letter's `z` is simply how far toward the
 * camera it sits. Letters behind the axis get hidden by the ironwork, letters
 * in front cover it, by nothing more than the depth test.
 *
 * The layout is the pro version's, scaled to this tower. What the pro adds is
 * a custom depth per *band* of a glyph (P's bowl behind the spire, its stem in
 * front), a separate full-resolution text pass, and pointer physics — see
 * `resources/tower-scene/lettering.tsx`. Shipped ready-made; import it.
 */

const FONT = {
  input: { baked: "/hero-demo/Geist-ExtraBold.font.glb" },
  raster: { technique: msdf },
} as const;

/**
 * The pro layout is authored against a 24-unit tower; ours is 66. Same
 * proportions, one multiplier.
 */
const LAYOUT_SCALE = 66 / 24;

/**
 * Per letter: where it sits (x across, y up, z toward the camera), and where
 * the glyph's visual centre is as a fraction of the em, so each letter is
 * placed by its outline rather than its box.
 */
const LETTERS: {
  char: string;
  position: [number, number, number];
  center: [number, number];
}[] = [
  { char: "P", position: [-0.3, 23.4, -1.6], center: [0.355, 0.355] },
  { char: "M", position: [3, 20.2, -2.2], center: [0.4635, 0.355] },
  { char: "N", position: [-2.5, 17.4, 3], center: [0.3765, 0.355] },
  { char: "D", position: [2.9, 14.6, -4], center: [0.377, 0.355] },
  { char: "R", position: [-3, 11.8, -6], center: [0.3635, 0.355] },
  { char: "S", position: [2.6, 9, 5], center: [0.3475, 0.355] },
];

export function Wordmark({
  size = 6 * LAYOUT_SCALE,
  spread = 0.8,
}: {
  /** Em size in world units. */
  size?: number;
  /** Multiplier on the authored left/right offsets. */
  spread?: number;
}) {
  const font = useFont(FONT);

  // A paragraph's origin is its top-left corner. Measure where the baseline
  // lands once the first letter has laid out, then place every glyph by it.
  const probe = useRef<TextObject<typeof msdf> | null>(null);
  const [baselineEm, setBaselineEm] = useState<number | null>(null);
  useFrame(() => {
    if (baselineEm !== null) return;
    const node = probe.current;
    if (!node || node.needsApply()) return;
    const layout = node.measureLayout();
    if (layout) setBaselineEm(layout.firstBaseline / size);
  });

  return (
    <Billboard>
      {LETTERS.map(({ char, position: [x, y, z], center }, i) => (
        <group
          key={char}
          position={[x * spread * LAYOUT_SCALE, y * LAYOUT_SCALE, z * LAYOUT_SCALE]}
        >
          <Text
            ref={i === 0 ? probe : undefined}
            font={font}
            style={{ fontSize: size, lineHeight: 1 }}
            paint={{ color: "#ffffff" }}
            position={[
              -center[0] * size,
              (baselineEm ?? 1) * size - center[1] * size,
              0,
            ]}
            visible={baselineEm !== null}
          >
            {char}
          </Text>
        </group>
      ))}
    </Billboard>
  );
}
