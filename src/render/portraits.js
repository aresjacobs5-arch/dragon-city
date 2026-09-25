import * as THREE from 'three';
import { MonsterView, getTemplate } from './monsters/builder.js';
import { buildModel } from './buildings/models.js';
import { eggMesh } from './monsters/eggs.js';
import { species as getSpecies } from '../systems/monsters.js';

// Renders thumbnails (monster portraits, silhouettes, buildings, eggs) into a
// small render target and caches them as object URLs. Work is queued and
// processed a couple of items per frame to avoid hitches.
export class Thumbnailer {
  constructor(engine) {
    this.engine = engine;
    this.size = 256;
    this.rt = new THREE.WebGLRenderTarget(this.size, this.size, { samples: 4, colorSpace: THREE.SRGBColorSpace });
    this.scene = new THREE.Scene();
    this.cam = new THREE.PerspectiveCamera(28, 1, 0.05, 100);
    this.scene.add(new THREE.HemisphereLight('#f0f6ff', '#8a7a6a', 1.4));
    const key = new THREE.DirectionalLight('#fff4e6', 2.6);
    key.position.set(-2, 3, 4);
    this.scene.add(key);
    const rim = new THREE.DirectionalLight('#cfe6ff', 1.6);
    rim.position.set(3, 2, -3);
    this.scene.add(rim);
    this.cache = new Map();
    this.pending = new Map();
    this.queue = [];
    this.buf = new Uint8Array(this.size * this.size * 4);
    this.canvas = document.createElement('canvas');
    this.canvas.width = this.canvas.height = this.size;
    this.ctx = this.canvas.getContext('2d');
    engine.onLateFrame(() => this._process());
  }

  _request(key, job) {
    if (this.cache.has(key)) return Promise.resolve(this.cache.get(key));
    if (this.pending.has(key)) return this.pending.get(key);
    const p = new Promise((resolve) => this.queue.push({ key, job, resolve }));
    this.pending.set(key, p);
    return p;
  }

  monster(sp, stage = 1, { silhouette = false } = {}) {
    return this._request(`m:${sp}:${stage}:${silhouette ? 1 : 0}`, () => this._renderMonster(sp, stage, silhouette));
  }
  building(type, level = 1) {
    return this._request(`b:${type}:${level}`, () => this._renderObject(buildModel(type, level), { elev: 0.62, fill: 0.8 }));
  }
  egg(sp) {
    return this._request(`e:${sp}`, () => {
      const e = eggMesh(getSpecies(sp), { glow: false });
      return this._renderObject(e, { elev: 0.15, fill: 0.78, yaw: 0 });
    });
  }
  // Synchronous cache peek
  peek(key) {
    return this.cache.get(key) || null;
  }

  _process() {
    let budget = 2;
    while (budget-- > 0 && this.queue.length) {
      const { key, job, resolve } = this.queue.shift();
      let url = null;
      try {
        url = job();
      } catch (e) {
        console.warn('[thumbs] failed', key, e);
      }
      this.cache.set(key, url);
      this.pending.delete(key);
      resolve(url);
    }
  }

  _renderMonster(sp, stage, silhouette) {
    const def = getSpecies(sp);
    const v = new MonsterView(def, stage, { castShadow: false, cloud: false, rim: 0.7 });
    v.group.rotation.y = -0.5;
    v.animator.update(0.016);
    if (silhouette) v.setSilhouette(1);
    const url = this._renderObject(v.group, { elev: 0.2, fill: 0.86, yaw: null, monster: v });
    v.dispose();
    return url;
  }

  _renderObject(obj, { elev = 0.3, fill = 0.85, yaw = 0.55, monster = null } = {}) {
    const r = this.engine.renderer;
    this.scene.add(obj);
    if (yaw !== null) obj.rotation.y = yaw;
    obj.updateMatrixWorld(true);
    const box = new THREE.Box3();
    if (monster) {
      const t = monster.template;
      const s = t.scale;
      box.min.set(t.bbox.min.x * s, 0, t.bbox.min.z * s);
      box.max.set(t.bbox.max.x * s, t.bbox.max.y * s, t.bbox.max.z * s);
      box.applyMatrix4(new THREE.Matrix4().makeRotationY(obj.rotation.y));
    } else box.setFromObject(obj);
    const size = new THREE.Vector3();
    const center = new THREE.Vector3();
    box.getSize(size);
    box.getCenter(center);
    const radius = Math.max(size.x, size.y * 1.05, size.z) * 0.5;
    const dist = radius / Math.sin((this.cam.fov * Math.PI) / 360) / fill;
    this.cam.position.set(center.x, center.y + dist * Math.sin(elev), center.z + dist * Math.cos(elev));
    this.cam.lookAt(center.x, center.y, center.z);
    this.cam.updateProjectionMatrix();
    const prevTarget = r.getRenderTarget();
    const prevClear = r.getClearColor(new THREE.Color());
    const prevAlpha = r.getClearAlpha();
    const prevScissor = r.getScissorTest();
    r.setScissorTest(false);
    r.setRenderTarget(this.rt);
    r.setClearColor(0x000000, 0);
    r.clear(true, true, true);
    r.render(this.scene, this.cam);
    r.readRenderTargetPixels(this.rt, 0, 0, this.size, this.size, this.buf);
    r.setRenderTarget(prevTarget);
    r.setClearColor(prevClear, prevAlpha);
    r.setScissorTest(prevScissor);
    this.scene.remove(obj);
    // flip Y into the 2D canvas
    const img = this.ctx.createImageData(this.size, this.size);
    const row = this.size * 4;
    for (let y = 0; y < this.size; y++) {
      img.data.set(this.buf.subarray((this.size - 1 - y) * row, (this.size - y) * row), y * row);
    }
    this.ctx.putImageData(img, 0, 0);
    return this.canvas.toDataURL('image/png');
  }
}

export function templateFor(sp, stage) {
  return getTemplate(getSpecies(sp), stage);
}
