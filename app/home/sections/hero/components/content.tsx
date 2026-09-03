"use client";

import { useMemo } from "react";

import { Houses } from "./houses";
import { Stars } from "./stars";
import { sun } from "./sun";
import { Tower } from "./tower";
import { Trees } from "./trees";
import { Wordmark } from "./wordmark";

/**
 * Things to play with. Everything here reads the same `hour`.
 *
 * Launch animation goes here. The pro version grows the city in over six
 * seconds with a shared intro clock (`resources/tower-scene/intro.tsx`) that
 * every instanced mesh reads on the GPU through a `positionNode`
 * (`resources/tower-scene/buildings.tsx`, `useBuildPosition`). The simple
 * version is static; a `useFrame` that scales the instances up by `delta` is
 * the afternoon's first stretch.
 */
export function Content({
  hour,
  treeCount,
  houseCount,
}: {
  hour: number;
  treeCount?: number;
  houseCount?: number;
}) {
  const { lightLevel } = useMemo(() => sun(hour), [hour]);

  return (
    <>
      <Tower lightLevel={lightLevel} />
      <Trees count={treeCount} />
      <Houses count={houseCount} />
      <Wordmark />
      <Stars lightLevel={lightLevel} />
    </>
  );
}
