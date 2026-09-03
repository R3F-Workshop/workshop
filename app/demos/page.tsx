import type { Metadata } from "next";
import Link from "next/link";

export const metadata: Metadata = {
  title: "Demos — Advanced React Three Fiber",
  robots: { index: false, follow: false },
};

/** The one standalone piece still on this site. The rest moved to the demos repo. */
const DEMOS = [
  {
    href: "/demos/hero-simple",
    title: "Paris hero, the simple version",
    blurb:
      "The hero as it is built on day one: the tower over an instanced city under a physical sky, a wordmark in the scene, and one bloom pass. About seven hundred lines, every file one lesson.",
    tags: ["instancing", "@pmndrs/sky", "useRenderPipeline"],
  },
];

export default function DemosPage() {
  return (
    <main className="mx-auto max-w-[900px] px-5 py-16 sm:px-8 md:py-24">
      <div className="font-mono text-[11px] tracking-[0.13em] text-faint uppercase">
        Demos
      </div>
      <h1 className="mt-2 text-[32px] leading-[1.05] font-semibold tracking-[-0.035em] md:text-[42px]">
        Made with R3F v10
      </h1>
      <p className="mt-4 max-w-[620px] text-base leading-[1.65] text-muted-foreground">
        The simple hero, running on its own. It needs WebGPU, there is no WebGL
        fallback, by design. The other demos live in the{" "}
        <a
          href="https://github.com/R3F-Workshop/demos"
          className="text-foreground underline underline-offset-4"
        >
          demos repo
        </a>
        .
      </p>

      <ul className="mt-10 grid gap-4">
        {DEMOS.map((d) => (
          <li key={d.href}>
            <Link
              href={d.href}
              className="block rounded-xl border border-border bg-card p-5 transition-colors hover:border-foreground/20 sm:p-6"
            >
              <div className="text-[19px] font-semibold tracking-[-0.02em]">
                {d.title}
              </div>
              <p className="mt-2 text-[15px] leading-[1.6] text-muted-foreground">
                {d.blurb}
              </p>
              <div className="mt-3.5 flex flex-wrap gap-2">
                {d.tags.map((t) => (
                  <span
                    key={t}
                    className="rounded-md border border-border px-2 py-1 font-mono text-[10.5px] text-faint"
                  >
                    {t}
                  </span>
                ))}
              </div>
            </Link>
          </li>
        ))}
      </ul>

      <Link
        href="/"
        className="mt-10 inline-block text-[14px] text-muted-foreground underline underline-offset-4 hover:text-foreground"
      >
        ← Back to the workshop
      </Link>
    </main>
  );
}
