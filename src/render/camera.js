import * as THREE from 'three';
import { clamp, ease } from '../core/math.js';

// Isometric-style camera with grab-panning, inertia, cursor-anchored zoom,
// pinch support and smooth fly-to transitions.
export class IsoCameraController {
  constructor(dom, { fov = 30, yaw = Math.PI * 0.25, pitch = 0.74, distance = 44, minDistance = 16, maxDistance = 80 } = {}) {
    this.dom = dom;
    this.camera = new THREE.PerspectiveCamera(fov, 1, 0.5, 2400);
    this.yaw = yaw;
    this.pitch = pitch;
    this.target = new THREE.Vector3();
    this.goal = new THREE.Vector3();
    this.distance = distance;
    this.goalDistance = distance;
    this.minDistance = minDistance;
    this.maxDistance = maxDistance;
    this.velocity = new THREE.Vector3();
    this.enabled = true;
    this.bounds = { minX: -20, maxX: 20, minZ: -20, maxZ: 20 };
    this.pointers = new Map();
    this.dragging = false;
    this.onTap = null;
    this.onDragStart = null;
    this.onDragMove = null; // if returns true, consumes the drag (building placement)
    this.onDragEnd = null;
    this.flight = null;
    this.shake = 0;
    this._raycaster = new THREE.Raycaster();
    this._plane = new THREE.Plane(new THREE.Vector3(0, 1, 0), 0);
    this._tmp = new THREE.Vector3();
    this._ndc = new THREE.Vector2();
    this._bind();
    this.apply();
  }

  _bind() {
    const d = this.dom;
    d.addEventListener('pointerdown', (e) => this._down(e));
    window.addEventListener('pointermove', (e) => this._move(e));
    window.addEventListener('pointerup', (e) => this._up(e));
    window.addEventListener('pointercancel', (e) => this._up(e));
    d.addEventListener('wheel', (e) => this._wheel(e), { passive: false });
    d.addEventListener('contextmenu', (e) => e.preventDefault());
  }

  groundPoint(clientX, clientY, out = new THREE.Vector3(), camera = this.camera) {
    const rect = this.dom.getBoundingClientRect();
    this._ndc.set(((clientX - rect.left) / rect.width) * 2 - 1, -((clientY - rect.top) / rect.height) * 2 + 1);
    this._raycaster.setFromCamera(this._ndc, camera);
    const hit = this._raycaster.ray.intersectPlane(this._plane, out);
    return hit ? out : null;
  }

  raycaster(clientX, clientY) {
    const rect = this.dom.getBoundingClientRect();
    this._ndc.set(((clientX - rect.left) / rect.width) * 2 - 1, -((clientY - rect.top) / rect.height) * 2 + 1);
    this._raycaster.setFromCamera(this._ndc, this.camera);
    return this._raycaster;
  }

  _down(e) {
    if (!this.enabled) return;
    this.dom.setPointerCapture && this.dom.setPointerCapture(e.pointerId);
    this.pointers.set(e.pointerId, { x: e.clientX, y: e.clientY, sx: e.clientX, sy: e.clientY, t: performance.now() });
    this.flight = null;
    if (this.pointers.size === 1) {
      this.dragging = false;
      this.velocity.set(0, 0, 0);
      this._grab = this.groundPoint(e.clientX, e.clientY, new THREE.Vector3());
      this._consumed = false;
      this._lastMoveT = performance.now();
      if (this.onDragStart) this._consumed = !!this.onDragStart(e.clientX, e.clientY);
    } else if (this.pointers.size === 2) {
      const [a, b] = [...this.pointers.values()];
      this._pinchDist = Math.hypot(a.x - b.x, a.y - b.y);
      this._pinchStartDistance = this.goalDistance;
      this.dragging = true;
    }
  }

  _move(e) {
    const p = this.pointers.get(e.pointerId);
    if (!p || !this.enabled) return;
    p.x = e.clientX;
    p.y = e.clientY;
    if (this.pointers.size === 1) {
      const moved = Math.hypot(p.x - p.sx, p.y - p.sy);
      if (!this.dragging && moved > 7) this.dragging = true;
      if (!this.dragging) return;
      if (this._consumed) {
        if (this.onDragMove) this.onDragMove(e.clientX, e.clientY);
        return;
      }
      if (!this._grab) return;
      const now = this.groundPoint(e.clientX, e.clientY, this._tmp);
      if (!now) return;
      const dx = this._grab.x - now.x, dz = this._grab.z - now.z;
      const t = performance.now();
      const dtm = Math.max(1, t - this._lastMoveT) / 1000;
      this._lastMoveT = t;
      this.target.x += dx;
      this.target.z += dz;
      this.goal.copy(this.target);
      this.velocity.set(dx / dtm, 0, dz / dtm).multiplyScalar(0.5).add(this.velocity.clone().multiplyScalar(0.5));
      this._clampTarget(this.target);
      this.goal.copy(this.target);
      this.apply();
    } else if (this.pointers.size === 2) {
      const [a, b] = [...this.pointers.values()];
      const dist = Math.hypot(a.x - b.x, a.y - b.y);
      if (this._pinchDist > 0) {
        const k = this._pinchDist / dist;
        this.goalDistance = clamp(this._pinchStartDistance * k, this.minDistance, this.maxDistance);
      }
    }
  }

  _up(e) {
    const p = this.pointers.get(e.pointerId);
    if (!p) return;
    this.pointers.delete(e.pointerId);
    if (this.pointers.size === 0) {
      const moved = Math.hypot(p.x - p.sx, p.y - p.sy);
      const dur = performance.now() - p.t;
      if (this._consumed) {
        if (this.onDragEnd) this.onDragEnd(e.clientX, e.clientY, !this.dragging);
        this._consumed = false;
      } else if (!this.dragging && moved < 8 && dur < 600) {
        if (this.onTap) this.onTap(e.clientX, e.clientY);
      }
      if (performance.now() - this._lastMoveT > 90) this.velocity.set(0, 0, 0);
      this.dragging = false;
      this._grab = null;
    } else if (this.pointers.size === 1) {
      const rest = [...this.pointers.values()][0];
      this._grab = this.groundPoint(rest.x, rest.y, new THREE.Vector3());
    }
  }

  _wheel(e) {
    if (!this.enabled) return;
    e.preventDefault();
    const before = this.groundPoint(e.clientX, e.clientY, new THREE.Vector3());
    const k = Math.exp(clamp(e.deltaY, -100, 100) * 0.0022);
    this.goalDistance = clamp(this.goalDistance * k, this.minDistance, this.maxDistance);
    // zoom toward cursor: shift goal so the point under the cursor stays roughly fixed
    if (before) {
      const f = 1 - this.goalDistance / this.distance;
      this.goal.x += (before.x - this.target.x) * f * 0.6;
      this.goal.z += (before.z - this.target.z) * f * 0.6;
      this._clampTarget(this.goal);
    }
  }

  zoomBy(k) {
    this.goalDistance = clamp(this.goalDistance * k, this.minDistance, this.maxDistance);
  }

  _clampTarget(v) {
    const b = this.bounds;
    v.x = clamp(v.x, b.minX, b.maxX);
    v.z = clamp(v.z, b.minZ, b.maxZ);
  }

  flyTo(target, distance = this.goalDistance, duration = 1.2, easing = ease.inOutCubic) {
    return new Promise((resolve) => {
      this.flight = {
        from: this.target.clone(),
        to: new THREE.Vector3(target.x, 0, target.z),
        d0: this.distance,
        d1: distance,
        t: 0,
        duration,
        easing,
        resolve,
      };
      this.velocity.set(0, 0, 0);
    });
  }

  update(dt) {
    if (this.flight) {
      const f = this.flight;
      f.t += dt;
      const k = clamp(f.t / f.duration, 0, 1);
      const e = f.easing(k);
      this.target.lerpVectors(f.from, f.to, e);
      // arc the zoom a little for a cinematic feel
      this.distance = f.d0 + (f.d1 - f.d0) * e + Math.sin(k * Math.PI) * Math.min(12, Math.abs(f.d1 - f.d0) * 0.3 + 4) * (f.duration > 1.5 ? 1 : 0);
      this.goal.copy(this.target);
      this.goalDistance = f.d1;
      if (k >= 1) {
        this.flight = null;
        this.distance = f.d1;
        f.resolve();
      }
    } else {
      if (!this.dragging && this.velocity.lengthSq() > 0.0001) {
        this.goal.addScaledVector(this.velocity, dt);
        this.velocity.multiplyScalar(Math.exp(-5.5 * dt));
        this._clampTarget(this.goal);
      }
      if (!this.dragging) {
        const k = 1 - Math.exp(-9 * dt);
        this.target.lerp(this.goal, k);
      }
      this.distance += (this.goalDistance - this.distance) * (1 - Math.exp(-8 * dt));
    }
    if (this.shake > 0) this.shake = Math.max(0, this.shake - dt * 2.5);
    this.apply();
  }

  apply() {
    const cp = Math.cos(this.pitch), sp = Math.sin(this.pitch);
    const dir = this._tmp.set(Math.sin(this.yaw) * cp, sp, Math.cos(this.yaw) * cp);
    this.camera.position.copy(this.target).addScaledVector(dir, this.distance);
    if (this.shake > 0) {
      const s = this.shake * this.shake * 0.35;
      this.camera.position.x += (Math.random() - 0.5) * s;
      this.camera.position.y += (Math.random() - 0.5) * s;
    }
    this.camera.lookAt(this.target.x, this.target.y, this.target.z);
  }

  resize(w, h) {
    this.camera.aspect = w / h;
    // Portrait screens need more distance to show the island.
    this.camera.fov = w < h ? 42 : 30;
    this.camera.updateProjectionMatrix();
  }
}
