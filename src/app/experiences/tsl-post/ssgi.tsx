"use client";

import { useEffect, useRef } from "react";
import {
  ACESFilmicToneMapping,
  DoubleSide,
  SRGBColorSpace,
  type Node,
  type PerspectiveCamera,
} from "three/webgpu";
import {
  diffuseColor,
  mix,
  mrt,
  normalView,
  output,
  vec4,
  velocity,
} from "three/tsl";
import { denoise } from "three/examples/jsm/tsl/display/DenoiseNode.js";
import { ssgi } from "three/examples/jsm/tsl/display/SSGINode.js";
import { traa } from "three/examples/jsm/tsl/display/TRAANode.js";
import {
  Canvas,
  useRenderPipeline,
  useUniforms,
} from "@react-three/fiber/webgpu";
import { useControls } from "leva";

import { Stage, STAGE_CAMERA } from "@/app/experiences/stage";

import { Tower } from "./tower";

/**
 * TSL post, three of five: ssgi.
 *
 * Screen space global illumination. The pass looks along the scene's depth
 * and normals from each pixel, finds the surfaces nearby on screen, and
 * gathers their colour as bounced light, with an occlusion term from the same
 * walk. It only knows what is on screen, which is both the trick and the
 * limit. The result is noisy per pixel, so a denoiser follows it, again
 * guided by depth and normals so it blurs across a surface and not over an
 * edge.
 *
 * The room gets a red wall and a blue wall, and two glowing slabs on the
 * floor, so the bounce has colour to carry. `enabled` removes both passes
 * and rebuilds, for the comparison. Everything else is a uniform the pass
 * owns, or one of ours, and writes live.
 */

function Ssgi() {
  const {
    enabled,
    giIntensity,
    aoIntensity,
    radius,
    sliceCount,
    stepCount,
    temporal,
    showGI,
  } = useControls("tsl post · ssgi", {
    // Adds or removes the passes, so it rebuilds.
    enabled: true,
    // Pass uniforms. Written live.
    giIntensity: { value: 8, min: 0, max: 30, step: 0.1 },
    aoIntensity: { value: 1.5, min: 0, max: 4, step: 0.05 },
    radius: { value: 6, min: 0.5, max: 24, step: 0.1 },
    sliceCount: { value: 3, min: 1, max: 6, step: 1 },
    stepCount: { value: 10, min: 2, max: 24, step: 1 },
    // Rotates the sample pattern every frame for the temporal resolver at
    // the end of the chain to average out. Off, the pattern is fixed and
    // the noise sits still. A plain field on the pass, written live.
    temporal: true,
    // A uniform in the composite, so it never rebuilds.
    showGI: false,
  });
  const knobs = useUniforms(
    { showGI: showGI ? 1 : 0 },
    "tslPostSsgi",
  );

  const giPassRef = useRef<ReturnType<typeof ssgi> | null>(null);
  const denoisePassRef = useRef<ReturnType<typeof denoise> | null>(null);
  const traaPassRef = useRef<ReturnType<typeof traa> | null>(null);

  const builtRef = useRef<boolean | null>(null);

  const { rebuild } = useRenderPipeline(
    // Gather, denoise, composite.
    ({ renderPipeline, camera, passes: { scenePass } }) => {
      // Last build's passes stay alive until the new graph is complete.
      const retiredGi = giPassRef.current;
      const retiredDenoise = denoisePassRef.current;
      const retiredTraa = traaPassRef.current;

      const color = scenePass.getTextureNode("output");
      const depth = scenePass.getTextureNode("depth");
      const normal = scenePass.getTextureNode("normal");
      // Every stage takes and gives a vec4. The composite lands here.
      let composite: Node<"vec4"> = color;

      if (!enabled) {
        giPassRef.current = null;
        denoisePassRef.current = null;
      } else {
        // The unlit surface colour, so bounced light is tinted by what it
        // lands on rather than by the lighting already there.
        const albedo = scenePass.getTextureNode("diffuse");

        // The Canvas camera is a PerspectiveCamera. The state types it as
        // the base class, and the pass needs the projection fields.
        const giPass = ssgi(color, depth, normal, camera as PerspectiveCamera);
        giPass.giIntensity.value = giIntensity;
        giPass.aoIntensity.value = aoIntensity;
        giPass.radius.value = radius;
        giPass.sliceCount.value = sliceCount;
        giPass.stepCount.value = stepCount;
        giPass.useTemporalFiltering = temporal;
        giPassRef.current = giPass;

        const denoisePass = denoise(
          giPass.getGINode(),
          depth,
          normal,
          camera as PerspectiveCamera,
        );
        denoisePassRef.current = denoisePass;
        // The typings declare DenoiseNode as a bare TempNode, which has no
        // swizzles. It produces a vec4.
        const gi = denoisePass as unknown as Node<"vec4">;

        // Direct light darkened by the occlusion, plus the bounce on albedo.
        const lit = color.rgb.mul(giPass.getAONode().r).add(albedo.rgb.mul(gi.rgb));
        composite = mix(vec4(lit, color.a), vec4(gi.rgb, 1), knobs.showGI);
      }

      // The pass renders without MSAA so the passes can sample its depth.
      // Temporal reprojection anti-aliasing takes over: it jitters the
      // camera a fraction of a pixel each frame, uses the velocity
      // attachment to find where each pixel was last frame, and averages the
      // history in. The same averaging is what settles the rotating SSGI
      // sample pattern, so the two belong together. It runs in both branches
      // so the enabled toggle compares only the GI.
      const traaPass = traa(
        composite,
        depth,
        scenePass.getTextureNode("velocity"),
        camera as PerspectiveCamera,
      );
      traaPassRef.current = traaPass;
      renderPipeline.outputNode = traaPass;

      // The presentation material has a new output node: say so.
      renderPipeline.needsUpdate = true;

      retiredGi?.dispose();
      retiredDenoise?.dispose();
      retiredTraa?.dispose();
      builtRef.current = enabled;
    },
    // What the passes read from the scene pass.
    ({ passes: { scenePass } }) => {
      scenePass.setMRT(
        mrt({ output, normal: normalView, diffuse: diffuseColor, velocity }),
      );
    },
  );

  // Structural change: rebuild the graph.
  useEffect(() => {
    if (builtRef.current !== null && builtRef.current !== enabled) rebuild();
  }, [enabled, rebuild]);

  // Live values: write into the pass that exists.
  useEffect(() => {
    const giPass = giPassRef.current;
    if (!giPass) return;
    giPass.giIntensity.value = giIntensity;
    giPass.aoIntensity.value = aoIntensity;
    giPass.radius.value = radius;
    giPass.sliceCount.value = sliceCount;
    giPass.stepCount.value = stepCount;
    giPass.useTemporalFiltering = temporal;
  }, [
    enabled,
    giIntensity,
    aoIntensity,
    radius,
    sliceCount,
    stepCount,
    temporal,
  ]);

  return null;
}

export function PostSsgi() {
  return (
    <div className="absolute inset-0">
      <Canvas
        shadows
        camera={{ position: STAGE_CAMERA, fov: 40 }}
        dpr={[1, 2]}
        renderer={{
          // SSGI samples the pass's depth, and a multisampled depth
          // attachment cannot be sampled, so the pass renders without MSAA.
          antialias: false,
          toneMapping: ACESFilmicToneMapping,
          outputColorSpace: SRGBColorSpace,
        }}
      >
        <Stage>
          <Tower />

          {/* Coloured walls either side of the tower. Free standing, so they
              are close enough to bounce onto it. */}
          <mesh position={[-2.6, 1.5, -0.5]} rotation-y={Math.PI / 2} receiveShadow>
            <planeGeometry args={[5, 3]} />
            <meshStandardNodeMaterial color="#c8322a" roughness={0.9} side={DoubleSide} />
          </mesh>
          <mesh position={[2.6, 1.5, -0.5]} rotation-y={-Math.PI / 2} receiveShadow>
            <planeGeometry args={[5, 3]} />
            <meshStandardNodeMaterial color="#2a55c8" roughness={0.9} side={DoubleSide} />
          </mesh>

          {/* Two lit slabs on the floor. Emissive surfaces are what screen
              space GI bounces best, because they are bright on screen. */}
          <mesh position={[-1.3, 0.05, 1.5]}>
            <boxGeometry args={[1.2, 0.1, 0.5]} />
            <meshStandardNodeMaterial color="#000000" emissive="#ffb070" emissiveIntensity={5} />
          </mesh>
          <mesh position={[1.4, 0.05, 1.4]}>
            <boxGeometry args={[1.2, 0.1, 0.5]} />
            <meshStandardNodeMaterial color="#000000" emissive="#70a0ff" emissiveIntensity={5} />
          </mesh>

          <Ssgi />
        </Stage>
      </Canvas>
    </div>
  );
}
