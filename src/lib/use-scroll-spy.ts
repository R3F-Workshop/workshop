"use client";

import { useEffect, useState } from "react";

export interface ScrollSpy {
  /** Header is revealed once the hero poster is mostly scrolled past. */
  shown: boolean;
  /** Document scroll progress, 0..1. */
  progress: number;
}

const INITIAL: ScrollSpy = { shown: false, progress: 0 };
const clamp01 = (value: number) => Math.min(1, Math.max(0, value));

export function useScrollSpy(): ScrollSpy {
  const [state, setState] = useState<ScrollSpy>(INITIAL);

  useEffect(() => {
    let queued = false;

    const measure = () => {
      queued = false;

      const doc = document.documentElement;
      const vh = window.innerHeight;
      const y = window.scrollY || doc.scrollTop || 0;
      const total = Math.max(1, doc.scrollHeight - vh);

      // The hero grade and pinned dial share this already-throttled scroll
      // measurement instead of registering another listener. The title and
      // description stay in normal flow so they move together at the same rate.
      const hero = document.getElementById("top");
      if (hero) {
        const reducedMotion = window.matchMedia(
          "(prefers-reduced-motion: reduce)",
        ).matches;
        const heroRect = hero.getBoundingClientRect();
        let dialOpacity = 1;
        let sceneGradeOpacity = 0;

        if (!reducedMotion) {
          const localScroll = Math.max(0, -heroRect.top);
          const fadeDistance = Math.max(160, Math.min(320, vh * 0.35));
          dialOpacity = 1 - clamp01(localScroll / fadeDistance);
          const gradeDistance = Math.max(260, vh * 0.5);
          sceneGradeOpacity = clamp01(localScroll / gradeDistance) * 0.97;
        }

        hero.style.setProperty(
          "--hero-dial-opacity",
          dialOpacity.toFixed(4),
        );
        hero.style.setProperty(
          "--hero-scene-grade-opacity",
          sceneGradeOpacity.toFixed(4),
        );

        const dial = hero.querySelector<HTMLElement>("[data-hero-dial]");
        const dialIsAvailable = reducedMotion || dialOpacity > 0.02;
        if (dial) {
          dial.toggleAttribute("inert", !dialIsAvailable);
          if (dialIsAvailable) dial.removeAttribute("aria-hidden");
          else dial.setAttribute("aria-hidden", "true");
        }
      }

      setState({
        shown: y > Math.max(400, vh) * 0.55,
        progress: Math.min(1, y / total),
      });
    };

    const onScroll = () => {
      if (queued) return;
      queued = true;
      requestAnimationFrame(measure);
    };

    window.addEventListener("scroll", onScroll, { passive: true });
    window.addEventListener("resize", onScroll);
    measure();

    // Sections shift as webfonts land; re-measure once things settle.
    const settle = window.setTimeout(measure, 400);

    return () => {
      window.removeEventListener("scroll", onScroll);
      window.removeEventListener("resize", onScroll);
      window.clearTimeout(settle);
    };
  }, []);

  return state;
}
