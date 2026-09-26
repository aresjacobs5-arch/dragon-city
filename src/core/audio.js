// Game audio. Recorded sound effects, creature voices, music and jingles come
// from freely licensed game-audio packs (see public/audio/CREDITS.txt) and are
// listed in src/data/audio.json. A small WebAudio synthesizer covers any sound
// that has not finished loading yet (or failed to load), so the game is never silent.
import MANIFEST from '../data/audio.json';

const NOTE = (n) => 440 * Math.pow(2, (n - 69) / 12);

class Synth {
  constructor() {
    this.ctx = null;
    this.ready = false;
    this.musicVol = 0.45;
    this.sfxVol = 0.8;
    this.muted = false;
    this.sdkMuted = false;
    this.track = null;
    this.pendingTrack = null;
    this.step = 0;
    this.nextTime = 0;
    this.lastSfx = {};
    this.samples = new Map(); // url -> AudioBuffer (decoded) | null (failed)
    this.raw = new Map(); // url -> Promise<ArrayBuffer>
    this.lastVariant = {};
    this.decks = [];
    this.musicName = null;
  }

  // Starts downloading the sound effects and voices (decoding needs the audio
  // context, which only exists after the first tap).
  preload() {
    const urls = [...Object.values(MANIFEST.sfx).flat(), ...Object.values(MANIFEST.voices).flat(), ...Object.values(MANIFEST.jingles)];
    let i = 0;
    const next = () => {
      if (i >= urls.length) return;
      const u = urls[i++];
      this._fetch(u).finally(next);
    };
    for (let k = 0; k < 6; k++) next();
  }
  _fetch(u) {
    if (!this.raw.has(u)) {
      this.raw.set(u, fetch(`./${u}`).then((r) => (r.ok ? r.arrayBuffer() : null)).catch(() => null));
    }
    const p = this.raw.get(u);
    if (this.ctx) this._decode(u, p);
    return p;
  }
  _decode(u, p) {
    if (this.samples.has(u) || this._decoding?.has(u)) return;
    (this._decoding = this._decoding || new Set()).add(u);
    p.then((buf) => {
      if (!buf) return this.samples.set(u, null);
      const done = (b) => this.samples.set(u, b || null);
      // Safari < 14.1 only supports the callback form
      const r = this.ctx.decodeAudioData(buf.slice(0), done, () => done(null));
      if (r && r.catch) r.catch(() => done(null));
    });
  }
  _buffer(u) {
    const b = this.samples.get(u);
    if (b === undefined) this._fetch(u);
    return b || null;
  }

  // Must be called from a user gesture.
  unlock() {
    if (this.ctx) {
      if (this.ctx.state === 'suspended') this.ctx.resume();
      return;
    }
    const AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return;
    const ctx = new AC();
    this.ctx = ctx;
    this.master = ctx.createGain();
    const comp = ctx.createDynamicsCompressor();
    comp.threshold.value = -14;
    comp.ratio.value = 3;
    this.master.connect(comp);
    comp.connect(ctx.destination);
    this.music = ctx.createGain();
    this.sfx = ctx.createGain();
    this.music.connect(this.master);
    this.sfx.connect(this.master);
    // gentle reverb for pads/bells
    this.verb = ctx.createConvolver();
    this.verb.buffer = this._impulse(2.2);
    this.verbGain = ctx.createGain();
    this.verbGain.gain.value = 0.28;
    this.verb.connect(this.verbGain);
    this.verbGain.connect(this.master);
    this.noiseBuf = this._noise();
    this.ready = true;
    for (const [u, p] of this.raw) this._decode(u, p);
    this._makeDecks();
    this.apply();
    this._sched = setInterval(() => this._schedule(), 60);
    if (this.pendingTrack) this.playMusic(this.pendingTrack);
  }

  // Two streaming players for music so scenes can crossfade. Each is started
  // once inside the unlocking tap so mobile browsers let it play later on.
  _makeDecks() {
    const SILENT = 'data:audio/wav;base64,UklGRiQAAABXQVZFZm10IBAAAAABAAEAQB8AAEAfAAABAAgAZGF0YQAAAAA=';
    for (let i = 0; i < 2; i++) {
      const el = document.createElement('audio');
      el.preload = 'auto';
      el.crossOrigin = 'anonymous';
      el.src = SILENT;
      const deck = { el, gain: this.ctx.createGain(), list: null, idx: 0, name: null };
      try {
        this.ctx.createMediaElementSource(el).connect(deck.gain);
      } catch (e) {
        deck.gain = null; // falls back to the element's own volume
      }
      if (deck.gain) {
        deck.gain.gain.value = 0;
        deck.gain.connect(this.music);
      }
      el.addEventListener('ended', () => this._nextTrack(deck));
      el.addEventListener('error', () => {
        if (deck.name && deck.name === this.musicName && el.src.indexOf('data:') !== 0) this._synthMusic(deck.name);
      });
      const p = el.play();
      if (p && p.catch) p.catch(() => {});
      this.decks.push(deck);
    }
  }

  _impulse(sec) {
    const ctx = this.ctx;
    const len = Math.floor(ctx.sampleRate * sec);
    const buf = ctx.createBuffer(2, len, ctx.sampleRate);
    for (let c = 0; c < 2; c++) {
      const d = buf.getChannelData(c);
      for (let i = 0; i < len; i++) d[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / len, 3);
    }
    return buf;
  }
  _noise() {
    const ctx = this.ctx;
    const buf = ctx.createBuffer(1, ctx.sampleRate, ctx.sampleRate);
    const d = buf.getChannelData(0);
    for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
    return buf;
  }

  setVolumes(music, sfx, muted) {
    this.musicVol = music;
    this.sfxVol = sfx;
    this.muted = muted;
    this.apply();
  }
  setSdkMuted(v) {
    this.sdkMuted = v;
    this.apply();
  }
  apply() {
    if (!this.ready) return;
    const mute = this.muted || this.sdkMuted || this.paused;
    const t = this.ctx.currentTime;
    this.master.gain.setTargetAtTime(mute ? 0 : 1, t, 0.05);
    this.music.gain.setTargetAtTime(this.musicVol * this._musicScale(), t, 0.1);
    this.sfx.gain.setTargetAtTime(this.sfxVol * 0.7, t, 0.05);
  }
  // recorded tracks are mastered quieter than the synth score
  _musicScale() {
    return this.track ? 0.38 : 0.62;
  }
  // Several things can pause audio at once (ads, hidden tab); track each reason.
  pause(v, reason = 'ad') {
    if (!this.pauseReasons) this.pauseReasons = new Set();
    if (v) this.pauseReasons.add(reason);
    else this.pauseReasons.delete(reason);
    this.paused = this.pauseReasons.size > 0;
    this.apply();
    for (const d of this.decks) {
      if (!d.name) continue;
      if (this.paused) d.el.pause();
      else if (d.name === this.musicName) this._resume(d.el);
    }
  }
  _resume(el) {
    const p = el.play();
    if (p && p.catch) p.catch(() => {});
  }

  // ------------------------------------------------------------ primitives
  _env(g, t, a, peak, d, sustain = 0, rel = 0.05) {
    g.gain.cancelScheduledValues(t);
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(Math.max(0.0002, peak), t + a);
    if (sustain > 0) {
      g.gain.exponentialRampToValueAtTime(Math.max(0.0002, peak * sustain), t + a + d);
    } else g.gain.exponentialRampToValueAtTime(0.0001, t + a + d);
  }
  tone({ freq = 440, type = 'sine', t = null, a = 0.005, d = 0.2, vol = 0.3, dest = null, slide = null, verb = 0, detune = 0, filter = null, vib = 0 }) {
    const ctx = this.ctx;
    const tt = t ?? ctx.currentTime;
    const o = ctx.createOscillator();
    o.type = type;
    o.frequency.setValueAtTime(freq, tt);
    if (detune) o.detune.value = detune;
    if (slide) o.frequency.exponentialRampToValueAtTime(Math.max(20, slide), tt + a + d);
    let node = o;
    if (vib) {
      const lfo = ctx.createOscillator();
      const lg = ctx.createGain();
      lfo.frequency.value = 5.5;
      lg.gain.value = vib;
      lfo.connect(lg);
      lg.connect(o.frequency);
      lfo.start(tt);
      lfo.stop(tt + a + d + 0.1);
    }
    if (filter) {
      const f = ctx.createBiquadFilter();
      f.type = 'lowpass';
      f.frequency.setValueAtTime(filter[0], tt);
      if (filter[1]) f.frequency.exponentialRampToValueAtTime(filter[1], tt + a + d);
      f.Q.value = filter[2] || 1;
      o.connect(f);
      node = f;
    }
    const g = ctx.createGain();
    node.connect(g);
    g.connect(dest || this.sfx);
    if (verb) {
      const vg = ctx.createGain();
      vg.gain.value = verb;
      g.connect(vg);
      vg.connect(this.verb);
    }
    this._env(g, tt, a, vol, d);
    o.start(tt);
    o.stop(tt + a + d + 0.05);
    return o;
  }
  noise({ t = null, d = 0.1, vol = 0.2, type = 'bandpass', f = 2000, f2 = null, q = 1, dest = null, a = 0.002 }) {
    const ctx = this.ctx;
    const tt = t ?? ctx.currentTime;
    const src = ctx.createBufferSource();
    src.buffer = this.noiseBuf;
    src.loop = true; // long rumbles outlast the 1s noise buffer
    const flt = ctx.createBiquadFilter();
    flt.type = type;
    flt.frequency.setValueAtTime(f, tt);
    if (f2) flt.frequency.exponentialRampToValueAtTime(f2, tt + d);
    flt.Q.value = q;
    const g = ctx.createGain();
    src.connect(flt);
    flt.connect(g);
    g.connect(dest || this.sfx);
    this._env(g, tt, a, vol, d);
    src.start(tt, Math.random() * 0.5);
    src.stop(tt + a + d + 0.05);
  }

  // ------------------------------------------------------------ SFX
  play(name, opts = {}) {
    if (!this.ready || this.muted) return;
    const now = this.ctx.currentTime;
    // rate-limit identical sounds (avoid machine-gun repeats)
    const minGap = { coin: 0.05, click: 0.04, hit: 0.03, tick: 0.02 }[name] ?? 0.06;
    if (this.lastSfx[name] && now - this.lastSfx[name] < minGap) return;
    this.lastSfx[name] = now;
    if (this._sample(name, now, opts)) return;
    const fn = SFX[name];
    if (fn) fn(this, now, opts);
  }

  // Plays a recorded variant of a sound; false if none is loaded yet.
  _sample(name, t, opts = {}) {
    if (name === 'roar' || name === 'squeak') return this.voice(opts.species || null, { stage: opts.stage ?? (name === 'squeak' ? 0 : 1), boss: !!opts.boss, pitch: opts.pitch });
    const list = MANIFEST.sfx[name];
    if (!list) return false;
    const ready = list.map((u) => this._buffer(u)).filter(Boolean);
    if (!ready.length) return false;
    const seq = SEQ[name] || [0];
    let k = this.lastVariant[name] ?? -1;
    for (const off of seq) {
      // never repeat the same variant twice in a row
      k = ready.length > 1 ? (k + 1 + Math.floor(Math.random() * (ready.length - 1))) % ready.length : 0;
      this._playBuffer(ready[k], t + off, { rate: (RATE[name] || 1) * (opts.rate || 1), jitter: 0.06, vol: opts.vol ?? 1 });
    }
    this.lastVariant[name] = k;
    return true;
  }
  _playBuffer(buf, t, { rate = 1, jitter = 0, vol = 1, dest = null } = {}) {
    const src = this.ctx.createBufferSource();
    src.buffer = buf;
    src.playbackRate.value = rate * (1 + (Math.random() - 0.5) * jitter);
    const g = this.ctx.createGain();
    g.gain.value = vol;
    src.connect(g);
    g.connect(dest || this.sfx);
    src.start(t);
    return src;
  }

  // A creature's voice. Every species keeps one voice for life: babies squeak,
  // evolved forms use the grown-up voice, deeper at each evolution.
  voice(def, { stage = 1, boss = false, pitch = null, vol = 1 } = {}) {
    if (!this.ready || this.muted) return true;
    const t = this.ctx.currentTime;
    const key = def ? def.id : 'x';
    let h = 0;
    for (let i = 0; i < key.length; i++) h = (h * 31 + key.charCodeAt(i)) >>> 0;
    const bigType = boss || (def && (['dragon', 'golem', 'whale', 'kraken', 'shell'].includes(def.model?.arch) || ['legendary', 'mythic', 'ancient'].includes(def.rarity)));
    let pool, rate;
    if (boss) (pool = 'big'), (rate = 0.78);
    else if (stage === 0) (pool = 'cute'), (rate = 1.08);
    else if (stage === 1) (pool = 'beast'), (rate = 1.08);
    else (pool = bigType ? 'big' : 'beast'), (rate = 0.9);
    if (!def && pitch) {
      // old callers pass only a pitch: map it onto the voice pools
      pool = pitch >= 120 ? 'cute' : pitch >= 90 ? 'beast' : 'big';
      rate = pitch >= 120 ? pitch / 130 : pitch >= 90 ? pitch / 100 : Math.max(0.7, pitch / 80);
    }
    const list = MANIFEST.voices[pool] || [];
    const buf = list.length ? this._buffer(list[h % list.length]) : null;
    if (!buf) {
      SFX[stage === 0 && !boss ? 'squeak' : 'roar'](this, t, { pitch: pitch || (boss ? 70 : stage === 0 ? 140 : 110) });
      return true;
    }
    this._playBuffer(buf, t, { rate, jitter: 0.05, vol: 0.9 * vol });
    return true;
  }

  // ------------------------------------------------------------ MUSIC
  playMusic(name) {
    if (!this.ready) {
      this.pendingTrack = name;
      return;
    }
    if (this.musicName === name) return;
    this.musicName = name;
    const list = MANIFEST.music[name];
    if (!list || !this.decks.length) return this._synthMusic(name);
    this.track = null; // recorded music replaces the synth score
    this.apply();
    const cur = this.decks.find((d) => d.name);
    const next = this.decks.find((d) => d !== cur) || this.decks[0];
    if (cur && cur !== next) this._fadeDeck(cur, 0, 0.7, true);
    // continue each scene's playlist where it left off
    this.playlistPos = this.playlistPos || {};
    next.list = list;
    next.idx = this.playlistPos[name] ?? 0;
    next.name = name;
    this._loadTrack(next);
    this._fadeDeck(next, 1, 1.2);
  }
  _loadTrack(deck) {
    const el = deck.el;
    el.loop = deck.list.length === 1;
    el.src = `./${deck.list[deck.idx % deck.list.length]}`;
    if (!this.paused) this._resume(el);
  }
  _nextTrack(deck) {
    if (!deck.name || deck.name !== this.musicName || !deck.list) return;
    deck.idx = (deck.idx + 1) % deck.list.length;
    this.playlistPos[deck.name] = deck.idx;
    this._loadTrack(deck);
  }
  _fadeDeck(deck, to, sec, stopAfter = false) {
    const t = this.ctx.currentTime;
    if (deck.gain) {
      deck.gain.gain.cancelScheduledValues(t);
      deck.gain.gain.setValueAtTime(deck.gain.gain.value, t);
      deck.gain.gain.linearRampToValueAtTime(to, t + sec);
    } else deck.el.volume = to;
    if (stopAfter) {
      const name = deck.name;
      deck.name = null;
      setTimeout(() => {
        if (!deck.name) {
          deck.el.pause();
          if (name) this.playlistPos[name] = deck.idx;
        }
      }, sec * 1000 + 60);
    }
  }
  _synthMusic(name) {
    for (const d of this.decks) if (d.name) this._fadeDeck(d, 0, 0.3, true);
    if (this.track && this.track.name === name) return;
    const tr = TRACKS[name];
    if (!tr) return;
    // fade out current by ducking music bus briefly
    const t = this.ctx.currentTime;
    this.music.gain.setTargetAtTime(0.0001, t, 0.25);
    setTimeout(() => {
      this.track = { name, ...tr };
      this.step = 0;
      this.nextTime = this.ctx.currentTime + 0.1;
      this.apply();
    }, 450);
  }
  stopMusic() {
    this.track = null;
    this.musicName = null;
    for (const d of this.decks) if (d.name) this._fadeDeck(d, 0, 0.5, true);
  }
  jingle(name) {
    if (!this.ready) return;
    const t = this.ctx.currentTime;
    const url = MANIFEST.jingles[name];
    const buf = url ? this._buffer(url) : null;
    const fn = JINGLES[name] || (name === 'victoryBoss' ? JINGLES.victory : name === 'evolve' ? JINGLES.levelup : null);
    if (!buf && !fn) return;
    // duck the music while the fanfare plays
    this.music.gain.setTargetAtTime(this.musicVol * this._musicScale() * 0.12, t, 0.08);
    let dur = 2.2;
    if (buf) {
      this._playBuffer(buf, t + 0.02, { vol: 1.1 });
      dur = buf.duration + 0.2;
    } else fn(this, t + 0.02);
    clearTimeout(this._duckT);
    this._duckT = setTimeout(() => this.apply(), dur * 1000);
  }

  _schedule() {
    if (!this.track || !this.ready) return;
    const tr = this.track;
    const spb = 60 / tr.bpm / 4; // 16th notes
    while (this.nextTime < this.ctx.currentTime + 0.25) {
      tr.step(this, this.step, this.nextTime, spb);
      this.step++;
      this.nextTime += spb;
    }
  }
}

// ---------------------------------------------------------------------------
// Recorded sounds: a few are played as short sequences, some at a fixed pitch.
const SEQ = { build: [0, 0.15, 0.3] };
const RATE = { thunder: 0.55 };

const SFX = {
  click: (s, t) => s.tone({ freq: 880, slide: 620, type: 'sine', d: 0.05, vol: 0.18, t }),
  tab: (s, t) => s.tone({ freq: 660, slide: 780, type: 'triangle', d: 0.05, vol: 0.14, t }),
  back: (s, t) => s.tone({ freq: 620, slide: 420, type: 'triangle', d: 0.07, vol: 0.14, t }),
  error: (s, t) => {
    s.tone({ freq: 180, type: 'square', d: 0.12, vol: 0.08, t, filter: [900] });
    s.tone({ freq: 150, type: 'square', d: 0.14, vol: 0.08, t: t + 0.1, filter: [900] });
  },
  coin: (s, t) => {
    s.tone({ freq: 1320, type: 'square', d: 0.06, vol: 0.06, t, filter: [4000] });
    s.tone({ freq: 1980, type: 'square', d: 0.14, vol: 0.06, t: t + 0.05, filter: [5000] });
    s.tone({ freq: 2640, type: 'sine', d: 0.2, vol: 0.05, t: t + 0.05, verb: 0.3 });
  },
  collect: (s, t) => [0, 0.06, 0.12].forEach((o, i) => s.tone({ freq: [1046, 1318, 1568][i], type: 'triangle', d: 0.12, vol: 0.12, t: t + o, verb: 0.2 })),
  food: (s, t) => {
    s.tone({ freq: 420, slide: 900, type: 'sine', d: 0.09, vol: 0.2, t });
    s.noise({ t: t + 0.02, d: 0.08, vol: 0.06, f: 3000 });
  },
  eat: (s, t) => [0, 0.11, 0.22].forEach((o) => s.noise({ t: t + o, d: 0.05, vol: 0.14, f: 900, q: 2 })),
  build: (s, t) => {
    [0, 0.14, 0.28].forEach((o) => {
      s.noise({ t: t + o, d: 0.05, vol: 0.18, f: 700, q: 3 });
      s.tone({ freq: 160, slide: 90, type: 'sine', d: 0.06, vol: 0.2, t: t + o });
    });
  },
  built: (s, t) => [0, 0.08, 0.16, 0.26].forEach((o, i) => s.tone({ freq: NOTE([72, 76, 79, 84][i]), type: 'triangle', d: 0.25, vol: 0.12, t: t + o, verb: 0.35 })),
  place: (s, t) => {
    s.tone({ freq: 220, slide: 110, type: 'sine', d: 0.12, vol: 0.3, t });
    s.noise({ t, d: 0.12, vol: 0.12, f: 400, type: 'lowpass' });
  },
  whoosh: (s, t) => s.noise({ t, d: 0.25, vol: 0.14, f: 400, f2: 3000, q: 1.5, a: 0.05 }),
  pop: (s, t) => s.tone({ freq: 300, slide: 900, type: 'sine', d: 0.07, vol: 0.2, t }),
  crack: (s, t) => {
    s.noise({ t, d: 0.05, vol: 0.3, f: 3500, q: 1, type: 'highpass' });
    s.noise({ t: t + 0.04, d: 0.04, vol: 0.2, f: 2500, q: 1, type: 'highpass' });
  },
  land: (s, t) => s.tone({ freq: 120, slide: 60, type: 'sine', d: 0.2, vol: 0.4, t }),
  burst: (s, t) => {
    s.noise({ t, d: 0.5, vol: 0.25, f: 800, f2: 6000, q: 0.7, a: 0.01 });
    [0, 0.05, 0.1, 0.15].forEach((o, i) => s.tone({ freq: NOTE([72, 76, 79, 84][i]), type: 'triangle', d: 0.6, vol: 0.14, t: t + o, verb: 0.5 }));
  },
  roar: (s, t, o = {}) => {
    const base = o.pitch || 110;
    s.tone({ freq: base, slide: base * 0.7, type: 'sawtooth', a: 0.05, d: 0.45, vol: 0.12, t, filter: [1400, 300, 2], vib: 12 });
    s.tone({ freq: base * 1.5, slide: base, type: 'square', a: 0.05, d: 0.35, vol: 0.05, t, filter: [1000, 250] });
    s.noise({ t, d: 0.4, vol: 0.08, f: 500, q: 0.8 });
  },
  squeak: (s, t) => s.tone({ freq: 900, slide: 1400, type: 'sine', d: 0.12, vol: 0.12, t, vib: 30 }),
  attack: (s, t) => s.noise({ t, d: 0.16, vol: 0.18, f: 900, f2: 3500, q: 1.2, a: 0.02 }),
  hit: (s, t) => {
    s.tone({ freq: 150, slide: 50, type: 'sine', d: 0.14, vol: 0.4, t });
    s.noise({ t, d: 0.06, vol: 0.2, f: 1800, q: 0.8 });
  },
  crit: (s, t) => {
    SFX.hit(s, t);
    s.tone({ freq: 1760, type: 'triangle', d: 0.35, vol: 0.12, t: t + 0.02, verb: 0.4 });
    s.tone({ freq: 2349, type: 'sine', d: 0.3, vol: 0.08, t: t + 0.05, verb: 0.4 });
  },
  fire: (s, t) => s.noise({ t, d: 0.35, vol: 0.2, f: 600, f2: 1800, q: 0.6, a: 0.03 }),
  water: (s, t) => {
    s.noise({ t, d: 0.3, vol: 0.14, f: 1200, f2: 400, q: 2, a: 0.02 });
    s.tone({ freq: 500, slide: 1200, type: 'sine', d: 0.1, vol: 0.12, t: t + 0.05 });
  },
  zap: (s, t) => {
    s.tone({ freq: 1400, slide: 200, type: 'sawtooth', d: 0.18, vol: 0.07, t, filter: [5000] });
    s.noise({ t, d: 0.15, vol: 0.12, f: 5000, q: 0.5, type: 'highpass' });
  },
  ice: (s, t) => [0, 0.03, 0.06].forEach((o, i) => s.tone({ freq: [2093, 2637, 3136][i], type: 'sine', d: 0.25, vol: 0.07, t: t + o, verb: 0.5 })),
  rock: (s, t) => {
    s.noise({ t, d: 0.25, vol: 0.3, f: 300, q: 0.8, type: 'lowpass' });
    s.tone({ freq: 90, slide: 45, type: 'sine', d: 0.25, vol: 0.4, t });
  },
  magic: (s, t) => [0, 0.05, 0.1, 0.15].forEach((o, i) => s.tone({ freq: NOTE([84, 88, 91, 96][i]), type: 'sine', d: 0.3, vol: 0.07, t: t + o, verb: 0.5 })),
  heal: (s, t) => [0, 0.07, 0.14].forEach((o, i) => s.tone({ freq: NOTE([76, 79, 84][i]), type: 'sine', d: 0.35, vol: 0.1, t: t + o, verb: 0.5 })),
  shield: (s, t) => s.tone({ freq: 330, slide: 660, type: 'triangle', d: 0.3, vol: 0.12, t, verb: 0.4 }),
  buff: (s, t) => s.tone({ freq: 440, slide: 880, type: 'square', d: 0.25, vol: 0.05, t, filter: [3000] }),
  debuff: (s, t) => s.tone({ freq: 500, slide: 200, type: 'square', d: 0.25, vol: 0.05, t, filter: [2000] }),
  charge: (s, t) => {
    s.noise({ t, d: 0.7, vol: 0.12, f: 300, f2: 4000, q: 2, a: 0.4 });
    s.tone({ freq: 110, slide: 440, type: 'sawtooth', a: 0.3, d: 0.5, vol: 0.06, t, filter: [800, 3000] });
  },
  boom: (s, t) => {
    s.tone({ freq: 90, slide: 30, type: 'sine', d: 0.6, vol: 0.5, t });
    s.noise({ t, d: 0.5, vol: 0.3, f: 500, type: 'lowpass' });
  },
  faint: (s, t) => s.tone({ freq: 500, slide: 120, type: 'triangle', d: 0.5, vol: 0.12, t }),
  heart: (s, t) => {
    s.tone({ freq: NOTE(79), type: 'sine', d: 0.2, vol: 0.12, t, verb: 0.4 });
    s.tone({ freq: NOTE(84), type: 'sine', d: 0.3, vol: 0.12, t: t + 0.12, verb: 0.4 });
  },
  quest: (s, t) => [0, 0.09].forEach((o, i) => s.tone({ freq: NOTE([84, 91][i]), type: 'triangle', d: 0.25, vol: 0.12, t: t + o, verb: 0.3 })),
  reward: (s, t) => [0, 0.07, 0.14, 0.21, 0.28].forEach((o, i) => s.tone({ freq: NOTE([72, 76, 79, 84, 88][i]), type: 'triangle', d: 0.3, vol: 0.1, t: t + o, verb: 0.4 })),
  unlock: (s, t) => [0, 0.1].forEach((o, i) => [0, 4, 7].forEach((n) => s.tone({ freq: NOTE(72 + n + i * 5), type: 'sine', d: 0.6, vol: 0.06, t: t + o, verb: 0.6 }))),
  tick: (s, t) => s.tone({ freq: 1600, type: 'square', d: 0.015, vol: 0.05, t, filter: [3000] }),
  spin: (s, t) => {
    for (let i = 0; i < 24; i++) s.tone({ freq: 1500, type: 'square', d: 0.012, vol: 0.04, t: t + Math.pow(i / 24, 1.8) * 4, filter: [3000] });
  },
  sparkle: (s, t) => [0, 0.04, 0.08].forEach((o) => s.tone({ freq: 2000 + Math.random() * 2000, type: 'sine', d: 0.15, vol: 0.05, t: t + o, verb: 0.5 })),
  swoosh: (s, t) => s.noise({ t, d: 0.35, vol: 0.12, f: 2000, f2: 300, q: 1, a: 0.08 }),
  // distant thunder: a soft crackle and a long low rumble
  thunder: (s, t) => {
    s.noise({ t, d: 0.25, vol: 0.05, f: 2600, type: 'highpass' });
    s.noise({ t: t + 0.12, d: 1.8, vol: 0.2, f: 160, type: 'lowpass', a: 0.15 });
    s.tone({ freq: 55, slide: 38, type: 'sine', d: 1.4, vol: 0.18, t: t + 0.15, a: 0.2 });
  },
};

// ---------------------------------------------------------------------------
// Music tracks: step(s, i, t, spb) schedules 16th-note step i at time t.
function chordAt(prog, bar) {
  return prog[bar % prog.length];
}
const PENTA_F = [65, 67, 69, 72, 74, 77, 79, 81, 84];

const TRACKS = {
  island: {
    bpm: 84,
    step(s, i, t, spb) {
      const bar = Math.floor(i / 16);
      const pos = i % 16;
      const prog = [[53, 57, 60], [50, 53, 57], [46, 50, 53], [48, 52, 55]]; // F Dm Bb C
      const ch = chordAt(prog, Math.floor(bar / 2));
      const M = s.music;
      if (pos === 0 && bar % 2 === 0) {
        for (const n of ch) s.tone({ freq: NOTE(n + 12), type: 'triangle', a: 0.6, d: 3.2, vol: 0.035, t, dest: M, verb: 0.5, filter: [1400] });
        s.tone({ freq: NOTE(ch[0] - 12), type: 'sine', a: 0.02, d: 1.6, vol: 0.14, t, dest: M });
      }
      if (pos === 8) s.tone({ freq: NOTE(ch[0] - 12), type: 'sine', a: 0.02, d: 1.0, vol: 0.1, t, dest: M });
      // marimba arpeggio
      if (pos % 4 === 0 || (pos % 4 === 2 && Math.random() < 0.35)) {
        const n = ch[(pos / 2) % 3 | 0] + 12 + (Math.random() < 0.3 ? 12 : 0);
        s.tone({ freq: NOTE(n), type: 'sine', a: 0.003, d: 0.35, vol: 0.07, t, dest: M, verb: 0.3 });
        s.tone({ freq: NOTE(n) * 4, type: 'sine', a: 0.002, d: 0.08, vol: 0.012, t, dest: M });
      }
      // flute melody (sparse)
      if (bar % 4 >= 2 && pos % 4 === 0 && Math.random() < 0.55) {
        const n = PENTA_F[(Math.random() * PENTA_F.length) | 0] + 12;
        s.tone({ freq: NOTE(n), type: 'sine', a: 0.06, d: spb * (Math.random() < 0.4 ? 6 : 3), vol: 0.045, t, dest: M, verb: 0.5, vib: 4 });
      }
      if (pos % 4 === 2) s.noise({ t, d: 0.03, vol: 0.012, f: 8000, type: 'highpass', dest: M });
    },
  },
  map: {
    bpm: 104,
    step(s, i, t, spb) {
      const bar = Math.floor(i / 16);
      const pos = i % 16;
      const prog = [[50, 53, 57], [48, 52, 55], [46, 50, 53], [45, 49, 52]]; // Dm C Bb A
      const ch = chordAt(prog, bar);
      const M = s.music;
      if (pos === 0) for (const n of ch) s.tone({ freq: NOTE(n + 12), type: 'sawtooth', a: 0.3, d: 1.8, vol: 0.018, t, dest: M, verb: 0.4, filter: [1200, 700] });
      if (pos === 0 || pos === 8) s.tone({ freq: NOTE(ch[0] - 12), type: 'sine', d: 0.5, vol: 0.2, t, dest: M, slide: NOTE(ch[0] - 14) });
      if (pos === 4 || pos === 12) s.noise({ t, d: 0.12, vol: 0.05, f: 300, type: 'lowpass', dest: M });
      if (pos % 2 === 0) {
        const n = ch[(pos / 2) % 3] + 24;
        s.tone({ freq: NOTE(n), type: 'triangle', a: 0.003, d: 0.18, vol: 0.05, t, dest: M });
      }
      if (bar % 2 === 1 && pos % 4 === 0 && Math.random() < 0.6) {
        const n = [62, 64, 65, 67, 69, 72, 74][(Math.random() * 7) | 0] + 12;
        s.tone({ freq: NOTE(n), type: 'square', a: 0.02, d: spb * 3, vol: 0.025, t, dest: M, filter: [2500], verb: 0.3, vib: 3 });
      }
    },
  },
  battle: {
    bpm: 138,
    step(s, i, t, spb) {
      const bar = Math.floor(i / 16);
      const pos = i % 16;
      const prog = [45, 45, 41, 43]; // Am F G
      const root = prog[bar % 4];
      const M = s.music;
      if (pos % 4 === 0) s.tone({ freq: 60, slide: 40, type: 'sine', d: 0.18, vol: 0.28, t, dest: M });
      if (pos === 4 || pos === 12) s.noise({ t, d: 0.1, vol: 0.09, f: 1800, q: 0.7, dest: M });
      if (pos % 2 === 0) s.noise({ t, d: 0.02, vol: 0.02, f: 9000, type: 'highpass', dest: M });
      if (pos % 2 === 0) s.tone({ freq: NOTE(root - 12 + (pos % 8 === 6 ? 12 : 0)), type: 'square', d: 0.1, vol: 0.05, t, dest: M, filter: [700] });
      const arp = [0, 3, 7, 12, 7, 3];
      if (bar % 2 === 1 || pos % 2 === 0) s.tone({ freq: NOTE(root + 24 + arp[pos % 6]), type: 'sawtooth', d: 0.08, vol: 0.018, t, dest: M, filter: [2400] });
    },
  },
  boss: {
    bpm: 150,
    step(s, i, t, spb) {
      const bar = Math.floor(i / 16);
      const pos = i % 16;
      const prog = [38, 38, 34, 37]; // Dm Bb C#dim-ish
      const root = prog[bar % 4];
      const M = s.music;
      if (pos % 4 === 0 || pos === 10) s.tone({ freq: 55, slide: 35, type: 'sine', d: 0.22, vol: 0.34, t, dest: M });
      if (pos === 4 || pos === 12) s.noise({ t, d: 0.14, vol: 0.11, f: 1500, q: 0.6, dest: M });
      if (pos % 2 === 1) s.noise({ t, d: 0.02, vol: 0.02, f: 9000, type: 'highpass', dest: M });
      if (pos === 0) for (const n of [0, 3, 7]) s.tone({ freq: NOTE(root + 12 + n), type: 'sawtooth', a: 0.02, d: 0.5, vol: 0.03, t, dest: M, filter: [1600, 400] });
      s.tone({ freq: NOTE(root + (pos % 8 < 6 ? 0 : 1)), type: 'square', d: 0.09, vol: 0.05, t, dest: M, filter: [500] });
      if (bar % 2 === 1 && pos % 4 === 2) s.tone({ freq: NOTE(root + 36 + [0, 3, 6, 5][pos / 4 | 0]), type: 'square', d: 0.15, vol: 0.02, t, dest: M, filter: [3000], vib: 5 });
    },
  },
};

const JINGLES = {
  victory: (s, t) => {
    [72, 76, 79, 84].forEach((n, i) => s.tone({ freq: NOTE(n), type: 'square', d: 0.16, vol: 0.06, t: t + i * 0.11, filter: [3000], verb: 0.3 }));
    [72, 76, 79, 84].forEach((n) => s.tone({ freq: NOTE(n), type: 'triangle', a: 0.02, d: 1.2, vol: 0.06, t: t + 0.5, verb: 0.5 }));
  },
  defeat: (s, t) => [67, 63, 60, 55].forEach((n, i) => s.tone({ freq: NOTE(n), type: 'triangle', d: 0.4, vol: 0.09, t: t + i * 0.2, verb: 0.4 })),
  levelup: (s, t) => {
    [60, 64, 67, 72, 76, 79, 84].forEach((n, i) => s.tone({ freq: NOTE(n), type: 'square', d: 0.12, vol: 0.05, t: t + i * 0.06, filter: [3500] }));
    [72, 76, 79, 84].forEach((n) => s.tone({ freq: NOTE(n), type: 'triangle', a: 0.02, d: 1.4, vol: 0.06, t: t + 0.45, verb: 0.6 }));
  },
  hatch: (s, t) => [79, 84, 88, 91, 96].forEach((n, i) => s.tone({ freq: NOTE(n), type: 'sine', d: 0.5, vol: 0.07, t: t + i * 0.07, verb: 0.6 })),
  island: (s, t) => {
    [48, 55, 60, 64, 67, 72].forEach((n, i) => s.tone({ freq: NOTE(n), type: 'triangle', a: 0.3, d: 2.5, vol: 0.05, t: t + i * 0.15, verb: 0.7 }));
  },
};

export const Audio = new Synth();
