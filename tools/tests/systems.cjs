// Exercises progression systems through game actions and reports results.
module.exports = async function (page, api) {
  await page.goto('http://localhost:5173/?nosdk&dev&devads', { waitUntil: 'load' });
  await page.waitForFunction(() => window.__ready === true, null, { timeout: 90000 });
  const E = (fn, arg) => api.eval(fn, arg);
  await E(() => {
    const { G, Tutorial, B, M } = window.__bh;
    Tutorial.finish();
    const S = G.state;
    S.player.level = 14;
    S.res.gold = 200000;
    S.res.food = 90000;
    S.res.gems = 500;
    S.res.energy = 60;
    const place = (type, x, z) => { const s = B.findSpot(type, 0, x, z); return s ? B.placeBuilding(type, 0, s.x, s.z, { instant: true }) : null; };
    const fire = place('hab_fire', 2.6, -2.2);
    place('farm', -3.6, 0.8);
    place('farm', -4.6, -2.4);
    const m = M.createMonster('embercub', { level: 20 });
    B.placeMonsterIn(m, fire);
    M.createMonster('ashhorn', { level: 18 });
    M.createMonster('sproutle', { level: 15 });
    S.shards.embercub = 200;
    S.inventory.chests = { wooden: 1, silver: 1, gold: 1 };
    S.inventory.runes = [{ id: G.uid(), type: 'atk', tier: 2, on: null }];
  });
  const A = window => null;
  const log = async (label, fn, arg) => {
    try {
      const r = await E(fn, arg);
      api.log(label, JSON.stringify(r));
    } catch (e) {
      api.log(label, 'ERROR', e.message);
    }
  };
  // wheel
  await log('wheel', () => { const r = window.__bh.Game.actions.spinWheel(false); return r && (r.prize || r); });
  // chests
  await log('chest wooden', () => { window.__bh.Game.actions.openChest('wooden'); return window.__bh.UI.stack.map((s) => s.key); });
  await api.wait(1500);
  await api.shot('chest');
  await E(() => window.__bh.UI.closeAll());
  await log('chest gold', () => { window.__bh.Game.actions.openChest('gold'); return Object.values(window.__bh.G.state.inventory.chests); });
  await E(() => window.__bh.UI.closeAll());
  // daily login
  await log('daily', () => { window.__bh.Game.actions.claimDaily(); return window.__bh.G.state.login; });
  await E(() => window.__bh.UI.closeAll());
  // rank up
  await log('rank', () => { const m = window.__bh.G.state.monsters[0]; const ok = window.__bh.Game.actions.rankUp(m); return { ok, rank: m.rank, shards: window.__bh.G.state.shards.embercub }; });
  // rune equip (needs level >= 10)
  await log('rune', () => { const G = window.__bh.G; const m = G.state.monsters[0]; const r = G.state.inventory.runes[0]; const ok = window.__bh.Game.actions.equipRune(m, r); return { ok, runes: m.runes.length }; });
  // obstacle clearing
  await log('obstacle', () => { const { B } = window.__bh; const o = B.activeObstacles(0)[0]; window.__bh.Game.actions.clearObstacle(o); window.__bh.Game.actions.finishClearing(o); B.tickBuildings(); return { id: o.id, removed: window.__bh.G.state.obstacles.removed.includes(o.id) }; });
  // habitat upgrade
  await log('upgrade', () => { const { G, B } = window.__bh; const b = G.state.buildings.find((x) => x.type === 'hab_fire'); window.__bh.Game.actions.upgradeBuilding(b); window.__bh.Game.actions.finishBuilding(b); B.tickBuildings(); return { level: b.level, state: b.state }; });
  // plant all + harvest all (bulk farming unlocked at 5)
  await log('plantAll', () => { const { B } = window.__bh; return { planted: B.plantAll('berries'), farms: B.farms().map((f) => f.crop) }; });
  // daily quests + achievements
  await log('dailyQuests', async () => { const q = await import('/src/systems/quests.js'); return q.dailyList().map((d) => `${d.id}:${d.value}/${d.goal.n}`); });
  await log('achievements claimable', async () => { const q = await import('/src/systems/quests.js'); q.checkCompletions(); return q.achievementList().filter((a) => a.done && !a.claimed).map((a) => a.id); });
  // shard summon
  await log('summon', () => { const G = window.__bh.G; const before = G.state.monsters.length; G.state.shards.embercub = 999; window.__bh.Game.actions.summonShards('embercub'); return { before, after: G.state.monsters.length }; });
  await api.wait(3500);
  await api.shot('summon-reveal');
  await E(() => { const b = document.querySelector('[data-tut="reveal-place"]'); if (b) b.click(); });
  await api.wait(2500);
  // event screen + event battle
  await E(() => window.__bh.Game.actions.events());
  await api.wait(1200);
  await api.shot('events');
  await log('event', async () => { const ev = await import('/src/systems/events.js'); const e = ev.currentEvent(); return { id: e.id, type: e.type, pts: ev.eventPoints() }; });
  await E(() => window.__bh.UI.closeAll());
  // tower battle via UI
  await E(() => { window.__bh.G.state.settings.auto = true; window.__bh.Campaign.openTower(); });
  await api.wait(1000);
  await api.shot('tower');
  await api.click('.panel .dlg-actions .btn.lg');
  await api.wait(1200);
  await api.click('[data-tut="team-fight"]');
  for (let i = 0; i < 200; i++) {
    await api.wait(500);
    if (await E(() => !!document.querySelector('.results .btn.lg'))) break;
  }
  await api.wait(1200);
  await api.shot('tower-result');
  await log('tower floor', () => window.__bh.G.state.tower.floor);
};
