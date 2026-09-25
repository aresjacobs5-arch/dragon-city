import { UI } from './ui.js';
import { h } from './dom.js';

// Fluffy cloud wipe used between island, map, battle and reveal scenes.
const CLOUD = `<svg viewBox="0 0 200 120" preserveAspectRatio="none"><path d="M20 100c-14 0-20-10-18-20 2-12 14-16 24-12 0-18 16-30 34-26 6-16 26-24 44-14 14-10 38-6 46 12 16-2 30 10 28 26 12 4 18 14 14 24-4 8-12 10-20 10z" fill="#fff"/><path d="M26 96c20 4 60 6 150 0" stroke="#dde8f8" stroke-width="10" fill="none" stroke-linecap="round"/></svg>`;

let busy = false;

export async function cloudTransition(swap, { sound = null } = {}) {
  if (busy) {
    await swap();
    return;
  }
  busy = true;
  const layer = h('div', { style: { position: 'fixed', inset: 0, zIndex: 40, pointerEvents: 'auto', overflow: 'hidden' } });
  const puffs = [];
  const N = 9;
  for (let i = 0; i < N; i++) {
    const p = h('div', { html: CLOUD, style: { position: 'absolute', width: '75vmax', height: '48vmax', left: `${(i % 3) * 38 - 30}vw`, top: `${Math.floor(i / 3) * 38 - 25}vh`, transition: 'transform .45s cubic-bezier(.3,.8,.3,1)', filter: 'drop-shadow(0 1rem 0 rgba(150,170,210,.35))' } });
    const fromLeft = i % 2 === 0;
    p.style.transform = `translateX(${fromLeft ? -130 : 130}vw) scale(1.1)`;
    layer.appendChild(p);
    puffs.push({ p, fromLeft });
  }
  document.body.appendChild(layer);
  if (sound) sound();
  await new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r)));
  puffs.forEach(({ p }, i) => {
    p.style.transitionDelay = `${i * 0.02}s`;
    p.style.transform = 'translateX(0) scale(1.1)';
  });
  await wait(520);
  try {
    await swap();
  } catch (e) {
    console.error(e);
  }
  await wait(120);
  puffs.forEach(({ p, fromLeft }, i) => {
    p.style.transitionDelay = `${i * 0.025}s`;
    p.style.transform = `translateX(${fromLeft ? 130 : -130}vw) scale(1.1)`;
  });
  await wait(650);
  layer.remove();
  busy = false;
}

export function wait(ms) {
  return new Promise((r) => setTimeout(r, ms));
}

export { UI };
