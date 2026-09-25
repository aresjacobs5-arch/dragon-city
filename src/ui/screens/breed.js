import { G } from '../../game/G.js';
import { UI } from '../ui.js';
import { h, icon, fmt, fmtTime, costEl, bar, setBar } from '../dom.js';
import { RARITIES, rarityIdx } from '../../data/rarities.js';
import { species, stageOf, sortMonsters, monsterName } from '../../systems/monsters.js';
import { breedOutcomes, breedTime, breedBlocker, breedingState, breedingSkipCost } from '../../systems/breeding.js';
import { hatcherySlots, eggLeft, eggReady, eggSkipCost } from '../../systems/hatchery.js';
import { isUnlocked } from '../../systems/player.js';
import { monsterCard, elIcons, blend } from './monsters.js';
import { MonsterStage } from '../../render/monsterStage.js';

export function openBreed(A) {
  const sel = { a: null, b: null, active: 'a', token: false };
  const stages = { a: new MonsterStage({ bg: '#ffe0ec' }), b: new MonsterStage({ bg: '#ffe0ec' }) };
  const vps = {};
  const slotEl = {};
  for (const k of ['a', 'b']) {
    const vp = h('div.vp');
    const info = h('div.info');
    const el = h('div.parent.empty', { onclick: () => { sel.active = k; paint(); } }, icon('paw'), h('span', null, 'Pick a monster'));
    slotEl[k] = { el, vp, info };
    stages[k].bindDrag(vp);
    vps[k] = { el: vp, scene: stages[k].scene, camera: stages[k].camera, update: (dt) => stages[k].update(dt), hidden: true };
  }
  const outcomes = h('div.outcomes.hscroll.well');
  const breedBtn = h('button.btn.lg.pink', { onclick: () => doBreed() }, icon('breed'), 'BREED');
  const tokenBtn = h('button.btn.sm.purple', { onclick: () => { sel.token = !sel.token; paint(); } }, icon('tokens'), 'Token');
  const mid = h('div.mid', null, h('div.heart.pulse', null, icon('heart')), breedBtn, tokenBtn, h('div.small.muted.t'));
  const pair = h('div.pair', null, slotEl.a.el, mid, slotEl.b.el);
  const grid = h('div.mgrid');
  const picker = h('div.picker.scroll', null, grid);
  const progress = h('div.col.grow.center');
  const body = h('div.breed', null, pair, h('div.row', null, h('div.display', null, 'Possible babies'), h('div.small.muted', null, '— rarer results need higher level parents')), outcomes, picker, progress);
  const scr = UI.panel({ key: 'breed', title: 'Breeding Mountain', ribbon: 'pink', content: [body] });

  const setParent = (k, m) => {
    sel[k] = m;
    const s = slotEl[k];
    s.el.className = 'parent' + (m ? '' : ' empty');
    s.el.innerHTML = '';
    if (m) {
      const def = species(m.sp);
      stages[k].scene.background.set(blend(RARITIES[def.rarity].color, '#ffffff', 0.72));
      stages[k].setMonster(def, stageOf(m));
      stages[k].play('happy');
      s.info.innerHTML = '';
      s.info.append(h('div.nm.display.ol', null, monsterName(m)), h('span.chip', null, `Lv ${m.lvl}`), h('div.grow'), elIcons(def.elements));
      s.el.append(s.vp, s.info);
      vps[k].hidden = false;
    } else {
      s.el.append(icon('paw'), h('span', null, 'Pick a monster'));
      vps[k].hidden = true;
    }
  };

  const doBreed = () => {
    const block = breedBlocker(sel.a, sel.b);
    if (block) {
      breedBtn.classList.remove('shake-no');
      void breedBtn.offsetWidth;
      breedBtn.classList.add('shake-no');
      UI.toast(block, { icon: 'info' });
      return;
    }
    const res = A.startBreeding(sel.a, sel.b, sel.token);
    if (res && !res.error) {
      stages.a.play('happy');
      stages.b.play('happy');
      stages.a.burst('heart', 10);
      stages.b.burst('heart', 10);
      setTimeout(() => paint(), 500);
    }
  };

  let upd = null;
  const paint = () => {
    const bs = breedingState();
    upd = null;
    slotEl.a.el.classList.toggle('active', sel.active === 'a' && !bs);
    slotEl.b.el.classList.toggle('active', sel.active === 'b' && !bs);
    tokenBtn.classList.toggle('hidden', !isUnlocked('rare_breeding') || !(G.state.res.tokens > 0));
    tokenBtn.classList.toggle('on', sel.token);
    tokenBtn.style.outline = sel.token ? '0.25rem solid var(--gold)' : '';
    if (bs) {
      // show the ongoing breeding
      const a = G.state.monsters.find((m) => m.id === bs.a);
      const b = G.state.monsters.find((m) => m.id === bs.b);
      if (a && sel.a !== a) setParent('a', a);
      if (b && sel.b !== b) setParent('b', b);
      picker.classList.add('hidden');
      breedBtn.classList.add('hidden');
      progress.classList.remove('hidden');
      progress.innerHTML = '';
      const img = h('img', { style: { width: '7rem', height: '7.5rem', objectFit: 'contain' } });
      A.eggThumb(bs.sp).then((u) => u && (img.src = u));
      const t = h('div.display', { style: { fontSize: '1.5rem' } }, '');
      const pb = bar(0, '#ff8fc0');
      pb.style.width = '16rem';
      const actions = h('div.dlg-actions');
      progress.append(h('div', { class: bs.done ? 'bob' : '' }, img), t, pb, actions);
      const renderActions = () => {
        actions.innerHTML = '';
        const now = breedingState();
        if (!now) return;
        if (now.done) actions.appendChild(h('button.btn.lg.green', { onclick: () => { A.collectBreeding(); paint(); } }, icon('egg'), 'Collect Egg'));
        else {
          const gems = breedingSkipCost();
          actions.appendChild(h('button.btn.teal', { onclick: () => { A.skipBreeding(); renderActions(); } }, gems ? 'Finish' : 'Finish Free', gems ? costEl({ gems }) : null));
          if (A.adsReady() && now.left > 20) actions.appendChild(h('button.btn.purple', { onclick: () => A.adSpeedBreeding(() => renderActions()) }, icon('film'), 'Speed Up'));
        }
      };
      renderActions();
      let wasDone = bs.done;
      upd = () => {
        const n = breedingState();
        if (!n) {
          paint();
          return;
        }
        t.textContent = n.done ? 'Egg is ready!' : fmtTime(n.left);
        setBar(pb, 1 - n.left / Math.max(1, n.total));
        if (n.done !== wasDone) {
          wasDone = n.done;
          renderActions();
        }
      };
      upd();
    } else {
      picker.classList.remove('hidden');
      breedBtn.classList.remove('hidden');
      progress.classList.add('hidden');
      grid.innerHTML = '';
      const other = sel.active === 'a' ? sel.b : sel.a;
      const list = sortMonsters(G.state.monsters.filter((m) => !species(m.sp).boss), 'level');
      for (const m of list) {
        const isSel = m === sel.a || m === sel.b;
        grid.appendChild(monsterCard(m, () => {
          if (m === other) return;
          setParent(sel.active, m);
          if (sel.active === 'a' && !sel.b) sel.active = 'b';
          else if (sel.active === 'b' && !sel.a) sel.active = 'a';
          paint();
        }, A, { sel: isSel, dim: m === other }));
      }
    }
    // outcomes
    outcomes.innerHTML = '';
    const tl = mid.querySelector('.t');
    if (sel.a && sel.b && !bs) {
      const outs = breedOutcomes(sel.a, sel.b, { token: sel.token });
      for (const o of outs) {
        const def = species(o.sp);
        const known = G.state.dex[o.sp] === 2;
        const R = RARITIES[def.rarity];
        const img = h('img', { alt: '' });
        A.portrait(o.sp, 1, !known).then((u) => u && (img.src = u));
        outcomes.appendChild(h('div.outcome', null, h('div.pic', { style: { '--rc': R.color } }, img, known ? null : h('div.q', null, '?')), h('div.nm', { style: { color: R.dark } }, known ? def.name : `??? ${R.name}`), h('div.pc', null, `${o.p < 0.01 ? '<1' : Math.round(o.p * 100)}%`)));
      }
      const times = outs.map((o) => breedTime(o.sp));
      tl.textContent = `${fmtTime(Math.min(...times))} – ${fmtTime(Math.max(...times))}`;
      breedBtn.classList.remove('disabled');
    } else if (!bs) {
      outcomes.appendChild(h('div.small.muted', { style: { padding: '0.8rem' } }, 'Choose two monsters to see what could hatch. Different elements make new hybrids!'));
      tl.textContent = '';
      breedBtn.classList.add('disabled');
    }
  };

  // Pre-select two good parents for convenience
  const mons = sortMonsters(G.state.monsters, 'level');
  const bs0 = breedingState();
  if (!bs0 && mons.length >= 2) {
    setParent('a', mons[0]);
    const diff = mons.find((m) => m !== mons[0] && species(m.sp).elements.some((e) => !species(mons[0].sp).elements.includes(e))) || mons[1];
    setParent('b', diff);
  }
  paint();
  scr.update = () => upd && upd();
  scr.onOpen = () => {
    G.engine.addViewport(vps.a);
    G.engine.addViewport(vps.b);
  };
  scr.onClose = () => {
    G.engine.removeViewport(vps.a);
    G.engine.removeViewport(vps.b);
    stages.a.dispose();
    stages.b.dispose();
  };
  scr.refresh = paint;
  UI.open(scr);
  return scr;
}

export function openHatchery(A) {
  const row = h('div.row.hscroll', { style: { gap: '0.8rem', padding: '0.4rem 0.2rem 0.8rem', justifyContent: 'center' } });
  const note = h('div.small.muted', { style: { textAlign: 'center' } });
  const scr = UI.panel({ key: 'hatchery', title: 'Hatchery', ribbon: 'gold', kind: 'modal', cls: 'wide', content: [row, note] });
  let items = [];
  const render = () => {
    row.innerHTML = '';
    items = [];
    const slots = hatcherySlots();
    note.textContent = `${G.state.hatchery.length} / ${slots} slots · Upgrade the Hatchery for more`;
    for (const egg of G.state.hatchery) {
      const def = species(egg.sp);
      const R = RARITIES[def.rarity];
      const img = h('img', { alt: '' });
      A.eggThumb(egg.sp).then((u) => u && (img.src = u));
      const t = h('div.t', null, '');
      const btns = h('div.col', { style: { gap: '0.35rem', width: '100%' } });
      const slot = h('div.egg-slot', null, h('span.rar-chip', { style: { background: R.color } }, R.name), img, t, btns);
      row.appendChild(slot);
      const renderBtns = () => {
        btns.innerHTML = '';
        if (eggReady(egg)) {
          slot.classList.add('ready');
          btns.appendChild(h('button.btn.sm.green.wide', { onclick: () => A.hatch(egg) }, 'HATCH!'));
        } else if (egg.until === null) {
          btns.appendChild(h('div.small.muted', null, 'Waiting for a slot'));
        } else {
          const gems = eggSkipCost(egg);
          btns.appendChild(h('button.btn.sm.teal.wide', { onclick: () => { A.skipEgg(egg); renderBtns(); } }, gems ? 'Finish' : 'Finish Free', gems ? costEl({ gems }) : null));
          if (A.adsReady() && eggLeft(egg) > 20) btns.appendChild(h('button.btn.sm.purple.wide', { onclick: () => A.adSpeedEgg(egg, renderBtns) }, icon('film'), 'Speed Up'));
        }
      };
      renderBtns();
      items.push({ egg, t, renderBtns, ready: eggReady(egg) });
    }
    for (let i = G.state.hatchery.length; i < slots; i++) row.appendChild(h('div.egg-slot.empty', null, icon('egg'), 'Empty'));
  };
  render();
  scr.update = () => {
    for (const it of items) {
      const r = eggReady(it.egg);
      it.t.textContent = r ? 'Ready!' : it.egg.until === null ? '' : fmtTime(eggLeft(it.egg));
      if (r !== it.ready) {
        it.ready = r;
        it.renderBtns();
      }
    }
    if (items.length !== G.state.hatchery.length) render();
  };
  scr.refresh = render;
  UI.open(scr);
  return scr;
}
