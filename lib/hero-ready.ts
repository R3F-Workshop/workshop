"use client";

import { useSyncExternalStore } from "react";

/** One bit, shared: has the hero rendered? */

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
