import * as THREE from 'three';
import * as G from '../geom.js';
import { worleyCell } from '../../core/noise.js';
import { ELEMENTS } from '../../data/elements.js';
import { RARITIES } from '../../data/rarities.js';
import { hashString } from '../../core/rng.js';

const _c = new THREE.Color();
const cache = new Map();

// Egg geometry for a species: element colored with a pattern from its second
// element, and rarity trims (gold band, gems, glow) for rarer eggs.
export function eggGeometry(species) {
  const key = species.id;
  if (cache.has(key)) return cache.get(key);
  const prof = [];
  for (let i = 0; i <= 24; i++) {
    const t = i / 24;
    const a = t * Math.PI;
    const r = Math.sin(a) * (0.36 - 0.06 * t) * (t < 0.5 ? 1 : 1 - (t - 0.5) * 0.12);
    prof.push([Math.max(0.001, r), -Math.cos(a) * 0.5 + 0.5]);
  }
  const geo = G.lathe(prof, 32);
  const els = species.elements;
  const base = new THREE.Color(ELEMENTS[els[0]].color).lerp(new THREE.Color('#ffffff'), 0.25);
  const second = new THREE.Color(ELEMENTS[els[1] || els[0]].light);
  const accent = new THREE.Color(ELEMENTS[els[els.length - 1]].dark);
  const r = RARITIES[species.rarity];
  const seed = hashString(species.id) % 97;
  const style = seed % 3;
  G.paint(geo, (x, y, z, nx, ny) => {
    _c.copy(base).offsetHSL(0, 0, ny * 0.08);
    if (style === 0) {
      const [d, id] = worleyCell(x * 7, y * 7, z * 7, seed);
      if (d < 0.2 + id * 0.12) _c.lerp(second, 0.9);
    } else if (style === 1) {
      const band = Math.sin(Math.atan2(z, x) * 6 + y * 9) * 0.5 + 0.5;
      if (Math.abs(y - 0.45) < 0.06 + band * 0.06) _c.lerp(second, 0.9);
    } else {
      const s = Math.sin(y * 18 + Math.atan2(z, x) * 2);
      if (s > 0.55) _c.lerp(second, 0.85);
    }
    if (r.idx >= 3 && Math.abs(y - 0.3) < 0.03) _c.set(r.idx >= 4 ? '#ffd23f' : '#e8e0f0');
    if (y > 0.93) _c.lerp(accent, 0.3);
    return _c;
  });
  cache.set(key, geo);
  return geo;
}

export function eggMesh(species, { glow = true } = {}) {
  const group = new THREE.Group();
  const mat = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.42, metalness: 0.05 });
  const m = new THREE.Mesh(eggGeometry(species), mat);
  m.castShadow = true;
  group.add(m);
  const r = RARITIES[species.rarity];
  if (glow && r.idx >= 2) {
    const halo = new THREE.Mesh(new THREE.SphereGeometry(0.46, 20, 14), new THREE.MeshBasicMaterial({ color: r.color, transparent: true, opacity: 0.18, depthWrite: false, toneMapped: false }));
    halo.position.y = 0.45;
    halo.scale.set(1, 1.2, 1);
    group.add(halo);
    group.userData.halo = halo;
  }
  if (r.idx >= 3) {
    for (let i = 0; i < 3; i++) {
      const gem = new THREE.Mesh(G.flat(G.ico(0.035, 0)), new THREE.MeshBasicMaterial({ color: r.idx >= 4 ? '#ff4f7b' : '#9ae6ff', toneMapped: false }));
      const a = (i / 3) * Math.PI * 2;
      gem.position.set(Math.cos(a) * 0.33, 0.3, Math.sin(a) * 0.33);
      group.add(gem);
    }
  }
  group.userData.mesh = m;
  return group;
}
