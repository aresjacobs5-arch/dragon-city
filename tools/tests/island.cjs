// Builds a lived-in island through real game systems and captures it.
module.exports = async function (page, api) {
  const url = 'http://localhost:5173/?nosdk&dev' + (process.env.KEEP ? '' : '');
  await page.goto(url, { waitUntil: 'load' });
  await page.waitForFunction(() => window.__ready === true, null, { timeout: 90000 });
  if (!process.env.KEEP) {
    await api.eval(() => {
      const { G, Tutorial, B, M, HT } = window.__bh;
      Tutorial.finish();
      G.state.player.level = 9;
      G.state.res.gold = 60000;
      G.state.res.food = 20000;
      const place = (type, x, z) => {
        const s = B.findSpot(type, 0, x, z);
        return s ? B.placeBuilding(type, 0, s.x, s.z, { instant: true }) : null;
      };
      const fire = place('hab_fire', 2.6, -2.2);
      const nat = place('hab_nature', 3.4, 1.8);
      const wat = place('hab_water', -1.5, 4.5);
      const farm = place('farm', -3.6, 0.8);
      const farm2 = place('farm', -4.5, -2.5);
      const br = place('breeding', -0.8, -5.8);
      place('gold_storage', 6, -4.5);
      const add = (sp, lvl, hab) => {
        const m = M.createMonster(sp, { level: lvl });
        if (hab) B.placeMonsterIn(m, hab);
        return m;
      };
      add('embercub', 12, fire); add('ashhorn', 7, fire); add('sproutle', 8, nat); add('bloomfang', 21, nat); add('ripplet', 5, wat);
      B.plant(farm, 'melons');
      B.plant(farm2, 'berries', { quick: true });
      for (const b of G.state.buildings) if (B.isHabitat(b)) { b.gold = 300; }
      HT.addEgg('zapkit', { instant: true });
      G.world.syncAll();
      window.__bh.saveGame(true);
    });
  }
  await api.wait(2500);
  await api.shot('island');
  await api.eval(() => { const c = window.__bh.G.world.camCtl; c.goalDistance = 26; c.goal.set(1.5, 0, 0.5); });
  await api.wait(2500);
  await api.shot('island-zoom');
};
