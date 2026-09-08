import { asset } from "./asset";

/**
 * Every piece of copy on the site, in one place.
 * Lifted from the `renderVals()` block of the original design doc.
 */

export const REGISTER_URL = "https://threejs.paris/workshop";

export const HERO = {
  kicker: "September 8 & 9, 2026 · Gobelins, Paris",
  title: ["Advanced React", "Three Fiber"],
  description:
    "Two focused days about building scalable R3F apps with a couple of pros at three.js conf. First learn how the pieces fit together, then turn that knowledge into something of your own.",
  days: [
    {
      label: "Day 1",
      body: "Learn the full R3F v10 WebGPU stack from staging to reactivity to TSL and postprocessing. We'll break down the Paris hero and more.",
      highlights: ["WebGPU"],
    },
    {
      label: "Day 2",
      body: "Build something amazing. Choose between a game, product editor or creative portfolio.",
      highlights: ["game", "product editor", "creative portfolio"],
    },
  ],
};

/**
 * No seat or capacity claim anywhere on the page, deliberately.
 *
 * The hero said thirty, this strip said forty and the closer said forty, which
 * was three numbers for one fact. Publishing any of them also means maintaining
 * it as places fill. Registration is the honest place for that number.
 */
/**
 * Section chrome: the eyebrow and title each section carries, plus the prose
 * that was otherwise stranded in JSX.
 *
 * Keyed by section id. Structured content — the Why cards, the outcomes, the
 * FAQ — keeps its own export below; this is for the copy that had nowhere
 * else to live.
 */
export const SECTION_COPY = {
  overview: {
    eyebrow: "01 · Overview",
    title: "Learn the pieces, then build with them",
    body: "Day one is teaching: React Three Fiber v10, then the pmndrs ecosystem around it — drei, physics, post, state, and how the pieces fit together. Day two is a hackathon: three tracks, a lead on each, something running by the end of the afternoon.",
    // True of both layers: the live scene when there is WebGPU, the concept
    // frame when there isn't.
    caption: "The block city · at mid distance",
  },
  why: {
    eyebrow: "02 · Why now",
    title: "WebGPU is here, behind an API you already know",
  },
  outcomes: {
    eyebrow: "03 · Outcomes",
    title: "What you leave with",
  },
  instructors: {
    eyebrow: "04 · Instructors",
    title: "Who is teaching",
  },
  setup: {
    eyebrow: "05 · Prerequisites",
    title: "Come in ready",
    audience:
      "This is aimed at React developers who have shipped a scene or two and want to go deeper — comfort with hooks is assumed, and prior R3F exposure helps. You do not need shader or graphics-pipeline experience; day one builds that up properly.",
    // Split around the one word that renders in mono, so the whole sentence
    // stays editable here rather than half of it living in the component.
    installBefore:
      "The one rule that matters: run the install once on your own network before you travel. Forty people pulling ",
    installCode: "node_modules",
    installAfter:
      " over conference wifi is the only thing that reliably wrecks a hands-on day.",
    repo: "We send the repo and a setup check about three weeks ahead. If it runs at home on the machine you are bringing, you are done.",
  },
  faq: {
    eyebrow: "06 · FAQ",
    title: "Questions",
  },
} as const;

/** The closing call to action. Not in SECTION_COPY: it has no eyebrow. */
export const CLOSER = {
  kicker: "September 8 & 9, 2026 · Gobelins, Paris",
  title: "Add the workshop to your conference ticket",
  primary: "Register on threejs.paris",
};

export const FACTS = [
  { k: "Dates", v: "Sep 8 & 9" },
  { k: "Format", v: "In person" },
  { k: "Level", v: "Intermediate" },
];

/** Three workshop-ready features highlighted in the R3F v10 changelog. */
export const WHY = {
  lede: "Explore three of the biggest additions to R3F v10.",
  points: [
    {
      n: "01",
      t: "Declarative WebGL and WebGPU",
      d: "Use one declarative R3F API to build scenes for both WebGL and WebGPU renderers.",
    },
    {
      n: "02",
      t: "A frame loop you can schedule",
      d: "Schedule work dynamically with dependencies, coordinate it across multiple canvases, control tick rates and more.",
    },
    {
      n: "03",
      t: "TSL built into R3F",
      d: "Build uniforms, node graphs and postprocessing with new hooks supported in R3F's core.",
    },
  ],
};

export const OUTCOMES = [
  {
    n: "01",
    t: "A working v10 setup",
    d: "R3F v10 running on your machine, configured the way we would start a real project.",
  },
  {
    n: "02",
    t: "The ecosystem in your head",
    d: "Which pmndrs library solves which problem.",
  },
  {
    n: "03",
    t: "The demos, not just the notes",
    d: "Every demo from day one, running and yours — including the ones on this page.",
  },
];

/**
 * The `role` line is a credential, not a rank.
 *
 * It used to read "Lead instructor" twice and "Assistant" twice, which sorted
 * the room rather than saying anything — and undersold the half of it that
 * matters most: two of these people build the stack being taught. Who runs a
 * track on day two is real information, so it moves into the bio, where it is a
 * fact about the schedule rather than a label on a person.
 */
export interface Instructor {
  name: string;
  role: string;
  bio: string;
  github: string;
  /** Add a public asset path when a small profile photo is available. */
  image?: string;
}

export const PEOPLE: readonly Instructor[] = [
  {
    name: "Dennis Smolek",
    role: "pmndrs core",
    bio: "Author of React Three Fiber v10 and builds production R3F for a living.",
    github: "https://github.com/DennisSmolek",
    image: asset("/instructors/dennis-smolek.jpg"),
  },
  {
    name: "Kris Baumgartner",
    role: "pmndrs core",
    bio: "Poimandres organizer, Koota author, and maintainer of the ecosystem.",
    github: "https://github.com/krispya",
    image: asset("/instructors/kris-baumgartner.png"),
  },
  {
    name: "Faraz Shaikh",
    role: "pmndrs contributor",
    bio: "Senior graphics programmer, technical artist, and maintainer at Poimandres.",
    github: "https://github.com/farazzshaikh",
    image: asset("/instructors/faraz-shaikh.jpg"),
  },
  {
    name: "Ava Lehner",
    role: "Interactive developer",
    bio: "Former education lobbyist turned creative developer working with Poimandres.",
    github: "https://github.com/avalehner",
    image: asset("/instructors/ava-lehner.jpg"),
  },
];

export const PREREQ_GROUPS = [
  {
    title: "You should already know",
    items: [
      { a: "React with hooks", b: "required" },
      { a: "TypeScript basics", b: "helpful" },
      { a: "A first R3F or three.js scene", b: "helpful" },
      { a: "Shader / graphics pipeline work", b: "not needed" },
    ],
  },
  {
    title: "Install before you arrive",
    items: [
      { a: "Node", b: "22 LTS · 20+ works" },
      { a: "pnpm", b: "corepack enable" },
      { a: "Workshop repo", b: "sent ~3 weeks before" },
      { a: "Browser", b: "WebGPU · hardware acceleration on" },
    ],
  },
];

export const FAQS = [
  {
    q: "Do I need a conference ticket?",
    a: "The workshop is an add-on to your three.js conf ticket. Registration for both lives on threejs.paris.",
  },
  {
    q: "Can I use an agent during the workshop?",
    a: "Yes, and we will be. The reason you type it yourself anyway is that 3D fails silently — a wrong colour space or a missing light throws no error, it just looks off. Two days of building by hand is what makes you fast with the tools afterwards.",
  },
  {
    q: "What if my setup breaks on the day?",
    a: "We keep browser mirrors of the morning repos, so you follow along live and fix your local setup at the break. Nobody sits idle.",
  },
  {
    q: "What if I have never written 3D code?",
    a: "You can follow — the morning rebuilds the fundamentals in v10 terms — but the pace assumes you have at least played with a scene before. If you are brand new, run through the R3F getting-started docs before you travel and you will be fine.",
  },
  {
    q: "Do I need an idea for the hackathon?",
    a: "No. Each track is briefed at kickoff on day two and you pick the one you want. Bring an idea if you have one.",
  },
  {
    q: "Will the recordings be available?",
    a: "The workshop is not recorded. You keep the repo, the slides, and whatever your track builds.",
  },
  {
    q: "What hardware should I bring?",
    a: "Any laptop from the last few years — integrated graphics is fine. What matters is a current browser with WebGPU and hardware acceleration switched on. We work in v10 on WebGPU, so check it before you travel; the setup guide tells you how.",
  },
  {
    q: "Is lunch included?",
    a: "Yes, both days, along with two breaks. Tell us about dietary requirements at registration.",
  },
];
