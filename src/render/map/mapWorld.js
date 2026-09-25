import * as THREE from 'three';
import { IsoCameraController } from '../camera.js';
import { buildIslandTerrain } from '../world/island.js';
import { createSky, createCloudSea } from '../world/sky.js';
import { CloudLayer } from '../world/clouds.js';
import { PROP_BUILDERS, createDecorScatter } from '../world/props.js';
import { theme as getTheme } from '../world/themes.js';
import { sharedEnvMaterial, updateGlobalUniforms } from '../materials.js';
import { MonsterView } from '../monsters/builder.js';
import { Particles } from '../fx/particles.js';
import { RNG } from '../../core/rng.js';
import { ease } from '../../core/math.js';
import * as Geo from '../geom.js';

// Campaign world map: a chain of floating islets carrying 30 stage nodes,
// connected by paths and rope bridges, with the region boss waiting at the end.

const ISLETS = 5;
const PER_ISLET = 6;
const SPACING = 17;

function isletCenter(k) {
  return [k % 2 === 0 ? -3.6 : 3.6, -k * SPACING];
}

function localNode(k, i) {
  const t = i / (PER_ISLET - 1);
  const lz = 5.4 - t * 10.8;
  const lx = Math.sin(t * Math.PI * 1.3 + k * 1.9) * 2.8;
  return [lx, lz];
}

export function nodeXZ(s) {
  const k = Math.floor((s - 1) / PER_ISLET);
  const i = (s - 1) % PER_ISLET;
  const [cx, cz] = isletCenter(k);
  const [lx, lz] = localNode(k, i);
  return [cx + lx, cz + lz];
}

export class MapWorld {
  constructor(engine) {
    this.engine = engine;
    this.scene = new THREE.Scene();
    this.camCtl = new IsoCameraController(engine.canvas, { yaw: 0, pitch: 0.95, distance: 30, minDistance: 18, maxDistance: 42, fov: 32 });
    this.camCtl.enabled = false;
    this.camera = this.camCtl.camera;
    this.hemi = new THREE.HemisphereLight('#d9ecff', '#7d6b4a', 1.1);
    this.scene.add(this.hemi);
    this.sun = new THREE.DirectionalLight('#fff0d6', 2.9);
    this.sun.castShadow = true;
    this.sun.shadow.mapSize.set(1024, 1024);
    Object.assign(this.sun.shadow.camera, { left: -22, right: 22, top: 22, bottom: -22, near: 1, far: 80 });
    this.sun.shadow.bias = -0.0006;
    this.sun.shadow.normalBias = 0.03;
    this.sun.shadow.radius = 3;
    this.scene.add(this.sun, this.sun.target);
    this.particles = new Particles(this.scene, 600);
    this.cache = new Map();
    this.cur = null;
    this.avatar = null;
    this.avatarNode = 1;
    this.time = 0;
    this.nodeGeo = Geo.paint(Geo.merge([
      Geo.xf(Geo.cylinder(0.92, 1.05, 0.32, 18), { p: [0, 0.16, 0] }),
      Geo.xf(Geo.cylinder(0.78, 0.92, 0.1, 18), { p: [0, 0.37, 0] }),
    ]), (x, y, z, nx, ny) => new THREE.Color(ny > 0.5 ? '#ffffff' : '#d8d2cc').multiplyScalar(0.92 + Math.random() * 0.08));
    this.nodeMats = {
      cleared: new THREE.MeshStandardMaterial({ color: '#ffd24a', roughness: 0.5, metalness: 0.1, flatShading: true, vertexColors: true }),
      current: new THREE.MeshStandardMaterial({ color: '#fff6e3', emissive: '#ffcf5a', emissiveIntensity: 0.25, roughness: 0.6, flatShading: true, vertexColors: true }),
      locked: new THREE.MeshStandardMaterial({ color: '#9a8f96', roughness: 0.9, flatShading: true, vertexColors: true }),
      boss: new THREE.MeshStandardMaterial({ color: '#e0443a', roughness: 0.6, flatShading: true, vertexColors: true }),
    };
    this.ringMat = new THREE.MeshBasicMaterial({ color: '#ffd84a', transparent: true, opacity: 0.8, toneMapped: false, depthWrite: false });
    this.ring = new THREE.Mesh(new THREE.RingGeometry(1.15, 1.4, 40).rotateX(-Math.PI / 2), this.ringMat);
    this.scene.add(this.ring);
  }

  // Builds (or reuses) the scene content for world w.
  showWorld(world, { onBuilt } = {}) {
    if (this.cur && this.cur.id === world.id) return this.cur;
    if (this.cur) this.scene.remove(this.cur.group);
    let W = this.cache.get(world.id);
    if (!W) {
      W = this._build(world);
      this.cache.set(world.id, W);
      // keep memory in check: at most 3 worlds cached
      if (this.cache.size > 3) {
        for (const [id, w] of this.cache) {
          if (id !== world.id) {
            this._disposeWorld(w);
            this.cache.delete(id);
            break;
          }
        }
      }
    }
    this.cur = W;
    this.scene.add(W.group);
    const T = W.T;
    this.scene.fog = new THREE.Fog(T.fog, 70, 300);
    this.hemi.color.set(T.skyHorizon).lerp(new THREE.Color('#ffffff'), 0.55);
    const [, zEnd] = nodeXZ(30);
    this.camCtl.bounds = { minX: -7, maxX: 7, minZ: zEnd - 2, maxZ: 10 };
    if (onBuilt) onBuilt(W);
    return W;
  }

  _disposeWorld(W) {
    W.group.traverse((o) => {
      if (o.isMesh && o.geometry && !o.userData.shared) o.geometry.dispose();
    });
    if (W.boss) W.boss.dispose();
  }

  _build(world) {
    const T = getTheme(world.theme);
    const group = new THREE.Group();
    const rng = new RNG(`map-${world.id}`);
    const nodes = [];
    for (let k = 0; k < ISLETS; k++) {
      const [cx, cz] = isletCenter(k);
      const boss = k === ISLETS - 1;
      const pts = [];
      for (let i = 0; i < PER_ISLET; i++) pts.push(localNode(k, i));
      // extend the path to the islet edges so bridges meet it
      const first = [pts[0][0], pts[0][1] + 2.5];
      const last = [pts[PER_ISLET - 1][0], pts[PER_ISLET - 1][1] - 2.5];
      const terrain = buildIslandTerrain({
        seed: world.id * 100 + k * 7 + 3,
        radius: boss ? 9.2 : 8.2,
        themeName: world.theme,
        shapeAmp: 0.7,
        paths: [{ points: [k > 0 ? first : pts[0], ...pts, k < ISLETS - 1 ? last : pts[PER_ISLET - 1]], width: 1.25 }],
        lowDetail: false,
        depthScale: 0.85,
      });
      terrain.group.position.set(cx, 0, cz);
      group.add(terrain.group);
      // trees & rocks away from the path
      const props = [];
      const distToPath = (x, z) => {
        let best = Infinity;
        for (let i = 0; i < pts.length - 1; i++) {
          const [ax, az] = pts[i], [bx, bz] = pts[i + 1];
          const dx = bx - ax, dz = bz - az;
          const l2 = dx * dx + dz * dz || 1;
          const t = Math.max(0, Math.min(1, ((x - ax) * dx + (z - az) * dz) / l2));
          best = Math.min(best, Math.hypot(x - (ax + dx * t), z - (az + dz * t)));
        }
        return best;
      };
      const placed = [];
      for (let n = 0; n < 40 && placed.length < 13; n++) {
        const a = rng.range(0, Math.PI * 2);
        const r = Math.sqrt(rng.next()) * 7.4;
        const x = Math.cos(a) * r, z = Math.sin(a) * r;
        if (!terrain.inside(x, z, 0.9)) continue;
        if (distToPath(x, z) < 1.7) continue;
        if (boss && z < -3) continue;
        if (placed.some((p) => Math.hypot(p[0] - x, p[1] - z) < 1.6)) continue;
        placed.push([x, z]);
        const kind = rng.chance(0.8) ? rng.pick(T.trees || ['round']) : 'rock';
        const g = (PROP_BUILDERS[kind] || PROP_BUILDERS.round)(T, world.id * 50 + k * 10 + n).clone();
        const s = rng.range(0.9, 1.4);
        Geo.xf(g, { p: [x, 0, z], r: [0, rng.range(0, 6.28), 0], s: [s, s, s] });
        props.push(g);
      }
      if (props.length) {
        const m = new THREE.Mesh(Geo.merge(props), sharedEnvMaterial(false));
        m.castShadow = true;
        m.receiveShadow = true;
        m.position.set(cx, 0, cz);
        group.add(m);
      }
      const layers = createDecorScatter(T, world.id * 13 + k);
      for (let c = 0; c < 38; c++) {
        const a = rng.range(0, Math.PI * 2);
        const r = Math.sqrt(rng.next()) * 7.6;
        const x0 = Math.cos(a) * r, z0 = Math.sin(a) * r;
        for (let i = 0; i < rng.int(3, 6); i++) {
          const x = x0 + rng.range(-0.7, 0.7), z = z0 + rng.range(-0.7, 0.7);
          if (!terrain.inside(x, z, 0.3) || distToPath(x, z) < 0.9) continue;
          (rng.chance(0.5) ? layers.grass : layers.grass2).add(x, 0, z, rng.range(0, 6.28), rng.range(0.8, 1.3));
        }
      }
      for (let c = 0; c < 8; c++) {
        const a = rng.range(0, Math.PI * 2);
        const r = rng.range(2, 7);
        const x0 = Math.cos(a) * r, z0 = Math.sin(a) * r;
        const layer = rng.pick(layers.flowers);
        for (let i = 0; i < rng.int(2, 4); i++) {
          const x = x0 + rng.range(-0.5, 0.5), z = z0 + rng.range(-0.5, 0.5);
          if (terrain.inside(x, z, 0.4) && distToPath(x, z) > 0.9) layer.add(x, 0, z, rng.range(0, 6.28), 1);
        }
      }
      for (const l of [layers.grass, layers.grass2, layers.pebbles, ...layers.flowers]) {
        l.finalize();
        l.mesh.position.set(cx, 0, cz);
        group.add(l.mesh);
      }
      // stage pedestals
      for (let i = 0; i < PER_ISLET; i++) {
        const s = k * PER_ISLET + i + 1;
        const [x, z] = nodeXZ(s);
        const mesh = new THREE.Mesh(this.nodeGeo, this.nodeMats.locked);
        mesh.userData.shared = true;
        mesh.position.set(x, 0, z);
        if (s === 30) mesh.scale.setScalar(1.5);
        mesh.castShadow = true;
        mesh.receiveShadow = true;
        group.add(mesh);
        nodes[s] = { s, mesh, pos: new THREE.Vector3(x, 0, z), prop: null };
      }
    }
    // rope bridges between islets
    for (let k = 0; k < ISLETS - 1; k++) {
      const a = nodeXZ(k * PER_ISLET + PER_ISLET);
      const b = nodeXZ((k + 1) * PER_ISLET + 1);
      group.add(this._bridge(new THREE.Vector3(a[0], 0, a[1] - 1.2), new THREE.Vector3(b[0], 0, b[1] + 1.2), T));
    }
    // sky & sea
    const sky = createSky({ top: T.skyTop, horizon: T.skyHorizon, sun: T.sun, sunDir: new THREE.Vector3(-0.3, 0.35, -0.9) });
    group.add(sky);
    const sea = createCloudSea({ y: -42, fog: T.fog, color: T.lava ? '#ffe2c8' : '#ffffff', shade: T.lava ? '#d8a08a' : '#b9cdea' });
    group.add(sea);
    const clouds = new CloudLayer({ seed: world.id * 3 + 1, count: 26, area: 110, yRange: [-38, -15], avoidRadius: 12, center: new THREE.Vector3(0, 0, -34) });
    group.add(clouds.group);
    return { id: world.id, world, group, T, nodes, sky, sea, clouds, boss: null };
  }

  _bridge(a, b, T) {
    const parts = [];
    const dir = b.clone().sub(a);
    const len = dir.length();
    dir.normalize();
    const side = new THREE.Vector3(-dir.z, 0, dir.x);
    const n = Math.max(4, Math.round(len / 0.46));
    const wood = new THREE.Color(T.trunk || '#8b5a3c').lerp(new THREE.Color('#c89a64'), 0.35);
    const yaw = Math.atan2(dir.x, dir.z);
    const sag = (t) => -Math.sin(t * Math.PI) * Math.min(1.1, len * 0.06);
    for (let i = 0; i <= n; i++) {
      const t = i / n;
      const p = a.clone().lerp(b, t);
      p.y = sag(t) - 0.04;
      const g = Geo.box(1.25, 0.09, 0.3);
      Geo.xf(g, { p: [p.x, p.y, p.z], r: [0, yaw, (i % 3 - 1) * 0.03] });
      Geo.paint(g, wood.clone().multiplyScalar(0.85 + ((i * 37) % 10) * 0.025));
      parts.push(g);
    }
    // ropes and posts
    for (const sgn of [-1, 1]) {
      const pts = [];
      for (let i = 0; i <= 12; i++) {
        const t = i / 12;
        const p = a.clone().lerp(b, t).addScaledVector(side, 0.66 * sgn);
        p.y = sag(t) + 0.55;
        pts.push(p);
      }
      const rope = Geo.taperTube(pts, 0.035, 5, 24);
      Geo.paint(rope, '#e6cf9f');
      parts.push(rope);
      for (const e of [a, b]) {
        const post = Geo.cylinder(0.07, 0.09, 0.9, 6);
        const pp = e.clone().addScaledVector(side, 0.66 * sgn);
        Geo.xf(post, { p: [pp.x, 0.3, pp.z] });
        Geo.paint(post, wood.clone().multiplyScalar(0.75));
        parts.push(post);
      }
    }
    const m = new THREE.Mesh(Geo.merge(parts), sharedEnvMaterial(true));
    m.castShadow = true;
    m.receiveShadow = true;
    return m;
  }

  // Updates node looks for the current progress.
  // info[s] = { state: 'cleared'|'current'|'locked', type }
  refreshNodes(info) {
    const W = this.cur;
    if (!W) return;
    for (let s = 1; s <= 30; s++) {
      const n = W.nodes[s];
      const it = info[s];
      if (!n || !it) continue;
      n.mesh.material = it.type === 'boss' && it.state !== 'cleared' ? this.nodeMats.boss : this.nodeMats[it.state];
      // type props
      const want = it.type === 'treasure' && it.state !== 'cleared' ? 'chest' : it.type === 'mystery' && it.state !== 'cleared' ? 'crystal' : (it.type === 'elite' || it.type === 'challenge') ? `flag:${it.type}` : null;
      if ((n.prop && n.prop.userData.kind) !== want) {
        if (n.prop) W.group.remove(n.prop);
        n.prop = want ? this._nodeProp(want, W.T) : null;
        if (n.prop) {
          n.prop.userData.kind = want;
          n.prop.position.copy(n.pos);
          n.prop.position.y = 0.42;
          W.group.add(n.prop);
        }
      }
    }
    // boss model on the last node
    if (!W.boss && W.world.boss) this._placeBoss(W);
  }

  _nodeProp(kind, T) {
    const g = new THREE.Group();
    if (kind === 'chest') {
      const body = Geo.paint(Geo.roundedBox(0.7, 0.42, 0.48, 0.06), '#a8683a');
      const lid = Geo.paint(Geo.xf(Geo.roundedBox(0.74, 0.2, 0.52, 0.06), { p: [0, 0.3, 0] }), '#c07a44');
      const band = Geo.paint(Geo.xf(Geo.box(0.12, 0.54, 0.54), { p: [0, 0.12, 0] }), '#ffd24a');
      const lock = Geo.paint(Geo.xf(Geo.box(0.14, 0.14, 0.06), { p: [0, 0.16, 0.26] }), '#ffe89a');
      const m = new THREE.Mesh(Geo.merge([body, lid, band, lock]), sharedEnvMaterial(true));
      m.position.y = 0.21;
      m.rotation.y = -0.3;
      m.castShadow = true;
      g.add(m);
    } else if (kind === 'crystal') {
      const m = new THREE.Mesh(Geo.crystal(0.9, 0.24, 6, 0.4), new THREE.MeshStandardMaterial({ color: '#c89aff', emissive: '#8a5ad8', emissiveIntensity: 0.6, roughness: 0.3, flatShading: true }));
      m.position.y = 0.55;
      m.castShadow = true;
      m.userData.spin = true;
      g.add(m);
    } else if (kind.startsWith('flag')) {
      const color = kind === 'flag:elite' ? '#a35bea' : '#ff8a2a';
      const pole = Geo.paint(Geo.xf(Geo.cylinder(0.04, 0.05, 1.3, 6), { p: [0.62, 0.65, -0.2] }), '#6a4a30');
      const cloth = Geo.paint(Geo.xf(Geo.box(0.5, 0.34, 0.03), { p: [0.88, 1.1, -0.2] }), color);
      const m = new THREE.Mesh(Geo.merge([pole, cloth]), sharedEnvMaterial(true));
      m.castShadow = true;
      g.add(m);
    }
    return g;
  }

  _placeBoss(W) {
    const def = W.world.bossDef;
    if (!def) return;
    const v = new MonsterView(def, 0, { castShadow: true, cloud: false, rim: 0.6 });
    const n = W.nodes[30];
    v.group.position.copy(n.pos).add(new THREE.Vector3(0, 0, -2.6));
    v.group.scale.setScalar(0.9);
    W.group.add(v.group);
    W.boss = v;
  }

  setBossVisible(v) {
    if (this.cur && this.cur.boss) this.cur.boss.group.visible = v;
  }

  // ---------------------------------------------------------------- avatar
  setAvatar(def, stage) {
    if (this.avatar) {
      this.scene.remove(this.avatar.group);
      this.avatar.dispose();
      this.avatar = null;
    }
    if (!def) return;
    this.avatar = new MonsterView(def, stage, { castShadow: true, cloud: false, rim: 0.6 });
    this.avatar.group.scale.setScalar(1.7);
    this.scene.add(this.avatar.group);
    this._placeAvatar(this.avatarNode);
  }

  _placeAvatar(s) {
    this.avatarNode = s;
    if (!this.avatar || !this.cur) return;
    const n = this.cur.nodes[s];
    if (!n) return;
    this.avatar.group.position.copy(n.pos).setY(0.42 * (s === 30 ? 1.5 : 1));
    this.avatar.group.rotation.y = 0.25;
  }

  placeAvatarAt(s) {
    this._placeAvatar(s);
  }

  async hopAvatar(from, to) {
    if (!this.avatar || !this.cur) return;
    for (let s = from; s !== to; s += to > from ? 1 : -1) {
      const a = this.cur.nodes[s].pos, b = this.cur.nodes[s + (to > from ? 1 : -1)].pos;
      const g = this.avatar.group;
      const yaw = Math.atan2(b.x - a.x, b.z - a.z);
      g.rotation.y = yaw;
      const dur = Math.min(0.9, 0.25 + a.distanceTo(b) * 0.05);
      await this._tween(dur, (k) => {
        g.position.lerpVectors(a, b, ease.inOutQuad(k));
        g.position.y = 0.42 + Math.abs(Math.sin(k * Math.PI * Math.max(1, Math.round(a.distanceTo(b) / 2)))) * 0.5;
      });
    }
    this._placeAvatar(to);
    this.avatar.animator.play('happy');
    this.particles.emit('sparkle', this.avatar.group.position.clone().setY(1), { count: 14, spread: 0.5 });
  }

  _tween(dur, fn) {
    return new Promise((resolve) => {
      this._tweens = this._tweens || [];
      this._tweens.push({ t: 0, dur, fn, resolve });
    });
  }

  nodePos(s, out = new THREE.Vector3()) {
    const n = this.cur && this.cur.nodes[s];
    if (!n) return out.set(0, 0, 0);
    return out.copy(n.pos);
  }

  focusNode(s, { instant = false, dist = 30 } = {}) {
    const p = this.nodePos(s, new THREE.Vector3());
    const t = { x: p.x * 0.6, z: p.z - 3 };
    if (instant) {
      this.camCtl.target.set(t.x, 0, t.z);
      this.camCtl.goal.copy(this.camCtl.target);
      this.camCtl.distance = this.camCtl.goalDistance = dist;
      this.camCtl.apply();
      return Promise.resolve();
    }
    return this.camCtl.flyTo(t, dist, 0.8);
  }

  setRing(s) {
    const p = this.nodePos(s, new THREE.Vector3());
    this.ring.position.set(p.x, 0.47 * (s === 30 ? 1.5 : 1), p.z);
    this.ring.scale.setScalar(s === 30 ? 1.5 : 1);
    this.ring.visible = s > 0;
  }

  // Nearest node to a screen point (within a generous radius).
  pickNode(x, y) {
    if (!this.cur) return null;
    let best = null, bd = 60;
    for (let s = 1; s <= 30; s++) {
      const p = this.engine.project(this.cur.nodes[s].pos, this.camera);
      const d = Math.hypot(p.x - x, p.y - y);
      if (d < bd) {
        bd = d;
        best = s;
      }
    }
    return best;
  }

  update(dt, t) {
    this.time += dt;
    updateGlobalUniforms(dt);
    this.camCtl.update(dt);
    const tgt = this.camCtl.target;
    this.sun.target.position.set(tgt.x, 0, tgt.z);
    this.sun.position.set(tgt.x - 12, 26, tgt.z + 14);
    if (this.cur) {
      this.cur.clouds.update(dt, t);
      this.cur.sky.position.copy(this.camera.position);
      this.cur.sea.userData.uniforms.uCenter.value.copy(this.camera.position);
      if (this.cur.boss) this.cur.boss.update(dt);
      for (let s = 1; s <= 30; s++) {
        const n = this.cur.nodes[s];
        if (n && n.prop) {
          const c = n.prop.children[0];
          if (c && c.userData.spin) {
            c.rotation.y += dt * 1.2;
            c.position.y = 0.55 + Math.sin(this.time * 2 + s) * 0.08;
          }
        }
      }
    }
    if (this.avatar) this.avatar.update(dt);
    if (this._tweens) {
      for (let i = this._tweens.length - 1; i >= 0; i--) {
        const tw = this._tweens[i];
        tw.t += dt;
        const k = Math.min(1, tw.t / tw.dur);
        tw.fn(k);
        if (k >= 1) {
          this._tweens.splice(i, 1);
          tw.resolve();
        }
      }
    }
    this.ringMat.opacity = 0.55 + Math.sin(this.time * 4) * 0.3;
    this.ring.rotation.y += dt * 0.6;
    this.particles.setScale(this.engine.height * this.engine.renderer.getPixelRatio(), this.camera.fov);
    this.particles.update(dt);
  }

  resize(w, h) {
    this.camCtl.resize(w, h);
  }
}
