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
  /** Breathing room around the tower, as a fraction of its largest dimension. */
  padding?: number;
  autoRotate?: boolean;
  /** Orbit drift, **degrees per second**. */
  autoRotateSpeed?: number;
  /** Locked orbit elevation, degrees. 90 is level with the horizon. */
  polarDegrees?: number;
  /** Hand the camera over: free orbit, wheel dolly, no polar lock, no auto-fit. */
  unlocked?: boolean;
  /** Metres per scene unit, mirrored from the scene's `worldScale`. */
  worldScale?: number;
  /** Bump to re-fit. */
  refitKey?: number;
}


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

  // Clip planes track worldScale.
  useEffect(() => {
    const cam = camera as THREE.PerspectiveCamera;
    if (!cam.isPerspectiveCamera) return;
    cam.fov = 30;
    cam.near = 0.2 * worldScale;
    // City outer radius is 400 scene units, so the far corner sits ~800·scale away with the camera backed off from it.
    cam.far = 1400 * worldScale;
    cam.updateProjectionMatrix();
  }, [camera, worldScale]);

  const frame = useCallback(() => {
    const target = targetRef.current;
    const cam = camera as THREE.PerspectiveCamera;
    if (!controls || !target || !cam?.isPerspectiveCamera) return false;

    // Wait for a finite canvas aspect ratio before calculating the camera pose.
    if (!(cam.aspect > 0) || !Number.isFinite(cam.aspect)) return false;

    // Force the parent chain current before measuring.
    target.updateWorldMatrix(true, true);

    // The GLTF may not have populated the group yet.
    _box.setFromObject(target);
    if (_box.isEmpty()) return false;

    _box.getSize(_size);
    _box.getCenter(_center);
    if (!Number.isFinite(_size.length()) || _size.length() === 0) return false;

    // Compute framing directly to keep the camera pose deterministic.
    const halfFov = THREE.MathUtils.degToRad(cam.fov) * 0.5;
    // fov is vertical, so the horizontal fit has to divide by aspect: this is what keeps the tower framed in portrait as well as landscape.
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

    // Limits have to be open while setting, or the assignment is clamped to the previous lock and the shot silently differs from the one computed.
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
      // Full manual control.
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
    if (frame()) return;

    const raf = requestAnimationFrame(() => frame());
    return () => cancelAnimationFrame(raf);
    // `size` is not read in `frame` directly, but a resize must re-fit: that is the entire point of the rewrite.
  }, [controls, frame, unlocked, refitKey, size.width, size.height]);

  useFrame((_, delta) => {
    if (!controls || !autoRotate || unlocked || autoRotateSpeed === 0) return;
    // Applied directly (no transition): a continuous drift is the target, not something to ease toward.
    controls.rotate(
      THREE.MathUtils.degToRad(autoRotateSpeed) * delta,
      0,
      false,
    );
  });

  return (
    <>
      {/* Only ONE camera. */}
      <CameraControls makeDefault />
    </>
  );
}

/** Mounts inside the Canvas so it can reach `useThree().controls`, and adds a "log framing" button to the panel. */
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
