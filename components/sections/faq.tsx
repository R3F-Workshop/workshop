import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import { FAQS, SECTION_COPY } from "@/lib/content";
import { Section, SectionTitle, Wrap } from "./section";

export function Faq() {
  return (
    <Section id="faq">
      <Wrap narrow>
        <div className="eyebrow">{SECTION_COPY.faq.eyebrow}</div>
        <SectionTitle>{SECTION_COPY.faq.title}</SectionTitle>

        <Accordion
          type="single"
          collapsible
          defaultValue="faq-0"
          className="mt-8 border-t border-border"
        >
          {FAQS.map(({ q, a }, i) => (
            <AccordionItem
              key={q}
              value={`faq-${i}`}
              className="border-b border-border not-last:border-b"
            >
              {/* Swap the stock chevron for the design's +/– glyph. The variants
                  hang off the trigger's own group, so no fork of the primitive. */}
              <AccordionTrigger className="items-center py-5 text-base font-medium tracking-[-0.01em] hover:text-muted-foreground hover:no-underline **:data-[slot=accordion-trigger-icon]:hidden">
                {q}
                <span
                  aria-hidden
                  className="ml-auto pl-4 font-mono text-[15px] text-dim"
                >
                  <span className="group-aria-expanded/accordion-trigger:hidden">
                    +
                  </span>
                  <span className="hidden group-aria-expanded/accordion-trigger:inline">
                    –
                  </span>
                </span>
              </AccordionTrigger>
              <AccordionContent className="pr-10 pb-5.5 text-[15px] leading-[1.65] text-muted-foreground">
                {a}
              </AccordionContent>
            </AccordionItem>
          ))}
        </Accordion>
      </Wrap>
    </Section>
  );
}
