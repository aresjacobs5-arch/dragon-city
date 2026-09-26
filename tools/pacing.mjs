// Pacing bot: plays a fresh save with the real game systems, acting like an
// attentive player (checks in every few seconds), and prints a timeline of
// level-ups, story goals, campaign progress and idle stretches.
// Usage: node tools/pacing.mjs [minutes=90] [seed]
import { G, createNewState } from '../src/game/G.js';
import * as B from '../src/systems/buildings.js';
import * as M from '../src/systems/monsters.js';
import * as BR from '../src/systems/breeding.js';
import * as HT from '../src/systems/hatchery.js';
import * as CP from '../src/systems/campaign.js';
import * as Q from '../src/systems/quests.js';
import * as RW from '../src/systems/rewards.js';
import * as R from '../src/systems/resources.js';
import { Battle } from '../src/systems/battle.js';
import { initEvents } from '../src/systems/events.js';
import { BUILDINGS, farmLimit } from '../src/data/buildings.js';
import { CROPS } from '../src/data/crops.js';
import { STAGES_PER_WORLD } from '../src/data/campaign.js';

const MINUTES = +(process.argv[2] || 90);
// deterministic runs: seed Math.random (used by the game's rng helpers)
let _seed = +(process.argv[3] || 1) * 2654435761 % 4294967296 || 1;
Math.random = () => ((_seed = (_seed * 1664525 + 1013904223) % 4294967296) / 4294967296);
const STEP = 5; // seconds between player actions
const T0 = 1_700_000_000_000;
G.state = createNewState(T0);
G.timeOffset = T0 - Date.now();
B.initBuildingsSystem();
initEvents();
Q.ensureDaily();

const t = () => (G.now() - T0) / 1000;
const clock = (s = t()) => `${String(Math.floor(s / 60)).padStart(3)}:${String(Math.floor(s % 60)).padStart(2, '0')}`;
const log = (...a) => console.log(clock(), ...a);
G.bus.on('player:levelup', ({ level }) => log(`** PLAYER LEVEL ${level}`));
const income = {};
G.bus.on('res:changed', ({ key, delta, source }) => {
  if (key !== 'gold' || !delta) return;
  const k = delta > 0 ? `+${source || '?'}` : `-${source || '?'}`;
  income[k] = (income[k] || 0) + delta;
});

// same opening as a new game: hatchery pre-built with the starter egg
{
  const s = B.findSpot('hatchery', 0, -2.5, -2.5);
  B.placeBuilding('hatchery', 0, s.x, s.z, { free: true, instant: true });
  HT.addEgg('embercub', { source: 'starter' });
}

const idle = { since: null, total: 0, spans: [] };
let lastLossAt = {};
let wins = 0, losses = 0;

let noSpace = 0;
function clearSomething() {
  if (Object.keys(G.state.obstacles.clearing).length) return false;
  for (const isl of G.state.islands) {
    const o = B.activeObstacles(isl).sort((a, b) => a.cost - b.cost)[0];
    if (o && R.canAfford({ gold: o.cost }) && B.startClearing(o)) return true;
  }
  return false;
}
function tryBuild(type, why) {
  if (B.buildBlocker(type)) return false;
  for (const isl of [...G.state.islands].reverse()) {
    const s = B.findSpot(type, isl, 0, 0);
    if (s) {
      const b = B.placeBuilding(type, isl, s.x, s.z);
      if (b) {
        log(`build ${type}${why ? ' (' + why + ')' : ''}`);
        return b;
      }
    }
  }
  noSpace++;
  if (noSpace % 20 === 1) log(`no space for ${type}: clearing obstacles`);
  clearSomething();
  return false;
}

function team() {
  return [...G.state.monsters].sort((a, b) => M.power(b) - M.power(a)).slice(0, 3);
}

function fight(stage) {
  const tm = team();
  if (!tm.length) return null;
  const b = new Battle({ allies: tm.map((m) => ({ ...m })), enemies: stage.enemies.map((e, i) => ({ mon: { sp: e.species, lvl: e.level, rank: 0 }, slot: i, elite: e.elite })), rule: stage.rule });
  let turns = 0;
  while (!b.result && turns < 500) {
    const u = b.nextActor();
    const r = b.beginTurn(u);
    if (b.result) break;
    if (!r.skip && u.alive) {
      const c = b.choose(u);
      b.act(u, c.ability, c.target);
    }
    turns++;
  }
  // presentation time at 2x speed: intro/outro + ~1.1s per turn
  G.timeOffset += (12 + turns * 1.1) * 1000;
  return { win: b.result === 'win', stars: b.starsEarned(), turns };
}

function act() {
  const now = G.now();
  B.tickBuildings(now);
  BR.tickBreeding(now);
  HT.tickHatchery(now);
  R.refreshEnergy(now);
  Q.checkCompletions();
  let did = false;

  // rewards first
  while (Q.currentMain() && Q.currentMain().done) {
    const q = Q.currentMain();
    Q.claimMain();
    log(`goal done: ${q.text}`);
    did = true;
  }
  for (const d of Q.dailyList()) if (d.done && !d.claimed) did = Q.claimDaily(d.id) || did;
  if (Q.dailyChestReady && Q.dailyChestReady()) did = !!Q.claimDailyChest() || did;
  for (const a of Q.achievementList()) if (a.done && !a.claimed) did = !!Q.claimAchievement(a.id) || did;
  if (!RW.loginStatus().claimedToday) {
    RW.claimLogin();
    did = true;
  }
  if (RW.wheelStatus().free) {
    RW.spinWheel(false);
    did = true;
  }
  for (const [id, n] of Object.entries(G.state.inventory.chests)) {
    for (let i = 0; i < n; i++) RW.openChest(id);
    if (n) did = true;
  }

  // free skips for short timers
  for (const b of G.state.buildings) if ((b.state === 'building' || b.state === 'upgrading') && B.finishNowCost(b) === 0 && B.remainingSec(b) > 0) did = B.finishNow(b) || did;
  for (const e of G.state.hatchery) if (e.until && !HT.eggReady(e) && HT.eggSkipCost(e) === 0) did = HT.skipEgg(e) || did;
  const bs = BR.breedingState();
  if (bs && !bs.done && BR.breedingSkipCost() === 0) did = BR.skipBreeding() || did;

  // hatch and house
  for (const e of [...G.state.hatchery]) {
    if (!HT.eggReady(e)) continue;
    const m = HT.hatchEgg(e);
    if (!m) continue;
    if (M.ownedCount(m.sp) === 1) log(`new species: ${m.sp} (${M.species(m.sp).rarity})`);
    did = true;
  }
  for (const m of G.state.monsters) {
    if (m.hab) continue;
    let hab = B.compatibleHabitats(m.sp).find((b) => B.habitatHasRoom(b));
    if (!hab) {
      const el = M.species(m.sp).elements.find((e) => BUILDINGS[`hab_${e}`] && !B.buildBlocker(`hab_${e}`));
      if (el) tryBuild(`hab_${el}`, `home for ${m.sp}`);
    }
    if (hab && B.placeMonsterIn(m, hab)) did = true;
  }

  // gold + food
  for (const b of G.state.buildings) {
    if (B.isHabitat(b) && B.habitatGold(b) >= Math.max(10, B.habitatCap(b) * 0.15)) {
      B.collectHabitat(b);
      did = true;
    }
  }
  for (const f of B.farms()) {
    if (f.crop && B.cropReady(f)) {
      B.harvest(f);
      did = true;
    }
    if (!f.crop && f.state === 'ready') {
      const lvl = G.state.player.level;
      const opts = CROPS.filter((c) => c.unlock <= lvl && c.time <= 600 && R.canAfford({ gold: c.cost }));
      const best = opts.sort((a, b) => b.food / b.time - a.food / a.time)[0];
      if (best && B.plant(f, best.id)) did = true;
    }
  }

  // story goal
  const q = Q.currentMain();
  if (q) {
    const g = q.goal;
    if (g.type === 'build' && !B.countOf(g.id)) did = !!tryBuild(g.id, 'goal') || did;
    if (g.type === 'clear') {
      const o = B.activeObstacles(0).filter((x) => !G.state.obstacles.clearing[x.id]).sort((a, b) => a.cost - b.cost)[0];
      if (o && R.canAfford({ gold: o.cost }) && Object.keys(G.state.obstacles.clearing).length === 0) did = B.startClearing(o) || did;
    }
    if (g.type === 'upgrade') {
      const h = G.state.buildings.filter((b) => B.isHabitat(b) && !B.upgradeBlocker(b))[0];
      if (h) did = B.startUpgrade(h) || did;
    }
  }
  // economy buildings a player would grab when affordable
  if (B.countOf('farm') < farmLimit(G.state.player.level) && G.state.res.gold > 400) did = !!tryBuild('farm', 'more food') || did;

  // breeding
  if (B.readyBuilding('breeding') && !G.state.breeding && HT.hatcheryHasRoom()) {
    // one representative per species, best level first
    const reps = new Map();
    for (const m of [...G.state.monsters].sort((a, b) => b.lvl - a.lvl)) if (!reps.has(m.sp)) reps.set(m.sp, m);
    const mons = [...reps.values()];
    let pair = null, best = -1;
    for (let i = 0; i < mons.length; i++) {
      for (let j = i + 1; j < mons.length; j++) {
        if (BR.breedBlocker(mons[i], mons[j])) continue;
        const outs = BR.breedOutcomes(mons[i], mons[j]);
        const score = outs.reduce((a, o) => a + o.p * (G.state.dex[o.sp] ? 0.05 * (1 + ['common', 'uncommon', 'rare', 'epic', 'legendary'].indexOf(M.species(o.sp).rarity)) : 1), 0);
        if (score > best) {
          best = score;
          pair = [mons[i], mons[j]];
        }
      }
    }
    if (pair) {
      const r = BR.startBreeding(pair[0], pair[1]);
      if (!r.error) did = true;
    }
  }
  if (bs && bs.done) {
    const r = BR.collectBreedingEgg();
    if (r && r.egg) did = true;
  }

  // release spare duplicates (keep 2 of each species) and rank up the team
  const bySp = {};
  for (const m of G.state.monsters) (bySp[m.sp] = bySp[m.sp] || []).push(m);
  const tm = new Set(team().map((m) => m.id));
  for (const list of Object.values(bySp)) {
    list.sort((a, b) => b.lvl - a.lvl);
    for (const m of list.slice(2)) if (!tm.has(m.id) && G.state.monsters.length > 3) M.release(m);
  }
  for (const m of team()) {
    if (m.lvl >= M.maxLevel(m) && M.rankUp(m)) {
      log(`rank up ${m.sp} -> rank ${m.rank}`);
      did = true;
    }
  }
  // grow: upgrade habitats and vaults when comfortably affordable
  for (const b of G.state.buildings) {
    const nx = B.nextLevelDef(b);
    if (nx && !B.upgradeBlocker(b) && G.state.res.gold > (nx.cost.gold || 0) * 2 && B.isHabitat(b)) {
      if (B.startUpgrade(b)) did = true;
    }
  }
  if (G.state.res.gold >= R.goldCap() * 0.9) did = !!tryBuild('gold_storage', 'gold capped') || did;
  if (G.state.res.food >= R.foodCap() * 0.9) did = !!tryBuild('food_storage', 'food capped') || did;
  const nextIsland = B.nextLockedIsland && B.nextLockedIsland();
  if (nextIsland && !B.islandUnlockBlocker(nextIsland.id) && B.unlockIsland(nextIsland.id)) {
    log(`unlocked island ${nextIsland.name}`);
    did = true;
  }

  // feed the team (keep enough food for the next crop cycle)
  for (const m of team().sort((a, b) => a.lvl - b.lvl)) {
    if (!M.canFeed(m)) continue;
    const need = M.foodToNext(m);
    if (G.state.res.food >= need) {
      const r = M.feed(m, 'level');
      if (r.levels) did = true;
    }
  }

  // campaign
  const f = CP.frontier();
  if (f.w <= 8) {
    const st = CP.getStage(f.w, f.s);
    const retryOk = !lastLossAt[st.id] || t() - lastLossAt[st.id].t > 240 || M.power(team()[0] || { lvl: 0 }) > lastLossAt[st.id].p;
    if (retryOk && CP.canEnter(st)) {
      if (st.type === 'treasure' || (st.type === 'mystery' && !st.enemies.length)) {
        CP.resolveNode(st);
        did = true;
      } else {
        CP.spendEnergy(st);
        const r = fight(st);
        if (r && r.win) {
          wins++;
          CP.completeStage(st, r.stars);
          if (st.type === 'boss' || st.stage % 5 === 0) log(`cleared ${st.id} (${st.type}) team ${team().map((m) => `${m.sp}:${m.lvl}`).join(' ')}`);
        } else {
          losses++;
          lastLossAt[st.id] = { t: t(), p: M.power(team()[0] || { lvl: 0 }) };
          log(`LOST ${st.id} (${st.type}) enemies ${st.enemies.map((e) => `${e.species}:${e.level}`).join(' ')} vs ${team().map((m) => `${m.sp}:${m.lvl}`).join(' ')}`);
        }
        did = true;
      }
    }
  }
  return did;
}

let lastSnap = 0;
while (t() < MINUTES * 60) {
  const did = act();
  if (!did) {
    if (idle.since === null) idle.since = t();
  } else if (idle.since !== null) {
    const span = t() - idle.since;
    if (span >= 60) idle.spans.push([idle.since, span]);
    idle.total += span;
    idle.since = null;
  }
  if (t() - lastSnap >= 600) {
    lastSnap = t();
    const S = G.state;
    const q = Q.currentMain();
    if (Object.keys(income).length) log('   gold flow (10 min):', Object.entries(income).sort((a, b) => Math.abs(b[1]) - Math.abs(a[1])).map(([k, v]) => `${k} ${Math.round(v)}`).join(', '));
    for (const k in income) delete income[k];
    log(`-- L${S.player.level} gold ${Math.round(S.res.gold)} food ${Math.round(S.res.food)} gems ${S.res.gems} energy ${S.res.energy} mons ${S.monsters.length} stage ${CP.frontier().w}-${CP.frontier().s} goal: ${q ? q.text + ` (${q.value}/${q.goal.n})` : '-'}`);
  }
  G.timeOffset += STEP * 1000;
}
console.log(`\nwins ${wins} losses ${losses}; idle ${Math.round((idle.total / (MINUTES * 60)) * 100)}% of the session`);
console.log('longest idle stretches (start, seconds):', idle.spans.sort((a, b) => b[1] - a[1]).slice(0, 8).map(([s, d]) => `${clock(s).trim()} ${Math.round(d)}s`).join(', '));
if (process.env.DEBUG) {
  console.log('dex', Object.keys(G.state.dex).filter((k) => G.state.dex[k]).join(','), 'dexraw', JSON.stringify(G.state.dex).slice(0, 300));
  console.log('monsters', G.state.monsters.map((m) => `${m.sp}:${m.lvl}`).join(' '));
  console.log('breeding', JSON.stringify(G.state.breeding), 'hatchery', JSON.stringify(G.state.hatchery));
  const reps = [...new Map(G.state.monsters.map((m) => [m.sp, m])).values()];
  for (let i = 0; i < reps.length; i++) for (let j = i + 1; j < reps.length; j++) {
    console.log(reps[i].sp, '+', reps[j].sp, BR.breedBlocker(reps[i], reps[j]) || '', BR.breedOutcomes(reps[i], reps[j]).map((o) => `${o.sp}:${(o.p * 100).toFixed(0)}%`).join(' '));
  }
}
