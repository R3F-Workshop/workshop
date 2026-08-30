import * as react from 'react';
import { ReactNode } from 'react';

interface SkyProps {
    preset?: string;
    quality?: string;
    cubeSize?: number;
    atmosphere?: any;
    enableAerialPerspective?: boolean;
    apKmPerSlice?: number;
    mirrorBelowHorizon?: boolean;
    exposure?: number;
    north?: any;
    sunDisc?: boolean;
    timeOfDay?: number;
    latitude?: number;
    dayOfYear?: number;
    sunDirection?: any;
    turbidity?: number;
    groundAlbedo?: any;
    hazeStrength?: number;
    hazePolicy?: any;
    hazeAltitudeBlend?: any;
    children?: ReactNode;
}
/**
 * `<Sky>` — mounts a vanilla `Sky` instance against the active R3F renderer
 * and scene, drives `update(camera)` per frame, and publishes the instance
 * via context for `useSky()` consumers.
 *
 * Construction-time options (cause a remount when changed):
 *   `preset`, `quality`, `cubeSize`, `enableAerialPerspective`, `apKmPerSlice`
 *
 * Imperative props (applied via setters; no remount):
 *   `timeOfDay`, `latitude`, `dayOfYear`, `sunDirection`, `north`,
 *   `exposure`, `sunDisc`, `turbidity`, `groundAlbedo`, `atmosphere`,
 *   `hazeStrength`, `hazePolicy`, `hazeAltitudeBlend`, `mirrorBelowHorizon`
 *
 * Aerial-perspective haze post-process: render an `<AutoHaze />` child
 * (imported from `tsl-sky/react/auto-haze`). It calls `useRenderPipeline`
 * and assigns the haze composite to `renderPipeline.outputNode`. The
 * separate sub-export keeps `useRenderPipeline` out of this module's
 * import graph, so `<Sky>` works on R3F builds where the hook hasn't
 * shipped yet (e.g. `10.0.0-alpha.2`). For custom pipelines, skip
 * `<AutoHaze />` and call `sky.applyHaze` from your own
 * `useRenderPipeline` callback (use `useSky()` to grab the instance).
 */
declare function Sky({ preset, quality, cubeSize, atmosphere, enableAerialPerspective, apKmPerSlice, mirrorBelowHorizon, exposure, north, sunDisc, timeOfDay, latitude, dayOfYear, sunDirection, turbidity, groundAlbedo, hazeStrength, hazePolicy, hazeAltitudeBlend, children, }: SkyProps): react.JSX.Element;

/**
 * Shape of the value published on `SkyContext` — the active vanilla `Sky`
 * instance. Only the surface used by React consumers is typed here; TSL /
 * three objects are left as `any`.
 */
interface SkyContextValue {
    attach(scene: any): void;
    detach(): void;
    dispose(): void;
    update(camera: any): void;
    setTimeOfDay(timeOfDay: number): void;
    setLatitude(latitude: number): void;
    setDayOfYear(dayOfYear: number): void;
    setSunDirection(sunDirection: any): void;
    setExposure(exposure: number): void;
    setSunDisc(sunDisc: boolean): void;
    setNorth(north: any): void;
    setTurbidity(turbidity: number): void;
    setGroundAlbedo(groundAlbedo: any): void;
    setAtmosphere(atmosphere: any): void;
    setMirrorBelowHorizon(mirrorBelowHorizon: boolean): void;
    setHazeStrength(hazeStrength: number): void;
    setHazePolicy(hazePolicy: any): void;
    setHazeAltitudeBlend(hazeAltitudeBlend: any): void;
    applyHaze(sceneTexture: any, options?: any): any;
    [key: string]: any;
}
declare const SkyContext: react.Context<SkyContextValue | null>;
/**
 * Returns the active `Sky` instance, or `null` if no `<Sky>` is mounted.
 *
 * Use this to reach the underlying instance from a child component — for
 * example to call `applyHaze` from a `useRenderPipeline` callback:
 *
 *   const sky = useSky();
 *   useRenderPipeline(({ renderPipeline, passes }) => {
 *     if (!sky) return;
 *     renderPipeline.outputNode = sky.applyHaze(
 *       passes.scenePass.getTextureNode(),
 *       { scenePass: passes.scenePass }
 *     );
 *   });
 */
declare function useSky(): SkyContextValue | null;

export { Sky, SkyContext, useSky };
