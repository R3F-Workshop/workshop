"use client";

import Image from "next/image";
import { useEffect, useRef, useState, type ReactNode } from "react";

import { useWebGPU } from "@/lib/use-webgpu";
import { cn } from "@/lib/utils";

/**
 * The place a section's 3D goes.
 *
 * The poster is always the base layer — it holds the space, so there's no
 * layout shift and no empty box while detection runs — and a scene, if we can
 * render one, fades in over it. Anything that goes wrong just leaves the
 * poster, which is a real image rather than a broken canvas.
 *
 * Callers pass `children` already lazily imported (`next/dynamic`, `ssr:false`)
 * so no three.js reaches the initial route bundle.
 */
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
  /** The canvas. Omit while a section's scene doesn't exist yet. */
  children?: ReactNode;
}) {
  const support = useWebGPU();
  const ref = useRef<HTMLDivElement>(null);
  const [near, setNear] = useState(false);

  // Mount the scene a little before it's needed and unmount it well after, so
  // scrolling past doesn't thrash renderers. Actual frame-level pausing is the
  // scene's own job via frameloop.
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
