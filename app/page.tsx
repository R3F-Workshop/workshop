import { Hero } from "@/components/hero/hero";
import { Closer } from "@/components/sections/closer";
import { Faq } from "@/components/sections/faq";
import { Outcomes } from "@/components/sections/outcomes";
import { Overview } from "@/components/sections/overview";
import { Setup } from "@/components/sections/setup";
import { Why } from "@/components/sections/why";
import { SiteFooter } from "@/components/site-footer";
import { SiteHeader } from "@/components/site-header";
import { ConnectorsCanvas } from "@/components/three/scenes";

export default function Page() {
  return (
    <>
      {/* The finished hero pairs with <LoadingScreen /> here (still in
          components/, driven by lib/hero-gate.ts) — bring both back with the
          real scene. See resources/README.md. */}
      <SiteHeader />
      <Hero />
      <main className="relative z-10 bg-background">
        <Overview />
        <Why />
        <Outcomes />
        <Setup />
        <Faq />
        {/* The physics layer sits over the closer's city poster and gradient,
            but under its headline and button, and spans the footer too. It
            takes no pointer events: the cursor that pushes the pile around is
            read off `window`, so the content above stays clickable. */}
        <div className="relative">
          <ConnectorsCanvas />
          <Closer />
          <SiteFooter />
        </div>
      </main>
    </>
  );
}
