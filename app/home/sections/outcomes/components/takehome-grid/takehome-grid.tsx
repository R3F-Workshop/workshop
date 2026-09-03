"use client";

import { useFrame, useThree } from "@react-three/fiber/webgpu";
import { useEffect, useMemo, useRef } from "react";
import * as THREE from "three/webgpu";

import { TAKEHOME_NAMES, type TakehomeGridConfig } from "./config";

/** A rank of tiles that turn over one at a time to show what you leave with. */

/** A tab left in the background accumulates no frames, but `delta` still counts the wall clock. */
const MAX_DT = 1 / 20;

/** Uses perspective coordinates so viewport dimensions stay in world units. */
export const TAKEHOME_CAMERA = { position: [0, 0, 6], fov: 35 } as const;

/** Label resolution. */
const LABEL_W = 512;
const LABEL_H = 320;

function smoothstep(edge0: number, edge1: number, x: number) {
  const t = Math.min(Math.max((x - edge0) / (edge1 - edge0), 0), 1);
  return t * t * (3 - 2 * t);
}

/** Lands past the target and settles back, so a tile arrives rather than stops. */
function easeOutBack(t: number, overshoot: number) {
  const c = overshoot;
  const p = t - 1;
  return 1 + (c + 1) * p * p * p + c * p * p;
}

/** One label per tile, drawn straight into a canvas. */
function makeLabel(
  text: string,
  back: string,
  ink: string,
): THREE.CanvasTexture {
  const canvas = document.createElement("canvas");
  canvas.width = LABEL_W;
  canvas.height = LABEL_H;
  const ctx = canvas.getContext("2d")!;

  ctx.fillStyle = back;
  ctx.fillRect(0, 0, LABEL_W, LABEL_H);

  ctx.fillStyle = ink;
  ctx.font =
    '500 54px ui-monospace, SFMono-Regular, "SF Mono", Menlo, Consolas, monospace';
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.fillText(text, LABEL_W / 2, LABEL_H / 2);

  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.anisotropy = 4;
  return texture;
}

export function TakehomeGrid({ config }: { config: TakehomeGridConfig }) {
  const { viewport } = useThree();
  const tiles = useRef<(THREE.Mesh | null)[]>([]);
  const clock = useRef(0);

  const count = config.cols * config.rows;
  const names = useMemo(() => TAKEHOME_NAMES.slice(0, count), [count]);

  const labels = useMemo(
    () => names.map((n) => makeLabel(n, config.back, config.ink)),
    [names, config.back, config.ink],
  );
  useEffect(() => () => labels.forEach((t) => t.dispose()), [labels]);

  // Fit the whole rank inside the frame rather than filling it: this sits in a card slot whose aspect is nothing like the grid's.
  const { scale, positions, height } = useMemo(() => {
    const height = config.tile / config.aspect;
    const totalW = config.cols * config.tile + (config.cols - 1) * config.gap;
    const totalH = config.rows * height + (config.rows - 1) * config.gap;

    const positions: [number, number][] = [];
    for (let i = 0; i < count; i++) {
      const ix = i % config.cols;
      const iy = Math.floor(i / config.cols);
      positions.push([
        (ix - (config.cols - 1) / 2) * (config.tile + config.gap),
        -(iy - (config.rows - 1) / 2) * (height + config.gap),
      ]);
    }

    // Keep labels clear of the tile edges.
    const scale =
      Math.min(
        (viewport.width * 0.86) / totalW,
        (viewport.height * 0.74) / totalH,
      ) || 1;

    return { scale, positions, height };
  }, [
    config.cols,
    config.rows,
    config.tile,
    config.aspect,
    config.gap,
    count,
    viewport.width,
    viewport.height,
  ]);

  useFrame((_, delta) => {
    clock.current += Math.min(delta, MAX_DT);

    const { stagger, turn, hold, close, overshoot } = config;
    // Last tile starts at (count-1)·stagger and takes `turn` to land: the grid then holds, closes together, and the cycle restarts from flat.
    const revealed = (count - 1) * stagger + turn;
    const cycle = revealed + hold + close;
    const t = clock.current % cycle;

    // Closing is the whole rank at once, which reads as putting them away rather than as the reveal running backwards.
    const closing = smoothstep(cycle - close, cycle, t);

    for (let i = 0; i < count; i++) {
      const mesh = tiles.current[i];
      if (!mesh) continue;

      const start = i * stagger;
      const p = smoothstep(start, start + turn, t);
      const eased = p <= 0 ? 0 : easeOutBack(p, overshoot);
      mesh.rotation.y = Math.PI * eased * (1 - closing);
    }
  });

  return (
    <group scale={scale}>
      <ambientLight intensity={config.ambient} />
      <directionalLight
        position={[1.6, 2.4, 3.2]}
        intensity={config.keyIntensity}
        color="#fff4e6"
      />

      {names.map((name, i) => (
        <mesh
          key={name}
          ref={(m) => {
            tiles.current[i] = m;
          }}
          position={[positions[i][0], positions[i][1], 0]}
        >
          <boxGeometry
            args={[config.tile, height, height * config.thickness]}
          />
          {/* BoxGeometry's six material slots, in three's order: +x, -x, +y, -y, +z, -z. */}
          <meshStandardMaterial
            attach="material-0"
            color={config.edge}
            roughness={0.7}
          />
          <meshStandardMaterial
            attach="material-1"
            color={config.edge}
            roughness={0.7}
          />
          <meshStandardMaterial
            attach="material-2"
            color={config.edge}
            roughness={0.7}
          />
          <meshStandardMaterial
            attach="material-3"
            color={config.edge}
            roughness={0.7}
          />
          <meshStandardMaterial
            attach="material-4"
            color={config.front}
            roughness={0.85}
          />
          <meshStandardMaterial
            attach="material-5"
            map={labels[i]}
            roughness={0.62}
          />
        </mesh>
      ))}
    </group>
  );
}
