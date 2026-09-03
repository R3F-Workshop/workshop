/** Turns "ten, written six ways" into geometry data for the magic box. */

import { readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import opentype from "opentype.js";

const FONT_DIR = process.argv[2];
if (!FONT_DIR) {
  console.error("usage: node scripts/build-glyphs.mjs <font-dir>");
  process.exit(1);
}

const OUT = new URL("../lib/ten-glyphs.ts", import.meta.url);

/** Curve flattening. 12 is past the point where more segments read on screen. */
const STEPS = 12;
/** Font units are ~1000/em: normalise so a cap-height glyph is roughly 1 unit. */
const EM = 1000;

/** Order is the boxGeometry material-slot order: +x, -x, +y, -y, +z, -z: because the runtime pairs `TEN_GLYPHS[i]` with face slot `i`. */
const FACES = [
  {
    id: "korean",
    text: "십",
    font: "NotoSansKR-Bold.otf",
    script: "Korean",
    // 십 is Sino-Korean: the numeral used for dates, prices and maths.
    note: "Sino-Korean sip — the same numeral as 十, borrowed into hangul.",
  },
  {
    id: "roman",
    text: "X",
    font: "Cinzel[wght].ttf",
    script: "Roman numeral",
    note: "Ten as a tally of two hands, in letterforms cut for Roman stone.",
  },
  {
    id: "devanagari",
    text: "१०",
    font: "NotoSansDevanagari-SemiBold.ttf",
    script: "Devanagari",
    note: "Where the positional zero came from.",
  },
  {
    id: "eastern-arabic",
    text: "١٠",
    font: "NotoSansArabic-SemiBold.ttf",
    script: "Eastern Arabic-Indic",
    note: "The digits actually used in Arabic; ours only borrowed the name.",
  },
  {
    id: "arabic-numerals",
    text: "10",
    font: "NotoSans-SemiBold.ttf",
    script: "Arabic numerals",
    note: "The one everybody reads without thinking.",
  },
  {
    id: "kanji",
    text: "十",
    font: "YujiSyuku-Regular.ttf",
    script: "Japanese / Chinese",
    note: "A complete cross — ten as a finished count, brush-drawn.",
  },
];

const lerp = (a, b, t) => a + (b - a) * t;

function quad(from, cp, to, out) {
  for (let i = 1; i <= STEPS; i++) {
    const t = i / STEPS;
    const ax = lerp(from[0], cp[0], t);
    const ay = lerp(from[1], cp[1], t);
    const bx = lerp(cp[0], to[0], t);
    const by = lerp(cp[1], to[1], t);
    out.push([lerp(ax, bx, t), lerp(ay, by, t)]);
  }
}

function cubic(from, c1, c2, to, out) {
  for (let i = 1; i <= STEPS; i++) {
    const t = i / STEPS;
    const u = 1 - t;
    const w0 = u * u * u;
    const w1 = 3 * u * u * t;
    const w2 = 3 * u * t * t;
    const w3 = t * t * t;
    out.push([
      w0 * from[0] + w1 * c1[0] + w2 * c2[0] + w3 * to[0],
      w0 * from[1] + w1 * c1[1] + w2 * c2[1] + w3 * to[1],
    ]);
  }
}

/** opentype path commands to closed contours of points. */
function toContours(path) {
  const contours = [];
  let current = null;
  let cursor = [0, 0];

  for (const cmd of path.commands) {
    if (cmd.type === "M") {
      if (current && current.length > 2) contours.push(current);
      cursor = [cmd.x, cmd.y];
      current = [cursor];
    } else if (cmd.type === "L") {
      cursor = [cmd.x, cmd.y];
      current.push(cursor);
    } else if (cmd.type === "Q") {
      quad(cursor, [cmd.x1, cmd.y1], [cmd.x, cmd.y], current);
      cursor = [cmd.x, cmd.y];
    } else if (cmd.type === "C") {
      cubic(cursor, [cmd.x1, cmd.y1], [cmd.x2, cmd.y2], [cmd.x, cmd.y], current);
      cursor = [cmd.x, cmd.y];
    } else if (cmd.type === "Z") {
      if (current && current.length > 2) contours.push(current);
      current = null;
    }
  }
  if (current && current.length > 2) contours.push(current);

  return contours;
}

function signedArea(pts) {
  let a = 0;
  for (let i = 0, j = pts.length - 1; i < pts.length; j = i++) {
    a += (pts[j][0] - pts[i][0]) * (pts[j][1] + pts[i][1]);
  }
  return a / 2;
}

function contains(outer, pt) {
  let inside = false;
  for (let i = 0, j = outer.length - 1; i < outer.length; j = i++) {
    const [xi, yi] = outer[i];
    const [xj, yj] = outer[j];
    if (yi > pt[1] !== yj > pt[1]) {
      const x = ((xj - xi) * (pt[1] - yi)) / (yj - yi) + xi;
      if (pt[0] < x) inside = !inside;
    }
  }
  return inside;
}

/** Winding decides what's a hole, not nesting. */
function classify(contours) {
  const areas = contours.map(signedArea);
  const dominant = Math.sign(areas.reduce((n, a) => n + a, 0)) || 1;

  return contours.map((pts, i) => ({
    pts,
    hole: Math.sign(areas[i]) !== dominant,
    area: Math.abs(areas[i]),
  }));
}

const round = (n) => Math.round(n * 1e4) / 1e4;

function build(face) {
  // opentype 2's `loadSync` is a no-op under ESM: parse the bytes ourselves.
  const buf = readFileSync(join(FONT_DIR, face.font));
  const font = opentype.parse(
    buf.buffer.slice(buf.byteOffset, buf.byteOffset + buf.byteLength),
  );
  // Deliberately not font.getPath(): its shaper walks the ccmp/bidi tables and throws on Noto's Arabic and Devanagari.
  const scale = EM / font.unitsPerEm;
  const commands = [];
  let pen = 0;
  for (const ch of [...face.text]) {
    const glyph = font.charToGlyph(ch);
    if (!glyph || glyph.index === 0) {
      throw new Error(`${face.id}: ${face.font} has no glyph for "${ch}"`);
    }
    commands.push(...glyph.getPath(pen, 0, EM).commands);
    pen += glyph.advanceWidth * scale;
  }

  const classified = classify(toContours({ commands }));

  // Normalise into a unit-ish box centred on the origin, so the runtime can scale every face by one number and have them optically match.
  let minX = Infinity;
  let minY = Infinity;
  let maxX = -Infinity;
  let maxY = -Infinity;
  for (const { pts } of classified) {
    for (const [x, y] of pts) {
      if (x < minX) minX = x;
      if (x > maxX) maxX = x;
      if (y < minY) minY = y;
      if (y > maxY) maxY = y;
    }
  }
  const cx = (minX + maxX) / 2;
  const cy = (minY + maxY) / 2;
  // Fit the larger axis: the runtime never has to think about aspect.
  const fit = 1 / Math.max(maxX - minX, maxY - minY);

  // opentype's Y grows downward.
  const norm = (pts) =>
    pts.map(([x, y]) => [round((x - cx) * fit), round(-(y - cy) * fit)]);

  const solids = classified
    .filter((c) => !c.hole)
    .sort((a, b) => b.area - a.area);
  const holes = classified.filter((c) => c.hole);

  // Attach each hole to the solid that encloses it: ExtrudeGeometry wants them grouped, and a run like "10" has two solids competing for one counter.
  const shapes = solids.map((solid) => ({
    contour: norm(solid.pts),
    holes: holes
      .filter((h) => contains(solid.pts, h.pts[0]))
      .map((h) => norm(h.pts)),
  }));

  const orphaned = holes.filter(
    (h) => !solids.some((s) => contains(s.pts, h.pts[0])),
  );
  if (orphaned.length) {
    throw new Error(`${face.id}: ${orphaned.length} hole(s) outside every solid`);
  }

  return {
    id: face.id,
    text: face.text,
    script: face.script,
    note: face.note,
    aspect: round((maxX - minX) / (maxY - minY)),
    shapes,
  };
}

const faces = FACES.map(build);

const body = faces
  .map(
    (f) => `  {
    id: ${JSON.stringify(f.id)},
    text: ${JSON.stringify(f.text)},
    script: ${JSON.stringify(f.script)},
    note: ${JSON.stringify(f.note)},
    aspect: ${f.aspect},
    shapes: [
${f.shapes
  .map(
    (s) => `      {
        contour: ${JSON.stringify(s.contour)},
        holes: [${s.holes.map((h) => JSON.stringify(h)).join(", ")}],
      },`,
  )
  .join("\n")}
    ],
  },`,
  )
  .join("\n");

writeFileSync(
  OUT,
  `// Generated by scripts/build-glyphs.mjs. Do not edit by hand.
//
// Flattened glyph contours normalized to a centered unit box with Y pointing up.
//
// Regenerate with a directory holding the Noto fonts listed in the script:
//   node scripts/build-glyphs.mjs <font-dir>

/** A closed outline plus any counters punched out of it. */
export type GlyphShape = {
  contour: [number, number][];
  holes: [number, number][][];
};

export type TenGlyph = {
  id: string;
  /** Characters used for the label and accessible text. */
  text: string;
  script: string;
  note: string;
  /** Source run width divided by height. */
  aspect: number;
  shapes: GlyphShape[];
};

export const TEN_GLYPHS: TenGlyph[] = [
${body}
];
`,
);

const total = faces.reduce(
  (n, f) =>
    n +
    f.shapes.reduce(
      (m, s) => m + s.contour.length + s.holes.reduce((k, h) => k + h.length, 0),
      0,
    ),
  0,
);
console.log(
  `wrote lib/ten-glyphs.ts — ${faces.length} faces, ${total} points\n` +
    faces
      .map(
        (f) =>
          `  ${f.text.padEnd(6)} ${f.id.padEnd(18)} ${f.shapes.length} shape(s), ${f.shapes.reduce((n, s) => n + s.holes.length, 0)} hole(s)`,
      )
      .join("\n"),
);
