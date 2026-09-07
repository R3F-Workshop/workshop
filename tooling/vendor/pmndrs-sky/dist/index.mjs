export { A as AerialPerspectiveLUT, E as EARTH, G as GroundedSkybox, L as LUT_RESOLUTIONS, M as MultiScatterLUT, S as Sky, a as SkyAtmosphereBaker, b as SkyAtmosphereMesh, c as SkyGround, d as SkyMoon, e as SkyNight, f as SkySun, g as SkyViewLUT, T as TransmittanceLUT, h as applyHaze, i as createHazeOutputNode, m as mergeAtmosphereParams, p as presets, r as resolvePreset, s as solarPosition } from './shared/sky.ButMu2p_.mjs';
import { Object3D, BufferGeometry, Line, LineBasicMaterial, Color, Vector3, ConeGeometry, Mesh, MeshBasicMaterial } from 'three/webgpu';
import 'three/tsl';
import 'three/addons/tsl/display/GaussianBlurNode.js';

var __defProp = Object.defineProperty;
var __defNormalProp = (obj, key, value) => key in obj ? __defProp(obj, key, { enumerable: true, configurable: true, writable: true, value }) : obj[key] = value;
var __publicField = (obj, key, value) => __defNormalProp(obj, typeof key !== "symbol" ? key + "" : key, value);
class SkyHelper extends Object3D {
  constructor(sky, options) {
    super();
    __publicField(this, "baker");
    __publicField(this, "size");
    __publicField(this, "compassGroup");
    __publicField(this, "arrowGroup");
    __publicField(this, "elevationArc");
    __publicField(this, "elevationGeometry");
    __publicField(this, "sunListener", null);
    this.baker = sky?.baker ?? sky;
    this.size = options?.size ?? 10;
    this.compassGroup = this.buildCompass();
    this.add(this.compassGroup);
    this.arrowGroup = this.buildArrow();
    this.add(this.arrowGroup);
    this.elevationGeometry = new BufferGeometry();
    this.elevationArc = new Line(
      this.elevationGeometry,
      new LineBasicMaterial({
        color: new Color("#fc3"),
        transparent: true,
        opacity: 0.4
      })
    );
    this.add(this.elevationArc);
    this.sunListener = this.baker.addSunListener((sunVec) => {
      this.updateFromSun(sunVec);
    });
    if (this.baker._sunVec) {
      this.updateFromSun(this.baker._sunVec);
    }
  }
  buildCompass() {
    const group = new Object3D();
    const ringGeometry = new BufferGeometry();
    const ringPoints = [];
    const segments = 64;
    for (let i = 0; i <= segments; i++) {
      const angle = i / segments * Math.PI * 2;
      ringPoints.push(new Vector3(Math.sin(angle) * this.size, 0, Math.cos(angle) * this.size));
    }
    ringGeometry.setFromPoints(ringPoints);
    const ring = new Line(ringGeometry, new LineBasicMaterial({ color: new Color("#444444") }));
    group.add(ring);
    const northGeometry = new BufferGeometry();
    northGeometry.setFromPoints([new Vector3(0, 0, this.size), new Vector3(0, 0, this.size * 1.2)]);
    const northTick = new Line(northGeometry, new LineBasicMaterial({ color: new Color("#e33") }));
    group.add(northTick);
    const otherTicksGeometry = new BufferGeometry();
    otherTicksGeometry.setFromPoints([
      // +X (east)
      new Vector3(this.size, 0, 0),
      new Vector3(this.size * 1.1, 0, 0),
      // -X (west)
      new Vector3(-this.size, 0, 0),
      new Vector3(-this.size * 1.1, 0, 0),
      // -Z (south)
      new Vector3(0, 0, -this.size),
      new Vector3(0, 0, -this.size * 1.1)
    ]);
    const otherTicks = new Line(otherTicksGeometry, new LineBasicMaterial({ color: new Color("#888") }));
    group.add(otherTicks);
    return group;
  }
  buildArrow() {
    const group = new Object3D();
    const shaftGeometry = new BufferGeometry();
    shaftGeometry.setFromPoints([new Vector3(0, 0, 0), new Vector3(0, this.size, 0)]);
    const shaft = new Line(shaftGeometry, new LineBasicMaterial({ color: new Color("#fc3"), linewidth: 2 }));
    group.add(shaft);
    const coneGeometry = new ConeGeometry(this.size * 0.15, this.size * 0.3, 16);
    const cone = new Mesh(coneGeometry, new MeshBasicMaterial({ color: new Color("#fc3") }));
    cone.position.y = this.size;
    group.add(cone);
    return group;
  }
  updateFromSun(sunVec) {
    const normalized = sunVec.clone().normalize();
    this.arrowGroup.quaternion.setFromUnitVectors(new Vector3(0, 1, 0), normalized);
    const sunAzimuth = Math.atan2(sunVec.x, sunVec.z);
    const horizonPoint = new Vector3(Math.sin(sunAzimuth) * this.size, 0, Math.cos(sunAzimuth) * this.size);
    const sunPoint = sunVec.clone().normalize().multiplyScalar(this.size);
    const arcPoints = [];
    const arcSegments = 24;
    for (let i = 0; i <= arcSegments; i++) {
      const t = i / arcSegments;
      const point = new Vector3().lerpVectors(horizonPoint, sunPoint, t).normalize().multiplyScalar(this.size);
      arcPoints.push(point);
    }
    this.elevationGeometry.dispose();
    this.elevationGeometry = new BufferGeometry();
    this.elevationGeometry.setFromPoints(arcPoints);
    this.elevationArc.geometry = this.elevationGeometry;
  }
  dispose() {
    if (this.sunListener) {
      this.sunListener();
      this.sunListener = null;
    }
    this.compassGroup.traverse((child) => {
      if (child instanceof Line) {
        child.geometry.dispose();
        if (child.material instanceof LineBasicMaterial) {
          child.material.dispose();
        }
      }
    });
    this.arrowGroup.traverse((child) => {
      if (child.geometry) child.geometry.dispose();
      if (child.material instanceof MeshBasicMaterial || child.material instanceof LineBasicMaterial) {
        child.material.dispose();
      }
    });
    this.elevationGeometry.dispose();
    if (this.elevationArc.material instanceof LineBasicMaterial) {
      this.elevationArc.material.dispose();
    }
  }
}

export { SkyHelper };
