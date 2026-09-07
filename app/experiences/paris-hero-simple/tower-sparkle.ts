import * as TSL from "three/tsl";
import type { UniformNode } from "three/webgpu";

/** The sparkle: the real tower's 20,000 bulbs going off for five minutes on the hour, compressed into a permanent state. */
export function makeSparkleNode(lightLevel: UniformNode<"float", number>) {
  const cell = TSL.floor(TSL.positionLocal.mul(0.9));
  const seed = TSL.fract(
    TSL.sin(cell.dot(TSL.vec3(127.1, 311.7, 74.7))).mul(43758.5453),
  );
  // Every cell runs the same 2.5s cycle at a private phase: the step keeps ~1.5% of it lit, so at any instant a sparse random scatter is popping.
  const cycle = TSL.fract(TSL.time.mul(0.4).add(seed));
  const flash = TSL.step(0.985, cycle);
  const brightness = seed.mul(0.6).add(0.4);

  return TSL.color("#fff3d0").mul(flash.mul(brightness).mul(8).mul(lightLevel));
}
