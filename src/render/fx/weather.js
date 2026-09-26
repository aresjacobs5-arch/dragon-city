import * as THREE from 'three';

// Ambient weather per environment: what drifts through the air of each world.
// kind: fall (from above), rise (from the ground), float (hovering motes)
export const WEATHER = {
  verdant: { type: 'leaf', rate: 0.9, kind: 'fall', life: 3.2 },
  volcanic: { type: 'ember', rate: 9, kind: 'rise', life: 2.6 },
  frozen: { type: 'snow', rate: 14, kind: 'fall', life: 4.5 },
  storm: { rate: 0, lightning: true },
  shadow: { type: 'magic', rate: 3, kind: 'float', life: 2.4, color: '#b67cff' },
  marsh: { type: 'sparkle', rate: 3.5, kind: 'float', life: 2.4, color: '#d8ff7a' },
  arcane: { type: 'magic', rate: 4, kind: 'float', life: 2.4 },
  celestial: { type: 'sparkle', rate: 5, kind: 'float', life: 2.6 },
  coral: { type: 'bubble', rate: 5, kind: 'rise', life: 3 },
  ancient: { type: 'dust', rate: 1.2, kind: 'float', life: 3 },
};

const _p = new THREE.Vector3();
const _d = new THREE.Vector3();

// Emits the weather particles around a focus point and, in stormy worlds,
// throws distant lightning into the background of the camera's view.
// Runs on real time so weather stays calm when battles play at 4x.
export class WeatherFx {
  constructor(scene, particles, camera) {
    this.scene = scene;
    this.particles = particles;
    this.camera = camera;
    this.theme = null;
    this.flashK = 0;
    this.acc = 0;
    this.nextBolt = 3;
    this.bolt = null;
    this.onSfx = null;
  }

  setTheme(name) {
    if (this.theme && this.theme !== name) this.particles.clear();
    this.theme = name;
    this.acc = 0;
    this.nextBolt = 2 + Math.random() * 3;
  }

  // area: half extents around `center`; scale enlarges particles for far cameras
  update(dt, { center = null, area = [11, 7], lift = 0, scale = 1, rateMul = 1 } = {}) {
    this.flashK = Math.max(0, this.flashK - dt * 5);
    if (this.bolt && this.bolt.visible) {
      this.bolt.material.opacity = Math.max(0, this.bolt.material.opacity - dt * 3.2);
      if (this.bolt.material.opacity <= 0) this.bolt.visible = false;
    }
    const W = WEATHER[this.theme];
    if (!W) return;
    const cx = center ? center.x : 0, cz = center ? center.z : -1;
    this.acc += dt * W.rate * rateMul;
    while (this.acc >= 1) {
      this.acc -= 1;
      const x = cx + (Math.random() - 0.5) * 2 * area[0];
      // falling particles start behind the action so they never fill the lens
      const z = W.kind === 'fall' ? cz - area[1] * 0.8 + Math.random() * area[1] * 1.7 : cz + (Math.random() - 0.5) * 2 * area[1];
      const y = lift + (W.kind === 'fall' ? 5 + Math.random() * 4 : W.kind === 'rise' ? Math.random() * 0.6 : 0.6 + Math.random() * 3);
      this.particles.emit(W.type, _p.set(x, y, z), { count: 1, spread: 0.2, speed: 0.25, up: W.kind === 'fall' ? 0 : 0.3, life: W.life, color: W.color || null, size: scale });
    }
    if (W.lightning) {
      this.nextBolt -= dt;
      if (this.nextBolt <= 0) {
        this.nextBolt = 5 + Math.random() * 7;
        this.strike();
      }
    }
  }

  strike() {
    if (!this.bolt) {
      const m = new THREE.MeshBasicMaterial({ color: '#eaf4ff', transparent: true, opacity: 0, blending: THREE.AdditiveBlending, depthWrite: false, fog: false, side: THREE.DoubleSide });
      this.bolt = new THREE.Mesh(new THREE.BufferGeometry(), m);
      this.bolt.frustumCulled = false;
      this.scene.add(this.bolt);
    }
    // jagged ribbon falling from the top of the view into the cloud sea, with
    // one branch, placed far in the background of whatever the camera frames
    const cam = this.camera;
    const side = Math.random() < 0.5 ? -1 : 1;
    const dir = _d.set(side * (0.35 + Math.random() * 0.45), 1.05, 0.5).unproject(cam).sub(cam.position).normalize();
    const top = _p.copy(cam.position).addScaledVector(dir, 130);
    const pts = [];
    let x = 0;
    for (let i = 0; i <= 12; i++) {
      pts.push([x, -i * 4.4]);
      x += (Math.random() - 0.5) * 5.5;
    }
    const pos = [];
    const strip = (list, w0) => {
      for (let i = 0; i < list.length - 1; i++) {
        const [ax, ay] = list[i], [bx, by] = list[i + 1];
        const wa = w0 * (1 - i / list.length), wb = w0 * (1 - (i + 1) / list.length);
        pos.push(ax - wa, ay, 0, ax + wa, ay, 0, bx + wb, by, 0, ax - wa, ay, 0, bx + wb, by, 0, bx - wb, by, 0);
      }
    };
    strip(pts, 0.8);
    const b0 = pts[3];
    const branch = [b0];
    for (let i = 1; i < 5; i++) branch.push([b0[0] + i * (2 + Math.random() * 2) * side, b0[1] - i * 3.6]);
    strip(branch, 0.4);
    const g = this.bolt.geometry;
    g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
    g.computeBoundingSphere();
    this.bolt.position.copy(top);
    this.bolt.rotation.set(0, Math.atan2(cam.position.x - top.x, cam.position.z - top.z), 0);
    this.bolt.material.opacity = 1;
    this.bolt.visible = true;
    this.flashK = 1;
    if (this.onSfx) this.onSfx('thunder');
  }
}
