// Monster database. Adding a monster = adding a definition here.
// model: procedural recipe consumed by render/monsters/archetypes.js
// roles tune stat spreads; rarity scales stats (see systems/monsters.js).

const M = [];
function mon(def) {
  M.push({ breedable: true, obtain: ['breed'], role: 'brawler', ...def });
}

// =============================== COMMON ===================================
mon({
  id: 'embercub', name: 'Embercub', elements: ['fire'], rarity: 'common', role: 'striker', obtain: ['starter', 'breed', 'shop'],
  desc: 'A charcoal pup whose cracks glow brighter when it is happy.',
  abilities: ['ember_swipe', 'flame_breath', 'heat_up', 'inferno'],
  model: {
    arch: 'quad',
    colors: { skin: '#3d3236', belly: '#6e5652', snout: '#7a605a', accent: '#2a2124', eye: '#ffb52e', glow: '#ff8a2a', inner: '#ff9a5a', horn: '#2b2326', limb: '#352b2e' },
    body: { width: 0.3, height: 0.27, length: 0.38 },
    head: { size: 0.36, snout: 0.35 },
    face: { eyes: 'round', mouth: 'smile', eyeSize: 0.3 },
    ears: { style: 'pointy', size: 0.55 },
    horns: { style: 'nub', size: 0.45, tip: 'glow', glow: 0.8 },
    tail: { style: 'flame', len: 0.45, r: 0.06 },
    pattern: { type: 'cracks', scale: 6, width: 0.045 },
  },
});
mon({
  id: 'sproutle', name: 'Sproutle', elements: ['nature'], rarity: 'common', role: 'support', obtain: ['tutorial', 'breed', 'shop'],
  desc: 'Naps in sunbeams and hums until flowers bloom around it.',
  abilities: ['vine_lash', 'healing_bloom', 'entangle', 'verdant_storm'],
  model: {
    arch: 'biped',
    colors: { skin: '#7cc453', belly: '#d9f0a8', accent: '#4f9a37', eye: '#5a3a1a', leaf: '#6fd04a', horn: '#9a6a3f', limb: '#6ab046', stem: '#5c9e38', flower: '#ff8fb8', inner: '#b8e886' },
    body: { r: 0.27, h: 0.42, armLen: 0.18 },
    head: { size: 0.4, faceBelly: true },
    face: { eyes: 'round', mouth: 'smile', cheeks: true, eyeSize: 0.3 },
    ears: { style: 'leaf', size: 0.55, pitch: 0.35, yaw: 1.2, tilt: 0.9, color: 'leaf' },
    horns: { style: 'wood', size: 0.3, yaw: 0.35, pitch: 0.85, minStage: 1 },
    hair: 'sprout',
    back: { style: 'moss', count: 3, size: 0.5, color: 'accent' },
  },
});
mon({
  id: 'ripplet', name: 'Ripplet', elements: ['water'], rarity: 'common', role: 'support', obtain: ['breed', 'shop'],
  desc: 'Its frilly gills sparkle whenever it spots a puddle.',
  abilities: ['splash', 'bubble_shield', 'tidal_jet', 'tsunami'],
  model: {
    arch: 'frog', gills: true,
    colors: { skin: '#7fd3ff', belly: '#e8f8ff', accent: '#ff8fc8', eye: '#2a1a3a', mouth: '#4a1a3a', cheek: '#ff9ac8' },
    body: { w: 0.34, h: 0.25, d: 0.3 },
    face: { eyes: 'round', mouth: 'smile', cheeks: true, eyeMounts: false, eyeYaw: 0.55, mouthWidth: 0.7 },
    tail: { style: 'fin', len: 0.4 },
    back: { style: 'fins', count: 3, size: 0.6, color: 'accent' },
    pattern: { type: 'spots', color: '#bfe9ff', scale: 9, amount: 0.55 },
  },
});
mon({
  id: 'pebblor', name: 'Pebblor', elements: ['earth'], rarity: 'common', role: 'tank', obtain: ['breed', 'shop'],
  desc: 'Carries its favorite pebbles in its fists. All of them.',
  abilities: ['rock_punch', 'stone_shield', 'boulder_toss', 'tectonic_slam'],
  model: {
    arch: 'golem', rocky: true,
    colors: { skin: '#a58b72', belly: '#bfa386', accent: '#8a7560', armor: '#7d6b5a', fist: '#8f7a64', eye: '#46d0ff', glow: '#5fe0ff', limb: '#9a8068' },
    body: { w: 0.38, h: 0.38, d: 0.3, fist: 0.19 },
    head: { size: 0.24, faceBelly: false },
    face: { eyes: 'round', mouth: 'smile', eyeSize: 0.36 },
    studs: { count: 5, color: '#5fe0ff', glow: 0.7, shape: 'crystal', size: 0.035 },
    back: { style: 'rocks', count: 4, size: 0.45, color: 'armor' },
    pattern: { type: 'plates', color: '#7a6552', scale: 6, width: 0.05 },
  },
});
mon({
  id: 'zapkit', name: 'Zapkit', elements: ['electric'], rarity: 'common', role: 'speedster', obtain: ['breed', 'shop'],
  desc: 'Faster than its own shadow. Its fur crackles when petted.',
  abilities: ['static_nip', 'thunderbolt', 'overcharge', 'storm_surge'],
  model: {
    arch: 'quad',
    colors: { skin: '#ffd23f', belly: '#fff4c2', snout: '#fff4c2', accent: '#2f6fd6', eye: '#2f6fd6', glow: '#7fe8ff', inner: '#2f6fd6', limb: '#f2c030', toe: '#2f6fd6' },
    body: { width: 0.26, height: 0.24, length: 0.36, legLen: 0.28, legR: 0.07, pawR: 0.085 },
    head: { size: 0.33, snout: 0.45, snoutW: 0.9 },
    face: { eyes: 'round', mouth: 'smile', eyeSize: 0.32, cheeks: true },
    ears: { style: 'bolt', size: 0.75, pitch: 0.7, yaw: 0.6, color: 'skin', inner: 'accent' },
    tail: { style: 'bolt', len: 0.5, r: 0.05, accent: 'accent', size: 1.3 },
    pattern: { type: 'stripes', color: '#2f6fd6', scale: 9, amount: 0.72 },
  },
});
mon({
  id: 'frostnip', name: 'Frostnip', elements: ['ice'], rarity: 'common', role: 'tank', obtain: ['breed', 'shop'],
  desc: 'A fluffy snowball with icicle ears. Hugs are very cold.',
  abilities: ['frost_bite', 'snow_burrow', 'ice_shard', 'absolute_zero'],
  model: {
    arch: 'biped',
    colors: { skin: '#f4fbff', belly: '#dff1ff', accent: '#8fd8ff', eye: '#3b7cc9', inner: '#bfe8ff', limb: '#e8f4ff', horn: '#8fd8ff', foot: '#bfdcf0', cheek: '#ffc6dc' },
    body: { r: 0.32, h: 0.46, armLen: 0.14, legLen: 0.08, taper: 0.05 },
    head: { size: 0.36, sink: true },
    face: { eyes: 'round', mouth: 'tiny', cheeks: true, eyeSize: 0.3 },
    ears: { style: 'long', size: 0.42, pitch: 0.75, yaw: 0.45, tilt: 0.25, color: 'skin', inner: 'inner' },
    horns: { style: 'crystal', size: 0.35, count: 2, yaw: 0.2, pitch: 1.1, color: 'accent', minStage: 1 },
    back: { style: 'fluff', count: 3, size: 0.5, color: 'skin' },
  },
});
mon({
  id: 'gloomling', name: 'Gloomling', elements: ['dark'], rarity: 'common', role: 'striker', obtain: ['breed', 'shop'],
  desc: 'Hides under beds, but only because it is afraid of the dark.',
  abilities: ['shadow_claw', 'spook', 'life_drain', 'eclipse'],
  model: {
    arch: 'floater',
    colors: { skin: '#4b3576', belly: '#7a5fb0', accent: '#2e1f4d', eye: '#ffe45a', glow: '#c9a0ff', inner: '#ff8fd8', membrane: '#7a55c0', mouth: '#2a0f2a' },
    body: { r: 0.3, float: 0.32, shape: 'orb', arms: false },
    face: { eyes: 'round', mouth: 'fangs', eyeSize: 0.34, eyePitch: 0.1 },
    ears: { style: 'bat', size: 0.6, pitch: 0.65, yaw: 0.65 },
    wings: { style: 'bat', size: 0.55, color: 'accent', membrane: 'membrane' },
    tail: { style: 'spike', len: 0.3, r: 0.04, accent: 'accent' },
  },
});
mon({
  id: 'lumipup', name: 'Lumipup', elements: ['light'], rarity: 'common', role: 'support', obtain: ['breed', 'shop'],
  desc: 'Glows softly at night so its friends never feel lost.',
  abilities: ['radiant_tap', 'glimmer', 'holy_beam', 'solar_flare'],
  model: {
    arch: 'quad',
    colors: { skin: '#fff3d6', belly: '#ffffff', snout: '#ffffff', accent: '#ffd23f', eye: '#8a5a1a', glow: '#ffe27a', inner: '#ffcfa0', limb: '#fff0cc', toe: '#ffd9a0' },
    body: { width: 0.28, height: 0.25, length: 0.34, legLen: 0.22 },
    head: { size: 0.37, snout: 0.4 },
    face: { eyes: 'round', mouth: 'smile', eyeSize: 0.3, cheeks: true },
    ears: { style: 'long', size: 0.4, pitch: 0.35, yaw: 1.15, tilt: 1.8, color: 'skin', inner: 'inner' },
    mane: { style: 'spike', count: 8, color: 'accent', minStage: 1 },
    halo: { minStage: 2 },
    tail: { style: 'fluffy', len: 0.3, r: 0.05, accent: 'accent' },
  },
});
mon({
  id: 'clankle', name: 'Clankle', elements: ['metal'], rarity: 'common', role: 'tank', obtain: ['breed', 'shop'],
  desc: 'A wind-up beetle that never, ever needs winding.',
  abilities: ['iron_strike', 'plate_armor', 'bolt_rivet', 'titan_hammer'],
  model: {
    arch: 'insect', shell: true, shellStripes: true, antennaGlow: true,
    colors: { skin: '#5a6478', shell: '#c9803a', accent: '#8a4a1a', accent2: '#6a3a18', eye: '#39e0ff', glow: '#39e0ff', limb: '#3f4556', membrane: '#dff0ff' },
    body: { r: 0.26 },
    head: { size: 0.2 },
    horns: { style: 'rhino', size: 0.9, count: 1, pitch: 0.4, yaw: 0, color: 'shell' },
    wings: { style: 'insect', size: 0.55, minStage: 2, color: 'membrane', accent: 'glow' },
  },
});
mon({
  id: 'wispurr', name: 'Wispurr', elements: ['magic'], rarity: 'common', role: 'caster', obtain: ['breed', 'shop'],
  desc: 'Purrs in riddles. Nobody has solved one yet.',
  abilities: ['arcane_bolt', 'hex', 'arcane_ward', 'starfall'],
  model: {
    arch: 'floater',
    colors: { skin: '#a58bff', belly: '#e0d4ff', accent: '#6b4fd8', eye: '#ffffff', glow: '#b8f2ff', inner: '#ffb8f0', cheek: '#ff9ad8' },
    body: { r: 0.3, float: 0.3, shape: 'orb', arms: true, wisp: true },
    face: { eyes: 'round', mouth: 'smile', cheeks: true, eyeSize: 0.3 },
    ears: { style: 'cat', size: 0.55 },
    orbit: { count: 3, shape: 'crystal' },
    pattern: { type: 'runes', color: '#c8f6ff', scale: 5, width: 0.045 },
  },
});

// =============================== UNCOMMON =================================
mon({
  id: 'bloomfang', name: 'Bloomfang', elements: ['fire', 'nature'], rarity: 'uncommon', role: 'brawler',
  desc: 'Its flower mane blooms brighter after every victory.',
  abilities: ['vine_lash', 'fireball', 'blossom_gale', 'wildfire_bloom'],
  model: {
    arch: 'quad',
    colors: { skin: '#e8763a', belly: '#ffd9a8', snout: '#ffe0b8', accent: '#ff5f8f', accent2: '#ffd23f', eye: '#3a7a2a', glow: '#ffb03a', inner: '#ffb3c4', limb: '#d86a32', leaf: '#5fc43d' },
    body: { width: 0.3, height: 0.27, length: 0.44, legLen: 0.3, chest: true },
    head: { size: 0.33, snout: 0.7, snoutW: 0.9 },
    face: { eyes: 'fierce', mouth: 'fangs', eyeSize: 0.28, brow: 'angry' },
    ears: { style: 'pointy', size: 0.6 },
    mane: { style: 'leaf', count: 9, color: 'leaf' },
    tail: { style: 'leaf', len: 0.5, r: 0.06, accent: 'leaf' },
    back: { style: 'leaves', count: 3, size: 0.4, color: 'leaf', minStage: 1 },
  },
});
mon({
  id: 'steamtoad', name: 'Steamtoad', elements: ['fire', 'water'], rarity: 'uncommon', role: 'tank',
  desc: 'Whistles like a kettle when it gets excited.',
  abilities: ['splash', 'steam_vent', 'bubble_shield', 'tsunami'],
  model: {
    arch: 'frog',
    colors: { skin: '#e0573a', belly: '#ffd0a8', accent: '#3aa0e8', accent2: '#8fd8ff', eye: '#1a1a2a', mouth: '#5a1a1a', glow: '#bfefff', cheek: '#ffa07a' },
    body: { w: 0.4, h: 0.3, d: 0.34 },
    face: { eyes: 'round', mouth: 'grin', mouthWidth: 1.0 },
    back: { style: 'orbs', count: 3, size: 0.55, color: 'accent' },
    pattern: { type: 'spots', color: '#3aa0e8', scale: 8, amount: 0.6 },
  },
});
mon({
  id: 'magmaul', name: 'Magmaul', elements: ['fire', 'earth'], rarity: 'uncommon', role: 'tank',
  desc: 'A tiny tortoise carrying a very grumpy volcano.',
  abilities: ['rock_punch', 'harden', 'fireball', 'tectonic_slam'],
  model: {
    arch: 'shell', shellTop: 'volcano', shellGlow: true,
    colors: { skin: '#8a6a58', belly: '#c9a888', shell: '#5a4442', rim: '#8a6a58', rock: '#4a3a38', eye: '#ffb52e', glow: '#ff7a1f', accent: '#ff7a1f' },
    body: { r: 0.42, h: 0.28 },
    head: { size: 0.21 },
    face: { eyes: 'fierce', mouth: 'smile', brow: 'angry' },
  },
});
mon({
  id: 'stormeel', name: 'Stormeel', elements: ['water', 'electric'], rarity: 'uncommon', role: 'speedster',
  desc: 'It hums like a power line and giggles when it zaps fish.',
  abilities: ['splash', 'thunderbolt', 'whirlpool', 'storm_surge'],
  model: {
    arch: 'serpent',
    colors: { skin: '#2f7fd6', belly: '#ffe45a', accent: '#ffe45a', eye: '#1a2a4a', glow: '#fff17a', snout: '#6fb0f0' },
    body: { r: 0.15, rise: 0.7, coil: 0.3 },
    head: { size: 0.25, snout: true },
    face: { eyes: 'round', mouth: 'smile', eyeSize: 0.34 },
    back: { style: 'fins', count: 4, size: 0.9, color: 'accent' },
    ears: { style: 'fin', size: 0.5, pitch: 0.35, yaw: 1.3, color: 'accent', inner: 'glow' },
    tailTip: 'bolt',
    whiskers: true,
  },
});
mon({
  id: 'mudwhisker', name: 'Mudwhisker', elements: ['water', 'earth'], rarity: 'uncommon', role: 'brawler',
  desc: 'Digs tunnels to the pond, then forgets which one it dug.',
  abilities: ['rock_punch', 'mud_bomb', 'soothing_rain', 'landslide'],
  model: {
    arch: 'biped',
    colors: { skin: '#8a6a4a', belly: '#e8cfa8', accent: '#5aa0c8', eye: '#1a1a1a', limb: '#7a5a3a', snout: '#f0dcb8', claw: '#fff4dc', nose: '#2a1a1a', inner: '#e8a8a0' },
    body: { r: 0.3, h: 0.44, armLen: 0.2, claws: true, taper: 0.05 },
    head: { size: 0.34, snout: 0.6, sink: true },
    face: { eyes: 'round', mouth: 'smile', eyeSize: 0.24, cheeks: false },
    ears: { style: 'round', size: 0.35, pitch: 0.55, yaw: 1.0 },
    tail: { style: 'fin', len: 0.35, r: 0.07, accent: 'accent' },
    pattern: { type: 'spots', color: '#6a4a30', scale: 8, amount: 0.5 },
  },
});
mon({
  id: 'thornback', name: 'Thornback', elements: ['nature', 'earth'], rarity: 'uncommon', role: 'tank',
  desc: 'Rolls into a spiky ball and waits for danger to get bored.',
  abilities: ['vine_lash', 'quill_volley', 'harden', 'landslide'],
  model: {
    arch: 'quad',
    colors: { skin: '#9a7a5a', belly: '#f0dcb8', snout: '#f4e2c4', accent: '#6fae3f', accent2: '#ff9ab0', eye: '#1a1a1a', inner: '#e8b0a0', limb: '#8a6a4a', nose: '#2a1a1a' },
    body: { width: 0.34, height: 0.3, length: 0.38, legLen: 0.16, hump: true },
    head: { size: 0.3, snout: 0.8, snoutW: 0.75, snoutY: 0.1 },
    face: { eyes: 'round', mouth: 'tiny', eyeSize: 0.26 },
    ears: { style: 'round', size: 0.35 },
    back: { style: 'spikes', count: 9, size: 0.7, color: 'accent' },
    tail: { style: 'plain', len: 0.15, r: 0.04 },
  },
});
mon({
  id: 'lotusnap', name: 'Lotusnap', elements: ['nature', 'water'], rarity: 'uncommon', role: 'support',
  desc: 'Its lotus blossom closes at night like a tiny tent.',
  abilities: ['splash', 'lotus_heal', 'bubble_shield', 'ancient_grove'],
  model: {
    arch: 'shell', shellTop: 'lotus',
    colors: { skin: '#6fc7a0', belly: '#e8f5c8', shell: '#3f9e7a', rim: '#d8eeb0', eye: '#3a2a1a', petal: '#ffb3d9', accent: '#2f7a5c', cheek: '#ffa8c8' },
    body: { r: 0.4, h: 0.3 },
    head: { size: 0.21 },
    face: { eyes: 'round', mouth: 'smile', cheeks: true },
  },
});
mon({
  id: 'frostfin', name: 'Frostfin', elements: ['ice', 'water'], rarity: 'uncommon', role: 'brawler',
  desc: 'A baby narwhal that swims through the sky on cold winds.',
  abilities: ['splash', 'horn_spear', 'whirlpool', 'absolute_zero'],
  model: {
    arch: 'whale',
    colors: { skin: '#7fb0e0', belly: '#f0f8ff', accent: '#bfe8ff', eye: '#1a2a4a', glow: '#dff6ff', horn: '#f4fbff' },
    body: { r: 0.3, len: 0.62, float: 0.35 },
    face: { eyes: 'round', mouth: 'smile', cheeks: true },
    horns: { style: 'unicorn', size: 0.7, count: 1, pitch: 0.25, yaw: 0, color: 'horn', splay: 0 },
    pattern: { type: 'spots', color: '#5a8ac0', scale: 10, amount: 0.6 },
  },
});
mon({
  id: 'cinderbolt', name: 'Cinderbolt', elements: ['fire', 'electric'], rarity: 'uncommon', role: 'striker',
  desc: 'A mischievous imp that sets off fireworks for fun.',
  abilities: ['ember_swipe', 'volt_hair', 'chain_spark', 'inferno'],
  model: {
    arch: 'biped',
    colors: { skin: '#ff7a3a', belly: '#ffd98a', accent: '#ffe45a', eye: '#2a1a4a', glow: '#ffcf3a', limb: '#e86a2a', horn: '#3a2a3a', inner: '#ffe45a', mouth: '#4a1a1a' },
    body: { r: 0.24, h: 0.38, armLen: 0.2, legLen: 0.12, claws: true },
    head: { size: 0.36 },
    face: { eyes: 'fierce', mouth: 'grin', eyeSize: 0.3, brow: 'angry' },
    ears: { style: 'pointy', size: 0.5, pitch: 0.2, yaw: 1.35, tilt: 1.2 },
    horns: { style: 'spike', size: 0.35, curl: 0.8 },
    hair: 'flame',
    tail: { style: 'bolt', len: 0.4, r: 0.04, accent: 'accent' },
  },
});
mon({
  id: 'duskmoth', name: 'Duskmoth', elements: ['dark', 'nature'], rarity: 'uncommon', role: 'caster',
  desc: 'The eyes on its wings blink when nobody is watching.',
  abilities: ['shadow_claw', 'dust_wing', 'entangle', 'eclipse'],
  model: {
    arch: 'insect',
    colors: { skin: '#5a4a7a', shell: '#6a5a9a', accent: '#ffd98a', accent2: '#3a2a5a', eye: '#ff6ad8', glow: '#ffd98a', limb: '#3a2a4a', membrane: '#7a5ab0' },
    body: { r: 0.22 },
    head: { size: 0.19 },
    face: { eyes: 'compound' },
    wings: { style: 'insect', size: 0.85, color: 'membrane', accent: 'accent' },
    back: null,
    shellStripes: true,
  },
});
mon({
  id: 'prismane', name: 'Prismane', elements: ['light', 'magic'], rarity: 'uncommon', role: 'support',
  desc: 'Its crystal horn splits sunlight into seven kinds of courage.',
  abilities: ['radiant_tap', 'rainbow_horn', 'blessing', 'solar_flare'],
  model: {
    arch: 'quad',
    colors: { skin: '#fff6fb', belly: '#ffffff', snout: '#fff0f6', accent: '#ff8fd8', accent2: '#8fd8ff', eye: '#7a4fc9', glow: '#ffe27a', horn: '#bfe8ff', inner: '#ffc8e8', limb: '#ffeaf4', hoof: '#c8a8ff' },
    body: { width: 0.26, height: 0.26, length: 0.4, legLen: 0.36, legR: 0.07, paw: 'hoof', pawR: 0.08 },
    head: { size: 0.3, snout: 0.8, snoutW: 0.8 },
    face: { eyes: 'round', mouth: 'smile', eyeSize: 0.3, lash: true },
    ears: { style: 'pointy', size: 0.45 },
    horns: { style: 'unicorn', size: 0.8, count: 1, pitch: 0.95, yaw: 0, color: 'horn', splay: 0 },
    mane: { style: 'crystal', count: 7, color: 'accent' },
    tail: { style: 'fluffy', len: 0.35, r: 0.05, color: 'accent', accent: 'accent2' },
  },
});
mon({
  id: 'rivetron', name: 'Rivetron', elements: ['metal', 'electric'], rarity: 'uncommon', role: 'brawler',
  desc: 'Built itself from spare parts. Still looking for part #7.',
  abilities: ['iron_strike', 'scrap_toss', 'overcharge', 'storm_surge'],
  model: {
    arch: 'golem', fistGlow: true,
    colors: { skin: '#9aa9bd', belly: '#c8d4e2', accent: '#5f6d82', armor: '#6f7d92', fist: '#7f8da2', eye: '#39e0ff', glow: '#ffe45a', limb: '#7f8da2' },
    body: { w: 0.34, h: 0.34, d: 0.28, fist: 0.15, legLen: 0.2 },
    head: { size: 0.24 },
    face: { eyes: 'glow', mouth: 'grin', eyeSize: 0.36 },
    ears: { style: 'bolt', size: 0.5, pitch: 1.0, yaw: 0.3, color: 'accent', inner: 'glow' },
    studs: { count: 8, color: '#c8d4e2', shape: 'rivet', size: 0.03 },
    back: { style: 'gears', count: 2, size: 0.6, color: 'accent' },
    pattern: { type: 'plates', color: '#5f6d82', scale: 5, width: 0.04 },
  },
});

// =============================== RARE =====================================
mon({
  id: 'ashhorn', name: 'Ashhorn', elements: ['fire', 'nature'], rarity: 'rare', role: 'brawler',
  desc: 'Survived a forest fire and grew a horn of living charcoal.',
  abilities: ['ember_swipe', 'charred_charge', 'regrowth', 'wildfire_bloom'],
  model: {
    arch: 'quad',
    colors: { skin: '#5a4a3a', belly: '#8a7a5a', snout: '#7a6a52', accent: '#6fae3f', eye: '#ffb52e', glow: '#ff8a2a', horn: '#2a2220', limb: '#4a3a2e', leaf: '#6fae3f', inner: '#ff9a5a' },
    body: { width: 0.36, height: 0.32, length: 0.46, legLen: 0.26, legR: 0.1, pawR: 0.11, chest: true, paw: 'hoof' },
    head: { size: 0.3, snout: 0.9, snoutW: 1.0 },
    face: { eyes: 'fierce', mouth: 'smile', eyeSize: 0.26, brow: 'angry' },
    ears: { style: 'round', size: 0.35 },
    horns: { style: 'rhino', size: 1.0, count: 1, pitch: -0.05, yaw: 0, color: 'horn', tip: 'glow', glow: 0.8 },
    back: { style: 'moss', count: 5, size: 0.55, color: 'accent' },
    tail: { style: 'flame', len: 0.3, r: 0.05 },
    pattern: { type: 'cracks', scale: 5, width: 0.04 },
  },
});
mon({
  id: 'tidebreaker', name: 'Tidebreaker', elements: ['water', 'metal'], rarity: 'rare', role: 'tank',
  desc: 'Its armored claws can crack a ship in half. It prefers clams.',
  abilities: ['splash', 'pincer_crush', 'riptide_armor', 'tsunami'],
  model: {
    arch: 'crab',
    colors: { skin: '#3a7ab8', belly: '#d8e8f8', accent: '#9aa9bd', claw: '#b8c4d4', eye: '#ffe45a', glow: '#8fd8ff' },
    body: { w: 0.42, h: 0.21, d: 0.3 },
    face: { eyes: 'fierce', mouth: 'smile' },
    back: { style: 'spikes', count: 3, size: 0.45, color: 'accent' },
    pattern: { type: 'plates', color: '#2a5a8a', scale: 6, width: 0.05 },
  },
});
mon({
  id: 'thunderhoof', name: 'Thunderhoof', elements: ['electric', 'earth'], rarity: 'rare', role: 'brawler',
  desc: 'When it stamps, distant hills hear thunder.',
  abilities: ['static_nip', 'thunder_ram', 'harden', 'storm_surge'],
  model: {
    arch: 'quad',
    colors: { skin: '#6a7a9a', belly: '#e8e2d4', snout: '#e8e2d4', accent: '#ffd23f', eye: '#ffe45a', glow: '#fff17a', horn: '#ffd23f', limb: '#5a6a88', hoof: '#3a3a4a', inner: '#ffe0a0' },
    body: { width: 0.33, height: 0.3, length: 0.44, legLen: 0.34, legR: 0.085, paw: 'hoof', pawR: 0.09, chest: true },
    head: { size: 0.28, snout: 0.8, snoutW: 0.85 },
    face: { eyes: 'fierce', mouth: 'smile', eyeSize: 0.26, brow: 'angry' },
    ears: { style: 'pointy', size: 0.35, pitch: 0.35, yaw: 1.3, tilt: 1.3 },
    horns: { style: 'ram', size: 0.55, pitch: 0.6, yaw: 0.6, color: 'horn', glow: 0.4 },
    back: { style: 'fluff', count: 5, size: 0.5, color: 'belly' },
    tail: { style: 'bolt', len: 0.3, r: 0.04, accent: 'accent' },
  },
});
mon({
  id: 'glacierback', name: 'Glacierback', elements: ['ice', 'earth'], rarity: 'rare', role: 'tank',
  desc: 'A glacier grows on its shell. It is very proud of it.',
  abilities: ['frost_bite', 'glacier_wall', 'boulder_toss', 'absolute_zero'],
  model: {
    arch: 'shell', shellTop: 'crystals', shellGlow: false,
    colors: { skin: '#8aa0b8', belly: '#dfe8f0', shell: '#6f8aa8', rim: '#c8d8e8', eye: '#1a2a4a', crystal: '#9fe6ff', accent2: '#9fe6ff', accent: '#9fe6ff' },
    body: { r: 0.44, h: 0.32 },
    head: { size: 0.22 },
    face: { eyes: 'round', mouth: 'smile', brow: 'flat' },
  },
});
mon({
  id: 'shadefang', name: 'Shadefang', elements: ['dark', 'fire'], rarity: 'rare', role: 'striker',
  desc: 'Its purple flames cast no light, only long shadows.',
  abilities: ['shadow_claw', 'hellfire_howl', 'life_drain', 'eclipse'],
  model: {
    arch: 'quad',
    colors: { skin: '#2e2440', belly: '#4a3a66', snout: '#4a3a66', accent: '#1a1428', eye: '#ff5fcf', glow: '#b86aff', inner: '#b86aff', limb: '#241c34', claw: '#e8d8ff' },
    body: { width: 0.3, height: 0.28, length: 0.46, legLen: 0.32, chest: true, paw: 'claw' },
    head: { size: 0.3, snout: 0.85, snoutW: 0.85 },
    face: { eyes: 'glow', mouth: 'fangs', eyeSize: 0.26, brow: 'angry' },
    ears: { style: 'pointy', size: 0.7, tilt: 0.1 },
    mane: { style: 'flame', count: 6 },
    tail: { style: 'flame', len: 0.55, r: 0.06 },
    pattern: { type: 'cracks', scale: 5, width: 0.035 },
  },
});
mon({
  id: 'sunpetal', name: 'Sunpetal', elements: ['light', 'nature'], rarity: 'rare', role: 'support',
  desc: 'Wherever it dances, the grass grows a little greener.',
  abilities: ['radiant_tap', 'petal_dance', 'blessing', 'ancient_grove'],
  model: {
    arch: 'biped', skirt: true,
    colors: { skin: '#fff0c8', belly: '#fffaf0', accent: '#ffd23f', eye: '#6a4a1a', petal: '#ffb3d9', leaf: '#7fd04a', flower: '#ffd23f', membrane: '#fff6b0', limb: '#ffe8b8', glow: '#ffe27a', cheek: '#ffb0c8', stem: '#6fb040' },
    body: { r: 0.2, h: 0.36, armLen: 0.2, legLen: 0.12 },
    head: { size: 0.34 },
    face: { eyes: 'round', mouth: 'smile', cheeks: true, eyeSize: 0.3, lash: true },
    ears: { style: 'leaf', size: 0.45, pitch: 0.55, yaw: 1.1, tilt: 0.7, color: 'leaf' },
    hair: 'sprout',
    halo: {},
    wings: { style: 'fairy', size: 0.55, color: 'membrane', accent: 'petal' },
  },
});
mon({
  id: 'gearhawk', name: 'Gearhawk', elements: ['metal', 'electric'], rarity: 'rare', role: 'speedster',
  desc: 'Its blade feathers were forged in a lightning storm.',
  abilities: ['iron_strike', 'arc_lightning', 'drill_pierce', 'gear_storm'],
  model: {
    arch: 'bird',
    colors: { skin: '#9aa6b8', belly: '#e0e6f0', accent: '#ffd23f', eye: '#ff5a3a', beak: '#ffb13d', glow: '#7fe8ff' },
    body: { r: 0.3 },
    head: { size: 0.26 },
    face: { eyes: 'fierce', mouth: 'beak', brow: 'angry' },
    wings: { style: 'mech', size: 0.6, color: 'skin', accent: 'accent' },
    crest: { style: 'feather', count: 3, size: 0.8, color: 'accent' },
    tail: { style: 'feather', accent: 'accent' },
    pattern: { type: 'scales', color: '#7a869a', scale: 14, width: 0.05 },
  },
});
mon({
  id: 'hexowl', name: 'Hexowl', elements: ['magic', 'dark'], rarity: 'rare', role: 'caster',
  desc: 'Reads the future in the stars, then refuses to share.',
  abilities: ['arcane_bolt', 'rune_gaze', 'curse', 'starfall'],
  model: {
    arch: 'bird',
    colors: { skin: '#5a4a8a', belly: '#c8b8e8', accent: '#ff8fe0', eye: '#ffe45a', beak: '#e8c060', glow: '#ff8fe0', inner: '#c8b8e8' },
    body: { r: 0.32, legLen: 0.12 },
    head: { size: 0.3 },
    face: { eyes: 'round', mouth: 'beak', eyeSize: 0.4 },
    ears: { style: 'feather', size: 0.4, pitch: 0.75, yaw: 0.55, color: 'skin', inner: 'accent' },
    wings: { style: 'feather', size: 0.5, color: 'skin', accent: 'accent' },
    tail: { style: 'feather', accent: 'accent' },
    pattern: { type: 'runes', color: '#ff9ae6', scale: 6, width: 0.04 },
  },
});
mon({
  id: 'coralisk', name: 'Coralisk', elements: ['water', 'nature'], rarity: 'rare', role: 'brawler',
  desc: 'A reef lizard whose coral frills change color with its mood.',
  abilities: ['splash', 'coral_spikes', 'healing_bloom', 'tsunami'],
  model: {
    arch: 'quad',
    colors: { skin: '#2fb8b0', belly: '#fff0c8', snout: '#bff0e0', accent: '#ff7a8a', accent2: '#ffb86b', eye: '#1a1a2a', inner: '#ff9ab0', limb: '#28a098', claw: '#fff0e0' },
    body: { width: 0.26, height: 0.22, length: 0.46, legLen: 0.18, legR: 0.07, paw: 'claw' },
    head: { size: 0.28, snout: 0.9, snoutW: 0.85 },
    face: { eyes: 'slit', mouth: 'smile', eyeSize: 0.3 },
    ears: { style: 'fin', size: 0.7, pitch: 0.3, yaw: 1.25, color: 'accent', inner: 'accent2' },
    back: { style: 'fins', count: 5, size: 0.8, color: 'accent' },
    tail: { style: 'fin', len: 0.7, r: 0.07, up: 0.2, accent: 'accent' },
    pattern: { type: 'spots', color: '#ffb86b', scale: 9, amount: 0.6 },
  },
});
mon({
  id: 'blizzbat', name: 'Blizzbat', elements: ['ice', 'dark'], rarity: 'rare', role: 'striker',
  desc: 'Its screech freezes puddles and interrupts naps.',
  abilities: ['frost_bite', 'frost_screech', 'life_drain', 'absolute_zero'],
  model: {
    arch: 'floater',
    colors: { skin: '#3a4a7a', belly: '#bfe8ff', accent: '#1f2a4f', eye: '#8ff0ff', glow: '#bff4ff', inner: '#8fd8ff', membrane: '#6a8ac8', mouth: '#1a0f2a' },
    body: { r: 0.28, float: 0.4, shape: 'orb' },
    face: { eyes: 'glow', mouth: 'fangs', eyeSize: 0.3 },
    ears: { style: 'bat', size: 0.75, pitch: 0.6, yaw: 0.6 },
    wings: { style: 'bat', size: 0.7, color: 'accent', membrane: 'membrane' },
    horns: { style: 'crystal', size: 0.4, count: 2, yaw: 0.25, pitch: 1.05, color: 'inner' },
    tail: { style: 'crystal', len: 0.3, r: 0.035, accent: 'inner' },
  },
});
mon({
  id: 'abyssquid', name: 'Abyssquid', elements: ['water', 'dark'], rarity: 'rare', role: 'caster',
  desc: 'Lives in the deepest clouds. Collects shiny buttons.',
  abilities: ['splash', 'ink_cloud', 'tidal_jet', 'eclipse'],
  model: {
    arch: 'kraken', glowTent: true,
    colors: { skin: '#5a3fa8', belly: '#ff9ad8', accent: '#ff9ad8', eye: '#ffe45a', glow: '#7ff0ff' },
    body: { r: 0.32, tent: 8 },
    face: { eyes: 'round', mouth: 'smile', eyeSize: 0.3 },
    pattern: { type: 'spots', color: '#8a6fe0', scale: 8, amount: 0.5 },
  },
});
mon({
  id: 'cinderwing', name: 'Cinderwing', elements: ['fire', 'light'], rarity: 'rare', role: 'support',
  desc: 'A phoenix chick that sneezes sparks when it laughs.',
  abilities: ['ember_swipe', 'phoenix_ember', 'fireball', 'rebirth_flame'],
  model: {
    arch: 'bird',
    colors: { skin: '#ff8a3a', belly: '#ffe0a0', accent: '#ffd23f', eye: '#3a1a1a', beak: '#ffd23f', glow: '#ffb32a' },
    body: { r: 0.28 },
    head: { size: 0.27 },
    face: { eyes: 'round', mouth: 'beak', cheeks: true },
    wings: { style: 'feather', size: 0.45, color: 'skin', accent: 'accent' },
    headFlames: {},
    tail: { style: 'feather', accent: 'accent' },
  },
});

// =============================== EPIC =====================================
mon({
  id: 'pyroclaw', name: 'Pyroclaw', elements: ['fire', 'metal'], rarity: 'epic', role: 'striker',
  desc: 'Forged in a volcano, polished by a thousand battles.',
  abilities: ['ember_swipe', 'molten_claw', 'heat_up', 'forge_breath'],
  model: {
    arch: 'dragon',
    colors: { skin: '#d8452a', belly: '#ffcf6a', snout: '#ffb45a', accent: '#3a2522', horn: '#2a1c1a', eye: '#ffe45a', glow: '#ffb32a', membrane: '#ff9a3a', limb: '#c23d25', claw: '#fff0d8', brow: '#a8321e' },
    horns: { size: 1.1, tip: 'glow', glow: 0.6 },
    back: { style: 'spikes', count: 7, size: 0.5, color: 'accent' },
    tail: { style: 'flame', len: 1.0, r: 0.1, spikes: 3 },
    wings: { style: 'dragon', size: 1.0, color: 'skin', membrane: 'membrane' },
    pattern: { type: 'scales', color: '#a8321e', scale: 16, width: 0.05 },
  },
});
mon({
  id: 'verdragon', name: 'Verdragon', elements: ['nature', 'light'], rarity: 'epic', role: 'support',
  desc: 'Flowers bloom in its footprints and sing at dawn.',
  abilities: ['vine_lash', 'blossom_gale', 'petal_dance', 'world_tree'],
  model: {
    arch: 'dragon',
    colors: { skin: '#5fbf4a', belly: '#f0f8c8', snout: '#e8f4c0', accent: '#ff8fb8', accent2: '#ffd23f', horn: '#9a6a3f', eye: '#6a3a1a', glow: '#ffe27a', membrane: '#8fe060', limb: '#4fa83d', leaf: '#6fd04a', brow: '#3f8a2e' },
    horns: { size: 1.0 },
    back: { style: 'leaves', count: 7, size: 0.8, color: 'leaf' },
    tail: { style: 'leaf', len: 1.0, r: 0.1, accent: 'leaf', spikes: 0 },
    wings: { style: 'leaf', size: 1.0, color: 'leaf' },
    mane: { style: 'leaf', count: 6, color: 'accent', minStage: 1 },
    halo: { minStage: 2 },
  },
});
mon({
  id: 'voltwyrm', name: 'Voltwyrm', elements: ['electric', 'magic'], rarity: 'epic', role: 'speedster',
  desc: 'Rides thunderclouds and spells its name in lightning.',
  abilities: ['static_nip', 'arc_lightning', 'mana_burst', 'mana_tempest'],
  model: {
    arch: 'serpent',
    colors: { skin: '#3a2a8a', belly: '#ffe45a', accent: '#ffe45a', accent2: '#ff8fe0', eye: '#ffffff', glow: '#fff17a', snout: '#5a4aaa', horn: '#ffe45a', membrane: '#8a6aff' },
    body: { r: 0.17, rise: 0.85, coil: 0.34 },
    head: { size: 0.27, snout: true },
    face: { eyes: 'fierce', mouth: 'fangs', brow: 'angry', eyeSize: 0.3 },
    horns: { style: 'bolt', size: 0.9, pitch: 0.55, yaw: 0.5, color: 'horn', glow: 0.6 },
    back: { style: 'fins', count: 5, size: 1.0, color: 'accent' },
    wings: { style: 'bat', size: 0.8, color: 'skin', membrane: 'membrane' },
    whiskers: true,
    tailTip: 'bolt',
    pattern: { type: 'runes', color: '#ffe45a', scale: 6, width: 0.04 },
  },
});
mon({
  id: 'frostmane', name: 'Frostmane', elements: ['ice', 'light'], rarity: 'epic', role: 'brawler',
  desc: 'Its crystal mane rings like wind chimes as it runs.',
  abilities: ['frost_bite', 'crystal_mane', 'frost_lance', 'prism_roar'],
  model: {
    arch: 'quad',
    colors: { skin: '#e8f4ff', belly: '#ffffff', snout: '#ffffff', accent: '#8fd8ff', accent2: '#ffe27a', eye: '#3b7cc9', glow: '#bff4ff', inner: '#bfe8ff', limb: '#dcecf8', claw: '#8fd8ff' },
    body: { width: 0.34, height: 0.31, length: 0.48, legLen: 0.34, chest: true, paw: 'claw' },
    head: { size: 0.31, snout: 0.7, snoutW: 0.95 },
    face: { eyes: 'fierce', mouth: 'smile', eyeSize: 0.26, brow: 'flat' },
    ears: { style: 'round', size: 0.35 },
    mane: { style: 'crystal', count: 10, color: 'accent' },
    tail: { style: 'crystal', len: 0.5, r: 0.06, accent: 'accent' },
    halo: { minStage: 2 },
  },
});
mon({
  id: 'anvilgrim', name: 'Anvilgrim', elements: ['metal', 'earth'], rarity: 'epic', role: 'tank',
  desc: 'Each knuckle is a forged anvil. It knocks politely anyway.',
  abilities: ['iron_strike', 'anvil_fist', 'iron_fortress', 'titan_hammer'],
  model: {
    arch: 'golem', fistGlow: true, knuckles: 'glow',
    colors: { skin: '#6a7688', belly: '#8a96a8', accent: '#4a5466', armor: '#556072', fist: '#3f4858', eye: '#ffb52e', glow: '#ff9a3a', limb: '#5a6678' },
    body: { w: 0.46, h: 0.44, d: 0.34, fist: 0.24, legLen: 0.2 },
    head: { size: 0.24 },
    face: { eyes: 'glow', mouth: 'none', eyeSize: 0.4 },
    horns: { style: 'spike', size: 0.5, curl: 0.2, pitch: 0.5, yaw: 0.6 },
    back: { style: 'plates', count: 4, size: 0.6, color: 'armor' },
    studs: { count: 10, color: '#c8d0dc', shape: 'rivet', size: 0.035 },
    pattern: { type: 'plates', color: '#3a4454', scale: 4, width: 0.035 },
  },
});
mon({
  id: 'arcanaga', name: 'Arcanaga', elements: ['magic', 'water'], rarity: 'epic', role: 'caster',
  desc: 'Guards a sunken library and quizzes all visitors.',
  abilities: ['arcane_bolt', 'tidal_hex', 'bubble_shield', 'mana_tempest'],
  model: {
    arch: 'serpent',
    colors: { skin: '#2fb8c8', belly: '#fff0f8', accent: '#ff5fcf', accent2: '#ffd23f', eye: '#ffffff', glow: '#ffb8f0', snout: '#5fd0dc', crown: '#ffd23f', gem: '#ff5fcf' },
    body: { r: 0.18, rise: 0.8, coil: 0.36 },
    head: { size: 0.28, snout: false },
    face: { eyes: 'round', mouth: 'smile', eyeSize: 0.34, lash: true },
    ears: { style: 'fin', size: 0.8, pitch: 0.3, yaw: 1.25, color: 'accent', inner: 'glow' },
    crown: {},
    back: { style: 'fins', count: 5, size: 1.0, color: 'accent' },
    tailTip: 'fin',
    pattern: { type: 'scales', color: '#1f8a98', scale: 18, width: 0.06 },
  },
});
mon({
  id: 'solflare', name: 'Solflare', elements: ['fire', 'light'], rarity: 'epic', role: 'support',
  desc: 'A phoenix that sings the sun awake every morning.',
  abilities: ['radiant_tap', 'phoenix_ember', 'flame_wave', 'rebirth_flame'],
  model: {
    arch: 'bird',
    colors: { skin: '#ff6a2b', belly: '#ffe08a', accent: '#ffd23f', eye: '#3a1a0a', beak: '#ffd23f', glow: '#ffb32a' },
    body: { r: 0.33, legLen: 0.18 },
    head: { size: 0.26 },
    face: { eyes: 'fierce', mouth: 'beak' },
    wings: { style: 'flame', size: 0.75 },
    crest: { style: 'flame', count: 3, size: 0.9, color: 'glow' },
    tail: { style: 'feather', accent: 'accent', size: 1.3 },
    halo: { minStage: 2 },
  },
});
mon({
  id: 'umbravolt', name: 'Umbravolt', elements: ['dark', 'electric'], rarity: 'epic', role: 'striker',
  desc: 'A shadow panther that moves between thunderclaps.',
  abilities: ['shadow_claw', 'shadow_pounce', 'thunderbolt', 'volt_eclipse'],
  model: {
    arch: 'quad',
    colors: { skin: '#241c3a', belly: '#3a2e5a', snout: '#3a2e5a', accent: '#ffe45a', eye: '#ffe45a', glow: '#fff17a', inner: '#ffe45a', limb: '#1c1630', claw: '#fff17a' },
    body: { width: 0.28, height: 0.26, length: 0.52, legLen: 0.33, legR: 0.075, paw: 'claw' },
    head: { size: 0.28, snout: 0.6, snoutW: 0.9 },
    face: { eyes: 'glow', mouth: 'fangs', eyeSize: 0.26, brow: 'angry' },
    ears: { style: 'pointy', size: 0.55, tilt: 0.2 },
    tail: { style: 'bolt', len: 0.8, r: 0.05, up: 0.3, accent: 'accent', size: 1.2 },
    back: { style: 'orbs', count: 4, size: 0.35, minStage: 1 },
    pattern: { type: 'stripes', color: '#ffe45a', scale: 10, amount: 0.86 },
  },
});

// =============================== LEGENDARY ================================
mon({
  id: 'ignarok', name: 'Ignarok', elements: ['fire', 'dark', 'metal'], rarity: 'legendary', role: 'striker', breedable: true,
  desc: 'The Obsidian King. Its crown melts any sword raised against it.',
  abilities: ['molten_claw', 'obsidian_crown', 'hellfire_howl', 'cataclysm'],
  recipe: [['pyroclaw', 'shadefang']],
  model: {
    arch: 'dragon',
    colors: { skin: '#231a22', belly: '#5a2a2a', snout: '#3a2a2e', accent: '#ff5a1f', horn: '#141014', eye: '#ffe45a', glow: '#ff6a1f', membrane: '#7a1a14', limb: '#1c141a', claw: '#ff9a3a', crown: '#ffb32a', gem: '#ff3a1a', brow: '#141014' },
    body: { width: 0.32, height: 0.31, length: 0.5 },
    horns: { size: 1.25, count: 4, tip: 'glow', glow: 0.8 },
    back: { style: 'flames', count: 7, size: 0.55 },
    tail: { style: 'flame', len: 1.1, r: 0.11, spikes: 4 },
    wings: { style: 'dragon', size: 1.12, color: 'accent', membrane: 'membrane' },
    crown: { minStage: 1 },
    pattern: { type: 'cracks', scale: 6, width: 0.04 },
  },
});
mon({
  id: 'sylvanos', name: 'Sylvanos', elements: ['nature', 'earth', 'light'], rarity: 'legendary', role: 'support',
  desc: 'An ancient stag whose antlers hold a whole forest.',
  abilities: ['vine_lash', 'antler_charge', 'epoch_bloom', 'world_tree'],
  recipe: [['verdragon', 'thornback'], ['verdragon', 'ashhorn']],
  model: {
    arch: 'quad',
    colors: { skin: '#b8864f', belly: '#f4e2c4', snout: '#f4e2c4', accent: '#6fcf4f', accent2: '#ffd23f', horn: '#7a5a3a', leaf: '#6fcf4f', eye: '#3a6a2a', glow: '#ffe27a', inner: '#e8b890', limb: '#a8764a', hoof: '#4a3a2a', flower: '#ff9ac8' },
    body: { width: 0.34, height: 0.32, length: 0.5, legLen: 0.42, legR: 0.075, paw: 'hoof', pawR: 0.085, chest: true, neck: 0.12 },
    head: { size: 0.27, snout: 0.9, snoutW: 0.8 },
    face: { eyes: 'round', mouth: 'smile', eyeSize: 0.25, lash: true },
    ears: { style: 'leaf', size: 0.45, pitch: 0.35, yaw: 1.3, tilt: 1.1, color: 'leaf' },
    horns: { style: 'wood', size: 1.2, yaw: 0.35, pitch: 0.9, color: 'horn' },
    back: { style: 'moss', count: 6, size: 0.5, color: 'accent' },
    tail: { style: 'leaf', len: 0.3, r: 0.05, accent: 'leaf' },
    halo: { minStage: 2 },
    pattern: { type: 'spots', color: '#fff4dc', scale: 9, amount: 0.62 },
  },
});
mon({
  id: 'tempestra', name: 'Tempestra', elements: ['electric', 'water', 'magic'], rarity: 'legendary', role: 'caster',
  desc: 'Queen of storms. Every thunderclap is her laughter.',
  abilities: ['static_nip', 'cyclone', 'arc_lightning', 'tempest_call'],
  recipe: [['voltwyrm', 'stormeel'], ['voltwyrm', 'arcanaga']],
  model: {
    arch: 'dragon',
    colors: { skin: '#2a5ab8', belly: '#e8f4ff', snout: '#8fc0f0', accent: '#ffe45a', accent2: '#8ff0ff', horn: '#ffe45a', eye: '#ffffff', glow: '#fff17a', membrane: '#8fd8ff', limb: '#2450a8', claw: '#fff4c2', brow: '#1f4a9a' },
    body: { width: 0.3, height: 0.29, length: 0.52 },
    horns: { size: 1.2, count: 4, glow: 0.5 },
    back: { style: 'fins', count: 7, size: 0.7, color: 'accent' },
    tail: { style: 'bolt', len: 1.1, r: 0.1, accent: 'accent', spikes: 0 },
    wings: { style: 'cloud', size: 1.0, color: 'belly' },
    face: { eyes: 'glow' },
    pattern: { type: 'runes', color: '#fff17a', scale: 5, width: 0.04 },
  },
});
mon({
  id: 'glaciax', name: 'Glaciax', elements: ['ice', 'metal'], rarity: 'legendary', role: 'tank',
  desc: 'A knight of living ice who has never lost a duel.',
  abilities: ['frost_bite', 'frost_lance', 'glacier_wall', 'glacial_judgement'],
  recipe: [['anvilgrim', 'frostmane'], ['anvilgrim', 'glacierback']],
  model: {
    arch: 'golem', knuckles: 'crystal',
    colors: { skin: '#9fc8e8', belly: '#e8f6ff', accent: '#5a8ac0', armor: '#c8d8ec', fist: '#8fd8ff', eye: '#ffffff', glow: '#bff4ff', limb: '#8ab8dc', crystal: '#bff4ff' },
    body: { w: 0.46, h: 0.46, d: 0.34, fist: 0.24, legLen: 0.22 },
    head: { size: 0.24 },
    face: { eyes: 'glow', mouth: 'none', eyeSize: 0.4 },
    horns: { style: 'crystal', size: 0.8, count: 2, yaw: 0.45, pitch: 0.75, color: 'crystal' },
    back: { style: 'crystals', count: 5, size: 0.8, color: 'crystal' },
    wings: { style: 'crystal', size: 0.8, color: 'crystal', minStage: 2 },
    pattern: { type: 'plates', color: '#5a8ac0', scale: 4, width: 0.035 },
  },
});
mon({
  id: 'noctyra', name: 'Noctyra', elements: ['dark', 'magic'], rarity: 'legendary', role: 'caster',
  desc: 'The Moth Empress. Her wings hold a sky full of stars.',
  abilities: ['arcane_bolt', 'moth_dust', 'curse', 'night_veil'],
  recipe: [['duskmoth', 'hexowl']],
  model: {
    arch: 'floater',
    colors: { skin: '#2e1f4d', belly: '#6a4a9a', accent: '#1a1030', accent2: '#ffd98a', eye: '#ffd98a', glow: '#ffd98a', membrane: '#3a2a6a', inner: '#ff8fd8', crown: '#ffd98a', gem: '#ff8fd8' },
    body: { r: 0.3, float: 0.45, shape: 'ghost', arms: true },
    face: { eyes: 'glow', mouth: 'tiny', eyeSize: 0.36 },
    ears: { style: 'feather', size: 0.7, pitch: 0.8, yaw: 0.35, color: 'accent2', inner: 'glow' },
    crown: {},
    wings: { style: 'insect', size: 1.0, color: 'membrane', accent: 'accent2' },
    orbit: { count: 5, shape: 'orb', radius: 1.8 },
    pattern: { type: 'spots', color: '#ffd98a', scale: 12, amount: 0.75 },
  },
});
mon({
  id: 'auraleon', name: 'Auraleon', elements: ['light', 'magic'], rarity: 'legendary', role: 'brawler',
  desc: 'A radiant lion whose roar turns night into morning.',
  abilities: ['radiant_tap', 'radiant_pride', 'rune_gaze', 'crown_of_suns'],
  recipe: [['frostmane', 'prismane'], ['solflare', 'prismane']],
  model: {
    arch: 'quad',
    colors: { skin: '#ffe0a0', belly: '#fff8e0', snout: '#fff8e0', accent: '#ffb32a', accent2: '#ff8fd8', eye: '#6a3a1a', glow: '#ffe27a', inner: '#ffc890', limb: '#f4d090', claw: '#fff4dc', crown: '#ffd23f', gem: '#8fd8ff' },
    body: { width: 0.36, height: 0.33, length: 0.52, legLen: 0.36, chest: true, paw: 'claw' },
    head: { size: 0.32, snout: 0.65, snoutW: 1.0 },
    face: { eyes: 'fierce', mouth: 'smile', eyeSize: 0.26, brow: 'flat' },
    ears: { style: 'round', size: 0.32 },
    mane: { style: 'flame', count: 10 },
    halo: {},
    tail: { style: 'fluffy', len: 0.6, r: 0.05, accent: 'accent' },
    wings: { style: 'angel', size: 0.7, color: 'belly', accent: 'accent', minStage: 2 },
  },
});

// =============================== MYTHIC ===================================
mon({
  id: 'voidmaw', name: 'Voidmaw', elements: ['void', 'dark'], rarity: 'mythic', role: 'striker', obtain: ['breed', 'event'],
  desc: 'Swallowed a constellation. You can still see it inside.',
  abilities: ['null_touch', 'event_horizon', 'consume', 'devour_stars'],
  recipe: [['noctyra', 'nullmite']],
  model: {
    arch: 'floater',
    colors: { skin: '#140c2a', belly: '#2a1a4a', accent: '#8a6aff', eye: '#ff5fcf', glow: '#c8b8ff', mouth: '#000000', inner: '#8a6aff', membrane: '#2a1a4a' },
    body: { r: 0.36, float: 0.4, shape: 'orb', tentacles: 5, tentLen: 0.5 },
    glowTent: true,
    face: { eyes: 'glow', mouth: 'open', eyeSize: 0.3, cyclops: true, jaw: true, mouthWidth: 0.7 },
    horns: { style: 'back', size: 0.8, count: 2, color: 'accent', glow: 0.7 },
    orbit: { count: 4, shape: 'rock', radius: 1.7, color: 'accent' },
    pattern: { type: 'spots', color: '#ffffff', scale: 14, amount: 0.8 },
  },
});
mon({
  id: 'celestwhal', name: 'Celestwhal', elements: ['celestial', 'water'], rarity: 'mythic', role: 'support', obtain: ['breed', 'event'],
  desc: 'Swims between islands and hums lullabies to the moon.',
  abilities: ['star_glint', 'whale_song', 'moonbeam', 'star_tide'],
  recipe: [['frostfin', 'stardrop']],
  model: {
    arch: 'whale',
    colors: { skin: '#3a4fa8', belly: '#dfe8ff', accent: '#8fd8ff', eye: '#1a1a3a', glow: '#ffe89a' },
    body: { r: 0.4, len: 0.85, float: 0.5 },
    face: { eyes: 'round', mouth: 'smile', cheeks: true },
    halo: {},
    back: { style: 'orbs', count: 4, size: 0.4 },
    pattern: { type: 'spots', color: '#fff6b0', scale: 10, amount: 0.72 },
  },
});
mon({
  id: 'astrowl', name: 'Astrowl', elements: ['celestial', 'magic'], rarity: 'mythic', role: 'caster', obtain: ['breed', 'event'],
  desc: 'Maps the stars at night and naps through the whole day.',
  abilities: ['star_glint', 'astral_gaze', 'constellation', 'comet_dive'],
  recipe: [['hexowl', 'stardrop']],
  model: {
    arch: 'bird',
    colors: { skin: '#2a3a8a', belly: '#c8d8ff', accent: '#ffe89a', eye: '#ffe89a', beak: '#ffe89a', glow: '#ffe89a', inner: '#8fb4ff' },
    body: { r: 0.34, legLen: 0.12 },
    head: { size: 0.32 },
    face: { eyes: 'glow', mouth: 'beak', eyeSize: 0.4 },
    ears: { style: 'feather', size: 0.5, pitch: 0.8, yaw: 0.5, color: 'accent', inner: 'glow' },
    wings: { style: 'angel', size: 0.6, color: 'skin', accent: 'accent' },
    halo: {},
    tail: { style: 'feather', accent: 'accent', size: 1.2 },
    pattern: { type: 'spots', color: '#ffffff', scale: 15, amount: 0.8 },
  },
});
mon({
  id: 'nullmite', name: 'Nullmite', elements: ['void'], rarity: 'rare', role: 'striker',
  desc: 'A tiny hole in reality that learned to scuttle.',
  abilities: ['null_touch', 'null_bite', 'consume', 'singularity'],
  model: {
    arch: 'insect',
    colors: { skin: '#1c1236', shell: '#2a1a4a', accent: '#8a6aff', accent2: '#140c2a', eye: '#ff5fcf', glow: '#c8b8ff', limb: '#140c2a', membrane: '#4a3a8a' },
    body: { r: 0.24 },
    head: { size: 0.2 },
    face: { eyes: 'glow', mouth: 'tiny', eyeSize: 0.5 },
    shell: true, shellGlow: true, antennaGlow: true,
    horns: { style: 'back', size: 0.6, count: 2, color: 'accent', glow: 0.6 },
  },
});
mon({
  id: 'stardrop', name: 'Stardrop', elements: ['celestial'], rarity: 'rare', role: 'support',
  desc: 'A jellyfish that fell from the night sky and liked it here.',
  abilities: ['star_glint', 'stellar_drop', 'moonbeam', 'supernova'],
  model: {
    arch: 'floater', glowBody: false, glowTent: true,
    colors: { skin: '#b8c8ff', belly: '#ffffff', accent: '#ffe89a', eye: '#2a2a6a', glow: '#ffe89a', cheek: '#ffc0e0' },
    body: { r: 0.3, float: 0.55, shape: 'jelly', tentacles: 6, tentLen: 0.5 },
    face: { eyes: 'round', mouth: 'smile', cheeks: true, eyeSize: 0.3 },
    crest: { style: 'spike', count: 1, size: 0.6, color: 'glow', glow: 1 },
    pattern: { type: 'spots', color: '#ffe89a', scale: 12, amount: 0.72 },
  },
});

// =============================== ANCIENT ==================================
mon({
  id: 'primordon', name: 'Primordon', elements: ['ancient', 'earth'], rarity: 'ancient', role: 'tank',
  desc: 'Older than the islands. Some say the islands are its dreams.',
  abilities: ['primal_slam', 'ruin_quake', 'primordial_shell', 'ageless_wrath'],
  recipe: [['glacierback', 'runeling'], ['magmaul', 'runeling']],
  model: {
    arch: 'shell', shellTop: 'garden', shellGlow: true,
    colors: { skin: '#6a8a6a', belly: '#d8d0a8', shell: '#8a7a5a', rim: '#c8b890', eye: '#37c9a8', glow: '#37c9a8', leaf: '#8fae3f', trunk: '#7a5a3c', flower: '#ffcf5a', accent: '#37c9a8' },
    body: { r: 0.5, h: 0.36 },
    head: { size: 0.24 },
    face: { eyes: 'glow', mouth: 'smile', brow: 'flat' },
    horns: { style: 'spike', size: 0.35, pitch: 0.8, yaw: 0.5, curl: 0.2, color: 'rim' },
  },
});
mon({
  id: 'elderwyrm', name: 'Elderwyrm', elements: ['ancient', 'nature'], rarity: 'ancient', role: 'brawler',
  desc: 'Its bark-scaled hide records every century it has lived.',
  abilities: ['primal_slam', 'fossil_crush', 'epoch_bloom', 'elder_roar'],
  recipe: [['sylvanos', 'runeling']],
  model: {
    arch: 'dragon',
    colors: { skin: '#6a5a3a', belly: '#c8b890', snout: '#a8987a', accent: '#37c9a8', horn: '#4a3a2a', eye: '#37c9a8', glow: '#6ff0d0', membrane: '#5a8a4a', limb: '#5a4a30', leaf: '#8fae3f', claw: '#e8dcc0', brow: '#4a3a2a' },
    body: { width: 0.34, height: 0.32, length: 0.54 },
    horns: { size: 1.25, count: 4, tip: 'glow', glow: 0.4 },
    back: { style: 'moss', count: 7, size: 0.7, color: 'leaf' },
    tail: { style: 'club', len: 1.1, r: 0.11, accent: 'horn' },
    wings: { style: 'leaf', size: 1.05, color: 'membrane' },
    face: { eyes: 'glow' },
    pattern: { type: 'plates', color: '#4a3a24', scale: 9, width: 0.05 },
  },
});
mon({
  id: 'runeling', name: 'Runeling', elements: ['ancient'], rarity: 'uncommon', role: 'caster',
  desc: 'A little stone spirit carved with forgotten letters.',
  abilities: ['primal_slam', 'rune_spark', 'time_warp', 'ageless_wrath'],
  model: {
    arch: 'biped',
    colors: { skin: '#b8b0a0', belly: '#d8d0c0', accent: '#37c9a8', eye: '#37c9a8', glow: '#6ff0d0', limb: '#a8a090', foot: '#8a8270' },
    body: { r: 0.26, h: 0.4, armLen: 0.16, legLen: 0.08 },
    head: { size: 0.34, sink: true },
    face: { eyes: 'glow', mouth: 'none', eyeSize: 0.3 },
    horns: { style: 'crystal', size: 0.35, count: 1, yaw: 0, pitch: 1.2, color: 'accent' },
    pattern: { type: 'runes', color: '#6ff0d0', scale: 6, width: 0.05 },
  },
});
mon({
  id: 'monolord', name: 'Monolord', elements: ['ancient', 'magic'], rarity: 'ancient', role: 'caster',
  desc: 'A walking monolith that remembers the first spell ever cast.',
  abilities: ['primal_slam', 'monolith_beam', 'time_warp', 'ageless_wrath'],
  recipe: [['glaciax', 'runeling'], ['noctyra', 'runeling']],
  model: {
    arch: 'golem', knuckles: 'glow', fistGlow: true,
    colors: { skin: '#8a8478', belly: '#a8a090', accent: '#6a6458', armor: '#5a5448', fist: '#6a6458', eye: '#6ff0d0', glow: '#6ff0d0', limb: '#7a7468' },
    body: { w: 0.48, h: 0.5, d: 0.34, fist: 0.22, legLen: 0.22 },
    head: { size: 0.26 },
    face: { eyes: 'glow', mouth: 'none', eyeSize: 0.34, cyclops: true },
    halo: {},
    back: { style: 'crystals', count: 3, size: 0.9, color: 'glow' },
    pattern: { type: 'runes', color: '#6ff0d0', scale: 4, width: 0.05 },
  },
});

// Late-element commons so every element has an entry point.
mon({
  id: 'emberling', name: 'Emberling', elements: ['fire', 'earth'], rarity: 'rare', role: 'brawler',
  desc: 'A walking campfire. Marshmallows are its love language.',
  abilities: ['ember_swipe', 'molten_claw', 'harden', 'meteor_crash'],
  model: {
    arch: 'golem', rocky: true, fistGlow: true,
    colors: { skin: '#4a3a38', belly: '#5a4442', accent: '#3a2a28', armor: '#3a2e2c', fist: '#4a3a38', eye: '#ffe45a', glow: '#ff7a1f', limb: '#433432' },
    body: { w: 0.34, h: 0.34, d: 0.28, fist: 0.17 },
    head: { size: 0.23 },
    face: { eyes: 'glow', mouth: 'grin', eyeSize: 0.34 },
    headFlames: {},
    back: { style: 'flames', count: 3, size: 0.6 },
    pattern: { type: 'cracks', scale: 5, width: 0.05 },
  },
});

export const MONSTERS = M;
export const MONSTER_BY_ID = Object.fromEntries(M.map((m) => [m.id, m]));
