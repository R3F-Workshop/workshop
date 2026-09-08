"use client";

import { useEffect, useState } from "react";

import { cn } from "@/lib/utils";

/**
 * The section list with the one in view lit.
 *
 * A chip row that sticks under the header on a phone, a rail that sticks
 * beside the content on a wide screen. Which section is current is read off
 * scroll position rather than an observer: the last heading above a line a
 * third of the way down the viewport wins, so a short final section can still
 * be reached.
 */
export function Toc({ items }: { items: { id: string; title: string }[] }) {
  const [active, setActive] = useState(items[0]?.id);

  useEffect(() => {
    let queued = false;

    const measure = () => {
      queued = false;
      const line = window.innerHeight * 0.33;
      let current = items[0]?.id;
      for (const { id } of items) {
        const el = document.getElementById(id);
        if (el && el.getBoundingClientRect().top <= line) current = id;
      }
      setActive(current);
    };

    const onScroll = () => {
      if (queued) return;
      queued = true;
      requestAnimationFrame(measure);
    };

    window.addEventListener("scroll", onScroll, { passive: true });
    window.addEventListener("resize", onScroll);
    onScroll();

    return () => {
      window.removeEventListener("scroll", onScroll);
      window.removeEventListener("resize", onScroll);
    };
  }, [items]);

  return (
    <nav aria-label="Sections">
      <div className="eyebrow hidden lg:block">Contents</div>
      <ol className="-mx-5 flex gap-2 overflow-x-auto px-5 contain-inline-size sm:-mx-8 sm:px-8 lg:mx-0 lg:mt-3 lg:flex-col lg:gap-0 lg:overflow-visible lg:px-0">
        {items.map((item, i) => {
          const current = item.id === active;
          return (
            <li key={item.id} className="shrink-0">
              <a
                href={`#${item.id}`}
                aria-current={current ? "location" : undefined}
                className={cn(
                  "flex items-baseline gap-2.5 rounded-md border px-2.5 py-1.5 font-mono text-[11px] whitespace-nowrap transition-colors",
                  "lg:rounded-none lg:border-0 lg:border-l lg:px-3.5 lg:py-2 lg:font-sans lg:text-[13.5px] lg:tracking-[-0.01em]",
                  current
                    ? "border-foreground/40 text-foreground lg:border-foreground"
                    : "border-border text-faint hover:text-foreground lg:border-border lg:text-muted-foreground",
                )}
              >
                <span className="font-mono text-[10px] tracking-[0.08em] text-faint">
                  {String(i + 1).padStart(2, "0")}
                </span>
                {item.title}
              </a>
            </li>
          );
        })}
      </ol>
    </nav>
  );
}
