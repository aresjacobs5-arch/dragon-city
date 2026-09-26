import * as THREE from 'three';
import { RNG } from '../../core/rng.js';
import * as G from '../geom.js';
import { globalUniforms, envMaterial } from '../materials.js';

const _c = new THREE.Color();
const _d = new THREE.Color();

// ---------------------------------------------------------------------------
// Prop geometry factories. Each returns a merged, vertex-colored geometry with
// its base at y = 0.
// ---------------------------------------------------------------------------

function canopyBlob(r, seed, base, light) {
  const g = G.jitter(G.ico(r, 2), r * 0.09, seed);
  const b = new THREE.Color(base), l = new THREE.Color(light);
  const dark = b.clone().offsetHSL(0.02, 0.05, -0.12);
  G.paint(g, (x, y, z, nx, ny) => {
    if (ny > 0) return _c.copy(b).lerp(l, Math.pow(ny, 1.4) * 0.9);
    return _c.copy(b).lerp(dark, -ny);
  });
  return g;
}

function trunkGeo(h, r, color, seed, bendAmt = 0.15) {
  const rng = new RNG(seed);
  const pts = [];
  for (let i = 0; i <= 3; i++) {
    const t = i / 3;
    pts.push(new THREE.Vector3(Math.sin(t * 2 + seed) * bendAmt * t, t * h, Math.cos(t * 1.7 + seed) * bendAmt * t * 0.6));
  }
  const g = G.taperTube(pts, (t) => r * (1.25 - t * 0.5) + (t < 0.12 ? (0.12 - t) * r * 3 : 0), 7, 6);
  const c = new THREE.Color(color);
  G.paint(g, (x, y, z, nx) => _c.copy(c).multiplyScalar(0.85 + nx * 0.12 + rng.range(-0.02, 0.02)));
  return g;
}

export const PROP_BUILDERS = {
  round(T, seed) {
    const rng = new RNG(seed);
    const parts = [trunkGeo(1.3, 0.16, T.trunk, seed)];
    const n = rng.int(3, 4);
    const leaves = T.leaves;
    for (let i = 0; i < n; i++) {
      const a = (i / n) * Math.PI * 2 + rng.range(0, 1);
      const r = rng.range(0.55, 0.8);
      const g = canopyBlob(r, seed + i, leaves[i % 2], leaves[2]);
      G.xf(g, { p: [Math.cos(a) * 0.38, 1.35 + rng.range(-0.1, 0.25), Math.sin(a) * 0.38] });
      parts.push(g);
    }
    const topB = canopyBlob(0.72, seed + 9, leaves[0], leaves[2]);
    G.xf(topB, { p: [0, 1.85, 0] });
    parts.push(topB);
    return G.merge(parts);
  },
  fruit(T, seed) {
    const rng = new RNG(seed);
    const base = PROP_BUILDERS.round(T, seed);
    const fruits = [base];
    for (let i = 0; i < 7; i++) {
      const a = rng.range(0, Math.PI * 2);
      const y = rng.range(1.2, 2.1);
      const r = 0.72 + (y > 1.8 ? -0.25 : 0.05);
      const f = G.sphere(0.09, 8, 6);
      G.xf(f, { p: [Math.cos(a) * r, y, Math.sin(a) * r] });
      G.toneByNormal(f, i % 3 === 0 ? '#ffb13d' : '#ff4f5a', 0.2, 0.25);
      fruits.push(f);
    }
    return G.merge(fruits);
  },
  blossom(T, seed) {
    const T2 = { ...T, leaves: ['#ffb3d9', '#f79ccb', '#ffe0f0'] };
    return PROP_BUILDERS.round(T2, seed);
  },
  pine(T, seed, snow = false) {
    const rng = new RNG(seed);
    const parts = [trunkGeo(0.7, 0.13, T.trunk, seed, 0.03)];
    const leaves = T.leaves;
    const tiers = 3;
    for (let i = 0; i < tiers; i++) {
      const r = 0.95 - i * 0.22;
      const h = 0.95 - i * 0.12;
      const g = G.jitter(G.cone(r, h, 8), 0.04, seed + i);
      const y = 0.55 + i * 0.52 + h / 2;
      G.xf(g, { p: [0, y, 0], r: [0, rng.range(0, 1), 0] });
      const base = new THREE.Color(leaves[i % 2]);
      const light = new THREE.Color(leaves[2]);
      const snowC = new THREE.Color('#ffffff');
      G.paint(g, (x, yy, z, nx, ny) => {
        _c.copy(base).lerp(light, Math.max(0, ny) * 0.5);
        if (snow && (ny > 0.35 || yy > y + h * 0.2)) _c.lerp(snowC, 0.85);
        return _c;
      });
      parts.push(g);
    }
    return G.merge(parts);
  },
  snowpine(T, seed) {
    return PROP_BUILDERS.pine({ ...T, leaves: ['#2f7a68', '#276a59', '#4f9a84'] }, seed, true);
  },
  dead(T, seed) {
    const rng = new RNG(seed);
    const parts = [trunkGeo(1.4, 0.15, T.trunk, seed, 0.25)];
    for (let i = 0; i < 3; i++) {
      const a = (i / 3) * Math.PI * 2 + rng.range(0, 1);
      const pts = [
        new THREE.Vector3(0, 0.9 + i * 0.15, 0),
        new THREE.Vector3(Math.cos(a) * 0.35, 1.2 + i * 0.12, Math.sin(a) * 0.35),
        new THREE.Vector3(Math.cos(a) * 0.6, 1.55 + i * 0.1, Math.sin(a) * 0.6),
      ];
      const g = G.taperTube(pts, (t) => 0.08 * (1 - t * 0.8), 5, 5);
      G.paint(g, T.trunk);
      parts.push(g);
      if (T.leaves) {
        const tip = G.jitter(G.ico(0.24, 1), 0.04, seed + i);
        G.xf(tip, { p: [pts[2].x, pts[2].y + 0.05, pts[2].z] });
        G.paint(tip, T.leaves[i % 3]);
        parts.push(tip);
      }
    }
    return G.merge(parts);
  },
  ember(T, seed) {
    return PROP_BUILDERS.dead(T, seed);
  },
  mushroom(T, seed) {
    const rng = new RNG(seed);
    const parts = [];
    const stem = G.lathe([[0.18, 0], [0.2, 0.2], [0.15, 0.7], [0.14, 1.1], [0.02, 1.12]], 10);
    G.paint(stem, '#efe4d6');
    parts.push(stem);
    const capC = new THREE.Color(T.leaves[0]);
    const cap = G.lathe([[0.02, 1.52], [0.4, 1.46], [0.72, 1.3], [0.82, 1.14], [0.7, 1.06], [0.2, 1.08], [0.02, 1.1]], 16);
    G.paint(cap, (x, y, z, nx, ny) => _c.copy(capC).offsetHSL(0, 0, ny > 0 ? ny * 0.12 : -0.1));
    parts.push(cap);
    for (let i = 0; i < 6; i++) {
      const a = rng.range(0, 6.28), rr = rng.range(0.15, 0.6);
      const dot = G.sphere(0.07, 6, 4);
      const y = 1.52 - rr * rr * 0.55 + 0.02;
      G.xf(dot, { p: [Math.cos(a) * rr, y, Math.sin(a) * rr], s: [1, 0.4, 1] });
      G.paint(dot, '#fff6e8');
      parts.push(dot);
    }
    return G.merge(parts);
  },
  crystal(T, seed) {
    const rng = new RNG(seed);
    const parts = [];
    const base = new THREE.Color(T.moss);
    for (let i = 0; i < 5; i++) {
      const h = rng.range(0.7, 1.8) * (i === 0 ? 1.3 : 1);
      const g = G.flat(G.crystal(h, rng.range(0.14, 0.24), 6));
      G.xf(g, { p: [rng.range(-0.25, 0.25), 0, rng.range(-0.25, 0.25)], r: [rng.range(-0.35, 0.35), rng.range(0, 3), rng.range(-0.35, 0.35)] });
      G.paint(g, (x, y, z, nx, ny) => _c.copy(base).offsetHSL(0, 0, 0.05 + ny * 0.2 + nx * 0.06));
      parts.push(g);
    }
    const rock = G.flat(G.jitter(G.ico(0.4, 0), 0.08, seed));
    G.xf(rock, { s: [1.2, 0.45, 1.2] });
    G.paint(rock, T.rock);
    parts.push(rock);
    return G.merge(parts);
  },
  palm(T, seed) {
    const rng = new RNG(seed);
    const parts = [];
    const pts = [];
    for (let i = 0; i <= 4; i++) {
      const t = i / 4;
      pts.push(new THREE.Vector3(Math.sin(t * 1.6) * 0.45, t * 2.0, 0));
    }
    const trunk = G.taperTube(pts, (t) => 0.13 * (1.15 - t * 0.4), 7, 10);
    G.paint(trunk, (x, y) => _c.set(T.trunk).multiplyScalar(0.85 + Math.sin(y * 18) * 0.12));
    parts.push(trunk);
    const top = pts[4];
    for (let i = 0; i < 7; i++) {
      const a = (i / 7) * Math.PI * 2 + rng.range(-0.2, 0.2);
      const leaf = G.leafGeo(1.2, 0.36, 0.03);
      G.bend(leaf, -1.0, 1.2);
      G.xf(leaf, { p: [top.x, top.y, top.z], r: [0, a, 0] });
      // tilt outward
      leaf.rotateY(0);
      G.paint(leaf, (x, y, z, nx, ny) => _c.set(T.leaves[i % 2]).offsetHSL(0, 0, ny * 0.08));
      parts.push(leaf);
    }
    const nut = G.sphere(0.1, 8, 6);
    G.xf(nut, { p: [top.x + 0.05, top.y - 0.12, top.z + 0.1] });
    G.paint(nut, '#7a5a2f');
    parts.push(nut);
    return G.merge(parts);
  },
  coral(T, seed) {
    const rng = new RNG(seed);
    const parts = [];
    const c = new THREE.Color(T.moss);
    for (let i = 0; i < 6; i++) {
      const a = rng.range(0, 6.28);
      const pts = [new THREE.Vector3(0, 0, 0), new THREE.Vector3(Math.cos(a) * 0.2, 0.5, Math.sin(a) * 0.2), new THREE.Vector3(Math.cos(a) * 0.45, rng.range(0.9, 1.4), Math.sin(a) * 0.45)];
      const g = G.taperTube(pts, (t) => 0.11 * (1 - t * 0.5), 6, 6);
      G.paint(g, _d.copy(c).offsetHSL(rng.range(-0.03, 0.03), 0, rng.range(-0.05, 0.08)));
      parts.push(g);
      const tip = G.sphere(0.07, 6, 4);
      G.xf(tip, { p: [pts[2].x, pts[2].y, pts[2].z] });
      G.paint(tip, '#fff0f4');
      parts.push(tip);
    }
    return G.merge(parts);
  },
  willow(T, seed) {
    const rng = new RNG(seed);
    const parts = [trunkGeo(1.5, 0.17, T.trunk, seed, 0.2)];
    const cb = canopyBlob(0.85, seed, T.leaves[0], T.leaves[2]);
    G.xf(cb, { p: [0, 1.8, 0], s: [1.1, 0.7, 1.1] });
    parts.push(cb);
    for (let i = 0; i < 10; i++) {
      const a = (i / 10) * Math.PI * 2;
      const pts = [new THREE.Vector3(Math.cos(a) * 0.75, 1.75, Math.sin(a) * 0.75), new THREE.Vector3(Math.cos(a) * 0.95, 1.2, Math.sin(a) * 0.95), new THREE.Vector3(Math.cos(a) * 1.0, rng.range(0.55, 0.85), Math.sin(a) * 1.0)];
      const g = G.taperTube(pts, 0.05, 4, 5);
      G.paint(g, T.leaves[1]);
      parts.push(g);
    }
    return G.merge(parts);
  },
  rock(T, seed, big = false) {
    const rng = new RNG(seed);
    const parts = [];
    const rockC = new THREE.Color(T.rock);
    const moss = new THREE.Color(T.moss);
    const n = big ? 3 : 1;
    for (let i = 0; i < n; i++) {
      const s = big ? rng.range(0.55, 0.95) : rng.range(0.4, 0.6);
      const g = G.flat(G.jitter(G.ico(1, 1), 0.18, seed + i * 5, 1.6));
      G.xf(g, { p: [i === 0 ? 0 : rng.range(-0.6, 0.6), s * 0.55, i === 0 ? 0 : rng.range(-0.6, 0.6)], r: [rng.range(0, 1), rng.range(0, 6), rng.range(0, 1)], s: [s * 1.2, s * 0.9, s] });
      const tint = rng.range(0.9, 1.05);
      G.paint(g, (x, y, z, nx, ny) => {
        _c.copy(rockC).multiplyScalar(tint * (0.82 + ny * 0.18));
        if (ny > 0.62) _c.lerp(moss, 0.75);
        return _c;
      });
      parts.push(g);
    }
    return G.merge(parts);
  },
  rockBig(T, seed) {
    return PROP_BUILDERS.rock(T, seed, true);
  },
  ruin(T, seed) {
    const rng = new RNG(seed);
    const parts = [];
    const stone = new THREE.Color('#d9cfbf');
    const moss = new THREE.Color(T.moss);
    const h = rng.range(1.0, 1.8);
    const col = G.flat(G.cylinder(0.26, 0.3, h, 8));
    const pos = col.attributes.position;
    for (let i = 0; i < pos.count; i++) {
      if (pos.getY(i) > h / 2 - 0.01) pos.setY(i, pos.getY(i) - rng.range(0, 0.35));
    }
    col.computeVertexNormals();
    G.xf(col, { p: [0, h / 2 + 0.12, 0], r: [rng.range(-0.08, 0.08), 0, rng.range(-0.08, 0.08)] });
    G.paint(col, (x, y, z, nx, ny) => _c.copy(stone).multiplyScalar(0.85 + Math.abs(nx) * 0.1).lerp(moss, y < 0.4 ? 0.35 : ny > 0.5 ? 0.5 : 0));
    parts.push(col);
    const base = G.flat(G.box(0.8, 0.24, 0.8));
    G.xf(base, { p: [0, 0.12, 0], r: [0, rng.range(0, 1), 0] });
    G.paint(base, (x, y, z, nx, ny) => _c.copy(stone).multiplyScalar(0.8 + ny * 0.15));
    parts.push(base);
    const chunk = G.flat(G.jitter(G.box(0.4, 0.3, 0.35), 0.05, seed));
    G.xf(chunk, { p: [0.55, 0.15, 0.3], r: [0.2, 0.5, 0.1] });
    G.paint(chunk, stone);
    parts.push(chunk);
    return G.merge(parts);
  },
  arch(T, seed) {
    const stone = new THREE.Color('#d6ccbc');
    const moss = new THREE.Color(T.moss);
    const parts = [];
    for (const sx of [-0.7, 0.7]) {
      const p = G.flat(G.box(0.34, 1.5, 0.34));
      G.xf(p, { p: [sx, 0.75, 0] });
      parts.push(p);
    }
    const arc = G.flat(G.torus(0.7, 0.17, 5, 10, Math.PI * 0.62));
    G.xf(arc, { p: [0, 1.5, 0], r: [0, 0, 0.2] });
    parts.push(arc);
    const g = G.merge(parts);
    G.paint(g, (x, y, z, nx, ny) => _c.copy(stone).multiplyScalar(0.82 + ny * 0.14).lerp(moss, y < 0.35 ? 0.4 : ny > 0.6 ? 0.45 : 0));
    return g;
  },
  bush(T, seed) {
    const rng = new RNG(seed);
    const parts = [];
    for (let i = 0; i < 3; i++) {
      const g = canopyBlob(rng.range(0.28, 0.4), seed + i, T.leaves[i % 2], T.leaves[2]);
      G.xf(g, { p: [rng.range(-0.25, 0.25), 0.22, rng.range(-0.25, 0.25)] });
      parts.push(g);
    }
    return G.merge(parts);
  },
  stump(T, seed) {
    const g = G.flat(G.cylinder(0.28, 0.34, 0.35, 9));
    G.xf(g, { p: [0, 0.17, 0] });
    G.paint(g, (x, y, z, nx, ny) => (ny > 0.9 ? _c.set('#e8c89a') : _c.set(T.trunk)));
    return g;
  },
};

// Tiny decorative geometries for instanced scatter.
export function grassTuftGeometry(color, tip) {
  const parts = [];
  const blades = 5;
  const base = new THREE.Color(color), t = new THREE.Color(tip);
  for (let i = 0; i < blades; i++) {
    const a = (i / blades) * Math.PI * 2 + 0.3 * i;
    const h = 0.3 + (i % 3) * 0.08;
    const g = new THREE.BufferGeometry();
    const w = 0.06;
    // two windings so blades are visible from both sides with upward normals
    g.setAttribute('position', new THREE.Float32BufferAttribute([-w, 0, 0, w, 0, 0, 0.02, h, 0.03, w, 0, 0, -w, 0, 0, 0.02, h, 0.03], 3));
    g.computeVertexNormals();
    G.xf(g, { p: [Math.cos(a) * 0.05, 0, Math.sin(a) * 0.05], r: [Math.sin(a) * 0.3, a, Math.cos(a) * 0.3] });
    G.paint(g, (x, y) => _c.copy(base).lerp(t, y / h));
    // double-sided normals up
    const n = g.attributes.normal;
    for (let k = 0; k < n.count; k++) n.setXYZ(k, 0, 1, 0);
    parts.push(g);
  }
  return G.merge(parts);
}

export function flowerGeometry(petal) {
  const parts = [];
  const stem = G.cylinder(0.012, 0.015, 0.22, 4);
  G.xf(stem, { p: [0, 0.11, 0] });
  G.paint(stem, '#4f9a37');
  parts.push(stem);
  for (let i = 0; i < 5; i++) {
    const a = (i / 5) * Math.PI * 2;
    const p = G.ellipsoid(0.055, 0.02, 0.035, 6, 4);
    G.xf(p, { p: [Math.cos(a) * 0.05, 0.23, Math.sin(a) * 0.05], r: [0, -a, 0] });
    G.paint(p, petal);
    parts.push(p);
  }
  const c = G.sphere(0.03, 6, 4);
  G.xf(c, { p: [0, 0.24, 0] });
  G.paint(c, '#ffd23f');
  parts.push(c);
  const g = G.merge(parts);
  const n = g.attributes.normal;
  for (let k = 0; k < n.count; k++) n.setXYZ(k, n.getX(k) * 0.3, 1, n.getZ(k) * 0.3);
  return g;
}

export function pebbleGeometry(color) {
  const g = G.flat(G.jitter(G.ico(0.09, 0), 0.02, 3));
  G.xf(g, { s: [1.3, 0.6, 1] });
  G.paint(g, color);
  return g;
}

// Wind-swaying instanced material.
function swayMaterial() {
  const m = envMaterial();
  const prev = m.onBeforeCompile;
  m.onBeforeCompile = (shader) => {
    prev(shader);
    shader.uniforms.uTime = globalUniforms.uTime;
    shader.vertexShader = shader.vertexShader
      .replace('#include <common>', '#include <common>\nuniform float uTime;')
      .replace(
        '#include <begin_vertex>',
        `#include <begin_vertex>
        #ifdef USE_INSTANCING
          vec2 ip = instanceMatrix[3].xz;
        #else
          vec2 ip = vec2(0.0);
        #endif
        float sw = sin(uTime * 1.8 + ip.x * 0.6 + ip.y * 0.4) * 0.5 + sin(uTime * 3.1 + ip.x * 1.3) * 0.2;
        transformed.x += sw * 0.09 * position.y * 3.0;
        transformed.z += sw * 0.04 * position.y * 3.0;`
      );
  };
  m.customProgramCacheKey = () => 'env-sway';
  return m;
}

// ---------------------------------------------------------------------------
// Instanced scatter layer with per-instance visibility (hidden under buildings).
// ---------------------------------------------------------------------------
export class ScatterLayer {
  constructor(geometry, material, capacity, { castShadow = false, receiveShadow = true } = {}) {
    this.mesh = new THREE.InstancedMesh(geometry, material, capacity);
    this.mesh.count = 0;
    this.mesh.castShadow = castShadow;
    this.mesh.receiveShadow = receiveShadow;
    this.items = [];
    this._m = new THREE.Matrix4();
    this._q = new THREE.Quaternion();
    this._s = new THREE.Vector3();
    this._p = new THREE.Vector3();
    this._e = new THREE.Euler();
  }
  add(x, y, z, rotY = 0, scale = 1) {
    if (this.items.length >= this.mesh.instanceMatrix.count) return -1;
    const i = this.items.length;
    this.items.push({ x, y, z, rotY, scale, visible: true });
    this._write(i);
    this.mesh.count = this.items.length;
    return i;
  }
  _write(i) {
    const it = this.items[i];
    this._e.set(0, it.rotY, 0);
    this._q.setFromEuler(this._e);
    const s = it.visible ? it.scale : 0.00001;
    this._s.set(s, s, s);
    this._p.set(it.x, it.y, it.z);
    this._m.compose(this._p, this._q, this._s);
    this.mesh.setMatrixAt(i, this._m);
  }
  refreshVisibility(isBlocked) {
    let changed = false;
    for (let i = 0; i < this.items.length; i++) {
      const it = this.items[i];
      const v = !isBlocked(it.x, it.z);
      if (v !== it.visible) {
        it.visible = v;
        this._write(i);
        changed = true;
      }
    }
    if (changed) this.mesh.instanceMatrix.needsUpdate = true;
  }
  finalize() {
    this.mesh.instanceMatrix.needsUpdate = true;
    this.mesh.computeBoundingSphere();
  }
}

export function createDecorScatter(T, seed) {
  const grassMat = swayMaterial();
  const flowerMat = swayMaterial();
  const pebMat = envMaterial({ flatShading: true });
  const layers = {
    grass: new ScatterLayer(grassTuftGeometry(new THREE.Color(T.grass[1]).offsetHSL(0, 0, -0.02), T.grassPatch), grassMat, 900),
    grass2: new ScatterLayer(grassTuftGeometry(new THREE.Color(T.grass[0]), new THREE.Color(T.grassPatch).offsetHSL(0, 0, 0.04)), grassMat, 600),
    pebbles: new ScatterLayer(pebbleGeometry(T.rock), pebMat, 140),
    flowers: T.flowers.map((c) => new ScatterLayer(flowerGeometry(c), flowerMat, 90)),
  };
  return layers;
}
