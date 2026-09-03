import { defineConfig, globalIgnores } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";
import nextTs from "eslint-config-next/typescript";

const eslintConfig = defineConfig([
  ...nextVitals,
  ...nextTs,
  // Override default ignores of eslint-config-next.
  globalIgnores([
    // Default ignores of eslint-config-next:
    ".next/**",
    "out/**",
    "build/**",
    "next-env.d.ts",
    // Archived static reference that is not built.
    "reference/**",
    // Build output copied in by `pnpm sync:sky` is not linted here.
    "vendor/**",
    // Agent worktrees, each a full checkout with its own node_modules.
    ".claude/**",
  ]),
  {
    // React Three Fiber drives three.js by mutating objects the renderer owns: `useFrame` exists to write to `camera`, materials.
    files: [
      "app/home/sections/hero/**/*.tsx",
      "app/home/sections/*/components/**/*.tsx",
      "app/home/components/canvas/**/*.tsx",
      "app/demos/*/components/**/*.tsx",
      "app/demos/components/webgpu-gate.tsx",
      "components/depth-attachment-sync.tsx",
      "components/leva-panel.tsx",
      "resources/**/*.tsx",
    ],
    rules: {
      "react-hooks/immutability": "off",
      "react-hooks/refs": "off",
    },
  },
  {
    // Vendored verbatim from three.js / Faraz's demo so it stays diffable against upstream.
    files: ["resources/tower-scene/ssao-node.js"],
    rules: {
      "@typescript-eslint/no-unused-vars": "off",
      "prefer-const": "off",
    },
  },
]);

export default eslintConfig;
