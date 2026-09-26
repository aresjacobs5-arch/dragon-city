// Starts a scripted battle (auto mode) and screenshots it periodically.
// env: BOSS=1 for a boss fight, THEME=volcanic, SHOTS=16
module.exports = async function (page, api) {
  await page.goto('http://localhost:5173/?nosdk&dev', { waitUntil: 'load' });
  await page.waitForFunction(() => window.__ready === true, null, { timeout: 90000 });
  const boss = !!process.env.BOSS;
  const theme = process.env.THEME || (boss ? 'volcanic' : 'coral');
  await api.eval(({ boss, theme }) => {
    const { G, Campaign, Tutorial } = window.__bh;
    Tutorial.finish();
    G.state.player.level = 12;
    G.state.settings.auto = true;
    const mk = (sp, lvl) => {
      const m = { id: G.uid(), sp, lvl, xp: 0, rank: 0, hab: null, runes: [], relic: null, got: Date.now() };
      G.state.monsters.push(m);
      return m;
    };
    const team = [mk('embercub', 16), mk('ripplet', 15), mk('sproutle', 15)];
    const enemies = boss
      ? [{ sp: 'boss_lavaturtle', lvl: 12, boss: true }]
      : [{ sp: 'zapkit', lvl: 14, elite: true }, { sp: 'pebblor', lvl: 13 }, { sp: 'frostnip', lvl: 13 }];
    Campaign.startBattle({ kind: 'tower', title: boss ? 'Boss Test' : 'Battle Test', theme, enemies, team, energy: 0, onWin: () => [] });
  }, { boss, theme });
  const n = +(process.env.SHOTS || 16);
  for (let i = 0; i < n; i++) {
    await api.wait(+(process.env.GAP || 1100));
    const done = await api.eval(() => !!document.querySelector('.results'));
    await api.shot(`b${i}`);
    if (done) break;
  }
};
