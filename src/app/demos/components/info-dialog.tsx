"use client";

import { Dialog } from "radix-ui";
import { InfoIcon, XIcon } from "lucide-react";
import type { ReactNode } from "react";

import { cn } from "@/lib/utils";

/**
 * The small "i" a demo sits behind.
 *
 * Anchored bottom-left so it stays clear of the Leva panel, which docks top
 * right, and out of the way of a drag that starts anywhere near the middle.
 */
export function InfoDialog({
  title,
  subtitle,
  children,
  className,
}: {
  title: string;
  subtitle?: string;
  children: ReactNode;
  className?: string;
}) {
  return (
    <Dialog.Root>
      <Dialog.Trigger
        aria-label="About this demo"
        className={cn(
          "fixed bottom-5 left-5 z-40 grid size-9 place-items-center rounded-full",
          "border border-border bg-background/80 text-muted-foreground backdrop-blur-md",
          "transition-colors hover:border-foreground/25 hover:text-foreground",
          "focus-visible:ring-[3px] focus-visible:ring-ring/50 focus-visible:outline-none",
          className,
        )}
      >
        <InfoIcon className="size-4" />
      </Dialog.Trigger>

      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 z-50 bg-black/70 backdrop-blur-[2px] data-[state=open]:animate-in data-[state=open]:fade-in" />
        <Dialog.Content
          className={cn(
            "fixed z-50 flex flex-col overflow-hidden border border-border bg-card shadow-2xl",
            // Full-height sheet on phones, centred panel from sm up.
            "inset-x-0 bottom-0 max-h-[85dvh] rounded-t-2xl",
            "sm:inset-auto sm:top-1/2 sm:left-1/2 sm:max-h-[80dvh] sm:w-[min(620px,calc(100vw-3rem))]",
            "sm:-translate-x-1/2 sm:-translate-y-1/2 sm:rounded-xl",
            "data-[state=open]:animate-in data-[state=open]:fade-in data-[state=open]:zoom-in-98",
          )}
        >
          <div className="flex items-start justify-between gap-4 border-b border-border px-5 py-4 sm:px-6">
            <div>
              <Dialog.Title className="text-[17px] font-semibold tracking-[-0.02em]">
                {title}
              </Dialog.Title>
              {subtitle ? (
                <Dialog.Description className="mt-1 font-mono text-[11px] tracking-[0.06em] text-faint">
                  {subtitle}
                </Dialog.Description>
              ) : (
                // Radix warns without one, and the title already says it.
                <Dialog.Description className="sr-only">
                  How this demo works
                </Dialog.Description>
              )}
            </div>
            <Dialog.Close
              aria-label="Close"
              className="-mt-1 -mr-1 grid size-8 shrink-0 place-items-center rounded-md text-muted-foreground transition-colors hover:bg-foreground/5 hover:text-foreground focus-visible:ring-[3px] focus-visible:ring-ring/50 focus-visible:outline-none"
            >
              <XIcon className="size-4" />
            </Dialog.Close>
          </div>

          <div className="overflow-y-auto px-5 py-5 sm:px-6">{children}</div>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}

/** A titled block inside the dialog. */
export function InfoSection({
  heading,
  children,
}: {
  heading: string;
  children: ReactNode;
}) {
  return (
    <section className="not-first:mt-6">
      <h3 className="font-mono text-[11px] tracking-[0.12em] text-faint uppercase">
        {heading}
      </h3>
      <div className="mt-2 space-y-2.5 text-[14.5px] leading-[1.65] text-muted-foreground">
        {children}
      </div>
    </section>
  );
}
