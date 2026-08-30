/**
 * Coordinates the loading overlay and WebGPU hero.
 *
 * Normal path:
 * warming -> priming-intro -> revealing-intro -> armed -> playing -> settled
 *
 * Bypass paths settle on the final pose without rewinding visible animation.
 */
export type HeroGateState =
  | "warming"
  | "priming-intro"
  | "priming-final"
  | "revealing-intro"
  | "revealing-final"
  | "armed"
  | "playing"
  | "settled";

export type HeroGateEvent =
  | { type: "WARMUP_FINISHED"; replayIntro: boolean }
  | { type: "POSE_RENDERED" }
  | { type: "OVERLAY_EXITED" }
  | { type: "BEAT_ELAPSED" }
  | { type: "INTRO_FINISHED" }
  | { type: "BYPASS" };

/** Returns the next state without performing side effects. */
export function transitionHeroGate(
  state: HeroGateState,
  event: HeroGateEvent,
): HeroGateState {
  switch (event.type) {
    case "WARMUP_FINISHED":
      if (state !== "warming") return state;
      return event.replayIntro ? "priming-intro" : "revealing-final";

    case "POSE_RENDERED":
      if (state === "priming-intro") return "revealing-intro";
      if (state === "priming-final") return "revealing-final";
      return state;

    case "OVERLAY_EXITED":
      if (state === "revealing-intro") return "armed";
      if (state === "revealing-final") return "settled";
      return state;

    case "BEAT_ELAPSED":
      return state === "armed" ? "playing" : state;

    case "INTRO_FINISHED":
      return state === "playing" ? "settled" : state;

    case "BYPASS":
      // Warmup already holds the final pose.
      if (state === "warming") return "revealing-final";
      // Confirm the final pose before revealing it.
      if (state === "priming-intro") return "priming-final";
      // Preserve the overlay fade and settle on the final pose.
      if (state === "revealing-intro") return "revealing-final";
      if (state === "armed" || state === "playing") return "settled";
      return state;
  }
}

export function heroGateCanRevealOverlay(state: HeroGateState) {
  return state === "revealing-intro" || state === "revealing-final";
}

export function heroGateOverlayHasExited(state: HeroGateState) {
  return state === "armed" || state === "playing" || state === "settled";
}

type Listener = (state: HeroGateState) => void;

export interface HeroGateController {
  getState: () => HeroGateState;
  subscribe: (listener: Listener) => () => void;
  warmupFinished: (replayIntro: boolean) => void;
  poseRendered: () => void;
  overlayExited: () => void;
  beatElapsed: () => void;
  introFinished: () => void;
  bypass: () => void;
}

let state: HeroGateState = "warming";
const listeners = new Set<Listener>();

function send(event: HeroGateEvent) {
  const next = transitionHeroGate(state, event);
  if (next === state) return;

  state = next;
  for (const listener of listeners) listener(state);
}

export const heroGate: HeroGateController = {
  getState: () => state,
  subscribe(listener) {
    listeners.add(listener);
    return () => listeners.delete(listener);
  },
  warmupFinished: (replayIntro) =>
    send({ type: "WARMUP_FINISHED", replayIntro }),
  poseRendered: () => send({ type: "POSE_RENDERED" }),
  overlayExited: () => send({ type: "OVERLAY_EXITED" }),
  beatElapsed: () => send({ type: "BEAT_ELAPSED" }),
  introFinished: () => send({ type: "INTRO_FINISHED" }),
  bypass: () => send({ type: "BYPASS" }),
};
