// Elements, their colors and the effectiveness chart.
// Each element is strong against at most three others; the reverse pairing is
// "resisted". The chart is intentionally small so players can learn it.
export const ELEMENTS = {
  fire: { id: 'fire', name: 'Fire', color: '#ff6a2b', dark: '#c7401a', light: '#ffc27a', strong: ['nature', 'ice', 'metal'], unlock: 1 },
  nature: { id: 'nature', name: 'Nature', color: '#5dbf3c', dark: '#3c8a26', light: '#b6ea8a', strong: ['water', 'earth'], unlock: 1 },
  water: { id: 'water', name: 'Water', color: '#2fa6ee', dark: '#1a6fb3', light: '#9fdcff', strong: ['fire', 'earth'], unlock: 4 },
  earth: { id: 'earth', name: 'Earth', color: '#b8834f', dark: '#80552f', light: '#e6c29a', strong: ['electric', 'fire'], unlock: 5 },
  electric: { id: 'electric', name: 'Electric', color: '#ffc93a', dark: '#d19a0a', light: '#fff0a6', strong: ['water', 'metal'], unlock: 7 },
  ice: { id: 'ice', name: 'Ice', color: '#7fdcff', dark: '#3b9ccc', light: '#dcf6ff', strong: ['nature', 'water'], unlock: 9 },
  light: { id: 'light', name: 'Light', color: '#ffe066', dark: '#d9a82a', light: '#fff8d2', strong: ['dark', 'void'], unlock: 12 },
  dark: { id: 'dark', name: 'Dark', color: '#7a4fc9', dark: '#4a2a86', light: '#c7a8ff', strong: ['magic', 'celestial'], unlock: 12 },
  metal: { id: 'metal', name: 'Metal', color: '#9aa9bd', dark: '#5f6d82', light: '#e1e8f2', strong: ['ice', 'earth'], unlock: 15 },
  magic: { id: 'magic', name: 'Magic', color: '#ff5fcf', dark: '#b8309a', light: '#ffc2ef', strong: ['light', 'metal'], unlock: 18 },
  ancient: { id: 'ancient', name: 'Ancient', color: '#37c9a8', dark: '#1d8a72', light: '#b4f2e2', strong: ['void', 'magic'], unlock: 30 },
  void: { id: 'void', name: 'Void', color: '#3b2a6e', dark: '#1d1238', light: '#9a86e0', strong: ['celestial', 'light'], unlock: 40 },
  celestial: { id: 'celestial', name: 'Celestial', color: '#8fb4ff', dark: '#4f6fd0', light: '#e6eeff', strong: ['ancient', 'dark'], unlock: 50 },
};

export const ELEMENT_LIST = Object.keys(ELEMENTS);
export const BASE_ELEMENTS = ['fire', 'nature', 'water', 'earth', 'electric', 'ice', 'light', 'dark', 'metal', 'magic'];

export const STRONG_MULT = 1.5;
export const WEAK_MULT = 0.7;

// Multiplier for an attack of element `atk` hitting a defender with elements `defs`.
export function effectiveness(atk, defs) {
  if (!atk || atk === 'neutral') return 1;
  const A = ELEMENTS[atk];
  if (!A) return 1;
  let m = 1;
  for (const d of defs) {
    if (A.strong.includes(d)) m *= STRONG_MULT;
    else if (ELEMENTS[d] && ELEMENTS[d].strong.includes(atk)) m *= WEAK_MULT;
  }
  return Math.min(2.25, Math.max(0.49, m));
}

export function weaknessesOf(el) {
  return ELEMENT_LIST.filter((e) => ELEMENTS[e].strong.includes(el));
}
