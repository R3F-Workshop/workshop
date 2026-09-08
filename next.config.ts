import type { NextConfig } from "next";

// GitHub Pages serves the site from a repository sub-path and cannot run a
// Node server. The Pages workflow sets both variables. A plain `next build` or
// a Vercel build leaves them unset and keeps the default server output.
const basePath = process.env.NEXT_PUBLIC_BASE_PATH ?? "";
const staticExport = process.env.STATIC_EXPORT === "1";

const nextConfig: NextConfig = {
  // Next's dev indicator defaults to bottom-left, which is exactly where the
  // demo pages put their info button — in dev it sits on top and swallows the
  // click. Production is unaffected either way; this just stops the two
  // fighting locally.
  devIndicators: { position: "bottom-right" },
  basePath,
  ...(staticExport && {
    output: "export",
    // Pages has no image optimizer. Folder style URLs give every route an
    // index.html so deep links work without relying on `.html` lookup.
    images: { unoptimized: true },
    trailingSlash: true,
  }),
};

export default nextConfig;
