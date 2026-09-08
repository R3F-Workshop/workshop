import { ArrowUpRightIcon } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";

import { Toc } from "@/app/resources/components/toc";
import { SiteFooter } from "@/components/site-footer";
import { cn } from "@/lib/utils";

export const metadata: Metadata = {
  title: "Resources — Advanced React Three Fiber",
  description:
    "Links for the stack the workshop is built on: three.js, React Three Fiber, the pmndrs libraries, glTF tooling, WebGPU, courses and community.",
};

/**
 * The link list, in the order it is taught: the renderer first, the React
 * layer over it, then the state and tools around that, then everything that
 * feeds a scene, then where to go afterwards.
 */
const SECTIONS: {
  id: string;
  title: string;
  blurb: string;
  links: {
    title: string;
    href: string;
    note: string;
    /** Version or role, shown beside the host. */
    meta?: string;
    /** Lifts the card to a full row with a larger title. */
    featured?: boolean;
  }[];
}[] = [
  {
    id: "three",
    title: "Three.js",
    blurb:
      "Everything on this site renders through three's WebGPURenderer and its shading language. The docs and examples are the reference the rest of the stack points back to.",
    links: [
      {
        title: "three.js examples",
        href: "https://threejs.org/examples/",
        note: "Hundreds of runnable scenes with source. Filter by webgpu to see the ones that match what the workshop builds.",
        featured: true,
      },
      {
        title: "Documentation",
        href: "https://threejs.org/docs/",
        note: "The API reference. Every class, every property, with the constructor signatures you will be typing.",
      },
      {
        title: "Manual",
        href: "https://threejs.org/manual/",
        note: "The long form guides: fundamentals, materials, textures, lights, cameras, and the how and why behind each.",
      },
      {
        title: "Three.js Shading Language",
        href: "https://github.com/mrdoob/three.js/wiki/Three.js-Shading-Language",
        note: "The TSL wiki. Nodes, uniforms, storage buffers, compute, and how a node graph becomes WGSL or GLSL.",
      },
      {
        title: "TSL transpiler",
        href: "https://threejs.org/examples/webgpu_tsl_transpiler.html",
        note: "Paste GLSL, get TSL. The fastest way to move an old shader onto the node system.",
      },
      {
        title: "TSL editor",
        href: "https://threejs.org/examples/webgpu_tsl_editor.html",
        note: "Write a node graph in the browser and watch the generated shader update as you type.",
      },
      {
        title: "mrdoob/three.js",
        href: "https://github.com/mrdoob/three.js",
        note: "The repository. Read the examples folder and the src/nodes tree, the answers to most TSL questions are in there.",
      },
      {
        title: "three.js editor",
        href: "https://threejs.org/editor/",
        note: "A scene editor in the browser. Handy for inspecting a model or posing a camera before writing any code.",
      },
    ],
  },
  {
    id: "r3f",
    title: "React Three Fiber",
    blurb:
      "The React layer over three. Fiber is the reconciler, drei is the box of helpers, and the examples repo is every official three.js example rebuilt as components.",
    links: [
      {
        title: "react-three-examples",
        href: "https://github.com/pmndrs/react-three-examples",
        note: "The official three.js examples ported to R3F v10, WebGPU first. The same scene, in vanilla and in React, side by side. New for v10.",
        meta: "new",
        featured: true,
      },
      {
        title: "react-three-examples, running",
        href: "https://pmndrs.github.io/react-three-examples/",
        note: "The ports, deployed. Open one, then read the source of the same demo on threejs.org.",
      },
      {
        title: "React Three Fiber docs",
        href: "https://r3f.docs.pmnd.rs/",
        note: "Getting started, the Canvas, hooks, events, and the pointers and gotchas that matter most.",
      },
      {
        title: "pmndrs/react-three-fiber",
        href: "https://github.com/pmndrs/react-three-fiber",
        note: "The repository. Issues and discussions are where v10 and the WebGPU entry are worked out.",
      },
      {
        title: "R3F examples",
        href: "https://r3f.docs.pmnd.rs/getting-started/examples",
        note: "The sandbox gallery from the docs. Small, focused, and forkable.",
      },
      {
        title: "drei docs",
        href: "https://drei.docs.pmnd.rs/",
        note: "Every helper, one page each. Cameras, controls, staging, loaders, shapes, text, and performance tools.",
      },
      {
        title: "pmndrs/drei",
        href: "https://github.com/pmndrs/drei",
        note: "The repository. The workshop runs on the v11 alpha with a patch or two in tooling/patches.",
      },
      {
        title: "drei storybook",
        href: "https://drei.pmnd.rs/",
        note: "Every drei component with live knobs. The quickest way to see what a helper does before importing it.",
      },
      {
        title: "react-three-rapier",
        href: "https://github.com/pmndrs/react-three-rapier",
        note: "Rapier physics as components. The pile of bodies in the closer is this.",
      },
      {
        title: "react-postprocessing",
        href: "https://github.com/pmndrs/react-postprocessing",
        note: "The WebGL post pipeline as components. On WebGPU, three's own post processing nodes take its place.",
      },
      {
        title: "uikit",
        href: "https://pmndrs.github.io/uikit/docs/",
        note: "Flexbox layout and UI rendered inside the scene. Buttons, text, images, all as meshes.",
      },
      {
        title: "xr",
        href: "https://pmndrs.github.io/xr/docs/",
        note: "WebXR for R3F: headsets, controllers, hands, and the interaction handles that go with them.",
      },
      {
        title: "pmndrs docs",
        href: "https://docs.pmnd.rs/",
        note: "The index of every documented pmndrs library, in one place.",
      },
    ],
  },
  {
    id: "state",
    title: "State and utilities",
    blurb:
      "The pmndrs state libraries share one idea: keep the store outside React and subscribe to slices, so a frame loop can read without a render. Pick by flavour.",
    links: [
      {
        title: "zustand",
        href: "https://zustand.docs.pmnd.rs/",
        note: "One store, plain functions, transient subscriptions. The default for scene state you read in useFrame.",
        meta: "store",
      },
      {
        title: "jotai",
        href: "https://jotai.org/",
        note: "Atoms. Bottom up, composable, and suspense aware. Good when state is many small independent values.",
        meta: "atoms",
      },
      {
        title: "valtio",
        href: "https://valtio.dev/",
        note: "A proxy you mutate. Components track what they read. Feels closest to writing to a three object.",
        meta: "proxy",
      },
      {
        title: "koota",
        href: "https://github.com/pmndrs/koota",
        note: "An entity component system with React bindings. Traits, queries, and systems for scenes with a lot of things in them.",
        meta: "ecs",
      },
      {
        title: "react-spring",
        href: "https://react-spring.dev/",
        note: "Spring physics animation that writes to the target directly. The @react-spring/three entry animates three objects without re-rendering.",
      },
      {
        title: "use-gesture",
        href: "https://use-gesture.netlify.app/",
        note: "Drag, pinch, wheel, and hover as hooks. Pairs with react-spring for gesture driven motion.",
      },
      {
        title: "leva",
        href: "https://github.com/pmndrs/leva",
        note: "The control panel behind every demo here. useControls declares a knob, the panel appears.",
      },
      {
        title: "maath",
        href: "https://github.com/pmndrs/maath",
        note: "Small math helpers: damping, easing, random distributions on shapes, buffer utilities.",
      },
      {
        title: "suspend-react",
        href: "https://github.com/pmndrs/suspend-react",
        note: "Suspense for any async value, keyed and cached. What useLoader is built on.",
      },
      {
        title: "detect-gpu",
        href: "https://github.com/pmndrs/detect-gpu",
        note: "Classifies the GPU into a tier from a benchmark table so a scene can pick its own quality.",
      },
      {
        title: "pmndrs/zustand",
        href: "https://github.com/pmndrs/zustand",
        note: "The zustand repository.",
      },
      {
        title: "pmndrs/jotai",
        href: "https://github.com/pmndrs/jotai",
        note: "The jotai repository.",
      },
      {
        title: "pmndrs/valtio",
        href: "https://github.com/pmndrs/valtio",
        note: "The valtio repository.",
      },
      {
        title: "pmndrs/react-spring",
        href: "https://github.com/pmndrs/react-spring",
        note: "The react-spring repository.",
      },
    ],
  },
  {
    id: "gltf",
    title: "glTF and assets",
    blurb:
      "A scene is mostly what you feed it. These are the tools to inspect a model, shrink it, turn it into components, and the places to find one to begin with.",
    links: [
      {
        title: "gltf.report",
        href: "https://gltf.report/",
        note: "Drop a glTF in and see what it costs: draw calls, vertices, texture memory, materials, and where the bytes went. Run a transform script right there.",
        featured: true,
      },
      {
        title: "glTF Transform",
        href: "https://gltf-transform.dev/",
        note: "The CLI and library behind gltf.report. Draco and meshopt compression, KTX2 textures, dedupe, prune, resample, and a scripting API for your own passes.",
        featured: true,
      },
      {
        title: "gltfjsx",
        href: "https://gltf.pmnd.rs/",
        note: "Turns a glTF into a typed React component with every node named and every material reused. Paste the result in and edit it like any JSX.",
        featured: true,
      },
      {
        title: "pmndrs/gltfjsx",
        href: "https://github.com/pmndrs/gltfjsx",
        note: "The CLI version, with the flags for instancing, transforms, and TypeScript output.",
      },
      {
        title: "donmccurdy/glTF-Transform",
        href: "https://github.com/donmccurdy/glTF-Transform",
        note: "The repository, and the place to read how each transform works.",
      },
      {
        title: "gltfpack",
        href: "https://meshoptimizer.org/gltf/",
        note: "The meshoptimizer CLI. One command to quantize, compress, and simplify a model for the web.",
      },
      {
        title: "three glTF viewer",
        href: "https://gltf-viewer.donmccurdy.com/",
        note: "Preview a model the way three will render it, with the environment and lights you can toggle.",
      },
      {
        title: "Khronos sample viewer",
        href: "https://github.khronos.org/glTF-Sample-Viewer-Release/",
        note: "The reference renderer. If a material looks wrong in three, check it here first.",
      },
      {
        title: "glTF validator",
        href: "https://github.khronos.org/glTF-Validator/",
        note: "Checks a file against the spec and lists every error and warning.",
      },
      {
        title: "glTF sample assets",
        href: "https://github.com/KhronosGroup/glTF-Sample-Assets",
        note: "The models everyone tests against, one per feature of the format.",
      },
      {
        title: "glTF 2.0 spec",
        href: "https://registry.khronos.org/glTF/specs/2.0/glTF-2.0.html",
        note: "The format itself. Shorter than you would expect and worth reading once.",
      },
      {
        title: "Blender",
        href: "https://www.blender.org/",
        note: "Where most glTF files come from. Its exporter is the reference implementation.",
      },
      {
        title: "Poly Haven",
        href: "https://polyhaven.com/",
        note: "HDRIs, textures, and models, all public domain. The environment maps in drei's presets come from here.",
      },
      {
        title: "ambientCG",
        href: "https://ambientcg.com/",
        note: "PBR material sets under CC0, in every resolution.",
      },
      {
        title: "Kenney",
        href: "https://kenney.nl/assets",
        note: "Thousands of low poly game assets, free to use. Perfect for prototyping a scene.",
      },
      {
        title: "Quaternius",
        href: "https://quaternius.com/",
        note: "Stylised low poly packs, rigged and animated, CC0.",
      },
      {
        title: "Sketchfab",
        href: "https://sketchfab.com/",
        note: "The largest library of downloadable models. Filter by downloadable and check the licence.",
      },
      {
        title: "pmndrs/assets",
        href: "https://github.com/pmndrs/assets",
        note: "HDRIs, fonts, and textures packaged as imports, so a sandbox can pull one in without hosting it.",
      },
    ],
  },
  {
    id: "webgpu",
    title: "WebGPU",
    blurb:
      "The demos here have no WebGL fallback by design. These explain what the renderer is talking to, and where it runs today.",
    links: [
      {
        title: "WebGPU Fundamentals",
        href: "https://webgpufundamentals.org/",
        note: "The long tutorial series. Read the first few chapters and TSL's storage buffers and compute passes stop being mysterious.",
        featured: true,
      },
      {
        title: "WGSL specification",
        href: "https://gpuweb.github.io/gpuweb/wgsl/",
        note: "The shading language TSL compiles to on WebGPU. Useful when reading generated shaders.",
      },
      {
        title: "webgpureport.org",
        href: "https://webgpureport.org/",
        note: "What your browser's adapter supports: limits, features, and the preferred canvas format.",
      },
      {
        title: "Can I use WebGPU",
        href: "https://caniuse.com/webgpu",
        note: "Browser support, kept current.",
      },
    ],
  },
  {
    id: "react",
    title: "React and the app",
    blurb:
      "R3F is just React, so the React docs apply in full. The rest of this site is the usual stack around it.",
    links: [
      {
        title: "react.dev",
        href: "https://react.dev/",
        note: "The React docs. Learn covers the mental model, Reference covers every hook and API.",
        featured: true,
      },
      {
        title: "React reference",
        href: "https://react.dev/reference/react",
        note: "Hooks, components, and APIs. useRef, useMemo, and Suspense are the ones R3F leans on hardest.",
      },
      {
        title: "React Compiler",
        href: "https://react.dev/learn/react-compiler",
        note: "Automatic memoisation. This site runs it, and its lint rules are why the scene folders opt out of a few.",
      },
      {
        title: "Next.js docs",
        href: "https://nextjs.org/docs",
        note: "The App Router. Every experience here is loaded through a dynamic import with ssr off, which is the one rule that matters for R3F.",
      },
      {
        title: "Tailwind CSS",
        href: "https://tailwindcss.com/docs",
        note: "Version 4, configured in CSS. Every class on this site is from here.",
      },
      {
        title: "shadcn/ui",
        href: "https://ui.shadcn.com/",
        note: "The component recipes in src/components/ui. Copied in, not installed.",
      },
      {
        title: "Radix Primitives",
        href: "https://www.radix-ui.com/primitives",
        note: "The unstyled dialogs, accordions, and menus underneath shadcn. The menu in the header is one.",
      },
      {
        title: "Lucide",
        href: "https://lucide.dev/",
        note: "The icon set.",
      },
    ],
  },
  {
    id: "workshop",
    title: "Used in the workshop",
    blurb:
      "The exact packages the repo installs, with the versions it pins. Several are alphas, which is the point: v10 is the WebGPU release.",
    links: [
      {
        title: "three",
        href: "https://github.com/mrdoob/three.js",
        note: "The renderer, the node system, and the addons folder.",
        meta: "r185",
      },
      {
        title: "@react-three/fiber",
        href: "https://github.com/pmndrs/react-three-fiber",
        note: "v10, imported from the webgpu entry. The TSL hooks and the shared canvas store are new here.",
        meta: "10.0.0-alpha.4",
      },
      {
        title: "@react-three/drei",
        href: "https://github.com/pmndrs/drei",
        note: "v11, rebuilt for the WebGPU renderer.",
        meta: "11.0.0-alpha.7",
      },
      {
        title: "@react-three/rapier",
        href: "https://github.com/pmndrs/react-three-rapier",
        note: "Physics for the connectors scene.",
        meta: "2.2.0",
      },
      {
        title: "@pmndrs/sky",
        href: "https://github.com/pmndrs/sky",
        note: "A physical Hillaire atmosphere in TSL. One number, the hour, drives the whole hero.",
        meta: "0.1.4",
      },
      {
        title: "@pmndrs/glyph",
        href: "https://github.com/pmndrs/glyph",
        note: "Text rendering for the WebGPU renderer. The wordmark in the hero.",
        meta: "canary",
      },
      {
        title: "@pmndrs/upscaler",
        href: "https://github.com/pmndrs/upscaler",
        note: "FSR3 reconstruction. The full hero renders at a lower resolution and upscales.",
        meta: "0.2.0",
      },
      {
        title: "camera-controls",
        href: "https://github.com/yomotsu/camera-controls",
        note: "The camera controller drei wraps. Smooth damping, fit to box, and a dolly that respects the scene.",
        meta: "3.1.2",
      },
      {
        title: "leva",
        href: "https://github.com/pmndrs/leva",
        note: "Every tunable on a demo page.",
        meta: "0.10.1",
      },
      {
        title: "Rapier",
        href: "https://rapier.rs/",
        note: "The physics engine itself, compiled to WebAssembly.",
      },
      {
        title: "opentype.js",
        href: "https://opentype.js.org/",
        note: "Reads font outlines. Used offline to generate the glyph geometry for the ten sided box.",
        meta: "2.0.0",
      },
    ],
  },
  {
    id: "learn",
    title: "Courses and people",
    blurb:
      "The teachers this community learned from. Bruno's course is the canonical start, the rest go deeper in their own directions.",
    links: [
      {
        title: "Three.js Journey",
        href: "https://threejs-journey.com/",
        note: "Bruno Simon's course. Ninety hours from a first cube to shaders, physics, and R3F. If you take one course, take this one.",
        meta: "Bruno Simon",
        featured: true,
      },
      {
        title: "bruno-simon.com",
        href: "https://bruno-simon.com/",
        note: "The portfolio that made a generation of developers want to learn three.js.",
        meta: "Bruno Simon",
      },
      {
        title: "SimonDev",
        href: "https://simondev.io/",
        note: "Courses on shaders and on the GLSL and math underneath them, from a veteran game graphics engineer.",
        meta: "Simon Dev",
      },
      {
        title: "SimonDev on YouTube",
        href: "https://www.youtube.com/@simondev758",
        note: "Deep dives on rendering, optimisation, and how real engines do it.",
        meta: "Simon Dev",
      },
      {
        title: "Wawa Sensei",
        href: "https://wawasensei.dev/",
        note: "Project based R3F teaching. Build a thing, then another, each one a little harder.",
        meta: "Wawa Sensei",
      },
      {
        title: "React Three Fiber Ultimate Guide",
        href: "https://wawasensei.dev/courses/react-three-fiber",
        note: "Wawa's full R3F course, from the Canvas to shaders and post processing.",
        meta: "Wawa Sensei",
      },
      {
        title: "Wawa Sensei on YouTube",
        href: "https://www.youtube.com/@WawaSensei",
        note: "The free lessons. Dozens of complete R3F builds, start to finish.",
        meta: "Wawa Sensei",
      },
      {
        title: "Maxime Heckel",
        href: "https://blog.maximeheckel.com/",
        note: "Long, careful articles on R3F, shaders, and post processing. Every one is a small course.",
      },
      {
        title: "Yuri Artiukh",
        href: "https://www.youtube.com/@akella_",
        note: "Live coding creative WebGL effects, the way an agency would ship them.",
      },
      {
        title: "Discover three.js",
        href: "https://discoverthreejs.com/",
        note: "A free book on three fundamentals, written to be read in order.",
      },
      {
        title: "The Book of Shaders",
        href: "https://thebookofshaders.com/",
        note: "Fragment shaders from nothing. The chapters on shaping functions and noise are the foundation for TSL too.",
      },
      {
        title: "Inigo Quilez",
        href: "https://iquilezles.org/articles/",
        note: "Signed distance fields, raymarching, and the maths of procedural graphics, from the source.",
      },
      {
        title: "Shadertoy",
        href: "https://www.shadertoy.com/",
        note: "Thousands of fragment shaders with source. The transpiler above turns them into TSL.",
      },
      {
        title: "Codrops",
        href: "https://tympanus.net/codrops/",
        note: "Tutorials and demos on the effects agencies actually ship, with the code.",
      },
      {
        title: "drcmda on CodeSandbox",
        href: "https://codesandbox.io/u/drcmda",
        note: "Paul Henschel's sandboxes. Hundreds of R3F patterns, each one a screen of code.",
        meta: "Paul Henschel",
      },
    ],
  },
  {
    id: "community",
    title: "Community",
    blurb: "Where to ask, and where the people who wrote these libraries answer.",
    links: [
      {
        title: "Poimandres Discord",
        href: "https://discord.gg/poimandres",
        note: "The pmndrs server. Channels for fiber, drei, zustand, and the rest, with the maintainers in them.",
        featured: true,
      },
      {
        title: "three.js forum",
        href: "https://discourse.threejs.org/",
        note: "The long running three.js discourse. Searchable, and most questions have already been asked.",
      },
      {
        title: "three.js Discord",
        href: "https://discord.gg/56GBJwAnUS",
        note: "The official three.js server.",
      },
      {
        title: "R3F discussions",
        href: "https://github.com/pmndrs/react-three-fiber/discussions",
        note: "Longer questions and proposals on the fiber repository.",
      },
      {
        title: "r/threejs",
        href: "https://www.reddit.com/r/threejs/",
        note: "Show and tell, mostly.",
      },
      {
        title: "threejs.paris",
        href: "https://threejs.paris/",
        note: "The conference this workshop runs alongside.",
      },
    ],
  },
];

const host = (href: string) => new URL(href).hostname.replace(/^www\./, "");

export default function ResourcesPage() {
  return (
    <>
      <main className="mx-auto max-w-[1180px] px-5 pt-28 pb-20 sm:px-8 md:pt-36 md:pb-28">
        <div className="max-w-[720px]">
          <div className="eyebrow">Resources</div>
          <h1 className="mt-3 text-[34px] leading-[1.05] font-semibold tracking-[-0.035em] md:text-[48px]">
            The stack, and where to learn it
          </h1>
          <p className="mt-5 text-base leading-[1.65] text-muted-foreground md:text-[17px]">
            Everything the workshop stands on, with a line on why each link is
            here. The order follows the two days: the renderer, the React layer
            over it, the state and tools around that, what feeds a scene, and
            where to keep going afterwards.
          </p>
        </div>

        <div className="mt-12 flex flex-col gap-8 lg:mt-16 lg:grid lg:grid-cols-[200px_minmax(0,1fr)] lg:gap-16">
          {/* A flex column rather than a grid below lg, so the sticky chip row
              is bounded by the whole page and not by its own short row. */}
          <aside className="sticky top-[72px] z-30 -mx-5 border-b border-border bg-background/85 px-5 py-3 backdrop-blur-md sm:-mx-8 sm:px-8 lg:top-24 lg:mx-0 lg:self-start lg:border-0 lg:bg-transparent lg:px-0 lg:py-0 lg:backdrop-blur-none">
            <Toc items={SECTIONS.map(({ id, title }) => ({ id, title }))} />
          </aside>

          <div className="min-w-0">
            {SECTIONS.map((section, i) => (
              <section
                key={section.id}
                id={section.id}
                aria-labelledby={`${section.id}-title`}
                className="scroll-mt-36 border-t border-border py-10 first:border-t-0 first:pt-0 lg:scroll-mt-28 lg:py-14"
              >
                <div className="eyebrow">
                  {String(i + 1).padStart(2, "0")} · {section.title}
                </div>
                <h2
                  id={`${section.id}-title`}
                  className="mt-3 text-[26px] leading-[1.1] font-semibold tracking-[-0.03em] md:text-[32px]"
                >
                  {section.title}
                </h2>
                <p className="mt-3 max-w-[640px] text-[15px] leading-[1.65] text-muted-foreground">
                  {section.blurb}
                </p>

                <ul className="mt-7 grid gap-3 sm:grid-cols-2">
                  {section.links.map((link) => (
                    <li
                      key={link.href}
                      className={cn(link.featured && "sm:col-span-2")}
                    >
                      <a
                        href={link.href}
                        target="_blank"
                        rel="noopener noreferrer"
                        className={cn(
                          "group flex h-full flex-col rounded-xl border border-border bg-card p-4 transition-colors hover:border-foreground/25 focus-visible:border-foreground/40 focus-visible:outline-none sm:p-5",
                          link.featured && "sm:flex-row sm:items-start sm:gap-8",
                        )}
                      >
                        <div className={cn("min-w-0", link.featured && "sm:w-[280px] sm:shrink-0")}>
                          <div className="flex items-start justify-between gap-3">
                            <span
                              className={cn(
                                "font-semibold tracking-[-0.02em]",
                                link.featured ? "text-[19px] md:text-[22px]" : "text-[15.5px]",
                              )}
                            >
                              {link.title}
                            </span>
                            <ArrowUpRightIcon className="mt-1 size-4 shrink-0 text-faint transition-[color,translate] group-hover:translate-x-0.5 group-hover:-translate-y-0.5 group-hover:text-foreground" />
                          </div>
                          <div className="mt-1.5 flex flex-wrap items-center gap-x-2.5 gap-y-1 font-mono text-[10.5px] text-faint">
                            <span>{host(link.href)}</span>
                            {link.meta && (
                              <span className="rounded border border-border px-1.5 py-px text-dim">
                                {link.meta}
                              </span>
                            )}
                          </div>
                        </div>
                        <p
                          className={cn(
                            "text-[13.5px] leading-[1.6] text-muted-foreground",
                            link.featured ? "mt-3 sm:mt-1" : "mt-3",
                          )}
                        >
                          {link.note}
                        </p>
                      </a>
                    </li>
                  ))}
                </ul>
              </section>
            ))}

            <div className="flex flex-wrap gap-x-6 gap-y-2 border-t border-border pt-8">
              <Link
                href="/demos"
                className="text-[14px] text-foreground underline underline-offset-4"
              >
                The demos →
              </Link>
              <Link
                href="/"
                className="text-[14px] text-muted-foreground underline underline-offset-4 hover:text-foreground"
              >
                Back to the workshop
              </Link>
            </div>
          </div>
        </div>
      </main>
      <SiteFooter />
    </>
  );
}
