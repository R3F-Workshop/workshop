import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";

import { CopyBlock } from "@/app/attendees/components/copy-block";
import { Card } from "@/components/ui/card";
import {
  ACCESS_CODES,
  CHECKPOINTS,
  DAY_OF,
  HELP_CHANNEL,
  REQUIREMENTS,
  SETUP,
  TROUBLESHOOTING,
  WEBGPU_CHECK,
} from "@/lib/attendees";

// Obscurity, not security — but there's no reason to help a
// crawler along.
export const metadata: Metadata = {
  title: "Attendee guide · Advanced R3F Workshop",
  robots: { index: false, follow: false },
};

// Only the real codes exist as routes; anything else 404s at the edge of the
// static build rather than rendering.
export function generateStaticParams() {
  return ACCESS_CODES.map((code) => ({ code }));
}

export const dynamicParams = false;

function Block({
  n,
  title,
  children,
}: {
  n: string;
  title: string;
  children: React.ReactNode;
}) {
  return (
    <section className="border-t border-border px-4 py-11 sm:px-6 md:py-14">
      <div className="mx-auto max-w-[820px]">
        <div className="eyebrow">
          {n} · {title}
        </div>
        <div className="mt-5">{children}</div>
      </div>
    </section>
  );
}

export default async function AttendeePage({
  params,
}: PageProps<"/attendees/[code]">) {
  const { code } = await params;
  if (!(ACCESS_CODES as readonly string[]).includes(code)) notFound();

  return (
    <main className="min-h-svh bg-background">
      <div className="flex items-center justify-between gap-5 border-b border-border px-4 py-5 font-mono text-[11px] font-medium tracking-[0.11em] uppercase sm:px-6">
        <span className="font-semibold">pmndrs</span>
        <Link
          href="/"
          className="text-dim transition-colors hover:text-foreground"
        >
          ← Workshop site
        </Link>
      </div>

      <header className="px-4 py-14 sm:px-6 md:py-20">
        <div className="mx-auto max-w-[820px]">
          <div className="font-mono text-[11px] font-medium tracking-[0.13em] text-dim uppercase">
            September 8 &amp; 9, 2026 · Gobelins, Paris
          </div>
          <h1
            className="mt-4 font-semibold tracking-[-0.035em]"
            style={{ fontSize: "clamp(30px, 5vw, 46px)", lineHeight: 1.05 }}
          >
            You&rsquo;re in. Here&rsquo;s what to do first.
          </h1>
          <p className="mt-4 max-w-[560px] text-base leading-[1.65] text-muted-foreground">
            Everything you need before and during the two days. Bookmark this
            page — it gets updated as we get closer.
          </p>
        </div>
      </header>

      <Block n="01" title="Start here">
        <h2 className="text-[22px] font-semibold tracking-[-0.02em]">
          {SETUP.heading}
        </h2>
        <p className="mt-3 text-base leading-[1.65] text-muted-foreground">
          {SETUP.lede}
        </p>
        <div className="mt-6">
          <CopyBlock code={SETUP.command} />
        </div>
        <p className="mt-4 text-[15px] leading-[1.6] text-foreground">
          {SETUP.done}
        </p>
        <p className="mt-2.5 text-[15px] leading-[1.6] text-dim">
          {SETUP.note}
        </p>
      </Block>

      <Block n="02" title="What you need">
        <div className="flex flex-col gap-px bg-border">
          {REQUIREMENTS.map(({ a, b, c }) => (
            <div key={a} className="bg-background py-3.5">
              <div className="grid grid-cols-[1fr_auto] items-baseline gap-3.5 text-sm">
                <span className="font-medium">{a}</span>
                <span className="text-right font-mono text-xs text-faint">
                  {b}
                </span>
              </div>
              {c ? (
                <div className="mt-1 text-[13px] leading-[1.5] text-dim">
                  {c}
                </div>
              ) : null}
            </div>
          ))}
        </div>

        <div className="mt-7">
          <h2 className="text-[17px] font-semibold tracking-[-0.02em]">
            {WEBGPU_CHECK.heading}
          </h2>
          <p className="mt-2.5 text-[15px] leading-[1.6] text-muted-foreground">
            {WEBGPU_CHECK.body}
          </p>
          <div className="mt-4">
            <CopyBlock code={WEBGPU_CHECK.command} />
          </div>
        </div>
      </Block>

      <Block n="03" title="How the day works">
        <h2 className="text-[22px] font-semibold tracking-[-0.02em]">
          {CHECKPOINTS.heading}
        </h2>
        <p className="mt-3 text-base leading-[1.65] text-muted-foreground">
          {CHECKPOINTS.lede}
        </p>
        <div className="mt-6">
          <CopyBlock code={CHECKPOINTS.command} />
        </div>
        <p className="mt-4 text-[15px] leading-[1.6] text-dim">
          {CHECKPOINTS.after}
        </p>
      </Block>

      <Block n="04" title="When it breaks">
        <div className="flex flex-col gap-8">
          {TROUBLESHOOTING.map(({ group, items }) => (
            <div key={group}>
              <div className="font-mono text-[11px] font-medium tracking-[0.1em] uppercase">
                {group}
              </div>
              <div className="mt-3.5 flex flex-col">
                {items.map(({ q, a }) => (
                  <div
                    key={q}
                    className="border-b border-hair py-3.5 last:border-b-0"
                  >
                    <div className="text-sm font-medium">{q}</div>
                    <div className="mt-1.5 text-sm leading-[1.6] text-muted-foreground">
                      {a}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      </Block>

      <Block n="05" title="On the day">
        <div className="hairline-grid grid-cols-2 sm:grid-cols-3">
          {DAY_OF.map(({ k, v }) => (
            <div key={k} className="bg-background px-4.5 py-4">
              <div className="font-mono text-[10px] tracking-[0.11em] text-faint uppercase">
                {k}
              </div>
              <div className="mt-1.5 text-[15px] font-medium">{v}</div>
            </div>
          ))}
        </div>

        <Card className="mt-5 gap-2 p-5">
          <div className="text-[15px] font-medium">Still stuck?</div>
          <div className="text-sm leading-[1.6] text-muted-foreground">
            Grab a floater, or post what you ran, the error, and your OS and
            Node version.
          </div>
          <div className="mt-1 font-mono text-[11px] text-faint">
            {HELP_CHANNEL.href ? (
              <a href={HELP_CHANNEL.href} className="hover:text-foreground">
                {HELP_CHANNEL.label}
              </a>
            ) : (
              HELP_CHANNEL.note
            )}
          </div>
        </Card>
      </Block>

      <footer className="border-t border-border px-4 py-10 sm:px-6">
        <div className="mx-auto max-w-[820px] font-mono text-[11px] text-faint">
          pmndrs · Advanced React Three Fiber · Paris 2026
        </div>
      </footer>
    </main>
  );
}
