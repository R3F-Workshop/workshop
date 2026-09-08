"use client";

import { useRef, useState } from "react";
import { Billboard } from "@react-three/drei/webgpu";
import { useFrame } from "@react-three/fiber/webgpu";
import { Text, useFont } from "@pmndrs/glyph/react";
import type { Text as TextObject } from "@pmndrs/glyph/three";
import { msdf } from "@pmndrs/glyph/three/msdf";
import { asset } from "@/lib/asset";

/** The PMNDRS wordmark, threaded through the tower. */

const FONT = {
  input: { baked: asset("/hero-demo/Geist-ExtraBold.font.glb") },
  raster: { technique: msdf },
} as const;

/** The pro layout is authored against a 24-unit tower: ours is 66. */
const LAYOUT_SCALE = 66 / 24;

/** Per letter: where it sits (x across, y up, z toward the camera), and where the glyph's visual centre is as a fraction of the em. */
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

  // A paragraph's origin is its top-left corner.
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
