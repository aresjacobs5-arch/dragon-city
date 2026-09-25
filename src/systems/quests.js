import { G, dayKey } from '../game/G.js';
import { MAIN_QUESTS, DAILY_POOL, DAILY_COUNT } from '../data/quests.js';
import { ACHIEVEMENTS } from '../data/achievements.js';
import { BUILDINGS } from '../data/buildings.js';
import { MONSTERS } from '../data/monsters.js';
import { RARITY_LIST, rarityIdx } from '../data/rarities.js';
import { RNG } from '../core/rng.js';
import { getStat } from './stats.js';
import { species } from './monsters.js';
import { grant } from './rewards.js';

// Current value for a goal (compared against goal.n).
export function goalValue(goal) {
  const st = G.state;
  switch (goal.type) {
    case 'build':
      return st.buildings.filter((b) => b.type === goal.id && b.state !== 'building').length;
    case 'build_category':
      return st.buildings.filter((b) => BUILDINGS[b.type].category === goal.category && b.state !== 'building').length;
    case 'own':
      return st.monsters.length;
    case 'breed_rarity': {
      const i = rarityIdx(goal.rarity);
      return RARITY_LIST.slice(i).reduce((s, r) => s + getStat(`breed_${r}`), 0);
    }
    case 'monster_level':
      return st.monsters.some((m) => m.lvl >= goal.level) ? 1 : 0;
    case 'campaign':
      return st.campaign.clears[goal.id] ? 1 : 0;
    case 'level':
      return st.player.level;
    case 'upgrade':
      return goal.category ? getStat(`upgrade_cat_${goal.category}`) : getStat('upgrade');
    case 'discover':
      return MONSTERS.filter((m) => st.dex[m.id] === 2).length;
    case 'discover_rarity':
      return MONSTERS.filter((m) => st.dex[m.id] === 2 && rarityIdx(m.rarity) >= rarityIdx(goal.rarity)).length;
    case 'island':
      return st.islands.length;
    case 'rank_max':
      return st.monsters.reduce((mx, m) => Math.max(mx, m.rank || 0), 0);
    case 'rune':
      return st.inventory.runes.filter((r) => r.on).length;
    case 'tower':
      return st.tower.floor;
    case 'element_owned':
      return new Set(st.monsters.filter((m) => species(m.sp).elements.includes(goal.element)).map((m) => m.sp)).size;
    default:
      return getStat(goal.type);
  }
}

// ---------------- Main quest chain
export function currentMain() {
  const q = MAIN_QUESTS[G.state.quests.main];
  if (!q) return null;
  const v = goalValue(q.goal);
  return { ...q, value: Math.min(v, q.goal.n), done: v >= q.goal.n };
}

export function claimMain() {
  const q = currentMain();
  if (!q || !q.done) return null;
  G.state.quests.main += 1;
  const items = grant(q.reward, 'quest');
  G.markDirty();
  G.bus.emit('quest:claimed', { q, items, main: true });
  return items;
}

// ---------------- Daily quests
export function ensureDaily(now = G.now()) {
  const today = dayKey(now);
  const Q = G.state.quests;
  if (Q.daily && Q.daily.day === today) return Q.daily;
  const lvl = G.state.player.level;
  const rng = new RNG(`daily-${today}-${G.state.seed}`);
  const pool = rng.shuffle(DAILY_POOL.filter((d) => lvl >= (d.minLevel || 1)));
  const list = pool.slice(0, DAILY_COUNT).map((d) => {
    const n = Math.max(1, Math.round(d.base + d.perLevel * lvl));
    return { id: d.id, key: d.goal.type, n, base: getStat(d.goal.type), claimed: false };
  });
  Q.daily = { day: today, list, chest: false };
  G.markDirty();
  G.bus.emit('daily:new', {});
  return Q.daily;
}

export function dailyList() {
  const d = ensureDaily();
  return d.list.map((x) => {
    const def = DAILY_POOL.find((p) => p.id === x.id);
    const v = Math.min(x.n, getStat(x.key) - x.base);
    return { ...x, def, text: def.text.replace('{n}', x.n.toLocaleString()), value: Math.max(0, v), done: v >= x.n, reward: def.reward };
  });
}

export function claimDaily(id) {
  const d = ensureDaily();
  const it = dailyList().find((x) => x.id === id);
  if (!it || !it.done || it.claimed) return null;
  d.list.find((x) => x.id === id).claimed = true;
  const items = grant(it.reward, 'daily');
  G.markDirty();
  G.bus.emit('quest:claimed', { q: it, items, daily: true });
  return items;
}

export function dailyChestReady() {
  const d = ensureDaily();
  return !d.chest && d.list.every((x) => x.claimed);
}

export function claimDailyChest() {
  if (!dailyChestReady()) return null;
  G.state.quests.daily.chest = true;
  const items = grant({ chest: G.state.player.level >= 15 ? 'gold' : 'silver', tokens: G.state.player.level >= 15 ? 1 : 0 }, 'daily');
  G.markDirty();
  return items;
}

// ---------------- Achievements
export function achievementList() {
  return ACHIEVEMENTS.map((a) => {
    const v = goalValue(a.goal);
    return { ...a, value: Math.min(v, a.goal.n), done: v >= a.goal.n, claimed: !!G.state.achievements[a.id] };
  });
}

export function claimAchievement(id) {
  const a = achievementList().find((x) => x.id === id);
  if (!a || !a.done || a.claimed) return null;
  G.state.achievements[id] = true;
  const items = grant(a.reward, 'achievement');
  G.markDirty();
  G.bus.emit('achievement:claimed', { a, items });
  return items;
}

// Count of claimable things for the HUD badge.
export function claimableCount() {
  let n = 0;
  const m = currentMain();
  if (m && m.done) n++;
  n += dailyList().filter((x) => x.done && !x.claimed).length;
  if (dailyChestReady()) n++;
  n += achievementList().filter((a) => a.done && !a.claimed).length;
  return n;
}

// Tracks newly completed quests to trigger a small celebration once.
const notified = new Set();
export function checkCompletions() {
  const m = currentMain();
  if (m && m.done && !notified.has(`m:${m.id}`)) {
    notified.add(`m:${m.id}`);
    G.bus.emit('quest:complete', { q: m, main: true });
  }
  for (const d of dailyList()) {
    if (d.done && !d.claimed && !notified.has(`d:${d.id}:${G.state.quests.daily.day}`)) {
      notified.add(`d:${d.id}:${G.state.quests.daily.day}`);
      G.bus.emit('quest:complete', { q: d, daily: true });
    }
  }
  for (const a of achievementList()) {
    if (a.done && !a.claimed && !notified.has(`a:${a.id}`)) {
      notified.add(`a:${a.id}`);
      G.bus.emit('achievement:complete', { a });
    }
  }
}
