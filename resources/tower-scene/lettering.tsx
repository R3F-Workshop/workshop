"use client";

import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
  type RefObject,
} from "react";
import { Billboard } from "@react-three/drei";
import { createPortal, useFrame, useThree } from "@react-three/fiber/webgpu";
import { Text, TextGroup, useFont } from "@pmndrs/glyph/react";
import { defineTextMaterial } from "@pmndrs/glyph/three";
import { msdf } from "@pmndrs/glyph/three/msdf";
import type { Text as TextObject } from "@pmndrs/glyph/three";
import * as THREE from "three/webgpu";
import {
  cameraFar,
  cameraNear,
  float,
  lights,
  mix,
  positionView,
  smoothstep,
  uniform,
  uv,
  vec3,
  viewZToPerspectiveDepth,
} from "three/tsl";

import type { TextLayer } from "./fx";
import { INTRO_COMPLETE, LETTER_CHAIN_START } from "./intro";

/**
 * Billboarded MSDF letters render in a full-resolution pass. Authored depth
 * bands and the tower depth twin determine the ironwork occlusion per pixel.
 */

const FONT_REQUEST = {
  input: { baked: "/hero-demo/Geist-ExtraBold.font.glb" },
  raster: { technique: msdf },
} as const;

/**
 * Creates a lit MSDF material with authored depth. The alpha test prevents
 * transparent parts of the glyph quad from writing depth.
 */
function createLetterMaterial(
  towerGlow: THREE.PointLight,
  /** The depth written for the visible glyph pixels. */
  depthNode: THREE.Node,
  /** Independent reveal for this letter. */
  revealNode: THREE.Node<"float">,
) {
  return defineTextMaterial((context) => {
    const material = new THREE.MeshStandardNodeMaterial({
      side: THREE.DoubleSide,
      roughness: 0.85,
      metalness: 0,
      transparent: true,
      depthWrite: true,
      alphaTest: 1 / 255,
    });
    material.positionNode = context.position;
    material.colorNode = context.shader.color;
    material.opacityNode = context.shader.opacity.mul(revealNode);
    material.normalNode = vec3(0, 0, 1);
    material.lightsNode = lights([towerGlow]);
    // Increase the sky response on camera-facing glyphs.
    material.envMapIntensity = 2;
    // Keep a small emissive floor so unlit glyphs remain visible.
    material.emissiveNode = context.shader.color.mul(0.18);
    material.depthNode = depthNode;
    return material;
  });
}

/**
 * Depth offsets in city units from top to bottom. Each UV band blends from
 * one offset to the next so a letter can pass through the tower.
 */
type Layering = {
  z: readonly number[];
  bands?: readonly (readonly [number, number])[];
};

/** Converts authored view-axis offsets into perspective depth. */
function layerDepthNode({ z, bands = [] }: Layering, worldScale: number) {
  const down = uv().y;
  let authored: THREE.Node<"float"> = float(z[0]);
  bands.forEach(([from, to], i) => {
    authored = mix(authored, float(z[i + 1]), smoothstep(from, to, down));
  });
  return viewZToPerspectiveDepth(
    positionView.z.add(authored.mul(worldScale)),
    cameraNear,
    cameraFar,
  );
}

/** How far the pointer may knock a letter off its slot. */
type Knock = {
  /** Horizontal travel, in city units. */
  sway: number;
  /** Vertical travel, in city units. */
  lift: number;
  /** Tilt, in radians. */
  spin: number;
};

/**
 * Reduce lift and tilt for depth banded letters so their seams stay aligned
 * with the tower.
 */
/** Glyph has one depth layer. */
const FREE: Knock = { sway: 0.45, lift: 0.34, spin: 0.032 };
/** Glyph crosses a broad tower section. */
const BANDED: Knock = { sway: 0.36, lift: 0.18, spin: 0.018 };
/** Glyph crosses the narrow spire. */
const THREADED: Knock = { sway: 0.3, lift: 0.07, spin: 0.008 };

/**
 * Poster layout in city units. Positions share the tower axis plane while
 * layers control occlusion and centers align each glyph by its outline bounds.
 */
const LETTERS: {
  char: string;
  /** Position in city units on the tower axis plane. */
  position: [number, number];
  center: [number, number];
  /** Authored depth against the tower. */
  layer: Layering;
  /** Room this letter has to be knocked around. */
  knock: Knock;
}[] = [
  {
    char: "P",
    position: [-0.3, 23.4],
    center: [0.355, 0.355],
    // Place the upper bowl behind the summit and the lower stem in front.
    layer: { z: [-1.6, 1.6], bands: [[0.36, 0.5]] },
    knock: THREADED,
  },
  {
    char: "M",
    position: [3, 20.2],
    center: [0.4635, 0.355],
    layer: { z: [-2.2] },
    knock: FREE,
  },
  {
    char: "N",
    position: [-2.5, 17.4],
    center: [0.3765, 0.355],
    layer: { z: [3] },
    knock: FREE,
  },
  {
    char: "D",
    position: [2.9, 14.6],
    center: [0.377, 0.355],
    layer: { z: [-4] },
    knock: FREE,
  },
  {
    char: "R",
    position: [-3, 11.8],
    center: [0.3635, 0.355],
    // Place the bowl behind the tower and the leg in front.
    layer: { z: [-6, 4], bands: [[0.42, 0.55]] },
    knock: BANDED,
  },
  {
    char: "S",
    position: [2.6, 9],
    center: [0.3475, 0.355],
    // Place the upper curve in front and the lower bowl behind the tower.
    layer: { z: [5, -6], bands: [[0.55, 0.7]] },
    knock: BANDED,
  },
];

/** Hit radius around a letter's center, as a fraction of the glyph em. */
const KNOCK_REACH = 0.5;
/** Pointer speed, in half-viewport-heights per second, that lands a full knock. */
const FULL_KNOCK_SPEED = 1.8;
/** Knock acceleration, in knock limits per second squared. */
const KNOCK_FORCE = 138;
/** Velocity ceiling, in knock limits per second. */
const KNOCK_SPEED_LIMIT = 13;
/** Share of the knock that shoves the letter along the pointer's travel. */
const SHOVE = 0.72;
/** Share that pushes the letter out of the pointer's way. */
const DODGE = 0.55;
/** Spring back to the authored slot. Underdamped, so the letter rings a little. */
const SWAY_STIFFNESS = 110;
const SWAY_DAMPING = 5.7;
const SPIN_STIFFNESS = 84;
const SPIN_DAMPING = 5;
/** Longest step the springs are integrated over. */
const MAX_STEP = 1 / 30;
/** Combined offset and velocity below which a letter is parked at rest. */
const REST = 2e-3;
/** Pointer travel slower than this is a resting hand, not a pass. */
const IDLE_SPEED = 0.02;
/** Smoothing rate for pointer velocity, in inverse seconds. */
const TRAVEL_SMOOTHING = 18;
/** Share of a letter's full travel used while the pointer rests over it. */
const HOVER_OFFSET = 0.62;

type Wobble = {
  x: number;
  y: number;
  spin: number;
  vx: number;
  vy: number;
  vSpin: number;
};

function restingWobble(): Wobble {
  return { x: 0, y: 0, spin: 0, vx: 0, vy: 0, vSpin: 0 };
}

type LetterSpring = {
  x: number;
  y: number;
  rotation: number;
  vx: number;
  vy: number;
  vr: number;
};

type LetterPose = LetterSpring & {
  phase: "uninitialized" | "animating" | "settled";
  previousTime: number;
};

type LetterPoseAction = "reset" | "animate" | "finish" | "hold";

/** The only legal pose transition for the current clock and transform. */
function gateLetterPose(
  pose: LetterPose,
  time: number,
  settledPoseIsValid: boolean,
): LetterPoseAction {
  if (pose.phase === "uninitialized") {
    return time >= INTRO_COMPLETE ? "finish" : "reset";
  }
  if (time < pose.previousTime) return "reset";
  if (time >= INTRO_COMPLETE || pose.phase === "settled") {
    return settledPoseIsValid ? "hold" : "finish";
  }
  return "animate";
}

/** Semi implicit step for a damped spring. */
function spring(
  value: number,
  velocity: number,
  target: number,
  stiffness: number,
  damping: number,
  dt: number,
) {
  const nextVelocity =
    (velocity + (target - value) * stiffness * dt) *
    Math.exp(-damping * dt);
  return [value + nextVelocity * dt, nextVelocity] as const;
}

/**
 * Projects each letter into pointer space and tests the cursor sweep.
 * Hits add velocity to springs anchored at the authored letter positions.
 */
function usePointerKnock(
  groups: RefObject<(THREE.Group | null)[]>,
  { size, worldScale }: { size: number; worldScale: number },
) {
  const bounds = useThree((state) => state.size);

  /** Latest pointer position in NDC, written from the window listener. */
  const cursor = useRef({ tracked: false, warped: true, x: 0, y: 0 });

  useEffect(() => {
    const reduced = window.matchMedia("(prefers-reduced-motion: reduce)");

    const onMove = (event: PointerEvent) => {
      if (!bounds.width || !bounds.height) return;
      const x = ((event.clientX - bounds.left) / bounds.width) * 2 - 1;
      const y = -((event.clientY - bounds.top) / bounds.height) * 2 + 1;
      if (x < -1 || x > 1 || y < -1 || y > 1) {
        park();
        return;
      }
      if (!cursor.current.tracked) cursor.current.warped = true;
      cursor.current.x = x;
      cursor.current.y = y;
      cursor.current.tracked = true;
    };

    const park = () => {
      cursor.current.tracked = false;
      cursor.current.warped = true;
    };

    const onOut = (event: PointerEvent) => {
      if (!event.relatedTarget) park();
    };
    const onVisibility = () => {
      if (document.hidden) park();
    };

    // Update the pointer listener when motion preferences change.
    const sync = () => {
      if (reduced.matches) {
        window.removeEventListener("pointermove", onMove);
        park();
      } else {
        window.addEventListener("pointermove", onMove, { passive: true });
      }
    };
    sync();
    reduced.addEventListener("change", sync);
    document.addEventListener("pointerout", onOut);
    window.addEventListener("blur", park);
    document.addEventListener("visibilitychange", onVisibility);
    return () => {
      reduced.removeEventListener("change", sync);
      window.removeEventListener("pointermove", onMove);
      document.removeEventListener("pointerout", onOut);
      window.removeEventListener("blur", park);
      document.removeEventListener("visibilitychange", onVisibility);
    };
  }, [bounds]);

  /** Pointer position last frame, in half-height units. */
  const previous = useRef({ tracked: false, x: 0, y: 0 });
  /** Smoothed pointer velocity, in half-heights per second. */
  const travel = useRef({ x: 0, y: 0 });
  const wobbles = useRef<Wobble[]>(LETTERS.map(restingWobble));
  const [scratch] = useState(() => ({
    slot: new THREE.Vector3(),
    eye: new THREE.Vector3(),
  }));

  useFrame(({ camera }, frameDelta) => {
    const wobbleGroups = groups.current;
    const step = Math.min(frameDelta, MAX_STEP);
    const view = camera as THREE.PerspectiveCamera;
    // Scale clip space x by aspect so hit areas remain circular.
    const aspect = view.aspect || 1;

    // Keep both cursor positions so fast motion uses a swept hit test.
    const now = cursor.current;
    const was = previous.current;
    const x = now.x * aspect;
    const y = now.y;
    const fromX = was.x;
    const fromY = was.y;
    const swept = now.tracked && was.tracked && !now.warped;
    const sweepX = swept ? x - fromX : 0;
    const sweepY = swept ? y - fromY : 0;
    const sweepLengthSq = sweepX * sweepX + sweepY * sweepY;
    const decay = 1 - Math.exp(-step * TRAVEL_SMOOTHING);
    if (swept) {
      const dt = Math.max(frameDelta, 1 / 240);
      travel.current.x += (sweepX / dt - travel.current.x) * decay;
      travel.current.y += (sweepY / dt - travel.current.y) * decay;
    } else {
      travel.current.x -= travel.current.x * decay;
      travel.current.y -= travel.current.y * decay;
    }
    was.x = x;
    was.y = y;
    was.tracked = now.tracked;
    now.warped = false;

    const speed = Math.hypot(travel.current.x, travel.current.y);
    const passing = swept && speed > IDLE_SPEED;
    if (now.tracked) view.getWorldPosition(scratch.eye);

    LETTERS.forEach(({ knock }, i) => {
      const group = wobbleGroups[i];
      // Test against the stable authored slot instead of the moving letter.
      const slot = group?.parent;
      if (!group || !slot) return;
      const wobble = wobbles.current[i];
      let targetX = 0;
      let targetY = 0;
      let targetSpin = 0;

      if (now.tracked) {
        slot.getWorldPosition(scratch.slot);
        const depth = scratch.eye.distanceTo(scratch.slot);
        scratch.slot.project(view);
        // Convert glyph size into clip space at the letter depth.
        const halfHeight =
          Math.tan((view.fov * THREE.MathUtils.DEG2RAD) / 2) * depth;
        const reach = (size * worldScale * KNOCK_REACH) / halfHeight;
        const letterX = scratch.slot.x * aspect;
        const letterY = scratch.slot.y;

        // A resting pointer gives the spring a small offset target.
        const hoverX = letterX - x;
        const hoverY = letterY - y;
        const hoverGap = Math.hypot(hoverX, hoverY);
        if (hoverGap < reach) {
          const near = 1 - hoverGap / reach;
          const falloff = near * near * (3 - 2 * near);
          const fallbackX = speed > IDLE_SPEED ? travel.current.x / speed : 0;
          const fallbackY = speed > IDLE_SPEED ? travel.current.y / speed : 1;
          const awayX = hoverGap > 1e-4 ? hoverX / hoverGap : fallbackX;
          const awayY = hoverGap > 1e-4 ? hoverY / hoverGap : fallbackY;
          targetX = awayX * knock.sway * HOVER_OFFSET * falloff;
          targetY = awayY * knock.lift * HOVER_OFFSET * falloff;
          targetSpin = -awayX * knock.spin * HOVER_OFFSET * falloff;
        }

        // Find the closest point on the cursor sweep.
        const alongSweep =
          passing && sweepLengthSq > 1e-8
            ? THREE.MathUtils.clamp(
                ((letterX - fromX) * sweepX +
                  (letterY - fromY) * sweepY) /
                  sweepLengthSq,
                0,
                1,
              )
            : 1;
        const hitX = fromX + sweepX * alongSweep;
        const hitY = fromY + sweepY * alongSweep;
        const toLetterX = letterX - hitX;
        const toLetterY = letterY - hitY;
        const gap = Math.hypot(toLetterX, toLetterY);

        if (passing && gap < reach) {
          const near = 1 - gap / reach;
          const falloff = near * near * (3 - 2 * near);
          const strength = Math.min(speed / FULL_KNOCK_SPEED, 1) * falloff;
          // Push the letter with and away from the pointer motion.
          const along = SHOVE / speed;
          const away = DODGE / Math.max(gap, 1e-4);
          const pushX = travel.current.x * along + toLetterX * away;
          const pushY = travel.current.y * along + toLetterY * away;
          const drive = strength * KNOCK_FORCE * step;
          wobble.vx += pushX * knock.sway * drive;
          wobble.vy += pushY * knock.lift * drive;
          // Use the contact offset to spin the glyph.
          const armX = -toLetterX / reach;
          const armY = -toLetterY / reach;
          wobble.vSpin += (armX * pushY - armY * pushX) * knock.spin * drive;
        }
      }

      const energy =
        Math.abs(wobble.x) +
        Math.abs(wobble.y) +
        Math.abs(wobble.vx) +
        Math.abs(wobble.vy);
      const targetEnergy =
        Math.abs(targetX) + Math.abs(targetY) + Math.abs(targetSpin);
      if (
        energy === 0 &&
        wobble.spin === 0 &&
        wobble.vSpin === 0 &&
        targetEnergy === 0
      ) {
        return;
      }

      const swayCap = knock.sway * KNOCK_SPEED_LIMIT;
      const liftCap = knock.lift * KNOCK_SPEED_LIMIT;
      const spinCap = knock.spin * KNOCK_SPEED_LIMIT;
      wobble.vx = THREE.MathUtils.clamp(wobble.vx, -swayCap, swayCap);
      wobble.vy = THREE.MathUtils.clamp(wobble.vy, -liftCap, liftCap);
      wobble.vSpin = THREE.MathUtils.clamp(wobble.vSpin, -spinCap, spinCap);

      [wobble.x, wobble.vx] = spring(
        wobble.x,
        wobble.vx,
        targetX,
        SWAY_STIFFNESS,
        SWAY_DAMPING,
        step,
      );
      [wobble.y, wobble.vy] = spring(
        wobble.y,
        wobble.vy,
        targetY,
        SWAY_STIFFNESS,
        SWAY_DAMPING,
        step,
      );
      [wobble.spin, wobble.vSpin] = spring(
        wobble.spin,
        wobble.vSpin,
        targetSpin,
        SPIN_STIFFNESS,
        SPIN_DAMPING,
        step,
      );

      // Clamp repeated hits without affecting normal spring motion.
      wobble.x = THREE.MathUtils.clamp(wobble.x, -knock.sway, knock.sway);
      wobble.y = THREE.MathUtils.clamp(wobble.y, -knock.lift, knock.lift);
      wobble.spin = THREE.MathUtils.clamp(wobble.spin, -knock.spin, knock.spin);

      // Park settled letters to avoid unnecessary matrix updates.
      const settling =
        Math.abs(wobble.x) +
        Math.abs(wobble.y) +
        Math.abs(wobble.vx) +
        Math.abs(wobble.vy) +
        (Math.abs(wobble.spin) + Math.abs(wobble.vSpin)) * 8;
      if (settling < REST) {
        wobble.x = 0;
        wobble.y = 0;
        wobble.spin = 0;
        wobble.vx = 0;
        wobble.vy = 0;
        wobble.vSpin = 0;
      }

      group.position.set(wobble.x, wobble.y, 0);
      group.rotation.z = wobble.spin;
    });
  });
}

/**
 * One link in the PMNDRS chain. Each letter is pulled out of the tower by an
 * underdamped spring, with the next link released a beat later. Opacity stays
 * at zero until release, then position and rotation settle at different rates.
 */
function AnimatedLetter({
  index,
  target,
  clock,
  reveal,
  children,
}: {
  index: number;
  target: [number, number];
  clock: RefObject<number>;
  reveal: { value: number };
  children: ReactNode;
}) {
  const group = useRef<THREE.Group>(null);
  const side = index % 2 === 0 ? -1 : 1;
  const targetX = target[0];
  const targetY = target[1];
  const targetRef = useRef({ x: targetX, y: targetY });
  targetRef.current.x = targetX;
  targetRef.current.y = targetY;

  const pose = useRef<LetterPose>({
    x: 0,
    y: targetY - 1.15,
    rotation: -side * 0.18,
    vx: 0,
    vy: 0,
    vr: 0,
    phase: "uninitialized",
    previousTime: clock.current,
  });

  const applyPose = useCallback(
    (phase: "animating" | "settled") => {
      const object = group.current;
      if (!object) return;
      const destination = targetRef.current;
      const finished = phase === "settled";
      const x = finished ? destination.x : 0;
      const y = finished ? destination.y : destination.y - 1.15;
      const rotation = finished ? 0 : -side * 0.18;

      Object.assign(pose.current, {
        x,
        y,
        rotation,
        vx: 0,
        vy: 0,
        vr: 0,
        phase,
      });
      object.position.set(x, y, 0);
      object.rotation.z = rotation;
      reveal.value = finished ? 1 : 0;
    },
    [reveal, side],
  );

  /**
   * Transform invariants:
   * 1. JSX never owns the live position or rotation.
   * 2. Only `applyPose` and this frame step write the transform.
   * 3. A settled pose is held unless the clock rewinds or its target changes.
   */
  useFrame((_, frameDelta) => {
    const object = group.current;
    if (!object) return;
    const current = pose.current;
    const destination = targetRef.current;
    const time = clock.current;
    const settledPoseIsValid =
      current.phase === "settled" &&
      current.x === destination.x &&
      current.y === destination.y &&
      object.position.x === destination.x &&
      object.position.y === destination.y &&
      object.position.z === 0 &&
      object.rotation.z === 0;
    const action = gateLetterPose(current, time, settledPoseIsValid);
    current.previousTime = time;

    if (action === "reset") {
      applyPose("animating");
      return;
    }
    if (action === "finish") {
      applyPose("settled");
      return;
    }
    if (action === "hold") {
      return;
    }

    const release = LETTER_CHAIN_START + index * 0.14;
    if (time < release) {
      reveal.value = 0;
      return;
    }

    const dt = Math.min(frameDelta, 1 / 30);
    [current.x, current.vx] = spring(
      current.x,
      current.vx,
      destination.x,
      76,
      6.7,
      dt,
    );
    [current.y, current.vy] = spring(
      current.y,
      current.vy,
      destination.y,
      88,
      7.3,
      dt,
    );
    [current.rotation, current.vr] = spring(
      current.rotation,
      current.vr,
      0,
      72,
      6.8,
      dt,
    );

    const revealProgress = THREE.MathUtils.clamp(
      (time - release) / 0.26,
      0,
      1,
    );
    reveal.value = revealProgress * revealProgress * (3 - 2 * revealProgress);

    object.position.set(current.x, current.y, 0);
    object.rotation.z = current.rotation;

    const error =
      Math.abs(current.x - destination.x) +
      Math.abs(current.y - destination.y) +
      Math.abs(current.rotation);
    const speed =
      Math.abs(current.vx) + Math.abs(current.vy) + Math.abs(current.vr);
    if (error < 0.002 && speed < 0.01) {
      applyPose("settled");
    }
  });

  return <group ref={group}>{children}</group>;
}

export function Lettering({
  /** Glyph em size in world units. */
  size = 6,
  /** Multiplier for the authored horizontal offsets. */
  spread = 0.8,
  /** Scale shared with the main scene. */
  worldScale = 1,
  /** Full-resolution scene used for lettering and tower depth. */
  textLayer,
  introClock,
  towerLightLevel = 1,
}: {
  size?: number;
  spread?: number;
  worldScale?: number;
  textLayer: TextLayer;
  introClock: RefObject<number>;
  /** Strength of the tower light spilling onto the glyphs. */
  towerLightLevel?: number;
}) {
  const geist = useFont(FONT_REQUEST);

  const style = useMemo(() => ({ fontSize: size, lineHeight: 1 }), [size]);

  /** A tower glow scoped to the lettering material. */
  const [towerGlow] = useState(
    () => new THREE.PointLight("#ffb35c", 500, 0, 2),
  );

  /** Each letter needs a material with its own depth node. */
  const letters = useMemo(
    () =>
      LETTERS.map((letter) => {
        const reveal = uniform(0);
        return {
          letter,
          reveal,
          material: createLetterMaterial(
            towerGlow,
            layerDepthNode(letter.layer, worldScale),
            reveal,
          ),
        };
      }),
    [towerGlow, worldScale],
  );

  /** Glyph baseline offset in em units. */
  const [baselineEm, setBaselineEm] = useState<number | null>(null);
  const probeRef = useRef<TextObject<typeof msdf> | null>(null);
  useFrame(() => {
    if (baselineEm !== null) return;
    const probe = probeRef.current;
    if (!probe || probe.needsApply()) return;
    const measured = probe.measureLayout();
    if (measured) setBaselineEm(measured.firstBaseline / size);
  });

  useFrame((state) => {
    // Mirror scene lighting into the independent text pass.
    textLayer.scene.environment = state.scene.environment;
    textLayer.scene.environmentIntensity = state.scene.environmentIntensity;
    textLayer.scene.environmentRotation.copy(state.scene.environmentRotation);
  });

  const wobbleGroups = useRef<(THREE.Group | null)[]>([]);
  usePointerKnock(wobbleGroups, { size, worldScale });

  // Use one glyph batch per letter so each batch can write its own depth.
  return createPortal(
    <group scale={worldScale}>
      <primitive
        object={towerGlow}
        position={[0, 11, 0]}
        intensity={500 * towerLightLevel}
      />
      <Billboard>
        {letters.map(
          ({ letter: { char, position, center }, material, reveal }, i) => (
            <TextGroup
              key={char}
              compositing="independent"
              material={material}
              visible={baselineEm !== null}
            >
              <AnimatedLetter
                index={i}
                target={[position[0] * spread, position[1]]}
                clock={introClock}
                reveal={reveal}
              >
                {/* Pointer motion is additive to the intro's authored slot. */}
                <group
                  ref={(node) => {
                    wobbleGroups.current[i] = node;
                  }}
                >
                  <Text
                    ref={i === 0 ? probeRef : undefined}
                    font={geist}
                    style={style}
                    paint={{ color: "#ffffff" }}
                    position={[
                      -center[0] * size,
                      (baselineEm ?? 1) * size - center[1] * size,
                      0,
                    ]}
                  >
                    {char}
                  </Text>
                </group>
              </AnimatedLetter>
            </TextGroup>
          ),
        )}
      </Billboard>
    </group>,
    textLayer.scene,
  );
}
