"use client";

import { ArrowUpRightIcon, MenuIcon, XIcon } from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { Dialog } from "radix-ui";

import { Logo } from "@/components/brand/logo";
import { Button } from "@/components/ui/button";
import { HERO, REGISTER_URL } from "@/lib/content";
import { useScrollSpy } from "@/lib/use-scroll-spy";
import { cn } from "@/lib/utils";

/**
 * The one header, mounted from the root layout.
 *
 * Three presentations of the same thing:
 * - On the home page the bar stays transparent over the hero and gains its
 *   backdrop, the page title and the progress rule once the hero scrolls past.
 *   The hero switches it on when it mounts through `data-site-header-state`.
 * - On content pages it is the same bar, on from the first paint.
 * - On a demo page there is no bar at all, only the menu button in the corner
 *   the demo shells keep clear, so the scene and its title plate stay as they
 *   are. `ControlsToggle` sits to its left.
 *
 * Navigation lives behind the menu button everywhere, so the three routes of
 * the site are reachable from anywhere in one tap.
 */
export function SiteHeader() {
  const pathname = usePathname();
  const { shown, progress } = useScrollSpy();

  // The attendee guide carries its own strip and is not part of the site nav.
  if (pathname.startsWith("/attendees")) return null;

  if (pathname.startsWith("/demos/")) {
    return (
      <SiteMenu
        pathname={pathname}
        className={cn(
          "fixed top-5 right-5 z-40 grid size-9 place-items-center rounded-full",
          "border border-border bg-background/80 text-muted-foreground backdrop-blur-md",
          "transition-colors hover:border-foreground/25 hover:text-foreground",
          "focus-visible:ring-[3px] focus-visible:ring-ring/50 focus-visible:outline-none",
        )}
      />
    );
  }

  const home = pathname === "/";
  const solid = shown || !home;

  return (
    <header
      data-site-header
      data-site-header-state={home ? "out" : "in"}
      className={cn(
        "fixed inset-x-0 top-0 z-50 overflow-hidden border-b transition-[background-color,border-color,backdrop-filter] duration-500",
        solid
          ? "border-border bg-black/70 backdrop-blur-xl"
          : "border-transparent bg-transparent",
      )}
    >
      {home && (
        // Slides in left to right while it fades. Tailwind v4 translate
        // utilities write the `translate` property, not `transform`, so the
        // transition has to name `translate` or the move snaps in one frame.
        <span
          aria-hidden={!shown}
          className={cn(
            "pointer-events-none absolute top-9 right-52 left-[3.375rem] z-10 block -translate-y-1/2 overflow-hidden text-ellipsis whitespace-nowrap text-[13px] font-medium tracking-[-0.01em] text-[#8a8a8a] transition-[opacity,translate] duration-500 ease-out sm:right-56 sm:left-[4.375rem]",
            shown ? "translate-x-0 opacity-100" : "-translate-x-3 opacity-0",
          )}
        >
          {HERO.title.join(" ")}
        </span>
      )}

      <div className="site-header-content flex min-h-[72px] items-center justify-between gap-5 px-4 py-3.5 transition-opacity duration-700 ease-out sm:px-8">
        <Link
          href="/"
          aria-label="Advanced React Three Fiber, home"
          className="shrink-0 transition-opacity hover:opacity-70"
        >
          <Logo color="currentColor" className="size-6 shrink-0" />
        </Link>

        <div className="flex items-center gap-2.5">
          <Button
            asChild
            size="sm"
            className={cn(
              "h-9 px-4 text-sm transition-shadow duration-500 sm:h-8 sm:text-[0.8rem]",
              solid ? "shadow-none" : "shadow-[0_0_24px_rgba(255,255,255,0.2)]",
            )}
          >
            <a href={REGISTER_URL} target="_blank" rel="noopener noreferrer">
              Register
            </a>
          </Button>

          <SiteMenu
            pathname={pathname}
            className={cn(
              "grid size-9 place-items-center rounded-full border text-muted-foreground transition-colors sm:size-8",
              "hover:border-foreground/25 hover:text-foreground",
              "focus-visible:ring-[3px] focus-visible:ring-ring/50 focus-visible:outline-none",
              solid ? "border-border" : "border-white/15 bg-black/20 backdrop-blur-md",
            )}
          />
        </div>
      </div>

      {home && (
        // Continuous page progress without section markers.
        <div
          className={cn(
            "relative h-0.5 bg-border transition-[opacity,translate] duration-500",
            shown ? "translate-y-0 opacity-100" : "translate-y-0.5 opacity-0",
          )}
        >
          <div
            className="absolute inset-y-0 left-0 bg-foreground"
            style={{ width: `${(progress * 100).toFixed(2)}%` }}
          />
        </div>
      )}
    </header>
  );
}

/**
 * The menu behind the hamburger: a sheet from the right on wide screens, the
 * whole screen on a phone. Every link closes it as it navigates.
 */
function SiteMenu({
  pathname,
  className,
}: {
  pathname: string;
  className?: string;
}) {
  const routes = [
    { href: "/", label: "Home", blurb: "The workshop. Two days in Paris." },
    { href: "/demos", label: "Demos", blurb: "Every scene, running on its own." },
    { href: "/resources", label: "Resources", blurb: "The stack, and where to learn it." },
  ];

  const isCurrent = (href: string) =>
    href === "/" ? pathname === "/" : pathname.startsWith(href);

  return (
    <Dialog.Root>
      <Dialog.Trigger aria-label="Open menu" title="Menu" className={className}>
        <MenuIcon className="size-4" />
      </Dialog.Trigger>

      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 z-50 bg-black/60 backdrop-blur-[2px] data-[state=closed]:animate-out data-[state=closed]:fade-out data-[state=open]:animate-in data-[state=open]:fade-in" />
        <Dialog.Content
          className={cn(
            "fixed inset-y-0 right-0 z-50 flex w-full flex-col border-border bg-card shadow-2xl sm:w-[min(400px,100vw)] sm:border-l",
            "data-[state=closed]:animate-out data-[state=closed]:slide-out-to-right data-[state=open]:animate-in data-[state=open]:slide-in-from-right",
          )}
        >
          <Dialog.Title className="sr-only">Site navigation</Dialog.Title>
          <Dialog.Description className="sr-only">
            Home, demos and resources
          </Dialog.Description>

          <div className="flex min-h-[72px] items-center justify-between px-5 sm:px-6">
            <Logo color="currentColor" className="size-6" />
            <Dialog.Close
              aria-label="Close menu"
              className="-mr-2 grid size-9 place-items-center rounded-md text-muted-foreground transition-colors hover:bg-foreground/5 hover:text-foreground focus-visible:ring-[3px] focus-visible:ring-ring/50 focus-visible:outline-none"
            >
              <XIcon className="size-4" />
            </Dialog.Close>
          </div>

          <nav className="flex-1 px-5 pt-6 sm:px-6">
            <ol>
              {routes.map((r, i) => (
                <li key={r.href} className="border-t border-border last:border-b">
                  <Dialog.Close asChild>
                    <Link
                      href={r.href}
                      aria-current={isCurrent(r.href) ? "page" : undefined}
                      className="group flex items-baseline gap-4 py-5 outline-none focus-visible:bg-foreground/5"
                    >
                      <span className="w-6 shrink-0 font-mono text-[11px] tracking-[0.1em] text-faint">
                        0{i + 1}
                      </span>
                      <span className="min-w-0 flex-1">
                        <span
                          className={cn(
                            "block text-[28px] leading-none font-semibold tracking-[-0.03em] transition-colors",
                            isCurrent(r.href)
                              ? "text-foreground"
                              : "text-muted-foreground group-hover:text-foreground",
                          )}
                        >
                          {r.label}
                        </span>
                        <span className="mt-2 block text-[13px] text-dim">
                          {r.blurb}
                        </span>
                      </span>
                      {isCurrent(r.href) && (
                        <span
                          aria-hidden
                          className="mt-1 size-1.5 shrink-0 self-center rounded-full bg-foreground"
                        />
                      )}
                    </Link>
                  </Dialog.Close>
                </li>
              ))}
            </ol>
          </nav>

          <div className="px-5 pb-6 sm:px-6">
            <Button asChild className="h-11 w-full text-sm">
              <a href={REGISTER_URL} target="_blank" rel="noopener noreferrer">
                Register
                <ArrowUpRightIcon data-icon="inline-end" />
              </a>
            </Button>
            <div className="mt-5 flex items-center justify-between font-mono text-[11px] tracking-[0.06em] text-faint">
              <a href="https://pmnd.rs/" className="transition-colors hover:text-foreground">
                pmnd.rs
              </a>
              <a
                href="https://threejs.paris/"
                className="transition-colors hover:text-foreground"
              >
                threejs.paris
              </a>
            </div>
          </div>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
