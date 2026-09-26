// Small, fast 2D/3D value + gradient noise used for terrain, textures and props.
import { mulberry32 } from './rng.js';

export function createNoise2D(seed = 1) {
  const r = mulberry32(seed);
  const perm = new Uint8Array(512);
  const p = new Uint8Array(256);
  for (let i = 0; i < 256; i++) p[i] = i;
  for (let i = 255; i > 0; i--) {
    const j = Math.floor(r() * (i + 1));
    const t = p[i]; p[i] = p[j]; p[j] = t;
  }
  for (let i = 0; i < 512; i++) perm[i] = p[i & 255];
  const grads = [];
  for (let i = 0; i < 16; i++) {
    const a = (i / 16) * Math.PI * 2;
    grads.push([Math.cos(a), Math.sin(a)]);
  }
  const fade = (t) => t * t * t * (t * (t * 6 - 15) + 10);
  function dot(ix, iy, x, y) {
    const g = grads[perm[perm[ix & 255] + (iy & 255)] & 15];
    return g[0] * x + g[1] * y;
  }
  // Returns roughly -1..1
  function noise(x, y) {
    const x0 = Math.floor(x), y0 = Math.floor(y);
    const fx = x - x0, fy = y - y0;
    const u = fade(fx), v = fade(fy);
    const n00 = dot(x0, y0, fx, fy);
    const n10 = dot(x0 + 1, y0, fx - 1, fy);
    const n01 = dot(x0, y0 + 1, fx, fy - 1);
    const n11 = dot(x0 + 1, y0 + 1, fx - 1, fy - 1);
    const nx0 = n00 + (n10 - n00) * u;
    const nx1 = n01 + (n11 - n01) * u;
    return (nx0 + (nx1 - nx0) * v) * 1.414;
  }
  noise.fbm = function fbm(x, y, oct = 4, lac = 2, gain = 0.5) {
    let amp = 1, freq = 1, sum = 0, norm = 0;
    for (let i = 0; i < oct; i++) {
      sum += amp * noise(x * freq, y * freq);
      norm += amp;
      amp *= gain;
      freq *= lac;
    }
    return sum / norm;
  };
  return noise;
}

// Cheap 3D hash noise for vertex displacement (not smooth across large scales,
// but good enough for low-poly rock facets).
export function hash3(x, y, z) {
  let h = Math.sin(x * 127.1 + y * 311.7 + z * 74.7) * 43758.5453123;
  return h - Math.floor(h);
}

export function valueNoise3(x, y, z) {
  const xi = Math.floor(x), yi = Math.floor(y), zi = Math.floor(z);
  const xf = x - xi, yf = y - yi, zf = z - zi;
  const s = (t) => t * t * (3 - 2 * t);
  const u = s(xf), v = s(yf), w = s(zf);
  const L = (a, b, t) => a + (b - a) * t;
  const c = (dx, dy, dz) => hash3(xi + dx, yi + dy, zi + dz);
  return L(
    L(L(c(0, 0, 0), c(1, 0, 0), u), L(c(0, 1, 0), c(1, 1, 0), u), v),
    L(L(c(0, 0, 1), c(1, 0, 1), u), L(c(0, 1, 1), c(1, 1, 1), u), v),
    w
  ) * 2 - 1;
}

// 3D Worley (cellular) noise. Returns [F1, F2] distances to the two nearest
// feature points. Used for lava cracks, scale patterns, turtle shells, spots.
const _w = [0, 0];
export function worley3(x, y, z, seed = 0) {
  const xi = Math.floor(x), yi = Math.floor(y), zi = Math.floor(z);
  let f1 = 9, f2 = 9;
  for (let dx = -1; dx <= 1; dx++) {
    for (let dy = -1; dy <= 1; dy++) {
      for (let dz = -1; dz <= 1; dz++) {
        const cx = xi + dx, cy = yi + dy, cz = zi + dz;
        const px = cx + hash3(cx, cy, cz + seed);
        const py = cy + hash3(cx + 17.3, cy - 3.1, cz + seed);
        const pz = cz + hash3(cx - 5.9, cy + 31.7, cz + seed);
        const d = Math.hypot(px - x, py - y, pz - z);
        if (d < f1) {
          f2 = f1;
          f1 = d;
        } else if (d < f2) f2 = d;
      }
    }
  }
  _w[0] = f1;
  _w[1] = f2;
  return _w;
}

// Per-cell random value for the nearest feature point (for varied spot sizes).
export function worleyCell(x, y, z, seed = 0) {
  const xi = Math.floor(x), yi = Math.floor(y), zi = Math.floor(z);
  let f1 = 9, id = 0;
  for (let dx = -1; dx <= 1; dx++) {
    for (let dy = -1; dy <= 1; dy++) {
      for (let dz = -1; dz <= 1; dz++) {
        const cx = xi + dx, cy = yi + dy, cz = zi + dz;
        const px = cx + hash3(cx, cy, cz + seed);
        const py = cy + hash3(cx + 17.3, cy - 3.1, cz + seed);
        const pz = cz + hash3(cx - 5.9, cy + 31.7, cz + seed);
        const d = Math.hypot(px - x, py - y, pz - z);
        if (d < f1) {
          f1 = d;
          id = hash3(cx * 1.7, cy * 2.3, cz * 3.1 + seed);
        }
      }
    }
  }
  return [f1, id];
}
