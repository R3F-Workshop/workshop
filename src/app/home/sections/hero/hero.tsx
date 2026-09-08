"use client";

import dynamic from "next/dynamic";
import { useEffect } from "react";

import { Logo } from "@/components/brand/logo";
import {
  DecoratedText,
  HighlightedText,
} from "@/app/home/components/decorated-text";
import { RevealGroup } from "@/app/home/components/motion/reveal";
import { Instructors } from "@/app/home/sections/instructors/instructors";
import { HERO, REGISTER_URL } from "@/lib/content";
import { skyGradient, todAt } from "@/lib/time-of-day";

import { VanillaPyramid } from "@/app/experiences/vanilla-pyramid";

// Only here for the vanilla morning. When the hero moves to R3F, swap the two
// components below for `<ParisHeroR3f />` from `@/app/experiences/paris-hero-r3f`
// and delete `./primary-canvas-stub.tsx`.
const PrimaryCanvasStub = dynamic(
  () => import("./primary-canvas-stub").then((m) => m.PrimaryCanvasStub),
  { ssr: false },
);

/**
 * The sky behind the canvas, frozen at the dusk the finished hero boots into.
 * The full site drives this through the time dial (`./time-dial.tsx`, kept
 * here ready to wire back in) and a replay spring — see
 * `src/app/experiences/paris-tower/site-hero.tsx`.
 */
const DUSK = todAt(0.85);

/**
 * The starter hero: the same DOM as the finished site, with the scene layer
 * swapped for the vanilla three.js pyramid. The finished version's entrance
 * choreography (loading gate, staggered UI reveal, time dial + replay spring)
 * comes back with the real scene, see `src/app/experiences/paris-tower/site-hero.tsx`.
 * Here the header is simply switched on once the page mounts.
 */
export function Hero() {
  useEffect(() => {
    const header = document.querySelector<HTMLElement>("[data-site-header]");
    if (header) header.dataset.siteHeaderState = "in";
  }, []);

  return (
    <section id="top" className="relative bg-background">
      <div className="grid">
        {/* The scene stays pinned while the second hero beat scrolls over it. */}
        <div className="sticky top-0 col-start-1 row-start-1 h-svh min-h-[500px] self-start overflow-hidden">
          <div
            className="absolute inset-0"
            style={{ background: skyGradient(DUSK) }}
          />

          <div className="absolute inset-0 z-20">
            <VanillaPyramid />
            <PrimaryCanvasStub />
          </div>

          {/* The pmndrs mark, floated above the pyramid. */}
          <div
            className="pointer-events-none absolute inset-x-0 z-20 flex justify-center"
            style={{ top: "clamp(72px, 16vh, 160px)" }}
          >
            <Logo
              color="white"
              className="h-14 w-14 opacity-90 sm:h-16 sm:w-16"
            />
          </div>

          {/* Grounds the poster copy without swallowing the scene. */}
          <div className="pointer-events-none absolute inset-x-0 bottom-0 z-20 h-[280px] bg-gradient-to-b from-transparent via-black/50 to-black/90" />

          {/* Scroll adds a duskier, warmer grade as the copy takes over. */}
          <div className="hero-scroll-grade pointer-events-none absolute inset-0 z-[25]" />
        </div>

        <div className="relative z-30 col-start-1 row-start-1">
          <div className="relative z-10 flex h-svh min-h-[500px] flex-col">
            <div className="mt-auto px-4 pb-6 sm:px-8">
              <div className="max-w-2xl">
                <div className="mb-3.5 font-mono text-[11px] font-medium tracking-[0.13em] text-white/60 uppercase">
                  {HERO.kicker}
                </div>
                <h1
                  className="font-bold tracking-[-0.035em] text-white"
                  style={{
                    fontSize: "clamp(34px, 5.4vw, 58px)",
                    lineHeight: 1.02,
                  }}
                >
                  {HERO.title[0]}
                  <br />
                  {HERO.title[1]}
                </h1>
              </div>
            </div>
          </div>

          <div className="relative isolate px-4 pt-8 pb-8 sm:px-8 sm:pt-12 sm:pb-12 lg:pt-16">
            <div className="pointer-events-none absolute inset-x-0 -top-40 bottom-0 z-0 bg-gradient-to-b from-transparent via-black/90 via-30% to-black" />

            <RevealGroup className="relative z-10 mx-auto max-w-[1180px]">
              <h2
                className="max-w-[860px] text-[24px] leading-[1.25] font-medium tracking-[-0.025em] text-white sm:text-[30px] lg:text-[36px]"
                data-reveal
              >
                <DecoratedText
                  text={HERO.description}
                  phrases={["three.js conf"]}
                  decorate={(phrase) => (
                    <a
                      href={REGISTER_URL}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="underline decoration-white/35 underline-offset-[0.16em] transition-colors hover:decoration-white/80 focus-visible:rounded-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/70"
                    >
                      {phrase}
                    </a>
                  )}
                />
              </h2>

              <div className="mt-14 border-t border-white/25 sm:mt-18">
                {HERO.days.map((day) => (
                  <article
                    key={day.label}
                    className="grid gap-4 border-b border-white/20 py-7 sm:grid-cols-[140px_minmax(0,1fr)] sm:gap-8 lg:py-9"
                    data-reveal
                  >
                    <h3 className="font-mono text-[11px] font-medium tracking-[0.14em] text-white/50 uppercase">
                      {day.label}
                    </h3>
                    <p className="max-w-[760px] text-base leading-[1.6] text-white/70 sm:text-lg">
                      <HighlightedText
                        text={day.body}
                        phrases={day.highlights}
                      />
                    </p>
                  </article>
                ))}
              </div>

              <Instructors />
            </RevealGroup>
          </div>
        </div>
      </div>
    </section>
  );
}
