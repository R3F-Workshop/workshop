import { StepNav } from "@/app/demos/components/step-nav";

/**
 * The hooks lesson, in order. The seven small demos, then the two experiences
 * that put them to work.
 */
const STEPS = [
  { href: "/demos/tsl-hooks/uniform", label: "1 a uniform" },
  { href: "/demos/tsl-hooks/shared", label: "2 shared uniforms" },
  { href: "/demos/tsl-hooks/nodes", label: "3 shared nodes" },
  { href: "/demos/tsl-hooks/canvases", label: "4 across canvases" },
  { href: "/demos/tsl-hooks/buffers", label: "5 buffers" },
  { href: "/demos/tsl-hooks/textures", label: "6 textures" },
  { href: "/demos/tsl-hooks/storage", label: "7 storage" },
  { href: "/demos/grain-gradient", label: "8 grain gradient" },
  { href: "/demos/compute/parallel", label: "9 compute" },
];

export function HooksSteps({ current }: { current: string }) {
  return <StepNav steps={STEPS} current={current} />;
}
