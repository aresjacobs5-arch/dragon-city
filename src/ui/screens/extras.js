import { G, dayKey } from '../../game/G.js';
import { UI } from '../ui.js';
import { h, icon, fmt, costEl, bar } from '../dom.js';
import { RUNE_TYPES, RUNE_TIERS, RELICS } from '../../data/rewards.js';
import { MONSTERS } from '../../data/monsters.js';
import { RARITIES } from '../../data/rarities.js';
import { species, monsterName, shardsFor, summonCost, addShards } from '../../systems/monsters.js';
import { addRune, randomRuneType } from '../../systems/rewards.js';
import { spend, canAfford } from '../../systems/resources.js';
import { runeIcon, elIcons, rarityChip } from './monsters.js';
import { openMonsterPicker } from './sheets.js';

// Rune Forge, Relic Workshop and Ancient Shrine.

const FUSE_GOLD = (tier) => 250 * tier * tier;
const SALVAGE_DUST = (tier) => 6 * tier * tier;
const CRAFT_DUST = 30;

export function openRuneForge(A) {
  let sel = null;
  const grid = h('div.rune-grid');
  const side = h('div.rune-side.well');
  const scr = UI.panel({ key: 'runes', title: 'Rune Forge', ribbon: 'purple', cls: 'wide', kind: 'modal', dim: 0.5, content: [h('div.rune-forge', null, h('div.scroll.rune-inv', null, grid), side)] });

  const spare = () => G.state.inventory.runes.filter((r) => !r.on);
  const render = () => {
    grid.innerHTML = '';
    const list = [...G.state.inventory.runes].sort((a, b) => b.tier - a.tier || a.type.localeCompare(b.type));
    if (!list.length) grid.appendChild(h('div.small.muted', { style: { gridColumn: '1 / -1', padding: '1rem' } }, 'No runes yet. Win campaign battles, open chests or craft one with Rune Dust.'));
    for (const r of list) {
      const t = RUNE_TYPES[r.type];
      const card = h(`button.rune-card${sel === r ? '.sel' : ''}${r.on ? '.on' : ''}`, { onclick: () => { sel = r; A.sfx('tab'); render(); } }, runeIcon(r), h('div.n', null, `${t.name} ${RUNE_TIERS[r.tier - 1]}`), h('div.v', null, `+${Math.round(t.values[r.tier - 1] * 100)}% ${t.stat.toUpperCase()}`));
      if (r.on) {
        const m = G.state.monsters.find((x) => x.id === r.on);
        card.appendChild(h('div.owner', null, m ? monsterName(m) : 'Equipped'));
      }
      grid.appendChild(card);
    }
    renderSide();
  };
  const renderSide = () => {
    side.innerHTML = '';
    side.appendChild(h('div.dust', null, icon('runeDust'), h('b', null, fmt(G.state.res.runeDust || 0)), h('span.muted.small', null, 'Rune Dust')));
    side.appendChild(h('button.btn.purple', {
      onclick: () => {
        if ((G.state.res.runeDust || 0) < CRAFT_DUST) {
          A.sfx('error');
          UI.toast(`Crafting needs ${CRAFT_DUST} Rune Dust. Salvage spare runes to get some.`, { icon: 'runeDust' });
          return;
        }
        G.state.res.runeDust -= CRAFT_DUST;
        const r = addRune(randomRuneType(), 1);
        sel = r;
        A.sfx('unlock');
        UI.toast(`Crafted ${RUNE_TYPES[r.type].name} I!`, { icon: 'rune', kind: 'good' });
        render();
      },
    }, icon('sparkle'), 'Craft', h('span.cost', null, icon('runeDust'), `${CRAFT_DUST}`)));
    if (!sel || !G.state.inventory.runes.includes(sel)) {
      sel = null;
      side.appendChild(h('div.small.muted', { style: { textAlign: 'center' } }, 'Select a rune to fuse or salvage it. Three identical runes fuse into a stronger one.'));
      return;
    }
    const t = RUNE_TYPES[sel.type];
    side.appendChild(h('div.rune-big', null, runeIcon(sel), h('div.display', null, `${t.name} ${RUNE_TIERS[sel.tier - 1]}`), h('div.small', null, `+${Math.round(t.values[sel.tier - 1] * 100)}% ${t.name}`)));
    const same = spare().filter((r) => r.type === sel.type && r.tier === sel.tier);
    if (sel.tier < 5) {
      const can = same.length >= 3 && !sel.on;
      const next = `${t.name} ${RUNE_TIERS[sel.tier]}`;
      side.appendChild(h('div.small', { style: { textAlign: 'center' } }, `Fuse 3 → ${next} (${Math.min(same.length, 3)}/3)`));
      side.appendChild(h(`button.btn.gold${can ? '' : '.disabled'}`, {
        onclick: () => {
          if (!can) {
            A.sfx('error');
            UI.toast(sel.on ? 'Unequip this rune first.' : 'You need 3 identical spare runes.', { icon: 'rune' });
            return;
          }
          const cost = { gold: FUSE_GOLD(sel.tier) };
          if (!canAfford(cost)) return A.notEnough(cost);
          spend(cost, 'rune');
          const use = [sel, ...same.filter((r) => r !== sel)].slice(0, 3);
          G.state.inventory.runes = G.state.inventory.runes.filter((r) => !use.includes(r));
          const nr = addRune(sel.type, sel.tier + 1);
          sel = nr;
          A.sfx('unlock');
          UI.toast(`Fused into ${next}!`, { icon: 'rune', kind: 'good' });
          render();
        },
      }, icon('rune'), 'Fuse', costEl({ gold: FUSE_GOLD(sel.tier) })));
    }
    side.appendChild(h(`button.btn.red${sel.on ? '.disabled' : ''}`, {
      onclick: () => {
        if (sel.on) {
          A.sfx('error');
          UI.toast('Unequip this rune first.', { icon: 'rune' });
          return;
        }
        const dust = SALVAGE_DUST(sel.tier);
        G.state.inventory.runes = G.state.inventory.runes.filter((r) => r !== sel);
        G.state.res.runeDust = (G.state.res.runeDust || 0) + dust;
        G.markDirty();
        sel = null;
        A.sfx('pop');
        UI.toast(`+${dust} Rune Dust`, { icon: 'runeDust', kind: 'good' });
        render();
      },
    }, 'Salvage', h('span.cost', null, icon('runeDust'), `+${SALVAGE_DUST(sel.tier)}`)));
  };
  render();
  UI.open(scr);
  return scr;
}

export function openRelics(A) {
  const list = h('div.relic-list.scroll');
  const scr = UI.panel({ key: 'relics', title: 'Relic Workshop', ribbon: 'teal', cls: 'wide', kind: 'modal', dim: 0.5, content: [h('div.relic-top', null, icon('relicFrags'), h('b.frags'), h('span.muted.small', null, 'Relic Fragments · earned from chests, bosses and events')), list] });
  const render = () => {
    scr.el.querySelector('.frags').textContent = fmt(G.state.res.relicFrags || 0);
    list.innerHTML = '';
    for (const r of RELICS) {
      const owned = !!G.state.inventory.relics[r.id];
      const user = G.state.monsters.find((m) => m.relic === r.id);
      const gem = h('div.relic-gem', { style: { '--rc': r.color } }, icon('relic'));
      const row = h(`div.relic-row.well${owned ? '.owned' : ''}`, null, gem, h('div.grow', null, h('div.display', null, r.name), h('div.small', null, r.desc), user ? h('div.tiny.muted', null, `Worn by ${monsterName(user)}`) : null));
      if (owned) {
        row.appendChild(h('button.btn.sm.blue', {
          onclick: () => openMonsterPicker(A, {
            title: `Equip ${r.name}`,
            note: r.desc,
            filter: (m) => m.relic !== r.id,
            onPick: (m) => {
              A.equipRelic(m, r.id);
              UI.toast(`${monsterName(m)} now wears the ${r.name}`, { icon: 'relic', kind: 'good' });
              render();
            },
          }),
        }, 'Equip'));
      } else {
        const can = (G.state.res.relicFrags || 0) >= r.cost;
        row.appendChild(h(`button.btn.sm.teal${can ? '' : '.disabled'}`, {
          onclick: () => {
            if (!can) {
              A.sfx('error');
              UI.toast(`Needs ${r.cost} Relic Fragments`, { icon: 'relicFrags' });
              return;
            }
            G.state.res.relicFrags -= r.cost;
            G.state.inventory.relics[r.id] = 1;
            G.markDirty();
            A.sfx('unlock');
            UI.toast(`Forged the ${r.name}!`, { icon: 'relic', kind: 'good' });
            render();
          },
        }, 'Forge', h('span.cost', null, icon('relicFrags'), `${r.cost}`)));
      }
      list.appendChild(row);
    }
  };
  render();
  UI.open(scr);
  return scr;
}

export function openShrine(A) {
  const grid = h('div.mgrid.shrine-grid');
  const offering = h('div.shrine-offer.well');
  const scr = UI.panel({ key: 'shrine', title: 'Ancient Shrine', ribbon: 'teal', kind: 'page', dim: 0.5, content: [offering, h('div.small.muted', { style: { textAlign: 'center', margin: '0.3rem 0 0.4rem' } }, 'Collect shards to summon monsters. Shards come from chests, releasing monsters and the daily offering.'), h('div.scroll.grow', null, grid)] });
  const render = () => {
    offering.innerHTML = '';
    const today = dayKey();
    const claimed = G.state.flags.shrineDay === today;
    const pool = MONSTERS.filter((m) => G.state.dex[m.id] >= 1 && m.rarity !== 'ancient');
    offering.append(h('div.row', null, icon('sparkle'), h('div.grow', null, h('div.display', null, 'Daily Offering'), h('div.small.muted', null, 'Receive shards of a monster you have discovered.'))),
      h(`button.btn.teal${claimed || !pool.length ? '.disabled' : ''}`, {
        onclick: () => {
          if (claimed || !pool.length) return;
          const m = pool[Math.floor(Math.random() * pool.length)];
          const n = 6 + Math.floor(Math.random() * 10);
          addShards(m.id, n);
          G.state.flags.shrineDay = today;
          G.markDirty();
          A.sfx('reward');
          UI.toast(`+${n} ${m.name} shards`, { icon: 'shards', kind: 'good' });
          render();
        },
      }, claimed ? 'Come back tomorrow' : 'Receive'));
    grid.innerHTML = '';
    const list = MONSTERS.filter((m) => shardsFor(m.id) > 0).sort((a, b) => shardsFor(b.id) / summonCost(b.id) - shardsFor(a.id) / summonCost(a.id));
    if (!list.length) grid.appendChild(h('div.small.muted', { style: { gridColumn: '1 / -1', textAlign: 'center', padding: '1rem' } }, 'No shards yet.'));
    for (const def of list) {
      const have = shardsFor(def.id), need = summonCost(def.id);
      const R = RARITIES[def.rarity];
      const img = h('img', { alt: def.name });
      A.portrait(def.id, 1, G.state.dex[def.id] !== 2).then((u) => u && (img.src = u));
      const card = h('div.mcard', { style: { '--rc': R.color } }, h('div.art', null, img, elIcons(def.elements)), h('div.name', null, def.name), h('div.shard-bar', null, bar(have / need, '#b48aff', `${have}/${need}`)));
      if (have >= need) card.appendChild(h('button.btn.sm.purple.summon', { onclick: () => { UI.close(scr); A.summonShards(def.id); } }, 'Summon'));
      grid.appendChild(card);
    }
  };
  render();
  UI.open(scr);
  return scr;
}

export { rarityChip };
