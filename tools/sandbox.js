import * as THREE from 'three';
import { Engine } from '../src/render/engine.js';
import { HomeWorld } from '../src/render/world/homeWorld.js';
import { ISLANDS } from '../src/data/islands.js';
import { PROP_BUILDERS } from '../src/render/world/props.js';
import { sharedEnvMaterial } from '../src/render/materials.js';
import { RNG } from '../src/core/rng.js';

const params = new URLSearchParams(location.search);
const engine = new Engine(document.getElementById('c'));
const world = new HomeWorld(engine);
const ids = (params.get('islands') || '0').split(',').map(Number);
for (const id of ids) world.addIsland(ISLANDS[id], true);
world.setBoundsFromIslands(ids);
// test scatter of obstacles
const rng = new RNG(4);
for (const id of ids) {
  const view = world.islands.get(id);
  const T = view.T;
  const kinds = [...T.trees, 'rock', 'rockBig', 'ruin', 'bush', 'arch', 'stump'];
  for (let i = 0; i < 22; i++) {
    const a = rng.range(0, 6.28), r = rng.range(2, view.def.radius - 1.2);
    const x = Math.cos(a) * r, z = Math.sin(a) * r;
    if (view._blockedByWater(x, z)) continue;
    const kind = rng.pick(kinds);
    const geo = PROP_BUILDERS[kind](T, i + id * 50); geo.scale(1.3,1.3,1.3);
    const m = new THREE.Mesh(geo, sharedEnvMaterial(kind.startsWith('rock') || kind === 'ruin' || kind === 'arch'));
    m.position.set(x, 0, z);
    m.rotation.y = rng.range(0, 6.28);
    m.castShadow = true; m.receiveShadow = true;
    view.group.add(m);
  }
}
if (params.get('focus')) { const d = ISLANDS[+params.get('focus')]; world.camCtl.target.set(d.center[0], 0, d.center[1]); world.camCtl.goal.copy(world.camCtl.target); }
if (params.get('dist')) { world.camCtl.distance = world.camCtl.goalDistance = +params.get('dist'); }
engine.setWorld(world);
engine.start();
window.__engine = engine; window.__world = world;
setTimeout(() => { window.__ready = true; }, 1500);
