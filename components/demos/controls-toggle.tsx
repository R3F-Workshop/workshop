"use client";

import { SlidersHorizontal } from "lucide-react";
import { useState } from "react";

import { LevaPanel } from "@/components/three/leva-panel";
import { cn } from "@/lib/utils";

/**
 * Leva, behind a button.
 *
 * A demo page is the effect first — a panel of thirty sliders in the corner
 * reads as an unfinished tool rather than as something made on purpose. The
 * controls matter for the teaching, so they stay one click away rather than
 * always up.
 *
 * Anchored top-right, which is where Leva docks, so the button sits over the
 * panel's own corner instead of somewhere unrelated. `InfoDialog` takes the
 * opposite corner.
 *
 * The panel itself is `LevaPanel`, so there is exactly one thing on the site
 * that mounts `<Leva>` and the `?debug` gate keeps working here too. It stays
 * mounted and toggles `hidden` rather than unmounting — unmounting drops the
 * store, which would silently reset every value you had just dialled in.
 */
export function ControlsToggle({ className }: { className?: string }) {
  const [open, setOpen] = useState(false);

  return (
    <>
      <LevaPanel alwaysOpen={open} />

      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-label={open ? "Hide controls" : "Show controls"}
        aria-pressed={open}
        title={open ? "Hide controls" : "Show controls"}
        className={cn(
          "fixed top-5 right-5 z-40 grid size-9 place-items-center rounded-full",
          "border border-border bg-background/80 backdrop-blur-md",
          "transition-colors focus-visible:ring-[3px] focus-visible:ring-ring/50 focus-visible:outline-none",
          open
            ? "border-foreground/25 text-foreground"
            : "text-muted-foreground hover:border-foreground/25 hover:text-foreground",
          className,
        )}
      >
        <SlidersHorizontal className="size-4" />
      </button>
    </>
  );
}
