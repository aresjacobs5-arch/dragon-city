import { G } from '../../game/G.js';
import { UI } from '../ui.js';
import { h, icon, fmt, bar } from '../dom.js';
import { currentMain, claimMain, dailyList, claimDaily, dailyChestReady, claimDailyChest, achievementList, claimAchievement } from '../../systems/quests.js';
import { isUnlocked } from '../../systems/player.js';
import { MAIN_QUESTS } from '../../data/quests.js';

export function rewardChips(reward) {
  const out = [];
  for (const [k, v] of Object.entries(reward || {})) {
    if (!v) continue;
    if (k === 'chest') out.push(h('span.rw', null, icon(`chest_${v}`), `${v[0].toUpperCase()}${v.slice(1)}`));
    else if (k === 'egg') out.push(h('span.rw', null, icon('egg'), typeof v === 'string' ? v : 'Egg'));
    else if (k === 'species') out.push(h('span.rw', null, icon('egg'), 'Egg'));
    else out.push(h('span.rw', null, icon(k === 'xp' ? 'xp' : k), fmt(v)));
  }
  return out;
}

export function openQuests(A, tab = 'main') {
  let cur = tab;
  const tabs = h('div.tabs');
  const body = h('div.scroll.grow');
  const scr = UI.panel({ key: 'quests', title: 'Quests', ribbon: 'green', content: [tabs, h('div', { style: { height: '0.6rem' } }), body] });
  const renderTabs = () => {
    tabs.innerHTML = '';
    const list = [['main', 'Story', 'quests'], ['daily', 'Daily', 'daily'], ['ach', 'Achievements', 'trophy']];
    for (const [k, l, ic] of list) {
      if (k === 'daily' && !isUnlocked('daily_quests')) continue;
      let n = 0;
      if (k === 'daily') n = dailyList().filter((x) => x.done && !x.claimed).length + (dailyChestReady() ? 1 : 0);
      if (k === 'ach') n = achievementList().filter((a) => a.done && !a.claimed).length;
      if (k === 'main') n = currentMain() && currentMain().done ? 1 : 0;
      tabs.appendChild(h(`button.tab${cur === k ? '.on' : ''}`, { onclick: () => { cur = k; renderTabs(); render(); } }, icon(ic), l, n ? h('div.badge', null, n) : null));
    }
  };
  const claimBtn = (fn, rowEl) => h('button.btn.sm.green', { onclick: (e) => { const items = fn(); if (items) { A.rewardFly(items, e.currentTarget); A.sfx('quest'); } renderTabs(); render(); } }, 'Claim');
  const render = () => {
    body.innerHTML = '';
    if (cur === 'main') {
      const q = currentMain();
      if (!q) {
        body.appendChild(h('div.dlg-text', null, 'All story quests complete. You are a legend!'));
        return;
      }
      body.appendChild(h('div.main-goal.well', null, icon('quests'),
        h('div.grow', null, h('div.small.muted', null, 'CURRENT GOAL'), h('div.t', null, q.text), h('div', { style: { margin: '0.4rem 0' } }, bar(q.value / q.goal.n, null, `${fmt(q.value)} / ${fmt(q.goal.n)}`)), h('div.row.qrow', { style: { padding: 0 } }, h('span.small.muted', null, 'Reward:'), rewardChips(q.reward))),
        q.done ? claimBtn(() => claimMain()) : h('button.btn.sm.blue', { onclick: () => { UI.close(scr); A.goTo(q.goal); } }, 'Go')));
      const idx = G.state.quests.main;
      body.appendChild(h('div.story-journey', null, h('span.small.muted', null, 'Story journey'), bar(idx / MAIN_QUESTS.length, '#5fc44a', `${idx} / ${MAIN_QUESTS.length}`)));
      const next = MAIN_QUESTS.slice(idx + 1, idx + 4);
      if (next.length) {
        body.appendChild(h('div.q-sec', null, 'Up next'));
        const wrap = h('div.qlist');
        for (const n of next) wrap.appendChild(h('div.qrow.well.upcoming', null, icon('quests'), h('div.txt', null, h('div.t', null, n.text)), h('div.rw', null, rewardChips(n.reward))));
        body.appendChild(wrap);
      }
      const done = MAIN_QUESTS.slice(Math.max(0, idx - 3), idx).reverse();
      if (done.length) {
        body.appendChild(h('div.q-sec', null, 'Completed'));
        const wrap = h('div.qlist');
        for (const n of done) wrap.appendChild(h('div.qrow.well.claimed', null, icon('check'), h('div.txt', null, h('div.t', null, n.text)), h('span.chip', null, 'Done')));
        body.appendChild(wrap);
      }
    } else if (cur === 'daily') {
      const list = dailyList();
      const wrap = h('div.qlist');
      for (const d of list) {
        wrap.appendChild(h(`div.qrow.well${d.claimed ? '.claimed' : d.done ? '.ready' : ''}`, null, icon(d.done ? 'check' : 'daily'),
          h('div.txt', null, h('div.t', null, d.text), bar(d.value / d.n, null, `${fmt(d.value)} / ${fmt(d.n)}`)),
          h('div.rw', null, rewardChips(d.reward)),
          d.claimed ? h('span.chip', null, 'Done') : d.done ? claimBtn(() => claimDaily(d.id)) : null));
      }
      const claimed = list.filter((x) => x.claimed).length;
      wrap.appendChild(h('div.qrow.well', { style: { background: '#fff1c4' } }, icon(G.state.player.level >= 15 ? 'chest_gold' : 'chest_silver'), h('div.txt', null, h('div.t', null, 'Daily Chest — finish all daily quests'), bar(claimed / list.length, '#ffc83d', `${claimed} / ${list.length}`)),
        dailyChestReady() ? claimBtn(() => claimDailyChest()) : G.state.quests.daily.chest ? h('span.chip', null, 'Opened') : null));
      body.appendChild(wrap);
    } else {
      const wrap = h('div.qlist');
      const list = achievementList().sort((a, b) => (b.done && !b.claimed) - (a.done && !a.claimed) || a.claimed - b.claimed);
      for (const a of list) {
        wrap.appendChild(h(`div.qrow.well${a.claimed ? '.claimed' : a.done ? '.ready' : ''}`, null, icon(a.icon === 'swords' ? 'battle' : a.icon === 'island' ? 'island' : a.icon === 'hammer' ? 'hammer' : a.icon === 'up' ? 'up' : a.icon === 'bolt' ? 'energy' : a.icon === 'calendar' ? 'daily' : a.icon === 'tower' ? 'tower' : a.icon === 'fire' || a.icon === 'nature' || a.icon === 'water' ? `el_${a.icon}` : a.icon),
          h('div.txt', null, h('div.t', null, a.name, h('span.small.muted', null, ` — ${goalText(a.goal)}`)), bar(a.value / a.goal.n, '#ffc83d', `${fmt(a.value)} / ${fmt(a.goal.n)}`)),
          h('div.rw', null, rewardChips(a.reward)),
          a.claimed ? h('span.chip', null, 'Done') : a.done ? claimBtn(() => claimAchievement(a.id)) : null));
      }
      body.appendChild(wrap);
    }
  };
  renderTabs();
  render();
  scr.refresh = () => {
    renderTabs();
    render();
  };
  UI.open(scr);
  return scr;
}

function goalText(g) {
  const n = fmt(g.n);
  return {
    own: `Own ${n} monsters`, discover: `Discover ${n} monsters`, discover_rarity: `Discover ${n} ${g.rarity}+`, breed: `Breed ${n} times`, hatch: `Hatch ${n} eggs`,
    collect_gold: `Collect ${n} gold`, feed: `Feed ${n} times`, harvest: `Harvest ${n} crops`, level: `Reach level ${n}`, win: `Win ${n} battles`,
    campaign_clears: `Clear ${n} stages`, boss_wins: `Defeat ${n} bosses`, island: `Own ${n} islands`, clear: `Clear ${n} obstacles`,
    build_category: `Build ${n} ${g.category}s`, monster_level: `Raise a monster to Lv ${g.level}`, rank_max: `Reach rank ${n}`,
    element_owned: `Own ${n} ${g.element} species`, tower: `Reach floor ${n}`, chest: `Open ${n} chests`, login_days: `Log in ${n} days`, ult: `Use ${n} ultimates`,
  }[g.type] || '';
}
