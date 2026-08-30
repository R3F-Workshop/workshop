"use client";

import { useEffect, useRef } from "react";
import {
  useFrame,
  useRenderPipeline,
  useUniforms,
} from "@react-three/fiber/webgpu";
import { upscale } from "@pmndrs/upscaler";
import { useSky } from "@pmndrs/sky/react";
import { bloom } from "three/examples/jsm/tsl/display/BloomNode.js";
import { denoise } from "three/examples/jsm/tsl/display/DenoiseNode.js";
import { ssgi } from "three/examples/jsm/tsl/display/SSGINode.js";
import { traa } from "three/examples/jsm/tsl/display/TRAANode.js";
import * as TSL from "three/tsl";
import * as THREE from "three/webgpu";

import { ssao } from "./ssao-node.js";

/** Runtime controls exposed by the vendored SSAO node. */
interface SSAOPass {
  radius: { value: number };
  sliceCount: { value: number };
  stepCount: { value: number };
  aoIntensity: { value: number };
  useScreenSpaceSampling: { value: boolean };
  useLinearThickness: { value: boolean };
  useTemporalFiltering: boolean;
  getAONode(): { r: unknown };
}

/** Runtime controls exposed by the SSGI node. */
interface SSGIPass {
  sliceCount: { value: number };
  stepCount: { value: number };
  radius: { value: number };
  giIntensity: { value: number };
  aoIntensity: { value: number };
  useTemporalFiltering: boolean;
  getAONode(): { r: unknown };
  getGINode(): unknown;
}

/** Bloom texture accessor. */
interface BloomPass {
  getTextureNode(): THREE.TextureNode;
}

/** FSR3 fields used for motion vectors and cleanup. */
interface FSRNodeLike {
  upscaler: { unjitteredProjectionMatrix: THREE.Matrix4 } | null;
  dispose(): void;
}

/** Sky texture used to color the fog. */
interface SkyWithBaker {
  baker?: { texture?: THREE.CubeTexture };
}

/**
 * Full-resolution lettering pass. Glyphs and tower depth share the scene,
 * while the camera mirrors the main camera without temporal jitter.
 */
export interface TextLayer {
  scene: THREE.Scene;
  camera: THREE.PerspectiveCamera;
}

/** TSL node shapes used at graph helper boundaries. */
type AnyFloat = ReturnType<typeof TSL.float>;
type AnyVec3 = ReturnType<typeof TSL.vec3>;
type AnyVec4 = ReturnType<typeof TSL.vec4>;

function makeFogCameraUniforms() {
  return {
    invProj: TSL.uniform(new THREE.Matrix4()),
    camWorld: TSL.uniform(new THREE.Matrix4()),
    camPos: TSL.uniform(new THREE.Vector3()),
  };
}

/** Fog uniforms consumed by the render graph. */
type FogKnobs = Record<
  "density" | "heightFalloff" | "horizonClamp",
  THREE.UniformNode<"float", number>
>;

/** Post-processing options for the tower scene render graph. */
export interface FXOptions {
  enabled?: boolean;
  ao?: boolean;
  bloom?: boolean;
  /** Adds sky aerial perspective to the graph. */
  haze?: boolean;
  hazeStrength?: number;
  hazePolicy?: string;
  /** Adds exponential height fog colored by the baked sky cube. */
  skyFog?: boolean;
  /** Fog extinction per kilometer of world units. */
  skyFogDensity?: number;
  /** Altitude falloff scale in world units. */
  skyFogHeight?: number;
  /** Clamps downward sky samples to the illuminated horizon. */
  skyFogHorizonClamp?: boolean;
  /** Uses FSR3 as the temporal resolver. TRAA runs when disabled. */
  fsr?: boolean;
  /** FSR3 upscale ratio (1 = native AA, 1.5 = Quality, 1.7 = Balanced). */
  renderScale?: number;
  /** Uses spatially denoised SSGI for indirect light and ambient occlusion. */
  ssgi?: boolean;
  ssgiIntensity?: number;
  ssgiAoIntensity?: number;
  ssgiSlices?: number;
  ssgiSteps?: number;
  ssgiRadius?: number;
  /** Full-resolution lettering pass. */
  textLayer: TextLayer;
  /** Includes the lettering pass in the graph. */
  textEnabled?: boolean;
  /** How strongly the tower bloom lights the lettering. */
  textGlow?: number;
}

export function FX({
  enabled = true,
  ao = true,
  bloom: withBloom = true,
  haze = false,
  hazeStrength = 1,
  hazePolicy = "auto",
  skyFog = false,
  skyFogDensity = 0.3,
  skyFogHeight = 300,
  skyFogHorizonClamp = true,
  fsr = true,
  renderScale = 1.5,
  ssgi: withSSGI = false,
  ssgiIntensity = 10,
  ssgiAoIntensity = 2,
  ssgiSlices = 2,
  ssgiSteps = 8,
  ssgiRadius = 12,
  textLayer,
  textEnabled = true,
  textGlow = 1,
}: FXOptions) {
  const sky = useSky();

  const useFsr = fsr;
  const useSsgi = withSSGI;
  // SSGI provides its own ambient occlusion.
  const useGtao = ao && !useSsgi;
  const useSkyFog = skyFog && Boolean(sky);

  /** Tracks the unjittered projection used for FSR3 motion vectors. */
  const fsrNodeRef = useRef<FSRNodeLike | null>(null);
  const velocityBoundRef = useRef(false);

  /** Lettering pass reused across render graph rebuilds. */
  const textPassRef = useRef<ReturnType<typeof TSL.pass> | null>(null);

  // `useRenderPipeline` deliberately keeps its pipeline alive across component
  // cleanup (including Fast Refresh), so disposing these refs from a React
  // cleanup would leave that live pipeline pointing at destroyed GPU resources.
  // Rebuilds retire them transactionally in the pipeline callback below; a
  // real Canvas teardown releases the renderer/device that owns the remainder.

  /** Active SSGI pass whose tuning values are runtime uniforms. */
  const ssgiPassRef = useRef<SSGIPass | null>(null);

  /** Stable fog uniforms shared with the render graph. */
  const fogKnobs = useUniforms(
    {
      density: skyFogDensity,
      heightFalloff: skyFogHeight,
      // Use a uniform so this toggle does not rebuild the graph.
      horizonClamp: skyFogHorizonClamp ? 1 : 0,
    },
    "heroFog",
  ) as unknown as FogKnobs;

  /** Lettering response to the tower bloom, tunable without a rebuild. */
  const glowKnobs = useUniforms(
    { textGlow },
    "heroTextGlow",
  ) as unknown as Record<"textGlow", THREE.UniformNode<"float", number>>;

  /** Main camera uniforms for ray reconstruction in the output pass. */
  const fogCamRef = useRef<ReturnType<typeof makeFogCameraUniforms> | null>(
    null,
  );
  if (fogCamRef.current === null) {
    fogCamRef.current = makeFogCameraUniforms();
  }
  const fogCam = fogCamRef.current;
  useUniforms(() => fogCam, "heroFogCamera");

  /** Sky instance and option key used by the active render graph. */
  const builtSkyRef = useRef<unknown>(null);
  const builtKeyRef = useRef<string | null>(null);
  const wantedKey = JSON.stringify([
    enabled,
    useGtao,
    withBloom,
    haze && Boolean(sky),
    hazePolicy,
    useSkyFog,
    useFsr,
    useFsr ? renderScale : 1,
    useSsgi,
    textEnabled,
  ]);

  useEffect(() => {
    if (!sky) return;
    sky.setHazeStrength(hazeStrength);
    sky.setHazePolicy(hazePolicy);
  }, [sky, hazeStrength, hazePolicy]);

  useEffect(() => {
    const pass = ssgiPassRef.current;
    if (!pass) return;
    pass.sliceCount.value = ssgiSlices;
    pass.stepCount.value = ssgiSteps;
    pass.radius.value = ssgiRadius;
    pass.giIntensity.value = ssgiIntensity;
    pass.aoIntensity.value = ssgiAoIntensity;
  }, [ssgiSlices, ssgiSteps, ssgiRadius, ssgiIntensity, ssgiAoIntensity]);

  useFrame(({ camera }) => {
    // Output nodes need explicit main camera uniforms for fog rays.
    if (useSkyFog) {
      fogCam.invProj.value.copy(camera.projectionMatrixInverse);
      fogCam.camWorld.value.copy(camera.matrixWorld);
      fogCam.camPos.value.setFromMatrixPosition(camera.matrixWorld);
    }

    // Keep the full-resolution text camera free of temporal jitter.
    const source = camera as THREE.PerspectiveCamera;
    if (source.isPerspectiveCamera) {
      const textCamera = textLayer.camera;
      source.matrixWorld.decompose(
        textCamera.position,
        textCamera.quaternion,
        textCamera.scale,
      );
      textCamera.fov = source.fov;
      textCamera.aspect = source.aspect;
      textCamera.near = source.near;
      textCamera.far = source.far;
      textCamera.updateProjectionMatrix();
    }

    // Bind the unjittered projection after the FSR3 upscaler initializes.
    if (useFsr) {
      const upscaler = fsrNodeRef.current?.upscaler;
      if (!velocityBoundRef.current && upscaler) {
        (
          TSL.velocity as unknown as {
            setProjectionMatrix(m: THREE.Matrix4 | null): void;
          }
        ).setProjectionMatrix(upscaler.unjitteredProjectionMatrix);
        velocityBoundRef.current = true;
      }
    } else if (velocityBoundRef.current) {
      (
        TSL.velocity as unknown as {
          setProjectionMatrix(m: THREE.Matrix4 | null): void;
        }
      ).setProjectionMatrix(null);
      velocityBoundRef.current = false;
    }
  });

  const { rebuild } = useRenderPipeline(
    // Build the effect graph and return its output node.
    ({ renderPipeline, passes, camera }) => {
      if (!renderPipeline || !passes?.scenePass) return;
      const scenePass = passes.scenePass;

      // Keep the active graph alive until its replacement is fully assembled.
      // If anything below throws, fiber retains the previous outputNode, so its
      // resources must remain valid too.
      const retiredFsrNode = fsrNodeRef.current;
      let nextFsrNode: FSRNodeLike | null = null;

      // Render glyph color and tower occlusion depth at display resolution.
      const previousTextPass = textPassRef.current;
      const textPass = textEnabled
        ? (previousTextPass ?? TSL.pass(textLayer.scene, textLayer.camera))
        : null;
      const retiredTextPass = textEnabled ? null : previousTextPass;
      const textTex = textPass?.getTextureNode("output");
      // Reuse authored glyph depth when applying fog to visible text pixels.
      const textDepth = textPass
        ? TSL.abs(textPass.getViewZNode())
        : null;

      /** Commits graph ownership, then releases resources no longer reachable. */
      const commitResources = () => {
        fsrNodeRef.current = nextFsrNode;
        textPassRef.current = textPass;
        retiredFsrNode?.dispose();
        retiredTextPass?.dispose();
      };

      /** Composites premultiplied text after depth occlusion is resolved. */
      const overlayText = textTex
        ? (baseNode: unknown, textRgbNode: unknown) => {
            const base = baseNode as AnyVec4;
            const covered = textTex.a;
            const rgb = base.rgb
              .mul(TSL.oneMinus(covered))
              .add(textRgbNode as AnyVec3) as unknown as AnyVec3;
            return TSL.vec4(rgb, TSL.max(base.a, covered));
          }
        : null;

      if (!enabled) {
        // Preserve lettering when post processing is disabled.
        const base = scenePass.getTextureNode("output");
        renderPipeline.outputNode =
          overlayText && textTex
            ? TSL.Fn(() => overlayText(base, textTex.rgb))()
            : base;
        // Mark the presentation material dirty after replacing its output node.
        renderPipeline.needsUpdate = true;
        commitResources();
        builtKeyRef.current = wantedKey;
        builtSkyRef.current = sky;
        return;
      }

      const color = scenePass.getTextureNode("output");
      const depth = scenePass.getTextureNode("depth");

      let graph = color;

      /** Tower bloom, reused as the light the lettering responds to. */
      let bloomTex: AnyVec4 | null = null;

      if (withBloom) {
        const emissive = scenePass.getTextureNode("emissive");
        const bloomPass = bloom(emissive, 0.5, 0.5);
        // Reuse the result texture without running bloom again.
        bloomTex = (
          bloomPass as unknown as BloomPass
        ).getTextureNode() as unknown as AnyVec4;
        graph = graph.add(bloomPass);
      }

      // Unpack byte-encoded normals through a shared sampling node.
      const sceneNormal =
        useGtao || useSsgi
          ? TSL.sample((uv: unknown) =>
              TSL.unpackRGBToNormal(
                scenePass.getTextureNode("normal").sample(uv),
              ),
            )
          : null;

      if (useSsgi && sceneNormal) {
        // Composite spatially denoised GI and AO at scene render resolution.
        const giPass = ssgi(
          color,
          depth,
          sceneNormal,
          camera as THREE.PerspectiveCamera,
        ) as unknown as SSGIPass;
        giPass.sliceCount.value = ssgiSlices;
        giPass.stepCount.value = ssgiSteps;
        giPass.radius.value = ssgiRadius;
        giPass.giIntensity.value = ssgiIntensity;
        giPass.aoIntensity.value = ssgiAoIntensity;
        giPass.useTemporalFiltering = false;
        ssgiPassRef.current = giPass;

        const gi = denoise(
          giPass.getGINode() as unknown as THREE.Node,
          depth,
          sceneNormal,
          camera as THREE.PerspectiveCamera,
        ) as unknown as { rgb: unknown };
        const albedo = scenePass.getTextureNode("diffuse");
        graph = TSL.vec4(
          graph.rgb.mul(giPass.getAONode().r).add(albedo.rgb.mul(gi.rgb)),
          graph.a,
        );
      }

      if (!useSsgi) ssgiPassRef.current = null;

      if (useGtao && sceneNormal) {
        const aoPass = ssao(
          depth,
          sceneNormal,
          camera as THREE.PerspectiveCamera,
          // SSAO samples alpha from the full color texture node.
          color,
        ) as unknown as SSAOPass;
        aoPass.radius.value = 4;
        aoPass.sliceCount.value = 2;
        aoPass.stepCount.value = 4;
        aoPass.aoIntensity.value = 2;
        aoPass.useScreenSpaceSampling.value = true;
        aoPass.useTemporalFiltering = true;
        aoPass.useLinearThickness.value = true;

        graph = TSL.vec4(graph.rgb.mul(aoPass.getAONode().r), graph.a);
      }

      if (haze && sky) {
        // Apply haze before temporal resolution so the resolver stabilizes it.
        graph = sky.applyHaze(graph, { scenePass, policy: hazePolicy });
      }

      const skyCube = useSkyFog
        ? (sky as SkyWithBaker | null)?.baker?.texture
        : undefined;

      /** Reconstructs a world ray and its axial depth correction. */
      const reconstructRay = () => {
        const u = TSL.uv();
        const ndc = TSL.vec2(
          u.x.mul(2.0).sub(1.0),
          TSL.float(1.0).sub(u.y.mul(2.0)),
        );
        const viewFar = fogCam.invProj.mul(TSL.vec4(ndc, 1.0, 1.0));
        const rayDirView = viewFar.xyz.div(viewFar.w);
        const cosFromAxis = TSL.max(TSL.abs(rayDirView.normalize().z), 1e-6);
        const rayDirWorld = TSL.normalize(
          fogCam.camWorld.mul(TSL.vec4(rayDirView, 0.0)).xyz,
        );
        return { cosFromAxis, rayDirWorld };
      };

      const fogAlong = skyCube
        ? (distNode: unknown, rayDirWorldNode: unknown) => {
            const dist = distNode as AnyFloat;
            const rayDirWorld = rayDirWorldNode as AnyVec3;

            // Integrate exponential density with a stable limit for level rays.
            const H = fogKnobs.heightFalloff;
            const sigma = fogKnobs.density.div(1000.0);
            const rayY = rayDirWorld.y;
            const x = dist.mul(rayY).div(H);
            const term = TSL.abs(x)
              .lessThan(1e-4)
              .select(
                TSL.float(1.0).sub(x.mul(0.5)),
                TSL.float(1.0).sub(TSL.exp(x.negate())).div(x),
              );
            const od = sigma
              .mul(TSL.exp(fogCam.camPos.y.negate().div(H)))
              .mul(dist)
              .mul(term);
            const fogAmount = TSL.clamp(
              TSL.float(1.0).sub(TSL.exp(od.negate())),
              0.0,
              1.0,
            );

            // Clamp downward color samples to the illuminated horizon.
            const sampleDir = TSL.normalize(
              TSL.vec3(
                rayDirWorld.x,
                TSL.mix(
                  rayDirWorld.y,
                  TSL.max(rayDirWorld.y, 0.02),
                  fogKnobs.horizonClamp,
                ),
                rayDirWorld.z,
              ),
            );
            const skyColor = TSL.cubeTexture(skyCube, sampleDir).rgb;
            return { fogAmount, skyColor };
          }
        : null;

      if (fogAlong) {
        const input = graph;
        graph = TSL.Fn(() => {
          const viewZ = scenePass.getViewZNode();
          const ray = reconstructRay();
          const dist = TSL.abs(viewZ).div(ray.cosFromAxis);
          const fog = fogAlong(dist, ray.rayDirWorld);
          // Exclude the sky because its baked texture already includes haze.
          const isSky = scenePass.getLinearDepthNode().greaterThan(0.999);
          const amount = isSky.select(TSL.float(0.0), fog.fogAmount);
          return TSL.vec4(TSL.mix(input.rgb, fog.skyColor, amount), input.a);
        })();
      }

      if (useFsr) {
        // Scale the FSR3 input with the drawing buffer so resizing stays valid.
        const pinned = TSL.convertToTexture(graph);
        pinned.setResolutionScale(1 / renderScale);
        const fsrNode = upscale(
          pinned,
          depth,
          scenePass.getTextureNode("velocity"),
          camera,
          { path: "temporal", jitter: true },
        );
        nextFsrNode = fsrNode as unknown as FSRNodeLike;
        velocityBoundRef.current = false;
        graph = fsrNode;
      } else {
        // Use TRAA as the temporal resolver when FSR3 is disabled.
        const traaPass = traa(
          graph,
          depth,
          scenePass.getTextureNode("velocity"),
          camera,
        );
        traaPass.useSubpixelCorrection = true;
        graph = traaPass;
      }

      // Apply matching fog to lettering before the final composite.
      if (overlayText && textTex) {
        const resolved = graph;
        graph = TSL.Fn(() => {
          let textRgb = textTex.rgb as unknown as AnyVec3;
          if (bloomTex) {
            // Shape bloom luminance to extend its reach across the lettering.
            // Restore the bloom hue before applying it to each glyph.
            const raw = bloomTex.rgb as unknown as AnyVec3;
            const level = TSL.max(TSL.luminance(raw), 1e-4);
            const lit = TSL.pow(level, 0.6).mul(glowKnobs.textGlow).min(2.0);
            // Coverage keeps the added light inside each glyph.
            textRgb = textRgb.add(
              raw.div(level).mul(lit).mul(textTex.a),
            ) as unknown as AnyVec3;
          }
          if (fogAlong) {
            const ray = reconstructRay();
            const dist = (textDepth as unknown as AnyFloat).div(
              ray.cosFromAxis,
            );
            const fog = fogAlong(dist, ray.rayDirWorld);
            // Weight fog color by premultiplied glyph coverage.
            textRgb = TSL.mix(
              textRgb,
              fog.skyColor.mul(textTex.a),
              fog.fogAmount,
            ) as unknown as AnyVec3;
          }
          return overlayText(resolved, textRgb);
        })();
      }

      renderPipeline.outputNode = graph;
      // Mark the presentation material dirty after replacing its output node.
      renderPipeline.needsUpdate = true;
      commitResources();
      builtKeyRef.current = wantedKey;
      builtSkyRef.current = sky;
    },
    // Configure one render pass with all required attachments.
    ({ passes }) => {
      const scenePass = passes?.scenePass;
      if (!scenePass) return;

      // Render below display resolution only when FSR3 will reconstruct it.
      scenePass.setResolutionScale(useFsr ? 1 / renderScale : 1);

      const needsNormal = useGtao || useSsgi;
      scenePass.setMRT(
        TSL.mrt({
          output: TSL.output,
          ...(withBloom ? { emissive: TSL.emissive } : {}),
          ...(needsNormal
            ? { normal: TSL.packNormalToRGB(TSL.normalView) }
            : {}),
          // Both temporal resolvers require motion vectors.
          velocity: TSL.velocity,
          // SSGI requires unlit albedo for indirect lighting.
          ...(useSsgi ? { diffuse: TSL.diffuseColor } : {}),
        }),
      );

      // Store packed normals and low dynamic range albedo as byte textures.
      if (needsNormal) {
        scenePass.getTexture("normal").type = THREE.UnsignedByteType;
      }
      if (useSsgi) {
        scenePass.getTexture("diffuse").type = THREE.UnsignedByteType;
      }
    },
  );

  /** Rebuilds the graph when structural options or sky resources change. */
  useEffect(() => {
    // Haze and fog resources are owned by a specific Sky instance.
    const skyChanged =
      (haze || skyFog) && Boolean(sky) && builtSkyRef.current !== sky;
    if (builtKeyRef.current !== wantedKey || skyChanged) rebuild();
  }, [rebuild, wantedKey, sky, haze, skyFog]);

  return null;
}
