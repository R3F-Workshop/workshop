import * as fiberWebGPU from '@react-three/fiber/webgpu';
import { u as useSky } from '../shared/sky.R90MEu9W.mjs';
import 'react';

const useRenderPipeline = fiberWebGPU.useRenderPipeline;
function AutoHaze(options = {}) {
  const sky = useSky();
  useRenderPipeline(({ renderPipeline, passes }) => {
    if (!sky) return;
    renderPipeline.outputNode = sky.applyHaze(passes.scenePass.getTextureNode(), {
      ...options,
      scenePass: passes.scenePass
    });
  });
  return null;
}

export { AutoHaze, AutoHaze as default };
