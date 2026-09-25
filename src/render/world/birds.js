import * as THREE from 'three';
import * as G from '../geom.js';
import { globalUniforms } from '../materials.js';

// A small flock of birds gliding in lazy loops around the islands.
// Wing flapping happens in the vertex shader so the whole flock is one draw call.
export class Birds {
  constructor(scene, count = 7) {
    const parts = [];
    const body = G.ellipsoid(0.1, 0.09, 0.26, 10, 8);
    G.paint(body, '#fdf7ee');
    parts.push(body);
    const head = G.sphere(0.08, 8, 6);
    G.xf(head, { p: [0, 0.05, 0.22] });
    G.paint(head, '#fdf7ee');
    parts.push(head);
    const beak = G.cone(0.03, 0.09, 5);
    G.xf(beak, { p: [0, 0.04, 0.33], r: [Math.PI / 2, 0, 0] });
    G.paint(beak, '#ffb13d');
    parts.push(beak);
    for (const s of [-1, 1]) {
      const w = new THREE.BufferGeometry();
      const v = [0, 0, 0.1, s * 0.62, 0.02, -0.02, 0, 0, -0.12, s * 0.62, 0.02, -0.02, s * 0.3, 0.02, -0.14, 0, 0, -0.12];
      w.setAttribute('position', new THREE.Float32BufferAttribute(v, 3));
      w.computeVertexNormals();
      G.paint(w, (x) => new THREE.Color('#fdf7ee').lerp(new THREE.Color('#6b7a99'), Math.min(1, Math.abs(x) / 0.62) ** 2));
      const n = w.attributes.normal;
      for (let k = 0; k < n.count; k++) n.setXYZ(k, 0, 1, 0);
      parts.push(w);
    }
    const tail = new THREE.BufferGeometry();
    tail.setAttribute('position', new THREE.Float32BufferAttribute([-0.07, 0, -0.2, 0.07, 0, -0.2, 0, 0.01, -0.36], 3));
    tail.computeVertexNormals();
    G.paint(tail, '#e8e2d8');
    parts.push(tail);
    const geo = G.merge(parts);
    const mat = new THREE.MeshLambertMaterial({ vertexColors: true, side: THREE.DoubleSide });
    mat.onBeforeCompile = (shader) => {
      shader.uniforms.uTime = globalUniforms.uTime;
      shader.vertexShader = shader.vertexShader
        .replace('#include <common>', '#include <common>\nuniform float uTime;')
        .replace(
          '#include <begin_vertex>',
          `#include <begin_vertex>
          float ph = instanceMatrix[3].x * 0.7 + instanceMatrix[3].z * 0.3;
          float flap = sin(uTime * 9.0 + ph) * 0.8;
          float ax = abs(position.x);
          transformed.y += flap * max(0.0, ax - 0.08) * 0.9;`
        );
    };
    this.mesh = new THREE.InstancedMesh(geo, mat, count);
    this.mesh.frustumCulled = false;
    scene.add(this.mesh);
    this.count = count;
    this.offsets = [];
    for (let i = 0; i < count; i++) {
      const row = Math.ceil(i / 2);
      const side = i === 0 ? 0 : i % 2 ? -1 : 1;
      this.offsets.push(new THREE.Vector3(side * row * 0.9, Math.sin(i) * 0.2, -row * 0.8));
    }
    this.t = Math.random() * 100;
    this._m = new THREE.Matrix4();
    this._q = new THREE.Quaternion();
    this._p = new THREE.Vector3();
    this._s = new THREE.Vector3(1.6, 1.6, 1.6);
    this._up = new THREE.Vector3(0, 1, 0);
  }

  update(dt, time, center) {
    this.t += dt;
    const R = 34;
    const a = this.t * 0.07;
    const cx = Math.cos(a) * R + center.x * 0.3;
    const cz = Math.sin(a * 1.3) * R * 0.7 + center.z * 0.3;
    const cy = 11 + Math.sin(this.t * 0.35) * 2.5;
    const dx = -Math.sin(a) * R * 0.07;
    const dz = Math.cos(a * 1.3) * R * 0.7 * 1.3 * 0.07;
    const yaw = Math.atan2(dx, dz);
    const bank = Math.sin(this.t * 0.2) * 0.25;
    this._q.setFromEuler(new THREE.Euler(0, yaw, bank, 'YXZ'));
    for (let i = 0; i < this.count; i++) {
      this._p.copy(this.offsets[i]).applyQuaternion(this._q);
      this._p.x += cx;
      this._p.y += cy + Math.sin(this.t * 1.2 + i) * 0.15;
      this._p.z += cz;
      this._m.compose(this._p, this._q, this._s);
      this.mesh.setMatrixAt(i, this._m);
    }
    this.mesh.instanceMatrix.needsUpdate = true;
  }
}
