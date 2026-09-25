import * as THREE from 'three';
import { clamp, ease } from '../../core/math.js';

// Procedural animation for rigid-skinned monsters. Poses are recomposed each
// frame from the rest pose: base state (idle/walk/sleep/float) + additive
// overlays (blink, look-at, one-shot actions such as attack, hit, jump, roar).

const _e = new THREE.Euler();
const _q = new THREE.Quaternion();

export class Animator {
  constructor(view) {
    this.view = view;
    this.bones = view.bones;
    this.arch = view.template.arch;
    this.floating = !!view.template.info.floating;
    this.rest = {};
    for (const [name, b] of Object.entries(this.bones)) {
      this.rest[name] = { p: b.position.clone(), q: b.quaternion.clone(), s: b.scale.clone() };
    }
    this.names = Object.keys(this.bones);
    this.fx = this.names.filter((n) => n.startsWith('fx') && n !== 'fxOrbit' && n !== 'fxHalo');
    this.tents = this.names.filter((n) => n.startsWith('tent'));
    this.t = Math.random() * 100;
    this.state = 'idle';
    this.walkPhase = 0;
    this.walkSpeed = 0;
    this.blinkT = 1 + Math.random() * 3;
    this.blinkK = 0;
    this.lookYaw = 0;
    this.lookPitch = 0;
    this.lookGoalYaw = 0;
    this.lookGoalPitch = 0;
    this.actions = [];
    this.sleepK = 0;
    this.timeScale = 1;
    this.rot = {}; // accumulated euler per bone for this frame
    this.orbitAngle = 0;
  }

  setState(s) {
    this.state = s;
  }

  // Play a one-shot action. Returns a promise that resolves at the impact moment.
  play(type, { duration, intensity = 1 } = {}) {
    const d = duration ?? ACTION_DURATIONS[type] ?? 0.6;
    return new Promise((resolve) => {
      this.actions.push({ type, t: 0, d, intensity, resolve, impact: ACTION_IMPACT[type] ?? 0.5, fired: false });
    });
  }

  isBusy() {
    return this.actions.length > 0;
  }

  lookAt(yaw, pitch = 0) {
    this.lookGoalYaw = clamp(yaw, -0.9, 0.9);
    this.lookGoalPitch = clamp(pitch, -0.4, 0.4);
  }

  _r(name, x = 0, y = 0, z = 0) {
    if (!this.bones[name]) return;
    const r = this.rot[name] || (this.rot[name] = [0, 0, 0]);
    r[0] += x;
    r[1] += y;
    r[2] += z;
  }
  _p(name, x = 0, y = 0, z = 0) {
    const b = this.bones[name];
    if (b) b.position.x += x, b.position.y += y, b.position.z += z;
  }
  _s(name, x = 1, y = 1, z = 1) {
    const b = this.bones[name];
    if (b) b.scale.x *= x, b.scale.y *= y, b.scale.z *= z;
  }

  update(dt) {
    dt *= this.timeScale;
    this.t += dt;
    const t = this.t;
    // reset
    for (const n of this.names) {
      const b = this.bones[n], r = this.rest[n];
      b.position.copy(r.p);
      b.quaternion.copy(r.q);
      b.scale.copy(r.s);
    }
    for (const k in this.rot) {
      const r = this.rot[k];
      r[0] = r[1] = r[2] = 0;
    }

    const sleeping = this.state === 'sleep';
    this.sleepK += ((sleeping ? 1 : 0) - this.sleepK) * (1 - Math.exp(-3 * dt));
    const sk = this.sleepK;
    const walking = this.state === 'walk';
    this.walkSpeed += ((walking ? 1 : 0) - this.walkSpeed) * (1 - Math.exp(-8 * dt));
    const ws = this.walkSpeed;

    // ---- breathing / idle
    const br = Math.sin(t * (2.3 - sk * 1.2));
    const bAmp = 0.022 + sk * 0.02;
    this._s('body', 1 - br * bAmp * 0.5, 1 + br * bAmp, 1 - br * bAmp * 0.5);
    this._p('body', 0, br * 0.008 - sk * 0.03, 0);
    if (this.floating) {
      const fb = Math.sin(t * 1.6) * 0.07 * (1 - sk * 0.6);
      this._p('root', 0, fb + 0.02, 0);
      this._r('root', 0, 0, Math.sin(t * 1.1) * 0.05);
    }
    // head idle sway
    this._r('head', Math.sin(t * 1.3) * 0.04 + sk * 0.35, Math.sin(t * 0.7) * 0.1 * (1 - sk), Math.sin(t * 0.9) * 0.03);
    this._r('neck', Math.sin(t * 1.1) * 0.05 + sk * 0.25, Math.sin(t * 0.6) * 0.08 * (1 - sk), 0);
    this._r('neck2', Math.sin(t * 1.4 + 1) * 0.06, Math.sin(t * 0.8 + 0.5) * 0.1 * (1 - sk), 0);
    // tail wag
    const wagSpeed = 2.4 + ws * 3;
    const wagAmp = (0.32 - sk * 0.25) * (this.arch === 'bird' ? 0.4 : 1);
    this._r('tail0', 0, Math.sin(t * wagSpeed) * wagAmp, 0);
    this._r('tail1', Math.sin(t * wagSpeed * 0.5) * 0.08, Math.sin(t * wagSpeed - 0.8) * wagAmp, 0);
    this._r('tail2', Math.sin(t * wagSpeed * 0.5 + 1) * 0.1, Math.sin(t * wagSpeed - 1.6) * wagAmp * 1.2, 0);
    // ears twitch
    const tw = Math.max(0, Math.sin(t * 0.9) - 0.93) * 12;
    this._r('earL', 0, 0, -Math.sin(t * 30) * 0.15 * tw - sk * 0.2);
    this._r('earR', 0, 0, Math.sin(t * 30) * 0.15 * tw + sk * 0.2);
    // wings
    const flier = this.floating || this.arch === 'bird' || this.arch === 'insect';
    let flap;
    if (this.arch === 'insect') flap = Math.sin(t * 28) * 0.35 * (1 - sk);
    else if (this.floating) flap = Math.sin(t * 5) * 0.5 * (1 - sk);
    else flap = Math.sin(t * 1.5) * 0.08 + (Math.max(0, Math.sin(t * 0.37) - 0.9) * 10) * Math.sin(t * 10) * 0.35;
    if (flier && this.arch === 'bird') flap = Math.sin(t * 1.4) * 0.06;
    this._r('wingL', 0, 0, flap + sk * 0.3);
    this._r('wingR', 0, 0, -flap - sk * 0.3);
    // arms idle
    this._r('armL', Math.sin(t * 1.8) * 0.05, 0, Math.sin(t * 2.3) * 0.05);
    this._r('armR', Math.sin(t * 1.8 + 1) * 0.05, 0, -Math.sin(t * 2.3 + 0.5) * 0.05);
    // tentacles
    for (let i = 0; i < this.tents.length; i++) {
      const n = this.tents[i];
      this._r(n, Math.sin(t * 1.7 + i * 1.3) * 0.12, Math.sin(t * 1.2 + i) * 0.1, Math.cos(t * 1.5 + i * 0.7) * 0.1);
    }
    // flames flicker
    for (let i = 0; i < this.fx.length; i++) {
      const n = this.fx[i];
      const f1 = Math.sin(t * 17 + i * 2.1) * 0.08 + Math.sin(t * 29 + i) * 0.05;
      this._s(n, 1 - f1 * 0.4, 1 + f1 * 1.2, 1 - f1 * 0.4);
      this._r(n, Math.sin(t * 7 + i) * 0.08, 0, Math.sin(t * 9 + i * 2) * 0.1);
    }
    if (this.bones.fxOrbit) {
      this.orbitAngle += dt * 1.1;
      this._r('fxOrbit', 0, this.orbitAngle, 0);
    }
    if (this.bones.fxHalo) this._p('fxHalo', 0, Math.sin(t * 2) * 0.02, 0);

    // ---- walking
    if (ws > 0.01) {
      this.walkPhase += dt * 9;
      const ph = this.walkPhase;
      const sw = Math.sin(ph) * 0.55 * ws;
      if (this.arch === 'biped' || this.arch === 'golem' || this.arch === 'bird') {
        this._r('legL', sw, 0, 0);
        this._r('legR', -sw, 0, 0);
        this._r('armL', -sw * 0.8, 0, 0);
        this._r('armR', sw * 0.8, 0, 0);
        this._p('body', 0, Math.abs(Math.sin(ph)) * 0.03 * ws, 0);
        this._r('body', 0, 0, Math.sin(ph) * 0.06 * ws);
      } else {
        this._r('legFL', sw, 0, 0);
        this._r('legBR', sw, 0, 0);
        this._r('legFR', -sw, 0, 0);
        this._r('legBL', -sw, 0, 0);
        this._r('legML', -sw, 0, 0);
        this._r('legMR', sw, 0, 0);
        this._p('body', 0, Math.abs(Math.sin(ph)) * 0.025 * ws, 0);
        this._r('body', Math.sin(ph * 2) * 0.03 * ws, 0, 0);
      }
      if (this.arch === 'serpent') {
        this._r('neck', 0, Math.sin(ph * 0.5) * 0.25 * ws, 0);
        this._r('neck2', 0, -Math.sin(ph * 0.5) * 0.2 * ws, 0);
      }
      this._r('head', Math.sin(ph * 2) * 0.04 * ws, 0, 0);
    }

    // ---- blink
    this.blinkT -= dt;
    if (this.blinkT <= 0) {
      this.blinkK = 1;
      this.blinkT = 1.6 + Math.random() * 3.5;
      if (Math.random() < 0.15) this.blinkT = 0.25; // double blink
    }
    const blink = this.blinkK > 0 ? Math.sin((1 - this.blinkK) * Math.PI) : 0;
    this.blinkK = Math.max(0, this.blinkK - dt * 7);
    const eyeClose = Math.max(blink, sk);
    if (eyeClose > 0.01) {
      this._s('eyeL', 1, 1 - eyeClose * 0.88, 1);
      this._s('eyeR', 1, 1 - eyeClose * 0.88, 1);
    }

    // ---- look at
    this.lookYaw += (this.lookGoalYaw * (1 - sk) - this.lookYaw) * (1 - Math.exp(-4 * dt));
    this.lookPitch += (this.lookGoalPitch * (1 - sk) - this.lookPitch) * (1 - Math.exp(-4 * dt));
    this._r('head', this.lookPitch, this.lookYaw * 0.8, 0);
    this._r('neck', 0, this.lookYaw * 0.25, 0);

    // ---- one-shot actions
    for (let i = this.actions.length - 1; i >= 0; i--) {
      const a = this.actions[i];
      a.t += dt;
      const k = clamp(a.t / a.d, 0, 1);
      ACTIONS[a.type] && ACTIONS[a.type](this, k, a.intensity);
      if (!a.fired && k >= a.impact) {
        a.fired = true;
        a.resolve();
      }
      if (k >= 1) this.actions.splice(i, 1);
    }

    // ---- apply accumulated rotations
    for (const k in this.rot) {
      const r = this.rot[k];
      if (!r[0] && !r[1] && !r[2]) continue;
      const b = this.bones[k];
      _e.set(r[0], r[1], r[2], 'YXZ');
      _q.setFromEuler(_e);
      b.quaternion.multiply(_q);
    }
  }
}

const ACTION_DURATIONS = { attack: 0.55, cast: 0.7, hit: 0.35, jump: 0.6, happy: 0.9, roar: 1.1, faint: 1.0, eat: 0.8, spin: 0.7, hop: 0.45, ult: 1.2 };
const ACTION_IMPACT = { attack: 0.45, cast: 0.55, hit: 0.1, jump: 0.5, happy: 0.5, roar: 0.55, faint: 0.9, eat: 0.5, spin: 0.5, hop: 0.5, ult: 0.7 };

const bump = (k, a, b) => {
  if (k <= a || k >= b) return 0;
  return Math.sin(((k - a) / (b - a)) * Math.PI);
};

export const ACTIONS = {
  attack(an, k, I) {
    // wind up, lunge, recover
    const wind = bump(k, 0, 0.4);
    const lunge = bump(k, 0.3, 0.75);
    an._p('root', 0, lunge * 0.05, -wind * 0.08 * I + lunge * 0.35 * I);
    an._r('body', -wind * 0.18 + lunge * 0.3, 0, 0);
    an._r('head', -wind * 0.2 + lunge * 0.25, 0, 0);
    an._r('armL', -lunge * 1.4, 0, 0);
    an._r('armR', -lunge * 1.4, 0, 0);
    an._r('jaw', lunge * 0.5, 0, 0);
    an._s('body', 1 + lunge * 0.06, 1 - lunge * 0.05, 1 + lunge * 0.1);
    an._r('tail0', lunge * 0.4, 0, 0);
  },
  cast(an, k, I) {
    const up = bump(k, 0, 0.7);
    const rel = bump(k, 0.45, 1);
    an._s('body', 1 - up * 0.06, 1 + up * 0.1, 1 - up * 0.06);
    an._r('head', -up * 0.3, 0, 0);
    an._r('armL', -up * 2.0, 0, -up * 0.4);
    an._r('armR', -up * 2.0, 0, up * 0.4);
    an._r('wingL', 0, 0, up * 0.6);
    an._r('wingR', 0, 0, -up * 0.6);
    an._p('root', 0, up * 0.08 + rel * 0.02, rel * 0.08);
  },
  hit(an, k, I) {
    const h = bump(k, 0, 1) * I;
    an._p('root', 0, 0, -h * 0.12);
    an._r('body', -h * 0.25, 0, Math.sin(k * 30) * 0.05 * h);
    an._r('head', -h * 0.35, 0, 0);
    an._s('body', 1 + h * 0.08, 1 - h * 0.1, 1 + h * 0.08);
  },
  jump(an, k, I) {
    const squash = bump(k, 0, 0.2) - bump(k, 0.85, 1);
    const air = bump(k, 0.15, 0.9);
    an._p('root', 0, air * 0.45 * I, 0);
    an._s('body', 1 + squash * 0.15, 1 - squash * 0.18 + air * 0.08, 1 + squash * 0.15);
    an._r('armL', -air * 1.2, 0, -air * 0.3);
    an._r('armR', -air * 1.2, 0, air * 0.3);
    an._r('legFL', -air * 0.5, 0, 0);
    an._r('legFR', -air * 0.5, 0, 0);
    an._r('legBL', air * 0.5, 0, 0);
    an._r('legBR', air * 0.5, 0, 0);
    an._r('wingL', 0, 0, Math.sin(k * 30) * air * 0.7);
    an._r('wingR', 0, 0, -Math.sin(k * 30) * air * 0.7);
  },
  hop(an, k, I) {
    const air = Math.sin(k * Math.PI);
    an._p('root', 0, air * 0.18 * I, 0);
    an._s('body', 1, 1 + air * 0.05, 1);
  },
  happy(an, k, I) {
    const hop1 = bump(k, 0, 0.45), hop2 = bump(k, 0.5, 0.95);
    an._p('root', 0, (hop1 + hop2) * 0.2 * I, 0);
    an._r('root', 0, bump(k, 0.2, 0.8) * Math.PI * 2 * 0 + Math.sin(k * Math.PI * 4) * 0.1, 0);
    an._r('armL', -(hop1 + hop2) * 2.2, 0, 0);
    an._r('armR', -(hop1 + hop2) * 2.2, 0, 0);
    an._r('head', -(hop1 + hop2) * 0.2, 0, 0);
    an._r('tail0', 0, Math.sin(k * 40) * 0.4, 0);
    an._s('body', 1, 1 + (hop1 + hop2) * 0.06, 1);
  },
  spin(an, k) {
    an._r('root', 0, ease.inOutCubic(k) * Math.PI * 2, 0);
    an._p('root', 0, Math.sin(k * Math.PI) * 0.2, 0);
  },
  roar(an, k, I) {
    const up = bump(k, 0, 0.35);
    const hold = bump(k, 0.25, 1);
    an._r('head', -up * 0.3 - hold * 0.45, 0, Math.sin(k * 60) * 0.03 * hold);
    an._r('neck', -hold * 0.3, 0, 0);
    an._r('jaw', hold * 0.6, 0, 0);
    an._r('body', -hold * 0.12, 0, 0);
    an._s('body', 1 + hold * 0.06, 1 + hold * 0.06, 1 + hold * 0.06);
    an._r('wingL', 0, 0, hold * 0.8);
    an._r('wingR', 0, 0, -hold * 0.8);
    an._r('armL', -hold * 1.6, 0, -hold * 0.5);
    an._r('armR', -hold * 1.6, 0, hold * 0.5);
    an._p('root', Math.sin(k * 70) * 0.01 * hold, 0, 0);
  },
  ult(an, k, I) {
    const charge = bump(k, 0, 0.65);
    const burst = bump(k, 0.6, 1);
    an._s('body', 1 + charge * 0.12, 1 - charge * 0.08 + burst * 0.1, 1 + charge * 0.12);
    an._r('head', -charge * 0.35 + burst * 0.3, 0, 0);
    an._r('jaw', burst * 0.6, 0, 0);
    an._p('root', Math.sin(k * 80) * 0.012 * charge, charge * 0.06, burst * 0.3);
    an._r('armL', -(charge + burst) * 1.5, 0, 0);
    an._r('armR', -(charge + burst) * 1.5, 0, 0);
    an._r('wingL', 0, 0, charge * 0.9);
    an._r('wingR', 0, 0, -charge * 0.9);
  },
  faint(an, k) {
    const f = ease.outBounce(clamp(k * 1.2, 0, 1));
    an._r('root', 0, 0, f * 1.45);
    an._p('root', 0, -f * 0.05, 0);
    an._r('head', 0.3 * f, 0, 0);
    an._s('eyeL', 1, 1 - f * 0.9, 1);
    an._s('eyeR', 1, 1 - f * 0.9, 1);
  },
  eat(an, k) {
    const n1 = bump(k, 0, 0.3), n2 = bump(k, 0.3, 0.6), n3 = bump(k, 0.6, 0.9);
    const nod = n1 + n2 + n3;
    an._r('head', nod * 0.35, 0, 0);
    an._r('jaw', nod * 0.4, 0, 0);
    an._s('body', 1 + nod * 0.04, 1 - nod * 0.03, 1 + nod * 0.04);
  },
};
