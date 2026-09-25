import * as THREE from 'three';
import { createNoise2D } from '../../core/noise.js';
import { islandShape } from '../../core/islandShape.js';
import { smoothstep, clamp } from '../../core/math.js';
import { sharedEnvMaterial } from '../materials.js';
import { theme as getTheme } from './themes.js';
import * as G from '../geom.js';

const _a = new THREE.Color();
const _b = new THREE.Color();

// Builds a floating island: flat grassy top with a rounded grass lip, faceted
// layered cliffs, a tapering rocky underside, hanging roots and cliff rocks.
export function buildIslandTerrain({
  seed = 1,
  radius = 11,
  themeName = 'verdant',
  depthScale = 1,
  paths = [],
  lowDetail = false,
  shapeAmp = 1,
}) {
  const T = getTheme(themeName);
  const shape = islandShape(seed, radius, shapeAmp);
  const { R, inside, rng } = shape;
  const noise = createNoise2D(seed * 7 + 3);

  const group = new THREE.Group();
  group.name = 'island';

  const grassA = new THREE.Color(T.grass[0]);
  const grassB = new THREE.Color(T.grass[1]);
  const grassC = new THREE.Color(T.grass[2]);
  const patch = new THREE.Color(T.grassPatch);
  const rim = new THREE.Color(T.rim);
  const dirt = new THREE.Color(T.dirt);
  const pathC = new THREE.Color(T.path);

  const distToPaths = (x, z) => {
    let best = Infinity;
    for (const p of paths) {
      const pts = p.points;
      for (let i = 0; i < pts.length - 1; i++) {
        const [ax, az] = pts[i], [bx, bz] = pts[i + 1];
        const dx = bx - ax, dz = bz - az;
        const l2 = dx * dx + dz * dz || 1;
        const t = clamp(((x - ax) * dx + (z - az) * dz) / l2, 0, 1);
        const d = Math.hypot(x - (ax + dx * t), z - (az + dz * t)) - (p.width || 0.8) * 0.5;
        if (d < best) best = d;
      }
    }
    return best;
  };

  const grassColor = (x, z, f) => {
    const n1 = noise.fbm(x * 0.09, z * 0.09, 3) * 0.5 + 0.5;
    const n2 = noise(x * 0.35 + 10, z * 0.35 - 4) * 0.5 + 0.5;
    _a.copy(grassA).lerp(grassB, smoothstep(0.35, 0.75, n1));
    _a.lerp(grassC, smoothstep(0.55, 0.95, 1 - n2) * 0.35);
    const pn = noise(x * 0.18 - 30, z * 0.18 + 12);
    if (pn > 0.35) _a.lerp(patch, smoothstep(0.35, 0.6, pn) * 0.45);
    // darken toward the rim (fake AO)
    _a.lerp(rim, smoothstep(0.88, 1.0, f) * 0.35);
    if (paths.length) {
      const d = distToPaths(x, z) + noise(x * 1.3, z * 1.3) * 0.12;
      if (d < 0.12) _a.lerp(pathC, smoothstep(0.08, -0.06, d));
    }
    return _a;
  };

  // ---------- TOP SURFACE ----------
  const NS = lowDetail ? 56 : 128;
  const NR = lowDetail ? 8 : 22;
  const pos = [];
  const colr = [];
  const idx = [];
  const pushV = (x, y, z, c) => {
    pos.push(x, y, z);
    colr.push(c.r, c.g, c.b);
    return pos.length / 3 - 1;
  };
  pushV(0, 0, 0, grassColor(0, 0, 0));
  const ringStart = [];
  // interior rings (flat)
  for (let i = 1; i <= NR; i++) {
    const f = Math.pow(i / NR, 0.85);
    ringStart.push(pos.length / 3);
    for (let j = 0; j < NS; j++) {
      const th = (j / NS) * Math.PI * 2;
      const r = f * R(th);
      const x = Math.cos(th) * r, z = Math.sin(th) * r;
      pushV(x, 0, z, grassColor(x, z, f));
    }
  }
  // rounded lip rings
  const lip = [
    { dr: 0.16, y: -0.07, c: (x, z) => grassColor(x, z, 1).clone().lerp(rim, 0.25) },
    { dr: 0.28, y: -0.24, c: () => _b.copy(rim) },
    { dr: 0.3, y: -0.42, c: () => _b.copy(rim).lerp(dirt, 0.55) },
    { dr: 0.22, y: -0.58, c: () => _b.copy(dirt) },
    { dr: 0.08, y: -0.66, c: () => _b.copy(dirt).multiplyScalar(0.8) },
  ];
  for (const L of lip) {
    ringStart.push(pos.length / 3);
    for (let j = 0; j < NS; j++) {
      const th = (j / NS) * Math.PI * 2;
      const wob = noise(Math.cos(th) * 3 + 5, Math.sin(th) * 3) * 0.06;
      const r = R(th) + L.dr + wob;
      const x = Math.cos(th) * r, z = Math.sin(th) * r;
      pushV(x, L.y + wob * 0.5, z, L.c(x, z));
    }
  }
  // center fan
  for (let j = 0; j < NS; j++) {
    const a = ringStart[0] + j;
    const b = ringStart[0] + ((j + 1) % NS);
    idx.push(0, b, a);
  }
  for (let r = 0; r < ringStart.length - 1; r++) {
    const s0 = ringStart[r], s1 = ringStart[r + 1];
    for (let j = 0; j < NS; j++) {
      const a = s0 + j, b = s0 + ((j + 1) % NS);
      const c = s1 + j, d = s1 + ((j + 1) % NS);
      idx.push(a, d, c, a, b, d);
    }
  }
  const topGeo = new THREE.BufferGeometry();
  topGeo.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  topGeo.setAttribute('color', new THREE.Float32BufferAttribute(colr, 3));
  topGeo.setIndex(idx);
  topGeo.computeVertexNormals();
  // force interior normals straight up for perfectly even lighting
  const nrm = topGeo.attributes.normal;
  const interiorCount = 1 + NR * NS;
  for (let i = 0; i < interiorCount; i++) nrm.setXYZ(i, 0, 1, 0);
  const top = new THREE.Mesh(topGeo, sharedEnvMaterial(false));
  top.receiveShadow = true;
  top.name = 'ground';
  group.add(top);

  // ---------- CLIFFS ----------
  const strata = T.strata.map((c) => new THREE.Color(c));
  const NC = lowDetail ? 28 : 60;
  const levels = [
    { y: -0.5, s: 0.995 },
    { y: -1.15, s: 1.02 },
    { y: -1.8, s: 0.985 },
    { y: -2.5, s: 1.005 },
    { y: -3.1, s: 0.95 },
    { y: -3.6, s: 0.88 },
  ].map((l) => ({ y: l.y * depthScale, s: l.s }));
  const cp = [];
  for (let li = 0; li < levels.length; li++) {
    const L = levels[li];
    for (let j = 0; j < NC; j++) {
      const th = ((j + (li % 2) * 0.5) / NC) * Math.PI * 2;
      const n = noise(Math.cos(th) * 4 + li * 1.7, Math.sin(th) * 4 - li) * 0.07 + rng.range(-0.03, 0.03);
      const r = R(th) * L.s * (1 + n) + (li === 0 ? 0 : 0.05);
      cp.push(new THREE.Vector3(Math.cos(th) * r, L.y + rng.range(-0.08, 0.08) * (li ? 1 : 0), Math.sin(th) * r));
    }
  }
  const cliffPos = [];
  const cliffCol = [];
  const tri = (a, b, c, color) => {
    cliffPos.push(a.x, a.y, a.z, b.x, b.y, b.z, c.x, c.y, c.z);
    for (let k = 0; k < 3; k++) cliffCol.push(color.r, color.g, color.b);
  };
  for (let li = 0; li < levels.length - 1; li++) {
    for (let j = 0; j < NC; j++) {
      const a = cp[li * NC + j], b = cp[li * NC + ((j + 1) % NC)];
      const c = cp[(li + 1) * NC + j], d = cp[(li + 1) * NC + ((j + 1) % NC)];
      const base = strata[(li + (j % 7 === 0 ? 1 : 0)) % strata.length];
      const v1 = rng.range(0.9, 1.06), v2 = rng.range(0.9, 1.06);
      _a.copy(base).multiplyScalar(v1);
      tri(a, c, b, _a);
      _b.copy(base).multiplyScalar(v2);
      if (li % 2 === 0) tri(b, c, d, _b);
      else tri(b, c, d, _b);
    }
  }
  // underside
  const under = new THREE.Color(T.under);
  const underDark = new THREE.Color(T.underDark);
  const bottomY = -radius * 0.95 * depthScale - 2;
  const lastL = levels[levels.length - 1];
  const UR = lowDetail ? 3 : 6;
  let prevRing = [];
  for (let j = 0; j < NC; j++) prevRing.push(cp[(levels.length - 1) * NC + j]);
  for (let u = 1; u <= UR; u++) {
    const t = u / (UR + 1);
    const ring = [];
    for (let j = 0; j < NC; j++) {
      const th = (j / NC) * Math.PI * 2;
      const lobe = 1 + 0.35 * t * noise(Math.cos(th) * 2.2 + 9, Math.sin(th) * 2.2 + u * 0.3);
      const r = R(th) * lastL.s * Math.pow(1 - t, 1.25) * lobe;
      const y = lastL.y + (bottomY - lastL.y) * Math.pow(t, 0.9) + rng.range(-0.25, 0.25);
      ring.push(new THREE.Vector3(Math.cos(th) * r, y, Math.sin(th) * r));
    }
    for (let j = 0; j < NC; j++) {
      const a = prevRing[j], b = prevRing[(j + 1) % NC], c = ring[j], d = ring[(j + 1) % NC];
      const k = u / UR;
      _a.copy(under).lerp(underDark, k * 0.9).multiplyScalar(rng.range(0.88, 1.06));
      tri(a, c, b, _a);
      _b.copy(under).lerp(underDark, k * 0.9).multiplyScalar(rng.range(0.88, 1.06));
      tri(b, c, d, _b);
    }
    prevRing = ring;
  }
  const apex = new THREE.Vector3(rng.range(-0.5, 0.5), bottomY - radius * 0.12, rng.range(-0.5, 0.5));
  for (let j = 0; j < NC; j++) {
    _a.copy(underDark).multiplyScalar(rng.range(0.85, 1.0));
    tri(prevRing[j], apex, prevRing[(j + 1) % NC], _a);
  }
  const cliffGeo = new THREE.BufferGeometry();
  cliffGeo.setAttribute('position', new THREE.Float32BufferAttribute(cliffPos, 3));
  cliffGeo.setAttribute('color', new THREE.Float32BufferAttribute(cliffCol, 3));
  cliffGeo.computeVertexNormals();
  const cliff = new THREE.Mesh(cliffGeo, sharedEnvMaterial(true));
  cliff.receiveShadow = true;
  cliff.castShadow = false;
  cliff.name = 'cliff';
  group.add(cliff);

  // ---------- DETAILS: cliff rocks, hanging spikes, roots ----------
  if (!lowDetail) {
    const extras = [];
    const rockC = new THREE.Color(T.strata[1]);
    const nRocks = Math.round(radius * 1.6);
    for (let i = 0; i < nRocks; i++) {
      const th = rng.range(0, Math.PI * 2);
      const y = rng.range(-3.2, -0.9) * depthScale;
      const r = R(th) * 0.99 + 0.15;
      const s = rng.range(0.35, 0.8);
      const g = G.flat(G.jitter(G.ico(1, 0), 0.25, i + seed));
      G.xf(g, { p: [Math.cos(th) * r, y, Math.sin(th) * r], r: [rng.range(0, 3), th, rng.range(0, 3)], s: [s * 1.3, s, s * 1.1] });
      G.paint(g, (x, yy, z, nx, ny) => _a.copy(rockC).multiplyScalar(0.85 + ny * 0.2 + rng.range(-0.04, 0.04)));
      extras.push(g);
    }
    // hanging spikes under the island
    const nSp = Math.round(radius * 0.9);
    for (let i = 0; i < nSp; i++) {
      const th = rng.range(0, Math.PI * 2);
      const rr = rng.range(0.25, 0.7) * radius;
      const t = clamp(rr / radius, 0, 1);
      const y = lastL.y + (bottomY - lastL.y) * Math.pow(1 - t, 1.1) * 0.8;
      const h = rng.range(1.2, 3.2) * (1 - t * 0.5);
      const g = G.flat(G.jitter(G.cone(rng.range(0.35, 0.8), h, 5), 0.12, i * 3 + seed));
      G.xf(g, { p: [Math.cos(th) * rr, y - h * 0.45, Math.sin(th) * rr], r: [Math.PI + rng.range(-0.2, 0.2), rng.range(0, 3), rng.range(-0.2, 0.2)] });
      G.paint(g, () => _a.copy(under).lerp(underDark, 0.5).multiplyScalar(rng.range(0.85, 1.05)));
      extras.push(g);
    }
    const rockMesh = new THREE.Mesh(G.merge(extras), sharedEnvMaterial(true));
    rockMesh.receiveShadow = true;
    group.add(rockMesh);

    // roots & vines
    const vines = [];
    const vineC = new THREE.Color(T.leaves ? T.leaves[1] : '#4a9e36');
    const rootC = new THREE.Color(T.trunk);
    const nV = Math.round(radius * 1.2);
    for (let i = 0; i < nV; i++) {
      const th = rng.range(0, Math.PI * 2);
      const r0 = R(th) + 0.2;
      const len = rng.range(0.8, 2.6);
      const isVine = rng.chance(0.6);
      const pts = [];
      for (let k = 0; k <= 4; k++) {
        const t = k / 4;
        const out = 0.12 + Math.sin(t * Math.PI) * 0.18;
        pts.push(new THREE.Vector3(Math.cos(th) * (r0 + out), -0.35 - t * len, Math.sin(th) * (r0 + out)).add(new THREE.Vector3(rng.range(-0.08, 0.08), 0, rng.range(-0.08, 0.08))));
      }
      const g = G.taperTube(pts, (t) => (isVine ? 0.045 : 0.07) * (1 - t * 0.7), 5, 8);
      G.paint(g, isVine ? vineC : rootC);
      vines.push(g);
      if (isVine) {
        for (let k = 1; k < 4; k++) {
          const lp = pts[k];
          const lg = G.leafGeo(0.22, 0.14, 0.02);
          G.xf(lg, { p: [lp.x, lp.y, lp.z], r: [rng.range(-1, 1), th + rng.range(-1, 1), rng.range(1.5, 2.6)] });
          G.paint(lg, _a.copy(vineC).offsetHSL(0, 0, rng.range(-0.02, 0.08)));
          vines.push(lg);
        }
      }
    }
    const vineMesh = new THREE.Mesh(G.merge(vines), sharedEnvMaterial(false));
    group.add(vineMesh);
  }

  return { group, R, inside, radius, theme: T, noise, top };
}
