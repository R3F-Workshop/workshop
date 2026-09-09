"use client";

import { useCallback } from "react";
import { color, mix, positionLocal } from "three/tsl";
import { useLocalNodes, useNodes } from "@react-three/fiber/webgpu";

/**
 * Two readers of the `tslMix` scope, one for each way of reading it.
 *
 * `Box` calls `useNodes` with the same scope and the same builder as the
 * subject. `useNodes` keeps whatever a scope already holds under a name, so
 * whichever of the two renders first fills the scope and the other's
 * `surface` is built, set aside, and replaced by the one already there. The
 * subject renders first, so the box gets the subject's graph back. Writing
 * the builder out keeps the box honest about what it expects to find, and
 * the file still works if the two ever swap order, provided the uniforms the
 * builder reads have been registered.
 *
 * `Pyramid` calls `useLocalNodes`. Nothing it makes goes into the store. Its
 * creator reads the shared `surface` out of `nodes.tslMix` and the `blend`
 * dial out of `uniforms.tslMix`, then wraps them in a graph
 * of its own. Both scopes are reachable from every creator, so a local graph
 * can build on a shared one.
 *
 * The creator is wrapped in `useCallback` because `useLocalNodes` memoises
 * on the creator's identity. An inline arrow would be a new function on
 * every render and the graph would be rebuilt each time.
 */

export function Box() {
  const nodes = useNodes(({ uniforms }) => {
    const u = uniforms.tslMix;
    return { surface: mix(u.colorA, u.colorB, u.blend) };
  }, "tslMix");

  return (
    <mesh castShadow receiveShadow position={[-2.4, 0.6, 0]} rotation-y={0.35}>
      <boxGeometry args={[1.2, 1.2, 1.2]} />
      <meshStandardNodeMaterial colorNode={nodes.surface} roughness={0.55} />
    </mesh>
  );
}

export function Pyramid() {
  const nodes = useLocalNodes(
    useCallback(({ nodes, uniforms }) => {
      const shared = nodes.tslMix;
      const u = uniforms.tslMix;
      // The cone is 1.4 tall and centred, so local y runs from -0.7 to 0.7.
      // This puts 0 at the base and 1 at the apex.
      const height = positionLocal.y.div(1.4).add(0.5);
      // The shared surface at the base, fading to a fixed chalk toward the
      // apex. The blend dial sets how far up the fade reaches, so the same
      // slider moves this mesh differently from the other two.
      return {
        colorNode: mix(shared.surface, color("#f1ede4"), height.mul(u.blend)),
      };
    }, []),
  );

  return (
    <mesh castShadow receiveShadow position={[2.4, 0.7, 0]} rotation-y={Math.PI / 4}>
      <coneGeometry args={[0.9, 1.4, 4]} />
      <meshStandardNodeMaterial colorNode={nodes.colorNode} roughness={0.55} />
    </mesh>
  );
}
