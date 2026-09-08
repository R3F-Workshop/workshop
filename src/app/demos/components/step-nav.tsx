import Link from "next/link";

import { cn } from "@/lib/utils";

/**
 * The steps of a lesson, in order, with the current one lit.
 *
 * Sits inside a demo's title plate, which takes no pointer events so it
 * never intercepts a cursor the scene is reading. The links opt back in.
 */
export function StepNav({
  steps,
  current,
}: {
  steps: { href: string; label: string }[];
  current: string;
}) {
  return (
    <nav className="mt-3 flex flex-wrap gap-2">
      {steps.map((s) => (
        <Link
          key={s.href}
          href={s.href}
          aria-current={s.href === current ? "page" : undefined}
          className={cn(
            "pointer-events-auto rounded-md border px-2 py-1 font-mono text-[10.5px] transition-colors",
            s.href === current
              ? "border-foreground/40 text-foreground"
              : "border-border text-faint hover:border-foreground/25 hover:text-foreground",
          )}
        >
          {s.label}
        </Link>
      ))}
    </nav>
  );
}
