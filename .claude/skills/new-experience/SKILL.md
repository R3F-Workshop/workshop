---
name: new-experience
description: Scaffold a new 3D experience folder under src/app/experiences plus its demo page. Use when asked to "make a new experience", "new experience setup for X", "scaffold an experience", or to start a new demo beat.
argument-hint: <slug> [vanilla] [section=<section-folder>]
---

Scaffold an experience named `$ARGUMENTS`. The first word is the slug (kebab case). If the word `vanilla` is present, make the vanilla three.js variant. If `section=<name>` is present, also add a section shell under `src/app/home/sections/<name>/components/`.

Read the `# Experiences` section of AGENTS.md first. Do exactly these steps and nothing more. Do not add config files, shared wrappers, Leva, or an InfoDialog unless asked.

1. Derive `Name` as the PascalCase of the slug and `Title` as the slug with spaces and a capital first letter.

2. Create `src/app/experiences/<slug>/<slug>.tsx`. For the R3F variant:

```tsx
"use client";

import { Canvas, useFrame } from "@react-three/fiber/webgpu";
import { useRef } from "react";
import type { Mesh } from "three";

import { useWebGPU } from "@/lib/use-webgpu";

function Scene() {
  const ref = useRef<Mesh>(null);

  useFrame(({ delta }) => {
    if (ref.current) ref.current.rotation.y += delta * 0.5;
  });

  return (
    <>
      <ambientLight intensity={0.5} />
      <directionalLight position={[4, 6, 3]} intensity={2} />
      <mesh ref={ref}>
        <boxGeometry />
        <meshStandardMaterial color="#96a0c8" />
      </mesh>
    </>
  );
}

export function <Name>() {
  // No WebGPU, no experience. The shell around this decides what to show instead.
  if (useWebGPU() !== "yes") return null;

  return (
    <div className="absolute inset-0">
      <Canvas
        camera={{ position: [0, 1, 5], fov: 40 }}
        dpr={[1, 2]}
        renderer={{ alpha: false, antialias: true }}
      >
        <color attach="background" args={["#08080a"]} />
        <Scene />
      </Canvas>
    </div>
  );
}
```

For the vanilla variant, copy the two-file shape of `src/app/experiences/vanilla-pyramid/` instead: a `<slug>.ts` exporting `mount<Name>(canvas: HTMLCanvasElement)` that draws into the given canvas and returns a dispose function, and a `<slug>.tsx` that is a `<canvas>` plus an effect calling it. The React side owns the element on purpose, so the comparison against `<Canvas>` is one element against one component. Start the `.ts` file from a renderer, a scene, a camera, one mesh, a loop, a resize observer, and a dispose.

3. Create `src/app/experiences/<slug>/index.ts`:

```ts
"use client";

import dynamic from "next/dynamic";

export const <Name> = dynamic(
  () => import("./<slug>").then((m) => m.<Name>),
  { ssr: false },
);
```

4. Create `src/app/demos/<slug>/page.tsx`. Copy the shape of `src/app/demos/blending-cube/page.tsx` with the title plate only, no InfoDialog: `metadata` with `robots: { index: false, follow: false }`, a `<main className="relative h-dvh w-full overflow-hidden bg-background">`, the component, and the title plate div with the eyebrow `Demo · <Title>`.

5. Add an entry to `DEMOS` in `src/app/demos/page.tsx` with `href: "/demos/<slug>"`, `title: "<Title>"`, a one line blurb, and an empty or short `tags` array.

6. If `section=<name>` was given, create `src/app/home/sections/<name>/components/<slug>-canvas.tsx` that renders `<<Name> />` from `@/app/experiences/<slug>` inside a `relative` box, and say in the report where the section should mount it. Do not edit the section file itself.

7. Run `pnpm exec eslint` on every file you created and `pnpm exec tsc --noEmit`. Fix what you broke. Do not commit.

Report the files created and the demo URL `/demos/<slug>`.
