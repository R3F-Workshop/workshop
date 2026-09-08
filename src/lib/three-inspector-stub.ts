/**
 * Stub for `three/addons/inspector/Inspector.js`.
 *
 * Why this exists: R3F v10 alpha 3's WebGPU entry statically imports the three
 * Inspector, and the Inspector imports `REVISION` back out of `three/webgpu` —
 * a genuine import cycle. Under Turbopack the cycle resolves `three/webgpu` to
 * `undefined` mid-evaluation, so the very first import of
 * `@react-three/fiber/webgpu` throws:
 *
 *   TypeError: Cannot read properties of undefined (reading 'REVISION')
 *
 * The Inspector is opt-in devtooling — R3F leaves `state.inspector` null unless
 * you ask for it — so replacing it with a no-op breaks the cycle and costs us
 * nothing. Aliased in `next.config.ts`.
 *
 * Remove this once the alpha makes that import lazy; it's an upstream bug, not
 * a fact about this app.
 */

export class Inspector {
  // R3F never constructs this unless the inspector is explicitly enabled.
  init() {}
  dispose() {}
}

export default Inspector;
