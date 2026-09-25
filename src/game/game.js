import * as THREE from 'three';
import { G, createNewState } from './G.js';
import { Engine } from '../render/engine.js';
import { HomeView, buildingWorldPos } from '../render/world/homeView.js';
import { Showcase } from '../render/showcase.js';
import { Thumbnailer } from '../render/portraits.js';
import { loadGame, saveGame, startAutosave, pickNewest, readCloud, wipeSave } from '../core/save.js';
import { SDK } from '../core/sdk.js';
import { Audio } from '../core/audio.js';
import { UI } from '../ui/ui.js';
import { HUD } from '../ui/hud.js';
import { Markers } from '../ui/markers.js';
import { h, icon, fmt, onAnyClick } from '../ui/dom.js';
import { cloudTransition, wait } from '../ui/transition.js';
import * as Sheets from '../ui/screens/sheets.js';
import { openMonsters, openMonsterDetail, monsterCard } from '../ui/screens/monsters.js';
import { openShop, eggPrice } from '../ui/screens/shop.js';
import { openDex } from '../ui/screens/dex.js';
import { openBreed, openHatchery } from '../ui/screens/breed.js';
import { openQuests } from '../ui/screens/quests.js';
import * as RW from '../ui/screens/rewards.js';
import { BUILDINGS } from '../data/buildings.js';
import { ISLAND_BY_ID } from '../data/islands.js';
import { RARITIES, rarityIdx } from '../data/rarities.js';
import { ELEMENTS } from '../data/elements.js';
import { RELIC_BY_ID, RUNE_SLOTS_BY_LEVEL } from '../data/rewards.js';
import * as B from '../systems/buildings.js';
import * as M from '../systems/monsters.js';
import * as BR from '../systems/breeding.js';
import * as HT from '../systems/hatchery.js';
import * as Q from '../systems/quests.js';
import * as RWD from '../systems/rewards.js';
import * as EV from '../systems/events.js';
import { add, spend, canAfford, missing, gemsForResources, refreshEnergy, maxEnergy } from '../systems/resources.js';
import { addXP, isUnlocked, elementUnlocked } from '../systems/player.js';
import { stat } from '../systems/stats.js';
import { computeOffline } from '../systems/offline.js';
import { stageForLevel } from '../render/monsters/builder.js';
import { Tutorial } from './tutorial.js';
import { Campaign } from './campaignMode.js';

export const Game = {
  sessionStart: performance.now(),
  levelQueue: [],
  evoQueue: [],
  busy: 0, // >0 while a blocking cinematic plays

  async boot(progress) {
    progress(0.05, 'Waking the islands');
    UI.init();
    const sdkP = SDK.init();
    // ---- engine
    const canvas = document.getElementById('game');
    const engine = new Engine(canvas);
    G.engine = engine;
    G.sdk = SDK;
    G.audio = Audio;
    progress(0.15, 'Connecting');
    await sdkP;
    SDK.loadingStart();
    SDK.onMuteChange = (m) => Audio.setSdkMuted(m);
    SDK.onAdStart = () => Audio.pause(true);
    SDK.onAdEnd = () => Audio.pause(false);
    // ---- save
    progress(0.25, 'Loading your save');
    let loaded = loadGame();
    loaded = pickNewest(loaded, readCloud());
    const fresh = !loaded.state;
    G.state = loaded.state || createNewState(Date.now());
    if (loaded.recovered) this._recoveredNotice = true;
    if (fresh) this._setupNewGame();
    B.initBuildingsSystem();
    EV.initEvents();
    Q.ensureDaily();
    // ---- world
    progress(0.4, 'Growing trees');
    await nextFrame();
    const world = new HomeView(engine);
    G.world = world;
    world.initFromState();
    progress(0.62, 'Hatching monsters');
    await nextFrame();
    this.thumbs = new Thumbnailer(engine);
    this.showcase = new Showcase(engine);
    // precompile shaders for the first scene to avoid hitches
    progress(0.75, 'Painting the sky');
    engine.setWorld(world);
    try {
      await engine.renderer.compileAsync(world.scene, world.camera);
    } catch (e) {
      /* older drivers */
    }
    progress(0.86, 'Almost there');
    HUD.init(this.actions);
    Markers.init(this.actions);
    Campaign.init(this);
    this._bindInput();
    this._bindEvents();
    this.applyAudioSettings();
    engine.onFrame((dt) => this.tick(dt));
    engine.start();
    startAutosave();
    const hud = document.getElementById('hud');
    // intro camera
    const home = ISLAND_BY_ID[0];
    world.camCtl.target.set(home.center[0] + 1, 0, home.center[1] + 1);
    world.camCtl.goal.copy(world.camCtl.target);
    world.camCtl.distance = 70;
    world.camCtl.goalDistance = fresh ? 40 : 42;
    progress(1, 'Ready');
    SDK.loadingStop();
    await wait(150);
    // first user gesture unlocks audio
    const unlock = () => {
      Audio.unlock();
      Audio.playMusic(G.mode === 'island' ? 'island' : G.mode);
      window.removeEventListener('pointerdown', unlock, true);
      window.removeEventListener('keydown', unlock, true);
    };
    window.addEventListener('pointerdown', unlock, true);
    window.addEventListener('keydown', unlock, true);
    onAnyClick(() => Audio.play('click'));
    SDK.gameplayStart();
    // pause gameplay reporting, music and saving cadence while the tab is hidden
    document.addEventListener('visibilitychange', () => {
      if (document.hidden) {
        SDK.gameplayStop();
        Audio.pause(true, 'hidden');
        saveGame(true);
      } else {
        Audio.pause(false, 'hidden');
        if (!SDK.adPlaying) SDK.gameplayStart();
      }
    });
    // offline earnings
    if (!fresh) {
      const off = computeOffline(G.state.lastTick);
      if (off && (off.gold > 5 || off.crops || off.eggs || off.breed)) {
        RW.openWelcomeBack(off, this.actions, (mult) => this._collectOffline(off, mult));
      }
    }
    if (this._recoveredNotice) UI.toast('Your save was restored from a backup.', { icon: 'info' });
    Tutorial.init(this);
    return fresh;
  },

  _setupNewGame() {
    // The Hatchery is pre-built with the starter egg already warming.
    const spot = B.findSpot('hatchery', 0, -2.5, -2.5);
    B.placeBuilding('hatchery', 0, spot.x, spot.z, { free: true, instant: true });
    G.state.player.xp = 0;
    HT.addEgg('embercub', { source: 'starter' });
    G.state.flags.starter = true;
    saveGame(true);
  },

  _collectOffline(off, mult) {
    if (off.gold > 0) {
      // offline gold stays in habitats; collect it all now with a flourish
      let total = 0;
      for (const b of G.state.buildings) if (B.isHabitat(b)) total += B.collectHabitat(b);
      if (mult > 1 && total > 0) add('gold', total * (mult - 1), { source: 'offline' });
      const pill = HUD.pill('gold');
      HUD.hold('gold', 900);
      UI.fly('gold', { x: window.innerWidth / 2, y: window.innerHeight / 2 }, pill, { count: 10, onArrive: () => HUD.bump('gold') });
      Audio.play('collect');
    }
  },

  // ------------------------------------------------------------------ frame
  tick(dt) {
    const now = G.now();
    B.tickBuildings(now);
    BR.tickBreeding(now);
    HT.tickHatchery(now);
    UI.update(dt);
    if (G.mode === 'island') {
      HUD.update(dt);
      Markers.update(dt);
      Sheets.updateSheet(dt);
    }
    Tutorial.update(dt);
    this._questT = (this._questT || 0) - dt;
    if (this._questT <= 0) {
      this._questT = 0.5;
      Q.checkCompletions();
      this._maybeShowEvolution();
      this._maybeShowLevelUp();
      this._maybeShowDaily();
    }
    if (G.mode === 'battle' || G.mode === 'map') Campaign.update(dt);
  },

  // Once per day, greet returning players with the login calendar.
  _maybeShowDaily() {
    if (this._dailyShown || !G.state.tutorial.done || this.busy || G.mode !== 'island') return;
    if (UI.stack.length || this.levelQueue.length || this.evoQueue.length || (G.world && G.world.placing)) return;
    if (performance.now() - this.sessionStart < 2500) return;
    this._dailyShown = true;
    if (!RWD.loginStatus().claimedToday) RW.openDaily(this.actions);
  },

  _maybeShowEvolution() {
    if (!this.evoQueue.length || this.busy || G.mode !== 'island') return;
    if (UI.stack.some((s) => ['levelup', 'rewards', 'reveal', 'evolve', 'confirm'].includes(s.key))) return;
    const e = this.evoQueue.shift();
    this.evoQueue = this.evoQueue.filter((x) => x.m !== e.m);
    this.celebrateEvolution(e.m, e.fromStage, Math.max(e.toStage, stageForLevel(e.m.lvl)));
  },

  async celebrateEvolution(m, fromStage, toStage) {
    const def = M.species(m.sp);
    this.busy++;
    const sc = this.showcase;
    const ui = h('div.reveal-ui');
    const top = h('div.top');
    const bottom = h('div.bottom');
    ui.append(top, bottom);
    const scr = { key: 'evolve', dim: 0, hideHud: true, solo: true, el: h('div.scr'), escClose: false };
    scr.el.appendChild(ui);
    scr.el.addEventListener('pointerdown', () => sc.skip());
    await cloudTransition(() => {
      G.mode = 'reveal';
      G.world.camCtl.enabled = false;
      G.engine.setWorld(sc);
      UI.open(scr);
      top.appendChild(h('div.big-title', { style: { fontSize: '2.4rem' } }, `${M.monsterName(m)} is evolving!`));
    }, { sound: () => Audio.play('whoosh') });
    Audio.play('charge');
    sc.playEvolve(def, fromStage, toStage, {
      sfx: (n) => Audio.play(n),
      onFlash: () => {
        Audio.play('burst');
        Audio.jingle('levelup');
        SDK.happytime();
      },
      onReveal: () => {
        Audio.play('roar', { pitch: 120 });
        top.innerHTML = '';
        top.append(h('div.big-title.gold', { style: { fontSize: '3rem' } }, 'EVOLVED!'), h('div.nm.display.ol', null, M.monsterName(m)), h('div.rar.rar-chip', { style: { background: RARITIES[def.rarity].color } }, toStage === 2 ? 'Final form' : 'Grown up'));
        bottom.append(h('button.btn.lg.green', { onclick: () => finish() }, icon('check'), 'Awesome!'), h('div.small.ol-s', null, 'Evolved monsters are stronger and earn more gold.'));
        scr.el.onpointerdown = null;
      },
    });
    const self = this;
    let done = false;
    async function finish() {
      if (done) return;
      done = true;
      await cloudTransition(() => {
        UI.close(scr);
        G.mode = 'island';
        G.world.camCtl.enabled = true;
        G.engine.setWorld(G.world);
        sc.clear();
        UI._sync();
      });
      self.busy--;
      const a = G.world.actorFor(m.id);
      if (a) {
        a.view.animator.play('happy');
        G.world.particles.emit('sparkle', a.view.group.position.clone().setY(1), { count: 24, spread: 0.6 });
      }
      const d = UI.find('mdetail');
      if (d && d.refresh) d.refresh();
    }
  },

  _maybeShowLevelUp() {
    if (!this.levelQueue.length || this.busy || (G.mode !== 'island' && G.mode !== 'map')) return;
    if (UI.stack.length || (G.world && G.world.placing)) return;
    if (Tutorial.blocksPopups()) return;
    // several level-ups at once (big rewards) become one celebration
    const all = this.levelQueue.splice(0);
    const lv = {
      level: all[all.length - 1].level,
      unlocks: all.flatMap((l) => l.unlocks),
      reward: all.reduce((r, l) => ({ gold: r.gold + l.reward.gold, food: r.food + l.reward.food, gems: r.gems + l.reward.gems }), { gold: 0, food: 0, gems: 0 }),
    };
    Sheets.closeSheet();
    Audio.jingle('levelup');
    SDK.happytime();
    RW.openLevelUp(lv.level, lv.unlocks, lv.reward, this.actions, () => {
      HUD.refresh();
      if (lv.unlocks.some((u) => u.feature.startsWith('island_'))) UI.toast('A new island can be unlocked!', { icon: 'island', kind: 'good' });
    });
  },

  // ------------------------------------------------------------------ input
  _bindInput() {
    const world = G.world;
    const cam = world.camCtl;
    cam.onTap = (x, y) => this._onTap(x, y);
    cam.onDragStart = (x, y) => {
      const p = world.placing;
      if (!p) return false;
      // drag the ghost if the pointer starts on/near it
      const gp = cam.groundPoint(x, y, new THREE.Vector3());
      if (!gp) return false;
      const [w, d] = BUILDINGS[p.type].size;
      const c = p.group.position;
      if (Math.abs(gp.x - c.x) <= w / 2 + 0.6 && Math.abs(gp.z - c.z) <= d / 2 + 0.6) {
        this._dragOffset = { x: c.x - gp.x, z: c.z - gp.z };
        return true;
      }
      return false;
    };
    cam.onDragMove = (x, y) => {
      const p = world.placing;
      if (!p) return;
      const gp = cam.groundPoint(x, y, new THREE.Vector3());
      if (!gp) return;
      gp.x += this._dragOffset.x;
      gp.z += this._dragOffset.z;
      const cell = world.cellAt(gp);
      if (cell && (cell.x !== p.x || cell.z !== p.z || cell.island !== p.island)) {
        world.movePlacingTo(cell.island, cell.x, cell.z);
        Audio.play('tick');
      }
    };
    cam.onDragEnd = () => {};
    // keyboard zoom for desktop accessibility
    window.addEventListener('keydown', (e) => {
      if (G.mode !== 'island' || UI.stack.length) return;
      if (e.key === '+' || e.key === '=') cam.zoomBy(0.85);
      if (e.key === '-') cam.zoomBy(1.18);
    });
  },

  _onTap(x, y) {
    if (G.mode !== 'island' || this.busy) return;
    const world = G.world;
    if (world.placing) {
      const gp = world.camCtl.groundPoint(x, y, new THREE.Vector3());
      if (gp) {
        const cell = world.cellAt(gp);
        if (cell) world.movePlacingTo(cell.island, cell.x, cell.z);
      }
      return;
    }
    if (UI.stack.length) return;
    const hit = world.pick(x, y);
    if (!hit) {
      this.actions.deselect();
      return;
    }
    if (hit.kind === 'building') this.actions.select(hit.id);
    else if (hit.kind === 'obstacle') {
      const o = B.activeObstacles(Number(hit.id.split('-')[0])).find((z) => z.id === hit.id);
      if (o) {
        world.select(null);
        Sheets.openObstacleSheet(o, this.actions);
        Audio.play('pop');
      }
    } else if (hit.kind === 'monster') {
      const a = world.actorFor(hit.id);
      if (a) {
        a.view.animator.play('happy');
        world.particles.emit('heart', a.view.topPoint(new THREE.Vector3()), { count: 3 });
        Audio.play('squeak');
      }
      const m = M.byId(hit.id);
      if (m) {
        Sheets.closeSheet();
        openMonsterDetail(m, this.actions);
      }
    } else if (hit.kind === 'locked') RW.openIslandInfo(hit.id, this.actions);
    else this.actions.deselect();
  },

  // ------------------------------------------------------------------ events
  _bindEvents() {
    const bus = G.bus;
    bus.on('player:levelup', (e) => {
      this.levelQueue.push(e);
      HUD.refresh();
    });
    bus.on('building:placed', ({ b }) => {
      G.world.syncBuildings();
      G.world.refreshDecor();
      Audio.play('build');
    });
    bus.on('building:done', ({ b }) => {
      G.world.syncBuildings();
      G.world.constructionPoof(b);
      Audio.play('built');
      if (Sheets.sheetOpen() && Sheets.sheetOpen().key === `b:${b.id}`) Sheets.rerenderSheet();
    });
    bus.on('building:upgraded', ({ b }) => {
      G.world.syncBuildings();
      G.world.constructionPoof(b);
      Audio.play('built');
      UI.toast(`${BUILDINGS[b.type].name} upgraded to level ${b.level}!`, { icon: 'up', kind: 'good' });
      Sheets.rerenderSheet();
    });
    bus.on('building:upgradeStart', () => Sheets.rerenderSheet());
    bus.on('building:moved', () => {
      G.world.syncAll();
    });
    bus.on('building:removed', () => G.world.syncAll());
    bus.on('monster:placed', () => G.world.syncMonsters());
    bus.on('monster:removed', () => G.world.syncMonsters());
    bus.on('monster:levelup', ({ m, evolved, from, to }) => {
      if (!evolved) return;
      G.world.syncMonsters();
      const fromStage = from >= 20 ? 2 : from >= 10 ? 1 : 0;
      const toStage = stageForLevel(to);
      if (toStage > fromStage) this.evoQueue.push({ m, fromStage, toStage });
    });
    bus.on('obstacle:cleared', ({ o, gems }) => {
      G.world.removeObstacleAnimated(o.id);
      Audio.play('pop');
      if (gems) UI.toast(`Found ${gems} gems in the ruins!`, { icon: 'gems', kind: 'good' });
      Sheets.closeSheet();
    });
    bus.on('obstacle:clearing', () => Audio.play('build'));
    bus.on('island:unlocked', ({ id }) => this._islandCinematic(id));
    bus.on('farm:ready', () => {});
    bus.on('breed:ready', () => {
      if (G.mode === 'island') UI.toast('Breeding complete — collect your egg!', { icon: 'heart' });
      Audio.play('heart');
    });
    bus.on('egg:ready', () => {
      if (G.mode === 'island' && G.state.tutorial.done) UI.toast('An egg is ready to hatch!', { icon: 'egg' });
    });
    bus.on('quest:complete', ({ q }) => {
      Audio.play('quest');
      if (q.text && G.mode === 'island') UI.toast(`Quest complete: ${q.text}`, { icon: 'check', kind: 'good' });
      HUD.refresh();
    });
    bus.on('achievement:complete', ({ a }) => {
      if (G.mode === 'island') UI.toast(`Achievement: ${a.name}`, { icon: 'trophy', kind: 'good' });
    });
    bus.on('storage:full', ({ key }) => {
      UI.toast(key === 'gold' ? 'Gold storage is full — build or upgrade a Gold Vault!' : 'Food storage is full — build or upgrade a Food Silo!', { icon: key, kind: 'bad' });
      Audio.play('error');
    });
    bus.on('ui:open', ({ scr }) => {
      if (scr.key !== 'confirm' && scr.key !== 'picker' && scr.key !== 'crops') Sheets.closeSheet();
    });
  },

  async _islandCinematic(id) {
    const world = G.world;
    const def = ISLAND_BY_ID[id];
    this.busy++;
    UI.closeAll();
    Sheets.closeSheet();
    Audio.jingle('island');
    SDK.happytime();
    await world.camCtl.flyTo({ x: def.center[0], z: def.center[1] }, 55, 1.6);
    world.unlockIslandVisual(id);
    world.particles.emit('puff', new THREE.Vector3(def.center[0], 1, def.center[1]), { count: 60, spread: def.radius * 0.6, speed: 3, size: 2.5 });
    world.particles.emit('sparkle', new THREE.Vector3(def.center[0], 3, def.center[1]), { count: 60, spread: def.radius * 0.5 });
    await world.camCtl.flyTo({ x: def.center[0], z: def.center[1] }, 38, 1.4);
    const scr = { key: 'rewards', dim: 0.25, hideHud: true, el: h('div.scr') };
    scr.el.appendChild(h('div.celebrate', null, h('div.big-title.gold', null, 'NEW ISLAND!'), h('div.big-title', { style: { fontSize: '2.6rem' } }, def.name), h('button.btn.lg.green', { onclick: () => UI.close(scr) }, 'Explore')));
    UI.open(scr);
    this.busy--;
  },

  applyAudioSettings() {
    const S = G.state.settings;
    Audio.setVolumes(S.music, S.sfx, S.muted);
  },

  // ------------------------------------------------------------------ helpers
  flyFromEl(kind, el, n = 5) {
    const r = el ? el.getBoundingClientRect() : { left: innerWidth / 2, top: innerHeight / 2, width: 0, height: 0 };
    const pill = HUD.pill(kind);
    if (!pill) return;
    HUD.hold(kind, 800);
    UI.fly(kind, { x: r.left + r.width / 2, y: r.top + r.height / 2 }, pill, { count: n, onArrive: () => HUD.bump(kind) });
  },
  flyFromWorld(kind, pos, n = 5) {
    const p = G.engine.project(pos, G.world.camera);
    const pill = HUD.pill(kind);
    if (!pill) return;
    HUD.hold(kind, 800);
    UI.fly(kind, p, pill, { count: n, onArrive: () => HUD.bump(kind) });
  },
};

function nextFrame() {
  return new Promise((r) => requestAnimationFrame(() => r()));
}

// ============================================================================
// ACTIONS (called by HUD, markers, sheets and screens)
// ============================================================================
const A = (Game.actions = {
  sfx: (n) => Audio.play(n),
  adsReady: () => SDK.adsReady(),
  portrait: (sp, stage = 1, sil = false) => Game.thumbs.monster(sp, stage, { silhouette: sil }),
  buildingThumb: (type) => Game.thumbs.building(type, 1),
  eggThumb: (sp) => Game.thumbs.egg(sp),
  monsterCard: (m, onClick) => monsterCard(m, onClick, A),

  // ---------------- navigation
  profile: () => RW.openProfile(A),
  settings: () => RW.openSettings(A),
  events: () => {
    if (!isUnlocked('events')) return UI.toast('Events unlock at level 6', { icon: 'lock' });
    RW.openEvents(A);
  },
  daily: () => RW.openDaily(A),
  wheel: () => RW.openWheel(A),
  chests: () => RW.openChests(A),
  dex: () => openDex(A),
  quests: (tab) => openQuests(A, tab),
  monsters: (tab) => openMonsters(A, { tab }),
  shop: (tab) => openShop(A, tab),
  island: () => {
    UI.closeAll();
    Sheets.closeSheet();
    if (G.mode !== 'island') return Campaign.exitToIsland();
    const cam = G.world.camCtl;
    cam.flyTo({ x: 0.5, z: 0.5 }, 42, 0.9);
  },
  battle: () => {
    UI.closeAll();
    Sheets.closeSheet();
    Campaign.openMap();
  },
  breed: () => {
    if (!isUnlocked('breeding')) return UI.toast('The Breeding Mountain unlocks at level 3', { icon: 'lock' });
    if (!B.readyBuilding('breeding')) {
      UI.toast('Build the Breeding Mountain first!', { icon: 'breed' });
      return openShop(A, 'buildings');
    }
    openBreed(A);
  },
  resource: (key, plus) => {
    if (key === 'energy') return UI.toast(`Energy refills over time (max ${maxEnergy()}) and on level up.`, { icon: 'energy' });
    if (plus || key === 'gems') return openShop(A, 'resources');
    if (key === 'gold') return UI.toast('Monsters in habitats earn gold. Tap the coin bubbles!', { icon: 'gold' });
    if (key === 'food') return UI.toast('Grow crops on your farms to get food.', { icon: 'food' });
  },
  goTo: (goal) => {
    if (goal.type === 'build' || goal.type === 'build_category') {
      const def = BUILDINGS[goal.id];
      return openShop(A, def && def.category === 'habitat' ? 'habitats' : def && def.category === 'decoration' ? 'decorations' : 'buildings');
    }
    if (goal.type === 'campaign' || goal.type === 'win') return A.battle();
    if (goal.type.startsWith('breed')) return A.breed();
    if (goal.type === 'hatch') return A.openHatchery();
    if (goal.type === 'feed' || goal.type === 'monster_level') return A.monsters();
    if (goal.type === 'harvest' || goal.type === 'farm_plant') {
      const f = B.farms()[0];
      return f ? A.select(f.id) : openShop(A, 'buildings');
    }
    if (goal.type === 'island') {
      const n = B.nextLockedIsland();
      if (n) return RW.openIslandInfo(n.id, A);
    }
    if (goal.type === 'own' || goal.type === 'discover') return openShop(A, 'monsters');
  },

  // ---------------- selection
  select: (id) => {
    const b = B.byBuildingId(id);
    if (!b) return;
    G.world.select(id);
    Sheets.openBuildingSheet(b, A);
    Audio.play('pop');
    // habitats with gold collect on tap for convenience
    if (B.isHabitat(b) && b.state !== 'building' && B.habitatGold(b) >= 1 && G.state.tutorial.done) A.collectHabitat(b.id, null, true);
  },
  deselect: () => {
    G.world.select(null);
    Sheets.closeSheet();
  },

  // ---------------- collecting
  collectHabitat: (id, el, quiet = false) => {
    const b = B.byBuildingId(id);
    if (!b) return;
    const amount = B.collectHabitat(b);
    if (amount > 0) {
      const pos = buildingWorldPos(b, new THREE.Vector3()).setY(1.8);
      G.world.coinBurst(b, Math.min(12, 3 + Math.floor(amount / 40)));
      Game.flyFromWorld('gold', pos, Math.min(8, 2 + Math.floor(amount / 50)));
      const p = G.engine.project(pos, G.world.camera);
      UI.floatText(`+${fmt(amount)}`, p.x, p.y - 30, { iconName: 'gold' });
      Audio.play('coin');
      G.world.bounce(b.id, 0.6);
    }
    HUD.refresh();
  },
  harvest: (id, el) => {
    const b = B.byBuildingId(id);
    if (!b) return;
    const amount = B.harvest(b);
    if (amount > 0) {
      const pos = buildingWorldPos(b, new THREE.Vector3()).setY(1);
      G.world.particles.emit('leaf', pos, { count: 12, spread: 0.6 });
      Game.flyFromWorld('food', pos, 6);
      const p = G.engine.project(pos, G.world.camera);
      UI.floatText(`+${fmt(amount)}`, p.x, p.y - 30, { iconName: 'food' });
      Audio.play('food');
      G.world.bounce(b.id, 0.6);
      Sheets.rerenderSheet();
    }
  },
  collectBreeding: () => {
    const res = BR.collectBreedingEgg();
    if (!res) return;
    if (res.error) {
      UI.toast(res.error, { icon: 'egg', kind: 'bad' });
      return A.openHatchery();
    }
    Audio.play('pop');
    UI.toast('The egg is warming in the Hatchery!', { icon: 'egg', kind: 'good' });
    const hb = B.findBuilding('hatchery');
    if (hb) G.world.bounce(hb.id, 1);
    const scr = UI.find('breed');
    if (scr) scr.refresh();
    Sheets.rerenderSheet();
    HUD.refresh();
  },
  openHatchery: () => openHatchery(A),

  // ---------------- building
  buyBuilding: (type, shopScr) => {
    const block = B.buildBlocker(type);
    if (block) {
      if (block.reason === 'cost') return A.notEnough(B.buildCost(type));
      return;
    }
    if (shopScr) UI.close(shopScr);
    Sheets.closeSheet();
    G.world.select(null);
    const cam = G.world.camCtl.target;
    // start near the camera focus on the closest island
    let best = 0, bd = Infinity;
    for (const id of G.state.islands) {
      const d = ISLAND_BY_ID[id];
      const dd = Math.hypot(d.center[0] - cam.x, d.center[1] - cam.z);
      if (dd < bd) {
        bd = dd;
        best = id;
      }
    }
    const def = ISLAND_BY_ID[best];
    let spot = B.findSpot(type, best, cam.x - def.center[0], cam.z - def.center[1]);
    let island = best;
    if (!spot) {
      for (const id of G.state.islands) {
        spot = B.findSpot(type, id, 0, 0);
        if (spot) {
          island = id;
          break;
        }
      }
    }
    if (!spot) {
      UI.toast('No free space! Clear obstacles or unlock a new island.', { icon: 'island', kind: 'bad' });
      return;
    }
    Tutorial.suggestSpot && Tutorial.suggestSpot(type, (s) => {
      if (s && B.canPlace(type, 0, s.x, s.z)) {
        spot = s;
        island = 0;
      }
    });
    G.world.startPlacing(type, { island, x: spot.x, z: spot.z });
    const d = ISLAND_BY_ID[island];
    const [w, dd] = BUILDINGS[type].size;
    G.world.camCtl.flyTo({ x: d.center[0] + spot.x + w / 2, z: d.center[1] + spot.z + dd / 2 + 2 }, Math.min(G.world.camCtl.goalDistance, 36), 0.6);
    Sheets.openPlacementSheet(A, {
      title: BUILDINGS[type].name,
      onConfirm: () => {
        const p = G.world.placing;
        if (!p || !p.valid) {
          Audio.play('error');
          return;
        }
        const b = B.placeBuilding(type, p.island, p.x, p.z);
        G.world.cancelPlacing();
        Sheets.closeSheet();
        if (!b) {
          A.notEnough(B.buildCost(type));
          return;
        }
        Audio.play('place');
        G.world.particles.emit('dust', buildingWorldPos(b, new THREE.Vector3()).setY(0.2), { count: 18, spread: 1 });
        HUD.refresh();
      },
      onCancel: () => {
        G.world.cancelPlacing();
        Sheets.closeSheet();
        Audio.play('back');
      },
    });
  },
  moveBuilding: (b) => {
    Sheets.closeSheet();
    G.world.select(null);
    G.world.startPlacing(b.type, { buildingId: b.id, island: b.island, x: b.x, z: b.z });
    Sheets.openPlacementSheet(A, {
      title: 'Move',
      onConfirm: () => {
        const p = G.world.placing;
        if (!p || !p.valid) {
          Audio.play('error');
          return;
        }
        const ok = B.moveBuilding(b, p.island, p.x, p.z);
        G.world.cancelPlacing();
        Sheets.closeSheet();
        if (ok) {
          Audio.play('place');
          G.world.syncAll();
          G.world.bounce(b.id, 1);
        }
      },
      onCancel: () => {
        G.world.cancelPlacing();
        Sheets.closeSheet();
      },
    });
  },
  upgradeBuilding: (b) => {
    const block = B.upgradeBlocker(b);
    if (block && block.reason === 'cost') return A.notEnough(B.nextLevelDef(b).cost);
    if (block) return;
    if (B.startUpgrade(b)) {
      Audio.play('build');
      G.world.bounce(b.id, 1);
      Sheets.rerenderSheet();
    }
  },
  finishBuilding: (b) => {
    const gems = B.finishNowCost(b);
    if (gems && G.state.res.gems < gems) return A.notEnough({ gems });
    B.finishNow(b);
    Sheets.rerenderSheet();
  },
  adSpeedBuilding: (b) =>
    A.rewardedAd('speed_build', () => {
      b.until = Math.max(G.now(), b.until - 30 * 60 * 1000);
      if (b.until - G.now() < 60000) b.until = G.now();
      Sheets.rerenderSheet();
    }),
  sellBuilding: (b) =>
    UI.confirm({
      title: 'Sell decoration?',
      text: `You will get back ${fmt(Math.round((BUILDINGS[b.type].cost.gold || 0) * 0.25))} gold.`,
      yes: 'Sell',
      yesClass: 'red',
      onYes: () => {
        B.sellBuilding(b);
        Sheets.closeSheet();
        G.world.select(null);
      },
    }),
  clearObstacle: (o) => {
    if (!canAfford({ gold: o.cost })) return A.notEnough({ gold: o.cost });
    if (B.startClearing(o)) {
      const m = G.world.oViews.get(o.id);
      if (m) G.world.particles.emit('dust', m.position.clone().setY(0.3), { count: 10, spread: 0.5 });
      Sheets.rerenderSheet();
    }
  },
  finishClearing: (o) => {
    const until = G.state.obstacles.clearing[o.id];
    if (!until) return;
    const gems = Math.max(0, Math.ceil(((until - G.now()) / 1000) > 20 ? Math.pow((until - G.now()) / 60000, 0.72) * 1.4 : 0));
    if (gems && !spend({ gems })) return A.notEnough({ gems });
    G.state.obstacles.clearing[o.id] = G.now();
    B.tickBuildings();
  },

  // ---------------- farming
  cropPicker: (farm) => Sheets.openCropPicker(farm, A),
  plant: (farm, cropId) => {
    const quick = !G.state.flags.firstPlant;
    if (farm) {
      if (!B.plant(farm, cropId, { quick })) return A.notEnough({ gold: 0 });
      G.state.flags.firstPlant = true;
      G.world.particles.emit('leaf', buildingWorldPos(farm, new THREE.Vector3()).setY(0.4), { count: 8, spread: 0.6 });
      Audio.play('pop');
      Sheets.rerenderSheet();
    } else {
      const n = B.plantAll(cropId);
      if (!n) UI.toast('Nothing to plant (or not enough gold).', { icon: 'farm' });
      else Audio.play('pop');
      Sheets.rerenderSheet();
    }
  },
  finishCrop: (b) => {
    const left = Math.ceil((b.cropUntil - G.now()) / 1000);
    const gems = left > 20 ? Math.max(1, Math.ceil(Math.pow(left / 60, 0.72) * 1.4)) : 0;
    if (gems && !spend({ gems })) return A.notEnough({ gems });
    b.cropUntil = G.now();
    Sheets.rerenderSheet();
  },

  // ---------------- monsters
  pickForHabitat: (b) => {
    const el = BUILDINGS[b.type].element;
    Sheets.openMonsterPicker(A, {
      title: `Move into ${BUILDINGS[b.type].name}`,
      note: h('span', null, 'Monsters with the ', icon(`el_${el}`), ` element can live here.`),
      filter: (m) => M.species(m.sp).elements.includes(el) && m.hab !== b.id,
      onPick: (m) => A.placeMonster(m, b),
    });
  },
  placeMonster: (m, b) => {
    if (!B.habitatHasRoom(b)) return UI.toast('That habitat is full. Upgrade it for more room!', { icon: 'habitat', kind: 'bad' });
    if (B.placeMonsterIn(m, b)) {
      Audio.play('place');
      setTimeout(() => {
        const a = G.world.actorFor(m.id);
        if (a) {
          a.view.animator.play('jump');
          G.world.particles.emit('sparkle', a.view.group.position.clone().setY(0.8), { count: 14, spread: 0.4 });
        }
      }, 60);
      Sheets.rerenderSheet();
    }
  },
  monsterDetail: (m) => openMonsterDetail(m, A),
  moveMonster: (m) => {
    const def = M.species(m.sp);
    const options = B.compatibleHabitats(m.sp).filter((b) => b.id !== m.hab);
    if (!options.length) {
      UI.toast(`Build a ${ELEMENTS[def.elements[0]].name} Habitat for ${def.name}!`, { icon: `el_${def.elements[0]}` });
      return;
    }
    const withRoom = options.filter((b) => B.habitatHasRoom(b));
    if (!withRoom.length) return UI.toast('All matching habitats are full. Upgrade one!', { icon: 'habitat', kind: 'bad' });
    const target = withRoom.sort((a, b) => b.level - a.level)[0];
    A.placeMonster(m, target);
    UI.toast(`${M.monsterName(m)} moved to the ${BUILDINGS[target.type].name}`, { icon: 'habitat', kind: 'good' });
    const d = UI.find('mdetail');
    if (d && d.refresh) d.refresh();
  },
  feed: (m, mode) => {
    const res = M.feed(m, mode);
    if (res.nofood && !res.spent) {
      A.notEnough({ food: M.foodToNext(m) });
      return res;
    }
    if (res.spent) {
      Audio.play('eat');
      Game.flyFromEl('food', null, 0);
      if (res.levels) Audio.play(res.evolved ? 'unlock' : 'reward');
      const a = G.world.actorFor(m.id);
      if (a) a.view.animator.play('eat');
    }
    return res;
  },
  rankUp: (m) => {
    const need = M.rankCost(m);
    if (M.shardsFor(m.sp) < need) {
      UI.toast('Not enough shards yet.', { icon: 'shards', kind: 'bad' });
      return false;
    }
    if (!canAfford({ gold: M.rankGoldCost(m) })) {
      A.notEnough({ gold: M.rankGoldCost(m) });
      return false;
    }
    const ok = M.rankUp(m);
    if (ok) {
      Audio.play('unlock');
      UI.toast(`${M.monsterName(m)} reached rank ${m.rank}!`, { icon: 'crown', kind: 'good' });
    }
    return ok;
  },
  releaseMonster: (m, scr) => {
    if (G.state.monsters.length <= 3) {
      Audio.play('error');
      UI.toast('Keep at least 3 monsters — they are your family!', { icon: 'heart', kind: 'bad' });
      return;
    }
    return UI.confirm({
      title: 'Release monster?',
      text: `${M.monsterName(m)} will return to the wild and leave you <b>${M.releaseValue(m)} ${M.species(m.sp).name} shards</b> for ranking up.`,
      yes: 'Release',
      yesClass: 'red',
      onYes: () => {
        const n = M.release(m);
        UI.close(scr);
        UI.toast(`+${n} shards`, { icon: 'shards', kind: 'good' });
        const list = UI.find('monsters');
        if (list && list.refresh) list.refresh();
      },
    });
  },
  equipRune: (m, r) => {
    const slots = RUNE_SLOTS_BY_LEVEL.filter((l) => m.lvl >= l).length;
    if (m.runes.length >= slots) {
      UI.toast(slots < 3 ? `Next rune slot at level ${RUNE_SLOTS_BY_LEVEL[slots]}` : 'All rune slots are full', { icon: 'rune' });
      return false;
    }
    m.runes.push(r.id);
    r.on = m.id;
    stat('rune_equip');
    G.markDirty();
    Audio.play('buff');
    return true;
  },
  unequipRune: (m, r) => {
    m.runes = m.runes.filter((x) => x !== r.id);
    r.on = null;
    G.markDirty();
  },
  equipRelic: (m, id) => {
    if (id) {
      const other = G.state.monsters.find((x) => x.relic === id);
      if (other) other.relic = null;
    }
    m.relic = id;
    G.markDirty();
    Audio.play('buff');
  },
  summonShards: (sp) => {
    const m = M.summonFromShards(sp);
    if (m) {
      UI.closeAll();
      Game.revealMonster(m);
    }
  },

  // ---------------- breeding & hatching
  startBreeding: (a, b, token) => {
    const res = BR.startBreeding(a, b, { token });
    if (res.error) {
      UI.toast(res.error, { icon: 'info', kind: 'bad' });
      return res;
    }
    Audio.play('heart');
    HUD.refresh();
    return res;
  },
  skipBreeding: () => {
    const gems = BR.breedingSkipCost();
    if (gems && G.state.res.gems < gems) return A.notEnough({ gems });
    BR.skipBreeding();
  },
  adSpeedBreeding: (cb) =>
    A.rewardedAd('speed_breed', () => {
      const br = G.state.breeding;
      if (br) br.until = Math.max(G.now(), br.until - Math.max(60000, (br.until - G.now()) * 0.5));
      cb && cb();
    }),
  skipEgg: (egg) => {
    const gems = HT.eggSkipCost(egg);
    if (gems && G.state.res.gems < gems) return A.notEnough({ gems });
    HT.skipEgg(egg);
  },
  adSpeedEgg: (egg, cb) =>
    A.rewardedAd('speed_egg', () => {
      if (egg.until) egg.until = Math.max(G.now(), egg.until - Math.max(60000, (egg.until - G.now()) * 0.5));
      cb && cb();
    }),
  hatch: (egg) => {
    const m = HT.hatchEgg(egg);
    if (!m) return;
    UI.closeAll();
    Game.revealMonster(m);
  },

  // ---------------- shop
  buyEgg: ({ species, rarity, cost }) => {
    const c = species ? { gold: eggPrice(species) } : cost;
    if (!canAfford(c)) return A.notEnough(c);
    spend(c, 'shop');
    const sp = species || HT.randomSpecies({ rarity });
    HT.addEgg(sp, { source: 'shop' });
    Audio.play('reward');
    UI.toast('Egg sent to the Hatchery!', { icon: 'egg', kind: 'good' });
    HUD.refresh();
  },
  buyPack: (p, cb) => {
    if (!canAfford(p.cost)) return A.notEnough(p.cost);
    spend(p.cost, 'shop');
    const items = RWD.grant(p.give, 'shop');
    A.rewardFly(items, null);
    cb && cb();
  },
  adGemsLeft: () => {
    const today = new Date().toDateString();
    if (G.state.ads.day !== today) {
      G.state.ads.day = today;
      G.state.ads.rewarded = 0;
    }
    return Math.max(0, 3 - G.state.ads.rewarded);
  },
  adForGems: (cb) =>
    A.rewardedAd('gems', () => {
      G.state.ads.rewarded++;
      const items = RWD.grant({ gems: 5 }, 'ad');
      A.rewardFly(items, null);
      cb && cb();
    }),

  // ---------------- rewards
  claimDaily: () => {
    const r = RWD.claimLogin();
    if (r) {
      RW.showRewards(r.items, A, { title: `Day ${r.day}!` });
      HUD.refresh();
    }
  },
  spinWheel: (viaAd) => RWD.spinWheel(viaAd),
  openChest: (id) => {
    const items = RWD.openChest(id);
    if (items) {
      Audio.play('burst');
      RW.showRewards(items, A, { title: RWD && `${id[0].toUpperCase()}${id.slice(1)} Chest!` });
    }
    HUD.refresh();
  },
  grantAndShow: (reward, title) => {
    const items = RWD.grant(reward, 'reward');
    RW.showRewards(items, A, { title });
    HUD.refresh();
  },
  rewardFly: (items, fromEl) => {
    for (const it of items) {
      if (['gold', 'food', 'gems'].includes(it.kind)) Game.flyFromEl(it.kind, fromEl, Math.min(8, 3 + Math.floor(it.n / 200)));
      else if (it.kind === 'egg') UI.toast('New egg in the Hatchery!', { icon: 'egg', kind: 'good' });
      else if (it.kind === 'chest') UI.toast('You got a chest!', { icon: 'chest', kind: 'good' });
      else if (it.kind === 'xp') {
        /* ring updates */
      }
    }
    Audio.play('collect');
    HUD.refresh();
  },
  notEnough: (cost) => {
    const miss = missing(cost);
    const k = Object.keys(miss)[0];
    Audio.play('error');
    if (!k) return;
    if (k === 'gems') {
      UI.toast('Not enough gems', { icon: 'gems', kind: 'bad' });
      return;
    }
    const gems = gemsForResources(miss);
    UI.confirm({
      title: `Need more ${k}`,
      text: `You need <b>${fmt(miss[k])}</b> more ${k}.`,
      yes: h('span', null, 'Buy for ', icon('gems'), `${gems}`),
      yesClass: 'teal',
      no: 'Later',
      extra: h('div.small.muted', { style: { textAlign: 'center' } }, k === 'gold' ? 'Tip: collect gold from habitats and win battles.' : 'Tip: plant crops on your farms.'),
      onYes: () => {
        if (!spend({ gems })) return UI.toast('Not enough gems', { icon: 'gems', kind: 'bad' });
        for (const [kk, v] of Object.entries(miss)) add(kk, v, { source: 'gems' });
        Audio.play('coin');
      },
    });
  },
  rewardedAd: (placement, onReward) => {
    if (!SDK.adsReady()) return UI.toast('No video available right now.', { icon: 'film' });
    SDK.rewarded().then((ok) => {
      if (ok) {
        onReward();
        Audio.play('reward');
      } else UI.toast('The video did not finish — no reward this time.', { icon: 'film' });
    });
  },

  // ---------------- events, islands, misc buildings
  claimEventMilestone: (i) => {
    const items = EV.claimMilestone(i);
    if (items) RW.showRewards(items, A, { title: 'Event Reward!' });
  },
  eventBattle: (ev, tier) => Campaign.eventBattle(ev, tier),
  lockedIsland: (id) => RW.openIslandInfo(id, A),
  unlockIsland: (id) => {
    if (!B.unlockIsland(id)) UI.toast('Cannot unlock yet.', { icon: 'lock', kind: 'bad' });
  },
  academyPick: () =>
    Sheets.openMonsterPicker(A, {
      title: 'Train at the Academy',
      note: 'Training grants a free level. Higher levels take longer.',
      filter: (m) => m.lvl < M.maxLevel(m),
      onPick: (m) => {
        if (B.startTraining(m)) {
          Audio.play('buff');
          Sheets.rerenderSheet();
        }
      },
    }),
  tower: () => Campaign.openTower(),
  runes: () => import('../ui/screens/extras.js').then((x) => x.openRuneForge(A)),
  relics: () => import('../ui/screens/extras.js').then((x) => x.openRelics(A)),
  shrine: () => import('../ui/screens/extras.js').then((x) => x.openShrine(A)),
  applyAudioSettings: () => Game.applyAudioSettings(),
  resetProgress: () =>
    UI.confirm({
      title: 'Reset everything?',
      text: 'All monsters, islands and progress will be lost forever.',
      yes: 'Reset',
      yesClass: 'red',
      onYes: () => {
        wipeSave();
        G.state = null;
        location.reload();
      },
    }),
});

// ============================================================================
// HATCH REVEAL
// ============================================================================
Game.revealMonster = async function (m) {
  const def = M.species(m.sp);
  const R = RARITIES[def.rarity];
  const first = true;
  this.busy++;
  const sc = this.showcase;
  const ui = h('div.reveal-ui');
  const top = h('div.top');
  const bottom = h('div.bottom');
  ui.append(top, bottom);
  const scr = { key: 'reveal', dim: 0, hideHud: true, solo: true, el: h('div.scr'), escClose: false };
  scr.el.appendChild(ui);
  scr.el.addEventListener('pointerdown', () => sc.skip());
  const prevMode = G.mode;
  await cloudTransition(() => {
    G.mode = 'reveal';
    G.world.camCtl.enabled = false;
    G.engine.setWorld(sc);
    UI.open(scr);
    bottom.appendChild(h('div.tap-hint.ol', null, 'Tap to hatch!'));
  }, { sound: () => Audio.play('whoosh') });
  Audio.jingle('hatch');
  sc.playHatch(def, stageForLevel(m.lvl), {
    sfx: (n) => Audio.play(n),
    onBurst: () => {
      Audio.play('burst');
      if (R.idx >= 3) SDK.happytime();
    },
    onReveal: () => {
      Audio.play('roar', { pitch: 140 - R.idx * 10 });
      top.innerHTML = '';
      bottom.innerHTML = '';
      const isNew = G.state.stats[`seen_${m.sp}`] !== 1;
      G.state.stats[`seen_${m.sp}`] = 1;
      if (isNew) top.appendChild(h('div.big-title.gold', { style: { fontSize: '2.6rem' } }, 'NEW MONSTER!'));
      top.append(h('div.nm.display.ol', null, def.name), h('div.rar.rar-chip', { style: { background: R.color } }, R.name), h('div.els', null, def.elements.map((e) => icon(`el_${e}`))));
      const hab = B.compatibleHabitats(m.sp).filter((b) => B.habitatHasRoom(b)).sort((a, b) => b.level - a.level)[0];
      const place = h('button.btn.lg.green', { 'data-tut': 'reveal-place', onclick: () => finish(hab) }, icon('habitat'), hab ? 'PLACE' : 'CONTINUE');
      bottom.append(place, h('div.small.ol-s', null, hab ? `Moves into your ${BUILDINGS[hab.type].name}` : `Build a ${ELEMENTS[def.elements[0]].name} Habitat to give it a home`));
      scr.el.onpointerdown = null;
    },
  });
  const self = this;
  let done = false;
  async function finish(hab) {
    if (done) return;
    done = true;
    await cloudTransition(() => {
      UI.close(scr);
      G.mode = 'island';
      G.world.camCtl.enabled = true;
      G.engine.setWorld(G.world);
      sc.clear();
      UI._sync();
    });
    self.busy--;
    if (hab) {
      A.placeMonster(m, hab);
      const pos = buildingWorldPos(hab, new THREE.Vector3());
      G.world.camCtl.flyTo({ x: pos.x, z: pos.z + 3 }, 26, 0.9);
    } else {
      UI.toast(`${def.name} is waiting for a ${ELEMENTS[def.elements[0]].name} Habitat!`, { icon: `el_${def.elements[0]}` });
    }
    G.bus.emit('reveal:done', { m, hab });
    HUD.refresh();
  }
};
