import { G } from '../game/G.js';
import { BUILDINGS } from '../data/buildings.js';

export const BASE_GOLD_CAP = 6000;
export const BASE_FOOD_CAP = 4000;

function uniqueLevel(type) {
  const b = G.state.buildings.find((x) => x.type === type && x.state !== 'building');
  return b ? b.level : 0;
}

export function goldCap() {
  const l = uniqueLevel('gold_storage');
  return l ? BUILDINGS.gold_storage.levels[l - 1].goldCap : BASE_GOLD_CAP;
}
export function foodCap() {
  const l = uniqueLevel('food_storage');
  return l ? BUILDINGS.food_storage.levels[l - 1].foodCap : BASE_FOOD_CAP;
}
export function capOf(key) {
  if (key === 'gold') return goldCap();
  if (key === 'food') return foodCap();
  return Infinity;
}

export function res(key) {
  return G.state.res[key] || 0;
}

// Adds resources. `capped` limits production-type income to storage size and
// returns the amount actually added.
export function add(key, n, { capped = false, source = null } = {}) {
  if (!n) return 0;
  const r = G.state.res;
  let amount = n;
  if (capped && n > 0) {
    const room = Math.max(0, capOf(key) - (r[key] || 0));
    amount = Math.min(n, room);
  }
  r[key] = Math.max(0, (r[key] || 0) + amount);
  G.markDirty();
  G.bus.emit('res:changed', { key, delta: amount, value: r[key], source });
  return amount;
}

export function canAfford(cost) {
  if (!cost) return true;
  for (const [k, v] of Object.entries(cost)) if ((G.state.res[k] || 0) < v) return false;
  return true;
}

export function missing(cost) {
  const out = {};
  for (const [k, v] of Object.entries(cost || {})) {
    const have = G.state.res[k] || 0;
    if (have < v) out[k] = v - have;
  }
  return out;
}

export function spend(cost, source = null) {
  if (!canAfford(cost)) return false;
  for (const [k, v] of Object.entries(cost || {})) if (v) add(k, -v, { source });
  return true;
}

// Gems needed to skip `seconds` of waiting. Short waits are nearly free.
export function gemsForTime(seconds) {
  if (seconds <= 0) return 0;
  if (seconds <= 20) return 0;
  return Math.max(1, Math.ceil(Math.pow(seconds / 60, 0.72) * 1.4));
}

// Gems to buy missing gold/food.
export function gemsForResources(m) {
  let g = 0;
  if (m.gold) g += Math.ceil(m.gold / 90);
  if (m.food) g += Math.ceil(m.food / 70);
  return g;
}

// ---- Energy
export function maxEnergy() {
  return 20 + Math.floor(G.state.player.level / 5) * 2;
}
export const ENERGY_REGEN_SEC = 150;

export function refreshEnergy(now = G.now()) {
  const r = G.state.res;
  const max = maxEnergy();
  if (r.energy >= max) {
    r.energyTs = now;
    return;
  }
  const elapsed = Math.floor((now - (r.energyTs || now)) / 1000);
  const gained = Math.floor(elapsed / ENERGY_REGEN_SEC);
  if (gained > 0) {
    r.energy = Math.min(max, r.energy + gained);
    r.energyTs = r.energy >= max ? now : (r.energyTs || now) + gained * ENERGY_REGEN_SEC * 1000;
    G.markDirty();
    G.bus.emit('res:changed', { key: 'energy', delta: gained, value: r.energy });
  }
}

export function nextEnergyIn(now = G.now()) {
  const r = G.state.res;
  if (r.energy >= maxEnergy()) return 0;
  return Math.max(0, ENERGY_REGEN_SEC - Math.floor((now - r.energyTs) / 1000) % ENERGY_REGEN_SEC);
}
