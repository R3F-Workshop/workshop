"use client";

import { useMemo } from "react";

import { Houses } from "./houses";
import { Stars } from "./stars";
import { sun } from "./sun";
import { Tower } from "./tower";
import { Trees } from "./trees";
import { Wordmark } from "./wordmark";

/** Groups the interactive hero objects. */
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
