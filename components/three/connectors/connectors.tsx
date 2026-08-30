"use client";

import { useFrame } from "@react-three/fiber/webgpu";
import {
  BallCollider,
  CuboidCollider,
  Physics,
  RigidBody,
  type RapierRigidBody,
} from "@react-three/rapier";
import { Suspense, useEffect, useMemo, useRef, type RefObject } from "react";
import {
  Color,
  MathUtils,
  Vector3,
  type MeshStandardNodeMaterial,
} from "three/webgpu";

import type { ConnectorsConfig } from "./config";
import { ConnectorsEnvironment } from "./environment";
import { getShape, shapeRadius, type ShapeKind } from "./shapes";

import { useSectionOnScreen } from "@/components/three/section-canvas";

/**
 * A container with no walls.
 *
 * After Lusion's connectors (via `pmndrs/examples/lusion-connectors`), rebuilt
 * on R3F v10 and WebGPU. Gravity is off; every frame each body takes an impulse
 * toward where it belongs proportional to how far out it has drifted, which is a
 * spring. What holds the pile together is that spring fighting the bodies' own
 * collisions — so it packs, sloshes, and re-settles, and none of that needs a
 * box to be in. On the demo page "where it belongs" is the origin for every
 * body, as in the original; behind the footer it is a slot each across the
 * width, which is what turns the pile into a band. See `spreadX` in `config.ts`.
 *
 * The cursor is a kinematic ball with no mesh. It has no forces of its own; it
 * simply cannot be overlapped, so shoving it through the pile displaces
 * everything in its way.
 *
 * What changed on the way over from the original:
 *  - the connector `.glb` is gone — the bodies are generated (see `shapes.ts`);
 *  - `MeshTransmissionMaterial` is gone with it. That one is a WebGL shader
 *    material; on WebGPU three does real transmission natively, so the glass
 *    body is a plain `meshPhysicalNodeMaterial` with `transmission: 1`;
 *  - no `EffectComposer`/N8AO. `@react-three/postprocessing` is WebGL-only, and
 *    the ambient occlusion it added is doing much less work here than it does
 *    against the original's flat background.
 */

/** Where the cursor body parks when the pointer isn't over the scene. */
const AWAY = -12;

/** Rapier gets confused by the delta a backgrounded tab hands back. */
const MAX_DT = 0.1;

type Body = {
  /** 0 dark, 1 light, 2 accent. Resolved to a colour at render, not here. */
  slot: 0 | 1 | 2;
  /** The rougher of the two finishes its colour comes in. */
  rough: boolean;
  /** The one transmissive body. Spawns far out so it flies in on load. */
  glass: boolean;
  /**
   * Where this body is pulled to, across the frame: -1 the left edge, 0 the
   * middle, +1 the right. Resolved against the viewport per frame rather than
   * baked into world units, so the band re-spaces itself on a phone instead of
   * hanging half its bodies off the sides.
   */
  anchor: number;
  position: [number, number, number];
};

/**
 * Deal the bodies out: dark, light, accent, repeating.
 *
 * The original hard-codes nine and alternates roughness within each colour,
 * which is what stops three white bodies reading as one white blob. Same idea,
 * generalised over `count` — and the last one dealt is the glass.
 *
 * Note what this *doesn't* decide: colours and roughness are slots here, looked
 * up per frame. Baking them in would mean re-dealing — and so re-throwing every
 * body back to a random start — every time the accent changes, and the accent
 * changes on every click.
 */
function deal(
  shape: ShapeKind,
  count: number,
  scale: number,
  centerY: number,
): Body[] {
  const spread = shapeRadius(shape) * scale * 6;

  return Array.from({ length: count }, (_, i) => {
    const glass = i === count - 1;
    // Evenly across the frame, nudged off the ruler line so a band of them
    // doesn't read as a row of fence posts. Deterministic per index, so the
    // spacing survives a reshuffle.
    const even = count > 1 ? (i / (count - 1)) * 2 - 1 : 0;
    return {
      glass,
      slot: (i % 3) as 0 | 1 | 2,
      rough: i % 2 === 0,
      anchor: even + Math.sin(i * 12.9898) * (0.7 / count),
      // Depth is deliberately the short axis. On a 17.5° lens a body four units
      // nearer the camera renders half again as large as its twin at the origin,
      // and a pile whose front row looms like that stops reading as a diorama.
      // The settled pile ends up a slab rather than a ball, which is also what
      // keeps it from hiding its own middle.
      position: glass
        ? [spread, centerY + spread, spread * 0.25]
        : [
            MathUtils.randFloatSpread(spread),
            centerY + MathUtils.randFloatSpread(spread),
            MathUtils.randFloatSpread(spread * 0.45),
          ],
    };
  });
}

export function ConnectorsScene({
  config,
  bounds,
}: {
  config: ConnectorsConfig;
  /**
   * The element the cursor is measured against — the canvas's wrapper, not the
   * canvas. Under a shared renderer `gl.domElement` is whichever canvas drew
   * last, so the scene is handed its own rectangle instead of looking one up.
   */
  bounds: RefObject<HTMLElement | null>;
}) {
  // Body sleep (see `Bodies`) quiets a settled pile, but the solver still
  // steps every frame. Off screen, stop stepping entirely — this is the one
  // scene whose per-frame cost is CPU physics rather than its (already
  // skipped) render pass.
  const onScreen = useSectionOnScreen();

  return (
    <>
      <ConnectorsEnvironment config={config} />
      {/* Rapier's wasm arrives asynchronously and `<Physics>` suspends on it.
          Nothing renders in the meantime, which is the right answer for a
          backdrop — a half-built pile appearing would be worse than none. */}
      <Suspense fallback={null}>
        <Physics gravity={[0, 0, 0]} paused={!onScreen}>
          <Cursor bounds={bounds} radius={config.pointerRadius} />
          <Bodies config={config} />
        </Physics>
      </Suspense>
    </>
  );
}

function Bodies({ config }: { config: ConnectorsConfig }) {
  const shape = getShape(config.shape);
  const { shape: kind, count, scale, centerY } = config;

  // Only what changes where the bodies start. Everything else — the palette, the
  // roughness, the glass, the strength of the pull, how wide they spread — is
  // read per frame, so dragging a slider never throws away the pile you were
  // tuning against, and clicking to recolour doesn't scatter it.
  const bodies = useMemo(
    () => deal(kind, count, scale, centerY),
    [kind, count, scale, centerY],
  );

  const apis = useRef<(RapierRigidBody | null)[]>([]);
  const mats = useRef<(MeshStandardNodeMaterial | null)[]>([]);
  const pull = useRef(new Vector3());
  const wanted = useRef(new Color());

  const palette = [config.dark, config.light, config.accent];
  const onScreen = useSectionOnScreen();

  useFrame(({ viewport }, delta) => {
    // Impulses land on velocities immediately, stepped or not — feeding them
    // into a paused world would wind the pile up like a spring and release it
    // all at once on scroll-back.
    if (!onScreen) return;

    const reach = (viewport.width / 2) * config.spreadX;

    bodies.forEach((body, i) => {
      const api = apis.current[i];
      if (!api) return;
      const { x, y, z } = api.translation();
      // Deliberately `false` for wake-up: a band nobody is touching settles,
      // falls asleep, and stops costing anything, and the cursor body wakes
      // whatever it runs into. Passing `true` here would keep a dozen bodies
      // integrating forever behind a footer nobody is looking at.
      api.applyImpulse(
        pull.current
          .set(x - body.anchor * reach, y - config.centerY, z)
          .negate()
          .multiplyScalar(config.pull),
        false,
      );
    });

    // Colours ease rather than switch. Cycling the accent is a click, and a
    // dozen bodies changing hue on the same frame reads as a glitch; over a
    // couple of hundred milliseconds it reads as the scene answering.
    const k = 1 - Math.pow(0.005, Math.min(delta, MAX_DT));
    bodies.forEach((body, i) => {
      const material = mats.current[i];
      if (!material) return;
      material.color.lerp(wanted.current.set(palette[body.slot]), k);
    });
  });

  const s = config.scale;

  return bodies.map((body, i) => (
    <RigidBody
      key={i}
      ref={(api) => {
        apis.current[i] = api;
      }}
      position={body.position}
      colliders={false}
      linearDamping={config.linearDamping}
      angularDamping={config.angularDamping}
      friction={0.1}
    >
      {shape.ball ? (
        <BallCollider args={[shape.ball * s]} />
      ) : (
        shape.colliders.map((c, j) => (
          <CuboidCollider
            key={j}
            args={[c.half[0] * s, c.half[1] * s, c.half[2] * s]}
            position={[c.at[0] * s, c.at[1] * s, c.at[2] * s]}
          />
        ))
      )}

      <mesh geometry={shape.geometry} scale={s}>
        {body.glass ? (
          <meshPhysicalNodeMaterial
            color="#ffffff"
            transmission={1}
            thickness={config.glassThickness}
            roughness={config.glassRoughness}
            ior={config.glassIor}
            // Transmission alone leaves the silhouette invisible against a dark
            // page. The clearcoat is what puts an edge back on it.
            clearcoat={1}
            clearcoatRoughness={0.05}
          />
        ) : (
          <meshStandardNodeMaterial
            ref={(material) => {
              mats.current[i] = material;
            }}
            // Two finishes per colour, so neighbours of a shade aren't twins.
            roughness={
              body.rough
                ? Math.min(1, config.roughness * 2.6)
                : config.roughness
            }
            metalness={config.metalness}
          />
        )}
      </mesh>

      {/* An accent body lights its neighbours, so the colour spreads instead of
          staying inside its own silhouette. Cheap: point lights with a hard
          distance cutoff, no shadows. */}
      {body.slot === 2 && !body.glass && config.accentLight > 0 ? (
        <pointLight
          intensity={config.accentLight}
          distance={2.5 + s * 2}
          decay={0}
          color={config.accent}
        />
      ) : null}
    </RigidBody>
  ));
}

/**
 * The cursor, as a body.
 *
 * Tracked off `window` rather than through R3F's pointer events, for the same
 * reason the flip grid does it: on the site this canvas is behind the closing
 * call to action and must not take clicks, so it is `pointer-events: none` and
 * never sees a pointer event of its own.
 */
function Cursor({
  bounds,
  radius,
}: {
  bounds: RefObject<HTMLElement | null>;
  radius: number;
}) {
  const api = useRef<RapierRigidBody>(null);
  const target = useRef(new Vector3(0, 0, AWAY));
  /** Normalised cursor, or null while it's off the element. */
  const ndc = useRef<{ x: number; y: number } | null>(null);

  useEffect(() => {
    const el = bounds.current;
    if (!el) return;

    const onMove = (event: PointerEvent) => {
      const rect = el.getBoundingClientRect();
      const x = ((event.clientX - rect.left) / rect.width) * 2 - 1;
      const y = -(((event.clientY - rect.top) / rect.height) * 2 - 1);
      ndc.current = x < -1 || x > 1 || y < -1 || y > 1 ? null : { x, y };
    };

    // `pointermove` stops firing once the cursor leaves the document, so
    // without these the body would stay wherever it was last seen — a permanent
    // dent in the pile. Each is a different way to lose the cursor with no
    // final move event: out of the document, out of the window, tab hidden.
    const park = () => {
      ndc.current = null;
    };
    const onOut = (event: PointerEvent) => {
      if (!event.relatedTarget) park();
    };
    const onVisibility = () => {
      if (document.hidden) park();
    };

    window.addEventListener("pointermove", onMove, { passive: true });
    document.addEventListener("pointerout", onOut);
    window.addEventListener("blur", park);
    document.addEventListener("visibilitychange", onVisibility);
    return () => {
      window.removeEventListener("pointermove", onMove);
      document.removeEventListener("pointerout", onOut);
      window.removeEventListener("blur", park);
      document.removeEventListener("visibilitychange", onVisibility);
    };
  }, [bounds]);

  useFrame(({ viewport }, delta) => {
    const at = ndc.current;
    const next = target.current;

    if (at) {
      // Eased rather than snapped. A kinematic body teleported across the pile
      // sweeps nothing on the way — it appears on the far side and the bodies
      // it should have shoved are left untouched, or fired off at whatever
      // velocity resolving the overlap implies.
      const k = 1 - Math.pow(0.0001, Math.min(delta, MAX_DT));
      next.x = MathUtils.lerp(next.x, (at.x * viewport.width) / 2, k);
      next.y = MathUtils.lerp(next.y, (at.y * viewport.height) / 2, k);
      next.z = MathUtils.lerp(next.z, 0, k);
    } else {
      next.z = AWAY;
    }

    api.current?.setNextKinematicTranslation(next);
  });

  return (
    <RigidBody
      ref={api}
      type="kinematicPosition"
      position={[0, 0, AWAY]}
      colliders={false}
    >
      <BallCollider args={[radius]} />
    </RigidBody>
  );
}
