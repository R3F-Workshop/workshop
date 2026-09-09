"use client";

import {
  ACESFilmicToneMapping,
  SRGBColorSpace,
} from "three/webgpu";
import {
  emissive,
  Fn,
  mrt,
  normalView,
  output,
  renderOutput,
  select,
  uv,
  vec3,
  vec4,
} from "three/tsl";
import { fxaa } from "three/examples/jsm/tsl/display/FXAANode.js";
import {
  Canvas,
  useRenderPipeline,
  useUniforms,
} from "@react-three/fiber/webgpu";
import { useControls } from "leva";

import { Stage, STAGE_CAMERA } from "@/app/experiences/stage";

import { Tower } from "./tower";

/**
 * TSL post, one of five: outputs.
 *
 * Nothing is processed yet. The point is what a scene pass can hand a post
 * graph. The setup callback asks the pass for more than colour: a normal and
 * an emissive attachment, through MRT. The main callback reads them back as
 * texture nodes, plus depth, which every pass keeps, and shows one of them.
 *
 * Which one is a GPU decision, not a JavaScript one. `view` is a uniform and
 * the pick is a `select` chain, so the Leva select changes a number and the
 * pipeline is never rebuilt. A JavaScript `if` here would run once, when the
 * graph is built, and choosing again would mean building again.
 */

/** The names in the Leva select, in the order the uniform counts them. */
const VIEWS = ["beauty", "normal", "depth", "emissive", "uv"] as const;

function Outputs() {
  // Both controls write uniforms. Neither rebuilds the pipeline. Leva widens
  // the select's value to string, so the index lookup narrows it back.
  const { view, depthRange } = useControls("tsl post · outputs", {
    view: { value: "beauty", options: [...VIEWS] },
    depthRange: { value: 14, min: 2, max: 30, step: 0.5 },
  });
  const knobs = useUniforms(
    { view: VIEWS.indexOf(view as (typeof VIEWS)[number]), depthRange },
    "tslPostOutputs",
  );

  useRenderPipeline(
    // Read the attachments back and pick one.
    ({ renderPipeline, passes: { scenePass } }) => {
      const beauty = scenePass.getTextureNode("output");
      const normal = scenePass.getTextureNode("normal");
      const glow = scenePass.getTextureNode("emissive");
      // Distance along the view axis, negative in front of the camera.
      const viewZ = scenePass.getViewZNode();

      const picked = Fn(() => {
        // View space normals are in -1..1. Remap so they read as colour.
        const normalColor = vec4(normal.rgb.mul(0.5).add(0.5), 1);
        // Near is white, depthRange and beyond is black.
        const depthColor = vec4(
          vec3(viewZ.negate().div(knobs.depthRange).clamp(0, 1).oneMinus()),
          1,
        );
        const uvColor = vec4(uv(), 0, 1);
        // Only the beauty goes through tone mapping and the colour space
        // transform. The data views are shown as the numbers they are.
        const beautyColor = renderOutput(beauty);

        const v = knobs.view;
        return select(
          v.equal(1),
          normalColor,
          select(
            v.equal(2),
            depthColor,
            select(v.equal(3), glow, select(v.equal(4), uvColor, beautyColor)),
          ),
        );
      });

      // The pipeline would otherwise wrap the output in its own renderOutput.
      renderPipeline.outputColorTransform = false;
      // The pass renders without MSAA (see the Canvas), so the edges are
      // smoothed afterwards. FXAA is one screen space pass over the final
      // image, and it works on display values, which is why it comes last.
      renderPipeline.outputNode = fxaa(picked());
      // The presentation material has a new output node: say so.
      renderPipeline.needsUpdate = true;
    },
    // Ask the scene pass for the extra attachments.
    ({ passes: { scenePass } }) => {
      scenePass.setMRT(mrt({ output, normal: normalView, emissive }));
    },
  );

  return null;
}

export function PostOutputs() {
  return (
    <div className="absolute inset-0">
      <Canvas
        shadows
        camera={{ position: STAGE_CAMERA, fov: 40 }}
        dpr={[1, 2]}
        renderer={{
          // The post graph samples the pass's depth, and a multisampled depth
          // attachment cannot be sampled, so the pass renders without MSAA.
          antialias: false,
          toneMapping: ACESFilmicToneMapping,
          outputColorSpace: SRGBColorSpace,
        }}
      >
        <Stage>
          <Tower />
          {/* Something bright for the emissive attachment beyond the tower's
              faint glow. */}
          <mesh position={[1.9, 0.3, 1.3]} castShadow>
            <sphereGeometry args={[0.3, 32, 32]} />
            <meshStandardNodeMaterial
              color="#000000"
              emissive="#ff7a1a"
              emissiveIntensity={2.5}
            />
          </mesh>
          <Outputs />
        </Stage>
      </Canvas>
    </div>
  );
}
