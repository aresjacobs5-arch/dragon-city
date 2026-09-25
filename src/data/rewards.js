// Chests, daily login rewards, lucky wheel, runes and relics.
// All randomized rewards publish their odds (shown in the UI).

export const CHESTS = {
  wooden: {
    id: 'wooden', name: 'Wooden Chest', color: '#b8783a', trim: '#7a4a22',
    rolls: 2,
    table: [
      { w: 40, gold: [150, 400] },
      { w: 35, food: [120, 300] },
      { w: 12, gems: [1, 3] },
      { w: 10, shards: [3, 6] },
      { w: 3, egg: 'uncommon' },
    ],
  },
  silver: {
    id: 'silver', name: 'Silver Chest', color: '#b8c8dc', trim: '#6a7a92',
    rolls: 3,
    table: [
      { w: 30, gold: [600, 1500] },
      { w: 28, food: [500, 1200] },
      { w: 16, gems: [3, 8] },
      { w: 14, shards: [6, 12] },
      { w: 8, rune: 1 },
      { w: 4, egg: 'rare' },
    ],
  },
  gold: {
    id: 'gold', name: 'Gold Chest', color: '#ffc83d', trim: '#b8781a',
    rolls: 4,
    table: [
      { w: 26, gold: [2500, 7000] },
      { w: 22, food: [2000, 5000] },
      { w: 18, gems: [8, 18] },
      { w: 14, shards: [12, 25] },
      { w: 10, rune: 2 },
      { w: 7, egg: 'rare' },
      { w: 3, egg: 'epic' },
    ],
  },
  mythic: {
    id: 'mythic', name: 'Mythic Chest', color: '#ff5fa8', trim: '#8a2a8a',
    rolls: 5,
    table: [
      { w: 22, gold: [10000, 30000] },
      { w: 18, food: [8000, 20000] },
      { w: 20, gems: [20, 45] },
      { w: 14, shards: [25, 50] },
      { w: 12, rune: 3 },
      { w: 10, egg: 'epic' },
      { w: 4, egg: 'legendary' },
    ],
  },
};

export const DAILY_REWARDS = [
  { day: 1, reward: { gold: 500 } },
  { day: 2, reward: { food: 400 } },
  { day: 3, reward: { gems: 10 } },
  { day: 4, reward: { egg: 'rare' } },
  { day: 5, reward: { gold: 2500 } },
  { day: 6, reward: { gems: 25 } },
  { day: 7, reward: { egg: 'epic' }, big: true },
];

export const WHEEL = [
  { id: 'g1', reward: { gold: 300 }, w: 20 },
  { id: 'f1', reward: { food: 300 }, w: 20 },
  { id: 'g2', reward: { gold: 1200 }, w: 12 },
  { id: 'e1', reward: { energy: 5 }, w: 12 },
  { id: 'c1', reward: { chest: 'wooden' }, w: 12 },
  { id: 'gm', reward: { gems: 5 }, w: 8 },
  { id: 'f2', reward: { food: 1500 }, w: 10 },
  { id: 'egg', reward: { egg: 'uncommon' }, w: 6 },
];

export const RUNE_TYPES = {
  atk: { id: 'atk', name: 'Attack', stat: 'atk', color: '#ff5a3a', values: [0.05, 0.1, 0.16, 0.23, 0.32] },
  hp: { id: 'hp', name: 'Health', stat: 'hp', color: '#4fcf5a', values: [0.06, 0.12, 0.19, 0.27, 0.36] },
  def: { id: 'def', name: 'Defense', stat: 'def', color: '#3f9ae8', values: [0.06, 0.12, 0.19, 0.27, 0.36] },
  spd: { id: 'spd', name: 'Speed', stat: 'spd', color: '#ffc83d', values: [0.03, 0.06, 0.1, 0.14, 0.19] },
};
export const RUNE_TIERS = ['I', 'II', 'III', 'IV', 'V'];
export const RUNE_SLOTS_BY_LEVEL = [10, 15, 20];

export const RELICS = [
  { id: 'flame_crown', name: 'Flame Crown', color: '#ff6a2b', desc: '+15% Fire damage, attacks may Burn', effect: { elementDmg: { fire: 0.15 }, onHit: { s: 'burn', ch: 0.12, t: 2 } }, cost: 8 },
  { id: 'ancient_shield', name: 'Ancient Shield', color: '#37c9a8', desc: 'Start battles with a 20% shield', effect: { startShield: 0.2 }, cost: 8 },
  { id: 'storm_orb', name: 'Storm Orb', color: '#ffc93a', desc: 'Basic attacks may Stun', effect: { onBasic: { s: 'stun', ch: 0.14, t: 1 } }, cost: 10 },
  { id: 'void_pendant', name: 'Void Pendant', color: '#7a4fc9', desc: 'Heal 12% of damage dealt', effect: { lifesteal: 0.12 }, cost: 12 },
  { id: 'tidal_pearl', name: 'Tidal Pearl', color: '#2fa6ee', desc: '+25% healing received', effect: { healBonus: 0.25 }, cost: 8 },
  { id: 'verdant_charm', name: 'Verdant Charm', color: '#5dbf3c', desc: 'Regenerate 5% HP every turn', effect: { regen: 0.05 }, cost: 10 },
  { id: 'iron_heart', name: 'Iron Heart', color: '#9aa9bd', desc: '+18% max HP', effect: { stat: { hp: 0.18 } }, cost: 8 },
  { id: 'swift_feather', name: 'Swift Feather', color: '#fff0a6', desc: '+12% Speed', effect: { stat: { spd: 0.12 } }, cost: 10 },
  { id: 'hunter_fang', name: "Hunter's Fang", color: '#e0334f', desc: '+15% critical chance', effect: { crit: 0.15 }, cost: 10 },
  { id: 'sage_tome', name: "Sage's Tome", color: '#ff5fcf', desc: 'Ultimate charges 30% faster', effect: { ultCharge: 0.3 }, cost: 12 },
];
export const RELIC_BY_ID = Object.fromEntries(RELICS.map((r) => [r.id, r]));
