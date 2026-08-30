import type { ReactNode } from "react";

import { ExploreLink } from "@/components/explore-link";

import {
  BlendingCubeCanvas,
  MagicBoxCanvas,
  TakehomeGridCanvas,
} from "@/components/three/scenes";
import { Card } from "@/components/ui/card";
import { OUTCOMES, SECTION_COPY } from "@/lib/content";
import { Section, SectionTitle, Wrap } from "./section";

/**
 * The visual area at the top of an outcome card.
 *
 * The label sits underneath rather than beside: a scene renders over it when
 * WebGPU is available, and shows through when it isn't. So the card is never
 * blank and never pretends a missing scene is there.
 */
function Slot({ label, children }: { label: string; children?: ReactNode }) {
  return (
    <div className="relative h-[190px] overflow-hidden border-b border-border bg-[#0b0b0e]">
      <div className="absolute inset-0 grid place-items-center px-4">
        <span className="text-center font-mono text-[10.5px] tracking-[0.12em] text-faint uppercase">
          {label}
        </span>
      </div>
      {children}
    </div>
  );
}

/** One slot per outcome, in card order. Each names the demo it came from. */
const SLOTS: { label: string; demo?: string; scene?: ReactNode }[] = [
  {
    label: "Ten, written six ways",
    demo: "/demos/magic-box",
    // Closer than the demo's framing — the slot is short and wide, so the
    // vertical field of view is what limits it.
    scene: (
      <MagicBoxCanvas camera={{ position: [-3.3, 1.55, 3.75], fov: 40 }} />
    ),
  },
  {
    label: "One box, four imports",
    demo: "/demos/blending-cube",
    // Pulled in and lifted slightly: the default framing leaves room under the
    // cube for a contact shadow that a 190px slot has no vertical budget for.
    scene: (
      <BlendingCubeCanvas camera={{ position: [3.2, 2.1, 4.0], fov: 30 }} />
    ),
  },
  {
    label: "Everything on this page, yours",
    demo: "/demos/takehome-grid",
    scene: <TakehomeGridCanvas />,
  },
];

export function Outcomes() {
  return (
    <Section id="outcomes">
      <Wrap>
        <div className="eyebrow">{SECTION_COPY.outcomes.eyebrow}</div>
        <SectionTitle>{SECTION_COPY.outcomes.title}</SectionTitle>

        <div className="mt-9 grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
          {OUTCOMES.map(({ n, t, d }, i) => (
            <Card key={n} className="gap-0 overflow-hidden p-0">
              <Slot label={SLOTS[i].label}>{SLOTS[i].scene}</Slot>
              <div className="flex flex-col gap-3 p-6">
                <div className="font-mono text-[11px] font-medium text-faint">
                  {n}
                </div>
                <div className="text-[19px] font-semibold tracking-[-0.02em]">
                  {t}
                </div>
                <div className="text-[15px] leading-[1.6] text-muted-foreground">
                  {d}
                </div>
                {/* `mt-auto` so the links sit on one line across the row even
                    when the card copy runs to different lengths. */}
                {SLOTS[i].demo ? (
                  <ExploreLink
                    href={SLOTS[i].demo}
                    label="Explore"
                    className="mt-auto pt-1"
                  />
                ) : null}
              </div>
            </Card>
          ))}
        </div>
      </Wrap>
    </Section>
  );
}
