"use client";

import { EnvironmentMap } from "@react-three/fiber/webgpu";
import { useEffect, useMemo } from "react";

import { createStudioEnvironment, STUDIO_DEFAULT } from "@/app/home/components/canvas/studio-env";
import type { ConnectorsConfig } from "./config";

/** What the bodies reflect and refract. */
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

  // The generator allocates a new DataTexture each time: the old one holds a GPU allocation until it's told to let go.
  useEffect(() => () => texture.dispose(), [texture]);

  return (
    <EnvironmentMap map={texture} environmentIntensity={config.envIntensity} />
  );
}
