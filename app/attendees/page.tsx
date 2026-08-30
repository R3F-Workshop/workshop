import type { Metadata } from "next";
import Link from "next/link";

import { CodeEntry } from "./code-entry";

export const metadata: Metadata = {
  title: "Attendee guide · Advanced R3F Workshop",
  robots: { index: false, follow: false },
};

/**
 * A landing spot for anyone who remembers the code but not the whole URL —
 * the real entry point is the direct link in the confirmation email.
 */
export default function AttendeesGate() {
  return (
    <main className="flex min-h-svh flex-col bg-background">
      <div className="flex items-center justify-between gap-5 border-b border-border px-4 py-5 font-mono text-[11px] font-medium tracking-[0.11em] uppercase sm:px-6">
        <span className="font-semibold">pmndrs</span>
        <Link
          href="/"
          className="text-dim transition-colors hover:text-foreground"
        >
          ← Workshop site
        </Link>
      </div>

      <div className="flex flex-1 items-center justify-center px-4 py-16">
        <div className="w-full max-w-[400px]">
          <div className="eyebrow">Attendees</div>
          <h1 className="mt-4 text-[28px] leading-[1.1] font-semibold tracking-[-0.03em]">
            Enter your access code
          </h1>
          <p className="mt-3.5 text-[15px] leading-[1.6] text-muted-foreground">
            It&rsquo;s in your confirmation email, along with a direct link that
            skips this step.
          </p>
          <div className="mt-7">
            <CodeEntry />
          </div>
        </div>
      </div>
    </main>
  );
}
