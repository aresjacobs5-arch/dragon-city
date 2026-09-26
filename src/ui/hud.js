import { G } from '../game/G.js';
import { UI } from './ui.js';
import { h, icon, fmt, fmtTime, bar, setBar, ringSvg } from './dom.js';
import { xpProgress, isUnlocked } from '../systems/player.js';
import { goldCap, foodCap, maxEnergy, refreshEnergy, nextEnergyIn } from '../systems/resources.js';
import { currentMain, claimMain, claimableCount } from '../systems/quests.js';
import { loginStatus, wheelStatus } from '../systems/rewards.js';
import { eventClaimable } from '../systems/events.js';
import { breedingState } from '../systems/breeding.js';
import { featureLevel } from '../data/unlocks.js';

// Heads-up display. Keeps the island visible: slim top bar, a small right
// column of round buttons, a single "next goal" card and the bottom nav.
export const HUD = {
  shown: {},
  init(actions) {
    this.actions = actions;
    const root = UI.layers.hud;
    // level badge
    this.lvl = h('div.lvl-badge.pe', { onclick: () => actions.profile() });
    this.lvlRing = h('div', { html: ringSvg(0) });
    this.lvlNum = h('div.core.display.ol', null, '1');
    this.lvl.append(this.lvlRing, this.lvlNum, h('div.star', null, icon('xp')));
    // resources
    this.pills = {};
    const pill = (key, iconName, opts = {}) => {
      const el = h(`div.res-pill.pe${opts.noPlus ? '.no-plus' : ''}`, { onclick: () => actions.resource(key) }, icon(iconName), h('span.val', null, '0'));
      if (opts.cap) el.appendChild(h('div.cap', null, h('i')));
      if (opts.sub) el.appendChild(h('div.sub'));
      if (!opts.noPlus) el.appendChild(h('button.plus', { onclick: (e) => { e.stopPropagation(); actions.resource(key, true); } }, icon('plus')));
      this.pills[key] = el;
      this.shown[key] = G.state.res[key] || 0;
      return el;
    };
    const res = h('div.hud-res', null, pill('energy', 'energy', { sub: true, noPlus: true }), pill('gold', 'gold', { cap: true }), pill('food', 'food', { cap: true }), pill('gems', 'gems'));
    const settings = h('button.icon-btn.pe', { onclick: () => actions.settings(), 'aria-label': 'Settings' }, icon('settings'));
    root.appendChild(h('div.hud-top', null, this.lvl, res, h('div.spacer'), settings));

    // side column
    this.side = {};
    const sideBtn = (key, iconName, label, fn) => {
      const b = h('button.icon-btn.pe', { onclick: fn }, icon(iconName), h('span.lbl.ol-s', null, label));
      this.side[key] = b;
      return b;
    };
    this.sideCol = h('div.side-col', null,
      sideBtn('events', 'events', 'Event', () => actions.events()),
      sideBtn('daily', 'daily', 'Daily', () => actions.daily()),
      sideBtn('wheel', 'wheel', 'Spin', () => actions.wheel()),
      sideBtn('chests', 'chest', 'Chests', () => actions.chests()),
      sideBtn('dex', 'dex', 'Dex', () => actions.dex()));
    root.appendChild(this.sideCol);

    // quest tracker
    this.qt = h('div.quest-tracker.pe', { onclick: () => this._questClick() }, icon('quests', 'qi'), h('div.qhead', null, 'Next goal'), h('div.qtext'), bar(0));
    root.appendChild(this.qt);

    // bottom nav
    this.nav = {};
    const navBtn = (key, iconName, label, fn, cls = '') => {
      const b = h(`button.nav-btn.pe${cls}`, { onclick: fn }, icon(iconName), h('span.lbl.ol-s', null, label));
      this.nav[key] = b;
      return b;
    };
    root.appendChild(h('div.hud-bottom', null,
      navBtn('island', 'island', 'ISLAND', () => actions.island()),
      navBtn('monsters', 'monsters', 'MONSTERS', () => actions.monsters()),
      navBtn('battle', 'battle', 'BATTLE', () => actions.battle(), '.battle'),
      navBtn('breed', 'breed', 'BREED', () => actions.breed()),
      navBtn('shop', 'shop', 'SHOP', () => actions.shop())));

    G.bus.on('res:changed', ({ key, source }) => {
      if (key === 'gold' || key === 'food') this._cap();
    });
    G.bus.on('player:xp', () => this._level());
    G.bus.on('player:levelup', () => this._level());
    this._level();
    this._cap();
    this.refresh();
    this._t = 0;
  },

  // Delay the counter update while flying icons travel to it.
  hold(key, ms = 700) {
    UI.hudHold[key] = performance.now() + ms;
  },

  pill(key) {
    return this.pills[key];
  },

  bump(key) {
    const el = this.pills[key];
    if (!el) return;
    el.classList.remove('bump');
    void el.offsetWidth;
    el.classList.add('bump');
  },

  _level() {
    const p = G.state.player;
    this.lvlNum.textContent = p.level;
    const k = xpProgress().k;
    this.lvlRing.innerHTML = ringSvg(k, '#ffd84a');
  },

  _cap() {
    const g = this.pills.gold, f = this.pills.food;
    const gk = G.state.res.gold / goldCap(), fk = G.state.res.food / foodCap();
    g.querySelector('.cap i').style.setProperty('--k', `${Math.min(1, gk) * 100}%`);
    f.querySelector('.cap i').style.setProperty('--k', `${Math.min(1, fk) * 100}%`);
    g.classList.toggle('full', gk >= 0.999);
    f.classList.toggle('full', fk >= 0.999);
  },

  _questClick() {
    const q = currentMain();
    if (q && q.done) {
      const items = claimMain();
      if (items) this.actions.rewardFly(items, this.qt);
      this.refresh();
    } else this.actions.quests();
  },

  refresh() {
    // quest tracker
    const q = currentMain();
    if (q) {
      this.qt.classList.remove('hidden');
      this.qt.querySelector('.qtext').textContent = q.text;
      setBar(this.qt.querySelector('.bar'), q.value / q.goal.n);
      this.qt.classList.toggle('done', q.done);
      this.qt.querySelector('.qhead').textContent = q.done ? 'Complete! Tap to claim' : 'Next goal';
    } else this.qt.classList.add('hidden');
    const lv = G.state.player.level;
    // side buttons visibility + badges
    const setBadge = (el, n, dot = false) => {
      let b = el.querySelector('.badge');
      if (!n) {
        if (b) b.remove();
        return;
      }
      if (!b) {
        b = h(`div.badge${dot ? '.dot' : ''}`);
        el.appendChild(b);
      }
      if (!dot) b.textContent = n;
    };
    this.side.events.classList.toggle('hidden', lv < featureLevel('events'));
    setBadge(this.side.events, eventClaimable());
    const ls = loginStatus();
    this.side.daily.classList.toggle('hidden', lv < 2 && !G.state.tutorial.done);
    setBadge(this.side.daily, ls.claimedToday ? 0 : 1, true);
    this.side.wheel.classList.toggle('hidden', !isUnlocked('spin_wheel'));
    setBadge(this.side.wheel, wheelStatus().free ? 1 : 0, true);
    const chests = Object.values(G.state.inventory.chests).reduce((s, n) => s + n, 0);
    this.side.chests.classList.toggle('hidden', !chests);
    setBadge(this.side.chests, chests);
    this.side.dex.classList.toggle('hidden', G.state.monsters.length < 2 && !G.state.tutorial.done);
    // nav
    const breedLocked = lv < featureLevel('breeding');
    this.nav.breed.classList.toggle('locked', breedLocked);
    this.nav.breed.dataset.lock = `Lv ${featureLevel('breeding')}`;
    const br = breedingState();
    setBadge(this.nav.breed, br && br.done ? 1 : 0, true);
    const cq = claimableCount() - (q && q.done ? 1 : 0);
    setBadge(this.qt, cq > 0 ? cq : 0);
  },

  update(dt) {
    const now = performance.now();
    for (const key of Object.keys(this.pills)) {
      const target = G.state.res[key] || 0;
      if (UI.hudHold[key] && now < UI.hudHold[key]) continue;
      let cur = this.shown[key];
      if (cur !== target) {
        const diff = target - cur;
        const step = Math.sign(diff) * Math.max(1, Math.abs(diff) * Math.min(1, dt * 7));
        cur = Math.abs(step) >= Math.abs(diff) ? target : cur + step;
        this.shown[key] = cur;
      }
      const el = this.pills[key].querySelector('.val');
      const txt = key === 'energy' ? `${Math.floor(cur)}/${maxEnergy()}` : fmt(cur);
      if (el.textContent !== txt) el.textContent = txt;
    }
    this._t -= dt;
    if (this._t <= 0) {
      this._t = 0.5;
      refreshEnergy();
      const sub = this.pills.energy.querySelector('.sub');
      const nx = nextEnergyIn();
      sub.textContent = nx > 0 ? `+1 in ${fmtTime(nx)}` : '';
      this.refresh();
    }
  },
};
