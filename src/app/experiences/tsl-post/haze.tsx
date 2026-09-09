"use client";

import {
  useCallback,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import {
  ACESFilmicToneMapping,
  MathUtils,
  Quaternion,
  SphereGeometry,
  SRGBColorSpace,
  Vector3,
  type Mesh,
  type PerspectiveCamera,
} from "three/webgpu";
import { renderOutput } from "three/tsl";
import { fxaa } from "three/examples/jsm/tsl/display/FXAANode.js";
import {
  Canvas,
  useFrame,
  useRenderPipeline,
  useThree,
} from "@react-three/fiber/webgpu";
import { FlyControls } from "@react-three/drei/webgpu";
import { Sky, useSky } from "@pmndrs/sky/react";
import type { Sky as SkyInstance } from "@pmndrs/sky";
import { button, useControls } from "leva";

/**
 * TSL post, four of five: haze.
 *
 * A port of the sky package's space to ground example. The camera starts
 * 400 km up, looking down at the limb of the planet, and eases down to 300 m
 * over 45 seconds, levelling out as it goes. Any click or wheel on the canvas
 * hands the camera over to free flight, and so does the end of the descent.
 *
 * The post pass is aerial perspective. The sky bakes a small 3D lookup of
 * how much light scatters in and how much is lost along the view ray, by
 * distance from the camera. `applyHaze` reads the scene pass's depth to know
 * how far each pixel is and blends that in. The lookup only covers about
 * 1024 km, so the space leg of the descent leans on a per pixel raymarch
 * instead, and the policy control says which of the two a pixel gets.
 *
 * The step has no room. The stage is the planet.
 */

//* The descent =====================================================

// 32 km per slice times 32 slices is about 1024 km of lookup coverage. The
// descent starts outside that and relies on the raymarch fallback until it
// is within range.
const AP_KM_PER_SLICE = 32;

const START_ALTITUDE_M = 400_000;
const END_ALTITUDE_M = 300;
const DURATION_S = 45;
// Larger is more front loaded: fast through empty space, slow near the
// ground where the geometry is.
const ALTITUDE_EASE_K = 5;
// Limb gazing at the start, steep down with the curve of the planet against
// space. Near level at the end, terrain ahead.
const START_PITCH = MathUtils.degToRad(-45);
const END_PITCH = MathUtils.degToRad(-2);
const START_YAW = 0;
const END_YAW = MathUtils.degToRad(20);
// The camera only ever moves radially above the origin, so this tangent
// basis holds for the whole descent. Forward is world +Z.
const UP = new Vector3(0, 1, 0);
const FORWARD = new Vector3(0, 0, 1);
const RIGHT = new Vector3().crossVectors(FORWARD, UP).normalize();

// Exposure is keyed to altitude rather than time, so it stays right after
// the handoff to free flight. Space is a bright limb against black and
// wants far less than the twilit surface.
const EXPOSURE_AT_SPACE = 0.15;
const EXPOSURE_AT_SURFACE = 0.65;

function easeExpoOut(p: number, k: number) {
  return (1 - Math.exp(-k * p)) / (1 - Math.exp(-k));
}

function smoothstep01(p: number) {
  return p * p * (3 - 2 * p);
}

/** Log lerp between the two exposures over the descent's altitude range. */
function exposureForAltitude(altitudeM: number) {
  const clamped = MathUtils.clamp(altitudeM, END_ALTITUDE_M, START_ALTITUDE_M);
  const t =
    (Math.log(clamped) - Math.log(END_ALTITUDE_M)) /
    (Math.log(START_ALTITUDE_M) - Math.log(END_ALTITUDE_M));
  return MathUtils.lerp(EXPOSURE_AT_SURFACE, EXPOSURE_AT_SPACE, t);
}

/** Puts the camera at progress p of the descent. Returns the altitude. */
function poseCamera(camera: PerspectiveCamera, p: number) {
  const altitudeM = MathUtils.lerp(
    START_ALTITUDE_M,
    END_ALTITUDE_M,
    easeExpoOut(p, ALTITUDE_EASE_K),
  );
  const look = smoothstep01(p);
  const pitch = MathUtils.lerp(START_PITCH, END_PITCH, look);
  const yaw = MathUtils.lerp(START_YAW, END_YAW, look);

  camera.position.set(0, altitudeM, 0);
  camera.up.copy(UP);
  const cosPitch = Math.cos(pitch);
  const forward = FORWARD.clone()
    .multiplyScalar(Math.cos(yaw) * cosPitch)
    .addScaledVector(RIGHT, Math.sin(yaw) * cosPitch)
    .addScaledVector(UP, Math.sin(pitch));
  camera.lookAt(camera.position.clone().add(forward));
  return altitudeM;
}

/**
 * The React context types only the surface its own bindings use. The vanilla
 * class types `update`'s planet frame option and exposes the baker.
 */
function usePlanetSky() {
  return useSky() as unknown as SkyInstance;
}

//* The planet ======================================================

/** The sky mesh, the ground, a few mountains and the sun. */
function Planet({ sunElevation, sunAzimuth }: { sunElevation: number; sunAzimuth: number }) {
  const sky = usePlanetSky();
  const scene = useThree((state) => state.scene);

  const bottomRadiusM = sky.baker.atmosphereParams.bottomRadius * 1000;
  const planetCenter = useMemo(
    () => new Vector3(0, -bottomRadiusM, 0),
    [bottomRadiusM],
  );

  // The live sky. It samples the sky view lookup per pixel against the
  // camera and raymarches above the atmosphere, which is most of the
  // descent. The cube the Sky component attaches as the background was
  // baked from the ground, so it comes off. The mesh is a box the camera
  // sits inside, moved along with it every frame.
  const skyMesh = useMemo(() => sky.baker.createSkyMesh() as Mesh, [sky]);
  useLayoutEffect(() => {
    scene.background = null;
  }, [scene, sky]);
  useFrame(({ camera }) => {
    skyMesh.position.copy(camera.position);
  });

  // The ground twice. The whole sphere, coarse, for the view from orbit.
  // Then a fine cap 140 km across at the pole, because a facet of the coarse
  // sphere sags almost 2 km below the true surface at its centre, and the
  // camera ends the descent 300 m up.
  const cap = useMemo(
    () =>
      new SphereGeometry(
        bottomRadiusM + 2,
        256,
        256,
        0,
        Math.PI * 2,
        0,
        140_000 / bottomRadiusM,
      ),
    [bottomRadiusM],
  );
  useEffect(() => () => cap.dispose(), [cap]);

  // Cones on the surface, close enough to catch the haze at the end of the
  // descent and give the horizon something besides flat ground. Each sits
  // on the sphere at a distance and bearing from the origin, with its axis
  // radial. Heights vary by a fixed hash so the scatter is stable.
  const mountains = useMemo(() => {
    const place = (distanceM: number, bearing: number, height: number, width: number) => {
      const angle = distanceM / bottomRadiusM;
      const along = new Vector3(Math.sin(bearing), 0, Math.cos(bearing));
      const radial = UP.clone()
        .multiplyScalar(Math.cos(angle))
        .addScaledVector(along, Math.sin(angle))
        .normalize();
      // The cone's origin is its half height.
      const position = planetCenter
        .clone()
        .addScaledVector(radial, bottomRadiusM + 2 + height * 0.5);
      const quaternion = new Quaternion().setFromUnitVectors(UP, radial);
      return { position, quaternion, scale: new Vector3(width, height, width) };
    };
    const near = Array.from({ length: 12 }, (_, n) => {
      const i = n + 1;
      const height = 400 + 400 * (((i * 7919) % 97) / 97);
      return place(i * 2000, ((i % 4) - 1.5) * 0.4, height, 600);
    });
    const far = Array.from({ length: 6 }, (_, i) =>
      place(30_000 + i * 8000, (i - 2.5) * 0.15, 1500, 1500),
    );
    return [...near, ...far];
  }, [bottomRadiusM, planetCenter]);

  // The sky's own spherical convention: theta is azimuth, phi is the zenith
  // angle. The light sits far along that direction and aims at the origin.
  const sunPosition = useMemo(() => {
    const phi = MathUtils.degToRad(90 - sunElevation);
    const theta = MathUtils.degToRad(sunAzimuth);
    return new Vector3(
      Math.sin(phi) * Math.cos(theta),
      Math.cos(phi),
      Math.sin(phi) * Math.sin(theta),
    ).multiplyScalar(50_000);
  }, [sunElevation, sunAzimuth]);

  return (
    <>
      <primitive object={skyMesh} />

      <mesh position={planetCenter}>
        <sphereGeometry args={[bottomRadiusM, 128, 64]} />
        <meshStandardNodeMaterial color="#6a6055" roughness={0.95} />
      </mesh>
      <mesh geometry={cap} position={planetCenter}>
        <meshStandardNodeMaterial color="#6a6055" roughness={0.95} />
      </mesh>

      {mountains.map((m, i) => (
        <mesh key={i} position={m.position} quaternion={m.quaternion} scale={m.scale}>
          <coneGeometry args={[1, 1, 12]} />
          <meshStandardNodeMaterial color="#4a3f33" roughness={0.9} />
        </mesh>
      ))}

      <directionalLight position={sunPosition} intensity={4} />
    </>
  );
}

//* The camera ======================================================

/**
 * Drives the scripted descent, asks for the handoff to free flight, keys
 * exposure to altitude, and keeps the sky in the planet frame.
 */
function Descent({
  run,
  flying,
  onHandoff,
  autoExposure,
  exposure,
  readoutRef,
}: {
  /** Bumped by the restart button. The elapsed time restarts with it. */
  run: number;
  /** Whether the visitor has the camera. */
  flying: boolean;
  onHandoff: () => void;
  autoExposure: boolean;
  exposure: number;
  readoutRef: React.RefObject<HTMLDivElement | null>;
}) {
  const sky = usePlanetSky();
  const camera = useThree((state) => state.camera) as PerspectiveCamera;
  const renderer = useThree((state) => state.renderer);

  const bottomRadiusM = sky.baker.atmosphereParams.bottomRadius * 1000;
  const planetCenter = useMemo(
    () => new Vector3(0, -bottomRadiusM, 0),
    [bottomRadiusM],
  );

  const elapsedRef = useRef(0);
  const elapsedRunRef = useRef(run);

  // Any input on the canvas hands the camera over. Capture phase, so it is
  // seen before the fly controls, which only mount afterwards and read the
  // camera's current pose, so there is no jump.
  useEffect(() => {
    if (flying) return;
    const canvas = renderer.domElement as HTMLCanvasElement;
    canvas.addEventListener("pointerdown", onHandoff, { capture: true });
    canvas.addEventListener("wheel", onHandoff, { capture: true, passive: true });
    return () => {
      canvas.removeEventListener("pointerdown", onHandoff, { capture: true });
      canvas.removeEventListener("wheel", onHandoff, { capture: true });
    };
  }, [flying, renderer, onHandoff]);

  useFrame(
    ({ delta }) => {
      // A restart starts the clock again.
      if (elapsedRunRef.current !== run) {
        elapsedRunRef.current = run;
        elapsedRef.current = 0;
      }

      let altitudeM: number;
      if (!flying) {
        elapsedRef.current += delta;
        const p = MathUtils.clamp(elapsedRef.current / DURATION_S, 0, 1);
        altitudeM = poseCamera(camera, p);
        if (p >= 1) onHandoff();
      } else {
        // Free flight has no floor of its own. Keep it 20 m off the ground.
        const radial = camera.position.clone().sub(planetCenter);
        const minRadius = bottomRadiusM + 20;
        if (radial.length() < minRadius)
          camera.position.copy(radial.setLength(minRadius).add(planetCenter));
        altitudeM = radial.length() - bottomRadiusM;
      }

      renderer.toneMappingExposure = autoExposure
        ? exposureForAltitude(altitudeM)
        : exposure;

      // The Sky component runs its own update in this phase, flat convention,
      // altitude from y. This job runs after it, below the default priority,
      // and re-syncs the planet frame, true altitude from the planet centre,
      // then refreshes the aerial perspective lookup for that frame.
      sky.update(camera, { planetCenter });
      void sky.updateAerialPerspective();

      if (readoutRef.current) {
        const phase = flying
          ? "free flight · drag to look, WASD to fly"
          : `descent ${elapsedRef.current.toFixed(1)} s / ${DURATION_S} s`;
        readoutRef.current.textContent = `${phase} · altitude ${Math.round(altitudeM).toLocaleString()} m`;
      }
    },
    { priority: -1 },
  );

  return flying ? (
    <FlyControls movementSpeed={400} rollSpeed={0.3} dragToLook />
  ) : null;
}

//* The post pass ===================================================

function Haze({
  enabled,
  policy,
  strength,
}: {
  enabled: boolean;
  policy: string;
  strength: number;
}) {
  const sky = usePlanetSky();
  const builtRef = useRef<boolean | null>(null);

  const { rebuild } = useRenderPipeline(
    ({ renderPipeline, passes: { scenePass } }) => {
      const color = scenePass.getTextureNode();
      const hazed = enabled
        ? sky.applyHaze(color, {
            scenePass,
            policy,
            strength,
            // Must match the renderer, which uses log depth for the orbit
            // views. The pass's depth is decoded accordingly.
            logarithmicDepthBuffer: true,
            // The lookup shows concentric banding around 50 to 100 km of
            // altitude, which the descent passes straight through. A low
            // blend window hands auto mode from the lookup to the raymarch
            // well before that, trading some lookup detail up close for a
            // band free descent.
            altitudeBlend: { startKm: 8, endKm: 24 },
          })
        : color;
      // The pass renders without MSAA so the haze can sample its depth. FXAA
      // smooths the mountain edges afterwards. It works on display values,
      // so the tone map runs here and the pipeline's own is switched off.
      renderPipeline.outputColorTransform = false;
      renderPipeline.outputNode = fxaa(renderOutput(hazed));
      // The presentation material has a new output node: say so.
      renderPipeline.needsUpdate = true;
      builtRef.current = enabled;
    },
  );

  // Structural change: rebuild the graph.
  useEffect(() => {
    if (builtRef.current !== null && builtRef.current !== enabled) rebuild();
  }, [enabled, rebuild]);

  // Uniforms on the haze node. Written live.
  useEffect(() => {
    sky.setHazeStrength(strength);
    sky.setHazePolicy(policy);
  }, [sky, strength, policy]);

  return null;
}

//* The experience ==================================================

function Scene({ readoutRef }: { readoutRef: React.RefObject<HTMLDivElement | null> }) {
  const [run, setRun] = useState(0);
  const [flying, setFlying] = useState(false);
  const handoff = useCallback(() => setFlying(true), []);
  const {
    sunElevation,
    sunAzimuth,
    hazeStrength,
    hazePolicy,
    haze,
    autoExposure,
    exposure,
  } = useControls("tsl post · haze", {
    // Sun setters on the sky. A rebake of the small lookups, no pipeline
    // change. Azimuth 90 puts the sun ahead of the camera's path, so it
    // grazes the limb at the start and reads as a horizon glow at the end.
    sunElevation: { value: 10, min: -5, max: 90, step: 0.1 },
    sunAzimuth: { value: 90, min: -180, max: 180, step: 0.1 },
    // Uniforms the haze node reads. Written live.
    hazeStrength: { value: 1, min: 0, max: 3, step: 0.01 },
    hazePolicy: { value: "auto", options: ["auto", "ap", "raymarch"] },
    // Adds or removes the haze node, so it rebuilds.
    haze: true,
    // Renderer fields, written every frame. Manual exposure only applies
    // while autoExposure is off.
    autoExposure: true,
    exposure: { value: EXPOSURE_AT_SPACE, min: 0, max: 2, step: 0.01 },
    // Back to the top, scripted again. The fly controls unmount and the
    // next frame poses the camera.
    "restart descent": button(() => {
      setFlying(false);
      setRun((n) => n + 1);
    }),
  });

  // A stable object, or the Sky component would call the setter on every
  // render.
  const sunDirection = useMemo(
    () => ({ elevation: sunElevation, azimuth: sunAzimuth, raw: true }),
    [sunElevation, sunAzimuth],
  );

  return (
    <Sky
      preset="earth"
      quality="medium"
      cubeSize={256}
      enableAerialPerspective
      apKmPerSlice={AP_KM_PER_SLICE}
      sunDirection={sunDirection}
      sunDisc
    >
      <Planet sunElevation={sunElevation} sunAzimuth={sunAzimuth} />
      <Descent
        run={run}
        flying={flying}
        onHandoff={handoff}
        autoExposure={autoExposure}
        exposure={exposure}
        readoutRef={readoutRef}
      />
      <Haze enabled={haze} policy={hazePolicy} strength={hazeStrength} />
    </Sky>
  );
}

export function PostHaze() {
  const readoutRef = useRef<HTMLDivElement>(null);

  return (
    <div className="absolute inset-0">
      <Canvas
        // Far enough to hold the whole planet from orbit. Earth's radius is
        // about 6.4 Mm, so 20 Mm covers the diameter with headroom.
        camera={{
          fov: 60,
          near: 1,
          far: 20_000_000,
          position: [0, START_ALTITUDE_M, 0],
        }}
        dpr={[1, 2]}
        renderer={{
          // The haze samples the pass's depth, and a multisampled depth
          // attachment cannot be sampled, so the pass renders without MSAA.
          antialias: false,
          // Seven orders of magnitude between near and far. Log depth keeps
          // the mountains from fighting the ground.
          logarithmicDepthBuffer: true,
          toneMapping: ACESFilmicToneMapping,
          outputColorSpace: SRGBColorSpace,
        }}
      >
        <Scene readoutRef={readoutRef} />
      </Canvas>

      {/* Phase and altitude, written from the frame loop. */}
      <div
        ref={readoutRef}
        className="pointer-events-none absolute bottom-5 left-5 rounded-md bg-black/50 px-3 py-2 font-mono text-[11px] text-white/80"
      />
    </div>
  );
}
