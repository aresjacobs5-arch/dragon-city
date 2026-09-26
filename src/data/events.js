// Rotating live events. Fully data-driven: the active event is picked from the
// week number, so replacing/adding events means editing this list only.
export const EVENTS = [
  {
    id: 'breeding_frenzy', name: 'Breeding Frenzy', type: 'breeding', color: '#ff5f8f', currency: 'Heartstones',
    blurb: 'Breed monsters to earn Heartstones. Rarer babies earn more!',
    points: { common: 10, uncommon: 20, rare: 45, epic: 90, legendary: 200, mythic: 400, ancient: 600 },
    milestones: [
      { at: 50, reward: { gold: 2000 } },
      { at: 150, reward: { gems: 10 } },
      { at: 300, reward: { chest: 'silver' } },
      { at: 500, reward: { egg: 'rare' } },
      { at: 800, reward: { gems: 30 } },
      { at: 1200, reward: { species: 'celestwhal' } },
    ],
  },
  {
    id: 'boss_hunt', name: 'Boss Hunt', type: 'boss', color: '#ff7a3a', currency: 'Trophy Marks',
    blurb: 'A rogue titan roams the skies. Defeat it at higher tiers for more Marks.',
    boss: 'boss_lavaturtle', tiers: [8, 16, 26, 38, 52], tierPoints: [20, 45, 80, 130, 200],
    milestones: [
      { at: 40, reward: { gold: 3000 } },
      { at: 120, reward: { gems: 12 } },
      { at: 250, reward: { chest: 'gold' } },
      { at: 450, reward: { egg: 'epic' } },
      { at: 700, reward: { species: 'voidmaw' } },
    ],
  },
  {
    id: 'treasure_island', name: 'Treasure Island', type: 'treasure', color: '#ffc83d', currency: 'Treasure Maps',
    blurb: 'Campaign victories uncover Treasure Maps. Dig up the loot!',
    perWin: 10, perBoss: 60,
    milestones: [
      { at: 60, reward: { gold: 3000 } },
      { at: 160, reward: { food: 4000 } },
      { at: 300, reward: { chest: 'silver' } },
      { at: 500, reward: { gems: 25 } },
      { at: 800, reward: { chest: 'mythic' } },
    ],
  },
  {
    id: 'element_trials', name: 'Element Trials', type: 'element', color: '#5dbf3c', currency: 'Trial Seals',
    blurb: 'Win special battles using only one element. Prove your mastery!',
    elements: ['fire', 'nature', 'water', 'earth'], tiers: [4, 10, 18, 28], tierPoints: [15, 35, 60, 100],
    milestones: [
      { at: 40, reward: { gold: 2500 } },
      { at: 120, reward: { gems: 10 } },
      { at: 240, reward: { egg: 'rare' } },
      { at: 400, reward: { chest: 'gold' } },
      { at: 600, reward: { species: 'astrowl' } },
    ],
  },
  {
    id: 'collection_fest', name: 'Collection Fest', type: 'collection', color: '#8fb4ff', currency: 'Fest Tickets',
    blurb: 'Hatch monsters to earn tickets. New discoveries earn triple!',
    points: { hatch: 15, discover: 45 },
    milestones: [
      { at: 45, reward: { food: 2500 } },
      { at: 120, reward: { gems: 10 } },
      { at: 240, reward: { chest: 'silver' } },
      { at: 400, reward: { egg: 'epic' } },
      { at: 650, reward: { species: 'stardrop' } },
    ],
  },
];

const WEEK = 7 * 24 * 3600 * 1000;
const EPOCH = Date.UTC(2024, 0, 1);

export function activeEvent(now = Date.now()) {
  const week = Math.floor((now - EPOCH) / WEEK);
  const ev = EVENTS[((week % EVENTS.length) + EVENTS.length) % EVENTS.length];
  const start = EPOCH + week * WEEK;
  return { ...ev, key: `${ev.id}-${week}`, start, end: start + WEEK };
}
