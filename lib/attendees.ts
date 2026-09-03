/** Content for the gated attendee guide at /attendees/<code>. */

/** Not security: obscurity, and proportionate for ~40 people. */
export const ACCESS_CODES = ["paris2026", "supersecret"] as const;

/** @notion 01 · Prerequisites: c370baf6-0216-8395-8da1-013edd909459 */
export const SETUP = {
  heading: "Do this at home, before you travel",
  lede: "Fifteen minutes, once, on your own network. Forty people pulling node_modules over conference wifi is the only thing that reliably wrecks a hands-on day — and it is entirely avoidable.",
  command: `git clone https://github.com/R3F-Workshop/d1-workshop.git
cd d1-workshop
pnpm install     # installs everything for both days, once
pnpm verify      # checks node version + deps
pnpm dev         # open the localhost URL`,
  done: "If it runs at home, Day 1 setup is a non-event. Close it and come along.",
  note: "Clone it — don't degit. degit strips git history, and the checkpoints you'll use all day are branches.",
};

/** @notion 01 · Prerequisites: c370baf6-0216-8395-8da1-013edd909459 */
export const REQUIREMENTS = [
  {
    a: "Node",
    b: "22 LTS · 20+ works",
    c: "Use fnm, nvm, or volta — the repo has an .nvmrc",
  },
  { a: "Package manager", b: "pnpm", c: "corepack enable — npm works too" },
  { a: "Git", b: "any recent version", c: "" },
  {
    a: "Browser",
    b: "WebGPU required",
    c: "Current Chrome, Edge, Safari, or Firefox — check yours below",
  },
  {
    a: "Hardware acceleration",
    b: "on",
    c: "The usual culprit behind a black canvas",
  },
  {
    a: "Laptop",
    b: "anything from the last few years",
    c: "Integrated graphics runs every demo",
  },
];

/** WebGPU is a hard requirement now that the workshop runs on v10: worth a 10-second check at home rather than a surprise at 09:30 on Day 1. */
export const WEBGPU_CHECK = {
  heading: "Check WebGPU before you travel",
  body: "We work in R3F v10 on WebGPU. Open your browser console and run this. An object means you're set; null or an error means update your browser, or turn hardware acceleration on.",
  command: "await navigator.gpu?.requestAdapter()",
};

/** @notion 08 · Day 1 Attendee Guide: 0a30baf6-0216-830f-9320-81d9bde47338 */
export const CHECKPOINTS = {
  heading: "How the day works",
  lede: "Every demo is a chain of runnable checkpoints. Fall behind and you rejoin with one command — you will not be left stranded at the back of the room.",
  command: `pnpm steps              # list checkpoints
pnpm step hello 1       # jump to one (stashes your work first)
git diff demo-hello/step-02 demo-hello/step-03`,
  after:
    "Ahead of the room instead? Every demo ends with stretch goals. One install covers the whole workshop, so switching branches never reinstalls.",
};

/** @notion 10 · Troubleshooting Cheat Sheet: 3980baf6-0216-83ce-9cd3-814488a417e9 */
export const TROUBLESHOOTING = [
  {
    group: "Setup and install",
    items: [
      {
        q: "Wrong Node version",
        a: "fnm use 22 or nvm use 22 — the repo has an .nvmrc.",
      },
      {
        q: "pnpm: command not found",
        a: "corepack enable, then reopen your terminal. Or just use npm.",
      },
      {
        q: "Install hangs or crawls on wifi",
        a: "This is why we install at home. Tether to your phone, or find a floater for the local mirror.",
      },
      { q: "pnpm verify fails on deps", a: "Re-run pnpm install." },
    ],
  },
  {
    group: "Runtime",
    items: [
      {
        q: "Black or blank canvas",
        a: "Turn on browser hardware acceleration. Then GPU drivers, then try another browser.",
      },
      {
        q: "Nothing visible at all",
        a: "No light in the scene, or the camera isn't pointed at the object. Almost always one of those two.",
      },
      {
        q: "Low FPS",
        a: "A big unoptimised model, too many objects, or other GPU-heavy tabs. Close them first.",
      },
      {
        q: "Port already in use",
        a: "Vite bumps the port automatically — use the URL it prints.",
      },
    ],
  },
  {
    group: "Git and checkpoints",
    items: [
      {
        q: "git switch refused — local changes",
        a: "pnpm step stashes for you. Otherwise commit or git stash first.",
      },
      {
        q: "Where did my code go?",
        a: "It's in a labelled stash. git stash list, then git stash pop.",
      },
      {
        q: "Checkpoints aren't showing",
        a: "Make sure you git cloned rather than degit'd. pnpm steps reads local and remote branches.",
      },
    ],
  },
];

export const DAY_OF = [
  { k: "Venue", v: "Gobelins, Paris" },
  { k: "Day 1", v: "Tuesday Sep 8" },
  { k: "Day 2", v: "Wednesday Sep 9" },
  { k: "Doors", v: "09:00" },
  { k: "Bring", v: "Laptop and charger" },
  { k: "Power", v: "At every seat" },
];

/** The link lands in the reminder email: until then the note renders. */
export const HELP_CHANNEL = {
  label: "Help channel",
  note: "Link to follow before the workshop — it will be in your reminder email.",
  href: null as string | null,
};
