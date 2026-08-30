"use client";

import { Leva } from "leva";
import { useSyncExternalStore } from "react";

const subscribe = () => () => {};

/**
 * Leva, present but out of the way.
 *
 * `useControls` spawns a panel on its own if none is mounted, which would put a
 * debug UI on a marketing page. Rendering it explicitly and hidden keeps the
 * controls wired while showing nothing — add `?debug` to the URL to open it.
 *
 * Read through `useSyncExternalStore` rather than an effect: the server has no
 * URL to read, and a `setState` in an effect trips `react-hooks/set-state-in-effect`.
 */
export function LevaPanel({
  /** For pages whose whole point is the controls — skips the `?debug` gate. */
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
