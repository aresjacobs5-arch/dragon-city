import { G } from '../../game/G.js';
import { UI } from '../ui.js';
import { h, icon, fmt, fmtTime, costEl } from '../dom.js';
import { BUILDINGS, BUILDING_LIST, farmLimit } from '../../data/buildings.js';
import { ELEMENTS } from '../../data/elements.js';
import { MONSTERS } from '../../data/monsters.js';
import { RARITIES } from '../../data/rarities.js';
import { buildCost, buildBlocker, buildTimeFor, countOf } from '../../systems/buildings.js';
import { elementUnlocked } from '../../systems/player.js';
import { rarityChip } from './monsters.js';

const TABS = [
  ['habitats', 'Habitats', 'habitat'],
  ['buildings', 'Buildings', 'building'],
  ['monsters', 'Monsters', 'egg'],
  ['decorations', 'Decor', 'deco'],
  ['resources', 'Resources', 'resources'],
];

export const SHOP_EGGS = [
  ...['embercub', 'sproutle', 'ripplet', 'pebblor', 'zapkit', 'frostnip', 'lumipup', 'gloomling', 'clankle', 'wispurr'].map((id) => ({ id: `egg_${id}`, species: id, cost: { gold: 0 } })),
  { id: 'egg_rand_uncommon', rarity: 'uncommon', cost: { gems: 25 } },
  { id: 'egg_rand_rare', rarity: 'rare', cost: { gems: 60 } },
  { id: 'egg_rand_epic', rarity: 'epic', cost: { gems: 180 }, minLevel: 15 },
];

export function eggPrice(sp) {
  const m = MONSTERS.find((x) => x.id === sp);
  const tier = ELEMENTS[m.elements[0]].unlock;
  return Math.round(150 + tier * 120);
}

export function openShop(A, tab = 'habitats') {
  let cur = tab;
  const vtabs = h('div.vtabs');
  const items = h('div.items.scroll');
  const scr = UI.panel({ key: 'shop', title: 'Shop', ribbon: 'orange', content: [h('div.shop', null, vtabs, items)] });
  const renderTabs = () => {
    vtabs.innerHTML = '';
    for (const [k, label, ic] of TABS) vtabs.appendChild(h(`button.tab${cur === k ? '.on' : ''}`, { 'data-tut': `tab-${k}`, onclick: () => { cur = k; renderTabs(); render(); } }, icon(ic), label));
  };
  const lvl = () => G.state.player.level;

  const buildingCard = (def) => {
    const block = buildBlocker(def.id);
    const locked = block && block.reason === 'level';
    const owned = block && block.reason === 'owned';
    const limit = block && block.reason === 'limit';
    const cost = buildCost(def.id);
    const img = h('img', { alt: '' });
    img.style.opacity = '0';
    A.buildingThumb(def.id).then((u) => {
      if (u) {
        img.src = u;
        img.style.opacity = '1';
      }
    });
    const color = def.element ? ELEMENTS[def.element].light : def.category === 'decoration' ? '#ffd6ee' : '#cfe9ff';
    const card = h(`div.scard${locked ? '.locked' : ''}`, null,
      h('div.art', { style: { '--sc': color } }, img, def.element ? h('div', { style: { position: 'absolute', left: '0.4rem', top: '0.4rem' } }, icon(`el_${def.element}`)) : null),
      h('div.nm', null, def.name),
      h('div.meta', null, icon('timer'), fmtTime(buildTimeFor(def.id)), def.xp ? icon('xp') : null, def.xp ? `+${def.xp}` : null),
    );
    if (def.id === 'farm') card.appendChild(h('div.count.chip', null, `${countOf('farm')}/${farmLimit(lvl())}`));
    if (locked) card.appendChild(h('div.lockover', null, icon('lock'), h('div.ol.display', { style: { fontSize: '1.2rem' } }, `Level ${block.level}`)));
    else if (owned) card.appendChild(h('button.btn.sm.buy.disabled', null, 'Built'));
    else if (limit) card.appendChild(h('button.btn.sm.buy.disabled', null, 'Max built'));
    else card.appendChild(h(`button.btn.sm.buy.${cost.gems ? 'teal' : 'green'}`, { 'data-tut': `buy-${def.id}`, onclick: () => A.buyBuilding(def.id, scr) }, costEl(cost)));
    return card;
  };

  const render = () => {
    items.innerHTML = '';
    if (cur === 'habitats' || cur === 'buildings' || cur === 'decorations') {
      const cat = cur === 'habitats' ? 'habitat' : cur === 'buildings' ? 'building' : 'decoration';
      const list = BUILDING_LIST.filter((b) => b.category === cat && b.id !== 'hatchery');
      list.sort((a, b) => a.unlockLevel - b.unlockLevel);
      for (const def of list) items.appendChild(buildingCard(def));
    } else if (cur === 'monsters') {
      for (const e of SHOP_EGGS) {
        if (e.minLevel && lvl() < e.minLevel) continue;
        let card;
        if (e.species) {
          const def = MONSTERS.find((m) => m.id === e.species);
          const ok = def.elements.every((x) => elementUnlocked(x));
          const cost = { gold: eggPrice(e.species) };
          const img = h('img', { alt: '' });
          A.portrait(e.species, 0).then((u) => u && (img.src = u));
          card = h(`div.scard${ok ? '' : '.locked'}`, null,
            h('div.art', { style: { '--sc': ELEMENTS[def.elements[0]].light } }, img, h('div', { style: { position: 'absolute', left: '0.4rem', top: '0.4rem' } }, icon(`el_${def.elements[0]}`))),
            h('div.nm', null, def.name),
            h('div.meta', null, rarityChip(def.rarity)),
            ok ? h('button.btn.sm.buy.green', { onclick: () => A.buyEgg({ species: e.species, cost }) }, costEl(cost)) : h('div.lockover', null, icon('lock'), h('div.ol.display', null, `Level ${ELEMENTS[def.elements[0]].unlock}`)));
        } else {
          const R = RARITIES[e.rarity];
          const img = h('img', { alt: '' });
          A.eggThumb(MONSTERS.find((m) => m.rarity === e.rarity).id).then((u) => u && (img.src = u));
          card = h('div.scard', null,
            h('div.art', { style: { '--sc': R.color } }, img, h('div.q.display.ol', { style: { position: 'absolute', right: '0.6rem', top: '0.2rem', fontSize: '2rem' } }, '?')),
            h('div.nm', null, `Mystery ${R.name} Egg`),
            h('div.meta', null, 'Random ', rarityChip(e.rarity), ' monster'),
            h('button.btn.sm.buy.teal', { onclick: () => A.buyEgg({ rarity: e.rarity, cost: e.cost }) }, costEl(e.cost)));
        }
        items.appendChild(card);
      }
    } else if (cur === 'resources') {
      const L = lvl();
      const packs = [
        { name: 'Pouch of Gold', ic: 'gold', give: { gold: 400 + L * 250 }, cost: { gems: 10 } },
        { name: 'Chest of Gold', ic: 'gold', give: { gold: (400 + L * 250) * 6 }, cost: { gems: 50 } },
        { name: 'Basket of Food', ic: 'food', give: { food: 300 + L * 200 }, cost: { gems: 10 } },
        { name: 'Cart of Food', ic: 'food', give: { food: (300 + L * 200) * 6 }, cost: { gems: 50 } },
        { name: 'Energy Refill', ic: 'energy', give: { energy: 20 }, cost: { gems: 8 } },
        { name: 'Breeding Token', ic: 'tokens', give: { tokens: 1 }, cost: { gems: 30 }, minLevel: 15 },
      ];
      if (A.adsReady()) {
        const left = A.adGemsLeft();
        items.appendChild(h('div.scard', null,
          h('div.art', { style: { '--sc': '#e6d8ff' } }, h('div.center', { style: { position: 'absolute', inset: 0 } }, icon('film'))),
          h('div.nm', null, 'Free Gems'),
          h('div.meta', null, icon('gems'), '+5 per video', ` · ${left} left today`),
          h(`button.btn.sm.buy.purple${left > 0 ? '' : '.disabled'}`, { onclick: () => left > 0 && A.adForGems(render) }, icon('film'), 'Watch')));
      }
      for (const p of packs) {
        if (p.minLevel && L < p.minLevel) continue;
        const k = Object.keys(p.give)[0];
        const card = h('div.scard', null,
          h('div.art', { style: { '--sc': k === 'gold' ? '#fff0b8' : k === 'food' ? '#ffd0d8' : k === 'energy' ? '#fff4a8' : '#ffd6ee' } }, h('div.center', { style: { position: 'absolute', inset: 0 } }, icon(p.ic))),
          h('div.nm', null, p.name),
          h('div.meta', null, icon(p.ic), `+${fmt(p.give[k])}`),
          h('button.btn.sm.buy.teal', { onclick: () => A.buyPack(p, render) }, costEl(p.cost)));
        card.querySelector('.art .ico').style.cssText = 'width:4.6rem;height:4.6rem';
        items.appendChild(card);
      }
    }
    items.querySelectorAll('.scard .art > .center .ico').forEach((i) => (i.style.cssText = 'width:4.6rem;height:4.6rem'));
  };
  renderTabs();
  render();
  scr.refresh = render;
  scr.tab = () => cur;
  scr.setTab = (t) => {
    cur = t;
    renderTabs();
    render();
  };
  UI.open(scr);
  return scr;
}
