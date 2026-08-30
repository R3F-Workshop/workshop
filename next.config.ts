import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Next's dev indicator defaults to bottom-left, which is exactly where the
  // demo pages put their info button — in dev it sits on top and swallows the
  // click. Production is unaffected either way; this just stops the two
  // fighting locally.
  devIndicators: { position: "bottom-right" },

  turbopack: {
    resolveAlias: {
      // Breaks an import cycle in R3F v10 alpha 3 that otherwise makes the
      // first `@react-three/fiber/webgpu` import throw. See the stub for the
      // full explanation — this should come out when the alpha is fixed.
      "three/addons/inspector/Inspector.js": "./lib/three-inspector-stub.ts",
    },
  },
};

export default nextConfig;
