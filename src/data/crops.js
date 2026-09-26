// Farm crops: longer crops yield better food-per-gold efficiency.
export const CROPS = [
  { id: 'berries', name: 'Quick Berries', time: 30, cost: 10, food: 40, unlock: 1, color: '#ff4f6d', leaf: '#4fae3a' },
  { id: 'roots', name: 'Juicy Roots', time: 120, cost: 30, food: 150, unlock: 2, color: '#ff9a3a', leaf: '#5fc43d' },
  { id: 'melons', name: 'Moon Melons', time: 600, cost: 110, food: 650, unlock: 5, color: '#8fd8ff', leaf: '#3f9a3a' },
  { id: 'pumpkins', name: 'Golden Pumpkins', time: 1800, cost: 320, food: 1800, unlock: 8, color: '#ffc02a', leaf: '#4f8a2e' },
  { id: 'starfruit', name: 'Star Fruit', time: 7200, cost: 1100, food: 6500, unlock: 12, color: '#ffe45a', leaf: '#6fbf3f' },
  { id: 'peppers', name: 'Dragon Peppers', time: 21600, cost: 2800, food: 17500, unlock: 18, color: '#e8303a', leaf: '#3f8a2e' },
  { id: 'grain', name: 'Ancient Grain', time: 43200, cost: 5500, food: 32000, unlock: 25, color: '#37c9a8', leaf: '#6f8a3a' },
];
export const CROP_BY_ID = Object.fromEntries(CROPS.map((c) => [c.id, c]));
