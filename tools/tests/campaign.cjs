// Plays campaign stages through the real UI (stage panel -> team -> battle -> results).
module.exports = async function (page, api) {
  await page.goto('http://localhost:5173/?nosdk&dev', { waitUntil: 'load' });
  await page.waitForFunction(() => window.__ready === true, null, { timeout: 90000 });
  const from = +(process.env.FROM || 2), to = +(process.env.TO || 10);
  await api.eval((from) => {
    const { G, Tutorial, M } = window.__bh;
    Tutorial.finish();
    G.state.player.level = 4;
    G.state.res.energy = 40;
    for (let s = 1; s < from; s++) G.state.campaign.clears[`1-${s}`] = 1;
    M.createMonster('embercub', { level: 6 });
    M.createMonster('sproutle', { level: 5 });
    M.createMonster('bloomfang', { level: 5 });
  }, from);
  await api.eval(() => window.__bh.Game.actions.battle());
  await api.wait(3000);
  const tapBadge = async () => {
    const b = await api.eval(() => {
      const el = document.querySelector('.bhud .tgt-badge');
      if (!el || !(window.__bh.Campaign.bs && window.__bh.Campaign.bs.choice)) return null;
      const r = el.getBoundingClientRect();
      return { x: r.left + r.width / 2, y: r.top + r.height / 2 };
    });
    if (b) await api.tap(b.x, b.y);
  };
  for (let s = from; s <= to; s++) {
    await api.eval((s) => window.__bh.Campaign.openStage(1, s), s);
    await api.wait(700);
    const fight = await api.eval(() => !!document.querySelector('[data-tut="stage-go"]'));
    const t0 = Date.now();
    if (fight) {
      await api.click('[data-tut="stage-go"]');
      await api.wait(900);
      await api.click('[data-tut="team-fight"]');
      let done = false;
      for (let i = 0; i < 400 && !done; i++) {
        await api.wait(350);
        await tapBadge();
        done = await api.eval(() => !!document.querySelector('.results .btn.lg'));
      }
      const res = await api.eval(() => ({ win: !!document.querySelector('.results .big-title.gold'), stars: document.querySelectorAll('.results .rs.on').length, items: [...document.querySelectorAll('.results .rw-item .n')].map((e) => e.textContent) }));
      api.log(`1-${s} battle`, JSON.stringify(res), `${((Date.now() - t0) / 1000).toFixed(0)}s`);
      if (s === from) await api.shot(`results-${s}`);
      await api.click('.results .btn.lg');
      await api.wait(3500);
    } else {
      await api.click('.panel .dlg-actions .btn.lg');
      await api.wait(1200);
      const items = await api.eval(() => [...document.querySelectorAll('.celebrate .rw-item .n')].map((e) => e.textContent));
      api.log(`1-${s} node`, JSON.stringify(items));
      await api.shot(`node-${s}`);
      await api.click('.celebrate .btn.lg');
      await api.wait(2500);
    }
    const lv = await api.eval(() => window.__bh.UI.stack.map((x) => x.key));
    if (lv.length) {
      api.log('closing', lv.join(','));
      await api.eval(() => window.__bh.UI.closeAll());
      await api.wait(400);
    }
  }
  await api.shot('map-end');
  api.log('state', JSON.stringify(await api.eval(() => ({ lvl: window.__bh.G.state.player.level, gold: window.__bh.G.state.res.gold, food: window.__bh.G.state.res.food, energy: window.__bh.G.state.res.energy, eggs: window.__bh.G.state.hatchery.map((e) => e.sp), clears: Object.keys(window.__bh.G.state.campaign.clears).length }))));
};
