import { StepNav } from "@/app/demos/components/step-nav";

/** The post processing lesson, in order. */
const STEPS = [
  { href: "/demos/tsl-post/outputs", label: "1 outputs" },
  { href: "/demos/tsl-post/pipeline", label: "2 pipeline" },
  { href: "/demos/tsl-post/ssgi", label: "3 ssgi" },
  { href: "/demos/tsl-post/haze", label: "4 haze" },
  { href: "/demos/tsl-post/fsr", label: "5 fsr" },
];

export function PostSteps({ current }: { current: string }) {
  return <StepNav steps={STEPS} current={current} />;
}
