import { G } from '../game/G.js';
import { MONSTERS } from '../data/monsters.js';
import { RARITIES, rarityIdx } from '../data/rarities.js';
import { BUILDINGS } from '../data/buildings.js';
import { rand } from '../core/rng.js';
import { species, createMonster, markSeen } from './monsters.js';
import { elementUnlocked, addXP } from './player.js';
import { readyBuilding } from './buildings.js';
import { spend, gemsForTime } from './resources.js';
import { stat, getStat } from './stats.js';

export function hatcherySlots() {
  const b = readyBuilding('hatchery');
  return b ? BUILDINGS.hatchery.levels[b.level - 1].slots : 1;
}

export function incubating() {
  return G.state.hatchery.filter((e) => e.until !== null);
}

export function hatcheryHasRoom() {
  return G.state.hatchery.length < hatcherySlots();
}

export function hatchTime(sp) {
  const r = RARITIES[species(sp).rarity];
  let t = r.hatchSec;
  const n = getStat('hatch');
  if (n < 2) t = Math.min(t, 8);
  else if (n < 5) t = Math.min(t, 20);
  else if (n < 10) t = Math.min(t, 60);
  return t;
}

// Adds an egg. Eggs beyond capacity wait (until = null) and start incubating
// automatically when a slot frees up.
export function addEgg(sp, { source = 'reward', instant = false, parents = null } = {}) {
  const active = incubating().length;
  const t = instant ? 0 : hatchTime(sp);
  const egg = {
    id: G.uid(),
    sp,
    source,
    start: G.now(),
    until: active < hatcherySlots() ? G.now() + t * 1000 : null,
    dur: t,
  };
  if (parents) egg.parents = parents;
  G.state.hatchery.push(egg);
  markSeen(sp);
  G.markDirty();
  G.bus.emit('egg:added', { egg });
  return egg;
}

export function eggLeft(egg) {
  if (egg.until === null) return egg.dur;
  return Math.max(0, Math.ceil((egg.until - G.now()) / 1000));
}

export function eggReady(egg) {
  return egg.until !== null && G.now() >= egg.until;
}

export function eggSkipCost(egg) {
  return gemsForTime(eggLeft(egg));
}

export function skipEgg(egg) {
  if (egg.until === null) return false;
  const gems = eggSkipCost(egg);
  if (gems > 0 && !spend({ gems }, 'skip')) return false;
  egg.until = G.now();
  G.markDirty();
  return true;
}

export function hatchEgg(egg) {
  if (!eggReady(egg)) return null;
  const i = G.state.hatchery.indexOf(egg);
  if (i < 0) return null;
  G.state.hatchery.splice(i, 1);
  const m = createMonster(egg.sp, { source: 'hatch', origin: egg.source, parents: egg.parents || null });
  stat('hatch');
  addXP(RARITIES[species(egg.sp).rarity].xp, 'hatch');
  promoteWaiting();
  G.markDirty();
  G.bus.emit('egg:hatched', { egg, m });
  return m;
}

function promoteWaiting() {
  const slots = hatcherySlots();
  for (const e of G.state.hatchery) {
    if (incubating().length >= slots) break;
    if (e.until === null) {
      e.start = G.now();
      e.until = G.now() + e.dur * 1000;
    }
  }
}

export function tickHatchery(now = G.now()) {
  promoteWaiting();
  for (const e of G.state.hatchery) {
    if (e.until !== null && now >= e.until && !e.notified) {
      e.notified = true;
      G.bus.emit('egg:ready', { egg: e });
    }
  }
}

// Picks a random species for reward eggs.
export function randomSpecies({ rarity = 'common', elements = null, exact = false } = {}) {
  const ri = rarityIdx(rarity);
  const ok = (m) => m.breedable && !m.recipe && m.elements.every((e) => elementUnlocked(e)) && (!elements || m.elements.every((e) => elements.includes(e)));
  let pool = MONSTERS.filter((m) => ok(m) && rarityIdx(m.rarity) === ri);
  if (!pool.length && !exact) pool = MONSTERS.filter((m) => ok(m) && rarityIdx(m.rarity) <= ri);
  if (!pool.length) pool = MONSTERS.filter((m) => m.breedable && !m.recipe && rarityIdx(m.rarity) === ri);
  if (!pool.length) pool = MONSTERS.filter((m) => rarityIdx(m.rarity) === 0);
  // prefer undiscovered species a little — collecting should feel rewarding
  const weighted = pool.map((m) => [m, G.state.dex[m.id] === 2 ? 1 : 1.8]);
  let total = weighted.reduce((s, x) => s + x[1], 0);
  let r = rand.next() * total;
  for (const [m, w] of weighted) if ((r -= w) <= 0) return m.id;
  return pool[0].id;
}
