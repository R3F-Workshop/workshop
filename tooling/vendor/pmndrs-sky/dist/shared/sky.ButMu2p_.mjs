import { Vector3, RenderTarget, ClampToEdgeWrapping, LinearFilter, HalfFloatType, NodeMaterial, RendererUtils, QuadMesh, Storage3DTexture, RGBAFormat, Matrix4, Mesh, BoxGeometry, BackSide, DataTexture, RepeatWrapping, Scene, CubeRenderTarget, LinearMipmapLinearFilter, CubeCamera, PMREMGenerator, MathUtils, SphereGeometry, PlaneGeometry, MeshStandardMaterial, Color, DirectionalLight, Object3D, Box3 } from 'three/webgpu';
import { uniform, vec3, length, max, float, select, min, PI, dot, Loop, exp, texture, saturate, vec2, normalize, Fn, acos, cos, sin, sqrt, clamp, wgslFn, vec4, uv, floor, instanceIndex, uint, textureStore, ivec3, int, fract, step, smoothstep, pow, mix, positionWorld, cameraPosition, abs, cross, If, equirectUV, modelViewProjection, positionLocal, reflect, cubeTexture, reflector, logarithmicDepthToViewZ, viewZToOrthographicDepth, texture3D } from 'three/tsl';
import { gaussianBlur } from 'three/addons/tsl/display/GaussianBlurNode.js';

const EARTH = {
  // Planet / atmosphere geometry (km)
  bottomRadius: 6360,
  topRadius: 6460,
  // Rayleigh
  rayleighScattering: new Vector3(5802e-6, 0.013558, 0.0331),
  // 1/km
  rayleighDensityExpScale: -1 / 8,
  // 1/km, density = exp(scale * altitude)
  // Mie
  mieScattering: new Vector3(3996e-6, 3996e-6, 3996e-6),
  // 1/km
  mieExtinction: new Vector3(444e-5, 444e-5, 444e-5),
  // 1/km
  mieAbsorption: new Vector3(444e-6, 444e-6, 444e-6),
  // extinction - scattering
  miePhaseG: 0.8,
  mieDensityExpScale: -1 / 1.2,
  // 1/km
  // Ozone absorption — Bruneton tent function, two linear segments around ~25 km.
  // Values taken from Unreal's `SetupEarthAtmosphere` (Application/SkyAtmosphereCommon.cpp)
  // which maps to the HLSL `absorption_density` via `GetAtmosphereParameters`.
  absorptionExtinction: new Vector3(65e-5, 1881e-6, 85e-6),
  // 1/km
  absorptionDensity0LayerWidth: 25,
  // km — tent switches segments at this altitude
  absorptionDensity0ConstantTerm: -2 / 3,
  absorptionDensity0LinearTerm: 1 / 15,
  // 1/km
  absorptionDensity1ConstantTerm: 8 / 3,
  absorptionDensity1LinearTerm: -1 / 15,
  // 1/km
  // Back-compat aliases — kept so code written against the original shape still reads;
  // the LUT pipeline uses the absorptionDensity* fields above.
  ozoneAbsorption: new Vector3(65e-5, 1881e-6, 85e-6),
  ozoneLayerCenterAltitude: 25,
  ozoneLayerHalfWidth: 15,
  // Ground albedo used by multi-scattering LUT
  groundAlbedo: new Vector3(0.3, 0.3, 0.3),
  // Sun
  sunAngularRadius: 4675e-6,
  // radians (~0.268 deg)
  sunIlluminance: new Vector3(1, 1, 1)
};
function mergeAtmosphereParams(base, partial) {
  const out = { ...base };
  if (!partial) return out;
  for (const key of Object.keys(partial)) {
    const src = partial[key];
    const cur = out[key];
    if (cur instanceof Vector3) {
      const next = cur.clone();
      if (src instanceof Vector3) {
        next.copy(src);
      } else if (Array.isArray(src)) {
        next.fromArray(src);
      } else if (src && typeof src === "object") {
        const v = src;
        next.set(v.x ?? next.x, v.y ?? next.y, v.z ?? next.z);
      }
      out[key] = next;
    } else {
      out[key] = src;
    }
  }
  return out;
}

function createAtmosphereUniforms(params) {
  return {
    // Geometry
    bottomRadius: uniform(params.bottomRadius),
    topRadius: uniform(params.topRadius),
    // Rayleigh
    rayleighScattering: uniform(params.rayleighScattering.clone()),
    rayleighDensityExpScale: uniform(params.rayleighDensityExpScale),
    // Mie
    mieScattering: uniform(params.mieScattering.clone()),
    mieExtinction: uniform(params.mieExtinction.clone()),
    mieAbsorption: uniform(params.mieAbsorption.clone()),
    mieDensityExpScale: uniform(params.mieDensityExpScale),
    miePhaseG: uniform(params.miePhaseG),
    // Ozone absorption (Bruneton tent)
    absorptionExtinction: uniform(params.absorptionExtinction.clone()),
    absorptionDensity0LayerWidth: uniform(params.absorptionDensity0LayerWidth),
    absorptionDensity0ConstantTerm: uniform(params.absorptionDensity0ConstantTerm),
    absorptionDensity0LinearTerm: uniform(params.absorptionDensity0LinearTerm),
    absorptionDensity1ConstantTerm: uniform(params.absorptionDensity1ConstantTerm),
    absorptionDensity1LinearTerm: uniform(params.absorptionDensity1LinearTerm),
    // Ground
    groundAlbedo: uniform(params.groundAlbedo.clone())
  };
}
function updateAtmosphereUniforms(uniforms, params) {
  uniforms.bottomRadius.value = params.bottomRadius;
  uniforms.topRadius.value = params.topRadius;
  copyVec3(uniforms.rayleighScattering.value, params.rayleighScattering);
  uniforms.rayleighDensityExpScale.value = params.rayleighDensityExpScale;
  copyVec3(uniforms.mieScattering.value, params.mieScattering);
  copyVec3(uniforms.mieExtinction.value, params.mieExtinction);
  copyVec3(uniforms.mieAbsorption.value, params.mieAbsorption);
  uniforms.mieDensityExpScale.value = params.mieDensityExpScale;
  uniforms.miePhaseG.value = params.miePhaseG;
  copyVec3(uniforms.absorptionExtinction.value, params.absorptionExtinction);
  uniforms.absorptionDensity0LayerWidth.value = params.absorptionDensity0LayerWidth;
  uniforms.absorptionDensity0ConstantTerm.value = params.absorptionDensity0ConstantTerm;
  uniforms.absorptionDensity0LinearTerm.value = params.absorptionDensity0LinearTerm;
  uniforms.absorptionDensity1ConstantTerm.value = params.absorptionDensity1ConstantTerm;
  uniforms.absorptionDensity1LinearTerm.value = params.absorptionDensity1LinearTerm;
  copyVec3(uniforms.groundAlbedo.value, params.groundAlbedo);
}
function copyVec3(dst, src) {
  if (src instanceof Vector3) dst.copy(src);
  else if (Array.isArray(src)) dst.fromArray(src);
  else if (src && typeof src === "object") dst.set(src.x ?? dst.x, src.y ?? dst.y, src.z ?? dst.z);
}

const LUT_RESOLUTIONS = {
  transmittance: { width: 256, height: 64 },
  multiScatter: { width: 32, height: 32 },
  skyView: { width: 192, height: 108 },
  // 3D froxel volume covering the camera frustum for Phase 2 aerial perspective.
  // kmPerSlice × z = total depth covered. Hillaire defaults to 4 km × 32 slices
  // (128 km); we use 8 km × 32 slices (256 km) so grazing rays don't truncate
  // significantly short of the atmosphere boundary, which would create a dark
  // fringe at distant silhouettes.
  aerialPerspective: { x: 32, y: 32, z: 32, kmPerSlice: 8 }
};

function fromUnitToSubUvs(u, resolution) {
  return u.add(float(0.5).div(resolution)).mul(resolution.div(resolution.add(float(1))));
}
function fromSubUvsToUnit(u, resolution) {
  return u.sub(float(0.5).div(resolution)).mul(resolution.div(resolution.sub(float(1))));
}
const PLANET_RADIUS_OFFSET = 0.01;
const rayleighPhase = /* @__PURE__ */ Fn(([cosTheta]) => {
  const factor = float(3).div(float(16).mul(PI));
  return factor.mul(float(1).add(cosTheta.mul(cosTheta)));
});
const hgPhase = /* @__PURE__ */ Fn(([cosTheta, g]) => {
  const g2 = g.mul(g);
  const numer = float(1).sub(g2);
  const denom = float(1).add(g2).add(float(2).mul(g).mul(cosTheta));
  return numer.div(float(4).mul(PI).mul(denom).mul(sqrt(denom)));
});
const raySphereIntersectNearest = /* @__PURE__ */ Fn(([ro, rd, center, radius]) => {
  const a = dot(rd, rd);
  const s0_r0 = ro.sub(center);
  const b = float(2).mul(dot(rd, s0_r0));
  const c = dot(s0_r0, s0_r0).sub(radius.mul(radius));
  const delta = b.mul(b).sub(float(4).mul(a).mul(c));
  const noHit = delta.lessThan(0);
  const sqrtDelta = sqrt(max(delta, float(0)));
  const denomInv = float(1).div(max(float(2).mul(a), float(1e-20)));
  const sol0 = b.negate().sub(sqrtDelta).mul(denomInv);
  const sol1 = b.negate().add(sqrtDelta).mul(denomInv);
  const bothNegative = sol0.lessThan(0).and(sol1.lessThan(0));
  const onlySol0Neg = sol0.lessThan(0);
  const onlySol1Neg = sol1.lessThan(0);
  const candidate = select(
    bothNegative,
    float(-1),
    select(
      onlySol0Neg,
      max(float(0), sol1),
      select(onlySol1Neg, max(float(0), sol0), max(float(0), min(sol0, sol1)))
    )
  );
  return select(noHit, float(-1), candidate);
});
function computeScatteringAbsorption(height, params) {
  const densityMie = exp(params.mieDensityExpScale.mul(height));
  const densityRay = exp(params.rayleighDensityExpScale.mul(height));
  const ozoneLayer0 = params.absorptionDensity0LinearTerm.mul(height).add(params.absorptionDensity0ConstantTerm);
  const ozoneLayer1 = params.absorptionDensity1LinearTerm.mul(height).add(params.absorptionDensity1ConstantTerm);
  const densityOzo = saturate(select(height.lessThan(params.absorptionDensity0LayerWidth), ozoneLayer0, ozoneLayer1));
  const scatteringMie = params.mieScattering.mul(densityMie);
  const absorptionMie = params.mieAbsorption.mul(densityMie);
  const extinctionMie = params.mieExtinction.mul(densityMie);
  const scatteringRay = params.rayleighScattering.mul(densityRay);
  const extinctionRay = scatteringRay;
  const scatteringOzo = vec3(0, 0, 0);
  const absorptionOzo = params.absorptionExtinction.mul(densityOzo);
  const extinctionOzo = absorptionOzo;
  const scattering = scatteringMie.add(scatteringRay).add(scatteringOzo);
  const extinction = extinctionMie.add(extinctionRay).add(extinctionOzo);
  return {
    rayleighScattering: scatteringRay,
    mieScattering: scatteringMie,
    mieExtinction: extinctionMie,
    mieAbsorption: absorptionMie,
    absorptionExtinction: absorptionOzo,
    scattering,
    extinction
  };
}
function moveToTopAtmosphere(worldPos, worldDir, params) {
  const center = vec3(0, 0, 0);
  const viewHeight = length(worldPos);
  const tTop = raySphereIntersectNearest(worldPos, worldDir, center, params.topRadius);
  const upVector = worldPos.div(max(viewHeight, float(1e-6)));
  const offset = upVector.mul(float(-PLANET_RADIUS_OFFSET));
  const clippedPos = worldPos.add(worldDir.mul(tTop)).add(offset);
  const aboveAtmo = viewHeight.greaterThan(params.topRadius);
  const missed = aboveAtmo.and(tTop.lessThan(0));
  const newPos = select(aboveAtmo, clippedPos, worldPos);
  const valid = missed.not();
  return { newPos, valid };
}
function uvToTransmittanceLutParams(uvNode, params) {
  const x_mu = uvNode.x;
  const x_r = uvNode.y;
  const topR2 = params.topRadius.mul(params.topRadius);
  const botR2 = params.bottomRadius.mul(params.bottomRadius);
  const H = sqrt(max(float(0), topR2.sub(botR2)));
  const rho = H.mul(x_r);
  const viewHeight = sqrt(rho.mul(rho).add(botR2));
  const d_min = params.topRadius.sub(viewHeight);
  const d_max = rho.add(H);
  const d = d_min.add(x_mu.mul(d_max.sub(d_min)));
  const viewZenithCosAngleRaw = select(
    d.lessThanEqual(float(0)),
    float(1),
    H.mul(H).sub(rho.mul(rho)).sub(d.mul(d)).div(max(float(2).mul(viewHeight).mul(d), float(1e-20)))
  );
  const viewZenithCosAngle = clamp(viewZenithCosAngleRaw, float(-1), float(1));
  return { viewHeight, viewZenithCosAngle };
}
function transmittanceLutParamsToUv(viewHeight, viewZenithCosAngle, params) {
  const topR2 = params.topRadius.mul(params.topRadius);
  const botR2 = params.bottomRadius.mul(params.bottomRadius);
  const H = sqrt(max(float(0), topR2.sub(botR2)));
  const rho = sqrt(max(float(0), viewHeight.mul(viewHeight).sub(botR2)));
  const discriminant = viewHeight.mul(viewHeight).mul(viewZenithCosAngle.mul(viewZenithCosAngle).sub(1)).add(topR2);
  const d = max(
    float(0),
    viewHeight.negate().mul(viewZenithCosAngle).add(sqrt(max(discriminant, float(0))))
  );
  const d_min = params.topRadius.sub(viewHeight);
  const d_max = rho.add(H);
  const x_mu = d.sub(d_min).div(max(d_max.sub(d_min), float(1e-20)));
  const x_r = rho.div(max(H, float(1e-20)));
  return vec2(x_mu, x_r);
}
function uvToSkyViewLutParams(atmosphere, viewHeight, uvNode) {
  const resX = float(192);
  const resY = float(108);
  const uCorr = fromSubUvsToUnit(uvNode.x, resX);
  const vCorr = fromSubUvsToUnit(uvNode.y, resY);
  const botR2 = atmosphere.bottomRadius.mul(atmosphere.bottomRadius);
  const vh2 = viewHeight.mul(viewHeight);
  const vHorizon = sqrt(max(vh2.sub(botR2), float(0)));
  const cosBeta = vHorizon.div(max(viewHeight, float(1e-6)));
  const beta = acos(clamp(cosBeta, float(-1), float(1)));
  const zenithHorizonAngle = float(PI).sub(beta);
  const coordAbove0 = float(2).mul(vCorr);
  const coordAbove1 = float(1).sub(coordAbove0);
  const coordAbove2 = coordAbove1.mul(coordAbove1);
  const coordAbove3 = float(1).sub(coordAbove2);
  const vzAbove = cos(zenithHorizonAngle.mul(coordAbove3));
  const coordBelow0 = vCorr.mul(2).sub(1);
  const coordBelow1 = coordBelow0.mul(coordBelow0);
  const vzBelow = cos(zenithHorizonAngle.add(beta.mul(coordBelow1)));
  const viewZenithCosAngle = select(vCorr.lessThan(0.5), vzAbove, vzBelow);
  const uSq = uCorr.mul(uCorr);
  const lightViewCosAngle = uSq.mul(2).sub(1).negate();
  return { viewZenithCosAngle, lightViewCosAngle };
}
function skyViewLutParamsToUv(atmosphere, intersectsGround, viewZenithCosAngle, lightViewCosAngle, viewHeight) {
  const botR2 = atmosphere.bottomRadius.mul(atmosphere.bottomRadius);
  const vh2 = viewHeight.mul(viewHeight);
  const vHorizon = sqrt(max(vh2.sub(botR2), float(0)));
  const cosBeta = vHorizon.div(max(viewHeight, float(1e-6)));
  const beta = acos(clamp(cosBeta, float(-1), float(1)));
  const zenithHorizonAngle = float(PI).sub(beta);
  const vzAcos = acos(clamp(viewZenithCosAngle, float(-1), float(1)));
  const coordSky0 = vzAcos.div(max(zenithHorizonAngle, float(1e-6)));
  const coordSky1 = float(1).sub(coordSky0);
  const coordSky2 = sqrt(max(coordSky1, float(0)));
  const coordSky3 = float(1).sub(coordSky2);
  const uvY_sky = coordSky3.mul(0.5);
  const coordGnd0 = vzAcos.sub(zenithHorizonAngle).div(max(beta, float(1e-6)));
  const coordGnd1 = sqrt(max(coordGnd0, float(0)));
  const uvY_gnd = coordGnd1.mul(0.5).add(0.5);
  const uvY = select(intersectsGround, uvY_gnd, uvY_sky);
  const uvXraw = sqrt(saturate(lightViewCosAngle.negate().mul(0.5).add(0.5)));
  const resX = float(192);
  const resY = float(108);
  const uv = vec2(fromUnitToSubUvs(uvXraw, resX), fromUnitToSubUvs(uvY, resY));
  return uv;
}
const getSphericalDir = /* @__PURE__ */ Fn(([iPlusHalf, jPlusHalf, sqrtSampleCount]) => {
  const randA = iPlusHalf.div(sqrtSampleCount);
  const randB = jPlusHalf.div(sqrtSampleCount);
  const theta = float(2).mul(PI).mul(randA);
  const phi = acos(float(1).sub(float(2).mul(randB)));
  const cosPhi = cos(phi);
  const sinPhi = sin(phi);
  const cosTheta = cos(theta);
  const sinTheta = sin(theta);
  return vec3(cosTheta.mul(sinPhi), sinTheta.mul(sinPhi), cosPhi);
});
function integrateScatteredLuminance({
  worldPos,
  worldDir,
  sunDir,
  params,
  transmittanceLUT,
  sampleCount = 20,
  ground = true,
  mieRayPhase = false,
  multiScatterLUT = null,
  tMaxOverride = null,
  // Optional per-call float TSL node in [0, 1] used as the within-step
  // offset instead of the canonical SebH constant (`0.3`). When every
  // pixel shares the same fixed offset, neighbouring pixels with
  // near-identical `tMax` accumulate optical depth at structurally
  // aligned sample altitudes, producing visible banding in the
  // transmittance (alpha) channel — most obvious from altitude on
  // long horizon-grazing rays. Passing a per-pixel hash here breaks
  // the coherence; the noise then averages out across screen-space
  // neighbours rather than aligning into bands.
  // extEpsNode — optional TSL float: minimum extinction for division; default 1e-6.
  sampleJitter = null,
  extEpsNode = void 0
}) {
  const earthO = vec3(0, 0, 0);
  const SAMPLE_SEGMENT_T = 0.3;
  const segmentT = sampleJitter ? sampleJitter : float(SAMPLE_SEGMENT_T);
  const extEps = extEpsNode !== void 0 && extEpsNode !== null ? extEpsNode : float(1e-6);
  const tBottom = raySphereIntersectNearest(worldPos, worldDir, earthO, params.bottomRadius);
  const tTop = raySphereIntersectNearest(worldPos, worldDir, earthO, params.topRadius);
  const tMaxIfNoBottom = tTop.lessThan(0).select(float(0), tTop);
  const tMaxIfBoth = tTop.greaterThan(0).select(tTop.min(tBottom), tBottom);
  const tMaxClipped = tBottom.lessThan(0).select(tMaxIfNoBottom, tMaxIfBoth);
  const tMax = (tMaxOverride ? min(tMaxClipped, tMaxOverride) : tMaxClipped).toVar();
  const uniformPhase = float(1).div(float(4).mul(PI));
  const cosTheta = dot(sunDir, worldDir);
  const miePhaseValue = hgPhase(cosTheta.negate(), params.miePhaseG);
  const rayleighPhaseValue = rayleighPhase(cosTheta);
  const L = vec3(0, 0, 0).toVar();
  const throughput = vec3(1, 1, 1).toVar();
  const opticalDepth = vec3(0, 0, 0).toVar();
  const multiScatAs1 = vec3(0, 0, 0).toVar();
  const tPrev = float(0).toVar();
  Loop({ start: 0, end: sampleCount, type: "int" }, ({ i }) => {
    const newT = tMax.mul(float(i).add(segmentT).div(float(sampleCount)));
    const dt = newT.sub(tPrev);
    const P = worldPos.add(worldDir.mul(newT));
    const pHeight = length(P);
    const altitude = pHeight.sub(params.bottomRadius);
    const upVector = P.div(max(pHeight, float(1e-6)));
    const medium = computeScatteringAbsorption(altitude, params);
    const extSafe = max(medium.extinction, vec3(extEps, extEps, extEps));
    const sampleOpticalDepth = medium.extinction.mul(dt);
    const sampleTransmittance = exp(sampleOpticalDepth.negate());
    opticalDepth.addAssign(sampleOpticalDepth);
    const sunZenithCos = dot(sunDir, upVector);
    const tLutUv = transmittanceLutParamsToUv(pHeight, sunZenithCos, params);
    const transmittanceToSun = texture(transmittanceLUT, tLutUv).rgb;
    const phaseTimesScattering = mieRayPhase ? medium.mieScattering.mul(miePhaseValue).add(medium.rayleighScattering.mul(rayleighPhaseValue)) : medium.scattering.mul(uniformPhase);
    const shadowOrigin = P.add(upVector.mul(float(PLANET_RADIUS_OFFSET)));
    const tEarth = raySphereIntersectNearest(shadowOrigin, sunDir, earthO, params.bottomRadius);
    const earthShadow = select(tEarth.greaterThanEqual(0), float(0), float(1));
    const directInScatter = earthShadow.mul(transmittanceToSun).mul(phaseTimesScattering);
    let S;
    if (multiScatterLUT) {
      const atmosphereThickness = params.topRadius.sub(params.bottomRadius);
      const altitude01 = saturate(altitude.div(max(atmosphereThickness, float(1e-6))));
      const msUvRaw = vec2(sunZenithCos.mul(0.5).add(0.5), altitude01);
      const msRes = float(32);
      const msUvX = msUvRaw.x.add(float(0.5).div(msRes)).mul(msRes.div(msRes.add(float(1))));
      const msUvY = msUvRaw.y.add(float(0.5).div(msRes)).mul(msRes.div(msRes.add(float(1))));
      const multiScatteredLuminance = texture(multiScatterLUT, vec2(msUvX, msUvY)).rgb;
      S = directInScatter.add(multiScatteredLuminance.mul(medium.scattering));
    } else {
      S = directInScatter;
    }
    const Sint = S.sub(S.mul(sampleTransmittance)).div(extSafe);
    L.addAssign(throughput.mul(Sint));
    const MS = medium.scattering;
    const MSint = MS.sub(MS.mul(sampleTransmittance)).div(extSafe);
    multiScatAs1.addAssign(throughput.mul(MSint));
    throughput.assign(throughput.mul(sampleTransmittance));
    tPrev.assign(newT);
  });
  if (ground) {
    const hitGround = tBottom.greaterThan(0).and(tMax.equal(tBottom));
    const P = worldPos.add(worldDir.mul(tBottom));
    const pHeight = length(P);
    const upVector = P.div(max(pHeight, float(1e-6)));
    const sunZenithCos = dot(sunDir, upVector);
    const tLutUv = transmittanceLutParamsToUv(pHeight, sunZenithCos, params);
    const transmittanceToSun = texture(transmittanceLUT, tLutUv).rgb;
    const NdotL = saturate(dot(normalize(upVector), normalize(sunDir)));
    const groundL = transmittanceToSun.mul(throughput).mul(NdotL).mul(params.groundAlbedo).div(PI);
    L.assign(select(hitGround, L.add(groundL), L));
  }
  return { L, multiScatAs1, transmittance: throughput, opticalDepth };
}

const BILINEAR_SAMPLE_2D = (
  /* wgsl */
  `
fn bilinearSample2D(map: texture_2d<f32>, uvc: vec2<f32>) -> vec3<f32> {
  let dims = vec2<i32>(textureDimensions(map, 0));
  let p = uvc * vec2<f32>(dims) - 0.5;
  let fl = floor(p);
  let f = p - fl;
  let maxc = dims - vec2<i32>(1, 1);
  let i0 = clamp(vec2<i32>(fl), vec2<i32>(0, 0), maxc);
  let i1 = clamp(vec2<i32>(fl) + vec2<i32>(1, 1), vec2<i32>(0, 0), maxc);
  let c00 = textureLoad(map, vec2<i32>(i0.x, i0.y), 0).rgb;
  let c10 = textureLoad(map, vec2<i32>(i1.x, i0.y), 0).rgb;
  let c01 = textureLoad(map, vec2<i32>(i0.x, i1.y), 0).rgb;
  let c11 = textureLoad(map, vec2<i32>(i1.x, i1.y), 0).rgb;
  return mix(mix(c00, c10, f.x), mix(c01, c11, f.x), f.y);
}
`
);
const RAYLEIGH_PHASE = (
  /* wgsl */
  `
fn rayleighPhase(cosTheta: f32) -> f32 {
  let factor = 3.0 / (16.0 * 3.1415926535897932);
  return factor * (1.0 + cosTheta * cosTheta);
}
`
);
const HG_PHASE = (
  /* wgsl */
  `
fn hgPhase(cosTheta: f32, g: f32) -> f32 {
  let g2 = g * g;
  let numer = 1.0 - g2;
  let denom = 1.0 + g2 + 2.0 * g * cosTheta;
  return numer / (4.0 * 3.1415926535897932 * denom * sqrt(denom));
}
`
);
const RAY_SPHERE = (
  /* wgsl */
  `
fn raySphereIntersectNearest(ro: vec3<f32>, rd: vec3<f32>, center: vec3<f32>, radius: f32) -> f32 {
  let a = dot(rd, rd);
  let s0r0 = ro - center;
  let b = 2.0 * dot(rd, s0r0);
  let c = dot(s0r0, s0r0) - radius * radius;
  let delta = b * b - 4.0 * a * c;
  if (delta < 0.0) { return -1.0; }
  let sqrtDelta = sqrt(max(delta, 0.0));
  let denomInv = 1.0 / max(2.0 * a, 1e-20);
  let sol0 = (-b - sqrtDelta) * denomInv;
  let sol1 = (-b + sqrtDelta) * denomInv;
  if (sol0 < 0.0 && sol1 < 0.0) { return -1.0; }
  if (sol0 < 0.0) { return max(0.0, sol1); }
  if (sol1 < 0.0) { return max(0.0, sol0); }
  return max(0.0, min(sol0, sol1));
}
`
);
const SPHERICAL_DIR = (
  /* wgsl */
  `
fn getSphericalDir(iPlusHalf: f32, jPlusHalf: f32, sqrtSampleCount: f32) -> vec3<f32> {
  let randA = iPlusHalf / sqrtSampleCount;
  let randB = jPlusHalf / sqrtSampleCount;
  let theta = 2.0 * 3.1415926535897932 * randA;
  let phi = acos(1.0 - 2.0 * randB);
  let cosPhi = cos(phi);
  let sinPhi = sin(phi);
  let cosTheta = cos(theta);
  let sinTheta = sin(theta);
  return vec3<f32>(cosTheta * sinPhi, sinTheta * sinPhi, cosPhi);
}
`
);
const UV_TO_TRANSMITTANCE = (
  /* wgsl */
  `
fn uvToTransmittanceLutParams(uv: vec2<f32>, bottomRadius: f32, topRadius: f32) -> vec2<f32> {
  let xMu = uv.x;
  let xR = uv.y;
  let topR2 = topRadius * topRadius;
  let botR2 = bottomRadius * bottomRadius;
  let H = sqrt(max(0.0, topR2 - botR2));
  let rho = H * xR;
  let viewHeight = sqrt(rho * rho + botR2);
  let dMin = topRadius - viewHeight;
  let dMax = rho + H;
  let d = dMin + xMu * (dMax - dMin);
  var vzca: f32 = 1.0;
  if (d > 0.0) {
    vzca = (H * H - rho * rho - d * d) / max(2.0 * viewHeight * d, 1e-20);
  }
  return vec2<f32>(viewHeight, clamp(vzca, -1.0, 1.0));
}
`
);

const TRANSMITTANCE_LUT_PIXEL = (
  /* wgsl */
  `
fn transmittanceLutPixel(
  uv: vec2<f32>,
  bottomRadius: f32,
  topRadius: f32,
  mieDensityExpScale: f32,
  rayleighDensityExpScale: f32,
  absorptionDensity0LayerWidth: f32,
  absorptionDensity0LinearTerm: f32,
  absorptionDensity0ConstantTerm: f32,
  absorptionDensity1LinearTerm: f32,
  absorptionDensity1ConstantTerm: f32,
  mieExtinction: vec3<f32>,
  rayleighScattering: vec3<f32>,
  absorptionExtinction: vec3<f32>
) -> vec3<f32> {
  let params = uvToTransmittanceLutParams(uv, bottomRadius, topRadius);
  let viewHeight = params.x;
  let viewZenithCosAngle = params.y;

  // World pos on +Y, ray in the YZ plane (matches the TSL twin's layout).
  let worldPos = vec3<f32>(0.0, viewHeight, 0.0);
  let sinZ = sqrt(max(0.0, 1.0 - viewZenithCosAngle * viewZenithCosAngle));
  let worldDir = vec3<f32>(sinZ, viewZenithCosAngle, 0.0);
  let earthO = vec3<f32>(0.0, 0.0, 0.0);

  let tBottom = raySphereIntersectNearest(worldPos, worldDir, earthO, bottomRadius);
  let tTop = raySphereIntersectNearest(worldPos, worldDir, earthO, topRadius);

  // tMax: 0 if miss/miss; else min of the two positive hits (ground shortcut
  // when pointing down); else just tTop.
  var tMax: f32;
  if (tBottom < 0.0) {
    if (tTop < 0.0) { tMax = 0.0; } else { tMax = tTop; }
  } else {
    if (tTop > 0.0) { tMax = min(tTop, tBottom); } else { tMax = tBottom; }
  }

  let sampleCount = 40.0;
  let segmentT = 0.3; // Hillaire mid-segment offset
  var opticalDepth = vec3<f32>(0.0, 0.0, 0.0);
  var tPrev = 0.0;

  for (var s = 0.0; s < sampleCount; s = s + 1.0) {
    let newT = tMax * ((s + segmentT) / sampleCount);
    let dt = newT - tPrev;
    let P = worldPos + worldDir * newT;
    let height = length(P) - bottomRadius;

    // --- inline extinction (mirrors computeScatteringAbsorption's extinction) ---
    let densityMie = exp(mieDensityExpScale * height);
    let densityRay = exp(rayleighDensityExpScale * height);
    let ozo0 = absorptionDensity0LinearTerm * height + absorptionDensity0ConstantTerm;
    let ozo1 = absorptionDensity1LinearTerm * height + absorptionDensity1ConstantTerm;
    let densityOzo = saturate(select(ozo1, ozo0, height < absorptionDensity0LayerWidth));
    // extinction = mieExtinction + rayleighScattering (Rayleigh absorption=0) + ozone absorption
    let extinction = mieExtinction * densityMie + rayleighScattering * densityRay + absorptionExtinction * densityOzo;

    opticalDepth = opticalDepth + extinction * dt;
    tPrev = newT;
  }

  return exp(-opticalDepth);
}
`
);
const SKYVIEW_LUT_PIXEL = (
  /* wgsl */
  `
fn skyViewLutPixel(
  uv: vec2<f32>,
  transmittanceLut: texture_2d<f32>,
  multiScatterLut: texture_2d<f32>,
  sunDirWorld: vec3<f32>,
  viewHeightIn: f32,
  bottomRadius: f32,
  topRadius: f32,
  mieDensityExpScale: f32,
  rayleighDensityExpScale: f32,
  absorptionDensity0LayerWidth: f32,
  absorptionDensity0LinearTerm: f32,
  absorptionDensity0ConstantTerm: f32,
  absorptionDensity1LinearTerm: f32,
  absorptionDensity1ConstantTerm: f32,
  mieScattering: vec3<f32>,
  mieExtinction: vec3<f32>,
  rayleighScattering: vec3<f32>,
  absorptionExtinction: vec3<f32>,
  miePhaseG: f32,
  groundAlbedo: vec3<f32>
) -> vec3<f32> {
  let PI = 3.1415926535897932;
  let OFFSET = 0.01;
  let viewHeight = max(viewHeightIn, bottomRadius + 0.01);
  let botR2 = bottomRadius * bottomRadius;
  let topR2 = topRadius * topRadius;
  let earthO = vec3<f32>(0.0, 0.0, 0.0);

  // --- unmap uv -> (viewZenithCosAngle, lightViewCosAngle) [uvToSkyViewLutParams] ---
  let resX = 192.0;
  let resY = 108.0;
  let uCorr = (uv.x - 0.5 / resX) * (resX / (resX - 1.0));
  let vCorr = (uv.y - 0.5 / resY) * (resY / (resY - 1.0));
  let vHorizon = sqrt(max(viewHeight * viewHeight - botR2, 0.0));
  let cosBeta = vHorizon / max(viewHeight, 1e-6);
  let beta = acos(clamp(cosBeta, -1.0, 1.0));
  let zenithHorizonAngle = PI - beta;
  var viewZenithCosAngle: f32;
  if (vCorr < 0.5) {
    let ca1 = 1.0 - 2.0 * vCorr;
    let ca3 = 1.0 - ca1 * ca1;
    viewZenithCosAngle = cos(zenithHorizonAngle * ca3);
  } else {
    let cb0 = vCorr * 2.0 - 1.0;
    viewZenithCosAngle = cos(zenithHorizonAngle + beta * (cb0 * cb0));
  }
  let uSq = uCorr * uCorr;
  let lightViewCosAngle = -(uSq * 2.0 - 1.0);

  // --- sun dir in LUT Z-up frame (only z-component of the world sun matters) ---
  let sunZenithCosAngle = dot(vec3<f32>(0.0, 0.0, 1.0), normalize(sunDirWorld));
  let sunDirSinZ = sqrt(max(1.0 - sunZenithCosAngle * sunZenithCosAngle, 0.0));
  let sunDir = vec3<f32>(sunDirSinZ, 0.0, sunZenithCosAngle);

  // --- world pos + view dir ---
  var worldPos = vec3<f32>(0.0, 0.0, viewHeight);
  let vzSin = sqrt(max(1.0 - viewZenithCosAngle * viewZenithCosAngle, 0.0));
  let worldDir = vec3<f32>(
    vzSin * lightViewCosAngle,
    vzSin * sqrt(max(1.0 - lightViewCosAngle * lightViewCosAngle, 0.0)),
    viewZenithCosAngle
  );

  // --- moveToTopAtmosphere (no-op unless camera above topRadius) ---
  if (viewHeight > topRadius) {
    let tTopClip = raySphereIntersectNearest(worldPos, worldDir, earthO, topRadius);
    if (tTopClip < 0.0) { return vec3<f32>(0.0, 0.0, 0.0); }
    let up0 = worldPos / viewHeight;
    worldPos = worldPos + worldDir * tTopClip - up0 * OFFSET;
  }

  // --- tMax ---
  let tBottom = raySphereIntersectNearest(worldPos, worldDir, earthO, bottomRadius);
  let tTop = raySphereIntersectNearest(worldPos, worldDir, earthO, topRadius);
  var tMax: f32;
  if (tBottom < 0.0) {
    if (tTop < 0.0) { tMax = 0.0; } else { tMax = tTop; }
  } else {
    if (tTop > 0.0) { tMax = min(tTop, tBottom); } else { tMax = tBottom; }
  }

  // --- phases (constant per ray) ---
  let cosTheta = dot(sunDir, worldDir);
  let miePhaseValue = hgPhase(-cosTheta, miePhaseG);
  let rayleighPhaseValue = rayleighPhase(cosTheta);

  let sampleCount = 30.0;
  let segmentT = 0.3;
  let atmosphereThickness = topRadius - bottomRadius;

  var L = vec3<f32>(0.0, 0.0, 0.0);
  var throughput = vec3<f32>(1.0, 1.0, 1.0);
  var tPrev = 0.0;

  for (var s = 0.0; s < sampleCount; s = s + 1.0) {
    let newT = tMax * ((s + segmentT) / sampleCount);
    let dt = newT - tPrev;
    let P = worldPos + worldDir * newT;
    let pHeight = length(P);
    let altitude = pHeight - bottomRadius;
    let up = P / max(pHeight, 1e-6);

    // medium sample
    let densityMie = exp(mieDensityExpScale * altitude);
    let densityRay = exp(rayleighDensityExpScale * altitude);
    let ozo0 = absorptionDensity0LinearTerm * altitude + absorptionDensity0ConstantTerm;
    let ozo1 = absorptionDensity1LinearTerm * altitude + absorptionDensity1ConstantTerm;
    let densityOzo = saturate(select(ozo1, ozo0, altitude < absorptionDensity0LayerWidth));
    let scatteringMie = mieScattering * densityMie;
    let scatteringRay = rayleighScattering * densityRay;
    let scattering = scatteringMie + scatteringRay;
    let extinction = mieExtinction * densityMie + scatteringRay + absorptionExtinction * densityOzo;
    let extSafe = max(extinction, vec3<f32>(1e-6, 1e-6, 1e-6));

    let sampleOpticalDepth = extinction * dt;
    let sampleTransmittance = exp(-sampleOpticalDepth);

    // transmittance to sun (transmittanceLutParamsToUv, then manual bilinear)
    let sunZenithCos = dot(sunDir, up);
    let H = sqrt(max(0.0, topR2 - botR2));
    let rho = sqrt(max(0.0, pHeight * pHeight - botR2));
    let disc = pHeight * pHeight * (sunZenithCos * sunZenithCos - 1.0) + topR2;
    let dSun = max(0.0, -pHeight * sunZenithCos + sqrt(max(disc, 0.0)));
    let tU = vec2<f32>((dSun - (topRadius - pHeight)) / max((rho + H) - (topRadius - pHeight), 1e-20), rho / max(H, 1e-20));
    let transmittanceToSun = bilinearSample2D(transmittanceLut, tU);

    // phase * scattering (Mie + Rayleigh)
    let phaseTimesScattering = scatteringMie * miePhaseValue + scatteringRay * rayleighPhaseValue;

    // earth shadow
    let shadowOrigin = P + up * OFFSET;
    let tEarth = raySphereIntersectNearest(shadowOrigin, sunDir, earthO, bottomRadius);
    let earthShadow = select(1.0, 0.0, tEarth >= 0.0);

    let directInScatter = earthShadow * transmittanceToSun * phaseTimesScattering;

    // multi-scatter LUT feedback (sub-UV corrected, 32x32)
    let altitude01 = saturate(altitude / max(atmosphereThickness, 1e-6));
    let msRes = 32.0;
    let msUvX = (sunZenithCos * 0.5 + 0.5 + 0.5 / msRes) * (msRes / (msRes + 1.0));
    let msUvY = (altitude01 + 0.5 / msRes) * (msRes / (msRes + 1.0));
    let multiScatteredLuminance = bilinearSample2D(multiScatterLut, vec2<f32>(msUvX, msUvY));

    let S = directInScatter + multiScatteredLuminance * scattering;
    let Sint = (S - S * sampleTransmittance) / extSafe;
    L = L + throughput * Sint;

    throughput = throughput * sampleTransmittance;
    tPrev = newT;
  }

  // ground bounce (ground = true)
  if (tBottom > 0.0 && tMax == tBottom) {
    let P = worldPos + worldDir * tBottom;
    let pHeight = length(P);
    let up = P / max(pHeight, 1e-6);
    let sunZenithCos = dot(sunDir, up);
    let H = sqrt(max(0.0, topR2 - botR2));
    let rho = sqrt(max(0.0, pHeight * pHeight - botR2));
    let disc = pHeight * pHeight * (sunZenithCos * sunZenithCos - 1.0) + topR2;
    let dSun = max(0.0, -pHeight * sunZenithCos + sqrt(max(disc, 0.0)));
    let tU = vec2<f32>((dSun - (topRadius - pHeight)) / max((rho + H) - (topRadius - pHeight), 1e-20), rho / max(H, 1e-20));
    let transmittanceToSun = bilinearSample2D(transmittanceLut, tU);
    let NdotL = saturate(dot(normalize(up), normalize(sunDir)));
    L = L + transmittanceToSun * throughput * NdotL * groundAlbedo / PI;
  }

  return L;
}
`
);
const MULTISCATTER_LUT_PIXEL = (
  /* wgsl */
  `
fn multiScatterLutPixel(
  uv: vec2<f32>,
  transmittanceLut: texture_2d<f32>,
  bottomRadius: f32,
  topRadius: f32,
  mieDensityExpScale: f32,
  rayleighDensityExpScale: f32,
  absorptionDensity0LayerWidth: f32,
  absorptionDensity0LinearTerm: f32,
  absorptionDensity0ConstantTerm: f32,
  absorptionDensity1LinearTerm: f32,
  absorptionDensity1ConstantTerm: f32,
  mieScattering: vec3<f32>,
  mieExtinction: vec3<f32>,
  rayleighScattering: vec3<f32>,
  absorptionExtinction: vec3<f32>,
  groundAlbedo: vec3<f32>
) -> vec3<f32> {
  let PI = 3.1415926535897932;
  let OFFSET = 0.01;
  let botR2 = bottomRadius * bottomRadius;
  let topR2 = topRadius * topRadius;
  let H = sqrt(max(0.0, topR2 - botR2));
  let earthO = vec3<f32>(0.0, 0.0, 0.0);

  // sub-UV correct (32x32).
  let res = 32.0;
  let corrU = (uv.x - 0.5 / res) * (res / (res - 1.0));
  let corrV = (uv.y - 0.5 / res) * (res / (res - 1.0));

  let cosSunZenith = corrU * 2.0 - 1.0;
  let sunDir = vec3<f32>(0.0, sqrt(saturate(1.0 - cosSunZenith * cosSunZenith)), cosSunZenith);

  let atmosphereThickness = topRadius - bottomRadius - OFFSET;
  let viewHeight = bottomRadius + saturate(corrV + OFFSET) * atmosphereThickness;
  let worldPos = vec3<f32>(0.0, 0.0, viewHeight);

  let sqrtN = 8.0;
  let sampleWeight = (4.0 * PI) / (sqrtN * sqrtN);
  let uniformPhase = 1.0 / (4.0 * PI);
  let sampleCount = 20.0;
  let segmentT = 0.3;

  var totalL = vec3<f32>(0.0, 0.0, 0.0);
  var totalMSA = vec3<f32>(0.0, 0.0, 0.0);

  for (var d = 0; d < 64; d = d + 1) {
    let iF = floor(f32(d) / sqrtN);
    let jF = f32(d) - iF * sqrtN;
    let worldDir = getSphericalDir(iF + 0.5, jF + 0.5, sqrtN);

    var L = vec3<f32>(0.0, 0.0, 0.0);
    var throughput = vec3<f32>(1.0, 1.0, 1.0);
    var multiScatAs1 = vec3<f32>(0.0, 0.0, 0.0);
    var tPrev = 0.0;

    let tBottom = raySphereIntersectNearest(worldPos, worldDir, earthO, bottomRadius);
    let tTop = raySphereIntersectNearest(worldPos, worldDir, earthO, topRadius);
    var tMax: f32;
    if (tBottom < 0.0) {
      if (tTop < 0.0) { tMax = 0.0; } else { tMax = tTop; }
    } else {
      if (tTop > 0.0) { tMax = min(tTop, tBottom); } else { tMax = tBottom; }
    }

    for (var s = 0.0; s < sampleCount; s = s + 1.0) {
      let newT = tMax * ((s + segmentT) / sampleCount);
      let dt = newT - tPrev;
      let P = worldPos + worldDir * newT;
      let pHeight = length(P);
      let altitude = pHeight - bottomRadius;
      let up = P / max(pHeight, 1e-6);

      // medium
      let densityMie = exp(mieDensityExpScale * altitude);
      let densityRay = exp(rayleighDensityExpScale * altitude);
      let ozo0 = absorptionDensity0LinearTerm * altitude + absorptionDensity0ConstantTerm;
      let ozo1 = absorptionDensity1LinearTerm * altitude + absorptionDensity1ConstantTerm;
      let densityOzo = saturate(select(ozo1, ozo0, altitude < absorptionDensity0LayerWidth));
      let scattering = mieScattering * densityMie + rayleighScattering * densityRay;
      let extinction = mieExtinction * densityMie + rayleighScattering * densityRay + absorptionExtinction * densityOzo;
      let extSafe = max(extinction, vec3<f32>(1e-6, 1e-6, 1e-6));

      let sampleTransmittance = exp(-extinction * dt);

      // transmittance to sun (Bruneton uv, manual bilinear)
      let sunZenithCos = dot(sunDir, up);
      let rho = sqrt(max(0.0, pHeight * pHeight - botR2));
      let disc = pHeight * pHeight * (sunZenithCos * sunZenithCos - 1.0) + topR2;
      let dSun = max(0.0, -pHeight * sunZenithCos + sqrt(max(disc, 0.0)));
      let tU = vec2<f32>((dSun - (topRadius - pHeight)) / max((rho + H) - (topRadius - pHeight), 1e-20), rho / max(H, 1e-20));
      let transmittanceToSun = bilinearSample2D(transmittanceLut, tU);

      let phaseTimesScattering = scattering * uniformPhase;

      let shadowOrigin = P + up * OFFSET;
      let tEarth = raySphereIntersectNearest(shadowOrigin, sunDir, earthO, bottomRadius);
      let earthShadow = select(1.0, 0.0, tEarth >= 0.0);

      let S = earthShadow * transmittanceToSun * phaseTimesScattering;
      let Sint = (S - S * sampleTransmittance) / extSafe;
      L = L + throughput * Sint;

      let MSint = (scattering - scattering * sampleTransmittance) / extSafe;
      multiScatAs1 = multiScatAs1 + throughput * MSint;

      throughput = throughput * sampleTransmittance;
      tPrev = newT;
    }

    // ground bounce
    if (tBottom > 0.0 && tMax == tBottom) {
      let Pg = worldPos + worldDir * tBottom;
      let pHeightG = length(Pg);
      let upG = Pg / max(pHeightG, 1e-6);
      let sunZenithCosG = dot(sunDir, upG);
      let rhoG = sqrt(max(0.0, pHeightG * pHeightG - botR2));
      let discG = pHeightG * pHeightG * (sunZenithCosG * sunZenithCosG - 1.0) + topR2;
      let dSunG = max(0.0, -pHeightG * sunZenithCosG + sqrt(max(discG, 0.0)));
      let tUG = vec2<f32>((dSunG - (topRadius - pHeightG)) / max((rhoG + H) - (topRadius - pHeightG), 1e-20), rhoG / max(H, 1e-20));
      let transmittanceToSunG = bilinearSample2D(transmittanceLut, tUG);
      let NdotL = saturate(dot(normalize(upG), normalize(sunDir)));
      L = L + transmittanceToSunG * throughput * NdotL * groundAlbedo / PI;
    }

    totalL = totalL + L * sampleWeight;
    totalMSA = totalMSA + multiScatAs1 * sampleWeight;
  }

  let isotropicPhase = 1.0 / (4.0 * PI);
  let inScattered = totalL * isotropicPhase;
  let msaFinal = totalMSA * isotropicPhase;
  let oneMinusR = max(vec3<f32>(1.0, 1.0, 1.0) - msaFinal, vec3<f32>(1e-6, 1e-6, 1e-6));
  return inScattered / oneMinusR;
}
`
);

const raySphereFn = /* @__PURE__ */ wgslFn(RAY_SPHERE);
const uvToTransmittanceLutParamsFn = /* @__PURE__ */ wgslFn(UV_TO_TRANSMITTANCE);
const rayleighPhaseFn = /* @__PURE__ */ wgslFn(RAYLEIGH_PHASE);
const hgPhaseFn = /* @__PURE__ */ wgslFn(HG_PHASE);
const bilinearSample2DFn = /* @__PURE__ */ wgslFn(BILINEAR_SAMPLE_2D);
const transmittanceLutPixelFn = /* @__PURE__ */ wgslFn(TRANSMITTANCE_LUT_PIXEL, [
  raySphereFn,
  uvToTransmittanceLutParamsFn
]);
const getSphericalDirFn = /* @__PURE__ */ wgslFn(SPHERICAL_DIR);
const skyViewLutPixelFn = /* @__PURE__ */ wgslFn(SKYVIEW_LUT_PIXEL, [
  raySphereFn,
  rayleighPhaseFn,
  hgPhaseFn,
  bilinearSample2DFn
]);
const multiScatterLutPixelFn = /* @__PURE__ */ wgslFn(MULTISCATTER_LUT_PIXEL, [
  getSphericalDirFn,
  raySphereFn,
  bilinearSample2DFn
]);
function atmosphereDensityArgs(params) {
  return {
    mieDensityExpScale: params.mieDensityExpScale,
    rayleighDensityExpScale: params.rayleighDensityExpScale,
    absorptionDensity0LayerWidth: params.absorptionDensity0LayerWidth,
    absorptionDensity0LinearTerm: params.absorptionDensity0LinearTerm,
    absorptionDensity0ConstantTerm: params.absorptionDensity0ConstantTerm,
    absorptionDensity1LinearTerm: params.absorptionDensity1LinearTerm,
    absorptionDensity1ConstantTerm: params.absorptionDensity1ConstantTerm
  };
}
function transmittanceLutColorNode(uvNode, params) {
  return transmittanceLutPixelFn({
    uv: uvNode,
    bottomRadius: params.bottomRadius,
    topRadius: params.topRadius,
    ...atmosphereDensityArgs(params),
    mieExtinction: params.mieExtinction,
    rayleighScattering: params.rayleighScattering,
    absorptionExtinction: params.absorptionExtinction
  });
}
function skyViewLutColorNode(uvNode, params, transmittanceTex, multiScatterTex, sunDirNode, viewHeightNode) {
  return skyViewLutPixelFn({
    uv: uvNode,
    transmittanceLut: texture(transmittanceTex),
    multiScatterLut: texture(multiScatterTex),
    sunDirWorld: sunDirNode,
    viewHeightIn: viewHeightNode,
    bottomRadius: params.bottomRadius,
    topRadius: params.topRadius,
    ...atmosphereDensityArgs(params),
    mieScattering: params.mieScattering,
    mieExtinction: params.mieExtinction,
    rayleighScattering: params.rayleighScattering,
    absorptionExtinction: params.absorptionExtinction,
    miePhaseG: params.miePhaseG,
    groundAlbedo: params.groundAlbedo
  });
}
function multiScatterLutColorNode(uvNode, params, transmittanceTex) {
  return multiScatterLutPixelFn({
    uv: uvNode,
    transmittanceLut: texture(transmittanceTex),
    bottomRadius: params.bottomRadius,
    topRadius: params.topRadius,
    ...atmosphereDensityArgs(params),
    mieScattering: params.mieScattering,
    mieExtinction: params.mieExtinction,
    rayleighScattering: params.rayleighScattering,
    absorptionExtinction: params.absorptionExtinction,
    groundAlbedo: params.groundAlbedo
  });
}

var __defProp$b = Object.defineProperty;
var __defNormalProp$b = (obj, key, value) => key in obj ? __defProp$b(obj, key, { enumerable: true, configurable: true, writable: true, value }) : obj[key] = value;
var __publicField$b = (obj, key, value) => __defNormalProp$b(obj, typeof key !== "symbol" ? key + "" : key, value);
const _quadMesh$2 = /* @__PURE__ */ new QuadMesh();
let _rendererState$2;
class TransmittanceLUT {
  constructor(renderer, { resolution = LUT_RESOLUTIONS.transmittance, atmosphereUniforms, backend = "auto" } = {}) {
    __publicField$b(this, "renderer");
    __publicField$b(this, "resolution");
    __publicField$b(this, "atmosphereUniforms");
    __publicField$b(this, "backend");
    __publicField$b(this, "renderTarget");
    __publicField$b(this, "material");
    if (!atmosphereUniforms) throw new Error("TransmittanceLUT: atmosphereUniforms is required");
    this.renderer = renderer;
    this.resolution = { ...resolution };
    this.atmosphereUniforms = atmosphereUniforms;
    this.backend = backend;
    this.renderTarget = new RenderTarget(resolution.width, resolution.height, {
      type: HalfFloatType,
      minFilter: LinearFilter,
      magFilter: LinearFilter,
      wrapS: ClampToEdgeWrapping,
      wrapT: ClampToEdgeWrapping,
      generateMipmaps: false,
      depthBuffer: false
    });
    this.renderTarget.texture.name = "TransmittanceLUT";
    this.material = new NodeMaterial();
    this.material.name = "TransmittanceLUT";
    this.material.colorNode = this._buildColorNode();
  }
  get texture() {
    return this.renderTarget.texture;
  }
  _buildColorNode() {
    const params = this.atmosphereUniforms;
    const isWebGPU = this.renderer.backend?.isWebGPUBackend === true;
    const useWGSL = this.backend === "wgsl" || this.backend === "auto" && isWebGPU;
    if (useWGSL) {
      return vec4(transmittanceLutColorNode(uv(), params), float(1));
    }
    const SAMPLE_COUNT = 40;
    const SAMPLE_SEGMENT_T = 0.3;
    return Fn(() => {
      const lutUv = uv();
      const { viewHeight, viewZenithCosAngle } = uvToTransmittanceLutParams(lutUv, params);
      const worldPos = vec3(float(0), viewHeight, float(0));
      const sinZ = sqrt(max(float(0), float(1).sub(viewZenithCosAngle.mul(viewZenithCosAngle))));
      const worldDir = vec3(sinZ, viewZenithCosAngle, float(0));
      const earthO = vec3(0, 0, 0);
      const tBottom = raySphereIntersectNearest(worldPos, worldDir, earthO, params.bottomRadius);
      const tTop = raySphereIntersectNearest(worldPos, worldDir, earthO, params.topRadius);
      const tMaxIfNoBottom = tTop.lessThan(0).select(float(0), tTop);
      const tMaxIfBoth = tTop.greaterThan(0).select(tTop.min(tBottom), tBottom);
      const tMax = tBottom.lessThan(0).select(tMaxIfNoBottom, tMaxIfBoth).toVar();
      const opticalDepth = vec3(0, 0, 0).toVar();
      const tPrev = float(0).toVar();
      const tCur = float(0).toVar();
      for (let s = 0; s < SAMPLE_COUNT; s++) {
        const newT = tMax.mul(float(s + SAMPLE_SEGMENT_T).div(float(SAMPLE_COUNT)));
        const dt = newT.sub(tPrev);
        tCur.assign(newT);
        const P = worldPos.add(worldDir.mul(tCur));
        const height = P.length().sub(params.bottomRadius);
        const medium = computeScatteringAbsorption(height, params);
        opticalDepth.addAssign(medium.extinction.mul(dt));
        tPrev.assign(newT);
      }
      const transmittance = exp(opticalDepth.negate());
      return vec4(transmittance, float(1));
    })();
  }
  /**
   * Execute the fragment pass into the render target. Cheap to call repeatedly —
   * the atmosphere uniforms are bound by reference, so each call uses whatever
   * is currently in `atmosphereUniforms`.
   */
  render() {
    const renderer = this.renderer;
    _rendererState$2 = RendererUtils.resetRendererState(renderer, _rendererState$2);
    renderer.setRenderTarget(this.renderTarget);
    _quadMesh$2.material = this.material;
    _quadMesh$2.name = "TransmittanceLUT";
    _quadMesh$2.render(renderer);
    RendererUtils.restoreRendererState(renderer, _rendererState$2);
  }
  dispose() {
    this.renderTarget.dispose();
    this.material.dispose();
  }
}

var __defProp$a = Object.defineProperty;
var __defNormalProp$a = (obj, key, value) => key in obj ? __defProp$a(obj, key, { enumerable: true, configurable: true, writable: true, value }) : obj[key] = value;
var __publicField$a = (obj, key, value) => __defNormalProp$a(obj, typeof key !== "symbol" ? key + "" : key, value);
const _quadMesh$1 = /* @__PURE__ */ new QuadMesh();
let _rendererState$1;
const SQRT_SAMPLE_COUNT = 8;
const RAYMARCH_SAMPLE_COUNT = 20;
class MultiScatterLUT {
  constructor(renderer, {
    resolution = LUT_RESOLUTIONS.multiScatter,
    atmosphereUniforms,
    transmittanceLUT,
    debugMode = null,
    backend = "auto"
  } = {}) {
    __publicField$a(this, "renderer");
    __publicField$a(this, "resolution");
    __publicField$a(this, "atmosphereUniforms");
    __publicField$a(this, "transmittanceLUT");
    __publicField$a(this, "debugMode");
    __publicField$a(this, "backend");
    __publicField$a(this, "renderTarget");
    __publicField$a(this, "material");
    if (!atmosphereUniforms) throw new Error("MultiScatterLUT: atmosphereUniforms is required");
    if (!transmittanceLUT) throw new Error("MultiScatterLUT: transmittanceLUT is required");
    this.renderer = renderer;
    this.resolution = { ...resolution };
    this.atmosphereUniforms = atmosphereUniforms;
    this.transmittanceLUT = transmittanceLUT;
    this.debugMode = debugMode;
    this.backend = backend;
    this.renderTarget = new RenderTarget(resolution.width, resolution.height, {
      type: HalfFloatType,
      minFilter: LinearFilter,
      magFilter: LinearFilter,
      wrapS: ClampToEdgeWrapping,
      wrapT: ClampToEdgeWrapping,
      generateMipmaps: false,
      depthBuffer: false
    });
    this.renderTarget.texture.name = "MultiScatterLUT";
    this.material = new NodeMaterial();
    this.material.name = "MultiScatterLUT";
    this.material.colorNode = this._buildColorNode();
  }
  get texture() {
    return this.renderTarget.texture;
  }
  _buildColorNode() {
    const params = this.atmosphereUniforms;
    const transmittanceTex = this.transmittanceLUT.texture;
    const lutWidth = this.resolution.width;
    const lutHeight = this.resolution.height;
    const debugMode = this.debugMode;
    const isWebGPU = this.renderer.backend?.isWebGPUBackend === true;
    const useWGSL = !debugMode && (this.backend === "wgsl" || this.backend === "auto" && isWebGPU);
    if (useWGSL) {
      return vec4(multiScatterLutColorNode(uv(), params, transmittanceTex), float(1));
    }
    return Fn(() => {
      const rawUv = uv();
      const corrU = rawUv.x.sub(float(0.5 / lutWidth)).mul(float(lutWidth / (lutWidth - 1)));
      const corrV = rawUv.y.sub(float(0.5 / lutHeight)).mul(float(lutHeight / (lutHeight - 1)));
      if (debugMode === "uv") return vec4(rawUv.x, rawUv.y, 0, 1);
      if (debugMode === "params") {
        const cSZ = corrU.mul(2).sub(1).mul(0.5).add(0.5);
        return vec4(cSZ, corrV, 0, 1);
      }
      const cosSunZenith = corrU.mul(2).sub(1);
      const sunDir = vec3(float(0), sqrt(saturate(float(1).sub(cosSunZenith.mul(cosSunZenith)))), cosSunZenith);
      const PRO = float(0.01);
      const atmosphereThickness = params.topRadius.sub(params.bottomRadius).sub(PRO);
      const viewHeight = params.bottomRadius.add(saturate(corrV.add(PRO)).mul(atmosphereThickness));
      const worldPos = vec3(float(0), float(0), viewHeight);
      if (debugMode === "trans-sample") {
        const sampleUv = vec2(corrU, corrV);
        return vec4(texture(transmittanceTex, sampleUv).rgb, 1);
      }
      if (debugMode === "first-dir") {
        const sqrtN_ = float(SQRT_SAMPLE_COUNT);
        const dir = getSphericalDir(float(0.5), float(0.5), sqrtN_);
        return vec4(dir.mul(0.5).add(0.5), 1);
      }
      const sqrtN = float(SQRT_SAMPLE_COUNT);
      const sphereSolidAngle = float(4).mul(PI);
      const sampleWeight = sphereSolidAngle.div(sqrtN.mul(sqrtN));
      const totalL = vec3(0, 0, 0).toVar();
      const totalMSA = vec3(0, 0, 0).toVar();
      const L = vec3(0, 0, 0).toVar();
      const throughput = vec3(1, 1, 1).toVar();
      const multiScatAs1 = vec3(0, 0, 0).toVar();
      const tPrev = float(0).toVar();
      const tMax = float(0).toVar();
      const earthO = vec3(0, 0, 0);
      const SAMPLE_SEGMENT_T = 0.3;
      const PRO_BIAS = float(0.01);
      const extEps = float(1e-6);
      const uniformPhase = float(1).div(float(4).mul(PI));
      if (debugMode === "loop-count") {
        const counter = float(0).toVar();
        Loop({ start: 0, end: SQRT_SAMPLE_COUNT * SQRT_SAMPLE_COUNT, type: "int" }, () => {
          counter.addAssign(float(1 / (SQRT_SAMPLE_COUNT * SQRT_SAMPLE_COUNT)));
        });
        return vec4(counter, 0, 0, 1);
      }
      if (debugMode === "inner-loop") {
        const counter = float(0).toVar();
        Loop({ start: 0, end: RAYMARCH_SAMPLE_COUNT, type: "int" }, () => {
          counter.addAssign(float(1 / RAYMARCH_SAMPLE_COUNT));
        });
        return vec4(counter, 0, 0, 1);
      }
      if (debugMode === "lit-20") {
        const counter = float(0).toVar();
        Loop({ start: 0, end: 20, type: "int" }, () => {
          counter.addAssign(float(0.05));
        });
        return vec4(counter, 0, 0, 1);
      }
      if (debugMode === "loop-simple") {
        const counter = float(0).toVar();
        Loop(20, () => {
          counter.addAssign(float(0.05));
        });
        return vec4(counter, 0, 0, 1);
      }
      if (debugMode === "nested") {
        const counter = float(0).toVar();
        Loop(2, () => {
          Loop(5, () => {
            counter.addAssign(float(0.1));
          });
        });
        return vec4(counter, 0, 0, 1);
      }
      Loop({ start: 0, end: SQRT_SAMPLE_COUNT * SQRT_SAMPLE_COUNT, type: "int" }, ({ i: idx }) => {
        const idxF = float(idx);
        const iF = floor(idxF.div(sqrtN));
        const jF = idxF.sub(iF.mul(sqrtN));
        const iPlusHalf = iF.add(float(0.5));
        const jPlusHalf = jF.add(float(0.5));
        const worldDir = getSphericalDir(iPlusHalf, jPlusHalf, sqrtN);
        L.assign(vec3(0, 0, 0));
        throughput.assign(vec3(1, 1, 1));
        multiScatAs1.assign(vec3(0, 0, 0));
        tPrev.assign(float(0));
        const tBottom = raySphereIntersectNearest(worldPos, worldDir, earthO, params.bottomRadius);
        const tTop = raySphereIntersectNearest(worldPos, worldDir, earthO, params.topRadius);
        const tMaxIfNoBottom = tTop.lessThan(0).select(float(0), tTop);
        const tMaxIfBoth = tTop.greaterThan(0).select(tTop.min(tBottom), tBottom);
        tMax.assign(tBottom.lessThan(0).select(tMaxIfNoBottom, tMaxIfBoth));
        Loop({ start: 0, end: RAYMARCH_SAMPLE_COUNT, type: "int" }, ({ i: s }) => {
          const newT = tMax.mul(float(s).add(float(SAMPLE_SEGMENT_T)).div(float(RAYMARCH_SAMPLE_COUNT)));
          const dt = newT.sub(tPrev);
          const P = worldPos.add(worldDir.mul(newT));
          const pHeight = length(P);
          const altitude = pHeight.sub(params.bottomRadius);
          const upVector = P.div(max(pHeight, float(1e-6)));
          const medium = computeScatteringAbsorption(altitude, params);
          const extSafe = max(medium.extinction, vec3(extEps, extEps, extEps));
          const sampleOpticalDepth = medium.extinction.mul(dt);
          const sampleTransmittance = exp(sampleOpticalDepth.negate());
          const sunZenithCos = dot(sunDir, upVector);
          const tLutUv = transmittanceLutParamsToUv(pHeight, sunZenithCos, params);
          const transmittanceToSun = texture(transmittanceTex, tLutUv).rgb;
          const phaseTimesScattering = medium.scattering.mul(uniformPhase);
          const shadowOrigin = P.add(upVector.mul(PRO_BIAS));
          const tEarth = raySphereIntersectNearest(shadowOrigin, sunDir, earthO, params.bottomRadius);
          const earthShadow = select(tEarth.greaterThanEqual(0), float(0), float(1));
          const S = earthShadow.mul(transmittanceToSun).mul(phaseTimesScattering);
          const Sint = S.sub(S.mul(sampleTransmittance)).div(extSafe);
          L.addAssign(throughput.mul(Sint));
          const MSv = medium.scattering;
          const MSint = MSv.sub(MSv.mul(sampleTransmittance)).div(extSafe);
          multiScatAs1.addAssign(throughput.mul(MSint));
          throughput.assign(throughput.mul(sampleTransmittance));
          tPrev.assign(newT);
        });
        const hitGround = tBottom.greaterThan(0).and(tMax.equal(tBottom));
        const Pg = worldPos.add(worldDir.mul(tBottom));
        const pHeightG = length(Pg);
        const upG = Pg.div(max(pHeightG, float(1e-6)));
        const sunZenithCosG = dot(sunDir, upG);
        const tLutUvG = transmittanceLutParamsToUv(pHeightG, sunZenithCosG, params);
        const transmittanceToSunG = texture(transmittanceTex, tLutUvG).rgb;
        const NdotL = saturate(dot(normalize(upG), normalize(sunDir)));
        const groundL = transmittanceToSunG.mul(throughput).mul(NdotL).mul(params.groundAlbedo).div(PI);
        L.assign(select(hitGround, L.add(groundL), L));
        totalL.addAssign(L.mul(sampleWeight));
        totalMSA.addAssign(multiScatAs1.mul(sampleWeight));
      });
      if (debugMode === "totalL-raw") return vec4(totalL, 1);
      if (debugMode === "totalMSA-raw") return vec4(totalMSA, 1);
      const isotropicPhase = float(1).div(sphereSolidAngle);
      const inScatteredLuminance = totalL.mul(isotropicPhase);
      const multiScatAs1Final = totalMSA.mul(isotropicPhase);
      const oneMinusR = max(float(1).sub(multiScatAs1Final), vec3(1e-6, 1e-6, 1e-6));
      const Lfinal = inScatteredLuminance.div(oneMinusR);
      return vec4(Lfinal, float(1));
    })();
  }
  render() {
    const renderer = this.renderer;
    _rendererState$1 = RendererUtils.resetRendererState(renderer, _rendererState$1);
    renderer.setRenderTarget(this.renderTarget);
    _quadMesh$1.material = this.material;
    _quadMesh$1.name = "MultiScatterLUT";
    _quadMesh$1.render(renderer);
    RendererUtils.restoreRendererState(renderer, _rendererState$1);
  }
  dispose() {
    this.renderTarget.dispose();
    this.material.dispose();
  }
}

var __defProp$9 = Object.defineProperty;
var __defNormalProp$9 = (obj, key, value) => key in obj ? __defProp$9(obj, key, { enumerable: true, configurable: true, writable: true, value }) : obj[key] = value;
var __publicField$9 = (obj, key, value) => __defNormalProp$9(obj, typeof key !== "symbol" ? key + "" : key, value);
const _quadMesh = /* @__PURE__ */ new QuadMesh();
let _rendererState;
const SAMPLE_COUNT = 30;
class SkyViewLUT {
  constructor(renderer, {
    resolution = LUT_RESOLUTIONS.skyView,
    atmosphereUniforms,
    transmittanceLUT,
    multiScatterLUT,
    sunDirection,
    backend = "auto"
  } = {}) {
    __publicField$9(this, "renderer");
    __publicField$9(this, "resolution");
    __publicField$9(this, "atmosphereUniforms");
    __publicField$9(this, "transmittanceLUT");
    __publicField$9(this, "multiScatterLUT");
    __publicField$9(this, "backend");
    __publicField$9(this, "_sunDirectionUniform");
    __publicField$9(this, "_viewHeightUniform");
    __publicField$9(this, "renderTarget");
    __publicField$9(this, "material");
    if (!atmosphereUniforms) throw new Error("SkyViewLUT: atmosphereUniforms is required");
    if (!transmittanceLUT) throw new Error("SkyViewLUT: transmittanceLUT is required");
    if (!multiScatterLUT) throw new Error("SkyViewLUT: multiScatterLUT is required");
    this.renderer = renderer;
    this.resolution = { ...resolution };
    this.atmosphereUniforms = atmosphereUniforms;
    this.transmittanceLUT = transmittanceLUT;
    this.multiScatterLUT = multiScatterLUT;
    this.backend = backend;
    const initialSun = sunDirection instanceof Vector3 ? sunDirection.clone() : new Vector3(0, 0, 1);
    this._sunDirectionUniform = uniform(initialSun);
    this._viewHeightUniform = uniform(atmosphereUniforms.bottomRadius.value + 0.01);
    this.renderTarget = new RenderTarget(resolution.width, resolution.height, {
      type: HalfFloatType,
      minFilter: LinearFilter,
      magFilter: LinearFilter,
      wrapS: ClampToEdgeWrapping,
      wrapT: ClampToEdgeWrapping,
      generateMipmaps: false,
      depthBuffer: false
    });
    this.renderTarget.texture.name = "SkyViewLUT";
    this.material = new NodeMaterial();
    this.material.name = "SkyViewLUT";
    this.material.colorNode = this._buildColorNode();
  }
  get texture() {
    return this.renderTarget.texture;
  }
  /** Current sun direction as a Vector3 (returned by reference — mutate in place
   * or go through the setter to re-copy). */
  get sunDirection() {
    return this._sunDirectionUniform.value;
  }
  set sunDirection(v) {
    if (v instanceof Vector3) this._sunDirectionUniform.value.copy(v);
    else if (Array.isArray(v)) this._sunDirectionUniform.value.fromArray(v);
    else if (v && typeof v === "object") this._sunDirectionUniform.value.set(v.x, v.y, v.z);
  }
  /** Planet-centred camera height in km. Setter for phase 2 per-frame updates. */
  get viewHeight() {
    return this._viewHeightUniform.value;
  }
  set viewHeight(km) {
    this._viewHeightUniform.value = km;
  }
  _buildColorNode() {
    const params = this.atmosphereUniforms;
    const transmittanceTex = this.transmittanceLUT.texture;
    const multiScatterTex = this.multiScatterLUT.texture;
    const sunDirU = this._sunDirectionUniform;
    const viewHeightU = this._viewHeightUniform;
    const isWebGPU = this.renderer.backend?.isWebGPUBackend === true;
    const useWGSL = this.backend === "wgsl" || this.backend === "auto" && isWebGPU;
    if (useWGSL) {
      return vec4(
        skyViewLutColorNode(uv(), params, transmittanceTex, multiScatterTex, sunDirU, viewHeightU),
        float(1)
      );
    }
    return Fn(() => {
      const lutUv = uv();
      const viewHeight = max(viewHeightU, params.bottomRadius.add(float(0.01)));
      const { viewZenithCosAngle, lightViewCosAngle } = uvToSkyViewLutParams(params, viewHeight, lutUv);
      const upVector = vec3(0, 0, 1);
      const sunZenithCosAngle = dot(upVector, normalize(sunDirU));
      const sunDirSinZ = sqrt(max(float(1).sub(sunZenithCosAngle.mul(sunZenithCosAngle)), float(0)));
      const sunDir = vec3(sunDirSinZ, float(0), sunZenithCosAngle);
      const worldPos = vec3(float(0), float(0), viewHeight).toVar();
      const vzSin = sqrt(max(float(1).sub(viewZenithCosAngle.mul(viewZenithCosAngle)), float(0)));
      const worldDir = vec3(
        vzSin.mul(lightViewCosAngle),
        vzSin.mul(sqrt(max(float(1).sub(lightViewCosAngle.mul(lightViewCosAngle)), float(0)))),
        viewZenithCosAngle
      ).toVar();
      const clipped = moveToTopAtmosphere(worldPos, worldDir, params);
      worldPos.assign(clipped.newPos);
      const ss = integrateScatteredLuminance({
        worldPos,
        worldDir,
        sunDir,
        params,
        transmittanceLUT: transmittanceTex,
        multiScatterLUT: multiScatterTex,
        sampleCount: SAMPLE_COUNT,
        ground: true,
        mieRayPhase: true
      });
      return vec4(ss.L, float(1));
    })();
  }
  render() {
    const renderer = this.renderer;
    _rendererState = RendererUtils.resetRendererState(renderer, _rendererState);
    renderer.setRenderTarget(this.renderTarget);
    _quadMesh.material = this.material;
    _quadMesh.name = "SkyViewLUT";
    _quadMesh.render(renderer);
    RendererUtils.restoreRendererState(renderer, _rendererState);
  }
  dispose() {
    this.renderTarget.dispose();
    this.material.dispose();
  }
}

var __defProp$8 = Object.defineProperty;
var __defNormalProp$8 = (obj, key, value) => key in obj ? __defProp$8(obj, key, { enumerable: true, configurable: true, writable: true, value }) : obj[key] = value;
var __publicField$8 = (obj, key, value) => __defNormalProp$8(obj, typeof key !== "symbol" ? key + "" : key, value);
class AerialPerspectiveLUT {
  constructor(renderer, {
    resolution = { x: 32, y: 32, z: 32 },
    // 8 km/slice × 32 slices = 256 km coverage. Hillaire's reference uses
    // 4 km/slice (128 km), but at horizon-grazing rays the full atmosphere
    // extends well beyond that, leaving a brightness gap where AP under-
    // integrates relative to the Sky-View LUT — visible as a residual dark
    // fringe on distant silhouettes. 256 km closes the gap for ground-based
    // scenes; further coverage starts losing near-camera precision.
    kmPerSlice = 8,
    atmosphereUniforms,
    transmittanceLUT,
    multiScatterLUT,
    sunDirection
  } = {}) {
    __publicField$8(this, "renderer");
    __publicField$8(this, "resolution");
    __publicField$8(this, "kmPerSlice");
    __publicField$8(this, "atmosphereUniforms");
    __publicField$8(this, "transmittanceLUT");
    __publicField$8(this, "multiScatterLUT");
    __publicField$8(this, "_tex");
    __publicField$8(this, "_sunDirection");
    __publicField$8(this, "_cameraPosKm");
    __publicField$8(this, "_invProj");
    __publicField$8(this, "_cameraMatrixWorld");
    __publicField$8(this, "_compute");
    if (!atmosphereUniforms) throw new Error("AerialPerspectiveLUT: atmosphereUniforms is required");
    if (!transmittanceLUT) throw new Error("AerialPerspectiveLUT: transmittanceLUT is required");
    if (!multiScatterLUT) throw new Error("AerialPerspectiveLUT: multiScatterLUT is required");
    this.renderer = renderer;
    this.resolution = { ...resolution };
    this.kmPerSlice = kmPerSlice;
    this.atmosphereUniforms = atmosphereUniforms;
    this.transmittanceLUT = transmittanceLUT;
    this.multiScatterLUT = multiScatterLUT;
    this._tex = new Storage3DTexture(resolution.x, resolution.y, resolution.z);
    this._tex.type = HalfFloatType;
    this._tex.format = RGBAFormat;
    this._tex.minFilter = LinearFilter;
    this._tex.magFilter = LinearFilter;
    this._tex.wrapS = ClampToEdgeWrapping;
    this._tex.wrapT = ClampToEdgeWrapping;
    this._tex.wrapR = ClampToEdgeWrapping;
    this._tex.name = "AerialPerspectiveLUT";
    this._sunDirection = uniform(sunDirection instanceof Vector3 ? sunDirection.clone() : new Vector3(0, 1, 0));
    this._cameraPosKm = uniform(new Vector3(0, atmosphereUniforms.bottomRadius.value + 1e-3, 0));
    this._invProj = uniform(new Matrix4());
    this._cameraMatrixWorld = uniform(new Matrix4());
    this._compute = this._buildCompute();
  }
  /** The 3D storage texture; bind as `texture( ap.texture, vec3 uvw )`
   * (NDC.xy + sqrt(slice/resZ) on Z) at consume time. */
  get texture() {
    return this._tex;
  }
  /** Camera inverse-projection uniform — kept in sync by `setCamera()`. */
  get invProjUniform() {
    return this._invProj;
  }
  /** Camera world-matrix uniform — kept in sync by `setCamera()`. */
  get cameraWorldUniform() {
    return this._cameraMatrixWorld;
  }
  /** Camera position (km, planet-centred) uniform — kept in sync by `setCamera()`. */
  get cameraPositionKmUniform() {
    return this._cameraPosKm;
  }
  /**
   * Set the sun direction (Y-up world space, normalized). The same vector you
   * pass to `SkyAtmosphereBaker.setSun(...)` works here.
   */
  setSunDirection(v) {
    if (v instanceof Vector3) this._sunDirection.value.copy(v);
    else if (Array.isArray(v)) this._sunDirection.value.fromArray(v);
  }
  /**
   * Bind the AP LUT to a Three.js camera. Must be called every frame the
   * camera moves (or its projection changes). The LUT does NOT internally
   * cache `camera` — it only reads matrices at this call.
   *
   * Internally:
   *  - cameraPosKm = true planet-centred camera vector when `planetCenter` is supplied.
   *    Otherwise the legacy flat convention is used:
   *    (0, bottomRadius + camera.y_world_meters · 0.001, 0)
   *  - invProj = camera.projectionMatrixInverse
   *  - cameraMatrixWorld = camera.matrixWorld
   */
  setCamera(camera, { planetCenter = null } = {}) {
    camera.updateMatrixWorld();
    camera.updateProjectionMatrix();
    const bottomR = this.atmosphereUniforms.bottomRadius.value;
    if (planetCenter) {
      this._cameraPosKm.value.copy(camera.position).sub(planetCenter).multiplyScalar(1e-3);
    } else {
      this._cameraPosKm.value.set(0, bottomR + camera.position.y * 1e-3, 0);
    }
    this._invProj.value.copy(camera.projectionMatrixInverse);
    this._cameraMatrixWorld.value.copy(camera.matrixWorld);
  }
  /** Dispatch the compute pass. Cheap (~1ms on a mid-tier GPU). */
  async render() {
    await this.renderer.computeAsync(this._compute);
  }
  dispose() {
    this._tex.dispose();
  }
  _buildCompute() {
    const params = this.atmosphereUniforms;
    const transmittanceTex = this.transmittanceLUT.texture;
    const multiScatterTex = this.multiScatterLUT.texture;
    const sunDirU = this._sunDirection;
    const cameraPosKmU = this._cameraPosKm;
    const invProjU = this._invProj;
    const cameraWorldU = this._cameraMatrixWorld;
    const tex = this._tex;
    const resX = this.resolution.x;
    const resY = this.resolution.y;
    const resZ = this.resolution.z;
    const kmPerSlice = this.kmPerSlice;
    const total = resX * resY * resZ;
    const fn = Fn(() => {
      const idx = instanceIndex;
      const x = idx.mod(uint(resX));
      const y = idx.div(uint(resX)).mod(uint(resY));
      const z = idx.div(uint(resX * resY));
      const fx = float(x);
      const fy = float(y);
      const fz = float(z);
      const ndcX = fx.add(0.5).div(float(resX)).mul(2).sub(1);
      const ndcY = float(1).sub(fy.add(0.5).div(float(resY)).mul(2));
      const clip = vec4(ndcX, ndcY, float(0.5), float(1));
      const viewH = invProjU.mul(clip);
      const viewPos = viewH.xyz.div(viewH.w);
      const worldDirRaw = cameraWorldU.mul(vec4(viewPos, float(0))).xyz;
      const worldDir = normalize(worldDirRaw);
      const w = fz.add(0.5).div(float(resZ));
      const sliceLin = w.mul(w).mul(float(resZ));
      const tMax = sliceLin.mul(float(kmPerSlice)).toVar();
      const camPosKm = cameraPosKmU.toVar();
      const PLANET_RADIUS_OFFSET = 0.01;
      const minHeight = params.bottomRadius.add(float(PLANET_RADIUS_OFFSET));
      const worldDirV = worldDir.toVar();
      const newWorldPos = camPosKm.add(worldDirV.mul(tMax)).toVar();
      const newViewHeight = length(newWorldPos);
      const belowGround = newViewHeight.lessThanEqual(minHeight);
      const groundShellHeight = minHeight.add(float(1e-3));
      const groundedPos = normalize(newWorldPos).mul(groundShellHeight);
      const correctedDir = normalize(groundedPos.sub(camPosKm));
      const correctedT = length(groundedPos.sub(camPosKm));
      worldDirV.assign(select(belowGround, correctedDir, worldDirV));
      tMax.assign(select(belowGround, correctedT, tMax));
      const moved = moveToTopAtmosphere(camPosKm, worldDirV, params);
      const startPos = moved.newPos.toVar();
      const result = integrateScatteredLuminance({
        worldPos: startPos,
        worldDir: worldDirV,
        sunDir: normalize(sunDirU),
        params,
        transmittanceLUT: transmittanceTex,
        multiScatterLUT: multiScatterTex,
        sampleCount: 30,
        ground: false,
        mieRayPhase: true,
        tMaxOverride: tMax
      });
      const meanT = result.transmittance.x.add(result.transmittance.y).add(result.transmittance.z).div(3);
      const alpha = float(1).sub(meanT);
      const validF = moved.valid.select(float(1), float(0));
      textureStore(tex, ivec3(int(x), int(y), int(z)), vec4(result.L.mul(validF), alpha.mul(validF)));
    });
    return fn().compute(total, [4, 4, 4]);
  }
}

const proceduralStars = /* @__PURE__ */ Fn(([uvNode, densityNode, brightnessScaleNode]) => {
  const GRID_U = float(400);
  const GRID_V = float(200);
  const scaledUv = vec2(uvNode.x.mul(GRID_U), uvNode.y.mul(GRID_V));
  const cell = floor(scaledUv);
  const local = fract(scaledUv);
  const h0 = _hash21(cell, vec2(12.9898, 78.233));
  const h1 = _hash21(cell, vec2(39.346, 11.135));
  const h2 = _hash21(cell, vec2(73.156, 52.235));
  const h3 = _hash21(cell, vec2(26.782, 91.453));
  const h4 = _hash21(cell, vec2(51.937, 21.118));
  const present = step(h0, densityNode);
  const margin = float(0.2);
  const span = float(1).sub(margin.mul(2));
  const centre = vec2(margin.add(h1.mul(span)), margin.add(h2.mul(span)));
  const radius = float(0.012).add(h3.mul(0.025));
  const dist = length(local.sub(centre));
  const shape = smoothstep(radius, radius.mul(0.2), dist);
  const magnitude = pow(h3, float(2)).mul(brightnessScaleNode);
  const warm = vec3(1, 0.85, 0.65);
  const cool = vec3(0.7, 0.85, 1);
  const colour = mix(warm, cool, h4);
  return colour.mul(shape).mul(magnitude).mul(present);
});
function _hash21(p, seed) {
  const k = dot(p, seed);
  return fract(sin(k).mul(43758.5453));
}

var __defProp$7 = Object.defineProperty;
var __defNormalProp$7 = (obj, key, value) => key in obj ? __defProp$7(obj, key, { enumerable: true, configurable: true, writable: true, value }) : obj[key] = value;
var __publicField$7 = (obj, key, value) => __defNormalProp$7(obj, typeof key !== "symbol" ? key + "" : key, value);
function _makeStarsPlaceholder() {
  const data = new Uint16Array(4);
  const tex = new DataTexture(data, 1, 1, RGBAFormat, HalfFloatType);
  tex.minFilter = LinearFilter;
  tex.magFilter = LinearFilter;
  tex.wrapS = RepeatWrapping;
  tex.wrapT = RepeatWrapping;
  tex.needsUpdate = true;
  tex.name = "SkyAtmosphereMesh.starsPlaceholder";
  return tex;
}
class SkyAtmosphereMesh extends Mesh {
  /**
   * @param {object} args
   * @param {object} args.atmosphereUniforms  bundle from createAtmosphereUniforms
   * @param {SkyViewLUT} args.skyViewLUT      already-constructed Sky-View LUT
   * @param {TransmittanceLUT} [args.transmittanceLUT]  required for the
   *   space-view raymarch fallback (camera viewHeight > topRadius). Optional
   *   for ground-only callers; without it, the mesh stays in pure SkyView mode.
   * @param {MultiScatterLUT} [args.multiScatterLUT]  paired with transmittanceLUT.
   * @param {THREE.Vector3} [args.sunDirection]  initial Y-up world-space sun dir
   * @param {THREE.Vector3} [args.upVector]      initial Y-up world-space up dir
   */
  constructor({
    atmosphereUniforms,
    skyViewLUT,
    transmittanceLUT = null,
    multiScatterLUT = null,
    sunDirection,
    upVector
  } = {}) {
    if (!atmosphereUniforms) throw new Error("SkyAtmosphereMesh: atmosphereUniforms is required");
    if (!skyViewLUT) throw new Error("SkyAtmosphereMesh: skyViewLUT is required");
    const material = new NodeMaterial();
    super(new BoxGeometry(1, 1, 1), material);
    __publicField$7(this, "atmosphereUniforms");
    __publicField$7(this, "skyViewLUT");
    __publicField$7(this, "transmittanceLUT");
    __publicField$7(this, "multiScatterLUT");
    __publicField$7(this, "sunDirection");
    __publicField$7(this, "upVector");
    __publicField$7(this, "showSunDisc");
    __publicField$7(this, "mirrorBelowHorizon");
    __publicField$7(this, "sunDiscIntensity");
    __publicField$7(this, "sunDiscCos");
    __publicField$7(this, "sunDiscCosInner");
    __publicField$7(this, "moonDirection");
    __publicField$7(this, "showMoonDisc");
    __publicField$7(this, "moonIntensity");
    __publicField$7(this, "moonDiscCos");
    __publicField$7(this, "moonColor");
    __publicField$7(this, "viewHeight");
    __publicField$7(this, "luminanceScale");
    __publicField$7(this, "_starsTexturePlaceholder");
    __publicField$7(this, "starsTextureNode");
    __publicField$7(this, "starsIntensity");
    __publicField$7(this, "starsMode");
    __publicField$7(this, "starsDensity");
    __publicField$7(this, "starsBrightnessScale");
    __publicField$7(this, "starsRotation");
    __publicField$7(this, "isSkyAtmosphereMesh");
    this.atmosphereUniforms = atmosphereUniforms;
    this.skyViewLUT = skyViewLUT;
    this.transmittanceLUT = transmittanceLUT;
    this.multiScatterLUT = multiScatterLUT;
    this.sunDirection = uniform(sunDirection instanceof Vector3 ? sunDirection.clone() : new Vector3(0, 1, 0));
    this.upVector = uniform(upVector instanceof Vector3 ? upVector.clone() : new Vector3(0, 1, 0));
    this.showSunDisc = uniform(0);
    this.mirrorBelowHorizon = uniform(0);
    this.sunDiscIntensity = uniform(20);
    this.sunDiscCos = uniform(Math.cos(4675e-6));
    this.sunDiscCosInner = uniform(Math.cos(4675e-6 * (1 - 0.1)));
    this.moonDirection = uniform(new Vector3(0, 1, 0));
    this.showMoonDisc = uniform(0);
    this.moonIntensity = uniform(1);
    this.moonDiscCos = uniform(Math.cos(4675e-6));
    this.moonColor = uniform(new Vector3(0.85, 0.9, 1));
    this.viewHeight = uniform(atmosphereUniforms.bottomRadius.value + 0.01);
    this.luminanceScale = uniform(40);
    this._starsTexturePlaceholder = _makeStarsPlaceholder();
    this.starsTextureNode = texture(this._starsTexturePlaceholder);
    this.starsIntensity = uniform(0);
    this.starsMode = uniform(0);
    this.starsDensity = uniform(0.3);
    this.starsBrightnessScale = uniform(1);
    this.starsRotation = uniform(0);
    this.isSkyAtmosphereMesh = true;
    const vertexNode = /* @__PURE__ */ Fn(() => {
      const position = modelViewProjection;
      position.z.assign(position.w);
      return position;
    })();
    const colorNode = this._buildColorNode();
    material.side = BackSide;
    material.depthWrite = true;
    material.vertexNode = vertexNode;
    material.colorNode = colorNode;
  }
  /**
   * Set the sun disc's angular size and rim softness. `halfAngleRad` is
   * half the disc's angular *diameter* (the physical Sun is ≈0.535°
   * diameter → ≈0.00465 rad half-angle). `edgeSoftness` is the fraction of
   * `halfAngleRad` over which the disc ramps from opaque to transparent at
   * its rim (0 = perfectly hard/aliased edge, 1 = the whole disc is a soft
   * gradient with no flat core). Both `sunDiscCos` (outer bound) and
   * `sunDiscCosInner` (inner bound) are recomputed here in one JS-side call
   * so the shader never needs a per-pixel `acos`.
   */
  setSunAngularRadius(halfAngleRad, edgeSoftness = 0.1) {
    this.sunDiscCos.value = Math.cos(halfAngleRad);
    this.sunDiscCosInner.value = Math.cos(halfAngleRad * (1 - edgeSoftness));
    return this;
  }
  _buildColorNode() {
    const params = this.atmosphereUniforms;
    const skyViewTex = this.skyViewLUT.texture;
    const transmittanceTex = this.transmittanceLUT ? this.transmittanceLUT.texture : null;
    const multiScatterTex = this.multiScatterLUT ? this.multiScatterLUT.texture : null;
    const enableSpaceFallback = transmittanceTex !== null && multiScatterTex !== null;
    const sunDirU = this.sunDirection;
    const upU = this.upVector;
    const showSunDiscU = this.showSunDisc;
    const sunDiscIntensityU = this.sunDiscIntensity;
    const sunDiscCosU = this.sunDiscCos;
    const sunDiscCosInnerU = this.sunDiscCosInner;
    const luminanceScaleU = this.luminanceScale;
    const viewHeightU = this.viewHeight;
    const starsTexNode = this.starsTextureNode;
    const starsIntensityU = this.starsIntensity;
    const starsModeU = this.starsMode;
    const starsDensityU = this.starsDensity;
    const starsBrightnessU = this.starsBrightnessScale;
    const starsRotationU = this.starsRotation;
    const moonDirU = this.moonDirection;
    const showMoonDiscU = this.showMoonDisc;
    const moonIntensityU = this.moonIntensity;
    const moonDiscCosU = this.moonDiscCos;
    const moonColorU = this.moonColor;
    const mirrorBelowHorizonU = this.mirrorBelowHorizon;
    return Fn(() => {
      const viewDirRaw = normalize(positionWorld.sub(cameraPosition));
      const upVec = normalize(upU);
      const sunDir = normalize(sunDirU);
      const vAlongUp = dot(viewDirRaw, upVec);
      const vAlongUpEffective = mix(vAlongUp, abs(vAlongUp), mirrorBelowHorizonU);
      const viewDirHorizontal = viewDirRaw.sub(upVec.mul(vAlongUp));
      const viewDir = normalize(viewDirHorizontal.add(upVec.mul(vAlongUpEffective)));
      const viewHeight = max(viewHeightU, params.bottomRadius.add(float(0.01)));
      const viewZenithCosAngle = clamp(dot(viewDir, upVec), float(-1), float(1));
      const sideRaw = cross(upVec, viewDir);
      const sideLen = max(length(sideRaw), float(1e-6));
      const sideVector = sideRaw.div(sideLen);
      const forwardVector = normalize(cross(sideVector, upVec));
      const lightOnPlaneX = dot(sunDir, forwardVector);
      const lightOnPlaneY = dot(sunDir, sideVector);
      const lightOnPlaneLen = max(length(vec2(lightOnPlaneX, lightOnPlaneY)), float(1e-6));
      const lightViewCosAngle = clamp(lightOnPlaneX.div(lightOnPlaneLen), float(-1), float(1));
      const earthO = vec3(0, 0, 0);
      const ro = upVec.mul(viewHeight);
      const tPlanet = raySphereIntersectNearest(ro, viewDir, earthO, params.bottomRadius);
      const intersectsGround = tPlanet.greaterThanEqual(float(0));
      const skyMask = intersectsGround.select(float(0), float(1));
      const skyColor = vec3(0, 0, 0).toVar();
      if (enableSpaceFallback) {
        const BLEND_HALF_WIDTH_KM = float(20);
        const blendStart = params.topRadius.sub(BLEND_HALF_WIDTH_KM);
        const blendEnd = params.topRadius.add(BLEND_HALF_WIDTH_KM);
        const lutUv = skyViewLutParamsToUv(params, intersectsGround, viewZenithCosAngle, lightViewCosAngle, viewHeight);
        const lutColor = texture(skyViewTex, lutUv).rgb.mul(luminanceScaleU);
        const rayColor = vec3(0, 0, 0).toVar();
        If(viewHeight.greaterThan(blendStart), () => {
          const camPos = upVec.mul(viewHeight);
          const moved = moveToTopAtmosphere(camPos, viewDir, params);
          const startPos = moved.newPos.toVar();
          const result = integrateScatteredLuminance({
            worldPos: startPos,
            worldDir: viewDir,
            sunDir,
            params,
            transmittanceLUT: transmittanceTex,
            multiScatterLUT: multiScatterTex,
            sampleCount: 30,
            ground: true,
            mieRayPhase: true
          });
          const validF = moved.valid.select(float(1), float(0));
          rayColor.assign(result.L.mul(luminanceScaleU).mul(validF));
        });
        const blendT = smoothstep(blendStart, blendEnd, viewHeight);
        skyColor.assign(mix(lutColor, rayColor, blendT));
      } else {
        const lutUv = skyViewLutParamsToUv(params, intersectsGround, viewZenithCosAngle, lightViewCosAngle, viewHeight);
        skyColor.assign(texture(skyViewTex, lutUv).rgb.mul(luminanceScaleU));
      }
      const tToSpace = vec3(1, 1, 1).toVar();
      if (transmittanceTex !== null) {
        const tToSpaceUv = transmittanceLutParamsToUv(viewHeight, viewZenithCosAngle, params);
        tToSpace.assign(texture(transmittanceTex, tToSpaceUv).rgb);
      }
      const starsContribution = vec3(0, 0, 0).toVar();
      if (transmittanceTex !== null) {
        const cosR = cos(starsRotationU);
        const sinR = sin(starsRotationU);
        const starsDir = vec3(
          viewDir.x.mul(cosR).add(viewDir.z.mul(sinR)),
          viewDir.y,
          viewDir.x.mul(sinR).negate().add(viewDir.z.mul(cosR))
        );
        const starsUv = equirectUV(starsDir);
        const proceduralRaw = proceduralStars(starsUv, starsDensityU, starsBrightnessU);
        const textureRaw = starsTexNode.sample(starsUv).rgb;
        const starsRaw = mix(proceduralRaw, textureRaw, starsModeU);
        starsContribution.assign(starsRaw.mul(tToSpace).mul(starsIntensityU).mul(skyMask));
      }
      const cosSun = dot(viewDir, sunDir);
      const sunAngularMask = smoothstep(sunDiscCosU, sunDiscCosInnerU, cosSun);
      const sunDiscMask = sunAngularMask.mul(showSunDiscU).mul(skyMask);
      const sunContribution = tToSpace.mul(sunDiscMask).mul(sunDiscIntensityU);
      const moonDir = normalize(moonDirU);
      const cosMoon = dot(viewDir, moonDir);
      const moonDiscMask = smoothstep(moonDiscCosU, moonDiscCosU.add(float(2e-5)), cosMoon).mul(showMoonDiscU);
      const moonContribution = moonColorU.mul(moonDiscMask).mul(moonIntensityU);
      return vec4(skyColor.add(starsContribution).add(sunContribution).add(moonContribution), float(1));
    })();
  }
}

var __defProp$6 = Object.defineProperty;
var __defNormalProp$6 = (obj, key, value) => key in obj ? __defProp$6(obj, key, { enumerable: true, configurable: true, writable: true, value }) : obj[key] = value;
var __publicField$6 = (obj, key, value) => __defNormalProp$6(obj, typeof key !== "symbol" ? key + "" : key, value);
class SkyAtmosphereBaker {
  constructor(renderer, {
    cubeSize = 256,
    atmosphere,
    lutResolutions,
    enableAerialPerspective = true,
    // AP coverage knobs — exposed at the baker level so callers can opt
    // into orbit-friendly long-range AP without reaching into the LUT.
    // Default 8 km/slice × 32 slices = 256 km, matching SebH's reference
    // for a ground-level demo. For planet-scale views (camera at 100 km+
    // altitude looking down at a globe) bump kmPerSlice to ~32 for
    // ~1024 km coverage at the cost of close-range slice resolution.
    // Whatever value lands here MUST match the `kmPerSlice` passed to
    // `createHazeOutputNode` so the LUT and the consumer agree.
    apKmPerSlice = 8,
    // Optional AP volume resolution override for diagnostics / high-cost
    // quality tests. Default stays inside AerialPerspectiveLUT (32³).
    apResolution = void 0,
    // When true, the cube bake folds the sky mesh's below-horizon view
    // rays to above-horizon before the LUT sample — the lower hemisphere
    // of `texture` and `environmentTexture` becomes a clean Y-mirror of
    // the upper hemisphere instead of the LUT's lit-ground-albedo
    // content. Useful when the consumer scene has reflective floors or
    // uses `GroundedSkybox` in reflective mode, so PBR IBL doesn't pick
    // up a coloured ground tint from below.
    //
    // Implementation: toggles the sky mesh's `mirrorBelowHorizon`
    // uniform on for the cube bake only (live mesh in main scene
    // continues to show real below-horizon LUT content). Zero extra
    // render passes — the cube bake itself is unchanged in cost.
    //
    // Off by default; callers must opt in.
    mirrorBelowHorizon = false
  } = {}) {
    __publicField$6(this, "renderer");
    __publicField$6(this, "cubeSize");
    __publicField$6(this, "lutResolutions");
    __publicField$6(this, "atmosphereParams");
    __publicField$6(this, "atmosphereUniforms");
    __publicField$6(this, "transmittanceLUT");
    __publicField$6(this, "multiScatterLUT");
    __publicField$6(this, "skyViewLUT");
    __publicField$6(this, "aerialPerspectiveLUT");
    __publicField$6(this, "apKmPerSlice");
    __publicField$6(this, "skyScene");
    __publicField$6(this, "sky");
    __publicField$6(this, "cubeRenderTarget");
    __publicField$6(this, "cubeCamera");
    __publicField$6(this, "_mirrorBelowHorizon");
    __publicField$6(this, "pmremGenerator");
    __publicField$6(this, "_pmremTarget");
    __publicField$6(this, "sunDirty");
    __publicField$6(this, "atmosDirty");
    __publicField$6(this, "cubeDirty");
    __publicField$6(this, "cameraDirty");
    __publicField$6(this, "_sunVec");
    __publicField$6(this, "_skyViewSunZenith");
    __publicField$6(this, "_sunListeners");
    __publicField$6(this, "_camera");
    __publicField$6(this, "_cameraPositionKm");
    __publicField$6(this, "_cameraUp");
    __publicField$6(this, "_cameraAltitudeM");
    __publicField$6(this, "_lastSkyViewHeightKm");
    __publicField$6(this, "_lastSkyViewZenith");
    __publicField$6(this, "_lastCubeZenith");
    this.renderer = renderer;
    this.cubeSize = cubeSize;
    this.lutResolutions = { ...LUT_RESOLUTIONS, ...lutResolutions || {} };
    this.atmosphereParams = mergeAtmosphereParams(EARTH, atmosphere);
    this.atmosphereUniforms = createAtmosphereUniforms(this.atmosphereParams);
    this.transmittanceLUT = new TransmittanceLUT(renderer, {
      resolution: this.lutResolutions.transmittance,
      atmosphereUniforms: this.atmosphereUniforms
    });
    this.multiScatterLUT = new MultiScatterLUT(renderer, {
      resolution: this.lutResolutions.multiScatter,
      atmosphereUniforms: this.atmosphereUniforms,
      transmittanceLUT: this.transmittanceLUT
    });
    this.skyViewLUT = new SkyViewLUT(renderer, {
      resolution: this.lutResolutions.skyView,
      atmosphereUniforms: this.atmosphereUniforms,
      transmittanceLUT: this.transmittanceLUT,
      multiScatterLUT: this.multiScatterLUT
    });
    if (enableAerialPerspective) {
      this.aerialPerspectiveLUT = new AerialPerspectiveLUT(renderer, {
        resolution: apResolution,
        atmosphereUniforms: this.atmosphereUniforms,
        transmittanceLUT: this.transmittanceLUT,
        multiScatterLUT: this.multiScatterLUT,
        kmPerSlice: apKmPerSlice
      });
      this.apKmPerSlice = apKmPerSlice;
    } else {
      this.aerialPerspectiveLUT = null;
      this.apKmPerSlice = apKmPerSlice;
    }
    this.skyScene = new Scene();
    this.sky = new SkyAtmosphereMesh({
      atmosphereUniforms: this.atmosphereUniforms,
      skyViewLUT: this.skyViewLUT,
      transmittanceLUT: this.transmittanceLUT,
      multiScatterLUT: this.multiScatterLUT
    });
    this.sky.scale.setScalar(45e4);
    this.skyScene.add(this.sky);
    this.cubeRenderTarget = new CubeRenderTarget(cubeSize, {
      type: HalfFloatType,
      minFilter: LinearMipmapLinearFilter,
      magFilter: LinearFilter,
      generateMipmaps: true
    });
    this.cubeCamera = new CubeCamera(1, 1e6, this.cubeRenderTarget);
    this.skyScene.add(this.cubeCamera);
    this._mirrorBelowHorizon = mirrorBelowHorizon;
    this.pmremGenerator = new PMREMGenerator(renderer);
    this.pmremGenerator.compileCubemapShader();
    this._pmremTarget = null;
    this.sunDirty = true;
    this.atmosDirty = true;
    this.cubeDirty = true;
    this.cameraDirty = true;
    this._sunVec = new Vector3(0, 1, 0);
    this._sunListeners = /* @__PURE__ */ new Set();
    this._camera = null;
    this._cameraPositionKm = new Vector3(0, this.atmosphereUniforms.bottomRadius.value + 1e-3, 0);
    this._cameraUp = new Vector3(0, 1, 0);
    this._skyViewSunZenith = 1;
    this._cameraAltitudeM = 1;
    this._lastSkyViewHeightKm = NaN;
    this._lastSkyViewZenith = NaN;
    this._lastCubeZenith = NaN;
  }
  get texture() {
    return this.cubeRenderTarget.texture;
  }
  get environmentTexture() {
    return this._pmremTarget ? this._pmremTarget.texture : null;
  }
  /** 3D Aerial Perspective LUT texture (phase 2). `null` if AP was disabled. */
  get aerialPerspectiveTexture() {
    return this.aerialPerspectiveLUT ? this.aerialPerspectiveLUT.texture : null;
  }
  get cameraPositionKm() {
    return this._cameraPositionKm;
  }
  get cameraAltitudeM() {
    return this._cameraAltitudeM;
  }
  get cameraUp() {
    return this._cameraUp;
  }
  /**
   * Phase 2: bind the main scene camera. Updates viewHeight on the
   * Sky-View LUT and mesh (so altitude is reflected in the sky), and
   * matrices on the AP LUT (so haze depth volume is camera-aligned).
   *
   * Should be called every frame the camera moves. Sets `cameraDirty` so
   * the next `update()` refreshes Sky-View. The AP LUT is updated by the
   * separate `updateAerialPerspective()` since it needs to fire every frame
   * regardless of any flags.
   */
  setCamera(camera, { planetCenter = null } = {}) {
    this._camera = camera;
    camera.updateMatrixWorld();
    const bottomR = this.atmosphereUniforms.bottomRadius.value;
    const bottomRadiusM = bottomR * 1e3;
    let viewHeightKm;
    if (planetCenter) {
      const cameraFromCenterM = camera.position.clone().sub(planetCenter);
      const cameraRadiusM = cameraFromCenterM.length();
      viewHeightKm = cameraRadiusM * 1e-3;
      this._cameraAltitudeM = cameraRadiusM - bottomRadiusM;
      this._cameraUp.copy(cameraFromCenterM).normalize();
      this._cameraPositionKm.copy(cameraFromCenterM).multiplyScalar(1e-3);
    } else {
      viewHeightKm = bottomR + camera.position.y * 1e-3;
      this._cameraAltitudeM = camera.position.y;
      this._cameraUp.set(0, 1, 0);
      this._cameraPositionKm.set(0, viewHeightKm, 0);
    }
    this.skyViewLUT.viewHeight = viewHeightKm;
    this.sky.viewHeight.value = viewHeightKm;
    this.sky.upVector.value.copy(this._cameraUp);
    this._syncSkyViewSunFrame();
    if (!(Math.abs(this._skyViewSunZenith - this._lastCubeZenith) <= 1e-3)) {
      this.cubeDirty = true;
    }
    if (this.aerialPerspectiveLUT) {
      this.aerialPerspectiveLUT.setCamera(camera, { planetCenter });
    }
    const heightChanged = !(Math.abs(viewHeightKm - this._lastSkyViewHeightKm) <= 1e-6);
    const zenithChanged = !(Math.abs(this._skyViewSunZenith - this._lastSkyViewZenith) <= 1e-6);
    if (heightChanged || zenithChanged) {
      this.cameraDirty = true;
    }
  }
  /**
   * Push the sun direction into the SkyView LUT's Z-up local frame, using the
   * sun's zenith cosine *relative to the camera's local up* — not the flat
   * world +Y. The LUT's horizon-packed parameterization is only valid when its
   * baked sun zenith matches the sun-vs-local-up angle the mesh computes its
   * sample scalars against (`SkyAtmosphereMesh` uses `upVector`, which
   * `setCamera` keeps radial in planet mode).
   *
   * Flat mode: cameraUp = +Y, so `sunVec · up = sin(elevation)` — identical to
   * the historical behaviour.
   */
  _syncSkyViewSunFrame() {
    const sinEff = MathUtils.clamp(this._sunVec.dot(this._cameraUp), -1, 1);
    const cosEff = Math.sqrt(Math.max(0, 1 - sinEff * sinEff));
    this._skyViewSunZenith = sinEff;
    this.skyViewLUT.sunDirection = new Vector3(cosEff, 0, sinEff);
  }
  /**
   * Set sun direction from (elevation, azimuth) in degrees. Convention matches
   * the legacy example:
   *   phi   = 90 - elevation   (polar angle from +Y)
   *   theta = azimuth
   *
   * The resulting Y-up world vector goes to the sky mesh. The SkyView LUT lives
   * in a Z-up local frame; we feed it a vector whose z-component equals the
   * sun's zenith cosine (= sin(elevation) = world.y) so its internal
   * `dot(up=(0,0,1), sunDir)` lands on the correct value. The LUT does not use
   * sun azimuth internally — azimuth is consumed by the mesh at sample time via
   * `lightViewCosAngle`.
   */
  setSun({ elevation, azimuth }) {
    const phi = MathUtils.degToRad(90 - elevation);
    const theta = MathUtils.degToRad(azimuth);
    this._sunVec.setFromSphericalCoords(1, phi, theta);
    this.sky.sunDirection.value.copy(this._sunVec);
    this._syncSkyViewSunFrame();
    if (this.aerialPerspectiveLUT) {
      this.aerialPerspectiveLUT.setSunDirection(this._sunVec);
    }
    this.sunDirty = true;
    this.cubeDirty = true;
    for (const fn of this._sunListeners) fn(this._sunVec);
  }
  /**
   * Subscribe to sun-direction changes. The listener fires after every
   * `setSun()` call with the current Y-up world-space sun vector (passed by
   * reference — clone in your callback if you need to keep a copy).
   *
   * @param {(sunVec: Vector3) => void} fn
   * @returns {() => void} unsubscribe function
   */
  addSunListener(fn) {
    this._sunListeners.add(fn);
    return () => this._sunListeners.delete(fn);
  }
  removeSunListener(fn) {
    this._sunListeners.delete(fn);
  }
  setAtmosphereParams(partial) {
    this.atmosphereParams = mergeAtmosphereParams(this.atmosphereParams, partial);
    updateAtmosphereUniforms(this.atmosphereUniforms, this.atmosphereParams);
    this.atmosDirty = true;
    this.cubeDirty = true;
  }
  /**
   * Mark the cube bake as stale. Useful when something mutated sky uniforms
   * directly without going through setSun/setAtmosphereParams.
   */
  markCubeDirty() {
    this.cubeDirty = true;
  }
  /**
   * Toggle the below-horizon Y-mirror on the cube bake. When `true`, the
   * next bake fills the cube's lower hemisphere with a clean Y-mirror of
   * the sky instead of the LUT's lit-ground-albedo content; the live sky
   * mesh in the main scene is unaffected. Forces a cube re-bake.
   */
  setMirrorBelowHorizon(flag) {
    this._mirrorBelowHorizon = !!flag;
    this.cubeDirty = true;
  }
  /**
   * Mode B factory — return a sky mesh that the caller can add to their main
   * scene as a far-plane background. Shares the underlying material and
   * uniforms with the baker's internal `this.sky`, so `setSun` / `setCamera`
   * propagate automatically to both meshes.
   *
   * Use this when you want a *live* sky (per-frame `setCamera`-driven Sky-View
   * sample, sun-disc visible) instead of using `baker.texture` as a static
   * `scene.background`. The cube bake still runs on sun-dirty for IBL — the
   * filtered `baker.environmentTexture` remains the recommended
   * `scene.environment`.
   *
   * Sun disc is enabled by default on the live mesh (cube bake still
   * temporarily forces it off during the bake to keep PMREM clean).
   *
   * @param {object} [opts]
   * @param {number} [opts.scale=450000] uniform scale of the sky box.
   * @param {boolean} [opts.showSunDisc=true] flip the disc on for all meshes
   *   sharing this material; the cube bake still hides it.
   * @returns {THREE.Mesh}
   */
  createSkyMesh({ scale = 45e4, showSunDisc = true } = {}) {
    const mesh = new Mesh(this.sky.geometry, this.sky.material);
    mesh.scale.setScalar(scale);
    mesh.frustumCulled = false;
    mesh.renderOrder = -1;
    if (showSunDisc) this.sky.showSunDisc.value = 1;
    return mesh;
  }
  /**
   * Caller-driven. Does nothing unless something is dirty. Re-runs only the
   * stages of the pipeline whose inputs changed.
   */
  update() {
    const skyDirty = this.atmosDirty || this.sunDirty || this.cameraDirty;
    if (!this.cubeDirty && !skyDirty) return;
    if (this.atmosDirty) {
      this.transmittanceLUT.render();
      this.multiScatterLUT.render();
      this.skyViewLUT.render();
    } else if (this.sunDirty || this.cameraDirty) {
      this.skyViewLUT.render();
    }
    if (skyDirty) {
      this._lastSkyViewHeightKm = this.sky.viewHeight.value;
      this._lastSkyViewZenith = this._skyViewSunZenith;
    }
    const skyContentChanged = this.atmosDirty || this.sunDirty || this.cubeDirty;
    if (skyContentChanged) {
      const prevShowSunDisc = this.sky.showSunDisc.value;
      const prevShowMoonDisc = this.sky.showMoonDisc.value;
      const prevMirror = this.sky.mirrorBelowHorizon.value;
      this.sky.showSunDisc.value = 0;
      this.sky.showMoonDisc.value = 0;
      this.sky.mirrorBelowHorizon.value = this._mirrorBelowHorizon ? 1 : 0;
      this.cubeCamera.update(this.renderer, this.skyScene);
      this.sky.showSunDisc.value = prevShowSunDisc;
      this.sky.showMoonDisc.value = prevShowMoonDisc;
      this.sky.mirrorBelowHorizon.value = prevMirror;
      if (this._pmremTarget === null) {
        this._pmremTarget = this.pmremGenerator.fromCubemap(this.cubeRenderTarget.texture);
      } else {
        this.pmremGenerator.fromCubemap(this.cubeRenderTarget.texture, this._pmremTarget);
      }
      this._lastCubeZenith = this._skyViewSunZenith;
    }
    this.sunDirty = false;
    this.atmosDirty = false;
    this.cubeDirty = false;
    this.cameraDirty = false;
  }
  /**
   * Run the per-frame Aerial Perspective LUT compute pass. Caller invokes
   * each frame after `setCamera()` has been called. Cheap (~1ms on mid GPU).
   *
   * Separated from `update()` because AP must refresh per frame regardless
   * of dirty flags, while `update()` is dirty-driven.
   */
  async updateAerialPerspective() {
    if (!this.aerialPerspectiveLUT) return;
    await this.aerialPerspectiveLUT.render();
  }
  dispose() {
    this.transmittanceLUT.dispose();
    this.multiScatterLUT.dispose();
    this.skyViewLUT.dispose();
    if (this.aerialPerspectiveLUT) this.aerialPerspectiveLUT.dispose();
    this.cubeRenderTarget.dispose();
    if (this._pmremTarget) this._pmremTarget.dispose();
    this.pmremGenerator.dispose();
    if (this.sky.material) this.sky.material.dispose();
    if (this.sky.geometry) this.sky.geometry.dispose();
    this.skyScene.remove(this.sky);
    this.skyScene.remove(this.cubeCamera);
  }
}

var __defProp$5 = Object.defineProperty;
var __defNormalProp$5 = (obj, key, value) => key in obj ? __defProp$5(obj, key, { enumerable: true, configurable: true, writable: true, value }) : obj[key] = value;
var __publicField$5 = (obj, key, value) => __defNormalProp$5(obj, typeof key !== "symbol" ? key + "" : key, value);
class GroundedSkybox extends Mesh {
  /**
   * @param {THREE.CubeTexture} cube — typically `baker.texture`.
   * @param {object} [opts]
   * @param {number} [opts.height=4]     camera-eye height above the floor. A
   *   larger value magnifies the downward part of the image; tune to taste.
   * @param {number} [opts.radius=200]   sphere radius. Must comfortably
   *   exceed the camera's working range so it never escapes the dome.
   * @param {number} [opts.resolution=128]  sphere tessellation; higher =
   *   smoother projection transition at the horizon, more vertices.
   * @param {boolean} [opts.reflective=false]  if true, the disc samples the
   *   cube via the view-direction reflected about the world-up axis — a
   *   "wet pavement" / mirror floor look. The dome portion still samples
   *   directly. Floor reflection picks up the *sky*, not lit ground.
   */
  constructor(cube, { height = 4, radius = 200, resolution = 128, reflective = false } = {}) {
    if (height <= 0 || radius <= 0 || resolution <= 0) {
      throw new Error("GroundedSkybox: height, radius, and resolution must be positive.");
    }
    const geometry = new SphereGeometry(radius, 2 * resolution, resolution);
    const pos = geometry.getAttribute("position");
    const tmp = new Vector3();
    const y1 = -height * 1.5;
    for (let i = 0; i < pos.count; i++) {
      tmp.fromBufferAttribute(pos, i);
      if (tmp.y < 0) {
        const f = tmp.y < y1 ? -height / tmp.y : 1 - tmp.y * tmp.y / (3 * y1 * y1);
        tmp.multiplyScalar(f);
        tmp.toArray(pos.array, 3 * i);
      }
    }
    pos.needsUpdate = true;
    const material = new NodeMaterial();
    material.side = BackSide;
    material.depthWrite = false;
    const directDir = normalize(positionLocal);
    const viewDir = normalize(positionWorld.sub(cameraPosition));
    const reflectedDir = reflect(viewDir, vec3(0, 1, 0));
    const isDisc = positionLocal.y.lessThan(0);
    const sampleDir = reflective ? select(isDisc, reflectedDir, directDir) : directDir;
    material.colorNode = cubeTexture(cube, sampleDir, 0).rgb;
    super(geometry, material);
    __publicField$5(this, "height");
    __publicField$5(this, "radius");
    this.frustumCulled = false;
    this.renderOrder = -1;
    this.height = height;
    this.radius = radius;
    this.position.y = height;
  }
  /**
   * Per-frame helper — keep the mesh centered above the camera so the
   * projected floor stays anchored to world y=0 and the camera never
   * escapes the dome. Call from your render loop.
   *
   * @param {THREE.Camera} camera
   */
  followCamera(camera) {
    this.position.x = camera.position.x;
    this.position.z = camera.position.z;
  }
}

var __defProp$4 = Object.defineProperty;
var __defNormalProp$4 = (obj, key, value) => key in obj ? __defProp$4(obj, key, { enumerable: true, configurable: true, writable: true, value }) : obj[key] = value;
var __publicField$4 = (obj, key, value) => __defNormalProp$4(obj, typeof key !== "symbol" ? key + "" : key, value);
class SkyGround {
  constructor(sky, {
    mode = "plane",
    // plane mode
    size = 2e5,
    segments = 1,
    // sphere mode (radius defaults to baker.atmosphereParams.bottomRadius * 1000)
    radius = null,
    widthSegments = 128,
    heightSegments = 64,
    // material shortcuts (used when `material` is null)
    color = 6971477,
    roughness = 0.95,
    metalness = 0,
    material = null,
    // reflection (plane mode only)
    reflective = false,
    blur = 0,
    reflectorOptions = {
      resolutionScale: 0.5,
      generateMipmaps: false,
      bounces: false
    },
    receiveShadow = true
  } = {}) {
    __publicField$4(this, "sky");
    __publicField$4(this, "mode");
    __publicField$4(this, "reflector");
    __publicField$4(this, "_scene");
    __publicField$4(this, "geometry");
    __publicField$4(this, "_sphereRadius");
    __publicField$4(this, "material");
    __publicField$4(this, "mesh");
    this.sky = sky;
    this.mode = mode;
    this.reflector = null;
    this._scene = null;
    if (mode === "sphere") {
      const r = radius ?? sky.baker.atmosphereParams.bottomRadius * 1e3;
      this.geometry = new SphereGeometry(r, widthSegments, heightSegments);
      this._sphereRadius = r;
    } else {
      this.geometry = new PlaneGeometry(size, size, segments, segments);
    }
    const wantsReflection = reflective && mode === "plane" && material === null;
    if (reflective && mode === "sphere") {
      console.warn("[SkyGround] reflective is not supported in sphere mode \u2014 falling back to non-reflective.");
    }
    if (material) {
      this.material = material;
    } else if (wantsReflection) {
      this.material = this._buildReflectiveMaterial({ color, roughness, blur, reflectorOptions });
    } else {
      this.material = new MeshStandardMaterial({ color, roughness, metalness });
    }
    this.mesh = new Mesh(this.geometry, this.material);
    this.mesh.receiveShadow = receiveShadow;
    if (mode === "sphere") {
      this.mesh.position.y = -this._sphereRadius;
    } else {
      this.mesh.rotation.x = -Math.PI / 2;
      this.mesh.position.y = 0;
    }
    if (this.reflector) this.mesh.add(this.reflector.target);
  }
  setVisible(visible) {
    this.mesh.visible = visible;
    return this;
  }
  attach(scene) {
    this._scene = scene;
    scene.add(this.mesh);
    return this;
  }
  detach() {
    if (this._scene) {
      this._scene.remove(this.mesh);
      this._scene = null;
    }
    return this;
  }
  dispose() {
    this.detach();
    this.geometry.dispose();
    if (this.material && this.material.dispose) this.material.dispose();
  }
  _buildReflectiveMaterial({
    color,
    roughness,
    blur,
    reflectorOptions
  }) {
    const reflectorNode = reflector(reflectorOptions);
    this.reflector = reflectorNode;
    const baseColorNode = vec4(new Color(color), 1);
    const sampledReflection = blur > 0 ? gaussianBlur(reflectorNode, null, blur) : reflectorNode;
    const mat = new NodeMaterial();
    mat.colorNode = mix(sampledReflection, baseColorNode, roughness);
    return mat;
  }
}

var __defProp$3 = Object.defineProperty;
var __defNormalProp$3 = (obj, key, value) => key in obj ? __defProp$3(obj, key, { enumerable: true, configurable: true, writable: true, value }) : obj[key] = value;
var __publicField$3 = (obj, key, value) => __defNormalProp$3(obj, typeof key !== "symbol" ? key + "" : key, value);
class SkyMoon {
  constructor(sky, {
    color = 11585760,
    intensity = 0.15,
    distance = 5e4,
    target = null,
    followSun = true,
    phase = 0.5,
    // Visible moon disc on the sky mesh (parallels SkySun-but-on-mesh).
    // Default ON because the moon's disc is its main visual feature.
    // Always full — no phase-shaded crescent (v1 simplification).
    showDisc = true,
    discIntensity = 1,
    discAngularDiameter = 935e-5,
    // ~0.535° matches Earth-Moon
    discColor = null,
    // null → use mesh default cool-white
    castShadow = false,
    shadowMapSize = 1024,
    shadowBias = -1e-4,
    shadowNormalBias = 0.05,
    shadowRadius = 1,
    shadowCamera = null
  } = {}) {
    __publicField$3(this, "sky");
    __publicField$3(this, "distance");
    __publicField$3(this, "followSun");
    __publicField$3(this, "phase");
    __publicField$3(this, "_mesh");
    __publicField$3(this, "light");
    __publicField$3(this, "target");
    __publicField$3(this, "_targetIntensity");
    __publicField$3(this, "_scene");
    __publicField$3(this, "_moonVec");
    __publicField$3(this, "_onSunChanged");
    __publicField$3(this, "_unsubscribe");
    this.sky = sky;
    this.distance = distance;
    this.followSun = followSun;
    this.phase = phase;
    this._mesh = sky.baker.sky;
    this.light = new DirectionalLight(color, intensity);
    this.light.castShadow = castShadow;
    this.light.shadow.mapSize.width = shadowMapSize;
    this.light.shadow.mapSize.height = shadowMapSize;
    this.light.shadow.bias = shadowBias;
    this.light.shadow.normalBias = shadowNormalBias;
    this.light.shadow.radius = shadowRadius;
    const cam = this.light.shadow.camera;
    const sc = shadowCamera || {};
    cam.left = sc.left ?? -50;
    cam.right = sc.right ?? 50;
    cam.top = sc.top ?? 50;
    cam.bottom = sc.bottom ?? -50;
    cam.near = sc.near ?? 1;
    cam.far = sc.far ?? 2e5;
    cam.updateProjectionMatrix();
    this.target = target || new Object3D();
    this.light.target = this.target;
    this._targetIntensity = intensity;
    this._scene = null;
    this._moonVec = new Vector3(0, 1, 0);
    this._mesh.showMoonDisc.value = showDisc ? 1 : 0;
    this._mesh.moonIntensity.value = discIntensity;
    this._mesh.moonDiscCos.value = Math.cos(discAngularDiameter * 0.5);
    if (discColor != null) this.setDiscColor(discColor);
    this._onSunChanged = (sunVec) => this._syncFromSun(sunVec);
    this._unsubscribe = sky.baker.addSunListener(this._onSunChanged);
    this._syncFromSun(sky.baker._sunVec);
  }
  get castShadow() {
    return this.light.castShadow;
  }
  set castShadow(value) {
    this.light.castShadow = value;
  }
  get color() {
    return this.light.color;
  }
  get intensity() {
    return this._targetIntensity;
  }
  set intensity(value) {
    this._targetIntensity = value;
    this._applyHorizonFade();
  }
  setIntensity(value) {
    this.intensity = value;
    return this;
  }
  setDistance(value) {
    this.distance = value;
    this._placeLight();
    return this;
  }
  /**
   * Set the lunar phase. 0 = new moon (moon co-located with sun, no
   * visible moonlight), 0.5 = full (anti-sun), 1 = new again.
   * Wraps modulo 1.
   */
  setPhase(phase) {
    this.phase = phase - Math.floor(phase);
    if (this.followSun) this._syncFromSun(this.sky.baker._sunVec);
    return this;
  }
  /**
   * Manual moon direction. Disables `followSun` automatically — the moon
   * stays where you put it until you call `setFollowSun(true)` again.
   *
   * `azimuth` is degrees CW from the configured `north` axis (matches
   * `sky.setSunDirection` semantics).
   */
  setDirection({ elevation, azimuth }) {
    this.followSun = false;
    const elevRad = MathUtils.degToRad(elevation);
    const azRad = MathUtils.degToRad(azimuth);
    const cosE = Math.cos(elevRad);
    const sinE = Math.sin(elevRad);
    this._moonVec.set(cosE * Math.sin(azRad), sinE, cosE * Math.cos(azRad));
    this._placeLight();
    return this;
  }
  setFollowSun(enabled) {
    this.followSun = enabled;
    if (enabled) this._syncFromSun(this.sky.baker._sunVec);
    return this;
  }
  attach(scene) {
    this._scene = scene;
    scene.add(this.light);
    scene.add(this.target);
    return this;
  }
  detach() {
    if (this._scene) {
      this._scene.remove(this.light);
      this._scene.remove(this.target);
      this._scene = null;
    }
    return this;
  }
  /**
   * Tighten the directional light's orthographic shadow frustum to enclose
   * the given world-space Box3. Identical math to `SkySun.fitShadowToBox`.
   */
  fitShadowToBox(box3) {
    if (box3.isEmpty()) return this;
    const cam = this.light.shadow.camera;
    this.light.target.updateMatrixWorld();
    this.light.updateMatrixWorld();
    cam.updateMatrixWorld();
    const corners = [
      new Vector3(box3.min.x, box3.min.y, box3.min.z),
      new Vector3(box3.min.x, box3.min.y, box3.max.z),
      new Vector3(box3.min.x, box3.max.y, box3.min.z),
      new Vector3(box3.min.x, box3.max.y, box3.max.z),
      new Vector3(box3.max.x, box3.min.y, box3.min.z),
      new Vector3(box3.max.x, box3.min.y, box3.max.z),
      new Vector3(box3.max.x, box3.max.y, box3.min.z),
      new Vector3(box3.max.x, box3.max.y, box3.max.z)
    ];
    const inv = cam.matrixWorldInverse;
    let minX = Infinity, maxX = -Infinity;
    let minY = Infinity, maxY = -Infinity;
    let minZ = Infinity, maxZ = -Infinity;
    for (const c of corners) {
      c.applyMatrix4(inv);
      if (c.x < minX) minX = c.x;
      if (c.x > maxX) maxX = c.x;
      if (c.y < minY) minY = c.y;
      if (c.y > maxY) maxY = c.y;
      if (c.z < minZ) minZ = c.z;
      if (c.z > maxZ) maxZ = c.z;
    }
    cam.left = minX;
    cam.right = maxX;
    cam.bottom = minY;
    cam.top = maxY;
    cam.near = Math.max(0.1, -maxZ - 1);
    cam.far = -minZ + 1;
    cam.updateProjectionMatrix();
    return this;
  }
  fitShadowToObject(object3D) {
    const box = new Box3().setFromObject(object3D);
    return this.fitShadowToBox(box);
  }
  dispose() {
    if (this._unsubscribe) {
      this._unsubscribe();
      this._unsubscribe = null;
    }
    this.detach();
    this.light.dispose();
  }
  _syncFromSun(sunVec) {
    if (!this.followSun) return;
    const angle = this.phase * Math.PI * 2;
    let kx = -sunVec.z;
    let ky = 0;
    let kz = sunVec.x;
    const kLen = Math.sqrt(kx * kx + kz * kz);
    if (kLen < 1e-6) {
      kx = 1;
      kz = 0;
    } else {
      kx /= kLen;
      kz /= kLen;
    }
    const c = Math.cos(angle);
    const s = Math.sin(angle);
    const oneMinusC = 1 - c;
    const kDotV = kx * sunVec.x + kz * sunVec.z;
    const crossX = ky * sunVec.z - kz * sunVec.y;
    const crossY = kz * sunVec.x - kx * sunVec.z;
    const crossZ = kx * sunVec.y - ky * sunVec.x;
    this._moonVec.set(
      sunVec.x * c + crossX * s + kx * kDotV * oneMinusC,
      sunVec.y * c + crossY * s + ky * kDotV * oneMinusC,
      sunVec.z * c + crossZ * s + kz * kDotV * oneMinusC
    );
    this._placeLight();
  }
  setDiscVisible(visible) {
    this._mesh.showMoonDisc.value = visible ? 1 : 0;
    return this;
  }
  setDiscIntensity(value) {
    this._mesh.moonIntensity.value = value;
    return this;
  }
  setDiscAngularDiameter(radians) {
    this._mesh.moonDiscCos.value = Math.cos(radians * 0.5);
    return this;
  }
  setDiscColor(color) {
    if (typeof color === "number") {
      const r = (color >> 16 & 255) / 255;
      const g = (color >> 8 & 255) / 255;
      const b = (color & 255) / 255;
      this._mesh.moonColor.value.set(r, g, b);
    } else {
      this._mesh.moonColor.value.copy(color);
    }
    return this;
  }
  _placeLight() {
    this.light.position.copy(this._moonVec).multiplyScalar(this.distance);
    this.light.target.updateMatrixWorld();
    this._applyHorizonFade();
    this._mesh.moonDirection.value.copy(this._moonVec);
  }
  _applyHorizonFade() {
    const elevDeg = MathUtils.radToDeg(Math.asin(Math.max(-1, Math.min(1, this._moonVec.y))));
    const fade = _smoothstep(-2, 0, elevDeg);
    this.light.intensity = this._targetIntensity * fade;
  }
}
function _smoothstep(edge0, edge1, x) {
  const t = Math.max(0, Math.min(1, (x - edge0) / (edge1 - edge0)));
  return t * t * (3 - 2 * t);
}

var __defProp$2 = Object.defineProperty;
var __defNormalProp$2 = (obj, key, value) => key in obj ? __defProp$2(obj, key, { enumerable: true, configurable: true, writable: true, value }) : obj[key] = value;
var __publicField$2 = (obj, key, value) => __defNormalProp$2(obj, typeof key !== "symbol" ? key + "" : key, value);
class SkyNight {
  constructor(sky) {
    __publicField$2(this, "sky");
    __publicField$2(this, "mesh");
    __publicField$2(this, "texture");
    __publicField$2(this, "source");
    __publicField$2(this, "_enabled");
    this.sky = sky;
    this.mesh = sky.baker.sky;
    this.texture = null;
    this.source = "procedural";
    this._enabled = false;
  }
  get intensity() {
    return this.mesh.starsIntensity.value;
  }
  set intensity(value) {
    this.mesh.starsIntensity.value = value;
    this.sky.baker.markCubeDirty();
  }
  get rotation() {
    return this.mesh.starsRotation.value;
  }
  set rotation(value) {
    this.mesh.starsRotation.value = value;
    this.sky.baker.markCubeDirty();
  }
  get density() {
    return this.mesh.starsDensity.value;
  }
  set density(value) {
    this.mesh.starsDensity.value = value;
    this.sky.baker.markCubeDirty();
  }
  get brightness() {
    return this.mesh.starsBrightnessScale.value;
  }
  set brightness(value) {
    this.mesh.starsBrightnessScale.value = value;
    this.sky.baker.markCubeDirty();
  }
  setIntensity(value) {
    this.intensity = value;
    return this;
  }
  setRotation(radians) {
    this.rotation = radians;
    return this;
  }
  setDensity(value) {
    this.density = value;
    return this;
  }
  setBrightness(value) {
    this.brightness = value;
    return this;
  }
  /**
   * Switch source live. Procedural keeps any HDR loaded but stops sampling
   * it; HDR requires the texture to already be bound (call `enable` with a
   * `url` or `texture` first, then `setSource('hdri')` is a no-op).
   *
   * @param {'procedural'|'hdri'} source
   */
  setSource(source) {
    if (source !== "procedural" && source !== "hdri") {
      throw new Error(`SkyNight: unknown source "${source}". Use 'procedural' or 'hdri'.`);
    }
    if (source === "hdri" && !this.texture) {
      console.warn(
        "[SkyNight] setSource('hdri') called but no texture is bound. Call enable({ source: 'hdri', url }) first."
      );
    }
    this.source = source;
    this.mesh.starsMode.value = source === "hdri" ? 1 : 0;
    this.sky.baker.markCubeDirty();
    return this;
  }
  /**
   * Turn stars on. Async because the `'hdri'` path may need to load.
   *
   * @param {object} [opts]
   * @param {'procedural'|'hdri'} [opts.source='procedural']
   * @param {string} [opts.url] HDR equirect URL (required for `'hdri'` if
   *   no `texture` is supplied). EXR or HDR formats supported.
   * @param {THREE.Texture} [opts.texture] pre-loaded equirect texture; skips
   *   the loader entirely. Implies `source: 'hdri'`.
   * @param {number} [opts.intensity=1.0] linear stars multiplier.
   * @param {number} [opts.rotation=0.0] starting rotation in radians.
   * @param {number} [opts.density=0.3] procedural density (ignored for HDR).
   * @param {number} [opts.brightness=1.0] procedural brightness (ignored for HDR).
   * @returns {Promise<SkyNight>}
   */
  async enable({
    source,
    url,
    texture: existingTexture,
    intensity = 1,
    rotation = 0,
    density,
    brightness
  } = {}) {
    const resolvedSource = source || (existingTexture || url ? "hdri" : "procedural");
    if (resolvedSource === "hdri") {
      if (existingTexture) {
        this.texture = existingTexture;
      } else if (url) {
        this.texture = await _loadEquirectHDR(url);
      } else {
        throw new Error(
          "SkyNight: source: 'hdri' requires { url } or { texture }. The bundled NightSkyHDRI is an example asset only \u2014 see examples/14-night-sky.html for usage."
        );
      }
      this.texture.minFilter = LinearFilter;
      this.texture.magFilter = LinearFilter;
      this.texture.wrapS = RepeatWrapping;
      this.texture.wrapT = RepeatWrapping;
      this.texture.needsUpdate = true;
      this.mesh.starsTextureNode.value = this.texture;
      this.mesh.starsMode.value = 1;
    } else {
      this.mesh.starsMode.value = 0;
    }
    this.source = resolvedSource;
    this.mesh.starsIntensity.value = intensity;
    this.mesh.starsRotation.value = rotation;
    if (typeof density === "number") this.mesh.starsDensity.value = density;
    if (typeof brightness === "number") this.mesh.starsBrightnessScale.value = brightness;
    this._enabled = true;
    this.sky.baker.markCubeDirty();
    return this;
  }
  /**
   * Hide stars without unloading the texture. Cheap re-enable via
   * `setIntensity( > 0 )`.
   */
  disable() {
    this.mesh.starsIntensity.value = 0;
    this._enabled = false;
    this.sky.baker.markCubeDirty();
    return this;
  }
  /**
   * Free any loaded HDR texture and revert to the placeholder. After this,
   * `enable({ source: 'hdri', ... })` must reload before HDR stars can be
   * shown again. Procedural mode is unaffected and remains available.
   */
  dispose() {
    this.disable();
    this.mesh.starsTextureNode.value = this.mesh._starsTexturePlaceholder;
    if (this.texture) {
      this.texture.dispose();
      this.texture = null;
    }
  }
}
async function _loadEquirectHDR(url) {
  const lower = url.toLowerCase().split("?")[0];
  const isExr = lower.endsWith(".exr");
  const loaderMod = isExr ? await import('three/addons/loaders/EXRLoader.js') : await import('three/addons/loaders/RGBELoader.js');
  const Loader = isExr ? loaderMod.EXRLoader : loaderMod.RGBELoader;
  const loader = new Loader();
  loader.setDataType(HalfFloatType);
  return new Promise((resolve, reject) => {
    loader.load(
      url,
      (tex) => resolve(tex),
      void 0,
      (err) => reject(err)
    );
  });
}

var __defProp$1 = Object.defineProperty;
var __defNormalProp$1 = (obj, key, value) => key in obj ? __defProp$1(obj, key, { enumerable: true, configurable: true, writable: true, value }) : obj[key] = value;
var __publicField$1 = (obj, key, value) => __defNormalProp$1(obj, typeof key !== "symbol" ? key + "" : key, value);
class SkySun {
  constructor(sky, {
    color = 16777215,
    intensity = 4,
    distance = 5e4,
    target = null,
    castShadow = true,
    shadowMapSize = 2048,
    shadowBias = -1e-4,
    shadowNormalBias = 0.05,
    shadowRadius = 1,
    shadowCamera = null
  } = {}) {
    __publicField$1(this, "sky");
    __publicField$1(this, "distance");
    __publicField$1(this, "light");
    __publicField$1(this, "target");
    __publicField$1(this, "_scene");
    __publicField$1(this, "_onSunChanged");
    __publicField$1(this, "_unsubscribe");
    this.sky = sky;
    this.distance = distance;
    this.light = new DirectionalLight(color, intensity);
    this.light.castShadow = castShadow;
    this.light.shadow.mapSize.width = shadowMapSize;
    this.light.shadow.mapSize.height = shadowMapSize;
    this.light.shadow.bias = shadowBias;
    this.light.shadow.normalBias = shadowNormalBias;
    this.light.shadow.radius = shadowRadius;
    const cam = this.light.shadow.camera;
    const sc = shadowCamera || {};
    cam.left = sc.left ?? -50;
    cam.right = sc.right ?? 50;
    cam.top = sc.top ?? 50;
    cam.bottom = sc.bottom ?? -50;
    cam.near = sc.near ?? 1;
    cam.far = sc.far ?? 2e5;
    cam.updateProjectionMatrix();
    this.target = target || new Object3D();
    this.light.target = this.target;
    this._scene = null;
    this._onSunChanged = (sunVec) => this._syncFromSunVec(sunVec);
    this._unsubscribe = sky.baker.addSunListener(this._onSunChanged);
    this._syncFromSunVec(sky.baker._sunVec);
  }
  get castShadow() {
    return this.light.castShadow;
  }
  set castShadow(value) {
    this.light.castShadow = value;
  }
  get intensity() {
    return this.light.intensity;
  }
  set intensity(value) {
    this.light.intensity = value;
  }
  setDistance(value) {
    this.distance = value;
    this._syncFromSunVec(this.sky.baker._sunVec);
    return this;
  }
  attach(scene) {
    this._scene = scene;
    scene.add(this.light);
    scene.add(this.target);
    return this;
  }
  detach() {
    if (this._scene) {
      this._scene.remove(this.light);
      this._scene.remove(this.target);
      this._scene = null;
    }
    return this;
  }
  /**
   * Tighten the directional light's orthographic shadow frustum to enclose
   * the given world-space Box3. The light's `target` (or origin if no target
   * was customised) is used as the centre of the shadow's local frame.
   */
  fitShadowToBox(box3) {
    if (box3.isEmpty()) return this;
    const cam = this.light.shadow.camera;
    this.light.target.updateMatrixWorld();
    this.light.updateMatrixWorld();
    cam.updateMatrixWorld();
    const corners = [
      new Vector3(box3.min.x, box3.min.y, box3.min.z),
      new Vector3(box3.min.x, box3.min.y, box3.max.z),
      new Vector3(box3.min.x, box3.max.y, box3.min.z),
      new Vector3(box3.min.x, box3.max.y, box3.max.z),
      new Vector3(box3.max.x, box3.min.y, box3.min.z),
      new Vector3(box3.max.x, box3.min.y, box3.max.z),
      new Vector3(box3.max.x, box3.max.y, box3.min.z),
      new Vector3(box3.max.x, box3.max.y, box3.max.z)
    ];
    const inv = cam.matrixWorldInverse;
    let minX = Infinity, maxX = -Infinity;
    let minY = Infinity, maxY = -Infinity;
    let minZ = Infinity, maxZ = -Infinity;
    for (const c of corners) {
      c.applyMatrix4(inv);
      if (c.x < minX) minX = c.x;
      if (c.x > maxX) maxX = c.x;
      if (c.y < minY) minY = c.y;
      if (c.y > maxY) maxY = c.y;
      if (c.z < minZ) minZ = c.z;
      if (c.z > maxZ) maxZ = c.z;
    }
    cam.left = minX;
    cam.right = maxX;
    cam.bottom = minY;
    cam.top = maxY;
    cam.near = Math.max(0.1, -maxZ - 1);
    cam.far = -minZ + 1;
    cam.updateProjectionMatrix();
    return this;
  }
  fitShadowToObject(object3D) {
    const box = new Box3().setFromObject(object3D);
    return this.fitShadowToBox(box);
  }
  dispose() {
    if (this._unsubscribe) {
      this._unsubscribe();
      this._unsubscribe = null;
    }
    this.detach();
    this.light.dispose();
  }
  _syncFromSunVec(sunVec) {
    this.light.position.copy(sunVec).multiplyScalar(this.distance);
    this.light.target.updateMatrixWorld();
  }
}

const presets = {
  earth: EARTH,
  mars: mergeAtmosphereParams(EARTH, {
    bottomRadius: 3389.5,
    topRadius: 3449.5,
    // ~60 km shell
    rayleighScattering: new Vector3(3e-3, 24e-4, 14e-4),
    // CO2-thin, slightly red-biased
    rayleighDensityExpScale: -1 / 11,
    // Mars scale height ~11.1 km
    mieScattering: new Vector3(0.018, 0.012, 6e-3),
    // dust
    mieExtinction: new Vector3(0.02, 0.013, 7e-3),
    mieAbsorption: new Vector3(2e-3, 1e-3, 1e-3),
    miePhaseG: 0.76,
    // strong forward-scatter
    mieDensityExpScale: -1 / 10,
    // Mars has no ozone layer of consequence — zero out the Bruneton tent.
    absorptionExtinction: new Vector3(0, 0, 0),
    ozoneAbsorption: new Vector3(0, 0, 0),
    groundAlbedo: new Vector3(0.45, 0.3, 0.18)
    // regolith
  }),
  titan: mergeAtmosphereParams(EARTH, {
    bottomRadius: 2575,
    topRadius: 2775,
    // 200 km renderer shell
    rayleighScattering: new Vector3(8e-4, 1e-3, 14e-4),
    // negligible at visible
    rayleighDensityExpScale: -1 / 25,
    // tall atmosphere
    mieScattering: new Vector3(0.02, 0.011, 4e-3),
    // tholin orange
    mieExtinction: new Vector3(0.025, 0.014, 6e-3),
    mieAbsorption: new Vector3(5e-3, 3e-3, 2e-3),
    miePhaseG: 0.85,
    // very forward-scattering haze
    mieDensityExpScale: -1 / 40,
    // haze layer is high & broad
    absorptionExtinction: new Vector3(0, 0, 0),
    ozoneAbsorption: new Vector3(0, 0, 0),
    groundAlbedo: new Vector3(0.2, 0.13, 0.06)
  })
};
function resolvePreset(nameOrObject) {
  if (typeof nameOrObject === "string") {
    const preset = presets[nameOrObject];
    if (!preset) {
      throw new Error(`Unknown sky preset: "${nameOrObject}". Available: ${Object.keys(presets).join(", ")}`);
    }
    return preset;
  }
  return nameOrObject;
}

function createHazeDepthNodes(scenePass, logarithmicDepthBuffer) {
  if (logarithmicDepthBuffer) {
    const depthTex = scenePass.getTextureNode("depth");
    const near = scenePass._cameraNear;
    const far = scenePass._cameraFar;
    const viewZNode = logarithmicDepthToViewZ(depthTex, near, far);
    const linearDepthNode = viewZToOrthographicDepth(viewZNode, near, far);
    return { viewZNode, linearDepthNode };
  }
  return {
    viewZNode: scenePass.getViewZNode(),
    linearDepthNode: scenePass.getLinearDepthNode()
  };
}

function createHazeOutputNode({
  scenePass,
  sceneColorNode = null,
  aerialPerspectiveTexture,
  luminanceScale,
  invProjUniform,
  resZ = 32,
  kmPerSlice = 8,
  // must match AerialPerspectiveLUT default
  hazeStrength = null,
  skyCube = null,
  cameraWorldUniform = null,
  cameraFarUniform = null,
  logarithmicDepthBuffer = false,
  hazeModeUniform = null,
  raymarchBlendStartKm = null,
  raymarchBlendEndKm = null,
  raymarchCoverageBlendKm = null,
  enableRaymarchFallback = false,
  raymarchSampleCount = 64,
  atmosphereUniforms = null,
  sunDirection = null,
  viewHeightKm = null,
  cameraPositionKm = null,
  transmittanceLUT = null,
  multiScatterLUT = null,
  raymarchOnlyUniform = null,
  // Debug modes for bisecting silhouette artefacts. Pass one of:
  // 'ap-rgb'   — AP inscatter colour only (×40 for visibility)
  // 'ap-alpha' — AP alpha (transmittance loss) only as grayscale
  // 'w'        — slice index w as grayscale; sky→1, foreground→0
  // 'is-sky'   — sky mask: white = sky, black = geometry
  // 'beyond'   — past-coverage mask: white = pixel uses raymarch fallback
  // null       — normal compositing
  debugMode = null
}) {
  if (skyCube && !cameraWorldUniform) {
    throw new Error("createHazeOutputNode: cameraWorldUniform is required when skyCube is provided.");
  }
  if (enableRaymarchFallback) {
    const missing = [];
    if (!atmosphereUniforms) missing.push("atmosphereUniforms");
    if (!sunDirection) missing.push("sunDirection");
    if (!viewHeightKm && !cameraPositionKm) missing.push("viewHeightKm or cameraPositionKm");
    if (!transmittanceLUT) missing.push("transmittanceLUT");
    if (!multiScatterLUT) missing.push("multiScatterLUT");
    if (!cameraWorldUniform) missing.push("cameraWorldUniform");
    if (missing.length) {
      throw new Error("createHazeOutputNode: enableRaymarchFallback requires " + missing.join(", ") + ".");
    }
  }
  const sceneColor = sceneColorNode ?? scenePass.getTextureNode("output");
  const { viewZNode, linearDepthNode } = createHazeDepthNodes(scenePass, logarithmicDepthBuffer);
  const coverageKm = kmPerSlice * resZ;
  return Fn(() => {
    const u = uv();
    const baseColor = sceneColorNode ? sceneColor : sceneColor.sample(u);
    const viewZ = viewZNode;
    const ndc2 = vec2(u.x.mul(2).sub(1), float(1).sub(u.y.mul(2)));
    const clipFar = vec4(ndc2.x, ndc2.y, float(1), float(1));
    const viewFar = invProjUniform.mul(clipFar);
    const rayDirView = viewFar.xyz.div(viewFar.w);
    const cosFromAxis = max(abs(rayDirView.normalize().z), float(1e-6));
    const distAlongRayM = abs(viewZ).div(cosFromAxis);
    const distKm = distAlongRayM.mul(1e-3);
    const sliceN = distKm.div(float(kmPerSlice)).div(float(resZ));
    const w = sqrt(clamp(sliceN, float(0), float(1)));
    const ap = texture3D(aerialPerspectiveTexture, vec3(u.x, u.y, w)).level(0);
    const isSky = cameraFarUniform ? viewZ.lessThan(cameraFarUniform.mul(-0.999)) : linearDepthNode.greaterThan(float(0.999));
    const beyondCoverage = distKm.greaterThan(float(coverageKm));
    const hazeMode = hazeModeUniform || float(1);
    const blendStartKm = raymarchBlendStartKm || float(50);
    const blendEndKm = max(raymarchBlendEndKm || float(100), blendStartKm.add(1e-3));
    const coverageBlendKm = max(raymarchCoverageBlendKm || float(128), float(1e-3));
    const cameraAltitudeKm = atmosphereUniforms ? cameraPositionKm ? length(cameraPositionKm).sub(atmosphereUniforms.bottomRadius) : viewHeightKm ? viewHeightKm.sub(atmosphereUniforms.bottomRadius) : float(0) : float(0);
    const altitudeWeight = smoothstep(blendStartKm, blendEndKm, cameraAltitudeKm);
    const coverageWeight = smoothstep(float(coverageKm).sub(coverageBlendKm), float(coverageKm), distKm);
    const autoWeight = max(altitudeWeight, coverageWeight);
    const apWeight = beyondCoverage.select(float(1), float(0));
    const isRaymarchMode = hazeMode.greaterThan(float(1.5));
    const isApMode = hazeMode.greaterThan(float(0.5)).and(hazeMode.lessThan(float(1.5)));
    const policyWeight = isRaymarchMode.select(float(1), isApMode.select(apWeight, autoWeight));
    const forceRaymarch = raymarchOnlyUniform ? raymarchOnlyUniform.greaterThan(float(0.5)) : null;
    const raymarchWeight = forceRaymarch ? forceRaymarch.select(float(1), policyWeight) : policyWeight;
    const useRaymarch = raymarchWeight.greaterThan(float(0)).and(isSky.not());
    if (debugMode === "ap-rgb") return vec4(ap.rgb.mul(luminanceScale).mul(5), 1);
    if (debugMode === "ap-alpha") return vec4(vec3(ap.a), 1);
    if (debugMode === "w") return vec4(vec3(w), 1);
    if (debugMode === "is-sky") return vec4(vec3(isSky.select(1, 0)), 1);
    if (debugMode === "beyond") return vec4(vec3(beyondCoverage.select(1, 0)), 1);
    if (debugMode === "lin-depth") return vec4(vec3(linearDepthNode), 1);
    if (debugMode === "view-z" && cameraFarUniform) return vec4(vec3(abs(viewZ).div(cameraFarUniform)), 1);
    const apRgbBase = ap.rgb.mul(luminanceScale);
    const apABase = hazeStrength !== null ? ap.a.mul(hazeStrength) : ap.a;
    const apRgbBaseScaled = hazeStrength !== null ? apRgbBase.mul(hazeStrength) : apRgbBase;
    const apA = apABase.toVar();
    const apRgbScaled = apRgbBaseScaled.toVar();
    const rmDebugRgb = vec3(0, 0, 0).toVar();
    const rmDebugAlpha = float(0).toVar();
    if (enableRaymarchFallback) {
      If(useRaymarch, () => {
        const worldDirRaw = cameraWorldUniform.mul(vec4(rayDirView, float(0))).xyz;
        const worldDir = normalize(worldDirRaw).toVar();
        const camPos = cameraPositionKm || vec3(float(0), viewHeightKm, float(0));
        const moved = moveToTopAtmosphere(camPos, worldDir, atmosphereUniforms);
        const startPos = moved.newPos.toVar();
        const distKmVar = distKm.toVar();
        const hash01 = fract(sin(dot(u, vec2(12.9898, 78.233))).mul(43758.5453));
        const result = integrateScatteredLuminance({
          worldPos: startPos,
          worldDir,
          sunDir: sunDirection,
          params: atmosphereUniforms,
          transmittanceLUT,
          multiScatterLUT,
          // Grazing rays from 50–100 km altitude can integrate over
          // 1000+ km of atmosphere; at 30 samples that's ~33 km/step,
          // which undersamples the TLUT's near-horizon remap and
          // produces visible rings/banding closer to the planet
          // horizon. 64 samples (~16 km/step on a 1000 km ray) cleans
          // it up at modest cost — geometry pixels only, not sky.
          sampleCount: raymarchSampleCount,
          ground: false,
          // we already have the surface in the scene; don't double-count
          mieRayPhase: true,
          tMaxOverride: distKmVar,
          sampleJitter: hash01
        });
        const validF = moved.valid.select(float(1), float(0));
        const rmRgb = result.L.mul(luminanceScale).mul(validF);
        const rmTransmittance = result.transmittance;
        const rmAlpha = float(1).sub(
          rmTransmittance.x.add(rmTransmittance.y).add(rmTransmittance.z).mul(float(1 / 3))
        ).mul(validF);
        const rmA = hazeStrength !== null ? rmAlpha.mul(hazeStrength) : rmAlpha;
        const rmRgbScaled = hazeStrength !== null ? rmRgb.mul(hazeStrength) : rmRgb;
        apA.assign(mix(apA, rmA, raymarchWeight));
        apRgbScaled.assign(mix(apRgbScaled, rmRgbScaled, raymarchWeight));
        rmDebugRgb.assign(rmRgbScaled);
        rmDebugAlpha.assign(rmA);
      });
    }
    if (debugMode === "rm-rgb") return vec4(rmDebugRgb.mul(5), 1);
    if (debugMode === "rm-alpha") return vec4(vec3(rmDebugAlpha), 1);
    let composited = baseColor.rgb.mul(float(1).sub(apA)).add(apRgbScaled);
    if (skyCube) {
      const worldDirRaw = cameraWorldUniform.mul(vec4(rayDirView, float(0))).xyz;
      const worldDir = normalize(worldDirRaw);
      const skyAtDir = cubeTexture(skyCube, worldDir).rgb;
      composited = mix(composited, skyAtDir, apA);
    }
    return vec4(mix(composited, baseColor.rgb, isSky.select(1, 0)), baseColor.a);
  })();
}

function applyHaze(sceneColorNode, {
  sky,
  scenePass,
  policy = "auto",
  strength = 1,
  altitudeBlend,
  logarithmicDepthBuffer = false,
  useCameraFar,
  includeSkyCubeBlend = false,
  raymarchFallback = true,
  raymarchSampleCount = 64,
  debugMode = null
} = {}) {
  if (!sky) throw new Error("applyHaze: `sky` is required.");
  if (!scenePass) throw new Error("applyHaze: `scenePass` is required.");
  const baker = sky.baker;
  const ap = baker.aerialPerspectiveLUT;
  if (!ap) {
    throw new Error("applyHaze: Sky was constructed with `enableAerialPerspective: false`.");
  }
  if (!raymarchFallback && policy === "raymarch") {
    console.warn("applyHaze: policy 'raymarch' has no effect with raymarchFallback: false.");
  }
  sky._hazeApplied = true;
  if (!sky._hazeStrength) sky._hazeStrength = uniform(strength);
  else sky._hazeStrength.value = strength;
  if (!sky._hazePolicy) sky._hazePolicy = uniform(policyToHazeMode(policy));
  else sky._hazePolicy.value = policyToHazeMode(policy);
  if (!sky._hazeRaymarchOnly) sky._hazeRaymarchOnly = uniform(policy === "raymarch" ? 1 : 0);
  else sky._hazeRaymarchOnly.value = policy === "raymarch" ? 1 : 0;
  const seedStartKm = altitudeBlend?.startKm ?? 50;
  const seedEndKm = altitudeBlend?.endKm ?? 100;
  if (!sky._hazeAltStart) sky._hazeAltStart = uniform(seedStartKm);
  else if (altitudeBlend) sky._hazeAltStart.value = seedStartKm;
  if (!sky._hazeAltEnd) sky._hazeAltEnd = uniform(seedEndKm);
  else if (altitudeBlend) sky._hazeAltEnd.value = seedEndKm;
  const seedFar = scenePass.camera?.far ?? 1e6;
  if (useCameraFar === void 0) useCameraFar = seedFar > 1e6;
  if (useCameraFar && !sky._cameraFar) sky._cameraFar = uniform(seedFar);
  return createHazeOutputNode({
    scenePass,
    sceneColorNode,
    aerialPerspectiveTexture: ap.texture,
    luminanceScale: baker.sky.luminanceScale,
    invProjUniform: ap.invProjUniform,
    resZ: ap.resolution?.z ?? ap.resolution?.depth ?? 32,
    kmPerSlice: baker.apKmPerSlice,
    hazeStrength: sky._hazeStrength,
    hazeModeUniform: sky._hazePolicy,
    raymarchBlendStartKm: sky._hazeAltStart,
    raymarchBlendEndKm: sky._hazeAltEnd,
    raymarchOnlyUniform: sky._hazeRaymarchOnly,
    cameraWorldUniform: ap.cameraWorldUniform,
    cameraFarUniform: useCameraFar ? sky._cameraFar : null,
    logarithmicDepthBuffer,
    // On by default so live policy switching works without rebuild; scenes
    // that never exceed AP coverage can pass `raymarchFallback: false` for a
    // far smaller shader (see the option's JSDoc).
    enableRaymarchFallback: raymarchFallback,
    raymarchSampleCount,
    atmosphereUniforms: baker.atmosphereUniforms,
    sunDirection: baker.sky.sunDirection,
    viewHeightKm: baker.sky.viewHeight,
    // Planet-frame camera position — already updated each frame by
    // AerialPerspectiveLUT.setCamera (called via baker.setCamera). When
    // the user isn't passing `planetCenter`, this defaults to
    // (0, viewHeight, 0) which matches the flat-ground convention.
    cameraPositionKm: ap.cameraPositionKmUniform,
    transmittanceLUT: baker.transmittanceLUT.texture,
    multiScatterLUT: baker.multiScatterLUT.texture,
    skyCube: includeSkyCubeBlend ? baker.texture : null,
    debugMode
  });
}
function policyToHazeMode(policy) {
  switch (policy) {
    case "auto":
      return 0;
    case "ap":
      return 1;
    case "raymarch":
      return 2;
    default:
      throw new Error(`applyHaze: unknown policy "${policy}". Use 'auto' | 'ap' | 'raymarch'.`);
  }
}

function solarPosition({
  timeOfDay = 12,
  dayOfYear = 172,
  latitude = 0
} = {}) {
  const deg2rad = Math.PI / 180;
  const rad2deg = 180 / Math.PI;
  const latRad = latitude * deg2rad;
  const gamma = 2 * Math.PI / 365 * (dayOfYear - 1 + (timeOfDay - 12) / 24);
  const eqtime = 229.18 * (75e-6 + 1868e-6 * Math.cos(gamma) - 0.032077 * Math.sin(gamma) - 0.014615 * Math.cos(2 * gamma) - 0.040849 * Math.sin(2 * gamma));
  const decl = 6918e-6 - 0.399912 * Math.cos(gamma) + 0.070257 * Math.sin(gamma) - 6758e-6 * Math.cos(2 * gamma) + 907e-6 * Math.sin(2 * gamma) - 2697e-6 * Math.cos(3 * gamma) + 148e-5 * Math.sin(3 * gamma);
  const tst = timeOfDay * 60 + eqtime;
  const haDeg = tst / 4 - 180;
  const ha = haDeg * deg2rad;
  const cosZenith = Math.sin(latRad) * Math.sin(decl) + Math.cos(latRad) * Math.cos(decl) * Math.cos(ha);
  const zenith = Math.acos(Math.max(-1, Math.min(1, cosZenith)));
  const elevation = 90 - zenith * rad2deg;
  const cosAz = (Math.sin(decl) - Math.sin(latRad) * Math.cos(zenith)) / (Math.cos(latRad) * Math.sin(zenith) || 1e-9);
  let azimuth = Math.acos(Math.max(-1, Math.min(1, cosAz))) * rad2deg;
  if (ha > 0) azimuth = 360 - azimuth;
  return { elevation, azimuth };
}

var __defProp = Object.defineProperty;
var __defNormalProp = (obj, key, value) => key in obj ? __defProp(obj, key, { enumerable: true, configurable: true, writable: true, value }) : obj[key] = value;
var __publicField = (obj, key, value) => __defNormalProp(obj, typeof key !== "symbol" ? key + "" : key, value);
const QUALITY_PRESETS = {
  low: {
    transmittance: { width: 128, height: 32 },
    multiScatter: { width: 16, height: 16 },
    skyView: { width: 96, height: 54 }
  },
  medium: LUT_RESOLUTIONS,
  high: {
    transmittance: { width: 512, height: 128 },
    multiScatter: { width: 64, height: 64 },
    skyView: { width: 256, height: 144 }
  }
};
const NORTH_AXES = {
  "+X": { vector: new Vector3(1, 0, 0), offsetDeg: 90 },
  "-X": { vector: new Vector3(-1, 0, 0), offsetDeg: -90 },
  "+Z": { vector: new Vector3(0, 0, 1), offsetDeg: 0 },
  // Three.js default. North = +Z means azimuth=0 (N) maps onto +Z; baker's
  // `setSun(azimuth)` treats theta=0 as +Z (sphericalCoords convention).
  "-Z": { vector: new Vector3(0, 0, -1), offsetDeg: 180 }
};
class Sky {
  constructor(renderer, {
    preset = "earth",
    quality = "medium",
    cubeSize = 256,
    atmosphere,
    exposure = 40,
    north = "+Z",
    sunDisc = true,
    // Solar-position inputs; pass `sunDirection` to bypass.
    timeOfDay = 12,
    latitude = 37.7,
    dayOfYear = 172,
    sunDirection,
    // Optional top-level scalar shortcuts merged onto the preset.
    turbidity,
    groundAlbedo,
    enableAerialPerspective = true,
    apKmPerSlice = 8,
    // Fold below-horizon cube-bake rays to above-horizon so the env's
    // lower hemisphere is a Y-mirror of the sky instead of lit ground
    // colour. Useful when the consumer scene has reflective floors and
    // you want a clean sky HDRI for IBL. See `SkyAtmosphereBaker`'s
    // constructor JSDoc.
    mirrorBelowHorizon = false
  } = {}) {
    __publicField(this, "baker");
    __publicField(this, "_renderer");
    __publicField(this, "_scene");
    __publicField(this, "_timeOfDay");
    __publicField(this, "_latitude");
    __publicField(this, "_dayOfYear");
    __publicField(this, "_turbidity");
    __publicField(this, "_northKey");
    __publicField(this, "_elevation");
    __publicField(this, "_azimuth");
    __publicField(this, "_cameraFar");
    __publicField(this, "_hazeStrength");
    __publicField(this, "_hazePolicy");
    __publicField(this, "_hazeRaymarchOnly");
    __publicField(this, "_hazeAltStart");
    __publicField(this, "_hazeAltEnd");
    /** Set by `applyHaze` — signals that the AP LUT has a consumer and needs
     *  its per-frame `updateAerialPerspective()` refresh. */
    __publicField(this, "_hazeApplied");
    __publicField(this, "_night");
    const baseAtmosphere = resolvePreset(preset);
    let merged = atmosphere ? mergeAtmosphereParams(baseAtmosphere, atmosphere) : baseAtmosphere;
    merged = applyShortcutScalars(merged, { turbidity, groundAlbedo });
    const lutResolutions = QUALITY_PRESETS[quality] || QUALITY_PRESETS.medium;
    this.baker = new SkyAtmosphereBaker(renderer, {
      cubeSize,
      atmosphere: merged,
      lutResolutions,
      enableAerialPerspective,
      apKmPerSlice,
      mirrorBelowHorizon
    });
    this._renderer = renderer;
    this._scene = null;
    this._timeOfDay = timeOfDay;
    this._latitude = latitude;
    this._dayOfYear = dayOfYear;
    this._turbidity = turbidity ?? 1;
    this._northKey = NORTH_AXES[north] ? north : "+Z";
    this.setExposure(exposure);
    this.setSunDisc(sunDisc);
    if (sunDirection) {
      this.setSunDirection(sunDirection);
    } else {
      this._refreshSunFromTime();
    }
  }
  get texture() {
    return this.baker.texture;
  }
  get environmentTexture() {
    return this.baker.environmentTexture;
  }
  get aerialPerspectiveTexture() {
    return this.baker.aerialPerspectiveTexture;
  }
  get mesh() {
    return this.baker.sky;
  }
  get sunElevation() {
    return this._elevation;
  }
  get sunAzimuth() {
    return this._azimuth;
  }
  attach(scene) {
    this._scene = scene;
    scene.environment = this.baker.environmentTexture;
    scene.background = this.baker.texture;
    return this;
  }
  detach() {
    if (this._scene) {
      if (this._scene.environment === this.baker.environmentTexture) this._scene.environment = null;
      if (this._scene.background === this.baker.texture) this._scene.background = null;
      this._scene = null;
    }
    return this;
  }
  setTimeOfDay(hours) {
    this._timeOfDay = hours;
    this._refreshSunFromTime();
    return this;
  }
  setLatitude(latitude) {
    this._latitude = latitude;
    this._refreshSunFromTime();
    return this;
  }
  setDayOfYear(day) {
    this._dayOfYear = day;
    this._refreshSunFromTime();
    return this;
  }
  /**
   * Direct sun control. Bypasses solar-position math; useful for cinematic
   * lighting or alien-planet tuning where civil time is meaningless.
   *
   * `azimuth` is degrees CW from the configured `north` axis. Pass
   * `{ elevation, azimuth, raw: true }` to skip the north-rotation and
   * feed the baker raw spherical-coord theta directly.
   */
  setSunDirection({ elevation, azimuth, raw = false }) {
    this._elevation = elevation;
    this._azimuth = azimuth;
    const theta = raw ? azimuth : azimuth + (NORTH_AXES[this._northKey]?.offsetDeg ?? 0);
    this.baker.setSun({ elevation, azimuth: theta });
    return this;
  }
  setNorth(axis) {
    if (NORTH_AXES[axis]) {
      this._northKey = axis;
      this.setSunDirection({ elevation: this._elevation, azimuth: this._azimuth });
    }
    return this;
  }
  setExposure(value) {
    this.baker.sky.luminanceScale.value = value;
    return this;
  }
  /**
   * `visible` may be a boolean OR an object
   * `{ visible?, angularDiameter?, edgeSoftness? }`. `angularDiameter` is in
   * radians; default ~0.00935 rad (~0.535°). `edgeSoftness` is the fraction
   * of the disc's angular *radius* the rim ramps over (default 0.1 = 10%);
   * see `SkyAtmosphereMesh.setSunAngularRadius`. The disc itself renders
   * in-shader on the sky mesh, tinted by transmittance-to-space, so it
   * reddens and dims naturally near the horizon and disappears once the
   * view ray intersects the planet — there is no separate sun sprite/mesh
   * to manage.
   */
  setSunDisc(visible) {
    if (typeof visible === "object" && visible !== null) {
      if (typeof visible.angularDiameter === "number") {
        this.baker.sky.setSunAngularRadius(visible.angularDiameter * 0.5, visible.edgeSoftness);
      }
      if (typeof visible.visible === "boolean") {
        this.baker.sky.showSunDisc.value = visible.visible ? 1 : 0;
      }
    } else {
      this.baker.sky.showSunDisc.value = visible ? 1 : 0;
    }
    return this;
  }
  /**
   * Convenience scalar 0..1+ — multiplies Mie scattering/extinction. 1.0 is
   * Earth-default; >1 makes the air look hazier; 0 turns Mie off entirely.
   */
  setTurbidity(value) {
    const factor = value / Math.max(this._turbidity, 1e-6);
    this._turbidity = value;
    const params = this.baker.atmosphereParams;
    this.baker.setAtmosphereParams({
      mieScattering: params.mieScattering.clone().multiplyScalar(factor),
      mieExtinction: params.mieExtinction.clone().multiplyScalar(factor),
      mieAbsorption: params.mieAbsorption.clone().multiplyScalar(factor)
    });
    return this;
  }
  setGroundAlbedo(value) {
    const v = value instanceof Vector3 ? value : typeof value === "number" ? new Vector3(value, value, value) : new Vector3(value.x ?? 0.3, value.y ?? 0.3, value.z ?? 0.3);
    this.baker.setAtmosphereParams({ groundAlbedo: v });
    return this;
  }
  setAtmosphere(partial) {
    this.baker.setAtmosphereParams(partial);
    return this;
  }
  /**
   * Toggle Y-mirror of the sky on the cube's lower hemisphere (a clean
   * sky HDRI for IBL with no ground tint). Forces a cube re-bake on the
   * next `update()`.
   */
  setMirrorBelowHorizon(flag) {
    this.baker.setMirrorBelowHorizon(flag);
    return this;
  }
  setPreset(name) {
    this.baker.setAtmosphereParams(resolvePreset(name));
    return this;
  }
  /**
   * Per-frame entry point.
   *
   * @param {THREE.Camera} camera          active main camera
   * @param {object} [opts]
   * @param {THREE.Vector3} [opts.planetCenter]  for spherical-planet demos:
   *   distance to this point gives true altitude. When omitted the legacy
   *   flat-ground convention (`y` == altitude) is used.
   */
  update(camera, opts = {}) {
    if (camera) {
      this.baker.setCamera(camera, opts);
      if (this._cameraFar) this._cameraFar.value = camera.far;
    }
    this.baker.update();
    if (this._scene && this._scene.environment !== this.baker.environmentTexture) {
      this._scene.environment = this.baker.environmentTexture;
    }
    return this;
  }
  updateAerialPerspective() {
    return this.baker.updateAerialPerspective();
  }
  applyHaze(sceneColorNode, options = {}) {
    return applyHaze(sceneColorNode, { ...options, sky: this });
  }
  /**
   * Update haze strength after `applyHaze` has been wired. Multiplies
   * inscatter colour and AP alpha. 0 = no haze; 1 = physical default.
   * No-op if haze hasn't been applied yet (we'd just be priming a uniform
   * that the next applyHaze would re-seed anyway).
   */
  setHazeStrength(value) {
    if (this._hazeStrength) this._hazeStrength.value = value;
    return this;
  }
  /**
   * Switch policy live. 'auto' blends AP→raymarch by altitude/coverage;
   * 'ap' uses AP-first with raymarch only past coverage; 'raymarch' forces
   * the raymarch fallback for every geometry pixel.
   */
  setHazePolicy(policy) {
    if (this._hazePolicy) this._hazePolicy.value = policyToHazeMode(policy);
    if (this._hazeRaymarchOnly) this._hazeRaymarchOnly.value = policy === "raymarch" ? 1 : 0;
    return this;
  }
  /**
   * Adjust the auto-mode altitude blend window in km. Above `endKm` the
   * raymarch path is fully active; below `startKm` the AP LUT is used.
   */
  setHazeAltitudeBlend({ startKm, endKm } = {}) {
    if (typeof startKm === "number" && this._hazeAltStart) this._hazeAltStart.value = startKm;
    if (typeof endKm === "number" && this._hazeAltEnd) this._hazeAltEnd.value = endKm;
    return this;
  }
  /**
   * Convenience: build a `SkySun` bound to this Sky. The returned instance
   * owns a `THREE.DirectionalLight` that auto-tracks every `setSunDirection`
   * / `baker.setSun` via the baker's listener hook. Call `sun.attach(scene)`.
   */
  createSun(opts) {
    return new SkySun(this, opts);
  }
  /**
   * Convenience: build a `SkyGround` bound to this Sky. Sphere mode auto-sizes
   * from `baker.atmosphereParams.bottomRadius`. Call `ground.attach(scene)`.
   */
  createGround(opts) {
    return new SkyGround(this, opts);
  }
  /**
   * Convenience: build a `GroundedSkybox` bound to this Sky. The skybox
   * supplies a "floor" via cube-content reprojection — usually replaces an
   * explicit `SkyGround` plane. Add the returned mesh to your scene and
   * call `mesh.followCamera(camera)` each frame.
   */
  createGroundedSkybox(opts) {
    return new GroundedSkybox(this.baker.texture, opts);
  }
  /**
   * Convenience: build a `SkyMoon` bound to this Sky. Owns a
   * `THREE.DirectionalLight` representing moonlight; auto-tracks the sun
   * (anti-sun + lunar phase offset) by default. Does not feed the
   * atmosphere LUTs. Call `moon.attach(scene)`.
   */
  createMoon(opts) {
    return new SkyMoon(this, opts);
  }
  /**
   * Opt into the night-sky stars layer. Default source is `'procedural'` —
   * a shader-generated starfield with zero asset cost. Pass
   * `{ source: 'hdri', url }` (or `{ texture }`) to use a real HDR sky
   * map for a photoreal Milky Way look.
   *
   * Stars fade naturally with twilight (attenuated by camera→space
   * transmittance) and flow into the IBL automatically via the cube bake.
   *
   * Returns the `SkyNight` instance for further control (`setIntensity`,
   * `setSource`, `setDensity`, `setBrightness`, `setRotation`, `disable`,
   * `dispose`). Idempotent — calling again updates in place.
   *
   * @param {object} [opts] see `SkyNight.enable` for full schema.
   * @returns {Promise<SkyNight>}
   */
  async enableStars(opts) {
    if (!this._night) this._night = new SkyNight(this);
    await this._night.enable(opts);
    return this._night;
  }
  /**
   * Hide stars without unloading the texture. Re-show via `enableStars()`
   * (cheap — texture stays bound) or `setStarsIntensity( > 0 )`.
   */
  disableStars() {
    if (this._night) this._night.disable();
    return this;
  }
  setStarsIntensity(value) {
    if (this._night) this._night.setIntensity(value);
    return this;
  }
  setStarsRotation(radians) {
    if (this._night) this._night.setRotation(radians);
    return this;
  }
  setStarsDensity(value) {
    if (this._night) this._night.setDensity(value);
    return this;
  }
  setStarsBrightness(value) {
    if (this._night) this._night.setBrightness(value);
    return this;
  }
  setStarsSource(source) {
    if (this._night) this._night.setSource(source);
    return this;
  }
  get stars() {
    return this._night || null;
  }
  dispose() {
    this.detach();
    this.baker.dispose();
  }
  _refreshSunFromTime() {
    const { elevation, azimuth } = solarPosition({
      timeOfDay: this._timeOfDay,
      latitude: this._latitude,
      dayOfYear: this._dayOfYear
    });
    this.setSunDirection({ elevation, azimuth });
  }
}
function applyShortcutScalars(base, { turbidity, groundAlbedo }) {
  if (turbidity == null && groundAlbedo == null) return base;
  const partial = {};
  if (typeof turbidity === "number" && turbidity !== 1) {
    partial.mieScattering = base.mieScattering.clone().multiplyScalar(turbidity);
    partial.mieExtinction = base.mieExtinction.clone().multiplyScalar(turbidity);
    partial.mieAbsorption = base.mieAbsorption.clone().multiplyScalar(turbidity);
  }
  if (groundAlbedo != null) {
    partial.groundAlbedo = groundAlbedo instanceof Vector3 ? groundAlbedo.clone() : typeof groundAlbedo === "number" ? new Vector3(groundAlbedo, groundAlbedo, groundAlbedo) : new Vector3(groundAlbedo.x ?? 0.3, groundAlbedo.y ?? 0.3, groundAlbedo.z ?? 0.3);
  }
  return mergeAtmosphereParams(base, partial);
}

export { AerialPerspectiveLUT as A, EARTH as E, GroundedSkybox as G, LUT_RESOLUTIONS as L, MultiScatterLUT as M, Sky as S, TransmittanceLUT as T, SkyAtmosphereBaker as a, SkyAtmosphereMesh as b, SkyGround as c, SkyMoon as d, SkyNight as e, SkySun as f, SkyViewLUT as g, applyHaze as h, createHazeOutputNode as i, mergeAtmosphereParams as m, presets as p, resolvePreset as r, solarPosition as s };
