"use client";

import { Moon, Sun, SunDim, Sunrise, Sunset } from "lucide-react";
import { useCallback, useEffect, useRef } from "react";

import { phaseFor, SOLAR_ZONES, zoneAt, type Phase } from "@/lib/time-of-day";
import { cn } from "@/lib/utils";

/** A rotary time control with a wrapping value and audible detents. */

const FULL_TURN = 360;
/** Value units between audible detents. */
const DETENT = 4;
const MIN_CLICK_INTERVAL = 0.032;
const AUDIO_FLOOR = 0.0001;

const PHASE_ICON: Record<Phase, typeof Sun> = {
  NIGHT: Moon,
  DUSK: Sunset,
  GOLDEN: SunDim,
  DAY: Sun,
};

/** Wraps clockwise and counterclockwise turns into the range [0, 100). */
const wrapValue = (v: number) => ((v % 100) + 100) % 100;

/** Formats dial units as a 24-hour clock. */
const clockLabel = (v: number) => {
  const minutes = Math.round((wrapValue(v) / 100) * 24 * 60) % (24 * 60);
  return `${Math.floor(minutes / 60)}:${String(minutes % 60).padStart(2, "0")}`;
};

type DialAudio = {
  ctx: AudioContext;
  noise: AudioBuffer;
  output: GainNode;
  lastClickAt: number;
};

const clamp01 = (value: number) => Math.max(0, Math.min(1, value));
const lerp = (from: number, to: number, t: number) =>
  from + (to - from) * t;

function envelope(
  ctx: AudioContext,
  now: number,
  peak: number,
  attack: number,
  decay: number,
) {
  const gain = ctx.createGain();
  gain.gain.setValueAtTime(AUDIO_FLOOR, now);
  gain.gain.linearRampToValueAtTime(peak, now + attack);
  gain.gain.exponentialRampToValueAtTime(AUDIO_FLOOR, now + decay);
  return gain;
}

function createDialAudio(): DialAudio | null {
  const Ctor =
    window.AudioContext ??
    (window as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
  if (!Ctor) return null;

  const ctx = new Ctor();
  const noise = ctx.createBuffer(1, ctx.sampleRate * 0.04, ctx.sampleRate);
  const data = noise.getChannelData(0);
  for (let i = 0; i < data.length; i++) data[i] = Math.random() * 2 - 1;

  const output = ctx.createGain();
  output.gain.value = 0.62;
  const compressor = ctx.createDynamicsCompressor();
  compressor.threshold.value = -18;
  compressor.knee.value = 12;
  compressor.ratio.value = 6;
  compressor.attack.value = 0.002;
  compressor.release.value = 0.08;
  output.connect(compressor).connect(ctx.destination);

  return {
    ctx,
    noise,
    output,
    lastClickAt: Number.NEGATIVE_INFINITY,
  };
}

/** A contact snap followed by the damped resonances of the dial body. */
function playClick(audio: DialAudio, speed: number) {
  const { ctx, noise, output } = audio;
  const now = ctx.currentTime;
  const variation = 0.94 + Math.random() * 0.12;
  const decayScale = lerp(1, 0.52, speed);

  // The plastic-on-metal contact is bright, short, and nearly non-tonal.
  const burst = ctx.createBufferSource();
  burst.buffer = noise;
  burst.playbackRate.value = variation;
  const band = ctx.createBiquadFilter();
  band.type = "bandpass";
  band.frequency.value = lerp(4500, 3800, speed) * variation;
  band.Q.value = 1.7;
  const burstGain = envelope(
    ctx,
    now,
    lerp(0.068, 0.025, speed),
    0.0008,
    0.018 * decayScale,
  );
  burst.connect(band).connect(burstGain).connect(output);
  burst.start(now);
  burst.stop(now + 0.025);

  // Two differently damped modes make the detent feel like a small object
  // with a hard shell and a heavier body instead of a synthesized beep.
  const modes = [
    ["triangle", 735, lerp(0.017, 0.01, speed), 0.001, 0.034],
    ["sine", 190, lerp(0.024, 0.008, speed), 0.0015, 0.052],
  ] as const;

  for (const [type, frequency, peak, attack, decay] of modes) {
    const oscillator = ctx.createOscillator();
    oscillator.type = type;
    oscillator.frequency.value = frequency * variation;
    const gain = envelope(ctx, now, peak, attack, decay * decayScale);
    oscillator.connect(gain).connect(output);
    oscillator.start(now);
    oscillator.stop(now + decay + 0.008);
  }
}

export function TimeDial({
  value,
  onValueChange,
  className,
  ...aria
}: {
  value: number;
  onValueChange: (value: number) => void;
  className?: string;
  "aria-label"?: string;
  "aria-labelledby"?: string;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const valueRef = useRef(value);
  const audioRef = useRef<DialAudio | null>(null);
  const dragRef = useRef<{
    x: number;
    y: number;
    lastAngle: number | null;
    value: number;
    moved: boolean;
  } | null>(null);
  const lastDetent = useRef(Math.round(value / DETENT));

  useEffect(() => {
    return () => void audioRef.current?.ctx.close();
  }, []);

  useEffect(() => {
    valueRef.current = value;
  }, [value]);

  // Create the audio context during a user gesture to satisfy autoplay policy.
  const tick = useCallback(() => {
    const audio = audioRef.current ?? createDialAudio();
    if (!audio) return;
    audioRef.current = audio;
    if (audio.ctx.state === "suspended") void audio.ctx.resume();

    // At speed, physical detents blur into a ratchet. Discard intervals too
    // dense to resolve, then soften and vary the remaining impacts so they do
    // not become a rigid machine-gun sequence.
    const interval = audio.ctx.currentTime - audio.lastClickAt;
    if (interval < MIN_CLICK_INTERVAL) return;
    const speed = clamp01((0.18 - interval) / 0.14);
    audio.lastClickAt = audio.ctx.currentTime;
    playClick(audio, speed);
  }, []);

  const setValue = useCallback(
    (next: number) => {
      valueRef.current = next;
      const detent = Math.round(next / DETENT);
      if (detent !== lastDetent.current) {
        lastDetent.current = detent;
        tick();
      }
      // Preserve whole turns for delayed replay.
      onValueChange(next);
    },
    [onValueChange, tick],
  );

  const updateFromPointer = useCallback(
    (clientX: number, clientY: number) => {
      const drag = dragRef.current;
      if (!drag) return;

      const dx = clientX - drag.x;
      const dy = clientY - drag.y;
      // Wait for a stable angle when a drag starts near the center.
      if (Math.hypot(dx, dy) < 4) return;

      // Unwrap the clockwise angle so crossing zero produces a small delta.
      const angle = (Math.atan2(dx, -dy) * 180) / Math.PI;
      if (drag.lastAngle === null) {
        drag.lastAngle = angle;
        return;
      }

      let delta = angle - drag.lastAngle;
      if (delta > 180) delta -= FULL_TURN;
      if (delta < -180) delta += FULL_TURN;

      drag.lastAngle = angle;
      if (Math.abs(delta) < 0.001) return;
      drag.moved = true;
      // Keep drag distance unbounded so replay preserves whole turns.
      drag.value += (delta / FULL_TURN) * 100;
      setValue(drag.value);
    },
    [setValue],
  );

  const normalizedValue = wrapValue(value);
  const angle = (normalizedValue / 100) * FULL_TURN;
  const solarHour = (normalizedValue / 100) * 24;
  const activeZone = zoneAt(solarHour);
  // The dial reflects live input while the scene catches up.
  const phase = phaseFor(solarHour);
  // Dawn uses Sunrise because dawn and dusk share a phase.
  const Icon = activeZone?.label === "Dawn" ? Sunrise : PHASE_ICON[phase];

  return (
    <div
      ref={ref}
      role="slider"
      tabIndex={0}
      aria-valuemin={0}
      aria-valuemax={100}
      aria-valuenow={Math.round(normalizedValue)}
      aria-valuetext={`${clockLabel(normalizedValue)}, ${(
        activeZone?.label ?? phase
      ).toLowerCase()}`}
      aria-orientation="vertical"
      {...aria}
      onPointerDown={(e) => {
        e.preventDefault();
        const rect = ref.current!.getBoundingClientRect();
        const x = rect.left + rect.width / 2;
        const y = rect.top + rect.height / 2;
        const dx = e.clientX - x;
        const dy = e.clientY - y;
        dragRef.current = {
          x,
          y,
          lastAngle:
            Math.hypot(dx, dy) < 4
              ? null
              : (Math.atan2(dx, -dy) * 180) / Math.PI,
          value: valueRef.current,
          moved: false,
        };
        ref.current?.setPointerCapture(e.pointerId);
        ref.current?.focus();
      }}
      onPointerMove={(e) => {
        if (ref.current?.hasPointerCapture(e.pointerId)) {
          const samples = e.nativeEvent.getCoalescedEvents?.();
          if (samples?.length) {
            for (const sample of samples) {
              updateFromPointer(sample.clientX, sample.clientY);
            }
          } else {
            updateFromPointer(e.clientX, e.clientY);
          }
        }
      }}
      onPointerUp={(e) => {
        const drag = dragRef.current;
        if (!drag || drag.moved) return;

        const dx = e.clientX - drag.x;
        const dy = e.clientY - drag.y;
        if (Math.hypot(dx, dy) < 4) return;

        const degrees = (Math.atan2(dx, -dy) * 180) / Math.PI;
        const clicked = wrapValue((degrees / FULL_TURN) * 100);
        // Select the reading nearest the current unwrapped turn.
        const next =
          clicked + Math.round((drag.value - clicked) / 100) * 100;
        setValue(next);
      }}
      onLostPointerCapture={() => {
        dragRef.current = null;
      }}
      onKeyDown={(e) => {
        const steps: Record<string, number | undefined> = {
          ArrowUp: 2,
          ArrowRight: 2,
          ArrowDown: -2,
          ArrowLeft: -2,
          PageUp: 10,
          PageDown: -10,
        };
        // Home selects midnight and End selects midday on the nearest turn.
        const wrappedJumps: Record<string, number | undefined> = {
          Home: 0, // midnight
          End: 50, // midday
        };
        const step = steps[e.key];
        const wrappedJump = wrappedJumps[e.key];
        const current = valueRef.current;
        const jump =
          wrappedJump === undefined
            ? undefined
            : wrappedJump +
              Math.round((current - wrappedJump) / 100) * 100;
        if (step === undefined && jump === undefined) return;
        e.preventDefault();
        setValue(jump ?? current + (step ?? 0));
      }}
      className={cn(
        "relative isolate size-[72px] shrink-0 cursor-pointer touch-none rounded-full border border-white/25 bg-white/5 select-none sm:size-20",
        "transition-colors hover:border-white/50 focus-visible:ring-2 focus-visible:ring-white/60 focus-visible:outline-none",
        className,
      )}
      style={{ contain: "layout style" }}
    >
      {/* Day quadrants and solar lighting zones. */}
      <svg
        viewBox="0 0 56 56"
        className="pointer-events-none absolute inset-0 size-full"
        aria-hidden
      >
        {SOLAR_ZONES.map((zone) => {
          const start = (zone.startHour / 24) * 100;
          const length = ((zone.endHour - zone.startHour) / 24) * 100;
          const active = activeZone?.label === zone.label;
          return (
            <circle
              key={zone.label}
              cx={28}
              cy={28}
              r={23}
              pathLength={100}
              fill="none"
              stroke={zone.color}
              strokeWidth={active ? 4 : 3}
              strokeLinecap="round"
              strokeDasharray={`${length} ${100 - length}`}
              strokeDashoffset={-start}
              transform="rotate(-90 28 28)"
              opacity={active ? 1 : 0.62}
            />
          );
        })}

        {[0, 0.25, 0.5, 0.75].map((t) => {
          const a = (t * FULL_TURN * Math.PI) / 180;
          const sin = Math.sin(a);
          const cos = Math.cos(a);
          return (
            <line
              key={t}
              x1={28 + 21 * sin}
              y1={28 - 21 * cos}
              x2={28 + 25 * sin}
              y2={28 - 25 * cos}
              stroke="rgb(255 255 255 / 0.32)"
              strokeWidth={1}
              strokeLinecap="round"
            />
          );
        })}
      </svg>

      {/* The needle tracks the pointer without interpolation. */}
      <div
        className="pointer-events-none absolute inset-0"
        style={{
          transform: `translateZ(0) rotate(${angle}deg)`,
          willChange: "transform",
        }}
      >
        <div className="absolute top-[6px] left-1/2 h-[10px] w-[2px] -translate-x-1/2 rounded-full bg-white sm:top-[7px] sm:h-[11px] sm:w-[3px]" />
      </div>

      <Icon
        className="pointer-events-none absolute top-1/2 left-1/2 size-5 -translate-x-1/2 -translate-y-1/2 text-white/80 sm:size-6"
        strokeWidth={1.75}
        aria-hidden
      />
    </div>
  );
}
