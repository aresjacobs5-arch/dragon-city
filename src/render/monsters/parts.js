import * as THREE from 'three';
import * as G from '../geom.js';
import { paints } from './rig.js';

// Reusable creature features. Every function adds geometry to a RigBuilder.
// Conventions: creatures face +Z, up is +Y, side s = +1 is the creature's left (+X).

const _q = new THREE.Quaternion();
const _v = new THREE.Vector3();
const UP = new THREE.Vector3(0, 1, 0);
const FWD = new THREE.Vector3(0, 0, 1);
const WHITE = '#ffffff';

export const C = (c) => new THREE.Color(c);

// Mirror a non-indexed geometry across X, fixing triangle winding.
export function mirrorX(g) {
  g.scale(-1, 1, 1); // also mirrors normals via the normal matrix
  for (const key of Object.keys(g.attributes)) {
    const a = g.attributes[key];
    const s = a.itemSize, arr = a.array;
    for (let i = 0; i + 2 < a.count; i += 3) {
      const o1 = (i + 1) * s, o2 = (i + 2) * s;
      for (let k = 0; k < s; k++) {
        const t = arr[o1 + k];
        arr[o1 + k] = arr[o2 + k];
        arr[o2 + k] = t;
      }
    }
    a.needsUpdate = true;
  }
  return g;
}

// Point + normal on an ellipsoid surface. yaw: angle from +Z toward +X; pitch: up.
export function surf(E, yaw, pitch, depth = 1) {
  const d = new THREE.Vector3(Math.sin(yaw) * Math.cos(pitch), Math.sin(pitch), Math.cos(yaw) * Math.cos(pitch));
  const [rx, ry, rz] = E.r;
  const p = new THREE.Vector3(E.c[0] + d.x * rx * depth, E.c[1] + d.y * ry * depth, E.c[2] + d.z * rz * depth);
  const n = new THREE.Vector3(d.x / rx, d.y / ry, d.z / rz).normalize();
  return { p, n };
}

// Rotate geometry so its +axis aligns with n, apply optional local euler first, then translate to p.
export function orient(geo, p, n, localEuler = null, axis = UP) {
  if (localEuler) {
    const m = new THREE.Matrix4().makeRotationFromEuler(new THREE.Euler(...localEuler, 'XYZ'));
    geo.applyMatrix4(m);
  }
  _q.setFromUnitVectors(axis, n.clone().normalize());
  geo.applyQuaternion(_q);
  geo.translate(p.x, p.y, p.z);
  return geo;
}

export function ellipsoidPart(E, seg = 22) {
  const g = G.ellipsoid(E.r[0], E.r[1], E.r[2], seg, Math.round(seg * 0.75));
  g.translate(E.c[0], E.c[1], E.c[2]);
  return g;
}

// ---------------------------------------------------------------------------
// FACE
// ---------------------------------------------------------------------------
export function eyes(rb, o) {
  const {
    bone = 'head', E, yaw = 0.42, pitch = 0.12, depth = 0.86, size = 0.12, iris = '#3fa9f5', style = 'round',
    skin = '#888', pupil = '#1a1022', glowC = '#ffffff', brow = null, lash = false, single = false, squash = 1,
  } = o;
  const sides = single ? [0] : [1, -1];
  for (const s of sides) {
    const { p, n } = surf(E, yaw * s, pitch, depth);
    const bn = single ? 'eyeL' : s > 0 ? 'eyeL' : 'eyeR';
    rb.bone(bn, bone, [p.x, p.y, p.z]);
    const parts = [];
    const r = size;
    const add = (geo, paint, glow = 0) => parts.push({ geo, paint, glow });
    if (style === 'glow') {
      add(G.ellipsoid(r, r * 1.1 * squash, r * 0.55, 16, 12), glowC, 1);
      const core = G.ellipsoid(r * 0.45, r * 0.55 * squash, r * 0.3, 10, 8);
      core.translate(0, 0, r * 0.35);
      add(core, WHITE, 1);
    } else if (style === 'compound') {
      add(G.ellipsoid(r, r * 1.05, r * 0.8, 18, 14), paints.form(iris, 0.12, 0.2), 0);
      const h1 = G.sphere(r * 0.2, 8, 6); h1.translate(r * 0.3, r * 0.35, r * 0.62); add(h1, WHITE, 1);
      const h2 = G.sphere(r * 0.1, 6, 4); h2.translate(-r * 0.25, -r * 0.2, r * 0.7); add(h2, WHITE, 1);
    } else {
      // sclera
      add(G.ellipsoid(r, r * 1.12 * squash, r * 0.6, 18, 14), paints.gradientY('#e8e4f0', WHITE, -r, r), 0);
      // iris
      const irisC = C(iris);
      const irisTop = irisC.clone().offsetHSL(0, 0.05, -0.18);
      const irisBot = irisC.clone().offsetHSL(0, 0, 0.12);
      const ig = G.ellipsoid(r * 0.68, r * 0.78 * squash, r * 0.36, 16, 12);
      ig.translate(0, -r * 0.04, r * 0.34);
      add(ig, paints.gradientY(irisBot, irisTop, -r * 0.7, r * 0.7), style === 'shine' ? 0.35 : 0);
      // pupil
      const slit = style === 'slit';
      const pg = G.ellipsoid(slit ? r * 0.13 : r * 0.38, slit ? r * 0.62 : r * 0.47 * squash, r * 0.2, 12, 10);
      pg.translate(0, -r * 0.04, r * 0.55);
      add(pg, pupil, 0);
      // sparkles
      const h1 = G.sphere(r * 0.19, 8, 6);
      h1.translate(r * 0.22 * (single ? 1 : s), r * 0.3, r * 0.66);
      add(h1, WHITE, 1);
      const h2 = G.sphere(r * 0.09, 6, 4);
      h2.translate(-r * 0.2 * (single ? 1 : s), -r * 0.24, r * 0.64);
      add(h2, WHITE, 1);
      if (style === 'fierce' || style === 'sleepy') {
        const lid = new THREE.SphereGeometry(r * 1.1, 16, 8, 0, Math.PI * 2, 0, Math.PI * (style === 'sleepy' ? 0.5 : 0.36));
        lid.rotateX(style === 'sleepy' ? 0.25 : 0.55);
        if (style === 'fierce') lid.rotateZ(-0.35 * (single ? 1 : s));
        lid.scale(1, 1.1 * squash, 0.7);
        add(G.clean(lid), paints.form(skin, 0.05, 0.1), 0);
      }
      if (lash) {
        for (let k = 0; k < 3; k++) {
          const l = G.cone(r * 0.07, r * 0.45, 4);
          l.rotateZ((-0.9 - k * 0.35) * (single ? 1 : s));
          l.translate((r * 0.75 + k * r * 0.08) * (single ? 1 : s), r * 0.65 - k * r * 0.18, r * 0.2);
          add(l, '#2a1a22', 0);
        }
      }
    }
    // orient all eye parts along the surface normal
    for (const pt of parts) {
      _q.setFromUnitVectors(FWD, n);
      pt.geo.applyQuaternion(_q);
      pt.geo.translate(p.x, p.y, p.z);
      rb.part(pt.geo, bn, pt.paint, pt.glow);
    }
    if (brow) {
      const bp = surf(E, yaw * s * 0.95, pitch + size * 1.6 / E.r[1], depth * 1.02);
      const bg = G.ellipsoid(size * 0.85, size * 0.2, size * 0.22, 10, 6);
      bg.rotateZ((brow === 'angry' ? -0.45 : brow === 'sad' ? 0.4 : 0) * s);
      _q.setFromUnitVectors(FWD, bp.n);
      bg.applyQuaternion(_q);
      bg.translate(bp.p.x, bp.p.y, bp.p.z);
      rb.part(bg, bone, paints.form(o.browColor || '#2a1e24', 0.1, 0.1), 0);
    }
  }
}

export function mouth(rb, o) {
  const { bone = 'head', E, yaw = 0, pitch = -0.28, depth = 0.95, width = 0.16, style = 'smile', color = '#3a1422', fang = WHITE, tongue = '#ff7a95', jaw = false } = o;
  const { p, n } = surf(E, yaw, pitch, depth);
  const add = (geo, paint, glow = 0, b = bone) => {
    _q.setFromUnitVectors(FWD, n);
    geo.applyQuaternion(_q);
    geo.translate(p.x, p.y, p.z);
    rb.part(geo, b, paint, glow);
  };
  if (style === 'smile' || style === 'fangs' || style === 'grin') {
    const arc = G.torus(width * 0.5, width * (style === 'grin' ? 0.09 : 0.075), 6, 16, Math.PI * 0.85);
    arc.rotateZ(Math.PI + Math.PI * 0.075);
    arc.translate(0, width * 0.32, 0);
    add(arc, color);
    if (style === 'fangs' || style === 'grin') {
      for (const s of [-1, 1]) {
        const f = G.cone(width * 0.1, width * 0.26, 6);
        f.rotateX(Math.PI);
        f.translate(s * width * 0.24, -width * 0.12, width * 0.02);
        add(f, fang);
      }
    }
  } else if (style === 'open' || style === 'roar') {
    const b = jaw ? 'jaw' : bone;
    if (jaw && !rb.has('jaw')) rb.bone('jaw', bone, [p.x, p.y + width * 0.2, p.z - width * 0.2]);
    const cav = G.ellipsoid(width * 0.5, width * (style === 'roar' ? 0.42 : 0.3), width * 0.22, 14, 10);
    add(cav, color, 0, b);
    const t = G.ellipsoid(width * 0.3, width * 0.12, width * 0.15, 10, 6);
    t.translate(0, -width * 0.13, width * 0.08);
    add(t, tongue, 0, b);
    for (const s of [-1, 1]) {
      const f = G.cone(width * 0.09, width * 0.22, 6);
      f.rotateX(Math.PI);
      f.translate(s * width * 0.26, width * 0.2, width * 0.12);
      add(f, fang, 0, b);
    }
  } else if (style === 'beak') {
    const up = G.cone(width * 0.45, width * 1.2, 10);
    up.rotateX(Math.PI / 2);
    up.scale(1, 0.75, 1);
    up.translate(0, width * 0.1, width * 0.45);
    add(up, paints.form(o.beakColor || '#ffb13d', 0.12, 0.12));
    const lo = G.cone(width * 0.36, width * 0.8, 10);
    lo.rotateX(Math.PI / 2);
    lo.scale(1, 0.55, 1);
    lo.translate(0, -width * 0.16, width * 0.3);
    add(lo, paints.form(C(o.beakColor || '#ffb13d').offsetHSL(0, 0, -0.1), 0.1, 0.1), 0, jaw ? 'jaw' : bone);
  } else if (style === 'tiny') {
    const d = G.ellipsoid(width * 0.2, width * 0.13, width * 0.1, 8, 6);
    add(d, color);
  }
}

export function nose(rb, { bone = 'head', E, pitch = -0.05, depth = 1.0, size = 0.05, color = '#2a1a22' }) {
  const { p, n } = surf(E, 0, pitch, depth);
  const g = G.ellipsoid(size * 1.3, size * 0.85, size * 0.8, 10, 8);
  _q.setFromUnitVectors(FWD, n);
  g.applyQuaternion(_q);
  g.translate(p.x, p.y, p.z);
  rb.part(g, bone, paints.form(color, 0.25, 0.05), 0);
  const hl = G.sphere(size * 0.28, 6, 4);
  hl.translate(p.x + size * 0.4, p.y + size * 0.45, p.z + size * 0.35);
  rb.part(hl, bone, WHITE, 0.6);
}

export function cheeks(rb, { bone = 'head', E, yaw = 0.62, pitch = -0.16, size = 0.07, color = '#ff8fa8' }) {
  for (const s of [-1, 1]) {
    const { p, n } = surf(E, yaw * s, pitch, 0.99);
    const g = G.ellipsoid(size * 1.3, size * 0.8, size * 0.3, 10, 6);
    _q.setFromUnitVectors(FWD, n);
    g.applyQuaternion(_q);
    g.translate(p.x, p.y, p.z);
    rb.part(g, bone, color, 0.15);
  }
}

// ---------------------------------------------------------------------------
// EARS
// ---------------------------------------------------------------------------
export function ears(rb, o) {
  const { bone = 'head', E, style = 'pointy', yaw = 0.8, pitch = 0.62, size = 0.2, color = '#888', inner = '#ffb3c4', tilt = 0.35, glowC = '#ffcc55', depth = 0.92 } = o;
  for (const s of [1, -1]) {
    const { p, n } = surf(E, yaw * s, pitch, depth);
    const bn = s > 0 ? 'earL' : 'earR';
    rb.bone(bn, bone, [p.x, p.y, p.z]);
    const parts = [];
    if (style === 'pointy' || style === 'cat') {
      const g = G.cone(size * 0.5, size * 1.2, 10);
      g.scale(1, 1, 0.45);
      g.translate(0, size * 0.55, 0);
      parts.push([g, paints.form(color, 0.08, 0.1), 0]);
      const i = G.cone(size * 0.3, size * 0.8, 8);
      i.scale(1, 1, 0.3);
      i.translate(0, size * 0.42, size * 0.1);
      parts.push([i, inner, 0]);
    } else if (style === 'round') {
      const g = G.ellipsoid(size * 0.55, size * 0.55, size * 0.18, 14, 10);
      g.translate(0, size * 0.35, 0);
      parts.push([g, paints.form(color), 0]);
      const i = G.ellipsoid(size * 0.36, size * 0.36, size * 0.1, 12, 8);
      i.translate(0, size * 0.33, size * 0.1);
      parts.push([i, inner, 0]);
    } else if (style === 'long') {
      const g = G.leafGeo(size * 2.2, size * 0.8, size * 0.18);
      G.bend(g, -0.5, size * 2.2);
      parts.push([g, paints.form(color), 0]);
      const i = G.leafGeo(size * 1.7, size * 0.45, size * 0.08);
      G.bend(i, -0.5, size * 1.7);
      i.translate(0, size * 0.15, size * 0.08);
      parts.push([i, inner, 0]);
    } else if (style === 'leaf') {
      const g = G.leafGeo(size * 2.0, size * 0.95, size * 0.1);
      G.bend(g, -0.7, size * 2.0);
      const cc = C(color), vein = cc.clone().offsetHSL(0, 0, 0.18);
      parts.push([g, (x, y, z, nx, ny, nz) => (Math.abs(x) < size * 0.05 ? vein : cc.clone().offsetHSL(0, 0, ny * 0.06)), 0]);
    } else if (style === 'fin') {
      const outline = [[0, 0], [size * 0.5, size * 0.4, size * 0.35, size * 1.4], [size * 0.1, size * 1.1], [-size * 0.2, size * 1.25], [-size * 0.35, size * 0.5, 0, 0]];
      const g = G.extrudeOutline(outline, size * 0.08, size * 0.04);
      parts.push([g, paints.gradientY(color, inner, 0, size * 1.3), 0.15]);
    } else if (style === 'bat') {
      const g = G.cone(size * 0.6, size * 1.6, 3);
      g.scale(1, 1, 0.35);
      g.translate(0, size * 0.75, 0);
      parts.push([g, paints.form(color), 0]);
      const i = G.cone(size * 0.38, size * 1.1, 3);
      i.scale(1, 1, 0.2);
      i.translate(0, size * 0.6, size * 0.07);
      parts.push([i, inner, 0]);
    } else if (style === 'bolt') {
      const w = size * 0.3;
      const outline = [[-w, 0], [w, 0], [w * 0.5, size * 0.6], [w * 1.6, size * 0.6], [-w * 0.2, size * 1.7], [0, size * 0.85], [-w * 1.2, size * 0.85]];
      const g = G.extrudeOutline(outline, size * 0.14, size * 0.04);
      parts.push([g, paints.gradientY(color, inner, 0, size * 1.6), (x, y) => (y > size * 0.9 ? 0.5 : 0.1)]);
    } else if (style === 'flame') {
      addFlameCluster(parts, size * 1.4, [0, 0, 0], glowC, 3);
    } else if (style === 'crystal') {
      for (let k = 0; k < 2; k++) {
        const g = G.flat(G.crystal(size * (1.4 - k * 0.4), size * 0.22, 5));
        g.rotateZ(-0.25 * k);
        g.translate(k * size * 0.2, 0, 0);
        parts.push([g, paints.form(color, 0.15, 0.1), 0.25]);
      }
    } else if (style === 'feather') {
      for (let k = 0; k < 3; k++) {
        const g = G.leafGeo(size * (1.6 - k * 0.3), size * 0.45, size * 0.06);
        g.rotateZ((k - 1) * 0.35);
        parts.push([g, paints.gradientY(color, inner, 0, size * 1.5), 0]);
      }
    }
    for (const [g, pnt, gl] of parts) {
      // tilt outward, then align to surface normal
      g.rotateZ(-tilt * s);
      orient(g, p, n.clone().lerp(UP, 0.35).normalize());
      rb.part(g, bn, pnt, gl);
    }
  }
}

// ---------------------------------------------------------------------------
// HORNS & HEAD ACCESSORIES
// ---------------------------------------------------------------------------
export function horns(rb, o) {
  const { bone = 'head', E, style = 'spike', yaw = 0.45, pitch = 0.75, size = 0.25, color = '#f5ead8', tipColor = null, glowTip = 0, count = 2, depth = 0.9, curl = 0.7, splay = 0.3 } = o;
  const tipC = tipColor || C(color).offsetHSL(0, -0.1, 0.12).getStyle();
  const list = count === 1 ? [0] : count === 2 ? [1, -1] : count === 4 ? [1, -1, 0.5, -0.5] : [1, -1];
  for (const s of list) {
    const isSmall = Math.abs(s) === 0.5;
    const { p, n } = surf(E, yaw * s * (isSmall ? 1.6 : 1), pitch - (isSmall ? 0.35 : 0), depth);
    let g;
    const sz = size * (isSmall ? 0.6 : 1);
    if (style === 'nub') {
      g = G.cone(sz * 0.35, sz * 0.7, 10);
      g.translate(0, sz * 0.3, 0);
    } else if (style === 'spike') {
      g = G.horn(sz * 1.3, sz * 0.26, curl * 0.6, 10, 8, 0);
    } else if (style === 'curl' || style === 'ram') {
      g = G.horn(sz * 2.2, sz * 0.3, -2.8, 18, 9, 0.15);
      g.rotateY(Math.PI / 2 * Math.sign(s || 1));
    } else if (style === 'back') {
      g = G.horn(sz * 1.6, sz * 0.24, -1.1, 12, 8, 0);
    } else if (style === 'unicorn') {
      const pts = [];
      for (let i = 0; i <= 6; i++) pts.push(new THREE.Vector3(0, (i / 6) * sz * 2.2, (i / 6) * sz * 0.4));
      g = G.taperTube(pts, (t) => sz * 0.22 * (1 - t) + 0.004, 8, 18, { twist: 12 });
    } else if (style === 'antler' || style === 'wood') {
      const parts = [];
      const main = [new THREE.Vector3(0, 0, 0), new THREE.Vector3(sz * 0.15, sz * 0.7, -sz * 0.1), new THREE.Vector3(sz * 0.45, sz * 1.4, -sz * 0.15), new THREE.Vector3(sz * 0.55, sz * 1.9, 0)];
      parts.push(G.taperTube(main, (t) => sz * 0.12 * (1 - t * 0.6), 6, 10));
      const br = [new THREE.Vector3(sz * 0.2, sz * 0.8, -sz * 0.1), new THREE.Vector3(-sz * 0.1, sz * 1.2, sz * 0.1), new THREE.Vector3(-sz * 0.15, sz * 1.5, sz * 0.2)];
      parts.push(G.taperTube(br, (t) => sz * 0.08 * (1 - t * 0.6), 6, 6));
      const br2 = [new THREE.Vector3(sz * 0.4, sz * 1.3, -sz * 0.14), new THREE.Vector3(sz * 0.8, sz * 1.5, -sz * 0.1), new THREE.Vector3(sz * 0.95, sz * 1.75, 0)];
      parts.push(G.taperTube(br2, (t) => sz * 0.07 * (1 - t * 0.6), 6, 6));
      g = G.merge(parts);
      if (s < 0) mirrorX(g);
      if (style === 'wood') {
        const leaf = G.leafGeo(sz * 0.7, sz * 0.4, sz * 0.06);
        leaf.rotateZ(-0.8 * s);
        leaf.translate(sz * 0.6 * s, sz * 1.85, 0);
        rb.part(orient(leaf, p, n), bone, o.leafColor || '#6fcf4f', 0);
      }
    } else if (style === 'crystal') {
      const parts = [];
      for (let k = 0; k < 3; k++) {
        const c = G.flat(G.crystal(sz * (1.5 - k * 0.35), sz * 0.2, 6));
        c.rotateZ((k - 1) * 0.35);
        c.rotateX((k % 2) * 0.25);
        parts.push(c);
      }
      g = G.merge(parts);
    } else if (style === 'bolt') {
      const w = sz * 0.22;
      g = G.extrudeOutline([[-w, 0], [w, 0], [w * 0.4, sz * 0.55], [w * 1.8, sz * 0.5], [-w * 0.1, sz * 1.6], [0, sz * 0.8], [-w * 1.4, sz * 0.85]], sz * 0.14, sz * 0.04);
    } else if (style === 'rhino') {
      g = G.horn(sz * 1.1, sz * 0.32, 0.9, 10, 9, 0);
    }
    if (!g) continue;
    g.rotateZ(-splay * Math.sign(s || 0) * (style === 'curl' || style === 'ram' ? 0 : 1));
    orient(g, p, n.clone().lerp(UP, style === 'rhino' ? 0 : 0.5).normalize());
    const len = sz * 2.2;
    rb.part(g, bone, paints.tip(color, tipC, [p.x, p.y, p.z], len), glowTip ? (x, y, z) => (Math.hypot(x - p.x, y - p.y, z - p.z) > len * 0.45 ? glowTip : 0) : 0);
  }
}

export function crest(rb, { bone = 'head', E, size = 0.2, color = '#ff5a5a', style = 'fin', count = 3, glow = 0 }) {
  for (let k = 0; k < count; k++) {
    const t = count === 1 ? 0 : k / (count - 1);
    const pitch = 0.95 - t * 0.9;
    const { p, n } = surf(E, 0, pitch, 0.9);
    let g;
    if (style === 'fin') {
      g = G.extrudeOutline([[-size * 0.3, 0], [size * 0.3, 0], [0, size * (1.3 - Math.abs(t - 0.3))]], size * 0.1, size * 0.04);
      g.rotateY(Math.PI / 2);
    } else if (style === 'spike') {
      g = G.cone(size * 0.2, size * (1.1 - t * 0.4), 8);
      g.translate(0, size * 0.45, 0);
    } else if (style === 'feather') {
      g = G.leafGeo(size * (1.6 - t * 0.5), size * 0.5, size * 0.06);
      g.rotateX(-0.5 - t * 0.4);
    } else if (style === 'flame') {
      const parts = [];
      addFlameCluster(parts, size * (1.4 - t * 0.5), [0, 0, 0], color, 2);
      for (const [pg, pc, gl] of parts) rb.part(orient(pg, p, n), bone, pc, gl);
      continue;
    }
    orient(g, p, n);
    rb.part(g, bone, paints.gradientY(color, C(color).offsetHSL(0, 0, 0.15), p.y, p.y + size), glow);
  }
}

export function halo(rb, { bone = 'head', at = [0, 1.4, 0], radius = 0.25, color = '#ffe27a' }) {
  rb.bone('fxHalo', bone, at);
  const g = G.torus(radius, radius * 0.1, 8, 28);
  g.rotateX(Math.PI / 2 - 0.25);
  g.translate(at[0], at[1], at[2]);
  rb.part(g, 'fxHalo', color, 1);
}

export function crown(rb, { bone = 'head', at, radius = 0.18, color = '#ffd23f', gem = '#ff4f7b' }) {
  const parts = [];
  const band = G.cylinder(radius, radius * 1.05, radius * 0.45, 12, true);
  parts.push(band);
  for (let k = 0; k < 5; k++) {
    const a = (k / 5) * Math.PI * 2;
    const sp = G.cone(radius * 0.22, radius * 0.7, 6);
    sp.translate(Math.sin(a) * radius, radius * 0.5, Math.cos(a) * radius);
    parts.push(sp);
  }
  const g = G.merge(parts);
  g.translate(at[0], at[1], at[2]);
  rb.part(g, bone, paints.form(color, 0.2, 0.15), 0.1);
  const gm = G.flat(G.ico(radius * 0.2, 0));
  gm.translate(at[0], at[1], at[2] + radius * 1.02);
  rb.part(gm, bone, gem, 0.6);
}

// ---------------------------------------------------------------------------
// FLAMES / GLOW BITS
// ---------------------------------------------------------------------------
export function flameTongue(h, r, seed = 0) {
  const g = G.lathe([[0.001, 0], [r * 0.72, h * 0.08], [r, h * 0.26], [r * 0.86, h * 0.46], [r * 0.5, h * 0.7], [r * 0.16, h * 0.9], [0.001, h]], 10);
  const p = g.attributes.position;
  for (let i = 0; i < p.count; i++) {
    const t = p.getY(i) / h;
    p.setX(i, p.getX(i) + Math.sin(t * 4.2 + seed) * r * 0.32 * t);
    p.setZ(i, p.getZ(i) - t * t * r * 0.45);
  }
  g.computeVertexNormals();
  return g;
}

// Pushes [geo, paint, glow] entries for a cluster of flame tongues.
export function addFlameCluster(out, h, at, color = '#ff8a2a', n = 3) {
  const core = C('#fff4c4');
  const mid = C(color).offsetHSL(0.02, 0.1, 0.08);
  const tipC = C(color).offsetHSL(-0.04, 0.15, -0.08);
  const count = Math.max(1, n);
  for (let k = 0; k < count + (count > 1 ? 1 : 0); k++) {
    const center = k === 0;
    const a = ((k - 1) / Math.max(1, count)) * Math.PI * 2 + 0.4;
    const hh = h * (center ? 1 : 0.62 - (k % 2) * 0.12);
    const rr = h * (center ? 0.3 : 0.22);
    const g = flameTongue(hh, rr, k * 1.7);
    if (!center) {
      g.rotateZ(Math.cos(a) * 0.45);
      g.rotateX(Math.sin(a) * 0.45);
      g.translate(Math.cos(a) * rr * 0.7, 0, Math.sin(a) * rr * 0.7);
    }
    g.translate(at[0], at[1], at[2]);
    const y0 = at[1], y1 = at[1] + hh;
    out.push([g, (x, y) => {
      const t = Math.min(1, Math.max(0, (y - y0) / (y1 - y0)));
      return t < 0.3 ? core.clone().lerp(mid, t / 0.3) : mid.clone().lerp(tipC, (t - 0.3) / 0.7);
    }, 1]);
  }
}

export function flames(rb, bone, h, at, color, n = 3) {
  const out = [];
  addFlameCluster(out, h, at, color, n);
  const fxName = `fx${rb.order.length}`;
  rb.bone(fxName, bone, at);
  for (const [g, pc, gl] of out) rb.part(g, fxName, pc, gl);
  rb.emitter(fxName, 'ember', [0, h * 0.6, 0]);
  return fxName;
}

// ---------------------------------------------------------------------------
// TAILS
// ---------------------------------------------------------------------------
// Tail defined by a list of absolute points; split into up to 3 bones.
export function tail(rb, o) {
  const { parent = 'body', pts, radius = 0.08, color = '#888', tipColor = null, style = 'plain', accent = '#ffcc55', glowC = '#ff8a2a', size = 1 } = o;
  const V = pts.map((p) => new THREE.Vector3(...p));
  // bones at 0, 1/3, 2/3 along the points
  const curve = new THREE.CatmullRomCurve3(V);
  const b0 = curve.getPointAt(0), b1 = curve.getPointAt(0.34), b2 = curve.getPointAt(0.67);
  rb.bone('tail0', parent, [b0.x, b0.y, b0.z]);
  rb.bone('tail1', 'tail0', [b1.x, b1.y, b1.z]);
  rb.bone('tail2', 'tail1', [b2.x, b2.y, b2.z]);
  // split tube into 3 segments so each follows its bone
  const segs = [[0, 0.34, 'tail0'], [0.34, 0.67, 'tail1'], [0.67, 1, 'tail2']];
  const rfn = typeof radius === 'function' ? radius : (t) => radius * (1 - t * 0.75);
  const tipC = C(tipColor || color);
  const baseC = C(color);
  for (const [t0, t1, bn] of segs) {
    const sp = [];
    for (let i = 0; i <= 4; i++) sp.push(curve.getPointAt(t0 + (t1 - t0) * (i / 4)));
    const g = G.taperTube(sp, (t) => rfn(t0 + (t1 - t0) * t), 10, 6, { capStart: t0 === 0, capEnd: t1 === 1 && style === 'plain' });
    const k0 = t0, k1 = t1;
    rb.part(g, bn, (x, y, z, nx, ny) => baseC.clone().lerp(tipC, (k0 + k1) / 2).offsetHSL(0, 0, ny * 0.05), 0);
  }
  const end = curve.getPointAt(1);
  const dir = curve.getTangentAt(1).normalize();
  const endR = rfn(1);
  if (style === 'flame') {
    const out = [];
    addFlameCluster(out, 0.34 * size, [0, 0, 0], glowC, 3);
    const fx = `fxTail`;
    rb.bone(fx, 'tail2', [end.x, end.y, end.z]);
    for (const [g, pc, gl] of out) rb.part(orient(g, end, dir.clone().lerp(UP, 0.6).normalize()), fx, pc, gl);
    rb.emitter(fx, 'ember', [0, 0.15 * size, 0]);
  } else if (style === 'leaf') {
    const g = G.leafGeo(0.3 * size, 0.19 * size, 0.035);
    rb.part(orient(g, end, dir), 'tail2', paints.gradientY(accent, C(accent).offsetHSL(0, 0, 0.15), end.y - 0.2, end.y + 0.3), 0);
  } else if (style === 'fluffy') {
    const g = G.ellipsoid(0.1 * size, 0.19 * size, 0.1 * size, 14, 10);
    g.translate(0, 0.12 * size, 0);
    rb.part(orient(g, end.clone().addScaledVector(dir, -0.05), dir), 'tail2', paints.gradientY(color, accent, end.y - 0.1, end.y + 0.4), 0);
  } else if (style === 'club') {
    const g = G.jitter(G.ico(0.14 * size, 1), 0.02, 3);
    g.translate(end.x, end.y, end.z);
    rb.part(g, 'tail2', paints.form(accent), 0);
    for (let k = 0; k < 5; k++) {
      const a = (k / 5) * Math.PI * 2;
      const sp = G.cone(0.035 * size, 0.12 * size, 6);
      const nn = new THREE.Vector3(Math.cos(a), Math.sin(a) * 0.8, Math.sin(a * 2) * 0.3).normalize();
      rb.part(orient(sp, end.clone().addScaledVector(nn, 0.12 * size), nn), 'tail2', '#f3ead8', 0);
    }
  } else if (style === 'fin') {
    const g = G.extrudeOutline([[0, 0], [0.28 * size, 0.08 * size, 0.34 * size, 0.3 * size], [0.1 * size, 0.18 * size], [0, 0.26 * size], [-0.1 * size, 0.18 * size], [-0.34 * size, 0.3 * size], [-0.28 * size, 0.08 * size, 0, 0]], 0.03, 0.015);
    rb.part(orient(g, end, dir), 'tail2', paints.gradientY(accent, C(accent).offsetHSL(0, 0, 0.2), end.y - 0.1, end.y + 0.3), 0.1);
  } else if (style === 'bolt') {
    const w = 0.06 * size;
    const g = G.extrudeOutline([[-w, 0], [w, 0], [w * 0.4, 0.14 * size], [w * 2.2, 0.12 * size], [-w * 0.5, 0.42 * size], [0, 0.2 * size], [-w * 1.8, 0.22 * size]], 0.05, 0.015);
    rb.part(orient(g, end, dir), 'tail2', accent, 0.45);
  } else if (style === 'crystal') {
    const g = G.flat(G.crystal(0.36 * size, 0.07 * size, 6));
    rb.part(orient(g, end, dir), 'tail2', paints.form(accent, 0.2, 0.1), 0.35);
  } else if (style === 'spike') {
    const g = G.cone(endR * 1.6 + 0.02, 0.2 * size, 8);
    g.translate(0, 0.08 * size, 0);
    rb.part(orient(g, end, dir), 'tail2', paints.form(accent), 0);
  } else if (style === 'wisp') {
    const g = G.cone(endR + 0.02, 0.25 * size, 8);
    g.translate(0, 0.1 * size, 0);
    rb.part(orient(g, end, dir), 'tail2', accent, 0.4);
  } else if (style === 'feather') {
    for (let k = 0; k < 5; k++) {
      const g = G.leafGeo(0.5 * size, 0.16 * size, 0.03);
      g.rotateZ((k - 2) * 0.28);
      g.rotateX(0.2);
      rb.part(orient(g, end, dir), 'tail2', paints.gradientY(color, accent, end.y - 0.1, end.y + 0.5), 0);
    }
  }
  // spikes along the tail
  if (o.spikes) {
    for (let k = 1; k <= o.spikes; k++) {
      const t = k / (o.spikes + 1);
      const pnt = curve.getPointAt(t);
      const tan = curve.getTangentAt(t);
      const upv = new THREE.Vector3(0, 1, 0).addScaledVector(tan, -tan.y).normalize();
      const sp = G.cone(rfn(t) * 0.55, rfn(t) * 1.6 + 0.04, 6);
      sp.translate(0, rfn(t) * 0.8, 0);
      rb.part(orient(sp, pnt, upv), t < 0.34 ? 'tail0' : t < 0.67 ? 'tail1' : 'tail2', o.spikeColor || accent, o.spikeGlow || 0);
    }
  }
}

// ---------------------------------------------------------------------------
// WINGS (extend along +X for the left wing, mirrored for the right)
// ---------------------------------------------------------------------------
export function wings(rb, o) {
  const { parent = 'body', at, style = 'bat', size = 0.6, color = '#8a6bd6', membrane = null, accent = '#ffffff', glowC = '#ff8a2a', tilt = 0.35, sweep = 0.5 } = o;
  for (const s of [1, -1]) {
    const bn = s > 0 ? 'wingL' : 'wingR';
    const root = [at[0] * s, at[1], at[2]];
    rb.bone(bn, parent, root);
    const parts = [];
    const L = size;
    if (style === 'bat' || style === 'dragon') {
      // bones (struts)
      const tips = [[L * 1.0, L * 0.55, -L * 0.1], [L * 0.95, L * 0.05, -L * 0.3], [L * 0.62, -L * 0.25, -L * 0.42]];
      const elbow = new THREE.Vector3(L * 0.42, L * 0.38, 0);
      const arm = G.taperTube([new THREE.Vector3(0, 0, 0), new THREE.Vector3(L * 0.2, L * 0.25, 0.02), elbow], (t) => L * 0.055 * (1 - t * 0.3), 6, 6);
      parts.push([arm, paints.form(color), 0]);
      for (const tp of tips) {
        const f = G.taperTube([elbow, new THREE.Vector3(...tp)], (t) => L * 0.035 * (1 - t * 0.8), 5, 5);
        parts.push([f, paints.form(color), 0]);
      }
      const claw = G.cone(L * 0.04, L * 0.12, 6);
      claw.rotateZ(0.6);
      claw.translate(elbow.x + L * 0.03, elbow.y + L * 0.06, 0);
      parts.push([claw, '#f3ead8', 0]);
      // membrane with scalloped edge
      const m = new THREE.Shape();
      m.moveTo(0, 0);
      m.lineTo(elbow.x, elbow.y);
      m.lineTo(tips[0][0], tips[0][1]);
      m.quadraticCurveTo(L * 0.85, L * 0.2, tips[1][0], tips[1][1]);
      m.quadraticCurveTo(L * 0.66, -L * 0.1, tips[2][0], tips[2][1]);
      m.quadraticCurveTo(L * 0.35, -L * 0.2, 0, -L * 0.12);
      m.lineTo(0, 0);
      const mg = new THREE.ExtrudeGeometry(m, { depth: L * 0.012, bevelEnabled: false, curveSegments: 6 });
      mg.translate(0, 0, -L * 0.006);
      // curve membrane back a little
      const mp = mg.attributes.position;
      for (let i = 0; i < mp.count; i++) mp.setZ(i, mp.getZ(i) - (mp.getX(i) / L) * L * 0.35 + Math.sin((mp.getX(i) / L) * Math.PI) * L * 0.08);
      mg.computeVertexNormals();
      const memC = membrane || C(color).offsetHSL(0, -0.05, 0.12).getStyle();
      parts.push([G.clean(mg), paints.gradientY(C(memC).offsetHSL(0, 0, -0.08), memC, -L * 0.3, L * 0.5), 0.05]);
      // fix strut z to membrane curve
      for (const [pg] of parts.slice(0, 5)) {
        const pp = pg.attributes.position;
        for (let i = 0; i < pp.count; i++) pp.setZ(i, pp.getZ(i) - (pp.getX(i) / L) * L * 0.35 + Math.sin((pp.getX(i) / L) * Math.PI) * L * 0.08);
        pg.computeVertexNormals();
      }
    } else if (style === 'feather' || style === 'angel') {
      const n = 7;
      for (let k = 0; k < n; k++) {
        const t = k / (n - 1);
        const len = L * (0.55 + (1 - Math.abs(t - 0.35)) * 0.55);
        const f = G.leafGeo(len, L * 0.24, L * 0.03);
        f.rotateZ(-Math.PI / 2 + 0.2 + t * 1.05);
        f.translate(L * 0.12 + t * L * 0.08, L * 0.12 - t * L * 0.05, -t * L * 0.08);
        const cA = C(color), cB = C(accent);
        parts.push([f, (x) => cA.clone().lerp(cB, Math.min(1, Math.abs(x) / (L * 1.1))), style === 'angel' ? 0.1 : 0]);
      }
      const cov = G.ellipsoid(L * 0.38, L * 0.16, L * 0.08, 12, 8);
      cov.translate(L * 0.3, L * 0.14, 0);
      cov.rotateZ(0.25);
      parts.push([cov, paints.form(color), 0]);
    } else if (style === 'insect' || style === 'fairy') {
      const cA = C(color);
      for (const [len, ang, w] of [[L * 1.05, 0.35, L * 0.42], [L * 0.75, -0.35, L * 0.32]]) {
        const f = G.leafGeo(len, w, L * 0.012);
        f.rotateZ(-Math.PI / 2 + ang);
        parts.push([f, (x, y) => cA.clone().lerp(C(accent), Math.min(1, Math.hypot(x, y) / len)), 0.35]);
      }
    } else if (style === 'leaf') {
      for (const [len, ang] of [[L * 1.1, 0.4], [L * 0.9, -0.05], [L * 0.7, -0.45]]) {
        const f = G.leafGeo(len, L * 0.42, L * 0.03);
        G.bend(f, 0.4, len);
        f.rotateZ(-Math.PI / 2 + ang);
        parts.push([f, (x, y, z, nx, ny) => C(color).offsetHSL(0, 0, Math.abs(y) < L * 0.03 ? 0.15 : ny * 0.05), 0]);
      }
    } else if (style === 'flame') {
      for (let k = 0; k < 4; k++) {
        const g = flameTongue(L * (1.0 - k * 0.15), L * 0.18);
        g.rotateZ(-Math.PI / 2 + 0.55 - k * 0.32);
        g.translate(L * 0.05, 0, -k * 0.02);
        const core = C('#fff2a8'), mid = C(glowC);
        parts.push([g, (x) => core.clone().lerp(mid, Math.min(1, Math.abs(x) / (L * 0.5))), 1]);
      }
    } else if (style === 'crystal') {
      for (let k = 0; k < 5; k++) {
        const g = G.flat(G.crystal(L * (1.0 - k * 0.12), L * 0.08, 5, 0.3));
        g.rotateZ(-Math.PI / 2 + 0.6 - k * 0.3);
        parts.push([g, paints.form(color, 0.2, 0.1), 0.35]);
      }
    } else if (style === 'mech') {
      const strut = G.taperTube([new THREE.Vector3(0, 0, 0), new THREE.Vector3(L * 0.35, L * 0.28, -0.02), new THREE.Vector3(L * 0.7, L * 0.34, -0.06)], L * 0.05, 6, 6);
      parts.push([strut, paints.form(C(color).offsetHSL(0, 0, -0.15), 0.2, 0.1), 0]);
      const n = 6;
      for (let k = 0; k < n; k++) {
        const t = k / (n - 1);
        const len = L * (0.95 - t * 0.35);
        const f = G.leafGeo(len, L * 0.2, L * 0.035);
        f.scale(1, 1, 1);
        f.rotateZ(-Math.PI / 2 + 0.45 - t * 1.05);
        f.translate(L * (0.12 + t * 0.45), L * (0.3 - t * 0.02), -t * 0.02);
        const base = C(color), edge = C(accent);
        parts.push([f, (x, y, z, nx, ny) => base.clone().lerp(edge, Math.max(0, Math.hypot(x, y) / (L * 1.1) - 0.45) * 1.6).offsetHSL(0, 0, ny * 0.1), 0]);
        const rv = G.sphere(L * 0.028, 6, 4);
        rv.translate(L * (0.12 + t * 0.45), L * (0.3 - t * 0.02), 0.012);
        parts.push([rv, glowC, 1]);
      }
    } else if (style === 'cloud') {
      for (let k = 0; k < 4; k++) {
        const g = G.ico(L * (0.24 - k * 0.03), 2);
        g.translate(L * (0.2 + k * 0.22), L * (0.1 - k * 0.04), 0);
        parts.push([g, paints.form(color, 0.1, 0.12), 0]);
      }
    }
    for (const [g0, pc, gl] of parts) {
      const g = g0.index ? g0.toNonIndexed() : g0;
      g.rotateY(-sweep * 0.5);
      g.rotateZ(tilt);
      if (s < 0) mirrorX(g);
      g.translate(root[0], root[1], root[2]);
      rb.part(g, bn, pc, gl);
    }
  }
}

// ---------------------------------------------------------------------------
// BACK / BODY DECORATIONS along a spine curve
// ---------------------------------------------------------------------------
export function backFeature(rb, o) {
  const { bone = 'body', spine, style = 'spikes', count = 5, size = 0.15, color = '#fff', glowC = '#ff8a2a', accent = '#ffd23f', seed = 1 } = o;
  const curve = new THREE.CatmullRomCurve3(spine.map((p) => new THREE.Vector3(...p.p)));
  const normals = spine.map((p) => new THREE.Vector3(...(p.n || [0, 1, 0])).normalize());
  const nAt = (t) => {
    const f = t * (normals.length - 1);
    const i = Math.min(normals.length - 2, Math.floor(f));
    return normals[i].clone().lerp(normals[i + 1], f - i).normalize();
  };
  for (let k = 0; k < count; k++) {
    const t = count === 1 ? 0.5 : k / (count - 1);
    const p = curve.getPointAt(t);
    const n = nAt(t);
    const sz = size * (0.7 + Math.sin(t * Math.PI) * 0.5);
    let g, pc = paints.form(color), gl = 0;
    if (style === 'spikes') {
      g = G.cone(sz * 0.38, sz * 1.25, 8);
      g.translate(0, sz * 0.45, 0);
      g.rotateX(-0.35);
    } else if (style === 'plates') {
      g = G.extrudeOutline([[-sz * 0.55, 0], [sz * 0.55, 0], [sz * 0.2, sz * 0.9, 0, sz * 1.2], [-sz * 0.2, sz * 0.9, -sz * 0.55, 0]], sz * 0.12, sz * 0.05);
      g.rotateY(Math.PI / 2);
      pc = paints.gradientY(color, accent, p.y, p.y + sz);
    } else if (style === 'crystals') {
      const parts = [];
      for (let j = 0; j < 3; j++) {
        const c = G.flat(G.crystal(sz * (1.4 - j * 0.35), sz * 0.22, 6));
        c.rotateZ((j - 1) * 0.4);
        c.rotateX((j % 2 ? 0.3 : -0.2));
        parts.push(c);
      }
      g = G.merge(parts);
      pc = paints.form(color, 0.2, 0.08);
      gl = 0.3;
    } else if (style === 'moss') {
      g = G.jitter(G.ico(sz * 0.7, 1), sz * 0.08, seed + k);
      g.scale(1.2, 0.6, 1.2);
      pc = paints.form(color, 0.12, 0.08);
      if (k % 2 === 0) {
        const fl = G.sphere(sz * 0.18, 8, 6);
        fl.translate(0, sz * 0.4, sz * 0.2);
        rb.part(orient(fl, p, n), bone, accent, 0.1);
      }
    } else if (style === 'flames') {
      const out = [];
      addFlameCluster(out, sz * 1.6, [0, 0, 0], glowC, 2);
      for (const [fg, fpc, fgl] of out) rb.part(orient(fg, p, n), bone, fpc, fgl);
      continue;
    } else if (style === 'gears') {
      const parts = [G.cylinder(sz * 0.5, sz * 0.5, sz * 0.14, 12)];
      for (let j = 0; j < 8; j++) {
        const a = (j / 8) * Math.PI * 2;
        const tooth = G.box(sz * 0.16, sz * 0.14, sz * 0.16);
        tooth.translate(Math.cos(a) * sz * 0.56, 0, Math.sin(a) * sz * 0.56);
        parts.push(tooth);
      }
      g = G.merge(parts);
      g.rotateX(Math.PI / 2);
      g.translate(0, sz * 0.25, 0);
      pc = paints.form(color, 0.2, 0.15);
    } else if (style === 'rocks') {
      g = G.flat(G.jitter(G.ico(sz * 0.6, 0), sz * 0.12, seed + k * 3));
      g.scale(1.1, 0.8, 1.1);
      pc = paints.form(color, 0.1, 0.12);
    } else if (style === 'leaves') {
      g = G.leafGeo(sz * 1.6, sz * 0.8, sz * 0.06);
      G.bend(g, -0.6, sz * 1.6);
      g.rotateX(-0.6);
      pc = (x, y, z, nx, ny) => C(color).offsetHSL(0, 0, ny * 0.08);
    } else if (style === 'orbs') {
      g = G.sphere(sz * 0.3, 10, 8);
      g.translate(0, sz * 0.3, 0);
      pc = glowC;
      gl = 1;
    } else if (style === 'fins') {
      g = G.extrudeOutline([[-sz * 0.5, 0], [sz * 0.5, 0], [-sz * 0.2, sz * 1.1]], sz * 0.08, sz * 0.03);
      g.rotateY(Math.PI / 2);
      pc = paints.gradientY(color, accent, p.y, p.y + sz);
      gl = 0.12;
    } else if (style === 'fluff') {
      g = G.ico(sz * 0.55, 2);
      g.scale(1, 0.7, 1);
      pc = paints.form(color, 0.1, 0.08);
    }
    if (!g) continue;
    rb.part(orient(g, p, n), bone, pc, gl);
  }
}

// Scatter small bits over an ellipsoid (spots of moss, gems, rivets, snow).
export function studs(rb, { bone = 'body', E, count = 8, size = 0.05, color = '#fff', glow = 0, shape = 'sphere', seed = 3, minPitch = 0.1, maxPitch = 1.2, yawRange = Math.PI }) {
  let r = seed * 9301 + 49297;
  const rnd = () => ((r = (r * 9301 + 49297) % 233280) / 233280);
  for (let k = 0; k < count; k++) {
    const yaw = (rnd() * 2 - 1) * yawRange;
    const pitch = minPitch + rnd() * (maxPitch - minPitch);
    const { p, n } = surf(E, yaw, pitch, 0.98);
    let g;
    if (shape === 'sphere') g = G.sphere(size * (0.7 + rnd() * 0.6), 8, 6);
    else if (shape === 'crystal') g = G.flat(G.crystal(size * 2.5, size * 0.5, 5));
    else if (shape === 'rock') g = G.flat(G.jitter(G.ico(size, 0), size * 0.2, k));
    else if (shape === 'rivet') g = G.cylinder(size, size, size * 0.4, 8);
    else if (shape === 'star') g = G.flat(G.ico(size, 0));
    rb.part(orient(g, p, n), bone, paints.form(color, 0.15, 0.1), glow);
  }
}
