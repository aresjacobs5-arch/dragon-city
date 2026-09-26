// Portrait phone layout check across the main scenes.
module.exports = async function (page, api) {
  await page.goto('http://localhost:5173/?nosdk&dev', { waitUntil: 'load' });
  await page.waitForFunction(() => window.__ready === true, null, { timeout: 90000 });
  await api.wait(1200);
  await api.shot('m-start');
  await api.eval(() => {
    const { G, Tutorial, B, M } = window.__bh;
    Tutorial.finish();
    G.state.player.level = 9;
    G.state.res.gold = 9000;
    const s = B.findSpot('hab_fire', 0, 2.6, -2.2);
    const b = B.placeBuilding('hab_fire', 0, s.x, s.z, { instant: true });
    const m = M.createMonster('embercub', { level: 6 });
    B.placeMonsterIn(m, b);
    B.placeMonsterIn(M.createMonster('ashhorn', { level: 5 }), b);
    M.createMonster('sproutle', { level: 5 });
    G.world.syncAll();
  });
  await api.wait(1200);
  await api.shot('m-island');
  await api.eval(() => window.__bh.Game.actions.shop('habitats'));
  await api.wait(1200);
  await api.shot('m-shop');
  await api.eval(() => window.__bh.UI.closeAll());
  await api.eval(() => window.__bh.Game.actions.monsterDetail(window.__bh.G.state.monsters[0]));
  await api.wait(1600);
  await api.shot('m-detail');
  await api.eval(() => window.__bh.UI.closeAll());
  await api.eval(() => window.__bh.Game.actions.battle());
  await api.wait(2600);
  await api.shot('m-map');
  await api.wait(2000);
  api.log('hud', await api.eval(() => document.getElementById('hud').className + ' ' + window.__bh.G.mode));
  await api.shot('m-map2');
  await api.eval(() => {
    const { G, Campaign } = window.__bh;
    G.state.settings.auto = false;
    const team = G.state.monsters.slice(0, 3);
    Campaign.startBattle({ kind: 'tower', title: 'Test', theme: 'verdant', enemies: [{ sp: 'ripplet', lvl: 5 }, { sp: 'pebblor', lvl: 5 }, { sp: 'zapkit', lvl: 4 }], team, energy: 0, onWin: () => [] });
  });
  for (let i = 0; i < 12; i++) {
    await api.wait(1000);
    const pending = await api.eval(() => !!(window.__bh.Campaign.bs && window.__bh.Campaign.bs.choice));
    if (pending) break;
  }
  await api.shot('m-battle');
};
