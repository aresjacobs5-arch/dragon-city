import * as THREE from 'three';
import { getParticleAtlas } from '../textures.js';

// Atlas frames (see textures.js): 0 dot, 1 star, 2 streak, 3 ring, 4 smoke, 5 heart,
// 6 leaf, 7 flame, 8 snowflake, 9 bolt, 10 coin, 11 z, 12 note, 13 plus, 14 drop, 15 diamond
const PRESETS = {
  dust: { frame: 4, colors: ['#f4e6cc', '#e8d4b0', '#fff6e3'], size: [0.9, 1.6], speed: [0.6, 1.6], up: [0.4, 1.2], gravity: -0.6, drag: 2.2, life: [0.7, 1.2], additive: false, spin: 1, grow: 1.2 },
  puff: { frame: 4, colors: ['#ffffff', '#eef4ff'], size: [1.2, 2.2], speed: [1.2, 2.6], up: [0.3, 1.2], gravity: -0.4, drag: 2.5, life: [0.6, 1.0], additive: false, spin: 1, grow: 1.4 },
  sparkle: { frame: 1, colors: ['#fff6b0', '#ffffff', '#ffe27a'], size: [0.35, 0.8], speed: [1, 3], up: [0.5, 2.5], gravity: 1.2, drag: 1.2, life: [0.6, 1.2], additive: true, spin: 3 },
  star: { frame: 1, colors: ['#ffd84a', '#fff6b0'], size: [0.5, 1.0], speed: [2, 5], up: [1, 4], gravity: 4, drag: 0.8, life: [0.7, 1.3], additive: true, spin: 4 },
  coin: { frame: 10, colors: ['#ffc83d', '#ffd84a'], size: [0.45, 0.65], speed: [1.5, 3], up: [3, 5], gravity: 9, drag: 0.4, life: [0.8, 1.1], additive: false, spin: 0 },
  heart: { frame: 5, colors: ['#ff6aa0', '#ff9ac8', '#ff4f7b'], size: [0.4, 0.8], speed: [0.2, 0.8], up: [0.8, 1.6], gravity: -0.3, drag: 0.8, life: [1.0, 1.6], additive: false, spin: 0.5 },
  leaf: { frame: 6, colors: ['#6fcf4f', '#5fae3f', '#9fe06a'], size: [0.35, 0.6], speed: [0.8, 2], up: [0.5, 2], gravity: 1.5, drag: 1.5, life: [1.0, 1.6], additive: false, spin: 4 },
  ember: { frame: 0, colors: ['#ffb03a', '#ff7a1f', '#ffe27a'], size: [0.18, 0.34], speed: [0.1, 0.4], up: [0.5, 1.4], gravity: -0.6, drag: 0.6, life: [0.6, 1.2], additive: true, spin: 0 },
  zzz: { frame: 11, colors: ['#ffffff', '#dfe8ff'], size: [0.35, 0.55], speed: [0.05, 0.2], up: [0.35, 0.6], gravity: -0.1, drag: 0.3, life: [1.6, 2.2], additive: false, spin: 0.3, grow: 0.8 },
  snow: { frame: 8, colors: ['#ffffff', '#dff4ff'], size: [0.25, 0.5], speed: [0.3, 1], up: [0.2, 1], gravity: 0.8, drag: 1, life: [1, 1.6], additive: false, spin: 2 },
  bubble: { frame: 3, colors: ['#bff0ff', '#ffffff'], size: [0.25, 0.5], speed: [0.1, 0.4], up: [0.6, 1.2], gravity: -0.4, drag: 0.5, life: [1, 1.6], additive: true, spin: 0, grow: 0.6 },
  magic: { frame: 15, colors: ['#ff9ae6', '#9ae6ff', '#ffe89a'], size: [0.3, 0.6], speed: [0.5, 2], up: [0.5, 2], gravity: -0.2, drag: 1, life: [0.8, 1.4], additive: true, spin: 3 },
  confetti: { frame: 15, colors: ['#ff5a4a', '#ffc83d', '#3fa9f5', '#62c63c', '#ff6aa0', '#9b6af0'], size: [0.3, 0.55], speed: [2, 6], up: [3, 7], gravity: 6, drag: 1.2, life: [1.4, 2.2], additive: false, spin: 6 },
  shock: { frame: 3, colors: ['#ffffff'], size: [1.5, 1.5], speed: [0, 0], up: [0, 0], gravity: 0, drag: 0, life: [0.35, 0.35], additive: true, spin: 0, grow: 5 },
  flash: { frame: 0, colors: ['#ffffff'], size: [3, 3], speed: [0, 0], up: [0, 0], gravity: 0, drag: 0, life: [0.25, 0.25], additive: true, spin: 0, grow: 1.5 },
  bolt: { frame: 9, colors: ['#fff17a', '#ffffff', '#7fe8ff'], size: [0.4, 0.8], speed: [1.5, 4], up: [0, 2], gravity: 0, drag: 2, life: [0.25, 0.5], additive: true, spin: 6 },
  flame: { frame: 7, colors: ['#ffb03a', '#ff6a1f', '#ffe27a'], size: [0.5, 1.0], speed: [0.5, 2.5], up: [0.5, 2.5], gravity: -1.5, drag: 1.5, life: [0.35, 0.7], additive: true, spin: 1, grow: 0.5 },
  drop: { frame: 14, colors: ['#7fd8ff', '#bff0ff', '#2fa6ee'], size: [0.25, 0.45], speed: [1.5, 3.5], up: [1, 3.5], gravity: 9, drag: 0.5, life: [0.5, 0.9], additive: false, spin: 0 },
  rock: { frame: 15, colors: ['#a8784a', '#8a6a4a', '#c8a070'], size: [0.25, 0.45], speed: [1.5, 3.5], up: [1.5, 4], gravity: 10, drag: 0.4, life: [0.5, 0.9], additive: false, spin: 6 },
  shadow: { frame: 4, colors: ['#5a3a8a', '#2a1a4a', '#8a5ad8'], size: [0.8, 1.5], speed: [0.5, 1.8], up: [0.2, 1.2], gravity: -0.4, drag: 2, life: [0.5, 1.0], additive: false, spin: 1, grow: 1.2 },
  plus: { frame: 13, colors: ['#7dff7a', '#c8ffb0'], size: [0.3, 0.55], speed: [0.2, 0.8], up: [0.8, 1.6], gravity: -0.5, drag: 1, life: [0.8, 1.2], additive: true, spin: 0 },
  note: { frame: 12, colors: ['#ff9ae6', '#9ae6ff', '#ffe89a'], size: [0.35, 0.55], speed: [0.2, 0.5], up: [0.5, 1], gravity: -0.3, drag: 0.4, life: [1.2, 1.8], additive: false, spin: 0.5 },
};

const VS = /* glsl */ `
  attribute float aSize;
  attribute float aAlpha;
  attribute float aFrame;
  attribute float aRot;
  attribute vec3 aColor;
  varying float vAlpha;
  varying float vFrame;
  varying float vRot;
  varying vec3 vColor;
  uniform float uScale;
  uniform float uMax;
  void main() {
    vAlpha = aAlpha;
    vFrame = aFrame;
    vRot = aRot;
    vColor = aColor;
    vec4 mv = modelViewMatrix * vec4(position, 1.0);
    gl_Position = projectionMatrix * mv;
    gl_PointSize = min(aSize * uScale / max(0.1, -mv.z), uMax);
  }`;
const FS = /* glsl */ `
  uniform sampler2D uAtlas;
  varying float vAlpha;
  varying float vFrame;
  varying float vRot;
  varying vec3 vColor;
  void main() {
    vec2 p = gl_PointCoord - 0.5;
    float c = cos(vRot), s = sin(vRot);
    p = vec2(c * p.x - s * p.y, s * p.x + c * p.y) + 0.5;
    if (p.x < 0.0 || p.y < 0.0 || p.x > 1.0 || p.y > 1.0) discard;
    float fx = mod(vFrame, 4.0), fy = floor(vFrame / 4.0);
    vec2 uv = vec2((fx + p.x) / 4.0, 1.0 - (fy + p.y) / 4.0);
    vec4 t = texture2D(uAtlas, uv);
    float a = t.a * vAlpha;
    if (a < 0.01) discard;
    gl_FragColor = vec4(vColor * t.rgb, a);
    #include <colorspace_fragment>
  }`;

class Pool {
  constructor(capacity, additive) {
    this.cap = capacity;
    this.n = 0;
    this.p = [];
    const geo = new THREE.BufferGeometry();
    this.pos = new Float32Array(capacity * 3);
    this.col = new Float32Array(capacity * 3);
    this.size = new Float32Array(capacity);
    this.alpha = new Float32Array(capacity);
    this.frame = new Float32Array(capacity);
    this.rot = new Float32Array(capacity);
    geo.setAttribute('position', new THREE.BufferAttribute(this.pos, 3).setUsage(THREE.DynamicDrawUsage));
    geo.setAttribute('aColor', new THREE.BufferAttribute(this.col, 3).setUsage(THREE.DynamicDrawUsage));
    geo.setAttribute('aSize', new THREE.BufferAttribute(this.size, 1).setUsage(THREE.DynamicDrawUsage));
    geo.setAttribute('aAlpha', new THREE.BufferAttribute(this.alpha, 1).setUsage(THREE.DynamicDrawUsage));
    geo.setAttribute('aFrame', new THREE.BufferAttribute(this.frame, 1).setUsage(THREE.DynamicDrawUsage));
    geo.setAttribute('aRot', new THREE.BufferAttribute(this.rot, 1).setUsage(THREE.DynamicDrawUsage));
    geo.setDrawRange(0, 0);
    this.mat = new THREE.ShaderMaterial({
      uniforms: { uAtlas: { value: getParticleAtlas() }, uScale: { value: 300 }, uMax: { value: 400 } },
      vertexShader: VS,
      fragmentShader: FS,
      transparent: true,
      depthWrite: false,
      blending: additive ? THREE.AdditiveBlending : THREE.NormalBlending,
    });
    this.points = new THREE.Points(geo, this.mat);
    this.points.frustumCulled = false;
    this.points.renderOrder = additive ? 20 : 19;
    this.geo = geo;
  }
  add(pt) {
    if (this.p.length >= this.cap) this.p.shift();
    this.p.push(pt);
  }
  update(dt) {
    const P = this.p;
    let w = 0;
    for (let i = 0; i < P.length; i++) {
      const q = P[i];
      q.t += dt;
      if (q.t >= q.life) continue;
      q.vy -= q.g * dt;
      const d = Math.exp(-q.drag * dt);
      q.vx *= d;
      q.vy *= q.g < 0 ? d : 1;
      q.vz *= d;
      q.x += q.vx * dt;
      q.y += q.vy * dt;
      q.z += q.vz * dt;
      q.r += q.spin * dt;
      P[w++] = q;
    }
    P.length = w;
    for (let i = 0; i < P.length; i++) {
      const q = P[i];
      const k = q.t / q.life;
      this.pos[i * 3] = q.x;
      this.pos[i * 3 + 1] = q.y;
      this.pos[i * 3 + 2] = q.z;
      this.col[i * 3] = q.cr;
      this.col[i * 3 + 1] = q.cg;
      this.col[i * 3 + 2] = q.cb;
      const pop = Math.min(1, q.t / 0.08);
      this.size[i] = q.s * pop * (1 + q.grow * k);
      this.alpha[i] = (k < 0.7 ? 1 : 1 - (k - 0.7) / 0.3) * q.a;
      this.frame[i] = q.f;
      this.rot[i] = q.r;
    }
    this.geo.setDrawRange(0, P.length);
    for (const k of ['position', 'aColor', 'aSize', 'aAlpha', 'aFrame', 'aRot']) this.geo.attributes[k].needsUpdate = true;
  }
}

const _col = new THREE.Color();

export class Particles {
  constructor(scene, capacity = 1500) {
    this.normal = new Pool(capacity, false);
    this.additive = new Pool(capacity, true);
    scene.add(this.normal.points);
    scene.add(this.additive.points);
  }

  // drop every live particle (e.g. when the scene behind them changes)
  clear() {
    this.normal.p.length = 0;
    this.additive.p.length = 0;
  }
  setScale(pixelHeight, fov = 30) {
    const s = pixelHeight / (2 * Math.tan((fov * Math.PI) / 360));
    this.normal.mat.uniforms.uScale.value = s;
    this.additive.mat.uniforms.uScale.value = s;
    // never let a single sprite cover the screen
    this.normal.mat.uniforms.uMax.value = pixelHeight * 0.4;
    this.additive.mat.uniforms.uMax.value = pixelHeight * 0.3;
  }
  emit(type, pos, { count = 10, color = null, spread = 0.3, speed = 1, size = 1, dir = null, up = 1, life = 1 } = {}) {
    const pr = PRESETS[type] || PRESETS.sparkle;
    const pool = pr.additive ? this.additive : this.normal;
    const rnd = (a) => a[0] + Math.random() * (a[1] - a[0]);
    for (let i = 0; i < count; i++) {
      const a = Math.random() * Math.PI * 2;
      const sp = rnd(pr.speed) * speed;
      _col.set(color || pr.colors[(Math.random() * pr.colors.length) | 0]);
      let vx = Math.cos(a) * sp, vz = Math.sin(a) * sp, vy = rnd(pr.up) * up;
      if (dir) {
        vx = dir.x * sp + (Math.random() - 0.5) * sp * 0.5;
        vy = dir.y * sp + (Math.random() - 0.5) * sp * 0.5;
        vz = dir.z * sp + (Math.random() - 0.5) * sp * 0.5;
      }
      pool.add({
        x: pos.x + (Math.random() - 0.5) * spread * 2,
        y: pos.y + (Math.random() - 0.5) * spread,
        z: pos.z + (Math.random() - 0.5) * spread * 2,
        vx, vy, vz,
        g: pr.gravity,
        drag: pr.drag,
        t: 0,
        life: rnd(pr.life) * life,
        s: rnd(pr.size) * size,
        a: 1,
        f: pr.frame,
        r: Math.random() * 6.28,
        spin: (Math.random() - 0.5) * pr.spin * 2,
        grow: pr.grow || 0,
        cr: _col.r,
        cg: _col.g,
        cb: _col.b,
      });
    }
  }
  update(dt) {
    this.normal.update(dt);
    this.additive.update(dt);
  }
}
