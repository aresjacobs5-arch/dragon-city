import * as THREE from 'three';
import { mergeGeometries, mergeVertices } from 'three/addons/utils/BufferGeometryUtils.js';
import { valueNoise3 } from '../core/noise.js';

// Geometry toolkit shared by terrain, props, buildings and monsters.
// All geometry uses position/normal/color attributes (no UVs) so that parts can
// be freely merged into single draw calls.

const _c = new THREE.Color();

export function col(c) {
  return c instanceof THREE.Color ? c : _c.set(c).clone();
}

// Keep only position + normal (+ color) attributes.
export function clean(geo) {
  let g = geo.index ? geo : geo;
  for (const k of Object.keys(g.attributes)) {
    if (k !== 'position' && k !== 'normal' && k !== 'color' && k !== 'skinIndex' && k !== 'skinWeight') g.deleteAttribute(k);
  }
  if (!g.attributes.normal) g.computeVertexNormals();
  return g;
}

// Paints vertex colors. `c` may be a color or fn(x,y,z,nx,ny,nz) => THREE.Color.
export function paint(geo, c) {
  const pos = geo.attributes.position;
  const nor = geo.attributes.normal;
  const arr = new Float32Array(pos.count * 3);
  const fixed = typeof c === 'function' ? null : col(c);
  for (let i = 0; i < pos.count; i++) {
    let cc = fixed;
    if (!cc) cc = c(pos.getX(i), pos.getY(i), pos.getZ(i), nor ? nor.getX(i) : 0, nor ? nor.getY(i) : 1, nor ? nor.getZ(i) : 0, i);
    arr[i * 3] = cc.r;
    arr[i * 3 + 1] = cc.g;
    arr[i * 3 + 2] = cc.b;
  }
  geo.setAttribute('color', new THREE.BufferAttribute(arr, 3));
  return geo;
}

// Vertical two-tone gradient helper used for soft stylized shading.
export function gradientPaint(geo, bottom, top, y0, y1) {
  const b = col(bottom), t = col(top);
  return paint(geo, (x, y) => {
    const k = Math.min(1, Math.max(0, (y - y0) / (y1 - y0 || 1)));
    return _c.copy(b).lerp(t, k);
  });
}

// Normal-based shading tint: lighter on top, darker underneath.
export function toneByNormal(geo, base, topLift = 0.12, bottomDrop = 0.22) {
  const b = col(base);
  const light = b.clone().offsetHSL(0, -0.02, topLift);
  const dark = b.clone().offsetHSL(0.0, 0.04, -bottomDrop);
  return paint(geo, (x, y, z, nx, ny) => {
    if (ny >= 0) return _c.copy(b).lerp(light, ny);
    return _c.copy(b).lerp(dark, -ny);
  });
}

export function merge(geos) {
  const list = geos.filter(Boolean).map((g) => {
    let gg = g.index ? g.toNonIndexed() : g;
    clean(gg);
    if (!gg.attributes.color) paint(gg, 0xffffff);
    return gg;
  });
  if (!list.length) return new THREE.BufferGeometry();
  const out = mergeGeometries(list, false);
  return out;
}

export function flat(geo) {
  const g = geo.index ? geo.toNonIndexed() : geo;
  g.computeVertexNormals();
  return g;
}

export function jitter(geo, amount = 0.1, seed = 1, scale = 2.3) {
  const g = geo.index ? geo : mergeVertices(geo);
  const pos = g.attributes.position;
  for (let i = 0; i < pos.count; i++) {
    const x = pos.getX(i), y = pos.getY(i), z = pos.getZ(i);
    const n1 = valueNoise3(x * scale + seed, y * scale, z * scale);
    const n2 = valueNoise3(x * scale, y * scale + seed * 1.7, z * scale + 3.1);
    const n3 = valueNoise3(x * scale + 7.7, y * scale, z * scale + seed * 0.9);
    pos.setXYZ(i, x + n1 * amount, y + n2 * amount, z + n3 * amount);
  }
  g.computeVertexNormals();
  return g;
}

export function sphere(r = 1, w = 16, h = 12) {
  const g = new THREE.SphereGeometry(r, w, h);
  return clean(g);
}

export function ellipsoid(rx, ry, rz, w = 18, h = 14) {
  const g = new THREE.SphereGeometry(1, w, h);
  g.scale(rx, ry, rz);
  return clean(g);
}

export function ico(r = 1, detail = 1) {
  return clean(new THREE.IcosahedronGeometry(r, detail));
}

export function box(w, h, d, bevel = 0) {
  if (bevel <= 0) return clean(new THREE.BoxGeometry(w, h, d));
  return roundedBox(w, h, d, bevel);
}

// Rounded box via extruded rounded rectangle.
export function roundedBox(w, h, d, r = 0.1, seg = 2) {
  const s = new THREE.Shape();
  const x = -w / 2, y = -h / 2;
  r = Math.min(r, w / 2 - 0.001, h / 2 - 0.001);
  s.moveTo(x + r, y);
  s.lineTo(x + w - r, y);
  s.quadraticCurveTo(x + w, y, x + w, y + r);
  s.lineTo(x + w, y + h - r);
  s.quadraticCurveTo(x + w, y + h, x + w - r, y + h);
  s.lineTo(x + r, y + h);
  s.quadraticCurveTo(x, y + h, x, y + h - r);
  s.lineTo(x, y + r);
  s.quadraticCurveTo(x, y, x + r, y);
  const bev = Math.min(r, d / 2 - 0.001);
  const g = new THREE.ExtrudeGeometry(s, {
    depth: Math.max(0.001, d - bev * 2),
    bevelEnabled: true,
    bevelThickness: bev,
    bevelSize: bev * 0.9,
    bevelSegments: seg,
    curveSegments: 4,
  });
  g.translate(0, 0, -(d - bev * 2) / 2);
  return clean(g);
}

export function cylinder(rTop, rBot, h, seg = 12, open = false) {
  const g = new THREE.CylinderGeometry(rTop, rBot, h, seg, 1, open);
  return clean(g);
}

export function cone(r, h, seg = 12) {
  return clean(new THREE.ConeGeometry(r, h, seg));
}

export function torus(R, r, rs = 8, ts = 24, arc = Math.PI * 2) {
  return clean(new THREE.TorusGeometry(R, r, rs, ts, arc));
}

// Lathe from [[radius, y], ...] profile.
export function lathe(profile, seg = 20, phiStart = 0, phiLen = Math.PI * 2) {
  const pts = profile.map(([r, y]) => new THREE.Vector2(Math.max(0.0001, r), y));
  const g = new THREE.LatheGeometry(pts, seg, phiStart, phiLen);
  return clean(g);
}

// Smooth closed blob from a radius profile function f(t) with t in 0..1 (bottom->top).
export function blob(height, radiusFn, seg = 20, rings = 14) {
  const prof = [];
  for (let i = 0; i <= rings; i++) {
    const t = i / rings;
    prof.push([radiusFn(t), t * height]);
  }
  prof[0][0] = 0.0001;
  prof[rings][0] = 0.0001;
  return lathe(prof, seg);
}

// Tube with varying radius along a Catmull-Rom curve. radius: number | fn(t)
// Optional `flatten` squashes the cross section (ratio of binormal axis).
export function taperTube(points, radius, radial = 8, segments = 12, { flatten = 1, capStart = true, capEnd = true, twist = 0 } = {}) {
  const curve = new THREE.CatmullRomCurve3(points.map((p) => (p.isVector3 ? p : new THREE.Vector3(p[0], p[1], p[2]))), false, 'catmullrom', 0.5);
  const frames = curve.computeFrenetFrames(segments, false);
  const rf = typeof radius === 'function' ? radius : () => radius;
  const verts = [];
  const idx = [];
  const P = new THREE.Vector3();
  for (let i = 0; i <= segments; i++) {
    const t = i / segments;
    curve.getPointAt(t, P);
    const N = frames.normals[i], B = frames.binormals[i];
    const r = rf(t);
    for (let j = 0; j < radial; j++) {
      const a = (j / radial) * Math.PI * 2 + twist * t;
      const cx = Math.cos(a) * r, cy = Math.sin(a) * r * flatten;
      verts.push(P.x + N.x * cx + B.x * cy, P.y + N.y * cx + B.y * cy, P.z + N.z * cx + B.z * cy);
    }
  }
  for (let i = 0; i < segments; i++) {
    for (let j = 0; j < radial; j++) {
      const a = i * radial + j;
      const b = i * radial + ((j + 1) % radial);
      const c = (i + 1) * radial + j;
      const d = (i + 1) * radial + ((j + 1) % radial);
      idx.push(a, c, b, b, c, d);
    }
  }
  if (capStart) {
    curve.getPointAt(0, P);
    const ci = verts.length / 3;
    verts.push(P.x, P.y, P.z);
    for (let j = 0; j < radial; j++) idx.push(ci, j, (j + 1) % radial);
  }
  if (capEnd) {
    curve.getPointAt(1, P);
    const ci = verts.length / 3;
    verts.push(P.x, P.y, P.z);
    const base = segments * radial;
    for (let j = 0; j < radial; j++) idx.push(ci, base + ((j + 1) % radial), base + j);
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(verts, 3));
  g.setIndex(idx);
  g.computeVertexNormals();
  return g;
}

// Horn: tapered curved spike. dir/curl in local space; base at origin.
// Grows along +Y and curls toward +Z by `curl` (radians of arc). `side` bends toward +X.
export function horn(length = 1, baseR = 0.15, curl = 0.8, seg = 10, radial = 8, side = 0, tipPow = 0.85) {
  const pts = [];
  const n = 6;
  for (let i = 0; i <= n; i++) {
    const t = i / n;
    let y, z;
    if (Math.abs(curl) < 1e-3) {
      y = t * length;
      z = 0;
    } else {
      const R = length / curl;
      const a = t * curl;
      y = R * Math.sin(a);
      z = R * (1 - Math.cos(a));
    }
    pts.push(new THREE.Vector3(side * length * t * t, y, z));
  }
  return taperTube(pts, (t) => baseR * Math.pow(1 - t, tipPow) + 0.003, radial, seg, { capEnd: false });
}

// Flat leaf/fin/wing shape extruded with rounded edges. Outline points in XY.
export function extrudeOutline(outline, depth = 0.05, bevel = 0.02, curveSeg = 8) {
  const s = new THREE.Shape();
  s.moveTo(outline[0][0], outline[0][1]);
  for (let i = 1; i < outline.length; i++) {
    const p = outline[i];
    if (p.length === 4) s.quadraticCurveTo(p[0], p[1], p[2], p[3]);
    else if (p.length === 6) s.bezierCurveTo(p[0], p[1], p[2], p[3], p[4], p[5]);
    else s.lineTo(p[0], p[1]);
  }
  const g = new THREE.ExtrudeGeometry(s, {
    depth,
    bevelEnabled: bevel > 0,
    bevelThickness: bevel,
    bevelSize: bevel,
    bevelSegments: 2,
    curveSegments: curveSeg,
  });
  g.translate(0, 0, -depth / 2);
  return clean(g);
}

export function leafGeo(len = 1, width = 0.4, depth = 0.04) {
  const w = width / 2;
  return extrudeOutline(
    [
      [0, 0],
      [w * 1.3, len * 0.3, w, len * 0.75],
      [w * 0.6, len * 0.95, 0, len],
      [-w * 0.6, len * 0.95, -w, len * 0.75],
      [-w * 1.3, len * 0.3, 0, 0],
    ],
    depth,
    depth * 0.4
  );
}

// Bends geometry along +Y around the X axis (curl forward) by `amount` radians over its height.
export function bend(geo, amount, height, axis = 'x') {
  const pos = geo.attributes.position;
  for (let i = 0; i < pos.count; i++) {
    const x = pos.getX(i), y = pos.getY(i), z = pos.getZ(i);
    const t = y / height;
    const a = amount * t;
    if (axis === 'x') {
      const r = height / (amount || 1e-4);
      if (Math.abs(amount) < 1e-4) continue;
      const ny = Math.sin(a) * (r - z);
      const nz = r - Math.cos(a) * (r - z);
      pos.setXYZ(i, x, ny, nz);
    } else {
      const r = height / (amount || 1e-4);
      if (Math.abs(amount) < 1e-4) continue;
      const ny = Math.sin(a) * (r - x);
      const nx = r - Math.cos(a) * (r - x);
      pos.setXYZ(i, nx, ny, z);
    }
  }
  geo.computeVertexNormals();
  return geo;
}

// Apply transform shorthand.
const _m = new THREE.Matrix4();
const _q = new THREE.Quaternion();
const _e = new THREE.Euler();
const _s = new THREE.Vector3();
const _p = new THREE.Vector3();
export function xf(geo, { p = [0, 0, 0], r = [0, 0, 0], s = [1, 1, 1] } = {}) {
  _e.set(r[0], r[1], r[2], 'XYZ');
  _q.setFromEuler(_e);
  _s.set(...(Array.isArray(s) ? s : [s, s, s]));
  _p.set(p[0], p[1], p[2]);
  _m.compose(_p, _q, _s);
  geo.applyMatrix4(_m);
  return geo;
}

export function crystal(h = 1, r = 0.2, sides = 6, tip = 0.35) {
  const body = new THREE.CylinderGeometry(r, r * 0.8, h * (1 - tip), sides, 1);
  body.translate(0, (h * (1 - tip)) / 2, 0);
  const top = new THREE.ConeGeometry(r, h * tip, sides);
  top.translate(0, h * (1 - tip) + (h * tip) / 2, 0);
  const g = mergeGeometries([clean(body.toNonIndexed()), clean(top.toNonIndexed())]);
  g.computeVertexNormals();
  return g;
}
