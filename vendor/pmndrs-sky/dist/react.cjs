'use strict';

const jsxRuntime = require('react/jsx-runtime');
const react = require('react');
const fiberWebGPU = require('@react-three/fiber/webgpu');
const Sky$1 = require('./shared/sky.BIl49Zx4.cjs');
const SkyContext = require('./shared/sky.BDQdLwjK.cjs');
require('three/webgpu');
require('three/tsl');
require('three/addons/tsl/display/GaussianBlurNode.js');

const pendingDisposal = /* @__PURE__ */ new Map();
function cancelScheduledDispose(sky) {
  const timer = pendingDisposal.get(sky);
  if (timer !== void 0) {
    clearTimeout(timer);
    pendingDisposal.delete(sky);
  }
}
function scheduleDispose(sky) {
  cancelScheduledDispose(sky);
  pendingDisposal.set(
    sky,
    setTimeout(() => {
      pendingDisposal.delete(sky);
      sky.dispose();
    }, 0)
  );
}
function Sky({
  preset = "earth",
  quality = "medium",
  cubeSize = 256,
  atmosphere,
  enableAerialPerspective = true,
  apKmPerSlice = 8,
  mirrorBelowHorizon = false,
  exposure = 40,
  north = "+Z",
  sunDisc = true,
  timeOfDay,
  latitude,
  dayOfYear,
  sunDirection,
  turbidity,
  groundAlbedo,
  hazeStrength,
  hazePolicy,
  hazeAltitudeBlend,
  children
}) {
  const renderer = fiberWebGPU.useThree((s) => s.gl);
  const scene = fiberWebGPU.useThree((s) => s.scene);
  const sky = react.useMemo(() => {
    return new Sky$1.Sky(renderer, {
      preset,
      quality,
      cubeSize,
      atmosphere,
      enableAerialPerspective,
      apKmPerSlice,
      mirrorBelowHorizon,
      exposure,
      north,
      sunDisc,
      timeOfDay,
      latitude,
      dayOfYear,
      sunDirection,
      turbidity,
      groundAlbedo
    });
  }, [renderer, preset, quality, cubeSize, enableAerialPerspective, apKmPerSlice]);
  react.useEffect(() => {
    cancelScheduledDispose(sky);
    sky.attach(scene);
    return () => {
      sky.detach();
      scheduleDispose(sky);
    };
  }, [sky, scene]);
  react.useEffect(() => {
    if (typeof timeOfDay === "number") sky.setTimeOfDay(timeOfDay);
  }, [sky, timeOfDay]);
  react.useEffect(() => {
    if (typeof latitude === "number") sky.setLatitude(latitude);
  }, [sky, latitude]);
  react.useEffect(() => {
    if (typeof dayOfYear === "number") sky.setDayOfYear(dayOfYear);
  }, [sky, dayOfYear]);
  react.useEffect(() => {
    if (sunDirection) sky.setSunDirection(sunDirection);
  }, [sky, sunDirection]);
  react.useEffect(() => {
    sky.setExposure(exposure);
  }, [sky, exposure]);
  react.useEffect(() => {
    sky.setSunDisc(sunDisc);
  }, [sky, sunDisc]);
  react.useEffect(() => {
    sky.setNorth(north);
  }, [sky, north]);
  react.useEffect(() => {
    if (typeof turbidity === "number") sky.setTurbidity(turbidity);
  }, [sky, turbidity]);
  react.useEffect(() => {
    if (groundAlbedo != null) sky.setGroundAlbedo(groundAlbedo);
  }, [sky, groundAlbedo]);
  react.useEffect(() => {
    if (atmosphere) sky.setAtmosphere(atmosphere);
  }, [sky, atmosphere]);
  react.useEffect(() => {
    sky.setMirrorBelowHorizon(!!mirrorBelowHorizon);
  }, [sky, mirrorBelowHorizon]);
  react.useEffect(() => {
    if (typeof hazeStrength === "number") sky.setHazeStrength(hazeStrength);
  }, [sky, hazeStrength]);
  react.useEffect(() => {
    if (hazePolicy) sky.setHazePolicy(hazePolicy);
  }, [sky, hazePolicy]);
  react.useEffect(() => {
    if (hazeAltitudeBlend) sky.setHazeAltitudeBlend(hazeAltitudeBlend);
  }, [sky, hazeAltitudeBlend]);
  fiberWebGPU.useFrame((state) => {
    sky.update(state.camera);
    if (sky._hazeApplied) void sky.updateAerialPerspective();
  });
  return /* @__PURE__ */ jsxRuntime.jsx(SkyContext.SkyContext.Provider, { value: sky, children });
}

exports.SkyContext = SkyContext.SkyContext;
exports.useSky = SkyContext.useSky;
exports.Sky = Sky;
