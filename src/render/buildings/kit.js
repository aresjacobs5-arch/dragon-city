import * as THREE from 'three';
import * as G from '../geom.js';
import { sharedEnvMaterial } from '../materials.js';

let _glowMat = null;
export function glowMat() {
  if (!_glowMat) _glowMat = new THREE.MeshBasicMaterial({ vertexColors: true, toneMapped: false });
  return _glowMat;
}

const _c = new THREE.Color();

// Accumulates vertex-colored parts and merges them per material so every
// building costs only a few draw calls.
export class Kit {
  constructor() {
    this.smooth = [];
    this.flat = [];
    this.glow = [];
    this.extra = [];
    this.anims = [];
  }
  // paint: color | fn | 'keep'
  add(geo, paint, { flat = false, glow = false, form = true } = {}) {
    let g = geo;
    if (paint !== 'keep') {
      if (typeof paint === 'function') G.paint(g, paint);
      else if (form) {
        const base = new THREE.Color(paint);
        const hi = base.clone().offsetHSL(0, -0.02, 0.07);
        const lo = base.clone().offsetHSL(0, 0.02, -0.09);
        G.paint(g, (x, y, z, nx, ny) => (ny >= 0 ? _c.copy(base).lerp(hi, ny) : _c.copy(base).lerp(lo, -ny)));
      } else G.paint(g, paint);
    }
    if (glow) this.glow.push(g);
    else if (flat) this.flat.push(G.flat(g));
    else this.smooth.push(g);
    return g;
  }
  obj(o, anim = null) {
    this.extra.push(o);
    if (anim) this.anims.push(anim);
    return o;
  }
  build({ castShadow = true } = {}) {
    const group = new THREE.Group();
    if (this.smooth.length) {
      const m = new THREE.Mesh(G.merge(this.smooth), sharedEnvMaterial(false));
      m.castShadow = castShadow;
      m.receiveShadow = true;
      group.add(m);
    }
    if (this.flat.length) {
      const m = new THREE.Mesh(G.merge(this.flat), sharedEnvMaterial(true));
      m.castShadow = castShadow;
      m.receiveShadow = true;
      group.add(m);
    }
    if (this.glow.length) {
      const m = new THREE.Mesh(G.merge(this.glow), glowMat());
      group.add(m);
    }
    for (const o of this.extra) group.add(o);
    const anims = this.anims;
    group.userData.animate = anims.length ? (t, dt) => anims.forEach((a) => a(t, dt)) : null;
    return group;
  }
}
