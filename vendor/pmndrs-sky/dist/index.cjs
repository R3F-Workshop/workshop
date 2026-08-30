'use strict';

const Sky = require('./shared/sky.BIl49Zx4.cjs');
const webgpu = require('three/webgpu');
require('three/tsl');
require('three/addons/tsl/display/GaussianBlurNode.js');

var __defProp = Object.defineProperty;
var __defNormalProp = (obj, key, value) => key in obj ? __defProp(obj, key, { enumerable: true, configurable: true, writable: true, value }) : obj[key] = value;
var __publicField = (obj, key, value) => __defNormalProp(obj, typeof key !== "symbol" ? key + "" : key, value);
class SkyHelper extends webgpu.Object3D {
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
    this.elevationGeometry = new webgpu.BufferGeometry();
    this.elevationArc = new webgpu.Line(
      this.elevationGeometry,
      new webgpu.LineBasicMaterial({
        color: new webgpu.Color("#fc3"),
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
    const group = new webgpu.Object3D();
    const ringGeometry = new webgpu.BufferGeometry();
    const ringPoints = [];
    const segments = 64;
    for (let i = 0; i <= segments; i++) {
      const angle = i / segments * Math.PI * 2;
      ringPoints.push(new webgpu.Vector3(Math.sin(angle) * this.size, 0, Math.cos(angle) * this.size));
    }
    ringGeometry.setFromPoints(ringPoints);
    const ring = new webgpu.Line(ringGeometry, new webgpu.LineBasicMaterial({ color: new webgpu.Color("#444444") }));
    group.add(ring);
    const northGeometry = new webgpu.BufferGeometry();
    northGeometry.setFromPoints([new webgpu.Vector3(0, 0, this.size), new webgpu.Vector3(0, 0, this.size * 1.2)]);
    const northTick = new webgpu.Line(northGeometry, new webgpu.LineBasicMaterial({ color: new webgpu.Color("#e33") }));
    group.add(northTick);
    const otherTicksGeometry = new webgpu.BufferGeometry();
    otherTicksGeometry.setFromPoints([
      // +X (east)
      new webgpu.Vector3(this.size, 0, 0),
      new webgpu.Vector3(this.size * 1.1, 0, 0),
      // -X (west)
      new webgpu.Vector3(-this.size, 0, 0),
      new webgpu.Vector3(-this.size * 1.1, 0, 0),
      // -Z (south)
      new webgpu.Vector3(0, 0, -this.size),
      new webgpu.Vector3(0, 0, -this.size * 1.1)
    ]);
    const otherTicks = new webgpu.Line(otherTicksGeometry, new webgpu.LineBasicMaterial({ color: new webgpu.Color("#888") }));
    group.add(otherTicks);
    return group;
  }
  buildArrow() {
    const group = new webgpu.Object3D();
    const shaftGeometry = new webgpu.BufferGeometry();
    shaftGeometry.setFromPoints([new webgpu.Vector3(0, 0, 0), new webgpu.Vector3(0, this.size, 0)]);
    const shaft = new webgpu.Line(shaftGeometry, new webgpu.LineBasicMaterial({ color: new webgpu.Color("#fc3"), linewidth: 2 }));
    group.add(shaft);
    const coneGeometry = new webgpu.ConeGeometry(this.size * 0.15, this.size * 0.3, 16);
    const cone = new webgpu.Mesh(coneGeometry, new webgpu.MeshBasicMaterial({ color: new webgpu.Color("#fc3") }));
    cone.position.y = this.size;
    group.add(cone);
    return group;
  }
  updateFromSun(sunVec) {
    const normalized = sunVec.clone().normalize();
    this.arrowGroup.quaternion.setFromUnitVectors(new webgpu.Vector3(0, 1, 0), normalized);
    const sunAzimuth = Math.atan2(sunVec.x, sunVec.z);
    const horizonPoint = new webgpu.Vector3(Math.sin(sunAzimuth) * this.size, 0, Math.cos(sunAzimuth) * this.size);
    const sunPoint = sunVec.clone().normalize().multiplyScalar(this.size);
    const arcPoints = [];
    const arcSegments = 24;
    for (let i = 0; i <= arcSegments; i++) {
      const t = i / arcSegments;
      const point = new webgpu.Vector3().lerpVectors(horizonPoint, sunPoint, t).normalize().multiplyScalar(this.size);
      arcPoints.push(point);
    }
    this.elevationGeometry.dispose();
    this.elevationGeometry = new webgpu.BufferGeometry();
    this.elevationGeometry.setFromPoints(arcPoints);
    this.elevationArc.geometry = this.elevationGeometry;
  }
  dispose() {
    if (this.sunListener) {
      this.sunListener();
      this.sunListener = null;
    }
    this.compassGroup.traverse((child) => {
      if (child instanceof webgpu.Line) {
        child.geometry.dispose();
        if (child.material instanceof webgpu.LineBasicMaterial) {
          child.material.dispose();
        }
      }
    });
    this.arrowGroup.traverse((child) => {
      if (child.geometry) child.geometry.dispose();
      if (child.material instanceof webgpu.MeshBasicMaterial || child.material instanceof webgpu.LineBasicMaterial) {
        child.material.dispose();
      }
    });
    this.elevationGeometry.dispose();
    if (this.elevationArc.material instanceof webgpu.LineBasicMaterial) {
      this.elevationArc.material.dispose();
    }
  }
}

exports.AerialPerspectiveLUT = Sky.AerialPerspectiveLUT;
exports.EARTH = Sky.EARTH;
exports.GroundedSkybox = Sky.GroundedSkybox;
exports.LUT_RESOLUTIONS = Sky.LUT_RESOLUTIONS;
exports.MultiScatterLUT = Sky.MultiScatterLUT;
exports.Sky = Sky.Sky;
exports.SkyAtmosphereBaker = Sky.SkyAtmosphereBaker;
exports.SkyAtmosphereMesh = Sky.SkyAtmosphereMesh;
exports.SkyGround = Sky.SkyGround;
exports.SkyMoon = Sky.SkyMoon;
exports.SkyNight = Sky.SkyNight;
exports.SkySun = Sky.SkySun;
exports.SkyViewLUT = Sky.SkyViewLUT;
exports.TransmittanceLUT = Sky.TransmittanceLUT;
exports.applyHaze = Sky.applyHaze;
exports.createHazeOutputNode = Sky.createHazeOutputNode;
exports.mergeAtmosphereParams = Sky.mergeAtmosphereParams;
exports.presets = Sky.presets;
exports.resolvePreset = Sky.resolvePreset;
exports.solarPosition = Sky.solarPosition;
exports.SkyHelper = SkyHelper;
