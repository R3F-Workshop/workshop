import { Mesh, Camera, Object3D, BufferGeometry, Material, DirectionalLight, Vector3, Color, Box3, RenderTarget, Storage3DTexture, DataTexture, Scene, CubeRenderTarget, CubeCamera, PMREMGenerator, PerspectiveCamera, Texture } from 'three/webgpu';
import * as three from 'three';

interface GroundedSkyboxOptions {
    height?: number;
    radius?: number;
    resolution?: number;
    reflective?: boolean;
}
/**
 * Ground-projected skybox for tsl-sky.
 *
 * Same geometric trick as three.js's `examples/jsm/objects/GroundedSkybox.js`,
 * ported to a TSL `NodeMaterial` so the cube texture sample can be expressed
 * cleanly for the WebGPU backend. The lower hemisphere of a sphere is pulled
 * radially inward so its vertices sit at `y = -height` locally — a flat disc.
 * The mesh is then placed at `(camX, height, camZ)` per frame so that disc
 * coincides with the world `y = 0` plane and tracks the camera horizontally.
 *
 * The cube sample direction at each fragment is `normalize(positionLocal)`.
 * For un-deformed (upper) vertices that's the original sphere direction →
 * normal sky sample. For deformed (lower) vertices the direction interpolates
 * across the flattened disc → small offsets sample near the cube's nadir
 * (ground colour) and large offsets sample horizon texels (sky touching
 * ground). The result blends from "floor right under the camera" out to
 * "horizon" without an explicit ground plane in the scene.
 *
 * Pair with `SkyViewLUT`'s ground-albedo contribution (the lower hemisphere
 * of the cube must have lit-ground colour, not black) for this to actually
 * look like a floor.
 *
 * Usage:
 * ```js
 * const sb = new GroundedSkybox( baker.texture, { height: 4, radius: 200 } );
 * scene.add( sb );
 * // Per-frame:
 * sb.followCamera( camera );
 * ```
 */
declare class GroundedSkybox extends Mesh {
    height: number;
    radius: number;
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
    constructor(cube: any, { height, radius, resolution, reflective }?: GroundedSkyboxOptions);
    /**
     * Per-frame helper — keep the mesh centered above the camera so the
     * projected floor stays anchored to world y=0 and the camera never
     * escapes the dome. Call from your render loop.
     *
     * @param {THREE.Camera} camera
     */
    followCamera(camera: Camera): void;
}

interface SkyGroundOptions {
    mode?: string;
    size?: number;
    segments?: number;
    radius?: number | null;
    widthSegments?: number;
    heightSegments?: number;
    color?: number;
    roughness?: number;
    metalness?: number;
    material?: Material | null;
    reflective?: boolean;
    blur?: number;
    reflectorOptions?: any;
    receiveShadow?: boolean;
}
/**
 * Optional ground / floor mesh for tsl-sky scenes.
 *
 * The sky atmosphere returns black for any view ray below the horizon, so a
 * scene with no ground geometry shows a black bottom hemisphere. `SkyGround`
 * makes the floor a one-liner and supports two geometry modes:
 *
 *  - `'plane'` — a finite flat square at y=0. Suitable for ground-level demos.
 *  - `'sphere'` — a planet-sized sphere whose surface tangent sits at y=0,
 *    auto-sized from `sky.baker.atmosphereParams.bottomRadius`. Suitable for
 *    high-altitude / orbital views — the sphere wraps the lower hemisphere
 *    so there's no visible black band when looking out toward the horizon.
 *
 * Reflection is opt-in on plane mode only (`{ reflective: true }`). The
 * reflective floor uses a `NodeMaterial` with `mix(reflector, baseColor,
 * roughness)` matching the three.js `webgpu_reflection_blurred` recipe — it
 * is NOT a full PBR shading pipeline. Roughness controls how much base color
 * is blended over the mirror; `blur > 0` runs a gaussian blur on the
 * reflection texture for a frosted look.
 *
 * Usage:
 * ```js
 * const ground = sky.createGround({ mode: 'plane', size: 200, reflective: true, blur: 4 });
 * ground.attach(scene);
 * ground.mesh.receiveShadow = true;
 * ```
 */
declare class SkyGround {
    sky: any;
    mode: string;
    reflector: any;
    _scene: Object3D | null;
    geometry: BufferGeometry;
    _sphereRadius: number;
    material: Material;
    mesh: Mesh;
    constructor(sky: any, { mode, size, segments, radius, widthSegments, heightSegments, color, roughness, metalness, material, reflective, blur, reflectorOptions, receiveShadow, }?: SkyGroundOptions);
    setVisible(visible: boolean): this;
    attach(scene: Object3D): this;
    detach(): this;
    dispose(): void;
    _buildReflectiveMaterial({ color, roughness, blur, reflectorOptions, }: {
        color: number;
        roughness: number;
        blur: number;
        reflectorOptions: any;
    }): Material;
}

interface SkyMoonOptions {
    color?: number;
    intensity?: number;
    distance?: number;
    target?: Object3D | null;
    followSun?: boolean;
    phase?: number;
    showDisc?: boolean;
    discIntensity?: number;
    discAngularDiameter?: number;
    discColor?: number | Color | Vector3 | null;
    castShadow?: boolean;
    shadowMapSize?: number;
    shadowBias?: number;
    shadowNormalBias?: number;
    shadowRadius?: number;
    shadowCamera?: any;
}
/**
 * Owns a `THREE.DirectionalLight` representing moonlight.
 *
 * Two direction sources:
 *
 *  - `followSun: true` (default) — moon direction is derived from the current
 *    sun by rotating the sun vector around the world up axis by the lunar
 *    `phase` × 2π. Phase 0 = new moon (moon at sun position, dark side facing
 *    earth, no moonlight), 0.5 = full moon (anti-sun, max moonlight), 1 = new.
 *    Subscribes to `sky.baker.addSunListener(...)` so it updates automatically
 *    on every `sky.setSunDirection` call.
 *
 *  - `setDirection({ elevation, azimuth })` — manual control, disables
 *    follow-sun and stays where you put it. Use for cinematic shots.
 *
 * The moon does NOT feed the atmosphere LUTs (the Hillaire integrator only
 * supports one light, and lunar irradiance is six orders of magnitude below
 * solar — atmospheric in-scatter from moonlight is sub-perceptible). It is a
 * pure scene light.
 *
 * Auto-fade: intensity scales by `smoothstep(-2°, 0°, moonElevation)` so the
 * light cleanly switches off as the moon dips below the horizon. The target
 * intensity (what you set via `intensity = X`) is preserved across fades so
 * the moon comes back to full strength when it rises again.
 *
 * Usage:
 * ```js
 * const moon = sky.createMoon( { intensity: 0.15, phase: 0.5 } );
 * moon.attach( scene );
 * moon.fitShadowToObject( scene );
 * moon.setPhase( 0.75 );  // last quarter
 * ```
 */
declare class SkyMoon {
    sky: any;
    distance: number;
    followSun: boolean;
    phase: number;
    _mesh: any;
    light: DirectionalLight;
    target: Object3D;
    _targetIntensity: number;
    _scene: Object3D | null;
    _moonVec: Vector3;
    _onSunChanged: (sunVec: Vector3) => void;
    _unsubscribe: (() => void) | null;
    constructor(sky: any, { color, intensity, distance, target, followSun, phase, showDisc, discIntensity, discAngularDiameter, // ~0.535° matches Earth-Moon
    discColor, // null → use mesh default cool-white
    castShadow, shadowMapSize, shadowBias, shadowNormalBias, shadowRadius, shadowCamera, }?: SkyMoonOptions);
    get castShadow(): boolean;
    set castShadow(value: boolean);
    get color(): Color;
    get intensity(): number;
    set intensity(value: number);
    setIntensity(value: number): this;
    setDistance(value: number): this;
    /**
     * Set the lunar phase. 0 = new moon (moon co-located with sun, no
     * visible moonlight), 0.5 = full (anti-sun), 1 = new again.
     * Wraps modulo 1.
     */
    setPhase(phase: number): this;
    /**
     * Manual moon direction. Disables `followSun` automatically — the moon
     * stays where you put it until you call `setFollowSun(true)` again.
     *
     * `azimuth` is degrees CW from the configured `north` axis (matches
     * `sky.setSunDirection` semantics).
     */
    setDirection({ elevation, azimuth }: {
        elevation: number;
        azimuth: number;
    }): this;
    setFollowSun(enabled: boolean): this;
    attach(scene: Object3D): this;
    detach(): this;
    /**
     * Tighten the directional light's orthographic shadow frustum to enclose
     * the given world-space Box3. Identical math to `SkySun.fitShadowToBox`.
     */
    fitShadowToBox(box3: Box3): this;
    fitShadowToObject(object3D: Object3D): this;
    dispose(): void;
    _syncFromSun(sunVec: Vector3): void;
    setDiscVisible(visible: boolean): this;
    setDiscIntensity(value: number): this;
    setDiscAngularDiameter(radians: number): this;
    setDiscColor(color: number | Color | Vector3): this;
    _placeLight(): void;
    _applyHorizonFade(): void;
}

interface SkySunOptions {
    color?: number;
    intensity?: number;
    distance?: number;
    target?: Object3D | null;
    castShadow?: boolean;
    shadowMapSize?: number;
    shadowBias?: number;
    shadowNormalBias?: number;
    shadowRadius?: number;
    shadowCamera?: any;
}
/**
 * Owns a `THREE.DirectionalLight` whose direction tracks the sky's sun vector.
 *
 * Subscribes to `sky.baker.addSunListener(...)` so any call to
 * `sky.setSunDirection(...)` or `sky.baker.setSun(...)` (e.g. from a GUI)
 * updates the light position automatically — no per-frame plumbing required
 * on the consumer side.
 *
 * The light's intensity, colour, and shadow params live on `this.light` for
 * direct mutation. The sun *disc* visibility lives on the sky mesh and stays
 * orthogonal — call `sky.setSunDisc(true)` separately if you want the visible
 * disc as well.
 *
 * Usage:
 * ```js
 * const sun = sky.createSun({ intensity: 4, castShadow: true });
 * sun.attach(scene);
 * sun.fitShadowToObject(scene);  // tighten shadow frustum
 * sun.light.color.setHex(0xfff0c0);  // mutate freely
 * ```
 */
declare class SkySun {
    sky: any;
    distance: number;
    light: DirectionalLight;
    target: Object3D;
    _scene: Object3D | null;
    _onSunChanged: (sunVec: Vector3) => void;
    _unsubscribe: (() => void) | null;
    constructor(sky: any, { color, intensity, distance, target, castShadow, shadowMapSize, shadowBias, shadowNormalBias, shadowRadius, shadowCamera, }?: SkySunOptions);
    get castShadow(): boolean;
    set castShadow(value: boolean);
    get intensity(): number;
    set intensity(value: number);
    setDistance(value: number): this;
    attach(scene: Object3D): this;
    detach(): this;
    /**
     * Tighten the directional light's orthographic shadow frustum to enclose
     * the given world-space Box3. The light's `target` (or origin if no target
     * was customised) is used as the centre of the shadow's local frame.
     */
    fitShadowToBox(box3: Box3): this;
    fitShadowToObject(object3D: Object3D): this;
    dispose(): void;
    _syncFromSunVec(sunVec: Vector3): void;
}

/**
 * Shape of the Hillaire atmosphere parameter bundle. Units: kilometers for
 * radii / altitudes, 1/km for scattering coefficients.
 */
interface AtmosphereParams {
    bottomRadius: number;
    topRadius: number;
    rayleighScattering: Vector3;
    rayleighDensityExpScale: number;
    mieScattering: Vector3;
    mieExtinction: Vector3;
    mieAbsorption: Vector3;
    miePhaseG: number;
    mieDensityExpScale: number;
    absorptionExtinction: Vector3;
    absorptionDensity0LayerWidth: number;
    absorptionDensity0ConstantTerm: number;
    absorptionDensity0LinearTerm: number;
    absorptionDensity1ConstantTerm: number;
    absorptionDensity1LinearTerm: number;
    ozoneAbsorption: Vector3;
    ozoneLayerCenterAltitude: number;
    ozoneLayerHalfWidth: number;
    groundAlbedo: Vector3;
    sunAngularRadius: number;
    sunIlluminance: Vector3;
}
/**
 * Partial override accepted by {@link mergeAtmosphereParams}. Vector fields may
 * be supplied as a Vector3, a plain `{x,y,z}`, or a `[x,y,z]` array.
 */
type AtmosphereParamsInput = {
    [K in keyof AtmosphereParams]?: AtmosphereParams[K] extends Vector3 ? Vector3 | {
        x?: number;
        y?: number;
        z?: number;
    } | number[] : AtmosphereParams[K];
};
/**
 * Earth-default atmosphere parameters used by the Hillaire LUT pipeline (phase 1b+).
 *
 * Phase 1a does not consume these — the legacy Preetham `SkyMesh` owns its own uniforms.
 * The baker still accepts `setAtmosphereParams(partial)` which merges onto `EARTH`,
 * so we expose the full shape now to keep the public API stable across phases.
 *
 * Values come from Hillaire 2020 / Bruneton references.
 */
declare const EARTH: AtmosphereParams;
/**
 * Shallow-ish merge: overwrite scalars, clone Vector3 when provided as plain {x,y,z} or Vector3.
 */
declare function mergeAtmosphereParams(base: AtmosphereParams, partial?: AtmosphereParamsInput | null): AtmosphereParams;

/**
 * Atmosphere presets. Each preset is a partial `AtmosphereParams` merged onto
 * the Earth defaults. Curated set — fictional looks are produced by tweaking
 * scalars on the chosen base via `Sky({ atmosphere: {...} })` or the
 * top-level `turbidity` / `groundAlbedo` shortcuts.
 *
 * Real-body sources:
 *   - Earth: Hillaire 2020 / Bruneton (already in `EARTH`)
 *   - Mars:  CO2-dominated thin atmosphere; daytime sky butterscotch from
 *     suspended dust (Mie), blue sunsets from forward-scattered Mie. Numbers
 *     tuned to match commonly published renderer references — they are not
 *     scientifically rigorous, but produce a recognisable Mars look.
 *   - Titan: thick orange tholin haze. Real atmosphere extends ~600 km;
 *     clamped here to a renderer-friendly 200 km shell. Heavy Mie, very
 *     forward-scattering, almost no Rayleigh contribution at visible
 *     wavelengths in the lower stack.
 *
 * Coefficients are 1/km. Radii are km.
 */
declare const presets: Record<string, AtmosphereParams>;
declare function resolvePreset(nameOrObject: string | AtmosphereParams): AtmosphereParams;

interface SkyOptions {
    preset?: string;
    quality?: string;
    cubeSize?: number;
    atmosphere?: any;
    exposure?: number;
    north?: string;
    sunDisc?: boolean | {
        visible?: boolean;
        angularDiameter?: number;
        edgeSoftness?: number;
    };
    timeOfDay?: number;
    latitude?: number;
    dayOfYear?: number;
    sunDirection?: any;
    turbidity?: number;
    groundAlbedo?: any;
    enableAerialPerspective?: boolean;
    apKmPerSlice?: number;
    mirrorBelowHorizon?: boolean;
}
/**
 * High-level wrapper around `SkyAtmosphereBaker`. Targets the 90% case:
 * pick a preset, set time-of-day + latitude, attach to a scene, call
 * `update(camera)` per frame.
 *
 * Power users still have access to `sky.baker` and can use `applyHaze` for
 * custom post-process chains.
 */
declare class Sky {
    baker: any;
    _renderer: any;
    _scene: any;
    _timeOfDay: number;
    _latitude: number;
    _dayOfYear: number;
    _turbidity: number;
    _northKey: string;
    _elevation: number;
    _azimuth: number;
    _cameraFar?: any;
    _hazeStrength?: any;
    _hazePolicy?: any;
    _hazeRaymarchOnly?: any;
    _hazeAltStart?: any;
    _hazeAltEnd?: any;
    /** Set by `applyHaze` — signals that the AP LUT has a consumer and needs
     *  its per-frame `updateAerialPerspective()` refresh. */
    _hazeApplied?: boolean;
    _night?: any;
    constructor(renderer: any, { preset, quality, cubeSize, atmosphere, exposure, north, sunDisc, timeOfDay, latitude, dayOfYear, sunDirection, turbidity, groundAlbedo, enableAerialPerspective, apKmPerSlice, mirrorBelowHorizon, }?: SkyOptions);
    get texture(): any;
    get environmentTexture(): any;
    get aerialPerspectiveTexture(): any;
    get mesh(): any;
    get sunElevation(): number;
    get sunAzimuth(): number;
    attach(scene: any): this;
    detach(): this;
    setTimeOfDay(hours: number): this;
    setLatitude(latitude: number): this;
    setDayOfYear(day: number): this;
    /**
     * Direct sun control. Bypasses solar-position math; useful for cinematic
     * lighting or alien-planet tuning where civil time is meaningless.
     *
     * `azimuth` is degrees CW from the configured `north` axis. Pass
     * `{ elevation, azimuth, raw: true }` to skip the north-rotation and
     * feed the baker raw spherical-coord theta directly.
     */
    setSunDirection({ elevation, azimuth, raw }: {
        elevation: number;
        azimuth: number;
        raw?: boolean;
    }): this;
    setNorth(axis: string): this;
    setExposure(value: number): this;
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
    setSunDisc(visible: boolean | {
        visible?: boolean;
        angularDiameter?: number;
        edgeSoftness?: number;
    }): this;
    /**
     * Convenience scalar 0..1+ — multiplies Mie scattering/extinction. 1.0 is
     * Earth-default; >1 makes the air look hazier; 0 turns Mie off entirely.
     */
    setTurbidity(value: number): this;
    setGroundAlbedo(value: any): this;
    setAtmosphere(partial: any): this;
    /**
     * Toggle Y-mirror of the sky on the cube's lower hemisphere (a clean
     * sky HDRI for IBL with no ground tint). Forces a cube re-bake on the
     * next `update()`.
     */
    setMirrorBelowHorizon(flag: boolean): this;
    setPreset(name: string): this;
    /**
     * Per-frame entry point.
     *
     * @param {THREE.Camera} camera          active main camera
     * @param {object} [opts]
     * @param {THREE.Vector3} [opts.planetCenter]  for spherical-planet demos:
     *   distance to this point gives true altitude. When omitted the legacy
     *   flat-ground convention (`y` == altitude) is used.
     */
    update(camera: any, opts?: any): this;
    updateAerialPerspective(): any;
    applyHaze(sceneColorNode: any, options?: any): any;
    /**
     * Update haze strength after `applyHaze` has been wired. Multiplies
     * inscatter colour and AP alpha. 0 = no haze; 1 = physical default.
     * No-op if haze hasn't been applied yet (we'd just be priming a uniform
     * that the next applyHaze would re-seed anyway).
     */
    setHazeStrength(value: number): this;
    /**
     * Switch policy live. 'auto' blends AP→raymarch by altitude/coverage;
     * 'ap' uses AP-first with raymarch only past coverage; 'raymarch' forces
     * the raymarch fallback for every geometry pixel.
     */
    setHazePolicy(policy: string): this;
    /**
     * Adjust the auto-mode altitude blend window in km. Above `endKm` the
     * raymarch path is fully active; below `startKm` the AP LUT is used.
     */
    setHazeAltitudeBlend({ startKm, endKm }?: {
        startKm?: number;
        endKm?: number;
    }): this;
    /**
     * Convenience: build a `SkySun` bound to this Sky. The returned instance
     * owns a `THREE.DirectionalLight` that auto-tracks every `setSunDirection`
     * / `baker.setSun` via the baker's listener hook. Call `sun.attach(scene)`.
     */
    createSun(opts?: any): SkySun;
    /**
     * Convenience: build a `SkyGround` bound to this Sky. Sphere mode auto-sizes
     * from `baker.atmosphereParams.bottomRadius`. Call `ground.attach(scene)`.
     */
    createGround(opts?: any): SkyGround;
    /**
     * Convenience: build a `GroundedSkybox` bound to this Sky. The skybox
     * supplies a "floor" via cube-content reprojection — usually replaces an
     * explicit `SkyGround` plane. Add the returned mesh to your scene and
     * call `mesh.followCamera(camera)` each frame.
     */
    createGroundedSkybox(opts?: any): GroundedSkybox;
    /**
     * Convenience: build a `SkyMoon` bound to this Sky. Owns a
     * `THREE.DirectionalLight` representing moonlight; auto-tracks the sun
     * (anti-sun + lunar phase offset) by default. Does not feed the
     * atmosphere LUTs. Call `moon.attach(scene)`.
     */
    createMoon(opts?: any): SkyMoon;
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
    enableStars(opts?: any): Promise<any>;
    /**
     * Hide stars without unloading the texture. Re-show via `enableStars()`
     * (cheap — texture stays bound) or `setStarsIntensity( > 0 )`.
     */
    disableStars(): this;
    setStarsIntensity(value: number): this;
    setStarsRotation(radians: number): this;
    setStarsDensity(value: number): this;
    setStarsBrightness(value: number): this;
    setStarsSource(source: string): this;
    get stars(): any;
    dispose(): void;
    _refreshSunFromTime(): void;
}

interface SkyNightEnableOptions {
    source?: string;
    url?: string;
    texture?: any;
    intensity?: number;
    rotation?: number;
    density?: number;
    brightness?: number;
}
/**
 * Opt-in night-sky stars layer for `tsl-sky`.
 *
 * Two source modes, both attenuated by camera→space transmittance (so they
 * fade naturally through twilight) and occluded by the planet:
 *
 *  - `'procedural'` (default) — shader-generated hash-grid starfield. Zero
 *    asset cost, zero load time. Ideal for the 80% case: games, viz,
 *    real-time tooling. No Milky Way / constellations.
 *
 *  - `'hdri'` — sample an equirectangular HDR cube the caller provides. Ideal
 *    for photoreal night scenes. Caller MUST pass `{ url }` or
 *    `{ texture }` — the bundled `examples/hdri/NightSkyHDRI001_1K_HDR.exr`
 *    is for the demo only and is not included in the published package.
 *
 * Stars also flow into the IBL automatically via the cube re-bake (`enable`,
 * `setSource`, `setIntensity`, etc. all call `markCubeDirty`), so PBR
 * objects pick up a soft star ambient with no extra plumbing.
 *
 * Usage:
 * ```js
 * await sky.enableStars();                                    // procedural
 * await sky.enableStars({ density: 0.5, brightness: 1.5 });   // procedural, tuned
 * await sky.enableStars({ source: 'hdri', url: '/stars.exr' });
 * await sky.enableStars({ source: 'hdri', texture: myTex });
 * ```
 */
declare class SkyNight {
    sky: any;
    mesh: any;
    texture: any;
    source: string;
    _enabled: boolean;
    constructor(sky: any);
    get intensity(): any;
    set intensity(value: any);
    get rotation(): any;
    set rotation(value: any);
    get density(): any;
    set density(value: any);
    get brightness(): any;
    set brightness(value: any);
    setIntensity(value: number): this;
    setRotation(radians: number): this;
    setDensity(value: number): this;
    setBrightness(value: number): this;
    /**
     * Switch source live. Procedural keeps any HDR loaded but stops sampling
     * it; HDR requires the texture to already be bound (call `enable` with a
     * `url` or `texture` first, then `setSource('hdri')` is a no-op).
     *
     * @param {'procedural'|'hdri'} source
     */
    setSource(source: string): this;
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
    enable({ source, url, texture: existingTexture, intensity, rotation, density, brightness, }?: SkyNightEnableOptions): Promise<this>;
    /**
     * Hide stars without unloading the texture. Cheap re-enable via
     * `setIntensity( > 0 )`.
     */
    disable(): this;
    /**
     * Free any loaded HDR texture and revert to the placeholder. After this,
     * `enable({ source: 'hdri', ... })` must reload before HDR stars can be
     * shown again. Procedural mode is unaffected and remains available.
     */
    dispose(): void;
}

interface ApplyHazeOptions {
    sky?: any;
    scenePass?: any;
    policy?: string;
    strength?: number;
    altitudeBlend?: {
        startKm: number;
        endKm: number;
    };
    logarithmicDepthBuffer?: boolean;
    useCameraFar?: boolean;
    includeSkyCubeBlend?: boolean;
    raymarchFallback?: boolean;
    raymarchSampleCount?: number;
    debugMode?: string | null;
}
/**
 * Build a haze TSL output node from a `Sky` instance and a scene-color node.
 *
 * Returns a `vec4` node. Caller assigns it (or composes it with bloom etc.)
 * onto their pipeline's outputNode.
 *
 * Vanilla:
 *   const post = new PostProcessing(renderer);
 *   const scenePass = pass(scene, camera);
 *   post.outputNode = applyHaze(scenePass.getTextureNode(), { scenePass, sky });
 *
 * R3F (useRenderPipeline):
 *   useRenderPipeline(({ renderPipeline, passes }) => {
 *     renderPipeline.outputNode = applyHaze(
 *       passes.scenePass.getTextureNode(),
 *       { scenePass: passes.scenePass, sky }
 *     );
 *   });
 *
 * Uniform ownership: this function lazily attaches `hazeStrength`,
 * `hazePolicy`, altitude-blend, and `cameraFar` uniforms onto the supplied
 * `sky` instance. Callers can mutate the haze knobs after the fact via
 * `sky.setHazeStrength(value)` / `sky.setHazePolicy(name)` /
 * `sky.setHazeAltitudeBlend({startKm, endKm})` without rebuilding the
 * pipeline. The build-time `policy` / `strength` / `altitudeBlend` args
 * just seed initial values.
 *
 * @param {THREE.Node} sceneColorNode  scene-color node — typically `scenePass.getTextureNode()`
 * @param {object} options
 * @param {Sky} options.sky                              the `Sky` instance
 * @param {THREE.PassNode} options.scenePass             the `pass(scene, camera)` result
 * @param {'auto'|'ap'|'raymarch'} [options.policy='auto']
 * @param {number} [options.strength=1.0]                multiplies inscatter + AP alpha
 * @param {{startKm:number,endKm:number}} [options.altitudeBlend]   auto-mode altitude blend window
 * @param {boolean} [options.logarithmicDepthBuffer=false]  must match `WebGPURenderer({ logarithmicDepthBuffer })`
 * @param {boolean} [options.useCameraFar]               opt-in to viewZ-based sky detection.
 *   Required for planet-scale demos where `camera.far` is huge (10⁷ m+);
 *   the default linear-depth test fails when geometry compresses into a
 *   thin sliver of [0, 1] near the camera. When enabled the `Sky` lazily
 *   creates a `cameraFar` uniform refreshed each frame in `sky.update`.
 *   Defaults to `true` when `camera.far > 1e6`, else `false`.
 * @param {boolean} [options.includeSkyCubeBlend=false]  legacy shim — see HazePostProcess.js
 * @param {boolean} [options.raymarchFallback=true]      compile the per-pixel
 *   raymarch fallback into the shader. Default on so live policy switching
 *   works. Pass `false` for scenes whose geometry never exceeds AP coverage
 *   (a city under the default 256 km cap): the haze shader shrinks to a LUT
 *   sample + composite — much smaller WGSL, dramatically faster pipeline
 *   compile. With it off, `policy: 'raymarch'` and altitude blending are
 *   inert (geometry past coverage clamps to the LUT's last slice).
 * @param {number} [options.raymarchSampleCount=64]      samples per pixel on the
 *   raymarch fallback path (geometry past AP coverage / raymarch policy). 64
 *   keeps orbit-altitude grazing rays band-free; ground-level scenes can use
 *   32 or lower for a cheaper shader. Build-time constant — rebuild the node
 *   (call `applyHaze` again) to change it.
 * @param {string} [options.debugMode]                   AP debug mode passthrough
 * @returns {THREE.Node} vec4 output node
 */
declare function applyHaze(sceneColorNode: any, { sky, scenePass, policy, strength, altitudeBlend, logarithmicDepthBuffer, useCameraFar, includeSkyCubeBlend, raymarchFallback, raymarchSampleCount, debugMode, }?: ApplyHazeOptions): any;

/**
 * NOAA solar-position calculator (simplified).
 *
 * Inputs:
 *   - timeOfDay: 0..24 (local solar hours; pass UTC + offset yourself if you
 *     care about civil time)
 *   - dayOfYear: 1..365
 *   - latitude:  degrees, +N
 *
 * Returns: { elevation, azimuth } in degrees, where azimuth is measured
 * clockwise from geographic north (0 = N, 90 = E, 180 = S, 270 = W).
 *
 * Accuracy is ~0.1° — plenty for visual sky placement. The model does NOT
 * include atmospheric refraction; the real sun is ~0.5° higher than the
 * geometric sun near the horizon, but the renderer's atmospheric scattering
 * makes that visually invisible.
 *
 * Reference: https://gml.noaa.gov/grad/solcalc/solareqns.PDF
 */
interface SolarPositionOptions {
    timeOfDay?: number;
    dayOfYear?: number;
    latitude?: number;
}
interface SolarPositionResult {
    elevation: number;
    azimuth: number;
}
declare function solarPosition({ timeOfDay, dayOfYear, latitude, }?: SolarPositionOptions): SolarPositionResult;

interface Resolution2D$2 {
    width: number;
    height: number;
}
/**
 * Shader-authoring backend. `'auto'` (default) picks WGSL on the WebGPU backend
 * and TSL on WebGL. `'tsl'` / `'wgsl'` force one — used by the parity harness
 * and the `?core=` example convention. Forcing `'tsl'` on WebGPU is valid (TSL
 * transpiles to WGSL); that's exactly how parity is measured.
 */
type ShaderBackend$2 = 'auto' | 'tsl' | 'wgsl';
interface TransmittanceLUTOptions {
    resolution?: Resolution2D$2;
    atmosphereUniforms?: any;
    backend?: ShaderBackend$2;
}
/**
 * Bruneton / Hillaire Transmittance LUT.
 *
 * Owns an RGBA16F render target; `render()` runs a single fragment pass that, for
 * each texel, un-maps the Bruneton (viewHeight, viewZenithCosAngle) parameterization
 * from UV, raymarches ~40 steps to the atmosphere boundary accumulating optical
 * depth, and writes `exp(-opticalDepth)`.
 *
 * Faithful port of `RenderTransmittanceLutPS` (with the `IntegrateScatteredLuminance`
 * inner loop specialized to `ground=false, sampleCountIni=40, variableSampleCount=false,
 * MieRayPhase=false`, which makes the integrator collapse to just optical-depth
 * accumulation — no in-scattered luminance, no transmittance-to-sun sample).
 */
declare class TransmittanceLUT {
    renderer: any;
    resolution: Resolution2D$2;
    atmosphereUniforms: any;
    backend: ShaderBackend$2;
    renderTarget: RenderTarget;
    material: any;
    constructor(renderer: any, { resolution, atmosphereUniforms, backend }?: TransmittanceLUTOptions);
    get texture(): three.Texture<unknown, three.TextureEventMap>;
    _buildColorNode(): any;
    /**
     * Execute the fragment pass into the render target. Cheap to call repeatedly —
     * the atmosphere uniforms are bound by reference, so each call uses whatever
     * is currently in `atmosphereUniforms`.
     */
    render(): void;
    dispose(): void;
}

interface Resolution2D$1 {
    width: number;
    height: number;
}
type ShaderBackend$1 = 'auto' | 'tsl' | 'wgsl';
interface MultiScatterLUTOptions {
    resolution?: Resolution2D$1;
    atmosphereUniforms?: any;
    transmittanceLUT?: TransmittanceLUT;
    debugMode?: string | null;
    backend?: ShaderBackend$1;
}
/**
 * Hillaire Multiple-Scattering LUT.
 *
 * 32×32 RGBA16F. Parameterised by (cosSunZenith, viewHeight). Each texel
 * integrates over 64 stratified spherical directions, for each direction
 * ray-marches 20 steps through the atmosphere reading the Transmittance LUT,
 * then finalises via Hillaire's closed-form geometric-series sum
 *   L_psi_ms = L_2ndOrder / (1 − f_ms)
 * where `f_ms` is the atmosphere's "if every bounce were uniform-phase"
 * transfer factor (the `MultiScatAs1` field in the reference code).
 *
 * Port of `NewMultiScattCS` from RenderSkyRayMarching.hlsl:418-537. The Unreal
 * reference uses a compute shader with 64 threads per pixel + groupshared
 * reduction; we flatten the reduction into a per-pixel nested loop because
 * we chose a fragment pipeline in PLAN.md. Output is identical modulo
 * floating-point associativity.
 *
 * Finalisation math:
 *   Equation 5 (Hillaire 2020):  L_2ndOrder = Σ_directions L * 4π / N  · (1/4π)
 *   Equation 7:                  f_ms       = Σ_directions MSA · 4π / N  · (1/4π)
 *   Equation 10:                 L          = L_2ndOrder · 1/(1 − f_ms)
 * The `4π / N` is the per-sample solid-angle weight; the outer `1/(4π)` is
 * the isotropic phase. Algebraically the 4π cancels with 1/(4π), so the sum
 * reduces to `(1/N) Σ …`. We keep the factored form to match the HLSL
 * line-for-line.
 */
declare class MultiScatterLUT {
    renderer: any;
    resolution: Resolution2D$1;
    atmosphereUniforms: any;
    transmittanceLUT: TransmittanceLUT;
    debugMode: string | null;
    backend: ShaderBackend$1;
    renderTarget: RenderTarget;
    material: any;
    constructor(renderer: any, { resolution, atmosphereUniforms, transmittanceLUT, debugMode, backend, }?: MultiScatterLUTOptions);
    get texture(): three.Texture<unknown, three.TextureEventMap>;
    _buildColorNode(): any;
    render(): void;
    dispose(): void;
}

interface Resolution2D {
    width: number;
    height: number;
}
type ShaderBackend = 'auto' | 'tsl' | 'wgsl';
interface SkyViewLUTOptions {
    resolution?: Resolution2D;
    atmosphereUniforms?: any;
    transmittanceLUT?: TransmittanceLUT;
    multiScatterLUT?: MultiScatterLUT;
    sunDirection?: Vector3;
    backend?: ShaderBackend;
}
/**
 * Hillaire Sky-View LUT.
 *
 * 192×108 RGBA16F. Pre-integrated view-ray radiance from the camera, indexed by
 * the horizon-packed (azimuth, zenith) parameterization from RenderSkyCommon.hlsl:122.
 *
 * Port of `SkyViewLutPS` in RenderSkyRayMarching.hlsl:581-635. Reads the
 * Transmittance LUT for sun-direction extinction and the Multi-Scatter LUT for
 * higher-order bounces. Invokes `integrateScatteredLuminance` with
 * `mieRayPhase=true` and the MS LUT attached, matching the HLSL's
 * `MULTISCATAPPROX_ENABLED` + `MieRayPhase=true` path.
 *
 * View position assumption (phase 1b): viewer sits at ground level,
 * `viewHeight = bottomRadius + PLANET_RADIUS_OFFSET`. Phase 2 will promote this
 * to a camera-world-position uniform when we support non-ground views.
 *
 * Simplification vs. Unreal: the HLSL uses `VariableSampleCount=true`
 * (interpolates between RayMarchMinMaxSPP.x and .y based on distance). We use a
 * fixed 30-step loop — the HLSL's SampleCountIni default is 30 and a constant
 * step count lets `integrateScatteredLuminance` unroll cleanly. Quality
 * difference at the defaults is imperceptible.
 */
declare class SkyViewLUT {
    renderer: any;
    resolution: Resolution2D;
    atmosphereUniforms: any;
    transmittanceLUT: TransmittanceLUT;
    multiScatterLUT: MultiScatterLUT;
    backend: ShaderBackend;
    _sunDirectionUniform: any;
    _viewHeightUniform: any;
    renderTarget: RenderTarget;
    material: any;
    constructor(renderer: any, { resolution, atmosphereUniforms, transmittanceLUT, multiScatterLUT, sunDirection, backend, }?: SkyViewLUTOptions);
    get texture(): three.Texture<unknown, three.TextureEventMap>;
    /** Current sun direction as a Vector3 (returned by reference — mutate in place
     * or go through the setter to re-copy). */
    get sunDirection(): any;
    set sunDirection(v: any);
    /** Planet-centred camera height in km. Setter for phase 2 per-frame updates. */
    get viewHeight(): any;
    set viewHeight(km: any);
    _buildColorNode(): any;
    render(): void;
    dispose(): void;
}

interface AerialPerspectiveResolution {
    x: number;
    y: number;
    z: number;
}
interface AerialPerspectiveLUTOptions {
    resolution?: AerialPerspectiveResolution;
    kmPerSlice?: number;
    atmosphereUniforms?: any;
    transmittanceLUT?: TransmittanceLUT;
    multiScatterLUT?: MultiScatterLUT;
    sunDirection?: Vector3;
}
interface SetCameraOptions {
    planetCenter?: Vector3 | null;
}
/**
 * Hillaire Aerial Perspective LUT (3D froxel volume).
 *
 * Per voxel `(x, y, z)`:
 *  - X/Y are screen-space NDC; the voxel's view ray is reconstructed from the
 *    camera's inverse view-projection.
 *  - Z is a *squared-distributed* depth slice covering 0 → `kmPerSlice * resZ` km
 *    from the camera. Squared distribution packs more detail near the camera
 *    where haze gradients matter most.
 *
 * Each voxel ray-marches from the camera through the atmosphere for exactly its
 * slice's depth, accumulating in-scattered luminance + transmittance. The LUT
 * stores `vec4(L, 1 - mean(transmittance))` so the consumer can blend
 * `final = sceneColor * (1 - AP.a) + AP.rgb`.
 *
 * Built per-frame via a TSL compute shader writing into a `Storage3DTexture`.
 *
 * Port of `RenderCameraVolumePS` (and the geometry-shader-driven slice loop)
 * from `UnrealEngineSkyAtmosphere/Resources/RenderSkyRayMarching.hlsl:645-716`.
 * The Unreal version uses one render-target write per slice (32 slices ×
 * fragment pass each); our compute path writes the whole 32×32×32 volume in
 * one dispatch, which is more idiomatic on WebGPU.
 *
 * Coordinate frame: camera position is given in three.js Y-up world space (m).
 * Ground-level callers can keep the legacy flat convention (`camera.y` =
 * altitude), while planet-scale callers pass a planet centre so the AP volume
 * receives the true planet-centred camera vector. View directions are taken
 * straight from the camera's world-space transform.
 *
 * @typedef {Object} AerialPerspectiveLUTOptions
 * @property {{x:number,y:number,z:number}} [resolution] Voxel grid size. Defaults to 32³.
 * @property {number} [kmPerSlice] Atmospheric thickness per Z slice (km). Default 4. Total range = kmPerSlice * resZ km.
 * @property {object} atmosphereUniforms - Atmosphere uniform bundle (see AtmosphereUniforms.js).
 * @property {TransmittanceLUT} transmittanceLUT
 * @property {MultiScatterLUT} multiScatterLUT
 * @property {Vector3} [sunDirection] Initial sun direction (Y-up world). Default (0,1,0).
 */
declare class AerialPerspectiveLUT {
    renderer: any;
    resolution: AerialPerspectiveResolution;
    kmPerSlice: number;
    atmosphereUniforms: any;
    transmittanceLUT: TransmittanceLUT;
    multiScatterLUT: MultiScatterLUT;
    _tex: Storage3DTexture;
    _sunDirection: any;
    _cameraPosKm: any;
    _invProj: any;
    _cameraMatrixWorld: any;
    _compute: any;
    constructor(renderer: any, { resolution, kmPerSlice, atmosphereUniforms, transmittanceLUT, multiScatterLUT, sunDirection, }?: AerialPerspectiveLUTOptions);
    /** The 3D storage texture; bind as `texture( ap.texture, vec3 uvw )`
     * (NDC.xy + sqrt(slice/resZ) on Z) at consume time. */
    get texture(): Storage3DTexture;
    /** Camera inverse-projection uniform — kept in sync by `setCamera()`. */
    get invProjUniform(): any;
    /** Camera world-matrix uniform — kept in sync by `setCamera()`. */
    get cameraWorldUniform(): any;
    /** Camera position (km, planet-centred) uniform — kept in sync by `setCamera()`. */
    get cameraPositionKmUniform(): any;
    /**
     * Set the sun direction (Y-up world space, normalized). The same vector you
     * pass to `SkyAtmosphereBaker.setSun(...)` works here.
     */
    setSunDirection(v: any): void;
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
    setCamera(camera: any, { planetCenter }?: SetCameraOptions): void;
    /** Dispatch the compute pass. Cheap (~1ms on a mid-tier GPU). */
    render(): Promise<void>;
    dispose(): void;
    _buildCompute(): any;
}

interface SkyAtmosphereMeshOptions {
    atmosphereUniforms?: any;
    skyViewLUT?: any;
    transmittanceLUT?: any;
    multiScatterLUT?: any;
    sunDirection?: Vector3;
    upVector?: Vector3;
}
/**
 * Phase 1b visible sky — Hillaire LUT-sampled box mesh.
 *
 * Matches the shape of the legacy Preetham `SkyMesh` exactly: `BoxGeometry(1,1,1)`
 * with `BackSide` + `depthWrite=false` + the `z = w` vertex trick so the cube
 * always sits at the far plane. Only the fragment path changes — for each view
 * direction we un-map the Hillaire (viewZenithCos, lightViewCos) parameterization
 * and sample the Sky-View LUT.
 *
 * Port of the final-compose pass `RenderSkyWithLutsPS` in
 * `UnrealEngineSkyAtmosphere/Resources/RenderSkyRayMarching.hlsl:333`. Uses
 * `skyViewLutParamsToUv` (forward map) from `atmosphere.tsl.js`.
 *
 * Sun disc is rendered on top as a smoothstep against the angular diameter,
 * gated by `showSunDisc` (default 0 — off during bake to keep PMREM clean).
 *
 * Sun direction and up vector live in three.js-world Y-up coordinates (baked sky
 * scene uses the main scene's conventions). The Sky-View LUT itself is built in
 * a Z-up local frame, but the *UV parameterization* is frame-independent: it
 * only depends on (viewZenithCos, lightViewCos, viewHeight, intersectsGround),
 * which we compute here from the Y-up world vectors directly.
 */
declare class SkyAtmosphereMesh extends Mesh {
    atmosphereUniforms: any;
    skyViewLUT: any;
    transmittanceLUT: any;
    multiScatterLUT: any;
    sunDirection: any;
    upVector: any;
    showSunDisc: any;
    mirrorBelowHorizon: any;
    sunDiscIntensity: any;
    sunDiscCos: any;
    sunDiscCosInner: any;
    moonDirection: any;
    showMoonDisc: any;
    moonIntensity: any;
    moonDiscCos: any;
    moonColor: any;
    viewHeight: any;
    luminanceScale: any;
    _starsTexturePlaceholder: DataTexture;
    starsTextureNode: any;
    starsIntensity: any;
    starsMode: any;
    starsDensity: any;
    starsBrightnessScale: any;
    starsRotation: any;
    isSkyAtmosphereMesh: boolean;
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
    constructor({ atmosphereUniforms, skyViewLUT, transmittanceLUT, multiScatterLUT, sunDirection, upVector, }?: SkyAtmosphereMeshOptions);
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
    setSunAngularRadius(halfAngleRad: number, edgeSoftness?: number): this;
    _buildColorNode(): any;
}

/**
 * Single source of truth for Hillaire LUT texture sizes. Defaults match the paper.
 *
 * Overridable per-construction via `new SkyAtmosphereBaker(renderer, { lutResolutions })`.
 */
interface LutResolutions {
    transmittance: {
        width: number;
        height: number;
    };
    multiScatter: {
        width: number;
        height: number;
    };
    skyView: {
        width: number;
        height: number;
    };
    aerialPerspective: {
        x: number;
        y: number;
        z: number;
        kmPerSlice: number;
    };
}
declare const LUT_RESOLUTIONS: LutResolutions;

interface SkyAtmosphereBakerOptions {
    cubeSize?: number;
    atmosphere?: any;
    lutResolutions?: any;
    enableAerialPerspective?: boolean;
    apKmPerSlice?: number;
    apResolution?: any;
    mirrorBelowHorizon?: boolean;
}
/**
 * Phase 1b baker.
 *
 * Owns the three-LUT Hillaire pipeline (Transmittance → MultiScatter → SkyView)
 * and a visible `SkyAtmosphereMesh` that samples the Sky-View LUT. The mesh is
 * rendered into a CubeRenderTarget by a CubeCamera, then PMREM-filtered for
 * `scene.environment`.
 *
 * Public API is stable from phase 1a:
 *  - constructor(renderer, { cubeSize = 256, atmosphere?, lutResolutions? })
 *  - setSun({ elevation, azimuth })        — degrees
 *  - setAtmosphereParams(partial)          — merges onto current params
 *  - markCubeDirty()                       — force next update() to re-bake
 *  - update()                              — caller-driven; re-runs only dirty stages
 *  - .texture                              — raw cube (for scene.background)
 *  - .environmentTexture                   — PMREM-filtered (for scene.environment)
 *  - .sky                                  — the SkyAtmosphereMesh (for GUI access)
 *  - dispose()
 *
 * Dirty-flag semantics:
 *   atmosDirty  → Transmittance + MultiScatter + SkyView + cube + PMREM
 *   sunDirty    → SkyView + cube + PMREM          (T and MS do not depend on sun)
 *   cubeDirty   → cube + PMREM                    (e.g. markCubeDirty after direct mutation)
 *   cameraDirty → SkyView + AP                    (camera moved; only LUTs that read
 *                                                  viewHeight / camera matrices refresh)
 *
 * Phase 2 additions:
 *   - `setCamera(camera)`: feeds the main camera's height into SkyView LUT and
 *     mesh, and matrices into the AP LUT.
 *   - `updateAerialPerspective()`: renders just the AP LUT (per-frame), since
 *     it depends on camera position/orientation that change every frame.
 *   - `aerialPerspectiveTexture`: 3D texture consumers (the haze post-process)
 *     read to apply atmospheric haze on opaque scene geometry.
 */
declare class SkyAtmosphereBaker {
    renderer: any;
    cubeSize: number;
    lutResolutions: LutResolutions;
    atmosphereParams: AtmosphereParams;
    atmosphereUniforms: any;
    transmittanceLUT: TransmittanceLUT;
    multiScatterLUT: MultiScatterLUT;
    skyViewLUT: SkyViewLUT;
    aerialPerspectiveLUT: AerialPerspectiveLUT | null;
    apKmPerSlice: number;
    skyScene: Scene;
    sky: SkyAtmosphereMesh;
    cubeRenderTarget: CubeRenderTarget;
    cubeCamera: CubeCamera;
    _mirrorBelowHorizon: boolean;
    pmremGenerator: PMREMGenerator;
    _pmremTarget: any;
    sunDirty: boolean;
    atmosDirty: boolean;
    cubeDirty: boolean;
    cameraDirty: boolean;
    _sunVec: Vector3;
    _skyViewSunZenith: number;
    _sunListeners: Set<(sunVec: Vector3) => void>;
    _camera: PerspectiveCamera | null;
    _cameraPositionKm: Vector3;
    _cameraUp: Vector3;
    _cameraAltitudeM: number;
    _lastSkyViewHeightKm: number;
    _lastSkyViewZenith: number;
    _lastCubeZenith: number;
    constructor(renderer: any, { cubeSize, atmosphere, lutResolutions, enableAerialPerspective, apKmPerSlice, apResolution, mirrorBelowHorizon, }?: SkyAtmosphereBakerOptions);
    get texture(): Texture;
    get environmentTexture(): Texture | null;
    /** 3D Aerial Perspective LUT texture (phase 2). `null` if AP was disabled. */
    get aerialPerspectiveTexture(): any;
    get cameraPositionKm(): Vector3;
    get cameraAltitudeM(): number;
    get cameraUp(): Vector3;
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
    setCamera(camera: PerspectiveCamera, { planetCenter }?: {
        planetCenter?: Vector3 | null;
    }): void;
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
    _syncSkyViewSunFrame(): void;
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
    setSun({ elevation, azimuth }: {
        elevation: number;
        azimuth: number;
    }): void;
    /**
     * Subscribe to sun-direction changes. The listener fires after every
     * `setSun()` call with the current Y-up world-space sun vector (passed by
     * reference — clone in your callback if you need to keep a copy).
     *
     * @param {(sunVec: Vector3) => void} fn
     * @returns {() => void} unsubscribe function
     */
    addSunListener(fn: (sunVec: Vector3) => void): () => void;
    removeSunListener(fn: (sunVec: Vector3) => void): void;
    setAtmosphereParams(partial: any): void;
    /**
     * Mark the cube bake as stale. Useful when something mutated sky uniforms
     * directly without going through setSun/setAtmosphereParams.
     */
    markCubeDirty(): void;
    /**
     * Toggle the below-horizon Y-mirror on the cube bake. When `true`, the
     * next bake fills the cube's lower hemisphere with a clean Y-mirror of
     * the sky instead of the LUT's lit-ground-albedo content; the live sky
     * mesh in the main scene is unaffected. Forces a cube re-bake.
     */
    setMirrorBelowHorizon(flag: boolean): void;
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
    createSkyMesh({ scale, showSunDisc }?: {
        scale?: number;
        showSunDisc?: boolean;
    }): Mesh;
    /**
     * Caller-driven. Does nothing unless something is dirty. Re-runs only the
     * stages of the pipeline whose inputs changed.
     */
    update(): void;
    /**
     * Run the per-frame Aerial Perspective LUT compute pass. Caller invokes
     * each frame after `setCamera()` has been called. Cheap (~1ms on mid GPU).
     *
     * Separated from `update()` because AP must refresh per frame regardless
     * of dirty flags, while `update()` is dirty-driven.
     */
    updateAerialPerspective(): Promise<void>;
    dispose(): void;
}

/**
 * Visual debug helper that displays the sun frame at a point in world space.
 *
 * Renders:
 * - Azimuth compass ring on the local XZ plane (radius = size, #444444)
 * - Cardinal tick marks at +X, -X, +Z, -Z; +Z (north) is #e33 and 2x length
 * - Sun direction arrow from origin toward the sun (shaft #fc3, cone at tip)
 * - Elevation arc tracing from sun's horizon point up to the sun direction (#fc3, 40% opacity)
 *
 * The +Z tick mark always points north, matching the Sky facade's default
 * `north: '+Z'` orientation. Sun position updates are tracked via the baker's
 * sun listener and reflected in real time.
 *
 * @example
 * const helper = new SkyHelper(sky, { size: 20 })
 * scene.add(helper)
 * // ... later
 * helper.dispose()
 */
declare class SkyHelper extends Object3D {
    private baker;
    private size;
    private compassGroup;
    private arrowGroup;
    private elevationArc;
    private elevationGeometry;
    private sunListener;
    constructor(sky: any, options?: {
        size?: number;
    });
    private buildCompass;
    private buildArrow;
    private updateFromSun;
    dispose(): void;
}

interface CreateHazeOutputNodeArgs {
    scenePass: any;
    /**
     * Scene-color node to composite the haze over. Optional; falls back to
     * `scenePass.getTextureNode('output')`. Pass a composed graph (bloom, AO,
     * grading…) so the haze goes on top of it instead of the raw scene pass —
     * without this, every effect composed before the haze is silently discarded.
     */
    sceneColorNode?: any;
    aerialPerspectiveTexture: any;
    luminanceScale: any;
    invProjUniform: any;
    resZ?: number;
    kmPerSlice?: number;
    hazeStrength?: any;
    skyCube?: any;
    cameraWorldUniform?: any;
    cameraFarUniform?: any;
    logarithmicDepthBuffer?: boolean;
    hazeModeUniform?: any;
    raymarchBlendStartKm?: any;
    raymarchBlendEndKm?: any;
    raymarchCoverageBlendKm?: any;
    enableRaymarchFallback?: boolean;
    /**
     * Sample count for the per-pixel raymarch fallback. Default 64 — chosen to
     * keep 1000+ km grazing rays band-free at orbit altitude (see the comment at
     * the integrator call). Ground-level scenes whose raymarch rays stay short
     * can drop this to 32 (or SebH's production-equivalent ~14) for a cheaper
     * shader. Build-time constant: changing it requires rebuilding the node.
     */
    raymarchSampleCount?: number;
    atmosphereUniforms?: any;
    sunDirection?: any;
    viewHeightKm?: any;
    cameraPositionKm?: any;
    transmittanceLUT?: any;
    multiScatterLUT?: any;
    raymarchOnlyUniform?: any;
    debugMode?: string | null;
}
/**
 * Build the TSL output node for the Aerial Perspective haze post-process.
 *
 * Per-pixel:
 *   1. Reads the scene's NDC depth.
 *   2. Reconstructs the view-space hit position via the camera inverse projection.
 *   3. Computes distance from camera in km.
 *   4. Maps to AP LUT W axis: `w = sqrt(slice / resZ)` (inverse of the LUT's
 *      squared distribution), where `slice = distKm / kmPerSlice`.
 *   5. Samples the 3D AP LUT (`texture3D`) at `(uv.x, uv.y, w)`.
 *   6. Sky pixels (depth == 1.0) keep their original colour — they're the cube
 *      background, which already contains atmospheric scattering. Geometry
 *      pixels get composited as `sceneColor * (1 - AP.a) + AP.rgb * luminanceScale`.
 *
 * The `luminanceScale` matches `SkyAtmosphereMesh.luminanceScale` (default 40)
 * so haze brightness is consistent with the sky.
 *
 * @param {Object} args
 * @param {THREE.PassNode} args.scenePass - `pass(scene, camera)` result.
 * @param {THREE.Storage3DTexture} args.aerialPerspectiveTexture - the AP LUT 3D texture.
 * @param {THREE.UniformNode<float>} args.luminanceScale - typically the same uniform
 *   the sky mesh uses; pass `baker.sky.luminanceScale` or a wrapped uniform.
 * @param {THREE.UniformNode<mat4>} args.invProjUniform - camera inverse
 *   projection matrix (uniform). Driven by the demo's per-frame setCamera().
 * @param {number} args.resZ - AP LUT Z resolution. Default 32.
 * @param {number} args.kmPerSlice - AP LUT km per slice. Default 4.
 * @param {THREE.UniformNode<float>} [args.hazeStrength] - optional 0..1 multiplier
 *   on the inscatter contribution. Useful as a GUI slider for before/after
 *   comparison without rebuilding the LUT. Default unscaled (1.0).
 * @param {THREE.CubeTexture} [args.skyCube] - optional cube texture (typically
 *   `baker.texture`). When provided, fully-attenuated geometry pixels (heavy
 *   AP alpha) are blended toward the cube's color in their world ray
 *   direction. This closes the AP-coverage / Sky-View boundary mismatch:
 *   without it, a flat ground extending toward the horizon shows AP haze that
 *   stops abruptly at the cube-sky boundary because AP integrates only ~256
 *   km while Sky-View covers the full atmosphere (often 1000+ km of optical
 *   path on grazing rays).
 * @param {THREE.UniformNode<mat4>} [args.cameraWorldUniform] - camera world
 *   matrix. Required when skyCube is provided so we can transform view-space
 *   ray directions into world space for the cube sample. Also required when
 *   `enableRaymarchFallback` is on (raymarch needs Y-up world ray direction).
 *
 * Per-pixel raymarch fallback (planet-scale support):
 *
 * @param {boolean} [args.enableRaymarchFallback=false] - when true, geometry
 *   whose distance from the camera exceeds the AP LUT's coverage cap
 *   (`kmPerSlice * resZ` km) falls back to a per-pixel
 *   `integrateScatteredLuminance` ray-march so the planet surface from
 *   altitude integrates the *actual* atmospheric optical path instead of
 *   being clamped to slice 31 of the LUT. Required for orbit / high-altitude
 *   demos where surface pixels can be 1000+ km away. Below the cap the LUT
 *   is used unchanged.
 *
 *   Requires the following extra inputs to be supplied:
 * @param {object} [args.atmosphereUniforms] - the same uniform bundle that
 *   feeds the rest of the pipeline (`baker.atmosphereUniforms`).
 * @param {THREE.UniformNode<vec3>} [args.sunDirection] - Y-up world-space
 *   sun direction uniform (`baker.sky.sunDirection`).
 * @param {THREE.UniformNode<float>} [args.viewHeightKm] - camera altitude
 *   from planet centre, in km (`baker.sky.viewHeight`). Updated per-frame
 *   via `baker.setCamera()`.
 * @param {THREE.UniformNode<vec3>} [args.cameraPositionKm] - optional true
 *   planet-centred camera position in km. When omitted the legacy
 *   `(0, viewHeightKm, 0)` convention is used.
 * @param {*} [args.transmittanceLUT] - the Transmittance LUT texture node
 *   (`baker.transmittanceLUT.texture`).
 * @param {*} [args.multiScatterLUT] - the Multi-Scatter LUT texture node
 *   (`baker.multiScatterLUT.texture`).
 * @param {THREE.UniformNode<float>} [args.raymarchOnlyUniform] - optional
 *   0/1 float uniform. When set to 1, every geometry pixel goes through
 *   the per-pixel raymarch path instead of the AP LUT — bypassing the
 *   LUT entirely. Useful at orbit altitude where the LUT's
 *   camera-frustum-aligned voxel parameterization breaks down: off-axis
 *   views compress the slice distribution in screen space and start
 *   producing direction-sensitive coverage holes. Mid-term this should
 *   flip on automatically when camera altitude exceeds some threshold;
 *   for now it's a manual toggle so we can A/B. Requires
 *   `enableRaymarchFallback = true`.
 *
 * @param {boolean} [args.logarithmicDepthBuffer=false] - Must match
 *   `WebGPURenderer.logarithmicDepthBuffer`. When true, viewZ/linear depth are
 *   built with `logarithmicDepthToViewZ` (PassNode’s default assumes perspective
 *   depth and breaks haze if this is set wrong).
 * @returns {THREE.Node<vec4>} The output node — feed this to
 *   `RenderPipeline.outputNode = ...` (or the deprecated `PostProcessing`).
 */
declare function createHazeOutputNode({ scenePass, sceneColorNode, aerialPerspectiveTexture, luminanceScale, invProjUniform, resZ, kmPerSlice, // must match AerialPerspectiveLUT default
hazeStrength, skyCube, cameraWorldUniform, cameraFarUniform, logarithmicDepthBuffer, hazeModeUniform, raymarchBlendStartKm, raymarchBlendEndKm, raymarchCoverageBlendKm, enableRaymarchFallback, raymarchSampleCount, atmosphereUniforms, sunDirection, viewHeightKm, cameraPositionKm, transmittanceLUT, multiScatterLUT, raymarchOnlyUniform, debugMode, }: CreateHazeOutputNodeArgs): any;

export { AerialPerspectiveLUT, EARTH, GroundedSkybox, LUT_RESOLUTIONS, MultiScatterLUT, Sky, SkyAtmosphereBaker, SkyAtmosphereMesh, SkyGround, SkyHelper, SkyMoon, SkyNight, SkySun, SkyViewLUT, TransmittanceLUT, applyHaze, createHazeOutputNode, mergeAtmosphereParams, presets, resolvePreset, solarPosition };
