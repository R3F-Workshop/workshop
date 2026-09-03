import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Next's dev indicator defaults to bottom-left, which is exactly where the demo pages put their info button.
  devIndicators: { position: "bottom-right" },

  turbopack: {
    resolveAlias: {
      // Breaks an import cycle in R3F v10 alpha 3 that otherwise makes the first `@react-three/fiber/webgpu` import throw.
      "three/addons/inspector/Inspector.js": "./lib/three-inspector-stub.ts",
    },
  },
};

export default nextConfig;
