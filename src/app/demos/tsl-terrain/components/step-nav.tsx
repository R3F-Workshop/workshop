import { StepNav } from "@/app/demos/components/step-nav";

/**
 * The terrain lesson, in order. Noise in the vertex stage, colour, the
 * noise baked once by compute, trees that read the bake, and the airplane.
 */
const STEPS = [
  { href: "/demos/tsl-terrain/vertex", label: "1 vertex" },
  { href: "/demos/tsl-terrain/color", label: "2 color" },
  { href: "/demos/tsl-terrain/compute", label: "3 compute" },
  { href: "/demos/tsl-terrain/trees", label: "4 trees" },
  { href: "/demos/tsl-terrain/airplane", label: "5 airplane" },
];

export function TerrainSteps({ current }: { current: string }) {
  return <StepNav steps={STEPS} current={current} />;
}
