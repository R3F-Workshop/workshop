import { Hero } from "@/app/home/sections/hero/hero";
import { Closer } from "@/app/home/sections/closer/closer";
import { Faq } from "@/app/home/sections/faq/faq";
import { Outcomes } from "@/app/home/sections/outcomes/outcomes";
import { Overview } from "@/app/home/sections/overview/overview";
import { Setup } from "@/app/home/sections/setup/setup";
import { Why } from "@/app/home/sections/why/why";
import { LoadingScreen } from "@/app/home/components/loading-screen";
import { SiteFooter } from "@/components/site-footer";
import { SiteHeader } from "@/components/site-header";
import { ConnectorsCanvas } from "@/app/home/components/canvas/scenes";

export default function Page() {
  return (
    <>
      {/* Holds the page until the hero has rendered — see lib/hero-ready.ts. */}
      <LoadingScreen />
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
