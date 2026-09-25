// Campaign: data-driven worlds + a deterministic stage generator, so hundreds
// of encounters stay manageable. Adding a world = adding an entry to WORLDS.
import { RNG } from '../core/rng.js';
import { MONSTERS } from './monsters.js';
import { rarityIdx } from './rarities.js';

export const STAGES_PER_WORLD = 30;

export const WORLDS = [
  { id: 1, name: 'Greenwild Valley', theme: 'verdant', levels: [1, 10], elements: ['nature', 'fire', 'water', 'earth'], maxRarity: 1, boss: 'boss_colossus', energy: 1, color: '#6fc24a' },
  { id: 2, name: 'Ember Highlands', theme: 'volcanic', levels: [9, 18], elements: ['fire', 'earth', 'electric', 'dark'], maxRarity: 2, boss: 'boss_lavaturtle', energy: 2, color: '#ff7a3a' },
  { id: 3, name: 'Coral Kingdom', theme: 'coral', levels: [16, 26], elements: ['water', 'nature', 'electric', 'ice'], maxRarity: 2, boss: 'boss_kraken', energy: 2, color: '#2fc6e0' },
  { id: 4, name: 'Thunder Peaks', theme: 'storm', levels: [24, 34], elements: ['electric', 'metal', 'earth', 'light'], maxRarity: 3, boss: 'boss_stormdragon', energy: 2, color: '#6a7ac8' },
  { id: 5, name: 'Frozen Frontier', theme: 'frozen', levels: [32, 42], elements: ['ice', 'water', 'light', 'metal'], maxRarity: 3, boss: 'boss_behemoth', energy: 3, color: '#8fd8ff' },
  { id: 6, name: 'Shadow Marsh', theme: 'marsh', levels: [40, 50], elements: ['dark', 'nature', 'magic', 'water'], maxRarity: 3, boss: 'boss_hydra', energy: 3, color: '#6f8a5a' },
  { id: 7, name: 'Arcane Kingdom', theme: 'arcane', levels: [48, 58], elements: ['magic', 'light', 'metal', 'ice'], maxRarity: 4, boss: 'boss_sphinx', energy: 3, color: '#9a7fff' },
  { id: 8, name: 'Celestial Rift', theme: 'celestial', levels: [56, 70], elements: ['celestial', 'void', 'ancient', 'light', 'dark'], maxRarity: 4, boss: 'boss_voidemperor', energy: 3, color: '#ffb8e0' },
];

// Node pattern for each block of 10 stages.
const PATTERN = ['battle', 'battle', 'battle', 'mystery', 'treasure', 'battle', 'battle', 'challenge', 'battle', 'elite'];

const CHALLENGE_RULES = [
  { id: 'max2', label: 'Two monsters only', maxTeam: 2 },
  { id: 'enrage', label: 'Enemies start enraged', enemyBuff: 'atkUp' },
  { id: 'element', label: 'Single element team', sameElement: true },
  { id: 'armored', label: 'Enemies start shielded', enemyShield: 0.25 },
];

function poolFor(world, maxRarity) {
  return MONSTERS.filter((m) => m.breedable && m.elements.every((e) => world.elements.includes(e)) && rarityIdx(m.rarity) <= maxRarity);
}

export function stageType(s) {
  if (s === STAGES_PER_WORLD) return 'boss';
  return PATTERN[(s - 1) % 10];
}

export function stageLevel(world, s) {
  const [a, b] = world.levels;
  if (world.id === 1 && s <= 3) return 1;
  return Math.round(a + ((b - a) * (s - 1)) / (STAGES_PER_WORLD - 1));
}

const cache = new Map();

export function getStage(w, s) {
  const key = `${w}-${s}`;
  if (cache.has(key)) return cache.get(key);
  const world = WORLDS[w - 1];
  if (!world) return null;
  const rng = new RNG(`stage-${key}`);
  const type = stageType(s);
  const lvl = stageLevel(world, s);
  const progress = (s - 1) / (STAGES_PER_WORLD - 1);
  const rarityCap = Math.min(world.maxRarity, Math.floor(progress * (world.maxRarity + 1)) + (type === 'elite' ? 1 : 0));
  let pool = poolFor(world, rarityCap);
  if (!pool.length) pool = poolFor(world, world.maxRarity);
  if (!pool.length) pool = MONSTERS.filter((m) => rarityIdx(m.rarity) <= 1);
  const pickWeighted = () =>
    rng.weighted(pool.map((m) => [m, rarityIdx(m.rarity) === rarityCap ? 1 : 2.2]));

  let count = 3;
  if (w === 1 && s <= 2) count = 1;
  else if (w === 1 && s <= 6) count = 2;
  else if (s % 3 === 1 && type === 'battle') count = 2;

  const enemies = [];
  let rule = null;
  if (type === 'boss') {
    enemies.push({ species: world.boss, level: world.levels[1] + 2, boss: true });
  } else if (type === 'battle' || type === 'elite' || type === 'challenge') {
    // challenge rules already add difficulty: slightly weaker, and fewer in the first world
    const n = type === 'challenge' && w === 1 ? 2 : count;
    for (let i = 0; i < n; i++) {
      const sp = pickWeighted();
      const elite = type === 'elite' && i === 0;
      enemies.push({ species: sp.id, level: lvl + (elite ? 2 : rng.int(-1, 0)) - (type === 'challenge' ? 1 : 0), elite });
    }
    enemies.forEach((e) => (e.level = Math.max(1, e.level)));
    if (type === 'challenge') rule = CHALLENGE_RULES[(w + s) % CHALLENGE_RULES.length];
  }
  // First stages are hand-tuned for the tutorial
  if (w === 1 && s === 1) enemies.splice(0, enemies.length, { species: 'sproutle', level: 1 });
  if (w === 1 && s === 2) enemies.splice(0, enemies.length, { species: 'ripplet', level: 1 });

  const wm = 1 + (w - 1) * 0.55;
  const typeMult = { battle: 1, elite: 1.8, challenge: 1.6, boss: 4, treasure: 1.2, mystery: 1 }[type];
  const rewards = {
    gold: Math.round(35 * wm * (1 + s / 12) * typeMult),
    food: Math.round(20 * wm * (1 + s / 12) * typeMult),
    xp: Math.round(14 * wm * (1 + s / 18) * (type === 'boss' ? 3 : type === 'elite' ? 1.6 : 1)),
  };
  const first = { gems: 0 };
  if (type === 'elite') first.gems = 3;
  if (type === 'challenge') first.gems = 5;
  if (type === 'boss') {
    first.gems = 15;
    first.egg = { rarity: Math.min(4, world.maxRarity), elements: world.elements };
    first.chest = w >= 4 ? 'gold' : 'silver';
  }
  if (type === 'treasure') first.chest = w >= 5 ? 'gold' : w >= 2 ? 'silver' : 'wooden';
  if (w === 1 && s === 1) first.egg = { species: 'sproutle' };
  if (w === 1 && s === 5) first.egg = { species: 'ripplet' };
  if (w >= 2 && type === 'battle' && rng.chance(0.25)) first.rune = Math.min(3, 1 + Math.floor((w - 1) / 3));

  let mystery = null;
  if (type === 'mystery') {
    mystery = rng.weighted([
      [{ kind: 'gold', amount: rewards.gold * 3 }, 3],
      [{ kind: 'food', amount: rewards.food * 4 }, 3],
      [{ kind: 'gems', amount: 3 + w }, 1.5],
      [{ kind: 'egg', rarity: Math.min(2, world.maxRarity), elements: world.elements }, 1.2],
      [{ kind: 'battle' }, 2],
    ]);
    if (mystery.kind === 'battle') {
      const rare = pool.filter((m) => rarityIdx(m.rarity) >= 1);
      const sp = (rare.length ? rng.pick(rare) : pickWeighted()).id;
      enemies.push({ species: sp, level: lvl + 3, elite: true });
      first.gems = Math.max(first.gems, 4);
    }
  }

  const energy = type === 'treasure' || type === 'mystery' ? 0 : (w === 1 && s <= 5 ? 0 : world.energy + (type === 'boss' ? 2 : 0));
  const stage = { id: key, world: w, stage: s, type, level: lvl, enemies, rewards, first, rule, mystery, energy, theme: world.theme };
  cache.set(key, stage);
  return stage;
}

export function totalStages() {
  return WORLDS.length * STAGES_PER_WORLD;
}

// Star chests per world: reaching these star totals grants a chest.
export const STAR_CHESTS = [
  { stars: 20, chest: 'wooden' },
  { stars: 45, chest: 'silver' },
  { stars: 75, chest: 'gold' },
];
