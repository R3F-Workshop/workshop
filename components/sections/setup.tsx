import { RevealGroup } from "@/components/motion/reveal";
import { Card } from "@/components/ui/card";
import { PREREQ_GROUPS, SECTION_COPY } from "@/lib/content";
import { Section, SectionTitle, Wrap } from "./section";

export function Setup() {
  return (
    <Section id="setup">
      <Wrap>
        <RevealGroup className="grid items-start gap-8 md:grid-cols-2 lg:gap-16">
          <div>
            <div className="eyebrow" data-reveal>
              {SECTION_COPY.setup.eyebrow}
            </div>
            <SectionTitle data-reveal>{SECTION_COPY.setup.title}</SectionTitle>
            <p
              className="mt-4 text-base leading-[1.65] text-muted-foreground"
              data-reveal
            >
              {SECTION_COPY.setup.audience}
            </p>
            <p
              className="mt-3.5 text-base leading-[1.65] text-muted-foreground"
              data-reveal
            >
              {SECTION_COPY.setup.installBefore}
              <span className="font-mono text-[13px] text-foreground">
                {SECTION_COPY.setup.installCode}
              </span>
              {SECTION_COPY.setup.installAfter}
            </p>
            <p
              className="mt-3.5 text-[15px] leading-[1.6] text-dim"
              data-reveal
            >
              {SECTION_COPY.setup.repo}
            </p>
          </div>

          <div className="grid gap-5">
            {PREREQ_GROUPS.map((group) => (
              <Card
                key={group.title}
                className="gap-0 overflow-hidden p-0"
                data-reveal
              >
                <div className="border-b border-border px-5 py-4 font-mono text-[11px] font-medium tracking-[0.1em] uppercase">
                  {group.title}
                </div>
                <div className="px-5 pt-1.5 pb-3.5">
                  {group.items.map(({ a, b }) => (
                    <div
                      key={a}
                      className="grid grid-cols-[1fr_auto] items-baseline gap-3.5 border-b border-hair py-2.5 text-sm last:border-b-0"
                    >
                      <span>{a}</span>
                      <span className="text-right font-mono text-xs text-faint">
                        {b}
                      </span>
                    </div>
                  ))}
                </div>
              </Card>
            ))}
          </div>
        </RevealGroup>
      </Wrap>
    </Section>
  );
}
