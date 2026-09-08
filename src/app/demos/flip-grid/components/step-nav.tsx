import { StepNav } from "@/app/demos/components/step-nav";

/** The four versions of the flip grid, in lesson order. */
const STEPS = [
  { href: "/demos/flip-grid/meshes", label: "1 meshes" },
  { href: "/demos/flip-grid/instanced", label: "2 instanced" },
  { href: "/demos/flip-grid/storage", label: "3 storage" },
  { href: "/demos/flip-grid", label: "4 compute" },
];

export function FlipGridSteps({ current }: { current: string }) {
  return <StepNav steps={STEPS} current={current} />;
}
