import { G } from '../../game/G.js';
import { UI } from '../ui.js';
import { h, icon, fmt, fmtTime, costEl, bar, setBar } from '../dom.js';
import { RARITIES, RARITY_LIST } from '../../data/rarities.js';
import { ELEMENTS, ELEMENT_LIST, weaknessesOf } from '../../data/elements.js';
import { ABILITIES, describeAbility } from '../../data/abilities.js';
import { STATUSES } from '../../data/statuses.js';
import { RUNE_TYPES, RUNE_TIERS, RUNE_SLOTS_BY_LEVEL, RELICS, RELIC_BY_ID } from '../../data/rewards.js';
import { BUILDINGS } from '../../data/buildings.js';
import { formName, EVOLVE_LEVELS } from '../../data/evolutions.js';
import {
  species, monStats, power, stageOf, feedCost, foodToNext, maxLevel, canFeed, ROLES, monsterName, sortMonsters,
  rankCost, rankGoldCost, shardsFor, MAX_RANK, releaseValue, ownedCount, goldRate, RANK_LEVEL_CAP,
} from '../../systems/monsters.js';
import { byBuildingId, readyBuilding } from '../../systems/buildings.js';
import { isUnlocked } from '../../systems/player.js';
import { MonsterStage } from '../../render/monsterStage.js';
import { featureLevel } from '../../data/unlocks.js';

const statusNames = Object.fromEntries(Object.entries(STATUSES).map(([k, v]) => [k, v.name]));

export function rarityChip(r) {
  const R = RARITIES[r];
  return h('span.rar-chip', { style: { background: R.color } }, R.name);
}

export function elIcons(els, cls = '') {
  return h(`div.els${cls ? '.' + cls : ''}`, null, els.map((e) => icon(`el_${e}`)));
}

// ---------------------------------------------------------------- cards
const ORIGIN = {
  starter: 'Your very first monster',
  shop: 'Hatched from a shop egg',
  chest: 'Found in a treasure chest',
  campaign: 'Found on your adventures',
  stars: 'A reward for your campaign stars',
  daily: 'A daily login gift',
  wheel: 'Won on the Lucky Wheel',
  event: 'An event reward',
  quest: 'A reward for a finished goal',
  shards: 'Summoned at the Ancient Shrine',
  achievement: 'A reward for an achievement',
  tower: 'A Challenge Tower prize',
};
function timeAgo(t) {
  const s = Math.max(0, (G.now() - t) / 1000);
  if (s < 90) return 'just now';
  if (s < 3600) return `${Math.round(s / 60)} minutes ago`;
  const n = s < 86400 ? Math.round(s / 3600) : Math.round(s / 86400);
  return `${n} ${s < 86400 ? 'hour' : 'day'}${n > 1 ? 's' : ''} ago`;
}
// One line of personal history: where the monster came from, how long it has
// been with you and how many battles you have won together.
export function monsterStory(m) {
  const from = m.par ? `Child of ${m.par[0]} and ${m.par[1]}` : ORIGIN[m.src] || 'Hatched in your haven';
  const parts = [from, `joined ${timeAgo(m.got || G.now())}`];
  if (m.wins) parts.push(`${m.wins} ${m.wins === 1 ? 'victory' : 'victories'} together`);
  return parts.join(' · ');
}

// Baby -> level 7 -> level 15: the monster's three forms, future ones hidden.
export function evolutionLine(m, A) {
  const def = species(m.sp);
  const cur = stageOf(m);
  const row = h('div.evo-line');
  for (let i = 0; i < 3; i++) {
    if (i) row.appendChild(h('div.evo-arrow', null, icon('arrowR')));
    const known = i <= cur;
    const img = h('img', { alt: '' });
    A.portrait(m.sp, i, !known).then((u) => u && (img.src = u));
    row.appendChild(h(`div.evo-form${i === cur ? '.cur' : ''}${known ? '' : '.locked'}`, null,
      h('div.pic', null, img),
      h('div.t', null, known ? formName(def, i) : '???'),
      h('div.lv', null, i === 0 ? 'Lv 1' : `Lv ${EVOLVE_LEVELS[i - 1]}`)));
  }
  return row;
}

export function monsterCard(m, onClick, A, { tag = null, dim = false, sel = false } = {}) {
  const def = species(m.sp);
  const R = RARITIES[def.rarity];
  const card = h(`button.mcard${dim ? '.dim' : ''}${sel ? '.sel' : ''}`, { onclick: onClick, style: { '--rc': R.color } });
  const img = h('img', { alt: def.name });
  img.style.opacity = '0';
  const ph = h('div.ph', null, icon('paw'));
  const art = h('div.art', null, ph, img, elIcons(def.elements), h('div.lv.ol-s', null, `Lv ${m.lvl}`));
  if (m.rank) art.appendChild(h('div.rank', null, Array.from({ length: m.rank }, () => icon('star'))));
  if (m.fav) art.appendChild(h('div.fav', null, icon('heart')));
  if (canFeed(m) && G.state.res.food >= foodToNext(m) && m.lvl < 60 && !tag) art.appendChild(h('div.up-ind', null, icon('up')));
  if (tag) art.appendChild(h('div.tag', null, tag));
  card.append(art, h('div.name', null, monsterName(m)), h('div.rbar'));
  A.portrait(m.sp, stageOf(m)).then((u) => {
    if (u) {
      img.src = u;
      img.style.opacity = '1';
      ph.remove(); // the paw placeholder would show through the transparent portrait
    }
  });
  return card;
}

export function speciesCard(def, A, { onClick, owned = false, seen = false } = {}) {
  const R = RARITIES[def.rarity];
  const known = owned;
  const card = h(`button.mcard${known ? '' : '.unknown'}`, { onclick: onClick, style: { '--rc': R.color } });
  const img = h('img', { alt: '' });
  img.style.opacity = '0';
  const art = h('div.art', null, img, known || seen ? elIcons(def.elements) : null);
  if (!known) art.appendChild(h('div.q', null, '?'));
  card.append(art, h('div.name', null, known ? def.name : '???'), h('div.rbar'));
  A.portrait(def.id, known ? 1 : 1, !known).then((u) => {
    if (u) {
      img.src = u;
      img.style.opacity = known ? '1' : '0.9';
    }
  });
  return card;
}

// ---------------------------------------------------------------- list
export function openMonsters(A, { tab = 'all' } = {}) {
  const state = { sort: 'power', el: null, q: '' };
  const grid = h('div.mgrid');
  const search = h('input', { placeholder: 'Search', oninput: (e) => { state.q = e.target.value.toLowerCase(); render(); } });
  const sortBtn = h('button.tab', { onclick: () => { const order = ['power', 'level', 'rarity', 'recent', 'name']; state.sort = order[(order.indexOf(state.sort) + 1) % order.length]; sortBtn.lastChild.textContent = labelOf(state.sort); render(); } }, icon('sort'), h('span', null, 'Power'));
  const labelOf = (s) => ({ power: 'Power', level: 'Level', rarity: 'Rarity', recent: 'Newest', name: 'Name' })[s];
  const elTabs = h('div.row', null, ELEMENT_LIST.map((e) => {
    const b = h('button.el-tab', { onclick: () => { state.el = state.el === e ? null : e; [...elTabs.children].forEach((c) => c.classList.toggle('on', c.dataset.el === state.el)); render(); } }, icon(`el_${e}`));
    b.dataset.el = e;
    return b;
  }));
  const count = h('div.chip', null, icon('paw'), h('span'));
  const toolbar = h('div.toolbar', null, count, h('div.search', null, icon('search'), search), sortBtn, elTabs);
  const body = h('div.scroll.grow', null, grid);
  const scr = UI.panel({ key: 'monsters', title: 'Monsters', ribbon: 'orange', content: [toolbar, body] });
  const render = () => {
    grid.innerHTML = '';
    let list = G.state.monsters.filter((m) => {
      const def = species(m.sp);
      if (state.el && !def.elements.includes(state.el)) return false;
      if (state.q && !monsterName(m).toLowerCase().includes(state.q)) return false;
      return true;
    });
    list = sortMonsters(list, state.sort);
    count.lastChild.textContent = `${G.state.monsters.length}`;
    for (const m of list) {
      const tag = !m.hab ? 'No home' : null;
      grid.appendChild(monsterCard(m, () => openMonsterDetail(m, A, { tab }), A, { tag }));
    }
    if (!list.length) grid.appendChild(h('div.dlg-text.muted', { style: { gridColumn: '1/-1', padding: '2rem' } }, 'No monsters here yet. Hatch or breed some!'));
  };
  render();
  scr.refresh = render;
  UI.open(scr);
  return scr;
}

// ---------------------------------------------------------------- detail
export function openMonsterDetail(m, A, { tab = 'info' } = {}) {
  const def = species(m.sp);
  const R = RARITIES[def.rarity];
  const stageBox = h('div.stage.pe');
  const vp = h('div.vp');
  stageBox.appendChild(vp);
  const tint = RARITIES[def.rarity].color;
  const ms = new MonsterStage({ bg: blend(tint, '#ffffff', 0.72) });
  let curStage = stageOf(m);
  ms.setMonster(def, curStage);
  ms.bindDrag(vp);
  const viewport = { el: vp, scene: ms.scene, camera: ms.camera, update: (dt) => ms.update(dt) };

  // Give your monster a name of its own
  const nameText = h('span', null, monsterName(m));
  const renameBtn = h('button.rename-btn', { 'aria-label': 'Rename', onclick: () => openRename(m, A, () => (nameText.textContent = monsterName(m))) }, icon('pencil'));
  const favBtn = h(`button.rename-btn.fav-btn${m.fav ? '.on' : ''}`, {
    'aria-label': 'Favourite',
    onclick: () => {
      m.fav = !m.fav;
      favBtn.classList.toggle('on', !!m.fav);
      G.markDirty();
      A.sfx(m.fav ? 'heart' : 'click');
      if (m.fav) UI.toast(`${monsterName(m)} is a favourite!`, { icon: 'heart', kind: 'good' });
      if (curTab === 'info') renderContent();
    },
  }, icon('heart'));
  const nameEl = h('div.nm.display.ol', null, nameText, renameBtn, favBtn);
  stageBox.appendChild(h('div.top', null, h('div.col', { style: { gap: '0.3rem' } }, nameEl, h('div.row', null, rarityChip(def.rarity), h('span.chip', null, icon('crown'), ROLES[def.role].label))), h('div.grow'), elIcons(def.elements)));
  const lvNum = h('div.lvnum.display.ol', null, '');
  const lvBar = bar(0, '#ffd84a', '');
  const feedRow = h('div.feed-row');
  stageBox.appendChild(h('div.bottom', null, h('div.lvline', null, lvNum, lvBar), feedRow));

  const side = h('div.side');
  const tabs = h('div.tabs');
  const content = h('div.scroll.grow');
  side.append(tabs, content);
  const wrap = h('div.mdetail', null, stageBox, side);
  const scr = UI.panel({ key: 'mdetail', title: '', content: [wrap], dim: 0.6 });
  scr.panel.style.paddingTop = '1.4rem';
  let curTab = tab;
  const TABS = [
    ['info', 'Stats', 'info'],
    ['rank', 'Rank', 'crown', 'ranks'],
    ['runes', 'Runes', 'rune', 'runes'],
    ['relic', 'Relic', 'relic', 'relics'],
  ];
  const renderTabs = () => {
    tabs.innerHTML = '';
    for (const [k, label, ic, feat] of TABS) {
      if (feat && !isUnlocked(feat)) continue;
      tabs.appendChild(h(`button.tab${curTab === k ? '.on' : ''}`, { onclick: () => { curTab = k; renderTabs(); renderContent(); } }, icon(ic), label));
    }
  };

  const renderLevel = () => {
    const cap = maxLevel(m);
    lvNum.textContent = `Lv ${m.lvl}`;
    if (m.lvl >= cap) setBar(lvBar, 1, m.rank < MAX_RANK ? `MAX · Rank up for Lv ${RANK_LEVEL_CAP[m.rank + 1]}` : 'MAX');
    else setBar(lvBar, m.xp / feedCost(m.lvl), `${fmt(m.xp)} / ${fmt(feedCost(m.lvl))}`);
    feedRow.innerHTML = '';
    if (m.lvl >= cap) return;
    const need = foodToNext(m);
    const chunk = Math.max(1, Math.ceil(feedCost(m.lvl) / 4));
    const mk = (label, mode, amount) => {
      const enough = G.state.res.food >= Math.min(amount, chunk);
      const b = h(`button.btn.${mode === 'level' ? 'orange' : 'green'}${enough ? '' : '.disabled'}`, {
        'data-tut': mode === 1 ? 'feed' : mode === 'level' ? 'feed-level' : 'feed-5',
        onclick: () => {
          if (!enough) {
            A.notEnough({ food: amount });
            return;
          }
          const res = A.feed(m, mode);
          afterFeed(res);
        },
      }, h('span', null, label, h('span.sub', null, costEl({ food: amount }))));
      return b;
    };
    feedRow.append(mk('Feed', 1, Math.min(chunk, need)), mk('Feed ×5', 5, Math.min(chunk * 5, need)), mk('Level Up', 'level', need));
  };

  const afterFeed = (res) => {
    if (!res || !res.spent) return;
    ms.play('eat');
    ms.burst('heart', 3);
    if (res.levels) {
      ms.burst('sparkle', 24);
      setTimeout(() => ms.play('happy'), 300);
    }
    if (res.evolved) {
      const ns = stageOf(m);
      ms.burst('flash', 1);
      ms.burst('star', 30);
      setTimeout(() => {
        curStage = ns;
        ms.setMonster(def, ns);
        ms.play('roar');
        ms.burst('confetti', 40);
        A.portraitInvalidate && A.portraitInvalidate(m.sp);
      }, 250);
    }
    renderLevel();
    if (curTab === 'info') renderContent();
  };

  const renderContent = () => {
    content.innerHTML = '';
    if (curTab === 'info') {
      const s = monStats(m);
      const statRow = (ic, k, v) => h('div.stat-row', null, icon(ic), h('span.k', null, k), h('span.v', null, v));
      content.appendChild(h('div.well.stat-grid', null,
        statRow('hp', 'HP', fmt(s.hp)), statRow('atk', 'ATK', fmt(s.atk)), statRow('def', 'DEF', fmt(s.def)), statRow('spd', 'SPD', fmt(s.spd)),
        statRow('crit', 'CRIT', `${Math.round(s.crit * 100)}%`), statRow('res', 'RES', `${Math.round(s.res * 100)}%`)));
      const home = m.hab ? byBuildingId(m.hab) : null;
      content.appendChild(h('div.row.well', { style: { padding: '0.5rem 0.7rem', margin: '0.6rem 0', flexWrap: 'wrap' } },
        h('span.chip', null, icon('battle'), `Power ${fmt(power(m))}`),
        h('span.chip', null, icon('gold'), `${fmt(Math.round(goldRate(m)))}/min`),
        h('span.chip', null, icon('habitat'), home ? BUILDINGS[home.type].name : 'No home'),
        h('div.grow'),
        h('button.btn.sm.blue', { onclick: () => A.moveMonster(m) }, icon('move'), home ? 'Move' : 'Place')));
      const weak = def.elements.flatMap((e) => weaknessesOf(e));
      content.appendChild(evolutionLine(m, A));
      if (weak.length) content.appendChild(h('div.row.small.muted', { style: { marginBottom: '0.5rem', flexWrap: 'wrap' } }, 'Weak to', [...new Set(weak)].map((e) => icon(`el_${e}`))));
      for (const id of def.abilities) {
        const ab = ABILITIES[id];
        content.appendChild(h('div.ability.well', { style: { marginBottom: '0.45rem' } },
          icon(ab.el === 'neutral' ? 'sparkle' : `el_${ab.el}`),
          h('div.grow', null, h('div.t', null, ab.name, h(`span.kind${ab.kind === 'ult' ? '.ult' : ''}`, null, ab.kind === 'basic' ? 'Basic' : ab.kind === 'ult' ? 'Ultimate' : 'Skill')), h('div.d', null, describeAbility(ab, statusNames))),
          ab.cd ? h('div.cd', null, icon('timer'), `${ab.cd}`) : null));
      }
      content.appendChild(h('div.small.muted', { style: { margin: '0.6rem 0.2rem 0.3rem', fontStyle: 'italic' } }, def.desc));
      content.appendChild(h('div.mstory', null, icon('heart'), h('span', null, monsterStory(m))));
      if (m.fav) {
        content.appendChild(h('div.small.muted', { style: { textAlign: 'right', marginTop: '0.3rem' } }, 'Favourites stay with you. Tap the heart to change that.'));
      } else if (ownedCount(m.sp) > 1 || m.lvl < 5) {
        content.appendChild(h('div.row', { style: { justifyContent: 'flex-end', marginTop: '0.3rem' } },
          h('button.btn.sm.red', { onclick: () => A.releaseMonster(m, scr) }, icon('shards'), `Release (+${releaseValue(m)} shards)`)));
      }
    } else if (curTab === 'rank') {
      const need = rankCost(m);
      const have = shardsFor(m.sp);
      const temple = readyBuilding('evolution_temple');
      content.appendChild(h('div.well', { style: { padding: '0.9rem', textAlign: 'center' } },
        h('div.row', { style: { justifyContent: 'center', gap: '0.3rem' } }, Array.from({ length: MAX_RANK }, (_, i) => icon(i < m.rank ? 'star' : 'starEmpty'))),
        h('div.display', { style: { fontSize: '1.4rem', margin: '0.4rem 0' } }, `Rank ${m.rank}`),
        h('div.small.muted', null, `Ranks add +9% stats each and raise the level cap to ${RANK_LEVEL_CAP[Math.min(MAX_RANK, m.rank + 1)]}.`),
        h('div', { style: { margin: '0.7rem 0' } }, bar(have / need, '#b58cff', `${have} / ${need} shards`)),
        m.rank >= MAX_RANK
          ? h('div.display', null, 'Max rank!')
          : !temple
            ? h('div.small', null, `Build the Evolution Temple (Lv ${featureLevel('ranks')}) to rank up.`)
            : h(`button.btn.purple${have >= need ? '' : '.disabled'}`, { onclick: () => { if (A.rankUp(m)) { ms.burst('star', 30); ms.play('roar'); renderContent(); renderLevel(); } } }, icon('crown'), 'Rank Up', costEl({ gold: rankGoldCost(m) }))));
      content.appendChild(h('div.small.muted', { style: { margin: '0.7rem 0.3rem' } }, 'Get shards by releasing duplicates, opening chests and event rewards.'));
    } else if (curTab === 'runes') {
      const slots = RUNE_SLOTS_BY_LEVEL.filter((l) => m.lvl >= l).length;
      const row = h('div.row', { style: { justifyContent: 'center', gap: '0.8rem', padding: '0.6rem' } });
      for (let i = 0; i < 3; i++) {
        const rid = m.runes[i];
        const r = rid ? G.state.inventory.runes.find((x) => x.id === rid) : null;
        const open = i < slots;
        row.appendChild(h('button.slot-card', { style: { width: '5rem', height: '5rem' }, onclick: () => { if (r) { A.unequipRune(m, r); renderContent(); } } },
          r ? runeIcon(r) : open ? h('div.center', { style: { height: '100%' } }, icon('plus')) : h('div.center.col', { style: { height: '100%', gap: 0 } }, icon('lock'), h('span.tiny', null, `Lv ${RUNE_SLOTS_BY_LEVEL[i]}`))));
      }
      content.appendChild(h('div.well', null, row));
      const inv = G.state.inventory.runes.filter((r) => !r.on);
      const list = h('div.row', { style: { flexWrap: 'wrap', gap: '0.5rem', padding: '0.6rem 0.2rem' } });
      for (const r of inv.sort((a, b) => b.tier - a.tier)) {
        list.appendChild(h('button.slot-card', { style: { width: '4.2rem', height: '4.2rem' }, onclick: () => { if (A.equipRune(m, r)) renderContent(); } }, runeIcon(r)));
      }
      if (!inv.length) list.appendChild(h('div.small.muted', null, 'No spare runes. Win campaign battles and open chests to find runes.'));
      content.append(h('div.display', { style: { margin: '0.6rem 0 0' } }, 'Inventory'), list);
    } else if (curTab === 'relic') {
      const cur = m.relic ? RELIC_BY_ID[m.relic] : null;
      content.appendChild(h('div.well', { style: { padding: '0.7rem' } }, cur ? h('div.row', null, icon('relic'), h('div.grow', null, h('div.display', null, cur.name), h('div.small.muted', null, cur.desc)), h('button.btn.sm.red', { onclick: () => { A.equipRelic(m, null); renderContent(); } }, 'Remove')) : h('div.small.muted', null, 'No relic equipped.')));
      for (const r of RELICS) {
        const owned = G.state.inventory.relics[r.id];
        if (!owned) continue;
        const usedBy = G.state.monsters.find((x) => x.relic === r.id);
        content.appendChild(h('div.ability.well', { style: { marginTop: '0.45rem' } }, icon('relic'), h('div.grow', null, h('div.t', null, r.name), h('div.d', null, r.desc)),
          usedBy && usedBy !== m ? h('span.chip.small', null, monsterName(usedBy)) : null,
          m.relic === r.id ? null : h('button.btn.sm.teal', { onclick: () => { A.equipRelic(m, r.id); renderContent(); } }, 'Equip')));
      }
      if (!Object.keys(G.state.inventory.relics).length) content.appendChild(h('div.small.muted', { style: { margin: '0.7rem' } }, 'Craft relics at the Relic Workshop.'));
    }
  };

  renderTabs();
  renderContent();
  renderLevel();
  scr.onOpen = () => G.engine.addViewport(viewport);
  scr.onClose = () => {
    G.engine.removeViewport(viewport);
    ms.dispose();
    const list = UI.find('monsters');
    if (list && list.refresh) list.refresh();
  };
  scr.refresh = () => {
    renderLevel();
    renderContent();
    nameText.textContent = monsterName(m);
  };
  UI.open(scr);
  return scr;
}

export function runeIcon(r) {
  const t = RUNE_TYPES[r.type];
  return h('div.center.col', { style: { height: '100%', gap: '0', background: t.color, color: '#fff' } }, icon(r.type === 'atk' ? 'atk' : r.type === 'hp' ? 'hp' : r.type === 'def' ? 'def' : 'spd'), h('span.display.ol-s', { style: { fontSize: '0.85rem' } }, `${RUNE_TIERS[r.tier - 1]}`));
}

function blend(a, b, k) {
  const pa = parseInt(a.slice(1), 16), pb = parseInt(b.slice(1), 16);
  const r = ((pa >> 16) & 255) * (1 - k) + ((pb >> 16) & 255) * k;
  const g = ((pa >> 8) & 255) * (1 - k) + ((pb >> 8) & 255) * k;
  const bl = (pa & 255) * (1 - k) + (pb & 255) * k;
  return `#${((1 << 24) + (Math.round(r) << 16) + (Math.round(g) << 8) + Math.round(bl)).toString(16).slice(1)}`;
}
export { blend };

// ---------------------------------------------------------------- rename
export function openRename(m, A, onDone) {
  const def = species(m.sp);
  const input = h('input.name-input', { type: 'text', maxLength: 14, value: m.nick || '', placeholder: def.name, autocomplete: 'off', spellcheck: 'false' });
  const scr = UI.panel({
    key: 'rename',
    title: 'Name your monster',
    ribbon: 'blue',
    kind: 'modal',
    hideHud: false,
    dim: 0.5,
    content: [
      h('div.dlg-text.small', null, `Every ${def.name} is one of a kind. What will you call this one?`),
      input,
      h('div.dlg-actions', null,
        m.nick ? h('button.btn.red', { onclick: () => save('') }, 'Reset') : null,
        h('button.btn.green', { onclick: () => save(input.value) }, icon('check'), 'Save')),
    ],
  });
  const save = (raw) => {
    const clean = String(raw || '').replace(/[<>]/g, '').replace(/\s+/g, ' ').trim().slice(0, 14);
    m.nick = clean && clean !== def.name ? clean : null;
    G.markDirty();
    A.sfx('pop');
    UI.close(scr);
    onDone && onDone();
    const list = UI.find('monsters');
    if (list && list.refresh) list.refresh();
  };
  input.addEventListener('keydown', (e) => {
    e.stopPropagation();
    if (e.key === 'Enter') save(input.value);
  });
  UI.open(scr);
  setTimeout(() => input.focus(), 60);
}
