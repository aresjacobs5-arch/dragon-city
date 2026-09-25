import { RNG } from './rng.js';

// Shared island outline used by both the terrain renderer and the placement
// grid, so what you see is exactly where you can build.
export function islandShape(seed, radius, shapeAmp = 1) {
  const rng = new RNG(seed);
  const harm = [];
  for (let k = 2; k <= 7; k++) harm.push({ k, a: (rng.range(0.02, 0.07) / (k * 0.45)) * shapeAmp, p: rng.range(0, Math.PI * 2) });
  const R = (th) => {
    let s = 1;
    for (const h of harm) s += h.a * Math.sin(h.k * th + h.p);
    return radius * s;
  };
  const inside = (x, z, margin = 0) => Math.hypot(x, z) <= R(Math.atan2(z, x)) - margin;
  return { R, inside, rng };
}
