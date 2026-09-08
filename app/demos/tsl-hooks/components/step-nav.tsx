import { StepNav } from "@/app/demos/components/step-nav";

/**
 * The hooks lesson, in order. The four small demos, then the two experiences
 * that put them to work.
 */
const STEPS = [
  { href: "/demos/tsl-hooks/uniform", label: "1 a uniform" },
  { href: "/demos/tsl-hooks/shared", label: "2 shared uniforms" },
  { href: "/demos/tsl-hooks/nodes", label: "3 shared nodes" },
  { href: "/demos/tsl-hooks/canvases", label: "4 across canvases" },
  { href: "/demos/grain-gradient", label: "5 grain gradient" },
  { href: "/demos/flip-grid/meshes", label: "6 flip grid" },
];

export function HooksSteps({ current }: { current: string }) {
  return <StepNav steps={STEPS} current={current} />;
}
