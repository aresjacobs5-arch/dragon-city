import { G } from '../../game/G.js';
import { UI } from '../ui.js';
import { h, icon, fmt, bar } from '../dom.js';
import { MONSTERS } from '../../data/monsters.js';
import { RARITIES, RARITY_LIST } from '../../data/rarities.js';
import { ELEMENTS, ELEMENT_LIST } from '../../data/elements.js';
import { ABILITIES, describeAbility } from '../../data/abilities.js';
import { STATUSES } from '../../data/statuses.js';
import { speciesCard, rarityChip, elIcons, blend } from './monsters.js';
import { MonsterStage } from '../../render/monsterStage.js';
import { ownedCount, shardsFor, summonCost } from '../../systems/monsters.js';

const statusNames = Object.fromEntries(Object.entries(STATUSES).map(([k, v]) => [k, v.name]));

// Monsterdex: every monster, owned ones in full color, the rest as silhouettes.
export function openDex(A) {
  const st = { el: null, rar: null };
  const grid = h('div.mgrid');
  const summary = h('div.row', { style: { flexWrap: 'wrap', gap: '0.5rem' } });
  const elTabs = h('div.row', null, ELEMENT_LIST.map((e) => {
    const b = h('button.el-tab', { onclick: () => { st.el = st.el === e ? null : e; [...elTabs.children].forEach((c) => c.classList.toggle('on', c.dataset.el === st.el)); render(); } }, icon(`el_${e}`));
    b.dataset.el = e;
    return b;
  }));
  const rarTabs = h('div.tabs', null, RARITY_LIST.map((r) => {
    const b = h('button.tab', { style: { padding: '0.2rem 0.6rem 0.3rem', fontSize: '0.85rem' }, onclick: () => { st.rar = st.rar === r ? null : r; [...rarTabs.children].forEach((c) => c.classList.toggle('on', c.dataset.r === st.rar)); render(); } }, RARITIES[r].name);
    b.dataset.r = r;
    return b;
  }));
  const scr = UI.panel({ key: 'dex', title: 'Monsterdex', ribbon: 'blue', content: [summary, h('div.toolbar', { style: { marginTop: '0.5rem' } }, elTabs, rarTabs), h('div.scroll.grow', null, grid)] });
  const render = () => {
    const owned = (m) => G.state.dex[m.id] === 2;
    const total = MONSTERS.length;
    const have = MONSTERS.filter(owned).length;
    summary.innerHTML = '';
    summary.appendChild(h('div.chip', { style: { fontSize: '1rem' } }, icon('dex'), h('b', null, `${have} / ${total}`), h('span.muted', null, ` · ${Math.round((have / total) * 100)}%`)));
    const els = st.el ? [st.el] : ['fire', 'nature', 'water', 'earth', 'electric', 'ice'];
    for (const e of els) {
      const list = MONSTERS.filter((m) => m.elements.includes(e));
      summary.appendChild(h('div.chip', null, icon(`el_${e}`), `${list.filter(owned).length}/${list.length}`));
    }
    grid.innerHTML = '';
    const list = MONSTERS.filter((m) => (!st.el || m.elements.includes(st.el)) && (!st.rar || m.rarity === st.rar));
    for (const def of list) {
      grid.appendChild(speciesCard(def, A, { owned: owned(def), seen: !!G.state.dex[def.id], onClick: () => openDexEntry(def, A) }));
    }
  };
  render();
  UI.open(scr);
  return scr;
}

export function openDexEntry(def, A) {
  const owned = G.state.dex[def.id] === 2;
  const vp = h('div.vp');
  const stage = h('div.stage.pe', null, vp);
  const ms = new MonsterStage({ bg: blend(RARITIES[def.rarity].color, '#ffffff', owned ? 0.72 : 0.35) });
  let stg = owned ? 1 : 1;
  ms.setMonster(def, stg);
  if (!owned) ms.setSilhouette(true);
  ms.bindDrag(vp);
  const viewport = { el: vp, scene: ms.scene, camera: ms.camera, update: (dt) => ms.update(dt) };
  stage.appendChild(h('div.top', null, h('div.col', { style: { gap: '0.3rem' } }, h('div.nm.display.ol', null, owned ? def.name : '???'), h('div.row', null, rarityChip(def.rarity))), h('div.grow'), owned || G.state.dex[def.id] ? elIcons(def.elements) : null));
  if (owned) {
    const stages = h('div.tabs', { style: { position: 'absolute', bottom: '0.8rem', left: '0.8rem' } }, ['Baby', 'Adult', 'Elder'].map((n, i) => h(`button.tab${i === stg ? '.on' : ''}`, { onclick: (e) => { stg = i; ms.setMonster(def, i); [...stages.children].forEach((c, k) => c.classList.toggle('on', k === i)); } }, n)));
    stage.appendChild(stages);
  }
  const side = h('div.side.scroll');
  if (owned) {
    side.appendChild(h('div.well', { style: { padding: '0.8rem', fontStyle: 'italic' } }, def.desc));
    side.appendChild(h('div.row', { style: { margin: '0.5rem 0', flexWrap: 'wrap' } }, h('span.chip', null, icon('paw'), `Owned: ${ownedCount(def.id)}`), h('span.chip', null, icon('shards'), `Shards: ${shardsFor(def.id)}`)));
    for (const id of def.abilities) {
      const ab = ABILITIES[id];
      side.appendChild(h('div.ability.well', { style: { marginBottom: '0.4rem' } }, icon(`el_${ab.el}`), h('div.grow', null, h('div.t', null, ab.name), h('div.d', null, describeAbility(ab, statusNames)))));
    }
  } else {
    side.appendChild(h('div.well', { style: { padding: '0.9rem' } }, h('div.display', { style: { fontSize: '1.3rem' } }, 'Undiscovered'), h('div.small.muted', null, 'Breed monsters, open eggs and explore the campaign to discover it.')));
  }
  const hint = breedingHint(def);
  if (hint) side.appendChild(h('div.well', { style: { padding: '0.7rem', marginTop: '0.5rem' } }, h('div.display', null, 'Breeding hint'), hint));
  const sh = shardsFor(def.id);
  if (sh >= summonCost(def.id)) side.appendChild(h('button.btn.purple.wide', { style: { marginTop: '0.6rem' }, onclick: () => A.summonShards(def.id) }, icon('shards'), `Summon (${summonCost(def.id)} shards)`));
  const scr = UI.panel({ key: 'dexentry', title: '', content: [h('div.mdetail', null, stage, side)], dim: 0.6 });
  scr.panel.style.paddingTop = '1.4rem';
  scr.onOpen = () => G.engine.addViewport(viewport);
  scr.onClose = () => {
    G.engine.removeViewport(viewport);
    ms.dispose();
  };
  UI.open(scr);
}

function breedingHint(def) {
  if (def.recipe && def.recipe.length) {
    const r = def.recipe[0];
    const known = (id) => G.state.dex[id] === 2;
    const nm = (id) => (known(id) ? MONSTERS.find((m) => m.id === id).name : '???');
    return h('div.row', { style: { flexWrap: 'wrap', gap: '0.3rem' } }, h('span', null, nm(r[0])), icon('breed'), h('span', null, nm(r[1])));
  }
  if (def.elements.length >= 2) return h('div.row', { style: { gap: '0.3rem', flexWrap: 'wrap' } }, 'Breed monsters with', def.elements.map((e) => icon(`el_${e}`)), 'elements');
  if (def.breedable) return h('div.row', { style: { gap: '0.3rem' } }, 'Any parents with', icon(`el_${def.elements[0]}`));
  return null;
}
