"use client";

import { useEffect, useRef } from "react";
import {
  ACESFilmicToneMapping,
  AgXToneMapping,
  NeutralToneMapping,
  NoToneMapping,
  SRGBColorSpace,
  type Node,
} from "three/webgpu";
import {
  emissive,
  Fn,
  mrt,
  normalView,
  output,
  renderOutput,
  smoothstep,
  uv,
  vec3,
  vec4,
} from "three/tsl";
import { ao } from "three/examples/jsm/tsl/display/GTAONode.js";
import { bloom } from "three/examples/jsm/tsl/display/BloomNode.js";
import { fxaa } from "three/examples/jsm/tsl/display/FXAANode.js";
import {
  Canvas,
  useRenderPipeline,
  useThree,
  useUniforms,
} from "@react-three/fiber/webgpu";
import { useControls } from "leva";

import { Stage, STAGE_CAMERA } from "@/app/experiences/stage";

import { Tower } from "./tower";

/**
 * TSL post, two of five: pipeline.
 *
 * The same scene pass, now with a typical chain hung off it. Ambient
 * occlusion from depth and normal, multiplied into the beauty. Bloom from the
 * emissive attachment, added on top. A vignette written by hand on the
 * screen uv. Then `renderOutput`, the tone map and colour space step the
 * pipeline would otherwise add on its own.
 *
 * Two kinds of control. A toggle adds or removes a pass, which is a
 * different graph, so it calls `rebuild()` and the whole chain is assembled
 * again. A slider writes into a pass's own uniform, or into one of ours, so
 * the graph stands and only a number changes. The comments on each control
 * say which.
 */

const TONE_MAPPINGS = {
  ACES: ACESFilmicToneMapping,
  AgX: AgXToneMapping,
  Neutral: NeutralToneMapping,
  none: NoToneMapping,
} as const;

function Pipeline() {
  const {
    ao: withAo,
    aoRadius,
    bloom: withBloom,
    bloomStrength,
    vignette: withVignette,
    vignetteStrength,
    fxaa: withFxaa,
    toneMapping,
    exposure,
  } = useControls("tsl post · pipeline", {
    // Toggles change the graph and rebuild it.
    ao: true,
    bloom: true,
    vignette: true,
    fxaa: true,
    // The tone map is compiled into the output node, so this rebuilds too.
    toneMapping: { value: "ACES", options: Object.keys(TONE_MAPPINGS) },
    // Sliders write into pass uniforms, one of ours, or a renderer field.
    aoRadius: { value: 0.35, min: 0.05, max: 1.5, step: 0.01 },
    bloomStrength: { value: 0.6, min: 0, max: 2, step: 0.01 },
    vignetteStrength: { value: 0.7, min: 0, max: 1, step: 0.01 },
    exposure: { value: 1, min: 0.1, max: 3, step: 0.01 },
  });
  const knobs = useUniforms(
    { vignetteStrength },
    "tslPostPipeline",
  );

  // The live passes, so the sliders can reach their uniforms.
  const aoPassRef = useRef<ReturnType<typeof ao> | null>(null);
  const bloomPassRef = useRef<ReturnType<typeof bloom> | null>(null);

  // What the current graph was built from. Only a change to this rebuilds.
  const builtKeyRef = useRef<string | null>(null);
  const wantedKey = JSON.stringify([
    withAo,
    withBloom,
    withVignette,
    withFxaa,
    toneMapping,
  ]);

  const { rebuild } = useRenderPipeline(
    // Assemble the chain.
    ({ renderPipeline, renderer, camera, passes: { scenePass } }) => {
      // The passes from the previous build stay alive until the new graph is
      // complete, then go. Fiber keeps the old output node if this throws.
      const retiredAo = aoPassRef.current;
      const retiredBloom = bloomPassRef.current;

      const beauty = scenePass.getTextureNode("output");
      // Every stage takes and gives a vec4. The texture is only the first.
      let graph: Node<"vec4"> = beauty;

      if (withAo) {
        const aoPass = ao(
          scenePass.getTextureNode("depth"),
          scenePass.getTextureNode("normal"),
          camera,
        );
        aoPass.radius.value = aoRadius;
        aoPassRef.current = aoPass;
        // The AO texture is a single channel. Darken the colour, keep alpha.
        graph = graph.mul(vec4(vec3(aoPass.getTextureNode().r), 1));
      } else {
        aoPassRef.current = null;
      }

      if (withBloom) {
        // Bloom reads only the emissive attachment, so only lights glow.
        const bloomPass = bloom(
          scenePass.getTextureNode("emissive"),
          bloomStrength,
          0.4,
          0.1,
        );
        bloomPassRef.current = bloomPass;
        graph = graph.add(bloomPass);
      } else {
        bloomPassRef.current = null;
      }

      if (withVignette) {
        const input = graph;
        graph = Fn(() => {
          // Distance from the screen centre, 0 there and about 0.7 in the
          // corners. The ramp starts well outside the subject.
          const fromCentre = uv().sub(0.5).length();
          const shade = smoothstep(0.35, 0.85, fromCentre).mul(
            knobs.vignetteStrength,
          );
          return vec4(input.rgb.mul(shade.oneMinus()), input.a);
        })();
      }

      // The tone map is read from the renderer when the output node is
      // built, which is why the select rebuilds. Exposure is a renderer
      // uniform the node reads every frame.
      renderer.toneMapping =
        TONE_MAPPINGS[toneMapping as keyof typeof TONE_MAPPINGS];
      renderPipeline.outputColorTransform = false;
      // The pass renders without MSAA so AO can sample its depth. FXAA is
      // the cheap replacement: one screen space pass over the display
      // values, so it goes after the tone map.
      renderPipeline.outputNode = withFxaa
        ? fxaa(renderOutput(graph))
        : renderOutput(graph);
      // The presentation material has a new output node: say so.
      renderPipeline.needsUpdate = true;

      retiredAo?.dispose();
      retiredBloom?.dispose();
      builtKeyRef.current = wantedKey;
    },
    // Ask the scene pass for what the passes read.
    ({ passes: { scenePass } }) => {
      scenePass.setMRT(mrt({ output, normal: normalView, emissive }));
    },
  );

  // Structural change: rebuild the graph.
  useEffect(() => {
    if (builtKeyRef.current !== null && builtKeyRef.current !== wantedKey)
      rebuild();
  }, [wantedKey, rebuild]);

  // Live values: write into the passes that exist.
  useEffect(() => {
    if (aoPassRef.current) aoPassRef.current.radius.value = aoRadius;
  }, [aoRadius, withAo]);
  useEffect(() => {
    if (bloomPassRef.current)
      bloomPassRef.current.strength.value = bloomStrength;
  }, [bloomStrength, withBloom]);

  // Exposure is a plain renderer field the output node reads every frame.
  // No graph, no rebuild.
  const renderer = useThree((state) => state.renderer);
  useEffect(() => {
    renderer.toneMappingExposure = exposure;
  }, [renderer, exposure]);

  return null;
}

export function PostPipeline() {
  return (
    <div className="absolute inset-0">
      <Canvas
        shadows
        camera={{ position: STAGE_CAMERA, fov: 40 }}
        dpr={[1, 2]}
        renderer={{
          // AO samples the pass's depth, and a multisampled depth attachment
          // cannot be sampled, so the pass renders without MSAA.
          antialias: false,
          toneMapping: ACESFilmicToneMapping,
          outputColorSpace: SRGBColorSpace,
        }}
      >
        <Stage>
          <Tower />
          {/* Something bright for the bloom beyond the tower's faint glow. */}
          <mesh position={[1.9, 0.3, 1.3]} castShadow>
            <sphereGeometry args={[0.3, 32, 32]} />
            <meshStandardNodeMaterial
              color="#000000"
              emissive="#ff7a1a"
              emissiveIntensity={2.5}
            />
          </mesh>
          <Pipeline />
        </Stage>
      </Canvas>
    </div>
  );
}
