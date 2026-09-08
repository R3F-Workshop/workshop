import { StepNav } from "@/app/demos/components/step-nav";

/**
 * The compute lesson, in order. Six standalone demos, one reason each, then
 * the flip grid that uses all of them.
 */
const STEPS = [
  { href: "/demos/compute/parallel", label: "1 parallel" },
  { href: "/demos/compute/persist", label: "2 persist" },
  { href: "/demos/compute/cursor", label: "3 cursor" },
  { href: "/demos/compute/neighbors", label: "4 neighbors" },
  { href: "/demos/compute/reduce", label: "5 reduce" },
  { href: "/demos/compute/terrain", label: "6 terrain" },
  { href: "/demos/flip-grid", label: "7 flip grid" },
];

export function ComputeSteps({ current }: { current: string }) {
  return <StepNav steps={STEPS} current={current} />;
}
