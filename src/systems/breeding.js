import { G } from '../game/G.js';
import { MONSTERS } from '../data/monsters.js';
import { RARITIES, rarityIdx, RARITY_LIST } from '../data/rarities.js';
import { BUILDINGS } from '../data/buildings.js';
import { rand } from '../core/rng.js';
import { species, byId } from './monsters.js';
import { elementUnlocked, isUnlocked, addXP } from './player.js';
import { readyBuilding } from './buildings.js';
import { addEgg, hatcheryHasRoom } from './hatchery.js';
import { add, spend, gemsForTime } from './resources.js';
import { stat, getStat } from './stats.js';

export function breedingRarityCap() {
  if (isUnlocked('legendary_breeding')) return 4;
  if (isUnlocked('rare_breeding')) return 3;
  return 2;
}

function recipeMatch(def, a, b) {
  if (!def.recipe) return false;
  return def.recipe.some(([x, y]) => (x === a.sp && y === b.sp) || (x === b.sp && y === a.sp));
}

export function breedBlocker(a, b) {
  if (!a || !b) return 'Pick two monsters';
  if (a.id === b.id) return 'Pick two different monsters';
  if (!readyBuilding('breeding')) return 'Build the Breeding Mountain';
  if (G.state.breeding) return 'Breeding Mountain is busy';
  if (species(a.sp).boss || species(b.sp).boss) return 'Cannot breed';
  return null;
}

// All possible offspring with probabilities. Recipes unlock special results.
export function breedOutcomes(a, b, { token = false } = {}) {
  const A = species(a.sp), B = species(b.sp);
  const els = new Set([...A.elements, ...B.elements]);
  const parentMax = Math.max(rarityIdx(A.rarity), rarityIdx(B.rarity));
  const cap = Math.min(breedingRarityCap(), parentMax + 1);
  const avgLvl = (a.lvl + b.lvl) / 2;
  const lvlBonus = Math.max(0, (avgLvl - 1) / 25);
  const list = [];
  for (const def of MONSTERS) {
    if (!def.breedable) continue;
    if (!def.elements.every((e) => els.has(e) && elementUnlocked(e))) continue;
    const r = rarityIdx(def.rarity);
    const isRecipe = recipeMatch(def, a, b);
    if (def.recipe) {
      if (!isRecipe) continue;
      if (r >= 4 && !isUnlocked('legendary_breeding')) continue;
    } else if (r > cap) continue;
    // parent-level gate for epic+ outcomes
    if (r >= 3 && !isRecipe && Math.min(a.lvl, b.lvl) < 10) continue;
    let w = RARITIES[def.rarity].weight;
    if (def.id === A.id || def.id === B.id) w *= 1.4;
    const spansBoth = def.elements.some((e) => A.elements.includes(e) && !B.elements.includes(e)) && def.elements.some((e) => B.elements.includes(e) && !A.elements.includes(e));
    if (spansBoth) w *= 1.7;
    w *= 1 + lvlBonus * r;
    if (isRecipe) w *= 2.5;
    if (token) w *= r >= 2 ? 3.5 : 0.35;
    list.push({ sp: def.id, w, rarity: def.rarity, recipe: isRecipe });
  }
  const total = list.reduce((s, x) => s + x.w, 0) || 1;
  for (const x of list) x.p = x.w / total;
  list.sort((x, y) => rarityIdx(x.rarity) - rarityIdx(y.rarity) || y.p - x.p);
  return list;
}

export function breedTime(sp) {
  const r = RARITIES[species(sp).rarity];
  const bm = readyBuilding('breeding');
  const speed = bm ? BUILDINGS.breeding.levels[bm.level - 1].speed : 1;
  let t = r.breedSec * speed;
  const n = getStat('breed');
  if (n < 1) t = Math.min(t, 10);
  else if (n < 4) t = Math.min(t, 30);
  else if (n < 8) t = Math.min(t, 90);
  return Math.round(t);
}

export function startBreeding(a, b, { token = false } = {}) {
  const block = breedBlocker(a, b);
  if (block) return { error: block };
  if (token && !spend({ tokens: 1 }, 'breed')) return { error: 'Need a Breeding Token' };
  let pick;
  const outs = breedOutcomes(a, b, { token });
  // The very first breeding always produces the first hybrid: a magical moment.
  const firstEver = getStat('breed') === 0 && !G.state.flags.firstBreedDone;
  const hybrid = outs.filter((o) => species(o.sp).elements.length >= 2 && rarityIdx(o.rarity) <= 1);
  if (firstEver && hybrid.length) pick = hybrid.sort((x, y) => y.p - x.p)[0];
  else {
    let r = rand.next();
    for (const o of outs) {
      if ((r -= o.p) <= 0) {
        pick = o;
        break;
      }
    }
    pick = pick || outs[outs.length - 1];
  }
  const t = breedTime(pick.sp);
  G.state.breeding = { a: a.id, b: b.id, sp: pick.sp, start: G.now(), until: G.now() + t * 1000, token };
  G.state.flags.firstBreedDone = true;
  G.markDirty();
  G.bus.emit('breed:start', { a, b, sp: pick.sp, time: t });
  return { sp: pick.sp, time: t };
}

export function breedingState() {
  const br = G.state.breeding;
  if (!br) return null;
  const left = Math.max(0, Math.ceil((br.until - G.now()) / 1000));
  return { ...br, left, done: left <= 0, total: Math.round((br.until - br.start) / 1000) };
}

export function breedingSkipCost() {
  const s = breedingState();
  return s ? gemsForTime(s.left) : 0;
}

export function skipBreeding() {
  const s = breedingState();
  if (!s || s.done) return true;
  const gems = gemsForTime(s.left);
  if (gems > 0 && !spend({ gems }, 'skip')) return false;
  G.state.breeding.until = G.now();
  G.markDirty();
  return true;
}

// Moves the finished egg into the hatchery.
export function collectBreedingEgg() {
  const s = breedingState();
  if (!s || !s.done) return null;
  if (!hatcheryHasRoom()) return { error: 'Hatchery is full' };
  const egg = addEgg(s.sp, { source: 'breed' });
  G.state.breeding = null;
  stat('breed');
  stat(`breed_${species(s.sp).rarity}`);
  addXP(10 + rarityIdx(species(s.sp).rarity) * 12, 'breed');
  G.markDirty();
  G.bus.emit('breed:collected', { egg, sp: s.sp });
  return { egg };
}

export function tickBreeding(now = G.now()) {
  const br = G.state.breeding;
  if (br && now >= br.until && !br.notified) {
    br.notified = true;
    G.bus.emit('breed:ready', { sp: br.sp });
  }
}

export function breedPairsHint() {
  return RARITY_LIST;
}
