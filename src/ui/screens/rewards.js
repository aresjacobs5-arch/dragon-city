import { G } from '../../game/G.js';
import { UI } from '../ui.js';
import { h, icon, fmt, fmtTime, costEl, bar, append } from '../dom.js';
import { DAILY_REWARDS, WHEEL, CHESTS, RUNE_TYPES, RUNE_TIERS } from '../../data/rewards.js';
import { UNLOCKS, xpToNext } from '../../data/unlocks.js';
import { ISLAND_BY_ID } from '../../data/islands.js';
import { loginStatus, wheelStatus, wheelOdds, chestOdds } from '../../systems/rewards.js';
import { currentEvent, milestoneStatus, timeLeft, eventPoints } from '../../systems/events.js';
import { species } from '../../systems/monsters.js';
import { islandUnlockBlocker } from '../../systems/buildings.js';
import { runeIcon } from './monsters.js';

const UNLOCK_ICON = (f) => {
  if (f.startsWith('element_')) return `el_${f.slice(8)}`;
  if (f.startsWith('island_')) return 'island';
  return { habitats: 'habitat', farm: 'farm', hatchery: 'egg', campaign: 'map', daily_quests: 'quests', breeding: 'breed', gold_storage: 'gold', bulk_farming: 'farm', food_storage: 'food', events: 'events', academy: 'up', spin_wheel: 'wheel', auto_battle: 'auto', battle_speed_4x: 'speed', ranks: 'crown', challenge_tower: 'tower', runes: 'rune', rare_breeding: 'tokens', relics: 'relic', legendary_breeding: 'crown', ancient_shrine: 'sparkle' }[f] || 'star';
};

export function rewardItemEl(it, A, delay = 0) {
  let pic, n = '';
  if (['gold', 'food', 'gems', 'xp', 'energy', 'tokens', 'relicFrags', 'runeDust'].includes(it.kind)) {
    pic = icon(it.kind);
    n = `+${fmt(it.n)}`;
  } else if (it.kind === 'egg') {
    pic = h('img', { alt: '' });
    A.eggThumb(it.sp).then((u) => u && (pic.src = u));
    n = 'Egg';
  } else if (it.kind === 'chest') {
    pic = icon(`chest_${it.id}`);
    n = CHESTS[it.id].name.replace(' Chest', '');
  } else if (it.kind === 'rune') {
    pic = h('div.slot-card', { style: { width: '3.2rem', height: '3.2rem' } }, runeIcon(it.rune));
    n = `${RUNE_TYPES[it.rune.type].name} ${RUNE_TIERS[it.rune.tier - 1]}`;
  } else if (it.kind === 'shards') {
    pic = icon('shards');
    n = `+${it.n}`;
  } else {
    pic = icon('gift');
  }
  const el = h('div.rw-item', null, pic, h('div.n', null, n));
  el.style.animationDelay = `${delay}s`;
  return el;
}

// Generic celebration popup for granted items.
export function showRewards(items, A, { title = 'Rewards!', sub = null, onClose = null } = {}) {
  const row = h('div.reward-row');
  items.forEach((it, i) => row.appendChild(rewardItemEl(it, A, 0.1 + i * 0.08)));
  const scr = { key: 'rewards', dim: 0.7, hideHud: true, el: h('div.scr') };
  const cont = h('button.btn.lg.green', { onclick: () => { UI.close(scr); onClose && onClose(); } }, 'Collect');
  scr.el.appendChild(h('div.celebrate', null, h('div.rays'), h('div.big-title.gold', null, title), sub ? h('div.ol.display', { style: { fontSize: '1.4rem', zIndex: 2 } }, sub) : null, row, cont));
  A.sfx('reward');
  UI.open(scr);
  return scr;
}

export function openLevelUp(level, unlocks, reward, A, onClose) {
  const scr = { key: 'levelup', dim: 0.72, hideHud: true, el: h('div.scr') };
  const list = h('div.unlock-list');
  unlocks.forEach((u, i) => {
    const c = h('div.panel.unlock-card', null, icon(UNLOCK_ICON(u.feature)), h('div', null, h('div.k', null, 'Unlocked'), h('div.t', null, u.label)));
    c.style.animationDelay = `${0.35 + i * 0.12}s`;
    list.appendChild(c);
  });
  const row = h('div.reward-row');
  [{ kind: 'gold', n: reward.gold }, { kind: 'food', n: reward.food }, { kind: 'gems', n: reward.gems }, { kind: 'energy', n: 0 }].filter((x) => x.n).forEach((it, i) => row.appendChild(rewardItemEl(it, A, 0.5 + i * 0.1)));
  const next = UNLOCKS.find((u) => u.level > level);
  scr.el.appendChild(h('div.celebrate', null, h('div.rays'),
    h('div.big-title.gold', null, 'LEVEL UP!'),
    h('div.display.ol', { style: { fontSize: '5.5rem', lineHeight: 1, zIndex: 2, animation: 'titleIn .6s .15s cubic-bezier(.3,1.7,.5,1) backwards' } }, `${level}`),
    list, row,
    next ? h('div.ol-s.display', { style: { zIndex: 2, fontSize: '1rem' } }, `Next: ${next.label} at level ${next.level}`) : null,
    h('button.btn.lg.green', { onclick: () => { UI.close(scr); onClose && onClose(); } }, 'Awesome!')));
  UI.open(scr);
  A.sfx('levelup');
  return scr;
}

export function openWelcomeBack(off, A, onCollect) {
  const scr = UI.panel({ key: 'welcome', title: 'Welcome Back!', ribbon: 'gold', kind: 'modal', close: false, dim: 0.65, content: [] });
  const hrs = off.away / 3600;
  const awayTxt = hrs >= 1 ? `${Math.floor(hrs)}h ${Math.floor((off.away % 3600) / 60)}m` : `${Math.floor(off.away / 60)}m`;
  const row = h('div.reward-row');
  if (off.gold > 0) row.appendChild(rewardItemEl({ kind: 'gold', n: off.gold }, A, 0.15));
  const lines = [];
  if (off.crops) lines.push(h('div.chip', null, icon('food'), `${off.crops} crop${off.crops > 1 ? 's' : ''} ready`));
  if (off.eggs) lines.push(h('div.chip', null, icon('egg'), `${off.eggs} egg${off.eggs > 1 ? 's' : ''} ready to hatch`));
  if (off.breed) lines.push(h('div.chip', null, icon('heart'), 'Breeding complete'));
  const acts = h('div.dlg-actions');
  const collect = (mult) => {
    UI.close(scr);
    onCollect(mult);
  };
  if (off.gold > 0) {
    acts.appendChild(h('button.btn.lg.green', { onclick: () => collect(1) }, 'Collect'));
    if (A.adsReady()) acts.appendChild(h('button.btn.lg.purple', { onclick: () => A.rewardedAd('offline_x2', () => collect(2)) }, icon('film'), '×2'));
  } else acts.appendChild(h('button.btn.lg.green', { onclick: () => collect(1) }, 'Continue'));
  append(scr.panel, [
    h('div.dlg-text', null, `While you were away (${awayTxt}) your monsters kept busy:`),
    row,
    h('div.row', { style: { justifyContent: 'center', flexWrap: 'wrap' } }, lines),
    off.away > 36000 ? h('div.small.muted', { style: { textAlign: 'center' } }, 'Habitats store gold up to their capacity — upgrade them to earn more while away.') : null,
    acts]);
  UI.open(scr);
  return scr;
}

export function openDaily(A) {
  const st = loginStatus();
  const grid = h('div.days');
  DAILY_REWARDS.forEach((d, i) => {
    const day = i + 1;
    const done = st.claimedToday ? day <= st.day : day < st.day;
    const today = !st.claimedToday && day === st.day;
    const r = d.reward;
    const k = Object.keys(r)[0];
    const ic = k === 'egg' ? 'egg' : k;
    const label = k === 'egg' ? `${r.egg[0].toUpperCase()}${r.egg.slice(1)} Egg` : fmt(r[k]);
    grid.appendChild(h(`div.day${done ? '.done' : ''}${today ? '.today' : ''}${d.big ? '.big' : ''}`, null, h('div.d', null, `Day ${day}`), icon(ic), h('div.n', null, label)));
  });
  const btn = st.claimedToday
    ? h('button.btn.lg.disabled', null, 'Come back tomorrow!')
    : h('button.btn.lg.green', { onclick: () => { UI.close(scr); A.claimDaily(); } }, 'Claim');
  const scr = UI.panel({ key: 'daily', title: 'Daily Rewards', ribbon: 'pink', kind: 'modal', cls: 'wide', content: [grid, h('div.dlg-actions', null, btn)] });
  UI.open(scr);
  return scr;
}

// ---------------- Lucky wheel
export function openWheel(A) {
  const segs = WHEEL;
  const n = segs.length;
  const colors = ['#ff5a4a', '#ffc83d', '#3fa9f5', '#62c63c', '#ff8fd8', '#b58cff', '#ff8a2a', '#2fc6e0'];
  let svg = `<svg class="wheel" viewBox="-110 -110 220 220">`;
  for (let i = 0; i < n; i++) {
    const a0 = (i / n) * Math.PI * 2 - Math.PI / 2 - Math.PI / n, a1 = ((i + 1) / n) * Math.PI * 2 - Math.PI / 2 - Math.PI / n;
    const x0 = Math.cos(a0) * 100, y0 = Math.sin(a0) * 100, x1 = Math.cos(a1) * 100, y1 = Math.sin(a1) * 100;
    svg += `<path d="M0 0L${x0.toFixed(1)} ${y0.toFixed(1)}A100 100 0 0 1 ${x1.toFixed(1)} ${y1.toFixed(1)}Z" fill="${colors[i % colors.length]}" stroke="#2a1a2f" stroke-width="3"/>`;
  }
  svg += `<circle r="100" fill="none" stroke="#2a1a2f" stroke-width="5"/><circle r="18" fill="#ffc83d" stroke="#2a1a2f" stroke-width="4"/></svg>`;
  const wrap = h('div.wheel-wrap', { html: svg });
  // icons on segments
  segs.forEach((s, i) => {
    const a = (i / n) * Math.PI * 2 - Math.PI / 2;
    const k = Object.keys(s.reward)[0];
    const ic = icon(k === 'egg' ? 'egg' : k === 'chest' ? `chest_${s.reward.chest}` : k);
    const lab = h('div', { style: { position: 'absolute', left: `${50 + Math.cos(a) * 31}%`, top: `${50 + Math.sin(a) * 31}%`, transform: `translate(-50%,-50%) rotate(${(a + Math.PI / 2) * 57.3}deg)`, display: 'flex', flexDirection: 'column', alignItems: 'center' } }, ic, h('span.ol-s.display', { style: { fontSize: '0.8rem' } }, k === 'egg' ? 'Egg' : k === 'chest' ? 'Chest' : fmt(s.reward[k])));
    ic.style.cssText = 'width:2rem;height:2rem';
    wrap.querySelector('svg').parentNode.appendChild(lab);
  });
  const spinLayer = h('div', { style: { position: 'absolute', inset: 0, transition: 'transform 4.2s cubic-bezier(.12,.7,.1,1)' } });
  while (wrap.firstChild) spinLayer.appendChild(wrap.firstChild);
  wrap.appendChild(spinLayer);
  wrap.appendChild(h('div.pointer', null, icon('arrowL')));
  wrap.querySelector('.pointer .ico').style.cssText = 'width:3rem;height:3rem;transform:rotate(-90deg)';
  const st = wheelStatus();
  const acts = h('div.dlg-actions');
  let angle = 0;
  const spin = (viaAd) => {
    const res = A.spinWheel(viaAd);
    if (!res) return;
    acts.innerHTML = '';
    const target = 360 * 5 + (360 - (res.idx / n) * 360);
    angle = angle - (angle % 360) + target;
    spinLayer.style.transform = `rotate(${angle}deg)`;
    A.sfx('spin');
    setTimeout(() => {
      A.grantAndShow(res.seg.reward, 'Lucky Spin!');
      UI.close(scr);
    }, 4400);
  };
  if (st.free) acts.appendChild(h('button.btn.lg.green', { onclick: () => spin(false) }, 'SPIN!'));
  else if (st.adSpin && A.adsReady()) acts.appendChild(h('button.btn.lg.purple', { onclick: () => A.rewardedAd('wheel', () => spin(true)) }, icon('film'), 'Extra Spin'));
  else acts.appendChild(h('button.btn.lg.disabled', null, 'Next spin tomorrow'));
  const odds = h('div.odds', null, wheelOdds().map((o) => {
    const k = Object.keys(o.reward)[0];
    const RES = { gold: 'Gold', food: 'Food', gems: 'Gems', energy: 'Energy', tokens: 'Breeding Token' };
    return h('span', null, `${k === 'egg' ? `${RARITY_NAME[o.reward.egg] || ''} Egg`.trim() : k === 'chest' ? `${RARITY_NAME[o.reward.chest] || o.reward.chest[0].toUpperCase() + o.reward.chest.slice(1)} Chest` : `${fmt(o.reward[k])} ${RES[k] || k}`}: ${(o.p * 100).toFixed(0)}%`);
  }));
  const scr = UI.panel({ key: 'wheel', title: 'Lucky Wheel', ribbon: 'purple', kind: 'modal', content: [wrap, acts, h('details', null, h('summary.small.muted', null, 'Odds'), odds)] });
  UI.open(scr);
  return scr;
}

// ---------------- Chests
const RARITY_NAME = { common: 'Common', uncommon: 'Uncommon', rare: 'Rare', epic: 'Epic', legendary: 'Legendary', mythic: 'Mythic' };
function chestRowLabel(o) {
  if (o.egg) return `${RARITY_NAME[o.egg] || ''} Egg`;
  if (o.rune) return 'Rune';
  if (o.shards) return 'Shards';
  if (o.gems) return 'Gems';
  if (o.food) return 'Food';
  return 'Gold';
}
const pct = (p) => (p >= 0.995 ? '100%' : p < 0.01 ? '<1%' : `${Math.round(p * 100)}%`);

export function openChests(A) {
  const list = h('div.row', { style: { gap: '1rem', justifyContent: 'center', flexWrap: 'wrap', padding: '0.6rem' } });
  const scr = UI.panel({ key: 'chests', title: 'Chests', ribbon: 'gold', kind: 'modal', cls: 'wide', content: [list] });
  const render = () => {
    list.innerHTML = '';
    const inv = G.state.inventory.chests;
    let any = false;
    for (const id of Object.keys(CHESTS)) {
      const n = inv[id] || 0;
      if (!n) continue;
      any = true;
      const c = CHESTS[id];
      const ic = icon(`chest_${id}`);
      ic.style.cssText = 'width:5rem;height:5rem';
      list.appendChild(h('div.egg-slot', { style: { width: '10rem' } }, h('span.chip', null, `×${n}`), ic, h('div.t', null, c.name),
        h('button.btn.sm.gold.wide', { onclick: () => { A.openChest(id); render(); if (!Object.values(G.state.inventory.chests).some(Boolean)) UI.close(scr); } }, 'Open'),
        h('details', null, h('summary.tiny.muted', null, 'Odds'),
          h('div.odds', null, h('div.tiny.muted', null, `${c.rolls} different rewards`), ...chestOdds(id).map((o) => h('span', null, `${chestRowLabel(o)}: ${pct(o.p)}`))))));
    }
    if (!any) list.appendChild(h('div.dlg-text.muted', null, 'No chests. Earn them from quests, stars and the campaign!'));
  };
  render();
  UI.open(scr);
  return scr;
}

// ---------------- Events
export function openEvents(A) {
  const ev = currentEvent();
  const body = h('div.col');
  const scr = UI.panel({ key: 'events', title: ev.name, ribbon: 'pink', kind: 'modal', cls: 'wide', content: [body] });
  const render = () => {
    body.innerHTML = '';
    const pts = eventPoints();
    body.append(
      h('div.row.well', { style: { padding: '0.7rem' } }, icon('events'), h('div.grow', null, h('div', null, ev.blurb), h('div.small.muted', null, `Ends in ${fmtTime(timeLeft())}`)), h('div.chip', { style: { fontSize: '1.1rem' } }, icon('event'), h('b', null, fmt(pts)), ev.currency)));
    const ms = milestoneStatus();
    const max = ms[ms.length - 1].at;
    body.appendChild(bar(pts / max, '#ff6aa0', `${fmt(pts)} / ${fmt(max)}`));
    const list = h('div.qlist.scroll', { style: { maxHeight: '38vh' } });
    for (const m of ms) {
      const k = Object.keys(m.reward)[0];
      const cap = (x) => `${x[0].toUpperCase()}${x.slice(1)}`;
      const RES = { gold: 'Gold', food: 'Food', gems: 'Gems', tokens: 'Breeding Tokens', relicFrags: 'Relic Fragments', runeDust: 'Rune Dust', energy: 'Energy' };
      const label = k === 'species' ? species(m.reward.species).name : k === 'chest' ? `${cap(m.reward.chest)} Chest` : k === 'egg' ? `${cap(m.reward.egg)} Egg` : `${fmt(m.reward[k])} ${RES[k] || cap(k)}`;
      list.appendChild(h(`div.qrow.well${m.claimed ? '.claimed' : m.reached ? '.ready' : ''}`, null, icon(k === 'species' ? 'crown' : k === 'egg' ? 'egg' : k === 'chest' ? `chest_${m.reward.chest}` : k),
        h('div.txt', null, h('div.t', null, label), h('div.small.muted', null, `${fmt(m.at)} ${ev.currency}`)),
        m.claimed ? h('span.chip', null, 'Claimed') : m.reached ? h('button.btn.sm.green', { onclick: () => { A.claimEventMilestone(m.i); render(); } }, 'Claim') : icon('lock')));
    }
    body.appendChild(list);
    if (ev.type === 'boss' || ev.type === 'element') {
      const acts = h('div.dlg-actions');
      ev.tiers.forEach((lvl, i) => acts.appendChild(h('button.btn.orange', { onclick: () => { UI.close(scr); A.eventBattle(ev, i); } }, `Tier ${i + 1}`, h('span.small', null, ` Lv${lvl}`))));
      body.appendChild(acts);
    }
  };
  render();
  UI.open(scr);
  return scr;
}

// ---------------- Settings
export function openSettings(A) {
  const S = G.state.settings;
  const slider = (key, label, ic) => {
    const inp = h('input.slider', { type: 'range', min: 0, max: 100, value: Math.round(S[key] * 100) });
    inp.style.setProperty('--k', `${S[key] * 100}%`);
    inp.addEventListener('input', () => {
      S[key] = inp.value / 100;
      inp.style.setProperty('--k', `${inp.value}%`);
      A.applyAudioSettings();
      G.markDirty();
    });
    return h('div.set-row.well', null, icon(ic), h('span.lbl', null, label), inp);
  };
  const muteT = h(`button.toggle${S.muted ? '.on' : ''}`, { onclick: () => { S.muted = !S.muted; muteT.classList.toggle('on', S.muted); A.applyAudioSettings(); G.markDirty(); } });
  const scr = UI.panel({
    key: 'settings', title: 'Settings', ribbon: 'blue', kind: 'modal', content: [
      slider('music', 'Music', 'music'),
      slider('sfx', 'Sounds', 'sound'),
      h('div.set-row.well', null, icon('mute'), h('span.lbl', null, 'Mute all'), h('div.grow'), muteT),
      h('div.set-row.well', null, icon('info'), h('div.grow.small', null, 'Progress saves automatically. ', h('span.muted', null, `Tamer since ${new Date(G.state.created).toLocaleDateString()}`))),
      h('div.dlg-actions', null, h('button.btn.sm.red', { onclick: () => A.resetProgress() }, 'Reset progress')),
      h('div.tiny.muted', { style: { textAlign: 'center' } }, 'Beasthaven · Fonts: Lilita One, Titan One, Nunito (SIL OFL)'),
    ],
  });
  UI.open(scr);
  return scr;
}

// ---------------- Profile / level info
export function openProfile(A) {
  const p = G.state.player;
  const need = xpToNext(p.level);
  const upcoming = UNLOCKS.filter((u) => u.level > p.level).slice(0, 6);
  const scr = UI.panel({
    key: 'profile', title: `Level ${p.level}`, ribbon: 'blue', kind: 'modal', content: [
      bar(p.xp / need, '#ffd84a', `${fmt(p.xp)} / ${fmt(need)} XP`),
      h('div.display', null, 'Coming up'),
      h('div.col', null, upcoming.map((u) => h('div.row.well', { style: { padding: '0.45rem 0.7rem' } }, icon(UNLOCK_ICON(u.feature)), h('div.grow', null, u.label), h('span.chip', null, `Lv ${u.level}`)))),
    ],
  });
  UI.open(scr);
}

// ---------------- Locked island
export function openIslandInfo(id, A) {
  const def = ISLAND_BY_ID[id];
  const block = islandUnlockBlocker(id);
  const acts = h('div.dlg-actions');
  if (!block || block.reason === 'cost') acts.appendChild(h(`button.btn.lg.gold${block ? '.disabled' : ''}`, { onclick: () => { if (!block) { UI.close(scr); A.unlockIsland(id); } else A.notEnough({ gold: def.cost }); } }, 'Unlock', costEl({ gold: def.cost })));
  else acts.appendChild(h('button.btn.lg.disabled', null, `Reach level ${def.unlockLevel}`));
  const scr = UI.panel({
    key: 'island', title: def.name, ribbon: 'teal', kind: 'modal', content: [
      h('div.dlg-text', null, 'A new floating island waits beyond the clouds — more room for habitats, farms and wonders.'),
      h('div.row', { style: { justifyContent: 'center', gap: '0.6rem' } }, h('span.chip', null, icon('xp'), `Level ${def.unlockLevel}`), h('span.chip', null, icon('gold'), fmt(def.cost))),
      acts,
    ],
  });
  UI.open(scr);
}
