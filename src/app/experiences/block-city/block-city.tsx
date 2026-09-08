"use client";

import { Canvas, useFrame } from "@react-three/fiber/webgpu";
import { folder, useControls } from "leva";
import { useEffect, useMemo, useRef } from "react";
import * as THREE from "three/webgpu";

import { DepthAttachmentSync } from "@/components/depth-attachment-sync";
import { useWebGPU } from "@/lib/use-webgpu";

/**
 * A block city that builds itself, for the Overview slot.
 *
 * The whole experience: a canvas, the scene inside it, and the Leva controls
 * that tune it. Drop `<BlockCity />` into any box and it fills it.
 *
 * Deliberately not the hero's `City`. That one is shaped around the tower it
 * stands in — a plaza cleared from the middle, a corridor kept open toward the
 * camera — which is exactly right there and leaves a donut-shaped hole here,
 * where the city is the subject rather than the setting. It is also on the
 * hero's critical path and shared with a diverged branch, so it is left alone.
 *
 * What is worth borrowing is borrowed: the deterministic sin-hash, the idea of
 * banding blocks into tiers so window density can track height, and the
 * canvas-drawn window map.
 *
 * The build is the point. Blocks rise out of the ground in a wave and settle,
 * which is the section's argument — learn the pieces, then build with them —
 * playing out in the picture beside it.
 */

/** The dials. Their defaults live on the Leva schema at the bottom of the file. */
type BlockCityConfig = {
  /** Cells across and deep. The patch is trimmed to an ellipse inside this. */
  cols: number;
  rows: number;
  /** Distance between cell centres, before jitter. */
  spacing: number;
  /** How far a block may wander from its cell, as a fraction of spacing. */
  jitter: number;

  minHeight: number;
  maxHeight: number;
  /** Taller toward the middle, like a real skyline. 0 for an even field. */
  centreBias: number;
  footprint: number;

  /** Seconds the whole build takes, first block to last. */
  build: number;
  /** Seconds any single block takes to rise. */
  rise: number;
  /** How far a block overshoots its height before settling. 0 for none. */
  overshoot: number;

  /** Degrees per second of the slow drift once it has settled. */
  drift: number;

  base: string;
  window: string;
  windowLight: number;

  ambient: number;
  keyIntensity: number;
  skyIntensity: number;
};

/** Deterministic PRNG. The same sin-hash the hero city and the design doc use. */
function rand(n: number, seed: number) {
  const x = Math.sin(seed * 9301 + n * 49297) * 233280;
  return x - Math.floor(x);
}

type Block = {
  x: number;
  z: number;
  w: number;
  d: number;
  h: number;
  shade: number;
  /** Seconds into the build before this one starts rising. */
  delay: number;
};

/** Height bands, each an InstancedMesh so window density can track height. */
const TIERS = [
  { max: 2.4, rows: 3 },
  { max: 4.2, rows: 5 },
  { max: Infinity, rows: 8 },
];

/**
 * A tab left in the background accumulates no frames, but `delta` still counts
 * the wall clock — without this the build is over before the first frame draws.
 */
const MAX_DT = 1 / 20;

function smoothstep(edge0: number, edge1: number, x: number) {
  const t = Math.min(Math.max((x - edge0) / (edge1 - edge0), 0), 1);
  return t * t * (3 - 2 * t);
}

/** Lands past its height and settles back, so a block arrives rather than stops. */
function easeOutBack(t: number, overshoot: number) {
  const p = t - 1;
  return 1 + (overshoot + 1) * p * p * p + overshoot * p * p;
}

function buildBlocks(config: BlockCityConfig): Block[][] {
  const tiers: Block[][] = TIERS.map(() => []);
  const halfC = (config.cols - 1) / 2;
  const halfR = (config.rows - 1) / 2;
  let n = 0;

  for (let gx = 0; gx < config.cols; gx++) {
    for (let gz = 0; gz < config.rows; gz++) {
      n++;
      const ox = (gx - halfC) / halfC;
      const oz = (gz - halfR) / halfR;

      // Trimmed to an ellipse. A rectangular patch shows its corners as two
      // hard diagonals against the sky, which reads as a slab rather than a
      // skyline thinning out into haze.
      const r = Math.hypot(ox, oz);
      if (r > 1) continue;
      // Ragged edge, so the boundary itself isn't a clean curve either.
      if (r > 0.72 && rand(n, 7) < (r - 0.72) / 0.28) continue;

      const x =
        (gx - halfC) * config.spacing +
        (rand(n, 1) - 0.5) * config.spacing * config.jitter;
      const z =
        (gz - halfR) * config.spacing +
        (rand(n, 2) - 0.5) * config.spacing * config.jitter;

      const bias = 1 - Math.min(r / 0.9, 1);
      const h =
        config.minHeight +
        rand(n, 3) ** 1.7 *
          (config.maxHeight - config.minHeight) *
          (1 - config.centreBias + config.centreBias * bias);

      // The wave sweeps from the far side toward the camera, so the build
      // finishes on the blocks nearest the eye.
      const delay =
        ((1 - (oz + 1) / 2) * 0.75 + rand(n, 8) * 0.25) * config.build;

      const block: Block = {
        x,
        z,
        w: config.spacing * config.footprint * (0.7 + rand(n, 4) * 0.6),
        d: config.spacing * config.footprint * (0.7 + rand(n, 5) * 0.6),
        h,
        shade: 0.78 + rand(n, 6) * 0.44,
        delay,
      };

      tiers[TIERS.findIndex((t) => h < t.max)].push(block);
    }
  }

  return tiers;
}

/** Small canvas of lit windows, used as the emissive map on the four walls. */
function makeWindowTexture(): THREE.CanvasTexture {
  const canvas = document.createElement("canvas");
  canvas.width = 32;
  canvas.height = 64;
  const ctx = canvas.getContext("2d")!;

  ctx.fillStyle = "#000";
  ctx.fillRect(0, 0, 32, 64);
  ctx.fillStyle = "#fff";
  for (let y = 0; y < 16; y++) {
    for (let x = 0; x < 4; x++) {
      if (rand(y * 4 + x, 11) > 0.62) {
        ctx.fillRect(x * 8 + 2, y * 4 + 1, 4, 2);
      }
    }
  }

  const texture = new THREE.CanvasTexture(canvas);
  texture.wrapS = THREE.RepeatWrapping;
  texture.wrapT = THREE.RepeatWrapping;
  return texture;
}

function Tier({
  blocks,
  rows,
  texture,
  config,
  clock,
}: {
  blocks: Block[];
  rows: number;
  texture: THREE.Texture;
  config: BlockCityConfig;
  clock: React.RefObject<number>;
}) {
  const ref = useRef<THREE.InstancedMesh>(null);
  const settled = useRef(false);

  const map = useMemo(() => {
    const t = texture.clone();
    t.needsUpdate = true;
    // Per-tier, which is the whole reason tiers exist — windows stay roughly
    // square instead of stretching with the building.
    t.repeat.set(1.6, rows / 4);
    return t;
  }, [texture, rows]);
  useEffect(() => () => map.dispose(), [map]);

  const scratch = useMemo(
    () => ({
      matrix: new THREE.Matrix4(),
      position: new THREE.Vector3(),
      quaternion: new THREE.Quaternion(),
      scale: new THREE.Vector3(),
      colour: new THREE.Color(),
    }),
    [],
  );

  // Colour never changes, so it is written once rather than every frame.
  useEffect(() => {
    const mesh = ref.current;
    if (!mesh) return;
    blocks.forEach((b, i) =>
      mesh.setColorAt(i, scratch.colour.setScalar(b.shade)),
    );
    if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true;
  }, [blocks, scratch]);

  useFrame(() => {
    const mesh = ref.current;
    if (!mesh || settled.current) return;

    const t = clock.current;
    let moving = false;

    for (let i = 0; i < blocks.length; i++) {
      const b = blocks[i];
      const p = smoothstep(b.delay, b.delay + config.rise, t);
      const grown = p <= 0 ? 0 : easeOutBack(p, config.overshoot);
      if (p < 1) moving = true;

      // Grown from the ground rather than lifted into place: at zero the block
      // is flat and invisible, so nothing has to be hidden under a floor.
      const h = Math.max(b.h * grown, 1e-4);
      scratch.position.set(b.x, h / 2, b.z);
      scratch.scale.set(b.w, h, b.d);
      scratch.matrix.compose(
        scratch.position,
        scratch.quaternion,
        scratch.scale,
      );
      mesh.setMatrixAt(i, scratch.matrix);
    }

    mesh.instanceMatrix.needsUpdate = true;
    mesh.computeBoundingSphere();

    // Once every block has landed there is nothing left to write, so the whole
    // per-frame cost goes away and only the drift remains.
    if (!moving) settled.current = true;
  });

  const walls = [0, 1, 4, 5];

  return (
    <instancedMesh ref={ref} args={[undefined, undefined, blocks.length]}>
      <boxGeometry args={[1, 1, 1]} />
      {[0, 1, 2, 3, 4, 5].map((slot) =>
        walls.includes(slot) ? (
          <meshStandardMaterial
            key={slot}
            attach={`material-${slot}`}
            color={config.base}
            roughness={0.88}
            metalness={0.04}
            emissive={config.window}
            emissiveMap={map}
            emissiveIntensity={config.windowLight}
          />
        ) : (
          <meshStandardMaterial
            key={slot}
            attach={`material-${slot}`}
            color={config.base}
            roughness={0.95}
            metalness={0.02}
          />
        ),
      )}
    </instancedMesh>
  );
}

function Scene({ config }: { config: BlockCityConfig }) {
  const group = useRef<THREE.Group>(null);
  const clock = useRef(0);

  const tiers = useMemo(() => buildBlocks(config), [config]);
  const texture = useMemo(() => makeWindowTexture(), []);
  useEffect(() => () => texture.dispose(), [texture]);

  useFrame((_, delta) => {
    clock.current += Math.min(delta, MAX_DT);
    if (group.current) {
      group.current.rotation.y =
        THREE.MathUtils.degToRad(config.drift) * clock.current;
    }
  });

  return (
    <>
      <ambientLight intensity={config.ambient} />
      {/* Low and raking, so the block faces separate from each other rather
          than flattening into one silhouette. */}
      <directionalLight
        position={[-40, 26, 34]}
        intensity={config.keyIntensity}
        color="#ffd9b0"
      />
      <hemisphereLight
        intensity={config.skyIntensity}
        color="#5c6b96"
        groundColor={config.base}
      />

      {/* No ground plane, on purpose. A lit one draws a hard horizon straight
          across the frame and turns the city into a diorama on a table; without
          it the rooflines are the horizon and the patch thins out into sky. It
          also means nothing has to hide the blocks before they rise. */}
      <group ref={group}>
        {tiers.map((blocks, i) => (
          <Tier
            key={i}
            blocks={blocks}
            rows={TIERS[i].rows}
            texture={texture}
            config={config}
            clock={clock}
          />
        ))}
      </group>
    </>
  );
}

export function BlockCity() {
  // Namespaced, because Leva's store is global and every demo shares it. The
  // panel only shows where a `LevaPanel` is mounted, so on the site these are
  // simply the defaults.
  const config: BlockCityConfig = useControls("block city", {
    layout: folder({
      cols: { value: 26, min: 6, max: 48, step: 1 },
      rows: { value: 20, min: 6, max: 40, step: 1 },
      spacing: { value: 4.1, min: 2, max: 8, step: 0.1 },
      jitter: { value: 0.5, min: 0, max: 1, step: 0.02 },
      footprint: { value: 0.62, min: 0.2, max: 1, step: 0.02 },
    }),
    skyline: folder({
      minHeight: { value: 0.8, min: 0.2, max: 4, step: 0.1 },
      maxHeight: { value: 6.2, min: 1, max: 16, step: 0.1 },
      centreBias: { value: 0.55, min: 0, max: 1, step: 0.02 },
    }),
    build: folder({
      build: { value: 2.6, min: 0.2, max: 8, step: 0.1 },
      rise: { value: 0.75, min: 0.1, max: 3, step: 0.05 },
      overshoot: { value: 1.15, min: 0, max: 3, step: 0.05 },
      drift: { value: 1.4, min: -8, max: 8, step: 0.1 },
    }),
    light: folder({
      base: { value: "#3d445a" },
      window: { value: "#ffbe78" },
      windowLight: { value: 0.16, min: 0, max: 3, step: 0.02 },
      ambient: { value: 0.62, min: 0, max: 2, step: 0.01 },
      keyIntensity: { value: 2.8, min: 0, max: 5, step: 0.05 },
      skyIntensity: { value: 1.0, min: 0, max: 3, step: 0.05 },
    }),
  });

  // No WebGPU, no experience. The shell around this decides what to show instead.
  if (useWebGPU() !== "yes") return null;

  return (
    <div className="absolute inset-0">
      <Canvas
        // Low, and that is the whole trick. Raise the camera and the blocks
        // flatten into a plan view, a model on a table, because a six-unit
        // building seen from twenty units up occupies almost none of the
        // frame. Down near roof height the near blocks tower, the far ones
        // recede behind them, and it reads as a skyline.
        camera={{ position: [0, 8.5, 66], fov: 26 }}
        dpr={[1, 2]}
        // Odd or fractional drawing buffers desync the depth attachment from
        // the swap chain, see DepthAttachmentSync.
        forceEven
        renderer={{ alpha: false, antialias: true }}
        style={{ pointerEvents: "none" }}
      >
        <DepthAttachmentSync />
        <color attach="background" args={["#0a0c14"]} />
        {/* Remounting on a layout change is deliberate: the block set is
            generated once and the instance buffers are sized to it. */}
        <Scene
          key={`${config.cols}x${config.rows}-${config.spacing}`}
          config={config}
        />
      </Canvas>
    </div>
  );
}
