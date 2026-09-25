// Plays the first-session tutorial by following the tutorial pointer.
module.exports = async function (page, api) {
  await page.goto('http://localhost:5173/?nosdk&dev', { waitUntil: 'load' });
  await page.waitForFunction(() => window.__ready === true, null, { timeout: 90000 });
  await api.wait(800);
  const step = () => api.eval(() => window.__bh.Tutorial.stepId());
  // Clicks the element the tutorial ring highlights, or the world point under the hand.
  const follow = async () => {
    const info = await api.eval(() => {
      const T = window.__bh.Tutorial;
      const g = T._cur;
      if (!g) return null;
      if (g.el) {
        const r = g.el.getBoundingClientRect();
        return { x: r.left + r.width / 2, y: r.top + r.height / 2, text: g.text };
      }
      if (g.world) {
        const p = window.__bh.G.engine.project(g.world, window.__bh.G.world.camera);
        return { x: p.x, y: p.y + 30, text: g.text, world: true };
      }
      return null;
    });
    return info;
  };
  let last = '';
  let idle = 0;
  for (let i = 0; i < 320; i++) {
    const s = await step();
    if (!s) break;
    const info = await follow();
    const mode = await api.eval(() => window.__bh.G.mode);
    if (s !== last) {
      api.log(`step ${s} (${mode})`, info ? info.text : '-');
      await api.shot(`${s}`);
      last = s;
    }
    if (mode === 'battle') {
      // in battle: tap badge if choice pending, else wait
      const pending = await api.eval(() => !!(window.__bh.Campaign.bs && window.__bh.Campaign.bs.choice));
      if (pending) {
        const b = await api.eval(() => {
          const el = document.querySelector('.bhud .tgt-badge');
          if (!el) return null;
          const r = el.getBoundingClientRect();
          return { x: r.left + r.width / 2, y: r.top + r.height / 2 };
        });
        if (b) {
          await api.shot('battle-choice');
          await api.tap(b.x, b.y);
        }
      }
      const res = await api.eval(() => !!document.querySelector('.results .btn.green, .results .btn.blue'));
      if (res) {
        await api.shot('battle-results');
        await api.click('.results .btn.green, .results .btn.blue');
      }
      await api.wait(700);
      continue;
    }
    if (info) {
      if (process.env.TUTLOG) api.log('tap', Math.round(info.x), Math.round(info.y), info.text);
      await api.tap(info.x, info.y);
      await api.wait(info.world ? 900 : 700);
      idle = 0;
    } else {
      // tap anywhere for reveal
      if (mode === 'reveal') {
        const place = await api.eval(() => !!document.querySelector('[data-tut="reveal-place"]'));
        if (place) {
          await api.shot('reveal');
          await api.click('[data-tut="reveal-place"]');
        } else await api.tap(640, 360);
      }
      idle++;
      if (idle % 4 === 3) {
        const top = await api.eval(() => { const t = window.__bh.G && document.querySelector('#screens > .scr:last-child'); return t ? t.innerText.slice(0, 60) : null; });
        if (top) {
          api.log('closing unexpected screen:', top.replace(/\n/g, ' '));
          await api.shot('unexpected');
          await page.keyboard.press('Escape');
        }
      }
      await api.wait(900);
    }
  }
  await api.shot('end');
  const st = await api.eval(() => {
    const G = window.__bh.G;
    return { step: G.state.tutorial.step, done: G.state.tutorial.done, level: G.state.player.level, monsters: G.state.monsters.map((m) => m.sp + ':' + m.lvl), res: G.state.res, main: G.state.quests.main };
  });
  api.log(JSON.stringify(st));
};
