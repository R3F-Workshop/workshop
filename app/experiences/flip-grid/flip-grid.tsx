"use client";

import {
  Canvas,
  EnvironmentMap,
  useFrame,
  useGPUStorage,
  useLocalNodes,
  useThree,
  useUniforms,
} from "@react-three/fiber/webgpu";
import { folder, useControls } from "leva";
import { useEffect, useMemo, useRef, type RefObject } from "react";
import {
  clamp,
  cos,
  dot,
  exp,
  float,
  Fn,
  fract,
  hash,
  instancedArray,
  instanceIndex,
  length,
  max,
  normalize,
  normalLocal,
  positionLocal,
  select,
  sin,
  struct,
  transformNormalToView,
  uniform,
  uv,
  vec2,
  vec3,
} from "three/tsl";
import {
  ACESFilmicToneMapping,
  Color,
  Vector2,
  type Node,
  type PointLight,
  type WebGPURenderer,
} from "three/webgpu";

import {
  createStudioEnvironment,
  ENV_PRESETS,
  type EnvPreset,
} from "@/app/home/components/canvas/studio-env";
import { DepthAttachmentSync } from "@/components/depth-attachment-sync";
import { useWebGPU } from "@/lib/use-webgpu";

/**
 * A grid of tiles that flip to gold as the cursor sweeps them, and hold that
 * pose for a few seconds before falling back.
 *
 * The whole experience: a canvas, the environment the gold reflects, the
 * simulation, and the Leva panel that tunes it. Drop `<FlipGrid />` into any
 * box and it fills it. The root element is also what the cursor is measured
 * against.
 *
 * The whole simulation lives on the GPU. A storage buffer holds one `Tile`
 * struct per instance — flip angle, angular velocity, and the hold timer — a
 * compute pass integrates it, and the vertex stage reads the angle back out.
 * The CPU writes five floats a frame (dt plus two pointer positions) no matter
 * how many tiles there are.
 *
 * That is the whole argument for the WebGPU path. Per-instance *state* is what
 * a stateless version can't have: with the flip angle derived from cursor
 * distance every frame, there is nowhere to put a timer, so "stay flipped for
 * three seconds" is unrepresentable. Doing it on WebGL means either ~1800
 * matrix writes per frame from JavaScript or a ping-pong float-texture dance.
 */

/**
 * Per-instance simulation state.
 *
 * Only genuinely *stateful* fields live here. Per-tile mass is derived from a
 * hash of the instance index instead — deterministic, free, and it needs no
 * init pass, which means the zero-filled buffer three allocates is already a
 * valid starting state.
 */
const Tile = struct(
  {
    /** Flip angle in radians. 0 rests dark side out, π shows the gold. */
    angle: "float",
    angVel: "float",
    /** Seconds left before this tile is allowed to fall back. */
    hold: "float",
  },
  "Tile",
);

/** Parking spot for the cursor when it's off the element. */
const AWAY = 1e6;

/**
 * The largest timestep the spring integrator is allowed to see. A backgrounded
 * tab or a long frame hitch would otherwise hand it a delta big enough to
 * explode a semi-implicit Euler step.
 */
const MAX_DT = 1 / 20;

/**
 * three's TSL types tag every node with its GLSL type. Struct members come back
 * as untyped nodes, so these name the shapes we know those reads produce and
 * keep the casts in one place.
 */
type FloatNode = Node<"float">;
type Vec2Node = Node<"vec2">;

/**
 * Every tunable, as the Leva panel hands them back. The defaults and what each
 * one does are documented on the panel schema in `FlipGrid`.
 */
type Config = {
  cols: number;
  rows: number;
  fill: number;
  thickness: number;
  radius: number;
  hold: number;
  stiffness: number;
  damping: number;
  massJitter: number;
  front: string;
  back: string;
  edge: string;
  roughness: number;
  flakeCells: number;
  flakeStrength: number;
  flakeRoughness: number;
  toneJitter: number;
  roughJitter: number;
  tiltJitter: number;
  curvature: number;
  envPreset: EnvPreset;
  ground: string;
  sky: string;
  keyIntensity: number;
  kickIntensity: number;
  fillIntensity: number;
  envIntensity: number;
  cursorLight: number;
  cursorLightHeight: number;
  cursorLightColor: string;
};

/**
 * Cheap 2D value hash — the classic sin/fract trick.
 *
 * Not a good hash in any statistical sense, but grain doesn't need one, and it
 * costs three instructions against a texture fetch and a mip chain.
 */
const hash2 = (p: Node<"vec2">) =>
  fract(sin(dot(p, vec2(127.1, 311.7))).mul(43758.5453));

function Scene({
  config,
  /**
   * The element whose bounds map the cursor into the scene. Not the canvas:
   * it is `pointer-events: none` so it never steals clicks, and under a shared
   * renderer `renderer.domElement` may well be someone else's.
   */
  bounds,
}: {
  config: Config;
  bounds: RefObject<HTMLElement | null>;
}) {
  const { cols, rows } = config;
  const count = cols * rows;
  const { viewport } = useThree();
  // `useThree` types `renderer` as the WebGL/WebGPU union even on the /webgpu
  // entry, and `compute` only exists on the WebGPU one.
  // See pmndrs/react-three-fiber#3851.
  const renderer = useThree((s) => s.renderer) as unknown as WebGPURenderer;

  // One cell spans whichever axis needs more coverage, so the grid always
  // overfills rather than leaving a margin.
  const step = Math.max(viewport.width / cols, viewport.height / rows);

  // Built with TSL's own `uniform()` rather than from raw values, because the
  // store hands everything back as `UniformNode<unknown>` and the node graph
  // below needs the concrete types. `useUniforms` still owns them — it accepts
  // existing uniform nodes as-is — so they stay visible to HMR and to anything
  // else reading the store.
  const u = useMemo(
    () => ({
      uStep: uniform(1),
      uTile: uniform(1),
      uThickness: uniform(config.thickness),
      uRadius: uniform(1),
      uHold: uniform(config.hold),
      uStiffness: uniform(config.stiffness),
      uDamping: uniform(config.damping),
      uMassJitter: uniform(config.massJitter),
      uDt: uniform(0),
      uPointer: uniform(new Vector2(AWAY, AWAY)),
      uPointerPrev: uniform(new Vector2(AWAY, AWAY)),
      uFront: uniform(new Color(config.front)),
      uBack: uniform(new Color(config.back)),
      uEdge: uniform(new Color(config.edge)),
      uRoughness: uniform(config.roughness),
      uFlakeCells: uniform(config.flakeCells),
      uFlakeStrength: uniform(config.flakeStrength),
      uFlakeRoughness: uniform(config.flakeRoughness),
      uTiltJitter: uniform(config.tiltJitter),
      uCurvature: uniform(config.curvature),
      uToneJitter: uniform(config.toneJitter),
      uRoughJitter: uniform(config.roughJitter),
    }),
    // Created once for the life of the component; every later change is a value
    // write below, not a rebuild.
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [],
  );

  // Scoped, because uniforms resolve against the *primary* store — on the site
  // this canvas shares one renderer with the hero, and unscoped names would
  // collide with it.
  useUniforms(() => u, "flipGrid");

  // Writing values instead of rebuilding the graph is what makes the Leva panel
  // feel instant rather than recompiling a shader per slider tick.
  useEffect(() => {
    u.uStep.value = step;
    u.uTile.value = step * config.fill;
    u.uThickness.value = config.thickness;
    u.uRadius.value = step * config.radius;
    u.uHold.value = config.hold;
    u.uStiffness.value = config.stiffness;
    u.uDamping.value = config.damping;
    u.uMassJitter.value = config.massJitter;
    u.uRoughness.value = config.roughness;
    u.uFlakeCells.value = config.flakeCells;
    u.uFlakeStrength.value = config.flakeStrength;
    u.uFlakeRoughness.value = config.flakeRoughness;
    u.uTiltJitter.value = config.tiltJitter;
    u.uCurvature.value = config.curvature;
    u.uToneJitter.value = config.toneJitter;
    u.uRoughJitter.value = config.roughJitter;
    u.uFront.value.set(config.front);
    u.uBack.value.set(config.back);
    u.uEdge.value.set(config.edge);
  });

  // Zero-filled at allocation, which is exactly "flat, still, not held".
  // `instancedArray` accepts a struct type at runtime but isn't typed for one
  // yet; the buffer it hands back behaves as a flat float array either way.
  const tiles = useMemo(
    () => instancedArray(count, Tile as unknown as "float"),
    [count],
  );
  // Registered at the root with a prefixed key rather than in a "flipGrid"
  // scope, because r3f names scoped storage `scope.name` — and three builds the
  // WGSL struct name off that, so the dot lands in an identifier and the shader
  // fails to parse. Scoped *uniforms* use `scope_name`, which is fine; it's only
  // the storage path that differs. See pmndrs/react-three-fiber#3848.
  useGPUStorage(() => ({ flipGridTiles: tiles }));

  const nodes = useLocalNodes(() => {
    /** This instance's cell centre, in world units. */
    const cellCentre = () => {
      const ix = float(instanceIndex.mod(cols));
      const iy = float(instanceIndex.div(cols));
      return vec2(ix.sub((cols - 1) / 2), iy.sub((rows - 1) / 2)).mul(u.uStep);
    };

    /**
     * Distance to the segment the cursor swept this frame, not to where it
     * happens to be right now.
     *
     * This canvas runs at a throttled framerate, so a fast sweep moves the
     * pointer several cells between samples. Testing against the point leaves
     * gaps in the trail; testing against the segment fills them in, for the
     * cost of one dot product.
     */
    const distanceToSweep = (p: Vec2Node) => {
      const a = u.uPointer;
      const ab = u.uPointerPrev.sub(a);
      const t = clamp(dot(p.sub(a), ab).div(max(dot(ab, ab), 1e-6)), 0, 1);
      return length(p.sub(a.add(ab.mul(t))));
    };

    const update = Fn(() => {
      const tile = tiles.element(instanceIndex);
      const angle = tile.get("angle") as FloatNode;
      const angVel = tile.get("angVel") as FloatNode;
      const hold = tile.get("hold") as FloatNode;

      // Pinned full while the cursor is on the tile, draining once it leaves.
      // Counting down rather than storing an absolute deadline keeps the shader
      // free of a clock and immune to float drift over a long session.
      const held = select(
        distanceToSweep(cellCentre()).lessThan(u.uRadius),
        u.uHold,
        hold.sub(u.uDt).max(0),
      ) as FloatNode;
      hold.assign(held);

      const target = select(held.greaterThan(0), float(Math.PI), float(0));

      // Heavier tiles accelerate more slowly into the flip and overshoot more
      // on arrival, so a sweep breaks up into a ripple instead of a wavefront.
      const mass = float(1).add(hash(instanceIndex).mul(u.uMassJitter));

      angVel.addAssign(
        target.sub(angle).mul(u.uStiffness).div(mass).mul(u.uDt),
      );
      // Exponential decay rather than a bare multiply, so damping means the same
      // thing whatever framerate this canvas ends up running at.
      angVel.mulAssign(exp(u.uDamping.mul(u.uDt).negate()));
      angle.addAssign(angVel.mul(u.uDt));
    })().compute(count);

    // Read-only here: three forces storage access to `read` outside the compute
    // stage, so one node serves both without any juggling.
    const angle = tiles.element(instanceIndex).get("angle") as FloatNode;
    const c = cos(angle);
    const s = sin(angle);

    /** Rotation about X, per component — three lines, and the shader stays flat. */
    const spin = (v: Node<"vec3">) =>
      vec3(v.x, v.y.mul(c).sub(v.z.mul(s)), v.y.mul(s).add(v.z.mul(c)));

    const local = positionLocal.mul(
      vec3(u.uTile, u.uTile, u.uTile.mul(u.uThickness)),
    );

    // Which face of the box a fragment belongs to, decided from the *unrotated*
    // normal — the geometry's own identity, independent of where the flip has
    // got to. That is the whole point of using a box: the gold doesn't fade in,
    // it arrives, because you are now looking at a different face.
    const isFront = normalLocal.z.greaterThan(0.5);
    const isBack = normalLocal.z.lessThan(-0.5);

    /**
     * Per-tile tone, so neighbours aren't stamped from the same die.
     *
     * Real sheet metal varies: alloy, age, how it caught the polish. Even a few
     * percent stops a grid of identical values from reading as printed.
     */
    const toneJitter = hash(instanceIndex.add(4919))
      .sub(0.5)
      .mul(u.uToneJitter);
    const gold = u.uBack.rgb.mul(float(1).add(toneJitter));

    const base = select(
      isFront,
      u.uFront.rgb,
      select(isBack, gold, u.uEdge.rgb),
    ) as Node<"vec3">;
    const metalness = float(
      select(isFront, float(0.12), select(isBack, float(1), float(0.9))),
    );

    /**
     * Grain, generated rather than sampled.
     *
     * The imperfection maps shipped with the MaterialX gold are 1k, and a tile
     * is about 20px on screen — so whatever the repeat, they land on mip 5 or 6
     * and average to flat before they ever reach the surface. That is why the
     * gold read as plastic: the "microfacets" were a no-op, and every tile was
     * showing nothing but a clean dome gradient.
     *
     * Detail only survives if it sits at a frequency the tile can resolve —
     * a handful of cells across, so a few pixels each. A hash lattice gives
     * exactly that, costs three ALU ops, and can't be mipped away. The maps are
     * still the right tool when a surface is large on screen; this one isn't.
     */
    const cellId = uv()
      .mul(u.uFlakeCells)
      .floor()
      // Shift the lattice per instance, or every tile wears identical facets.
      .add(vec2(float(instanceIndex.mod(29)), float(instanceIndex.mod(31))));

    const grainX = hash2(cellId).sub(0.5);
    const grainY = hash2(cellId.add(vec2(19.7, 7.3))).sub(0.5);
    // Per-facet roughness too. Uniform roughness is its own tell — it's what
    // makes a surface look moulded rather than worked.
    const grainRough = hash2(cellId.add(vec2(3.1, 41.9)));

    /**
     * A few degrees of per-tile lean, on top of the per-fragment flakes.
     *
     * Under an orthographic camera a distant environment doesn't care where a
     * tile *is*, only which way it faces — so a grid of perfectly flat tiles
     * with identical normals reflects one identical direction and settles into
     * one identical colour, which is what makes it read as a painted swatch
     * rather than a hundred small mirrors. Tilting each plate slightly is what
     * real stamped metal does anyway, and it's what breaks the grid up.
     */
    const tilt = vec2(hash(instanceIndex.add(31)), hash(instanceIndex.add(77)))
      .sub(0.5)
      .mul(u.uTiltJitter);

    /**
     * A gentle dome across each tile — the single thing that makes this read as
     * metal rather than as gold paint.
     *
     * A perfectly flat face has one normal, samples one direction, and comes
     * back one colour; the choice is then between a mirror finish (binary: a
     * tile either catches the key or goes black) and a rough one (everything
     * averages to the same flat cream). Neither looks like metal. A curved face
     * sweeps its normal across the environment and picks up a *gradient* —
     * bright falling to dark within the same tile — which is exactly why a
     * rounded object reads as gold and a flat swatch of the same material
     * doesn't. Two lines of maths stand in for the curvature.
     */
    const dome = uv().sub(0.5).mul(2).mul(u.uCurvature);

    const perturbed = normalize(
      vec3(
        dome.x.add(grainX.mul(u.uFlakeStrength)).add(tilt.x),
        dome.y.add(grainY.mul(u.uFlakeStrength)).add(tilt.y),
        // Sign follows the face, so the perturbation leans out of whichever
        // side we're looking at rather than into it.
        select(isBack, float(-1), float(1)),
      ),
    );
    const faceNormal = select(
      isFront.or(isBack),
      perturbed,
      normalLocal,
    ) as Node<"vec3">;

    // Roughness varies three ways: per facet, per tile, and by face. A single
    // roughness across a whole surface is one of the reliable tells of CG.
    const goldRoughness = u.uRoughness
      .add(grainRough.mul(u.uFlakeRoughness))
      .add(hash(instanceIndex.add(7717)).sub(0.5).mul(u.uRoughJitter));

    const roughness = float(
      select(isFront, float(0.78), select(isBack, goldRoughness, float(0.38))),
    ).clamp(0.03, 1);

    return {
      update,
      positionNode: spin(local).add(vec3(cellCentre(), 0)),
      // The normal has to turn with the tile or the lighting won't sell the
      // flip. `normalNode` is read in view space, so the rotated local normal
      // goes through the model-normal matrix on the way out.
      normalNode: transformNormalToView(spin(faceNormal)),
      colorNode: base,
      metalnessNode: metalness,
      roughnessNode: roughness,
      // No emissive term any more. The previous version faked reflections by
      // adding a gradient to emissive, which is why the gold read as coloured
      // plastic: emissive ignores fresnel, ignores roughness, and can't be
      // occluded. The scene's environment map now drives real image-based
      // lighting instead, and metalness routes it through the proper specular
      // path.
    };
  });

  const pointer = useRef(new Vector2(AWAY, AWAY));
  /**
   * Set when the cursor teleports — entering the element, or leaving it. The
   * sweep test has to collapse to a point on those frames, or the segment from
   * "parked at infinity" to "over the grid" would flip everything it crosses.
   */
  const warped = useRef(true);

  useEffect(() => {
    const el = bounds.current;
    if (!el) return;

    const onMove = (event: PointerEvent) => {
      const rect = el.getBoundingClientRect();
      const nx = ((event.clientX - rect.left) / rect.width) * 2 - 1;
      const ny = -(((event.clientY - rect.top) / rect.height) * 2 - 1);

      if (nx < -1 || nx > 1 || ny < -1 || ny > 1) {
        if (pointer.current.x !== AWAY) warped.current = true;
        pointer.current.set(AWAY, AWAY);
        return;
      }

      if (pointer.current.x === AWAY) warped.current = true;
      pointer.current.set(
        (nx * viewport.width) / 2,
        (ny * viewport.height) / 2,
      );
    };

    /**
     * Park the cursor. `pointermove` only fires while the cursor is *in* the
     * document, so without these the last position sticks and whatever it was
     * over stays flipped forever — leave the window and you leave a permanent
     * gold blot behind. Each of these is a different way to lose the cursor
     * without a final move event:
     *  - `pointerout` with no `relatedTarget`: left the document entirely.
     *  - `blur`: focus went to another window, or the OS took over.
     *  - `visibilitychange`: tab hidden, or the machine slept.
     */
    const park = () => {
      if (pointer.current.x === AWAY) return;
      pointer.current.set(AWAY, AWAY);
      warped.current = true;
    };

    const onOut = (event: PointerEvent) => {
      if (!event.relatedTarget) park();
    };
    const onVisibility = () => {
      if (document.hidden) park();
    };

    // Listen on the window rather than the element: the canvas doesn't take
    // pointer events, and on the site the copy sitting on top of it would eat
    // them before the section ever saw them.
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
  }, [bounds, viewport.width, viewport.height]);

  const cursorLight = useRef<PointLight>(null);

  useFrame((_, delta) => {
    u.uDt.value = Math.min(delta, MAX_DT);

    // On a teleport the segment collapses to a point, so nothing between the
    // old and new cursor positions gets swept.
    u.uPointerPrev.value.copy(
      warped.current ? pointer.current : u.uPointer.value,
    );
    warped.current = false;
    u.uPointer.value.copy(pointer.current);

    // A specular highlight that travels is one of the strongest metal cues
    // there is — a static one reads as a painted-on shine. Parked far away the
    // light simply stops reaching the grid, so it needs no separate on/off.
    const light = cursorLight.current;
    if (light) {
      light.position.set(
        pointer.current.x,
        pointer.current.y,
        config.cursorLightHeight,
      );
    }

    // `useFrame` runs in the scheduler's update phase, ahead of this canvas's
    // render, so the vertex stage always reads angles the compute pass just
    // wrote.
    renderer.compute(nodes.update);
  });

  return (
    <>
      {/* Deliberately dim. The environment map is doing the lighting now; these
          only keep the dark front faces from crushing to black. */}
      <ambientLight intensity={0.12} />
      <directionalLight position={[2, 3, 6]} intensity={0.5} color="#fff4e0" />

      <pointLight
        ref={cursorLight}
        intensity={config.cursorLight}
        color={config.cursorLightColor}
        distance={0}
        decay={1.6}
      />

      <instancedMesh
        args={[undefined, undefined, count]}
        // Instance transforms live in the shader, so the CPU-side bounding
        // volume is meaningless here.
        frustumCulled={false}
      >
        {/* A unit box, scaled in the vertex stage — so the thickness slider is
            a uniform write rather than a geometry rebuild. */}
        <boxGeometry args={[1, 1, 1]} />
        <meshStandardNodeMaterial
          positionNode={nodes.positionNode}
          normalNode={nodes.normalNode}
          colorNode={nodes.colorNode}
          metalnessNode={nodes.metalnessNode}
          roughnessNode={nodes.roughnessNode}
        />
      </instancedMesh>
    </>
  );
}

/**
 * Builds the environment the gold reflects and hands it to the scene.
 *
 * Rebuilt whenever a light changes — cheap in itself, 256×128 of CPU float
 * maths, but three re-runs PMREM on the result, so it is deliberately not on
 * the per-frame path.
 */
function Environment({ config }: { config: Config }) {
  const texture = useMemo(() => {
    const preset = ENV_PRESETS[config.envPreset];
    // The three intensities are positional slots, not fixed roles: key/kick/fill
    // in the studio, sun/haze/bounce outdoors.
    const [a, b, c] = preset.softboxes;
    return createStudioEnvironment({
      ...preset,
      ground: hexToLinear(config.ground),
      sky: hexToLinear(config.sky),
      softboxes: [
        { ...a, intensity: config.keyIntensity },
        { ...b, intensity: config.kickIntensity },
        { ...c, intensity: config.fillIntensity },
      ],
    });
  }, [
    config.envPreset,
    config.ground,
    config.sky,
    config.keyIntensity,
    config.kickIntensity,
    config.fillIntensity,
  ]);

  // The generator allocates a new DataTexture each time; the old one holds a
  // GPU allocation until it's told to let go.
  useEffect(() => () => texture.dispose(), [texture]);

  return (
    <EnvironmentMap map={texture} environmentIntensity={config.envIntensity} />
  );
}

/** sRGB hex to the linear triplet the environment builder works in. */
function hexToLinear(hex: string): [number, number, number] {
  const n = parseInt(hex.replace("#", ""), 16);
  const toLinear = (c: number) =>
    c <= 0.04045 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4);
  return [
    toLinear(((n >> 16) & 255) / 255),
    toLinear(((n >> 8) & 255) / 255),
    toLinear((n & 255) / 255),
  ];
}

export function FlipGrid() {
  const bounds = useRef<HTMLDivElement>(null);

  // Namespaced, because Leva's store is global and every demo shares it. The
  // panel is a DOM overlay, so it is entirely indifferent to how many canvases
  // are on the page — a folder per demo is all it takes to keep them apart.
  const controls = useControls("flip grid", {
    grid: folder({
      // Grid resolution. Changing either remounts the scene, see the key below.
      cols: { value: 56, min: 8, max: 120, step: 1 },
      rows: { value: 32, min: 6, max: 80, step: 1 },
      // Tile edge as a fraction of the cell, so a hairline gutter shows through.
      fill: { value: 0.82, min: 0.3, max: 1, step: 0.01 },
      // Tile depth as a fraction of the tile edge. This is what sells the flip.
      thickness: { value: 0.09, min: 0.01, max: 0.5, step: 0.005 },
    }),
    cursor: folder({
      // Flip radius around the cursor, in cells.
      radius: { value: 3.2, min: 0.5, max: 12, step: 0.1 },
      // Seconds a tile stays flipped after the cursor has moved off it.
      hold: { value: 3, min: 0, max: 10, step: 0.1 },
    }),
    spring: folder({
      // Angular spring driving the flip. Damping below ~2·sqrt(stiffness)
      // overshoots.
      stiffness: { value: 60, min: 5, max: 300, step: 1 },
      damping: { value: 9, min: 0.5, max: 60, step: 0.5 },
      // Upper bound on the per-instance mass multiplier. 0 makes every tile
      // identical.
      massJitter: { value: 1.4, min: 0, max: 6, step: 0.05 },
    }),
    faces: folder({
      // Front (resting), back (the metal), and the four edges. The front is
      // darker than it looks like it needs to be: a studio bright enough to
      // make gold glow also lights the resting faces, and these are meant to
      // disappear.
      front: "#0a0a0d",
      // Gold reflectance. `Gold.mtlx`'s base_color — (1.059, 0.773, 0.307)
      // linear — which is what physically-based gold actually is: paler and
      // less orange than the colour most people reach for.
      back: "#f6cd76",
      edge: "#6b5a33",
      // Base roughness of the metal face. 0 is a mirror; the flakes add the rest.
      roughness: { value: 0.13, min: 0, max: 1, step: 0.01 },
    }),
    surface: folder({
      // Fine normal perturbation, standing in for the microfacet structure a
      // real metal surface has. Without it a flat tile reflects exactly one
      // direction of the environment and reads as paint. See `Scene`.
      // Grain facets across a tile. Aim for a few pixels each.
      flakeCells: { value: 12, min: 1, max: 32, step: 1 },
      flakeStrength: { value: 0.09, min: 0, max: 2, step: 0.01 },
      // How far the grain pushes roughness around per facet.
      flakeRoughness: { value: 0.18, min: 0, max: 1, step: 0.01 },
      // Per-tile brightness spread, so neighbours aren't identical.
      toneJitter: { value: 0.3, min: 0, max: 1, step: 0.01 },
      // Per-tile roughness spread.
      roughJitter: { value: 0.18, min: 0, max: 1, step: 0.01 },
      // Per-tile lean, in normal-space units (~0.3 is a few degrees). Without
      // it every settled tile faces the same way, reflects the same direction
      // of a distant environment, and the grid resolves to one flat colour.
      tiltJitter: { value: 0.12, min: 0, max: 1.5, step: 0.01 },
      // How much each tile domes across its own face. This is the curvature a
      // flat plate doesn't have, and it's what turns a single reflected sample
      // into a highlight gradient. 0 makes the tiles genuinely flat, and
      // genuinely plastic-looking.
      curvature: { value: 0.18, min: 0, max: 2.5, step: 0.01 },
    }),
    environment: folder({
      // Which environment to reflect. Outdoor's hard horizon suits flat tiles.
      envPreset: { value: "outdoor", options: ["outdoor", "studio"] },
      // Intensities are linear radiance, so >1 is expected.
      ground: "#2a2018",
      sky: "#6f83ad",
      keyIntensity: { value: 55, min: 0, max: 120, step: 0.5 },
      kickIntensity: { value: 2.2, min: 0, max: 60, step: 0.1 },
      fillIntensity: { value: 0.5, min: 0, max: 10, step: 0.1 },
      // Multiplier applied to the environment as a whole.
      envIntensity: { value: 1, min: 0, max: 4, step: 0.05 },
    }),
    cursorLight: folder({
      // A light that rides the cursor, so the metal has something moving to
      // catch.
      cursorLight: { value: 9, min: 0, max: 60, step: 0.5 },
      cursorLightHeight: { value: 3.5, min: 0.2, max: 20, step: 0.1 },
      cursorLightColor: "#fff2d8",
    }),
  });

  // Leva types a select as plain `string`, so the union has to be restored on
  // the way out. Narrowing the one field beats casting the whole object.
  const config: Config = {
    ...controls,
    envPreset: controls.envPreset as EnvPreset,
  };

  // No WebGPU, no experience. The shell around this decides what to show instead.
  if (useWebGPU() !== "yes") return null;

  return (
    // This element is what the cursor is measured against. The canvas itself
    // takes no pointer events, so the listeners sit on the window and map the
    // cursor through this box's bounds.
    <div ref={bounds} className="absolute inset-0">
      <Canvas
        orthographic
        camera={{ position: [0, 0, 10], zoom: 1 }}
        dpr={[1, 2]}
        // Odd/fractional drawing buffers desync the depth attachment from the
        // swap chain — see DepthAttachmentSync.
        forceEven
        renderer={{
          alpha: true,
          antialias: true,
          // r3f already defaults to this; stated explicitly because the scene
          // depends on it. The environment is HDR on purpose — softboxes sit well
          // above 1 so a mirror-flat tile has something with range to reflect —
          // and without a tone map every one of them clips to flat white.
          toneMapping: ACESFilmicToneMapping,
        }}
        style={{ pointerEvents: "none" }}
      >
        <DepthAttachmentSync />
        <Environment config={config} />
        {/* Remounting on a resolution change is deliberate: the storage buffer is
            sized to cols × rows, and tearing it down is far simpler to reason
            about than resizing it in place. */}
        <Scene
          key={`${config.cols}x${config.rows}`}
          config={config}
          bounds={bounds}
        />
      </Canvas>
    </div>
  );
}
