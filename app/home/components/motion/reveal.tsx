"use client";

import { useEffect, useRef, type ReactNode } from "react";

import { cn } from "@/lib/utils";

/**
 * Scroll reveal, one observer for the whole page.
 *
 * `RevealGroup` doesn't animate anything itself — it finds the `[data-reveal]`
 * elements underneath it, numbers them for the stagger, and hands them to a
 * shared IntersectionObserver. Children stay plain server-rendered markup with
 * one attribute on them, so this works inside `.map()` and costs no per-item
 * hook, ref, or wrapper element.
 *
 *   <RevealGroup className="grid gap-5">
 *     {items.map((item) => <Card key={item.id} data-reveal>…</Card>)}
 *   </RevealGroup>
 *
 * The hidden state lives in CSS behind `@media (scripting: enabled)`, so markup
 * still renders visible when scripting is off. See `app/globals.css`.
 */

const OPTIONS: IntersectionObserverInit = {
  threshold: 0.18,
  // Hold the reveal until the element is a little way up the viewport, rather
  // than firing the instant its top edge appears.
  rootMargin: "0px 0px -10% 0px",
};

/** Longest stagger we'll ever queue: 6 items × 60ms. Past that it reads as lag. */
const MAX_STAGGER_INDEX = 5;

let shared: IntersectionObserver | null = null;

function observer() {
  shared ??= new IntersectionObserver((entries, io) => {
    for (const entry of entries) {
      if (!entry.isIntersecting) continue;
      (entry.target as HTMLElement).dataset.reveal = "in";
      // Reveal is one-way — content never re-hides on the way back up.
      io.unobserve(entry.target);
    }
  }, OPTIONS);
  return shared;
}

export function RevealGroup({
  className,
  children,
}: {
  className?: string;
  children: ReactNode;
}) {
  const ref = useRef<HTMLDivElement>(null);

  // Server-component updates can replace reveal targets without remounting
  // this client boundary. Re-register them whenever its children change so
  // Fast Refresh does not leave new elements in the hidden CSS state.
  useEffect(() => {
    const root = ref.current;
    if (!root) return;

    const targets = Array.from(
      root.querySelectorAll<HTMLElement>("[data-reveal]"),
    );

    // Reduced motion is not a gentler animation, it's no animation: paint the
    // final state and never observe anything.
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
      for (const el of targets) el.dataset.reveal = "in";
      return;
    }

    const io = observer();
    targets.forEach((el, i) => {
      el.style.setProperty("--i", String(Math.min(i, MAX_STAGGER_INDEX)));
      io.observe(el);
    });

    return () => {
      for (const el of targets) io.unobserve(el);
    };
  }, [children]);

  return (
    <div ref={ref} className={cn(className)}>
      {children}
    </div>
  );
}
