"use client";

import { PlaceholderScene } from "@/app/home/components/canvas/placeholder-scene";
import { SectionCanvas } from "@/app/home/components/canvas/section-canvas";

/**
 * The flip grid slot as a section backdrop.
 *
 * Brings its own positioned wrapper, so the section only has to drop it in.
 * The wrapper takes no pointer events: the copy on top has to stay readable
 * and clickable, and the finished experience reads the cursor from the window
 * anyway.
 *
 * Starter: renders the placeholder. The finished experience is
 * `app/experiences/flip-grid` (still fully working at /demos/flip-grid).
 * Replace this component's body with `<FlipGrid />` to bring it back. The
 * camera here is orthographic at zoom 1, so 1 unit is about 1 px, hence the
 * placeholder's scale.
 */
export function FlipGridCanvas() {
  return (
    <div className="pointer-events-none absolute inset-0">
      <SectionCanvas
        className="absolute inset-0"
        orthographic
        camera={{ position: [0, 0, 10], zoom: 1 }}
        fps={40}
      >
        <PlaceholderScene scale={140} />
      </SectionCanvas>
    </div>
  );
}
