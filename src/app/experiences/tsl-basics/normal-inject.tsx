"use client";

import {
  Canvas,
  EnvironmentMap,
  useFrame,
  useLocalNodes,
  useUniforms,
  type CreatorState,
} from "@react-three/fiber/webgpu";
import { useGLTF } from "@react-three/drei/webgpu";
import { useControls } from "leva";
import { Suspense, useEffect, useLayoutEffect, useMemo, useRef } from "react";
import {
  cos,
  float,
  Fn,
  length,
  materialNormal,
  modelViewMatrix,
  positionLocal,
  smoothstep,
  time,
  uniform,
} from "three/tsl";
import {
  Vector3,
  type Group,
  type Mesh,
  type MeshStandardMaterial,
  type MeshStandardNodeMaterial,
  type Node,
  type UniformNode,
} from "three/webgpu";

import {
  createStudioEnvironment,
  STUDIO_DEFAULT,
} from "@/app/home/components/canvas/studio-env";
import { useWebGPU } from "@/lib/use-webgpu";
import { asset } from "@/lib/asset";

/**
 * TSL basics: injecting a node into a loaded material.
 *
 * A glTF arrives with a `MeshStandardMaterial` on it, not a node material.
 * The WebGPU renderer copes with that by converting every classic material
 * into its node twin the first time it builds it, in
 * `renderer.library.fromMaterial`, which is why plain materials render at
 * all under WebGPU. Do that conversion yourself and the material is yours to
 * extend. Here it is the ordinary R3F shape: a `<meshStandardNodeMaterial>`
 * declared under the mesh, and one `copy(loaded)` through its ref that
 * carries the colour map, the metal-rough map, the emissive, the AO and the
 * normal map the file set. Fiber owns the material's lifetime, so there is
 * nothing to dispose by hand.
 *
 * Every slot on a node material has a `xNode` override and a `materialX`
 * accessor. The override replaces what the material would have computed.
 * The accessor is that computation, offered back as a node: `materialNormal`
 * is the normal map sampled, unpacked and moved into view space, or the
 * plain vertex normal when there is no map. Setting `normalNode` to
 * something built out of `materialNormal` is therefore not a replacement
 * but a wrap. The helmet's dents and panel lines still work, and the ripple
 * sits on top of them.
 *
 * The ripple is a hover effect. `onPointerMove` on the mesh hands back a
 * world point, the handler turns it into the helmet's own space, and a
 * uniform carries it to the shader. The shader measures each fragment's
 * distance to that point and tilts the normal along the radial direction by
 * a cosine of that distance. Nothing about the geometry moves. Only the
 * lighting thinks it does.
 *
 * Open the controls and switch `inject` off. The `normalNode` prop goes to
 * null and the material is back on its own normal. No `needsUpdate` is
 * needed: a node material hashes every `xNode` slot into its program cache
 * key, so a swapped node is a different program and the renderer rebuilds
 * on its own.
 *
 * The model is the Khronos DamagedHelmet sample, by theblueturtle_, under
 * CC BY-NC 4.0.
 */

//* The injected node =========================================================

/** The dials and the pointer, as the store hands them back. */
type Uniforms = {
  /** The pointer on the surface, in the helmet's own space. */
  hit: UniformNode<"vec3", Vector3>;
  /** How far the ripple reaches from the pointer, in local units. */
  radius: UniformNode<"float", number>;
  /** Ring frequency, in rings per local unit. */
  rings: UniformNode<"float", number>;
  speed: UniformNode<"float", number>;
  /** How far the normal tilts at the strongest point. */
  amplitude: UniformNode<"float", number>;
};

/**
 * The creator, run once by `useLocalNodes`. Module level so its identity is
 * stable and the graph is not rebuilt when a Leva change re-renders
 * `Helmet`.
 *
 * `touch` is a plain uniform made here rather than in `useUniforms` because
 * the frame loop owns it. A React re-render would reset a hook-owned value
 * and the fade would flicker.
 */
function build({ uniforms }: CreatorState) {
  const u = uniforms.scope("tslNormalInject") as unknown as Uniforms;
  const touch = uniform(0);

  const normalNode = Fn(() => {
    // Where this fragment sits relative to the pointer, in local space.
    const toHit = positionLocal.sub(u.hit);
    const d = length(toHit);
    // 1 under the pointer, fading to 0 at the radius.
    const fade = float(1).sub(smoothstep(0, u.radius, d));
    // The slope of a ripple travelling outward. A cosine of the distance is
    // the derivative of the sine that would be its height.
    const slope = cos(d.mul(u.rings).sub(time.mul(u.speed)))
      .mul(u.amplitude)
      .mul(fade)
      .mul(touch);

    // The material's own answer, sampled once. It lives in view space, so
    // the radial direction has to be moved there too before they combine.
    const original = materialNormal.toVar();
    const radial = toHit
      .div(d.max(1e-4))
      .transformDirection(modelViewMatrix)
      .toVar();
    // Only the part of the radial direction that lies in the surface. Where
    // the surface curves away from the pointer the out-of-plane part would
    // lift the normal off the surface instead of tilting it.
    const inPlane = radial.sub(original.mul(radial.dot(original)));
    return original.add(inPlane.mul(slope)).normalize();
  })();

  return { normalNode, touch };
}

//* Scene ======================================================================

const MODEL = asset("/models/DamagedHelmet.glb");

function Helmet() {
  // The file has one node, named by its exporter, carrying one mesh.
  const { nodes } = useGLTF(MODEL) as unknown as {
    nodes: { "node_damagedHelmet_-6514": Mesh };
  };
  const source = nodes["node_damagedHelmet_-6514"];
  const loaded = source.material as MeshStandardMaterial;

  const values = useControls("tsl basics · normal inject", {
    inject: true,
    radius: { value: 0.35, min: 0.05, max: 1.5, step: 0.01 },
    rings: { value: 45, min: 5, max: 120, step: 1 },
    speed: { value: 6, min: 0, max: 20, step: 0.5 },
    amplitude: { value: 0.6, min: 0, max: 2, step: 0.05 },
  });

  // The same Vector3 on every render. The hook compares by identity, so it
  // never resets it, and the pointer handler below is its only writer.
  const hit = useMemo(() => new Vector3(), []);
  useUniforms({ ...values, hit }, "tslNormalInject");
  const { normalNode, touch } = useLocalNodes(build) as unknown as {
    normalNode: Node<"vec3">;
    touch: UniformNode<"float", number>;
  };

  // The promotion. Fiber creates the node material declared below empty, the
  // ref lands before layout effects run, and one `copy` carries every classic
  // property the file set across to it, textures included. The loader's own
  // material is left untouched because the loader caches and shares it.
  // Strict mode replays this, and copying twice is harmless.
  const materialRef = useRef<MeshStandardNodeMaterial>(null);
  useLayoutEffect(() => {
    materialRef.current?.copy(loaded);
  }, [loaded]);

  // Hover fades the ripple in and out. `hover` flips the target and the loop
  // eases the uniform toward it, so leaving mid-ripple lets it die in place
  // rather than cut.
  const hovering = useRef(false);
  const meshRef = useRef<Mesh>(null);
  const turntableRef = useRef<Group>(null);

  /**
   * The pointer on the surface in world units, or nothing once it has left.
   * The point goes into the mesh's own space because the helmet turns, and
   * that is what keeps the ripple stuck to the surface while the mesh
   * rotates underneath the pointer.
   */
  const hover = (point?: Vector3) => {
    hovering.current = point !== undefined;
    if (point && meshRef.current) meshRef.current.worldToLocal(hit.copy(point));
  };

  useFrame(({ delta }) => {
    const target = hovering.current ? 1 : 0;
    touch.value += (target - touch.value) * (1 - Math.exp(-8 * delta));
    if (turntableRef.current) turntableRef.current.rotation.y += delta * 0.12;
  });

  return (
    // The turntable spins in y. The mesh inside keeps the file's own
    // rotation, which stands the helmet up, so the two do not compound.
    <group ref={turntableRef}>
      <mesh
        ref={meshRef}
        geometry={source.geometry}
        quaternion={source.quaternion}
        onPointerMove={(e) => hover(e.point)}
        onPointerLeave={() => hover()}
      >
        {/* The injection is a prop. Everything else about this material
            arrives through the copy above. */}
        <meshStandardNodeMaterial
          ref={materialRef}
          normalNode={values.inject ? normalNode : null}
        />
      </mesh>
    </group>
  );
}

useGLTF.preload(MODEL);

/** The metal needs something to reflect. Generated, so nothing is fetched. */
function Studio() {
  const texture = useMemo(() => createStudioEnvironment(STUDIO_DEFAULT), []);
  useEffect(() => () => texture.dispose(), [texture]);
  return <EnvironmentMap map={texture} environmentIntensity={0.9} />;
}

export function NormalInject() {
  // No WebGPU, no experience. The shell around this decides what to show instead.
  if (useWebGPU() !== "yes") return null;

  return (
    <div className="absolute inset-0">
      <Canvas
        camera={{ position: [0.2, 0.3, 4.6], fov: 32 }}
        dpr={[1, 2]}
        renderer={{ alpha: false, antialias: true }}
      >
        <color attach="background" args={["#08080a"]} />
        <Studio />
        <directionalLight position={[3, 4, 3]} intensity={1.6} color="#fff4e0" />
        {/* The loader suspends. A promise thrown inside the Canvas is rethrown
            past it by its own fallback, which unmounts the root, so the loading
            component gets a Suspense of its own. */}
        <Suspense fallback={null}>
          <Helmet />
        </Suspense>
      </Canvas>
    </div>
  );
}
