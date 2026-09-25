import { G } from '../game/G.js';
import { h, icon, clear } from './dom.js';
import './styles/base.css';
import './styles/hud.css';
import './styles/screens.css';

// UI root: layers, responsive scale, screen stack, toasts, flying icons.
export const UI = {
  root: null,
  layers: {},
  stack: [],
  flyers: [],
  floats: [],
  hudHold: {},
  init() {
    this.root = document.getElementById('ui');
    for (const name of ['markers', 'hud', 'screens', 'fx', 'tutorial']) {
      const el = h(`div#${name}`);
      this.root.appendChild(el);
      this.layers[name] = el;
    }
    this.toastWrap = h('div.toast-wrap');
    this.layers.fx.appendChild(this.toastWrap);
    const onResize = () => this.rescale();
    window.addEventListener('resize', onResize);
    if (window.visualViewport) window.visualViewport.addEventListener('resize', onResize);
    this.rescale();
    window.addEventListener('keydown', (e) => {
      if (e.key === 'Escape' && this.stack.length) {
        const top = this.stack[this.stack.length - 1];
        if (top.escClose !== false) this.close(top);
      }
    });
  },
  rescale() {
    const w = window.innerWidth, hgt = window.innerHeight;
    let s;
    if (w >= hgt) s = Math.min(w / 1280, hgt / 720);
    else s = Math.min(w / 560, hgt / 980);
    s = Math.max(0.56, Math.min(1.45, s));
    this.scale = s;
    document.documentElement.style.setProperty('--root', `${(16 * s).toFixed(2)}px`);
    this.portrait = w < hgt;
    document.body.classList.toggle('portrait', this.portrait);
  },
  rem(n) {
    return n * 16 * this.scale;
  },

  // ---------------- screens
  open(scr) {
    if (!scr.el.classList.contains('scr')) scr.el.classList.add('scr');
    this.layers.screens.appendChild(scr.el);
    this.stack.push(scr);
    if (scr.onOpen) scr.onOpen();
    this._sync();
    G.bus.emit('ui:open', { scr });
    return scr;
  },
  close(scr, silent = false) {
    if (!scr) return;
    const i = this.stack.indexOf(scr);
    if (i < 0) return;
    this.stack.splice(i, 1);
    if (scr.onClose) scr.onClose();
    scr.el.classList.add('closing');
    setTimeout(() => scr.el.remove(), 170);
    this._sync();
    if (!silent) G.bus.emit('ui:close', { scr });
  },
  closeAll() {
    for (const s of [...this.stack]) this.close(s, true);
    G.bus.emit('ui:close', {});
  },
  top() {
    return this.stack[this.stack.length - 1] || null;
  },
  isOpen(key) {
    return this.stack.some((s) => s.key === key);
  },
  find(key) {
    return this.stack.find((s) => s.key === key) || null;
  },
  _sync() {
    let dim = 0;
    let hideHud = false;
    let hideWorld = false;
    for (const s of this.stack) {
      dim = Math.max(dim, s.dim ?? 0.5);
      if (s.hideHud) hideHud = true;
      if (s.hideWorld) hideWorld = true;
    }
    if (G.engine) {
      G.engine.dimTarget = dim;
      G.engine.worldVisible = !hideWorld;
    }
    this.layers.hud.classList.toggle('away', hideHud || G.mode !== 'island');
    this.layers.markers.style.display = this.stack.length && dim > 0.2 ? 'none' : '';
  },
  update(dt) {
    for (const s of this.stack) if (s.update) s.update(dt);
    this._updateFlyers(dt);
  },

  // Standard panel screen with ribbon title and close button.
  panel({ key, title = '', ribbon = '', kind = 'page', content = [], onClose = null, dim = 0.55, close = true, hideHud = true, cls = '' }) {
    const panel = h(`div.panel.main.${kind}${cls ? '.' + cls : ''}`);
    if (title) panel.appendChild(h(`div.ribbon.ol${ribbon ? '.' + ribbon : ''}`, null, title));
    const scr = { key, el: h('div.scr'), dim, hideHud, onClose, panel };
    if (close) panel.appendChild(h('button.x-btn', { onclick: () => this.close(scr), 'aria-label': 'Close' }, icon('close')));
    for (const c of [].concat(content)) if (c) panel.appendChild(c);
    scr.el.appendChild(panel);
    // clicking the backdrop closes modals
    scr.el.addEventListener('pointerdown', (e) => {
      if (e.target === scr.el && close && kind === 'modal') this.close(scr);
    });
    return scr;
  },

  confirm({ title = 'Are you sure?', text = '', yes = 'OK', no = 'Cancel', yesClass = 'green', onYes, onNo, extra = null }) {
    const scr = this.panel({
      key: 'confirm',
      title,
      kind: 'modal',
      ribbon: 'blue',
      hideHud: false,
      content: [
        text ? h('div.dlg-text', { html: text }) : null,
        extra,
        h('div.dlg-actions', null,
          no ? h('button.btn.red', { onclick: () => { this.close(scr); onNo && onNo(); } }, no) : null,
          h(`button.btn.${yesClass}`, { onclick: () => { this.close(scr); onYes && onYes(); } }, yes)),
      ],
    });
    return this.open(scr);
  },

  // ---------------- toasts
  toast(text, { icon: ic = null, kind = '' } = {}) {
    const t = h(`div.toast${kind ? '.' + kind : ''}`, null, ic ? icon(ic) : null, h('span', null, text));
    this.toastWrap.appendChild(t);
    while (this.toastWrap.children.length > 3) this.toastWrap.firstChild.remove();
    setTimeout(() => {
      t.classList.add('out');
      setTimeout(() => t.remove(), 300);
    }, 2200);
  },

  // ---------------- flying icons (currency to counters)
  fly(iconName, from, toEl, { count = 5, onArrive = null, size = 1, spread = 40 } = {}) {
    if (!toEl) return;
    const r = toEl.getBoundingClientRect();
    const tx = r.left + Math.min(r.width, this.rem(1.6)) * 0.5, ty = r.top + r.height / 2;
    const n = Math.max(1, Math.min(count, 12));
    for (let i = 0; i < n; i++) {
      const el = h('div.fly', null, icon(iconName));
      el.style.width = el.style.height = `${2.4 * size}rem`;
      this.layers.fx.appendChild(el);
      const sx = from.x + (Math.random() - 0.5) * spread, sy = from.y + (Math.random() - 0.5) * spread;
      const cx = (sx + tx) / 2 + (Math.random() - 0.5) * 160, cy = Math.min(sy, ty) - 80 - Math.random() * 80;
      this.flyers.push({ el, sx, sy, cx, cy, tx, ty, t: -i * 0.05, dur: 0.55 + Math.random() * 0.15, onArrive: i === n - 1 ? onArrive : null, pop: 0 });
    }
  },
  _updateFlyers(dt) {
    for (let i = this.flyers.length - 1; i >= 0; i--) {
      const f = this.flyers[i];
      f.t += dt;
      if (f.t < 0) {
        f.el.style.transform = `translate(${f.sx}px, ${f.sy}px) scale(0)`;
        continue;
      }
      const popT = 0.14;
      if (f.t < popT) {
        const k = f.t / popT;
        f.el.style.transform = `translate(${f.sx}px, ${f.sy - k * 18}px) scale(${0.3 + k * 0.9})`;
        continue;
      }
      const k = Math.min(1, (f.t - popT) / f.dur);
      const e = k * k * (3 - 2 * k);
      const sy0 = f.sy - 18;
      const x = (1 - e) * (1 - e) * f.sx + 2 * (1 - e) * e * f.cx + e * e * f.tx;
      const y = (1 - e) * (1 - e) * sy0 + 2 * (1 - e) * e * f.cy + e * e * f.ty;
      f.el.style.transform = `translate(${x}px, ${y}px) scale(${1.2 - e * 0.5})`;
      if (k >= 1) {
        f.el.remove();
        this.flyers.splice(i, 1);
        if (f.onArrive) f.onArrive();
        G.bus.emit('ui:flyArrive', {});
      }
    }
  },

  // Floating text that rises and fades (e.g. +40 food over a farm)
  floatText(text, x, y, { iconName = null, color = null, cls = 'ol' } = {}) {
    const el = h(`div.float-text.${cls}`, null, iconName ? icon(iconName) : null, h('span', null, text));
    if (color) el.style.color = color;
    this.layers.fx.appendChild(el);
    const start = performance.now();
    const step = (now) => {
      const k = (now - start) / 1100;
      if (k >= 1) {
        el.remove();
        return;
      }
      const e = 1 - Math.pow(1 - k, 3);
      el.style.transform = `translate(-50%, -50%) translate(${x}px, ${y - e * 60}px) scale(${k < 0.15 ? 0.6 + k * 3 : 1})`;
      el.style.opacity = k > 0.7 ? 1 - (k - 0.7) / 0.3 : 1;
      requestAnimationFrame(step);
    };
    requestAnimationFrame(step);
  },

  clearLayer(name) {
    clear(this.layers[name]);
  },
};
