import * as THREE from 'three';
import * as G from '../geom.js';
import { Kit, glowMat } from './kit.js';
import { waterMaterial, pondGeometry } from '../world/water.js';
import { PROP_BUILDERS } from '../world/props.js';
import { theme as getTheme } from '../world/themes.js';
import { RNG } from '../../core/rng.js';

// Procedural building models. Each returns a THREE.Group centered on the
// footprint with userData.animate(t) for moving parts.

const X = (g, p = [0, 0, 0], r = [0, 0, 0], s = [1, 1, 1]) => G.xf(g, { p, r, s });
const STONE = '#cfc3b0';
const STONE_D = '#a89a86';
const WOOD = '#9a6238';
const WOOD_D = '#7a4a2a';
const ROOF_R = '#e0553a';
const GOLD = '#ffc83d';

function rimStones(kit, radius, n, color, h = 0.3, seed = 1) {
  const rng = new RNG(seed);
  for (let i = 0; i < n; i++) {
    const a = (i / n) * Math.PI * 2;
    const g = G.jitter(G.box(0.42, h, 0.34), 0.03, i + seed);
    X(g, [Math.cos(a) * radius, h / 2 + 0.02, Math.sin(a) * radius], [0, -a, 0]);
    kit.add(g, new THREE.Color(color).multiplyScalar(rng.range(0.9, 1.06)), { flat: true });
  }
}

function platform(kit, r, top, side = STONE, h = 0.26) {
  const base = G.cylinder(r, r + 0.08, h, 20);
  X(base, [0, h / 2, 0]);
  kit.add(base, side, { flat: true });
  const inner = G.cylinder(r - 0.12, r - 0.12, 0.04, 24);
  X(inner, [0, h + 0.01, 0]);
  kit.add(inner, top, { form: false });
}

function tree(kit, T, seed, p, s = 1) {
  const g = PROP_BUILDERS.round(T, seed).clone();
  X(g, p, [0, seed, 0], [s, s, s]);
  kit.add(g, 'keep');
}

function crystalCluster(kit, p, color, s = 1, glow = false, n = 4, seed = 1) {
  const rng = new RNG(seed);
  for (let i = 0; i < n; i++) {
    const g = G.crystal(rng.range(0.35, 0.8) * s * (i === 0 ? 1.3 : 1), rng.range(0.07, 0.12) * s, 6);
    X(g, [p[0] + rng.range(-0.12, 0.12) * s, p[1], p[2] + rng.range(-0.12, 0.12) * s], [rng.range(-0.4, 0.4), rng.range(0, 3), rng.range(-0.4, 0.4)]);
    const c = new THREE.Color(color);
    if (glow) kit.add(g, (x, y, z, nx, ny) => c.clone().offsetHSL(0, 0, 0.05 + ny * 0.12), { glow: true });
    else kit.add(g, c.offsetHSL(0, 0, 0), { flat: true });
  }
}

function lantern(kit, p, glowC = '#ffd98a') {
  const post = G.cylinder(0.04, 0.05, 0.7, 6);
  X(post, [p[0], 0.35, p[2]]);
  kit.add(post, WOOD_D);
  const cap = G.cone(0.14, 0.12, 6);
  X(cap, [p[0], 0.86, p[2]]);
  kit.add(cap, '#4a3a3a');
  const lamp = G.sphere(0.09, 8, 6);
  X(lamp, [p[0], 0.74, p[2]]);
  kit.add(lamp, glowC, { glow: true });
}

function flag(kit, p, color, h = 1.3) {
  const pole = G.cylinder(0.03, 0.035, h, 6);
  X(pole, [p[0], h / 2, p[2]]);
  kit.add(pole, '#6a5040');
  const cloth = G.extrudeOutline([[0, 0], [0.42, -0.06], [0.36, -0.16], [0.42, -0.28], [0, -0.3]], 0.015, 0.005);
  X(cloth, [p[0] + 0.02, h - 0.05, p[2]]);
  kit.add(cloth, color);
  const knob = G.sphere(0.05, 6, 4);
  X(knob, [p[0], h + 0.03, p[2]]);
  kit.add(knob, GOLD);
}

// -------------------------------------------------------------------------
// HABITATS
// -------------------------------------------------------------------------
const HAB = {
  fire(kit, L, anims) {
    platform(kit, 1.42, '#5a4442', '#4a3a38');
    rimStones(kit, 1.38, 14, '#3a2e2c', 0.3, 3);
    // lava pool
    const pool = new THREE.Mesh(pondGeometry(0.55, 7, 28), waterMaterial({ deep: '#d8431a', shallow: '#ffb13a', lava: true }));
    pool.position.set(0.55, 0.29, -0.5);
    kit.obj(pool);
    // volcano cone
    const v = G.jitter(G.lathe([[0.62, 0], [0.45, 0.45], [0.26, 0.85], [0.18, 0.95], [0.12, 0.88], [0.001, 0.85]], 12), 0.03, 4);
    X(v, [-0.55, 0.28, -0.45]);
    kit.add(v, (x, y) => new THREE.Color('#3a2a28').lerp(new THREE.Color('#5a3a30'), Math.min(1, y)), { flat: true });
    const top = G.sphere(0.13, 8, 6);
    X(top, [-0.55, 1.18, -0.45], [0, 0, 0], [1, 0.4, 1]);
    kit.add(top, '#ff8a2a', { glow: true });
    // obsidian spikes
    const rng = new RNG(5);
    for (let i = 0; i < 4 + L * 2; i++) {
      const a = rng.range(0, Math.PI * 2);
      const r = rng.range(0.9, 1.2);
      const g = G.cone(rng.range(0.06, 0.1), rng.range(0.3, 0.6), 5);
      X(g, [Math.cos(a) * r, 0.45, Math.sin(a) * r], [rng.range(-0.3, 0.3), 0, rng.range(-0.3, 0.3)]);
      kit.add(g, '#241a1c', { flat: true });
    }
    if (L >= 2) lantern(kit, [1.0, 0.28, 0.75], '#ffb03a');
    if (L >= 3) flag(kit, [-1.05, 0.28, 0.8], '#ff5a2a');
    if (L >= 4) crystalCluster(kit, [0.9, 0.28, 0.9], '#ff8a2a', 0.9, true, 3, 8);
  },
  nature(kit, L, anims, T) {
    platform(kit, 1.42, '#79c451', '#8a6a4a');
    // wooden fence
    const n = 16;
    for (let i = 0; i < n; i++) {
      const a = (i / n) * Math.PI * 2;
      if (i === 3 || i === 4) continue;
      const post = G.box(0.08, 0.34, 0.08);
      X(post, [Math.cos(a) * 1.36, 0.43, Math.sin(a) * 1.36]);
      kit.add(post, WOOD);
      const rail = G.box(0.52, 0.05, 0.05);
      X(rail, [Math.cos(a + Math.PI / n) * 1.35, 0.5, Math.sin(a + Math.PI / n) * 1.35], [0, -a - Math.PI / n + Math.PI / 2, 0]);
      kit.add(rail, WOOD_D);
    }
    tree(kit, T, 11, [-0.62, 0.28, -0.55], 0.9 + L * 0.08);
    // leaf hut
    const hut = G.lathe([[0.5, 0], [0.48, 0.2], [0.38, 0.45], [0.2, 0.62], [0.001, 0.68]], 12);
    X(hut, [0.62, 0.28, -0.55]);
    kit.add(hut, (x, y) => new THREE.Color('#5fae3f').lerp(new THREE.Color('#8fd45a'), y * 1.3));
    const door = G.ellipsoid(0.16, 0.2, 0.06, 10, 8);
    X(door, [0.62, 0.36, -0.08]);
    kit.add(door, '#4a3020');
    // flowers & mushrooms
    const rng = new RNG(4);
    for (let i = 0; i < 6 + L * 2; i++) {
      const a = rng.range(0, 6.28), r = rng.range(0.4, 1.15);
      const f = G.sphere(0.06, 6, 4);
      X(f, [Math.cos(a) * r, 0.34, Math.sin(a) * r]);
      kit.add(f, rng.pick(['#ff7aa2', '#ffd24a', '#ffffff', '#b58cff']));
    }
    if (L >= 2) {
      const m = PROP_BUILDERS.mushroom({ ...T, leaves: ['#e8503a'] }, 3).clone();
      X(m, [0.95, 0.28, 0.55], [0, 0, 0], [0.35, 0.35, 0.35]);
      kit.add(m, 'keep');
    }
    if (L >= 3) flag(kit, [-1.0, 0.28, 0.75], '#5fc43d');
    if (L >= 4) tree(kit, { ...T, leaves: ['#ffb8e0', '#f7a0d2', '#ffd6ee'] }, 12, [0.95, 0.28, -0.95], 0.6);
  },
  water(kit, L) {
    platform(kit, 1.42, '#d8c8a0', '#9aa8b8');
    rimStones(kit, 1.38, 16, '#b8c4d0', 0.32, 7);
    const pool = new THREE.Mesh(pondGeometry(1.08, 3, 36), waterMaterial({ deep: '#1f8ad8', shallow: '#7fe0f7' }));
    pool.position.set(0, 0.31, 0.05);
    kit.obj(pool);
    const rng = new RNG(2);
    for (let i = 0; i < 3; i++) {
      const g = G.jitter(G.ico(rng.range(0.15, 0.24), 0), 0.03, i);
      X(g, [rng.range(-0.7, 0.7), 0.3, rng.range(-0.7, 0.7)], [0, 0, 0], [1.2, 0.6, 1]);
      kit.add(g, '#b8c4d0', { flat: true });
    }
    // coral
    const c = PROP_BUILDERS.coral({ moss: '#ff8fa3' }, 3).clone();
    X(c, [-0.8, 0.28, -0.7], [0, 0, 0], [0.45, 0.45, 0.45]);
    kit.add(c, 'keep');
    if (L >= 2) {
      const c2 = PROP_BUILDERS.coral({ moss: '#ffb86b' }, 9).clone();
      X(c2, [0.85, 0.28, -0.75], [0, 1, 0], [0.4, 0.4, 0.4]);
      kit.add(c2, 'keep');
    }
    if (L >= 3) {
      // fountain spout
      const f = G.cylinder(0.14, 0.2, 0.5, 8);
      X(f, [0, 0.5, 0]);
      kit.add(f, '#e8e0d0', { flat: true });
      const bowl = G.lathe([[0.001, 0], [0.3, 0.02], [0.34, 0.12], [0.28, 0.12], [0.001, 0.05]], 12);
      X(bowl, [0, 0.75, 0]);
      kit.add(bowl, '#e8e0d0');
      const wtr = G.sphere(0.12, 8, 6);
      X(wtr, [0, 0.9, 0], [0, 0, 0], [1, 0.6, 1]);
      kit.add(wtr, '#9fe8ff', { glow: true });
    }
    if (L >= 4) lantern(kit, [1.05, 0.28, 0.9], '#9fe8ff');
  },
  earth(kit, L) {
    platform(kit, 1.42, '#d8a86a', '#a8784a');
    const rng = new RNG(6);
    // mesa rocks
    for (let i = 0; i < 3; i++) {
      const g = G.jitter(G.cylinder(0.35, 0.45, 0.5 + i * 0.2, 7), 0.04, i);
      X(g, [-0.6 + i * 0.25, 0.28 + (0.5 + i * 0.2) / 2, -0.6 + (i % 2) * 0.2]);
      kit.add(g, (x, y) => new THREE.Color('#c8864a').lerp(new THREE.Color('#e8b070'), (Math.sin(y * 18) + 1) / 2 * 0.6), { flat: true });
    }
    // cave arch
    const arch = G.torus(0.38, 0.14, 6, 10, Math.PI);
    X(arch, [0.6, 0.28, -0.5]);
    kit.add(arch, '#b8804a', { flat: true });
    for (let i = 0; i < 5; i++) {
      const g = G.jitter(G.ico(rng.range(0.12, 0.22), 0), 0.03, i + 10);
      X(g, [rng.range(-1, 1), 0.34, rng.range(0.2, 1)]);
      kit.add(g, '#a8784a', { flat: true });
    }
    crystalCluster(kit, [0.9, 0.28, 0.6], '#ffb03a', 0.7, L >= 2, 3, 3);
    if (L >= 3) flag(kit, [-1.05, 0.28, 0.75], '#c8864a');
    if (L >= 4) crystalCluster(kit, [-0.9, 0.28, 0.7], '#ffcf5a', 0.8, true, 4, 5);
  },
  electric(kit, L, anims) {
    platform(kit, 1.42, '#5a6478', '#3f4556');
    // striped floor ring
    const ring = G.torus(1.05, 0.05, 4, 32);
    X(ring, [0, 0.31, 0], [Math.PI / 2, 0, 0]);
    kit.add(ring, '#ffd23f', { glow: true });
    const coil = (x, z, h) => {
      const base = G.cylinder(0.12, 0.16, h, 8);
      X(base, [x, 0.28 + h / 2, z]);
      kit.add(base, '#8a96a8');
      for (let k = 0; k < 3; k++) {
        const t = G.torus(0.13, 0.03, 4, 12);
        X(t, [x, 0.4 + k * (h / 3.2), z], [Math.PI / 2, 0, 0]);
        kit.add(t, '#c07a30');
      }
      const orb = G.sphere(0.12, 10, 8);
      X(orb, [x, 0.34 + h, z]);
      kit.add(orb, '#7fe8ff', { glow: true });
    };
    coil(-0.75, -0.6, 0.9);
    coil(0.75, -0.6, 0.7);
    if (L >= 2) coil(0, -0.95, 1.1);
    const box = G.box(0.4, 0.3, 0.3, 0.05);
    X(box, [0.85, 0.43, 0.6]);
    kit.add(box, '#ffd23f');
    if (L >= 3) flag(kit, [-1.0, 0.28, 0.75], '#ffd23f');
  },
  ice(kit, L) {
    platform(kit, 1.42, '#f0f8ff', '#9fc0de');
    // igloo
    const ig = G.lathe([[0.55, 0], [0.54, 0.15], [0.47, 0.35], [0.33, 0.5], [0.001, 0.56]], 14);
    X(ig, [0.55, 0.28, -0.5]);
    kit.add(ig, (x, y) => new THREE.Color('#ffffff').lerp(new THREE.Color('#cfe8f8'), Math.abs(Math.sin(y * 20)) * 0.4));
    const door = G.ellipsoid(0.16, 0.18, 0.1, 10, 8);
    X(door, [0.55, 0.36, -0.02]);
    kit.add(door, '#4f7aa8');
    crystalCluster(kit, [-0.6, 0.28, -0.55], '#9fe6ff', 1.1, false, 5, 2);
    crystalCluster(kit, [0.9, 0.28, 0.75], '#bff0ff', 0.7, L >= 2, 3, 4);
    const rng = new RNG(8);
    for (let i = 0; i < 5; i++) {
      const s = G.ico(rng.range(0.1, 0.18), 1);
      X(s, [rng.range(-1, 1), 0.3, rng.range(0.1, 1)], [0, 0, 0], [1.3, 0.5, 1.2]);
      kit.add(s, '#ffffff');
    }
    if (L >= 3) flag(kit, [-1.05, 0.28, 0.75], '#7fdcff');
  },
  light(kit, L, anims) {
    platform(kit, 1.42, '#fff6e0', '#e8dcc8');
    for (let i = 0; i < 4; i++) {
      const a = (i / 4) * Math.PI * 2 + Math.PI / 4;
      const p = G.cylinder(0.1, 0.12, 0.9, 10);
      X(p, [Math.cos(a) * 1.05, 0.73, Math.sin(a) * 1.05]);
      kit.add(p, '#fffaf0');
      const cap = G.box(0.28, 0.08, 0.28);
      X(cap, [Math.cos(a) * 1.05, 1.2, Math.sin(a) * 1.05]);
      kit.add(cap, GOLD);
    }
    const orbBase = G.cylinder(0.18, 0.25, 0.4, 10);
    X(orbBase, [0, 0.48, -0.5]);
    kit.add(orbBase, '#fffaf0');
    const orb = new THREE.Mesh(G.paint(G.sphere(0.2, 14, 10), '#ffe27a'), glowMat());
    orb.position.set(0, 0.95, -0.5);
    kit.obj(orb, (t) => (orb.position.y = 0.95 + Math.sin(t * 1.5) * 0.06));
    if (L >= 3) flag(kit, [-0.4, 0.28, 0.9], '#ffe27a');
  },
  dark(kit, L) {
    platform(kit, 1.42, '#3a2e50', '#2a2040');
    const rng = new RNG(9);
    for (let i = 0; i < 3 + L; i++) {
      const a = rng.range(0, 6.28), r = rng.range(0.7, 1.15);
      const g = G.cone(rng.range(0.1, 0.16), rng.range(0.6, 1.1), 5);
      X(g, [Math.cos(a) * r, 0.6, Math.sin(a) * r], [rng.range(-0.3, 0.3), 0, rng.range(-0.3, 0.3)]);
      kit.add(g, '#241c34', { flat: true });
    }
    const ring = G.torus(0.6, 0.04, 4, 28);
    X(ring, [0, 0.31, 0.1], [Math.PI / 2, 0, 0]);
    kit.add(ring, '#b67cff', { glow: true });
    const stone = G.box(0.4, 0.8, 0.2, 0.04);
    X(stone, [0, 0.68, -0.8]);
    kit.add(stone, '#3a2e50', { flat: true });
    const rune = G.box(0.2, 0.3, 0.02);
    X(rune, [0, 0.72, -0.69]);
    kit.add(rune, '#b67cff', { glow: true });
    if (L >= 3) crystalCluster(kit, [0.9, 0.28, 0.7], '#b67cff', 0.8, true, 3, 6);
  },
  metal(kit, L) {
    platform(kit, 1.42, '#8a96a8', '#5f6d82');
    for (let i = 0; i < 6; i++) {
      const a = (i / 6) * Math.PI * 2;
      const r = G.cylinder(0.05, 0.05, 0.04, 8);
      X(r, [Math.cos(a) * 1.2, 0.31, Math.sin(a) * 1.2]);
      kit.add(r, '#c8d0dc');
    }
    const gear = G.merge([G.cylinder(0.45, 0.45, 0.12, 16), ...Array.from({ length: 10 }, (_, i) => X(G.box(0.14, 0.12, 0.16), [Math.cos((i / 10) * 6.28) * 0.52, 0, Math.sin((i / 10) * 6.28) * 0.52], [0, -(i / 10) * 6.28, 0]))]);
    const gm = new THREE.Mesh(G.paint(gear, '#b8c4d4'), glowMat());
    gm.material = new THREE.MeshLambertMaterial({ vertexColors: true });
    gm.rotation.x = Math.PI / 2;
    gm.position.set(-0.55, 0.85, -0.7);
    gm.castShadow = true;
    kit.obj(gm, (t) => (gm.rotation.y = t * 0.6));
    const stack = G.cylinder(0.16, 0.2, 1.1, 10);
    X(stack, [0.7, 0.83, -0.6]);
    kit.add(stack, '#6f7d92');
    const band = G.torus(0.18, 0.03, 4, 12);
    X(band, [0.7, 1.2, -0.6], [Math.PI / 2, 0, 0]);
    kit.add(band, '#ffc83d');
    if (L >= 3) flag(kit, [-1.0, 0.28, 0.75], '#9aa9bd');
  },
  magic(kit, L, anims) {
    platform(kit, 1.42, '#6a5aa8', '#4a3d6f');
    const ring = G.torus(0.95, 0.04, 4, 36);
    X(ring, [0, 0.31, 0], [Math.PI / 2, 0, 0]);
    kit.add(ring, '#ff9ae6', { glow: true });
    const ring2 = G.torus(0.6, 0.03, 4, 30);
    X(ring2, [0, 0.31, 0], [Math.PI / 2, 0, 0]);
    kit.add(ring2, '#9ae6ff', { glow: true });
    const holder = new THREE.Group();
    holder.position.set(0, 1.25, -0.2);
    for (let i = 0; i < 3 + (L >= 3 ? 2 : 0); i++) {
      const a = (i / (3 + (L >= 3 ? 2 : 0))) * Math.PI * 2;
      const c = new THREE.Mesh(G.paint(G.crystal(0.36, 0.08, 6), i % 2 ? '#ff9ae6' : '#9ae6ff'), glowMat());
      c.position.set(Math.cos(a) * 0.55, Math.sin(a * 2) * 0.1, Math.sin(a) * 0.55);
      holder.add(c);
    }
    kit.obj(holder, (t) => {
      holder.rotation.y = t * 0.5;
      holder.position.y = 1.25 + Math.sin(t * 1.3) * 0.08;
    });
    for (const [x, z] of [[-0.9, -0.7], [0.9, -0.7]]) {
      const s = G.box(0.22, 0.5, 0.18, 0.03);
      X(s, [x, 0.53, z]);
      kit.add(s, '#8a7dbd', { flat: true });
    }
  },
  ancient(kit, L) {
    platform(kit, 1.42, '#b8ae8a', '#a89a78');
    for (let i = 0; i < 3; i++) {
      const g = PROP_BUILDERS.ruin({ moss: '#9fbf4f' }, 20 + i).clone();
      X(g, [-0.8 + i * 0.8, 0.28, -0.8], [0, i, 0], [0.7, 0.7, 0.7]);
      kit.add(g, 'keep');
    }
    const ring = G.torus(0.8, 0.04, 4, 30);
    X(ring, [0, 0.31, 0.2], [Math.PI / 2, 0, 0]);
    kit.add(ring, '#37c9a8', { glow: true });
  },
  void(kit, L) {
    platform(kit, 1.42, '#1c1236', '#140c2a');
    const orb = new THREE.Mesh(G.paint(G.sphere(0.35, 16, 12), '#8a6aff'), glowMat());
    orb.position.set(0, 1.1, -0.5);
    const ring = new THREE.Mesh(G.paint(G.torus(0.55, 0.03, 4, 36), '#c8b8ff'), glowMat());
    ring.position.copy(orb.position);
    kit.obj(orb, (t) => orb.scale.setScalar(1 + Math.sin(t * 2) * 0.06));
    kit.obj(ring, (t) => {
      ring.rotation.x = t * 0.7;
      ring.rotation.y = t * 0.4;
    });
  },
  celestial(kit, L) {
    platform(kit, 1.42, '#f3e2ff', '#d7b8ec');
    const moon = new THREE.Mesh(G.paint(G.torus(0.35, 0.12, 8, 20, Math.PI * 1.3), '#ffe89a'), glowMat());
    moon.position.set(0, 1.2, -0.6);
    kit.obj(moon, (t) => (moon.position.y = 1.2 + Math.sin(t) * 0.07));
    for (let i = 0; i < 5; i++) {
      const s = G.flat(G.ico(0.07, 0));
      X(s, [Math.cos(i * 1.3) * 0.9, 0.8 + (i % 3) * 0.2, Math.sin(i * 1.3) * 0.9]);
      kit.add(s, '#fff6b0', { glow: true });
    }
  },
};

export function buildHabitat(element, level = 1) {
  const kit = new Kit();
  const T = getTheme('verdant');
  (HAB[element] || HAB.nature)(kit, level, kit.anims, T);
  if (level >= 5) {
    // golden trim for maxed habitats
    const t = G.torus(1.46, 0.04, 4, 40);
    X(t, [0, 0.27, 0], [Math.PI / 2, 0, 0]);
    kit.add(t, GOLD);
  }
  return kit.build();
}

// -------------------------------------------------------------------------
// FARM & CROPS
// -------------------------------------------------------------------------
export function buildFarm(level = 1) {
  const kit = new Kit();
  const soil = G.roundedBox(1.9, 0.18, 1.9, 0.08);
  X(soil, [0, 0.09, 0]);
  kit.add(soil, '#8a5a3a');
  for (let i = 0; i < 3; i++) {
    const row = G.roundedBox(1.55, 0.12, 0.38, 0.06);
    X(row, [0, 0.2, -0.55 + i * 0.55]);
    kit.add(row, '#6a4228');
  }
  // fence posts
  for (let i = 0; i < 4; i++) {
    const a = (i / 4) * Math.PI * 2 + Math.PI / 4;
    const p = G.box(0.08, 0.36, 0.08);
    X(p, [Math.cos(a) * 1.3, 0.2, Math.sin(a) * 1.3]);
    kit.add(p, WOOD);
  }
  for (const [x, z, r] of [[0, -0.93, 0], [0, 0.93, 0], [-0.93, 0, Math.PI / 2], [0.93, 0, Math.PI / 2]]) {
    const rail = G.box(1.8, 0.05, 0.05);
    X(rail, [x, 0.3, z], [0, r, 0]);
    kit.add(rail, WOOD_D);
  }
  if (level >= 2) {
    // scarecrow
    const pole = G.cylinder(0.03, 0.03, 0.9, 6);
    X(pole, [0.85, 0.45, -0.85]);
    kit.add(pole, WOOD_D);
    const arm = G.cylinder(0.025, 0.025, 0.5, 6);
    X(arm, [0.85, 0.7, -0.85], [0, 0, Math.PI / 2]);
    kit.add(arm, WOOD_D);
    const head = G.sphere(0.1, 8, 6);
    X(head, [0.85, 0.95, -0.85]);
    kit.add(head, '#f4d89a');
    const hat = G.cone(0.14, 0.14, 8);
    X(hat, [0.85, 1.07, -0.85]);
    kit.add(hat, '#5a8a3a');
  }
  return kit.build();
}

// Crop plant at growth stage g (0..1) for crop def c.
export function buildCropPlants(c, g) {
  const kit = new Kit();
  const leafC = new THREE.Color(c.leaf);
  for (let i = 0; i < 3; i++) {
    for (let j = 0; j < 3; j++) {
      const x = -0.52 + j * 0.52, z = -0.55 + i * 0.55;
      const s = 0.35 + g * 0.65;
      for (let k = 0; k < 3; k++) {
        const lf = G.leafGeo(0.26 * s, 0.14 * s, 0.02);
        G.bend(lf, -0.5, 0.26 * s);
        X(lf, [x, 0.24, z], [0.35, (k / 3) * Math.PI * 2 + i + j, 0]);
        kit.add(lf, leafC.clone().offsetHSL(0, 0, k * 0.04));
      }
      if (g >= 0.99) {
        let fruit;
        if (c.id === 'berries') {
          for (let q = 0; q < 3; q++) {
            const b = G.sphere(0.06, 8, 6);
            X(b, [x + Math.cos(q * 2) * 0.07, 0.36 + q * 0.03, z + Math.sin(q * 2) * 0.07]);
            kit.add(b, c.color);
          }
          continue;
        } else if (c.id === 'roots') {
          fruit = G.cone(0.08, 0.16, 8);
          X(fruit, [x, 0.3, z], [Math.PI, 0, 0]);
        } else if (c.id === 'melons') {
          fruit = G.ellipsoid(0.15, 0.12, 0.13, 10, 8);
          X(fruit, [x, 0.33, z]);
        } else if (c.id === 'pumpkins') {
          fruit = G.lathe([[0.001, 0], [0.13, 0.03], [0.17, 0.12], [0.12, 0.22], [0.001, 0.2]], 10);
          X(fruit, [x, 0.22, z]);
        } else if (c.id === 'starfruit') {
          fruit = G.flat(G.ico(0.1, 0));
          X(fruit, [x, 0.4, z]);
          kit.add(fruit, c.color, { glow: true });
          continue;
        } else if (c.id === 'peppers') {
          fruit = G.horn(0.22, 0.05, 0.8, 8, 8);
          X(fruit, [x, 0.42, z], [Math.PI, 0, 0.3]);
        } else {
          fruit = G.cylinder(0.03, 0.04, 0.34, 6);
          X(fruit, [x, 0.4, z]);
          kit.add(fruit, c.color, { glow: true });
          continue;
        }
        kit.add(fruit, c.color);
      }
    }
  }
  return kit.build({ castShadow: false });
}

// -------------------------------------------------------------------------
// CORE BUILDINGS
// -------------------------------------------------------------------------
function hatchery(level) {
  const kit = new Kit();
  const base = G.cylinder(0.92, 1.0, 0.3, 12);
  X(base, [0, 0.15, 0]);
  kit.add(base, STONE, { flat: true });
  // straw nest
  const nest = G.torus(0.6, 0.2, 8, 20);
  X(nest, [0, 0.42, 0], [Math.PI / 2, 0, 0], [1, 1, 0.8]);
  kit.add(nest, (x, y, z) => new THREE.Color('#e8c070').lerp(new THREE.Color('#c89a50'), (Math.sin(Math.atan2(z, x) * 14) + 1) / 2 * 0.6));
  const fill = G.cylinder(0.5, 0.5, 0.1, 16);
  X(fill, [0, 0.38, 0]);
  kit.add(fill, '#d8b060');
  // arch frame
  const arch = G.torus(0.78, 0.07, 6, 20, Math.PI);
  X(arch, [0, 0.3, -0.05]);
  kit.add(arch, WOOD);
  const roof = G.lathe([[0.4, 0], [0.3, 0.12], [0.001, 0.22]], 8);
  X(roof, [0, 1.08, -0.05]);
  kit.add(roof, ROOF_R);
  const lamp = G.sphere(0.07, 8, 6);
  X(lamp, [0, 1.02, -0.05]);
  kit.add(lamp, '#ffd98a', { glow: true });
  if (level >= 2) {
    lantern(kit, [0.85, 0, 0.6]);
  }
  if (level >= 3) flag(kit, [-0.85, 0, 0.6], '#ff9ac8', 1.2);
  return kit.build();
}

function breeding(level) {
  const kit = new Kit();
  const base = G.cylinder(1.4, 1.48, 0.25, 14);
  X(base, [0, 0.12, 0]);
  kit.add(base, '#9ad06a', { flat: true });
  const peak = (x, z, h, r) => {
    const g = G.jitter(G.lathe([[r, 0], [r * 0.8, h * 0.35], [r * 0.5, h * 0.7], [r * 0.2, h * 0.92], [0.001, h]], 9), 0.04, x * 10);
    X(g, [x, 0.22, z]);
    kit.add(g, (px, py) => {
      const c = new THREE.Color('#a8a0b8').lerp(new THREE.Color('#c8c0d8'), py / h);
      if (py > 0.22 + h * 0.75) c.lerp(new THREE.Color('#ffffff'), 0.7);
      return c;
    }, { flat: true });
  };
  peak(-0.62, -0.25, 1.9, 0.7);
  peak(0.62, -0.25, 1.6, 0.62);
  peak(0, -0.75, 1.2, 0.55);
  // arch bridge between the peaks
  const arch = G.torus(0.62, 0.1, 6, 16, Math.PI);
  X(arch, [0, 1.15, -0.2]);
  kit.add(arch, '#c8c0d8', { flat: true });
  // heart crystal
  const heartShape = new THREE.Shape();
  heartShape.moveTo(0, -0.2);
  heartShape.bezierCurveTo(-0.3, 0.02, -0.2, 0.3, 0, 0.14);
  heartShape.bezierCurveTo(0.2, 0.3, 0.3, 0.02, 0, -0.2);
  const hg = G.clean(new THREE.ExtrudeGeometry(heartShape, { depth: 0.1, bevelEnabled: true, bevelThickness: 0.05, bevelSize: 0.04, bevelSegments: 2 }));
  hg.translate(0, 0, -0.05);
  const heart = new THREE.Mesh(G.paint(hg, '#ff6aa0'), glowMat());
  heart.position.set(0, 1.95, -0.2);
  heart.scale.setScalar(1.3);
  kit.obj(heart, (t) => {
    heart.rotation.y = Math.sin(t * 1.2) * 0.5;
    const s = 1.3 * (1 + Math.max(0, Math.sin(t * 3)) * 0.08);
    heart.scale.setScalar(s);
    heart.position.y = 1.95 + Math.sin(t * 1.5) * 0.05;
  });
  heart.name = 'heart';
  const rng = new RNG(3);
  for (let i = 0; i < 10; i++) {
    const a = rng.range(0, 6.28), r = rng.range(0.9, 1.3);
    const f = G.sphere(0.06, 6, 4);
    X(f, [Math.cos(a) * r, 0.28, Math.sin(a) * r]);
    kit.add(f, rng.pick(['#ff7aa2', '#ffd24a', '#ffffff']));
  }
  if (level >= 2) lantern(kit, [1.0, 0.2, 0.85], '#ff9ac8');
  if (level >= 3) flag(kit, [-1.0, 0.2, 0.85], '#ff6aa0');
  return kit.build();
}

function hut(kit, { w = 1.4, d = 1.3, h = 0.8, wall = '#f4e8d0', roof = ROOF_R, roofH = 0.7 } = {}) {
  const base = G.roundedBox(w + 0.25, 0.2, d + 0.25, 0.06);
  X(base, [0, 0.1, 0]);
  kit.add(base, STONE, { flat: true });
  const body = G.roundedBox(w, h, d, 0.05);
  X(body, [0, 0.2 + h / 2, 0]);
  kit.add(body, wall);
  const rf = G.cone(Math.max(w, d) * 0.82, roofH, 4);
  X(rf, [0, 0.2 + h + roofH / 2 - 0.02, 0], [0, Math.PI / 4, 0], [1, 1, d / w]);
  kit.add(rf, roof, { flat: true });
  const door = G.roundedBox(0.34, 0.5, 0.06, 0.04);
  X(door, [0, 0.45, d / 2 + 0.02]);
  kit.add(door, WOOD_D);
  const win = G.roundedBox(0.24, 0.24, 0.05, 0.04);
  X(win, [w * 0.3, 0.2 + h * 0.62, d / 2 + 0.02]);
  kit.add(win, '#ffe9a8', { glow: true });
}

function goldStorage(level) {
  const kit = new Kit();
  hut(kit, { wall: '#e8dcc8', roof: '#ffc83d', roofH: 0.2, h: 0.75 });
  const dome = G.lathe([[0.62, 0], [0.55, 0.3], [0.32, 0.55], [0.001, 0.62]], 16);
  X(dome, [0, 0.95, 0]);
  kit.add(dome, '#ffc83d');
  const coin = G.cylinder(0.1, 0.1, 0.03, 12);
  for (let i = 0; i < 6; i++) {
    const c = coin.clone();
    X(c, [0.62 + (i % 3) * 0.12, 0.24 + Math.floor(i / 3) * 0.04, 0.72 - (i % 2) * 0.1], [0.2, 0, 0.1]);
    kit.add(c, '#ffd23f');
  }
  if (level >= 3) flag(kit, [-0.75, 0.2, 0.7], '#ffc83d', 1.1);
  return kit.build();
}

function foodStorage(level) {
  const kit = new Kit();
  const base = G.cylinder(0.85, 0.9, 0.2, 12);
  X(base, [0, 0.1, 0]);
  kit.add(base, STONE, { flat: true });
  const silo = G.cylinder(0.55, 0.58, 1.3, 14);
  X(silo, [-0.15, 0.85, -0.1]);
  kit.add(silo, (x, y) => new THREE.Color('#d8a060').lerp(new THREE.Color('#c08040'), (Math.sin(y * 16) + 1) / 2 * 0.5));
  const roof = G.lathe([[0.64, 0], [0.4, 0.3], [0.001, 0.48]], 14);
  X(roof, [-0.15, 1.5, -0.1]);
  kit.add(roof, ROOF_R);
  for (let i = 0; i < 2; i++) {
    const barrel = G.lathe([[0.001, 0], [0.16, 0], [0.19, 0.15], [0.16, 0.3], [0.001, 0.3]], 10);
    X(barrel, [0.55 + i * 0.1, 0.2, 0.5 - i * 0.4]);
    kit.add(barrel, WOOD);
    const fruit = G.sphere(0.09, 8, 6);
    X(fruit, [0.55 + i * 0.1, 0.52, 0.5 - i * 0.4]);
    kit.add(fruit, i ? '#ff9a3a' : '#ff4f6d');
  }
  return kit.build();
}

function academy(level) {
  const kit = new Kit();
  hut(kit, { wall: '#f0e6d8', roof: '#3f7ad8', h: 0.9 });
  const tower = G.cylinder(0.26, 0.28, 1.2, 10);
  X(tower, [0.55, 0.8, -0.4]);
  kit.add(tower, '#e8dcc8');
  const tr = G.cone(0.36, 0.5, 10);
  X(tr, [0.55, 1.62, -0.4]);
  kit.add(tr, '#3f7ad8');
  flag(kit, [0.55, 1.8, -0.4], '#ffc83d', 0.45);
  const bell = G.lathe([[0.001, 0.15], [0.07, 0.14], [0.1, 0.02], [0.12, 0]], 10);
  X(bell, [0.55, 1.2, -0.12]);
  kit.add(bell, GOLD);
  return kit.build();
}

function temple(level) {
  const kit = new Kit();
  for (let i = 0; i < 3; i++) {
    const step = G.roundedBox(2.6 - i * 0.4, 0.18, 2.6 - i * 0.4, 0.04);
    X(step, [0, 0.09 + i * 0.18, 0]);
    kit.add(step, i % 2 ? '#e8e0d0' : '#d8cfbf', { flat: true });
  }
  for (let i = 0; i < 4; i++) {
    const a = (i / 4) * Math.PI * 2 + Math.PI / 4;
    const p = G.cylinder(0.12, 0.14, 1.2, 10);
    X(p, [Math.cos(a) * 0.72, 1.14, Math.sin(a) * 0.72]);
    kit.add(p, '#fffaf0');
  }
  const roof = G.roundedBox(1.9, 0.18, 1.9, 0.05);
  X(roof, [0, 1.82, 0]);
  kit.add(roof, '#e8dcc8', { flat: true });
  const rt = G.cone(1.1, 0.5, 4);
  X(rt, [0, 2.15, 0], [0, Math.PI / 4, 0]);
  kit.add(rt, '#a35bea', { flat: true });
  const orb = new THREE.Mesh(G.paint(G.sphere(0.2, 14, 10), '#ff8fe0'), glowMat());
  orb.position.set(0, 1.0, 0);
  kit.obj(orb, (t) => {
    orb.position.y = 1.0 + Math.sin(t * 1.4) * 0.08;
    orb.rotation.y = t;
  });
  return kit.build();
}

function tower(level) {
  const kit = new Kit();
  const base = G.cylinder(0.85, 0.95, 0.3, 10);
  X(base, [0, 0.15, 0]);
  kit.add(base, STONE_D, { flat: true });
  const body = G.cylinder(0.55, 0.7, 2.8, 10);
  X(body, [0, 1.7, 0]);
  kit.add(body, (x, y) => new THREE.Color('#bfb4a4').lerp(new THREE.Color('#d8cfbf'), (Math.sin(y * 9) + 1) / 2 * 0.5), { flat: true });
  for (let i = 0; i < 8; i++) {
    const a = (i / 8) * Math.PI * 2;
    const m = G.box(0.22, 0.26, 0.22);
    X(m, [Math.cos(a) * 0.58, 3.2, Math.sin(a) * 0.58], [0, -a, 0]);
    kit.add(m, '#bfb4a4', { flat: true });
  }
  const rf = G.cone(0.7, 1.0, 10);
  X(rf, [0, 3.8, 0]);
  kit.add(rf, '#c8402a', { flat: true });
  flag(kit, [0, 4.25, 0], '#ffc83d', 0.6);
  const win = G.roundedBox(0.2, 0.34, 0.06, 0.05);
  X(win, [0, 2.4, 0.6]);
  kit.add(win, '#ffe9a8', { glow: true });
  const door = G.roundedBox(0.36, 0.55, 0.08, 0.06);
  X(door, [0, 0.55, 0.7]);
  kit.add(door, WOOD_D);
  return kit.build();
}

function forge(level) {
  const kit = new Kit();
  const base = G.roundedBox(1.8, 0.2, 1.8, 0.06);
  X(base, [0, 0.1, 0]);
  kit.add(base, STONE_D, { flat: true });
  const furnace = G.lathe([[0.55, 0], [0.5, 0.6], [0.3, 0.95], [0.18, 1.3], [0.16, 1.5]], 10);
  X(furnace, [-0.35, 0.2, -0.35]);
  kit.add(furnace, '#8a7a6a', { flat: true });
  const mouth = G.ellipsoid(0.22, 0.18, 0.1, 10, 8);
  X(mouth, [-0.35, 0.45, 0.14]);
  kit.add(mouth, '#ff8a2a', { glow: true });
  const anvil = G.merge([X(G.box(0.5, 0.14, 0.24), [0, 0.07, 0]), X(G.box(0.2, 0.2, 0.18), [0, -0.1, 0]), X(G.cone(0.1, 0.25, 6), [0.33, 0.07, 0], [0, 0, -Math.PI / 2])]);
  X(anvil, [0.4, 0.45, 0.35]);
  kit.add(anvil, '#4a5466');
  crystalCluster(kit, [0.55, 0.2, -0.5], '#ff6ad8', 0.6, true, 3, 11);
  return kit.build();
}

function portal(level) {
  const kit = new Kit();
  const base = G.cylinder(0.9, 0.95, 0.2, 12);
  X(base, [0, 0.1, 0]);
  kit.add(base, STONE, { flat: true });
  const ring = G.torus(0.75, 0.16, 8, 24);
  X(ring, [0, 1.05, 0]);
  kit.add(ring, '#9a8ab8', { flat: true });
  for (let i = 0; i < 6; i++) {
    const a = (i / 6) * Math.PI * 2;
    const r = G.box(0.1, 0.1, 0.05);
    X(r, [Math.cos(a) * 0.75, 1.05 + Math.sin(a) * 0.75, 0.16]);
    kit.add(r, '#ffe27a', { glow: true });
  }
  const swirl = new THREE.Mesh(
    new THREE.CircleGeometry(0.62, 32),
    new THREE.ShaderMaterial({
      uniforms: { uTime: { value: 0 } },
      transparent: true,
      side: THREE.DoubleSide,
      vertexShader: 'varying vec2 vUv; void main(){ vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.0); }',
      fragmentShader: `uniform float uTime; varying vec2 vUv;
        void main(){ vec2 p = vUv - 0.5; float r = length(p) * 2.0; float a = atan(p.y, p.x);
          float s = sin(a * 3.0 + r * 10.0 - uTime * 3.0) * 0.5 + 0.5;
          vec3 c = mix(vec3(0.45, 0.25, 0.95), vec3(1.0, 0.55, 0.9), s);
          c = mix(c, vec3(1.0), smoothstep(0.35, 0.0, r) * 0.8);
          gl_FragColor = vec4(c, smoothstep(1.0, 0.85, r)); }`,
    })
  );
  swirl.position.set(0, 1.05, 0);
  kit.obj(swirl, (t) => (swirl.material.uniforms.uTime.value = t));
  return kit.build();
}

function workshop(level) {
  const kit = new Kit();
  hut(kit, { wall: '#e0d0f0', roof: '#6a4fc9', h: 0.8 });
  crystalCluster(kit, [0.65, 0.2, 0.6], '#37c9a8', 0.5, true, 3, 13);
  const case_ = G.roundedBox(0.4, 0.4, 0.3, 0.04);
  X(case_, [-0.6, 0.4, 0.6]);
  kit.add(case_, '#bfe8ff');
  return kit.build();
}

function shrine(level) {
  const kit = new Kit();
  const base = G.cylinder(1.4, 1.5, 0.25, 8);
  X(base, [0, 0.12, 0]);
  kit.add(base, '#c8b890', { flat: true });
  const ob = G.lathe([[0.3, 0], [0.26, 1.8], [0.001, 2.2]], 4);
  X(ob, [0, 0.25, -0.2], [0, Math.PI / 4, 0]);
  kit.add(ob, '#8a8478', { flat: true });
  for (let i = 0; i < 4; i++) {
    const r = G.box(0.12, 0.12, 0.02);
    X(r, [0, 0.7 + i * 0.35, 0.02]);
    kit.add(r, '#6ff0d0', { glow: true });
  }
  for (let i = 0; i < 3; i++) {
    const g = PROP_BUILDERS.ruin({ moss: '#9fbf4f' }, 40 + i).clone();
    X(g, [Math.cos(i * 2.1) * 1.0, 0.25, Math.sin(i * 2.1) * 1.0 + 0.2], [0, i, 0], [0.6, 0.6, 0.6]);
    kit.add(g, 'keep');
  }
  return kit.build();
}

// -------------------------------------------------------------------------
// DECORATIONS
// -------------------------------------------------------------------------
const DECO = {
  deco_flowerbed(kit) {
    const b = G.roundedBox(0.8, 0.14, 0.8, 0.05);
    X(b, [0, 0.07, 0]);
    kit.add(b, '#8a5a3a');
    const rng = new RNG(5);
    for (let i = 0; i < 9; i++) {
      const f = G.sphere(0.07, 6, 4);
      X(f, [-0.25 + (i % 3) * 0.25, 0.2, -0.25 + Math.floor(i / 3) * 0.25]);
      kit.add(f, rng.pick(['#ff7aa2', '#ffd24a', '#ffffff', '#b58cff']));
    }
  },
  deco_lantern(kit) {
    lantern(kit, [0, 0, 0], '#ffd98a');
  },
  deco_bench(kit) {
    const seat = G.roundedBox(0.8, 0.07, 0.3, 0.03);
    X(seat, [0, 0.3, 0]);
    kit.add(seat, WOOD);
    const back = G.roundedBox(0.8, 0.25, 0.05, 0.02);
    X(back, [0, 0.5, -0.13]);
    kit.add(back, WOOD);
    for (const x of [-0.32, 0.32]) {
      const l = G.box(0.06, 0.3, 0.26);
      X(l, [x, 0.15, 0]);
      kit.add(l, '#4a3a3a');
    }
  },
  deco_statue(kit) {
    const b = G.cylinder(0.32, 0.36, 0.3, 8);
    X(b, [0, 0.15, 0]);
    kit.add(b, STONE, { flat: true });
    const body = G.ellipsoid(0.2, 0.22, 0.24, 10, 8);
    X(body, [0, 0.5, 0]);
    kit.add(body, '#b8b0a4');
    const head = G.sphere(0.2, 10, 8);
    X(head, [0, 0.8, 0.08]);
    kit.add(head, '#b8b0a4');
    for (const s of [-1, 1]) {
      const e = G.cone(0.06, 0.18, 6);
      X(e, [s * 0.12, 1.0, 0.05], [0, 0, -0.4 * s]);
      kit.add(e, '#b8b0a4');
    }
  },
  deco_fountain(kit) {
    const b = G.lathe([[0.001, 0], [0.85, 0], [0.9, 0.3], [0.8, 0.32], [0.001, 0.2]], 16);
    kit.add(b, STONE);
    const water = new THREE.Mesh(pondGeometry(0.72, 1, 24), waterMaterial({ deep: '#1f8ad8', shallow: '#7fe0f7' }));
    water.position.y = 0.26;
    kit.obj(water);
    const col = G.cylinder(0.1, 0.14, 0.7, 8);
    X(col, [0, 0.5, 0]);
    kit.add(col, STONE);
    const top = G.lathe([[0.001, 0], [0.3, 0.02], [0.32, 0.1], [0.001, 0.05]], 12);
    X(top, [0, 0.85, 0]);
    kit.add(top, STONE);
    const spray = G.sphere(0.1, 8, 6);
    X(spray, [0, 1.0, 0]);
    kit.add(spray, '#bff0ff', { glow: true });
  },
  deco_banner(kit) {
    flag(kit, [0, 0, 0], '#ff5f8f', 1.4);
  },
  deco_mushrooms(kit) {
    const T = { leaves: ['#ff5a3a'] };
    for (let i = 0; i < 4; i++) {
      const m = PROP_BUILDERS.mushroom({ ...T, leaves: [['#ff5a3a', '#b67cff', '#5fc4ff', '#ffc83d'][i]] }, i).clone();
      const a = (i / 4) * Math.PI * 2;
      X(m, [Math.cos(a) * 0.25, 0, Math.sin(a) * 0.25], [0, a, 0], [0.25, 0.25 + i * 0.03, 0.25]);
      kit.add(m, 'keep');
    }
  },
  deco_crystal(kit) {
    crystalCluster(kit, [0, 0, 0], '#9ae6ff', 1.3, true, 5, 7);
  },
  deco_arch(kit) {
    const g = PROP_BUILDERS.arch({ moss: '#9fbf4f' }, 3).clone();
    X(g, [0, 0, 0], [0, 0, 0], [0.8, 0.8, 0.8]);
    kit.add(g, 'keep');
    const moon = G.torus(0.2, 0.06, 6, 16, Math.PI * 1.3);
    X(moon, [0, 1.35, 0]);
    kit.add(moon, '#ffe89a', { glow: true });
  },
  deco_tree(kit) {
    const T = getTheme('celestial');
    const g = PROP_BUILDERS.round({ ...T, leaves: ['#ffb8e0', '#f7a0d2', '#ffd6ee'], trunk: '#9a6a44' }, 77).clone();
    X(g, [0, 0, 0], [0, 0, 0], [1.3, 1.3, 1.3]);
    kit.add(g, 'keep');
    for (let i = 0; i < 6; i++) {
      const o = G.sphere(0.06, 8, 6);
      X(o, [Math.cos(i) * 0.7, 1.6 + (i % 2) * 0.4, Math.sin(i) * 0.7]);
      kit.add(o, '#ffe27a', { glow: true });
    }
  },
};

// -------------------------------------------------------------------------
// CONSTRUCTION SCAFFOLD
// -------------------------------------------------------------------------
export function buildScaffold(w, d) {
  const kit = new Kit();
  const hw = w * 0.45, hd = d * 0.45;
  const base = G.roundedBox(w * 0.9, 0.12, d * 0.9, 0.04);
  X(base, [0, 0.06, 0]);
  kit.add(base, '#c8b89a');
  for (const [x, z] of [[-hw, -hd], [hw, -hd], [-hw, hd], [hw, hd]]) {
    const p = G.box(0.08, 1.1, 0.08);
    X(p, [x, 0.55, z]);
    kit.add(p, WOOD);
  }
  for (const y of [0.45, 0.95]) {
    for (const [x, z, rw, rd] of [[0, -hd, w * 0.9, 0.06], [0, hd, w * 0.9, 0.06], [-hw, 0, 0.06, d * 0.9], [hw, 0, 0.06, d * 0.9]]) {
      const b = G.box(rw, 0.06, rd);
      X(b, [x, y, z]);
      kit.add(b, WOOD_D);
    }
  }
  const crate = G.box(0.3, 0.3, 0.3);
  X(crate, [hw * 0.5, 0.27, hd * 0.4], [0, 0.4, 0]);
  kit.add(crate, '#c89a60');
  const bricks = G.box(0.35, 0.18, 0.25);
  X(bricks, [-hw * 0.4, 0.21, -hd * 0.3], [0, -0.3, 0]);
  kit.add(bricks, '#d8a080');
  return kit.build();
}

export function buildModel(type, level = 1, element = null) {
  if (type.startsWith('hab_')) return buildHabitat(type.slice(4), level);
  switch (type) {
    case 'farm':
      return buildFarm(level);
    case 'hatchery':
      return hatchery(level);
    case 'breeding':
      return breeding(level);
    case 'gold_storage':
      return goldStorage(level);
    case 'food_storage':
      return foodStorage(level);
    case 'academy':
      return academy(level);
    case 'evolution_temple':
      return temple(level);
    case 'challenge_tower':
      return tower(level);
    case 'rune_forge':
      return forge(level);
    case 'event_portal':
      return portal(level);
    case 'relic_workshop':
      return workshop(level);
    case 'ancient_shrine':
      return shrine(level);
    default:
      if (DECO[type]) {
        const kit = new Kit();
        DECO[type](kit);
        return kit.build();
      }
      return buildScaffold(2, 2);
  }
}
