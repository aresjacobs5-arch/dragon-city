import * as THREE from 'three';
import { RNG } from '../../core/rng.js';
import * as G from '../geom.js';

const _c = new THREE.Color();

// Puffy low-poly cloud clumps that drift around the islands.
function cloudGeometry(rng, top, bottom) {
  const parts = [];
  const n = rng.int(4, 7);
  const len = rng.range(4, 8);
  for (let i = 0; i < n; i++) {
    const t = n === 1 ? 0.5 : i / (n - 1);
    const r = rng.range(1.2, 2.2) * (1 - Math.abs(t - 0.5) * 0.9);
    const g = G.ico(r, 3);
    G.xf(g, { p: [(t - 0.5) * len, rng.range(-0.2, 0.5) + r * 0.25, rng.range(-0.9, 0.9)], s: [1, 0.72, 1] });
    parts.push(g);
  }
  // a couple of top puffs
  for (let i = 0; i < 2; i++) {
    const g = G.ico(rng.range(1.2, 1.8), 3);
    G.xf(g, { p: [rng.range(-len * 0.25, len * 0.25), rng.range(0.9, 1.4), rng.range(-0.5, 0.5)], s: [1, 0.8, 1] });
    parts.push(g);
  }
  const geo = G.merge(parts);
  geo.computeBoundingBox();
  const bb = geo.boundingBox;
  const tc = new THREE.Color(top), bc = new THREE.Color(bottom);
  G.paint(geo, (x, y, z, nx, ny) => {
    const k = Math.min(1, Math.max(0, (y - bb.min.y) / (bb.max.y - bb.min.y)));
    _c.copy(bc).lerp(tc, Math.pow(k, 0.7));
    if (ny > 0.3) _c.lerp(tc, 0.3);
    return _c;
  });
  return geo;
}

export class CloudLayer {
  constructor({ seed = 5, count = 26, area = 120, yRange = [-18, 6], top = '#ffffff', bottom = '#c8d6f2', avoidRadius = 16, center = new THREE.Vector3() } = {}) {
    const rng = new RNG(seed);
    this.group = new THREE.Group();
    this.clouds = [];
    this.area = area;
    this.center = center;
    const mat = new THREE.MeshLambertMaterial({ vertexColors: true, emissive: new THREE.Color('#5d6f99'), emissiveIntensity: 0.35 });
    const variants = [];
    for (let i = 0; i < 6; i++) variants.push(cloudGeometry(rng, top, bottom));
    for (let i = 0; i < count; i++) {
      const m = new THREE.Mesh(rng.pick(variants), mat);
      let x, z;
      let tries = 0;
      do {
        x = rng.range(-area, area);
        z = rng.range(-area, area);
        tries++;
      } while (Math.hypot(x, z) < avoidRadius && tries < 20);
      const y = rng.range(yRange[0], yRange[1]);
      // clouds near the island level stay out of the way; lower ones can pass beneath
      if (y > -8 && Math.hypot(x, z) < avoidRadius + 8) {
        const a = Math.atan2(z, x);
        x = Math.cos(a) * (avoidRadius + 10);
        z = Math.sin(a) * (avoidRadius + 10);
      }
      m.position.set(center.x + x, y, center.z + z);
      const s = rng.range(0.8, 2.0) * (y < -10 ? 1.6 : 1);
      m.scale.set(s, s * rng.range(0.8, 1.1), s);
      m.rotation.y = rng.range(0, Math.PI * 2);
      m.userData.speed = rng.range(0.4, 1.2);
      m.userData.bobPhase = rng.range(0, 6.28);
      m.userData.baseY = y;
      this.group.add(m);
      this.clouds.push(m);
    }
  }
  update(dt, t) {
    for (const m of this.clouds) {
      m.position.x += m.userData.speed * dt;
      if (m.position.x - this.center.x > this.area) m.position.x -= this.area * 2;
      m.position.y = m.userData.baseY + Math.sin(t * 0.2 + m.userData.bobPhase) * 0.3;
    }
  }
}
