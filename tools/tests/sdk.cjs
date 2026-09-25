// Injects a fake CrazyGames SDK v3 and verifies the game's calls and ad gating.
module.exports = async function (page, api) {
  await page.addInitScript(() => {
    const calls = [];
    window.__sdkCalls = calls;
    const settings = { muteAudio: false };
    const listeners = [];
    const store = {};
    window.CrazyGames = {
      SDK: {
        environment: 'crazygames',
        init: async () => calls.push('init'),
        game: {
          settings,
          gameplayStart: () => calls.push('gameplayStart'),
          gameplayStop: () => calls.push('gameplayStop'),
          loadingStart: () => calls.push('loadingStart'),
          loadingStop: () => calls.push('loadingStop'),
          happytime: () => calls.push('happytime'),
          addSettingsChangeListener: (fn) => listeners.push(fn),
        },
        ad: {
          requestAd: (type, cb) => {
            calls.push('requestAd:' + type);
            setTimeout(() => cb.adStarted && cb.adStarted(), 50);
            setTimeout(() => cb.adFinished && cb.adFinished(), 400);
          },
        },
        data: {
          getItem: (k) => (k in store ? store[k] : null),
          setItem: (k, v) => {
            calls.push('data.setItem');
            store[k] = v;
          },
        },
        user: { getUser: async () => null },
      },
    };
    window.__muteFromSdk = (v) => {
      settings.muteAudio = v;
      listeners.forEach((f) => f());
    };
  });
  await page.goto('http://localhost:5173/?dev', { waitUntil: 'load' });
  await page.waitForFunction(() => window.__ready === true, null, { timeout: 90000 });
  await api.wait(500);
  api.log('after boot:', JSON.stringify(await api.eval(() => window.__sdkCalls)));
  // rewarded ad flow: gems video from the shop
  const before = await api.eval(() => window.__bh.G.state.res.gems);
  await api.eval(() => window.__bh.Game.actions.adForGems(() => {}));
  await api.wait(1500);
  const after = await api.eval(() => window.__bh.G.state.res.gems);
  api.log('rewarded gems:', before, '->', after, JSON.stringify(await api.eval(() => window.__sdkCalls.slice(-4))));
  // midgame must be blocked: tutorial not done and session < 10 minutes
  const can1 = await api.eval(() => window.__bh.G.sdk.canMidgame(30, false));
  const can2 = await api.eval(() => window.__bh.G.sdk.canMidgame(700, true));
  api.log('canMidgame early/tutorial:', can1, ' after 11.6min+tutorial:', can2);
  // mute propagation from the platform
  await api.eval(() => window.__muteFromSdk(true));
  api.log('audio sdkMuted:', await api.eval(() => window.__bh.G.audio.sdkMuted));
  // cloud save mirror
  await api.eval(() => window.__bh.saveGame(true));
  await api.wait(300);
  api.log('data writes:', await api.eval(() => window.__sdkCalls.filter((c) => c === 'data.setItem').length));
  // battle start/finish should not trigger midgame during battle
  const midInBattle = await api.eval(() => window.__sdkCalls.filter((c) => c === 'requestAd:midgame').length);
  api.log('midgame requests so far:', midInBattle);
};
