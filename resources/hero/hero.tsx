"use client";

import dynamic from "next/dynamic";
import {
  Fragment,
  memo,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type AnimationEvent as ReactAnimationEvent,
  type ReactNode,
} from "react";

import { RevealGroup } from "@/components/motion/reveal";
import { TimeDial } from "@/components/hero/time-dial";
import { Instructors } from "@/components/sections/instructors";
import { HERO, REGISTER_URL } from "@/lib/content";
import { skyGradient, todAt } from "@/lib/time-of-day";

// WebGPU has no business running during SSR, and the scene is the heaviest
// thing on the page — keep it out of the server bundle entirely.
//
// This is the verified tower pipeline from the lab (`/demos/paris-hero`), not
// the old low-poly `ParisScene`. The DOM wordmark sandwich is retired with it:
// the sky paints every canvas pixel once loaded, and the PMNDRS lettering now
// lives *inside* the scene, billboarded through the ironwork.
const TowerHero = dynamic(
  () => import("./tower-hero").then((m) => m.TowerHero),
  { ssr: false },
);

const DAY_CYCLE = 100;
const INITIAL_TIME_OF_DAY = 85;
/** Replay limits keep expensive atmosphere updates smooth on missed frames. */
const REPLAY_UNITS_PER_SECOND = 42;
const REPLAY_SPRING_STIFFNESS = 144;
const REPLAY_SPRING_DAMPING = 28;
const REPLAY_MAX_UNITS_PER_FRAME = 0.7;
const REPLAY_POSITION_EPSILON = 0.005;
const REPLAY_VELOCITY_EPSILON = 0.02;
const MAX_FRAME_MS = 40;

const wrapTimeOfDay = (value: number) =>
  ((value % DAY_CYCLE) + DAY_CYCLE) % DAY_CYCLE;

/** Drops completed turns that cannot change the cyclic scene state. */
const collapseCompletedTurns = (next: number, current: number) =>
  next - Math.trunc((next - current) / DAY_CYCLE) * DAY_CYCLE;

/**
 * Replays unwrapped dial input as an overdamped spring. Velocity survives
 * target changes, while the per-frame cap prevents a slow atmosphere frame
 * from becoming a visible jump. Completed turns are visually identical, so
 * they are collapsed before they can build an unbounded replay backlog.
 */
function useTimeOfDayReplay(initial: number, instant: boolean) {
  const [value, setValue] = useState(initial);
  const state = useRef({
    value: initial,
    target: initial,
    velocity: 0,
    lastFrame: 0,
    frame: 0,
  });

  const step = useCallback(function replayFrame(now: number) {
    const s = state.current;
    const seconds = Math.min(now - s.lastFrame, MAX_FRAME_MS) / 1000;
    s.lastFrame = now;
    const distance = s.target - s.value;

    if (
      Math.abs(distance) <= REPLAY_POSITION_EPSILON &&
      Math.abs(s.velocity) <= REPLAY_VELOCITY_EPSILON
    ) {
      s.value = s.target;
      s.velocity = 0;
    } else if (seconds > 0) {
      const acceleration =
        REPLAY_SPRING_STIFFNESS * distance -
        REPLAY_SPRING_DAMPING * s.velocity;
      s.velocity += acceleration * seconds;

      // At lower render rates the frame-distance limit also lowers velocity,
      // keeping the spring continuous instead of clamping its position later.
      const frameSpeedLimit = Math.min(
        REPLAY_UNITS_PER_SECOND,
        REPLAY_MAX_UNITS_PER_FRAME / seconds,
      );
      s.velocity = Math.max(
        -frameSpeedLimit,
        Math.min(frameSpeedLimit, s.velocity),
      );
      s.value += s.velocity * seconds;
    }

    setValue(s.value);
    if (
      Math.abs(s.target - s.value) > REPLAY_POSITION_EPSILON ||
      Math.abs(s.velocity) > REPLAY_VELOCITY_EPSILON
    ) {
      s.frame = requestAnimationFrame(replayFrame);
    } else {
      s.frame = 0;
    }
  }, []);

  const enqueue = useCallback(
    (next: number) => {
      const s = state.current;
      if (instant) {
        cancelAnimationFrame(s.frame);
        s.frame = 0;
        s.target = next;
        s.value = next;
        s.velocity = 0;
        setValue(next);
        return;
      }

      const target = collapseCompletedTurns(next, s.value);
      if (Math.abs(target - s.target) < Number.EPSILON) return;
      s.target = target;

      if (!s.frame) {
        s.lastFrame = performance.now();
        s.frame = requestAnimationFrame(step);
      }
    },
    [instant, step],
  );

  useEffect(() => {
    if (!instant) return;
    const s = state.current;
    cancelAnimationFrame(s.frame);
    s.frame = 0;
    s.value = s.target;
    s.velocity = 0;
    setValue(s.target);
  }, [instant]);

  useEffect(() => {
    const s = state.current;
    return () => {
      cancelAnimationFrame(s.frame);
      s.frame = 0;
    };
  }, []);

  return { value, enqueue };
}

const HeroTimeDial = memo(function HeroTimeDial({
  onValueChange,
}: {
  onValueChange: (value: number) => void;
}) {
  const [value, setValue] = useState(INITIAL_TIME_OF_DAY);
  const handleValueChange = useCallback(
    (next: number) => {
      setValue(next);
      onValueChange(next);
    },
    [onValueChange],
  );

  return (
    <div
      data-hero-ui
      data-hero-ui-step="3"
      data-hero-dial
      className="pointer-events-auto absolute right-4 bottom-6 sm:right-8"
    >
      <div className="hero-scroll-dial">
        <TimeDial
          value={value}
          onValueChange={handleValueChange}
          aria-label="Time of day"
        />
      </div>
    </div>
  );
});

function TimeOfDayExperience({
  reducedMotion,
  onScreen,
  onUiReveal,
}: {
  reducedMotion: boolean;
  onScreen: boolean;
  onUiReveal: () => void;
}) {
  const { value: tod, enqueue } = useTimeOfDayReplay(
    INITIAL_TIME_OF_DAY,
    reducedMotion,
  );
  const palette = useMemo(() => todAt(tod / DAY_CYCLE), [tod]);

  return (
    <>
      {/* The scene stays pinned while the second hero beat scrolls over it. */}
      <div className="sticky top-0 col-start-1 row-start-1 h-svh min-h-[500px] self-start overflow-hidden">
        {/* Covers the canvas while its shaders compile. */}
        <div
          className="absolute inset-0"
          style={{ background: skyGradient(palette) }}
        />

        <div className="absolute inset-0 z-20">
          <TowerHero
            value={wrapTimeOfDay(tod)}
            reducedMotion={reducedMotion}
            paused={!onScreen}
            onUiReveal={onUiReveal}
          />
        </div>

        {/* Grounds the poster copy without swallowing the city. */}
        <div className="pointer-events-none absolute inset-x-0 bottom-0 z-20 h-[280px] bg-gradient-to-b from-transparent via-black/50 to-black/90" />

        {/* Scroll adds a duskier, warmer grade as the copy takes over. */}
        <div className="hero-scroll-grade pointer-events-none absolute inset-0 z-[25]" />
      </div>

      {/* The dial alone stays pinned to the hero and fades on scroll. */}
      <div className="hero-dial-layer pointer-events-none sticky top-0 z-40 col-start-1 row-start-1 h-svh min-h-[500px] self-start">
        <HeroTimeDial onValueChange={enqueue} />
      </div>
    </>
  );
}

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
  const [reducedMotion, setReducedMotion] = useState(false);
  const [onScreen, setOnScreen] = useState(true);
  const sectionRef = useRef<HTMLElement>(null);
  // The scene's frame callback only flips one DOM attribute. Keeping this cue
  // outside React avoids reconciling the entire hero during a busy GPU frame.
  const revealUi = useCallback(() => {
    const root = sectionRef.current;
    if (root?.dataset.heroUiState === "out") {
      root.dataset.heroUiState = "in";
    }

    const header = document.querySelector<HTMLElement>("[data-site-header]");
    if (header?.dataset.siteHeaderState === "out") {
      header.dataset.siteHeaderState = "in";
    }
  }, []);

  const settleUiLayers = useCallback(
    (event: ReactAnimationEvent<HTMLElement>) => {
      const target = event.target;
      if (
        event.animationName === "hero-ui-arrive" &&
        target instanceof HTMLElement &&
        target.dataset.heroUiStep === "3"
      ) {
        // Release the compositor layers after the last stagger has landed.
        event.currentTarget.dataset.heroUiState = "settled";
      }
    },
    [],
  );

  useEffect(() => {
    const query = window.matchMedia("(prefers-reduced-motion: reduce)");
    const sync = () => {
      setReducedMotion(query.matches);
      // Reset the DOM cue when the canvas animation is enabled again.
      if (sectionRef.current) {
        const nextState = query.matches ? "settled" : "out";
        if (sectionRef.current.dataset.heroUiState !== nextState) {
          sectionRef.current.dataset.heroUiState = nextState;
        }
      }
    };
    sync();
    query.addEventListener("change", sync);
    return () => query.removeEventListener("change", sync);
  }, []);

  // Scrolling is an explicit signal to move on from the scene entrance. If the
  // canvas has not reached its UI cue yet, start the UI animation immediately.
  // This also covers browsers restoring a non-zero scroll position on load.
  useEffect(() => {
    if (window.scrollY > 0) {
      revealUi();
      return;
    }

    const revealOnScroll = () => revealUi();
    window.addEventListener("scroll", revealOnScroll, {
      passive: true,
      once: true,
    });
    return () => window.removeEventListener("scroll", revealOnScroll);
  }, [revealUi]);

  // Stop driving the render loop once the hero scrolls away — there is no point
  // burning GPU on a canvas nobody can see.
  useEffect(() => {
    const el = sectionRef.current;
    if (!el) return;
    const observer = new IntersectionObserver(
      ([entry]) => setOnScreen(entry.isIntersecting),
      { rootMargin: "120px" },
    );
    observer.observe(el);
    return () => observer.disconnect();
  }, []);

  return (
    <section
      ref={sectionRef}
      id="top"
      data-hero-ui-state="out"
      onAnimationEnd={settleUiLayers}
      className="relative bg-background"
    >
      <div className="grid">
        <TimeOfDayExperience
          reducedMotion={reducedMotion}
          onScreen={onScreen}
          onUiReveal={revealUi}
        />

        <div className="relative z-30 col-start-1 row-start-1">
          <div className="relative z-10 flex h-svh min-h-[500px] flex-col">
            <div className="mt-auto px-4 pb-6 sm:px-8">
              <div
                data-hero-ui
                data-hero-ui-step="1"
                className="max-w-2xl"
              >
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
