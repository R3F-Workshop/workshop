import { defineConfig, globalIgnores } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";
import nextTs from "eslint-config-next/typescript";
import reactHooks from "eslint-plugin-react-hooks";

const eslintConfig = defineConfig([
  ...nextVitals,
  ...nextTs,
  {
    name: "workshop/react-compiler",
    // Next registers the plugin.
    rules: {
      ...reactHooks.configs.flat["recommended-latest"].rules,
      "react-hooks/exhaustive-deps": "error",
      "react-hooks/incompatible-library": "error",
      "react-hooks/unsupported-syntax": "error",
    },
  },
  {
    // These R3F modules mutate external resources outside React rendering.
    files: [
      "app/home/sections/hero/components/stars.tsx",
      "app/home/sections/why/components/flip-grid/flip-grid.tsx",
      "resources/tower-scene/buildings.tsx",
      "resources/tower-scene/fx.tsx",
      "resources/tower-scene/lettering.tsx",
      "resources/tower-scene/stars.tsx",
    ],
    rules: { "react-hooks/immutability": "off" },
  },
  // Override default ignores of eslint-config-next.
  globalIgnores([
    // Default ignores of eslint-config-next:
    ".next/**",
    "out/**",
    "build/**",
    "next-env.d.ts",
    // Archived static reference that is not built.
    "reference/**",
    // The packed sky tarball, nothing to lint.
    "vendor/**",
    // Agent worktrees, each a full checkout with its own node_modules.
    ".claude/**",
  ]),
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
