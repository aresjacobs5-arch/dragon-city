export const clamp = (v, a, b) => (v < a ? a : v > b ? b : v);
export const lerp = (a, b, t) => a + (b - a) * t;
export const invLerp = (a, b, v) => (v - a) / (b - a);
export const smoothstep = (a, b, v) => {
  const t = clamp((v - a) / (b - a), 0, 1);
  return t * t * (3 - 2 * t);
};
export const damp = (current, target, lambda, dt) => lerp(current, target, 1 - Math.exp(-lambda * dt));
export const TAU = Math.PI * 2;

export const ease = {
  linear: (t) => t,
  inQuad: (t) => t * t,
  outQuad: (t) => 1 - (1 - t) * (1 - t),
  inOutQuad: (t) => (t < 0.5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2),
  outCubic: (t) => 1 - Math.pow(1 - t, 3),
  inCubic: (t) => t * t * t,
  inOutCubic: (t) => (t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2),
  outBack: (t) => {
    const c1 = 1.70158, c3 = c1 + 1;
    return 1 + c3 * Math.pow(t - 1, 3) + c1 * Math.pow(t - 1, 2);
  },
  inBack: (t) => {
    const c1 = 1.70158, c3 = c1 + 1;
    return c3 * t * t * t - c1 * t * t;
  },
  outElastic: (t) => {
    if (t === 0 || t === 1) return t;
    return Math.pow(2, -10 * t) * Math.sin((t * 10 - 0.75) * ((2 * Math.PI) / 3)) + 1;
  },
  outBounce: (t) => {
    const n1 = 7.5625, d1 = 2.75;
    if (t < 1 / d1) return n1 * t * t;
    if (t < 2 / d1) return n1 * (t -= 1.5 / d1) * t + 0.75;
    if (t < 2.5 / d1) return n1 * (t -= 2.25 / d1) * t + 0.9375;
    return n1 * (t -= 2.625 / d1) * t + 0.984375;
  },
};

// Tiny tween manager, driven by the main loop.
export class Tweens {
  constructor() { this.list = []; }
  add({ duration = 0.3, delay = 0, ease: e = ease.outCubic, onUpdate, onComplete, scaled = true }) {
    const tw = { t: -delay, duration, ease: e, onUpdate, onComplete, done: false, scaled };
    this.list.push(tw);
    return tw;
  }
  wait(seconds) {
    return new Promise((resolve) => this.add({ duration: seconds, onComplete: resolve }));
  }
  to(duration, fn, e = ease.outCubic, delay = 0) {
    return new Promise((resolve) => this.add({ duration, delay, ease: e, onUpdate: fn, onComplete: resolve }));
  }
  update(dt, scaledDt = dt) {
    const l = this.list;
    for (let i = 0; i < l.length; i++) {
      const tw = l[i];
      if (tw.done) continue;
      tw.t += tw.scaled ? scaledDt : dt;
      if (tw.t < 0) continue;
      const k = tw.duration > 0 ? clamp(tw.t / tw.duration, 0, 1) : 1;
      if (tw.onUpdate) tw.onUpdate(tw.ease(k), k);
      if (k >= 1) {
        tw.done = true;
        if (tw.onComplete) tw.onComplete();
      }
    }
    if (l.length > 64 || (l.length && l.every((t) => t.done))) this.list = l.filter((t) => !t.done);
  }
  cancel(tw) { if (tw) tw.done = true; }
  clear() { this.list.length = 0; }
}
