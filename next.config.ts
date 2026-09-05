import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  reactCompiler: true,
  // Next's dev indicator defaults to bottom-left, which is exactly where the demo pages put their info button.
  devIndicators: { position: "bottom-right" },
};

export default nextConfig;
