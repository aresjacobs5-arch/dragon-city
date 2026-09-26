// Save/load round trip through a real page reload, plus corruption recovery.
module.exports = async function (page, api) {
  const url = 'http://localhost:5173/?nosdk&dev';
  await page.goto(url, { waitUntil: 'load' });
  await page.waitForFunction(() => window.__ready === true, null, { timeout: 90000 });
  const before = await api.eval(() => {
    const { G, Tutorial, B, M } = window.__bh;
    Tutorial.finish();
    const s = B.findSpot('hab_fire', 0, 2.6, -2.2);
    const b = B.placeBuilding('hab_fire', 0, s.x, s.z, { instant: true });
    const m = M.createMonster('embercub', { level: 4 });
    B.placeMonsterIn(m, b);
    G.state.res.gold = 4321;
    G.state.campaign.clears['1-1'] = 1;
    window.__bh.saveGame(true);
    return { b: G.state.buildings.length, m: G.state.monsters.length, gold: G.state.res.gold, tut: G.state.tutorial.done };
  });
  api.log('before', JSON.stringify(before));
  await page.reload({ waitUntil: 'load' });
  await page.waitForFunction(() => window.__ready === true, null, { timeout: 90000 });
  await api.wait(800);
  const after = await api.eval(() => {
    const { G } = window.__bh;
    return { b: G.state.buildings.length, m: G.state.monsters.length, gold: G.state.res.gold, tut: G.state.tutorial.done, c11: !!G.state.campaign.clears['1-1'] };
  });
  api.log('after reload', JSON.stringify(after));
  await api.shot('after-reload');
  // corrupt the primary save; the backup must be used
  await api.eval(() => {
    window.__bh.saveGame(true); // ensure backup = previous good save
    const raw = localStorage.getItem('beasthaven.save');
    localStorage.setItem('beasthaven.save', raw.slice(0, raw.length / 2) + 'garbage');
  });
  await page.reload({ waitUntil: 'load' });
  await page.waitForFunction(() => window.__ready === true, null, { timeout: 90000 });
  await api.wait(600);
  const rec = await api.eval(() => {
    const { G } = window.__bh;
    return { b: G.state.buildings.length, m: G.state.monsters.length, gold: G.state.res.gold, toast: [...document.querySelectorAll('.toast')].map((t) => t.textContent) };
  });
  api.log('after corruption', JSON.stringify(rec));
  await api.shot('after-corrupt');
  // both copies corrupted -> fresh game, no crash
  await api.eval(() => {
    localStorage.setItem('beasthaven.save', '{broken');
    localStorage.setItem('beasthaven.save.bak', 'nope');
  });
  await page.reload({ waitUntil: 'load' });
  await page.waitForFunction(() => window.__ready === true, null, { timeout: 90000 });
  const fresh = await api.eval(() => ({ b: window.__bh.G.state.buildings.length, m: window.__bh.G.state.monsters.length, eggs: window.__bh.G.state.hatchery.length }));
  api.log('both corrupted', JSON.stringify(fresh));
  await api.eval(() => localStorage.clear());
};
