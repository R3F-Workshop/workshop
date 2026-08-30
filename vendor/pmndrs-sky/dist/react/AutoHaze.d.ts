interface AutoHazeProps {
    [key: string]: any;
}
/**
 * Aerial-perspective haze post-process for `<Sky>`. Renders nothing; calls
 * `useRenderPipeline` and assigns `sky.applyHaze(scenePass)` to
 * `renderPipeline.outputNode`.
 *
 * Lives in its own sub-export (`tsl-sky/react/auto-haze`) so the
 * `useRenderPipeline` import is only pulled into bundles that actually
 * need it. R3F builds without that hook (e.g. `10.0.0-alpha.2`) can
 * still use the plain `<Sky>` from `tsl-sky/react`.
 *
 * Mutually exclusive with a user-owned `useRenderPipeline` — the docs
 * warn against multiple init callsites racing for `outputNode`. For
 * custom pipelines, skip `<AutoHaze />` and call `sky.applyHaze` from
 * your own `useRenderPipeline` callback (use `useSky()` to grab the
 * instance).
 *
 * Props are forwarded to `sky.applyHaze` as the options bag (e.g.
 * `policy`, `altStartKm`, `altEndKm`, `hazeStrength`, `skyCube`).
 *
 * `useRenderPipeline` does not currently support reactive callback
 * bodies — the callback closes over its initial deps. The `sky`
 * instance is stable across renders (Sky owns the haze uniforms, so
 * prop changes still take effect through `sky.setHaze*` setters even
 * without rebuilding the callback).
 */
declare function AutoHaze(options?: AutoHazeProps): null;

// @ts-ignore
export = AutoHaze;
export { AutoHaze };
export type { AutoHazeProps };
