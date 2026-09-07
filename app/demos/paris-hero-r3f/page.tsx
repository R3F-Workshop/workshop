import type { Metadata } from "next";

import { ParisHeroR3f } from "@/app/experiences/paris-hero-r3f";
import { skyGradient, todAt } from "@/lib/time-of-day";

export const metadata: Metadata = {
  title: "Paris hero, R3F — build",
  description: "The Paris hero rebuilt in React Three Fiber, live.",
  robots: { index: false, follow: false },
};

export default function ParisHeroR3fPage() {
  return (
    <main className="relative h-dvh w-full overflow-hidden bg-background">
      {/* The same dusk sky the site hero sits over, so framing reads the same here. */}
      <div className="absolute inset-0" style={{ background: skyGradient(todAt(0.85)) }} />
      <ParisHeroR3f />

      <div className="pointer-events-none absolute top-5 left-5 z-30 max-w-[min(430px,calc(100vw-2.5rem))]">
        <div className="font-mono text-[11px] tracking-[0.13em] text-white/60 uppercase">
          Demo · Paris hero, R3F
        </div>
        <h1 className="mt-1.5 text-[22px] leading-[1.15] font-semibold tracking-[-0.03em] text-white sm:text-[26px]">
          Built live
        </h1>
      </div>
    </main>
  );
}
