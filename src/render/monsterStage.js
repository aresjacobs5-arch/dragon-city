import * as THREE from 'three';
import { MonsterView } from './monsters/builder.js';
import { Particles } from './fx/particles.js';
import { eggMesh } from './monsters/eggs.js';
import { updateGlobalUniforms } from './materials.js';
import * as G from './geom.js';

// Small 3D stage used by DOM viewports (monster detail, breeding parents, dex).
// Draggable rotation, pedestal, soft lights and its own particles.
export class MonsterStage {
  constructor({ bg = '#cfe9ff', pedestal = true, fov = 26 } = {}) {
    this.scene = new THREE.Scene();
    this.scene.background = new THREE.Color(bg);
    this.camera = new THREE.PerspectiveCamera(fov, 1, 0.05, 100);
    this.scene.add(new THREE.HemisphereLight('#f4f8ff', '#9a8a7a', 1.35));
    const key = new THREE.DirectionalLight('#fff2e0', 2.4);
    key.position.set(-2.5, 4, 4);
    key.castShadow = true;
    key.shadow.mapSize.set(512, 512);
    Object.assign(key.shadow.camera, { left: -2, right: 2, top: 2, bottom: -2, near: 0.5, far: 12 });
    key.shadow.radius = 4;
    this.scene.add(key);
    const rim = new THREE.DirectionalLight('#d8ecff', 1.4);
    rim.position.set(3, 2, -3);
    this.scene.add(rim);
    if (pedestal) {
      const top = new THREE.Mesh(G.paint(G.cylinder(0.95, 1.05, 0.22, 40), '#fff6e3'), new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.8 }));
      top.position.y = -0.11;
      top.receiveShadow = true;
      this.scene.add(top);
      const rimRing = new THREE.Mesh(G.torus(1.0, 0.04, 6, 48), new THREE.MeshStandardMaterial({ color: '#e6cf9f', roughness: 0.6 }));
      rimRing.rotation.x = Math.PI / 2;
      this.scene.add(rimRing);
      this.pedestal = top;
    }
    this.particles = new Particles(this.scene, 400);
    this.pivot = new THREE.Group();
    this.scene.add(this.pivot);
    this.view = null;
    this.yaw = -0.45;
    this.yawVel = 0;
    this.dragging = false;
    this.time = 0;
    this.zoom = 1;
  }

  setMonster(species, stage = 0) {
    if (this.view) {
      this.pivot.remove(this.view.group);
      this.view.dispose();
    }
    if (this.egg) {
      this.pivot.remove(this.egg);
      this.egg = null;
    }
    if (!species) {
      this.view = null;
      return null;
    }
    this.view = new MonsterView(species, stage, { castShadow: true, cloud: false, rim: 0.6 });
    this.pivot.add(this.view.group);
    this._frame(this.view.worldHeight, this.view.template.radius * this.view.template.scale);
    return this.view;
  }

  setEgg(species) {
    this.setMonster(null);
    this.egg = eggMesh(species);
    this.egg.scale.setScalar(1.6);
    this.pivot.add(this.egg);
    this._frame(1.4, 0.6);
  }

  setSilhouette(v) {
    if (this.view) this.view.setSilhouette(v ? 1 : 0);
  }

  _frame(height, radius) {
    const size = Math.max(height * 1.08, radius * 1.9, 0.9);
    const dist = (size * 0.62) / Math.tan((this.camera.fov * Math.PI) / 360) * this.zoom;
    this.focusY = height * 0.47;
    this.dist = dist;
    this.camera.position.set(0, this.focusY + dist * 0.22, dist);
    this.camera.lookAt(0, this.focusY, 0);
  }

  // Attach pointer drag-to-rotate to a DOM element.
  bindDrag(el) {
    let lastX = 0;
    const down = (e) => {
      this.dragging = true;
      lastX = e.clientX;
      el.setPointerCapture && el.setPointerCapture(e.pointerId);
    };
    const move = (e) => {
      if (!this.dragging) return;
      const dx = e.clientX - lastX;
      lastX = e.clientX;
      this.yaw += dx * 0.012;
      this.yawVel = dx * 0.012 * 30;
    };
    const up = () => (this.dragging = false);
    el.addEventListener('pointerdown', down);
    el.addEventListener('pointermove', move);
    el.addEventListener('pointerup', up);
    el.addEventListener('pointercancel', up);
  }

  play(anim, opts) {
    return this.view ? this.view.animator.play(anim, opts) : Promise.resolve();
  }

  burst(type, count = 20, opts = {}) {
    const y = this.view ? this.view.worldHeight * 0.6 : 0.8;
    this.particles.emit(type, new THREE.Vector3(0, y, 0), { count, spread: 0.4, ...opts });
  }

  update(dt) {
    this.time += dt;
    updateGlobalUniforms(0);
    if (!this.dragging) {
      this.yawVel *= Math.exp(-3 * dt);
      this.yaw += this.yawVel * dt;
      this.yaw += Math.sin(this.time * 0.4) * 0.0015;
    }
    this.pivot.rotation.y = this.yaw;
    if (this.view) {
      this.view.update(dt);
      this.view.ambient(this.particles, dt);
    }
    if (this.egg) this.egg.rotation.z = Math.sin(this.time * 2.2) * 0.06;
    this.particles.setScale(400, this.camera.fov);
    this.particles.update(dt);
  }

  dispose() {
    if (this.view) this.view.dispose();
  }
}
