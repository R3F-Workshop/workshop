import { ImageResponse } from "next/og";

/**
 * The share card.
 *
 * Generated rather than drawn, so it never drifts from the copy: the kicker and
 * the title come from the same `lib/content.ts` the page renders.
 *
 * Two constraints shape the design. Satori has no WebGPU, so none of the real
 * scenes can appear here — the gold band is a still approximation of the flip
 * grid's rank, built from divs. And it reads no local font: the site's Geist
 * arrives through `next/font/google` as woff2, which Satori cannot parse, and
 * there is no .ttf in the repo to hand it. So this leans on layout, the mark
 * and the gold rather than on distinctive type.
 */

export const alt =
  "Advanced React Three Fiber — a pmndrs workshop. Gobelins, Paris, September 8 and 9, 2026.";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

const BG = "#08080a";
const GOLD = "#c9a862";
const DIM = "#17171c";

/** The pmndrs mark, on its native 800×800 grid. Five rects — see brand/logo. */
const MARK: [number, number, number, number][] = [
  [280, 560, 240, 240],
  [280, 280, 240, 240],
  [0, 280, 240, 240],
  [280, 0, 280, 240],
  [560, 0, 240, 520],
];

/** The same sin-hash the scenes use, so the scatter is stable across builds. */
function rand(n: number, seed: number) {
  const x = Math.sin(seed * 9301 + n * 49297) * 233280;
  return x - Math.floor(x);
}

export default function Image() {
  // 24 × 38 + 23 gaps + 2 × 64 padding = 1155, inside the 1200 frame. At 26
  // the last column is clipped by the edge and reads as a mistake, not a bleed.
  const cols = 24;
  const rows = 3;
  const tile = 38;
  const gap = 5;

  return new ImageResponse(
    <div
      style={{
        width: "100%",
        height: "100%",
        background: BG,
        display: "flex",
        flexDirection: "column",
        justifyContent: "space-between",
        padding: 64,
      }}
    >
      {/* The mark, scaled off its 800-unit grid. */}
      <div
        style={{ display: "flex", position: "relative", width: 44, height: 44 }}
      >
        {MARK.map(([x, y, w, h], i) => (
          <div
            key={i}
            style={{
              position: "absolute",
              left: (x / 800) * 44,
              top: (y / 800) * 44,
              width: (w / 800) * 44,
              height: (h / 800) * 44,
              background: "#ffffff",
            }}
          />
        ))}
      </div>

      <div style={{ display: "flex", flexDirection: "column" }}>
        <div
          style={{
            display: "flex",
            fontSize: 22,
            letterSpacing: 3,
            color: "#8a8a95",
            textTransform: "uppercase",
          }}
        >
          September 8 &amp; 9, 2026 · Gobelins, Paris
        </div>
        <div
          style={{
            display: "flex",
            flexDirection: "column",
            marginTop: 18,
            fontSize: 92,
            lineHeight: 1.04,
            letterSpacing: -3,
            color: "#ffffff",
            fontWeight: 700,
          }}
        >
          <div style={{ display: "flex" }}>Advanced React</div>
          <div style={{ display: "flex" }}>Three Fiber</div>
        </div>
        <div
          style={{
            display: "flex",
            marginTop: 22,
            fontSize: 26,
            color: "#b6b6c0",
          }}
        >
          A pmndrs workshop · Intermediate · Two days
        </div>
      </div>

      {/* A still of the flip grid's rank: mostly resting, a scatter turned to
            gold, denser toward the right so it reads as a sweep in progress. */}
      <div style={{ display: "flex", flexDirection: "column" }}>
        {Array.from({ length: rows }).map((_, r) => (
          <div key={r} style={{ display: "flex", marginTop: r ? gap : 0 }}>
            {Array.from({ length: cols }).map((_, c) => {
              const lit =
                rand(r * cols + c, 7) < 0.05 + (c / cols) ** 1.5 * 0.75;
              return (
                <div
                  key={c}
                  style={{
                    width: tile,
                    height: tile,
                    marginLeft: c ? gap : 0,
                    background: lit ? GOLD : DIM,
                  }}
                />
              );
            })}
          </div>
        ))}
      </div>
    </div>,
    { ...size },
  );
}
