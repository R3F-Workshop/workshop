import type { ComponentPropsWithoutRef, ReactNode } from "react";

import { cn } from "@/lib/utils";

/**
 * The shell every content section shares: hairline top rule, the design doc's
 * fluid vertical rhythm, and scroll-margin so nav jumps clear the fixed header.
 */
export function Section({
  id,
  className,
  children,
}: {
  id: string;
  className?: string;
  children: ReactNode;
}) {
  return (
    <section
      id={id}
      className={cn(
        "scroll-mt-[82px] border-t border-border px-4 py-14 sm:px-6 md:py-20 lg:px-10 lg:py-26",
        className,
      )}
    >
      {children}
    </section>
  );
}

export function Wrap({
  narrow,
  className,
  children,
}: {
  narrow?: boolean;
  className?: string;
  children: ReactNode;
}) {
  return (
    <div
      className={cn(
        "mx-auto",
        narrow ? "max-w-[820px]" : "max-w-[1180px]",
        className,
      )}
    >
      {children}
    </div>
  );
}

export function SectionTitle({
  children,
  className,
  ...props
}: ComponentPropsWithoutRef<"h2">) {
  return (
    <h2
      className={cn(
        "mt-4 text-[28px] leading-[1.1] font-semibold tracking-[-0.03em] md:text-[34px] lg:text-[40px]",
        className,
      )}
      {...props}
    >
      {children}
    </h2>
  );
}

/** Mono caption used for times, counts, and other secondary metadata. */
export function Note({
  children,
  className,
  ...props
}: ComponentPropsWithoutRef<"div">) {
  return (
    <div className={cn("font-mono text-xs text-faint", className)} {...props}>
      {children}
    </div>
  );
}
