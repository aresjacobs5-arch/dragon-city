import * as THREE from 'three';
import { G } from './G.js';
import { UI } from '../ui/ui.js';
import { h, icon, fmt, fmtTime, bar, setBar } from '../ui/dom.js';
import { cloudTransition } from '../ui/transition.js';
import { Audio } from '../core/audio.js';
import { SDK } from '../core/sdk.js';
import { RNG } from '../core/rng.js';
import { MapWorld } from '../render/map/mapWorld.js';
import { Arena } from '../render/battle/arena.js';
import { stageForLevel } from '../render/monsters/builder.js';
import { Battle } from '../systems/battle.js';
import * as CP from '../systems/campaign.js';
import { WORLDS, STAGES_PER_WORLD, getStage, STAR_CHESTS } from '../data/campaign.js';
import { ELEMENTS, effectiveness, weaknessesOf } from '../data/elements.js';
import { RARITIES, rarityIdx } from '../data/rarities.js';
import { STATUSES } from '../data/statuses.js';
import { ABILITIES, describeAbility } from '../data/abilities.js';
import { MONSTERS } from '../data/monsters.js';
import { species, power, stageOf, monsterName, sortMonsters, markSeen, byId } from '../systems/monsters.js';
import { refreshEnergy, maxEnergy, nextEnergyIn, ENERGY_REGEN_SEC } from '../systems/resources.js';
import { isUnlocked } from '../systems/player.js';
import { stat } from '../systems/stats.js';
import { grant } from '../systems/rewards.js';
import { addEventPoints } from '../systems/events.js';
import { featureLevel } from '../data/unlocks.js';
import { showRewards, rewardItemEl } from '../ui/screens/rewards.js';

// Campaign map, team selection, turn-based battles and results.

const statusNames = Object.fromEntries(Object.entries(STATUSES).map(([k, v]) => [k, v.name]));
const TYPE_LABEL = { battle: 'Battle', elite: 'Elite Battle', challenge: 'Challenge', boss: 'Boss Battle', treasure: 'Treasure', mystery: 'Mystery' };
const TYPE_ICON = { elite: 'skull', challenge: 'target', boss: 'crown', treasure: 'chest', mystery: 'question' };
const TYPE_RIBBON = { battle: 'blue', elite: 'purple', challenge: 'orange', boss: 'red', treasure: 'gold', mystery: 'purple' };

function abIcon(ab) {
  if (ab.kind === 'ult') return 'star';
  if (ab.fx === 'heal') return 'heart';
  if (ab.fx === 'shield') return 'shield';
  if (ab.fx === 'buff') return 'up';
  return ab.el && ab.el !== 'neutral' ? `el_${ab.el}` : 'sword';
}

function sessionSeconds() {
  return (performance.now() - (G._sessionStart || 0)) / 1000;
}

export const Campaign = {
  game: null,
  A: null,
  map: null,
  arena: null,
  world: 1,
  layer: null,
  labels: [],
  bs: null,

  init(game) {
    this.game = game;
    this.A = game.actions;
    G._sessionStart = performance.now();
    this.layer = h('div#modehud');
    UI.root.insertBefore(this.layer, UI.layers.screens);
    // battle taps on the canvas (target selection)
    const canvas = G.engine.canvas;
    let down = null;
    canvas.addEventListener('pointerdown', (e) => (down = { x: e.clientX, y: e.clientY, t: performance.now() }));
    canvas.addEventListener('pointerup', (e) => {
      if (!down || G.mode !== 'battle') return;
      const moved = Math.hypot(e.clientX - down.x, e.clientY - down.y);
      if (moved < 12 && performance.now() - down.t < 700) this._battleTap(e.clientX, e.clientY);
      down = null;
    });
  },

  // ======================================================================
  // MODE SWITCHING
  // ======================================================================
  _clearLayer() {
    this.layer.innerHTML = '';
    this.labels = [];
    this.mapHud = null;
    this.bhud = null;
  },

  _setMode(mode) {
    G.mode = mode;
    if (G.world) G.world.camCtl.enabled = mode === 'island';
    if (this.map) this.map.camCtl.enabled = mode === 'map';
    UI.layers.markers.style.visibility = mode === 'island' ? '' : 'hidden';
    UI._sync();
    G.bus.emit('mode:changed', { mode });
  },

  async exitToIsland() {
    if (this._transit) return;
    this._transit = true;
    await cloudTransition(() => {
      UI.closeAll();
      this._clearLayer();
      if (this.arena) this.arena.clearUnits();
      this._setMode('island');
      G.engine.setWorld(G.world);
      G.engine.dimTarget = 0;
    }, { sound: () => Audio.play('whoosh') });
    this._transit = false;
    Audio.playMusic('island');
    this._maybeMidgame();
  },

  _maybeMidgame() {
    // Natural break only: after leaving a battle/map, never mid-animation.
    if (SDK.canMidgame(sessionSeconds(), G.state.tutorial.done)) {
      setTimeout(() => {
        if (!this.game.busy && !UI.stack.some((s) => ['reveal', 'levelup', 'rewards'].includes(s.key))) SDK.midgame();
      }, 400);
    }
  },

  // ======================================================================
  // MAP
  // ======================================================================
  async openMap(w = null) {
    if (this._transit) return;
    const f = CP.frontier();
    let world = w || G.state.campaign.world || f.w;
    if (!CP.worldUnlocked(world)) world = f.w;
    this._transit = true;
    if (!this.map) this.map = new MapWorld(G.engine);
    const wasMap = G.mode === 'map';
    const swap = () => {
      UI.closeAll();
      this._clearLayer();
      if (this.arena) this.arena.clearUnits();
      this._showWorld(world);
      G.engine.setWorld(this.map);
      this._setMode('map');
      this._buildMapHud();
    };
    if (wasMap) swap();
    else await cloudTransition(swap, { sound: () => Audio.play('whoosh') });
    this._transit = false;
    Audio.playMusic('map');
    G.bus.emit('map:opened', { world });
  },

  _showWorld(w) {
    this.world = w;
    G.state.campaign.world = w;
    const def = WORLDS[w - 1];
    this.map.showWorld({ ...def, bossDef: species(def.boss) });
    this._refreshMap();
    const f = CP.frontier();
    const focus = f.w === w ? f.s : f.w > w ? 30 : 1;
    const start = this._avatarFrom && this._avatarFrom.w === w ? this._avatarFrom.s : focus;
    this._avatarFrom = null;
    // lead monster walks the map with you
    const lead = this._teamMonsters()[0] || sortMonsters([...G.state.monsters], 'power')[0];
    this.map.avatarNode = start;
    this.map.setAvatar(lead ? species(lead.sp) : null, lead ? stageOf(lead) : 0);
    this.map.setRing(f.w === w && start === f.s ? f.s : 0);
    this.map.focusNode(start, { instant: true });
    this.map.camCtl.onTap = (x, y) => {
      const s = this.map.pickNode(x, y);
      if (s) this.openStage(this.world, s);
    };
  },

  _nodeInfo() {
    const w = this.world;
    const info = {};
    for (let s = 1; s <= STAGES_PER_WORLD; s++) {
      const st = getStage(w, s);
      const cleared = CP.isCleared(st.id);
      const open = CP.stageUnlocked(w, s);
      info[s] = { type: st.type, state: cleared ? 'cleared' : open ? 'current' : 'locked', stars: CP.stars(st.id) };
    }
    return info;
  },

  _refreshMap() {
    const info = this._nodeInfo();
    this.map.refreshNodes(info);
    this._nodeInfoCache = info;
    if (this.mapHud) this._updateMapHud();
  },

  _buildMapHud() {
    const w = this.world;
    const def = WORLDS[w - 1];
    const root = h('div.map-hud');
    const title = h('div.title', null, h('div.ribbon.ol', { style: { '--rb': def.color } }, `${w}. ${def.name}`));
    const stars = h('div.stars', null, icon('star'), h('span.v'));
    const back = h('button.btn.blue.back', { onclick: () => this.A.island() }, icon('home'), 'Island');
    const energy = h('div.res-pill.no-plus.energy.pe', { onclick: () => UI.toast(`Energy refills over time (max ${maxEnergy()}) and when you level up.`, { icon: 'energy' }) }, icon('energy'), h('span.val'), h('div.sub'));
    const prevW = w > 1;
    const nextW = w < WORLDS.length;
    const nextOpen = nextW && CP.worldUnlocked(w + 1);
    const navL = prevW ? h('button.btn.round.gold.wnav.l', { onclick: () => this._switchWorld(w - 1), 'aria-label': 'Previous world' }, icon('arrowL')) : null;
    const navR = nextW ? h(`button.btn.round.wnav.r${nextOpen ? '.gold' : '.disabled'}`, { onclick: () => (nextOpen ? this._switchWorld(w + 1) : UI.toast(`Defeat the ${species(def.boss).name} to unlock the next world`, { icon: 'lock' })), 'aria-label': 'Next world' }, icon(nextOpen ? 'arrowR' : 'lock')) : null;
    // star chest track
    const track = h('div.star-track.pe');
    const trackBar = bar(0, '#ffd84a');
    track.appendChild(trackBar);
    const chestEls = STAR_CHESTS.map((sc) => {
      const c = h('div.sc', { style: { left: `${(sc.stars / 90) * 100}%` } }, icon(`chest_${sc.chest}`), h('span.ol-s', null, `${sc.stars}`));
      track.appendChild(c);
      return { sc, c };
    });
    const extra = h('div.map-extra');
    if (isUnlocked('challenge_tower')) extra.appendChild(h('button.icon-btn.pe', { onclick: () => this.openTower() }, icon('tower'), h('span.lbl.ol-s', null, 'Tower')));
    root.append(...[title, stars, back, energy, navL, navR, track, extra].filter(Boolean));
    this.layer.appendChild(root);
    this.labelLayer = h('div.node-layer');
    this.layer.insertBefore(this.labelLayer, root);
    this.mapHud = { root, stars, energy, trackBar, chestEls };
    this._buildLabels();
    this._updateMapHud();
  },

  _buildLabels() {
    this.labelLayer.innerHTML = '';
    this.labels = [];
    const info = this._nodeInfoCache || this._nodeInfo();
    for (let s = 1; s <= STAGES_PER_WORLD; s++) {
      const it = info[s];
      const el = h('div.node-lbl', { onclick: () => this.openStage(this.world, s) });
      if (TYPE_ICON[it.type] && it.state !== 'cleared') el.appendChild(h('div.kind', null, icon(TYPE_ICON[it.type])));
      el.appendChild(h(`div.num${it.state === 'current' ? '.cur' : it.state === 'locked' ? '.locked' : ''}`, null, it.type === 'boss' ? 'BOSS' : `${this.world}-${s}`));
      if (it.state === 'cleared' && (it.type === 'battle' || it.type === 'elite' || it.type === 'challenge' || it.type === 'boss')) {
        el.appendChild(h('div.st', null, [0, 1, 2].map((i) => icon(i < it.stars ? 'star' : 'starEmpty'))));
      }
      this.labelLayer.appendChild(el);
      this.labels.push({ s, el, pos: new THREE.Vector3() });
    }
  },

  _updateMapHud() {
    const H = this.mapHud;
    if (!H) return;
    const ws = CP.worldStars(this.world);
    H.stars.querySelector('.v').textContent = `${ws} / ${STAGES_PER_WORLD * 3}`;
    setBar(H.trackBar, ws / 90);
    const claimed = G.state.campaign.starChests[this.world] || [];
    for (const { sc, c } of H.chestEls) c.classList.toggle('got', claimed.includes(sc.stars));
    this._updateEnergy();
  },

  _updateEnergy() {
    const H = this.mapHud;
    if (!H) return;
    refreshEnergy();
    H.energy.querySelector('.val').textContent = `${Math.floor(G.state.res.energy)}/${maxEnergy()}`;
    const nx = nextEnergyIn();
    H.energy.querySelector('.sub').textContent = nx > 0 ? `+1 in ${fmtTime(nx)}` : '';
  },

  async _switchWorld(w) {
    if (this._transit) return;
    this._transit = true;
    await cloudTransition(() => {
      this._clearLayer();
      this._showWorld(w);
      this._buildMapHud();
    }, { sound: () => Audio.play('whoosh') });
    this._transit = false;
  },

  // ======================================================================
  // STAGE PANEL
  // ======================================================================
  openStage(w, s) {
    const stage = getStage(w, s);
    if (!CP.stageUnlocked(w, s)) {
      Audio.play('error');
      UI.toast('Clear the previous stages first!', { icon: 'lock' });
      return;
    }
    const cleared = CP.isCleared(stage.id);
    const fight = stage.enemies.length > 0;
    const content = [];
    const head = h('div.stage-head', null, h('span.chip', null, icon(TYPE_ICON[stage.type] || 'battle'), TYPE_LABEL[stage.type]), stage.rule ? h('span.chip.rule', null, icon('info'), stage.rule.label) : null, cleared ? h('span.chip.done', null, icon('check'), 'Cleared') : null);
    content.push(head);
    if (fight) {
      const row = h('div.enemy-row');
      const enemyEls = new Set();
      for (const e of stage.enemies) {
        const def = species(e.species);
        if (!def.boss) markSeen(e.species);
        row.appendChild(this._enemyCard(e.species, e.level, { elite: e.elite, boss: def.boss }));
        def.elements.forEach((x) => enemyEls.add(x));
      }
      content.push(row);
      const strong = new Set();
      for (const el of enemyEls) for (const s2 of weaknessesOf(el)) strong.add(s2);
      if (strong.size) content.push(h('div.hint-row', null, h('span', null, 'Strong picks:'), [...strong].slice(0, 5).map((e) => icon(`el_${e}`))));
    } else if (stage.type === 'treasure') {
      content.push(h('div.dlg-text', null, 'A treasure chest sits on this islet. Open it!'));
    } else {
      content.push(h('div.dlg-text', null, 'Something mysterious awaits here…'));
    }
    // rewards
    const rw = h('div.reward-row.small-rw');
    const mult = cleared ? 0.5 : 1;
    if (fight || stage.type === 'treasure') {
      rw.appendChild(rewardItemEl({ kind: 'gold', n: Math.round(stage.rewards.gold * (stage.type === 'treasure' && cleared ? 0.3 : mult)) }, this.A));
      if (fight) rw.appendChild(rewardItemEl({ kind: 'food', n: Math.round(stage.rewards.food * mult) }, this.A));
      rw.appendChild(rewardItemEl({ kind: 'xp', n: Math.round(stage.rewards.xp * (cleared ? 0.6 : 1)) }, this.A));
    }
    if (!cleared) {
      const f = stage.first;
      if (f.gems) rw.appendChild(this._firstTag(rewardItemEl({ kind: 'gems', n: f.gems }, this.A)));
      if (f.chest) rw.appendChild(this._firstTag(rewardItemEl({ kind: 'chest', id: f.chest }, this.A)));
      if (f.egg) {
        const it = h('div.rw-item', null, f.egg.species ? h('img', { alt: '' }) : icon('egg'), h('div.n', null, 'Egg'));
        if (f.egg.species) this.A.eggThumb(f.egg.species).then((u) => u && (it.querySelector('img').src = u));
        rw.appendChild(this._firstTag(it));
      }
      if (f.rune) rw.appendChild(this._firstTag(h('div.rw-item', null, icon('rune'), h('div.n', null, 'Rune'))));
      if (stage.type === 'mystery' && !fight) rw.appendChild(h('div.rw-item', null, icon('question'), h('div.n', null, '???')));
    }
    if (rw.children.length) content.push(h('div.sect-lbl', null, cleared ? 'Replay rewards' : 'Rewards'), rw);
    const scr = UI.panel({ key: 'stage', title: `Stage ${w}-${s}`, ribbon: TYPE_RIBBON[stage.type] || 'blue', kind: 'modal', hideHud: false, dim: 0.35, content });
    const actions = h('div.dlg-actions');
    if (fight) {
      const go = h('button.btn.lg.orange', { onclick: () => { UI.close(scr); this._prepareStage(stage); } }, icon('battle'), 'Battle', stage.energy ? h('span.cost', null, icon('energy'), `${stage.energy}`) : null);
      go.dataset.tut = 'stage-go';
      actions.appendChild(go);
    } else {
      const open = h('button.btn.lg.gold', { onclick: () => { UI.close(scr); this._openNode(stage); } }, icon(stage.type === 'treasure' ? 'chest' : 'question'), cleared ? 'Search' : 'Open');
      actions.appendChild(open);
    }
    scr.panel.appendChild(actions);
    UI.open(scr);
    Audio.play('pop');
  },

  _firstTag(el) {
    el.appendChild(h('div.first-tag', null, 'FIRST'));
    return el;
  },

  _enemyCard(sp, lvl, { elite = false, boss = false } = {}) {
    const def = species(sp);
    const R = RARITIES[def.rarity];
    const card = h('div.mcard.enemy', { style: { '--rc': boss ? '#e0443a' : R.color } });
    const img = h('img', { alt: def.name });
    img.style.opacity = '0';
    const ph = h('div.ph', null, icon('paw'));
    const art = h('div.art', null, ph, img, h('div.els', null, def.elements.map((e) => icon(`el_${e}`))), h('div.lv.ol-s', null, `Lv ${lvl}`));
    if (elite) art.appendChild(h('div.tag', null, 'ELITE'));
    if (boss) art.appendChild(h('div.tag', null, 'BOSS'));
    card.append(art, h('div.name', null, def.name), h('div.rbar'));
    this.A.portrait(sp, boss ? 0 : stageForLevel(lvl)).then((u) => {
      if (u) {
        img.src = u;
        img.style.opacity = '1';
        ph.remove();
      }
    });
    return card;
  },

  _openNode(stage) {
    if (stage.enemies.length) return this._prepareStage(stage);
    const first = !CP.isCleared(stage.id);
    const items = CP.resolveNode(stage);
    Audio.play('burst');
    showRewards(items, this.A, { title: stage.type === 'treasure' ? 'Treasure!' : 'Lucky Find!', onClose: () => this._afterMapProgress(first) });
    this._refreshMap();
    this._buildLabels();
  },

  async _afterMapProgress(advanced) {
    this._refreshMap();
    if (this.labelLayer) this._buildLabels();
    const f = CP.frontier();
    if (advanced && f.w === this.world && this.map.avatarNode !== f.s) {
      const from = this.map.avatarNode;
      this.map.setRing(0);
      await this.map.focusNode(f.s);
      await this.map.hopAvatar(from, f.s);
      this.map.setRing(f.s);
    } else if (advanced && f.w > this.world) {
      UI.toast(`${WORLDS[f.w - 1].name} unlocked!`, { icon: 'map', kind: 'good' });
      Audio.play('unlock');
      if (this.mapHud) {
        this._clearLayer();
        this._buildMapHud();
      }
    }
  },

  _prepareStage(stage) {
    refreshEnergy();
    if (G.state.res.energy < stage.energy) {
      Audio.play('error');
      UI.confirm({
        title: 'Out of energy',
        text: `This battle needs <b>${stage.energy}</b> energy. Energy refills by 1 every ${Math.round((ENERGY_REGEN_SEC / 60) * 10) / 10} minutes${this.A.adsReady() ? ', or watch a short video to refill 5 now.' : '.'}`,
        yes: this.A.adsReady() ? h('span', null, icon('film'), '+5') : 'OK',
        yesClass: this.A.adsReady() ? 'purple' : 'green',
        no: this.A.adsReady() ? 'Later' : null,
        onYes: () => {
          if (this.A.adsReady()) this.A.rewardedAd('energy', () => {
            G.state.res.energy += 5;
            G.markDirty();
            this._updateEnergy();
          });
        },
      });
      return;
    }
    const enemies = stage.enemies.map((e) => ({ sp: e.species, lvl: e.level, elite: !!e.elite, boss: !!species(e.species).boss }));
    this.openTeamSelect({
      title: `Stage ${stage.world}-${stage.stage}`,
      enemies,
      rule: stage.rule,
      onStart: (team) => this.startBattle({
        kind: 'campaign',
        stage,
        title: `Stage ${stage.world}-${stage.stage}`,
        theme: WORLDS[stage.world - 1].theme,
        enemies,
        rule: stage.rule,
        team,
        energy: stage.energy,
      }),
    });
  },

  // ======================================================================
  // TEAM SELECT
  // ======================================================================
  _teamMonsters() {
    return G.state.team.map((id) => byId(id)).filter(Boolean);
  },

  _autoTeam(enemies, size, rule) {
    const enemyEls = enemies.flatMap((e) => species(e.sp).elements);
    const score = (m) => {
      const def = species(m.sp);
      let k = 1;
      for (const el of def.elements) {
        const e = enemyEls.length ? enemyEls.reduce((s, x) => s + effectiveness(el, [x]), 0) / enemyEls.length : 1;
        k = Math.max(k, e);
      }
      return power(m) * (0.75 + k * 0.25);
    };
    let pool = [...G.state.monsters].sort((a, b) => score(b) - score(a));
    if (rule && rule.sameElement && pool.length) {
      // pick the element with the best combined score
      const byEl = {};
      for (const m of pool) for (const el of species(m.sp).elements) (byEl[el] = byEl[el] || []).push(m);
      let best = null, bs = -1;
      for (const [el, list] of Object.entries(byEl)) {
        const sc = list.slice(0, size).reduce((s, m) => s + score(m), 0);
        if (sc > bs) {
          bs = sc;
          best = el;
        }
      }
      pool = best ? byEl[best] : pool;
    }
    return pool.slice(0, size).map((m) => m.id);
  },

  openTeamSelect({ title, enemies, rule = null, onStart }) {
    const size = (rule && rule.maxTeam) || 3;
    if (!G.state.monsters.length) {
      UI.toast('Hatch a monster first!', { icon: 'egg' });
      return;
    }
    let team = this._teamMonsters().map((m) => m.id).slice(0, size);
    if (!team.length) team = this._autoTeam(enemies, size, rule);
    const enemyEls = [...new Set(enemies.flatMap((e) => species(e.sp).elements))];
    const slots = h('div.team-slots');
    const grid = h('div.mgrid.team-grid');
    const powerEl = h('div.team-power');
    const warn = h('div.team-warn.small');
    const enemyPower = enemies.reduce((s, e) => s + power({ sp: e.sp, lvl: e.lvl, rank: 0 }) * (e.elite ? 1.3 : 1), 0);
    const fightBtn = h('button.btn.lg.orange', { onclick: () => start() }, icon('battle'), 'Fight!');
    fightBtn.dataset.tut = 'team-fight';
    const matchTag = (m) => {
      const def = species(m.sp);
      const strong = def.elements.some((el) => enemyEls.some((x) => effectiveness(el, [x]) > 1.01));
      if (strong) return 'strong';
      const weak = enemyEls.some((x) => effectiveness(x, def.elements) > 1.01);
      return weak ? 'weak' : null;
    };
    const valid = () => {
      if (!team.length) return 'Pick at least one monster.';
      if (rule && rule.sameElement) {
        const sets = team.map((id) => species(byId(id).sp).elements);
        const common = sets.reduce((acc, s) => acc.filter((x) => s.includes(x)), sets[0]);
        if (!common.length) return 'All monsters must share an element.';
      }
      return null;
    };
    const render = () => {
      slots.innerHTML = '';
      for (let i = 0; i < size; i++) {
        const m = byId(team[i]);
        if (m) {
          const c = this.A.monsterCard(m, () => {
            team = team.filter((x) => x !== m.id);
            Audio.play('back');
            render();
          });
          c.classList.add('slotted');
          slots.appendChild(c);
        } else slots.appendChild(h('div.team-empty', null, icon('plus')));
      }
      grid.innerHTML = '';
      for (const m of sortMonsters([...G.state.monsters], 'power')) {
        const inTeam = team.includes(m.id);
        const tag = matchTag(m);
        const c = this.A.monsterCard(m, () => {
          if (inTeam) team = team.filter((x) => x !== m.id);
          else if (team.length < size) team.push(m.id);
          else {
            team[team.length - 1] = m.id;
          }
          Audio.play('tab');
          render();
        });
        if (inTeam) c.classList.add('sel');
        if (tag) c.querySelector('.art').appendChild(h(`div.match.${tag}`, null, tag === 'strong' ? 'STRONG' : 'WEAK'));
        grid.appendChild(c);
      }
      const tp = team.reduce((s, id) => s + power(byId(id)), 0);
      powerEl.innerHTML = '';
      const ratio = enemyPower ? tp / enemyPower : 1;
      powerEl.append(icon('atk'), h('b', null, fmt(tp)), h('span.muted', null, ' vs '), icon('skull'), h('b', null, fmt(enemyPower)));
      powerEl.className = `team-power ${ratio >= 1.1 ? 'good' : ratio >= 0.85 ? 'ok' : 'bad'}`;
      const v = valid();
      warn.textContent = v || (ratio < 0.8 ? 'This fight looks tough! Feed your monsters to level them up.' : '');
      fightBtn.classList.toggle('disabled', !!v);
    };
    const start = () => {
      const v = valid();
      if (v) {
        Audio.play('error');
        UI.toast(v, { icon: 'info', kind: 'bad' });
        return;
      }
      G.state.team = [...team];
      G.markDirty();
      UI.close(scr);
      onStart(team.map((id) => byId(id)));
    };
    const enemyRow = h('div.team-enemies', null, h('span.lbl', null, 'Enemies'), enemies.map((e) => {
      const def = species(e.sp);
      const img = h('img', { alt: def.name });
      this.A.portrait(e.sp, def.boss ? 0 : stageForLevel(e.lvl)).then((u) => u && (img.src = u));
      return h('div.foe', null, img, h('div.els', null, def.elements.map((x) => icon(`el_${x}`))), h('span.lv.ol-s', null, `${e.lvl}`));
    }));
    const autoBtn = h('button.btn.blue', { onclick: () => { team = this._autoTeam(enemies, size, rule); Audio.play('tab'); render(); } }, icon('sparkle'), 'Best');
    const scr = UI.panel({
      key: 'team',
      title: 'Choose Your Team',
      ribbon: 'orange',
      kind: 'page',
      dim: 0.5,
      hideHud: true,
      content: [
        h('div.team-top', null, enemyRow, rule ? h('span.chip.rule', null, icon('info'), rule.label) : null),
        h('div.team-row', null, slots, h('div.team-side', null, powerEl, warn, h('div.row', null, autoBtn, fightBtn))),
        h('div.scroll.grow', null, grid),
      ],
    });
    render();
    UI.open(scr);
  },

  // ======================================================================
  // BATTLE
  // ======================================================================
  // cfg: { kind, stage?, title, theme, enemies:[{sp,lvl,elite,boss}], rule, team:[monsters], energy, onWin?, onLose? }
  async startBattle(cfg) {
    if (this._transit || this.bs) return;
    if (cfg.energy) {
      refreshEnergy();
      if (G.state.res.energy < cfg.energy) {
        UI.toast('Not enough energy!', { icon: 'energy', kind: 'bad' });
        return;
      }
      G.state.res.energy -= cfg.energy;
      G.bus.emit('res:changed', { key: 'energy', delta: -cfg.energy, value: G.state.res.energy });
      G.markDirty();
    }
    this._transit = true;
    if (!this.arena) {
      this.arena = new Arena(G.engine);
      this.arena.onSfx = (n) => Audio.play(n);
    }
    const bossFight = cfg.enemies.some((e) => e.boss);
    const battle = new Battle({
      allies: cfg.team.map((m) => ({ ...m })),
      enemies: cfg.enemies.map((e, i) => ({ mon: { sp: e.sp, lvl: e.lvl, rank: e.rank || 0 }, slot: i, elite: e.elite })),
      rule: cfg.rule,
    });
    const bs = (this.bs = {
      cfg,
      battle,
      bossFight,
      quit: false,
      auto: !!G.state.settings.auto && isUnlocked('auto_battle'),
      speed: G.state.settings.bspeed || 1,
      frames: new Map(),
      shownHp: new Map(),
      pending: [],
      choice: null,
      returnTo: G.mode === 'map' ? 'map' : 'island',
    });
    if (bs.speed === 4 && !isUnlocked('battle_speed_4x')) bs.speed = 2;
    await cloudTransition(() => {
      UI.closeAll();
      this._clearLayer();
      this.arena.setup({
        theme: cfg.theme,
        bossFight,
        units: battle.units.map((u) => ({ uid: u.uid, def: u.def, lvl: u.lvl, side: u.side, slot: u.slot, boss: u.boss })),
      });
      this.arena.speed = bs.speed;
      G.engine.setWorld(this.arena);
      this._setMode('battle');
      this._buildBattleHud();
    }, { sound: () => Audio.play('whoosh') });
    this._transit = false;
    Audio.playMusic(bossFight ? 'boss' : 'battle');
    G.bus.emit('battle:start', { cfg });
    SDK.gameplayStart();
    await this._intro();
    await this._loop();
  },

  async _intro() {
    const bs = this.bs;
    const ar = this.arena;
    const boss = bs.battle.units.find((u) => u.boss);
    this._banner(bs.cfg.title, 'wave');
    if (boss) {
      await ar.wait(0.5);
      await ar.shot('ult', { uid: boss.uid, dur: 0.6 });
      Audio.play('roar', { pitch: 70 });
      ar.unit(boss.uid).view.animator.play('roar');
      ar.shake(0.6);
      this._banner(boss.name.toUpperCase(), 'boss');
      await ar.wait(1.4);
      await ar.shot('overview', { dur: 0.6 });
    } else {
      await ar.wait(0.9);
    }
    this._banner('FIGHT!', 'fight');
    Audio.play('swoosh');
    await ar.wait(0.6);
  },

  async _loop() {
    const bs = this.bs;
    const b = bs.battle;
    let guard = 0;
    while (!b.result && !bs.quit && guard++ < 999) {
      const u = b.nextActor();
      if (!u) break;
      this._setTurn(u);
      const { ev, skip } = b.beginTurn(u);
      await this._playEvents(ev.filter((e) => e.t !== 'turn'));
      if (b.result || bs.quit) break;
      if (skip || !u.alive) {
        await this.arena.wait(0.3);
        continue;
      }
      let choice;
      if (u.side === 0 && !bs.auto) {
        choice = await this._playerChoice(u);
        if (!choice) {
          if (bs.quit) break;
          choice = b.choose(u);
        }
      } else {
        await this.arena.wait(u.side === 1 ? 0.35 : 0.2);
        choice = b.choose(u);
      }
      if (bs.quit) break;
      const ab = ABILITIES[choice.ability] || u.abilities[0];
      const events = b.act(u, ab.id, choice.target);
      if (u.side === 0 && ab.kind === 'ult') stat('ult');
      await this._playAction(u, ab, events);
      this._refreshFrames();
      await this.arena.wait(0.18);
    }
    this._hideAbilityBar();
    this.arena.setActive(null);
    this.arena.setTargets([]);
    await this._finish(bs.quit ? 'lose' : b.result || 'lose');
  },

  _setTurn(u) {
    const bs = this.bs;
    this.arena.setActive(u.uid);
    for (const [uid, f] of bs.frames) f.el.classList.toggle('turn', uid === u.uid);
    this._renderOrder(u);
  },

  // ---------------------------------------------------------------- player input
  _playerChoice(u) {
    const bs = this.bs;
    return new Promise((resolve) => {
      bs.choice = { u, resolve, ab: null };
      const opts = bs.battle.abilityOptions(u);
      // default: ultimate if charged, else the strongest ready skill? Keep it predictable: basic attack
      const def = opts.find((o) => o.ab.kind === 'basic') || opts[0];
      this._showAbilityBar(u, opts);
      this._selectAbility(def.ab);
      if (!G.state.flags.battleHint) this._hint('Pick a skill, then tap an enemy!');
    });
  },

  _resolveChoice(ability, target) {
    const bs = this.bs;
    if (!bs || !bs.choice) return;
    const c = bs.choice;
    bs.choice = null;
    this._hideAbilityBar();
    this.arena.setTargets([]);
    this._clearBadges();
    this._hint(null);
    G.state.flags.battleHint = true;
    c.resolve(ability ? { ability, target } : null);
  },

  _selectAbility(ab) {
    const bs = this.bs;
    if (!bs.choice) return;
    const u = bs.choice.u;
    bs.choice.ab = ab;
    for (const b of this.bhud.abar.querySelectorAll('.abtn')) b.classList.toggle('sel', b.dataset.ab === ab.id);
    // targets
    const b = bs.battle;
    let targets;
    if (ab.target === 'enemy' || ab.target === 'ally') targets = b.targetsFor(u, ab);
    else if (ab.target === 'self') targets = [u];
    else if (ab.target === 'allies') targets = b.alive(u.side);
    else targets = b.alive(1 - u.side);
    this.arena.setTargets(targets.map((t) => t.uid), ab.target === 'ally' || ab.target === 'allies' || ab.target === 'self' ? '#5fd66a' : '#ff5a4a');
    this._clearBadges();
    const single = ab.target === 'enemy' || ab.target === 'ally';
    for (const t of targets) {
      let cls = 'neutral', txt = single ? 'TAP' : ab.target === 'self' ? 'SELF' : 'ALL';
      if (t.side !== u.side && ab.power > 0) {
        const eff = b.effLabel(u, ab, t);
        if (eff === 'strong') {
          cls = 'strong';
          txt = 'STRONG';
        } else if (eff === 'weak') {
          cls = 'weak';
          txt = 'WEAK';
        }
      }
      const badge = h(`div.tgt-badge.${cls}`, { onclick: () => this._confirmTarget(t.uid) }, txt);
      badge.dataset.uid = t.uid;
      this.bhud.badges.appendChild(badge);
    }
  },

  _confirmTarget(uid) {
    const bs = this.bs;
    if (!bs || !bs.choice || !bs.choice.ab) return;
    const ab = bs.choice.ab;
    const u = bs.choice.u;
    const valid = ab.target === 'enemy' || ab.target === 'ally' ? bs.battle.targetsFor(u, ab).map((t) => t.uid) : null;
    if (valid && !valid.includes(uid)) {
      Audio.play('error');
      return;
    }
    Audio.play('click');
    this._resolveChoice(ab.id, valid ? uid : null);
  },

  _battleTap(x, y) {
    const bs = this.bs;
    if (!bs || !bs.choice || !bs.choice.ab) return;
    const ab = bs.choice.ab;
    const u = bs.choice.u;
    let targets;
    if (ab.target === 'enemy' || ab.target === 'ally') targets = bs.battle.targetsFor(u, ab);
    else if (ab.target === 'self') targets = [u];
    else if (ab.target === 'allies') targets = bs.battle.alive(u.side);
    else targets = bs.battle.alive(1 - u.side);
    const ids = new Set(targets.map((t) => t.uid));
    const hit = this.arena.pickUnit(x, y, (r) => ids.has(r.uid));
    if (hit) this._confirmTarget(hit.uid);
  },

  // ---------------------------------------------------------------- HUD
  _buildBattleHud() {
    const bs = this.bs;
    const root = h('div.bhud');
    const quit = h('button.btn.round.red.quit', { onclick: () => this._askQuit(), 'aria-label': 'Leave battle' }, icon('close'));
    const order = h('div.order');
    const speedBtn = h('button.btn.sm.blue', { onclick: () => this._cycleSpeed() }, icon('speed'), h('span.v', null, `${bs.speed}x`));
    const autoBtn = h(`button.btn.sm${bs.auto ? '.gold.on' : '.blue'}`, { onclick: () => this._toggleAuto() }, icon(isUnlocked('auto_battle') ? 'auto' : 'lock'), 'Auto');
    const ctl = h('div.ctl', null, speedBtn, autoBtn);
    const frames = h('div.frames');
    const badges = h('div.badges');
    const nums = h('div.nums');
    const abar = h('div.abar.hidden');
    const hint = h('div.hint-bubble.hidden');
    const bossBar = h('div.boss-bar.hidden');
    root.append(frames, badges, nums, order, quit, ctl, bossBar, abar, hint);
    this.layer.appendChild(root);
    this.bhud = { root, order, speedBtn, autoBtn, frames, badges, nums, abar, hint, bossBar };
    for (const u of bs.battle.units) this._makeFrame(u);
  },

  _makeFrame(u) {
    const bs = this.bs;
    if (u.boss) {
      const bb = this.bhud.bossBar;
      bb.classList.remove('hidden');
      bb.innerHTML = '';
      const hp = bar(1, '#ff5a4a');
      hp.classList.add('hp');
      hp.appendChild(h('div.sh'));
      const el = h('div.unit-frame.boss', null, h('div.nm.ol-s', null, u.def.elements.map((e) => icon(`el_${e}`)), u.name, h('span.lvl', null, `Lv ${u.lvl}`)), hp, bar(0, '#c88aff'), h('div.sts'));
      el.querySelectorAll('.bar')[1].classList.add('en');
      bb.appendChild(el);
      bs.frames.set(u.uid, { el, u, hp, en: el.querySelectorAll('.bar')[1], sts: el.querySelector('.sts'), fixed: true });
      bs.shownHp.set(u.uid, u.hp);
      return;
    }
    const hp = bar(1, u.side === 0 ? '#62c63c' : '#ff5a4a');
    hp.classList.add('hp');
    hp.appendChild(h('div.sh'));
    const en = bar(0, '#c88aff');
    en.classList.add('en');
    const el = h(`div.unit-frame${u.side === 0 ? '.ally' : '.enemy'}`, null, h('div.nm.ol-s', null, u.def.elements.slice(0, 2).map((e) => icon(`el_${e}`)), h('span', null, u.name), h('span.lvl', null, `${u.lvl}`)), hp, en, h('div.sts'));
    if (u.elite) el.classList.add('elite');
    this.bhud.frames.appendChild(el);
    bs.frames.set(u.uid, { el, u, hp, en, sts: el.querySelector('.sts'), pos: new THREE.Vector3() });
    bs.shownHp.set(u.uid, u.hp);
    this._updateFrame(u.uid);
  },

  _updateFrame(uid, hpOverride = null) {
    const bs = this.bs;
    const f = bs.frames.get(uid);
    if (!f) return;
    const u = f.u;
    const hpv = hpOverride != null ? hpOverride : bs.shownHp.get(uid);
    setBar(f.hp, hpv / u.maxHp);
    const sh = u.statuses.find((s) => s.id === 'shield');
    f.hp.querySelector('.sh').style.setProperty('--s', `${sh ? Math.min(100, (sh.value / u.maxHp) * 100) : 0}%`);
    setBar(f.en, u.energy / 100);
    f.en.classList.toggle('full', u.energy >= 100);
    const key = u.statuses.map((s) => `${s.id}${s.stacks || ''}`).join(',');
    if (f.stsKey !== key) {
      f.stsKey = key;
      f.sts.innerHTML = '';
      for (const s of u.statuses.slice(0, 6)) {
        const ic = icon(`st_${s.id}`);
        if (s.stacks > 1) {
          const w = h('div.st-w', null, ic, h('span.ol-s', null, `${s.stacks}`));
          f.sts.appendChild(w);
        } else f.sts.appendChild(ic);
      }
    }
    f.el.classList.toggle('dead', !u.alive && hpv <= 0);
  },

  _refreshFrames() {
    for (const uid of this.bs.frames.keys()) this._updateFrame(uid);
  },

  _renderOrder(cur) {
    const bs = this.bs;
    const order = this.bhud.order;
    const list = [cur, ...bs.battle.predictOrder(5)].slice(0, 6);
    // build off-screen and swap once every portrait has decoded (no blank flicker)
    const token = (this._orderToken = (this._orderToken || 0) + 1);
    const els = list.map((u, i) => {
      const img = h('img', { alt: '' });
      const ready = this.A.portrait(u.sp, u.boss ? 0 : stageForLevel(u.lvl)).then((x) => {
        if (!x) return;
        img.src = x;
        return img.decode ? img.decode().catch(() => {}) : null;
      });
      return { el: h(`div.o.${u.side === 0 ? 'ally' : 'enemy'}${i === 0 ? '.first' : ''}`, null, img), ready };
    });
    Promise.all(els.map((e) => e.ready)).then(() => {
      if (token !== this._orderToken || !this.bhud || this.bhud.order !== order) return;
      order.replaceChildren(...els.map((e) => e.el));
    });
  },

  _showAbilityBar(u, opts) {
    const abar = this.bhud.abar;
    abar.innerHTML = '';
    abar.classList.remove('hidden');
    for (const o of opts) {
      const ab = o.ab;
      const isUlt = ab.kind === 'ult';
      const ready = o.ready;
      const btn = h(`button.abtn${isUlt ? '.ult' : ''}${isUlt && ready ? '.ready' : ''}${!ready ? '.cool' : ''}`, {
        onclick: () => {
          if (!ready) {
            Audio.play('error');
            UI.toast(isUlt ? 'Ultimate charges as your monster fights' : `Ready in ${o.cd} turn${o.cd > 1 ? 's' : ''}`, { icon: 'timer' });
            return;
          }
          const bs = this.bs;
          if (bs.choice && bs.choice.ab && bs.choice.ab.id === ab.id && !(ab.target === 'enemy' || ab.target === 'ally')) {
            this._resolveChoice(ab.id, null);
            return;
          }
          Audio.play('tab');
          this._selectAbility(ab);
        },
      }, icon(abIcon(ab)), h('div.n', null, ab.name), h('div.d', null, describeAbility(ab, statusNames)));
      btn.dataset.ab = ab.id;
      if (!ready && !isUlt) btn.appendChild(h('div.cdn', null, `${o.cd}`));
      if (isUlt) {
        const k = Math.min(1, u.energy / 100);
        btn.appendChild(h('div.en-ring', { html: `<svg viewBox="0 0 36 36"><circle cx="18" cy="18" r="15" fill="#2a1a2f"/><circle cx="18" cy="18" r="12" fill="none" stroke="#5a4a66" stroke-width="5"/><circle cx="18" cy="18" r="12" fill="none" stroke="${k >= 1 ? '#ffd84a' : '#c88aff'}" stroke-width="5" stroke-dasharray="${75.4 * k} 75.4" transform="rotate(-90 18 18)"/></svg>` }));
      }
      abar.appendChild(btn);
    }
  },

  _hideAbilityBar() {
    if (!this.bhud) return;
    this.bhud.abar.classList.add('hidden');
    this._clearBadges();
  },

  _clearBadges() {
    if (this.bhud) this.bhud.badges.innerHTML = '';
  },

  _hint(text) {
    if (!this.bhud) return;
    const el = this.bhud.hint;
    if (!text) return el.classList.add('hidden');
    el.textContent = text;
    el.classList.remove('hidden');
  },

  _cycleSpeed() {
    const bs = this.bs;
    const allow4 = isUnlocked('battle_speed_4x');
    const seq = allow4 ? [1, 2, 4] : [1, 2];
    const i = seq.indexOf(bs.speed);
    bs.speed = seq[(i + 1) % seq.length];
    if (!allow4 && bs.speed === 1 && i === 1 && !G.state.flags.speedTip) {
      G.state.flags.speedTip = true;
      UI.toast(`4x speed unlocks at level ${featureLevel('battle_speed_4x')}`, { icon: 'speed' });
    }
    this.arena.speed = bs.speed;
    G.state.settings.bspeed = bs.speed;
    G.markDirty();
    this.bhud.speedBtn.querySelector('.v').textContent = `${bs.speed}x`;
    Audio.play('tab');
  },

  _toggleAuto() {
    const bs = this.bs;
    if (!isUnlocked('auto_battle')) {
      Audio.play('error');
      UI.toast(`Auto battle unlocks at level ${featureLevel('auto_battle')}`, { icon: 'lock' });
      return;
    }
    bs.auto = !bs.auto;
    G.state.settings.auto = bs.auto;
    G.markDirty();
    const b = this.bhud.autoBtn;
    b.classList.toggle('gold', bs.auto);
    b.classList.toggle('on', bs.auto);
    b.classList.toggle('blue', !bs.auto);
    Audio.play('tab');
    if (bs.auto && bs.choice) {
      const u = bs.choice.u;
      const c = bs.battle.choose(u);
      this._resolveChoice(c.ability, c.target);
    }
  },

  _askQuit() {
    UI.confirm({
      title: 'Leave battle?',
      text: 'You will lose this battle and the energy spent on it.',
      yes: 'Leave',
      yesClass: 'red',
      no: 'Stay',
      onYes: () => {
        const bs = this.bs;
        if (!bs) return;
        bs.quit = true;
        if (bs.choice) this._resolveChoice(null, null);
      },
    });
  },

  _banner(text, kind = 'wave') {
    if (!this.bhud) return;
    if (kind === 'ult') {
      const b = h('div.ult-banner', null, h('div.inner', null, text));
      this.bhud.root.appendChild(b);
      setTimeout(() => b.remove(), 1200 / Math.max(1, this.bs ? this.bs.speed * 0.7 : 1));
      return;
    }
    const b = h('div.wave-banner', null, h(`div.big-title${kind === 'boss' ? '.boss' : kind === 'fight' ? '.gold' : ''}`, null, text));
    this.bhud.root.appendChild(b);
    setTimeout(() => {
      b.classList.add('out');
      setTimeout(() => b.remove(), 400);
    }, kind === 'boss' ? 1400 : 800);
  },

  // ---------------------------------------------------------------- floating numbers
  _num(uid, text, cls = '', tag = null) {
    if (!this.bhud) return;
    const f = this.bs.frames.get(uid);
    const p = this.arena.headPos(uid, new THREE.Vector3());
    const out = G.engine.project(p, this.arena.camera);
    const el = h(`div.dmg-num${cls ? '.' + cls.split(' ').join('.') : ''}`, null, tag ? h('span.tag', null, tag) : null, text);
    this.bhud.nums.appendChild(el);
    const jx = (Math.random() - 0.5) * 50;
    const y0 = out.y - (f && f.fixed ? 0 : UI.rem(2.5));
    const start = performance.now();
    const dur = 950 / Math.max(1, (this.bs ? this.bs.speed : 1) * 0.75);
    const step = (now) => {
      const k = (now - start) / dur;
      if (k >= 1 || !el.isConnected) {
        el.remove();
        return;
      }
      const e = 1 - Math.pow(1 - k, 3);
      const pop = k < 0.12 ? 0.5 + (k / 0.12) * 0.7 : k < 0.22 ? 1.2 - ((k - 0.12) / 0.1) * 0.2 : 1;
      el.style.transform = `translate(-50%, -50%) translate(${out.x + jx}px, ${y0 - e * 55}px) scale(${pop})`;
      el.style.opacity = k > 0.75 ? 1 - (k - 0.75) / 0.25 : 1;
      requestAnimationFrame(step);
    };
    requestAnimationFrame(step);
  },

  // ---------------------------------------------------------------- event playback
  async _playEvents(list) {
    for (const e of list) {
      this._showEvent(e);
      if (e.t === 'dot' || e.t === 'skip') await this.arena.wait(e.t === 'skip' ? 0.55 : 0.35);
      else if (e.t === 'heal' && !e.quiet) await this.arena.wait(0.25);
    }
    await this._flushPending();
  },

  async _flushPending() {
    const bs = this.bs;
    if (!bs || !bs.pending.length) return;
    const p = bs.pending;
    bs.pending = [];
    await Promise.all(p);
  },

  async _playAction(u, ab, events) {
    const bs = this.bs;
    const use = events.find((e) => e.t === 'use');
    const idxUse = use ? events.indexOf(use) : events.length;
    await this._playEvents(events.slice(0, idxUse));
    if (!use || !u.alive && !events.slice(idxUse).length) return;
    const rest = events.slice(idxUse + 1);
    const hitIdx = [];
    rest.forEach((e, i) => {
      if (e.t === 'hit' && e.src === u.uid) hitIdx.push(i);
    });
    const sequential = (ab.target === 'random' || (ab.hits || 1) > 1) && hitIdx.length > 1;
    const chunks = [];
    if (sequential) {
      for (let i = 0; i < hitIdx.length; i++) {
        const start = i === 0 ? 0 : hitIdx[i];
        const end = i + 1 < hitIdx.length ? hitIdx[i + 1] : rest.length;
        chunks.push(rest.slice(start, end));
      }
    } else chunks.push(rest);
    let flushed = 0;
    const flush = (i) => {
      for (let k = flushed; k <= i && k < chunks.length; k++) for (const e of chunks[k]) this._showEvent(e, ab);
      flushed = Math.max(flushed, i + 1);
    };
    this._hint(null);
    if (use.ult) {
      this._banner(ab.name.toUpperCase() + '!', 'ult');
      Audio.play('charge');
    }
    await this.arena.perform(u.uid, ab, use.targets, {
      impacts: chunks.length,
      onImpact: flush,
      ult: use.ult,
      sfx: (n) => Audio.play(n),
    });
    flush(chunks.length - 1);
    await this._flushPending();
  },

  _showEvent(e, ab = null) {
    const bs = this.bs;
    const ar = this.arena;
    const unit = bs.battle.get(e.u);
    switch (e.t) {
      case 'hit': {
        bs.shownHp.set(e.u, e.hp);
        this._updateFrame(e.u);
        const el = ab ? ab.el : 'neutral';
        ar.hitReact(e.u, { crit: e.crit, eff: e.eff, el });
        const cls = [e.crit ? 'crit' : '', e.eff || ''].filter(Boolean).join(' ');
        const tag = e.crit ? 'CRITICAL!' : e.eff === 'strong' ? 'STRONG!' : e.eff === 'weak' ? 'weak' : null;
        if (e.absorbed && e.amount - e.absorbed <= 0) this._num(e.u, `${fmt(e.absorbed)}`, 'shield', 'BLOCKED');
        else this._num(e.u, `${fmt(e.amount)}`, cls, tag);
        Audio.play(e.crit ? 'crit' : 'hit');
        break;
      }
      case 'dot': {
        bs.shownHp.set(e.u, e.hp);
        this._updateFrame(e.u);
        ar.dotReact(e.u, e.status);
        this._num(e.u, `${fmt(e.amount)}`, 'status-dmg', statusNames[e.status]);
        Audio.play(e.status === 'burn' ? 'fire' : 'debuff');
        break;
      }
      case 'heal': {
        bs.shownHp.set(e.u, e.hp);
        this._updateFrame(e.u);
        if (!e.quiet || e.amount > 0) this._num(e.u, `+${fmt(e.amount)}`, 'heal');
        if (!e.quiet) {
          ar.healFx(e.u);
          Audio.play('heal');
        }
        break;
      }
      case 'shield': {
        ar.setShield(e.u, true);
        this._num(e.u, `+${fmt(e.amount)}`, 'shield', 'SHIELD');
        this._updateFrame(e.u);
        Audio.play('shield');
        break;
      }
      case 'status': {
        const d = STATUSES[e.status];
        if (!d) break;
        ar.statusFx(e.u, e.status, d.kind);
        this._num(e.u, d.name, `status ${d.kind}`);
        this._updateFrame(e.u);
        Audio.play(d.kind === 'buff' ? 'buff' : 'debuff');
        break;
      }
      case 'resist':
        this._num(e.u, 'Resisted', 'status');
        break;
      case 'statusEnd':
        if (e.status === 'shield') {
          ar.setShield(e.u, false);
          if (e.broken) this._num(e.u, 'Shield broken!', 'status');
        }
        this._updateFrame(e.u);
        break;
      case 'cleanse':
        this._num(e.u, 'Cleansed', 'status heal');
        ar.aura(e.u, '#ffffff');
        this._updateFrame(e.u);
        break;
      case 'dispel':
        this._num(e.u, 'Buffs removed', 'status');
        this._updateFrame(e.u);
        break;
      case 'skip': {
        this._num(e.u, e.reason === 'freeze' ? 'Frozen!' : 'Stunned!', 'status');
        ar.statusFx(e.u, e.reason, 'debuff');
        break;
      }
      case 'die': {
        bs.shownHp.set(e.u, 0);
        this._updateFrame(e.u);
        const f = bs.frames.get(e.u);
        if (f) f.el.classList.add('dead');
        Audio.play('faint');
        bs.pending.push(ar.die(e.u));
        if (unit && unit.boss) ar.shake(0.8);
        break;
      }
      case 'ultReady':
        this._updateFrame(e.u);
        if (unit && unit.side === 0) {
          this._num(e.u, 'ULT READY', 'status ult');
          Audio.play('sparkle');
        }
        break;
      case 'summon': {
        const nu = bs.battle.get(e.u);
        if (!nu) break;
        ar.addUnit({ uid: nu.uid, def: nu.def, lvl: nu.lvl, side: nu.side, slot: nu.slot, boss: false }, { pop: true });
        this._makeFrame(nu);
        this._num(e.u, 'Summoned!', 'status');
        Audio.play('pop');
        break;
      }
      case 'phase': {
        const f = bs.frames.get(e.u);
        this._banner(e.shield ? 'BARRIER UP!' : `PHASE ${e.phase + 1}!`, 'boss');
        ar.shake(0.7);
        const uv = ar.unit(e.u);
        if (uv) {
          uv.view.animator.play('roar');
          uv.view.flash('#ff6a5a', 1);
        }
        Audio.play('roar', { pitch: 80 });
        if (f) this._updateFrame(e.u);
        break;
      }
      default:
        break;
    }
  },

  // ---------------------------------------------------------------- results
  async _finish(result) {
    const bs = this.bs;
    const cfg = bs.cfg;
    const ar = this.arena;
    const win = result === 'win';
    await this._flushPending();
    if (win) {
      ar.celebrate(0);
      Audio.jingle('victory');
      const lead = bs.battle.alive(0)[0];
      ar.shot('victory', { uid: lead ? lead.uid : null, dur: 1.0 });
    } else {
      Audio.jingle('defeat');
    }
    await ar.wait(win ? 1.1 : 0.7);
    let items = [];
    let stars = 0;
    let first = false;
    if (win) {
      stars = bs.quit ? 0 : bs.battle.starsEarned();
      if (cfg.kind === 'campaign') {
        const res = CP.completeStage(cfg.stage, stars);
        items = res.items;
        first = res.first;
      } else if (cfg.onWin) {
        items = cfg.onWin(stars) || [];
        stat('win');
      }
      G.bus.emit('battle:won', { cfg, stars });
    } else if (cfg.onLose) cfg.onLose();
    G.markDirty();
    this._showResults({ win, stars, items, first });
  },

  _showResults({ win, stars, items, first }) {
    const bs = this.bs;
    const cfg = bs.cfg;
    const scr = { key: 'results', dim: 0.55, hideHud: true, el: h('div.scr'), escClose: false };
    const box = h('div.celebrate.results');
    if (win) {
      box.appendChild(h('div.rays'));
      box.appendChild(h('div.big-title.gold', null, 'VICTORY!'));
      const st = h('div.result-stars');
      for (let i = 0; i < 3; i++) {
        const s = h(`div.rs${i < stars ? '.on' : ''}`, null, icon(i < stars ? 'star' : 'starEmpty'));
        s.style.animationDelay = `${0.35 + i * 0.22}s`;
        st.appendChild(s);
        if (i < stars) setTimeout(() => Audio.play('coin'), 350 + i * 220);
      }
      if (cfg.kind === 'campaign') box.appendChild(st);
      if (cfg.sub) box.appendChild(h('div.ol.display.result-sub', null, cfg.sub));
      const row = h('div.reward-row');
      items.forEach((it, i) => row.appendChild(rewardItemEl(it, this.A, 0.6 + i * 0.08)));
      if (items.length) box.appendChild(row);
      const acts = h('div.dlg-actions');
      const goldItem = items.find((i) => i.kind === 'gold');
      const foodItem = items.find((i) => i.kind === 'food');
      if ((goldItem || foodItem) && this.A.adsReady()) {
        const dbl = h('button.btn.purple', {
          onclick: () => {
            this.A.rewardedAd('battle_double', () => {
              const extra = {};
              if (goldItem) extra.gold = goldItem.n;
              if (foodItem) extra.food = foodItem.n;
              grant(extra, 'ad');
              dbl.remove();
              for (const el of row.querySelectorAll('.rw-item .n')) {
                if (el.textContent.startsWith('+')) el.classList.add('doubled');
              }
              UI.toast('Rewards doubled!', { icon: 'gift', kind: 'good' });
            });
          },
        }, icon('film'), 'x2 Rewards');
        acts.appendChild(dbl);
      }
      acts.appendChild(h('button.btn.lg.green', { onclick: () => this._leaveBattle(scr, { win, first }) }, 'Continue'));
      box.appendChild(acts);
    } else {
      box.appendChild(h('div.big-title.defeat', null, bs.quit ? 'RETREAT' : 'DEFEAT'));
      const tips = this._defeatTips();
      box.appendChild(h('div.panel.tips', null, h('div.tips-h.display', null, 'Tips to win'), tips.map((t) => h('div.tip', null, icon(t.icon), h('span', { html: t.text })))));
      const acts = h('div.dlg-actions');
      if (cfg.kind === 'campaign') acts.appendChild(h('button.btn.orange', { onclick: () => this._leaveBattle(scr, { retry: true }) }, icon('battle'), 'Retry'));
      acts.appendChild(h('button.btn.lg.blue', { onclick: () => this._leaveBattle(scr, {}) }, cfg.kind === 'campaign' ? 'Map' : 'Back'));
      box.appendChild(acts);
    }
    scr.el.appendChild(box);
    UI.open(scr);
  },

  _defeatTips() {
    const bs = this.bs;
    const tips = [];
    const enemyEls = [...new Set(bs.battle.units.filter((u) => u.side === 1).flatMap((u) => u.elements))];
    const strong = new Set();
    for (const el of enemyEls) for (const s of weaknessesOf(el)) strong.add(s);
    if (strong.size) tips.push({ icon: `el_${[...strong][0]}`, text: `Bring monsters strong against the enemy: <b>${[...strong].slice(0, 3).map((e) => ELEMENTS[e].name).join(', ')}</b>` });
    tips.push({ icon: 'food', text: 'Feed your monsters to raise their level and stats.' });
    if (G.state.player.level >= 3) tips.push({ icon: 'breed', text: 'Breed new monsters to build a stronger team.' });
    tips.push({ icon: 'star', text: 'Save ultimates for the toughest enemy.' });
    return tips.slice(0, 3);
  },

  async _leaveBattle(scr, { win = false, first = false, retry = false }) {
    const bs = this.bs;
    const cfg = bs.cfg;
    UI.close(scr);
    this.bs = null;
    if (cfg.kind === 'campaign') {
      if (win && first) this._avatarFrom = { w: cfg.stage.world, s: cfg.stage.stage };
      await this.openMap(cfg.stage.world);
      if (win) await this._afterMapProgress(first);
      if (retry) this._prepareStage(cfg.stage);
      else this._maybeMidgame();
    } else {
      await this.exitToIsland();
    }
  },

  // ======================================================================
  // EVENTS & TOWER
  // ======================================================================
  eventBattle(ev, tier) {
    let enemies = [];
    let rule = null;
    let theme = 'volcanic';
    if (ev.type === 'boss') {
      enemies = [{ sp: ev.boss, lvl: ev.tiers[tier], boss: true }];
    } else if (ev.type === 'element') {
      const rng = new RNG(`${ev.key}-${tier}`);
      const pool = MONSTERS.filter((m) => m.breedable && rarityIdx(m.rarity) <= Math.min(3, 1 + tier));
      for (let i = 0; i < 3; i++) {
        const m = rng.pick(pool);
        enemies.push({ sp: m.id, lvl: ev.tiers[tier] + rng.int(-1, 1), elite: i === 0 && tier >= 2 });
      }
      rule = { id: 'element', label: 'Single element team', sameElement: true };
      theme = 'verdant';
    } else return;
    const pts = ev.tierPoints[tier];
    this.openTeamSelect({
      title: ev.name,
      enemies,
      rule,
      onStart: (team) => this.startBattle({
        kind: 'event',
        title: `${ev.name} · Tier ${tier + 1}`,
        theme,
        enemies,
        rule,
        team,
        energy: 2,
        sub: `+${pts} ${ev.currency}`,
        onWin: () => {
          addEventPoints(pts, 'battle');
          return grant({ gold: 120 * (tier + 1) * (tier + 1) }, 'event');
        },
      }),
    });
  },

  towerFloor(floor) {
    const rng = new RNG(`tower-${floor}`);
    const lvl = Math.round(5 + floor * 1.45);
    const pool = MONSTERS.filter((m) => m.breedable && rarityIdx(m.rarity) <= Math.min(4, 1 + Math.floor(floor / 8)));
    const enemies = [];
    const n = floor < 3 ? 2 : 3;
    for (let i = 0; i < n; i++) {
      const m = rng.pick(pool);
      enemies.push({ sp: m.id, lvl: lvl + (floor % 5 === 0 && i === 0 ? 3 : rng.int(-1, 0)), elite: floor % 5 === 0 && i === 0 });
    }
    const reward = { gold: Math.round(180 * Math.pow(floor, 1.15)), food: Math.round(90 * Math.pow(floor, 1.1)) };
    if (floor % 5 === 0) reward.gems = 3 + Math.floor(floor / 5);
    if (floor % 10 === 0) reward.chest = floor >= 30 ? 'gold' : 'silver';
    return { floor, enemies, reward };
  },

  openTower() {
    if (!isUnlocked('challenge_tower')) return UI.toast(`The Challenge Tower opens at level ${featureLevel('challenge_tower')}`, { icon: 'lock' });
    const floor = G.state.tower.floor + 1;
    const F = this.towerFloor(floor);
    const row = h('div.enemy-row');
    for (const e of F.enemies) {
      markSeen(e.sp);
      row.appendChild(this._enemyCard(e.sp, e.lvl, { elite: e.elite }));
    }
    const rw = h('div.reward-row.small-rw');
    for (const [k, v] of Object.entries(F.reward)) rw.appendChild(k === 'chest' ? rewardItemEl({ kind: 'chest', id: v }, this.A) : rewardItemEl({ kind: k, n: v }, this.A));
    const floors = h('div.tower-floors');
    for (let f = floor + 3; f >= Math.max(1, floor - 2); f--) {
      floors.appendChild(h(`div.tf${f === floor ? '.cur' : f < floor ? '.done' : ''}`, null, f < floor ? icon('check') : f % 5 === 0 ? icon('skull') : null, `Floor ${f}`));
    }
    const scr = UI.panel({
      key: 'tower',
      title: 'Challenge Tower',
      ribbon: 'purple',
      kind: 'modal',
      cls: 'wide',
      dim: 0.5,
      content: [
        h('div.tower-wrap', null, floors, h('div.col.grow', null, h('div.sect-lbl', null, `Floor ${floor}${floor % 5 === 0 ? ' · Guardian' : ''}`), row, h('div.sect-lbl', null, 'Rewards'), rw)),
        h('div.dlg-actions', null, h('button.btn.lg.orange', {
          onclick: () => {
            UI.close(scr);
            this.openTeamSelect({
              title: `Floor ${floor}`,
              enemies: F.enemies,
              onStart: (team) => this.startBattle({
                kind: 'tower',
                title: `Tower · Floor ${floor}`,
                theme: 'arcane',
                enemies: F.enemies,
                team,
                energy: 0,
                onWin: () => {
                  G.state.tower.floor = Math.max(G.state.tower.floor, floor);
                  G.markDirty();
                  return grant(F.reward, 'tower');
                },
              }),
            });
          },
        }, icon('battle'), 'Climb')),
      ],
    });
    UI.open(scr);
  },

  // ======================================================================
  // FRAME
  // ======================================================================
  update(dt) {
    if (G.mode === 'map' && this.map && this.labels.length) {
      const cam = this.map.camera;
      const out = { x: 0, y: 0, visible: false };
      for (const L of this.labels) {
        this.map.nodePos(L.s, L.pos);
        L.pos.y += L.s === 30 ? 1.2 : 0.9;
        G.engine.project(L.pos, cam, out);
        if (!out.visible || out.y < -40 || out.y > G.engine.height + 40) {
          L.el.style.display = 'none';
          continue;
        }
        L.el.style.display = '';
        L.el.style.transform = `translate(${out.x.toFixed(1)}px, ${out.y.toFixed(1)}px) translate(-50%, -100%)`;
      }
      this._eT = (this._eT || 0) - dt;
      if (this._eT <= 0) {
        this._eT = 1;
        this._updateEnergy();
      }
    }
    if (G.mode === 'battle' && this.bs && this.arena) {
      const out = { x: 0, y: 0, visible: false };
      const v = new THREE.Vector3();
      for (const [uid, f] of this.bs.frames) {
        if (f.fixed) continue;
        this.arena.headPos(uid, v);
        G.engine.project(v, this.arena.camera, out);
        f.el.style.transform = `translate(${out.x.toFixed(1)}px, ${(out.y - 6).toFixed(1)}px) translate(-50%, -100%)`;
      }
      if (this.bhud && this.bhud.badges.children.length) {
        for (const b of this.bhud.badges.children) {
          const uid = Number(b.dataset.uid);
          const u = this.arena.unit(uid);
          if (!u) continue;
          this.arena.chestPos(uid, v);
          v.y = Math.max(0.3, v.y * 0.5);
          G.engine.project(v, this.arena.camera, out);
          b.style.left = `${out.x}px`;
          b.style.top = `${out.y + UI.rem(1.5)}px`;
        }
      }
    }
  },
};
