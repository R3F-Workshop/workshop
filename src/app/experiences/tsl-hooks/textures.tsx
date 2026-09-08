"use client";

import {
  Canvas,
  useFrame,
  useLocalNodes,
  useRenderTarget,
  useTextures,
  useThree,
  type CreatorState,
} from "@react-three/fiber/webgpu";
import { useEffect, useMemo, useRef } from "react";
import { texture, time, uv, vec2 } from "three/tsl";
import {
  CanvasTexture,
  PerspectiveCamera,
  RepeatWrapping,
  SRGBColorSpace,
  type Mesh,
  type WebGPURenderer,
} from "three/webgpu";

import { useWebGPU } from "@/lib/use-webgpu";

/**
 * TSL hooks, six: textures.
 *
 * The store keeps a registry of textures by key, and it does not care where
 * a texture came from. `useTexture(url)` loads one and registers it.
 * `useTextures()` is the registry itself: `add`, `get`, `has`, `dispose`,
 * and a subscription, so a component re-renders when the registry changes.
 *
 * Nothing is loaded here, on purpose. `Paint` draws a texture on a 2D
 * canvas and adds it. `Mirror` renders the scene into a `useRenderTarget`
 * every frame from a second camera and adds that. Three readers then take
 * textures out of the registry three different ways: `Slab` hands one to a
 * material's `map` prop, `Scroll` samples one in TSL with `texture()` and a
 * uv of its own, and `Screen` shows the render target. A file, a canvas and
 * a render target all arrive the same way.
 *
 * `useLocalNodes` subscribes to the registry too, so a builder that samples
 * a texture rebuilds when the texture appears.
 *
 * On loading: `useTexture` suspends, and a promise thrown inside the Canvas
 * is re-thrown past it by its own Suspense fallback, which unmounts the
 * root. See pmndrs/react-three-fiber#3850. Give the loading component a
 * Suspense of its own.
 */

/** A dark tile with a gold diagonal and a label, drawn on a 2D canvas. */
function paint(): CanvasTexture {
  const canvas = document.createElement("canvas");
  canvas.width = 256;
  canvas.height = 256;
  const ctx = canvas.getContext("2d")!;

  ctx.fillStyle = "#1a1a22";
  ctx.fillRect(0, 0, 256, 256);
  ctx.strokeStyle = "#ffd9a0";
  ctx.lineWidth = 18;
  for (let i = -256; i < 512; i += 64) {
    ctx.beginPath();
    ctx.moveTo(i, 0);
    ctx.lineTo(i + 256, 256);
    ctx.stroke();
  }
  ctx.fillStyle = "#08080a";
  ctx.fillRect(48, 88, 160, 80);
  ctx.fillStyle = "#ffd9a0";
  ctx.font = "bold 64px system-ui, sans-serif";
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.fillText("TSL", 128, 128);

  const tex = new CanvasTexture(canvas);
  tex.colorSpace = SRGBColorSpace;
  // So a uv past 1 wraps, which is what `Scroll` relies on.
  tex.wrapS = RepeatWrapping;
  tex.wrapT = RepeatWrapping;
  return tex;
}

function Paint() {
  const textures = useTextures();
  const tex = useMemo(() => paint(), []);

  useEffect(() => {
    // A bumped version survives the dispose that strict mode's double
    // mount triggers in development.
    tex.needsUpdate = true;
    textures.add("hooksPaint", tex);
    return () => {
      textures.dispose("hooksPaint", { force: true });
    };
  }, [textures, tex]);

  return null;
}

function Mirror() {
  const target = useRenderTarget(512, 512);
  const textures = useTextures();
  const scene = useThree((s) => s.scene);
  const renderer = useThree((s) => s.renderer) as unknown as WebGPURenderer;

  // Looks down on the scene from above. Only layer 0, so it never sees the
  // screen that shows its own picture.
  const camera = useMemo(() => {
    const c = new PerspectiveCamera(40, 1, 0.1, 50);
    c.position.set(0, 6, 5);
    c.lookAt(0, 0, 0);
    return c;
  }, []);

  useEffect(() => {
    textures.add("hooksMirror", target.texture);
    return () => {
      textures.dispose("hooksMirror", { force: true });
    };
  }, [textures, target]);

  useFrame(() => {
    renderer.setRenderTarget(target);
    renderer.render(scene, camera);
    renderer.setRenderTarget(null);
  });

  return null;
}

function Slab() {
  // The registry as a subscription: this re-renders when the key appears.
  const map = useTextures((r) => r.get("hooksPaint"));
  const ref = useRef<Mesh>(null);
  useFrame(({ delta }) => {
    if (ref.current) ref.current.rotation.y += delta * 0.4;
  });
  if (!map) return null;
  return (
    <mesh ref={ref} position={[-2.4, 0, 0]}>
      <boxGeometry args={[1.5, 1.5, 1.5]} />
      <meshStandardMaterial map={map} roughness={0.6} />
    </mesh>
  );
}

function scrollBuild({ textures }: CreatorState) {
  const tex = textures.get("hooksPaint");
  if (!tex) return {};
  // The registry texture sampled in TSL, with a uv this material invents.
  return { colorNode: texture(tex, uv().add(vec2(time.mul(0.15), 0))) };
}

function Scroll() {
  const nodes = useLocalNodes(scrollBuild);
  return (
    <mesh>
      <sphereGeometry args={[0.95, 48, 48]} />
      <meshStandardNodeMaterial {...nodes} roughness={0.5} />
    </mesh>
  );
}

function Screen() {
  const map = useTextures((r) => r.get("hooksMirror"));
  const camera = useThree((s) => s.camera);
  const ref = useRef<Mesh>(null);

  // Layer 1: the main camera sees it, the mirror camera does not.
  useEffect(() => {
    ref.current?.layers.set(1);
    camera.layers.enable(1);
  }, [camera, map]);

  if (!map) return null;
  return (
    <mesh ref={ref} position={[2.4, 0, 0]} rotation={[0, -0.35, 0]}>
      <planeGeometry args={[2, 2]} />
      <meshBasicMaterial map={map} />
    </mesh>
  );
}

export function HooksTextures() {
  // No WebGPU, no experience. The shell around this decides what to show instead.
  if (useWebGPU() !== "yes") return null;

  return (
    <div className="absolute inset-0">
      <Canvas
        camera={{ position: [0, 0.5, 9], fov: 40 }}
        dpr={[1, 2]}
        renderer={{ alpha: false, antialias: true }}
      >
        <color attach="background" args={["#08080a"]} />
        <ambientLight intensity={0.6} color="#b8c4ee" />
        <directionalLight position={[4, 6, 3]} intensity={2} color="#fff4e0" />
        <Paint />
        <Mirror />
        <Slab />
        <Scroll />
        <Screen />
      </Canvas>
    </div>
  );
}
