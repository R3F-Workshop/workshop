"use client";

import { useEffect } from "react";

import { HeroCanvas } from "./components/hero-canvas";
import { heroReady } from "@/lib/hero-ready";
import { useWebGPU } from "@/lib/use-webgpu";

/** No WebGPU: the design doc's tower plate, placed to match the 3D framing. */
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

/** The bridge between the page and the scene: one capability check, then either the poster or the canvas. */
export function HeroScene({
  hour,
  autoRotate = true,
}: {
  hour: number;
  autoRotate?: boolean;
}) {
  const support = useWebGPU();

  // Nothing to wait for on the poster path: let the loading screen go.
  useEffect(() => {
    if (support === "no") heroReady.set();
  }, [support]);

  if (support === "checking") return null;
  if (support === "no") return <FallbackPoster />;

  return (
    <HeroCanvas hour={hour} autoRotate={autoRotate} onReady={heroReady.set} />
  );
}
