// Battle status effects. `kind` drives icon tint and cleanse/dispel rules.
export const STATUSES = {
  burn: { id: 'burn', name: 'Burn', kind: 'debuff', color: '#ff6a2b', dot: 0.06, desc: 'Takes fire damage each turn' },
  poison: { id: 'poison', name: 'Poison', kind: 'debuff', color: '#8fd13a', dot: 0.045, stacks: 3, desc: 'Takes damage each turn (stacks)' },
  freeze: { id: 'freeze', name: 'Freeze', kind: 'debuff', color: '#7fdcff', skip: true, desc: 'Skips next turn' },
  stun: { id: 'stun', name: 'Stun', kind: 'debuff', color: '#ffd23f', skip: true, desc: 'Skips next turn' },
  bleed: { id: 'bleed', name: 'Bleed', kind: 'debuff', color: '#e0334f', onAct: 0.07, desc: 'Takes damage when acting' },
  regen: { id: 'regen', name: 'Regen', kind: 'buff', color: '#5dd66a', hot: 0.08, desc: 'Heals each turn' },
  shield: { id: 'shield', name: 'Shield', kind: 'buff', color: '#8fd8ff', desc: 'Absorbs damage' },
  atkUp: { id: 'atkUp', name: 'Attack Up', kind: 'buff', color: '#ff7a3a', mod: { atk: 0.35 }, desc: '+35% Attack' },
  atkDown: { id: 'atkDown', name: 'Attack Down', kind: 'debuff', color: '#b86a4a', mod: { atk: -0.35 }, desc: '-35% Attack' },
  defUp: { id: 'defUp', name: 'Defense Up', kind: 'buff', color: '#5aa8ff', mod: { def: 0.5 }, desc: '+50% Defense' },
  defDown: { id: 'defDown', name: 'Defense Down', kind: 'debuff', color: '#6a7ab8', mod: { def: -0.45 }, desc: '-45% Defense' },
  spdUp: { id: 'spdUp', name: 'Speed Up', kind: 'buff', color: '#ffe066', mod: { spd: 0.3 }, desc: '+30% Speed' },
  spdDown: { id: 'spdDown', name: 'Speed Down', kind: 'debuff', color: '#8a8aa8', mod: { spd: -0.3 }, desc: '-30% Speed' },
  taunt: { id: 'taunt', name: 'Taunt', kind: 'buff', color: '#ff9a3a', desc: 'Enemies must target this monster' },
  rage: { id: 'rage', name: 'Rage', kind: 'buff', color: '#ff3a3a', mod: { atk: 0.15 }, stacks: 5, desc: 'Attack grows each turn' },
};
