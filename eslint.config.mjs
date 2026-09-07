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
    // Archived copy of the original static port — kept for reference, not built.
    "reference/**",
    // Build output copied in by `pnpm sync:sky` — not ours to lint.
    "vendor/**",
    // Agent worktrees, each a full checkout with its own node_modules. Linting
    // them buried the real output under ~18k findings.
    ".claude/**",
  ]),
  {
    // React Three Fiber drives three.js by mutating objects the renderer owns:
    // `useFrame` exists to write to `camera`, materials, and instance matrices
    // every frame. The React Compiler's immutability rules read that as unsafe
    // mutation of a hook's return value — correct for React state, wrong for an
    // imperative renderer. Scoped to the scene; the rest of the app keeps the
    // full rule set.
    //
    // The scene folders are the same story one level up: TSL uniforms are
    // mutable handles you write to from `useFrame`, which is the entire point
    // of a uniform. Every scene lives under app/experiences, and the section
    // shells and canvas helpers around them mutate the same handles.
    files: [
      "app/home/sections/hero/**/*.tsx",
      "app/home/sections/*/components/**/*.tsx",
      "app/experiences/**/*.tsx",
      "app/home/components/canvas/**/*.tsx",
      "app/demos/components/webgpu-gate.tsx",
      "components/depth-attachment-sync.tsx",
      "components/leva-panel.tsx",
    ],
    rules: {
      "react-hooks/immutability": "off",
      "react-hooks/refs": "off",
    },
  },
  {
    // Vendored verbatim from three.js / Faraz's demo so it stays diffable
    // against upstream. Not ours to lint.
    files: ["app/experiences/paris-tower/ssao-node.js"],
    rules: {
      "@typescript-eslint/no-unused-vars": "off",
      "prefer-const": "off",
    },
  },
]);

export default eslintConfig;
