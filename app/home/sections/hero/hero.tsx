"use client";

import dynamic from "next/dynamic";
import { Fragment, useEffect, useState, type ReactNode } from "react";

import { RevealGroup } from "@/app/home/components/motion/reveal";
import { TimeDial } from "@/app/home/sections/hero/time-dial";
import { Instructors } from "@/app/home/sections/instructors/instructors";
import { HERO, REGISTER_URL } from "@/lib/content";
import { useHeroReady } from "@/lib/hero-ready";
import { skyGradient, todAt } from "@/lib/time-of-day";

// Keep the WebGPU scene out of SSR and the server bundle.
const HeroScene = dynamic(
  () => import("./hero-scene").then((m) => m.HeroScene),
  { ssr: false },
);

/** The dial counts 0–100 around a day: the scene wants hours. */
const DAY_CYCLE = 100;
/** Dusk. */
const INITIAL_DIAL = 78;
const wrap = (v: number) => ((v % DAY_CYCLE) + DAY_CYCLE) % DAY_CYCLE;

function DecoratedText({
  text,
  phrases,
  decorate,
}: {
  text: string;
  phrases: readonly string[];
  decorate: (phrase: string) => ReactNode;
}) {
  if (phrases.length === 0) return text;

  const escapedPhrases = phrases.map((phrase) =>
    phrase.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"),
  );
  const phrasePattern = new RegExp(`(${escapedPhrases.join("|")})`, "g");

  return text.split(phrasePattern).map((segment, index) =>
    phrases.includes(segment) ? (
      <Fragment key={`${segment}-${index}`}>{decorate(segment)}</Fragment>
    ) : (
      segment
    ),
  );
}

function HighlightedText({
  text,
  phrases,
}: {
  text: string;
  phrases: readonly string[];
}) {
  return (
    <DecoratedText
      text={text}
      phrases={phrases}
      decorate={(phrase) => (
        <span className="font-medium text-white">{phrase}</span>
      )}
    />
  );
}

export function Hero() {
  const [dial, setDial] = useState(INITIAL_DIAL);
  const hour = (wrap(dial) / DAY_CYCLE) * 24;
  const palette = todAt(wrap(dial) / DAY_CYCLE);

  // The header stays hidden until the scene is up, then fades in.
  const ready = useHeroReady();
  useEffect(() => {
    if (!ready) return;
    const header = document.querySelector<HTMLElement>("[data-site-header]");
    if (header) header.dataset.siteHeaderState = "in";
  }, [ready]);

  return (
    <section id="top" className="relative bg-background">
      <div className="grid">
        {/* The scene stays pinned while the second hero beat scrolls over it. */}
        <div className="sticky top-0 col-start-1 row-start-1 h-svh min-h-[500px] self-start overflow-hidden">
          {/* Covers the canvas while its shaders compile. */}
          <div
            className="absolute inset-0"
            style={{ background: skyGradient(palette) }}
          />

          <div className="absolute inset-0 z-20">
            <HeroScene hour={hour} />
          </div>

          {/* Grounds the poster copy without swallowing the city. */}
          <div className="pointer-events-none absolute inset-x-0 bottom-0 z-20 h-[280px] bg-gradient-to-b from-transparent via-black/50 to-black/90" />

          {/* Scroll adds a duskier, warmer grade as the copy takes over. */}
          <div className="hero-scroll-grade pointer-events-none absolute inset-0 z-[25]" />
        </div>

        {/* The dial alone stays pinned to the hero and fades on scroll. */}
        <div className="hero-dial-layer pointer-events-none sticky top-0 z-40 col-start-1 row-start-1 h-svh min-h-[500px] self-start">
          <div className="hero-scroll-dial pointer-events-auto absolute right-4 bottom-6 sm:right-8">
            <TimeDial
              value={dial}
              onValueChange={setDial}
              aria-label="Time of day"
            />
          </div>
        </div>

        {/* The copy layer lets the pointer through to the scene beneath it: only the parts you can actually interact with take it back. */}
        <div className="pointer-events-none relative z-30 col-start-1 row-start-1">
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

          <div className="pointer-events-auto relative isolate px-4 pt-8 pb-8 sm:px-8 sm:pt-12 sm:pb-12 lg:pt-16">
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
