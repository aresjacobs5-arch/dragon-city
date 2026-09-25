import * as THREE from 'three';
import { G } from '../game/G.js';
import { UI } from './ui.js';
import { h, icon, fmt, fmtTime, bar, setBar } from './dom.js';
import { BUILDINGS } from '../data/buildings.js';
import { ISLAND_BY_ID, ISLANDS } from '../data/islands.js';
import { CROP_BY_ID } from '../data/crops.js';
import { isHabitat, habitatGold, habitatCap, cropReady, remainingSec, obstaclesFor } from '../systems/buildings.js';
import { buildingWorldPos } from '../render/world/homeView.js';
import { breedingState } from '../systems/breeding.js';
import { eggReady } from '../systems/hatchery.js';

// World-anchored UI: collect bubbles, timers, lock labels. Positions are
// projected from 3D every frame; the set of markers is rebuilt a few times a second.
export const Markers = {
  items: new Map(),
  init(actions) {
    this.actions = actions;
    this.layer = UI.layers.markers;
    this._t = 0;
  },
  _ensure(key, make) {
    let m = this.items.get(key);
    if (!m) {
      m = make();
      m.el.classList.add('mk');
      this.layer.appendChild(m.el);
      this.items.set(key, m);
    }
    m.alive = true;
    return m;
  },
  sync() {
    const world = G.world;
    if (!world) return;
    for (const m of this.items.values()) m.alive = false;
    const now = G.now();
    for (const b of G.state.buildings) {
      if (!G.state.islands.includes(b.island)) continue;
      const def = BUILDINGS[b.type];
      const pos = buildingWorldPos(b, new THREE.Vector3());
      const topY = def.category === 'habitat' ? 1.9 : b.type === 'challenge_tower' ? 4.8 : b.type === 'breeding' ? 2.6 : 1.7;
      if (b.state === 'building' || b.state === 'upgrading') {
        const m = this._ensure(`t:${b.id}`, () => {
          const el = h('div.mk-timer', null, h('div.t'), bar(0, '#5fc4ff'));
          return { el, pos: new THREE.Vector3(), timer: true };
        });
        m.pos.copy(pos).setY(topY + 0.2);
        const left = remainingSec(b);
        const total = Math.max(1, (b.until - (b.started || b.until - 1000)) / 1000);
        m.el.querySelector('.t').textContent = left > 0 ? fmtTime(left) : '';
        setBar(m.el.querySelector('.bar'), 1 - left / total);
        continue;
      }
      if (isHabitat(b)) {
        const g = habitatGold(b, now);
        const cap = habitatCap(b);
        if (g >= Math.min(20, cap * 0.1)) {
          const full = g >= cap - 0.5;
          const m = this._ensure(`g:${b.id}`, () => {
            const el = h('button.bubble.pe', { onclick: () => this.actions.collectHabitat(b.id, el) }, icon('gold'));
            return { el, pos: new THREE.Vector3() };
          });
          m.el.classList.toggle('gold-full', full);
          m.pos.copy(pos).setY(topY);
        }
      }
      if (b.type === 'farm' && b.crop) {
        if (cropReady(b, now)) {
          const m = this._ensure(`f:${b.id}`, () => {
            const el = h('button.bubble.pe', { onclick: () => this.actions.harvest(b.id, el) }, icon(`crop_${b.crop}`));
            return { el, pos: new THREE.Vector3() };
          });
          m.pos.copy(pos).setY(1.3);
        } else {
          const m = this._ensure(`c:${b.id}`, () => {
            const el = h('div.mk-timer', null, h('div.t'), bar(0, '#7dd84a'));
            return { el, pos: new THREE.Vector3() };
          });
          m.pos.copy(pos).setY(1.1);
          const left = Math.ceil((b.cropUntil - now) / 1000);
          const total = Math.max(1, (b.cropUntil - (b.cropStart || now)) / 1000);
          m.el.querySelector('.t').textContent = fmtTime(left);
          setBar(m.el.querySelector('.bar'), 1 - left / total);
        }
      }
      if (b.type === 'hatchery' && G.state.hatchery.some((e) => eggReady(e))) {
        const m = this._ensure(`h:${b.id}`, () => {
          const el = h('button.bubble.pe', { onclick: () => this.actions.openHatchery() }, icon('egg'));
          return { el, pos: new THREE.Vector3() };
        });
        m.pos.copy(pos).setY(1.9);
      }
      if (b.type === 'breeding') {
        const bs = breedingState();
        if (bs && bs.done) {
          const m = this._ensure(`br:${b.id}`, () => {
            const el = h('button.bubble.pe', { onclick: () => this.actions.collectBreeding() }, icon('heart'));
            return { el, pos: new THREE.Vector3() };
          });
          m.pos.copy(pos).setY(2.9);
        } else if (bs) {
          const m = this._ensure(`bt:${b.id}`, () => {
            const el = h('div.mk-timer', null, h('div.t'), bar(0, '#ff8fc0'));
            return { el, pos: new THREE.Vector3() };
          });
          m.pos.copy(pos).setY(2.8);
          m.el.querySelector('.t').textContent = fmtTime(bs.left);
          setBar(m.el.querySelector('.bar'), 1 - bs.left / Math.max(1, bs.total));
        }
      }
    }
    // obstacles being cleared
    for (const [id, until] of Object.entries(G.state.obstacles.clearing)) {
      const isl = Number(id.split('-')[0]);
      const o = obstaclesFor(isl).find((x) => x.id === id);
      if (!o) continue;
      const def = ISLAND_BY_ID[isl];
      const m = this._ensure(`o:${id}`, () => {
        const el = h('div.mk-timer', null, h('div.t'), bar(0, '#ffc83d'));
        return { el, pos: new THREE.Vector3() };
      });
      m.pos.set(def.center[0] + o.x + o.w / 2, 1.8, def.center[1] + o.z + o.d / 2);
      const left = Math.ceil((until - now) / 1000);
      m.el.querySelector('.t').textContent = fmtTime(left);
      setBar(m.el.querySelector('.bar'), 1 - left / Math.max(1, o.time));
    }
    // locked islands: show requirements
    for (const def of ISLANDS) {
      if (G.state.islands.includes(def.id)) continue;
      const m = this._ensure(`l:${def.id}`, () => {
        const el = h('button.mk-lock.pe', { onclick: () => this.actions.lockedIsland(def.id) }, icon('lock'), h('div.lbl'));
        return { el, pos: new THREE.Vector3() };
      });
      m.pos.set(def.center[0], 3.5, def.center[1]);
      const lvl = G.state.player.level;
      m.el.querySelector('.lbl').textContent = lvl >= def.unlockLevel ? `${def.name} · ${fmt(def.cost)}` : `${def.name} · Lv ${def.unlockLevel}`;
    }
    for (const [key, m] of this.items) {
      if (!m.alive) {
        m.el.remove();
        this.items.delete(key);
      }
    }
  },
  update(dt) {
    if (G.mode !== 'island' || !G.world) {
      this.layer.style.visibility = 'hidden';
      return;
    }
    this.layer.style.visibility = '';
    this._t -= dt;
    if (this._t <= 0) {
      this._t = 0.2;
      this.sync();
    }
    const cam = G.world.camera;
    const out = { x: 0, y: 0, visible: false };
    const hidePlacing = !!G.world.placing;
    for (const m of this.items.values()) {
      G.engine.project(m.pos, cam, out);
      if (!out.visible || hidePlacing) {
        m.el.style.display = 'none';
        continue;
      }
      m.el.style.display = '';
      m.el.style.transform = `translate(${out.x.toFixed(1)}px, ${out.y.toFixed(1)}px) translate(-50%, -100%)`;
    }
  },
  clear() {
    for (const m of this.items.values()) m.el.remove();
    this.items.clear();
  },
};
