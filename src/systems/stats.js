import { G } from '../game/G.js';

// Cumulative counters used by quests, daily quests and achievements.
export function stat(key, n = 1) {
  const s = G.state.stats;
  s[key] = (s[key] || 0) + n;
  G.markDirty();
  G.bus.emit('stat', { key, n, value: s[key] });
}

export function getStat(key) {
  return G.state.stats[key] || 0;
}
