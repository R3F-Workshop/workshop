"use client";

import { useEffect, useMemo } from "react";
import { attribute, float, sin, time, uniform, vec3 } from "three/tsl";
import * as THREE from "three/webgpu";

import { makeRng } from "./scatter";

/** A dome of points that comes out as the sun goes down. */
export function Stars({
  count = 2500,
  radius = 1400,
  lightLevel = 1,
  size = 2.2,
  seed = 0x5eed,
}: {
  count?: number;
  /** Dome radius. */
  radius?: number;
  /** 0 in daylight, 1 at night. */
  lightLevel?: number;
  /** Star size in pixels. */
  size?: number;
  seed?: number;
}) {
  const darkness = useMemo(() => uniform(0), []);
  useEffect(() => {
    darkness.value = lightLevel;
  }, [darkness, lightLevel]);

  const geometry = useMemo(() => {
    const random = makeRng(seed);
    const positions = new Float32Array(count * 3);
    const brightness = new Float32Array(count);
    const phase = new Float32Array(count);
    for (let i = 0; i < count; i++) {
      // Even over the upper hemisphere, kept a little above the horizon so the city's skyline never has stars poking through it.
      const y = 0.04 + random() * 0.96;
      const r = Math.sqrt(1 - y * y);
      const angle = random() * Math.PI * 2;
      positions[i * 3] = Math.cos(angle) * r * radius;
      positions[i * 3 + 1] = y * radius;
      positions[i * 3 + 2] = Math.sin(angle) * r * radius;
      // Most stars are faint: a few are not.
      brightness[i] = 0.25 + random() ** 3 * 0.75;
      phase[i] = random() * Math.PI * 2;
    }
    const g = new THREE.BufferGeometry();
    g.setAttribute("position", new THREE.BufferAttribute(positions, 3));
    g.setAttribute("brightness", new THREE.BufferAttribute(brightness, 1));
    g.setAttribute("phase", new THREE.BufferAttribute(phase, 1));
    return g;
  }, [count, radius, seed]);

  const material = useMemo(() => {
    const m = new THREE.PointsNodeMaterial();
    const bright = attribute<"float">("brightness", "float");
    const twinkle = sin(time.mul(1.5).add(attribute<"float">("phase", "float")))
      .mul(0.2)
      .add(0.8);
    m.colorNode = vec3(1.0, 0.96, 0.88).mul(bright);
    m.opacityNode = darkness.mul(twinkle);
    m.sizeNode = float(size).mul(bright.mul(0.6).add(0.6));
    m.sizeAttenuation = false;
    m.transparent = true;
    m.depthWrite = false;
    m.blending = THREE.AdditiveBlending;
    return m;
  }, [darkness, size]);

  return <points geometry={geometry} material={material} frustumCulled={false} />;
}
