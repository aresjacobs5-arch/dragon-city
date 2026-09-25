// Opens every screen for visual review. Uses a mid-game save built via dev hooks.
module.exports = async function (page, api) {
  await page.goto('http://localhost:5173/?nosdk&dev&devads', { waitUntil: 'load' });
  await page.waitForFunction(() => window.__ready === true, null, { timeout: 90000 });
  await api.eval(() => {
    const { G, Tutorial } = window.__bh;
    Tutorial.finish();
    const S = G.state;
    S.player.level = 14;
    S.res.gold = 25000;
    S.res.food = 12000;
    S.res.gems = 140;
    S.res.relicFrags = 20;
    S.res.runeDust = 45;
    const mk = (sp, lvl, rank = 0) => {
      const m = { id: G.uid(), sp, lvl, xp: 0, rank, hab: null, runes: [], relic: null, got: Date.now() };
      S.monsters.push(m);
      S.dex[sp] = 2;
      return m;
    };
    mk('embercub', 12, 1); mk('sproutle', 11); mk('bloomfang', 14, 1); mk('ripplet', 9); mk('pebblor', 8); mk('zapkit', 10); mk('ashhorn', 13); mk('stormeel', 6);
    for (const sp of ['frostnip', 'lumipup', 'gloomling']) S.dex[sp] = 1;
    for (let w = 1; w <= 1; w++) for (let s = 1; s <= 12; s++) { S.campaign.clears[`${w}-${s}`] = 1; S.campaign.stars[`${w}-${s}`] = s % 3 === 0 ? 2 : 3; }
    S.inventory.chests = { wooden: 2, silver: 1 };
    S.inventory.runes = [{ id: G.uid(), type: 'atk', tier: 1, on: null }, { id: G.uid(), type: 'atk', tier: 1, on: null }, { id: G.uid(), type: 'atk', tier: 1, on: null }, { id: G.uid(), type: 'hp', tier: 2, on: null }];
    S.inventory.relics = { iron_heart: 1 };
    S.shards = { embercub: 25, zapkit: 12 };
    S.tower.floor = 3;
    G.markDirty();
  });
  await api.wait(500);
  const A = (expr) => api.eval(`window.__bh.Game.actions.${expr}`);
  const closeAll = async () => {
    await api.eval(() => window.__bh.UI.closeAll());
    await api.wait(250);
  };
  const list = [
    ['shop-habitats', 'shop("habitats")'],
    ['shop-buildings', 'shop("buildings")'],
    ['shop-monsters', 'shop("monsters")'],
    ['shop-resources', 'shop("resources")'],
    ['monsters', 'monsters()'],
    ['dex', 'dex()'],
    ['quests', 'quests()'],
    ['daily', 'daily()'],
    ['wheel', 'wheel()'],
    ['chests', 'chests()'],
    ['events', 'events()'],
    ['settings', 'settings()'],
    ['profile', 'profile()'],
    ['breed', 'breed()'],
    ['hatchery', 'openHatchery()'],
    ['runes', 'runes()'],
    ['relics', 'relics()'],
    ['shrine', 'shrine()'],
  ];
  for (const [name, expr] of list) {
    try {
      await A(expr);
      await api.wait(1400);
      await api.shot(name);
    } catch (e) {
      api.log('ERR', name, e.message);
    }
    await closeAll();
    await api.wait(300);
  }
  // monster detail
  await api.eval(() => window.__bh.Game.actions.monsterDetail(window.__bh.G.state.monsters[2]));
  await api.wait(1600);
  await api.shot('monster-detail');
  await closeAll();
  // campaign map + stage + team
  await A('battle()');
  await api.wait(2500);
  await api.shot('map');
  await api.eval(() => window.__bh.Campaign.openStage(1, 13));
  await api.wait(900);
  await api.shot('stage');
  await api.click('[data-tut="stage-go"]');
  await api.wait(1200);
  await api.shot('team');
  await closeAll();
  await api.eval(() => window.__bh.Campaign.openStage(1, 15));
  await api.wait(900);
  await api.shot('stage-treasure');
  await closeAll();
  await api.eval(() => window.__bh.Campaign.openTower());
  await api.wait(900);
  await api.shot('tower');
  await closeAll();
};
