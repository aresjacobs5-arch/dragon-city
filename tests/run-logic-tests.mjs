// Headless logic tests: node tests/run-logic-tests.mjs
import { G, createNewState } from '../src/game/G.js';
import { encode, decode } from '../src/core/save.js';
import { placeBuilding, findSpot, collectHabitat, habitatGold, placeMonsterIn, tickBuildings, plant, harvest, obstaclesFor, islandGrid, canPlace } from '../src/systems/buildings.js';
import { createMonster, feed, monStats, power, species } from '../src/systems/monsters.js';
import { Battle } from '../src/systems/battle.js';
import { breedOutcomes, startBreeding, collectBreedingEgg } from '../src/systems/breeding.js';
import { hatchEgg, tickHatchery } from '../src/systems/hatchery.js';
import { getStage, WORLDS, STAGES_PER_WORLD } from '../src/data/campaign.js';
import { MONSTERS } from '../src/data/monsters.js';
import { ABILITIES } from '../src/data/abilities.js';
import { BOSSES } from '../src/data/bosses.js';
import { addXP } from '../src/systems/player.js';
import { currentMain, claimMain, dailyList } from '../src/systems/quests.js';
import { openChest, addChest, loginStatus, claimLogin } from '../src/systems/rewards.js';
import { computeOffline } from '../src/systems/offline.js';

let fails = 0;
const ok = (cond, msg) => {
  if (!cond) {
    fails++;
    console.log('  FAIL', msg);
  } else console.log('  ok  ', msg);
};

console.log('# data integrity');
for (const m of [...MONSTERS, ...Object.values(BOSSES)]) {
  for (const a of m.abilities) if (!ABILITIES[a]) ok(false, `${m.id} missing ability ${a}`);
  if (m.abilities.length !== 4) ok(false, `${m.id} has ${m.abilities.length} abilities`);
  if (!m.abilities.some((a) => ABILITIES[a].kind === 'ult')) ok(false, `${m.id} has no ult`);
  for (const r of m.recipe || []) for (const p of r) if (!MONSTERS.find((x) => x.id === p)) ok(false, `${m.id} recipe parent ${p} missing`);
}
ok(MONSTERS.length >= 50, `monster count ${MONSTERS.length}`);

console.log('# new game + buildings');
G.state = createNewState(1_000_000_000_000);
G.timeOffset = 1_000_000_000_000 - Date.now();
const grid = islandGrid(0);
ok(grid.cells.size > 250, `home island cells ${grid.cells.size}`);
ok(obstaclesFor(0).length > 20, `obstacles ${obstaclesFor(0).length}`);
const hs = findSpot('hatchery', 0, -1, -2);
const hatch = placeBuilding('hatchery', 0, hs.x, hs.z, { free: true, instant: true });
ok(!!hatch && hatch.state === 'ready', 'hatchery placed');
const spot = findSpot('hab_fire', 0, 2, 1);
const hab = placeBuilding('hab_fire', 0, spot.x, spot.z);
ok(!!hab && hab.state === 'building', 'fire habitat building');
ok(!canPlace('hab_fire', 0, spot.x, spot.z), 'occupied spot rejected');
G.timeOffset += 5000;
tickBuildings();
ok(hab.state === 'ready', 'habitat completed');
const cub = createMonster('embercub');
ok(placeMonsterIn(cub, hab), 'placed embercub');
G.timeOffset += 60_000;
const g = habitatGold(hab);
ok(g > 15 && g < 30, `gold after 1 min: ${g.toFixed(1)}`);
const before = G.state.res.gold;
collectHabitat(hab);
ok(G.state.res.gold > before, 'collected gold');

console.log('# farm & feeding');
const fs = findSpot('farm', 0, -2, 1);
const farm = placeBuilding('farm', 0, fs.x, fs.z);
G.timeOffset += 6000;
tickBuildings();
ok(plant(farm, 'berries'), 'planted berries');
G.timeOffset += 31000;
const foodBefore = G.state.res.food;
harvest(farm);
ok(G.state.res.food > foodBefore, `harvested food ${G.state.res.food - foodBefore}`);
G.state.res.food = 500;
const fr = feed(cub, 'level');
ok(fr.levels === 1 && cub.lvl === 2, `fed to level ${cub.lvl}`);

console.log('# battle simulation');
function simulate(allies, enemies, maxTurns = 400) {
  const b = new Battle({ allies, enemies: enemies.map((m, i) => ({ mon: m, slot: i })) });
  let turns = 0;
  const kinds = new Set();
  while (!b.result && turns < maxTurns) {
    const u = b.nextActor();
    const r = b.beginTurn(u);
    r.ev.forEach((e) => kinds.add(e.t));
    if (b.result) break;
    if (!r.skip && u.alive) {
      const c = b.choose(u);
      b.act(u, c.ability, c.target).forEach((e) => kinds.add(e.t));
    }
    turns++;
  }
  return { result: b.result, turns, kinds, stars: b.starsEarned() };
}
const r1 = simulate([{ id: 1, sp: 'embercub', lvl: 1, rank: 0 }], [{ sp: 'sproutle', lvl: 1 }]);
ok(r1.result !== null, `1v1 finished: ${r1.result} in ${r1.turns} turns`);
let wins = 0;
for (let i = 0; i < 200; i++) if (simulate([{ id: 1, sp: 'embercub', lvl: 1 }], [{ sp: 'sproutle', lvl: 1 }]).result === 'win') wins++;
ok(wins > 150, `embercub beats sproutle (element advantage) ${wins}/200`);
const r3 = simulate(
  [{ id: 1, sp: 'pyroclaw', lvl: 30 }, { id: 2, sp: 'verdragon', lvl: 30 }, { id: 3, sp: 'tidebreaker', lvl: 30 }],
  [{ sp: 'boss_stormdragon', lvl: 36 }]
);
ok(r3.result !== null && r3.kinds.has('summon') === false, `boss fight finished: ${r3.result} turns ${r3.turns} events ${[...r3.kinds].join(',')}`);
const r4 = simulate(
  [{ id: 1, sp: 'bloomfang', lvl: 12 }, { id: 2, sp: 'stormeel', lvl: 12 }, { id: 3, sp: 'magmaul', lvl: 12 }],
  [{ sp: 'boss_colossus', lvl: 12 }]
);
ok(r4.kinds.has('summon'), `colossus summons minions (${r4.result}, ${r4.turns} turns)`);

console.log('# campaign stage generation');
let bad = 0;
let count = 0;
for (let w = 1; w <= WORLDS.length; w++) {
  for (let s = 1; s <= STAGES_PER_WORLD; s++) {
    const st = getStage(w, s);
    count++;
    const needsFight = ['battle', 'elite', 'challenge', 'boss'].includes(st.type);
    if (needsFight && !st.enemies.length) bad++;
    for (const e of st.enemies) if (!species(e.species)) bad++;
  }
}
ok(bad === 0 && count === 240, `${count} stages generated, ${bad} invalid`);

console.log('# balance: player-like team vs each world (win rates)');
for (let w = 1; w <= WORLDS.length; w++) {
  const W = WORLDS[w - 1];
  const lvl = W.levels[1] + 2;
  const team = ['bloomfang', 'stormeel', 'ashhorn'].map((sp, i) => ({ id: i + 1, sp: w > 3 ? ['pyroclaw', 'verdragon', 'tidebreaker'][i] : sp, lvl, rank: Math.min(5, Math.floor(w / 2)) }));
  let win = 0;
  const N = 40;
  for (let i = 0; i < N; i++) {
    const st = getStage(w, 25);
    const res = simulate(team, st.enemies.map((e) => ({ sp: e.species, lvl: e.level })));
    if (res.result === 'win') win++;
  }
  let bossWin = 0;
  for (let i = 0; i < 20; i++) {
    const st = getStage(w, 30);
    const res = simulate(team, st.enemies.map((e) => ({ sp: e.species, lvl: e.level })));
    if (res.result === 'win') bossWin++;
  }
  console.log(`   world ${w} (team lvl ${lvl}): stage 25 ${win}/${N}, boss ${bossWin}/20`);
}

console.log('# breeding');
const sprout = createMonster('sproutle');
const outs = breedOutcomes(cub, sprout);
console.log('   outcomes:', outs.map((o) => `${o.sp}:${(o.p * 100).toFixed(1)}%`).join(' '));
ok(outs.some((o) => o.sp === 'bloomfang'), 'bloomfang is a possible outcome');
const bs = findSpot('breeding', 0, 0, 0);
const bm = placeBuilding('breeding', 0, bs.x, bs.z, { free: true, instant: true });
const br = startBreeding(cub, sprout);
ok(br.sp === 'bloomfang' && br.time <= 10, `first breeding -> ${br.sp} in ${br.time}s`);
G.timeOffset += 11000;
const col = collectBreedingEgg();
ok(col && col.egg, 'egg collected into hatchery');
G.timeOffset += 10000;
tickHatchery();
const baby = hatchEgg(col.egg);
ok(baby && baby.sp === 'bloomfang', 'hybrid hatched');

console.log('# quests / rewards');
addXP(500);
ok(G.state.player.level >= 3, `player level ${G.state.player.level}`);
const mq = currentMain();
ok(mq && mq.id, `main quest ${mq.id}: ${mq.text} (${mq.value}/${mq.goal.n})`);
if (mq.done) claimMain();
ok(dailyList().length === 5 || G.state.player.level < 2, 'daily quests generated');
addChest('gold');
const items = openChest('gold');
ok(items.length >= 3, `gold chest gave ${items.length} items`);
const ls = loginStatus();
ok(ls.day === 1, 'login day 1');
claimLogin();
ok(loginStatus().claimedToday, 'login claimed');

console.log('# offline earnings');
const last = G.now();
G.timeOffset += 3 * 3600 * 1000;
const off = computeOffline(last);
ok(off && off.gold > 0, `offline gold ${off && off.gold} over 3h`);

console.log('# save round trip + corruption');
const str = encode(G.state);
const back = decode(str).state;
ok(back.monsters.length === G.state.monsters.length, 'decode restores monsters');
let threw = false;
try {
  decode(str.replace('embercub', 'embercux'));
} catch {
  threw = true;
}
ok(threw, 'checksum detects tampering');

console.log(fails ? `\n${fails} FAILURE(S)` : '\nALL TESTS PASSED');
process.exit(fails ? 1 : 0);
