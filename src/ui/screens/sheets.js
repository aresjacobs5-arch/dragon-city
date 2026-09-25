import { G } from '../../game/G.js';
import { UI } from '../ui.js';
import { h, icon, fmt, fmtTime, costEl, bar, setBar } from '../dom.js';
import { BUILDINGS } from '../../data/buildings.js';
import { CROPS, CROP_BY_ID } from '../../data/crops.js';
import { RARITIES } from '../../data/rarities.js';
import {
  isHabitat, habitatGold, habitatCap, habitatRate, habitatMonsters, habitatCapacity, nextLevelDef, upgradeBlocker,
  remainingSec, finishNowCost, cropReady, farmYield, farms, obstaclesFor, readyBuilding,
} from '../../systems/buildings.js';
import { species, monsterName, stageOf, sortMonsters } from '../../systems/monsters.js';
import { isUnlocked } from '../../systems/player.js';
import { breedingState } from '../../systems/breeding.js';
import { hatcherySlots } from '../../systems/hatchery.js';
import { goldCap, foodCap, gemsForTime } from '../../systems/resources.js';

let current = null;

export function closeSheet() {
  if (current) {
    current.el.remove();
    if (current.onClose) current.onClose();
    current = null;
  }
}

export function sheetOpen() {
  return current;
}

function openSheet(el, { onClose, update, key } = {}) {
  closeSheet();
  UI.layers.hud.appendChild(el);
  current = { el, onClose, update, key };
  return current;
}

export function updateSheet(dt) {
  if (current && current.update) current.update(dt);
}

function actionBtn(label, iconName, cls, fn, { disabled = false, sub = null } = {}) {
  const b = h(`button.btn.${cls}${disabled ? '.disabled' : ''}`, { onclick: (e) => { if (disabled) { b.classList.remove('shake-no'); void b.offsetWidth; b.classList.add('shake-no'); return; } fn(e); } }, iconName ? icon(iconName) : null, label, sub);
  return b;
}

function monSlot(m, onClick, A) {
  const card = h('button.slot-card.pe', { onclick: onClick });
  if (!m) {
    card.classList.add('empty');
    card.appendChild(icon('plus'));
    return card;
  }
  const img = h('img', { alt: '' });
  A.portrait(m.sp, stageOf(m)).then((u) => u && (img.src = u));
  card.append(img, h('div.lv.ol-s', null, `Lv${m.lvl}`));
  return card;
}

// --------------------------------------------------------------------------
// Building sheet
// --------------------------------------------------------------------------
export function openBuildingSheet(b, A) {
  const def = BUILDINGS[b.type];
  const el = h('div.panel.sheet.pe');
  const ribbon = h(`div.ribbon.ol${def.category === 'habitat' ? '.green' : def.category === 'decoration' ? '.pink' : '.blue'}`, null, def.name);
  el.append(ribbon, h('button.x-btn', { onclick: () => A.deselect() }, icon('close')));
  el.appendChild(h('div.lvl-tag.display', null, def.levels.length > 1 ? `Level ${b.level}` : ''));
  const stats = h('div.stats');
  const mons = h('div.mons');
  const actions = h('div.actions');
  el.append(stats, mons, actions);
  let upd = null;

  const renderBusy = () => {
    stats.innerHTML = '';
    actions.innerHTML = '';
    mons.innerHTML = '';
    const left = remainingSec(b);
    const label = b.state === 'building' ? 'Building' : 'Upgrading';
    const t = h('b', null, fmtTime(left));
    stats.appendChild(h('div.stat.well', null, icon('hammer'), `${label}…`, t));
    const gems = finishNowCost(b);
    actions.appendChild(actionBtn(gems ? 'Finish' : 'Finish Free', null, 'teal', () => A.finishBuilding(b), { sub: gems ? costEl({ gems }) : null }));
    if (A.adsReady() && left > 30) actions.appendChild(actionBtn('Speed Up', 'film', 'purple', () => A.adSpeedBuilding(b)));
    upd = () => {
      const l = remainingSec(b);
      t.textContent = fmtTime(l);
      if (b.state === 'ready') {
        A.deselect();
        A.select(b.id);
      }
    };
  };

  const upgradeBtn = () => {
    const next = nextLevelDef(b);
    if (!next) return null;
    const block = upgradeBlocker(b);
    const lockedLvl = block && block.reason === 'level';
    return actionBtn(lockedLvl ? `Lv ${block.level}` : 'Upgrade', 'up', 'gold', () => A.upgradeBuilding(b), {
      disabled: !!block && block.reason !== 'cost',
      sub: lockedLvl ? null : costEl(next.cost),
    });
  };
  const moveBtn = () => actionBtn('Move', 'move', 'blue', () => A.moveBuilding(b));

  const render = () => {
    stats.innerHTML = '';
    actions.innerHTML = '';
    mons.innerHTML = '';
    upd = null;
    if (b.state === 'building' || b.state === 'upgrading') {
      renderBusy();
      if (b.state === 'upgrading' && !isHabitat(b)) return;
      if (b.state === 'building') return;
    }
    if (isHabitat(b)) {
      const goldEl = h('b', null, '0');
      const cap = habitatCap(b);
      stats.append(
        h('div.stat.well', null, icon('gold'), goldEl, h('span.muted.small', null, `/ ${fmt(cap)}`)),
        h('div.stat.well', null, icon('timer'), h('b', null, `${fmt(Math.round(habitatRate(b)))}`), h('span.muted.small', null, '/min')),
        h('div.stat.well', null, icon('paw'), h('b', null, `${habitatMonsters(b).length}/${habitatCapacity(b)}`)));
      const list = habitatMonsters(b);
      for (let i = 0; i < habitatCapacity(b); i++) {
        const m = list[i];
        mons.appendChild(monSlot(m, () => (m ? A.monsterDetail(m) : A.pickForHabitat(b)), A));
      }
      if (b.state !== 'upgrading') {
        actions.append(actionBtn('Collect', 'gold', 'gold', (e) => A.collectHabitat(b.id, e.currentTarget)));
        const ub = upgradeBtn();
        if (ub) actions.appendChild(ub);
      }
      actions.appendChild(moveBtn());
      const prev = upd;
      upd = () => {
        if (prev) prev();
        goldEl.textContent = fmt(habitatGold(b));
      };
      return;
    }
    if (b.type === 'farm') {
      const yieldK = farmYield(b);
      if (b.crop) {
        const c = CROP_BY_ID[b.crop];
        if (cropReady(b)) {
          stats.appendChild(h('div.stat.well', null, icon(`crop_${c.id}`), h('b', null, c.name), 'is ready!'));
          actions.appendChild(actionBtn('Harvest', 'food', 'green', (e) => A.harvest(b.id, e.currentTarget)));
        } else {
          const t = h('b', null, '');
          stats.append(h('div.stat.well', null, icon(`crop_${c.id}`), h('b', null, c.name)), h('div.stat.well', null, icon('timer'), t), h('div.stat.well', null, icon('food'), h('b', null, `+${fmt(Math.round(c.food * yieldK))}`)));
          const gems = gemsForTime(Math.ceil((b.cropUntil - G.now()) / 1000));
          actions.appendChild(actionBtn('Grow Now', null, 'teal', () => A.finishCrop(b), { sub: costEl({ gems }) }));
          upd = () => {
            const left = Math.ceil((b.cropUntil - G.now()) / 1000);
            t.textContent = fmtTime(left);
            if (left <= 0) render();
          };
          upd();
        }
      } else {
        stats.appendChild(h('div.stat.well', null, icon('farm'), 'Ready to plant'));
        actions.appendChild(actionBtn('Plant', 'crop_berries', 'green', () => A.cropPicker(b)));
      }
      if (isUnlocked('bulk_farming') && farms().length > 1) {
        actions.appendChild(actionBtn('All', 'crop_roots', 'orange', () => A.cropPicker(null)));
      }
      const ub = upgradeBtn();
      if (ub) actions.appendChild(ub);
      actions.appendChild(moveBtn());
      return;
    }
    if (b.type === 'hatchery') {
      stats.appendChild(h('div.stat.well', null, icon('egg'), h('b', null, `${G.state.hatchery.length}/${hatcherySlots()}`), 'eggs'));
      actions.appendChild(actionBtn('Open', 'egg', 'green', () => A.openHatchery()));
    } else if (b.type === 'breeding') {
      const bs = breedingState();
      if (bs) stats.appendChild(h('div.stat.well', null, icon('heart'), bs.done ? 'Egg ready!' : `Breeding… ${fmtTime(bs.left)}`));
      else stats.appendChild(h('div.stat.well', null, icon('heart'), 'Ready to breed'));
      actions.appendChild(actionBtn(bs && bs.done ? 'Collect' : 'Breed', 'breed', 'pink', () => (bs && bs.done ? A.collectBreeding() : A.breed())));
    } else if (b.type === 'gold_storage') {
      stats.appendChild(h('div.stat.well', null, icon('gold'), 'Capacity', h('b', null, fmt(goldCap()))));
    } else if (b.type === 'food_storage') {
      stats.appendChild(h('div.stat.well', null, icon('food'), 'Capacity', h('b', null, fmt(foodCap()))));
    } else if (b.type === 'academy') {
      const ac = G.state.academy;
      if (ac) {
        const m = G.state.monsters.find((x) => x.id === ac.mon);
        const t = h('b', null, '');
        stats.appendChild(h('div.stat.well', null, icon('up'), m ? monsterName(m) : '—', 'training', t));
        upd = () => (t.textContent = fmtTime(Math.ceil((ac.until - G.now()) / 1000)));
        upd();
      } else {
        stats.appendChild(h('div.stat.well', null, icon('up'), 'Train a monster +1 level for free'));
        actions.appendChild(actionBtn('Train', 'up', 'green', () => A.academyPick()));
      }
    } else if (b.type === 'evolution_temple') {
      stats.appendChild(h('div.stat.well', null, icon('crown'), 'Rank up monsters with shards'));
      actions.appendChild(actionBtn('Ranks', 'crown', 'purple', () => A.monsters('rank')));
    } else if (b.type === 'challenge_tower') {
      stats.appendChild(h('div.stat.well', null, icon('tower'), 'Floor', h('b', null, `${G.state.tower.floor + 1}`)));
      actions.appendChild(actionBtn('Climb', 'battle', 'orange', () => A.tower()));
    } else if (b.type === 'rune_forge') {
      stats.appendChild(h('div.stat.well', null, icon('rune'), h('b', null, `${G.state.inventory.runes.length}`), 'runes'));
      actions.appendChild(actionBtn('Forge', 'rune', 'purple', () => A.runes()));
    } else if (b.type === 'event_portal') {
      actions.appendChild(actionBtn('Event', 'events', 'pink', () => A.events()));
    } else if (b.type === 'relic_workshop') {
      stats.appendChild(h('div.stat.well', null, icon('relicFrags'), h('b', null, fmt(G.state.res.relicFrags)), 'fragments'));
      actions.appendChild(actionBtn('Relics', 'relic', 'teal', () => A.relics()));
    } else if (b.type === 'ancient_shrine') {
      actions.appendChild(actionBtn('Summon', 'sparkle', 'teal', () => A.shrine()));
    } else if (BUILDINGS[b.type].category === 'decoration') {
      stats.appendChild(h('div.stat.well', null, icon('deco'), 'Makes your island lovelier'));
      actions.appendChild(actionBtn('Sell', null, 'red', () => A.sellBuilding(b)));
    }
    if (b.state !== 'upgrading') {
      const ub = upgradeBtn();
      if (ub) actions.appendChild(ub);
    }
    actions.appendChild(moveBtn());
  };
  render();
  const s = openSheet(el, { key: `b:${b.id}`, update: () => upd && upd() });
  s.rerender = render;
  return s;
}

export function rerenderSheet() {
  if (current && current.rerender) current.rerender();
}

// --------------------------------------------------------------------------
// Obstacle sheet
// --------------------------------------------------------------------------
const OB_NAMES = { tree: 'Tree', bush: 'Bush', stump: 'Old Stump', rock: 'Rock', rockBig: 'Boulder', ruin: 'Ancient Ruin', arch: 'Ruined Arch' };
export function openObstacleSheet(o, A) {
  const el = h('div.panel.sheet.pe');
  el.append(h('div.ribbon.ol.gold', null, OB_NAMES[o.kind] || 'Obstacle'), h('button.x-btn', { onclick: () => A.deselect() }, icon('close')));
  const stats = h('div.stats');
  const actions = h('div.actions');
  el.append(stats, actions);
  let upd = null;
  const render = () => {
    stats.innerHTML = '';
    actions.innerHTML = '';
    const until = G.state.obstacles.clearing[o.id];
    if (until) {
      const t = h('b', null, '');
      stats.appendChild(h('div.stat.well', null, icon('hammer'), 'Clearing…', t));
      const gems = gemsForTime(Math.ceil((until - G.now()) / 1000));
      actions.appendChild(actionBtn(gems ? 'Finish' : 'Finish Free', null, 'teal', () => A.finishClearing(o), { sub: gems ? costEl({ gems }) : null }));
      upd = () => {
        const l = Math.ceil((until - G.now()) / 1000);
        t.textContent = fmtTime(l);
        if (l <= 0 || !G.state.obstacles.clearing[o.id]) A.deselect();
      };
      upd();
    } else {
      stats.append(h('div.stat.well', null, icon('timer'), h('b', null, fmtTime(o.time))), h('div.stat.well', null, icon('xp'), h('b', null, `+${o.xp}`)), o.gems ? h('div.stat.well', null, icon('gems'), h('b', null, '?')) : null);
      actions.appendChild(actionBtn('Clear', 'hammer', 'green', () => A.clearObstacle(o), { sub: costEl({ gold: o.cost }) }));
    }
  };
  render();
  const s = openSheet(el, { key: `o:${o.id}`, update: () => upd && upd() });
  s.rerender = render;
  return s;
}

// --------------------------------------------------------------------------
// Placement controls (confirm / cancel under the ghost)
// --------------------------------------------------------------------------
export function openPlacementSheet(A, { title = 'Place building', onConfirm, onCancel, cost = null }) {
  const hint = h('div.place-hint.pe', null, 'Drag to move · ', title);
  const ok = h('button.btn.round.green', { onclick: () => onConfirm() }, icon('check'));
  const no = h('button.btn.round.red', { onclick: () => onCancel() }, icon('close'));
  const ctl = h('div.place-ctl', null, no, ok);
  const wrap = h('div', null, hint, ctl);
  ctl.style.position = 'absolute';
  const s = openSheet(wrap, {
    key: 'placing',
    update: () => {
      const p = G.world && G.world.placing;
      if (!p) return;
      const out = G.engine.project(p.group.position.clone().setY(0), G.world.camera);
      ctl.style.left = `${out.x}px`;
      ctl.style.top = `${out.y + UI.rem(2.2)}px`;
      ctl.style.transform = 'translateX(-50%)';
      ok.classList.toggle('disabled', !p.valid);
    },
  });
  return s;
}

// --------------------------------------------------------------------------
// Crop picker
// --------------------------------------------------------------------------
export function openCropPicker(farm, A) {
  const lvl = G.state.player.level;
  const yieldK = farm ? farmYield(farm) : 1;
  const grid = h('div.shop.items.scroll', { style: { display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(9.5rem, 1fr))', gap: '0.8rem', maxHeight: '60vh' } });
  const scr = UI.panel({ key: 'crops', title: farm ? 'Plant a Crop' : 'Plant All', kind: 'modal', ribbon: 'green', cls: 'wide', hideHud: false, dim: 0.35, content: [grid] });
  for (const c of CROPS) {
    const locked = lvl < c.unlock;
    const card = h(`div.scard${locked ? '.locked' : ''}`, null,
      h('div.art', { style: { '--sc': c.color, height: '6rem' } }, h('div.center', { style: { position: 'absolute', inset: 0 } }, icon(`crop_${c.id}`, 'big'))),
      h('div.nm', null, c.name),
      h('div.meta', null, icon('timer'), fmtTime(c.time), icon('food'), `+${fmt(Math.round(c.food * yieldK))}`),
      locked
        ? h('div.lockover', null, icon('lock'), h('div.ol.display', null, `Lv ${c.unlock}`))
        : h('button.btn.sm.gold.buy', { onclick: () => { UI.close(scr); A.plant(farm, c.id); } }, costEl({ gold: c.cost })));
    card.querySelector('.art .ico').style.cssText = 'width:4.2rem;height:4.2rem';
    grid.appendChild(card);
  }
  UI.open(scr);
}

// --------------------------------------------------------------------------
// Monster picker (for habitats, academy, breeding parents, teams)
// --------------------------------------------------------------------------
export function openMonsterPicker(A, { title, filter = () => true, onPick, note = null, cardExtra = null }) {
  const list = sortMonsters(G.state.monsters.filter(filter), 'power');
  const grid = h('div.mgrid');
  const body = h('div.scroll', { style: { maxHeight: '62vh' } }, grid);
  const scr = UI.panel({ key: 'picker', title, kind: 'modal', ribbon: 'blue', cls: 'wide', hideHud: false, dim: 0.4, content: [note ? h('div.dlg-text.small', null, note) : null, body] });
  if (!list.length) grid.appendChild(h('div.dlg-text.muted', { style: { gridColumn: '1 / -1' } }, 'No suitable monsters yet.'));
  for (const m of list) {
    const card = A.monsterCard(m, () => {
      UI.close(scr);
      onPick(m);
    });
    if (cardExtra) cardExtra(m, card);
    grid.appendChild(card);
  }
  UI.open(scr);
}
