import * as THREE from 'three';
import { G } from '../../game/G.js';
import { HomeWorld } from './homeWorld.js';
import { Particles } from '../fx/particles.js';
import { buildModel, buildScaffold, buildCropPlants } from '../buildings/models.js';
import { PROP_BUILDERS } from './props.js';
import { sharedEnvMaterial } from '../materials.js';
import { MonsterView, stageForLevel } from '../monsters/builder.js';
import { eggMesh } from '../monsters/eggs.js';
import { ISLANDS, ISLAND_BY_ID } from '../../data/islands.js';
import { BUILDINGS } from '../../data/buildings.js';
import { CROP_BY_ID } from '../../data/crops.js';
import { theme as getTheme } from './themes.js';
import { buildIslandTerrain } from './island.js';
import { activeObstacles, islandGrid, canPlace, footprintCells } from '../../systems/buildings.js';
import { species, byId as monById } from '../../systems/monsters.js';
import { RNG } from '../../core/rng.js';
import * as Geo from '../geom.js';

const _v = new THREE.Vector3();
const _v2 = new THREE.Vector3();

export function buildingWorldPos(b, out = new THREE.Vector3()) {
  const def = ISLAND_BY_ID[b.island];
  const [w, d] = BUILDINGS[b.type].size;
  return out.set(def.center[0] + b.x + w / 2, 0, def.center[1] + b.z + d / 2);
}

// A monster living in a habitat: wanders, naps, hops and occasionally looks at you.
class MonsterActor {
  constructor(home, m, center, radius) {
    this.home = home;
    this.m = m;
    this.stage = stageForLevel(m.lvl);
    this.view = new MonsterView(species(m.sp), this.stage);
    this.view.group.userData.pickMonster = m.id;
    this.center = center.clone();
    this.radius = radius;
    const a = Math.random() * Math.PI * 2;
    const r = Math.random() * radius * 0.6;
    this.view.group.position.set(center.x + Math.cos(a) * r, 0.3, center.z + Math.sin(a) * r);
    this.view.group.rotation.y = Math.random() * Math.PI * 2;
    this.heading = this.view.group.rotation.y;
    this.state = 'idle';
    this.timer = 0.5 + Math.random() * 3;
    this.target = new THREE.Vector3();
    this.emitT = Math.random();
    this.zzzT = 0;
    home.scene.add(this.view.group);
  }
  setCenter(c) {
    this.center.copy(c);
    this.view.group.position.set(c.x, 0.3, c.z);
  }
  update(dt, camPos) {
    const g = this.view.group;
    const an = this.view.animator;
    this.timer -= dt;
    if (this.state === 'walk') {
      _v.copy(this.target).sub(g.position);
      _v.y = 0;
      const dist = _v.length();
      if (dist < 0.08 || this.timer <= 0) {
        this.state = 'idle';
        this.timer = 1.5 + Math.random() * 3.5;
        an.setState('idle');
      } else {
        const desired = Math.atan2(_v.x, _v.z);
        let diff = desired - this.heading;
        while (diff > Math.PI) diff -= Math.PI * 2;
        while (diff < -Math.PI) diff += Math.PI * 2;
        this.heading += diff * Math.min(1, dt * 6);
        g.rotation.y = this.heading;
        const sp = 0.55 * Math.min(1, dist * 3);
        g.position.x += Math.sin(this.heading) * sp * dt;
        g.position.z += Math.cos(this.heading) * sp * dt;
      }
    } else if (this.state === 'sleep') {
      this.zzzT -= dt;
      if (this.zzzT <= 0) {
        this.zzzT = 1.4;
        this.view.topPoint(_v2);
        this.home.particles.emit('zzz', _v2, { count: 1, spread: 0.05 });
      }
      if (this.timer <= 0) {
        this.state = 'idle';
        this.timer = 2;
        an.setState('idle');
        an.play('jump', { intensity: 0.6 });
      }
    } else if (this.timer <= 0) {
      const r = Math.random();
      if (r < 0.55) {
        const a = Math.random() * Math.PI * 2;
        const rr = Math.sqrt(Math.random()) * this.radius;
        this.target.set(this.center.x + Math.cos(a) * rr, 0, this.center.z + Math.sin(a) * rr);
        this.state = 'walk';
        this.timer = 6;
        an.setState('walk');
      } else if (r < 0.68) {
        an.play(Math.random() < 0.5 ? 'hop' : 'happy');
        this.timer = 2 + Math.random() * 2;
      } else if (r < 0.76) {
        this.state = 'sleep';
        this.timer = 8 + Math.random() * 10;
        an.setState('sleep');
      } else {
        // look toward the camera for a moment
        _v.copy(camPos).sub(g.position);
        const yaw = Math.atan2(_v.x, _v.z);
        let diff = yaw - this.heading;
        while (diff > Math.PI) diff -= Math.PI * 2;
        while (diff < -Math.PI) diff += Math.PI * 2;
        this.lookT = 2.2;
        an.lookAt(Math.max(-0.9, Math.min(0.9, diff)), -0.25);
        this.timer = 2.4 + Math.random() * 2;
      }
    }
    if (this.lookT > 0) {
      this.lookT -= dt;
      if (this.lookT <= 0) an.lookAt(0, 0);
    }
    // ambient emitters (embers from flames, final-form auras)
    this.view.ambient(this.home.particles, dt);
    this.view.update(dt);
  }
  dispose() {
    this.view.dispose();
  }
}

export class HomeView extends HomeWorld {
  constructor(engine) {
    super(engine);
    this.particles = new Particles(this.scene, 1600);
    this.bViews = new Map();
    this.oViews = new Map();
    this.actors = new Map();
    this.locked = new Map();
    this.placing = null;
    this.selectedId = null;
    this.selRing = this._makeSelRing();
    this.scene.add(this.selRing);
    this.time = 0;
    this.shake = 0;
    this.oneShots = [];
  }

  _makeSelRing() {
    const g = new THREE.RingGeometry(0.9, 1.05, 48);
    g.rotateX(-Math.PI / 2);
    const m = new THREE.Mesh(g, new THREE.MeshBasicMaterial({ color: '#ffe27a', transparent: true, opacity: 0.85, depthWrite: false, toneMapped: false }));
    m.renderOrder = 3;
    m.visible = false;
    return m;
  }

  // ---------------------------------------------------------------- islands
  initFromState() {
    const st = G.state;
    for (const def of ISLANDS) {
      if (st.islands.includes(def.id)) this.addIsland(def, true);
      else this._addLockedIsland(def);
    }
    this._rebuildBridges();
    this.setBoundsFromIslands(st.islands);
    this.syncAll();
  }

  _addLockedIsland(def) {
    // A soft silhouette of the island under a cap of clouds, with a lock label.
    const t = buildIslandTerrain({ seed: def.seed, radius: def.radius, themeName: def.theme, lowDetail: true });
    t.group.position.set(def.center[0], -1.5, def.center[1]);
    // fade the land toward the haze so it reads as distant and undiscovered
    const haze = new THREE.Color('#d9e1f2');
    const tmp = new THREE.Color();
    t.group.traverse((o) => {
      const col = o.isMesh && o.geometry.attributes.color;
      if (!col) return;
      for (let i = 0; i < col.count; i++) {
        tmp.fromBufferAttribute(col, i).lerp(haze, 0.35);
        col.setXYZ(i, tmp.r, tmp.g, tmp.b);
      }
      col.needsUpdate = true;
    });
    // all puffs of one island are merged into a single draw call
    const rng = new RNG(def.seed);
    const puffs = [];
    const puff = (r, x, y, z, sx, sy, sz) => puffs.push(Geo.xf(Geo.ico(r, 2), { p: [x, y, z], s: [sx, sy, sz] }));
    // cloud cap hiding the land
    puff(rng.range(3, 3.6), rng.range(-1, 1), 1.3, rng.range(-1, 1), 1.3, 0.62, 1.1);
    for (const [n, rf, y0] of [[6, 0.36, 0.9], [10, 0.72, 0.4]]) {
      for (let i = 0; i < n; i++) {
        const a = (i / n) * Math.PI * 2 + rng.range(-0.2, 0.2);
        const r = def.radius * rf * rng.range(0.9, 1.1);
        puff(rng.range(2.4, 3.4), Math.cos(a) * r, y0 + rng.range(0, 0.9), Math.sin(a) * r, 1.3, 0.62, 1.1);
      }
    }
    // a cloud bank hugging the cliffs so undiscovered islands read as soft, not dark
    for (let i = 0; i < 12; i++) {
      const a = (i / 12) * Math.PI * 2 + rng.range(-0.15, 0.15);
      const r = def.radius * rng.range(0.78, 1.02);
      puff(rng.range(2.6, 4.2), Math.cos(a) * r, rng.range(-5.5, -1.2), Math.sin(a) * r, 1.35, 0.72, 1.2);
    }
    t.group.add(new THREE.Mesh(Geo.merge(puffs), lockedMistMaterial()));
    t.group.userData.lockedIsland = def.id;
    this.scene.add(t.group);
    this.locked.set(def.id, t.group);
  }

  unlockIslandVisual(id) {
    const g = this.locked.get(id);
    if (g) {
      this.scene.remove(g);
      this.locked.delete(id);
      g.traverse((o) => o.isMesh && o.geometry.dispose());
    }
    const view = this.addIsland(ISLAND_BY_ID[id], true);
    view.group.position.y = -3;
    this._rebuildBridges();
    this.setBoundsFromIslands(G.state.islands);
    this.syncAll();
    return view;
  }

  _rebuildBridges() {
    if (this.bridges) this.scene.remove(this.bridges);
    const parts = [];
    for (const id of G.state.islands) {
      const d = ISLAND_BY_ID[id];
      for (const to of d.bridgeTo || []) {
        if (!G.state.islands.includes(to)) continue;
        const e = ISLAND_BY_ID[to];
        const a = new THREE.Vector3(d.center[0], 0, d.center[1]);
        const b = new THREE.Vector3(e.center[0], 0, e.center[1]);
        const dir = b.clone().sub(a).normalize();
        const start = a.clone().addScaledVector(dir, d.radius - 0.4);
        const end = b.clone().addScaledVector(dir, -(e.radius - 0.4));
        const len = start.distanceTo(end);
        const n = Math.ceil(len / 0.55);
        const side = new THREE.Vector3(-dir.z, 0, dir.x);
        for (let i = 0; i <= n; i++) {
          const t = i / n;
          const p = start.clone().lerp(end, t);
          p.y = -0.12 - Math.sin(t * Math.PI) * 0.9;
          const plank = Geo.box(0.42, 0.08, 1.4);
          Geo.xf(plank, { p: [p.x, p.y, p.z], r: [0, Math.atan2(dir.x, dir.z) + Math.PI / 2, 0] });
          Geo.paint(plank, new THREE.Color(i % 2 ? '#a8703f' : '#9a6238'));
          parts.push(plank);
          if (i % 3 === 0) {
            for (const s of [-1, 1]) {
              const post = Geo.cylinder(0.05, 0.05, 0.6, 5);
              Geo.xf(post, { p: [p.x + side.x * 0.7 * s, p.y + 0.3, p.z + side.z * 0.7 * s] });
              Geo.paint(post, '#7a4a2a');
              parts.push(post);
            }
          }
        }
        for (const s of [-1, 1]) {
          const pts = [];
          for (let i = 0; i <= 12; i++) {
            const t = i / 12;
            const p = start.clone().lerp(end, t).addScaledVector(side, 0.7 * s);
            p.y = 0.45 - Math.sin(t * Math.PI) * 0.95;
            pts.push(p);
          }
          const rope = Geo.taperTube(pts, 0.03, 4, 24);
          Geo.paint(rope, '#e8d4a0');
          parts.push(rope);
        }
      }
    }
    if (!parts.length) return;
    this.bridges = new THREE.Mesh(Geo.merge(parts), sharedEnvMaterial(false));
    this.bridges.castShadow = true;
    this.bridges.receiveShadow = true;
    this.scene.add(this.bridges);
  }

  // ---------------------------------------------------------------- sync
  syncAll() {
    this.syncObstacles();
    this.syncBuildings();
    this.syncMonsters();
    this.refreshDecor();
  }

  refreshDecor() {
    for (const [id, view] of this.islands) {
      const blocked = new Set();
      for (const b of G.state.buildings) if (b.island === id) for (const c of footprintCells(b.type, b.x, b.z)) blocked.add(c);
      view.refreshDecor((x, z) => blocked.has(`${Math.floor(x)},${Math.floor(z)}`));
    }
  }

  // Obstacles are drawn as merged batches (one per material) rather than one
  // mesh each; the per-obstacle meshes stay out of the scene and are only used
  // for picking and for the removal animation.
  syncObstacles() {
    const alive = new Set();
    let changed = false;
    for (const id of G.state.islands) {
      const def = ISLAND_BY_ID[id];
      const T = getTheme(def.theme);
      for (const o of activeObstacles(id)) {
        alive.add(o.id);
        if (this.oViews.has(o.id)) continue;
        const builder = PROP_BUILDERS[o.model] || PROP_BUILDERS.rock;
        const geo = builder(T, o.seed);
        const flat = o.kind.startsWith('rock') || o.kind === 'ruin' || o.kind === 'arch';
        const mesh = new THREE.Mesh(geo, sharedEnvMaterial(flat));
        mesh.castShadow = true;
        mesh.receiveShadow = true;
        const s = o.kind === 'tree' ? 1.05 : o.kind === 'rockBig' ? 1.25 : 1;
        mesh.scale.setScalar(s);
        mesh.position.set(def.center[0] + o.x + o.w / 2, 0, def.center[1] + o.z + o.d / 2);
        mesh.rotation.y = o.rot;
        mesh.userData.pickObstacle = o.id;
        mesh.userData.flat = flat;
        mesh.updateMatrixWorld(true);
        this.oViews.set(o.id, mesh);
        changed = true;
      }
    }
    for (const [id, mesh] of this.oViews) {
      if (!alive.has(id)) {
        mesh.geometry.dispose();
        this.oViews.delete(id);
        changed = true;
      }
    }
    if (changed || !this.oBatch) this._rebuildObstacleBatch();
  }

  _rebuildObstacleBatch() {
    for (const m of this.oBatch || []) {
      this.scene.remove(m);
      m.geometry.dispose();
    }
    this.oBatch = [];
    for (const flat of [true, false]) {
      const parts = [];
      for (const mesh of this.oViews.values()) {
        if (mesh.userData.flat === flat) parts.push(mesh.geometry.clone().applyMatrix4(mesh.matrixWorld));
      }
      if (!parts.length) continue;
      const batch = new THREE.Mesh(Geo.merge(parts), sharedEnvMaterial(flat));
      batch.castShadow = true;
      batch.receiveShadow = true;
      this.scene.add(batch);
      this.oBatch.push(batch);
    }
  }

  removeObstacleAnimated(id) {
    const mesh = this.oViews.get(id);
    if (!mesh) return;
    this.oViews.delete(id);
    this._rebuildObstacleBatch();
    this.scene.add(mesh);
    const start = this.time;
    const s0 = mesh.scale.x;
    this.particles.emit('puff', mesh.position.clone().setY(0.5), { count: 16, spread: 0.5 });
    this.particles.emit('leaf', mesh.position.clone().setY(0.8), { count: 8, spread: 0.5 });
    const anim = () => {
      const k = (this.time - start) / 0.35;
      if (k >= 1) {
        this.scene.remove(mesh);
        mesh.geometry.dispose();
        return true;
      }
      mesh.scale.setScalar(s0 * (1 - k) * (1 + Math.sin(k * Math.PI) * 0.3));
      return false;
    };
    this.oneShots.push(anim);
  }

  _bKey(b) {
    return `${b.type}:${b.level}:${b.state === 'building' ? 'b' : 'r'}`;
  }

  syncBuildings() {
    const alive = new Set();
    for (const b of G.state.buildings) {
      if (!G.state.islands.includes(b.island)) continue;
      alive.add(b.id);
      let v = this.bViews.get(b.id);
      const key = this._bKey(b);
      if (!v) {
        v = { id: b.id, group: new THREE.Group(), key: null, model: null, crop: null, cropStage: -1, eggs: null, parents: null };
        v.group.userData.pickBuilding = b.id;
        this.scene.add(v.group);
        this.bViews.set(b.id, v);
      }
      if (v.key !== key) {
        if (v.model) v.group.remove(v.model);
        const [w, d] = BUILDINGS[b.type].size;
        v.model = b.state === 'building' ? buildScaffold(w, d) : buildModel(b.type, b.level);
        v.model.traverse((o) => (o.userData.pickBuilding = b.id));
        v.group.add(v.model);
        v.key = key;
      }
      buildingWorldPos(b, v.group.position);
    }
    for (const [id, v] of this.bViews) {
      if (!alive.has(id)) {
        this.scene.remove(v.group);
        this.bViews.delete(id);
      }
    }
  }

  // Habitat interior radius for wandering monsters
  syncMonsters() {
    const want = new Map();
    for (const m of G.state.monsters) {
      if (!m.hab) continue;
      const b = G.state.buildings.find((x) => x.id === m.hab);
      if (!b || !G.state.islands.includes(b.island)) continue;
      want.set(m.id, b);
    }
    for (const [id, a] of this.actors) {
      const m = monById(id);
      if (!want.has(id) || !m || stageForLevel(m.lvl) !== a.stage) {
        a.dispose();
        this.actors.delete(id);
      }
    }
    for (const [id, b] of want) {
      const c = buildingWorldPos(b, new THREE.Vector3());
      const a = this.actors.get(id);
      if (a) {
        if (a.center.distanceTo(c) > 0.01) a.setCenter(c);
        continue;
      }
      const m = monById(id);
      this.actors.set(id, new MonsterActor(this, m, c, 0.95));
    }
  }

  actorFor(monId) {
    return this.actors.get(monId) || null;
  }

  // ---------------------------------------------------------------- per-building dynamic visuals
  _updateDynamic(dt) {
    const now = G.now();
    for (const b of G.state.buildings) {
      const v = this.bViews.get(b.id);
      if (!v || b.state === 'building') continue;
      if (b.type === 'farm') {
        let stage = -1;
        if (b.crop) {
          const k = (now - (b.cropStart || now)) / Math.max(1, b.cropUntil - (b.cropStart || now));
          stage = k >= 1 ? 3 : k > 0.6 ? 2 : k > 0.25 ? 1 : 0;
        }
        const key = b.crop ? `${b.crop}:${stage}` : null;
        if (v.cropKey !== key) {
          if (v.crop) v.group.remove(v.crop);
          v.crop = null;
          if (b.crop) {
            v.crop = buildCropPlants(CROP_BY_ID[b.crop], [0.15, 0.45, 0.75, 1][stage]);
            v.group.add(v.crop);
            if (stage === 3) this.particles.emit('sparkle', v.group.position.clone().setY(0.6), { count: 8, spread: 0.7 });
          }
          v.cropKey = key;
        }
      }
      if (b.type === 'hatchery') {
        const key = G.state.hatchery.slice(0, 3).map((e) => e.sp).join(',');
        if (v.eggKey !== key) {
          if (v.eggs) v.group.remove(v.eggs);
          v.eggs = new THREE.Group();
          G.state.hatchery.slice(0, 3).forEach((e, i) => {
            const eg = eggMesh(species(e.sp), { glow: false });
            const a = (i / 3) * Math.PI * 2 + 0.6;
            eg.position.set(Math.cos(a) * 0.28, 0.4, Math.sin(a) * 0.28);
            eg.scale.setScalar(0.55);
            eg.userData.phase = i * 1.3;
            v.eggs.add(eg);
          });
          v.group.add(v.eggs);
          v.eggKey = key;
        }
        if (v.eggs) v.eggs.children.forEach((eg) => (eg.rotation.z = Math.sin(this.time * 3 + eg.userData.phase) * 0.12));
      }
      if (b.type === 'breeding') {
        const br = G.state.breeding;
        const key = br ? `${br.a}-${br.b}` : null;
        if (v.parentKey !== key) {
          if (v.parents) {
            v.parents.forEach((p) => p.dispose());
            v.parents = null;
          }
          if (br) {
            v.parents = [br.a, br.b].map((id, i) => {
              const m = monById(id);
              if (!m) return null;
              const mv = new MonsterView(species(m.sp), stageForLevel(m.lvl), { castShadow: true });
              mv.group.position.copy(v.group.position).add(new THREE.Vector3(i ? 0.75 : -0.75, 0.25, 0.75));
              mv.group.rotation.y = i ? -0.6 : 0.6;
              mv.group.scale.setScalar(0.7);
              this.scene.add(mv.group);
              return mv;
            }).filter(Boolean);
          }
          v.parentKey = key;
        }
        if (v.parents) v.parents.forEach((p) => p.update(dt));
        if (br && Math.random() < dt * 1.5) this.particles.emit('heart', v.group.position.clone().setY(1.6), { count: 1, spread: 0.5 });
      }
      if (v.model && v.model.userData.animate) v.model.userData.animate(this.time, dt);
    }
  }

  // ---------------------------------------------------------------- selection & picking
  pick(clientX, clientY) {
    // Monsters are small and wander around: pick them generously in screen space.
    let bestMon = null, bd = Infinity;
    const eng = this.engine;
    for (const [id, a] of this.actors) {
      if (!a.view.group.visible) continue;
      const base = a.view.group.position;
      const pb = eng.project(_pv.set(base.x, base.y + a.view.worldHeight * 0.45, base.z), this.camera, _po1);
      if (!pb.visible) continue;
      const pt = eng.project(_pv.set(base.x, base.y + a.view.worldHeight, base.z), this.camera, _po2);
      const r = Math.max(24, Math.abs(pb.y - pt.y) * 1.25);
      const d = Math.hypot(pb.x - clientX, pb.y - clientY);
      if (d < r && d < bd) {
        bd = d;
        bestMon = id;
      }
    }
    if (bestMon != null) return { kind: 'monster', id: bestMon };
    const ray = this.camCtl.raycaster(clientX, clientY);
    const targets = [];
    for (const a of this.actors.values()) targets.push(a.view.mesh);
    for (const v of this.bViews.values()) targets.push(v.group);
    for (const m of this.oViews.values()) targets.push(m);
    for (const g of this.locked.values()) targets.push(g);
    const hits = ray.intersectObjects(targets, true);
    for (const hit of hits) {
      let o = hit.object;
      while (o) {
        if (o.userData.monsterView) return { kind: 'monster', id: [...this.actors].find(([, a]) => a.view === o.userData.monsterView)?.[0] };
        if (o.userData.pickMonster) return { kind: 'monster', id: o.userData.pickMonster };
        if (o.userData.pickBuilding) return { kind: 'building', id: o.userData.pickBuilding };
        if (o.userData.pickObstacle) return { kind: 'obstacle', id: o.userData.pickObstacle };
        if (o.userData.lockedIsland !== undefined) return { kind: 'locked', id: o.userData.lockedIsland };
        o = o.parent;
      }
    }
    // fall back to ground cell under the pointer (for tapping empty space)
    const gp = this.camCtl.groundPoint(clientX, clientY, new THREE.Vector3());
    return gp ? { kind: 'ground', point: gp } : null;
  }

  select(id) {
    this.selectedId = id;
    const v = id ? this.bViews.get(id) : null;
    if (v) {
      const b = G.state.buildings.find((x) => x.id === id);
      const [w] = BUILDINGS[b.type].size;
      this.selRing.visible = true;
      this.selRing.scale.setScalar(w * 0.62);
      this.selRing.position.copy(v.group.position).setY(0.06);
      this.bounce(id);
    } else this.selRing.visible = false;
  }

  bounce(id, strength = 1) {
    const v = this.bViews.get(id);
    if (v) v.bounceT = strength;
  }

  // ---------------------------------------------------------------- placement ghost
  startPlacing(type, { buildingId = null, island = null, x = null, z = null } = {}) {
    this.cancelPlacing();
    const model = buildModel(type, 1);
    const [w, d] = BUILDINGS[type].size;
    const fp = new THREE.Mesh(new THREE.PlaneGeometry(w, d), new THREE.MeshBasicMaterial({ color: '#5fd65a', transparent: true, opacity: 0.55, depthWrite: false, toneMapped: false }));
    fp.rotation.x = -Math.PI / 2;
    fp.position.y = 0.04;
    fp.renderOrder = 4;
    const group = new THREE.Group();
    group.add(fp);
    group.add(model);
    this.scene.add(group);
    this.placing = { type, buildingId, island, x, z, group, model, fp, valid: false };
    if (buildingId) {
      const v = this.bViews.get(buildingId);
      if (v) v.group.visible = false;
    }
    this._showGrid(island ?? 0);
    this._updateGhost();
    return this.placing;
  }

  movePlacingTo(island, x, z) {
    if (!this.placing) return;
    this.placing.island = island;
    this.placing.x = x;
    this.placing.z = z;
    this._showGrid(island);
    this._updateGhost();
  }

  // Converts a world point into the island + top-left cell for the ghost footprint.
  cellAt(point) {
    const [w, d] = BUILDINGS[this.placing.type].size;
    let best = null;
    for (const id of G.state.islands) {
      const def = ISLAND_BY_ID[id];
      const lx = point.x - def.center[0], lz = point.z - def.center[1];
      const dist = Math.hypot(lx, lz);
      if (dist < def.radius + 2 && (!best || dist < best.dist)) best = { id, lx, lz, dist };
    }
    if (!best) return null;
    return { island: best.id, x: Math.round(best.lx - w / 2), z: Math.round(best.lz - d / 2) };
  }

  _updateGhost() {
    const p = this.placing;
    if (!p) return;
    const def = ISLAND_BY_ID[p.island];
    const [w, d] = BUILDINGS[p.type].size;
    p.group.position.set(def.center[0] + p.x + w / 2, 0, def.center[1] + p.z + d / 2);
    p.valid = canPlace(p.type, p.island, p.x, p.z, p.buildingId);
    p.fp.material.color.set(p.valid ? '#5fd65a' : '#ff5a4a');
  }

  _showGrid(islandId) {
    if (this.grid && this.grid.userData.island === islandId) {
      this.grid.visible = true;
      return;
    }
    if (this.grid) this.scene.remove(this.grid);
    const g = islandGrid(islandId);
    const def = ISLAND_BY_ID[islandId];
    const pos = [];
    for (const key of g.cells) {
      const [x, z] = key.split(',').map(Number);
      const x0 = def.center[0] + x + 0.06, x1 = def.center[0] + x + 0.94;
      const z0 = def.center[1] + z + 0.06, z1 = def.center[1] + z + 0.94;
      pos.push(x0, 0.03, z0, x0, 0.03, z1, x1, 0.03, z1, x0, 0.03, z0, x1, 0.03, z1, x1, 0.03, z0);
    }
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
    this.grid = new THREE.Mesh(geo, new THREE.MeshBasicMaterial({ color: '#ffffff', transparent: true, opacity: 0.18, depthWrite: false }));
    this.grid.renderOrder = 2;
    this.grid.userData.island = islandId;
    this.scene.add(this.grid);
  }

  cancelPlacing() {
    const p = this.placing;
    if (!p) return;
    this.scene.remove(p.group);
    if (p.buildingId) {
      const v = this.bViews.get(p.buildingId);
      if (v) v.group.visible = true;
    }
    this.placing = null;
    if (this.grid) this.grid.visible = false;
  }

  // ---------------------------------------------------------------- effects
  constructionPoof(b) {
    const p = buildingWorldPos(b, new THREE.Vector3());
    this.particles.emit('dust', p.clone().setY(0.3), { count: 26, spread: 1.0, speed: 1.4 });
    this.particles.emit('sparkle', p.clone().setY(1.2), { count: 14, spread: 1.0 });
    this.bounce(b.id, 1.4);
  }
  coinBurst(b, n = 8) {
    const p = buildingWorldPos(b, new THREE.Vector3());
    this.particles.emit('coin', p.clone().setY(1.2), { count: n, spread: 0.3 });
  }
  worldToScreen(p) {
    return this.engine.project(p, this.camera);
  }

  // ---------------------------------------------------------------- frame
  update(dt, t) {
    super.update(dt, t);
    this.time += dt;
    this.oneShots = this.oneShots.filter((f) => !f());
    this.particles.setScale(this.engine.height * this.engine.renderer.getPixelRatio(), this.camera.fov);
    this.particles.update(dt);
    const camPos = this.camera.position;
    for (const a of this.actors.values()) a.update(dt, camPos);
    this._updateDynamic(dt);
    // building bounce
    for (const v of this.bViews.values()) {
      if (v.bounceT > 0) {
        v.bounceT = Math.max(0, v.bounceT - dt * 3);
        const k = v.bounceT;
        const s = 1 + Math.sin(k * Math.PI * 3) * 0.08 * k;
        v.group.scale.set(1 / Math.sqrt(s), s, 1 / Math.sqrt(s));
      } else if (v.group.scale.y !== 1) v.group.scale.set(1, 1, 1);
    }
    if (this.selRing.visible) {
      const s = this.selRing.userData.base || this.selRing.scale.x;
      this.selRing.userData.base = s;
      this.selRing.material.opacity = 0.55 + Math.sin(this.time * 5) * 0.3;
    }
    if (this.placing) {
      const p = this.placing;
      p.model.position.y = 0.15 + Math.sin(this.time * 4) * 0.08;
      p.fp.material.opacity = 0.45 + Math.sin(this.time * 6) * 0.12;
    }
    // islands rising after unlock
    for (const v of this.islands.values()) {
      if (v.group.position.y < 0) v.group.position.y = Math.min(0, v.group.position.y + dt * 2.5);
    }
  }
}

let _mistMat = null;
function lockedMistMaterial() {
  if (!_mistMat) _mistMat = new THREE.MeshLambertMaterial({ color: '#f4f8ff', emissive: '#8a9ac0', emissiveIntensity: 0.4, transparent: true, opacity: 0.93 });
  return _mistMat;
}
const _pv = new THREE.Vector3();
const _po1 = { x: 0, y: 0, visible: false };
const _po2 = { x: 0, y: 0, visible: false };
