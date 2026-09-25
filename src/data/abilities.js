// Ability library. Monsters reference abilities by id. Descriptions are
// generated from data so text always matches numbers.
//
// target: enemy | enemies | random (hits random enemies) | ally | allies | self
// fx: melee | bolt | beam | burst | wave | rain | buff | heal | shield | drain | slam
// effects: [{ s: statusId, ch: chance, t: turns, on: 'target' | 'self' | 'allies' | 'enemies', v?: value }]

const A = {};
function def(id, o) {
  A[id] = { id, kind: 'skill', target: 'enemy', power: 1, hits: 1, cd: 0, effects: [], fx: 'melee', ...o };
}

// ---------------- FIRE
def('ember_swipe', { name: 'Ember Swipe', el: 'fire', kind: 'basic', power: 1.0, fx: 'melee' });
def('flame_breath', { name: 'Flame Breath', el: 'fire', power: 1.3, cd: 2, fx: 'beam', effects: [{ s: 'burn', ch: 0.35, t: 2 }] });
def('heat_up', { name: 'Heat Up', el: 'fire', target: 'self', power: 0, cd: 3, fx: 'buff', effects: [{ s: 'atkUp', ch: 1, t: 2, on: 'self' }, { s: 'spdUp', ch: 1, t: 2, on: 'self' }] });
def('fireball', { name: 'Fireball', el: 'fire', power: 1.55, cd: 3, fx: 'bolt', effects: [{ s: 'burn', ch: 0.25, t: 2 }] });
def('flame_wave', { name: 'Flame Wave', el: 'fire', target: 'enemies', power: 0.8, cd: 3, fx: 'wave', effects: [{ s: 'burn', ch: 0.25, t: 2 }] });
def('inferno', { name: 'Inferno', el: 'fire', kind: 'ult', target: 'enemies', power: 1.55, fx: 'burst', effects: [{ s: 'burn', ch: 0.6, t: 3 }] });
def('meteor_crash', { name: 'Meteor Crash', el: 'fire', kind: 'ult', power: 3.0, fx: 'rain', effects: [{ s: 'stun', ch: 0.4, t: 1 }] });
// ---------------- NATURE
def('vine_lash', { name: 'Vine Lash', el: 'nature', kind: 'basic', power: 1.0, fx: 'melee' });
def('thorn_barrage', { name: 'Thorn Barrage', el: 'nature', target: 'random', hits: 3, power: 0.55, cd: 2, fx: 'bolt', effects: [{ s: 'poison', ch: 0.25, t: 3 }] });
def('healing_bloom', { name: 'Healing Bloom', el: 'nature', target: 'ally', power: 0, heal: 0.3, cd: 3, fx: 'heal' });
def('regrowth', { name: 'Regrowth', el: 'nature', target: 'allies', power: 0, cd: 4, fx: 'heal', effects: [{ s: 'regen', ch: 1, t: 3, on: 'allies' }] });
def('entangle', { name: 'Entangle', el: 'nature', power: 0.95, cd: 2, fx: 'bolt', effects: [{ s: 'spdDown', ch: 0.8, t: 2 }] });
def('verdant_storm', { name: 'Verdant Storm', el: 'nature', kind: 'ult', target: 'enemies', power: 1.4, fx: 'burst', effects: [{ s: 'regen', ch: 1, t: 2, on: 'allies' }] });
def('ancient_grove', { name: 'Ancient Grove', el: 'nature', kind: 'ult', target: 'allies', power: 0, heal: 0.4, cleanse: true, fx: 'heal' });
// ---------------- WATER
def('splash', { name: 'Splash', el: 'water', kind: 'basic', power: 1.0, fx: 'bolt' });
def('tidal_jet', { name: 'Tidal Jet', el: 'water', power: 1.4, cd: 2, fx: 'beam', effects: [{ s: 'defDown', ch: 0.35, t: 2 }] });
def('bubble_shield', { name: 'Bubble Shield', el: 'water', target: 'ally', power: 0, shield: 0.25, cd: 3, fx: 'shield' });
def('soothing_rain', { name: 'Soothing Rain', el: 'water', target: 'allies', power: 0, heal: 0.16, cd: 3, fx: 'heal' });
def('whirlpool', { name: 'Whirlpool', el: 'water', target: 'enemies', power: 0.9, cd: 3, fx: 'wave', effects: [{ s: 'spdDown', ch: 0.35, t: 2 }] });
def('tsunami', { name: 'Tsunami', el: 'water', kind: 'ult', target: 'enemies', power: 1.65, fx: 'wave', effects: [{ s: 'defDown', ch: 0.5, t: 2 }] });
// ---------------- EARTH
def('rock_punch', { name: 'Rock Punch', el: 'earth', kind: 'basic', power: 1.0, fx: 'melee' });
def('stone_shield', { name: 'Stone Shield', el: 'earth', target: 'self', power: 0, shield: 0.35, cd: 3, fx: 'shield', effects: [{ s: 'taunt', ch: 1, t: 2, on: 'self' }] });
def('boulder_toss', { name: 'Boulder Toss', el: 'earth', power: 1.5, cd: 3, fx: 'bolt', effects: [{ s: 'stun', ch: 0.2, t: 1 }] });
def('quake', { name: 'Quake', el: 'earth', target: 'enemies', power: 0.9, cd: 3, fx: 'slam' });
def('harden', { name: 'Harden', el: 'earth', target: 'self', power: 0, cd: 3, fx: 'buff', heal: 0.12, effects: [{ s: 'defUp', ch: 1, t: 3, on: 'self' }] });
def('tectonic_slam', { name: 'Tectonic Slam', el: 'earth', kind: 'ult', target: 'enemies', power: 1.5, fx: 'slam', effects: [{ s: 'stun', ch: 0.35, t: 1 }] });
// ---------------- ELECTRIC
def('static_nip', { name: 'Static Nip', el: 'electric', kind: 'basic', power: 1.0, fx: 'melee' });
def('thunderbolt', { name: 'Thunderbolt', el: 'electric', power: 1.4, cd: 2, fx: 'beam', effects: [{ s: 'stun', ch: 0.2, t: 1 }] });
def('chain_spark', { name: 'Chain Spark', el: 'electric', target: 'random', hits: 3, power: 0.6, cd: 2, fx: 'bolt' });
def('overcharge', { name: 'Overcharge', el: 'electric', target: 'allies', power: 0, cd: 3, fx: 'buff', effects: [{ s: 'spdUp', ch: 1, t: 2, on: 'allies' }] });
def('storm_surge', { name: 'Storm Surge', el: 'electric', kind: 'ult', target: 'enemies', power: 1.5, fx: 'rain', effects: [{ s: 'stun', ch: 0.25, t: 1 }] });
// ---------------- ICE
def('frost_bite', { name: 'Frost Bite', el: 'ice', kind: 'basic', power: 1.0, fx: 'melee' });
def('ice_shard', { name: 'Ice Shard', el: 'ice', power: 1.3, cd: 2, fx: 'bolt', effects: [{ s: 'freeze', ch: 0.25, t: 1 }] });
def('frozen_armor', { name: 'Frozen Armor', el: 'ice', target: 'self', power: 0, shield: 0.2, cd: 3, fx: 'shield', effects: [{ s: 'defUp', ch: 1, t: 2, on: 'self' }] });
def('blizzard', { name: 'Blizzard', el: 'ice', target: 'enemies', power: 0.8, cd: 3, fx: 'rain', effects: [{ s: 'spdDown', ch: 0.45, t: 2 }] });
def('absolute_zero', { name: 'Absolute Zero', el: 'ice', kind: 'ult', target: 'enemies', power: 1.4, fx: 'burst', effects: [{ s: 'freeze', ch: 0.4, t: 1 }] });
// ---------------- DARK
def('shadow_claw', { name: 'Shadow Claw', el: 'dark', kind: 'basic', power: 1.0, fx: 'melee' });
def('nightmare', { name: 'Nightmare', el: 'dark', power: 1.2, cd: 2, fx: 'bolt', effects: [{ s: 'atkDown', ch: 0.5, t: 2 }] });
def('life_drain', { name: 'Life Drain', el: 'dark', power: 1.35, lifesteal: 0.5, cd: 3, fx: 'drain' });
def('curse', { name: 'Curse', el: 'dark', power: 0.7, cd: 3, fx: 'bolt', effects: [{ s: 'defDown', ch: 0.8, t: 2 }, { s: 'poison', ch: 0.6, t: 3 }] });
def('eclipse', { name: 'Eclipse', el: 'dark', kind: 'ult', target: 'enemies', power: 1.6, fx: 'burst', effects: [{ s: 'atkDown', ch: 0.5, t: 2 }] });
// ---------------- LIGHT
def('radiant_tap', { name: 'Radiant Tap', el: 'light', kind: 'basic', power: 1.0, fx: 'bolt' });
def('holy_beam', { name: 'Holy Beam', el: 'light', power: 1.4, cd: 2, cleanseSelf: true, fx: 'beam' });
def('blessing', { name: 'Blessing', el: 'light', target: 'ally', power: 0, cd: 3, fx: 'buff', effects: [{ s: 'atkUp', ch: 1, t: 2 }, { s: 'regen', ch: 1, t: 2 }] });
def('sanctuary', { name: 'Sanctuary', el: 'light', target: 'allies', power: 0, shield: 0.16, cd: 4, fx: 'shield' });
def('solar_flare', { name: 'Solar Flare', el: 'light', kind: 'ult', target: 'enemies', power: 1.5, healAllies: 0.2, fx: 'burst' });
// ---------------- METAL
def('iron_strike', { name: 'Iron Strike', el: 'metal', kind: 'basic', power: 1.0, fx: 'melee' });
def('drill_pierce', { name: 'Drill Pierce', el: 'metal', power: 1.4, pierce: 0.5, cd: 2, fx: 'melee' });
def('plate_armor', { name: 'Plate Armor', el: 'metal', target: 'allies', power: 0, cd: 3, fx: 'buff', effects: [{ s: 'defUp', ch: 1, t: 2, on: 'allies' }] });
def('shrapnel', { name: 'Shrapnel', el: 'metal', target: 'enemies', power: 0.8, cd: 3, fx: 'burst', effects: [{ s: 'bleed', ch: 0.4, t: 2 }] });
def('titan_hammer', { name: 'Titan Hammer', el: 'metal', kind: 'ult', power: 3.1, fx: 'slam', effects: [{ s: 'defDown', ch: 0.7, t: 2 }] });
// ---------------- MAGIC
def('arcane_bolt', { name: 'Arcane Bolt', el: 'magic', kind: 'basic', power: 1.0, fx: 'bolt' });
def('mana_burst', { name: 'Mana Burst', el: 'magic', target: 'enemies', power: 0.9, cd: 2, fx: 'burst' });
def('hex', { name: 'Hex', el: 'magic', power: 1.1, cd: 2, fx: 'bolt', effects: [{ s: 'random_debuff', ch: 0.8, t: 2 }] });
def('arcane_ward', { name: 'Arcane Ward', el: 'magic', target: 'self', power: 0, shield: 0.2, cd: 3, fx: 'shield', effects: [{ s: 'atkUp', ch: 1, t: 2, on: 'self' }] });
def('starfall', { name: 'Starfall', el: 'magic', kind: 'ult', target: 'random', hits: 5, power: 0.72, fx: 'rain' });
// ---------------- ANCIENT
def('primal_slam', { name: 'Primal Slam', el: 'ancient', kind: 'basic', power: 1.05, fx: 'slam' });
def('time_warp', { name: 'Time Warp', el: 'ancient', target: 'enemies', power: 0.6, cd: 3, fx: 'wave', effects: [{ s: 'spdDown', ch: 0.7, t: 2 }, { s: 'spdUp', ch: 1, t: 2, on: 'allies' }] });
def('fossil_crush', { name: 'Fossil Crush', el: 'ancient', power: 1.8, cd: 3, fx: 'slam', effects: [{ s: 'defDown', ch: 0.5, t: 2 }] });
def('ageless_wrath', { name: 'Ageless Wrath', el: 'ancient', kind: 'ult', target: 'enemies', power: 1.9, fx: 'burst', effects: [{ s: 'defDown', ch: 0.6, t: 2 }] });
// ---------------- VOID
def('null_touch', { name: 'Null Touch', el: 'void', kind: 'basic', power: 1.05, fx: 'melee' });
def('void_rift', { name: 'Void Rift', el: 'void', power: 1.5, dispel: true, ignoreShield: true, cd: 2, fx: 'beam' });
def('consume', { name: 'Consume', el: 'void', power: 1.1, lifesteal: 1.0, cd: 3, fx: 'drain' });
def('singularity', { name: 'Singularity', el: 'void', kind: 'ult', target: 'enemies', power: 2.0, fx: 'burst', effects: [{ s: 'stun', ch: 0.3, t: 1 }] });
// ---------------- CELESTIAL
def('star_glint', { name: 'Star Glint', el: 'celestial', kind: 'basic', power: 1.05, fx: 'bolt' });
def('moonbeam', { name: 'Moonbeam', el: 'celestial', power: 1.5, cd: 2, selfHeal: 0.2, fx: 'beam' });
def('constellation', { name: 'Constellation', el: 'celestial', target: 'allies', power: 0, cd: 4, fx: 'buff', effects: [{ s: 'atkUp', ch: 1, t: 2, on: 'allies' }, { s: 'spdUp', ch: 1, t: 2, on: 'allies' }] });
def('supernova', { name: 'Supernova', el: 'celestial', kind: 'ult', target: 'enemies', power: 2.1, fx: 'burst', effects: [{ s: 'burn', ch: 0.5, t: 2 }] });

// ---------------- UNIQUE (rare and above)
def('charred_charge', { name: 'Charred Charge', el: 'fire', power: 1.6, cd: 2, fx: 'melee', effects: [{ s: 'burn', ch: 0.5, t: 2 }, { s: 'spdUp', ch: 1, t: 2, on: 'self' }] });
def('wildfire_bloom', { name: 'Wildfire Bloom', el: 'nature', kind: 'ult', target: 'enemies', power: 1.5, fx: 'burst', effects: [{ s: 'burn', ch: 0.5, t: 2 }, { s: 'poison', ch: 0.5, t: 3 }] });
def('pincer_crush', { name: 'Pincer Crush', el: 'metal', power: 1.45, pierce: 0.35, cd: 2, fx: 'melee', effects: [{ s: 'bleed', ch: 0.5, t: 2 }] });
def('riptide_armor', { name: 'Riptide Armor', el: 'water', target: 'self', power: 0, shield: 0.3, cd: 3, fx: 'shield', effects: [{ s: 'taunt', ch: 1, t: 2, on: 'self' }, { s: 'regen', ch: 1, t: 2, on: 'self' }] });
def('thunder_ram', { name: 'Thunder Ram', el: 'electric', power: 1.6, cd: 2, fx: 'melee', effects: [{ s: 'stun', ch: 0.35, t: 1 }] });
def('landslide', { name: 'Landslide', el: 'earth', kind: 'ult', target: 'enemies', power: 1.6, fx: 'slam', effects: [{ s: 'spdDown', ch: 0.6, t: 2 }] });
def('glacier_wall', { name: 'Glacier Wall', el: 'ice', target: 'allies', power: 0, shield: 0.18, cd: 4, fx: 'shield', effects: [{ s: 'defUp', ch: 1, t: 2, on: 'allies' }] });
def('hellfire_howl', { name: 'Hellfire Howl', el: 'dark', target: 'enemies', power: 0.85, cd: 3, fx: 'wave', effects: [{ s: 'atkDown', ch: 0.5, t: 2 }, { s: 'burn', ch: 0.4, t: 2 }] });
def('petal_dance', { name: 'Petal Dance', el: 'light', target: 'allies', power: 0, heal: 0.18, cleanse: true, cd: 3, fx: 'heal' });
def('gear_storm', { name: 'Gear Storm', el: 'metal', kind: 'ult', target: 'random', hits: 4, power: 0.85, fx: 'rain', effects: [{ s: 'bleed', ch: 0.35, t: 2 }] });
def('rune_gaze', { name: 'Rune Gaze', el: 'magic', power: 1.3, cd: 2, fx: 'beam', effects: [{ s: 'stun', ch: 0.25, t: 1 }, { s: 'defDown', ch: 0.4, t: 2 }] });
def('coral_spikes', { name: 'Coral Spikes', el: 'nature', target: 'enemies', power: 0.75, cd: 3, fx: 'wave', effects: [{ s: 'bleed', ch: 0.4, t: 2 }] });
def('frost_screech', { name: 'Frost Screech', el: 'ice', target: 'enemies', power: 0.7, cd: 3, fx: 'wave', effects: [{ s: 'atkDown', ch: 0.45, t: 2 }, { s: 'freeze', ch: 0.15, t: 1 }] });
def('ink_cloud', { name: 'Ink Cloud', el: 'dark', target: 'enemies', power: 0.6, cd: 3, fx: 'burst', effects: [{ s: 'atkDown', ch: 0.6, t: 2 }, { s: 'spdDown', ch: 0.4, t: 2 }] });
def('phoenix_ember', { name: 'Phoenix Ember', el: 'light', target: 'ally', power: 0, heal: 0.25, cd: 3, fx: 'heal', effects: [{ s: 'atkUp', ch: 1, t: 2 }] });
def('molten_claw', { name: 'Molten Claw', el: 'fire', power: 1.5, pierce: 0.3, cd: 2, fx: 'melee', effects: [{ s: 'burn', ch: 0.5, t: 3 }] });
def('forge_breath', { name: 'Forge Breath', el: 'metal', kind: 'ult', target: 'enemies', power: 1.75, fx: 'beam', effects: [{ s: 'burn', ch: 0.5, t: 2 }, { s: 'defDown', ch: 0.4, t: 2 }] });
def('blossom_gale', { name: 'Blossom Gale', el: 'nature', target: 'enemies', power: 0.9, cd: 3, fx: 'wave', effects: [{ s: 'regen', ch: 1, t: 2, on: 'allies' }] });
def('sunlit_roar', { name: 'Sunlit Roar', el: 'light', kind: 'ult', target: 'enemies', power: 1.6, healAllies: 0.25, cleanseAllies: true, fx: 'burst' });
def('arc_lightning', { name: 'Arc Lightning', el: 'electric', target: 'random', hits: 4, power: 0.6, cd: 2, fx: 'bolt', effects: [{ s: 'stun', ch: 0.12, t: 1 }] });
def('mana_tempest', { name: 'Mana Tempest', el: 'magic', kind: 'ult', target: 'enemies', power: 1.7, fx: 'rain', effects: [{ s: 'random_debuff', ch: 0.6, t: 2 }] });
def('crystal_mane', { name: 'Crystal Mane', el: 'ice', target: 'self', power: 0, shield: 0.25, cd: 3, fx: 'shield', effects: [{ s: 'atkUp', ch: 1, t: 2, on: 'self' }] });
def('prism_roar', { name: 'Prism Roar', el: 'light', kind: 'ult', target: 'enemies', power: 1.6, fx: 'wave', effects: [{ s: 'freeze', ch: 0.3, t: 1 }] });
def('anvil_fist', { name: 'Anvil Fist', el: 'metal', power: 1.7, cd: 2, fx: 'slam', effects: [{ s: 'stun', ch: 0.3, t: 1 }] });
def('iron_fortress', { name: 'Iron Fortress', el: 'earth', target: 'allies', power: 0, shield: 0.22, cd: 4, fx: 'shield', effects: [{ s: 'taunt', ch: 1, t: 2, on: 'self' }] });
def('tidal_hex', { name: 'Tidal Hex', el: 'magic', power: 1.35, cd: 2, fx: 'wave', effects: [{ s: 'defDown', ch: 0.5, t: 2 }, { s: 'spdDown', ch: 0.3, t: 2 }] });
def('rebirth_flame', { name: 'Rebirth Flame', el: 'fire', kind: 'ult', target: 'allies', power: 0, heal: 0.35, fx: 'heal', effects: [{ s: 'atkUp', ch: 1, t: 2, on: 'allies' }] });
def('shadow_pounce', { name: 'Shadow Pounce', el: 'dark', power: 1.55, execute: 0.5, cd: 2, fx: 'melee' });
def('volt_eclipse', { name: 'Volt Eclipse', el: 'electric', kind: 'ult', power: 3.2, fx: 'beam', effects: [{ s: 'stun', ch: 0.45, t: 1 }] });
def('obsidian_crown', { name: 'Obsidian Crown', el: 'dark', target: 'self', power: 0, cd: 3, fx: 'buff', effects: [{ s: 'atkUp', ch: 1, t: 3, on: 'self' }, { s: 'defUp', ch: 1, t: 3, on: 'self' }] });
def('cataclysm', { name: 'Cataclysm', el: 'fire', kind: 'ult', target: 'enemies', power: 2.0, fx: 'rain', effects: [{ s: 'burn', ch: 0.7, t: 3 }, { s: 'defDown', ch: 0.5, t: 2 }] });
def('antler_charge', { name: 'Antler Charge', el: 'earth', power: 1.6, cd: 2, fx: 'melee', effects: [{ s: 'stun', ch: 0.3, t: 1 }] });
def('world_tree', { name: 'World Tree', el: 'nature', kind: 'ult', target: 'allies', power: 0, heal: 0.45, cleanse: true, fx: 'heal', effects: [{ s: 'defUp', ch: 1, t: 2, on: 'allies' }] });
def('cyclone', { name: 'Cyclone', el: 'water', target: 'enemies', power: 1.0, cd: 3, fx: 'wave', effects: [{ s: 'spdDown', ch: 0.5, t: 2 }] });
def('tempest_call', { name: 'Tempest Call', el: 'electric', kind: 'ult', target: 'enemies', power: 1.9, fx: 'rain', effects: [{ s: 'stun', ch: 0.35, t: 1 }, { s: 'defDown', ch: 0.4, t: 2 }] });
def('frost_lance', { name: 'Frost Lance', el: 'ice', power: 1.65, pierce: 0.4, cd: 2, fx: 'beam', effects: [{ s: 'freeze', ch: 0.3, t: 1 }] });
def('glacial_judgement', { name: 'Glacial Judgement', el: 'metal', kind: 'ult', power: 3.3, fx: 'slam', effects: [{ s: 'freeze', ch: 0.6, t: 1 }] });
def('moth_dust', { name: 'Moth Dust', el: 'magic', target: 'enemies', power: 0.7, cd: 2, fx: 'rain', effects: [{ s: 'poison', ch: 0.5, t: 3 }, { s: 'atkDown', ch: 0.3, t: 2 }] });
def('night_veil', { name: 'Night Veil', el: 'dark', kind: 'ult', target: 'enemies', power: 1.8, lifesteal: 0.3, fx: 'burst', effects: [{ s: 'stun', ch: 0.3, t: 1 }] });
def('radiant_pride', { name: 'Radiant Pride', el: 'light', target: 'allies', power: 0, cd: 4, fx: 'buff', effects: [{ s: 'atkUp', ch: 1, t: 2, on: 'allies' }, { s: 'regen', ch: 1, t: 2, on: 'allies' }] });
def('crown_of_suns', { name: 'Crown of Suns', el: 'magic', kind: 'ult', target: 'enemies', power: 2.0, healAllies: 0.2, fx: 'burst' });
def('event_horizon', { name: 'Event Horizon', el: 'void', target: 'enemies', power: 0.9, dispel: true, cd: 3, fx: 'burst' });
def('devour_stars', { name: 'Devour Stars', el: 'dark', kind: 'ult', power: 3.4, lifesteal: 0.6, fx: 'drain' });
def('whale_song', { name: 'Whale Song', el: 'celestial', target: 'allies', power: 0, heal: 0.25, cleanse: true, cd: 3, fx: 'heal' });
def('star_tide', { name: 'Star Tide', el: 'water', kind: 'ult', target: 'enemies', power: 2.0, healAllies: 0.2, fx: 'wave' });
def('astral_gaze', { name: 'Astral Gaze', el: 'celestial', power: 1.4, cd: 2, fx: 'beam', effects: [{ s: 'stun', ch: 0.3, t: 1 }] });
def('comet_dive', { name: 'Comet Dive', el: 'magic', kind: 'ult', power: 3.3, fx: 'rain', effects: [{ s: 'burn', ch: 0.5, t: 2 }] });
def('ruin_quake', { name: 'Ruin Quake', el: 'earth', target: 'enemies', power: 1.0, cd: 3, fx: 'slam', effects: [{ s: 'stun', ch: 0.25, t: 1 }] });
def('primordial_shell', { name: 'Primordial Shell', el: 'ancient', target: 'allies', power: 0, shield: 0.28, cd: 4, fx: 'shield', effects: [{ s: 'taunt', ch: 1, t: 2, on: 'self' }] });
def('epoch_bloom', { name: 'Epoch Bloom', el: 'nature', target: 'allies', power: 0, heal: 0.22, cd: 3, fx: 'heal', effects: [{ s: 'atkUp', ch: 1, t: 2, on: 'allies' }] });
def('elder_roar', { name: 'Elder Roar', el: 'ancient', kind: 'ult', target: 'enemies', power: 2.2, fx: 'wave', effects: [{ s: 'atkDown', ch: 0.6, t: 2 }, { s: 'spdDown', ch: 0.4, t: 2 }] });
def('monolith_beam', { name: 'Monolith Beam', el: 'magic', power: 1.6, cd: 2, fx: 'beam', effects: [{ s: 'defDown', ch: 0.5, t: 2 }] });
def('stellar_drop', { name: 'Stellar Drop', el: 'celestial', target: 'ally', power: 0, heal: 0.3, cd: 3, fx: 'heal', effects: [{ s: 'shield', ch: 1, t: 2, v: 0.12 }] });
def('rune_spark', { name: 'Rune Spark', el: 'ancient', power: 1.3, cd: 2, fx: 'bolt', effects: [{ s: 'spdDown', ch: 0.4, t: 2 }] });
def('null_bite', { name: 'Null Bite', el: 'void', power: 1.4, dispel: true, cd: 2, fx: 'melee' });
def('snow_burrow', { name: 'Snow Burrow', el: 'ice', target: 'self', power: 0, heal: 0.2, cd: 3, fx: 'buff', effects: [{ s: 'defUp', ch: 1, t: 2, on: 'self' }] });
def('glimmer', { name: 'Glimmer', el: 'light', target: 'ally', power: 0, heal: 0.22, cd: 3, fx: 'heal' });
def('scrap_toss', { name: 'Scrap Toss', el: 'metal', power: 1.35, cd: 2, fx: 'bolt', effects: [{ s: 'bleed', ch: 0.35, t: 2 }] });
def('spook', { name: 'Spook', el: 'dark', power: 1.15, cd: 2, fx: 'bolt', effects: [{ s: 'atkDown', ch: 0.45, t: 2 }] });
def('steam_vent', { name: 'Steam Vent', el: 'water', target: 'enemies', power: 0.8, cd: 3, fx: 'burst', effects: [{ s: 'burn', ch: 0.3, t: 2 }] });
def('mud_bomb', { name: 'Mud Bomb', el: 'earth', power: 1.25, cd: 2, fx: 'bolt', effects: [{ s: 'spdDown', ch: 0.6, t: 2 }] });
def('quill_volley', { name: 'Quill Volley', el: 'nature', target: 'random', hits: 4, power: 0.5, cd: 2, fx: 'bolt', effects: [{ s: 'bleed', ch: 0.2, t: 2 }] });
def('lotus_heal', { name: 'Lotus Heal', el: 'water', target: 'allies', power: 0, heal: 0.15, cd: 3, fx: 'heal', effects: [{ s: 'regen', ch: 1, t: 2, on: 'allies' }] });
def('horn_spear', { name: 'Horn Spear', el: 'ice', power: 1.5, pierce: 0.3, cd: 2, fx: 'melee', effects: [{ s: 'freeze', ch: 0.2, t: 1 }] });
def('volt_hair', { name: 'Volt Flare', el: 'electric', power: 1.35, cd: 2, fx: 'bolt', effects: [{ s: 'burn', ch: 0.3, t: 2 }] });
def('dust_wing', { name: 'Dust Wing', el: 'dark', target: 'enemies', power: 0.7, cd: 3, fx: 'rain', effects: [{ s: 'poison', ch: 0.45, t: 3 }] });
def('rainbow_horn', { name: 'Rainbow Horn', el: 'magic', target: 'allies', power: 0, heal: 0.18, cd: 3, fx: 'heal', effects: [{ s: 'spdUp', ch: 1, t: 2, on: 'allies' }] });
def('bolt_rivet', { name: 'Bolt Rivet', el: 'metal', power: 1.3, cd: 2, fx: 'bolt', effects: [{ s: 'stun', ch: 0.2, t: 1 }] });

// Boss-only
def('boss_quake', { name: 'Titan Quake', el: 'earth', target: 'enemies', power: 1.1, cd: 3, fx: 'slam', effects: [{ s: 'stun', ch: 0.25, t: 1 }] });
def('boss_rage', { name: 'Primal Rage', el: 'neutral', target: 'self', power: 0, cd: 4, fx: 'buff', effects: [{ s: 'atkUp', ch: 1, t: 3, on: 'self' }, { s: 'rage', ch: 1, t: 9, on: 'self' }] });
def('boss_summon', { name: 'Call Minions', el: 'neutral', target: 'self', power: 0, cd: 5, fx: 'buff', summon: true });
def('boss_shield', { name: 'Ancient Barrier', el: 'neutral', target: 'self', power: 0, shield: 0.25, cd: 4, fx: 'shield' });

export const ABILITIES = A;

// Short, number-driven description.
export function describeAbility(ab, statusNames = {}) {
  const parts = [];
  const tgt = { enemy: '', enemies: ' to all enemies', random: ` ×${ab.hits} random`, ally: '', allies: ' to all allies', self: '' }[ab.target] || '';
  if (ab.power > 0) parts.push(`${Math.round(ab.power * 100)}% dmg${ab.hits > 1 && ab.target !== 'random' ? ' ×' + ab.hits : ''}${tgt}`);
  if (ab.heal) parts.push(`Heal ${Math.round(ab.heal * 100)}%${ab.target === 'allies' ? ' all' : ''}`);
  if (ab.healAllies) parts.push(`Heal allies ${Math.round(ab.healAllies * 100)}%`);
  if (ab.shield) parts.push(`Shield ${Math.round(ab.shield * 100)}%${ab.target === 'allies' ? ' all' : ''}`);
  if (ab.lifesteal) parts.push(`Drain ${Math.round(ab.lifesteal * 100)}%`);
  if (ab.pierce) parts.push(`Ignores ${Math.round(ab.pierce * 100)}% DEF`);
  if (ab.execute) parts.push('Bonus vs weakened');
  if (ab.cleanse || ab.cleanseAllies || ab.cleanseSelf) parts.push('Cleanse');
  if (ab.dispel) parts.push('Removes buffs');
  if (ab.summon) parts.push('Summons minions');
  for (const e of ab.effects || []) {
    const n = e.s === 'random_debuff' ? 'Random debuff' : statusNames[e.s] || e.s;
    const who = e.on === 'self' ? ' (self)' : e.on === 'allies' ? ' (allies)' : '';
    parts.push(`${e.ch < 1 ? Math.round(e.ch * 100) + '% ' : ''}${n}${who}`);
  }
  return parts.join(' · ');
}
