import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { valueNoise3, worley3, worleyCell } from '../../core/noise.js';

// RigBuilder collects geometry parts, each rigidly bound to one bone, and
// merges them into a single skinned geometry (one draw call per monster).
// Parts carry vertex colors plus a per-vertex "glow" value that the creature
// shader turns into emissive light (lava cracks, flames, runes, eye sparkles).

const _c = new THREE.Color();

export class RigBuilder {
  constructor() {
    this.bones = new Map(); // name -> { name, parent, abs: Vector3, index }
    this.order = [];
    this.parts = [];
    this.emitters = []; // particle emitters bound to bones: { bone, type, offset }
    this.bone('root', null, [0, 0, 0]);
  }

  emitter(bone, type, offset = [0, 0, 0], rate = 1) {
    this.emitters.push({ bone, type, offset, rate });
  }

  bone(name, parent, abs) {
    if (this.bones.has(name)) {
      const b = this.bones.get(name);
      b.abs.set(abs[0], abs[1], abs[2]);
      return b;
    }
    const b = { name, parent, abs: new THREE.Vector3(abs[0], abs[1], abs[2]), index: this.order.length };
    this.bones.set(name, b);
    this.order.push(b);
    return b;
  }

  has(name) {
    return this.bones.has(name);
  }

  // Adds a part. `paint` is a color, a function (x,y,z,nx,ny,nz)=>Color, or null
  // (keep existing colors). `glow` is a number or function returning 0..1.
  part(geo, boneName = 'root', paint = null, glow = 0, pat = 0) {
    let g = geo.index ? geo.toNonIndexed() : geo;
    for (const k of Object.keys(g.attributes)) if (k !== 'position' && k !== 'normal' && k !== 'color' && k !== 'glow' && k !== 'pat') g.deleteAttribute(k);
    if (!g.attributes.normal) g.computeVertexNormals();
    const pos = g.attributes.position, nor = g.attributes.normal;
    const n = pos.count;
    if (paint !== null || !g.attributes.color) {
      const arr = new Float32Array(n * 3);
      const fixed = typeof paint === 'function' ? null : _c.set(paint === null ? 0xffffff : paint).clone();
      for (let i = 0; i < n; i++) {
        const cc = fixed || paint(pos.getX(i), pos.getY(i), pos.getZ(i), nor.getX(i), nor.getY(i), nor.getZ(i));
        arr[i * 3] = cc.r;
        arr[i * 3 + 1] = cc.g;
        arr[i * 3 + 2] = cc.b;
      }
      g.setAttribute('color', new THREE.BufferAttribute(arr, 3));
    }
    if (!g.attributes.glow || glow !== 0) {
      const ga = new Float32Array(n);
      if (typeof glow === 'function') {
        for (let i = 0; i < n; i++) ga[i] = glow(pos.getX(i), pos.getY(i), pos.getZ(i), nor.getX(i), nor.getY(i), nor.getZ(i));
      } else ga.fill(glow);
      g.setAttribute('glow', new THREE.BufferAttribute(ga, 1));
    }
    if (!g.attributes.pat || pat !== 0) {
      const pa = new Float32Array(n);
      pa.fill(pat);
      g.setAttribute('pat', new THREE.BufferAttribute(pa, 1));
    }
    const b = this.bones.get(boneName) || this.bones.get('root');
    const si = new Uint16Array(n * 4);
    const sw = new Float32Array(n * 4);
    for (let i = 0; i < n; i++) {
      si[i * 4] = b.index;
      sw[i * 4] = 1;
    }
    g.setAttribute('skinIndex', new THREE.BufferAttribute(si, 4));
    g.setAttribute('skinWeight', new THREE.BufferAttribute(sw, 4));
    this.parts.push(g);
    return g;
  }

  // Produces a serializable template: merged geometry + bone definitions.
  build() {
    const geo = mergeGeometries(this.parts, false);
    geo.computeBoundingBox();
    geo.computeBoundingSphere();
    const bones = this.order.map((b) => ({ name: b.name, parent: b.parent, abs: b.abs.clone() }));
    return { geometry: geo, bones, emitters: this.emitters.slice() };
  }
}

// Instantiate bones for a template (each monster instance needs its own skeleton).
export function createSkeleton(bonesDef) {
  const bones = [];
  const byName = {};
  for (const d of bonesDef) {
    const b = new THREE.Bone();
    b.name = d.name;
    const parent = d.parent ? byName[d.parent] : null;
    const pAbs = d.parent ? bonesDef.find((x) => x.name === d.parent).abs : new THREE.Vector3();
    b.position.copy(d.abs).sub(pAbs);
    if (parent) parent.add(b);
    bones.push(b);
    byName[d.name] = b;
  }
  return { bones, byName, root: byName.root };
}

// ---------------------------------------------------------------------------
// Paint helpers
// ---------------------------------------------------------------------------
export const paints = {
  solid(c) {
    const col = new THREE.Color(c);
    return () => col;
  },
  // Stylized form shading: lighter top, slightly darker underside.
  form(c, lift = 0.07, drop = 0.1) {
    const base = new THREE.Color(c);
    const hi = base.clone().offsetHSL(0, -0.03, lift);
    const lo = base.clone().offsetHSL(0.01, 0.03, -drop);
    return (x, y, z, nx, ny) => (ny >= 0 ? _c.copy(base).lerp(hi, ny * ny) : _c.copy(base).lerp(lo, -ny));
  },
  // Body with a lighter belly on the underside/front (axis: which normal dir is "belly").
  belly(skin, belly, { dir = [0, -1, 0.35], threshold = 0.15, soft = 0.35, lift = 0.07 } = {}) {
    const s = new THREE.Color(skin), b = new THREE.Color(belly);
    const hi = s.clone().offsetHSL(0, -0.03, lift);
    const L = Math.hypot(dir[0], dir[1], dir[2]);
    const dx = dir[0] / L, dy = dir[1] / L, dz = dir[2] / L;
    return (x, y, z, nx, ny, nz) => {
      const d = nx * dx + ny * dy + nz * dz;
      const k = Math.min(1, Math.max(0, (d - threshold) / soft));
      _c.copy(s);
      if (ny > 0) _c.lerp(hi, ny * ny * 0.8);
      return _c.lerp(b, k * k * (3 - 2 * k));
    };
  },
  gradientY(bottom, top, y0, y1) {
    const b = new THREE.Color(bottom), t = new THREE.Color(top);
    return (x, y) => _c.copy(b).lerp(t, Math.min(1, Math.max(0, (y - y0) / (y1 - y0))));
  },
  // Tip gradient along the part's own length (base->tip) using distance from a point.
  tip(base, tipC, origin, length) {
    const b = new THREE.Color(base), t = new THREE.Color(tipC);
    const o = new THREE.Vector3(...origin);
    return (x, y, z) => _c.copy(b).lerp(t, Math.min(1, Math.hypot(x - o.x, y - o.y, z - o.z) / length));
  },
  // Round spots at cellular feature points (sizes vary per cell; some cells skipped).
  spots(basePaint, spotC, scale = 6, threshold = 0.5, seed = 1) {
    const sc = new THREE.Color(spotC);
    return (x, y, z, nx, ny, nz) => {
      const c = basePaint(x, y, z, nx, ny, nz);
      const [d, id] = worleyCell(x * scale, y * scale, z * scale, seed);
      if (id < threshold) return c;
      const r = 0.22 + (id - threshold) * 0.5;
      if (d < r) return c.lerp(sc, Math.min(1, (r - d) * 14));
      return c;
    };
  },
  // Plate/scale pattern: darker seams between cells (turtle shells, armor).
  plates(basePaint, seamC, scale = 5, width = 0.08, seed = 2) {
    const sc = new THREE.Color(seamC);
    return (x, y, z, nx, ny, nz) => {
      const c = basePaint(x, y, z, nx, ny, nz);
      const [f1, f2] = worley3(x * scale, y * scale, z * scale, seed);
      const e = f2 - f1;
      if (e < width) return c.lerp(sc, Math.min(1, (width - e) / width * 1.4));
      return c.offsetHSL(0, 0, (f1 - 0.4) * -0.06);
    };
  },
  stripes(basePaint, stripeC, axis = 'y', freq = 10, width = 0.35, onlyTop = true) {
    const sc = new THREE.Color(stripeC);
    return (x, y, z, nx, ny, nz) => {
      const c = basePaint(x, y, z, nx, ny, nz);
      if (onlyTop && ny < -0.2) return c;
      const v = axis === 'y' ? y : axis === 'z' ? z : x;
      const s = Math.sin(v * freq) * 0.5 + 0.5;
      if (s < width) return c.lerp(sc, Math.min(1, (width - s) * 8));
      return c;
    };
  },
};

// Cellular crack mask (cell borders), used for glowing lava veins / fractures.
export function crackMask(scale = 5, width = 0.09, seed = 0) {
  return (x, y, z) => {
    const [f1, f2] = worley3(x * scale, y * scale, z * scale, seed);
    const e = f2 - f1;
    return e < width ? 1 - e / width : 0;
  };
}

export function withCracks(basePaint, glowC, mask) {
  const gc = new THREE.Color(glowC);
  return (x, y, z, nx, ny, nz) => {
    const c = basePaint(x, y, z, nx, ny, nz);
    const m = mask(x, y, z);
    return m > 0.05 ? c.lerp(gc, Math.min(1, m * 1.5)) : c;
  };
}
