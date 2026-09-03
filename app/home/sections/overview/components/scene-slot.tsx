"use client";

import Image from "next/image";
import { useEffect, useRef, useState, type ReactNode } from "react";

import { useWebGPU } from "@/lib/use-webgpu";
import { cn } from "@/lib/utils";

/** Layers an optional 3D scene over its static poster. */
export function SceneSlot({
  poster,
  alt,
  sizes,
  className,
  children,
}: {
  poster: string;
  alt: string;
  sizes?: string;
  className?: string;
  /** Optional scene rendered above the poster. */
  children?: ReactNode;
}) {
  const support = useWebGPU();
  const ref = useRef<HTMLDivElement>(null);
  const [near, setNear] = useState(false);

  // Mount the scene a little before it's needed and unmount it well after, so scrolling past doesn't thrash renderers.
  useEffect(() => {
    const el = ref.current;
    if (!el || support !== "yes" || !children) return;

    const io = new IntersectionObserver(
      ([entry]) => setNear(entry.isIntersecting),
      { rootMargin: "300px 0px" },
    );
    io.observe(el);
    return () => io.disconnect();
  }, [support, children]);

  const showScene = support === "yes" && Boolean(children) && near;

  return (
    <div ref={ref} className={cn("relative overflow-hidden", className)}>
      <Image
        src={poster}
        alt={alt}
        fill
        sizes={sizes}
        className="object-cover object-[center_60%]"
      />
      {showScene ? (
        <div className="absolute inset-0 animate-in fade-in duration-700">
          {children}
        </div>
      ) : null}
    </div>
  );
}
