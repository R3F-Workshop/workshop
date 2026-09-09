/**
 * Scoped resources registered by the TSL workshop lessons.
 *
 * Fiber's runtime already exposes these as `uniforms.scopeName` and
 * `nodes.scopeName`. These declarations give creator callbacks the matching
 * scope shapes without repeating casts in every experience.
 */

declare interface ThreeFiberUniformScopes {
  computeParallel: {
    seed: import("three/webgpu").UniformNode<"float", number>;
    size: import("three/webgpu").UniformNode<"float", number>;
    a: import("three/webgpu").UniformNode<"color", import("three/webgpu").Color>;
    b: import("three/webgpu").UniformNode<"color", import("three/webgpu").Color>;
  };
  computePersist: {
    gravity: import("three/webgpu").UniformNode<"float", number>;
    speed: import("three/webgpu").UniformNode<"float", number>;
    spread: import("three/webgpu").UniformNode<"float", number>;
    bounce: import("three/webgpu").UniformNode<"float", number>;
    floor: import("three/webgpu").UniformNode<"float", number>;
    size: import("three/webgpu").UniformNode<"float", number>;
    cool: import("three/webgpu").UniformNode<"color", import("three/webgpu").Color>;
    hot: import("three/webgpu").UniformNode<"color", import("three/webgpu").Color>;
    dt: import("three/webgpu").UniformNode<"float", number>;
  };
  computeCursor: {
    pointer: import("three/webgpu").UniformNode<"vec3", import("three/webgpu").Vector3>;
    radius: import("three/webgpu").UniformNode<"float", number>;
    rate: import("three/webgpu").UniformNode<"float", number>;
    jitter: import("three/webgpu").UniformNode<"float", number>;
    height: import("three/webgpu").UniformNode<"float", number>;
    base: import("three/webgpu").UniformNode<"color", import("three/webgpu").Color>;
    tip: import("three/webgpu").UniformNode<"color", import("three/webgpu").Color>;
    dt: import("three/webgpu").UniformNode<"float", number>;
  };
  computeNeighbors: {
    drop: import("three/webgpu").UniformNode<"vec3", import("three/webgpu").Vector3>;
    spread: import("three/webgpu").UniformNode<"float", number>;
    damping: import("three/webgpu").UniformNode<"float", number>;
    speed: import("three/webgpu").UniformNode<"float", number>;
    amplitude: import("three/webgpu").UniformNode<"float", number>;
    deep: import("three/webgpu").UniformNode<"color", import("three/webgpu").Color>;
    crest: import("three/webgpu").UniformNode<"color", import("three/webgpu").Color>;
  };
  computeReduce: {
    drift: import("three/webgpu").UniformNode<"float", number>;
    base: import("three/webgpu").UniformNode<"color", import("three/webgpu").Color>;
    tip: import("three/webgpu").UniformNode<"color", import("three/webgpu").Color>;
  };
  computeTerrain: {
    frequency: import("three/webgpu").UniformNode<"float", number>;
    octaves: import("three/webgpu").UniformNode<"float", number>;
    lacunarity: import("three/webgpu").UniformNode<"float", number>;
    gain: import("three/webgpu").UniformNode<"float", number>;
    amplitude: import("three/webgpu").UniformNode<"float", number>;
    offsetX: import("three/webgpu").UniformNode<"float", number>;
    offsetZ: import("three/webgpu").UniformNode<"float", number>;
    water: import("three/webgpu").UniformNode<"float", number>;
    snow: import("three/webgpu").UniformNode<"float", number>;
    clearance: import("three/webgpu").UniformNode<"float", number>;
    planeXZ: import("three/webgpu").UniformNode<"vec2", import("three/webgpu").Vector2>;
  };
  flipGrid: {
    step: import("three/webgpu").UniformNode<"float", number>;
    tile: import("three/webgpu").UniformNode<"float", number>;
    radius: import("three/webgpu").UniformNode<"float", number>;
    thickness: import("three/webgpu").UniformNode<"float", number>;
    hold: import("three/webgpu").UniformNode<"float", number>;
    stiffness: import("three/webgpu").UniformNode<"float", number>;
    damping: import("three/webgpu").UniformNode<"float", number>;
    massJitter: import("three/webgpu").UniformNode<"float", number>;
    dt: import("three/webgpu").UniformNode<"float", number>;
    pointer: import("three/webgpu").UniformNode<"vec2", import("three/webgpu").Vector2>;
    pointerPrev: import("three/webgpu").UniformNode<"vec2", import("three/webgpu").Vector2>;
    front: import("three/webgpu").UniformNode<"color", import("three/webgpu").Color>;
    back: import("three/webgpu").UniformNode<"color", import("three/webgpu").Color>;
    edge: import("three/webgpu").UniformNode<"color", import("three/webgpu").Color>;
    roughness: import("three/webgpu").UniformNode<"float", number>;
    flakeCells: import("three/webgpu").UniformNode<"float", number>;
    flakeStrength: import("three/webgpu").UniformNode<"float", number>;
    flakeRoughness: import("three/webgpu").UniformNode<"float", number>;
    toneJitter: import("three/webgpu").UniformNode<"float", number>;
    roughJitter: import("three/webgpu").UniformNode<"float", number>;
    tiltJitter: import("three/webgpu").UniformNode<"float", number>;
    curvature: import("three/webgpu").UniformNode<"float", number>;
  };
  grainGradient: {
    aspect: import("three/webgpu").UniformNode<"float", number>;
    softness: import("three/webgpu").UniformNode<"float", number>;
    intensity: import("three/webgpu").UniformNode<"float", number>;
    noise: import("three/webgpu").UniformNode<"float", number>;
    grainSize: import("three/webgpu").UniformNode<"float", number>;
    opacity: import("three/webgpu").UniformNode<"float", number>;
    speed: import("three/webgpu").UniformNode<"float", number>;
    scale: import("three/webgpu").UniformNode<"float", number>;
    rotation: import("three/webgpu").UniformNode<"float", number>;
    offset: import("three/webgpu").UniformNode<"vec2", import("three/webgpu").Vector2>;
    color1: import("three/webgpu").UniformNode<"color", import("three/webgpu").Color>;
    color2: import("three/webgpu").UniformNode<"color", import("three/webgpu").Color>;
    color3: import("three/webgpu").UniformNode<"color", import("three/webgpu").Color>;
  };
  town: {
    progress: import("three/webgpu").UniformNode<"float", number>;
  };
  tslNormalInject: {
    hit: import("three/webgpu").UniformNode<"vec3", import("three/webgpu").Vector3>;
    radius: import("three/webgpu").UniformNode<"float", number>;
    rings: import("three/webgpu").UniformNode<"float", number>;
    speed: import("three/webgpu").UniformNode<"float", number>;
    amplitude: import("three/webgpu").UniformNode<"float", number>;
  };
  hooksUniform: {
    base: import("three/webgpu").UniformNode<"color", import("three/webgpu").Color>;
    tip: import("three/webgpu").UniformNode<"color", import("three/webgpu").Color>;
    bands: import("three/webgpu").UniformNode<"float", number>;
    speed: import("three/webgpu").UniformNode<"float", number>;
  };
  hooksShared: {
    base: import("three/webgpu").UniformNode<"color", import("three/webgpu").Color>;
    tip: import("three/webgpu").UniformNode<"color", import("three/webgpu").Color>;
    sheen: import("three/webgpu").UniformNode<"float", number>;
    pulse: import("three/webgpu").UniformNode<"float", number>;
  };
  hooksNodes: {
    hueShift: import("three/webgpu").UniformNode<"float", number>;
    bands: import("three/webgpu").UniformNode<"float", number>;
    speed: import("three/webgpu").UniformNode<"float", number>;
  };
  hooksCanvases: {
    base: import("three/webgpu").UniformNode<"color", import("three/webgpu").Color>;
    tip: import("three/webgpu").UniformNode<"color", import("three/webgpu").Color>;
    bands: import("three/webgpu").UniformNode<"float", number>;
    pulse: import("three/webgpu").UniformNode<"float", number>;
  };
  hooksBuffers: {
    base: import("three/webgpu").UniformNode<"color", import("three/webgpu").Color>;
    tip: import("three/webgpu").UniformNode<"color", import("three/webgpu").Color>;
    amplitude: import("three/webgpu").UniformNode<"float", number>;
  };
  hooksStorage: {
    scale: import("three/webgpu").UniformNode<"float", number>;
    hue: import("three/webgpu").UniformNode<"float", number>;
    t: import("three/webgpu").UniformNode<"float", number>;
  };
  tslMix: {
    colorA: import("three/webgpu").UniformNode<"color", import("three/webgpu").Color>;
    colorB: import("three/webgpu").UniformNode<"color", import("three/webgpu").Color>;
    blend: import("three/webgpu").UniformNode<"float", number>;
  };
  tslNoise: {
    colorA: import("three/webgpu").UniformNode<"color", import("three/webgpu").Color>;
    colorB: import("three/webgpu").UniformNode<"color", import("three/webgpu").Color>;
    frequency: import("three/webgpu").UniformNode<"float", number>;
    speed: import("three/webgpu").UniformNode<"float", number>;
    octaves: import("three/webgpu").UniformNode<"float", number>;
    lacunarity: import("three/webgpu").UniformNode<"float", number>;
    gain: import("three/webgpu").UniformNode<"float", number>;
    contrast: import("three/webgpu").UniformNode<"float", number>;
  };
  tslWobble: ThreeFiberUniformScopes["tslNoise"] & {
    wobbleAmplitude: import("three/webgpu").UniformNode<"float", number>;
    wobbleFrequency: import("three/webgpu").UniformNode<"float", number>;
    wobbleSpeed: import("three/webgpu").UniformNode<"float", number>;
  };
  tslTerrain: {
    frequency: import("three/webgpu").UniformNode<"float", number>;
    octaves: import("three/webgpu").UniformNode<"float", number>;
    lacunarity: import("three/webgpu").UniformNode<"float", number>;
    gain: import("three/webgpu").UniformNode<"float", number>;
    amplitude: import("three/webgpu").UniformNode<"float", number>;
    offsetX: import("three/webgpu").UniformNode<"float", number>;
    offsetZ: import("three/webgpu").UniformNode<"float", number>;
    water: import("three/webgpu").UniformNode<"float", number>;
    snow: import("three/webgpu").UniformNode<"float", number>;
    treeline: import("three/webgpu").UniformNode<"float", number>;
    maxSlope: import("three/webgpu").UniformNode<"float", number>;
    clearance: import("three/webgpu").UniformNode<"float", number>;
    planeXZ: import("three/webgpu").UniformNode<"vec2", import("three/webgpu").Vector2>;
  };
}

declare interface ThreeFiberNodeScopes {
  hooksNodes: {
    palette: (inputs: {
      t: import("three/webgpu").Node<"float">;
    }) => import("three/webgpu").Node<"vec3">;
    stripes: import("three/webgpu").Node<"float">;
  };
  tslMix: {
    surface: import("three/webgpu").Node<"vec3">;
  };
  tslNoise: {
    fractal: import("three/webgpu").Node<"vec3">;
    worley: import("three/webgpu").Node<"vec3">;
    cell: import("three/webgpu").Node<"vec3">;
  };
  tslWobble: {
    fractal: import("three/webgpu").Node<"vec3">;
    worley: import("three/webgpu").Node<"vec3">;
    cell: import("three/webgpu").Node<"vec3">;
    spherePosition: import("three/webgpu").Node<"vec3">;
    boxPosition: import("three/webgpu").Node<"vec3">;
    pyramidPosition: import("three/webgpu").Node<"vec3">;
    spherePhase: import("three/webgpu").UniformNode<"float", number>;
    boxPhase: import("three/webgpu").UniformNode<"float", number>;
    pyramidPhase: import("three/webgpu").UniformNode<"float", number>;
  };
}

declare interface ThreeFiberBufferScopes {
  hooksBuffers: {
    offsets: import("three/webgpu").InstancedBufferAttribute;
    heights: import("three/webgpu").InstancedBufferAttribute;
  };
}
