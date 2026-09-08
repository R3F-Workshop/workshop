import * as THREE from "three/webgpu";

/**
 * The starter's pyramid in vanilla three.js. No React in this file.
 *
 * Renderer, scene, camera, lights, one mesh, a loop, a resize observer, and
 * the raycaster ceremony for hover and click. Everything `<Canvas>` and one
 * `onClick` prop are about to replace.
 *
 * Returns a dispose function. WebGPU initialises asynchronously, so the
 * function keeps an `alive` flag and the caller can dispose before the first
 * frame ever renders.
 */
export function mountPyramid(container: HTMLElement) {
  let alive = true;

  const renderer = new THREE.WebGPURenderer({ antialias: true, alpha: true });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
  renderer.setSize(container.clientWidth, container.clientHeight);
  container.appendChild(renderer.domElement);

  const scene = new THREE.Scene();

  const camera = new THREE.PerspectiveCamera(
    40,
    container.clientWidth / container.clientHeight,
    0.1,
    100,
  );
  camera.position.set(0, 0.7, 5.2);
  // R3F aims its default camera at the origin. Here that is a line of code.
  camera.lookAt(0, 0, 0);

  scene.add(new THREE.AmbientLight("#b8c4ee", 0.55));
  const key = new THREE.DirectionalLight("#ffd9a0", 2.2);
  key.position.set(4, 6, 3);
  scene.add(key);
  const fill = new THREE.DirectionalLight("#6d7dc4", 0.6);
  fill.position.set(-5, 2, -4);
  scene.add(fill);

  // A four-sided cone is a pyramid. flatShading keeps the facets crisp.
  const geometry = new THREE.ConeGeometry(1.5, 1.9, 4);
  const material = new THREE.MeshStandardMaterial({
    color: "#96a0c8",
    flatShading: true,
    metalness: 0.35,
    roughness: 0.4,
  });
  const pyramid = new THREE.Mesh(geometry, material);
  pyramid.position.y = -0.4;
  scene.add(pyramid);

  // Interaction. The browser gives you a pointer in pixels; the scene wants a
  // ray. Everything below is the conversion, and the bookkeeping around it.
  const raycaster = new THREE.Raycaster();
  const pointer = new THREE.Vector2();
  let hovered = false;
  let active = false;

  const applyColor = () => {
    material.color.set(active ? "orange" : hovered ? "hotpink" : "#96a0c8");
    renderer.domElement.style.cursor = hovered ? "pointer" : "";
  };

  // Pixels to normalized device coordinates, minus one to one, y flipped.
  const readPointer = (event: PointerEvent) => {
    const rect = renderer.domElement.getBoundingClientRect();
    pointer.x = ((event.clientX - rect.left) / rect.width) * 2 - 1;
    pointer.y = -((event.clientY - rect.top) / rect.height) * 2 + 1;
  };

  const isOverPyramid = () => {
    raycaster.setFromCamera(pointer, camera);
    return raycaster.intersectObject(pyramid).length > 0;
  };

  const onPointerMove = (event: PointerEvent) => {
    readPointer(event);
    const next = isOverPyramid();
    if (next === hovered) return;
    hovered = next;
    applyColor();
  };

  const onPointerLeave = () => {
    if (!hovered) return;
    hovered = false;
    applyColor();
  };

  const onClick = (event: PointerEvent) => {
    readPointer(event);
    if (!isOverPyramid()) return;
    active = !active;
    applyColor();
  };

  renderer.domElement.addEventListener("pointermove", onPointerMove);
  renderer.domElement.addEventListener("pointerleave", onPointerLeave);
  renderer.domElement.addEventListener("click", onClick);

  const resize = new ResizeObserver(() => {
    const width = container.clientWidth;
    const height = container.clientHeight;
    if (width === 0 || height === 0) return;
    camera.aspect = width / height;
    camera.updateProjectionMatrix();
    renderer.setSize(width, height);
  });
  resize.observe(container);

  // Multiply by delta, always. Same speed on every screen.
  let last = performance.now();
  const frame = (now: number) => {
    const delta = (now - last) / 1000;
    last = now;
    pyramid.rotation.y += delta * 0.5;
    renderer.render(scene, camera);
  };

  // WebGPU needs a device before it can draw. Nothing renders until this
  // resolves, which is the wait the R3F version hides.
  renderer.init().then(() => {
    if (!alive) return;
    renderer.setAnimationLoop(frame);
  });

  return () => {
    alive = false;
    renderer.setAnimationLoop(null);
    resize.disconnect();
    renderer.domElement.removeEventListener("pointermove", onPointerMove);
    renderer.domElement.removeEventListener("pointerleave", onPointerLeave);
    renderer.domElement.removeEventListener("click", onClick);
    geometry.dispose();
    material.dispose();
    renderer.dispose();
    renderer.domElement.remove();
  };
}
