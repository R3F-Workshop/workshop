import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Next's dev indicator defaults to bottom-left, which is exactly where the
  // demo pages put their info button — in dev it sits on top and swallows the
  // click. Production is unaffected either way; this just stops the two
  // fighting locally.
  devIndicators: { position: "bottom-right" },
};

export default nextConfig;
