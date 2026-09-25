// Rarity tiers. Stats scale modestly; the real difference is in ability kits,
// visuals, breeding difficulty and hatch drama.
export const RARITIES = {
  common: { id: 'common', idx: 0, name: 'Common', color: '#a9b4bb', dark: '#6d7a83', stat: 1.0, gold: 1.0, breedSec: 15, hatchSec: 10, weight: 100, shards: 10, shardValue: 3, xp: 20 },
  uncommon: { id: 'uncommon', idx: 1, name: 'Uncommon', color: '#5cc45a', dark: '#2f8a33', stat: 1.14, gold: 1.5, breedSec: 90, hatchSec: 45, weight: 42, shards: 20, shardValue: 6, xp: 45 },
  rare: { id: 'rare', idx: 2, name: 'Rare', color: '#3e9bf0', dark: '#1f63b0', stat: 1.3, gold: 2.3, breedSec: 420, hatchSec: 210, weight: 16, shards: 40, shardValue: 12, xp: 90 },
  epic: { id: 'epic', idx: 3, name: 'Epic', color: '#a35bea', dark: '#6b2cb0', stat: 1.5, gold: 3.4, breedSec: 1800, hatchSec: 900, weight: 5, shards: 70, shardValue: 25, xp: 180 },
  legendary: { id: 'legendary', idx: 4, name: 'Legendary', color: '#ffaa2b', dark: '#c46d0a', stat: 1.74, gold: 5.0, breedSec: 5400, hatchSec: 2700, weight: 1.4, shards: 110, shardValue: 50, xp: 360 },
  mythic: { id: 'mythic', idx: 5, name: 'Mythic', color: '#ff4f7b', dark: '#b8204a', stat: 2.0, gold: 7.0, breedSec: 10800, hatchSec: 5400, weight: 0.5, shards: 160, shardValue: 90, xp: 600 },
  ancient: { id: 'ancient', idx: 6, name: 'Ancient', color: '#2fd6b8', dark: '#128a74', stat: 2.3, gold: 9.5, breedSec: 18000, hatchSec: 9000, weight: 0.25, shards: 220, shardValue: 140, xp: 900 },
};

export const RARITY_LIST = ['common', 'uncommon', 'rare', 'epic', 'legendary', 'mythic', 'ancient'];

export function rarityIdx(r) {
  return RARITIES[r] ? RARITIES[r].idx : 0;
}
