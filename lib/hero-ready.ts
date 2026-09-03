"use client";

import { useSyncExternalStore } from "react";

/**
 * One bit, shared: has the hero rendered?
 *
 * The scene sets it (from inside the canvas, once its shaders have compiled),
 * the loading screen and the header read it. A tiny external store rather
 * than context because the two sides live in different React trees.
 */

let ready = false;
const listeners = new Set<() => void>();

export const heroReady = {
  get: () => ready,
  set() {
    if (ready) return;
    ready = true;
    for (const listener of listeners) listener();
  },
  subscribe(listener: () => void) {
    listeners.add(listener);
    return () => {
      listeners.delete(listener);
    };
  },
};

export function useHeroReady(): boolean {
  return useSyncExternalStore(heroReady.subscribe, heroReady.get, () => false);
}
