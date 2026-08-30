"use client";

import { useEffect } from "react";
import { useFrame } from "@react-three/fiber/webgpu";

import { DepthAttachmentSync } from "@/components/three/depth-attachment-sync";
import {
  PARIS_ATMOSPHERE_DEFAULTS,
  PARIS_HOMEPAGE_CITY_DEFAULTS,
} from "@/components/hero-demo/paris-defaults";
import { TowerCanvas } from "@/components/hero-demo/tower-canvas";
import { heroGate } from "@/lib/hero-gate";
import { useWebGPU } from "@/lib/use-webgpu";

/** This canvas's id, which is also the id of the render job r3f registers. */
const PRIMARY = "main";

// Dark blue ground reflectance keeps the horizon saturated.
// Stable identity prevents unnecessary sky rebakes.
const HERO_GROUND_ALBEDO = { x: 0.025, y: 0.075, z: 0.18 } as const;

/**
 * Idle this canvas without touching the frame loop.
 *
 * `frameloop` is not per-canvas — r3f writes it to the scheduler singleton,
 * and "demand" stops the one RAF the whole page shares, freezing every other
 * canvas (pmndrs/react-three-fiber#3852). So idling happens at the job level:
 * `pauseJob` skips this canvas's render pass while everything else keeps
 * being driven. Carried over verbatim from the previous hero scene.
 */
function useIdleWhenHidden(paused: boolean) {
  // `useFrame` without a callback is the documented scheduler-access form,
  // and it works *outside* `<Canvas>` too: registration is skipped and the
  // returned `scheduler` is the same global singleton `getScheduler()`
  // resolves to — the frame loop is page-wide, not per-canvas, which is the
  // whole reason job-level pausing works from up here.
  const { scheduler } = useFrame();

  useEffect(() => {
    if (!scheduler.getJobIds().includes(PRIMARY)) return;

    if (paused) scheduler.pauseJob(PRIMARY);
    else scheduler.resumeJob(PRIMARY);

    // Never leave it parked on unmount — the job outlives this effect.
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

/**
 * The real hero: the verified `TowerCanvas` (FSR3 + bloom + sky fog, dusk at
 * Paris solar position, PMNDRS lettering in-scene) as the site's primary
 * canvas.
 *
 * What changed against the old low-poly hero: the sky is the @pmndrs/sky
 * atmosphere rather than a CSS gradient, so the canvas paints every pixel
 * once loaded and the DOM wordmark sandwich is retired — the lettering lives
 * in the scene now, billboarded through the tower. The CSS gradient behind
 * the canvas still earns its keep as the backdrop during the shader compile
 * (the canvas is transparent until the first frame lands).
 */
export function TowerHero({
  /** Time of day, 0..100, matching the hero slider. */
  value,
  reducedMotion = false,
  /** Hero is off-screen — skip its render job, leave the loop alone. */
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
    // Canvas always mounts its fallback. Capability detection avoids
    // bypassing the gate after a successful WebGPU boot.
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
      // The homepage never enables SSGI, so don't let the widened device
      // limit it needs fail canvas creation on adapters that lack it.
      reserveSsgiHeadroom={false}
      onUiReveal={onUiReveal}
      gate={heroGate}
      canvasStyle={{ pointerEvents: "none" }}
      // No WebGPU: the design doc's original tower plate, placed to match the
      // 3D framing, so the hero still shows a tower.
      fallback={<FallbackPoster />}
    >
      <DepthAttachmentSync />
    </TowerCanvas>
  );
}
