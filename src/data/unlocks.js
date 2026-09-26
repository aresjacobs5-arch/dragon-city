// Player level unlock table. Each entry is shown on the LEVEL UP screen.
// `feature` keys are checked by systems/progression.js -> isUnlocked().
export const UNLOCKS = [
  { level: 1, feature: 'habitats', label: 'Habitats' },
  { level: 1, feature: 'farm', label: 'Farm' },
  { level: 1, feature: 'hatchery', label: 'Hatchery' },
  { level: 1, feature: 'campaign', label: 'Campaign' },
  { level: 2, feature: 'daily_quests', label: 'Daily Quests' },
  { level: 3, feature: 'breeding', label: 'Breeding Mountain' },
  { level: 4, feature: 'element_water', label: 'Water Monsters' },
  { level: 4, feature: 'gold_storage', label: 'Gold Vault' },
  { level: 5, feature: 'element_earth', label: 'Earth Monsters' },
  { level: 5, feature: 'bulk_farming', label: 'Plant All & Collect All' },
  { level: 6, feature: 'food_storage', label: 'Food Silo' },
  { level: 6, feature: 'events', label: 'Event Portal' },
  { level: 7, feature: 'element_electric', label: 'Electric Monsters' },
  { level: 7, feature: 'academy', label: 'Monster Academy' },
  { level: 8, feature: 'spin_wheel', label: 'Lucky Wheel' },
  { level: 8, feature: 'auto_battle', label: 'Auto Battle' },
  { level: 9, feature: 'element_ice', label: 'Ice Monsters' },
  { level: 10, feature: 'island_1', label: 'Volcanic Reach Island' },
  { level: 10, feature: 'battle_speed_4x', label: '4x Battle Speed' },
  { level: 11, feature: 'ranks', label: 'Evolution Temple & Ranks' },
  { level: 12, feature: 'element_light', label: 'Light Monsters' },
  { level: 12, feature: 'element_dark', label: 'Dark Monsters' },
  { level: 12, feature: 'challenge_tower', label: 'Challenge Tower' },
  { level: 13, feature: 'runes', label: 'Rune Forge' },
  { level: 15, feature: 'element_metal', label: 'Metal Monsters' },
  { level: 15, feature: 'rare_breeding', label: 'Epic Breeding & Tokens' },
  { level: 18, feature: 'element_magic', label: 'Magic Monsters' },
  { level: 20, feature: 'relics', label: 'Relic Workshop' },
  { level: 22, feature: 'legendary_breeding', label: 'Legendary Breeding' },
  { level: 25, feature: 'island_2', label: 'Frozen Crown Island' },
  { level: 30, feature: 'element_ancient', label: 'Ancient Monsters' },
  { level: 30, feature: 'ancient_shrine', label: 'Ancient Shrine' },
  { level: 35, feature: 'island_3', label: 'Storm Sanctuary Island' },
  { level: 40, feature: 'element_void', label: 'Void Monsters' },
  { level: 45, feature: 'island_4', label: 'Shadow Realm Island' },
  { level: 50, feature: 'element_celestial', label: 'Celestial Monsters' },
  { level: 55, feature: 'island_5', label: 'Celestial Garden Island' },
  { level: 65, feature: 'island_6', label: 'Ancient Ruins Island' },
];

export const MAX_PLAYER_LEVEL = 80;

// XP needed to go from level L to L+1.
export function xpToNext(level) {
  return Math.round(40 * Math.pow(level, 1.55) + 20 * level);
}

export function unlocksAt(level) {
  return UNLOCKS.filter((u) => u.level === level);
}

export function featureLevel(feature) {
  const u = UNLOCKS.find((x) => x.feature === feature);
  return u ? u.level : 1;
}
