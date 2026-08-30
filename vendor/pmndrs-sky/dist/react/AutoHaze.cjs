'use strict';

Object.defineProperty(exports, '__esModule', { value: true });

const fiberWebGPU = require('@react-three/fiber/webgpu');
const SkyContext = require('../shared/sky.BDQdLwjK.cjs');
require('react');

function _interopNamespaceCompat(e) {
  if (e && typeof e === 'object' && 'default' in e) return e;
  const n = Object.create(null);
  if (e) {
    for (const k in e) {
      n[k] = e[k];
    }
  }
  n.default = e;
  return n;
}

const fiberWebGPU__namespace = /*#__PURE__*/_interopNamespaceCompat(fiberWebGPU);

const useRenderPipeline = fiberWebGPU__namespace.useRenderPipeline;
function AutoHaze(options = {}) {
  const sky = SkyContext.useSky();
  useRenderPipeline(({ renderPipeline, passes }) => {
    if (!sky) return;
    renderPipeline.outputNode = sky.applyHaze(passes.scenePass.getTextureNode(), {
      ...options,
      scenePass: passes.scenePass
    });
  });
  return null;
}

exports.AutoHaze = AutoHaze;
exports.default = AutoHaze;
