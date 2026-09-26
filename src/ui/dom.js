import { iconSvg } from './icons.js';

// Tiny DOM builder: h('div.panel.modal', { onclick }, child, 'text', ...)
export function h(tag, props = null, ...children) {
  let t = tag;
  let classes = [];
  let id = null;
  if (typeof tag === 'string') {
    const parts = tag.split(/(?=[.#])/);
    t = parts[0] || 'div';
    for (const p of parts.slice(1)) {
      if (p[0] === '.') classes.push(p.slice(1));
      else if (p[0] === '#') id = p.slice(1);
    }
  }
  const el = document.createElement(t);
  if (classes.length) el.className = classes.join(' ');
  if (id) el.id = id;
  if (props) {
    for (const [k, v] of Object.entries(props)) {
      if (v === undefined || v === null || v === false) continue;
      if (k === 'class') el.className += (el.className ? ' ' : '') + v;
      else if (k === 'style' && typeof v === 'object') {
        for (const [sk, sv] of Object.entries(v)) {
          if (sk.startsWith('--')) el.style.setProperty(sk, sv);
          else el.style[sk] = sv;
        }
      }
      else if (k === 'html') el.innerHTML = v;
      else if (k === 'text') el.textContent = v;
      else if (k.startsWith('on') && typeof v === 'function') {
        const evt = k.slice(2).toLowerCase();
        if (evt === 'click' || evt === 'tap') el.addEventListener('click', wrapClick(v));
        else el.addEventListener(evt, v);
      } else if (k === 'dataset') Object.assign(el.dataset, v);
      else if (k in el && typeof v !== 'string') el[k] = v;
      else el.setAttribute(k, v === true ? '' : v);
    }
  }
  append(el, children);
  return el;
}

let clickHook = null;
export function onAnyClick(fn) {
  clickHook = fn;
}
function wrapClick(fn) {
  return (e) => {
    e.stopPropagation();
    if (clickHook) clickHook(e);
    fn(e);
  };
}

export function append(el, children) {
  for (const c of children.flat(Infinity)) {
    if (c === null || c === undefined || c === false) continue;
    if (c instanceof Node) el.appendChild(c);
    else el.appendChild(document.createTextNode(String(c)));
  }
  return el;
}

export function icon(name, cls = '') {
  const tpl = document.createElement('template');
  tpl.innerHTML = iconSvg(name, cls);
  return tpl.content.firstChild;
}

export function clear(el) {
  while (el.firstChild) el.removeChild(el.firstChild);
  return el;
}

// Number formatting: 1,234 / 12.3K / 4.5M
export function fmt(n) {
  n = Math.floor(n || 0);
  if (Math.abs(n) < 100000) return n.toLocaleString('en-US');
  if (Math.abs(n) < 1e6) return (n / 1000).toFixed(n < 1e6 ? 1 : 0).replace(/\.0$/, '') + 'K';
  if (Math.abs(n) < 1e9) return (n / 1e6).toFixed(n < 1e8 ? 2 : 1).replace(/\.?0+$/, '') + 'M';
  return (n / 1e9).toFixed(2).replace(/\.?0+$/, '') + 'B';
}

export function fmtTime(sec) {
  sec = Math.max(0, Math.ceil(sec));
  if (sec < 60) return `${sec}s`;
  const m = Math.floor(sec / 60), s = sec % 60;
  if (m < 60) return s ? `${m}m ${s}s` : `${m}m`;
  const hh = Math.floor(m / 60), mm = m % 60;
  if (hh < 24) return mm ? `${hh}h ${mm}m` : `${hh}h`;
  const d = Math.floor(hh / 24);
  return `${d}d ${hh % 24}h`;
}

export function costEl(cost, { have = null } = {}) {
  const wrap = h('span.cost');
  for (const [k, v] of Object.entries(cost || {})) {
    if (!v) continue;
    wrap.appendChild(icon(k === 'tokens' ? 'tokens' : k));
    wrap.appendChild(document.createTextNode(fmt(v)));
  }
  if (!wrap.childNodes.length) wrap.appendChild(document.createTextNode('FREE'));
  return wrap;
}

export function bar(k, color = null, label = null) {
  const b = h('div.bar', null, h('i', { style: { '--k': `${Math.max(0, Math.min(1, k)) * 100}%`, ...(color ? { '--bc': color } : {}) } }), label !== null ? h('span', null, label) : null);
  return b;
}

export function setBar(barEl, k, label = null) {
  const i = barEl.querySelector('i');
  i.style.setProperty('--k', `${Math.max(0, Math.min(1, k)) * 100}%`);
  if (label !== null) {
    const s = barEl.querySelector('span');
    if (s) s.textContent = label;
  }
}

export function ringSvg(k, color = '#ffd84a', track = 'rgba(42,26,47,.55)') {
  const r = 26, c = 2 * Math.PI * r;
  return `<svg class="ring" viewBox="0 0 64 64"><circle cx="32" cy="32" r="${r}" fill="none" stroke="${track}" stroke-width="7"/><circle cx="32" cy="32" r="${r}" fill="none" stroke="#2a1a2f" stroke-width="9" stroke-dasharray="${c * k} ${c}" opacity=".0"/><circle class="arc" cx="32" cy="32" r="${r}" fill="none" stroke="${color}" stroke-width="6" stroke-linecap="round" stroke-dasharray="${c * k} ${c}"/></svg>`;
}
