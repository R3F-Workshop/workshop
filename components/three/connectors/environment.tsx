"use client";

import { EnvironmentMap } from "@react-three/fiber/webgpu";
import { useEffect, useMemo } from "react";

import { createStudioEnvironment, STUDIO_DEFAULT } from "../studio-env";
import type { ConnectorsConfig } from "./config";

/**
 * What the bodies reflect and refract.
 *
 * The same generated equirect the flip grid uses — three softboxes in a dark
 * dome, built on the CPU in a fraction of a millisecond, no `.hdr` to fetch. The
 * Lusion original arranges four drei `<Lightformer>`s inside an `<Environment>`,
 * which renders them to a cube target every time it rebuilds; this reaches the
 * same place without a render pass.
 *
 * The dome is deliberately not black. Metal is only its reflection and glass is
 * only what's behind it, so a body facing away from every softbox needs
 * *something* to return or it reads as a hole cut in the page.
 */
export function ConnectorsEnvironment({ config }: { config: ConnectorsConfig }) {
  const texture = useMemo(() => {
    const [key, kick, fill] = STUDIO_DEFAULT.softboxes;
    return createStudioEnvironment({
      ...STUDIO_DEFAULT,
      ground: [0.018, 0.018, 0.024],
      sky: [0.05, 0.058, 0.08],
      softboxes: [
        { ...key, intensity: config.keyIntensity },
        { ...kick, intensity: config.kickIntensity },
        { ...fill, intensity: config.fillIntensity },
      ],
    });
  }, [config.keyIntensity, config.kickIntensity, config.fillIntensity]);

  // The generator allocates a new DataTexture each time; the old one holds a
  // GPU allocation until it's told to let go.
  useEffect(() => () => texture.dispose(), [texture]);

  return (
    <EnvironmentMap map={texture} environmentIntensity={config.envIntensity} />
  );
}
