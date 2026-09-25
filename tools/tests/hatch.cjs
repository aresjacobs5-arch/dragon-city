// Captures the hatch reveal sequence for a chosen species (env SP, default a rare-ish hybrid).
module.exports = async function (page, api) {
  await page.goto('http://localhost:5173/?nosdk&dev', { waitUntil: 'load' });
  await page.waitForFunction(() => window.__ready === true, null, { timeout: 90000 });
  const sp = process.env.SP || 'stormeel';
  await api.eval((sp) => {
    const { G, Tutorial, HT } = window.__bh;
    Tutorial.finish();
    G.state.hatchery = [];
    HT.addEgg(sp, { instant: true });
  }, sp);
  await api.wait(300);
  await api.eval(() => window.__bh.Game.actions.hatch(window.__bh.G.state.hatchery[0]));
  for (let i = 0; i < 14; i++) {
    await api.wait(i < 3 ? 500 : 700);
    await api.shot('h' + i);
    const placed = await api.eval(() => !!document.querySelector('[data-tut="reveal-place"]'));
    if (placed && i > 8) break;
  }
};
