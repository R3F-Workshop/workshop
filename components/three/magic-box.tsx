"use client";

import { Edges, MeshPortalMaterial, useGLTF } from "@react-three/drei/webgpu";
import { useFrame } from "@react-three/fiber/webgpu";
import { useControls } from "leva";
import { useEffect, useMemo, useRef } from "react";
import * as THREE from "three/webgpu";

import { TEN_GLYPHS, type TenGlyph } from "@/lib/ten-glyphs";
import { CameraRig } from "./camera-rig";
import { LevaPanel } from "./leva-panel";
import { SectionCanvas } from "./section-canvas";

/**
 * Ten, written six ways — one per face of a portal cube.
 *
 * Structurally this is pmndrs/examples' magic-box: each face of a plain
 * `boxGeometry` gets a `MeshPortalMaterial`, so what you see through it is a
 * genuinely separate scene rather than a texture. Ours is dark, and each portal
 * holds an extruded numeral instead of a platonic solid.
 *
 * The glyph outlines are generated offline — see scripts/build-glyphs.mjs for
 * why they arrive as raw points instead of a font.
 */

const MODEL = "/models/aobox.glb";

/**
 * One entry per boxGeometry material slot, in three's order: +x, -x, +y, -y,
 * +z, -z.
 *
 * Two different rotations, and conflating them cost me an hour:
 *
 * - `room` orients the AO box. These are the original example's values. The box
 *   is closed and lit from inside, so this only decides which baked corner you
 *   are looking into — any of them "works", they just look different.
 * - `facing` turns the glyph to look out through this slot, mapping its default
 *   +z to the slot's own normal. The original never needed this because a torus
 *   reads the same from every angle. A numeral does not, and using the room
 *   values here points half the glyphs at a side wall.
 */
const FACES = [
  // Slot order below is fixed by three; the glyph on each one is decided in
  // scripts/build-glyphs.mjs, which emits TEN_GLYPHS in this same order.
  // +x · Korean 십
  { accent: "#79c9a8", room: [0, 0, 0], facing: [0, Math.PI / 2, 0] },
  // -x · Roman X
  { accent: "#7fb6d9", room: [0, Math.PI, 0], facing: [0, -Math.PI / 2, 0] },
  // +y · Devanagari १०
  {
    accent: "#c98fb0",
    room: [0, Math.PI / 2, Math.PI / 2],
    facing: [-Math.PI / 2, 0, 0],
  },
  // -y · Eastern Arabic ١٠
  {
    accent: "#8f8ad9",
    room: [0, Math.PI / 2, -Math.PI / 2],
    facing: [Math.PI / 2, 0, 0],
  },
  // +z · 10, in the site gold. Faces the default camera, and it is the one that
  // carries the v10 nod, so it gets the accent colour.
  { accent: "#e0b365", room: [0, -Math.PI / 2, 0], facing: [0, 0, 0] },
  // -z · Japanese 十
  { accent: "#d9917f", room: [0, Math.PI / 2, 0], facing: [0, Math.PI, 0] },
] as const;

/**
 * Contours -> extruded geometry.
 *
 * The points are already normalised into a unit box with Y up, so there is no
 * flipping or centring to do beyond the bevel's own bounds.
 */
function useGlyphGeometry(glyph: TenGlyph, depth: number, bevel: number) {
  const geometry = useMemo(() => {
    const shapes = glyph.shapes.map(({ contour, holes }) => {
      const shape = new THREE.Shape(
        contour.map(([x, y]) => new THREE.Vector2(x, y)),
      );
      for (const hole of holes) {
        shape.holes.push(
          new THREE.Path(hole.map(([x, y]) => new THREE.Vector2(x, y))),
        );
      }
      return shape;
    });

    const geo = new THREE.ExtrudeGeometry(shapes, {
      depth,
      bevelEnabled: bevel > 0,
      bevelThickness: bevel,
      bevelSize: bevel,
      bevelSegments: 2,
      // The contours are already flattened polylines; subdividing them again
      // would only add vertices to straight edges.
      curveSegments: 1,
    });
    // Extrude grows along +z from the shape plane, and the bevel adds to both
    // ends — centring after the fact is simpler than predicting the offset.
    geo.center();
    geo.computeVertexNormals();
    return geo;
  }, [glyph, depth, bevel]);

  useEffect(() => () => geometry.dispose(), [geometry]);

  return geometry;
}

function Side({
  index,
  glyph,
  accent,
  room,
  facing,
  wallLevel,
  glyphScale,
  glyphDepth,
  depth,
  bevel,
  sway,
  metalness,
  roughness,
}: {
  index: number;
  glyph: TenGlyph;
  accent: string;
  room: readonly [number, number, number];
  facing: readonly [number, number, number];
  wallLevel: number;
  glyphScale: number;
  glyphDepth: number;
  depth: number;
  bevel: number;
  sway: number;
  metalness: number;
  roughness: number;
}) {
  const mesh = useRef<THREE.Mesh>(null);
  const { nodes } = useGLTF(MODEL) as unknown as {
    nodes: { Cube: THREE.Mesh };
  };
  const geometry = useGlyphGeometry(glyph, depth, bevel);
  // The reference sells each room by painting its walls the face colour. Ours
  // is the dark version of that: the same hue, dimmed, so six rooms stay
  // distinguishable without lifting off the page's black.
  const wall = useMemo(
    () => new THREE.Color(accent).multiplyScalar(wallLevel),
    [accent, wallLevel],
  );

  useFrame((state) => {
    if (!mesh.current) return;
    // The original tumbles its shape end over end. Numerals have to stay
    // legible, so this is a slow sway about Y with a little counter-tilt —
    // enough to catch the light without ever turning a glyph away.
    const t = state.elapsed + index * 1.7;
    mesh.current.rotation.y = Math.sin(t * 0.35) * sway;
    mesh.current.rotation.x = Math.sin(t * 0.23) * sway * 0.35;
  });

  return (
    <MeshPortalMaterial attach={`material-${index}`}>
      {/* Everything below is inside the portal, isolated from the page scene. */}

      {/* No Environment here — drei's presets fetch from a CDN, and this is a
          marketing page. That costs us image-based reflections, which is why
          the glyph metalness stays low: a high-metalness surface with nothing
          to reflect renders black. */}
      <ambientLight intensity={0.35} />

      {/* The room: baked AO in the corners does the work a dozen lights would.
          No shadow casting in here, but not because scenes can't have their own
          — shadow maps live on the lights, so all six portal scenes would render
          theirs independently without colliding. It's the switch that's shared:
          `shadowMap.enabled` and `.type` are renderer state, and R3F's `shadows`
          prop writes them straight onto the renderer. This canvas borrows the
          hero's, so turning shadows on here turns them on for the hero and every
          other section too — and with portals that means shadow passes for six
          extra scenes a frame. The AO bake buys the same look for nothing.
          If we ever want them, the switch belongs on the hero's Canvas. */}
      <mesh rotation={room} geometry={nodes.Cube.geometry}>
        <meshStandardNodeMaterial
          color={wall}
          aoMap={
            (nodes.Cube.material as THREE.MeshStandardMaterial | undefined)
              ?.aoMap ?? null
          }
          aoMapIntensity={1}
          roughness={0.85}
          metalness={0}
        />
        <spotLight
          color={accent}
          intensity={5}
          decay={0}
          position={[5, 6, 5]}
          angle={0.6}
          penumbra={1}
        />
        {/* Cool counter-light so the unlit side of the glyph isn't pure black. */}
        <pointLight
          position={[-5, -2, 4]}
          intensity={2.5}
          decay={0}
          color="#6b7080"
        />
      </mesh>

      <group rotation={facing}>
        {/* Pushed out toward its own face instead of sitting on the cube's
            mid-plane. Centred, the neighbouring face slices through it at any
            angle off head-on — fine for the original's torus, fatal for
            something you have to read. Local +z is this slot's normal. */}
        <mesh
          ref={mesh}
          geometry={geometry}
          scale={glyphScale}
          position={[0, 0, glyphDepth]}
        >
          <meshStandardNodeMaterial
            color={accent}
            metalness={metalness}
            roughness={roughness}
          />
        </mesh>
      </group>
    </MeshPortalMaterial>
  );
}

function Box() {
  const group = useRef<THREE.Group>(null);

  const {
    autoRotate,
    rotateSpeed,
    wallLevel,
    glyphScale,
    glyphDepth,
    depth,
    bevel,
    sway,
    metalness,
    roughness,
    edges,
  } = useControls("magic box", {
    autoRotate: true,
    rotateSpeed: { value: 0.12, min: 0, max: 1, step: 0.01 },
    wallLevel: { value: 0.13, min: 0, max: 1, step: 0.01 },
    glyphScale: { value: 1.25, min: 0.4, max: 2.4, step: 0.05 },
    glyphDepth: { value: 0.45, min: -0.9, max: 0.9, step: 0.05 },
    depth: { value: 0.22, min: 0.02, max: 0.6, step: 0.01 },
    bevel: { value: 0.015, min: 0, max: 0.08, step: 0.005 },
    sway: { value: 0.32, min: 0, max: 1.2, step: 0.02 },
    metalness: { value: 0.25, min: 0, max: 1, step: 0.05 },
    roughness: { value: 0.35, min: 0, max: 1, step: 0.05 },
    edges: true,
  });

  useFrame((_, delta) => {
    if (!group.current || !autoRotate) return;
    group.current.rotation.y += delta * rotateSpeed;
    // A touch of X keeps the top and bottom faces in the rotation rather than
    // leaving two of the six permanently unseen.
    group.current.rotation.x = Math.sin(group.current.rotation.y * 0.5) * 0.16;
  });

  return (
    <group ref={group}>
      <mesh>
        <boxGeometry args={[2, 2, 2]} />
        {edges && <Edges color="#3a3a45" />}
        {FACES.map((face, i) => (
          <Side
            key={TEN_GLYPHS[i].id}
            index={i}
            glyph={TEN_GLYPHS[i]}
            accent={face.accent}
            room={face.room}
            facing={face.facing}
            wallLevel={wallLevel}
            glyphScale={glyphScale}
            glyphDepth={glyphDepth}
            depth={depth}
            bevel={bevel}
            sway={sway}
            metalness={metalness}
            roughness={roughness}
          />
        ))}
      </mesh>
    </group>
  );
}

/** Shared camera framing — the box is 2 units and this keeps all of it in view. */
export const BOX_CAMERA = { position: [-4.2, 2.0, 4.8], fov: 40 } as const;

/** The scene itself, independent of which canvas is hosting it. */
export function MagicBoxScene() {
  return (
    <>
      {/* Opaque, unlike every other section canvas: it covers the poster
          underneath rather than compositing over it. Each canvas owns its own
          scene, so this doesn't touch the hero's transparency. */}
      <color attach="background" args={["#0b0b0e"]} />
      <Box />
      <CameraRig />
    </>
  );
}

/**
 * In-page version: a secondary canvas borrowing the hero's renderer.
 *
 * `camera` is overridable because BOX_CAMERA frames the box for a full screen;
 * dropped into a short, wide card slot the same framing leaves it marooned in
 * the middle. Callers pull in rather than the box growing.
 */
export function MagicBoxCanvas({
  camera = BOX_CAMERA,
}: {
  camera?: { position: readonly [number, number, number]; fov: number };
} = {}) {
  return (
    <>
      <LevaPanel />
      <SectionCanvas
        interactive
        // It is the one thing on the page you can grab, so it gets a real
        // framerate rather than the backdrop budget.
        fps={60}
        camera={camera}
      >
        <MagicBoxScene />
      </SectionCanvas>
    </>
  );
}

useGLTF.preload(MODEL);
