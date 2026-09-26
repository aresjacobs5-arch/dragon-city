import { G } from '../game/G.js';
import { isHabitat, habitatGold, habitatRate, cropReady, snapshotAllHabitats } from './buildings.js';
import { refreshEnergy } from './resources.js';

// Offline earnings are simply habitat gold that accrued while away (capped by
// each habitat's storage), plus crops that finished growing. An additional
// global cap of 10 hours prevents exploits via device clock changes.
export const OFFLINE_CAP_HOURS = 10;

export function computeOffline(lastTick, now = G.now()) {
  if (!lastTick || now <= lastTick) return null;
  let away = (now - lastTick) / 1000;
  if (away < 90) return null;
  // Clock went backwards or is absurd: ignore
  if (away > 60 * 60 * 24 * 60) away = 60 * 60 * 24 * 60;
  const capSec = OFFLINE_CAP_HOURS * 3600;
  const effective = Math.min(away, capSec);
  let gold = 0;
  for (const b of G.state.buildings) {
    if (!isHabitat(b) || b.state === 'building') continue;
    // fold everything earned before leaving into the snapshot
    if (b.goldTs < lastTick) {
      b.gold = habitatGold(b, lastTick);
      b.goldTs = lastTick;
    }
    const before = b.gold;
    // global cap: only the last OFFLINE_CAP_HOURS count toward accrual
    if (away > capSec) b.goldTs = Math.max(b.goldTs, now - capSec * 1000);
    const after = habitatGold(b, now);
    gold += Math.max(0, after - before);
  }
  let crops = 0;
  for (const b of G.state.buildings) if (b.type === 'farm' && b.crop && cropReady(b, now) && b.cropUntil > lastTick) crops++;
  refreshEnergy(now);
  const eggs = G.state.hatchery.filter((e) => e.until && e.until <= now && e.until > lastTick).length;
  const breed = G.state.breeding && G.state.breeding.until <= now && G.state.breeding.until > lastTick;
  return { away, effective, gold: Math.floor(gold), crops, eggs, breed: !!breed, rate: G.state.buildings.filter(isHabitat).reduce((s, b) => s + habitatRate(b), 0) };
}

export { snapshotAllHabitats };
