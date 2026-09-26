import { ABILITIES } from '../data/abilities.js';
import { formName, stageForLevel } from '../data/evolutions.js';
import { STATUSES } from '../data/statuses.js';
import { effectiveness } from '../data/elements.js';
import { RELIC_BY_ID } from '../data/rewards.js';
import { species, monStats } from './monsters.js';
import { mulberry32 } from '../core/rng.js';

// Pure battle simulation. The renderer asks for the next actor, the player (or
// AI) chooses an action, and `act` returns an ordered list of events that the
// presentation layer plays back with animations.

const METER = 1000;
const RANDOM_DEBUFFS = ['atkDown', 'defDown', 'spdDown', 'poison', 'burn'];

let unitSeq = 1;

export function makeUnit(mon, side, slot, extra = {}) {
  const def = species(mon.sp);
  const stats = monStats(mon);
  const abilities = (def.abilities || []).map((id) => ABILITIES[id]).filter(Boolean);
  const u = {
    uid: unitSeq++,
    side,
    slot,
    monId: mon.id ?? null,
    sp: mon.sp,
    def,
    name: mon.nick || formName(def, def.boss ? 0 : stageForLevel(mon.lvl || 1)),
    lvl: mon.lvl,
    rank: mon.rank || 0,
    elements: def.elements,
    base: stats,
    hp: stats.hp,
    maxHp: stats.hp,
    energy: 0,
    meter: 0,
    cds: {},
    statuses: [],
    alive: true,
    abilities,
    relic: mon.relic ? RELIC_BY_ID[mon.relic] : null,
    boss: !!def.boss,
    mechanics: def.mechanics || null,
    triggered: {},
    phase: 0,
    elite: !!extra.elite,
    summoned: !!extra.summoned,
  };
  if (u.elite) {
    u.maxHp = u.hp = Math.round(u.hp * 1.35);
  }
  return u;
}

export class Battle {
  constructor({ allies, enemies, rule = null, seed = null, allyLevelHint = 1 }) {
    this.rand = seed != null ? mulberry32(seed) : Math.random;
    this.units = [];
    allies.forEach((m, i) => this.units.push(makeUnit(m, 0, i)));
    enemies.forEach((e, i) => this.units.push(makeUnit(e.mon, 1, e.slot ?? i, { elite: e.elite })));
    this.rule = rule;
    this.turn = 0;
    this.result = null;
    this.stats = { ults: 0, dealt: 0, crits: 0 };
    // opening effects
    for (const u of this.units) {
      u.meter = this.rand() * 120;
      if (u.relic && u.relic.effect.startShield) this._addShield(u, u.maxHp * u.relic.effect.startShield, 99);
      if (u.side === 1 && rule) {
        if (rule.enemyBuff) this._applyStatusRaw(u, rule.enemyBuff, 3);
        if (rule.enemyShield) this._addShield(u, u.maxHp * rule.enemyShield, 99);
      }
    }
  }

  alive(side) {
    return this.units.filter((u) => u.alive && (side === undefined || u.side === side));
  }
  get(uid) {
    return this.units.find((u) => u.uid === uid);
  }

  // ---------------- stats with modifiers
  stat(u, key) {
    const v = u.base[key];
    // crit and resistance are probabilities, not flat stats
    if (key === 'crit' || key === 'res') return Math.max(0, Math.min(0.95, v || 0));
    let mod = 0;
    for (const s of u.statuses) {
      const d = STATUSES[s.id];
      if (d && d.mod && d.mod[key]) mod += d.mod[key] * (s.stacks || 1);
    }
    return Math.max(1, v * (1 + mod));
  }

  // ---------------- turn order
  _timeToAct(u) {
    return (METER - u.meter) / this.stat(u, 'spd');
  }

  nextActor() {
    const alive = this.alive();
    if (!alive.length) return null;
    let best = null;
    let bt = Infinity;
    for (const u of alive) {
      const t = this._timeToAct(u);
      if (t < bt - 1e-9 || (Math.abs(t - bt) < 1e-9 && best && (this.stat(u, 'spd') > this.stat(best, 'spd') || u.side < best.side))) {
        bt = t;
        best = u;
      }
    }
    const dt = Math.max(0, bt);
    for (const u of alive) u.meter += this.stat(u, 'spd') * dt;
    best.meter -= METER;
    if (best.meter < 0) best.meter = 0;
    return best;
  }

  // Predicts upcoming actors without mutating state (for the turn timeline).
  predictOrder(n = 6) {
    const sim = this.alive().map((u) => ({ u, m: u.meter, s: this.stat(u, 'spd') }));
    const out = [];
    for (let i = 0; i < n && sim.length; i++) {
      let best = null, bt = Infinity;
      for (const x of sim) {
        const t = (METER - x.m) / x.s;
        if (t < bt) {
          bt = t;
          best = x;
        }
      }
      for (const x of sim) x.m += x.s * Math.max(0, bt);
      best.m -= METER;
      out.push(best.u);
    }
    return out;
  }

  // ---------------- start-of-turn processing
  beginTurn(u) {
    const ev = [{ t: 'turn', u: u.uid }];
    this.turn++;
    // relic regen
    if (u.relic && u.relic.effect.regen) this._heal(u, u, u.maxHp * u.relic.effect.regen, ev, true);
    // boss rage
    if (u.boss && u.mechanics && u.mechanics.rage) {
      const r = u.statuses.find((s) => s.id === 'rage');
      if (!r || r.stacks < 5) {
        this._applyStatusRaw(u, 'rage', 99, 1);
        ev.push({ t: 'status', u: u.uid, status: 'rage', turns: 99, stacks: (r ? r.stacks : 1) });
      }
    }
    // damage / heal over time
    for (const s of [...u.statuses]) {
      const d = STATUSES[s.id];
      if (!d) continue;
      if (d.dot && u.alive) {
        const amount = Math.max(1, Math.round(u.maxHp * d.dot * (s.stacks || 1) * (u.boss ? 0.4 : 1)));
        this._damageRaw(u, amount, ev, { status: s.id });
      }
      if (d.hot && u.alive) this._heal(u, u, u.maxHp * d.hot, ev, true);
    }
    if (!u.alive) {
      this._checkEnd(ev);
      return { ev, skip: true };
    }
    // cooldowns
    for (const k of Object.keys(u.cds)) if (u.cds[k] > 0) u.cds[k]--;
    // crowd control
    const cc = u.statuses.find((s) => STATUSES[s.id] && STATUSES[s.id].skip);
    let skip = false;
    if (cc) {
      skip = true;
      ev.push({ t: 'skip', u: u.uid, reason: cc.id });
      u.statuses = u.statuses.filter((s) => s !== cc);
      ev.push({ t: 'statusEnd', u: u.uid, status: cc.id });
    }
    // tick durations
    for (const s of [...u.statuses]) {
      if (s.id === 'shield' || s.id === 'rage') continue;
      if (STATUSES[s.id] && STATUSES[s.id].skip) continue;
      s.turns--;
      if (s.turns <= 0) {
        u.statuses = u.statuses.filter((x) => x !== s);
        ev.push({ t: 'statusEnd', u: u.uid, status: s.id });
      }
    }
    const sh = u.statuses.find((s) => s.id === 'shield');
    if (sh) {
      sh.turns--;
      if (sh.turns <= 0) {
        u.statuses = u.statuses.filter((x) => x !== sh);
        ev.push({ t: 'statusEnd', u: u.uid, status: 'shield' });
      }
    }
    return { ev, skip };
  }

  // ---------------- abilities
  abilityOptions(u) {
    return u.abilities.map((ab) => {
      const cd = u.cds[ab.id] || 0;
      let ready = cd <= 0;
      if (ab.kind === 'ult') ready = u.energy >= 100;
      return { ab, ready, cd, energy: u.energy };
    });
  }

  targetsFor(u, ab) {
    const foes = this.alive(1 - u.side);
    const friends = this.alive(u.side);
    switch (ab.target) {
      case 'enemy': {
        const taunt = foes.filter((f) => f.statuses.some((s) => s.id === 'taunt'));
        return taunt.length ? taunt : foes;
      }
      case 'ally':
        return friends;
      case 'self':
        return [u];
      default:
        return [];
    }
  }

  needsTarget(ab) {
    return ab.target === 'enemy' || ab.target === 'ally';
  }

  // Returns the effectiveness label of `ab` from `u` against `t`.
  effLabel(u, ab, t) {
    const m = effectiveness(ab.el === 'neutral' ? null : ab.el, t.elements);
    return m > 1.01 ? 'strong' : m < 0.99 ? 'weak' : null;
  }

  act(u, abilityId, targetUid = null) {
    const ab = ABILITIES[abilityId] || u.abilities[0];
    const ev = [];
    if (!u.alive || this.result) return ev;
    // bleed triggers when acting
    const bleed = u.statuses.find((s) => s.id === 'bleed');
    if (bleed) {
      this._damageRaw(u, Math.max(1, Math.round(u.maxHp * STATUSES.bleed.onAct * (u.boss ? 0.4 : 1))), ev, { status: 'bleed' });
      if (!u.alive) {
        this._checkEnd(ev);
        return ev;
      }
    }
    // resolve targets
    let targets = [];
    const foes = this.alive(1 - u.side);
    const friends = this.alive(u.side);
    if (ab.target === 'enemy') {
      const valid = this.targetsFor(u, ab);
      let t = targetUid != null ? valid.find((x) => x.uid === targetUid) : null;
      if (!t) t = valid[0];
      targets = t ? [t] : [];
    } else if (ab.target === 'enemies') targets = foes;
    else if (ab.target === 'allies') targets = friends;
    else if (ab.target === 'self') targets = [u];
    else if (ab.target === 'ally') {
      let t = targetUid != null ? friends.find((x) => x.uid === targetUid) : null;
      if (!t) t = friends.slice().sort((a, b) => a.hp / a.maxHp - b.hp / b.maxHp)[0];
      targets = t ? [t] : [];
    } else if (ab.target === 'random') {
      targets = [];
      for (let i = 0; i < ab.hits; i++) {
        const pool = this.alive(1 - u.side);
        if (!pool.length) break;
        targets.push(pool[Math.floor(this.rand() * pool.length)]);
      }
    }
    const ultUsed = ab.kind === 'ult';
    ev.push({ t: 'use', u: u.uid, ab: ab.id, targets: targets.map((x) => x.uid), ult: ultUsed });
    if (ultUsed) {
      u.energy = 0;
      this.stats.ults += u.side === 0 ? 1 : 0;
    } else {
      if (ab.cd) u.cds[ab.id] = ab.cd + 1;
      this._gainEnergy(u, ab.kind === 'basic' ? 26 : 20, ev);
    }
    // damage
    if (ab.power > 0) {
      const hitsEach = ab.target === 'random' ? 1 : ab.hits || 1;
      let idx = 0;
      for (const t of targets) {
        for (let h = 0; h < hitsEach; h++) {
          if (!t.alive) break;
          this._hit(u, t, ab, ev, idx++);
        }
      }
    }
    // healing / shields / support
    if (ab.heal) for (const t of targets) this._heal(u, t, t.maxHp * ab.heal, ev);
    if (ab.healAllies) for (const t of this.alive(u.side)) this._heal(u, t, t.maxHp * ab.healAllies, ev);
    if (ab.selfHeal) this._heal(u, u, u.maxHp * ab.selfHeal, ev);
    if (ab.shield) for (const t of targets) {
      this._addShield(t, t.maxHp * ab.shield, 2);
      ev.push({ t: 'shield', u: t.uid, amount: Math.round(t.maxHp * ab.shield) });
    }
    if (ab.cleanse || ab.cleanseAllies) for (const t of ab.cleanseAllies ? this.alive(u.side) : targets) this._cleanse(t, ev);
    if (ab.cleanseSelf) this._cleanse(u, ev);
    if (ab.dispel) for (const t of targets) if (t.side !== u.side) this._dispel(t, ev);
    // status effects
    for (const e of ab.effects || []) {
      let recips;
      if (e.on === 'self') recips = [u];
      else if (e.on === 'allies') recips = this.alive(u.side);
      else if (e.on === 'enemies') recips = this.alive(1 - u.side);
      else recips = targets.filter((t) => t.alive);
      const uniq = [...new Set(recips)];
      for (const t of uniq) {
        const sid = e.s === 'random_debuff' ? RANDOM_DEBUFFS[Math.floor(this.rand() * RANDOM_DEBUFFS.length)] : e.s;
        if (sid === 'shield') {
          this._addShield(t, t.maxHp * (e.v || 0.1), e.t);
          ev.push({ t: 'shield', u: t.uid, amount: Math.round(t.maxHp * (e.v || 0.1)) });
          continue;
        }
        this._tryStatus(u, t, sid, e.ch, e.t, ev);
      }
    }
    if (ab.summon && u.mechanics && u.mechanics.summon) this._summon(u, ev);
    this._checkEnd(ev);
    return ev;
  }

  _hit(u, t, ab, ev, idx) {
    const el = ab.el === 'neutral' ? null : ab.el;
    const eff = effectiveness(el, t.elements);
    let atk = this.stat(u, 'atk');
    let def = this.stat(t, 'def');
    if (ab.pierce) def *= 1 - ab.pierce;
    const mitig = def / (def + 60 + 8 * u.lvl);
    let dmg = atk * ab.power * eff * (1 - mitig) * (0.93 + this.rand() * 0.14);
    if (u.relic && u.relic.effect.elementDmg && el && u.relic.effect.elementDmg[el]) dmg *= 1 + u.relic.effect.elementDmg[el];
    if (ab.execute && t.hp / t.maxHp < 0.4) dmg *= 1 + ab.execute;
    if (t.boss && u.side === 0) dmg *= 1.0;
    const crit = this.rand() < this.stat(u, 'crit');
    if (crit) {
      dmg *= 1.5;
      if (u.side === 0) this.stats.crits++;
    }
    dmg = Math.max(1, Math.round(dmg));
    const res = this._damageRaw(t, dmg, ev, { src: u.uid, ab: ab.id, crit, eff: eff > 1.01 ? 'strong' : eff < 0.99 ? 'weak' : null, ignoreShield: ab.ignoreShield, idx });
    if (u.side === 0) this.stats.dealt += res.dealt;
    // lifesteal
    const ls = (ab.lifesteal || 0) + (u.relic && u.relic.effect.lifesteal ? u.relic.effect.lifesteal : 0);
    if (ls > 0 && res.dealt > 0) this._heal(u, u, res.dealt * ls, ev, true);
    // relic procs
    if (u.relic && t.alive) {
      const r = u.relic.effect;
      if (r.onHit) this._tryStatus(u, t, r.onHit.s, r.onHit.ch, r.onHit.t, ev);
      if (r.onBasic && ab.kind === 'basic') this._tryStatus(u, t, r.onBasic.s, r.onBasic.ch, r.onBasic.t, ev);
    }
    if (t.alive) this._gainEnergy(t, 8, ev);
    this._bossTriggers(t, ev);
  }

  _damageRaw(t, amount, ev, info = {}) {
    let dealt = 0;
    let absorbed = 0;
    const sh = t.statuses.find((s) => s.id === 'shield');
    if (sh && !info.ignoreShield && !info.status) {
      absorbed = Math.min(sh.value, amount);
      sh.value -= absorbed;
      amount -= absorbed;
      if (sh.value <= 0.5) {
        t.statuses = t.statuses.filter((x) => x !== sh);
        ev.push({ t: 'statusEnd', u: t.uid, status: 'shield', broken: true });
      }
    }
    dealt = Math.min(t.hp, amount);
    t.hp -= dealt;
    const killed = t.hp <= 0;
    ev.push({ t: info.status ? 'dot' : 'hit', u: t.uid, src: info.src, ab: info.ab, amount: dealt + absorbed, absorbed, crit: !!info.crit, eff: info.eff || null, status: info.status || null, hp: t.hp, idx: info.idx || 0 });
    if (killed) {
      t.hp = 0;
      t.alive = false;
      t.statuses = [];
      ev.push({ t: 'die', u: t.uid });
    }
    return { dealt, absorbed, killed };
  }

  _heal(src, t, amount, ev, quiet = false) {
    if (!t.alive) return;
    let a = amount;
    if (t.relic && t.relic.effect.healBonus) a *= 1 + t.relic.effect.healBonus;
    a = Math.round(Math.min(t.maxHp - t.hp, a));
    if (a <= 0) return;
    t.hp += a;
    ev.push({ t: 'heal', u: t.uid, amount: a, hp: t.hp, quiet });
  }

  _addShield(t, amount, turns) {
    const sh = t.statuses.find((s) => s.id === 'shield');
    if (sh) {
      sh.value = Math.max(sh.value, amount);
      sh.turns = Math.max(sh.turns, turns);
    } else t.statuses.push({ id: 'shield', turns, value: amount });
  }

  _applyStatusRaw(t, sid, turns, stacksAdd = 1) {
    const d = STATUSES[sid];
    if (!d) return;
    const ex = t.statuses.find((s) => s.id === sid);
    if (ex) {
      ex.turns = Math.max(ex.turns, turns);
      if (d.stacks) ex.stacks = Math.min(d.stacks, (ex.stacks || 1) + stacksAdd);
    } else t.statuses.push({ id: sid, turns, stacks: 1 });
  }

  _tryStatus(src, t, sid, chance, turns, ev) {
    const d = STATUSES[sid];
    if (!d || !t.alive) return;
    let ch = chance;
    if (d.kind === 'debuff' && src.side !== t.side) {
      ch *= 1 - this.stat(t, 'res');
      if (t.boss && d.skip) ch *= 0.5;
    }
    if (this.rand() < ch) {
      this._applyStatusRaw(t, sid, turns);
      ev.push({ t: 'status', u: t.uid, status: sid, turns, stacks: (t.statuses.find((s) => s.id === sid) || {}).stacks || 1 });
    } else if (d.kind === 'debuff' && chance >= 0.5) {
      ev.push({ t: 'resist', u: t.uid, status: sid });
    }
  }

  _cleanse(t, ev) {
    const before = t.statuses.length;
    t.statuses = t.statuses.filter((s) => STATUSES[s.id] && STATUSES[s.id].kind !== 'debuff');
    if (t.statuses.length !== before) ev.push({ t: 'cleanse', u: t.uid });
  }

  _dispel(t, ev) {
    const before = t.statuses.length;
    t.statuses = t.statuses.filter((s) => !(STATUSES[s.id] && STATUSES[s.id].kind === 'buff') || s.id === 'rage');
    if (t.statuses.length !== before) ev.push({ t: 'dispel', u: t.uid });
  }

  _gainEnergy(u, n, ev) {
    if (!u.alive) return;
    let g = n;
    if (u.relic && u.relic.effect.ultCharge) g *= 1 + u.relic.effect.ultCharge;
    if (u.boss) g *= 1.25;
    const before = u.energy;
    u.energy = Math.min(100, u.energy + g);
    if (before < 100 && u.energy >= 100) ev.push({ t: 'ultReady', u: u.uid });
  }

  _bossTriggers(t, ev) {
    if (!t.boss || !t.alive || !t.mechanics) return;
    const k = t.hp / t.maxHp;
    const M = t.mechanics;
    const once = (key, thr, fn) => {
      if (k <= thr && !t.triggered[key]) {
        t.triggered[key] = true;
        fn();
      }
    };
    if (M.summon) M.summon.at.forEach((thr, i) => once(`summon${i}`, thr, () => this._summon(t, ev)));
    if (M.phases) M.phases.forEach((thr, i) => once(`phase${i}`, thr, () => {
      t.phase++;
      this._cleanse(t, ev);
      this._applyStatusRaw(t, 'atkUp', 3);
      this._applyStatusRaw(t, 'spdUp', 3);
      t.energy = Math.min(100, t.energy + 50);
      ev.push({ t: 'phase', u: t.uid, phase: t.phase });
      ev.push({ t: 'status', u: t.uid, status: 'atkUp', turns: 3 });
    }));
    if (M.shieldPhases) M.shieldPhases.forEach((thr, i) => once(`shield${i}`, thr, () => {
      this._addShield(t, t.maxHp * 0.22, 3);
      ev.push({ t: 'phase', u: t.uid, phase: ++t.phase, shield: true });
      ev.push({ t: 'shield', u: t.uid, amount: Math.round(t.maxHp * 0.22) });
    }));
  }

  _summon(boss, ev) {
    const M = boss.mechanics.summon;
    const taken = new Set(this.alive(boss.side).map((u) => u.slot));
    let made = 0;
    for (const slot of [0, 2, 1, 3]) {
      if (made >= M.count) break;
      if (taken.has(slot)) continue;
      const mon = { sp: M.species, lvl: Math.max(1, boss.lvl - 4), rank: 0 };
      const nu = makeUnit(mon, boss.side, slot, { summoned: true });
      nu.meter = 400;
      this.units.push(nu);
      taken.add(slot);
      made++;
      ev.push({ t: 'summon', u: nu.uid, by: boss.uid });
    }
  }

  _checkEnd(ev) {
    if (this.result) return;
    if (!this.alive(1).length) {
      this.result = 'win';
      ev.push({ t: 'end', result: 'win' });
    } else if (!this.alive(0).length) {
      this.result = 'lose';
      ev.push({ t: 'end', result: 'lose' });
    }
  }

  starsEarned() {
    const lost = this.units.filter((u) => u.side === 0 && !u.alive).length;
    return lost === 0 ? 3 : lost === 1 ? 2 : 1;
  }

  // ---------------- AI
  choose(u) {
    const opts = this.abilityOptions(u).filter((o) => o.ready);
    const foes = this.alive(1 - u.side);
    const friends = this.alive(u.side);
    const bestFoe = (ab) => {
      const valid = this.targetsFor(u, ab);
      let best = null, bs = -Infinity;
      for (const f of valid) {
        const eff = effectiveness(ab.el === 'neutral' ? null : ab.el, f.elements);
        const score = eff * 2 + (1 - f.hp / f.maxHp) * 1.5 + (f.hp < this.stat(u, 'atk') * ab.power ? 2 : 0) + this.rand() * 0.3;
        if (score > bs) {
          bs = score;
          best = f;
        }
      }
      return best;
    };
    const lowAlly = friends.slice().sort((a, b) => a.hp / a.maxHp - b.hp / b.maxHp)[0];
    let pick = null, pickScore = -Infinity, target = null;
    for (const o of opts) {
      const ab = o.ab;
      let score = 0;
      let tgt = null;
      if (ab.kind === 'ult') score += 100;
      if (ab.power > 0) {
        if (ab.target === 'enemy') {
          tgt = bestFoe(ab);
          if (!tgt) continue;
          score += ab.power * 10 * effectiveness(ab.el === 'neutral' ? null : ab.el, tgt.elements);
        } else {
          const n = ab.target === 'random' ? Math.min(ab.hits, foes.length * 2) : foes.length;
          score += ab.power * 10 * Math.max(1, n * 0.8);
        }
      }
      if (ab.heal || ab.healAllies) {
        const need = 1 - (lowAlly ? lowAlly.hp / lowAlly.maxHp : 1);
        score += need > 0.35 ? 25 + need * 30 : -20;
        if (ab.target === 'ally') tgt = lowAlly;
      }
      if (ab.shield) {
        const hasShield = (ab.target === 'self' ? u : lowAlly || u).statuses.some((s) => s.id === 'shield');
        score += hasShield ? -10 : 12 + (1 - u.hp / u.maxHp) * 20;
        if (ab.target === 'ally') tgt = lowAlly;
      }
      if (!ab.power && ab.effects && ab.effects.length && !ab.heal && !ab.shield) {
        const s0 = ab.effects[0];
        const recip = s0.on === 'self' ? u : null;
        const already = recip && recip.statuses.some((s) => s.id === s0.s);
        score += already ? -15 : 14;
        if (ab.target === 'ally') tgt = friends.find((f) => f !== u) || u;
      }
      if (ab.kind === 'basic') score -= 2;
      score += this.rand() * 3;
      if (score > pickScore) {
        pickScore = score;
        pick = ab;
        target = tgt;
      }
    }
    if (!pick) pick = u.abilities[0];
    if (!target && pick.target === 'enemy') target = bestFoe(pick);
    return { ability: pick.id, target: target ? target.uid : null };
  }
}
