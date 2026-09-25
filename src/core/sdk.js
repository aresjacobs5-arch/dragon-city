// Safe wrapper around the CrazyGames HTML5 SDK (v3).
// Everything degrades gracefully: if the SDK script can't load (local dev,
// offline, ad blockers), calls become no-ops and ads report "unavailable".

const SDK_URL = 'https://sdk.crazygames.com/crazygames-sdk-v3.js';

export const SDK = {
  sdk: null,
  env: 'none', // 'none' | 'local' | 'crazygames' | 'disabled'
  available: false,
  dataAvailable: false,
  adPlaying: false,
  lastMidgame: 0,
  gameplayActive: false,
  onMuteChange: null,
  onAdStart: null,
  onAdEnd: null,
  forceDevAds: false,

  async init(timeoutMs = 3500) {
    const params = new URLSearchParams(location.search);
    this.forceDevAds = params.has('devads');
    if (params.has('nosdk')) return this;
    try {
      await Promise.race([this._loadScript(), new Promise((_, rej) => setTimeout(() => rej(new Error('sdk timeout')), timeoutMs))]);
      const sdk = window.CrazyGames && window.CrazyGames.SDK;
      if (!sdk) throw new Error('sdk missing');
      await Promise.race([sdk.init(), new Promise((_, rej) => setTimeout(() => rej(new Error('init timeout')), timeoutMs))]);
      this.sdk = sdk;
      this.env = sdk.environment || 'crazygames';
      this.available = this.env !== 'disabled';
      this.dataAvailable = this.available && !!sdk.data;
      try {
        sdk.game.addSettingsChangeListener(() => this._emitMute());
      } catch (e) {
        /* optional */
      }
      this._emitMute();
    } catch (e) {
      console.info('[sdk] CrazyGames SDK not available:', e.message);
      this.sdk = null;
      this.available = false;
    }
    return this;
  },

  _loadScript() {
    return new Promise((resolve, reject) => {
      if (window.CrazyGames && window.CrazyGames.SDK) return resolve();
      const s = document.createElement('script');
      s.src = SDK_URL;
      s.async = true;
      s.onload = () => resolve();
      s.onerror = () => reject(new Error('sdk load failed'));
      document.head.appendChild(s);
    });
  },

  _emitMute() {
    try {
      const muted = !!(this.sdk && this.sdk.game && this.sdk.game.settings && this.sdk.game.settings.muteAudio);
      if (this.onMuteChange) this.onMuteChange(muted);
    } catch (e) {
      /* ignore */
    }
  },

  _call(fn) {
    if (!this.sdk) return;
    try {
      const r = fn(this.sdk);
      if (r && r.catch) r.catch(() => {});
    } catch (e) {
      console.warn('[sdk] call failed', e);
    }
  },

  loadingStart() {
    this._call((s) => s.game.loadingStart());
  },
  loadingStop() {
    this._call((s) => s.game.loadingStop());
  },
  gameplayStart() {
    if (this.gameplayActive) return;
    this.gameplayActive = true;
    this._call((s) => s.game.gameplayStart());
  },
  gameplayStop() {
    if (!this.gameplayActive) return;
    this.gameplayActive = false;
    this._call((s) => s.game.gameplayStop());
  },
  happytime() {
    this._call((s) => s.game.happytime && s.game.happytime());
  },

  // ---------------- ads
  adsReady() {
    return (this.available || this.forceDevAds) && !this.adPlaying;
  },

  // Rewarded ads are always player-initiated. Resolves true if the reward should be granted.
  rewarded() {
    return new Promise((resolve) => {
      if (this.adPlaying) return resolve(false);
      if (!this.sdk) {
        if (this.forceDevAds) return this._fakeAd().then(resolve);
        return resolve(false);
      }
      this.adPlaying = true;
      const wasActive = this.gameplayActive;
      const done = (ok) => {
        this.adPlaying = false;
        if (this.onAdEnd) this.onAdEnd();
        if (wasActive) this.gameplayStart();
        resolve(ok);
      };
      try {
        this.sdk.ad.requestAd('rewarded', {
          adStarted: () => {
            this.gameplayStop();
            if (this.onAdStart) this.onAdStart();
          },
          adFinished: () => done(true),
          adError: (err) => {
            console.info('[sdk] rewarded ad error', err);
            done(false);
          },
        });
      } catch (e) {
        done(false);
      }
    });
  },

  // Midgame ads only at natural breaks, never more than once every 4 minutes,
  // and never during the first 10 minutes of a fresh player's session.
  canMidgame(sessionSeconds, tutorialDone) {
    if (!this.sdk || this.adPlaying) return false;
    if (!tutorialDone || sessionSeconds < 600) return false;
    return Date.now() - this.lastMidgame > 240000;
  },
  midgame() {
    return new Promise((resolve) => {
      if (!this.sdk || this.adPlaying) return resolve(false);
      this.adPlaying = true;
      this.lastMidgame = Date.now();
      const wasActive = this.gameplayActive;
      const done = (ok) => {
        this.adPlaying = false;
        if (this.onAdEnd) this.onAdEnd();
        if (wasActive) this.gameplayStart();
        resolve(ok);
      };
      try {
        this.sdk.ad.requestAd('midgame', {
          adStarted: () => {
            this.gameplayStop();
            if (this.onAdStart) this.onAdStart();
          },
          adFinished: () => done(true),
          adError: () => done(false),
        });
      } catch (e) {
        done(false);
      }
    });
  },

  _fakeAd() {
    // Local development stand-in so rewarded flows can be tested (?devads).
    return new Promise((resolve) => {
      this.adPlaying = true;
      if (this.onAdStart) this.onAdStart();
      const el = document.createElement('div');
      el.style.cssText = 'position:fixed;inset:0;z-index:99;background:#000c;color:#fff;display:flex;align-items:center;justify-content:center;font:900 28px sans-serif';
      el.textContent = 'Ad playing…';
      document.body.appendChild(el);
      setTimeout(() => {
        el.remove();
        this.adPlaying = false;
        if (this.onAdEnd) this.onAdEnd();
        resolve(true);
      }, 1500);
    });
  },

  // ---------------- data (cloud save for logged-in players)
  getData(key) {
    if (!this.dataAvailable) return null;
    try {
      return this.sdk.data.getItem(key);
    } catch {
      return null;
    }
  },
  setData(key, value) {
    if (!this.dataAvailable) return;
    try {
      this.sdk.data.setItem(key, value);
    } catch (e) {
      console.warn('[sdk] data write failed', e);
    }
  },

  async getUser() {
    if (!this.sdk || !this.sdk.user) return null;
    try {
      return await this.sdk.user.getUser();
    } catch {
      return null;
    }
  },
};
