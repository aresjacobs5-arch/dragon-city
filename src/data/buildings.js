// Building definitions. Every placeable structure lives here.
// size: [w, d] in grid cells. levels[i] describes level i+1.
import { ELEMENTS } from './elements.js';

const B = {};

// ---------------- Habitats (one per element)
const HAB_TIERS = [
  ['fire', 100, 1],
  ['nature', 250, 1],
  ['water', 600, 4],
  ['earth', 900, 5],
  ['electric', 1500, 7],
  ['ice', 2400, 9],
  ['light', 4000, 12],
  ['dark', 4000, 12],
  ['metal', 6500, 15],
  ['magic', 9000, 18],
  ['ancient', 45000, 30],
  ['void', 90000, 40],
  ['celestial', 160000, 50],
];

HAB_TIERS.forEach(([el, cost, lvl], i) => {
  const t = 1 + i * 0.35;
  B[`hab_${el}`] = {
    id: `hab_${el}`,
    name: `${ELEMENTS[el].name} Habitat`,
    category: 'habitat',
    element: el,
    size: [3, 3],
    unlockLevel: lvl,
    cost: { gold: cost },
    buildTime: Math.round(i < 2 ? 3 : 8 * Math.pow(t, 2.2)),
    xp: Math.round(25 + cost * 0.04),
    levels: [
      { capacity: 2, goldCap: Math.round(400 * t) },
      { capacity: 3, goldCap: Math.round(1200 * t), cost: { gold: Math.round(cost * 2.5 + 300) }, time: Math.round(20 * t) },
      { capacity: 3, goldCap: Math.round(3500 * t), cost: { gold: Math.round(cost * 6 + 1500) }, time: Math.round(90 * t) },
      { capacity: 4, goldCap: Math.round(9000 * t), cost: { gold: Math.round(cost * 14 + 6000) }, time: Math.round(300 * t) },
      { capacity: 4, goldCap: Math.round(22000 * t), cost: { gold: Math.round(cost * 30 + 20000) }, time: Math.round(900 * t) },
      { capacity: 5, goldCap: Math.round(50000 * t), cost: { gold: Math.round(cost * 60 + 60000) }, time: Math.round(2400 * t), minLevel: 20 },
    ],
  };
});

// ---------------- Production & core buildings
B.farm = {
  id: 'farm', name: 'Farm', category: 'building', size: [2, 2], unlockLevel: 1, cost: { gold: 50 }, buildTime: 5, xp: 15,
  limitByLevel: [[1, 1], [3, 2], [6, 3], [10, 4], [15, 5], [20, 6], [28, 7]],
  levels: [
    { yield: 1.0 },
    { yield: 1.2, cost: { gold: 600 }, time: 30 },
    { yield: 1.4, cost: { gold: 3500 }, time: 180, minLevel: 8 },
    { yield: 1.65, cost: { gold: 15000 }, time: 600, minLevel: 14 },
    { yield: 1.9, cost: { gold: 60000 }, time: 1800, minLevel: 22 },
  ],
};
B.hatchery = {
  id: 'hatchery', name: 'Hatchery', category: 'building', size: [2, 2], unlockLevel: 1, cost: { gold: 0 }, buildTime: 0, unique: true, xp: 0,
  levels: [
    { slots: 2 },
    { slots: 3, cost: { gold: 2500 }, time: 60, minLevel: 6 },
    { slots: 4, cost: { gold: 20000 }, time: 600, minLevel: 14 },
    { slots: 5, cost: { gold: 120000 }, time: 1800, minLevel: 25 },
  ],
};
B.breeding = {
  id: 'breeding', name: 'Breeding Mountain', category: 'building', size: [3, 3], unlockLevel: 3, cost: { gold: 300 }, buildTime: 4, unique: true, xp: 60,
  levels: [
    { speed: 1.0 },
    { speed: 0.9, cost: { gold: 5000 }, time: 120, minLevel: 8 },
    { speed: 0.8, cost: { gold: 30000 }, time: 600, minLevel: 15 },
    { speed: 0.7, cost: { gold: 150000 }, time: 1800, minLevel: 25 },
  ],
};
B.gold_storage = {
  id: 'gold_storage', name: 'Gold Vault', category: 'building', size: [2, 2], unlockLevel: 4, cost: { gold: 400 }, buildTime: 10, unique: true, xp: 40,
  levels: [
    { goldCap: 25000 },
    { goldCap: 80000, cost: { gold: 6000 }, time: 120 },
    { goldCap: 300000, cost: { gold: 30000 }, time: 600, minLevel: 12 },
    { goldCap: 1500000, cost: { gold: 150000 }, time: 1800, minLevel: 20 },
    { goldCap: 8000000, cost: { gold: 900000 }, time: 3600, minLevel: 30 },
    { goldCap: 50000000, cost: { gold: 5000000 }, time: 7200, minLevel: 45 },
  ],
};
B.food_storage = {
  id: 'food_storage', name: 'Food Silo', category: 'building', size: [2, 2], unlockLevel: 6, cost: { gold: 800 }, buildTime: 15, unique: true, xp: 50,
  levels: [
    { foodCap: 15000 },
    { foodCap: 50000, cost: { gold: 8000 }, time: 180 },
    { foodCap: 200000, cost: { gold: 40000 }, time: 900, minLevel: 14 },
    { foodCap: 900000, cost: { gold: 200000 }, time: 2400, minLevel: 22 },
    { foodCap: 5000000, cost: { gold: 1200000 }, time: 5400, minLevel: 35 },
  ],
};
B.academy = {
  id: 'academy', name: 'Monster Academy', category: 'building', size: [2, 2], unlockLevel: 7, cost: { gold: 1500 }, buildTime: 20, unique: true, xp: 80,
  levels: [
    { trainTime: 300 },
    { trainTime: 240, cost: { gold: 12000 }, time: 300, minLevel: 12 },
    { trainTime: 180, cost: { gold: 60000 }, time: 1200, minLevel: 20 },
  ],
};
B.evolution_temple = {
  id: 'evolution_temple', name: 'Evolution Temple', category: 'building', size: [3, 3], unlockLevel: 11, cost: { gold: 6000 }, buildTime: 45, unique: true, xp: 150,
  levels: [{ maxRank: 3 }, { maxRank: 5, cost: { gold: 60000 }, time: 1200, minLevel: 20 }],
};
B.challenge_tower = {
  id: 'challenge_tower', name: 'Challenge Tower', category: 'building', size: [2, 2], unlockLevel: 12, cost: { gold: 8000 }, buildTime: 60, unique: true, xp: 180,
  levels: [{}],
};
B.rune_forge = {
  id: 'rune_forge', name: 'Rune Forge', category: 'building', size: [2, 2], unlockLevel: 13, cost: { gold: 10000 }, buildTime: 60, unique: true, xp: 200,
  levels: [{ maxTier: 3 }, { maxTier: 4, cost: { gold: 80000 }, time: 1200, minLevel: 22 }, { maxTier: 5, cost: { gold: 400000 }, time: 3600, minLevel: 32 }],
};
B.event_portal = {
  id: 'event_portal', name: 'Event Portal', category: 'building', size: [2, 2], unlockLevel: 6, cost: { gold: 1000 }, buildTime: 15, unique: true, xp: 80,
  levels: [{}],
};
B.relic_workshop = {
  id: 'relic_workshop', name: 'Relic Workshop', category: 'building', size: [2, 2], unlockLevel: 20, cost: { gold: 80000 }, buildTime: 300, unique: true, xp: 400,
  levels: [{}],
};
B.ancient_shrine = {
  id: 'ancient_shrine', name: 'Ancient Shrine', category: 'building', size: [3, 3], unlockLevel: 30, cost: { gold: 500000 }, buildTime: 900, unique: true, xp: 1000,
  levels: [{}],
};

// ---------------- Decorations (cosmetic + XP)
const DECOS = [
  ['deco_flowerbed', 'Flower Bed', [1, 1], 150, 2],
  ['deco_lantern', 'Glow Lantern', [1, 1], 300, 3],
  ['deco_bench', 'Garden Bench', [1, 1], 400, 4],
  ['deco_statue', 'Hero Statue', [1, 1], 2000, 8],
  ['deco_fountain', 'Sky Fountain', [2, 2], 6000, 10],
  ['deco_banner', 'Clan Banner', [1, 1], 1200, 6],
  ['deco_mushrooms', 'Glowshroom Ring', [1, 1], 900, 5],
  ['deco_crystal', 'Crystal Spire', [1, 1], 15000, 16],
  ['deco_arch', 'Moon Arch', [2, 1], 25000, 20],
  ['deco_tree', 'Wishing Tree', [2, 2], 40000, 24],
];
for (const [id, name, size, gold, lvl] of DECOS) {
  B[id] = { id, name, category: 'decoration', size, unlockLevel: lvl, cost: { gold }, buildTime: 1, xp: Math.round(10 + gold * 0.02), levels: [{}] };
}

export const BUILDINGS = B;
export const BUILDING_LIST = Object.values(B);

export function farmLimit(level) {
  let n = 1;
  for (const [lvl, count] of B.farm.limitByLevel) if (level >= lvl) n = count;
  return n;
}

export function habitatLimit(level) {
  // Soft cap on habitat count; more islands raise the space available anyway.
  return 3 + Math.floor(level / 3);
}
