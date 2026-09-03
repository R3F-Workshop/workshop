"use client";

import { useEffect } from "react";
import { useFrame } from "@react-three/fiber/webgpu";

import { DepthAttachmentSync } from "@/components/depth-attachment-sync";
import {
  PARIS_ATMOSPHERE_DEFAULTS,
  PARIS_HOMEPAGE_CITY_DEFAULTS,
} from "@/resources/tower-scene/paris-defaults";
import { TowerCanvas } from "@/resources/tower-scene/tower-canvas";
import { heroGate } from "@/lib/hero-gate";
import { useWebGPU } from "@/lib/use-webgpu";

/** This canvas's id, which is also the id of the render job r3f registers. */
const PRIMARY = "main";

// Dark blue ground reflectance keeps the horizon saturated.
const HERO_GROUND_ALBEDO = { x: 0.025, y: 0.075, z: 0.18 } as const;

/** Idle this canvas without touching the frame loop. */
function useIdleWhenHidden(paused: boolean) {
  // `useFrame` without a callback is the documented scheduler-access form, and it works *outside* `<Canvas>` too.
  const { scheduler } = useFrame();

  useEffect(() => {
    if (!scheduler.getJobIds().includes(PRIMARY)) return;

    if (paused) scheduler.pauseJob(PRIMARY);
    else scheduler.resumeJob(PRIMARY);

    // Never leave it parked on unmount: the job outlives this effect.
    return () => {
      if (scheduler.getJobIds().includes(PRIMARY)) scheduler.resumeJob(PRIMARY);
    };
  }, [paused, scheduler]);
}

/** Static fallback shown when WebGPU is unavailable. */
function FallbackPoster() {
  return (
    <div
      className="absolute left-1/2 -translate-x-1/2"
      style={{
        top: "clamp(40px, 7vh, 80px)",
        width: "min(430px, 74vw)",
        height: "min(660px, 64vh)",
        backgroundImage: "url(/concept/tower-cutout.png)",
        backgroundSize: "contain",
        backgroundPosition: "center bottom",
        backgroundRepeat: "no-repeat",
      }}
    />
  );
}

/** The real hero: the verified `TowerCanvas` (FSR3 + bloom + sky fog, dusk at Paris solar position. */
export function TowerHero({
  /** Time of day, 0..100, matching the hero slider. */
  value,
  reducedMotion = false,
  /** Hero is off-screen: skip its render job, leave the loop alone. */
  paused = false,
  onUiReveal,
}: {
  value: number;
  reducedMotion?: boolean;
  paused?: boolean;
  onUiReveal?: () => void;
}) {
  useIdleWhenHidden(paused);
  const support = useWebGPU();

  useEffect(() => {
    if (support !== "no") return;
    // Canvas always mounts its fallback.
    heroGate.bypass();
  }, [support]);

  useEffect(() => {
    const syncUi = () => {
      const state = heroGate.getState();
      if (state === "revealing-final" || state === "settled") {
        onUiReveal?.();
      }
    };

    const unsubscribe = heroGate.subscribe(syncUi);
    syncUi();
    return unsubscribe;
  }, [onUiReveal]);

  if (support === "checking") return null;
  if (support === "no") return <FallbackPoster />;

  // Slider fraction → solar hours for the sky.
  const hours = (value / 100) * 24;

  // Hold a low daytime exposure, then fade to the night grade at dawn and dusk.
  const t = Math.min(1, Math.max(0, (8 - Math.abs(hours - 12)) / 3));
  const daylight = t * t * (3 - 2 * t);
  const exposure = 40 + (6 - 40) * daylight;

  return (
    <TowerCanvas
      {...PARIS_HOMEPAGE_CITY_DEFAULTS}
      {...PARIS_ATMOSPHERE_DEFAULTS}
      canvasId={PRIMARY}
      timeOfDay={hours}
      exposure={exposure}
      // A clear, saturated "bleu nuit" horizon lets the stars stay crisp.
      turbidity={0}
      groundAlbedo={HERO_GROUND_ALBEDO}
      autoRotateSpeed={reducedMotion ? 0 : 1}
      frameloop={reducedMotion ? "demand" : "always"}
      intro={!reducedMotion}
      dpr={[1, 2]}
      renderScale={1.5}
      // The homepage never enables SSGI, so don't let the widened device limit it needs fail canvas creation on adapters that lack it.
      reserveSsgiHeadroom={false}
      onUiReveal={onUiReveal}
      gate={heroGate}
      canvasStyle={{ pointerEvents: "none" }}
      // Match the static tower plate to the 3D framing when WebGPU is unavailable.
      fallback={<FallbackPoster />}
    >
      <DepthAttachmentSync />
    </TowerCanvas>
  );
}
