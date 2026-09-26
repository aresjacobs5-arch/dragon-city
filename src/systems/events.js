import { G } from '../game/G.js';
import { activeEvent } from '../data/events.js';
import { species } from './monsters.js';
import { grant } from './rewards.js';

// Live-event progress. Event data is rotated weekly from data/events.js.
export function currentEvent() {
  const ev = activeEvent(G.now());
  const E = G.state.events;
  if (E.key !== ev.key) {
    E.key = ev.key;
    E.points = 0;
    E.claimed = [];
    G.markDirty();
  }
  return ev;
}

export function eventPoints() {
  currentEvent();
  return G.state.events.points;
}

export function addEventPoints(n, reason = '') {
  if (!n) return;
  currentEvent();
  G.state.events.points += n;
  G.markDirty();
  G.bus.emit('event:points', { n, total: G.state.events.points, reason });
}

export function milestoneStatus() {
  const ev = currentEvent();
  const pts = G.state.events.points;
  return ev.milestones.map((m, i) => ({ ...m, i, reached: pts >= m.at, claimed: G.state.events.claimed.includes(i) }));
}

export function claimMilestone(i) {
  const ms = milestoneStatus()[i];
  if (!ms || !ms.reached || ms.claimed) return null;
  G.state.events.claimed.push(i);
  G.markDirty();
  return grant(ms.reward, 'event');
}

export function eventClaimable() {
  if (G.state.player.level < 6) return 0;
  return milestoneStatus().filter((m) => m.reached && !m.claimed).length;
}

export function timeLeft() {
  const ev = currentEvent();
  return Math.max(0, Math.floor((ev.end - G.now()) / 1000));
}

// Hook gameplay into event scoring.
export function initEvents() {
  G.bus.on('breed:collected', ({ sp }) => {
    const ev = currentEvent();
    if (ev.type === 'breeding') addEventPoints(ev.points[species(sp).rarity] || 10, 'breed');
  });
  G.bus.on('egg:hatched', ({ m }) => {
    const ev = currentEvent();
    if (ev.type === 'collection') addEventPoints(ev.points.hatch, 'hatch');
  });
  G.bus.on('dex:discovered', () => {
    const ev = currentEvent();
    if (ev.type === 'collection') addEventPoints(ev.points.discover, 'discover');
  });
  G.bus.on('campaign:win', ({ stage }) => {
    const ev = currentEvent();
    if (ev.type === 'treasure') addEventPoints(stage.type === 'boss' ? ev.perBoss : ev.perWin, 'win');
  });
}
