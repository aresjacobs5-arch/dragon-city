import * as THREE from 'three';
import { buildIslandTerrain } from '../world/island.js';
import { createSky, createCloudSea } from '../world/sky.js';
import { CloudLayer } from '../world/clouds.js';
import { PROP_BUILDERS, createDecorScatter } from '../world/props.js';
import { theme as getTheme } from '../world/themes.js';
import { sharedEnvMaterial, updateGlobalUniforms } from '../materials.js';
import { MonsterView, stageForLevel } from '../monsters/builder.js';
import { Particles } from '../fx/particles.js';
import { RNG } from '../../core/rng.js';
import { ELEMENTS } from '../../data/elements.js';
import { clamp, ease } from '../../core/math.js';
import * as Geo from '../geom.js';
import { WeatherFx } from '../fx/weather.js';


// Battle stage: a themed floating arena, the six combatants and all ability
// effects. Every timing runs on "arena time", so 2x / 4x speed scales the
// whole presentation (animations, projectiles, particles and waits).

const FORMATION = [
  [2.7, 0.4],
  [4.6, -2.1],
  [4.3, 2.6],
  [6.0, 0.3],
];
const BOSS_FORMATION = [
  [5.2, -1.1],
  [2.4, -2.7],
  [2.6, 2.5],
  [1.9, 0.0],
];
// Portrait screens: your team at the bottom, enemies at the top.
const V_FORMATION = [
  [0, 2.5],
  [-1.75, 3.9],
  [1.75, 3.9],
  [0, 5.2],
];
const V_BOSS_FORMATION = [
  [0, -3.7],
  [-1.9, -1.8],
  [1.9, -1.8],
  [0, -1.2],
];

// Particle recipes per element for impacts and trails.
const EL_FX = {
  fire: { hit: 'flame', trail: 'ember', sfx: 'fire' },
  nature: { hit: 'leaf', trail: 'leaf', sfx: 'attack' },
  water: { hit: 'drop', trail: 'bubble', sfx: 'water' },
  earth: { hit: 'rock', trail: 'dust', sfx: 'rock' },
  electric: { hit: 'bolt', trail: 'bolt', sfx: 'zap' },
  ice: { hit: 'snow', trail: 'snow', sfx: 'ice' },
  light: { hit: 'star', trail: 'sparkle', sfx: 'magic' },
  dark: { hit: 'shadow', trail: 'shadow', sfx: 'magic' },
  metal: { hit: 'sparkle', trail: 'sparkle', sfx: 'hit' },
  magic: { hit: 'magic', trail: 'magic', sfx: 'magic' },
  ancient: { hit: 'magic', trail: 'sparkle', sfx: 'magic' },
  void: { hit: 'shadow', trail: 'shadow', sfx: 'magic' },
  celestial: { hit: 'star', trail: 'sparkle', sfx: 'magic' },
  neutral: { hit: 'star', trail: 'sparkle', sfx: 'hit' },
};

export function elementColor(el) {
  return (ELEMENTS[el] && ELEMENTS[el].color) || '#ffffff';
}
export function elementFx(el) {
  return EL_FX[el] || EL_FX.neutral;
}

const _v = new THREE.Vector3();
const _v2 = new THREE.Vector3();
const _q = new THREE.Quaternion();
const UP = new THREE.Vector3(0, 1, 0);

function glowMat(color, opacity = 1) {
  return new THREE.MeshBasicMaterial({ color, transparent: true, opacity, blending: THREE.AdditiveBlending, depthWrite: false, toneMapped: false });
}

const bubbleShader = {
  vertexShader: /* glsl */ `
    varying vec3 vN; varying vec3 vV;
    void main(){ vec4 mv = modelViewMatrix * vec4(position, 1.0); vN = normalize(normalMatrix * normal); vV = normalize(-mv.xyz); gl_Position = projectionMatrix * mv; }`,
  fragmentShader: /* glsl */ `
    uniform vec3 uColor; uniform float uAlpha; uniform float uTime; varying vec3 vN; varying vec3 vV;
    void main(){
      float f = pow(1.0 - abs(dot(vN, vV)), 2.0);
      float band = 0.5 + 0.5 * sin(vN.y * 14.0 + uTime * 3.0);
      gl_FragColor = vec4(uColor * (0.25 + f * 1.3 + band * 0.08), (0.1 + f * 0.9) * uAlpha);
    }`,
};

export class Arena {
  constructor(engine) {
    this.engine = engine;
    this.scene = new THREE.Scene();
    this.camera = new THREE.PerspectiveCamera(34, 1, 0.1, 2400);
    this.speed = 1;
    this.time = 0;
    this.timers = [];
    this.tweens = [];
    this.units = new Map();
    this.envCache = new Map();
    this.env = null;
    this.themeName = null;
    this.mood = 0; // 0 = normal lighting, 1 = dramatic ultimate lighting
    this.moodGoal = 0;
    this.shakeK = 0;
    this.aspect = 16 / 9;

    this.hemi = new THREE.HemisphereLight('#d9ecff', '#7d6b4a', 1.1);
    this.scene.add(this.hemi);
    this.sun = new THREE.DirectionalLight('#fff0d6', 3.0);
    this.sun.position.set(-8, 16, 10);
    this.sun.target.position.set(0, 0, 0);
    this.sun.castShadow = true;
    this.sun.shadow.mapSize.set(1024, 1024);
    Object.assign(this.sun.shadow.camera, { left: -11, right: 11, top: 11, bottom: -11, near: 1, far: 50 });
    this.sun.shadow.bias = -0.0006;
    this.sun.shadow.normalBias = 0.03;
    this.sun.shadow.radius = 3;
    this.scene.add(this.sun, this.sun.target);
    this.ultLight = new THREE.PointLight('#ffffff', 0, 9, 1.6);
    this.scene.add(this.ultLight);

    this.particles = new Particles(this.scene, 2200);
    this.weather = new WeatherFx(this.scene, this.particles, this.camera);
    this.weather.onSfx = (n) => this.onSfx && this.onSfx(n);
    this.fxGroup = new THREE.Group();
    this.scene.add(this.fxGroup);

    // shared fx geometry
    this.geo = {
      sphere: new THREE.SphereGeometry(1, 20, 14),
      beam: new THREE.CylinderGeometry(1, 1, 1, 14, 1, true).rotateX(Math.PI / 2).translate(0, 0, 0.5),
      ring: new THREE.RingGeometry(0.82, 1, 48).rotateX(-Math.PI / 2),
      disc: new THREE.CircleGeometry(1, 40).rotateX(-Math.PI / 2),
      pillar: new THREE.CylinderGeometry(1, 1, 1, 20, 1, true).translate(0, 0.5, 0),
    };

    // camera rig
    this.cam = { pos: new THREE.Vector3(0, 7, 16), look: new THREE.Vector3(0, 1.1, 0) };
    this.camTween = null;
    this.shotName = 'overview';
    this.selRing = new THREE.Mesh(this.geo.ring, new THREE.MeshBasicMaterial({ color: '#ffd84a', transparent: true, opacity: 0.9, depthWrite: false, toneMapped: false }));
    this.selRing.renderOrder = 2;
    this.selRing.visible = false;
    this.scene.add(this.selRing);
    this.targetRings = [];
  }

  // ------------------------------------------------------------------ setup
  setTheme(name) {
    if (this.themeName === name && this.env) return;
    if (this.env) this.scene.remove(this.env.group);
    let env = this.envCache.get(name);
    if (!env) {
      env = this._buildEnv(name);
      this.envCache.set(name, env);
      // keep GPU memory bounded: at most three arenas stay built
      if (this.envCache.size > 3) {
        for (const [k, e] of this.envCache) {
          if (k === name) continue;
          e.group.traverse((o) => {
            if (o.isMesh && o.geometry) o.geometry.dispose();
          });
          this.envCache.delete(k);
          break;
        }
      }
    } else {
      // refresh LRU order
      this.envCache.delete(name);
      this.envCache.set(name, env);
    }
    this.env = env;
    this.themeName = name;
    this.weather.setTheme(name);
    this.scene.add(env.group);
    const T = env.T;
    this.scene.fog = new THREE.Fog(T.fog, 60, 260);
    this.baseHemi = 1.1 * (T.light ?? 1);
    this.baseSun = (T.lava ? 2.6 : 3.0) * (T.light ?? 1);
    this.hemi.color.set(T.skyHorizon).lerp(new THREE.Color('#ffffff'), 0.5);
  }

  _buildEnv(name) {
    const T = getTheme(name);
    const group = new THREE.Group();
    const seed = 77 + name.length * 13 + name.charCodeAt(0);
    const rng = new RNG(seed);
    const terrain = buildIslandTerrain({ seed, radius: 12.5, themeName: name, shapeAmp: 0.55, paths: [{ points: [[-8, 0.2], [-3, 0.1], [3, 0.1], [8, 0.2]], width: 2.4 }] });
    group.add(terrain.group);
    // trees and rocks framing the arena (kept away from the fighting lanes)
    const props = [];
    const trees = T.trees || ['round'];
    const spots = [];
    for (let i = 0; i < 26; i++) {
      const a = rng.range(0, Math.PI * 2);
      const r = rng.range(7.6, 11.2);
      const x = Math.cos(a) * r * 1.05, z = Math.sin(a) * r * 0.85;
      if (z > 3.2 && Math.abs(x) < 9) continue; // keep the camera side clear
      if (!terrain.inside(x, z, 0.8)) continue;
      if (spots.some((s) => Math.hypot(s[0] - x, s[1] - z) < 2.2)) continue;
      spots.push([x, z]);
      const kind = rng.chance(0.78) ? rng.pick(trees) : rng.chance(0.5) ? 'rockBig' : 'rock';
      const builder = PROP_BUILDERS[kind] || PROP_BUILDERS.round;
      const g = builder(T, seed * 3 + i).clone();
      const s = rng.range(1.1, 1.7) * (kind.startsWith('rock') ? 1.2 : 1);
      Geo.xf(g, { p: [x, 0, z], r: [0, rng.range(0, 6.28), 0], s: [s, s, s] });
      props.push(g);
    }
    if (props.length) {
      const m = new THREE.Mesh(Geo.merge(props), sharedEnvMaterial(false));
      m.castShadow = true;
      m.receiveShadow = true;
      group.add(m);
    }
    // grass and flowers
    const layers = createDecorScatter(T, seed);
    for (let c = 0; c < 70; c++) {
      const a = rng.range(0, Math.PI * 2);
      const r = Math.sqrt(rng.next()) * 11;
      const cx = Math.cos(a) * r, cz = Math.sin(a) * r;
      const lane = Math.abs(cz) < 1.6 && Math.abs(cx) < 8;
      const n = rng.int(3, 7);
      for (let i = 0; i < n; i++) {
        const x = cx + rng.range(-0.8, 0.8), z = cz + rng.range(-0.8, 0.8);
        if (!terrain.inside(x, z, 0.3) || lane) continue;
        (rng.chance(0.5) ? layers.grass : layers.grass2).add(x, 0, z, rng.range(0, 6.28), rng.range(0.8, 1.4));
      }
    }
    for (let c = 0; c < 16; c++) {
      const a = rng.range(0, Math.PI * 2);
      const r = rng.range(5, 11);
      const cx = Math.cos(a) * r, cz = Math.sin(a) * r * 0.8;
      const layer = rng.pick(layers.flowers);
      for (let i = 0; i < rng.int(2, 5); i++) {
        const x = cx + rng.range(-0.5, 0.5), z = cz + rng.range(-0.5, 0.5);
        if (terrain.inside(x, z, 0.4)) layer.add(x, 0, z, rng.range(0, 6.28), rng.range(0.8, 1.2));
      }
    }
    for (const l of [layers.grass, layers.grass2, layers.pebbles, ...layers.flowers]) {
      l.finalize();
      group.add(l.mesh);
    }
    // sky, cloud sea, drifting clouds
    const sky = createSky({ top: T.skyTop, horizon: T.skyHorizon, sun: T.sun, sunDir: new THREE.Vector3(-0.4, 0.3, -0.9) });
    group.add(sky);
    const sea = createCloudSea({ y: -40, fog: T.fog, color: T.cloudSea || (T.lava ? '#ffe2c8' : '#ffffff'), shade: T.cloudShade || (T.lava ? '#d8a08a' : '#b9cdea') });
    group.add(sea);
    const clouds = new CloudLayer({ seed: seed + 5, count: 18, area: 90, yRange: [-26, -4], avoidRadius: 18, ...(T.cloudTop ? { top: T.cloudTop, bottom: T.cloudBottom } : {}) });
    group.add(clouds.group);
    // distant islets
    for (let i = 0; i < 5; i++) {
      const a = -Math.PI * 0.95 + (i / 4) * Math.PI * 0.9 + rng.range(-0.1, 0.1);
      const d = rng.range(55, 95);
      const t = buildIslandTerrain({ seed: seed + 40 + i, radius: rng.range(3, 6), themeName: name, lowDetail: true, depthScale: 0.9 });
      t.group.position.set(Math.cos(a) * d * 1.3, rng.range(-18, -6), Math.sin(a) * d - 10);
      group.add(t.group);
    }
    return { group, T, terrain, sky, sea, clouds };
  }

  clearUnits() {
    for (const u of this.units.values()) {
      u.view.dispose();
      if (u.bubble) this.scene.remove(u.bubble);
    }
    this.units.clear();
    for (const r of this.targetRings) this.scene.remove(r);
    this.targetRings = [];
    this.selRing.visible = false;
    while (this.fxGroup.children.length) this.fxGroup.remove(this.fxGroup.children[0]);
    this.timers = [];
    this.tweens = [];
    this.mood = this.moodGoal = 0;
  }

  // units: [{ uid, sp(def), lvl, side, slot, boss }]
  setup({ theme, units, bossFight = false }) {
    this.setTheme(theme);
    this.clearUnits();
    this.bossFight = bossFight;
    this.aspect = this.engine.width / this.engine.height;
    this.vertical = this.aspect < 0.85;
    for (const u of units) this.addUnit(u);
    this.shot('overview', { instant: true });
  }

  slotPos(side, slot, out = new THREE.Vector3()) {
    if (this.vertical) {
      if (side === 1 && this.bossFight) {
        const p = V_BOSS_FORMATION[slot] || V_BOSS_FORMATION[0];
        return out.set(p[0], 0, p[1]);
      }
      const p = V_FORMATION[slot] || V_FORMATION[0];
      return side === 0 ? out.set(p[0], 0, p[1]) : out.set(-p[0], 0, -p[1] + 0.3);
    }
    const table = side === 1 && this.bossFight ? BOSS_FORMATION : FORMATION;
    const p = table[slot] || table[0];
    const sx = side === 0 ? -1 : 1;
    return out.set(p[0] * sx, 0, p[1]);
  }

  facingFor(side) {
    if (this.vertical) return side === 0 ? Math.PI - 0.62 : -0.38;
    return side === 0 ? Math.PI / 2 - 0.42 : -Math.PI / 2 + 0.42;
  }

  // Switches between landscape and portrait formations (called on resize).
  setVertical(v) {
    if (this.vertical === v) return;
    this.vertical = v;
    for (const u of this.units.values()) {
      this.slotPos(u.side, u.slot, u.base);
      u.facing = this.facingFor(u.side);
      if (!this.tweens.length) {
        u.view.group.position.copy(u.base);
        u.view.group.rotation.y = u.facing;
      }
    }
  }

  sideCenter(side, out = new THREE.Vector3()) {
    out.set(0, 0, 0);
    let n = 0;
    for (const u of this.units.values()) {
      if (u.side !== side || !u.alive) continue;
      out.add(u.base);
      n++;
    }
    if (!n) return this.slotPos(side, 0, out);
    return out.multiplyScalar(1 / n);
  }

  addUnit(u, { pop = false } = {}) {
    const view = new MonsterView(u.def, u.boss ? 0 : stageForLevel(u.lvl), { castShadow: true, cloud: false, rim: 0.6 });
    const base = this.slotPos(u.side, u.slot);
    view.group.position.copy(base);
    const facing = this.facingFor(u.side);
    view.group.rotation.y = facing;
    this.scene.add(view.group);
    // bosses tower over everyone else
    const extra = u.boss ? 1.75 : 1;
    view.group.scale.setScalar(extra);
    const radius = view.template.radius * view.template.scale * extra;
    const rec = { uid: u.uid, view, base, facing, side: u.side, slot: u.slot, boss: !!u.boss, alive: true, radius, height: view.worldHeight * extra, bubble: null, def: u.def };
    this.units.set(u.uid, rec);
    if (pop) {
      view.group.scale.setScalar(0.001);
      this.particles.emit('puff', base.clone().setY(0.4), { count: 16, spread: 0.6 });
      this.tween(0.45, (k) => view.group.scale.setScalar(Math.max(0.001, ease.outBack(k) * extra)));
    }
    return rec;
  }

  unit(uid) {
    return this.units.get(uid) || null;
  }

  headPos(uid, out = new THREE.Vector3()) {
    const u = this.units.get(uid);
    if (!u) return out.set(0, 0, 0);
    return u.view.topPoint(out);
  }

  chestPos(uid, out = new THREE.Vector3()) {
    const u = this.units.get(uid);
    if (!u) return out.set(0, 1, 0);
    return out.copy(u.view.group.position).setY(u.view.group.position.y + u.height * 0.55);
  }

  mouthPos(u, out = new THREE.Vector3()) {
    const f = _v2.set(Math.sin(u.facing), 0, Math.cos(u.facing));
    return out.copy(u.view.group.position).addScaledVector(f, u.radius * 0.7).setY(u.view.group.position.y + u.height * 0.62);
  }

  // ------------------------------------------------------------------ time
  wait(sec) {
    return new Promise((r) => this.timers.push({ at: this.time + sec, r }));
  }

  tween(dur, fn, easing = null) {
    return new Promise((resolve) => {
      this.tweens.push({ t: 0, dur: Math.max(0.0001, dur), fn, easing, resolve });
    });
  }

  // ------------------------------------------------------------------ camera
  _overview(out) {
    // fit every living combatant for any aspect ratio
    const vfov = (this.camera.fov * Math.PI) / 180;
    const hfov = 2 * Math.atan(Math.tan(vfov / 2) * this.aspect);
    let maxX = 2.0, maxH = 1, minZ = 0, maxZ = 0;
    for (const u of this.units.values()) {
      if (!u.alive) continue;
      maxX = Math.max(maxX, Math.abs(u.base.x) + u.radius);
      maxH = Math.max(maxH, u.height);
      minZ = Math.min(minZ, u.base.z);
      maxZ = Math.max(maxZ, u.base.z);
    }
    if (this.vertical) {
      const halfW = Math.max(2.7, maxX + 0.9);
      const elev = 0.66;
      const dist = Math.max(10, halfW / Math.tan(hfov / 2) + 1.5);
      const cz = (minZ + maxZ) * 0.5 + 0.4;
      out.pos.set(0, 0.8 + Math.sin(elev) * dist, cz + Math.cos(elev) * dist);
      out.look.set(0, 0.6, cz - 0.4);
      return out;
    }
    const halfW = Math.max(4.6, maxX + 1.6, maxH * 1.5);
    const dist = Math.max(9, halfW / Math.tan(hfov / 2) + 2.5);
    const elev = 0.36;
    out.pos.set(0, 1.0 + Math.sin(elev) * dist, Math.cos(elev) * dist);
    out.look.set(0, 1.1, -0.2);
    return out;
  }

  shot(name, { uid = null, dur = 0.6, instant = false } = {}) {
    const goal = { pos: new THREE.Vector3(), look: new THREE.Vector3() };
    this._overview(goal);
    const u = uid != null ? this.units.get(uid) : null;
    if (name === 'focus' && u) {
      const p = u.view.group.position;
      goal.look.lerp(_v.set(p.x, u.height * 0.5, p.z), 0.35);
      goal.pos.lerp(_v.set(p.x * 0.6, goal.pos.y * 0.8, goal.pos.z * 0.82), 0.4);
    } else if (name === 'ult' && u) {
      const p = u.view.group.position;
      const f = _v2.set(Math.sin(u.facing), 0, Math.cos(u.facing));
      const size = Math.max(u.height, u.radius * 1.6);
      goal.look.set(p.x, u.height * 0.55, p.z);
      goal.pos.copy(p).addScaledVector(f, size * 1.7 + 1.6).add(_v.set(0, size * 0.55 + 0.7, 1.2));
    } else if (name === 'victory') {
      // look at the winners from the front
      const c = this.sideCenter(0, new THREE.Vector3());
      const f = _v2.set(Math.sin(this.facingFor(0)), 0, Math.cos(this.facingFor(0)));
      goal.look.set(c.x, 0.9, c.z);
      goal.pos.copy(c).addScaledVector(f, 6.5).add(_v.set(this.vertical ? 0 : 1.2, 2.6, this.vertical ? 1.5 : 1.5));
    }
    this.shotName = name;
    if (instant) {
      this.cam.pos.copy(goal.pos);
      this.cam.look.copy(goal.look);
      this.camTween = null;
      return Promise.resolve();
    }
    return new Promise((resolve) => {
      this.camTween = { from: { pos: this.cam.pos.clone(), look: this.cam.look.clone() }, to: goal, t: 0, dur, resolve };
    });
  }

  shake(amount = 0.4) {
    this.shakeK = Math.max(this.shakeK, amount);
  }

  setMood(k) {
    this.moodGoal = k;
  }

  // ------------------------------------------------------------------ selection
  setActive(uid) {
    const u = uid != null ? this.units.get(uid) : null;
    if (!u || !u.alive) {
      this.selRing.visible = false;
      this.activeUid = null;
      return;
    }
    this.activeUid = uid;
    this.selRing.visible = true;
    this.selRing.material.color.set(u.side === 0 ? '#ffd84a' : '#ff6a5a');
  }

  setTargets(uids, color = '#ff5a4a') {
    for (const r of this.targetRings) this.scene.remove(r);
    this.targetRings = [];
    for (const uid of uids) {
      const u = this.units.get(uid);
      if (!u) continue;
      const r = new THREE.Mesh(this.geo.ring, new THREE.MeshBasicMaterial({ color, transparent: true, opacity: 0.85, depthWrite: false, toneMapped: false }));
      r.renderOrder = 2;
      r.userData.uid = uid;
      this.scene.add(r);
      this.targetRings.push(r);
    }
  }

  // Screen-space pick of the unit nearest to a tap (generous radius).
  pickUnit(x, y, filter = null) {
    let best = null, bd = Infinity;
    for (const u of this.units.values()) {
      if (!u.alive || (filter && !filter(u))) continue;
      const p = this.engine.project(this.chestPos(u.uid, _v), this.camera);
      const d = Math.hypot(p.x - x, p.y - y);
      const r = Math.max(60, u.height * 45);
      if (d < r && d < bd) {
        bd = d;
        best = u;
      }
    }
    return best;
  }

  // ------------------------------------------------------------------ reactions
  hitReact(uid, { crit = false, eff = null, el = 'neutral', big = false } = {}) {
    const u = this.units.get(uid);
    if (!u) return;
    u.view.animator.play('hit', { intensity: crit || big ? 1.5 : 1 });
    u.view.flash(eff === 'strong' || crit ? '#fff2c0' : '#ffffff', crit ? 1 : 0.8);
    const c = this.chestPos(uid, new THREE.Vector3());
    const fx = elementFx(el);
    this.particles.emit(fx.hit, c, { count: crit ? 16 : 9, spread: 0.35, speed: 1.3, color: el === 'metal' ? '#e8f0ff' : null });
    this.particles.emit('star', c, { count: crit ? 8 : 3, spread: 0.2, speed: 1.1 });
    if (crit || big) this.shake(crit ? 0.45 : 0.35);
    // knockback wobble (away from the attacker's side)
    const kx = -Math.sin(u.facing), kz = -Math.cos(u.facing);
    const bx = u.view.group.position.x, bz = u.view.group.position.z;
    this.tween(0.22, (k) => {
      if (!u.alive && k < 1) return;
      const w = Math.sin(k * Math.PI) * 0.18;
      u.view.group.position.x = bx + kx * w;
      u.view.group.position.z = bz + kz * w;
    });
  }

  dotReact(uid, status) {
    const u = this.units.get(uid);
    if (!u) return;
    const c = this.chestPos(uid, new THREE.Vector3());
    const type = status === 'burn' ? 'flame' : status === 'poison' ? 'bubble' : 'drop';
    const color = status === 'poison' ? '#8fd13a' : status === 'bleed' ? '#e0334f' : null;
    this.particles.emit(type, c, { count: 10, spread: 0.3, color });
    u.view.flash(status === 'poison' ? '#9fe05a' : status === 'bleed' ? '#ff5a6a' : '#ffb03a', 0.6);
    u.view.animator.play('hit', { intensity: 0.6 });
  }

  healFx(uid) {
    const u = this.units.get(uid);
    if (!u) return;
    const c = this.chestPos(uid, new THREE.Vector3());
    this.particles.emit('plus', c, { count: 10, spread: 0.5 });
    this.particles.emit('sparkle', c, { count: 6, spread: 0.4, color: '#b8ffb0' });
    u.view.flash('#9fff9a', 0.5);
  }

  statusFx(uid, status, kind) {
    const u = this.units.get(uid);
    if (!u) return;
    const c = this.chestPos(uid, new THREE.Vector3());
    if (status === 'freeze') {
      this.particles.emit('snow', c, { count: 18, spread: 0.5 });
      u.view.flash('#bff0ff', 0.9);
    } else if (status === 'stun') {
      this.particles.emit('star', this.headPos(uid, new THREE.Vector3()), { count: 10, spread: 0.3, speed: 0.6 });
    } else if (kind === 'buff') {
      this.aura(uid, status === 'defUp' ? '#5aa8ff' : status === 'spdUp' ? '#ffe066' : status === 'regen' ? '#5dd66a' : '#ff9a3a');
    } else {
      this.particles.emit('shadow', c, { count: 8, spread: 0.3, size: 0.6 });
    }
  }

  aura(uid, color) {
    const u = this.units.get(uid);
    if (!u) return;
    const p = u.view.group.position;
    const m = new THREE.Mesh(this.geo.pillar, glowMat(color, 0.5));
    m.position.set(p.x, 0, p.z);
    const r = Math.max(0.6, u.radius * 1.1);
    m.scale.set(r, 0.01, r);
    this.fxGroup.add(m);
    this.particles.emit('sparkle', _v.set(p.x, 0.2, p.z), { count: 14, spread: r * 0.8, color, up: 1.5 });
    this.tween(0.7, (k) => {
      m.scale.y = Math.max(0.01, u.height * 1.3 * ease.outCubic(Math.min(1, k * 2)));
      m.material.opacity = 0.5 * (1 - k);
      if (k >= 1) this.fxGroup.remove(m);
    });
  }

  setShield(uid, on) {
    const u = this.units.get(uid);
    if (!u) return;
    if (on && !u.bubble) {
      const mat = new THREE.ShaderMaterial({
        uniforms: { uColor: { value: new THREE.Color('#8fd8ff') }, uAlpha: { value: 1 }, uTime: { value: 0 } },
        transparent: true,
        depthWrite: false,
        blending: THREE.AdditiveBlending,
        ...bubbleShader,
      });
      const b = new THREE.Mesh(this.geo.sphere, mat);
      const r = Math.max(u.height * 0.62, u.radius * 1.15, 0.6);
      b.userData.r = r;
      b.scale.setScalar(0.001);
      this.scene.add(b);
      u.bubble = b;
      this.tween(0.35, (k) => b.scale.setScalar(Math.max(0.001, ease.outBack(k) * r)));
    } else if (!on && u.bubble) {
      const b = u.bubble;
      u.bubble = null;
      this.particles.emit('sparkle', b.position, { count: 18, spread: b.userData.r * 0.7, color: '#bfeaff' });
      this.tween(0.25, (k) => {
        b.scale.setScalar(b.userData.r * (1 + k * 0.4));
        b.material.uniforms.uAlpha.value = 1 - k;
        if (k >= 1) this.scene.remove(b);
      });
    }
  }

  async die(uid) {
    const u = this.units.get(uid);
    if (!u || !u.alive) return;
    u.alive = false;
    if (this.activeUid === uid) this.selRing.visible = false;
    this.setShield(uid, false);
    u.view.animator.play('faint');
    await this.wait(0.55);
    const g = u.view.group;
    const s0 = g.scale.x;
    this.particles.emit('puff', g.position.clone().setY(0.4), { count: u.boss ? 40 : 18, spread: u.radius * 0.8, size: u.boss ? 2 : 1 });
    await this.tween(0.35, (k) => {
      g.scale.setScalar(Math.max(0.001, s0 * (1 - ease.inBack(k) * 0.999)));
    });
    g.visible = false;
  }

  celebrate(side = 0) {
    for (const u of this.units.values()) {
      if (u.side !== side || !u.alive) continue;
      u.view.animator.play(Math.random() < 0.5 ? 'happy' : 'jump');
      this.particles.emit('confetti', this.headPos(u.uid, new THREE.Vector3()), { count: 22, spread: 0.6 });
    }
  }

  // ------------------------------------------------------------------ abilities
  // Plays an ability. `impacts` = number of sequential impact moments; onImpact(i)
  // is called at each so damage numbers land exactly when the effect connects.
  async perform(actorUid, ab, targetUids, { impacts = 1, onImpact = () => {}, ult = false, sfx = () => {} } = {}) {
    const a = this.units.get(actorUid);
    if (!a) {
      for (let i = 0; i < impacts; i++) onImpact(i);
      return;
    }
    const el = ab.el || 'neutral';
    const color = elementColor(el);
    const fx = elementFx(el);
    const targets = targetUids.map((id) => this.units.get(id)).filter(Boolean);
    const fire = (i) => onImpact(i);
    const kind = ab.fx || 'melee';
    const self = targets.length === 1 && targets[0] === a;
    // face the first target
    if (targets.length && !self) this._faceToward(a, targets[0]);

    if (ult) await this._ultCharge(a, ab, color, sfx);

    switch (kind) {
      case 'melee': {
        const t = targets[0];
        if (!t) {
          fire(0);
          break;
        }
        await this._dashTo(a, t);
        sfx('attack');
        for (let i = 0; i < impacts; i++) {
          await a.view.animator.play('attack', { duration: impacts > 1 ? 0.4 : 0.55 });
          const tt = targets[Math.min(i, targets.length - 1)];
          this._slashFx(tt, color);
          fire(i);
        }
        await this.wait(0.2);
        await this._dashBack(a);
        break;
      }
      case 'bolt': {
        sfx('attack');
        const castP = a.view.animator.play('cast', { duration: 0.6 });
        await castP;
        const shots = [];
        for (let i = 0; i < impacts; i++) {
          const t = targets[i % Math.max(1, targets.length)] || targets[0];
          if (!t) {
            fire(i);
            continue;
          }
          const from = this.mouthPos(a, new THREE.Vector3());
          const to = this.chestPos(t.uid, new THREE.Vector3());
          shots.push(this.projectile(from, to, color, fx.trail, { size: ult ? 0.5 : 0.28, arc: impacts > 1 ? 1.2 : 0.6 }).then(() => {
            sfx(fx.sfx);
            fire(i);
          }));
          if (impacts > 1) await this.wait(0.14);
        }
        // AoE bolts: one projectile per target, impact together
        if (impacts === 1 && targets.length > 1) {
          // handled by caller as a single impact
        }
        await Promise.all(shots);
        await this.wait(0.15);
        break;
      }
      case 'beam': {
        sfx('charge');
        await a.view.animator.play('cast', { duration: 0.55 });
        const t = targets[0];
        if (!t) {
          fire(0);
          break;
        }
        const from = this.mouthPos(a, new THREE.Vector3());
        const to = this.chestPos(t.uid, new THREE.Vector3());
        await this.beam(from, to, color, fx.trail, { width: ult ? 0.4 : 0.22 });
        sfx(fx.sfx);
        for (let i = 0; i < impacts; i++) fire(i);
        await this.wait(0.25);
        break;
      }
      case 'burst': {
        sfx('charge');
        await a.view.animator.play(ult ? 'roar' : 'cast', { duration: ult ? 0.8 : 0.6 });
        const pts = targets.map((t) => this.chestPos(t.uid, new THREE.Vector3()));
        for (const p of pts) this.burstAt(p, color, fx.hit, ult ? 1.4 : 1);
        sfx('boom');
        this.shake(ult ? 0.6 : 0.35);
        for (let i = 0; i < impacts; i++) fire(i);
        await this.wait(0.35);
        break;
      }
      case 'wave': {
        sfx('whoosh');
        await a.view.animator.play('cast', { duration: 0.55 });
        await this.groundWave(a, targets, color, fx.hit);
        sfx(fx.sfx);
        for (let i = 0; i < impacts; i++) fire(i);
        await this.wait(0.3);
        break;
      }
      case 'rain': {
        sfx('charge');
        await a.view.animator.play('roar', { duration: 0.7 });
        const falls = [];
        let n = 0;
        for (const t of targets) {
          for (let k = 0; k < (ult ? 4 : 3); k++) {
            const to = t.view.group.position.clone().add(_v.set((Math.random() - 0.5) * 0.9, t.height * 0.4, (Math.random() - 0.5) * 0.9));
            const from = to.clone().add(_v.set(-1.5 + Math.random(), 9, -2));
            falls.push(this.wait(n++ * 0.07).then(() => this.projectile(from, to, color, fx.trail, { size: ult ? 0.42 : 0.3, arc: 0, speed: 20 })));
          }
        }
        await this.wait(0.35);
        sfx('boom');
        this.shake(0.5);
        for (let i = 0; i < impacts; i++) fire(i);
        await Promise.all(falls);
        await this.wait(0.2);
        break;
      }
      case 'slam': {
        sfx('whoosh');
        await a.view.animator.play('jump', { duration: 0.6 });
        sfx('rock');
        const side = targets.length ? targets[0].side : 1 - a.side;
        this.groundRing(this.sideCenter(side, new THREE.Vector3()).setY(0.05), color, 5.5, 0.5);
        this.groundRing(a.view.group.position.clone().setY(0.05), '#ffffff', 2.2, 0.35);
        for (const t of targets) this.particles.emit('rock', t.view.group.position.clone().setY(0.3), { count: 10, spread: 0.6 });
        this.shake(0.7);
        for (let i = 0; i < impacts; i++) fire(i);
        await this.wait(0.35);
        break;
      }
      case 'drain': {
        sfx('magic');
        const castP = a.view.animator.play('cast', { duration: 0.7 });
        const t = targets[0];
        await castP;
        if (t) {
          const from = this.mouthPos(a, new THREE.Vector3());
          const to = this.chestPos(t.uid, new THREE.Vector3());
          await this.projectile(from, to, color, fx.trail, { size: 0.26, arc: 0.4 });
          fire(0);
          for (let i = 1; i < impacts; i++) fire(i);
          // life flows back
          const dir = from.clone().sub(to).normalize();
          this.particles.emit('magic', to, { count: 16, spread: 0.3, dir, speed: 3, color: '#ff6a9a' });
          await this.wait(0.35);
          this.healFx(a.uid);
        } else for (let i = 0; i < impacts; i++) fire(i);
        await this.wait(0.2);
        break;
      }
      case 'heal':
      case 'buff':
      case 'shield':
      default: {
        sfx(kind === 'heal' ? 'heal' : kind === 'shield' ? 'shield' : 'buff');
        await a.view.animator.play(kind === 'buff' ? 'roar' : 'cast', { duration: 0.6 });
        for (const t of targets) {
          if (kind === 'heal') this.healFx(t.uid);
          else this.aura(t.uid, kind === 'shield' ? '#8fd8ff' : color);
        }
        for (let i = 0; i < impacts; i++) fire(i);
        await this.wait(0.3);
        break;
      }
    }
    if (ult) this._ultEnd();
    this._faceHome(a);
  }

  async _ultCharge(a, ab, color, sfx) {
    this.setMood(1);
    this.ultLight.color.set(color);
    this.ultLight.position.copy(a.view.group.position).add(_v.set(0, a.height * 0.8 + 0.8, 1.6));
    this.ultLight.intensity = 0;
    this.tween(0.4, (k) => (this.ultLight.intensity = k * 30));
    await this.shot('ult', { uid: a.uid, dur: 0.4 });
    sfx('charge');
    const c = this.chestPos(a.uid, new THREE.Vector3());
    for (let i = 0; i < 6; i++) {
      const p = c.clone().add(_v.set(Math.cos(i) * 1.6, Math.sin(i * 1.7) * 0.8 + 0.4, Math.sin(i) * 1.6));
      this.particles.emit('sparkle', p, { count: 3, dir: c.clone().sub(p).normalize(), speed: 1.4, color });
    }
    this.particles.emit('magic', c, { count: 20, spread: 0.5, color });
    await a.view.animator.play('ult', { duration: 0.9 });
    this.shot('overview', { dur: 0.35 });
    await this.wait(0.12);
  }

  _ultEnd() {
    this.setMood(0);
    this.tween(0.5, (k) => (this.ultLight.intensity = (1 - k) * 30));
  }

  _faceToward(a, t) {
    const d = _v.copy(t.view.group.position).sub(a.view.group.position);
    const yaw = Math.atan2(d.x, d.z);
    const from = a.view.group.rotation.y;
    let diff = yaw - from;
    while (diff > Math.PI) diff -= Math.PI * 2;
    while (diff < -Math.PI) diff += Math.PI * 2;
    this.tween(0.15, (k) => (a.view.group.rotation.y = from + diff * k));
  }

  _faceHome(a) {
    if (!a.alive) return;
    const from = a.view.group.rotation.y;
    let diff = a.facing - from;
    while (diff > Math.PI) diff -= Math.PI * 2;
    while (diff < -Math.PI) diff += Math.PI * 2;
    this.tween(0.25, (k) => (a.view.group.rotation.y = from + diff * k));
  }

  async _dashTo(a, t) {
    const from = a.view.group.position.clone();
    const dir = _v.copy(t.view.group.position).sub(from);
    dir.y = 0;
    const len = dir.length();
    dir.normalize();
    const stop = Math.max(0.9, t.radius + a.radius * 0.8 + 0.25);
    const to = from.clone().addScaledVector(dir, Math.max(0, len - stop));
    this.particles.emit('dust', from.clone().setY(0.15), { count: 6, spread: 0.3 });
    await this.tween(0.24, (k) => {
      a.view.group.position.lerpVectors(from, to, ease.inOutCubic(k));
      a.view.group.position.y = Math.sin(k * Math.PI) * 0.35;
    });
  }

  async _dashBack(a) {
    const from = a.view.group.position.clone();
    const to = a.base;
    await this.tween(0.28, (k) => {
      a.view.group.position.lerpVectors(from, to, ease.inOutCubic(k));
      a.view.group.position.y = Math.sin(k * Math.PI) * 0.3;
    });
    a.view.group.position.copy(to);
  }

  _slashFx(t, color) {
    const c = this.chestPos(t.uid, new THREE.Vector3());
    const m = new THREE.Mesh(this.geo.ring, glowMat(color, 1));
    m.position.copy(c);
    m.lookAt(this.camera.position);
    m.rotateX(Math.PI / 2);
    m.scale.setScalar(0.2);
    this.fxGroup.add(m);
    this.tween(0.25, (k) => {
      m.scale.setScalar(0.2 + k * 1.1);
      m.material.opacity = 1 - k;
      if (k >= 1) this.fxGroup.remove(m);
    });
    this.particles.emit('flash', c, { count: 1, size: 0.8 });
  }

  projectile(from, to, color, trail, { size = 0.3, arc = 0.6, speed = 15 } = {}) {
    const core = new THREE.Mesh(this.geo.sphere, new THREE.MeshBasicMaterial({ color: new THREE.Color(color).lerp(new THREE.Color('#ffffff'), 0.6), toneMapped: false }));
    const glow = new THREE.Mesh(this.geo.sphere, glowMat(color, 0.55));
    glow.scale.setScalar(1.9);
    core.add(glow);
    core.scale.setScalar(size);
    core.position.copy(from);
    this.fxGroup.add(core);
    const dist = from.distanceTo(to);
    const dur = Math.max(0.12, dist / speed);
    let acc = 0;
    return this.tween(dur, (k) => {
      core.position.lerpVectors(from, to, k);
      core.position.y += Math.sin(k * Math.PI) * arc;
      acc += 1;
      if (acc % 2 === 0) this.particles.emit(trail, core.position, { count: 1, spread: size * 0.4, speed: 0.3, color: trail === 'sparkle' ? color : null });
      glow.scale.setScalar(1.7 + Math.sin(this.time * 40) * 0.3);
      if (k >= 1) {
        this.fxGroup.remove(core);
        this.particles.emit('flash', to, { count: 1, size: Math.min(1.4, size * 3.2) });
        this.particles.emit(trail, to, { count: 8, spread: 0.3, speed: 1.4, color: trail === 'sparkle' ? color : null });
      }
    });
  }

  async beam(from, to, color, trail, { width = 0.22 } = {}) {
    const len = from.distanceTo(to);
    const dir = _v.copy(to).sub(from).normalize();
    _q.setFromUnitVectors(new THREE.Vector3(0, 0, 1), dir);
    const outer = new THREE.Mesh(this.geo.beam, glowMat(color, 0.75));
    const inner = new THREE.Mesh(this.geo.beam, glowMat('#ffffff', 0.9));
    for (const m of [outer, inner]) {
      m.position.copy(from);
      m.quaternion.copy(_q);
      this.fxGroup.add(m);
    }
    await this.tween(0.16, (k) => {
      outer.scale.set(width, width, len * k);
      inner.scale.set(width * 0.4, width * 0.4, len * k);
    });
    this.particles.emit('flash', to, { count: 1, size: 1.2 });
    this.particles.emit(trail, to, { count: 14, spread: 0.3, speed: 1.6, color: trail === 'sparkle' ? color : null });
    await this.tween(0.32, (k) => {
      const w = width * (1 + Math.sin(k * 30) * 0.15) * (1 - k * 0.6);
      outer.scale.set(w, w, len);
      inner.scale.set(w * 0.4, w * 0.4, len);
      outer.material.opacity = 0.75 * (1 - k);
      inner.material.opacity = 0.9 * (1 - k);
      if (Math.random() < 0.5) this.particles.emit(trail, from.clone().lerp(to, Math.random()), { count: 1, spread: 0.1, color: trail === 'sparkle' ? color : null });
    });
    this.fxGroup.remove(outer);
    this.fxGroup.remove(inner);
  }

  burstAt(p, color, hit, scale = 1) {
    this.particles.emit('flash', p, { count: 1, size: 1.3 * Math.min(1.2, scale) });
    this.particles.emit('shock', p, { count: 1, size: 1.4 * scale, color });
    this.particles.emit(hit, p, { count: Math.round(18 * scale), spread: 0.4, speed: 1.8 * scale });
    this.particles.emit('sparkle', p, { count: 10, spread: 0.5, color });
    const m = new THREE.Mesh(this.geo.sphere, glowMat(color, 0.7));
    m.position.copy(p);
    this.fxGroup.add(m);
    this.tween(0.4, (k) => {
      m.scale.setScalar(0.3 + ease.outCubic(k) * 1.6 * scale);
      m.material.opacity = 0.7 * (1 - k);
      if (k >= 1) this.fxGroup.remove(m);
    });
  }

  groundRing(p, color, radius = 4, dur = 0.5) {
    const m = new THREE.Mesh(this.geo.ring, glowMat(color, 0.9));
    m.position.copy(p);
    m.position.y = 0.06;
    this.fxGroup.add(m);
    return this.tween(dur, (k) => {
      m.scale.setScalar(0.2 + ease.outCubic(k) * radius);
      m.material.opacity = 0.9 * (1 - k);
      if (k >= 1) this.fxGroup.remove(m);
    });
  }

  async groundWave(a, targets, color, hit) {
    const side = targets.length ? targets[0].side : 1 - a.side;
    const from = a.view.group.position.clone().setY(0.1);
    const center = this.sideCenter(side, new THREE.Vector3());
    const dir = center.clone().sub(from).setY(0);
    if (dir.lengthSq() < 0.01) dir.set(side === 1 ? 1 : -1, 0, 0);
    const travel = dir.length() + 2.2;
    dir.normalize();
    const wall = new THREE.Mesh(this.geo.pillar, glowMat(color, 0.55));
    wall.scale.set(0.5, 1.4, 3.8);
    wall.rotation.y = Math.atan2(dir.x, dir.z) + Math.PI / 2;
    wall.position.copy(from);
    this.fxGroup.add(wall);
    const side2 = new THREE.Vector3(-dir.z, 0, dir.x);
    const hitDone = new Set();
    await this.tween(0.55, (k) => {
      wall.position.copy(from).addScaledVector(dir, travel * k);
      wall.scale.y = 1.4 + Math.sin(k * Math.PI) * 0.8;
      wall.material.opacity = 0.55 * (1 - k * 0.5);
      if (Math.random() < 0.7) {
        const p = wall.position.clone().addScaledVector(side2, (Math.random() - 0.5) * 6).setY(0.4);
        this.particles.emit(hit, p, { count: 1, spread: 0.2, speed: 1.2 });
      }
      for (const t of targets) {
        if (hitDone.has(t.uid)) continue;
        if (_v.copy(t.view.group.position).sub(wall.position).dot(dir) <= 0) {
          hitDone.add(t.uid);
          this.particles.emit(hit, this.chestPos(t.uid, new THREE.Vector3()), { count: 10, spread: 0.3 });
        }
      }
    });
    this.tween(0.2, (k) => {
      wall.material.opacity = 0.3 * (1 - k);
      if (k >= 1) this.fxGroup.remove(wall);
    });
  }

  // ------------------------------------------------------------------ frame
  update(dt) {
    const sdt = dt * this.speed;
    this.time += sdt;
    updateGlobalUniforms(sdt);
    // timers
    if (this.timers.length) {
      const due = this.timers.filter((t) => t.at <= this.time);
      if (due.length) {
        this.timers = this.timers.filter((t) => t.at > this.time);
        for (const t of due) t.r();
      }
    }
    // tweens
    for (let i = this.tweens.length - 1; i >= 0; i--) {
      const tw = this.tweens[i];
      tw.t += sdt;
      const k = Math.min(1, tw.t / tw.dur);
      tw.fn(tw.easing ? tw.easing(k) : k);
      if (k >= 1) {
        this.tweens.splice(i, 1);
        tw.resolve();
      }
    }
    for (const u of this.units.values()) {
      u.view.update(sdt);
      if (u.alive) u.view.ambient(this.particles, sdt);
      if (u.bubble) {
        u.bubble.position.copy(u.view.group.position).setY(u.view.group.position.y + u.height * 0.5);
        u.bubble.material.uniforms.uTime.value = this.time;
      }
    }
    // rings
    const pulse = 1 + Math.sin(this.time * 5) * 0.06;
    if (this.selRing.visible && this.activeUid != null) {
      const u = this.units.get(this.activeUid);
      if (u) {
        this.selRing.position.set(u.view.group.position.x, 0.05, u.view.group.position.z);
        this.selRing.scale.setScalar(Math.max(0.8, u.radius * 1.25) * pulse);
      }
    }
    for (const r of this.targetRings) {
      const u = this.units.get(r.userData.uid);
      if (!u) continue;
      r.position.set(u.view.group.position.x, 0.05, u.view.group.position.z);
      r.scale.setScalar(Math.max(0.8, u.radius * 1.25) * (1 + Math.sin(this.time * 7) * 0.08));
      r.visible = u.alive;
    }
    this.weather.update(dt);
    // mood lighting
    this.mood += (this.moodGoal - this.mood) * (1 - Math.exp(-8 * dt));
    this.hemi.intensity = (this.baseHemi || 1.1) * (1 - this.mood * 0.55) + this.weather.flashK * 1.4;
    this.sun.intensity = (this.baseSun || 3) * (1 - this.mood * 0.6);
    // camera
    if (this.camTween) {
      const c = this.camTween;
      c.t += sdt;
      const k = Math.min(1, c.t / c.dur);
      const e = ease.inOutCubic(k);
      this.cam.pos.lerpVectors(c.from.pos, c.to.pos, e);
      this.cam.look.lerpVectors(c.from.look, c.to.look, e);
      if (k >= 1) {
        this.camTween = null;
        c.resolve();
      }
    } else if (this.shotName === 'overview') {
      // gentle idle drift
      const goal = this._overview({ pos: _v.clone(), look: _v2.clone() });
      this.cam.pos.lerp(goal.pos, 1 - Math.exp(-2 * dt));
      this.cam.look.lerp(goal.look, 1 - Math.exp(-2 * dt));
    }
    this.camera.position.copy(this.cam.pos);
    this.camera.position.x += Math.sin(this.time * 0.35) * 0.18;
    this.camera.position.y += Math.sin(this.time * 0.5) * 0.08;
    if (this.shakeK > 0) {
      this.shakeK = Math.max(0, this.shakeK - dt * 1.8);
      const s = this.shakeK * this.shakeK * 0.5;
      this.camera.position.x += (Math.random() - 0.5) * s;
      this.camera.position.y += (Math.random() - 0.5) * s;
    }
    this.camera.lookAt(this.cam.look);
    if (this.env) {
      this.env.clouds.update(sdt, this.time);
      this.env.sky.position.copy(this.camera.position);
      this.env.sea.userData.uniforms.uCenter.value.copy(this.camera.position);
    }
    this.particles.setScale(this.engine.height * this.engine.renderer.getPixelRatio(), this.camera.fov);
    this.particles.update(sdt);
  }

  resize(w, h) {
    this.aspect = w / h;
    this.camera.aspect = w / h;
    this.camera.fov = w < h ? 46 : 34;
    this.camera.updateProjectionMatrix();
    this.setVertical(w / h < 0.85);
  }
}
