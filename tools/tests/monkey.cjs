// Random clicking across the whole game to shake out runtime errors.
// env: N (iterations), SEED
module.exports = async function (page, api) {
  await page.goto('http://localhost:5173/?nosdk&dev&devads', { waitUntil: 'load' });
  await page.waitForFunction(() => window.__ready === true, null, { timeout: 90000 });
  if (process.env.MID) {
    await api.eval(() => {
      const { G, Tutorial, B, M } = window.__bh;
      Tutorial.finish();
      G.state.player.level = 16;
      G.state.res.gold = 80000;
      G.state.res.food = 50000;
      G.state.res.gems = 300;
      const place = (type, x, z) => { const s = B.findSpot(type, 0, x, z); return s ? B.placeBuilding(type, 0, s.x, s.z, { instant: true }) : null; };
      const fire = place('hab_fire', 2.6, -2.2);
      const nat = place('hab_nature', 3.4, 1.8);
      place('farm', -3.6, 0.8);
      place('breeding', -0.8, -5.8);
      place('rune_forge', 6, -4);
      place('challenge_tower', -6, 3);
      B.placeMonsterIn(M.createMonster('embercub', { level: 12 }), fire);
      B.placeMonsterIn(M.createMonster('sproutle', { level: 11 }), nat);
      M.createMonster('bloomfang', { level: 13 });
      G.state.inventory.chests = { wooden: 3, silver: 1 };
      G.world.syncAll();
    });
  }
  let seed = +(process.env.SEED || 7);
  const rnd = () => ((seed = (seed * 16807) % 2147483647) / 2147483647);
  const N = +(process.env.N || 250);
  const errors = [];
  page.on('pageerror', (e) => errors.push(e.message));
  let lastErr = 0;
  for (let i = 0; i < N; i++) {
    const targets = await api.eval(() => {
      const sel = '#ui button, #ui .mcard, #ui .node-lbl, #ui .bubble, #ui .tab, #ui .qrow button, #ui .tgt-badge, #ui .abtn';
      const out = [];
      for (const el of document.querySelectorAll(sel)) {
        const r = el.getBoundingClientRect();
        if (r.width < 4 || r.height < 4 || r.bottom < 0 || r.right < 0 || r.left > innerWidth || r.top > innerHeight) continue;
        const cs = getComputedStyle(el);
        if (cs.visibility === 'hidden' || cs.pointerEvents === 'none' || +cs.opacity === 0) continue;
        const txt = (el.innerText || '').trim().slice(0, 24);
        if (/reset/i.test(txt)) continue;
        // topmost check
        const x = r.left + r.width / 2, y = r.top + r.height / 2;
        const top = document.elementFromPoint(x, y);
        if (!top || !(top === el || el.contains(top))) continue;
        out.push({ x, y, txt });
      }
      return out;
    });
    const r = rnd();
    if (r < 0.15 || !targets.length) {
      await api.tap(40 + rnd() * 1200, 60 + rnd() * 600);
    } else if (r < 0.2) {
      await page.keyboard.press('Escape');
    } else {
      const t = targets[Math.floor(rnd() * targets.length)];
      await api.tap(t.x, t.y);
    }
    await api.wait(250 + rnd() * 400);
    if (errors.length > lastErr) {
      api.log(`#${i} ERROR:`, errors.slice(lastErr).join(' | '));
      lastErr = errors.length;
      await api.shot(`err-${i}`);
    }
    if (i % 50 === 49) {
      const st = await api.eval(() => ({ mode: window.__bh.G.mode, stack: window.__bh.UI.stack.map((s) => s.key), lvl: window.__bh.G.state.player.level, mons: window.__bh.G.state.monsters.length }));
      api.log(`#${i}`, JSON.stringify(st));
    }
  }
  api.log('total errors', errors.length);
  await api.shot('monkey-end');
};
