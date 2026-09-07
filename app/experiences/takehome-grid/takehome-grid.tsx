"use client";

import { Canvas, useFrame, useThree } from "@react-three/fiber/webgpu";
import { folder, useControls } from "leva";
import { useEffect, useMemo, useRef } from "react";
import * as THREE from "three/webgpu";

import { DepthAttachmentSync } from "@/components/depth-attachment-sync";
import { useWebGPU } from "@/lib/use-webgpu";

/**
 * A rank of tiles that turn over one at a time to show what you leave with.
 *
 * The whole experience: a canvas, the scene inside it, and the Leva controls
 * that tune it. Drop `<TakehomeGrid />` into any box and it fills it.
 *
 * The flip grid in the "Why now" section looks like this one's sibling and is
 * built nothing like it, which is the interesting part. That grid runs 1800
 * tiles whose flip angle, velocity and hold timer are history-dependent — it
 * needs somewhere on the GPU to keep per-instance state, and a compute pass to
 * integrate it. This one has six tiles on a fixed timeline, so every angle is a
 * pure function of the tile's index and the clock. No storage buffer, no
 * compute pass, no instancing: six meshes and a loop.
 *
 * Worth keeping the contrast. Reaching for the heavy machinery here would cost
 * more code and run slower.
 *
 * The turn is about Y rather than X on purpose. Both put the far face toward
 * the camera, but a π turn about X arrives upside down, and the label would
 * have to be drawn flipped to compensate. About Y it lands the right way up and
 * BoxGeometry's own per-face UVs do the rest.
 */

/**
 * What the tiles say.
 *
 * These are the real demo slugs, and that is the whole point of the card: the
 * things being handed over are the things the visitor has already scrolled
 * past. Adding a name here that isn't a demo yet would make the card a claim
 * rather than evidence, so the list grows when the demos do.
 */
const TAKEHOME_NAMES = [
  "magic-box",
  "flip-grid",
  "grain-gradient",
  "blending-cube",
  "block-city",
  "connectors",
];

/** The dials. Their defaults live on the Leva schema at the bottom of the file. */
type TakehomeGridConfig = {
  cols: number;
  rows: number;

  /** Tile width in world units; height follows from `aspect`. */
  tile: number;
  aspect: number;
  gap: number;
  /** Tile depth as a fraction of its height — the edge you see mid-turn. */
  thickness: number;

  /** Seconds between one tile starting its turn and the next. */
  stagger: number;
  /** Seconds a single tile takes to turn. */
  turn: number;
  /** Seconds the full grid stays revealed before it closes again. */
  hold: number;
  /** Seconds the whole grid takes to turn back. */
  close: number;
  /** How far past the landing the turn overshoots, 0 for none. */
  overshoot: number;

  /** The resting face — dark, so the reveal is a change in value not hue. */
  front: string;
  /** The revealed face. */
  back: string;
  /** The type on the revealed face. */
  ink: string;
  edge: string;

  ambient: number;
  keyIntensity: number;
};

/**
 * A tab left in the background accumulates no frames, but `delta` still counts
 * the wall clock — without this the sequence jumps most of a cycle on return.
 */
const MAX_DT = 1 / 20;

/** Label resolution. Wide, because the tiles are wide and the type is one line. */
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

/**
 * One label per tile, drawn straight into a canvas.
 *
 * Deliberately not a loaded texture. `useTexture` suspends, and a promise
 * thrown inside the Canvas is re-thrown past it by its own Suspense fallback,
 * which unmounts the root — see pmndrs/react-three-fiber#3850. A CanvasTexture
 * is built synchronously and sidesteps the whole problem.
 */
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

function Scene({ config }: { config: TakehomeGridConfig }) {
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

  // Fit the whole rank inside the frame rather than filling it: this sits in a
  // card slot whose aspect is nothing like the grid's, so overflowing would
  // crop a name and a cropped name is worse than a small one.
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

    // Margins are generous on purpose. This has to survive a 190px card slot
    // whose aspect is nothing like the rank's, and a cropped name is a worse
    // failure than a small one.
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
    // Last tile starts at (count-1)·stagger and takes `turn` to land; the grid
    // then holds, closes together, and the cycle restarts from flat.
    const revealed = (count - 1) * stagger + turn;
    const cycle = revealed + hold + close;
    const t = clock.current % cycle;

    // Closing is the whole rank at once, which reads as putting them away
    // rather than as the reveal running backwards.
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
          {/* BoxGeometry's six material slots, in three's order: +x, -x, +y,
              -y, +z, -z. The camera sees +z at rest and -z once turned, so the
              label goes on slot 5 and everything else is the edge. */}
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

export function TakehomeGrid() {
  // Namespaced, because Leva's store is global and every demo shares it. The
  // panel only shows where a `LevaPanel` is mounted, so on the site these are
  // simply the defaults.
  // `tile` is not exposed: it is the unit the rest of the layout is measured
  // in, and the fit-to-frame scale makes changing it a no-op.
  const controls = useControls("takehome grid", {
    grid: folder({
      cols: { value: 3, min: 1, max: 4, step: 1 },
      rows: { value: 2, min: 1, max: 3, step: 1 },
      aspect: { value: 1.6, min: 0.8, max: 3.5, step: 0.05 },
      gap: { value: 0.07, min: 0, max: 0.4, step: 0.01 },
      thickness: { value: 0.11, min: 0.02, max: 0.5, step: 0.005 },
    }),
    timing: folder({
      stagger: { value: 0.36, min: 0, max: 1.5, step: 0.02 },
      turn: { value: 0.85, min: 0.2, max: 3, step: 0.05 },
      hold: { value: 2.6, min: 0.2, max: 8, step: 0.1 },
      close: { value: 0.75, min: 0.2, max: 3, step: 0.05 },
      overshoot: { value: 1.35, min: 0, max: 3, step: 0.05 },
    }),
    colour: folder({
      front: { value: "#2b2b34" },
      back: { value: "#e6e1d6" },
      ink: { value: "#14141a" },
      edge: { value: "#4a4a55" },
      ambient: { value: 0.55, min: 0, max: 2, step: 0.01 },
      keyIntensity: { value: 2.2, min: 0, max: 6, step: 0.05 },
    }),
  });
  const config: TakehomeGridConfig = { ...controls, tile: 1 };

  // No WebGPU, no experience. The shell around this decides what to show instead.
  if (useWebGPU() !== "yes") return null;

  return (
    <div className="absolute inset-0">
      <Canvas
        // Perspective rather than orthographic, and deliberately. `viewport`
        // under an orthographic camera reports world units scaled by zoom,
        // which is easy to get subtly wrong when the layout is then fitted to
        // it. Under a perspective camera it is simply the visible extent at
        // the target plane, so fitting the rank to it is unambiguous. Nothing
        // here needs a parallel projection, the tiles sit on one plane.
        camera={{ position: [0, 0, 6], fov: 35 }}
        dpr={[1, 2]}
        // Odd or fractional drawing buffers desync the depth attachment from
        // the swap chain, see DepthAttachmentSync.
        forceEven
        renderer={{ alpha: false, antialias: true }}
        style={{ pointerEvents: "none" }}
      >
        <DepthAttachmentSync />
        <color attach="background" args={["#08080a"]} />
        {/* Remounting on a grid-size change is deliberate: the label textures
            are built per tile, and rebuilding the rank is simpler to reason
            about than reconciling them in place. */}
        <Scene key={`${config.cols}x${config.rows}`} config={config} />
      </Canvas>
    </div>
  );
}
