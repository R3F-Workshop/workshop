import { jsx } from 'react/jsx-runtime';
import { useMemo, useEffect } from 'react';
import { useThree, useFrame } from '@react-three/fiber/webgpu';
import { S as Sky$1 } from './shared/sky.ButMu2p_.mjs';
import { S as SkyContext } from './shared/sky.R90MEu9W.mjs';
export { u as useSky } from './shared/sky.R90MEu9W.mjs';
import 'three/webgpu';
import 'three/tsl';
import 'three/addons/tsl/display/GaussianBlurNode.js';

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
  const renderer = useThree((s) => s.gl);
  const scene = useThree((s) => s.scene);
  const sky = useMemo(() => {
    return new Sky$1(renderer, {
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
  useEffect(() => {
    cancelScheduledDispose(sky);
    sky.attach(scene);
    return () => {
      sky.detach();
      scheduleDispose(sky);
    };
  }, [sky, scene]);
  useEffect(() => {
    if (typeof timeOfDay === "number") sky.setTimeOfDay(timeOfDay);
  }, [sky, timeOfDay]);
  useEffect(() => {
    if (typeof latitude === "number") sky.setLatitude(latitude);
  }, [sky, latitude]);
  useEffect(() => {
    if (typeof dayOfYear === "number") sky.setDayOfYear(dayOfYear);
  }, [sky, dayOfYear]);
  useEffect(() => {
    if (sunDirection) sky.setSunDirection(sunDirection);
  }, [sky, sunDirection]);
  useEffect(() => {
    sky.setExposure(exposure);
  }, [sky, exposure]);
  useEffect(() => {
    sky.setSunDisc(sunDisc);
  }, [sky, sunDisc]);
  useEffect(() => {
    sky.setNorth(north);
  }, [sky, north]);
  useEffect(() => {
    if (typeof turbidity === "number") sky.setTurbidity(turbidity);
  }, [sky, turbidity]);
  useEffect(() => {
    if (groundAlbedo != null) sky.setGroundAlbedo(groundAlbedo);
  }, [sky, groundAlbedo]);
  useEffect(() => {
    if (atmosphere) sky.setAtmosphere(atmosphere);
  }, [sky, atmosphere]);
  useEffect(() => {
    sky.setMirrorBelowHorizon(!!mirrorBelowHorizon);
  }, [sky, mirrorBelowHorizon]);
  useEffect(() => {
    if (typeof hazeStrength === "number") sky.setHazeStrength(hazeStrength);
  }, [sky, hazeStrength]);
  useEffect(() => {
    if (hazePolicy) sky.setHazePolicy(hazePolicy);
  }, [sky, hazePolicy]);
  useEffect(() => {
    if (hazeAltitudeBlend) sky.setHazeAltitudeBlend(hazeAltitudeBlend);
  }, [sky, hazeAltitudeBlend]);
  useFrame((state) => {
    sky.update(state.camera);
    if (sky._hazeApplied) void sky.updateAerialPerspective();
  });
  return /* @__PURE__ */ jsx(SkyContext.Provider, { value: sky, children });
}

export { Sky, SkyContext };
