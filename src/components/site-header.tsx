"use client";

import { Logo } from "@/components/brand/logo";
import { Button } from "@/components/ui/button";
import { HERO, REGISTER_URL } from "@/lib/content";
import { useScrollSpy } from "@/lib/use-scroll-spy";
import { cn } from "@/lib/utils";

export function SiteHeader() {
  const { shown, progress } = useScrollSpy();

  return (
    <header
      data-site-header
      data-site-header-state="out"
      className={cn(
        "fixed inset-x-0 top-0 z-50 overflow-hidden border-b transition-[background-color,border-color,backdrop-filter] duration-500",
        shown
          ? "border-border bg-black/70 backdrop-blur-xl"
          : "border-transparent bg-transparent",
      )}
    >
      {/* Slides in left -> right while it fades. Tailwind v4 translate-*
          utilities write the `translate` property, not `transform` — the
          transition has to name `translate` or the move snaps in one frame. */}
      <span
        aria-hidden={!shown}
        className={cn(
          "pointer-events-none absolute top-9 right-28 left-[3.375rem] z-10 block -translate-y-1/2 overflow-hidden text-ellipsis whitespace-nowrap text-[13px] font-medium tracking-[-0.01em] text-[#8a8a8a] transition-[opacity,translate] duration-500 ease-out sm:right-32 sm:left-[4.375rem]",
          shown
            ? "translate-x-0 opacity-100"
            : "-translate-x-3 opacity-0",
        )}
      >
        {HERO.title.join(" ")}
      </span>

      <div className="site-header-content flex min-h-[72px] items-center justify-between gap-5 px-4 py-3.5 transition-opacity duration-700 ease-out sm:px-8">
        <a
          href="https://pmnd.rs/"
          aria-label="Visit pmnd.rs"
          className="shrink-0 transition-opacity hover:opacity-70"
        >
          <Logo color="currentColor" className="size-6 shrink-0" />
        </a>

        <Button
          asChild
          size="sm"
          className={cn(
            "h-11 px-5 text-sm transition-shadow duration-500 sm:h-8 sm:px-4 sm:text-[0.8rem]",
            shown
              ? "shadow-none"
              : "shadow-[0_0_24px_rgba(255,255,255,0.2)]",
          )}
        >
          <a href={REGISTER_URL} target="_blank" rel="noopener noreferrer">
            Register
          </a>
        </Button>
      </div>

      {/* Continuous page progress without section markers. */}
      <div
        className={cn(
          "relative h-0.5 bg-border transition-[opacity,translate] duration-500",
          shown
            ? "translate-y-0 opacity-100"
            : "translate-y-0.5 opacity-0",
        )}
      >
        <div
          className="absolute inset-y-0 left-0 bg-foreground"
          style={{ width: `${(progress * 100).toFixed(2)}%` }}
        />
      </div>
    </header>
  );
}
