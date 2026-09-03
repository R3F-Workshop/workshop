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

/** The whole post-processing chain, in one box. */
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
    // Configure the output.
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

      // The presentation material has a new output node: say so.
      renderPipeline.needsUpdate = true;
      built.current = enabled;
    },
    // Configure the scene pass's attachments.
    ({ passes }) => {
      passes?.scenePass?.setMRT(mrt({ output, emissive }));
    },
  );

  // Structural change: rebuild the graph.
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
