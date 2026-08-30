import { ExploreLink } from "@/app/home/components/explore-link";
import { RevealGroup } from "@/app/home/components/motion/reveal";
import { SceneSlot } from "@/app/home/sections/overview/components/scene-slot";
import { BlockCityCanvas } from "@/app/home/components/canvas/scenes";
import { FACTS, SECTION_COPY } from "@/lib/content";
import { Section, SectionTitle, Wrap } from "@/app/home/components/section";

export function Overview() {
  return (
    <Section id="overview">
      <Wrap>
        <RevealGroup className="grid items-start gap-8 md:grid-cols-2 lg:gap-16">
          <div>
            <div className="eyebrow" data-reveal>
              {SECTION_COPY.overview.eyebrow}
            </div>
            <SectionTitle data-reveal>
              {SECTION_COPY.overview.title}
            </SectionTitle>
            <p
              className="mt-4 text-base leading-[1.65] text-muted-foreground"
              data-reveal
            >
              {SECTION_COPY.overview.body}
            </p>

            <div className="hairline-grid mt-7 grid-cols-3" data-reveal>
              {FACTS.map(({ k, v }) => (
                <div key={k} className="bg-background px-4.5 py-4">
                  <div className="font-mono text-[10px] tracking-[0.11em] text-faint uppercase">
                    {k}
                  </div>
                  <div className="mt-1.5 text-[15px] font-medium">{v}</div>
                </div>
              ))}
            </div>
          </div>

          <div
            className="overflow-hidden rounded-xl border border-border bg-card"
            data-reveal
          >
            {/* The poster stays the base layer and the scene fades in over it,
                so this still reads without WebGPU. The city is its own
                component rather than the hero's: that one is shaped around the
                tower it stands in, and leaves a hole in the middle here. */}
            <SceneSlot
              poster="/concept/city-wide.png"
              alt="Concept frame of the block city at mid distance"
              sizes="(max-width: 768px) 100vw, 50vw"
              className="h-[240px] opacity-85 md:h-[300px] lg:h-[360px]"
            >
              <BlockCityCanvas />
            </SceneSlot>
            {/* Deliberately true of both layers: the live scene when there is
                WebGPU, the concept frame when there isn't. */}
            <div className="flex items-center justify-between gap-4 border-t border-border px-4.5 py-4 font-mono text-[11px] text-faint">
              <span>{SECTION_COPY.overview.caption}</span>
              <ExploreLink href="/demos/block-city" label="Explore" />
            </div>
          </div>
        </RevealGroup>
      </Wrap>
    </Section>
  );
}
