import { G } from '../game/G.js';
import { getStage, WORLDS, STAGES_PER_WORLD, STAR_CHESTS } from '../data/campaign.js';
import { refreshEnergy } from './resources.js';
import { addXP } from './player.js';
import { grant } from './rewards.js';
import { stat } from './stats.js';

export function isCleared(id) {
  return !!G.state.campaign.clears[id];
}

export function stars(id) {
  return G.state.campaign.stars[id] || 0;
}

// Highest stage the player may attempt (the one after the last cleared).
export function frontier() {
  for (let w = 1; w <= WORLDS.length; w++) {
    for (let s = 1; s <= STAGES_PER_WORLD; s++) {
      if (!isCleared(`${w}-${s}`)) return { w, s };
    }
  }
  return { w: WORLDS.length, s: STAGES_PER_WORLD };
}

export function stageUnlocked(w, s) {
  const f = frontier();
  return w < f.w || (w === f.w && s <= f.s);
}

export function worldUnlocked(w) {
  return w === 1 || isCleared(`${w - 1}-${STAGES_PER_WORLD}`);
}

export function worldStars(w) {
  let n = 0;
  for (let s = 1; s <= STAGES_PER_WORLD; s++) n += stars(`${w}-${s}`);
  return n;
}

export function canEnter(stage) {
  refreshEnergy();
  return G.state.res.energy >= stage.energy;
}

export function spendEnergy(stage) {
  refreshEnergy();
  if (G.state.res.energy < stage.energy) return false;
  if (stage.energy > 0) {
    G.state.res.energy -= stage.energy;
    G.bus.emit('res:changed', { key: 'energy', delta: -stage.energy, value: G.state.res.energy });
  }
  G.markDirty();
  return true;
}

export function refundEnergy(stage) {
  G.state.res.energy += stage.energy;
  G.bus.emit('res:changed', { key: 'energy', delta: stage.energy, value: G.state.res.energy });
  G.markDirty();
}

// Records a victory and grants rewards. Returns the list of granted items.
export function completeStage(stage, starCount, { bonus = 1 } = {}) {
  const id = stage.id;
  const first = !isCleared(id);
  const C = G.state.campaign;
  C.clears[id] = (C.clears[id] || 0) + 1;
  C.stars[id] = Math.max(C.stars[id] || 0, starCount);
  const mult = first ? 1 : 0.5;
  const reward = {
    gold: Math.round(stage.rewards.gold * mult * bonus),
    food: Math.round(stage.rewards.food * mult * bonus),
  };
  const items = grant(reward, 'campaign');
  addXP(Math.round(stage.rewards.xp * (first ? 1 : 0.6)), 'campaign');
  items.push({ kind: 'xp', n: Math.round(stage.rewards.xp * (first ? 1 : 0.6)) });
  if (first) {
    const f = stage.first;
    const extra = {};
    if (f.gems) extra.gems = f.gems;
    if (f.egg) extra.egg = f.egg;
    if (f.chest) extra.chest = f.chest;
    if (f.rune) extra.rune = f.rune;
    items.push(...grant(extra, 'campaign'));
    stat('campaign_clears');
  }
  if (stage.type === 'boss') stat('boss_wins');
  stat('win');
  // star chests
  const ws = worldStars(stage.world);
  const claimed = C.starChests[stage.world] || [];
  for (const sc of STAR_CHESTS) {
    if (ws >= sc.stars && !claimed.includes(sc.stars)) {
      claimed.push(sc.stars);
      items.push(...grant({ chest: sc.chest }, 'stars'));
    }
  }
  C.starChests[stage.world] = claimed;
  G.markDirty();
  G.bus.emit('campaign:win', { stage, first, stars: starCount, items });
  return { items, first };
}

// Resolves non-battle nodes (treasure chests and mystery rewards).
export function resolveNode(stage) {
  const first = !isCleared(stage.id);
  const C = G.state.campaign;
  C.clears[stage.id] = (C.clears[stage.id] || 0) + 1;
  C.stars[stage.id] = 3;
  let items = [];
  if (first) {
    if (stage.type === 'treasure') items = grant({ chest: stage.first.chest, gold: stage.rewards.gold }, 'campaign');
    else if (stage.mystery) {
      const m = stage.mystery;
      const r = m.kind === 'egg' ? { egg: { rarity: ['common', 'uncommon', 'rare'][m.rarity] || 'uncommon', elements: m.elements } } : { [m.kind]: m.amount };
      items = grant(r, 'campaign');
    }
    addXP(stage.rewards.xp, 'campaign');
    stat('campaign_clears');
  } else {
    items = grant({ gold: Math.round(stage.rewards.gold * 0.3) }, 'campaign');
  }
  G.markDirty();
  G.bus.emit('campaign:node', { stage, items, first });
  return items;
}

export { getStage, WORLDS, STAGES_PER_WORLD };
