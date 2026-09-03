import { ArrowUpRightIcon } from "lucide-react";

import { cn } from "@/lib/utils";

/** Links a section to its standalone demo. */
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
