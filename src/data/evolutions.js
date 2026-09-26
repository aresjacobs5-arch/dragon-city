// Evolution: every monster has three forms. It hatches as a baby, evolves at
// level 7 and reaches its final form at level 15. Each form has its own name;
// the looks of evolved forms are derived in render/monsters/evolve.js.

export const EVOLVE_LEVELS = [7, 15];

export function stageForLevel(level) {
  return level >= EVOLVE_LEVELS[1] ? 2 : level >= EVOLVE_LEVELS[0] ? 1 : 0;
}

// species id -> [level 7 form, level 15 form]
export const FORM_NAMES = {
  embercub: ['Blazehound', 'Infernox'],
  sproutle: ['Bloomkin', 'Grovewarden'],
  ripplet: ['Rippleon', 'Torrentide'],
  pebblor: ['Bouldor', 'Montolith'],
  zapkit: ['Joltfox', 'Stormlynx'],
  frostnip: ['Chillhorn', 'Avalanchor'],
  gloomling: ['Murkwing', 'Nightshroud'],
  lumipup: ['Gleamhound', 'Aurorion'],
  clankle: ['Cogscarab', 'Titanscarab'],
  wispurr: ['Glimmurr', 'Arcanyx'],
  bloomfang: ['Thornblaze', 'Wildroar'],
  steamtoad: ['Geysertoad', 'Vaporking'],
  magmaul: ['Lavashell', 'Volcanox'],
  stormeel: ['Surgeel', 'Tidalvolt'],
  mudwhisker: ['Marshpaw', 'Bogmonarch'],
  thornback: ['Bramblehide', 'Thornocerous'],
  lotusnap: ['Lilyshell', 'Lotusarch'],
  frostfin: ['Floewhal', 'Glaciorca'],
  cinderbolt: ['Sparkblaze', 'Plasmarch'],
  duskmoth: ['Gloamoth', 'Moonveil'],
  prismane: ['Glimmerhorn', 'Spectralis'],
  rivetron: ['Dynamox', 'Gigavolt'],
  ashhorn: ['Charhorn', 'Pyrocerus'],
  tidebreaker: ['Reefclaw', 'Tsunaclaw'],
  thunderhoof: ['Stormhoof', 'Titanram'],
  glacierback: ['Floeshell', 'Glaciodon'],
  shadefang: ['Smokefang', 'Nightblaze'],
  sunpetal: ['Daybloom', 'Solaria'],
  gearhawk: ['Cogfalcon', 'Aegisgryph'],
  hexowl: ['Grimowl', 'Oraclaw'],
  coralisk: ['Reefback', 'Atollord'],
  blizzbat: ['Frostwing', 'Hailwraith'],
  abyssquid: ['Inkreaver', 'Abyssarch'],
  cinderwing: ['Flarewing', 'Phoenyx'],
  pyroclaw: ['Forgewing', 'Pyrotyrant'],
  verdragon: ['Leafdrake', 'Arborwyrm'],
  voltwyrm: ['Arcwyrm', 'Thundercoil'],
  frostmane: ['Snowmane', 'Aurorix'],
  anvilgrim: ['Forgegrim', 'Colossiron'],
  arcanaga: ['Spellnaga', 'Leviarcana'],
  solflare: ['Dawnflare', 'Heliosar'],
  umbravolt: ['Duskvolt', 'Eclipsar'],
  ignarok: ['Blazarok', 'Ignaroth'],
  sylvanos: ['Grovanos', 'Sylvanarch'],
  tempestra: ['Stormestra', 'Maelstrix'],
  glaciax: ['Frostiax', 'Cryolossus'],
  noctyra: ['Nocturna', 'Nyxaria'],
  auraleon: ['Radialeon', 'Luxarion'],
  voidmaw: ['Riftmaw', 'Oblivor'],
  celestwhal: ['Starwhal', 'Galaxwhal'],
  astrowl: ['Nebulowl', 'Zodiarch'],
  nullmite: ['Riftmite', 'Nullstalker'],
  stardrop: ['Starbloom', 'Nebulon'],
  primordon: ['Fossildon', 'Aeonodon'],
  elderwyrm: ['Rootwyrm', 'Worldroot'],
  runeling: ['Glyphguard', 'Runemonarch'],
  monolord: ['Obelord', 'Megalith'],
  emberling: ['Blazeguard', 'Magmatitan'],
};

// Name of a species in a given form (bosses and unknown ids keep their name).
export function formName(def, stage = 0) {
  const names = stage > 0 && def && FORM_NAMES[def.id];
  return names ? names[stage - 1] : def ? def.name : '';
}

export const FORM_LABEL = ['Baby', 'Evolved', 'Final form'];
