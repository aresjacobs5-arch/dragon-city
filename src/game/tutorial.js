import * as THREE from 'three';
import { G } from './G.js';
import { UI } from '../ui/ui.js';
import { HUD } from '../ui/hud.js';
import { Markers } from '../ui/markers.js';
import { h, icon } from '../ui/dom.js';
import * as Sheets from '../ui/screens/sheets.js';
import { buildingWorldPos } from '../render/world/homeView.js';
import { BUILDINGS } from '../data/buildings.js';
import { xpToNext } from '../data/unlocks.js';
import * as B from '../systems/buildings.js';
import { species } from '../systems/monsters.js';
import { getStat } from '../systems/stats.js';
import { eggReady } from '../systems/hatchery.js';
import { breedingState } from '../systems/breeding.js';
import { currentMain } from '../systems/quests.js';
import { addXP } from '../systems/player.js';
import { add } from '../systems/resources.js';
import { Campaign } from './campaignMode.js';

// First-session guide. Every step is a predicate on the game state, so the
// tutorial resumes correctly after a reload and never blocks free play: it
// simply points (hand + highlight + one short line) at the next useful thing.

const HAND = `<svg viewBox="0 0 64 64"><path d="M15 5c3.6-.6 6.6 2 6.6 5.6v15.2l2.6-.8c2.8-.8 5.6.6 6.4 3l.4 1c2.8-1.6 6.4-.4 7.6 2.4 2.8-1.2 6.4.6 7 3.8l1 6.4c1.4 8.8-4.4 16.4-13.2 17.4l-4 .4c-5.8.6-10.6-2-13.4-7l-7.6-12.6c-1.6-2.8-.8-5.8 1.8-7 2.2-1 4.8-.2 6 1.8l2.4 3.8V11.2c0-3 1.6-5.6 4.4-6.2z" fill="#fff" stroke="#2a1a2f" stroke-width="3.4" stroke-linejoin="round"/><path d="M24.2 30v9M31.8 31.6v8M39.4 34v6.4" fill="none" stroke="#2a1a2f" stroke-width="2.6" stroke-linecap="round"/><path d="M13.6 10.8c.4-2 1.8-3 3.4-3" fill="none" stroke="#d8e8ff" stroke-width="2.4" stroke-linecap="round"/></svg>`;

const SPOTS = { hab_fire: [2.6, -2.2], farm: [-3.4, 0.8], hab_nature: [3.2, 1.6], breeding: [-1.2, 4.2] };

const q = (sel) => {
  const el = document.querySelector(sel);
  if (!el) return null;
  const r = el.getBoundingClientRect();
  if (r.width < 2 || r.height < 2) return null;
  return el;
};
const built = (type) => G.state.buildings.some((b) => b.type === type && b.state !== 'building');
const exists = (type) => G.state.buildings.some((b) => b.type === type);
const firstOf = (type) => G.state.buildings.find((b) => b.type === type) || null;
const isOpen = (key) => UI.isOpen(key);
const topKey = () => (UI.top() ? UI.top().key : null);
const placing = (type) => G.world && G.world.placing && G.world.placing.type === type && !G.world.placing.buildingId;
const sheetKey = () => (Sheets.sheetOpen() ? Sheets.sheetOpen().key : null);
const worldAt = (b, y = 1.6) => ({ world: buildingWorldPos(b, new THREE.Vector3()).setY(y) });
const marker = (key) => {
  const m = Markers.items.get(key);
  return m && m.el.isConnected && m.el.style.display !== 'none' && m.el.style.transform ? m.el : null;
};

// Walks the player through buying + placing a building from the shop.
function buildFlow(type, tab, intro) {
  const name = BUILDINGS[type].name;
  if (placing(type)) return { el: q('[data-tut="place-ok"]'), text: 'Drag it where you like, then tap <b>✓</b> to build!' };
  if (isOpen('shop')) {
    const scr = UI.find('shop');
    if (scr.tab && scr.tab() !== tab) return { el: q(`[data-tut="tab-${tab}"]`), text: `Open the <b>${tab[0].toUpperCase() + tab.slice(1)}</b> tab.` };
    return { el: q(`[data-tut="buy-${type}"]`), text: `Buy the <b>${name}</b>.`, scroll: true };
  }
  if (UI.stack.length) return null;
  return { el: HUD.nav.shop, text: intro };
}

// Hatchery → egg → reveal → place.
function hatchFlow(intro) {
  if (G.mode === 'reveal') {
    const p = q('[data-tut="reveal-place"]');
    return p ? { el: p, text: 'Give it a home!' } : null;
  }
  if (isOpen('hatchery')) {
    const hb = q('[data-tut="hatch"]');
    if (hb) return { el: hb, text: 'Tap <b>HATCH!</b>' };
    const fin = q('[data-tut="egg-finish"]');
    if (fin) return { el: fin, text: 'Almost ready… tap to finish!' };
    return null;
  }
  if (UI.stack.length) return null;
  const hatchery = firstOf('hatchery');
  if (!hatchery) return null;
  const ready = G.state.hatchery.some((e) => eggReady(e));
  if (sheetKey() === `b:${hatchery.id}`) return { el: q('[data-tut="hatchery-open"]'), text: 'Open the Hatchery.' };
  const bub = marker(`h:${hatchery.id}`);
  if (ready && bub) return { el: bub, text: intro };
  return { ...worldAt(hatchery, 1.4), text: ready ? intro : 'Your egg is warming up in the <b>Hatchery</b>…' };
}

function mainIsland(fn) {
  if (G.mode === 'map') return { el: q('.map-hud .back'), text: 'Head back to your island.' };
  if (G.mode !== 'island') return null;
  return fn();
}

const STEPS = [
  {
    id: 'fire_hab',
    enter: () => ensureGold(BUILDINGS.hab_fire.cost.gold),
    done: () => exists('hab_fire'),
    guide: () => mainIsland(() => buildFlow('hab_fire', 'habitats', 'Welcome, Keeper! Your egg needs a home. Open the <b>Shop</b>.')),
  },
  {
    id: 'hatch1',
    done: () => G.state.monsters.length >= 1 && G.mode === 'island' && !Tutorial.game.busy,
    guide: () => {
      if (G.mode === 'reveal') return hatchFlow('');
      return mainIsland(() => {
        const hb = firstOf('hab_fire');
        if (hb && hb.state === 'building') return { ...worldAt(hb, 2.2), text: 'Building… just a moment!' };
        return hatchFlow('Your egg is ready! Tap the <b>Hatchery</b>.');
      });
    },
  },
  {
    id: 'collect',
    enter: () => {
      const hb = firstOf('hab_fire');
      if (hb) {
        B.snapshotHabitat(hb);
        hb.gold = Math.max(hb.gold, 60);
        G.markDirty();
      }
    },
    done: () => getStat('collect_times') >= 1,
    guide: () => mainIsland(() => {
      const hb = firstOf('hab_fire');
      if (!hb || UI.stack.length) return null;
      const bub = marker(`g:${hb.id}`);
      if (sheetKey() === `b:${hb.id}`) return { el: Sheets.sheetOpen().el.querySelector('.actions .btn.gold') || bub, text: 'Collect your gold!' };
      return bub ? { el: bub, text: 'Monsters earn gold! Tap the coins.' } : { ...worldAt(hb, 2), text: 'Tap the habitat.' };
    }),
  },
  {
    id: 'claim',
    done: () => !!G.state.flags.tutClaim || !currentMain() || !currentMain().done,
    exit: () => (G.state.flags.tutClaim = true),
    guide: () => mainIsland(() => (UI.stack.length ? null : { el: HUD.qt, text: 'Goal complete! Tap to claim your reward.' })),
  },
  {
    id: 'farm',
    enter: () => ensureGold(BUILDINGS.farm.cost.gold + 10),
    done: () => exists('farm'),
    guide: () => mainIsland(() => buildFlow('farm', 'buildings', 'Hungry monsters grow strong. Build a <b>Farm</b>!')),
  },
  {
    id: 'plant',
    enter: () => ensureGold(10),
    done: () => {
      const f = firstOf('farm');
      return !!(f && f.crop) || getStat('harvest') >= 1;
    },
    guide: () => mainIsland(() => {
      const f = firstOf('farm');
      if (!f) return null;
      if (f.state === 'building') return { ...worldAt(f, 1.8), text: 'Building your farm…' };
      if (isOpen('crops')) return { el: q('[data-tut="crop-berries"]'), text: 'Plant <b>Quick Berries</b>.' };
      if (UI.stack.length) return null;
      if (sheetKey() === `b:${f.id}`) return { el: q('[data-tut="plant"]'), text: 'Tap <b>Plant</b>.' };
      return { ...worldAt(f, 0.9), text: 'Tap your <b>Farm</b>.' };
    }),
  },
  {
    id: 'harvest',
    done: () => getStat('harvest') >= 1,
    guide: () => mainIsland(() => {
      const f = firstOf('farm');
      if (!f || !f.crop || UI.stack.length) return null;
      if (B.cropReady(f)) {
        const bub = marker(`f:${f.id}`);
        if (sheetKey() === `b:${f.id}`) return { el: q('[data-tut="harvest"]'), text: 'Harvest your berries!' };
        return bub ? { el: bub, text: 'Harvest your berries!' } : { ...worldAt(f, 1), text: 'Tap the farm to harvest.' };
      }
      if (sheetKey() === `b:${f.id}`) {
        const g = q('[data-tut="grow"]');
        if (g) return { el: g, text: 'Short waits are free to skip!' };
      }
      return { ...worldAt(f, 1.3), text: 'Berries grow in seconds…' };
    }),
  },
  {
    id: 'feed',
    enter: () => ensureFood(40),
    done: () => G.state.monsters.some((m) => m.lvl >= 2),
    guide: () => mainIsland(() => {
      const m = G.state.monsters[0];
      if (!m) return null;
      if (isOpen('mdetail')) {
        if (topKey() !== 'mdetail') return null;
        return { el: q('[data-tut="feed-level"]') || q('[data-tut="feed"]'), text: `Feed ${species(m.sp).name} to level it up!` };
      }
      if (UI.stack.length) return null;
      const a = G.world.actorFor(m.id);
      if (a) return { world: a.view.topPoint(new THREE.Vector3()), text: `Tap <b>${species(m.sp).name}</b>!` };
      return { el: HUD.nav.monsters, text: 'Open your <b>Monsters</b>.' };
    }),
  },
  {
    id: 'battle',
    done: () => !!G.state.campaign.clears['1-1'] && G.mode !== 'battle',
    guide: () => {
      if (G.mode === 'battle') {
        if (isOpen('results')) return { el: q('.results .btn.green'), text: 'Victory! Collect your loot.' };
        const badge = q('.bhud .tgt-badge');
        if (badge && Campaign.bs && Campaign.bs.choice) return { el: badge, text: 'Tap the enemy to attack!' };
        return null;
      }
      if (G.mode === 'map') {
        if (isOpen('team')) return { el: q('[data-tut="team-fight"]'), text: 'Your team is ready. <b>Fight!</b>' };
        if (isOpen('stage')) return { el: q('[data-tut="stage-go"]'), text: 'Start the battle!' };
        if (UI.stack.length) return null;
        const L = Campaign.labels && Campaign.labels[0];
        return L && L.el.isConnected ? { el: L.el, text: 'Tap the first stage.' } : null;
      }
      if (G.mode !== 'island' || UI.stack.length) return null;
      return { el: HUD.nav.battle, text: 'Adventure awaits! Tap <b>BATTLE</b>.' };
    },
  },
  {
    id: 'nature_hab',
    enter: () => ensureGold(BUILDINGS.hab_nature.cost.gold),
    done: () => exists('hab_nature'),
    guide: () => mainIsland(() => buildFlow('hab_nature', 'habitats', 'You won a <b>Sproutle</b> egg! Build it a <b>Nature Habitat</b>.')),
  },
  {
    id: 'hatch2',
    done: () => G.state.monsters.length >= 2 && G.mode === 'island' && !Tutorial.game.busy,
    guide: () => {
      if (G.mode === 'reveal') return hatchFlow('');
      return mainIsland(() => {
        const hb = firstOf('hab_nature');
        if (hb && hb.state === 'building') return { ...worldAt(hb, 2.2), text: 'Building… almost there!' };
        if (!G.state.hatchery.length) return null;
        return hatchFlow('Hatch your new egg!');
      });
    },
  },
  {
    id: 'level3',
    enter: () => {
      // Make sure the breeding lesson is reachable within the first session.
      const p = G.state.player;
      if (p.level < 3) {
        let need = 0;
        for (let l = p.level; l < 3; l++) need += xpToNext(l);
        addXP(Math.max(1, need - p.xp), 'tutorial');
      }
    },
    done: () => G.state.player.level >= 3 && !isOpen('levelup'),
    guide: () => null,
  },
  {
    id: 'breeding',
    enter: () => ensureGold(BUILDINGS.breeding.cost.gold),
    done: () => exists('breeding'),
    guide: () => mainIsland(() => buildFlow('breeding', 'buildings', 'Monsters can have babies! Build the <b>Breeding Mountain</b>.')),
  },
  {
    id: 'breed',
    done: () => !!G.state.breeding || getStat('breed') >= 1,
    guide: () => mainIsland(() => {
      const bb = firstOf('breeding');
      if (bb && bb.state === 'building') return { ...worldAt(bb, 2.8), text: 'Building the mountain…' };
      if (isOpen('breed')) return { el: q('[data-tut="breed-go"]'), text: 'Pair your two monsters and tap <b>BREED</b>!' };
      if (UI.stack.length) return null;
      return { el: HUD.nav.breed, text: 'Tap <b>BREED</b>.' };
    }),
  },
  {
    id: 'breed_hatch',
    done: () => G.state.monsters.length >= 3 && G.mode === 'island' && !Tutorial.game.busy,
    guide: () => {
      if (G.mode === 'reveal') return hatchFlow('');
      return mainIsland(() => {
        const bs = breedingState();
        if (bs) {
          if (isOpen('breed')) {
            const c = q('[data-tut="breed-collect"]') || q('[data-tut="breed-finish"]');
            return c ? { el: c, text: bs.done ? 'Collect the egg!' : 'Tap to finish — it\'s free!' } : null;
          }
          if (UI.stack.length) return null;
          const bb = firstOf('breeding');
          const bub = bb && marker(`br:${bb.id}`);
          if (bs.done && bub) return { el: bub, text: 'The egg is ready! Collect it.' };
          return { el: HUD.nav.breed, text: 'Check on the Breeding Mountain.' };
        }
        if (!G.state.hatchery.length) return null;
        return hatchFlow('Hatch the baby!');
      });
    },
  },
  {
    id: 'finale',
    enter: () => (Tutorial._finaleT = 6),
    done: () => Tutorial._finaleT <= 0,
    guide: () => (G.mode === 'island' && !UI.stack.length ? { el: HUD.qt, text: 'You\'re a natural! Follow your goals here to grow your haven.', noHand: true } : null),
  },
];

function ensureGold(n) {
  if (G.state.res.gold < n) add('gold', n - G.state.res.gold, { source: 'tutorial' });
}
function ensureFood(n) {
  if (G.state.res.food < n) add('food', n - G.state.res.food, { source: 'tutorial' });
}

export const Tutorial = {
  game: null,
  _t: 0,
  _finaleT: 0,
  _claimT: 0,
  init(game) {
    this.game = game;
    const T = G.state.tutorial;
    if (T.done) return;
    this.layer = UI.layers.tutorial;
    this.hand = h('div.tut-hand', { html: HAND });
    this.ring = h('div.tut-ring');
    this.bubble = h('div.tut-bubble');
    this.layer.append(this.ring, this.hand, this.bubble);
    this._hide();
    this.active = true;
    this._entered = -1;
  },

  blocksPopups() {
    if (!this.active) return false;
    const step = STEPS[G.state.tutorial.step];
    // never interrupt a placement or an open flow with a level-up popup
    return !!(G.world && G.world.placing) || (step && step.id === 'battle' && G.mode !== 'island');
  },

  suggestSpot(type, cb) {
    if (!this.active || !SPOTS[type]) return;
    const [x, z] = SPOTS[type];
    const s = B.findSpot(type, 0, x, z);
    if (s) cb(s);
  },

  update(dt) {
    if (!this.active) return;
    const T = G.state.tutorial;
    if (this._finaleT > 0) this._finaleT -= dt;
    // advance through satisfied steps
    let guard = 0;
    while (T.step < STEPS.length && guard++ < 20) {
      const step = STEPS[T.step];
      if (this._entered !== T.step) {
        this._entered = T.step;
        if (step.enter) step.enter();
      }
      if (!step.done()) break;
      if (step.exit) step.exit();
      T.step++;
      G.markDirty();
      G.bus.emit('tutorial:step', { step: T.step });
    }
    if (T.step >= STEPS.length) {
      this.finish();
      return;
    }
    // quietly claim finished goals once claiming has been taught
    if (G.state.flags.tutClaim && G.mode === 'island' && !UI.stack.length) {
      this._claimT -= dt;
      const cm = currentMain();
      if (cm && cm.done && this._claimT <= 0) {
        this._claimT = 1.2;
        HUD._questClick();
      }
    }
    this._t -= dt;
    // position every frame for smooth tracking, recompute target 10x/s
    if (this._t <= 0) {
      this._t = 0.1;
      const step = STEPS[T.step];
      let g = null;
      try {
        g = step.guide();
      } catch (e) {
        g = null;
      }
      // A window from an earlier step is still open: after a moment, point at its close button.
      if (!g && (G.mode === 'island' || G.mode === 'map') && UI.stack.length && !this.game.busy) {
        this._nullT = (this._nullT || 0) + 0.1;
        if (this._nullT > 1.6) {
          const top = UI.top();
          const x = top && top.el.querySelector('.x-btn');
          const ok = top && top.el.querySelector('.celebrate .btn.green');
          if (ok) g = { el: ok, text: null };
          else if (x) g = { el: x, text: 'Close this window to continue.' };
        }
      } else this._nullT = 0;
      this._cur = g;
    }
    this._place(this._cur);
  },

  _hide() {
    this.hand.style.opacity = '0';
    this.ring.style.display = 'none';
    this.bubble.style.display = 'none';
    this._lastText = null;
  },

  _place(g) {
    if (!g || (!g.el && !g.world) || this.game.busy) {
      this._hide();
      return;
    }
    let x, y, rect = null;
    if (g.el) {
      if (!g.el.isConnected) return this._hide();
      if (g.scroll && !this._scrolled) {
        this._scrolled = g.el;
        g.el.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
      }
      rect = g.el.getBoundingClientRect();
      if (rect.width < 2) return this._hide();
      x = rect.left + rect.width / 2;
      y = rect.top + rect.height / 2;
    } else {
      const p = G.engine.project(g.world, G.world.camera);
      if (!p.visible) return this._hide();
      x = p.x;
      y = p.y;
    }
    const W = window.innerWidth, H = window.innerHeight;
    // ring
    if (rect) {
      const pad = 6;
      this.ring.style.display = '';
      this.ring.style.width = `${rect.width + pad * 2}px`;
      this.ring.style.height = `${rect.height + pad * 2}px`;
      this.ring.style.left = `${rect.left - pad}px`;
      this.ring.style.top = `${rect.top - pad}px`;
      this.ring.style.borderRadius = rect.width > 120 ? '1.2rem' : `${Math.min(rect.width, rect.height) / 2 + pad}px`;
    } else this.ring.style.display = 'none';
    // hand: fingertip (22% / 8% of its box) at the target, below-right of it
    const hs = UI.rem(4.2);
    const below = y < H * 0.72;
    const hx = x - hs * 0.22 + (rect ? Math.min(rect.width * 0.15, 20) : 0);
    const hy = below ? y - hs * 0.08 + (rect ? Math.min(rect.height * 0.3, 18) : 6) : y - hs * 1.05;
    this.hand.style.opacity = g.noHand ? '0' : '1';
    this.hand.style.transform = `translate(${hx}px, ${hy}px)${below ? '' : ' scaleY(-1)'}`;
    // bubble
    if (g.text) {
      if (this._lastText !== g.text) {
        this._lastText = g.text;
        this.bubble.innerHTML = '';
        this.bubble.append(h('div.who', null, icon('paw'), 'Keeper tip'), h('div', { html: g.text }));
        this.bubble.style.animation = 'none';
        void this.bubble.offsetWidth;
        this.bubble.style.animation = '';
      }
      this.bubble.style.display = '';
      const bw = this.bubble.offsetWidth, bh = this.bubble.offsetHeight;
      let bx = x - bw / 2;
      let by = below ? hy + hs + 6 : hy - bh - 6;
      if (by + bh > H - 8) by = y - bh - hs * 0.9;
      if (by < 8) by = Math.min(H - bh - 8, y + hs + 10);
      bx = Math.max(8, Math.min(W - bw - 8, bx));
      this.bubble.style.left = `${bx}px`;
      this.bubble.style.top = `${by}px`;
    } else this.bubble.style.display = 'none';
  },

  finish() {
    const T = G.state.tutorial;
    T.done = true;
    T.step = STEPS.length;
    this.active = false;
    this._hide();
    G.markDirty();
    G.bus.emit('tutorial:done', {});
    HUD.refresh();
  },

  stepId() {
    return this.active ? (STEPS[G.state.tutorial.step] || {}).id : null;
  },
};
