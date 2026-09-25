import { G } from '../game/G.js';
import { BUILDINGS, farmLimit } from '../data/buildings.js';
import { ISLANDS, ISLAND_BY_ID } from '../data/islands.js';
import { CROP_BY_ID } from '../data/crops.js';
import { theme as getTheme } from '../render/world/themes.js';
import { islandShape } from '../core/islandShape.js';
import { RNG } from '../core/rng.js';
import { add, spend, canAfford, gemsForTime } from './resources.js';
import { addXP, isUnlocked } from './player.js';
import { stat } from './stats.js';
import { goldRate, species, byId } from './monsters.js';

// ----------------------------------------------------------------------------
// Island grids
// ----------------------------------------------------------------------------
const gridCache = new Map();

export function islandGrid(islandId) {
  if (gridCache.has(islandId)) return gridCache.get(islandId);
  const def = ISLAND_BY_ID[islandId];
  const shape = islandShape(def.seed, def.radius);
  const blockers = [];
  if (def.pond) blockers.push({ x: def.pond.x, z: def.pond.z, r: def.pond.r + 0.45 });
  if (def.stream) {
    const pts = [[def.pond.x, def.pond.z], ...def.stream];
    for (let i = 0; i < pts.length - 1; i++) {
      for (let k = 0; k <= 4; k++) {
        const t = k / 4;
        blockers.push({ x: pts[i][0] + (pts[i + 1][0] - pts[i][0]) * t, z: pts[i][1] + (pts[i + 1][1] - pts[i][1]) * t, r: 0.75 });
      }
    }
  }
  const cells = new Set();
  const R = Math.ceil(def.radius) + 1;
  const m = 0.5;
  for (let x = -R; x < R; x++) {
    for (let z = -R; z < R; z++) {
      if (!shape.inside(x, z, m) || !shape.inside(x + 1, z, m) || !shape.inside(x, z + 1, m) || !shape.inside(x + 1, z + 1, m)) continue;
      const cx = x + 0.5, cz = z + 0.5;
      let blocked = false;
      for (const b of blockers) if (Math.hypot(cx - b.x, cz - b.z) < b.r) blocked = true;
      if (!blocked) cells.add(`${x},${z}`);
    }
  }
  const g = { def, shape, cells, blockers };
  gridCache.set(islandId, g);
  return g;
}

// ----------------------------------------------------------------------------
// Obstacles (deterministic per island)
// ----------------------------------------------------------------------------
const OB_KINDS = {
  tree: { size: [1, 1], gold: 60, time: 5, xp: 8 },
  bush: { size: [1, 1], gold: 30, time: 3, xp: 5 },
  stump: { size: [1, 1], gold: 40, time: 4, xp: 6 },
  rock: { size: [1, 1], gold: 90, time: 8, xp: 10 },
  rockBig: { size: [2, 2], gold: 250, time: 15, xp: 22 },
  ruin: { size: [1, 1], gold: 160, time: 10, xp: 16, gems: 0.25 },
  arch: { size: [2, 1], gold: 320, time: 20, xp: 26, gems: 0.4 },
};

const obstacleCache = new Map();
export function obstaclesFor(islandId) {
  if (obstacleCache.has(islandId)) return obstacleCache.get(islandId);
  const g = islandGrid(islandId);
  const def = g.def;
  const T = getTheme(def.theme);
  const rng = new RNG(`obstacles-${islandId}`);
  const list = [];
  const taken = new Set();
  const reserved = (x, z) => {
    // keep a free building area around the center of every island
    const d = Math.hypot(x + 0.5, z + 0.5);
    return d < (islandId === 0 ? 6.2 : 4.2);
  };
  const cells = rng.shuffle([...g.cells]);
  const scale = 1 + islandId * 1.6;
  const kindsFor = () =>
    rng.weighted([
      ['tree', 5],
      ['bush', 2],
      ['stump', 1],
      ['rock', 3],
      ['rockBig', 1.2],
      ['ruin', 1.2],
      ['arch', 0.5],
    ]);
  let idx = 0;
  for (const key of cells) {
    const [x, z] = key.split(',').map(Number);
    if (reserved(x, z)) continue;
    if (!rng.chance(0.4)) continue;
    const kind = kindsFor();
    const k = OB_KINDS[kind];
    const fp = [];
    let ok = true;
    for (let dx = 0; dx < k.size[0]; dx++) for (let dz = 0; dz < k.size[1]; dz++) {
      const c = `${x + dx},${z + dz}`;
      if (!g.cells.has(c) || taken.has(c) || reserved(x + dx, z + dz)) ok = false;
      fp.push(c);
    }
    if (!ok) continue;
    for (const c of fp) taken.add(c);
    const treeKind = rng.pick(T.trees);
    list.push({
      id: `${islandId}-${idx++}`,
      island: islandId,
      kind,
      model: kind === 'tree' ? treeKind : kind,
      x, z, w: k.size[0], d: k.size[1],
      cost: Math.round(k.gold * scale),
      time: Math.round(k.time * (1 + islandId * 0.6)),
      xp: Math.round(k.xp * scale),
      gems: k.gems || 0,
      rot: rng.range(0, Math.PI * 2),
      seed: rng.int(1, 9999),
    });
  }
  obstacleCache.set(islandId, list);
  return list;
}

export function activeObstacles(islandId) {
  const removed = new Set(G.state.obstacles.removed);
  return obstaclesFor(islandId).filter((o) => !removed.has(o.id));
}

export function startClearing(o) {
  if (G.state.obstacles.clearing[o.id]) return false;
  if (!spend({ gold: o.cost }, 'clear')) return false;
  G.state.obstacles.clearing[o.id] = G.now() + o.time * 1000;
  G.markDirty();
  G.bus.emit('obstacle:clearing', { o });
  return true;
}

function finishClearing(id) {
  const o = obstaclesFor(Number(id.split('-')[0])).find((x) => x.id === id);
  delete G.state.obstacles.clearing[id];
  if (!G.state.obstacles.removed.includes(id)) G.state.obstacles.removed.push(id);
  if (o) {
    addXP(o.xp, 'clear');
    let gems = 0;
    const rng = new RNG(`gem-${id}`);
    if (o.gems && rng.chance(o.gems)) {
      gems = 1 + rng.int(0, 2);
      add('gems', gems, { source: 'clear' });
    }
    stat('clear');
    G.bus.emit('obstacle:cleared', { o, gems });
  }
  G.markDirty();
}

// ----------------------------------------------------------------------------
// Occupancy & placement
// ----------------------------------------------------------------------------
export function footprintCells(type, x, z) {
  const [w, d] = BUILDINGS[type].size;
  const out = [];
  for (let dx = 0; dx < w; dx++) for (let dz = 0; dz < d; dz++) out.push(`${x + dx},${z + dz}`);
  return out;
}

export function occupancy(islandId, ignoreBuildingId = null) {
  const occ = new Map();
  for (const b of G.state.buildings) {
    if (b.island !== islandId || b.id === ignoreBuildingId) continue;
    for (const c of footprintCells(b.type, b.x, b.z)) occ.set(c, { kind: 'building', id: b.id });
  }
  for (const o of activeObstacles(islandId)) {
    for (let dx = 0; dx < o.w; dx++) for (let dz = 0; dz < o.d; dz++) occ.set(`${o.x + dx},${o.z + dz}`, { kind: 'obstacle', id: o.id });
  }
  return occ;
}

export function canPlace(type, islandId, x, z, ignoreId = null) {
  if (!G.state.islands.includes(islandId)) return false;
  const g = islandGrid(islandId);
  const occ = occupancy(islandId, ignoreId);
  for (const c of footprintCells(type, x, z)) {
    if (!g.cells.has(c) || occ.has(c)) return false;
  }
  return true;
}

// Finds the free spot closest to (cx, cz) (island-local).
export function findSpot(type, islandId, cx = 0, cz = 0, ignoreId = null) {
  const g = islandGrid(islandId);
  const [w, d] = BUILDINGS[type].size;
  let best = null;
  let bestD = Infinity;
  const occ = occupancy(islandId, ignoreId);
  for (const key of g.cells) {
    const [x, z] = key.split(',').map(Number);
    let ok = true;
    for (let dx = 0; dx < w && ok; dx++) for (let dz = 0; dz < d && ok; dz++) {
      const c = `${x + dx},${z + dz}`;
      if (!g.cells.has(c) || occ.has(c)) ok = false;
    }
    if (!ok) continue;
    const dd = Math.hypot(x + w / 2 - cx, z + d / 2 - cz);
    if (dd < bestD) {
      bestD = dd;
      best = { x, z };
    }
  }
  return best;
}

export function countOf(type) {
  return G.state.buildings.filter((b) => b.type === type).length;
}

export function buildCost(type) {
  const def = BUILDINGS[type];
  const n = countOf(type);
  const cost = { ...def.cost };
  if (def.category === 'habitat' && n > 0) cost.gold = Math.round(cost.gold * (1 + 0.6 * n));
  if (type === 'farm' && n > 0) cost.gold = Math.round(cost.gold * Math.pow(2.2, n));
  return cost;
}

// Why a building can't be bought right now (or null).
export function buildBlocker(type) {
  const def = BUILDINGS[type];
  if (G.state.player.level < def.unlockLevel) return { reason: 'level', level: def.unlockLevel };
  if (def.unique && countOf(type) > 0) return { reason: 'owned' };
  if (type === 'farm' && countOf('farm') >= farmLimit(G.state.player.level)) return { reason: 'limit' };
  if (!canAfford(buildCost(type))) return { reason: 'cost' };
  return null;
}

export function buildTimeFor(type) {
  const def = BUILDINGS[type];
  // first building of each type builds fast to keep the opening snappy
  const n = countOf(type);
  if (n === 0) return def.buildTime;
  return Math.round(def.buildTime * (1 + n * 0.5));
}

export function placeBuilding(type, islandId, x, z, { free = false, instant = false } = {}) {
  if (!canPlace(type, islandId, x, z)) return null;
  const cost = buildCost(type);
  if (!free && !spend(cost, 'build')) return null;
  const now = G.now();
  const t = instant ? 0 : buildTimeFor(type);
  const b = {
    id: G.uid(),
    type,
    island: islandId,
    x,
    z,
    level: 1,
    state: t > 0 ? 'building' : 'ready',
    until: t > 0 ? now + t * 1000 : 0,
    started: now,
    gold: 0,
    goldTs: now,
    crop: null,
    cropUntil: 0,
  };
  G.state.buildings.push(b);
  G.markDirty();
  G.bus.emit('building:placed', { b });
  if (t === 0) onConstructed(b, true);
  return b;
}

function onConstructed(b, instant = false) {
  const def = BUILDINGS[b.type];
  // charm changes habitat income: bank what was earned at the old rate first
  if (def.category === 'decoration') snapshotAllHabitats();
  b.state = 'ready';
  b.until = 0;
  b.goldTs = G.now();
  addXP(def.xp, 'build');
  stat('build');
  stat(`build_${b.type}`);
  stat(`build_cat_${def.category}`);
  G.markDirty();
  G.bus.emit('building:done', { b, instant });
}

export function moveBuilding(b, islandId, x, z) {
  if (!canPlace(b.type, islandId, x, z, b.id)) return false;
  if (b.island !== islandId && BUILDINGS[b.type].category === 'habitat') {
    // monsters move along with their habitat
  }
  b.island = islandId;
  b.x = x;
  b.z = z;
  G.markDirty();
  G.bus.emit('building:moved', { b });
  return true;
}

export function sellBuilding(b) {
  const def = BUILDINGS[b.type];
  if (def.category !== 'decoration') return false;
  snapshotAllHabitats();
  const refund = Math.round((def.cost.gold || 0) * 0.25);
  G.state.buildings.splice(G.state.buildings.indexOf(b), 1);
  add('gold', refund, { source: 'sell' });
  G.markDirty();
  G.bus.emit('building:removed', { b });
  return refund;
}

export function nextLevelDef(b) {
  const def = BUILDINGS[b.type];
  return def.levels[b.level] || null;
}

export function upgradeBlocker(b) {
  const next = nextLevelDef(b);
  if (!next) return { reason: 'max' };
  if (b.state !== 'ready') return { reason: 'busy' };
  if (next.minLevel && G.state.player.level < next.minLevel) return { reason: 'level', level: next.minLevel };
  if (!canAfford(next.cost)) return { reason: 'cost' };
  return null;
}

export function startUpgrade(b) {
  if (upgradeBlocker(b)) return false;
  const next = nextLevelDef(b);
  if (!spend(next.cost, 'upgrade')) return false;
  if (BUILDINGS[b.type].category === 'habitat') snapshotHabitat(b);
  b.state = 'upgrading';
  b.until = G.now() + (next.time || 1) * 1000;
  b.started = G.now();
  G.markDirty();
  G.bus.emit('building:upgradeStart', { b });
  return true;
}

function onUpgraded(b) {
  if (BUILDINGS[b.type].category === 'habitat') snapshotHabitat(b);
  b.level += 1;
  b.state = 'ready';
  b.until = 0;
  addXP(Math.round(BUILDINGS[b.type].xp * (0.6 + b.level * 0.4)), 'upgrade');
  stat('upgrade');
  stat(`upgrade_cat_${BUILDINGS[b.type].category}`);
  G.markDirty();
  G.bus.emit('building:upgraded', { b });
}

export function remainingSec(b) {
  return Math.max(0, Math.ceil(((b.until || 0) - G.now()) / 1000));
}

export function finishNowCost(b) {
  return gemsForTime(remainingSec(b));
}

export function finishNow(b) {
  const gems = finishNowCost(b);
  if (gems > 0 && !spend({ gems }, 'skip')) return false;
  b.until = G.now();
  tickBuildings();
  return true;
}

export function byBuildingId(id) {
  return G.state.buildings.find((b) => b.id === id) || null;
}

export function findBuilding(type) {
  return G.state.buildings.find((b) => b.type === type) || null;
}

export function readyBuilding(type) {
  return G.state.buildings.find((b) => b.type === type && b.state !== 'building') || null;
}

// ----------------------------------------------------------------------------
// Habitats
// ----------------------------------------------------------------------------
export function isHabitat(b) {
  return BUILDINGS[b.type].category === 'habitat';
}
export function habitatLevelDef(b) {
  return BUILDINGS[b.type].levels[b.level - 1];
}
export function habitatMonsters(b) {
  return G.state.monsters.filter((m) => m.hab === b.id);
}
export function habitatCapacity(b) {
  return habitatLevelDef(b).capacity;
}
// Decorations make the island charming: +1% habitat gold each (max +25%).
export function charmBonus() {
  const n = G.state.buildings.filter((x) => BUILDINGS[x.type].category === 'decoration' && x.state !== 'building').length;
  return Math.min(0.25, n * 0.01);
}

export function habitatRate(b) {
  if (b.state === 'building') return 0;
  return habitatMonsters(b).reduce((s, m) => s + goldRate(m), 0) * (1 + charmBonus());
}
export function habitatCap(b) {
  return habitatLevelDef(b).goldCap;
}
export function habitatGold(b, now = G.now()) {
  if (b.state === 'building') return 0;
  const g = b.gold + (habitatRate(b) * Math.max(0, now - b.goldTs)) / 60000;
  return Math.min(habitatCap(b), g);
}
export function snapshotHabitat(b, now = G.now()) {
  b.gold = habitatGold(b, now);
  b.goldTs = now;
}
export function snapshotAllHabitats() {
  const now = G.now();
  for (const b of G.state.buildings) if (isHabitat(b)) snapshotHabitat(b, now);
}

export function collectHabitat(b) {
  snapshotHabitat(b);
  const amount = Math.floor(b.gold);
  if (amount <= 0) return 0;
  const added = add('gold', amount, { capped: true, source: 'habitat' });
  b.gold -= added;
  if (added > 0) {
    stat('collect_gold', added);
    stat('collect_times');
    G.bus.emit('habitat:collected', { b, amount: added, full: added < amount });
  } else G.bus.emit('storage:full', { key: 'gold' });
  G.markDirty();
  return added;
}

export function compatibleHabitats(sp) {
  const def = species(sp);
  return G.state.buildings.filter((b) => isHabitat(b) && b.state !== 'building' && def.elements.includes(BUILDINGS[b.type].element));
}

export function habitatHasRoom(b) {
  return habitatMonsters(b).length < habitatCapacity(b);
}

export function placeMonsterIn(m, b) {
  if (b && (!habitatHasRoom(b) || !species(m.sp).elements.includes(BUILDINGS[b.type].element))) return false;
  const old = m.hab ? byBuildingId(m.hab) : null;
  if (old) snapshotHabitat(old);
  if (b) snapshotHabitat(b);
  m.hab = b ? b.id : null;
  G.markDirty();
  G.bus.emit('monster:placed', { m, from: old, to: b });
  return true;
}

export function totalGoldRate() {
  return G.state.buildings.filter(isHabitat).reduce((s, b) => s + habitatRate(b), 0);
}

// ----------------------------------------------------------------------------
// Farms
// ----------------------------------------------------------------------------
export function farmYield(b) {
  return BUILDINGS.farm.levels[b.level - 1].yield;
}
export function cropReady(b, now = G.now()) {
  return !!b.crop && now >= b.cropUntil;
}
export function plant(b, cropId, { quick = false } = {}) {
  const c = CROP_BY_ID[cropId];
  if (!c || b.crop || b.state === 'building') return false;
  if (G.state.player.level < c.unlock) return false;
  if (!spend({ gold: c.cost }, 'plant')) return false;
  b.crop = cropId;
  const t = quick ? Math.min(10, c.time) : c.time;
  b.cropStart = G.now();
  b.cropUntil = G.now() + t * 1000;
  stat('farm_plant');
  G.markDirty();
  G.bus.emit('farm:planted', { b, crop: c });
  return true;
}
export function harvest(b) {
  if (!cropReady(b)) return 0;
  const c = CROP_BY_ID[b.crop];
  const amount = Math.round(c.food * farmYield(b));
  const added = add('food', amount, { capped: true, source: 'farm' });
  if (added <= 0) {
    G.bus.emit('storage:full', { key: 'food' });
    return 0;
  }
  b.crop = null;
  b.cropUntil = 0;
  stat('harvest');
  addXP(Math.max(1, Math.round(c.time / 60)), 'harvest');
  G.markDirty();
  G.bus.emit('farm:harvested', { b, amount: added, crop: c });
  return added;
}
export function farms() {
  return G.state.buildings.filter((b) => b.type === 'farm' && b.state !== 'building');
}
export function plantAll(cropId) {
  let n = 0;
  for (const f of farms()) if (!f.crop && plant(f, cropId)) n++;
  return n;
}
export function harvestAll() {
  let total = 0;
  for (const f of farms()) if (cropReady(f)) total += harvest(f);
  return total;
}

// ----------------------------------------------------------------------------
// Academy (passive training)
// ----------------------------------------------------------------------------
export function academyTrainTime(m) {
  const b = readyBuilding('academy');
  if (!b) return Infinity;
  const base = BUILDINGS.academy.levels[b.level - 1].trainTime;
  return Math.round(base * (1 + m.lvl * 0.25));
}
export function startTraining(m) {
  if (G.state.academy || !readyBuilding('academy')) return false;
  const t = academyTrainTime(m);
  G.state.academy = { mon: m.id, until: G.now() + t * 1000, start: G.now() };
  G.markDirty();
  G.bus.emit('academy:start', { m });
  return true;
}

// ----------------------------------------------------------------------------
// Islands
// ----------------------------------------------------------------------------
export function islandUnlockBlocker(id) {
  const def = ISLAND_BY_ID[id];
  if (!def) return { reason: 'none' };
  if (G.state.islands.includes(id)) return { reason: 'owned' };
  if (G.state.player.level < def.unlockLevel) return { reason: 'level', level: def.unlockLevel };
  if (!canAfford({ gold: def.cost })) return { reason: 'cost' };
  return null;
}
export function unlockIsland(id) {
  if (islandUnlockBlocker(id)) return false;
  const def = ISLAND_BY_ID[id];
  spend({ gold: def.cost }, 'island');
  G.state.islands.push(id);
  addXP(200 + id * 150, 'island');
  stat('island');
  G.markDirty();
  G.bus.emit('island:unlocked', { id });
  return true;
}
export function nextLockedIsland() {
  return ISLANDS.find((i) => !G.state.islands.includes(i.id)) || null;
}

// ----------------------------------------------------------------------------
// Tick: completes timers and emits events
// ----------------------------------------------------------------------------
export function tickBuildings(now = G.now()) {
  for (const b of G.state.buildings) {
    if ((b.state === 'building' || b.state === 'upgrading') && b.until && now >= b.until) {
      if (b.state === 'building') onConstructed(b);
      else onUpgraded(b);
    }
    if (b.type === 'farm' && b.crop && now >= b.cropUntil && !b._notified) {
      b._notified = true;
      G.bus.emit('farm:ready', { b });
    }
    if (b.type === 'farm' && !b.crop) b._notified = false;
  }
  for (const [id, until] of Object.entries(G.state.obstacles.clearing)) if (now >= until) finishClearing(id);
  const ac = G.state.academy;
  if (ac && now >= ac.until) {
    const m = byId(ac.mon);
    G.state.academy = null;
    if (m) {
      m.lvl = Math.min(m.lvl + 1, 60);
      m.xp = 0;
      G.bus.emit('monster:levelup', { m, from: m.lvl - 1, to: m.lvl, evolved: m.lvl === 10 || m.lvl === 20, source: 'academy' });
      G.bus.emit('monster:changed', { m });
    }
    G.markDirty();
  }
}

export function initBuildingsSystem() {
  G.bus.on('monster:levelup', ({ m }) => {
    const b = m.hab ? byBuildingId(m.hab) : null;
    if (b) snapshotHabitat(b);
  });
}

export { isUnlocked };
