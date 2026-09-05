"use client";

import CameraControls from "camera-controls";
import { useFrame, useThree } from "@react-three/fiber/webgpu";
import { useEffect, useRef } from "react";
import * as THREE from "three/webgpu";

/** `camera-controls`, wired by hand. drei ships a `<CameraControls>` wrapper but only from its default entry, not from `@react-three/drei/webgpu`. */
CameraControls.install({
  THREE: {
    Vector2: THREE.Vector2,
    Vector3: THREE.Vector3,
    Vector4: THREE.Vector4,
    Quaternion: THREE.Quaternion,
    Matrix4: THREE.Matrix4,
    Spherical: THREE.Spherical,
    Box3: THREE.Box3,
    Sphere: THREE.Sphere,
    Raycaster: THREE.Raycaster,
  },
});

export function CameraRig({
  /** Vertical angles are clamped so the box never reads upside down. */
  minPolar,
  maxPolar,
  minDistance = 3,
  maxDistance = 9,
  enabled = true,
}: {
  minPolar?: number;
  maxPolar?: number;
  minDistance?: number;
  maxDistance?: number;
  enabled?: boolean;
}) {
  const camera = useThree((s) => s.camera);
  const events = useThree((s) => s.events);
  const renderer = useThree((s) => s.renderer);

  // `renderer.domElement` is the *primary* canvas here: every section canvas borrows the hero's renderer.
  const element = (events.connected ??
    renderer.domElement) as unknown as HTMLElement;

  const controls = useRef<CameraControls | null>(null);

  useEffect(() => {
    const instance = new CameraControls(
      camera as THREE.PerspectiveCamera,
      element,
    );
    controls.current = instance;
    return () => {
      controls.current = null;
      instance.dispose();
    };
  }, [camera, element]);

  useEffect(() => {
    const instance = controls.current;
    if (!instance) return;
    instance.minPolarAngle = minPolar ?? Math.PI * 0.18;
    instance.maxPolarAngle = maxPolar ?? Math.PI * 0.82;
    instance.minDistance = minDistance;
    instance.maxDistance = maxDistance;
    instance.enabled = enabled;
    // Scrolling the page is worth more than zooming the box.
    instance.mouseButtons.wheel = CameraControls.ACTION.NONE;
    instance.touches.two = CameraControls.ACTION.TOUCH_ZOOM;
  }, [camera, element, minPolar, maxPolar, minDistance, maxDistance, enabled]);

  useFrame((_, delta) => {
    controls.current?.update(delta);
  });

  return null;
}
