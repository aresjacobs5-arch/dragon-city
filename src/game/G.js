import { Bus } from '../core/bus.js';

// Global game context shared by all systems and UI.
export const G = {
  state: null,
  bus: new Bus(),
  timeOffset: 0, // debug time travel (ms)
  dirty: false,
  engine: null, // render engine (set at boot)
  world: null, // home world view
  ui: null, // ui root
  sdk: null,
  audio: null,
  mode: 'island',
  now() {
    return Date.now() + this.timeOffset;
  },
  markDirty() {
    this.dirty = true;
  },
  uid() {
    this.state.uid = (this.state.uid || 100) + 1;
    return this.state.uid;
  },
};

export const SAVE_VERSION = 3;

export function dayKey(t = G.now()) {
  const d = new Date(t);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

export function createNewState(now = Date.now()) {
  return {
    v: SAVE_VERSION,
    created: now,
    lastTick: now,
    seed: Math.floor(Math.random() * 1e9),
    uid: 100,
    player: { level: 1, xp: 0, name: 'Tamer' },
    res: { gold: 200, food: 40, gems: 25, tokens: 0, energy: 20, energyTs: now, relicFrags: 0, runeDust: 0 },
    shards: {},
    islands: [0],
    buildings: [],
    obstacles: { removed: [], clearing: {} },
    monsters: [],
    dex: {},
    hatchery: [],
    breeding: null,
    campaign: { stars: {}, clears: {}, world: 1, starChests: {} },
    tower: { floor: 0 },
    quests: { main: 0, claimedMain: [], daily: null },
    achievements: {},
    stats: {},
    login: { lastDay: null, streak: 0, day: 0, claimedDay: null },
    wheel: { lastDay: null, adSpin: null },
    events: { key: null, points: 0, claimed: [] },
    inventory: { chests: {}, runes: [], relics: {} },
    team: [],
    academy: null,
    tutorial: { step: 0, done: false },
    settings: { music: 0.45, sfx: 0.8, muted: false },
    flags: {},
    ads: { lastMidgame: 0, day: null, rewarded: 0 },
    notices: [],
  };
}
