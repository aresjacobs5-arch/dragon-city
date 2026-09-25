import * as THREE from 'three';
import { Engine } from '../src/render/engine.js';
import { MonsterView } from '../src/render/monsters/builder.js';
import { MONSTERS as TEST_SPECIES } from '../src/data/monsters.js';

const params = new URLSearchParams(location.search);
const engine = new Engine(document.getElementById('c'));
const scene = new THREE.Scene();
scene.background = new THREE.Color('#bfe3f7');
const cam = new THREE.PerspectiveCamera(30, 1, 0.1, 200);
scene.add(new THREE.HemisphereLight('#e6f2ff', '#8a7a5a', 1.1));
const sun = new THREE.DirectionalLight('#fff2dc', 2.8);
sun.position.set(-4, 8, 6);
sun.castShadow = true;
sun.shadow.mapSize.set(2048, 2048);
Object.assign(sun.shadow.camera, { left: -12, right: 12, top: 12, bottom: -12, near: 0.5, far: 40 });
sun.shadow.radius = 3;
scene.add(sun);
const ground = new THREE.Mesh(new THREE.PlaneGeometry(60, 60), new THREE.MeshLambertMaterial({ color: '#8ccf5c' }));
ground.rotation.x = -Math.PI / 2;
ground.receiveShadow = true;
scene.add(ground);

let list = TEST_SPECIES;
if (params.get('only')) list = list.filter((s) => params.get('only').split(',').includes(s.id));
const stage = +(params.get('stage') || 1);
const cols = +(params.get('cols') || Math.ceil(Math.sqrt(list.length * 1.8)));
const spacing = +(params.get('sp') || 2.1);
const views = [];
const labels = document.getElementById('labels');
list.forEach((sp, i) => {
  const stages = params.get('stages') ? [0, 1, 2] : [stage];
  stages.forEach((stg, j) => {
    const v = new MonsterView(sp, stg);
    const idx = params.get('stages') ? i * 3 + j : i;
    const cx = idx % cols, cz = Math.floor(idx / cols);
    v.group.position.set((cx - (cols - 1) / 2) * spacing, 0, cz * spacing * 1.1);
    v.group.rotation.y = -0.35;
    scene.add(v.group);
    views.push(v);
    const el = document.createElement('div');
    el.className = 'lbl';
    el.textContent = sp.name + (params.get('stages') ? ' ' + stg : '');
    labels.appendChild(el);
    v.label = el;
  });
});
const rows = Math.ceil(views.length / cols);
const cz = ((rows - 1) * spacing * 1.1) / 2;
const dist = +(params.get('dist') || Math.max(cols * spacing * 1.25, rows * spacing * 2.2));
cam.position.set(0, dist * 0.55, cz + dist);
cam.lookAt(0, 0.5, cz);
engine.setWorld({
  scene, camera: cam,
  update(dt) {
    for (const v of views) v.update(dt);
    const p = new THREE.Vector3();
    for (const v of views) {
      p.set(0, -0.05, 0.9).applyMatrix4(v.group.matrixWorld);
      const s = engine.project(p, cam);
      v.label.style.left = s.x + 'px';
      v.label.style.top = s.y + 'px';
    }
  },
  resize(w, h) { cam.aspect = w / h; cam.updateProjectionMatrix(); },
});
engine.start();
window.__views = views;
window.__play = (a) => views.forEach((v) => v.animator.play(a));
setTimeout(() => (window.__ready = true), 1200);
