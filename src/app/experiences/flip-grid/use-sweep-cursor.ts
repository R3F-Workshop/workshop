import { useThree } from "@react-three/fiber/webgpu";
import { useEffect, useRef, type RefObject } from "react";
import { Vector2 } from "three/webgpu";

/** Parking spot for the cursor when it is off the element. */
export const AWAY = 1e6;

/**
 * The cursor, in scene units, measured against an element's bounds.
 *
 * Kept out of the grid so the grid can be about the simulation. It hands
 * back two refs rather than state:
 * the frame loop reads them, and nothing should re-render when the mouse
 * moves.
 *
 * `pointer` is the cursor in world units, or `AWAY` on both axes when it is
 * off the element. `warped` is set when the cursor teleports, entering the
 * element or leaving it. The sweep test has to collapse to a point on those
 * frames, or the segment from "parked at infinity" to "over the grid" would
 * flip everything it crosses. The consumer clears it once it has looked.
 *
 * Not the canvas: it is `pointer-events: none` so it never steals clicks,
 * and under a shared renderer `renderer.domElement` may well be someone
 * else's.
 */
export function useSweepCursor(bounds: RefObject<HTMLElement | null>) {
  const { viewport } = useThree();
  const pointer = useRef(new Vector2(AWAY, AWAY));
  const warped = useRef(true);

  useEffect(() => {
    const el = bounds.current;
    if (!el) return;

    const onMove = (event: PointerEvent) => {
      const rect = el.getBoundingClientRect();
      const nx = ((event.clientX - rect.left) / rect.width) * 2 - 1;
      const ny = -(((event.clientY - rect.top) / rect.height) * 2 - 1);

      if (nx < -1 || nx > 1 || ny < -1 || ny > 1) {
        if (pointer.current.x !== AWAY) warped.current = true;
        pointer.current.set(AWAY, AWAY);
        return;
      }

      if (pointer.current.x === AWAY) warped.current = true;
      pointer.current.set(
        (nx * viewport.width) / 2,
        (ny * viewport.height) / 2,
      );
    };

    /**
     * Park the cursor. `pointermove` only fires while the cursor is in the
     * document, so without these the last position sticks and whatever it
     * was over stays flipped forever. Each of these is a different way to
     * lose the cursor without a final move event:
     *  - `pointerout` with no `relatedTarget`: left the document entirely.
     *  - `blur`: focus went to another window, or the OS took over.
     *  - `visibilitychange`: tab hidden, or the machine slept.
     */
    const park = () => {
      if (pointer.current.x === AWAY) return;
      pointer.current.set(AWAY, AWAY);
      warped.current = true;
    };

    const onOut = (event: PointerEvent) => {
      if (!event.relatedTarget) park();
    };
    const onVisibility = () => {
      if (document.hidden) park();
    };

    // Listen on the window rather than the element: the canvas doesn't take
    // pointer events, and on the site the copy sitting on top of it would eat
    // them before the section ever saw them.
    window.addEventListener("pointermove", onMove, { passive: true });
    document.addEventListener("pointerout", onOut);
    window.addEventListener("blur", park);
    document.addEventListener("visibilitychange", onVisibility);
    return () => {
      window.removeEventListener("pointermove", onMove);
      document.removeEventListener("pointerout", onOut);
      window.removeEventListener("blur", park);
      document.removeEventListener("visibilitychange", onVisibility);
    };
  }, [bounds, viewport.width, viewport.height]);

  return { pointer, warped };
}
