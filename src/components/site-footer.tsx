import { LogoFull } from "@/components/brand/logo";

/**
 * `z-20` for the same reason the closer has it: the physics container behind
 * this band is a sibling rather than a descendant, so the footer's own contents
 * have to be lifted over it explicitly. See `app/page.tsx`.
 */
export function SiteFooter() {
  return (
    <footer className="relative z-20 flex flex-wrap items-center justify-between gap-4 border-t border-border px-4 py-9 font-mono text-xs text-faint sm:px-6 lg:px-10">
      <div className="flex items-center gap-3.5">
        <LogoFull color="currentColor" className="h-5 w-auto text-foreground" />
        <span>Advanced React Three Fiber</span>
      </div>
      <div className="flex items-center gap-5">
        <a href="https://threejs.paris/" className="hover:text-foreground">
          threejs.paris
        </a>
        <a href="https://pmnd.rs/" className="hover:text-foreground">
          pmnd.rs
        </a>
      </div>
    </footer>
  );
}
