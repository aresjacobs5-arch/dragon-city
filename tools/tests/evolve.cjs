// Feeds a level 6 monster to level 7 (or LVL=14 to 15) from the detail screen and captures the evolution.
module.exports = async function (page, api) {
  await page.goto('http://localhost:5173/?nosdk&dev', { waitUntil: 'load' });
  await page.waitForFunction(() => window.__ready === true, null, { timeout: 90000 });
  await api.eval(({ sp, lvl }) => {
    const { G, Tutorial, B, M } = window.__bh;
    Tutorial.finish();
    G.state.res.food = 50000;
    const s = B.findSpot('hab_fire', 0, 2.6, -2.2);
    const b = B.placeBuilding('hab_fire', 0, s.x, s.z, { instant: true });
    const m = M.createMonster(sp, { level: lvl });
    B.placeMonsterIn(m, b);
  }, { sp: process.env.SP || 'embercub', lvl: +(process.env.LVL || 6) });
  await api.eval(() => window.__bh.Game.actions.monsterDetail(window.__bh.G.state.monsters[0]));
  await api.wait(1500);
  await api.shot('detail-before');
  await api.click('[data-tut="feed-level"]');
  for (let i = 0; i < 12; i++) {
    await api.wait(650);
    await api.shot('evo' + i);
    if (await api.eval(() => !!document.querySelector('.reveal-ui .btn.lg'))) break;
  }
  await api.wait(800);
  await api.shot('evolved');
  await api.click('.reveal-ui .btn.lg');
  await api.wait(3000);
  await api.shot('detail-after');
};
