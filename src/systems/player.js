import { G } from '../game/G.js';
import { xpToNext, unlocksAt, featureLevel, MAX_PLAYER_LEVEL } from '../data/unlocks.js';
import { ELEMENTS } from '../data/elements.js';
import { add, maxEnergy } from './resources.js';
import { stat } from './stats.js';

export function isUnlocked(feature) {
  return G.state.player.level >= featureLevel(feature);
}

export function elementUnlocked(el) {
  const e = ELEMENTS[el];
  return !!e && G.state.player.level >= e.unlock;
}

export function levelReward(level) {
  return {
    gold: 80 * level + 40,
    food: 50 * level,
    gems: level % 5 === 0 ? 10 : 2,
  };
}

// Grants XP and processes any level-ups. Level-up events are queued so the UI
// can show them at a natural moment (never mid-battle-animation).
export function addXP(n, source = null) {
  if (!n || n <= 0) return;
  const p = G.state.player;
  if (p.level >= MAX_PLAYER_LEVEL) return;
  p.xp += Math.round(n);
  G.bus.emit('player:xp', { delta: n, source });
  while (p.level < MAX_PLAYER_LEVEL && p.xp >= xpToNext(p.level)) {
    p.xp -= xpToNext(p.level);
    p.level += 1;
    const reward = levelReward(p.level);
    add('gold', reward.gold, { source: 'levelup' });
    add('food', reward.food, { source: 'levelup' });
    add('gems', reward.gems, { source: 'levelup' });
    // Level-ups refill energy
    G.state.res.energy = Math.max(G.state.res.energy, maxEnergy());
    stat('level_reached', 0);
    G.bus.emit('player:levelup', { level: p.level, unlocks: unlocksAt(p.level), reward });
  }
  G.markDirty();
}

export function xpProgress() {
  const p = G.state.player;
  const need = xpToNext(p.level);
  return { xp: p.xp, need, k: Math.min(1, p.xp / need) };
}
