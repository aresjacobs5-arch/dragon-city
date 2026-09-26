import * as THREE from 'three';
import * as G from '../geom.js';
import { paints, crackMask, withCracks } from './rig.js';
import * as P from './parts.js';

const { C, surf, ellipsoidPart, orient } = P;
const V3 = (x, y, z) => new THREE.Vector3(x, y, z);

// ---------------------------------------------------------------------------
// Skin paint composition (belly + pattern + glow cracks)
// ---------------------------------------------------------------------------
export function skinPaint(m, bellyDir = [0, -1, 0.25], { threshold = 0.2, noBelly = false, colorKey = 'skin' } = {}) {
  const c = m.colors;
  const paint = noBelly || !c.belly ? paints.form(c[colorKey]) : paints.belly(c[colorKey], c.belly, { dir: bellyDir, threshold });
  // Patterns (cracks, spots, plates, stripes, runes) are rendered per-pixel in the creature shader.
  return { paint, glow: 0, pat: m.pattern ? 1 : 0 };
}

const legPaint = (m) => paints.form(m.colors.limb || m.colors.skin, 0.06, 0.12);

function paw(rb, bone, at, r, m, style = 'paw', dir = 1) {
  const [x, y, z] = at;
  if (style === 'hoof') {
    const h = G.cylinder(r * 0.8, r * 0.95, r * 0.9, 12);
    h.translate(x, r * 0.45, z);
    rb.part(h, bone, paints.form(m.colors.hoof || '#4a3a32', 0.1, 0.1));
    return;
  }
  const f = G.ellipsoid(r * 1.05, r * 0.72, r * 1.25, 14, 10);
  f.translate(x, r * 0.62, z + r * 0.25 * dir);
  rb.part(f, bone, legPaint(m));
  const toeC = m.colors.toe || C(m.colors.limb || m.colors.skin).offsetHSL(0, 0, 0.1).getStyle();
  if (style === 'claw') {
    for (let k = -1; k <= 1; k++) {
      const c = G.cone(r * 0.16, r * 0.5, 6);
      c.rotateX(Math.PI / 2 * dir);
      c.translate(x + k * r * 0.45, r * 0.3, z + r * 1.35 * dir);
      rb.part(c, bone, m.colors.claw || '#f3ead8');
    }
  } else {
    for (let k = -1; k <= 1; k++) {
      const t = G.sphere(r * 0.3, 8, 6);
      t.translate(x + k * r * 0.48, r * 0.35, z + r * 1.12 * dir);
      rb.part(t, bone, toeC);
    }
  }
}

function faceOn(rb, m, headE, st, { snoutE = null, eyePitch = null, eyeYaw = null, eyeDepth = 0.86 } = {}) {
  const f = m.face || {};
  const baby = st.s === 0;
  const hr = headE.r[0];
  const eyeSize = (f.eyeSize || 0.3) * hr * (baby ? 1.12 : 1);
  P.eyes(rb, {
    bone: 'head',
    E: headE,
    yaw: eyeYaw ?? f.eyeYaw ?? 0.42,
    pitch: eyePitch ?? f.eyePitch ?? (snoutE ? 0.2 : 0.1),
    depth: f.eyeDepth ?? eyeDepth,
    size: eyeSize,
    iris: m.colors.eye || '#3fa9f5',
    style: f.eyes || 'round',
    skin: m.colors.skin,
    glowC: m.colors.eyeGlow || m.colors.glow || '#ffffff',
    brow: f.brow || null,
    browColor: m.colors.brow || C(m.colors.skin).offsetHSL(0, 0, -0.2).getStyle(),
    lash: !!f.lash,
    single: !!f.cyclops,
    squash: f.eyeSquash || 1,
  });
  const mouthE = snoutE || headE;
  if (f.mouth !== 'none') {
    P.mouth(rb, {
      bone: 'head',
      E: mouthE,
      pitch: f.mouthPitch ?? (snoutE ? -0.42 : -0.3),
      depth: 0.97,
      width: (f.mouthWidth || 0.42) * (snoutE ? snoutE.r[0] * 1.5 : hr),
      style: f.mouth || 'smile',
      color: m.colors.mouth || '#3a1422',
      beakColor: m.colors.beak,
      jaw: !!f.jaw,
    });
  }
  if (snoutE && f.nose !== false) P.nose(rb, { bone: 'head', E: snoutE, pitch: 0.18, depth: 1.0, size: snoutE.r[0] * 0.28, color: m.colors.nose || '#2a1a22' });
  if (f.cheeks) P.cheeks(rb, { bone: 'head', E: headE, size: hr * 0.2, color: m.colors.cheek || '#ff8fa8', yaw: 0.72, pitch: snoutE ? 0.0 : -0.12 });
}

function headFeatures(rb, m, headE, st) {
  const g = st.g;
  if (m.ears) {
    const e = m.ears;
    P.ears(rb, {
      bone: 'head', E: headE, style: e.style, yaw: e.yaw ?? 0.95, pitch: e.pitch ?? 0.6, size: (e.size || 0.5) * headE.r[0] * (0.9 + g * 0.2),
      color: m.colors[e.color || 'skin'] || e.color, inner: m.colors[e.inner || 'inner'] || m.colors.belly || '#ffc0cf', tilt: e.tilt ?? 0.35, glowC: m.colors.glow,
    });
  }
  if (m.horns && st.s >= (m.horns.minStage || 0)) {
    const h = m.horns;
    P.horns(rb, {
      bone: 'head', E: headE, style: h.style, yaw: h.yaw ?? 0.42, pitch: h.pitch ?? 0.78, size: (h.size || 0.5) * headE.r[0] * (0.6 + g * 0.55),
      color: m.colors[h.color || 'horn'] || h.color || '#f3ead8', tipColor: h.tip ? m.colors[h.tip] || h.tip : null, count: h.count || 2,
      glowTip: h.glow || 0, curl: h.curl ?? 0.7, splay: h.splay ?? 0.3, leafColor: m.colors.leaf, depth: h.depth || 0.9,
    });
  }
  if (m.crest && st.s >= (m.crest.minStage || 0)) {
    const c = m.crest;
    P.crest(rb, { bone: 'head', E: headE, size: (c.size || 0.5) * headE.r[0] * (0.7 + g * 0.45), color: m.colors[c.color || 'accent'] || c.color, style: c.style || 'fin', count: c.count || 3, glow: c.glow || 0 });
  }
  if (m.halo && st.s >= (m.halo.minStage || 0)) {
    P.halo(rb, { bone: 'head', at: [headE.c[0], headE.c[1] + headE.r[1] * 1.45, headE.c[2] - headE.r[2] * 0.1], radius: headE.r[0] * 0.62, color: m.colors.glow || '#ffe27a' });
  }
  if (m.crown && st.s >= (m.crown.minStage || 0)) {
    P.crown(rb, { bone: 'head', at: [headE.c[0], headE.c[1] + headE.r[1] * 0.82, headE.c[2]], radius: headE.r[0] * 0.42, color: m.colors.crown || '#ffd23f', gem: m.colors.gem || '#ff4f7b' });
  }
  if (m.headFlames && st.s >= (m.headFlames.minStage || 0)) {
    P.flames(rb, 'head', headE.r[0] * (0.9 + g * 0.5), [headE.c[0], headE.c[1] + headE.r[1] * 0.85, headE.c[2] - headE.r[2] * 0.15], m.colors.glow, 3);
  }
}

function stageAdjust(v, st, baby = 0.85, adult = 1.1) {
  return v * (st.s === 0 ? baby : st.s === 2 ? adult : 1);
}

// ---------------------------------------------------------------------------
// ARCHETYPES
// ---------------------------------------------------------------------------
export const ARCHETYPES = {
  // Four-legged beasts: cubs, wolves, lions, rams, rhinos.
  quad(rb, m, st) {
    const B = { width: 0.3, height: 0.28, length: 0.42, legLen: 0.26, legR: 0.085, pawR: 0.1, neck: 0, chest: false, paw: 'paw', ...m.body };
    const H = { size: 0.34, w: 1, h: 0.94, d: 0.95, snout: 0.5, snoutW: 1, snoutY: 0, ...m.head };
    const baby = st.s === 0;
    const legLen = B.legLen * (baby ? 0.78 : st.s === 2 ? 1.08 : 1);
    const rx = B.width, ry = B.height * (baby ? 1.04 : 1), rz = B.length * (baby ? 0.86 : 1);
    const bodyY = legLen + ry * 0.72;
    const bodyE = { c: [0, bodyY, 0], r: [rx, ry, rz] };
    rb.bone('body', 'root', bodyE.c);
    const sk = skinPaint(m, [0, -1, 0.15]);
    rb.part(ellipsoidPart(bodyE, 28), 'body', sk.paint, sk.glow, sk.pat);
    if (B.chest) {
      const E = { c: [0, bodyY + ry * 0.12, rz * 0.42], r: [rx * 1.08, ry * 1.08, rz * 0.62] };
      rb.part(ellipsoidPart(E, 24), 'body', sk.paint, sk.glow, sk.pat);
    }
    if (B.hump) {
      const E = { c: [0, bodyY + ry * 0.55, -rz * 0.1], r: [rx * 0.8, ry * 0.55, rz * 0.6] };
      rb.part(ellipsoidPart(E, 20), 'body', sk.paint, sk.glow, sk.pat);
    }
    // legs
    for (const [name, sx, sz] of [['legFL', 1, 1], ['legFR', -1, 1], ['legBL', 1, -1], ['legBR', -1, -1]]) {
      const hip = [sx * rx * 0.6, bodyY - ry * 0.3, sz * rz * 0.56];
      rb.bone(name, 'root', hip);
      const foot = [hip[0] * 1.04, B.pawR * 0.7, hip[2] + sz * 0.015];
      const mid = [hip[0] * 1.06, (hip[1] + foot[1]) * 0.5, hip[2] + (sz > 0 ? 0.01 : -0.03)];
      const leg = G.taperTube([hip, mid, foot], (t) => B.legR * (1.15 - t * 0.35), 10, 6);
      rb.part(leg, name, legPaint(m));
      if (sz < 0 || B.thighs) {
        const th = G.ellipsoid(B.legR * 1.7, B.legR * 2.0, B.legR * 1.8, 12, 10);
        th.translate(hip[0] * 0.95, hip[1] - B.legR * 0.4, hip[2]);
        rb.part(th, name, sk.paint, sk.glow, sk.pat);
      }
      paw(rb, name, [foot[0], 0, foot[2]], B.pawR, m, B.paw);
    }
    // neck & head
    const neck = B.neck * (baby ? 0.6 : 1);
    const hs = H.size * (baby ? 1.16 : st.s === 2 ? 0.96 : 1);
    const neckBase = [0, bodyY + ry * 0.45, rz * 0.62];
    const headC = [0, neckBase[1] + hs * 0.45 + neck * 0.9, neckBase[2] + hs * 0.35 + neck * 0.45];
    let headParent = 'body';
    if (neck > 0.05) {
      rb.bone('neck', 'body', neckBase);
      const ng = G.taperTube([neckBase, [0, (neckBase[1] + headC[1]) / 2, (neckBase[2] + headC[2]) / 2 - 0.02], [0, headC[1] - hs * 0.3, headC[2] - hs * 0.2]], (t) => (B.neckR || rx * 0.55) * (1 - t * 0.3), 12, 8);
      rb.part(ng, 'neck', sk.paint, sk.glow, sk.pat);
      headParent = 'neck';
    }
    rb.bone('head', headParent, headC);
    const headE = { c: headC, r: [hs * H.w, hs * H.h, hs * H.d] };
    const hp = skinPaint(m, [0, -0.6, 1], { threshold: 0.45 });
    rb.part(ellipsoidPart(headE, 28), 'head', hp.paint, hp.glow, hp.pat);
    let snoutE = null;
    if (H.snout > 0) {
      snoutE = { c: [0, headC[1] - hs * (0.26 - H.snoutY), headC[2] + hs * (0.62 + H.snout * 0.2)], r: [hs * 0.44 * H.snoutW, hs * 0.34, hs * (0.28 + H.snout * 0.3)] };
      rb.part(ellipsoidPart(snoutE, 20), 'head', paints.form(m.colors.snout || m.colors.belly || m.colors.skin, 0.1, 0.08));
    }
    faceOn(rb, m, headE, st, { snoutE });
    headFeatures(rb, m, headE, st);
    if (m.mane && st.s >= (m.mane.minStage || 0)) mane(rb, m, headE, st);
    // tail
    if (m.tail) {
      const t = m.tail;
      const len = (t.len || 0.5) * (baby ? 0.8 : 1);
      const base = [0, bodyY + ry * 0.2, -rz * 0.9];
      const up = t.up ?? 0.6;
      const pts = [base, [0, base[1] + len * up * 0.4, base[2] - len * 0.45], [0, base[1] + len * up, base[2] - len * 0.8], [0, base[1] + len * up * 1.35, base[2] - len * 0.95]];
      P.tail(rb, { parent: 'body', pts, radius: (t.r || 0.07) * (baby ? 0.9 : 1), color: m.colors[t.color || 'skin'], tipColor: m.colors[t.tip || 'skin'] || t.tip, style: t.style, accent: m.colors[t.accent || 'accent'], glowC: m.colors.glow, size: (t.size || 1) * (0.8 + st.g * 0.35), spikes: t.spikes, spikeColor: m.colors[t.spikeColor || 'accent'] });
    }
    // back
    if (m.back && st.s >= (m.back.minStage || 0)) {
      const spine = [];
      for (let k = 0; k <= 4; k++) {
        const a = 1.0 - k * 0.42;
        spine.push({ p: [0, bodyY + Math.sin(a) * ry * 0.98 + (k === 0 ? 0.02 : 0), Math.cos(a) * rz * 0.98 * (k < 2 ? 1 : 1)], n: [0, Math.sin(a) + 0.4, Math.cos(a) * 0.5] });
      }
      P.backFeature(rb, { bone: 'body', spine, style: m.back.style, count: m.back.count || 5, size: (m.back.size || 0.3) * ry * (0.7 + st.g * 0.5), color: m.colors[m.back.color || 'accent'] || m.back.color, glowC: m.colors.glow, accent: m.colors.accent2 || m.colors.accent, seed: 3 });
    }
    if (m.wings && st.s >= (m.wings.minStage || 0)) {
      const w = m.wings;
      P.wings(rb, { parent: 'body', at: [rx * 0.55, bodyY + ry * 0.55, rz * 0.2], style: w.style, size: (w.size || 0.7) * (0.55 + st.g * 0.55), color: m.colors[w.color || 'skin'] || w.color, membrane: m.colors[w.membrane || 'membrane'], accent: m.colors[w.accent || 'accent'], glowC: m.colors.glow, tilt: w.tilt ?? 0.45, sweep: w.sweep ?? 0.6 });
    }
    return { height: headC[1] + hs, center: [0, bodyY, 0], headC };
  },

  // Chibi upright creatures: sprites, imps, sproutlings.
  biped(rb, m, st) {
    const B = { r: 0.28, h: 0.5, legLen: 0.1, legR: 0.08, armLen: 0.26, armR: 0.06, taper: 0.15, ...m.body };
    const H = { size: 0.38, w: 1, h: 0.95, d: 0.92, snout: 0, ...m.head };
    const baby = st.s === 0;
    const hs = H.size * (baby ? 1.12 : st.s === 2 ? 0.95 : 1);
    const legLen = B.legLen * (baby ? 0.8 : 1.1);
    const bodyH = B.h * (baby ? 0.85 : 1);
    const footY = 0;
    const bodyBottom = legLen + 0.02;
    const bodyY = bodyBottom + bodyH * 0.45;
    rb.bone('body', 'root', [0, bodyY, 0]);
    const sk = skinPaint(m, [0, -0.25, 1], { threshold: 0.3 });
    // pear-shaped torso
    const prof = [];
    const n = 14;
    for (let i = 0; i <= n; i++) {
      const t = i / n;
      const r = B.r * Math.sin(Math.PI * Math.min(1, t * 1.02)) ** 0.7 * (1 - t * B.taper) * (1 + 0.1 * Math.sin(t * Math.PI * 0.8));
      prof.push([Math.max(0.001, r), bodyBottom + t * bodyH]);
    }
    const torso = G.lathe(prof, 24);
    torso.scale(1, 1, B.depth || 0.9);
    rb.part(torso, 'body', sk.paint, sk.glow, sk.pat);
    // legs
    for (const [name, sx] of [['legL', 1], ['legR', -1]]) {
      const hip = [sx * B.r * 0.48, bodyBottom + 0.05, 0];
      rb.bone(name, 'root', hip);
      const leg = G.taperTube([hip, [hip[0], footY + B.legR * 0.8, 0.01]], B.legR, 10, 4);
      rb.part(leg, name, legPaint(m));
      const foot = G.ellipsoid(B.legR * 1.35, B.legR * 0.8, B.legR * 1.7, 12, 8);
      foot.translate(hip[0], B.legR * 0.7, B.legR * 0.55);
      rb.part(foot, name, paints.form(m.colors.foot || m.colors.limb || m.colors.skin, 0.1, 0.12));
    }
    // arms
    if (B.armLen > 0) {
      for (const [name, sx] of [['armL', 1], ['armR', -1]]) {
        const sh = [sx * B.r * 0.82, bodyY + bodyH * 0.18, 0.02];
        rb.bone(name, 'body', sh);
        const hand = [sx * (B.r * 0.95 + B.armLen * 0.45), sh[1] - B.armLen * 0.8, 0.08];
        const arm = G.taperTube([sh, [sx * (B.r + B.armLen * 0.2), sh[1] - B.armLen * 0.4, 0.06], hand], (t) => B.armR * (1 - t * 0.2), 9, 6);
        rb.part(arm, name, legPaint(m));
        const hg = G.sphere(B.armR * (B.fists ? 2.2 : 1.35), 12, 10);
        hg.translate(hand[0], hand[1], hand[2]);
        rb.part(hg, name, paints.form(m.colors.hand || m.colors.limb || m.colors.skin, 0.1, 0.1));
        if (B.claws) {
          for (let k = -1; k <= 1; k++) {
            const c = G.cone(B.armR * 0.3, B.armR * 1.0, 6);
            c.rotateX(Math.PI);
            c.translate(hand[0] + k * B.armR * 0.6, hand[1] - B.armR * 1.3, hand[2] + B.armR * 0.5);
            rb.part(c, name, m.colors.claw || '#f3ead8');
          }
        }
      }
    }
    // head
    const headC = [0, bodyBottom + bodyH + hs * (H.sink ? 0.55 : 0.72), 0.02];
    rb.bone('head', 'body', headC);
    const headE = { c: headC, r: [hs * H.w, hs * H.h, hs * H.d] };
    const hp = skinPaint(m, [0, -0.5, 1], { threshold: 0.55, noBelly: !H.faceBelly });
    rb.part(ellipsoidPart(headE, 30), 'head', hp.paint, hp.glow, hp.pat);
    let snoutE = null;
    if (H.snout > 0) {
      snoutE = { c: [0, headC[1] - hs * 0.28, headC[2] + hs * 0.72], r: [hs * 0.42, hs * 0.3, hs * (0.25 + H.snout * 0.25)] };
      rb.part(ellipsoidPart(snoutE, 18), 'head', paints.form(m.colors.snout || m.colors.belly, 0.1, 0.08));
    }
    faceOn(rb, m, headE, st, { snoutE });
    headFeatures(rb, m, headE, st);
    if (m.hair) {
      // leafy / flame / crystal tuft on top
      const top = [headC[0], headC[1] + headE.r[1] * 0.88, headC[2] - 0.02];
      if (m.hair === 'sprout') {
        rb.bone('fxHair', 'head', top);
        const stem = G.taperTube([top, [top[0] + 0.02, top[1] + 0.12, top[2]], [top[0] + 0.05, top[1] + 0.2, top[2]]], 0.02, 6, 5);
        rb.part(stem, 'fxHair', m.colors.stem || '#5c9e38');
        for (const s of [1, -1]) {
          const lf = G.leafGeo(0.22 * (0.9 + st.g * 0.4), 0.14, 0.02);
          G.bend(lf, -0.5, 0.22);
          lf.rotateZ(-1.1 * s);
          lf.translate(top[0] + 0.05, top[1] + 0.19, top[2]);
          rb.part(lf, 'fxHair', paints.form(m.colors.leaf || '#72cf4b', 0.12, 0.08));
        }
        if (st.s >= 2) {
          const bud = G.sphere(0.06, 10, 8);
          bud.translate(top[0] + 0.05, top[1] + 0.24, top[2]);
          rb.part(bud, 'fxHair', m.colors.flower || '#ff8fb8', 0.2);
        }
      } else if (m.hair === 'flame') {
        P.flames(rb, 'head', hs * 0.9, top, m.colors.glow, 3);
      } else if (m.hair === 'tuft') {
        for (let k = 0; k < 4; k++) {
          const c = G.cone(hs * 0.14, hs * 0.5, 8);
          c.rotateZ((k - 1.5) * 0.35);
          c.rotateX(-0.2);
          c.translate(top[0] + (k - 1.5) * hs * 0.14, top[1] + hs * 0.14, top[2]);
          rb.part(c, 'head', paints.form(m.colors.hairC || m.colors.accent, 0.12, 0.1));
        }
      }
    }
    if (m.tail) {
      const t = m.tail;
      const len = t.len || 0.35;
      const base = [0, bodyBottom + bodyH * 0.25, -B.r * 0.75];
      const pts = [base, [0, base[1] - 0.02, base[2] - len * 0.4], [0, base[1] + len * 0.25, base[2] - len * 0.75], [0, base[1] + len * 0.65, base[2] - len * 0.85]];
      P.tail(rb, { parent: 'body', pts, radius: t.r || 0.05, color: m.colors[t.color || 'skin'], tipColor: m.colors[t.tip || 'skin'] || t.tip, style: t.style, accent: m.colors[t.accent || 'accent'], glowC: m.colors.glow, size: (t.size || 0.8) * (0.8 + st.g * 0.3), spikes: t.spikes });
    }
    if (m.back && st.s >= (m.back.minStage || 0)) {
      const spine = [];
      for (let k = 0; k <= 3; k++) spine.push({ p: [0, bodyBottom + bodyH * (0.85 - k * 0.22), -B.r * (0.55 + k * 0.1)], n: [0, 0.5, -1] });
      P.backFeature(rb, { bone: 'body', spine, style: m.back.style, count: m.back.count || 4, size: (m.back.size || 0.4) * B.r * (0.75 + st.g * 0.4), color: m.colors[m.back.color || 'accent'] || m.back.color, glowC: m.colors.glow, accent: m.colors.accent2 || m.colors.accent });
    }
    if (m.wings && st.s >= (m.wings.minStage || 0)) {
      const w = m.wings;
      P.wings(rb, { parent: 'body', at: [B.r * 0.5, bodyBottom + bodyH * 0.75, -B.r * 0.45], style: w.style, size: (w.size || 0.5) * (0.6 + st.g * 0.5), color: m.colors[w.color || 'skin'] || w.color, membrane: m.colors[w.membrane || 'membrane'], accent: m.colors[w.accent || 'accent'], glowC: m.colors.glow, tilt: w.tilt ?? 0.55, sweep: w.sweep ?? 0.9 });
    }
    if (m.skirt) {
      for (let k = 0; k < 7; k++) {
        const a = (k / 7) * Math.PI * 2;
        const pet = G.leafGeo(0.22, 0.16, 0.02);
        pet.rotateX(Math.PI - 0.5);
        pet.rotateY(a);
        pet.translate(Math.sin(a) * B.r * 0.75, bodyBottom + 0.1, Math.cos(a) * B.r * 0.75);
        rb.part(pet, 'body', paints.form(m.colors.petal || m.colors.accent, 0.1, 0.1));
      }
    }
    return { height: headC[1] + hs, center: [0, bodyY, 0], headC };
  },

  // Heavy brutes with oversized fists (gorilla stance).
  golem(rb, m, st) {
    const B = { w: 0.4, h: 0.42, d: 0.32, legLen: 0.16, fist: 0.19, ...m.body };
    const baby = st.s === 0;
    const k = baby ? 0.85 : st.s === 2 ? 1.1 : 1;
    const w = B.w * k, h = B.h * k, d = B.d * k;
    const legLen = B.legLen * k;
    const bodyY = legLen + h * 0.95;
    rb.bone('body', 'root', [0, bodyY, 0]);
    const sk = skinPaint(m, [0, -0.3, 1], { threshold: 0.35 });
    // torso: broad chest tapering to the waist
    const prof = [];
    for (let i = 0; i <= 14; i++) {
      const t = i / 14;
      const r = Math.sin(Math.PI * Math.min(1, t * 1.05)) ** 0.6 * (0.78 + t * 0.32);
      prof.push([Math.max(0.001, r), (t - 0.5) * 2]);
    }
    const torso = G.lathe(prof, 26);
    torso.scale(w, h, d);
    if (m.rocky) G.jitter(torso, 0.025, 4, 3);
    torso.rotateX(-0.12);
    torso.translate(0, bodyY, 0);
    rb.part(torso, 'body', sk.paint, sk.glow, sk.pat);
    // shoulder boulders
    for (const s2 of [1, -1]) {
      const sh = m.rocky ? G.flat(G.jitter(G.ico(w * 0.4, 1), 0.035, s2 + 5)) : G.sphere(w * 0.38, 16, 12);
      sh.scale(1, 0.85, 1);
      sh.translate(s2 * w * 0.86, bodyY + h * 0.5, -0.02);
      rb.part(sh, 'body', paints.form(m.colors.armor || m.colors.accent, 0.1, 0.15));
    }
    // legs
    for (const [name, sx] of [['legL', 1], ['legR', -1]]) {
      const hip = [sx * w * 0.42, bodyY - h * 0.8, -0.02];
      rb.bone(name, 'root', hip);
      const leg = G.taperTube([hip, [hip[0] * 1.05, 0.1, 0.0]], (t) => w * 0.25 * (1 - t * 0.1), 10, 4);
      rb.part(leg, name, legPaint(m));
      const foot = m.rocky ? G.flat(G.jitter(G.ellipsoid(w * 0.3, 0.08, w * 0.36, 8, 5), 0.015, sx)) : G.ellipsoid(w * 0.3, 0.08, w * 0.36, 12, 8);
      foot.translate(hip[0] * 1.05, 0.07, 0.06);
      rb.part(foot, name, paints.form(m.colors.armor || m.colors.accent, 0.1, 0.15));
    }
    // long arms with huge fists resting forward
    for (const [name, sx] of [['armL', 1], ['armR', -1]]) {
      const sh = [sx * w * 0.9, bodyY + h * 0.35, 0.0];
      rb.bone(name, 'body', sh);
      const fr = B.fist * k * (1 + st.g * 0.2);
      const hand = [sx * w * 1.2, fr * 0.95, d * 0.55];
      const elbow = [sx * w * 1.35, (sh[1] + hand[1]) * 0.5 + 0.02, d * 0.05];
      const arm = G.taperTube([sh, elbow, [hand[0], hand[1] + fr * 0.6, hand[2] - fr * 0.3]], (t) => w * 0.2 * (1 - t * 0.2), 10, 8);
      rb.part(arm, name, legPaint(m));
      const fist = m.rocky ? G.flat(G.jitter(G.ico(fr, 1), fr * 0.1, sx * 3)) : G.ellipsoid(fr, fr * 0.9, fr, 16, 12);
      fist.translate(hand[0], hand[1], hand[2]);
      rb.part(fist, name, paints.form(m.colors.fist || m.colors.armor || m.colors.accent, 0.1, 0.18));
      if (m.fistGlow) {
        const g2 = G.sphere(fr * 0.3, 10, 8);
        g2.translate(hand[0] + sx * fr * 0.5, hand[1] + fr * 0.2, hand[2] + fr * 0.6);
        rb.part(g2, name, m.colors.glow, 1);
      }
      if (m.knuckles) {
        for (let q = -1; q <= 1; q++) {
          const kn = G.cone(fr * 0.16, fr * 0.45, 6);
          kn.rotateX(Math.PI / 2);
          kn.translate(hand[0] + q * fr * 0.4, hand[1] + fr * 0.3, hand[2] + fr * 0.95);
          rb.part(kn, name, m.colors[m.knuckles] || m.knuckles, 0.2);
        }
      }
    }
    // head protruding from the upper front
    const hs = ((m.head && m.head.size) || 0.25) * (baby ? 1.18 : 1) * k;
    const headC = [0, bodyY + h * 0.62, d * 0.62];
    rb.bone('head', 'body', headC);
    const headE = { c: headC, r: [hs, hs * 0.92, hs * 0.88] };
    const hp = skinPaint(m, [0, -0.5, 1], { threshold: 0.5, noBelly: !(m.head && m.head.faceBelly) });
    rb.part(ellipsoidPart(headE, 26), 'head', hp.paint, hp.glow, hp.pat);
    faceOn(rb, m, headE, st, { eyePitch: 0.1 });
    headFeatures(rb, m, headE, st);
    if (m.back && st.s >= (m.back.minStage || 0)) {
      const spine = [];
      for (let q = 0; q <= 3; q++) {
        const a = 1.25 - q * 0.42;
        spine.push({ p: [0, bodyY + Math.sin(a) * h * 0.92, -Math.cos(a) * d * 0.9 - 0.02], n: [0, Math.sin(a), -Math.cos(a)] });
      }
      P.backFeature(rb, { bone: 'body', spine, style: m.back.style, count: m.back.count || 5, size: (m.back.size || 0.35) * h * (0.7 + st.g * 0.5), color: m.colors[m.back.color || 'accent'] || m.back.color, glowC: m.colors.glow, accent: m.colors.accent2 || m.colors.accent });
    }
    if (m.studs) P.studs(rb, { bone: 'body', E: { c: [0, bodyY, 0], r: [w * 0.95, h, d * 0.95] }, count: m.studs.count || 8, size: m.studs.size || 0.04, color: m.colors[m.studs.color || 'glow'] || m.studs.color, glow: m.studs.glow || 0, shape: m.studs.shape || 'crystal', minPitch: -0.4, maxPitch: 0.9 });
    if (m.wings && st.s >= (m.wings.minStage || 0)) {
      const wg = m.wings;
      P.wings(rb, { parent: 'body', at: [w * 0.5, bodyY + h * 0.55, -d * 0.6], style: wg.style, size: (wg.size || 0.7) * (0.6 + st.g * 0.5), color: m.colors[wg.color || 'accent'] || wg.color, membrane: m.colors[wg.membrane || 'membrane'], accent: m.colors[wg.accent || 'accent2'], glowC: m.colors.glow, tilt: 0.4, sweep: 0.8 });
    }
    return { height: bodyY + h + hs * 0.4, center: [0, bodyY, 0], headC };
  },

  // Coiled serpents / eels.
  serpent(rb, m, st) {
    const B = { r: 0.16, rise: 0.72, coil: 0.3, ...m.body };
    const baby = st.s === 0;
    const k = baby ? 0.8 : st.s === 2 ? 1.12 : 1;
    const r = B.r * k;
    rb.bone('body', 'root', [0, r, 0]);
    // coil on the ground
    const coilPts = [];
    for (let i = 0; i <= 10; i++) {
      const a = -Math.PI * 0.2 + (i / 10) * Math.PI * 1.7;
      const cr = B.coil * k * (1 - i * 0.02);
      coilPts.push(V3(Math.cos(a) * cr, r * 0.9, Math.sin(a) * cr - 0.05));
    }
    const tailTip = coilPts[0];
    const sk = skinPaint(m, [0, -1, 0], { threshold: 0.1 });
    const tailPts = [V3(tailTip.x + 0.05, r * 0.6, tailTip.z - 0.2), V3(tailTip.x + 0.18, r * 0.5, tailTip.z - 0.34)];
    const coilCurve = [tailPts[1], tailPts[0], ...coilPts];
    const cg = G.taperTube(coilCurve, (t) => r * (0.35 + Math.min(1, t * 2.5) * 0.65), 12, 24);
    rb.part(cg, 'body', sk.paint, sk.glow, sk.pat);
    // rising neck in two bones
    const last = coilPts[coilPts.length - 1];
    const n0 = [last.x, last.y, last.z];
    const n1 = [last.x * 0.3, r + B.rise * 0.5 * k, last.z * 0.5 + 0.05];
    const n2 = [0, r + B.rise * k, 0.12];
    rb.bone('neck', 'body', n0);
    rb.bone('neck2', 'neck', n1);
    const skN = skinPaint(m, [0, -0.2, 1], { threshold: 0.35 });
    const neckA = G.taperTube([n0, [n0[0] * 0.8, n0[1] + 0.1, n0[2] + 0.02], n1], r * 0.98, 14, 8, { capStart: false });
    rb.part(neckA, 'neck', skN.paint, skN.glow, skN.pat);
    const neckB = G.taperTube([n1, [n1[0] * 0.3, (n1[1] + n2[1]) / 2, 0.1], n2], (t) => r * (0.98 - t * 0.1), 14, 8, { capStart: false });
    rb.part(neckB, 'neck2', skN.paint, skN.glow, skN.pat);
    const hs = ((m.head && m.head.size) || 0.26) * (baby ? 1.15 : 1);
    const headC = [0, n2[1] + hs * 0.35, n2[2] + hs * 0.35];
    rb.bone('head', 'neck2', headC);
    const headE = { c: headC, r: [hs * 0.95, hs * 0.85, hs * 1.1] };
    const hp = skinPaint(m, [0, -1, 0.4], { threshold: 0.3 });
    rb.part(ellipsoidPart(headE, 26), 'head', hp.paint, hp.glow, hp.pat);
    let snoutE = null;
    if (m.head && m.head.snout) {
      snoutE = { c: [0, headC[1] - hs * 0.2, headC[2] + hs * 0.8], r: [hs * 0.55, hs * 0.38, hs * 0.5] };
      rb.part(ellipsoidPart(snoutE, 18), 'head', paints.form(m.colors.snout || m.colors.belly || m.colors.skin, 0.1, 0.08));
    }
    faceOn(rb, m, headE, st, { snoutE, eyePitch: snoutE ? 0.3 : 0.15 });
    headFeatures(rb, m, headE, st);
    // dorsal fins along the rising neck
    if (m.back) {
      const spine = [
        { p: [n0[0], n0[1] + r * 0.9, n0[2] - 0.02], n: [0.2, 1, -0.4] },
        { p: [n1[0], n1[1] + r * 0.2, n1[2] - r * 0.85], n: [0, 0.3, -1] },
        { p: [0, n2[1] - 0.05, n2[2] - r * 0.95], n: [0, 0.2, -1] },
      ];
      P.backFeature(rb, { bone: 'neck', spine, style: m.back.style, count: m.back.count || 4, size: (m.back.size || 0.5) * r * (1 + st.g * 0.6), color: m.colors[m.back.color || 'accent'] || m.back.color, glowC: m.colors.glow, accent: m.colors.accent2 || m.colors.accent });
    }
    if (m.whiskers) {
      for (const s of [1, -1]) {
        const base = snoutE ? [s * snoutE.r[0] * 0.8, snoutE.c[1], snoutE.c[2] + snoutE.r[2] * 0.4] : [s * hs * 0.7, headC[1] - hs * 0.3, headC[2] + hs * 0.6];
        const w = G.taperTube([base, [base[0] + s * 0.15, base[1] - 0.04, base[2] + 0.05], [base[0] + s * 0.3, base[1] - 0.14, base[2] + 0.02]], (t) => 0.015 * (1 - t * 0.7), 5, 6);
        rb.part(w, 'head', m.colors.accent);
      }
    }
    if (m.wings && st.s >= (m.wings.minStage || 0)) {
      const w = m.wings;
      P.wings(rb, { parent: 'neck2', at: [r * 0.7, n1[1] + 0.05, n1[2]], style: w.style, size: (w.size || 0.5) * (0.6 + st.g * 0.5), color: m.colors[w.color || 'accent'] || w.color, membrane: m.colors[w.membrane || 'membrane'], accent: m.colors[w.accent || 'accent2'], glowC: m.colors.glow, tilt: 0.5, sweep: 0.6 });
    }
    // tail tip decoration
    if (m.tailTip) {
      const out = tailPts[1];
      const dir = V3(0.4, 0.4, -1).normalize();
      if (m.tailTip === 'fin') {
        const g = G.extrudeOutline([[0, 0], [0.2, 0.05, 0.24, 0.24], [0, 0.12], [-0.24, 0.24, -0.2, 0.05, 0, 0]], 0.025, 0.01);
        rb.part(orient(g, out, dir), 'body', m.colors.accent, 0.1);
      } else if (m.tailTip === 'bolt') {
        const g = G.extrudeOutline([[-0.03, 0], [0.03, 0], [0.01, 0.08], [0.1, 0.07], [-0.03, 0.26], [0, 0.12], [-0.08, 0.13]], 0.04, 0.01);
        rb.part(orient(g, out, dir), 'body', m.colors.glow, 0.8);
      } else if (m.tailTip === 'rattle' || m.tailTip === 'crystal') {
        const g = G.flat(G.crystal(0.22, 0.05, 6));
        rb.part(orient(g, out, dir), 'body', m.colors.accent, 0.4);
      }
    }
    return { height: headC[1] + hs, center: [0, r + B.rise * 0.4, 0], headC };
  },

  // Floating spirits: orbs, jellies, ghosts, wisps.
  floater(rb, m, st) {
    const B = { r: 0.34, float: 0.35, shape: 'orb', tentacles: 0, arms: false, ...m.body };
    const baby = st.s === 0;
    const k = baby ? 0.85 : st.s === 2 ? 1.1 : 1;
    const r = B.r * k;
    const cy = B.float + r;
    rb.bone('body', 'root', [0, cy, 0]);
    rb.bone('head', 'body', [0, cy + r * 0.1, 0]);
    const sk = skinPaint(m, [0, -1, 0.3], { threshold: 0.35 });
    let headE;
    if (B.shape === 'jelly') {
      const bell = G.lathe([[0.001, r * 0.95], [r * 0.5, r * 0.88], [r * 0.85, r * 0.55], [r * 1.0, r * 0.1], [r * 0.95, -r * 0.2], [r * 0.7, -r * 0.18], [r * 0.4, -r * 0.1], [0.001, -r * 0.12]], 26);
      bell.translate(0, cy, 0);
      rb.part(bell, 'head', sk.paint, m.glowBody ? 0.25 : sk.glow);
      headE = { c: [0, cy + r * 0.2, 0], r: [r, r * 0.8, r] };
    } else if (B.shape === 'ghost') {
      const body = G.lathe([[0.001, r * 1.1], [r * 0.6, r * 1.0], [r * 0.95, r * 0.55], [r * 1.0, 0], [r * 0.85, -r * 0.5], [r * 0.5, -r * 0.9], [r * 0.2, -r * 1.2], [0.001, -r * 1.35]], 24);
      const pp = body.attributes.position;
      for (let i = 0; i < pp.count; i++) {
        const y = pp.getY(i);
        if (y < 0) {
          const a = Math.atan2(pp.getZ(i), pp.getX(i));
          pp.setX(i, pp.getX(i) + Math.sin(a * 3 + y * 6) * 0.03 * -y / r);
          pp.setZ(i, pp.getZ(i) - (-y / r) * 0.12);
        }
      }
      body.computeVertexNormals();
      body.translate(0, cy, 0);
      rb.part(body, 'head', sk.paint, m.glowBody ? 0.3 : sk.glow);
      headE = { c: [0, cy + r * 0.25, 0], r: [r * 0.98, r * 0.9, r * 0.98] };
    } else {
      headE = { c: [0, cy, 0], r: [r, r * 0.95, r * 0.96] };
      rb.part(ellipsoidPart(headE, 30), 'head', sk.paint, m.glowBody ? 0.25 : sk.glow);
    }
    faceOn(rb, m, headE, st, { eyePitch: B.shape === 'jelly' ? 0.05 : 0.12 });
    headFeatures(rb, m, headE, st);
    if (B.tentacles) {
      const n = B.tentacles;
      for (let i = 0; i < n; i++) {
        const a = (i / n) * Math.PI * 2 + 0.3;
        const bn = `tent${i % 4}`;
        const base = [Math.cos(a) * r * 0.6, cy - r * 0.1, Math.sin(a) * r * 0.6];
        if (!rb.has(bn)) rb.bone(bn, 'body', [0, cy - r * 0.15, 0]);
        const len = (B.tentLen || 0.45) * k;
        const pts = [base, [base[0] * 1.2, cy - len * 0.4, base[2] * 1.2], [base[0] * 0.9 + Math.cos(a + 1) * 0.06, cy - len * 0.8, base[2] * 0.9 + Math.sin(a + 1) * 0.06], [base[0] * 1.3, cy - len, base[2] * 1.3]];
        const tg = G.taperTube(pts, (t) => r * 0.14 * (1 - t * 0.8), 8, 10);
        rb.part(tg, bn, paints.gradientY(m.colors.accent || m.colors.skin, m.colors.skin, cy - len, cy), m.glowTent ? (x, y) => (y < cy - len * 0.6 ? 0.6 : 0.1) : 0);
      }
    }
    if (B.arms) {
      for (const [name, sx] of [['armL', 1], ['armR', -1]]) {
        const sh = [sx * r * 0.92, cy - r * 0.1, 0.05];
        rb.bone(name, 'body', sh);
        const hand = [sx * r * 1.3, cy - r * 0.35, 0.12];
        const arm = G.taperTube([sh, hand], (t) => r * 0.12 * (1 - t * 0.3), 8, 4);
        rb.part(arm, name, paints.form(m.colors.skin));
        const hg = G.sphere(r * 0.14, 10, 8);
        hg.translate(...hand);
        rb.part(hg, name, paints.form(m.colors.skin));
      }
    }
    if (B.wisp) {
      const pts = [[0, cy - r * 0.6, -r * 0.3], [0, cy - r * 1.0, -r * 0.6], [0.05, cy - r * 1.1, -r * 1.0], [0.1, cy - r * 0.9, -r * 1.3]];
      P.tail(rb, { parent: 'body', pts, radius: (t) => r * 0.45 * (1 - t * 0.9) + 0.01, color: m.colors.skin, tipColor: m.colors.accent, style: 'wisp', accent: m.colors.glow, size: 0.8 });
    }
    if (m.tail) {
      const t = m.tail;
      const len = t.len || 0.4;
      const base = [0, cy - r * 0.2, -r * 0.85];
      const pts = [base, [0, base[1] - 0.05, base[2] - len * 0.4], [0, base[1] + len * 0.2, base[2] - len * 0.75], [0, base[1] + len * 0.6, base[2] - len * 0.85]];
      P.tail(rb, { parent: 'body', pts, radius: t.r || 0.05, color: m.colors[t.color || 'skin'], tipColor: m.colors[t.tip || 'accent'] || t.tip, style: t.style, accent: m.colors[t.accent || 'accent'], glowC: m.colors.glow, size: t.size || 0.8 });
    }
    if (m.wings && st.s >= (m.wings.minStage || 0)) {
      const w = m.wings;
      P.wings(rb, { parent: 'body', at: [r * 0.6, cy + r * 0.25, -r * 0.4], style: w.style, size: (w.size || 0.5) * (0.6 + st.g * 0.5), color: m.colors[w.color || 'accent'] || w.color, membrane: m.colors[w.membrane || 'membrane'], accent: m.colors[w.accent || 'accent2'], glowC: m.colors.glow, tilt: w.tilt ?? 0.5, sweep: 0.7 });
    }
    if (m.orbit) {
      // orbiting shards/orbs around the body (animated via fxOrbit bone)
      rb.bone('fxOrbit', 'root', [0, cy, 0]);
      const n = m.orbit.count || 3;
      for (let i = 0; i < n; i++) {
        const a = (i / n) * Math.PI * 2;
        const R = r * (m.orbit.radius || 1.6);
        let g;
        if (m.orbit.shape === 'orb') g = G.sphere(r * 0.13, 10, 8);
        else if (m.orbit.shape === 'rock') g = G.flat(G.jitter(G.ico(r * 0.16, 0), 0.02, i));
        else g = G.flat(G.crystal(r * 0.45, r * 0.09, 5));
        g.translate(Math.cos(a) * R, Math.sin(a * 2) * r * 0.2, Math.sin(a) * R);
        g.translate(0, cy, 0);
        rb.part(g, 'fxOrbit', m.colors[m.orbit.color || 'glow'] || m.orbit.color, m.orbit.glow ?? 0.8);
      }
    }
    if (m.back && st.s >= (m.back.minStage || 0)) {
      const spine = [];
      for (let q = 0; q <= 3; q++) {
        const a = 1.35 - q * 0.35;
        spine.push({ p: [0, cy + Math.sin(a) * r * 0.97, -Math.cos(a) * r * 0.97], n: [0, Math.sin(a), -Math.cos(a)] });
      }
      P.backFeature(rb, { bone: 'head', spine, style: m.back.style, count: m.back.count || 4, size: (m.back.size || 0.4) * r * (0.7 + st.g * 0.5), color: m.colors[m.back.color || 'accent'] || m.back.color, glowC: m.colors.glow, accent: m.colors.accent2 || m.colors.accent });
    }
    return { height: cy + r * 1.05, center: [0, cy, 0], headC: headE.c, floating: true };
  },

  // Round birds and griffins.
  bird(rb, m, st) {
    const B = { r: 0.3, legLen: 0.16, ...m.body };
    const baby = st.s === 0;
    const k = baby ? 0.88 : st.s === 2 ? 1.08 : 1;
    const r = B.r * k;
    const legLen = B.legLen * (baby ? 0.8 : 1);
    const cy = legLen + r * 0.9;
    rb.bone('body', 'root', [0, cy, 0]);
    const sk = skinPaint(m, [0, -0.3, 1], { threshold: 0.2 });
    const body = G.ellipsoid(r, r * 0.95, r * 1.05, 26, 20);
    body.translate(0, cy, -0.02);
    rb.part(body, 'body', sk.paint, sk.glow, sk.pat);
    const hs = ((m.head && m.head.size) || 0.26) * (baby ? 1.12 : 1);
    const headC = [0, cy + r * 0.7 + hs * 0.2, r * 0.45];
    rb.bone('head', 'body', headC);
    const headE = { c: headC, r: [hs, hs * 0.95, hs * 0.95] };
    const hp = skinPaint(m, [0, -0.6, 1], { threshold: 0.5, noBelly: true });
    rb.part(ellipsoidPart(headE, 26), 'head', hp.paint, hp.glow, hp.pat);
    m.face = { mouth: 'beak', ...m.face };
    faceOn(rb, m, headE, st, { eyePitch: 0.18, eyeYaw: 0.5 });
    headFeatures(rb, m, headE, st);
    for (const [name, sx] of [['legL', 1], ['legR', -1]]) {
      const hip = [sx * r * 0.4, cy - r * 0.7, 0.02];
      rb.bone(name, 'root', hip);
      const leg = G.taperTube([hip, [hip[0], 0.05, 0.04]], r * 0.07, 6, 3);
      rb.part(leg, name, m.colors.beak || '#ffb13d');
      for (let q = -1; q <= 1; q++) {
        const toe = G.taperTube([[hip[0], 0.03, 0.04], [hip[0] + q * 0.07, 0.02, 0.14]], r * 0.05, 5, 3);
        rb.part(toe, name, m.colors.beak || '#ffb13d');
      }
    }
    const w = m.wings || { style: 'feather', size: 0.5 };
    P.wings(rb, { parent: 'body', at: [r * 0.75, cy + r * 0.25, -0.02], style: w.style || 'feather', size: (w.size || 0.5) * (0.6 + st.g * 0.55), color: m.colors[w.color || 'skin'] || w.color, accent: m.colors[w.accent || 'accent'], membrane: m.colors.membrane, glowC: m.colors.glow, tilt: w.tilt ?? 0.3, sweep: w.sweep ?? 0.8 });
    // tail feathers
    const t = m.tail || { style: 'feather' };
    const base = [0, cy - r * 0.1, -r * 0.95];
    const pts = [base, [0, base[1] + 0.03, base[2] - 0.08], [0, base[1] + 0.08, base[2] - 0.14], [0, base[1] + 0.12, base[2] - 0.18]];
    P.tail(rb, { parent: 'body', pts, radius: r * 0.12, color: m.colors.skin, tipColor: m.colors.skin, style: t.style || 'feather', accent: m.colors[t.accent || 'accent'], glowC: m.colors.glow, size: (t.size || 0.9) * (0.75 + st.g * 0.4) });
    return { height: headC[1] + hs, center: [0, cy, 0], headC };
  },

  // Beetles and moths.
  insect(rb, m, st) {
    const B = { r: 0.26, ...m.body };
    const baby = st.s === 0;
    const k = baby ? 0.85 : st.s === 2 ? 1.1 : 1;
    const r = B.r * k;
    const cy = r * 1.05 + 0.08;
    rb.bone('body', 'root', [0, cy, 0]);
    const sk = skinPaint(m, [0, -1, 0], { threshold: 0.3 });
    const thorax = G.ellipsoid(r * 0.8, r * 0.75, r * 0.7, 20, 16);
    thorax.translate(0, cy, r * 0.25);
    rb.part(thorax, 'body', sk.paint, sk.glow, sk.pat);
    const abd = G.ellipsoid(r, r * 0.85, r * 1.25, 24, 18);
    abd.translate(0, cy + r * 0.05, -r * 0.85);
    const shell = m.shell ? paints.form(m.colors.shell || m.colors.accent, 0.15, 0.1) : sk.paint;
    rb.part(abd, 'body', m.shellStripes ? paints.stripes(shell, m.colors.accent2 || '#222', 'z', 20, 0.25) : shell, m.shellGlow ? (x, y, z) => (Math.sin(z * 18) > 0.7 ? 0.8 : 0) : sk.glow);
    if (m.shell) {
      const line = G.box(0.012, r * 0.1, r * 2.3);
      line.translate(0, cy + r * 0.88, -r * 0.85);
      rb.part(line, 'body', C(m.colors.shell || m.colors.accent).offsetHSL(0, 0, -0.2));
    }
    const hs = ((m.head && m.head.size) || 0.2) * (baby ? 1.2 : 1);
    const headC = [0, cy + r * 0.2, r * 0.25 + r * 0.7 + hs * 0.5];
    rb.bone('head', 'body', headC);
    const headE = { c: headC, r: [hs, hs * 0.9, hs * 0.85] };
    rb.part(ellipsoidPart(headE, 22), 'head', paints.form(m.colors.skin));
    m.face = { eyes: 'compound', eyeSize: 0.45, eyeYaw: 0.62, eyePitch: 0.2, mouth: 'tiny', ...m.face };
    faceOn(rb, m, headE, st, { eyeDepth: 0.8 });
    headFeatures(rb, m, headE, st);
    // antennae
    for (const s of [1, -1]) {
      const b = [s * hs * 0.35, headC[1] + hs * 0.75, headC[2] + hs * 0.1];
      const pts = [b, [b[0] + s * 0.06, b[1] + 0.14, b[2] + 0.05], [b[0] + s * 0.14, b[1] + 0.22, b[2] + 0.02]];
      rb.bone(s > 0 ? 'earL' : 'earR', 'head', b);
      rb.part(G.taperTube(pts, 0.012, 5, 6), s > 0 ? 'earL' : 'earR', m.colors.skin);
      const tip = G.sphere(0.03, 8, 6);
      tip.translate(...pts[2]);
      rb.part(tip, s > 0 ? 'earL' : 'earR', m.colors.glow || m.colors.accent, m.antennaGlow ? 1 : 0);
    }
    // six legs
    const legNames = ['legFL', 'legFR', 'legML', 'legMR', 'legBL', 'legBR'];
    let li = 0;
    for (const z of [r * 0.35, 0, -r * 0.35]) {
      for (const s of [1, -1]) {
        const hip = [s * r * 0.55, cy - r * 0.35, z + r * 0.15];
        const name = legNames[li++];
        rb.bone(name, 'root', hip);
        const pts = [hip, [s * (r * 0.95), cy - r * 0.05, z + r * 0.2], [s * (r * 1.15), 0.03, z + r * 0.3]];
        rb.part(G.taperTube(pts, (t) => 0.028 * (1 - t * 0.4), 6, 6), name, m.colors.limb || m.colors.skin);
      }
    }
    if (m.wings && st.s >= (m.wings.minStage || 0)) {
      const w = m.wings;
      P.wings(rb, { parent: 'body', at: [r * 0.3, cy + r * 0.65, 0], style: w.style || 'insect', size: (w.size || 0.6) * (0.6 + st.g * 0.5), color: m.colors[w.color || 'membrane'] || w.color, accent: m.colors[w.accent || 'accent'], glowC: m.colors.glow, tilt: w.tilt ?? 0.4, sweep: 1.2 });
    }
    return { height: headC[1] + hs + 0.2, center: [0, cy, 0], headC };
  },

  // Turtles & tortoises with decorated shells.
  shell(rb, m, st) {
    const B = { r: 0.42, h: 0.3, legR: 0.1, ...m.body };
    const baby = st.s === 0;
    const k = baby ? 0.82 : st.s === 2 ? 1.12 : 1;
    const r = B.r * k, h = B.h * k;
    const cy = 0.16 * k;
    rb.bone('body', 'root', [0, cy, 0]);
    const shellC = m.colors.shell || m.colors.accent;
    const dome = G.lathe([[0.001, h * 1.18], [r * 0.45, h * 1.1], [r * 0.8, h * 0.8], [r * 1.0, h * 0.3], [r * 1.06, 0.03], [r * 0.95, -0.03], [0.001, -0.05]], 32, 0, Math.PI * 2);
    dome.scale(1, 1, 1.12);
    dome.translate(0, cy, 0);
    const seam = C(shellC).offsetHSL(0, 0.05, -0.2);
    const platePaint = paints.plates(paints.form(shellC, 0.1, 0.1), seam, 3.2 / k, 0.1, 5);
    const rimC = C(m.colors.rim || m.colors.belly || '#e8d8a8');
    const shellPaint = (x, y, z, nx, ny, nz) => {
      const base = platePaint(x, y, z, nx, ny, nz);
      if (y < cy + h * 0.16) base.lerp(rimC, 0.85);
      return base;
    };
    rb.part(dome, 'body', shellPaint, m.shellGlow ? (x, y, z) => (Math.sin(x * 16) * Math.sin(z * 14) + Math.sin((x + z) * 11) > 1.3 ? 0.9 : 0) : 0);
    const sk = skinPaint(m, [0, -1, 0.5], { threshold: 0.2 });
    for (const [name, sx, sz] of [['legFL', 1, 1], ['legFR', -1, 1], ['legBL', 1, -1], ['legBR', -1, -1]]) {
      const hip = [sx * r * 0.7, cy + 0.02, sz * r * 0.62];
      rb.bone(name, 'root', hip);
      const leg = G.ellipsoid(B.legR * 1.2 * k, B.legR * 1.4 * k, B.legR * 1.2 * k, 12, 10);
      leg.translate(hip[0] * 1.05, B.legR * 1.2 * k, hip[2] * 1.05);
      rb.part(leg, name, sk.paint);
    }
    const hs = ((m.head && m.head.size) || 0.2) * (baby ? 1.25 : 1) * k;
    const neckBase = [0, cy + h * 0.25, r * 1.0];
    const headC = [0, cy + h * 0.55 + hs * 0.5, r * 1.12 + hs * 0.6];
    rb.bone('neck', 'body', neckBase);
    rb.part(G.taperTube([neckBase, [0, (neckBase[1] + headC[1]) / 2, (neckBase[2] + headC[2]) / 2], [0, headC[1] - hs * 0.2, headC[2] - hs * 0.3]], hs * 0.5, 10, 6), 'neck', sk.paint);
    rb.bone('head', 'neck', headC);
    const headE = { c: headC, r: [hs, hs * 0.92, hs * 1.05] };
    rb.part(ellipsoidPart(headE, 24), 'head', skinPaint(m, [0, -0.6, 1], { threshold: 0.45 }).paint);
    faceOn(rb, m, headE, st, { eyePitch: 0.2, eyeYaw: 0.5 });
    headFeatures(rb, m, headE, st);
    // small tail
    const tl = G.cone(0.05 * k, 0.16 * k, 8);
    tl.rotateX(-Math.PI / 2 - 0.3);
    tl.translate(0, cy + 0.03, -r * 1.2);
    rb.part(tl, 'body', m.colors.skin);
    // shell decorations
    const top = [0, cy + h, 0];
    if (m.shellTop === 'volcano') {
      const v = G.lathe([[r * 0.35, 0], [r * 0.24, h * 0.55], [r * 0.14, h * 0.7], [r * 0.1, h * 0.6], [0.001, h * 0.55]], 14);
      v.translate(top[0], top[1] - 0.02, top[2]);
      rb.part(G.jitter(v, 0.01, 2), 'body', paints.gradientY(m.colors.rock || '#4a3a38', m.colors.rock || '#5a4442', top[1], top[1] + h * 0.7));
      P.flames(rb, 'body', h * 0.9 * (0.7 + st.g * 0.6), [top[0], top[1] + h * 0.62, top[2]], m.colors.glow, 3);
    } else if (m.shellTop === 'garden') {
      for (let q = 0; q < 4; q++) {
        const a = q * 1.7;
        const bush = G.jitter(G.ico(r * 0.2, 1), 0.02, q);
        bush.translate(Math.cos(a) * r * 0.35, top[1] - 0.02 + (q === 0 ? 0.04 : 0), Math.sin(a) * r * 0.35);
        rb.part(bush, 'body', paints.form(m.colors.leaf || '#6fcf4f', 0.12, 0.1));
      }
      const fl = G.sphere(r * 0.08, 8, 6);
      fl.translate(0.05, top[1] + r * 0.2, 0.05);
      rb.part(fl, 'body', m.colors.flower || '#ff8fb8', 0.2);
      if (st.s >= 1) {
        const tree = G.taperTube([[0, top[1], 0], [0.02, top[1] + r * 0.4, 0]], r * 0.05, 6, 3);
        rb.part(tree, 'body', m.colors.trunk || '#8b5a3c');
        const cb = G.jitter(G.ico(r * 0.28, 2), 0.02, 9);
        cb.translate(0.02, top[1] + r * 0.55, 0);
        rb.part(cb, 'body', paints.form(m.colors.leaf || '#6fcf4f', 0.15, 0.1));
      }
    } else if (m.shellTop === 'crystals' || m.shellTop === 'spikes') {
      const n = 3 + st.s * 2;
      for (let q = 0; q < n; q++) {
        const a = (q / n) * Math.PI * 2;
        const rr = q === 0 ? 0 : r * 0.42;
        const hh = (q === 0 ? 1.4 : 0.9) * r * (0.5 + st.g * 0.5);
        const g = m.shellTop === 'crystals' ? G.flat(G.crystal(hh, r * 0.12, 6)) : G.cone(r * 0.1, hh * 0.7, 8);
        g.rotateZ(Math.cos(a) * 0.3 * (q ? 1 : 0));
        g.rotateX(-Math.sin(a) * 0.3 * (q ? 1 : 0));
        const yy = cy + h * (q ? 0.8 : 1) - 0.03;
        g.translate(Math.cos(a) * rr, yy, Math.sin(a) * rr);
        rb.part(g, 'body', paints.form(m.colors.crystal || m.colors.accent2 || '#9fe3ff', 0.2, 0.1), m.shellTop === 'crystals' ? 0.3 : 0);
      }
    } else if (m.shellTop === 'lotus') {
      for (let q = 0; q < 8; q++) {
        const a = (q / 8) * Math.PI * 2;
        const pet = G.leafGeo(r * 0.5, r * 0.3, 0.02);
        G.bend(pet, -0.6, r * 0.5);
        pet.rotateX(-0.6);
        pet.rotateY(a);
        pet.translate(Math.sin(a) * r * 0.08, top[1] - 0.03, Math.cos(a) * r * 0.08);
        rb.part(pet, 'body', paints.gradientY(m.colors.petal || '#ffb3d9', '#ffffff', top[1], top[1] + r * 0.4));
      }
      const c = G.sphere(r * 0.1, 10, 8);
      c.translate(0, top[1] + r * 0.08, 0);
      rb.part(c, 'body', '#ffd23f', 0.4);
    }
    return { height: Math.max(headC[1] + hs, cy + h * 1.6), center: [0, cy + h * 0.5, 0], headC };
  },

  // Frogs, toads, axolotls.
  frog(rb, m, st) {
    const B = { w: 0.34, h: 0.26, d: 0.3, ...m.body };
    const baby = st.s === 0;
    const k = baby ? 0.85 : st.s === 2 ? 1.1 : 1;
    const w = B.w * k, h = B.h * k, d = B.d * k;
    const cy = h * 0.95;
    rb.bone('body', 'root', [0, cy, 0]);
    const sk = skinPaint(m, [0, -0.5, 1], { threshold: 0.25 });
    const body = G.ellipsoid(w, h, d, 26, 20);
    body.translate(0, cy, 0);
    rb.part(body, 'body', sk.paint, sk.glow, sk.pat);
    // head merged at the front-top
    const headC = [0, cy + h * 0.45, d * 0.45];
    rb.bone('head', 'body', headC);
    const headE = { c: headC, r: [w * 0.92, h * 0.78, d * 0.72] };
    rb.part(ellipsoidPart(headE, 26), 'head', skinPaint(m, [0, -0.4, 1], { threshold: 0.35 }).paint, sk.glow);
    // bulging eye mounts
    const f = m.face || {};
    const eyeYaw = f.eyeYaw ?? 0.5;
    if (f.eyeMounts !== false) {
      for (const s of [1, -1]) {
        const { p } = surf(headE, eyeYaw * s, 0.55, 0.78);
        const mount = G.sphere(w * 0.24, 14, 10);
        mount.translate(p.x, p.y, p.z);
        rb.part(mount, 'head', paints.form(m.colors.skin));
      }
    }
    const eyeHost = { c: [headC[0], headC[1] + h * 0.36, headC[2] - d * 0.02], r: [w * 0.8, h * 0.5, d * 0.62] };
    P.eyes(rb, { bone: 'head', E: eyeHost, yaw: eyeYaw, pitch: 0.55, depth: 0.95, size: w * 0.2 * (baby ? 1.1 : 1), iris: m.colors.eye, style: f.eyes || 'round', skin: m.colors.skin, glowC: m.colors.glow });
    P.mouth(rb, { bone: 'head', E: headE, pitch: -0.12, depth: 0.98, width: w * (f.mouthWidth || 0.9), style: f.mouth || 'smile', color: m.colors.mouth || '#3a1422' });
    if (f.cheeks) P.cheeks(rb, { bone: 'head', E: headE, size: w * 0.14, yaw: 0.8, pitch: 0.0, color: m.colors.cheek || '#ff8fa8' });
    headFeatures(rb, m, headE, st);
    // legs: big folded back legs, small front legs
    for (const [name, sx] of [['legBL', 1], ['legBR', -1]]) {
      const hip = [sx * w * 0.75, cy - h * 0.2, -d * 0.35];
      rb.bone(name, 'root', hip);
      const thigh = G.ellipsoid(w * 0.34, h * 0.42, d * 0.55, 16, 12);
      thigh.translate(hip[0], h * 0.45, hip[2] + 0.02);
      rb.part(thigh, name, sk.paint);
      const foot = G.ellipsoid(w * 0.26, 0.04, d * 0.42, 12, 6);
      foot.translate(hip[0] * 1.08, 0.04, hip[2] + d * 0.38);
      rb.part(foot, name, paints.form(m.colors.limb || m.colors.belly || m.colors.skin, 0.1, 0.1));
    }
    for (const [name, sx] of [['legFL', 1], ['legFR', -1]]) {
      const hip = [sx * w * 0.5, cy - h * 0.35, d * 0.6];
      rb.bone(name, 'root', hip);
      rb.part(G.taperTube([hip, [hip[0] * 1.1, 0.05, hip[2] + 0.04]], w * 0.08, 8, 3), name, legPaint(m));
      const hand = G.ellipsoid(w * 0.12, 0.035, w * 0.14, 10, 6);
      hand.translate(hip[0] * 1.1, 0.035, hip[2] + 0.08);
      rb.part(hand, name, paints.form(m.colors.limb || m.colors.belly || m.colors.skin));
    }
    if (m.gills) {
      for (const s of [1, -1]) {
        for (let q = 0; q < 3; q++) {
          const { p, n } = surf(headE, (1.35 + q * 0.12) * s, 0.35 - q * 0.3, 0.95);
          const g = G.leafGeo(w * (0.35 - q * 0.04), w * 0.14, 0.02);
          g.rotateZ(-0.6 * s);
          rb.part(orient(g, p, n.clone().lerp(V3(0, 1, -0.5), 0.3).normalize()), 'head', paints.gradientY(m.colors.accent, C(m.colors.accent).offsetHSL(0, 0, 0.15), p.y - 0.1, p.y + 0.2), 0.25);
        }
      }
    }
    if (m.back && st.s >= (m.back.minStage || 0)) {
      const spine = [];
      for (let q = 0; q <= 3; q++) {
        const a = 1.2 - q * 0.4;
        spine.push({ p: [0, cy + Math.sin(a) * h * 0.98, -Math.cos(a) * d * 0.9 + 0.05], n: [0, Math.sin(a), -Math.cos(a)] });
      }
      P.backFeature(rb, { bone: 'body', spine, style: m.back.style, count: m.back.count || 4, size: (m.back.size || 0.5) * h * (0.7 + st.g * 0.5), color: m.colors[m.back.color || 'accent'] || m.back.color, glowC: m.colors.glow, accent: m.colors.accent2 || m.colors.accent });
    }
    if (m.tail) {
      const t = m.tail;
      const base = [0, cy - h * 0.1, -d * 0.9];
      const len = t.len || 0.4;
      const pts = [base, [0, base[1] - 0.02, base[2] - len * 0.45], [0.04, base[1] + len * 0.05, base[2] - len * 0.8], [0.08, base[1] + len * 0.2, base[2] - len]];
      P.tail(rb, { parent: 'body', pts, radius: t.r || 0.07, color: m.colors.skin, tipColor: m.colors[t.tip || 'skin'], style: t.style || 'fin', accent: m.colors.accent, glowC: m.colors.glow, size: t.size || 0.9 });
    }
    return { height: cy + h * 1.3, center: [0, cy, 0], headC };
  },

  // Winged dragons with reptilian heads (epic+ rarity silhouettes).
  dragon(rb, m, st) {
    const baby = st.s === 0, adult = st.s === 2;
    const B = { width: 0.28, height: 0.28, length: 0.46, legLen: 0.3, legR: 0.09, pawR: 0.1, neck: 0.34, neckR: 0.13, ...m.body };
    const Hd = { size: 1, snout: 1, ...m.head };
    const k = baby ? 0.82 : adult ? 1.1 : 1;
    const w = B.width * k, h = B.height * k, L = B.length * k * (baby ? 0.85 : 1);
    const legLen = B.legLen * k * (baby ? 0.8 : 1);
    const bodyY = legLen + h * 0.7;
    rb.bone('body', 'root', [0, bodyY, 0]);
    const sk = skinPaint(m, [0, -1, 0.3], { threshold: 0.25 });
    // belly scales: horizontal bands on the underside
    const bellyC = C(m.colors.belly || m.colors.skin);
    const bandC = bellyC.clone().offsetHSL(0, 0, -0.12);
    const bodyPaint = (x, y, z, nx, ny, nz) => {
      const c = sk.paint(x, y, z, nx, ny, nz);
      if (ny < -0.35 && Math.sin(z * 55) > 0.55) c.lerp(bandC, 0.6);
      return c;
    };
    const bodyE = { c: [0, bodyY, 0], r: [w, h, L] };
    rb.part(ellipsoidPart(bodyE, 30), 'body', bodyPaint, sk.glow, sk.pat);
    const chest = { c: [0, bodyY + h * 0.18, L * 0.5], r: [w * 1.05, h * 1.08, L * 0.55] };
    rb.part(ellipsoidPart(chest, 26), 'body', bodyPaint, sk.glow, sk.pat);
    // legs (front slimmer, back with big thighs)
    for (const [name, sx, sz] of [['legFL', 1, 1], ['legFR', -1, 1], ['legBL', 1, -1], ['legBR', -1, -1]]) {
      const hip = [sx * w * 0.66, bodyY - h * 0.25, sz * L * 0.58];
      rb.bone(name, 'root', hip);
      const foot = [hip[0] * 1.08, B.pawR * 0.7, hip[2] + sz * 0.03];
      const knee = [hip[0] * 1.12, (hip[1] + foot[1]) * 0.55, hip[2] + (sz > 0 ? 0.05 : -0.09)];
      rb.part(G.taperTube([hip, knee, foot], (t) => B.legR * k * (1.2 - t * 0.4), 10, 8), name, legPaint(m));
      if (sz < 0) {
        const th = G.ellipsoid(B.legR * 2.0 * k, B.legR * 2.4 * k, B.legR * 2.3 * k, 14, 10);
        th.translate(hip[0] * 0.98, hip[1] - B.legR * 0.6, hip[2]);
        rb.part(th, name, bodyPaint, 0, sk.pat);
      } else {
        const sh = G.ellipsoid(B.legR * 1.5 * k, B.legR * 1.8 * k, B.legR * 1.6 * k, 12, 10);
        sh.translate(hip[0] * 0.98, hip[1], hip[2]);
        rb.part(sh, name, bodyPaint, 0, sk.pat);
      }
      paw(rb, name, [foot[0], 0, foot[2]], B.pawR * k, m, 'claw');
    }
    // S-curved neck
    const neckLen = B.neck * k * (baby ? 0.45 : 1);
    const nb = [0, bodyY + h * 0.45, L * 0.78];
    const nm = [0, nb[1] + neckLen * 0.62, nb[2] + neckLen * 0.12];
    const ne = [0, nm[1] + neckLen * 0.4, nm[2] + neckLen * 0.3];
    rb.bone('neck', 'body', nb);
    rb.bone('neck2', 'neck', nm);
    const nr = B.neckR * k;
    const skN = skinPaint(m, [0, -0.2, 1], { threshold: 0.3 });
    rb.part(G.taperTube([nb, [0, (nb[1] + nm[1]) / 2, nb[2] + 0.02], nm], (t) => nr * (1.25 - t * 0.2), 14, 8), 'neck', skN.paint, skN.glow, skN.pat);
    rb.part(G.taperTube([nm, [0, (nm[1] + ne[1]) / 2, (nm[2] + ne[2]) / 2 - 0.01], ne], (t) => nr * (1.05 - t * 0.2), 14, 8, { capStart: false }), 'neck2', skN.paint, skN.glow, skN.pat);
    // head: cranium + long snout + jaw
    const hs = (baby ? 1.55 : adult ? 1.2 : 1.25) * Hd.size * k;
    const snoutLen = (baby ? 0.55 : 1) * Hd.snout;
    const hc = [0, ne[1] + 0.07 * hs, ne[2] + 0.05 * hs];
    rb.bone('head', 'neck2', hc);
    const cran = { c: hc, r: [0.16 * hs, 0.145 * hs, 0.16 * hs] };
    const hp = skinPaint(m, [0, -0.7, 0.7], { threshold: 0.4 });
    rb.part(ellipsoidPart(cran, 26), 'head', hp.paint, hp.glow, hp.pat);
    const snout = { c: [0, hc[1] - 0.03 * hs, hc[2] + (0.13 + 0.08 * snoutLen) * hs], r: [0.105 * hs, 0.085 * hs, (0.1 + 0.1 * snoutLen) * hs] };
    rb.part(ellipsoidPart(snout, 22), 'head', paints.belly(m.colors.skin, m.colors.snout || m.colors.belly || m.colors.skin, { dir: [0, -1, 0.2], threshold: 0.3 }));
    const jawPivot = [0, hc[1] - 0.06 * hs, hc[2] + 0.02 * hs];
    rb.bone('jaw', 'head', jawPivot);
    const jaw = { c: [0, hc[1] - 0.095 * hs, hc[2] + (0.1 + 0.07 * snoutLen) * hs], r: [0.085 * hs, 0.045 * hs, (0.09 + 0.08 * snoutLen) * hs] };
    rb.part(ellipsoidPart(jaw, 18), 'jaw', paints.form(m.colors.belly || m.colors.skin, 0.05, 0.1));
    const mouthIn = { c: [0, hc[1] - 0.075 * hs, hc[2] + (0.12 + 0.07 * snoutLen) * hs], r: [0.08 * hs, 0.03 * hs, (0.085 + 0.075 * snoutLen) * hs] };
    rb.part(ellipsoidPart(mouthIn, 14), 'jaw', m.colors.mouth || '#4a1420');
    // teeth
    if (!baby) {
      for (const sx of [1, -1]) {
        for (let q = 0; q < 3; q++) {
          const tz = snout.c[2] + snout.r[2] * (0.55 - q * 0.35);
          const tt = G.cone(0.012 * hs, 0.04 * hs, 5);
          tt.rotateX(Math.PI);
          tt.translate(sx * snout.r[0] * 0.72, snout.c[1] - snout.r[1] * 0.78, tz);
          rb.part(tt, 'head', '#fffaf0');
        }
      }
    }
    // nostrils
    for (const sx of [1, -1]) {
      const n = G.ellipsoid(0.018 * hs, 0.012 * hs, 0.02 * hs, 8, 6);
      n.translate(sx * 0.04 * hs, snout.c[1] + snout.r[1] * 0.62, snout.c[2] + snout.r[2] * 0.72);
      rb.part(n, 'head', '#2a1418');
    }
    // eyes on the cranium sides
    const f = m.face || {};
    P.eyes(rb, {
      bone: 'head', E: cran, yaw: baby ? 0.5 : 0.62, pitch: baby ? 0.12 : 0.16, depth: 0.86,
      size: (baby ? 0.085 : 0.066) * hs * (f.eyeScale || 1), iris: m.colors.eye, style: baby ? 'round' : f.eyes || 'slit', skin: m.colors.skin,
      glowC: m.colors.eyeGlow || m.colors.glow, brow: null,
    });
    // brow ridges
    if (!baby) {
      for (const sx of [1, -1]) {
        const { p, n } = surf(cran, 0.5 * sx, 0.42, 0.95);
        const br = G.ellipsoid(0.07 * hs, 0.028 * hs, 0.05 * hs, 12, 8);
        br.rotateZ(-0.35 * sx);
        rb.part(orient(br, p, n, null, new THREE.Vector3(0, 0, 1)), 'head', paints.form(m.colors.brow || m.colors.accent || m.colors.skin, 0.1, 0.1));
      }
    }
    // horns swept back
    const hornC = m.colors[(m.horns && m.horns.color) || 'horn'] || m.colors.accent || '#f3ead8';
    const hornTip = m.horns && m.horns.tip ? m.colors[m.horns.tip] || m.horns.tip : C(hornC).offsetHSL(0, -0.1, 0.15).getStyle();
    const hornN = (m.horns && m.horns.count) || 2;
    const hornSize = ((m.horns && m.horns.size) || 1) * hs * (baby ? 0.45 : adult ? 1.25 : 1);
    for (const sx of [1, -1]) {
      const base = [sx * 0.08 * hs, hc[1] + 0.1 * hs, hc[2] - 0.06 * hs];
      const g = G.horn(0.3 * hornSize, 0.045 * hornSize, -1.2, 12, 8, 0.1);
      g.rotateX(-0.9);
      g.rotateZ(-0.35 * sx);
      g.translate(...base);
      rb.part(g, 'head', paints.tip(hornC, hornTip, base, 0.3 * hornSize), m.horns && m.horns.glow ? (x, y, z) => (Math.hypot(x - base[0], y - base[1], z - base[2]) > 0.15 * hornSize ? m.horns.glow : 0) : 0);
      if (hornN >= 4 && !baby) {
        const b2 = [sx * 0.12 * hs, hc[1] + 0.02 * hs, hc[2] - 0.1 * hs];
        const g2 = G.horn(0.18 * hornSize, 0.03 * hornSize, -0.8, 10, 6, 0.1);
        g2.rotateX(-1.3);
        g2.rotateZ(-0.7 * sx);
        g2.translate(...b2);
        rb.part(g2, 'head', paints.tip(hornC, hornTip, b2, 0.18 * hornSize));
      }
      // cheek frill
      const fr = G.cone(0.03 * hs, 0.12 * hs, 6);
      fr.rotateX(-Math.PI / 2 - 0.3);
      fr.rotateY(0.6 * sx);
      fr.translate(sx * 0.12 * hs, hc[1] - 0.05 * hs, hc[2] - 0.08 * hs);
      rb.part(fr, 'head', m.colors.accent || hornC);
    }
    if (m.crown && st.s >= (m.crown.minStage || 0)) P.crown(rb, { bone: 'head', at: [0, hc[1] + 0.13 * hs, hc[2] - 0.02], radius: 0.07 * hs, color: m.colors.crown || '#ffd23f', gem: m.colors.gem || '#ff4f7b' });
    if (m.headFlames && st.s >= (m.headFlames.minStage || 0)) P.flames(rb, 'head', 0.16 * hs, [0, hc[1] + 0.12 * hs, hc[2] - 0.04 * hs], m.colors.glow, 3);
    // tail
    const t = m.tail || {};
    const tl = (t.len || 1) * k * (baby ? 0.6 : 1);
    const tb = [0, bodyY + 0.02, -L * 0.9];
    const pts = [tb, [0, bodyY - 0.06, tb[2] - tl * 0.35], [0.04, bodyY - 0.02, tb[2] - tl * 0.7], [0.1, bodyY + 0.1, tb[2] - tl * 0.95]];
    P.tail(rb, { parent: 'body', pts, radius: (tt) => (t.r || 0.11) * k * (1 - tt * 0.8) + 0.008, color: m.colors.skin, tipColor: m.colors[t.tip || 'skin'] || t.tip, style: t.style || 'spike', accent: m.colors[t.accent || 'accent'], glowC: m.colors.glow, size: (t.size || 1.1) * (0.8 + st.g * 0.35), spikes: baby ? 0 : t.spikes ?? 3, spikeColor: m.colors[(m.back && m.back.color) || 'accent'] });
    // back spikes along neck + spine
    const back = m.back || { style: 'spikes' };
    if (!baby || back.style !== 'spikes') {
      const spine = [
        { p: [0, ne[1] - 0.02, ne[2] - nr * 0.9], n: [0, 0.4, -1] },
        { p: [0, nm[1] + 0.02, nm[2] - nr * 1.1], n: [0, 0.6, -1] },
        { p: [0, bodyY + h * 1.0, L * 0.35], n: [0, 1, -0.1] },
        { p: [0, bodyY + h * 0.98, -L * 0.2], n: [0, 1, 0] },
        { p: [0, bodyY + h * 0.8, -L * 0.75], n: [0, 1, 0.2] },
      ];
      P.backFeature(rb, { bone: 'body', spine, style: back.style, count: back.count || (adult ? 8 : 6), size: (back.size || 0.5) * h * (0.6 + st.g * 0.5), color: m.colors[back.color || 'accent'] || back.color, glowC: m.colors.glow, accent: m.colors.accent2 || m.colors.accent });
    }
    // wings
    const wg = m.wings || { style: 'dragon', size: 1 };
    if (wg.style !== 'none') {
      P.wings(rb, { parent: 'body', at: [w * 0.5, bodyY + h * 0.7, L * 0.25], style: wg.style || 'dragon', size: (wg.size || 1) * k * (baby ? 0.42 : adult ? 1.12 : 0.95), color: m.colors[wg.color || 'skin'] || wg.color, membrane: m.colors[wg.membrane || 'membrane'], accent: m.colors[wg.accent || 'accent'], glowC: m.colors.glow, tilt: wg.tilt ?? 0.55, sweep: wg.sweep ?? 0.7 });
    }
    if (m.mane && st.s >= (m.mane.minStage || 0)) mane(rb, m, { c: [0, ne[1] - 0.05, ne[2] - 0.05], r: [nr * 1.3, nr * 1.3, nr * 1.3] }, st);
    return { height: Math.max(hc[1] + 0.2 * hs + (adult ? 0.15 : 0.1), bodyY + h + 0.3), center: [0, bodyY, 0], headC: hc };
  },

  // Octopus / kraken.
  kraken(rb, m, st) {
    const B = { r: 0.34, tent: 8, ...m.body };
    const baby = st.s === 0;
    const k = baby ? 0.85 : st.s === 2 ? 1.12 : 1;
    const r = B.r * k;
    const cy = r * 0.95 + 0.12;
    rb.bone('body', 'root', [0, cy, 0]);
    rb.bone('head', 'body', [0, cy + r * 0.2, 0]);
    const sk = skinPaint(m, [0, -0.3, 1], { threshold: 0.3 });
    const mantle = G.lathe([[0.001, r * 1.55], [r * 0.45, r * 1.5], [r * 0.8, r * 1.2], [r * 0.98, r * 0.6], [r * 0.95, 0.05], [r * 0.7, -r * 0.3], [0.001, -r * 0.35]], 26);
    mantle.translate(0, cy - r * 0.2, -0.04);
    rb.part(mantle, 'head', sk.paint, sk.glow, sk.pat);
    const headE = { c: [0, cy + r * 0.05, 0.02], r: [r * 0.92, r * 0.8, r * 0.9] };
    faceOn(rb, m, headE, st, { eyePitch: 0.2 });
    headFeatures(rb, m, headE, st);
    const n = B.tent;
    for (let i = 0; i < n; i++) {
      const a = (i / n) * Math.PI * 2 + 0.2;
      const bn = `tent${i % 4}`;
      if (!rb.has(bn)) rb.bone(bn, 'body', [0, cy - r * 0.3, 0]);
      const base = [Math.cos(a) * r * 0.5, cy - r * 0.35, Math.sin(a) * r * 0.5];
      const L = (B.tentLen || 0.7) * k;
      const pts = [base, [Math.cos(a) * r * 0.9, 0.08, Math.sin(a) * r * 0.9], [Math.cos(a) * (r + L * 0.55), 0.05, Math.sin(a) * (r + L * 0.55)], [Math.cos(a + 0.4) * (r + L * 0.75), 0.18, Math.sin(a + 0.4) * (r + L * 0.75)], [Math.cos(a + 0.8) * (r + L * 0.65), 0.28, Math.sin(a + 0.8) * (r + L * 0.65)]];
      const tg = G.taperTube(pts, (t) => r * 0.2 * (1 - t * 0.85) + 0.008, 10, 14);
      rb.part(tg, bn, (x, y, z, nx, ny) => (ny < -0.3 ? C(m.colors.belly || m.colors.accent) : C(m.colors.skin).offsetHSL(0, 0, ny * 0.06)), m.glowTent ? (x, y, z, nx, ny) => (ny < -0.3 ? 0.4 : 0) : 0);
    }
    if (m.back) {
      const spine = [];
      for (let q = 0; q <= 3; q++) spine.push({ p: [0, cy + r * (1.25 - q * 0.25), -r * (0.3 + q * 0.18)], n: [0, 1 - q * 0.2, -0.6] });
      P.backFeature(rb, { bone: 'head', spine, style: m.back.style, count: m.back.count || 4, size: (m.back.size || 0.4) * r * (0.7 + st.g * 0.5), color: m.colors[m.back.color || 'accent'] || m.back.color, glowC: m.colors.glow, accent: m.colors.accent2 || m.colors.accent });
    }
    return { height: cy + r * 1.5, center: [0, cy, 0], headC: headE.c };
  },

  // Crabs and crawlers with big claws.
  crab(rb, m, st) {
    const B = { w: 0.4, h: 0.2, d: 0.3, ...m.body };
    const baby = st.s === 0;
    const k = baby ? 0.85 : st.s === 2 ? 1.1 : 1;
    const w = B.w * k, h = B.h * k, d = B.d * k;
    const cy = 0.2 * k + h * 0.6;
    rb.bone('body', 'root', [0, cy, 0]);
    rb.bone('head', 'body', [0, cy + h * 0.5, d * 0.6]);
    const sk = skinPaint(m, [0, -1, 0.3], { threshold: 0.2 });
    const shell = G.ellipsoid(w, h, d, 24, 16);
    const pp = shell.attributes.position;
    for (let i = 0; i < pp.count; i++) if (pp.getY(i) > 0) pp.setY(i, pp.getY(i) * (1 + Math.cos(pp.getX(i) * 4) * 0.12));
    shell.computeVertexNormals();
    shell.translate(0, cy, 0);
    rb.part(shell, 'body', sk.paint, sk.glow, sk.pat);
    // eye stalks
    const eyeE = { c: [0, cy + h * 1.35, d * 0.55], r: [w * 0.4, h * 0.5, d * 0.35] };
    for (const s of [1, -1]) {
      const b = [s * w * 0.25, cy + h * 0.6, d * 0.55];
      const tip = [s * w * 0.3, cy + h * 1.35, d * 0.6];
      rb.part(G.taperTube([b, tip], w * 0.05, 6, 3), 'head', m.colors.skin);
    }
    P.eyes(rb, { bone: 'head', E: eyeE, yaw: 0.72, pitch: 0.1, depth: 0.9, size: w * 0.16, iris: m.colors.eye, style: (m.face && m.face.eyes) || 'round', skin: m.colors.skin });
    P.mouth(rb, { bone: 'head', E: { c: [0, cy, d * 0.1], r: [w, h, d] }, pitch: -0.05, depth: 1.0, width: w * 0.35, style: (m.face && m.face.mouth) || 'smile', color: m.colors.mouth || '#3a1422' });
    // claws
    for (const [name, sx] of [['armL', 1], ['armR', -1]]) {
      const sh = [sx * w * 0.8, cy - h * 0.1, d * 0.45];
      rb.bone(name, 'body', sh);
      const el = [sx * w * 1.15, cy + h * 0.2, d * 0.9];
      rb.part(G.taperTube([sh, el], w * 0.09, 8, 4), name, sk.paint);
      const cs = w * 0.32 * (0.8 + st.g * 0.4);
      const claw = G.ellipsoid(cs * 0.6, cs * 0.45, cs, 14, 10);
      claw.translate(el[0], el[1], el[2] + cs * 0.6);
      rb.part(claw, name, paints.form(m.colors.claw || m.colors.accent, 0.12, 0.12));
      const pin = G.cone(cs * 0.25, cs * 0.9, 8);
      pin.rotateX(Math.PI / 2 - 0.3);
      pin.translate(el[0], el[1] + cs * 0.35, el[2] + cs * 1.2);
      rb.part(pin, name, paints.form(m.colors.claw || m.colors.accent, 0.12, 0.12));
    }
    const legNames = ['legFL', 'legFR', 'legML', 'legMR', 'legBL', 'legBR'];
    let li = 0;
    for (const z of [d * 0.2, -d * 0.15, -d * 0.5]) {
      for (const s of [1, -1]) {
        const hip = [s * w * 0.8, cy - h * 0.3, z];
        const name = legNames[li++];
        rb.bone(name, 'root', hip);
        const pts = [hip, [s * w * 1.25, cy + h * 0.1, z - 0.02], [s * w * 1.4, 0.02, z - 0.05]];
        rb.part(G.taperTube(pts, (t) => w * 0.06 * (1 - t * 0.6), 6, 6), name, sk.paint);
      }
    }
    if (m.back) {
      const spine = [];
      for (let q = 0; q <= 3; q++) spine.push({ p: [0, cy + h * 0.95, d * (0.4 - q * 0.3)], n: [0, 1, 0] });
      P.backFeature(rb, { bone: 'body', spine, style: m.back.style, count: m.back.count || 4, size: (m.back.size || 0.5) * h * (0.8 + st.g * 0.5), color: m.colors[m.back.color || 'accent'] || m.back.color, glowC: m.colors.glow, accent: m.colors.accent2 || m.colors.accent });
    }
    return { height: cy + h * 2, center: [0, cy, 0], headC: [0, cy + h, d * 0.6] };
  },

  // Floating sky whales.
  whale(rb, m, st) {
    const B = { r: 0.36, len: 0.8, float: 0.5, ...m.body };
    const baby = st.s === 0;
    const k = baby ? 0.8 : st.s === 2 ? 1.12 : 1;
    const r = B.r * k, L = B.len * k;
    const cy = B.float + r;
    rb.bone('body', 'root', [0, cy, 0]);
    rb.bone('head', 'body', [0, cy, L * 0.3]);
    const sk = skinPaint(m, [0, -1, 0.1], { threshold: 0.0 });
    const prof = [];
    for (let i = 0; i <= 16; i++) {
      const t = i / 16;
      prof.push([Math.max(0.001, r * Math.sin(Math.PI * Math.pow(t, 0.75)) * (1 - t * 0.35)), (t - 0.5) * L * 2]);
    }
    const body = G.lathe(prof, 26);
    body.rotateX(-Math.PI / 2);
    body.scale(1, 0.92, 1);
    body.translate(0, cy, 0);
    rb.part(body, 'head', m.bellyStripes ? paints.stripes(sk.paint, m.colors.belly, 'x', 40, 0.4, false) : sk.paint, sk.glow, sk.pat);
    const headE = { c: [0, cy + r * 0.05, L * 0.35], r: [r * 0.95, r * 0.85, L * 0.6] };
    faceOn(rb, m, headE, st, { eyePitch: 0.05, eyeYaw: 0.75, eyeDepth: 0.9 });
    headFeatures(rb, m, headE, st);
    const tailBase = [0, cy + r * 0.05, -L * 0.95];
    const pts = [tailBase, [0, cy + r * 0.12, -L * 1.2], [0, cy + r * 0.2, -L * 1.4], [0, cy + r * 0.25, -L * 1.5]];
    P.tail(rb, { parent: 'body', pts, radius: r * 0.28, color: m.colors.skin, style: 'fin', accent: m.colors.accent, size: r * 3.2 });
    for (const [name, sx] of [['wingL', 1], ['wingR', -1]]) {
      const at = [sx * r * 0.85, cy - r * 0.3, L * 0.15];
      rb.bone(name, 'body', at);
      const fin = G.leafGeo(r * 1.1, r * 0.5, 0.04);
      fin.rotateZ(-Math.PI / 2 * sx - 0.3 * sx);
      fin.rotateY(0.4 * sx);
      fin.translate(...at);
      rb.part(sx < 0 ? fin : fin, name, paints.form(m.colors.accent, 0.12, 0.1), 0.1);
    }
    if (m.back) {
      const spine = [];
      for (let q = 0; q <= 4; q++) spine.push({ p: [0, cy + r * 0.92, L * (0.4 - q * 0.3)], n: [0, 1, 0] });
      P.backFeature(rb, { bone: 'head', spine, style: m.back.style, count: m.back.count || 5, size: (m.back.size || 0.4) * r * (0.7 + st.g * 0.5), color: m.colors[m.back.color || 'accent'] || m.back.color, glowC: m.colors.glow, accent: m.colors.accent2 || m.colors.accent });
    }
    return { height: cy + r * 1.2, center: [0, cy, 0], headC: headE.c, floating: true };
  },
};

function mane(rb, m, headE, st) {
  const mm = m.mane;
  const n = mm.count || 12;
  const color = m.colors[mm.color || 'accent'] || mm.color;
  for (let i = 0; i < n; i++) {
    const t = i / n;
    const yaw = (t - 0.5) * Math.PI * 1.7 + Math.PI;
    for (const pitchOff of [0.1, 0.6]) {
      const { p, n: nn } = surf(headE, yaw, pitchOff - 0.15, 0.82);
      const dir = nn.clone().add(V3(0, 0.25, -0.35)).normalize();
      if (mm.style === 'flame') {
        const out = [];
        P.addFlameCluster(out, headE.r[0] * 0.7, [0, 0, 0], m.colors.glow, 1);
        for (const [g, pc, gl] of out) rb.part(orient(g, p, dir), 'head', pc, gl);
      } else if (mm.style === 'leaf') {
        const g = G.leafGeo(headE.r[0] * 0.75, headE.r[0] * 0.4, 0.02);
        rb.part(orient(g, p, dir), 'head', paints.form(color, 0.1, 0.1));
      } else if (mm.style === 'crystal') {
        const g = G.flat(G.crystal(headE.r[0] * 0.8, headE.r[0] * 0.12, 5));
        rb.part(orient(g, p, dir), 'head', paints.form(color, 0.2, 0.1), 0.3);
      } else {
        const g = G.cone(headE.r[0] * 0.22, headE.r[0] * 0.9, 8);
        g.translate(0, headE.r[0] * 0.3, 0);
        rb.part(orient(g, p, dir), 'head', paints.form(color, 0.12, 0.12));
      }
    }
  }
}
