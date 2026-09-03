"use client";

import { Leva } from "leva";
import { useSyncExternalStore } from "react";

const subscribe = () => () => {};

/** Keeps Leva controls mounted behind the debug gate. */
export function LevaPanel({
  /** Shows controls without requiring the `?debug` query. */
  alwaysOpen = false,
}: {
  alwaysOpen?: boolean;
} = {}) {
  const debug = useSyncExternalStore(
    subscribe,
    () => new URLSearchParams(window.location.search).has("debug"),
    () => false,
  );

  const show = alwaysOpen || debug;

  return (
    <Leva hidden={!show} collapsed={!alwaysOpen} titleBar={{ title: "tune" }} />
  );
}
