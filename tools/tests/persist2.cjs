// Corruption recovery without the game's unload-save interfering.
module.exports = async function (page, api) {
  const url = 'http://localhost:5173/?nosdk&dev';
  const ctx = page.context();
  await page.goto(url, { waitUntil: 'load' });
  await page.waitForFunction(() => window.__ready === true, null, { timeout: 90000 });
  await api.eval(() => {
    const { G, Tutorial, B, M } = window.__bh;
    Tutorial.finish();
    const s = B.findSpot('hab_fire', 0, 2.6, -2.2);
    const b = B.placeBuilding('hab_fire', 0, s.x, s.z, { instant: true });
    B.placeMonsterIn(M.createMonster('embercub', { level: 4 }), b);
    G.state.res.gold = 4321;
    window.__bh.saveGame(true);
    window.__bh.saveGame(true); // backup now holds the same good save
  });
  await page.close();
  const run = async (label, corrupt) => {
    const p = await ctx.newPage();
    const logs = [];
    p.on('console', (m) => logs.push(m.text()));
    await p.goto('http://localhost:5173/src/loader.css');
    await p.evaluate(corrupt);
    await p.goto(url, { waitUntil: 'load' });
    await p.waitForFunction(() => window.__ready === true, null, { timeout: 90000 });
    await p.waitForTimeout(700);
    const st = await p.evaluate(() => ({ b: window.__bh.G.state.buildings.length, m: window.__bh.G.state.monsters.length, gold: window.__bh.G.state.res.gold, toasts: [...document.querySelectorAll('.toast')].map((t) => t.textContent) }));
    api.log(label, JSON.stringify(st), logs.filter((l) => l.includes('[save]')).join(' | '));
    await p.close({ runBeforeUnload: false });
  };
  await run('primary corrupted', () => {
    const raw = localStorage.getItem('beasthaven.save');
    localStorage.setItem('beasthaven.save', raw.slice(0, 40) + 'garbage');
  });
  await run('both corrupted', () => {
    localStorage.setItem('beasthaven.save', '{broken');
    localStorage.setItem('beasthaven.save.bak', 'nope');
  });
  await run('empty storage', () => localStorage.clear());
};
