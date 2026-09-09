import { StepNav } from "@/app/demos/components/step-nav";

/** The materials lesson, in order. Each step is the previous one plus one idea. */
const STEPS = [
  { href: "/demos/tsl-materials/mix", label: "1 mix" },
  { href: "/demos/tsl-materials/readers", label: "2 readers" },
  { href: "/demos/tsl-materials/noise", label: "3 noise" },
  { href: "/demos/tsl-materials/wobble", label: "4 wobble" },
];

export function MaterialsSteps({ current }: { current: string }) {
  return <StepNav steps={STEPS} current={current} />;
}
