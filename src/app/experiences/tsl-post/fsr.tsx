"use client";

import { useEffect, useRef } from "react";
import {
  ACESFilmicToneMapping,
  MathUtils,
  SRGBColorSpace,
  Vector2,
  type Group,
  type Mesh,
} from "three/webgpu";
import { mrt, output, velocity } from "three/tsl";
import {
  Canvas,
  useFrame,
  useRenderPipeline,
  useThree,
} from "@react-three/fiber/webgpu";
import type { CameraControlsImpl } from "@react-three/drei";
import {
  DebugView,
  getQualityModeRatio,
  QualityMode,
  upscale,
  type UpscalePath,
  type UpscalerNode,
} from "@pmndrs/upscaler";
import { useControls } from "leva";

import { Stage, STAGE_CAMERA } from "@/app/experiences/stage";

import { Tower } from "./tower";

/**
 * TSL post, five of five: fsr.
 *
 * The scene pass renders small and the upscaler makes it big. The temporal
 * path is the real thing: each frame the camera is nudged by a fraction of a
 * pixel, so successive frames sample different spots, and the upscaler
 * reprojects the previous frames onto this one using depth and the velocity
 * attachment to find where every pixel was. Where the history cannot be
 * trusted, a surface just uncovered or a shading change, it is thrown away
 * and rebuilt. The debug views show each of those buffers.
 *
 * The scene moves so there is motion to see: the pedestal turns, a chrome
 * sphere orbits the tower, and the camera drifts.
 *
 * Quality and path are how the pass is built, so they rebuild. Sharpness and
 * the debug view are runtime settings on the upscaler, written every frame.
 */

const QUALITIES = {
  "native AA": QualityMode.NativeAA,
  quality: QualityMode.Quality,
  balanced: QualityMode.Balanced,
  performance: QualityMode.Performance,
  "ultra performance": QualityMode.UltraPerformance,
};

const DEBUG_VIEWS = {
  none: DebugView.None,
  "motion vectors": DebugView.MotionVectors,
  disocclusion: DebugView.Disocclusion,
  depth: DebugView.Depth,
  "accumulation age": DebugView.AccumulationAge,
  locks: DebugView.Locks,
  exposure: DebugView.Exposure,
};

function Fsr({ readoutRef }: { readoutRef: React.RefObject<HTMLDivElement | null> }) {
  const { enabled, quality, path, sharpness, debugView } = useControls(
    "tsl post · fsr",
    {
      // Adds or removes the pass, so it rebuilds.
      enabled: true,
      // Sizes the scene pass. A different render target, so it rebuilds.
      quality: { value: QualityMode.Quality, options: QUALITIES },
      // A construction option of the pass, so it rebuilds.
      path: {
        value: "temporal" as UpscalePath,
        options: ["bilinear", "spatial", "temporal"] as UpscalePath[],
      },
      // Runtime settings on the upscaler. Written every frame.
      sharpness: { value: 0.5, min: 0, max: 1, step: 0.01 },
      debugView: { value: DebugView.None, options: DEBUG_VIEWS },
    },
  );

  const renderer = useThree((state) => state.renderer);

  const nodeRef = useRef<UpscalerNode | null>(null);
  const velocityBoundRef = useRef(false);
  const sizeRef = useRef(new Vector2());

  const builtKeyRef = useRef<string | null>(null);
  const wantedKey = JSON.stringify([enabled, quality, path]);

  const { rebuild } = useRenderPipeline(
    // Hand the small render to the upscaler.
    ({ renderPipeline, camera, passes: { scenePass } }) => {
      // The previous pass stays alive until the new graph is complete.
      const retired = nodeRef.current;

      const color = scenePass.getTextureNode("output");
      if (enabled) {
        // The pass takes the render sized inputs and produces display
        // sized output. Jitter is the temporal path's business only.
        // `upscale` is typed as a generic node object. Its instance is the
        // UpscalerNode, which owns the upscaler the settings live on.
        const node = upscale(
          color,
          scenePass.getTextureNode("depth"),
          scenePass.getTextureNode("velocity"),
          camera,
          { path, jitter: path === "temporal" },
        ) as unknown as UpscalerNode;
        nodeRef.current = node;
        velocityBoundRef.current = false;
        renderPipeline.outputNode = node;
      } else {
        nodeRef.current = null;
        renderPipeline.outputNode = color;
      }
      // The presentation material has a new output node: say so.
      renderPipeline.needsUpdate = true;

      retired?.dispose();
      builtKeyRef.current = wantedKey;
    },
    // Render small, with motion vectors.
    ({ passes: { scenePass } }) => {
      const ratio = enabled ? getQualityModeRatio(quality) : 1;
      scenePass.setResolutionScale(1 / ratio);
      // Velocity is where each pixel was last frame, in screen space.
      scenePass.setMRT(mrt({ output, velocity }));
    },
  );

  // Structural change: rebuild the graph.
  useEffect(() => {
    if (builtKeyRef.current !== null && builtKeyRef.current !== wantedKey)
      rebuild();
  }, [wantedKey, rebuild]);

  useFrame(() => {
    // The upscaler exists once the pass has been set up on the GPU.
    const upscaler = nodeRef.current?.upscaler ?? null;
    if (upscaler) {
      upscaler.settings.sharpness = sharpness;
      upscaler.settings.debugView = debugView;
      // Motion vectors must be free of the jitter, so the velocity node gets
      // the unjittered projection. The matrix instance is stable and the
      // upscaler updates its contents every frame.
      if (!velocityBoundRef.current) {
        velocity.setProjectionMatrix(upscaler.unjitteredProjectionMatrix);
        velocityBoundRef.current = true;
      }
    } else if (velocityBoundRef.current) {
      velocity.setProjectionMatrix(null);
      velocityBoundRef.current = false;
    }

    if (!readoutRef.current) return;
    const size = renderer.getDrawingBufferSize(sizeRef.current);
    const text = upscaler
      ? `render ${upscaler.renderWidth} × ${upscaler.renderHeight} → display ${upscaler.displayWidth} × ${upscaler.displayHeight} · ${upscaler.upscaleRatio.toFixed(2)}×`
      : `render ${size.x} × ${size.y} = display`;
    if (readoutRef.current.textContent !== text)
      readoutRef.current.textContent = text;
  });

  return null;
}

/** The pedestal turns, a chrome sphere orbits, and the camera drifts. */
function Motion() {
  const pedestalRef = useRef<Group>(null);
  const sphereRef = useRef<Mesh>(null);
  const controls = useThree((state) => state.controls) as CameraControlsImpl | null;

  useFrame(({ delta, elapsed }) => {
    if (pedestalRef.current) pedestalRef.current.rotation.y += delta * 0.15;
    if (sphereRef.current) {
      const angle = elapsed * 0.6;
      sphereRef.current.position.set(
        Math.cos(angle) * 2.2,
        1.3 + Math.sin(elapsed * 1.3) * 0.3,
        Math.sin(angle) * 2.2,
      );
    }
    // drei's CameraControls has no autoRotate, so nudge it here.
    controls?.rotate(MathUtils.degToRad(6) * delta, 0, false);
  });

  return (
    <>
      <group ref={pedestalRef}>
        <Tower />
      </group>
      <mesh ref={sphereRef} castShadow>
        <sphereGeometry args={[0.35, 48, 48]} />
        <meshStandardNodeMaterial color="#ffffff" metalness={1} roughness={0.05} />
      </mesh>
    </>
  );
}

export function PostFsr() {
  const readoutRef = useRef<HTMLDivElement>(null);

  return (
    <div className="absolute inset-0">
      <Canvas
        shadows
        camera={{ position: STAGE_CAMERA, fov: 40 }}
        dpr={[1, 2]}
        renderer={{
          // The upscaler is the anti aliasing, and it samples the pass's
          // depth, which a multisampled attachment cannot provide.
          antialias: false,
          toneMapping: ACESFilmicToneMapping,
          outputColorSpace: SRGBColorSpace,
        }}
      >
        <Stage>
          <Motion />
          <Fsr readoutRef={readoutRef} />
        </Stage>
      </Canvas>

      {/* Render resolution against display resolution, from the frame loop. */}
      <div
        ref={readoutRef}
        className="pointer-events-none absolute bottom-5 left-5 rounded-md bg-black/50 px-3 py-2 font-mono text-[11px] text-white/80"
      />
    </div>
  );
}
