import * as THREE from 'three';
import { createNoise2D } from '../core/noise.js';

// Procedurally generated textures. Everything is generated on the fly so the
// game ships without bulky image assets.

function makeCanvas(w, h) {
  const c = document.createElement('canvas');
  c.width = w;
  c.height = h;
  return c;
}

// Tileable fbm noise by sampling on a torus.
function tileableNoise(size, scale, seed, oct = 4) {
  const n = createNoise2D(seed);
  const data = new Float32Array(size * size);
  const TAU = Math.PI * 2;
  let min = Infinity, max = -Infinity;
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const a = (x / size) * TAU, b = (y / size) * TAU;
      // 4D torus mapped into two 2D noise lookups (cheap approximation)
      const nx = Math.cos(a) * scale, ny = Math.sin(a) * scale;
      const nz = Math.cos(b) * scale, nw = Math.sin(b) * scale;
      let v = 0, amp = 1, f = 1, norm = 0;
      for (let o = 0; o < oct; o++) {
        v += amp * (n(nx * f + nz * f * 0.7 + 13.1 * o, ny * f + nw * f * 0.7 - 7.3 * o) * 0.5 +
          n(nz * f + 31.7, nw * f - nx * f * 0.3 + 5.2) * 0.5);
        norm += amp;
        amp *= 0.5;
        f *= 2;
      }
      v /= norm;
      data[y * size + x] = v;
      if (v < min) min = v;
      if (v > max) max = v;
    }
  }
  for (let i = 0; i < data.length; i++) data[i] = (data[i] - min) / (max - min);
  return data;
}

let _cloudShadowTex = null;
export function getCloudShadowTexture() {
  if (_cloudShadowTex) return _cloudShadowTex;
  const size = 128;
  const d = tileableNoise(size, 1.1, 77, 4);
  const c = makeCanvas(size, size);
  const ctx = c.getContext('2d');
  const img = ctx.createImageData(size, size);
  for (let i = 0; i < d.length; i++) {
    // Soft threshold -> patches of shadow
    let v = d[i];
    v = Math.min(1, Math.max(0, (v - 0.45) / 0.3));
    v = v * v * (3 - 2 * v);
    const g = Math.round(255 * (1 - v));
    img.data[i * 4] = g;
    img.data[i * 4 + 1] = g;
    img.data[i * 4 + 2] = g;
    img.data[i * 4 + 3] = 255;
  }
  ctx.putImageData(img, 0, 0);
  const t = new THREE.CanvasTexture(c);
  t.wrapS = t.wrapT = THREE.RepeatWrapping;
  t.colorSpace = THREE.NoColorSpace;
  t.magFilter = THREE.LinearFilter;
  t.minFilter = THREE.LinearMipmapLinearFilter;
  _cloudShadowTex = t;
  return t;
}

let _noiseTex = null;
export function getNoiseTexture() {
  if (_noiseTex) return _noiseTex;
  const size = 128;
  const d1 = tileableNoise(size, 1.6, 11, 4);
  const d2 = tileableNoise(size, 3.2, 23, 3);
  const c = makeCanvas(size, size);
  const ctx = c.getContext('2d');
  const img = ctx.createImageData(size, size);
  for (let i = 0; i < d1.length; i++) {
    img.data[i * 4] = Math.round(d1[i] * 255);
    img.data[i * 4 + 1] = Math.round(d2[i] * 255);
    img.data[i * 4 + 2] = Math.round(((d1[i] + d2[i]) * 0.5) * 255);
    img.data[i * 4 + 3] = 255;
  }
  ctx.putImageData(img, 0, 0);
  const t = new THREE.CanvasTexture(c);
  t.wrapS = t.wrapT = THREE.RepeatWrapping;
  t.colorSpace = THREE.NoColorSpace;
  _noiseTex = t;
  return t;
}

// Particle atlas: 4x4 grid of soft sprites.
// 0 soft dot, 1 star, 2 spark streak, 3 ring, 4 smoke puff, 5 heart, 6 leaf, 7 flame
// 8 snowflake, 9 bolt, 10 coin, 11 zzz, 12 note, 13 plus, 14 drop, 15 diamond
let _atlas = null;
export function getParticleAtlas() {
  if (_atlas) return _atlas;
  const cell = 64;
  const c = makeCanvas(cell * 4, cell * 4);
  const ctx = c.getContext('2d');
  const draw = (i, fn) => {
    const x = (i % 4) * cell, y = Math.floor(i / 4) * cell;
    ctx.save();
    ctx.translate(x + cell / 2, y + cell / 2);
    fn(ctx, cell / 2);
    ctx.restore();
  };
  const soft = (ctx2, r, inner = 0) => {
    const g = ctx2.createRadialGradient(0, 0, r * inner, 0, 0, r);
    g.addColorStop(0, 'rgba(255,255,255,1)');
    g.addColorStop(0.35, 'rgba(255,255,255,0.75)');
    g.addColorStop(1, 'rgba(255,255,255,0)');
    ctx2.fillStyle = g;
    ctx2.beginPath();
    ctx2.arc(0, 0, r, 0, Math.PI * 2);
    ctx2.fill();
  };
  draw(0, (g, r) => soft(g, r * 0.95));
  draw(1, (g, r) => {
    soft(g, r * 0.55);
    g.fillStyle = '#fff';
    g.beginPath();
    for (let k = 0; k < 8; k++) {
      const a = (k / 8) * Math.PI * 2 - Math.PI / 2;
      const rr = k % 2 === 0 ? r * 0.95 : r * 0.22;
      g.lineTo(Math.cos(a) * rr, Math.sin(a) * rr);
    }
    g.closePath();
    g.fill();
  });
  draw(2, (g, r) => {
    const gr = g.createLinearGradient(0, -r, 0, r);
    gr.addColorStop(0, 'rgba(255,255,255,0)');
    gr.addColorStop(0.5, 'rgba(255,255,255,1)');
    gr.addColorStop(1, 'rgba(255,255,255,0)');
    g.fillStyle = gr;
    g.beginPath();
    g.ellipse(0, 0, r * 0.16, r * 0.95, 0, 0, Math.PI * 2);
    g.fill();
  });
  draw(3, (g, r) => {
    g.strokeStyle = '#fff';
    g.lineWidth = r * 0.14;
    g.shadowColor = '#fff';
    g.shadowBlur = r * 0.2;
    g.beginPath();
    g.arc(0, 0, r * 0.78, 0, Math.PI * 2);
    g.stroke();
  });
  draw(4, (g, r) => {
    for (let k = 0; k < 6; k++) {
      const a = k * 1.3;
      g.save();
      g.translate(Math.cos(a) * r * 0.3, Math.sin(a) * r * 0.25);
      soft(g, r * 0.62);
      g.restore();
    }
  });
  draw(5, (g, r) => {
    g.fillStyle = '#fff';
    g.beginPath();
    const s = r * 0.9;
    g.moveTo(0, s * 0.85);
    g.bezierCurveTo(-s * 1.1, s * 0.05, -s * 0.6, -s * 0.9, 0, -s * 0.35);
    g.bezierCurveTo(s * 0.6, -s * 0.9, s * 1.1, s * 0.05, 0, s * 0.85);
    g.fill();
  });
  draw(6, (g, r) => {
    g.fillStyle = '#fff';
    g.beginPath();
    g.moveTo(0, -r * 0.9);
    g.quadraticCurveTo(r * 0.7, 0, 0, r * 0.9);
    g.quadraticCurveTo(-r * 0.7, 0, 0, -r * 0.9);
    g.fill();
  });
  draw(7, (g, r) => {
    const gr = g.createRadialGradient(0, r * 0.35, 0, 0, r * 0.2, r);
    gr.addColorStop(0, 'rgba(255,255,255,1)');
    gr.addColorStop(0.5, 'rgba(255,255,255,0.8)');
    gr.addColorStop(1, 'rgba(255,255,255,0)');
    g.fillStyle = gr;
    g.beginPath();
    g.moveTo(0, -r * 0.95);
    g.bezierCurveTo(r * 0.55, -r * 0.2, r * 0.75, r * 0.35, 0, r * 0.85);
    g.bezierCurveTo(-r * 0.75, r * 0.35, -r * 0.55, -r * 0.2, 0, -r * 0.95);
    g.fill();
  });
  draw(8, (g, r) => {
    g.strokeStyle = '#fff';
    g.lineCap = 'round';
    g.lineWidth = r * 0.14;
    for (let k = 0; k < 6; k++) {
      g.save();
      g.rotate((k / 6) * Math.PI * 2);
      g.beginPath();
      g.moveTo(0, 0);
      g.lineTo(0, -r * 0.85);
      g.moveTo(0, -r * 0.5);
      g.lineTo(r * 0.22, -r * 0.7);
      g.moveTo(0, -r * 0.5);
      g.lineTo(-r * 0.22, -r * 0.7);
      g.stroke();
      g.restore();
    }
  });
  draw(9, (g, r) => {
    g.fillStyle = '#fff';
    g.beginPath();
    g.moveTo(r * 0.15, -r * 0.95);
    g.lineTo(-r * 0.45, r * 0.1);
    g.lineTo(-r * 0.02, r * 0.1);
    g.lineTo(-r * 0.2, r * 0.95);
    g.lineTo(r * 0.5, -r * 0.15);
    g.lineTo(r * 0.06, -r * 0.15);
    g.closePath();
    g.fill();
  });
  draw(10, (g, r) => {
    g.fillStyle = '#fff';
    g.beginPath();
    g.ellipse(0, 0, r * 0.8, r * 0.8, 0, 0, Math.PI * 2);
    g.fill();
    g.fillStyle = 'rgba(0,0,0,0.25)';
    g.beginPath();
    g.ellipse(0, 0, r * 0.5, r * 0.5, 0, 0, Math.PI * 2);
    g.fill();
  });
  draw(11, (g, r) => {
    g.fillStyle = '#fff';
    g.font = `900 ${Math.round(r * 1.5)}px sans-serif`;
    g.textAlign = 'center';
    g.textBaseline = 'middle';
    g.fillText('z', 0, r * 0.05);
  });
  draw(12, (g, r) => {
    g.fillStyle = '#fff';
    g.beginPath();
    g.ellipse(-r * 0.25, r * 0.45, r * 0.3, r * 0.22, -0.4, 0, Math.PI * 2);
    g.fill();
    g.fillRect(r * 0.0, -r * 0.8, r * 0.12, r * 1.3);
    g.beginPath();
    g.moveTo(r * 0.06, -r * 0.8);
    g.quadraticCurveTo(r * 0.6, -r * 0.6, r * 0.5, -r * 0.2);
    g.lineTo(r * 0.06, -r * 0.45);
    g.fill();
  });
  draw(13, (g, r) => {
    g.fillStyle = '#fff';
    g.fillRect(-r * 0.18, -r * 0.8, r * 0.36, r * 1.6);
    g.fillRect(-r * 0.8, -r * 0.18, r * 1.6, r * 0.36);
  });
  draw(14, (g, r) => {
    g.fillStyle = '#fff';
    g.beginPath();
    g.moveTo(0, -r * 0.9);
    g.bezierCurveTo(r * 0.3, -r * 0.4, r * 0.65, 0, r * 0.65, r * 0.3);
    g.arc(0, r * 0.3, r * 0.65, 0, Math.PI, false);
    g.bezierCurveTo(-r * 0.65, 0, -r * 0.3, -r * 0.4, 0, -r * 0.9);
    g.fill();
  });
  draw(15, (g, r) => {
    soft(g, r * 0.5);
    g.fillStyle = '#fff';
    g.beginPath();
    g.moveTo(0, -r * 0.9);
    g.lineTo(r * 0.5, 0);
    g.lineTo(0, r * 0.9);
    g.lineTo(-r * 0.5, 0);
    g.closePath();
    g.fill();
  });
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  t.generateMipmaps = true;
  t.minFilter = THREE.LinearMipmapLinearFilter;
  _atlas = t;
  return t;
}

// Vertical gradient texture (used for sky domes and backdrops).
export function gradientTexture(stops, h = 256) {
  const c = makeCanvas(4, h);
  const ctx = c.getContext('2d');
  const g = ctx.createLinearGradient(0, 0, 0, h);
  for (const [o, col] of stops) g.addColorStop(o, col);
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, 4, h);
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
}

// Stripe texture used for waterfalls / energy beams.
let _foamTex = null;
export function getFoamTexture() {
  if (_foamTex) return _foamTex;
  const w = 64, h = 256;
  const c = makeCanvas(w, h);
  const ctx = c.getContext('2d');
  ctx.fillStyle = '#000';
  ctx.fillRect(0, 0, w, h);
  const n = createNoise2D(5);
  const img = ctx.getImageData(0, 0, w, h);
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const v = n((x / w) * 6, (y / h) * 1.5) * 0.5 + 0.5;
      const streak = Math.pow(Math.max(0, n((x / w) * 14 + 10, (y / h) * 3) ), 1.2);
      const val = Math.min(1, v * 0.45 + streak * 1.3);
      const i = (y * w + x) * 4;
      img.data[i] = img.data[i + 1] = img.data[i + 2] = Math.round(val * 255);
      img.data[i + 3] = 255;
    }
  }
  ctx.putImageData(img, 0, 0);
  const t = new THREE.CanvasTexture(c);
  t.wrapS = t.wrapT = THREE.RepeatWrapping;
  t.colorSpace = THREE.NoColorSpace;
  _foamTex = t;
  return t;
}
