"use client";

import { useEffect, useRef } from "react";
import { useRenderPipeline } from "@react-three/fiber/webgpu";
import { bloom } from "three/examples/jsm/tsl/display/BloomNode.js";
import { emissive, mrt, output } from "three/tsl";

/** The bloom pass's live knobs. */
interface BloomPass {
  strength: { value: number };
  radius: { value: number };
  threshold: { value: number };
}

/**
 * The whole post-processing chain, in one box.
 *
 * One scene pass into a multi-render-target — colour on one attachment,
 * emissive on another — then bloom on the emissive alone, added back over
 * the colour. Only things that *emit* glow: the tower's lights and bulbs, not
 * every bright pixel. The knobs are uniforms; toggling `bloom` rebuilds the
 * graph, turning `strength` doesn't.
 *
 * The pro pipeline (`resources/tower-scene/fx.tsx`) builds on exactly this
 * scene pass, in this order:
 *   1. GTAO from a packed-normal attachment (or SSGI, which replaces it)
 *   2. sky-coloured height fog, sampling the baked sky cube per view ray
 *   3. the temporal resolver: FSR3 reconstructing from 1/1.5 res (or TRAA)
 *   4. a full-resolution lettering pass composited last, so glyphs stay crisp
 * Each is a stage you add to this graph, not a different graph.
 */
export function PostFx({
  bloom: enabled = true,
  strength = 0.45,
  radius = 0.4,
  threshold = 0.05,
}: {
  bloom?: boolean;
  strength?: number;
  radius?: number;
  threshold?: number;
}) {
  const pass = useRef<BloomPass | null>(null);
  const built = useRef<boolean | null>(null);

  const { rebuild } = useRenderPipeline(
    // Configure the output. Runs once, and again on `rebuild()`.
    ({ renderPipeline, passes }) => {
      const scenePass = passes?.scenePass;
      if (!renderPipeline || !scenePass) return;

      const beauty = scenePass.getTextureNode("output");

      if (enabled) {
        const glow = bloom(
          scenePass.getTextureNode("emissive"),
          strength,
          radius,
          threshold,
        );
        pass.current = glow as unknown as BloomPass;
        renderPipeline.outputNode = beauty.add(glow);
      } else {
        pass.current = null;
        renderPipeline.outputNode = beauty;
      }

      // The presentation material has a new output node; say so.
      renderPipeline.needsUpdate = true;
      built.current = enabled;
    },
    // Configure the scene pass's attachments. Runs first.
    ({ passes }) => {
      passes?.scenePass?.setMRT(mrt({ output, emissive }));
    },
  );

  // Structural change: rebuild the graph. Value change: write the uniform.
  useEffect(() => {
    if (built.current !== null && built.current !== enabled) rebuild();
  }, [enabled, rebuild]);

  useEffect(() => {
    const glow = pass.current;
    if (!glow) return;
    glow.strength.value = strength;
    glow.radius.value = radius;
    glow.threshold.value = threshold;
  }, [strength, radius, threshold]);

  return null;
}
