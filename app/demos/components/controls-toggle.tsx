"use client";

import { SlidersHorizontal } from "lucide-react";
import { useState } from "react";

import { LevaPanel } from "@/components/leva-panel";
import { cn } from "@/lib/utils";

/** Toggles the Leva controls panel. */
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
