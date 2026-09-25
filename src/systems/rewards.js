import { G, dayKey } from '../game/G.js';
import { CHESTS, DAILY_REWARDS, WHEEL, RUNE_TYPES } from '../data/rewards.js';
import { MONSTERS } from '../data/monsters.js';
import { rand } from '../core/rng.js';
import { add, maxEnergy } from './resources.js';
import { addXP } from './player.js';
import { addEgg, randomSpecies } from './hatchery.js';
import { addShards } from './monsters.js';
import { stat } from './stats.js';

// Grants any reward object: { gold, food, gems, xp, tokens, energy, egg, species, chest, rune, shards, relicFrags }
// Returns a normalized list of granted items for display.
export function grant(reward, source = 'reward') {
  const out = [];
  if (!reward) return out;
  for (const k of ['gold', 'food', 'gems', 'tokens', 'relicFrags', 'runeDust']) {
    if (reward[k]) {
      add(k, reward[k], { source });
      out.push({ kind: k, n: reward[k] });
    }
  }
  if (reward.energy) {
    G.state.res.energy = Math.min(maxEnergy() * 2, G.state.res.energy + reward.energy);
    G.bus.emit('res:changed', { key: 'energy', delta: reward.energy, value: G.state.res.energy });
    out.push({ kind: 'energy', n: reward.energy });
  }
  if (reward.xp) {
    addXP(reward.xp, source);
    out.push({ kind: 'xp', n: reward.xp });
  }
  if (reward.egg) {
    const spec = typeof reward.egg === 'string' ? { rarity: reward.egg } : reward.egg;
    const sp = spec.species || randomSpecies({ rarity: spec.rarity || 'common', elements: spec.elements || null });
    addEgg(sp, { source });
    out.push({ kind: 'egg', sp, rarity: spec.rarity });
  }
  if (reward.species) {
    addEgg(reward.species, { source });
    out.push({ kind: 'egg', sp: reward.species });
  }
  if (reward.chest) {
    addChest(reward.chest);
    out.push({ kind: 'chest', id: reward.chest });
  }
  if (reward.rune) {
    const r = addRune(randomRuneType(), reward.rune);
    out.push({ kind: 'rune', rune: r });
  }
  if (reward.shards) {
    const sp = reward.shardSp || randomOwnedSpecies();
    addShards(sp, reward.shards);
    out.push({ kind: 'shards', sp, n: reward.shards });
  }
  G.markDirty();
  G.bus.emit('reward:granted', { items: out, source });
  return out;
}

function randomOwnedSpecies() {
  const owned = MONSTERS.filter((m) => G.state.dex[m.id] === 2);
  const pool = owned.length ? owned : MONSTERS.filter((m) => m.rarity === 'common');
  return rand.pick(pool).id;
}

// ---------------- Chests
export function addChest(id, n = 1) {
  const c = G.state.inventory.chests;
  c[id] = (c[id] || 0) + n;
  G.markDirty();
  G.bus.emit('chest:added', { id });
}

function rollRange(r) {
  return Array.isArray(r) ? Math.round(r[0] + rand.next() * (r[1] - r[0])) : r;
}

export function chestOdds(id) {
  const t = CHESTS[id].table;
  const total = t.reduce((s, x) => s + x.w, 0);
  return t.map((x) => ({ ...x, p: x.w / total }));
}

export function openChest(id) {
  const c = G.state.inventory.chests;
  if (!c[id]) return null;
  c[id] -= 1;
  const def = CHESTS[id];
  const reward = {};
  const items = [];
  for (let i = 0; i < def.rolls; i++) {
    const total = def.table.reduce((s, x) => s + x.w, 0);
    let r = rand.next() * total;
    let row = def.table[0];
    for (const x of def.table) if ((r -= x.w) <= 0) {
      row = x;
      break;
    }
    if (row.gold) reward.gold = (reward.gold || 0) + rollRange(row.gold);
    if (row.food) reward.food = (reward.food || 0) + rollRange(row.food);
    if (row.gems) reward.gems = (reward.gems || 0) + rollRange(row.gems);
    if (row.shards) items.push({ shards: rollRange(row.shards) });
    if (row.rune) items.push({ rune: row.rune });
    if (row.egg) items.push({ egg: row.egg });
  }
  const granted = grant(reward, 'chest');
  for (const it of items) granted.push(...grant(it, 'chest'));
  stat('chest');
  G.markDirty();
  return granted;
}

// ---------------- Runes
export function randomRuneType() {
  return rand.pick(Object.keys(RUNE_TYPES));
}
export function addRune(type, tier = 1) {
  const r = { id: G.uid(), type, tier: Math.max(1, Math.min(5, tier)), on: null };
  G.state.inventory.runes.push(r);
  G.markDirty();
  G.bus.emit('rune:added', { r });
  return r;
}

// ---------------- Daily login (7-day cycle)
export function loginStatus(now = G.now()) {
  const L = G.state.login;
  const today = dayKey(now);
  const claimedToday = L.claimedDay === today;
  // streak continues if last claim was yesterday
  const yesterday = dayKey(now - 86400000);
  let day = L.day || 0;
  if (!claimedToday) {
    if (L.claimedDay !== yesterday) day = 0;
    day = (day % 7) + 1;
  }
  return { today, claimedToday, day, reward: DAILY_REWARDS[day - 1] };
}

export function claimLogin() {
  const st = loginStatus();
  if (st.claimedToday) return null;
  const L = G.state.login;
  L.day = st.day;
  L.claimedDay = st.today;
  L.streak = (L.streak || 0) + 1;
  stat('login_days');
  const items = grant(st.reward.reward, 'daily');
  G.markDirty();
  return { day: st.day, items };
}

// ---------------- Lucky wheel
export function wheelStatus(now = G.now()) {
  const W = G.state.wheel;
  const today = dayKey(now);
  return { free: W.lastDay !== today, adSpin: W.adSpin !== today };
}
export function spinWheel(viaAd = false) {
  const st = wheelStatus();
  if (!viaAd && !st.free) return null;
  if (viaAd && !st.adSpin) return null;
  const total = WHEEL.reduce((s, x) => s + x.w, 0);
  let r = rand.next() * total;
  let idx = 0;
  for (let i = 0; i < WHEEL.length; i++) if ((r -= WHEEL[i].w) <= 0) {
    idx = i;
    break;
  }
  const today = dayKey();
  if (viaAd) G.state.wheel.adSpin = today;
  else G.state.wheel.lastDay = today;
  stat('spin');
  G.markDirty();
  return { idx, seg: WHEEL[idx] };
}
export function wheelOdds() {
  const total = WHEEL.reduce((s, x) => s + x.w, 0);
  return WHEEL.map((x) => ({ ...x, p: x.w / total }));
}
