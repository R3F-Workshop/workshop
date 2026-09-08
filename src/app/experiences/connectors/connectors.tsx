"use client";

import { Canvas, EnvironmentMap, useFrame } from "@react-three/fiber/webgpu";
import {
  BallCollider,
  CuboidCollider,
  Physics,
  RigidBody,
  type RapierRigidBody,
} from "@react-three/rapier";
import { folder, useControls } from "leva";
import {
  Suspense,
  useEffect,
  useMemo,
  useRef,
  useState,
  type RefObject,
} from "react";
import {
  ACESFilmicToneMapping,
  Color,
  MathUtils,
  Vector3,
  type MeshStandardNodeMaterial,
} from "three/webgpu";

import { createStudioEnvironment, STUDIO_DEFAULT } from "@/app/home/components/canvas/studio-env";
import { useWebGPU } from "@/lib/use-webgpu";

import { getShape, shapeRadius, type ShapeKind } from "./shapes";

/**
 * A container with no walls.
 *
 * The whole experience: a canvas, the physics inside it, the controls, and the
 * element the cursor is measured against. Drop `<Connectors />` into any box
 * and it fills it. Click anywhere to cycle the accent.
 *
 * After Lusion's connectors (via `pmndrs/examples/lusion-connectors`), rebuilt
 * on R3F v10 and WebGPU. Gravity is off; every frame each body takes an impulse
 * toward where it belongs proportional to how far out it has drifted, which is a
 * spring. What holds the pile together is that spring fighting the bodies' own
 * collisions — so it packs, sloshes, and re-settles, and none of that needs a
 * box to be in. "Where it belongs" is the origin for every body, as in the
 * original, unless `spreadX` gives them a slot each across the width, which is
 * what turns the pile into a band.
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

/**
 * The accents a click cycles through, gold first.
 *
 * The last three are the Lusion original's, kept deliberately — the click-to-
 * recolour is half of what that demo is remembered for.
 */
const ACCENTS = ["#f6cd76", "#4060ff", "#20ffa0", "#ff4060"] as const;

/** Every tunable of the container, as the scene reads it. */
type Config = {
  /** Which body to fill the container with. */
  shape: ShapeKind;
  /** How many. The last one is glass, so this includes it. */
  count: number;
  /** Body size. 1 puts the logo at ~2.9 world units across. */
  scale: number;

  /**
   * Strength of the pull home, per second.
   *
   * This is the whole container. There are no walls: gravity is off and every
   * body has an impulse applied toward where it belongs, proportional to how far
   * out it has drifted — a spring. Bodies pile up against each other rather than
   * against a box, and that is what looks alive. Where "home" is depends on
   * `spreadX`: the origin for everything, or a slot each.
   */
  pull: number;
  /**
   * How far apart the bodies are anchored across the frame, as a fraction of its
   * half-width. 0 is the original — every body pulled to the same point, one
   * pile. Above 0 they get a slot each and the pile becomes a band.
   *
   * This is what makes the shape fit its frame, and it is the one place the
   * physics deviates from the original. A full screen wants the pile; a strip
   * five times wider than it is tall wants a band, and a single pile in the
   * middle of it is a smudge with dead space either side. Weakening the
   * sideways pull spreads them too, but where they end up is then down to
   * whatever the opening scramble happened to do — some loads band nicely, some
   * clump in two lumps. A slot each is the same look, every load.
   *
   * The bodies still collide, and the cursor still ploughs through them. They
   * just find their way back to a spread rather than to a heap.
   */
  spreadX: number;
  /** Where the bodies gather vertically, in world units from the centre. */
  centerY: number;
  /** Velocity bleed. Low values make the pile keep sloshing after a shove. */
  linearDamping: number;
  angularDamping: number;

  /** Radius of the invisible ball the cursor drags through the pile. */
  pointerRadius: number;

  /** Base colours the bodies are dealt from. */
  dark: string;
  light: string;
  /** The colour a third of them take. Cycled by clicking. */
  accent: string;
  /** Light carried by each accent body, so the accent bounces onto its neighbours. */
  accentLight: number;

  /** Non-glass bodies. Gold wants low roughness; a matte plastic wants ~0.7. */
  roughness: number;
  metalness: number;

  /** One body is transmissive. 0 turns it into another opaque one. */
  glassThickness: number;
  glassRoughness: number;
  glassIor: number;

  /** Environment. Intensities are linear radiance, so >1 is expected. */
  keyIntensity: number;
  kickIntensity: number;
  fillIntensity: number;
  envIntensity: number;
};

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

/**
 * What the bodies reflect and refract.
 *
 * The same generated equirect the flip grid uses — three softboxes in a dark
 * dome, built on the CPU in a fraction of a millisecond, no `.hdr` to fetch. The
 * Lusion original arranges four drei `<Lightformer>`s inside an `<Environment>`,
 * which renders them to a cube target every time it rebuilds; this reaches the
 * same place without a render pass.
 *
 * The dome is deliberately not black. Metal is only its reflection and glass is
 * only what's behind it, so a body facing away from every softbox needs
 * *something* to return or it reads as a hole cut in the page.
 */
function Environment({ config }: { config: Config }) {
  const texture = useMemo(() => {
    const [key, kick, fill] = STUDIO_DEFAULT.softboxes;
    return createStudioEnvironment({
      ...STUDIO_DEFAULT,
      ground: [0.018, 0.018, 0.024],
      sky: [0.05, 0.058, 0.08],
      softboxes: [
        { ...key, intensity: config.keyIntensity },
        { ...kick, intensity: config.kickIntensity },
        { ...fill, intensity: config.fillIntensity },
      ],
    });
  }, [config.keyIntensity, config.kickIntensity, config.fillIntensity]);

  // The generator allocates a new DataTexture each time; the old one holds a
  // GPU allocation until it's told to let go.
  useEffect(() => () => texture.dispose(), [texture]);

  return (
    <EnvironmentMap map={texture} environmentIntensity={config.envIntensity} />
  );
}

function Scene({
  config,
  bounds,
}: {
  config: Config;
  /**
   * The element the cursor is measured against — the canvas's wrapper, not the
   * canvas. The scene is handed its own rectangle rather than looking one up
   * off the renderer.
   */
  bounds: RefObject<HTMLElement | null>;
}) {
  return (
    <>
      <Environment config={config} />
      {/* Rapier's wasm arrives asynchronously and `<Physics>` suspends on it.
          Nothing renders in the meantime, which is the right answer for a
          backdrop — a half-built pile appearing would be worse than none. */}
      <Suspense fallback={null}>
        <Physics gravity={[0, 0, 0]}>
          <Cursor bounds={bounds} radius={config.pointerRadius} />
          <Bodies config={config} />
        </Physics>
      </Suspense>
    </>
  );
}

function Bodies({ config }: { config: Config }) {
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

  useFrame(({ viewport, delta }) => {
    const reach = (viewport.width / 2) * config.spreadX;

    bodies.forEach((body, i) => {
      const api = apis.current[i];
      if (!api) return;
      const { x, y, z } = api.translation();
      // Deliberately `false` for wake-up: a band nobody is touching settles,
      // falls asleep, and stops costing anything, and the cursor body wakes
      // whatever it runs into. Passing `true` here would keep a dozen bodies
      // integrating forever while nobody is looking at them.
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
 * reason the flip grid does it: on the site this canvas sits behind the closing
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

  useFrame(({ viewport, delta }) => {
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

export function Connectors() {
  const bounds = useRef<HTMLDivElement>(null);
  const [accent, setAccent] = useState(0);

  // Namespaced, because Leva's store is global and every demo shares it.
  const controls = useControls("connectors", {
    bodies: folder({
      shape: { value: "logo", options: ["logo", "dot", "cross"] },
      count: { value: 10, min: 3, max: 40, step: 1 },
      scale: { value: 0.46, min: 0.15, max: 1.6, step: 0.01 },
    }),
    container: folder({
      pull: { value: 0.2, min: 0, max: 1.5, step: 0.01 },
      spreadX: { value: 0, min: 0, max: 1, step: 0.01 },
      centerY: { value: 0, min: -4, max: 4, step: 0.05 },
      linearDamping: { value: 4, min: 0, max: 20, step: 0.1 },
      angularDamping: { value: 1, min: 0, max: 20, step: 0.1 },
      pointerRadius: { value: 1, min: 0.1, max: 4, step: 0.05 },
    }),
    surface: folder({
      dark: "#3b3b42",
      light: "#e9e7e2",
      accentLight: { value: 3.5, min: 0, max: 20, step: 0.1 },
      roughness: { value: 0.28, min: 0, max: 1, step: 0.01 },
      metalness: { value: 0.35, min: 0, max: 1, step: 0.01 },
    }),
    glass: folder({
      glassThickness: { value: 0.9, min: 0, max: 4, step: 0.05 },
      glassRoughness: { value: 0.06, min: 0, max: 1, step: 0.01 },
      glassIor: { value: 1.5, min: 1, max: 2.4, step: 0.01 },
    }),
    environment: folder({
      keyIntensity: { value: 4, min: 0, max: 60, step: 0.1 },
      kickIntensity: { value: 14, min: 0, max: 60, step: 0.1 },
      fillIntensity: { value: 0.8, min: 0, max: 10, step: 0.1 },
      envIntensity: { value: 1, min: 0, max: 4, step: 0.05 },
    }),
  });

  // Leva types a select as plain `string`, so the union has to be restored on
  // the way out. Narrowing the one field beats casting the whole object. The
  // accent isn't a Leva control at all — it's the click, so it's merged in here.
  const config: Config = {
    ...controls,
    shape: controls.shape as ShapeKind,
    accent: ACCENTS[accent],
  };

  // No WebGPU, no experience. The shell around this decides what to show instead.
  if (useWebGPU() !== "yes") return null;

  return (
    // Click anywhere to cycle the accent, which is the original's one
    // interaction beyond the cursor. It lives on this wrapper rather than on the
    // canvas because the canvas doesn't take pointer events.
    <div
      ref={bounds}
      onClick={() => setAccent((i) => (i + 1) % ACCENTS.length)}
      className="absolute inset-0"
    >
      {/* The camera is the original's: 17.5° at fifteen units back. A long lens
          on a near-orthographic framing is most of why the pile reads as a
          diorama rather than as objects flying at you. */}
      <Canvas
        camera={{ position: [0, 0, 15], fov: 17.5, near: 1, far: 40 }}
        dpr={[1, 2]}
        renderer={{
          alpha: false,
          antialias: true,
          // The environment is HDR on purpose — softboxes sit well above 1 so the
          // glass and the metal have something with range to bend — and without a
          // tone map every one of them clips to flat white.
          toneMapping: ACESFilmicToneMapping,
        }}
        // The cursor is read off `window`, not from R3F's pointer events, so the
        // canvas has no reason to take them. Keeping it out of the way also means
        // whatever sits over it stays clickable.
        style={{ pointerEvents: "none" }}
      >
        <color attach="background" args={["#08080a"]} />
        <Scene config={config} bounds={bounds} />
      </Canvas>
    </div>
  );
}
