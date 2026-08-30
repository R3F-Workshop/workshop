"use client";

import { useCallback, useEffect } from "react";
import { CameraControls, CameraControlsImpl } from "@react-three/drei";
import { useFrame, useThree } from "@react-three/fiber/webgpu";
import { button, useControls } from "leva";
import * as THREE from "three/webgpu";

const _box = new THREE.Box3();
const _size = new THREE.Vector3();
const _center = new THREE.Vector3();

export interface FramingOptions {
  /**
   * Breathing room around the tower, as a fraction of its largest dimension.
   *
   * NOT pixels: `fitToBox` adds padding to the bounding box in **world units**
   * (camera-controls.module.js:1665), so a viewport-relative value here would be
   * a hundred-odd world units of padding on a ~66-unit tower and dolly the
   * camera into the next arrondissement. Scaling off the box keeps it framing-
   * relative, which is what a viewport fraction was reaching for anyway.
   */
  padding?: number;
  autoRotate?: boolean;
  /**
   * Orbit drift, **degrees per second**.
   *
   * The original was `controls.rotate(delta * 0.0001, 0, true)` — about
   * 0.005°/sec, which is invisible, and passing `enableTransition: true` made it
   * worse: each frame damps toward a target a hair away and never arrives, so
   * the drift largely cancels itself. Real units, and no transition, since a
   * continuous drift wants to be applied directly.
   */
  autoRotateSpeed?: number;
  /** Locked orbit elevation, degrees. 90 is level with the horizon. */
  polarDegrees?: number;
  /**
   * Hand the camera over: free orbit, wheel dolly, no polar lock, no auto-fit.
   * Use it to dial framing in by hand — `logFraming` prints values to paste back
   * in as the new defaults.
   */
  unlocked?: boolean;
  /**
   * Metres per scene unit, mirrored from the scene's `worldScale`.
   *
   * The clip planes have to live on *this* camera, not on `<Canvas camera>`:
   * `makeDefault` replaces the Canvas camera outright, so those props never
   * apply. Missing that meant the far plane stayed at three's default 2000 while
   * `worldScale` pushed the city out to ~2000 units — the tower clipped away
   * entirely, which looks exactly like "the glow stopped and the controls died".
   */
  worldScale?: number;
  /**
   * Bump to re-fit. Driven by the tower's GLTF landing, rather than the camera
   * polling for a non-empty bounding box each frame — that retry loop is what
   * made the fit "sometimes not fire".
   */
  refitKey?: number;
}

/**
 * Ported from `threejs-conf-pmndrs/src/Camera.tsx`, with the framing fixed.
 *
 * The original called `fitToBox(tower)` and then `dollyTo(60)` on the very next
 * line, which throws the fit away and pins the camera at a constant distance —
 * correct at exactly one window size, cropped or tiny at every other. Since
 * `fov` is vertical, portrait was the worst case.
 *
 * Two things about `fitToBox` that are easy to get wrong, and were:
 *
 * 1. Padding is world units, not pixels (see `padding` above).
 * 2. It **snaps the polar angle to the nearest 90°** internally —
 *    `rotateTo(theta, roundToStep(phi, PI_HALF))`. Setting `min/maxPolarAngle`
 *    to the desired angle *before* fitting makes the two fight: the fit is
 *    computed for a snapped orientation and then clamped back. So the polar
 *    limits are released for the fit and re-applied after, which also means the
 *    fitted distance is measured against a level shot rather than a tilted one.
 */
export function Camera({
  targetRef,
  padding = 0.1,
  autoRotate = true,
  autoRotateSpeed = 2,
  polarDegrees = 93,
  unlocked = false,
  worldScale = 1,
  refitKey = 0,
}: FramingOptions & {
  targetRef: React.RefObject<THREE.Group | null>;
}) {
  const size = useThree((state) => state.size);
  const camera = useThree((state) => state.camera);
  const controls = useThree((state) => state.controls) as CameraControlsImpl;

  // Clip planes track worldScale. `<Canvas camera={{ near, far }}>` only applies
  // at creation, so scaling the world afterwards left the far plane at three's
  // default 2000 while the city stretched to ~2000 units — the tower clipped out
  // of existence.
  useEffect(() => {
    const cam = camera as THREE.PerspectiveCamera;
    if (!cam.isPerspectiveCamera) return;
    cam.fov = 30;
    cam.near = 0.2 * worldScale;
    // City outer radius is 400 scene units, so the far corner sits ~800·scale
    // away with the camera backed off from it.
    cam.far = 1400 * worldScale;
    cam.updateProjectionMatrix();
  }, [camera, worldScale]);

  const frame = useCallback(() => {
    const target = targetRef.current;
    const cam = camera as THREE.PerspectiveCamera;
    if (!controls || !target || !cam?.isPerspectiveCamera) return false;

    // Nothing below is meaningful before the canvas has a real size — aspect is
    // 0 or NaN on the first pass, and that is what poisoned the camera to
    // `[NaN, NaN, NaN]`: a NaN distance went into the controls and every
    // subsequent frame inherited it.
    if (!(cam.aspect > 0) || !Number.isFinite(cam.aspect)) return false;

    // Force the parent chain current before measuring. `Box3.setFromObject`
    // refreshes the target's own descendants but NOT its ancestors — and this
    // fit can run from an effect before the first render has ever computed
    // the `worldScale` group's matrixWorld. Measured then, the tower reads at
    // 1/worldScale size and the camera parks 5× too close (tgt y 12 instead
    // of 60, dist 57 instead of 285 — the "camera inside the letters" boot).
    target.updateWorldMatrix(true, true);

    // The GLTF may not have populated the group yet.
    _box.setFromObject(target);
    if (_box.isEmpty()) return false;

    _box.getSize(_size);
    _box.getCenter(_center);
    if (!Number.isFinite(_size.length()) || _size.length() === 0) return false;

    // Framing computed directly rather than via `controls.fitToBox`.
    //
    // fitToBox has burned three separate bugs here: its padding is in world
    // units (not pixels), it snaps the polar angle to the nearest 90° while
    // fitting, and it produced a NaN distance from a not-yet-sized camera. The
    // maths it saves is six lines, and doing it here means every value can be
    // checked finite before it reaches the camera.
    const halfFov = THREE.MathUtils.degToRad(cam.fov) * 0.5;
    // fov is vertical, so the horizontal fit has to divide by aspect — this is
    // what keeps the tower framed in portrait as well as landscape.
    const fitHeight = _size.y * 0.5 / Math.tan(halfFov);
    const fitWidth = _size.x * 0.5 / (Math.tan(halfFov) * cam.aspect);
    const distance = Math.max(fitHeight, fitWidth) * (1 + padding) + _size.z * 0.5;

    if (!Number.isFinite(distance) || distance <= 0) return false;

    const polar = THREE.MathUtils.degToRad(polarDegrees);
    const azimuth = Number.isFinite(controls.azimuthAngle)
      ? controls.azimuthAngle
      : 0;

    const sinPolar = Math.sin(polar);
    const position = new THREE.Vector3(
      _center.x + distance * sinPolar * Math.sin(azimuth),
      _center.y + distance * Math.cos(polar),
      _center.z + distance * sinPolar * Math.cos(azimuth),
    );

    if (!Number.isFinite(position.x + position.y + position.z)) return false;

    // Limits have to be open while setting, or the assignment is clamped to the
    // previous lock and the shot silently differs from the one computed.
    controls.minPolarAngle = 0;
    controls.maxPolarAngle = Math.PI;
    controls.setLookAt(
      position.x,
      position.y,
      position.z,
      _center.x,
      _center.y,
      _center.z,
      false,
    );
    if (!unlocked) {
      controls.minPolarAngle = polar;
      controls.maxPolarAngle = polar;
    }
    return true;
  }, [controls, camera, targetRef, padding, polarDegrees, unlocked]);

  useEffect(() => {
    if (!controls) return;

    if (unlocked) {
      // Full manual control. Keep a sliver away from the poles so the orbit
      // doesn't gimbal at straight up / straight down.
      controls.minPolarAngle = 0.01;
      controls.maxPolarAngle = Math.PI - 0.01;
      controls.mouseButtons = {
        left: CameraControlsImpl.ACTION.ROTATE,
        middle: CameraControlsImpl.ACTION.DOLLY,
        right: CameraControlsImpl.ACTION.TRUCK,
        wheel: CameraControlsImpl.ACTION.DOLLY,
      };
      controls.touches = {
        one: CameraControlsImpl.ACTION.TOUCH_ROTATE,
        two: CameraControlsImpl.ACTION.TOUCH_DOLLY_TRUCK,
        three: CameraControlsImpl.ACTION.TOUCH_TRUCK,
      };
      return;
    }

    controls.mouseButtons = {
      left: CameraControlsImpl.ACTION.ROTATE,
      middle: CameraControlsImpl.ACTION.ROTATE,
      right: CameraControlsImpl.ACTION.ROTATE,
      wheel: CameraControlsImpl.ACTION.NONE,
    };
    controls.touches = {
      one: CameraControlsImpl.ACTION.TOUCH_ROTATE,
      two: CameraControlsImpl.ACTION.TOUCH_ROTATE,
      three: CameraControlsImpl.ACTION.TOUCH_ROTATE,
    };

    // `refitKey` (the tower's GLTF landing) is the trigger, not a polling loop.
    // One retry on the next frame is still kept, because a resize can arrive
    // before R3F has written the new aspect onto the camera and `frame()`
    // correctly refuses to compute against a stale one.
    if (frame()) return;

    const raf = requestAnimationFrame(() => frame());
    return () => cancelAnimationFrame(raf);
    // `size` is not read in `frame` directly, but a resize must re-fit — that
    // is the entire point of the rewrite.
  }, [controls, frame, unlocked, refitKey, size.width, size.height]);

  useFrame((_, delta) => {
    if (!controls || !autoRotate || unlocked || autoRotateSpeed === 0) return;
    // Applied directly (no transition) — a continuous drift is the target, not
    // something to ease toward. Also gives the temporal passes real motion to
    // reproject against, which a static camera never exercises.
    controls.rotate(
      THREE.MathUtils.degToRad(autoRotateSpeed) * delta,
      0,
      false,
    );
  });

  return (
    <>
      {/* Only ONE camera. The original paired `<CameraControls makeDefault>`
          with `<PerspectiveCamera makeDefault>`, and two components both
          claiming "default" is a race: CameraControls binds to whatever
          `state.camera` is when it mounts, so `fitToBox` can end up driving a
          camera that is not the one being rendered — which presents as controls
          that do nothing at all. The Canvas's own camera is the single default;
          its clip planes are set imperatively above, because `<Canvas camera>`
          props are applied once at creation and don't track `worldScale`. */}
      <CameraControls makeDefault />
    </>
  );
}

/**
 * Mounts inside the Canvas so it can reach `useThree().controls`, and adds a
 * "log framing" button to the panel. Separate from `<Camera>` so the ported
 * component stays free of Leva.
 */
export function FramingTools() {
  const controls = useThree((state) => state.controls) as CameraControlsImpl;

  useControls("framing", {
    logFraming: button(() => logFraming(controls)),
  });

  return null;
}

/** Print the current framing in a form that can be pasted back as defaults. */
export function logFraming(controls: CameraControlsImpl | null) {
  if (!controls) {
    console.warn("[hero-demo] no camera controls yet");
    return;
  }
  const pos = controls.getPosition(new THREE.Vector3());
  const tgt = controls.getTarget(new THREE.Vector3());
  const round = (v: number) => Math.round(v * 100) / 100;

  console.log(
    `[hero-demo] framing
  position:  [${round(pos.x)}, ${round(pos.y)}, ${round(pos.z)}]
  target:    [${round(tgt.x)}, ${round(tgt.y)}, ${round(tgt.z)}]
  distance:  ${round(controls.distance)}
  polar:     ${round(THREE.MathUtils.radToDeg(controls.polarAngle))}°
  azimuth:   ${round(THREE.MathUtils.radToDeg(controls.azimuthAngle))}°`,
  );
}
