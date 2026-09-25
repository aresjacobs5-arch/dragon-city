// Seeded random number utilities. Deterministic generation keeps islands,
// campaign stages and loot tables stable across sessions.

export function hashString(str) {
  let h = 2166136261 >>> 0;
  for (let i = 0; i < str.length; i++) {
    h ^= str.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

export function mulberry32(seed) {
  let a = seed >>> 0;
  return function rand() {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export class RNG {
  constructor(seed = 1) {
    this.seed = typeof seed === 'string' ? hashString(seed) : seed >>> 0;
    this._r = mulberry32(this.seed);
  }
  next() { return this._r(); }
  range(a, b) { return a + (b - a) * this._r(); }
  int(a, b) { return Math.floor(a + (b - a + 1) * this._r()); }
  chance(p) { return this._r() < p; }
  pick(arr) { return arr[Math.floor(this._r() * arr.length)]; }
  sign() { return this._r() < 0.5 ? -1 : 1; }
  shuffle(arr) {
    const a = arr.slice();
    for (let i = a.length - 1; i > 0; i--) {
      const j = Math.floor(this._r() * (i + 1));
      [a[i], a[j]] = [a[j], a[i]];
    }
    return a;
  }
  // items: [{ w: weight, ...}] or [[item, weight]]
  weighted(items, weightKey = 'w') {
    let total = 0;
    for (const it of items) total += Array.isArray(it) ? it[1] : it[weightKey];
    let r = this._r() * total;
    for (const it of items) {
      const w = Array.isArray(it) ? it[1] : it[weightKey];
      if ((r -= w) <= 0) return Array.isArray(it) ? it[0] : it;
    }
    const last = items[items.length - 1];
    return Array.isArray(last) ? last[0] : last;
  }
}

// Non-deterministic helper used for moment-to-moment gameplay randomness.
export const rand = {
  next: () => Math.random(),
  range: (a, b) => a + (b - a) * Math.random(),
  int: (a, b) => Math.floor(a + (b - a + 1) * Math.random()),
  chance: (p) => Math.random() < p,
  pick: (arr) => arr[Math.floor(Math.random() * arr.length)],
};
