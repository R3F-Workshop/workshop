import { ArrowUpRightIcon } from "lucide-react";

import { cn } from "@/lib/utils";

/**
 * "Explore this" — the link from a section to the demo its scene came from.
 *
 * Desktop only. The demo pages assume a pointer and a viewport with room for a
 * controls panel and a dialog, so offering them on a phone would be a promise
 * the other end can't keep. `hidden` also keeps it out of the accessibility
 * tree there, rather than leaving an invisible link in the tab order.
 *
 * Opens in a new tab on purpose: these are asides, and a visitor reading the
 * page should get their place back when they close it.
 */
export function ExploreLink({
  href,
  label = "Explore this demo",
  className,
}: {
  href: string;
  label?: string;
  className?: string;
}) {
  return (
    <a
      href={href}
      target="_blank"
      rel="noopener noreferrer"
      className={cn(
        "hidden items-center gap-1.5 font-mono text-[11px] tracking-[0.08em] text-faint uppercase",
        "transition-colors hover:text-foreground md:inline-flex",
        "focus-visible:ring-[3px] focus-visible:ring-ring/50 focus-visible:outline-none",
        className,
      )}
    >
      {label}
      <ArrowUpRightIcon className="size-3" aria-hidden />
    </a>
  );
}
