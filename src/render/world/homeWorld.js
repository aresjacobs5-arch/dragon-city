import * as THREE from 'three';
import { RNG } from '../../core/rng.js';
import { IsoCameraController } from '../camera.js';
import { updateGlobalUniforms, sharedEnvMaterial } from '../materials.js';
import { buildIslandTerrain } from './island.js';
import { createSky, createCloudSea } from './sky.js';
import { CloudLayer } from './clouds.js';
import { createPond, createWaterfall, ribbonGeometry, waterMaterial } from './water.js';
import { PROP_BUILDERS, createDecorScatter } from './props.js';
import { theme as getTheme } from './themes.js';
import { ISLANDS } from '../../data/islands.js';
import { Birds } from './birds.js';
import * as G from '../geom.js';

// A visual island in the home archipelago.
export class IslandView {
  constructor(world, def, unlocked) {
    this.world = world;
    this.def = def;
    this.unlocked = unlocked;
    this.group = new THREE.Group();
    this.group.position.set(def.center[0], 0, def.center[1]);
    this.T = getTheme(def.theme);
    this.terrain = buildIslandTerrain({ seed: def.seed, radius: def.radius, themeName: def.theme, paths: def.paths || [] });
    this.group.add(this.terrain.group);
    this.blockers = []; // {x,z,r} local-space circles where decor is hidden (pond, stream)
    this.footprints = []; // rects (local) where decor is hidden (buildings)
    if (def.pond) this._addWater();
    this._addDecor();
    this.world.scene.add(this.group);
  }

  _addWater() {
    const d = this.def;
    const pond = createPond({ x: d.pond.x, z: d.pond.z, radius: d.pond.r, seed: d.seed, theme: this.T });
    this.group.add(pond);
    this.blockers.push({ x: d.pond.x, z: d.pond.z, r: d.pond.r + 0.5 });
    if (d.stream) {
      const pts = [[d.pond.x, 0.045, d.pond.z], ...d.stream.map((p) => [p[0], 0.045, p[1]])];
      const lava = !!this.T.lava;
      const wc = new THREE.Color(this.T.water);
      const mat = waterMaterial({
        deep: lava ? '#d8431a' : wc.clone().offsetHSL(0, 0.05, -0.05).getStyle(),
        shallow: lava ? '#ffb13a' : wc.clone().offsetHSL(0, 0, 0.2).getStyle(),
        flow: new THREE.Vector2(0.05, 0.08),
        lava,
      });
      const stream = new THREE.Mesh(ribbonGeometry(pts, 0.75), mat);
      stream.renderOrder = 1;
      this.group.add(stream);
      for (const p of d.stream) this.blockers.push({ x: p[0], z: p[1], r: 0.8 });
      // waterfall at the island edge following the last stream segment
      const last = d.stream[d.stream.length - 1];
      const ang = Math.atan2(last[1], last[0]);
      const edgeR = this.terrain.R(ang);
      const wf = createWaterfall({ x: Math.cos(ang) * (edgeR - 0.1), z: Math.sin(ang) * (edgeR - 0.1), angle: ang, width: 1.25, drop: 20, color: lava ? '#ff7a1f' : this.T.water, lava });
      this.group.add(wf);
      // stones along the stream banks
      const rng = new RNG(d.seed + 99);
      const stones = [];
      for (let i = 0; i < pts.length - 1; i++) {
        for (let k = 0; k < 3; k++) {
          const t = (k + rng.next()) / 3;
          const x = pts[i][0] + (pts[i + 1][0] - pts[i][0]) * t;
          const z = pts[i][2] + (pts[i + 1][2] - pts[i][2]) * t;
          const dx = pts[i + 1][0] - pts[i][0], dz = pts[i + 1][2] - pts[i][2];
          const l = Math.hypot(dx, dz) || 1;
          for (const side of [-1, 1]) {
            const s = rng.range(0.12, 0.22);
            const g = G.flat(G.jitter(G.ico(1, 0), 0.2, i * 7 + k + side));
            G.xf(g, { p: [x + (-dz / l) * 0.45 * side, 0.03, z + (dx / l) * 0.45 * side], s: [s * 1.3, s * 0.6, s] });
            G.paint(g, new THREE.Color(this.T.rock).multiplyScalar(rng.range(0.85, 1.05)));
            stones.push(g);
          }
        }
      }
      const sm = new THREE.Mesh(G.merge(stones), sharedEnvMaterial(true));
      sm.receiveShadow = true;
      this.group.add(sm);
    }
  }

  _addDecor() {
    const rng = new RNG(this.def.seed * 3 + 1);
    const layers = createDecorScatter(this.T, this.def.seed);
    this.decor = layers;
    const R = this.terrain.R;
    const inside = this.terrain.inside;
    const tryPos = (margin) => {
      for (let k = 0; k < 20; k++) {
        const a = rng.range(0, Math.PI * 2);
        const r = Math.sqrt(rng.next()) * (this.def.radius - margin);
        const x = Math.cos(a) * r, z = Math.sin(a) * r;
        if (inside(x, z, margin) && !this._blockedByWater(x, z)) return [x, z];
      }
      return null;
    };
    // clustered grass
    for (let c = 0; c < 70; c++) {
      const p = tryPos(0.4);
      if (!p) continue;
      const n = rng.int(3, 8);
      for (let i = 0; i < n; i++) {
        const x = p[0] + rng.range(-0.8, 0.8), z = p[1] + rng.range(-0.8, 0.8);
        if (!inside(x, z, 0.3) || this._blockedByWater(x, z)) continue;
        (rng.chance(0.5) ? layers.grass : layers.grass2).add(x, 0, z, rng.range(0, 6.28), rng.range(0.8, 1.5));
      }
    }
    // extra grass near rim
    for (let i = 0; i < 160; i++) {
      const a = rng.range(0, Math.PI * 2);
      const r = R(a) - rng.range(0.25, 1.4);
      const x = Math.cos(a) * r, z = Math.sin(a) * r;
      if (this._blockedByWater(x, z)) continue;
      layers.grass2.add(x, 0, z, rng.range(0, 6.28), rng.range(0.9, 1.6));
    }
    for (let c = 0; c < 26; c++) {
      const p = tryPos(0.6);
      if (!p) continue;
      const layer = rng.pick(layers.flowers);
      const n = rng.int(3, 7);
      for (let i = 0; i < n; i++) {
        const x = p[0] + rng.range(-0.6, 0.6), z = p[1] + rng.range(-0.6, 0.6);
        if (!inside(x, z, 0.4) || this._blockedByWater(x, z)) continue;
        layer.add(x, 0, z, rng.range(0, 6.28), rng.range(0.8, 1.3));
      }
    }
    for (let i = 0; i < 50; i++) {
      const p = tryPos(0.3);
      if (p) layers.pebbles.add(p[0], 0.01, p[1], rng.range(0, 6.28), rng.range(0.6, 1.4));
    }
    const all = [layers.grass, layers.grass2, layers.pebbles, ...layers.flowers];
    for (const l of all) {
      l.finalize();
      this.group.add(l.mesh);
    }
  }

  _blockedByWater(x, z) {
    for (const b of this.blockers) if (Math.hypot(x - b.x, z - b.z) < b.r) return true;
    return false;
  }

  refreshDecor(isBlocked) {
    const all = [this.decor.grass, this.decor.grass2, this.decor.pebbles, ...this.decor.flowers];
    for (const l of all) l.refreshVisibility(isBlocked);
  }
}

export class HomeWorld {
  constructor(engine) {
    this.engine = engine;
    this.scene = new THREE.Scene();
    const T = getTheme('verdant');
    this.scene.fog = new THREE.Fog(T.fog, 110, 360);
    this.camCtl = new IsoCameraController(engine.canvas, { distance: 46, minDistance: 14, maxDistance: 75 });
    this.camera = this.camCtl.camera;

    // Lighting: warm key light with soft shadows, cool sky fill.
    this.hemi = new THREE.HemisphereLight('#d9ecff', '#7d6b4a', 1.05);
    this.scene.add(this.hemi);
    this.sun = new THREE.DirectionalLight('#fff0d6', 3.1);
    this.sunOffset = new THREE.Vector3(-14, 26, 12);
    this.sun.castShadow = true;
    this.sun.shadow.mapSize.set(2048, 2048);
    const sc = this.sun.shadow.camera;
    sc.left = -26; sc.right = 26; sc.top = 26; sc.bottom = -26; sc.near = 1; sc.far = 90;
    this.sun.shadow.bias = -0.0006;
    this.sun.shadow.normalBias = 0.03;
    this.sun.shadow.radius = 3;
    this.scene.add(this.sun);
    this.scene.add(this.sun.target);

    this.sky = createSky({ top: T.skyTop, horizon: T.skyHorizon, sun: T.sun, sunDir: new THREE.Vector3(-0.5, 0.35, -0.8) });
    this.scene.add(this.sky);
    this.cloudSea = createCloudSea({ y: -48, fog: T.fog });
    this.scene.add(this.cloudSea);
    this.clouds = new CloudLayer({ seed: 9, count: 34, area: 150, yRange: [-34, -3], avoidRadius: 26 });
    this.scene.add(this.clouds.group);

    this.islands = new Map();
    this.birds = new Birds(this.scene);
    this._buildBackground();
  }

  addIsland(def, unlocked = true) {
    const view = new IslandView(this, def, unlocked);
    this.islands.set(def.id, view);
    return view;
  }

  _buildBackground() {
    const rng = new RNG(1234);
    this.bgIslands = [];
    const themes = ['verdant', 'verdant', 'coral', 'arcane', 'verdant', 'celestial', 'storm', 'verdant'];
    for (let i = 0; i < 9; i++) {
      const a = (i / 9) * Math.PI * 2 + rng.range(-0.2, 0.2);
      // keep background isles mostly behind the play area (away from camera side)
      const dist = rng.range(130, 220);
      const x = Math.cos(a) * dist - 30, z = Math.sin(a) * dist - 40;
      const t = buildIslandTerrain({ seed: 500 + i, radius: rng.range(4, 9), themeName: themes[i % themes.length], lowDetail: true, depthScale: 0.9 });
      t.group.position.set(x, rng.range(-25, 10), z);
      t.group.rotation.y = rng.range(0, 6.28);
      // a few trees
      const T = t.theme;
      const trees = [];
      const n = rng.int(2, 5);
      for (let k = 0; k < n; k++) {
        const kind = rng.pick(T.trees);
        const g = (PROP_BUILDERS[kind] || PROP_BUILDERS.round)(T, 900 + i * 10 + k).clone();
        const aa = rng.range(0, 6.28), rr = rng.range(0, t.radius * 0.6);
        const s = rng.range(1.0, 1.6);
        G.xf(g, { p: [Math.cos(aa) * rr, 0, Math.sin(aa) * rr], s: [s, s, s] });
        trees.push(g);
      }
      const tm = new THREE.Mesh(G.merge(trees), sharedEnvMaterial(false));
      t.group.add(tm);
      t.group.userData.bob = rng.range(0, 6.28);
      t.group.userData.baseY = t.group.position.y;
      this.scene.add(t.group);
      this.bgIslands.push(t.group);
    }
  }

  setBoundsFromIslands(ids) {
    let minX = Infinity, maxX = -Infinity, minZ = Infinity, maxZ = -Infinity;
    for (const id of ids) {
      const d = ISLANDS[id];
      if (!d) continue;
      minX = Math.min(minX, d.center[0] - d.radius);
      maxX = Math.max(maxX, d.center[0] + d.radius);
      minZ = Math.min(minZ, d.center[1] - d.radius);
      maxZ = Math.max(maxZ, d.center[1] + d.radius);
    }
    this.camCtl.bounds = { minX: minX - 4, maxX: maxX + 4, minZ: minZ - 4, maxZ: maxZ + 4 };
  }

  update(dt, t) {
    updateGlobalUniforms(dt);
    this.camCtl.update(dt);
    // shadow camera follows the view target (texel snapped to avoid shimmer)
    const tgt = this.camCtl.target;
    const snap = 52 / 2048;
    const sx = Math.round(tgt.x / snap) * snap, sz = Math.round(tgt.z / snap) * snap;
    this.sun.target.position.set(sx, 0, sz);
    this.sun.position.set(sx + this.sunOffset.x, this.sunOffset.y, sz + this.sunOffset.z);
    this.clouds.update(dt, t);
    this.cloudSea.userData.uniforms.uCenter.value.copy(this.camera.position);
    this.sky.position.copy(this.camera.position);
    this.birds.update(dt, t, tgt);
    for (const g of this.bgIslands) g.position.y = g.userData.baseY + Math.sin(t * 0.25 + g.userData.bob) * 0.8;
  }

  resize(w, h) {
    this.camCtl.resize(w, h);
  }
}
