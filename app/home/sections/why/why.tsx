import { ExploreLink } from "@/app/home/components/explore-link";
import { RevealGroup } from "@/app/home/components/motion/reveal";
import { FlipGridCanvas } from "@/app/home/components/canvas/scenes";
import { Card } from "@/components/ui/card";
import { WHY } from "@/lib/content";
import { Wrap } from "@/app/home/components/section";

/** Forward-looking: what v10 and WebGPU make possible. */
export function Why() {
  return (
    <section
      id="why"
      className="relative overflow-hidden px-4 pt-9 pb-14 sm:px-6 sm:pt-12 sm:pb-20 md:px-8 md:pb-24 lg:px-10 lg:pt-14 lg:pb-28"
    >
      {/* The tiles are the argument. */}
      <FlipGridCanvas />

      <Wrap className="relative">
        <RevealGroup className="max-w-[860px]">
          <p
            className="max-w-[24ch] text-[24px] leading-[1.2] font-medium tracking-[-0.025em] text-foreground sm:max-w-none sm:text-[30px] sm:leading-[1.3] lg:text-[36px]"
            data-reveal
          >
            {WHY.lede}
          </p>
        </RevealGroup>

        <RevealGroup className="mt-9 sm:mt-12 lg:mt-14">
          <div className="grid gap-3 sm:grid-cols-2 sm:gap-4 lg:grid-cols-3 lg:gap-5">
            {WHY.points.map(({ n, t, d }) => (
              <Card key={n} className="w-full gap-0 p-5 sm:p-6" data-reveal>
                <h2 className="text-[17px] leading-[1.25] font-medium tracking-[-0.02em] sm:text-[18px]">
                  {t}
                </h2>
                <p className="mt-2.5 text-[14px] leading-[1.6] text-muted-foreground sm:text-[15px]">
                  {d}
                </p>
              </Card>
            ))}
          </div>

          <div className="mt-6 hidden md:block" data-reveal>
            <ExploreLink
              href="/demos/flip-grid"
              label="Explore the flip grid"
            />
          </div>
        </RevealGroup>
      </Wrap>
    </section>
  );
}
