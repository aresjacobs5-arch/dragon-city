// Level-up celebration, island unlock cinematic, welcome-back offline earnings.
module.exports = async function (page, api) {
  const url = 'http://localhost:5173/?nosdk&dev';
  const outDir = process.argv[3];
  await page.goto(url, { waitUntil: 'load' });
  await page.waitForFunction(() => window.__ready === true, null, { timeout: 90000 });
  await api.eval(() => {
    const { Tutorial, B, M } = window.__bh;
    Tutorial.finish();
    const s = B.findSpot('hab_fire', 0, 2.6, -2.2);
    const b = B.placeBuilding('hab_fire', 0, s.x, s.z, { instant: true });
    B.placeMonsterIn(M.createMonster('embercub', { level: 8 }), b);
    B.placeMonsterIn(M.createMonster('ashhorn', { level: 6 }), b);
  });
  // level up from 9 to 10 (unlocks the first extra island)
  await api.eval(async () => {
    const p = window.__bh.G.state.player;
    p.level = 9;
    p.xp = 0;
    const m = await import('/src/systems/player.js');
    m.addXP(m.xpProgress().need + 5);
  });
  await api.wait(2500);
  await api.shot('levelup');
  await api.eval(() => window.__bh.UI.closeAll());
  await api.wait(1200);
  await api.eval(() => window.__bh.UI.closeAll());
  // island unlock cinematic
  await api.eval(() => {
    const { G, B } = window.__bh;
    G.state.res.gold = 999999;
    const n = B.nextLockedIsland();
    B.unlockIsland(n.id);
  });
  await api.wait(1800);
  await api.shot('island-unlock-fly');
  await api.wait(3000);
  await api.shot('island-unlock-done');
  await api.eval(() => window.__bh.UI.closeAll());
  await api.wait(800);
  await api.eval(() => { const c = window.__bh.G.world.camCtl; c.goalDistance = 70; c.goal.set(8, 0, -6); });
  await api.wait(2500);
  await api.shot('two-islands');
  // offline: pretend we were away for 5 hours
  const raw = await api.eval(() => {
    const { G } = window.__bh;
    const away = Date.now() - 5 * 3600 * 1000;
    window.__bh.saveGame(true);
    const r = JSON.parse(localStorage.getItem('beasthaven.save'));
    return r;
  });
  const ctx = page.context();
  await page.close({ runBeforeUnload: false });
  const p2 = await ctx.newPage();
  await p2.goto(url + '&timeskip=18000', { waitUntil: 'load' });
  await p2.waitForFunction(() => window.__ready === true, null, { timeout: 90000 });
  await p2.waitForTimeout(1500);
  await p2.screenshot({ path: outDir + '/99-welcome.png' });
  console.log('welcome shot', raw ? 'ok' : 'none');
};
