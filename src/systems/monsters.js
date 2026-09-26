import { G } from '../game/G.js';
import { stageForLevel, formName } from '../data/evolutions.js';
import { MONSTER_BY_ID, MONSTERS } from '../data/monsters.js';
import { BOSSES } from '../data/bosses.js';
import { RARITIES, rarityIdx } from '../data/rarities.js';
import { RUNE_TYPES, RELIC_BY_ID } from '../data/rewards.js';
import { add } from './resources.js';
import { addXP } from './player.js';
import { stat } from './stats.js';

export function species(id) {
  return MONSTER_BY_ID[id] || BOSSES[id] || null;
}

export const ROLES = {
  brawler: { hp: 1.0, atk: 1.1, def: 1.0, spd: 1.0, crit: 0.08, label: 'Brawler' },
  tank: { hp: 1.38, atk: 0.8, def: 1.4, spd: 0.86, crit: 0.05, label: 'Tank' },
  striker: { hp: 0.86, atk: 1.32, def: 0.86, spd: 1.08, crit: 0.14, label: 'Striker' },
  speedster: { hp: 0.9, atk: 1.06, def: 0.86, spd: 1.3, crit: 0.1, label: 'Speedster' },
  support: { hp: 1.12, atk: 0.86, def: 1.05, spd: 1.04, crit: 0.06, label: 'Support' },
  caster: { hp: 0.92, atk: 1.22, def: 0.9, spd: 1.06, crit: 0.1, label: 'Caster' },
};

export const RANK_LEVEL_CAP = [20, 25, 30, 40, 50, 60];
export const MAX_RANK = 5;

export function maxLevel(m) {
  return RANK_LEVEL_CAP[Math.min(MAX_RANK, m.rank || 0)];
}

export function stageOf(m) {
  return stageForLevel(m.lvl);
}

// Food needed to go from level L to L+1.
export function feedCost(level) {
  return Math.round(11 * Math.pow(level, 1.55) + 9);
}

export function byId(id) {
  return G.state.monsters.find((m) => m.id === id) || null;
}

export function createMonster(sp, { level = 1, source = 'hatch', habitat = null, origin = null, parents = null } = {}) {
  const def = species(sp);
  if (!def) throw new Error(`Unknown species ${sp}`);
  const m = { id: G.uid(), sp, lvl: level, xp: 0, rank: 0, hab: habitat, runes: [], relic: null, got: G.now(), src: origin || source };
  if (parents) m.par = parents;
  G.state.monsters.push(m);
  const firstTime = !G.state.dex[sp] || G.state.dex[sp] < 2;
  G.state.dex[sp] = 2;
  G.markDirty();
  G.bus.emit('monster:added', { m, firstTime, source });
  if (firstTime) G.bus.emit('dex:discovered', { sp });
  return m;
}

export function markSeen(sp) {
  if (!G.state.dex[sp]) {
    G.state.dex[sp] = 1;
    G.markDirty();
  }
}

export function removeMonster(m) {
  const i = G.state.monsters.indexOf(m);
  if (i >= 0) G.state.monsters.splice(i, 1);
  G.state.team = G.state.team.filter((id) => id !== m.id);
  // free runes back to inventory
  for (const rid of m.runes || []) {
    const r = G.state.inventory.runes.find((x) => x.id === rid);
    if (r) r.on = null;
  }
  G.markDirty();
  G.bus.emit('monster:removed', { m });
}

export function runeBonus(m) {
  const b = { hp: 0, atk: 0, def: 0, spd: 0 };
  for (const rid of m.runes || []) {
    const r = G.state.inventory.runes.find((x) => x.id === rid);
    if (!r) continue;
    const t = RUNE_TYPES[r.type];
    b[t.stat] += t.values[r.tier - 1];
  }
  return b;
}

// Full combat stats.
export function monStats(m, opts = {}) {
  const def = species(m.sp);
  const role = ROLES[def.role] || ROLES.brawler;
  const rar = RARITIES[def.rarity];
  const L = m.lvl;
  const rank = m.rank || 0;
  const rb = opts.noRunes ? { hp: 0, atk: 0, def: 0, spd: 0 } : runeBonus(m);
  const relic = m.relic ? RELIC_BY_ID[m.relic] : null;
  const rs = (relic && relic.effect.stat) || {};
  const rankK = 1 + 0.09 * rank;
  const s = {
    hp: Math.round(160 * role.hp * rar.stat * (1 + 0.105 * (L - 1)) * rankK * (1 + rb.hp + (rs.hp || 0))),
    atk: Math.round(30 * role.atk * rar.stat * (1 + 0.095 * (L - 1)) * rankK * (1 + rb.atk)),
    def: Math.round(22 * role.def * rar.stat * (1 + 0.085 * (L - 1)) * rankK * (1 + rb.def)),
    spd: Math.round(100 * role.spd * (1 + 0.03 * rar.idx) * (1 + 0.004 * (L - 1)) * (1 + 0.02 * rank) * (1 + rb.spd + (rs.spd || 0))),
    crit: role.crit + (relic && relic.effect.crit ? relic.effect.crit : 0) + rank * 0.01,
    res: 0.05 + 0.025 * rar.idx + 0.02 * rank,
  };
  if (def.boss && def.mechanics) {
    s.hp = Math.round(s.hp * (def.mechanics.hpMult || 3));
    s.atk = Math.round(s.atk * (def.mechanics.atkMult || 1.05));
  }
  return s;
}

export function power(m) {
  const s = monStats(m);
  return Math.round(s.hp * 0.35 + s.atk * 2.2 + s.def * 1.6 + s.spd * 0.6);
}

// Gold per minute produced while living in a habitat.
export function goldRate(m) {
  const def = species(m.sp);
  const rar = RARITIES[def.rarity];
  return 20 * rar.gold * (1 + 0.12 * (m.lvl - 1)) * (1 + 0.05 * (m.rank || 0));
}

export function canFeed(m) {
  return m.lvl < maxLevel(m);
}

// Feed a monster. mode: 1 (a quarter level), 'level' (to next level), 5 (five feeds)
// Returns { spent, levels, evolved, capped, nofood }
export function feed(m, mode = 1) {
  const res = { spent: 0, levels: 0, evolved: false, capped: false, nofood: false, fromStage: stageOf(m) };
  const feeds = mode === 'level' ? 999 : mode;
  const startLvl = m.lvl;
  for (let i = 0; i < feeds; i++) {
    if (!canFeed(m)) {
      res.capped = true;
      break;
    }
    const need = feedCost(m.lvl);
    const chunk = Math.max(1, Math.ceil(need / 4));
    const remaining = need - m.xp;
    const give = Math.min(chunk, remaining);
    if ((G.state.res.food || 0) < give) {
      res.nofood = true;
      break;
    }
    add('food', -give, { source: 'feed' });
    m.xp += give;
    res.spent += give;
    stat('feed');
    if (m.xp >= need) {
      m.xp = 0;
      m.lvl += 1;
      res.levels += 1;
      addXP(4 + Math.floor(m.lvl / 2), 'feed');
      if (mode === 'level') break;
    }
  }
  if (res.levels) {
    const stageNow = stageOf(m);
    if (stageNow !== res.fromStage) res.evolved = true;
    G.bus.emit('monster:levelup', { m, from: startLvl, to: m.lvl, evolved: res.evolved });
  }
  if (res.spent) {
    G.markDirty();
    G.bus.emit('monster:changed', { m });
  }
  return res;
}

// Food needed to reach the next level from the current xp.
export function foodToNext(m) {
  return feedCost(m.lvl) - m.xp;
}

// ---------------- Shards & ranks
export function shardsFor(sp) {
  return G.state.shards[sp] || 0;
}
export function rankCost(m) {
  const rar = RARITIES[species(m.sp).rarity];
  return Math.round(rar.shards * (1 + (m.rank || 0) * 0.8));
}
export function rankGoldCost(m) {
  return Math.round(500 * Math.pow(3, m.rank || 0) * (1 + rarityIdx(species(m.sp).rarity) * 0.5));
}
export function rankUp(m) {
  const need = rankCost(m);
  if ((m.rank || 0) >= MAX_RANK) return false;
  if (shardsFor(m.sp) < need) return false;
  const gold = rankGoldCost(m);
  if ((G.state.res.gold || 0) < gold) return false;
  add('gold', -gold, { source: 'rank' });
  G.state.shards[m.sp] -= need;
  m.rank = (m.rank || 0) + 1;
  stat('rank');
  G.markDirty();
  G.bus.emit('monster:rankup', { m });
  G.bus.emit('monster:changed', { m });
  return true;
}
export function addShards(sp, n) {
  G.state.shards[sp] = (G.state.shards[sp] || 0) + n;
  G.markDirty();
  G.bus.emit('shards:changed', { sp, n });
}
// Converting a monster into shards of its own species (duplicates become useful).
export function releaseValue(m) {
  const rar = RARITIES[species(m.sp).rarity];
  return Math.round(rar.shardValue * (1 + m.lvl * 0.08));
}
export function release(m) {
  const n = releaseValue(m);
  addShards(m.sp, n);
  removeMonster(m);
  return n;
}
export function ownedCount(sp) {
  return G.state.monsters.filter((m) => m.sp === sp).length;
}

// Collecting enough shards of an undiscovered/unowned monster summons it.
export function summonCost(sp) {
  const rar = RARITIES[species(sp).rarity];
  return rar.shards * 3;
}
export function summonFromShards(sp) {
  const need = summonCost(sp);
  if (shardsFor(sp) < need) return null;
  G.state.shards[sp] -= need;
  return createMonster(sp, { source: 'shards' });
}

export function discoveredCount() {
  return MONSTERS.filter((m) => G.state.dex[m.id] === 2).length;
}

// Highest form of a species the keeper has raised (for the Monsterdex).
export function formsReached(sp) {
  let best = -1;
  const rec = G.state.dexForms && G.state.dexForms[sp];
  if (rec !== undefined) best = rec;
  for (const m of G.state.monsters) if (m.sp === sp) best = Math.max(best, stageOf(m));
  return best;
}
function noteForm(m) {
  const f = (G.state.dexForms = G.state.dexForms || {});
  const s = stageOf(m);
  if ((f[m.sp] ?? -1) < s) {
    f[m.sp] = s;
    G.markDirty();
  }
}
G.bus.on('monster:levelup', ({ m }) => m && noteForm(m));
G.bus.on('monster:added', ({ m }) => m && noteForm(m));

// A nickname if the keeper gave one, otherwise the name of its current form.
export function monsterName(m) {
  return m.nick || formName(species(m.sp), stageOf(m));
}

export function sortMonsters(list, key = 'power') {
  const rar = (m) => rarityIdx(species(m.sp).rarity);
  const fn = {
    power: (a, b) => power(b) - power(a),
    level: (a, b) => b.lvl - a.lvl || rar(b) - rar(a),
    rarity: (a, b) => rar(b) - rar(a) || b.lvl - a.lvl,
    name: (a, b) => species(a.sp).name.localeCompare(species(b.sp).name),
    recent: (a, b) => b.got - a.got,
  }[key];
  // favourites always lead the list
  return list.slice().sort((a, b) => (b.fav ? 1 : 0) - (a.fav ? 1 : 0) || fn(a, b));
}
