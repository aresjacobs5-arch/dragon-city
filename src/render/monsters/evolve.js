import * as THREE from 'three';
import { ELEMENTS } from '../../data/elements.js';

// Evolved looks. A species definition describes its baby form; this derives
// its level 7 and level 15 forms from it: richer colours, grown horns, new
// back crests and tails themed on the element, and at the final form wings,
// a mane, crest or halo, and a fiercer face. Per-species overrides in
// EVO_TWEAKS adjust the result where the generic rules don't suit a body.

const HORN = { fire: 'curl', nature: 'wood', water: 'back', earth: 'rhino', electric: 'bolt', ice: 'crystal', light: 'unicorn', dark: 'curl', metal: 'spike', magic: 'crystal', ancient: 'antler', void: 'back', celestial: 'unicorn' };
const BACK = { fire: 'flames', nature: 'leaves', water: 'fins', earth: 'rocks', electric: 'spikes', ice: 'crystals', light: 'orbs', dark: 'spikes', metal: 'plates', magic: 'crystals', ancient: 'moss', void: 'orbs', celestial: 'orbs' };
const TAIL = { fire: 'flame', nature: 'leaf', water: 'fin', earth: 'club', electric: 'bolt', ice: 'crystal', light: 'fluffy', dark: 'spike', metal: 'spike', magic: 'wisp', ancient: 'club', void: 'wisp', celestial: 'wisp' };
const PATTERN = { fire: 'cracks', nature: 'spots', water: 'spots', earth: 'plates', electric: 'stripes', ice: 'spots', light: 'spots', dark: 'stripes', metal: 'plates', magic: 'runes', ancient: 'runes', void: 'spots', celestial: 'spots' };
const CREST = { fire: 'flame', nature: 'feather', water: 'fin', earth: 'spike', electric: 'spike', ice: 'spike', light: 'feather', dark: 'spike', metal: 'fin', magic: 'feather', ancient: 'fin', void: 'spike', celestial: 'feather' };
const MANE = { fire: 'flame', nature: 'leaf', ice: 'crystal', light: 'crystal', magic: 'crystal', celestial: 'crystal' };
const WINGS = { fire: 'flame', electric: 'bat', ice: 'crystal', light: 'angel', dark: 'bat', magic: 'fairy', void: 'bat', celestial: 'angel' };
const SHELL_TOP = { nature: 'garden', water: 'garden', earth: 'spikes', metal: 'spikes', fire: 'spikes', dark: 'spikes', void: 'spikes', ice: 'crystals', magic: 'crystals', light: 'crystals', celestial: 'crystals', electric: 'crystals', ancient: 'spikes' };
const GLOWY = new Set(['fire', 'electric', 'light', 'magic', 'celestial', 'void']);

// what each body plan can grow
const CAN = {
  quad: { head: 1, back: 1, tail: 1, wings: 1, mane: 1 },
  biped: { head: 1, back: 1, tail: 1, wings: 1 },
  golem: { head: 1, back: 1 },
  serpent: { head: 1, back: 1, tail: 1, wings: 1 },
  floater: { head: 1, back: 1, tail: 1, wings: 1 },
  bird: { head: 1, tail: 1, wings: 1, crestOnly: 1 },
  insect: { head: 1, wings: 1 },
  shell: { head: 1 },
  frog: { head: 1, back: 1, tail: 1, noHorns: 1 },
  dragon: { back: 1, tail: 1, wings: 1, mane: 1, dragon: 1 },
  kraken: { head: 1, back: 1, noHorns: 1 },
  crab: { back: 1 },
  whale: { head: 1, back: 1, mane: 1 },
};

// Per-species adjustments: skip a generic addition, or add something specific.
// Keys: s1 / s2 = partial model merged after the generic rules.
const EVO_TWEAKS = {
  ripplet: { s2: { crest: { style: 'fin', size: 0.6, count: 3, color: 'accent' } } },
  steamtoad: { s2: { crest: { style: 'flame', size: 0.5, count: 3, glow: 1 } } },
  frostfin: { s2: { mane: null, crest: { style: 'fin', size: 0.7, count: 3, color: 'accent' } } },
  celestwhal: { s2: { mane: null } },
  pebblor: { s2: { horns: { style: 'rhino', size: 0.55 } } },
  gloomling: { noWings: 1 },
  blizzbat: { noWings: 1 },
  hexowl: { s2: { crest: { style: 'feather', size: 0.7, count: 5, color: 'accent' } } },
  astrowl: { s2: { crest: null } },
  abyssquid: { s2: { crown: {} } },
  lotusnap: { s2: { halo: {} } },
  glacierback: { s2: { crest: { style: 'spike', size: 0.55, count: 5, color: 'accent' } } },
};

const _c = new THREE.Color();
const _hsl = {};
function richer(hex, sat, light) {
  if (typeof hex !== 'string' || hex[0] !== '#') return hex;
  _c.set(hex).getHSL(_hsl);
  _c.setHSL(_hsl.h, Math.min(1, _hsl.s + sat), Math.max(0.04, Math.min(0.96, _hsl.l + light)));
  return `#${_c.getHexString()}`;
}

function grow(obj, key, k) {
  if (obj && typeof obj[key] === 'number') obj[key] *= k;
}

// model: deep copy of the species model (mutated and returned)
export function evolveModel(model, def, stage) {
  if (!stage || !def || def.boss) return model;
  const m = model;
  const el = def.elements[0];
  const el2 = def.elements[1] || el;
  const can = CAN[m.arch] || CAN.quad;
  const tw = EVO_TWEAKS[def.id] || {};
  const s2 = stage >= 2;
  const k = s2 ? 1 : 0.5; // how far along the evolution line

  // colours deepen and take on the element's hue as the monster matures;
  // eyes and mouth stay as they are
  const C = m.colors || (m.colors = {});
  const tint = new THREE.Color(ELEMENTS[el].color);
  for (const key of Object.keys(C)) {
    if (['eye', 'eyeW', 'mouth', 'cheek', 'inner', 'glow'].includes(key)) continue;
    if (typeof C[key] !== 'string' || C[key][0] !== '#') continue;
    const mixed = _c.set(C[key]).lerp(tint, (key === 'skin' || key === 'limb' ? 0.1 : 0.05) * (s2 ? 2 : 1));
    C[key] = richer(`#${mixed.getHexString()}`, 0.16 * k, (key === 'belly' ? 0.02 : -0.12) * k);
  }
  if (!C.glow) C.glow = ELEMENTS[el].light;
  if (!C.accent) C.accent = ELEMENTS[el2].color;

  // horns grow in (or appear) and become more dramatic
  if (!can.noHorns && (can.head || can.dragon) && !can.crestOnly) {
    if (!m.horns) {
      if (!can.dragon) m.horns = { style: HORN[el2] || HORN[el], size: s2 ? 0.66 : 0.44, color: 'accent' };
    } else if (!m.horns.minStage || m.horns.minStage <= stage) {
      grow(m.horns, 'size', s2 ? 1.6 : 1.22);
      if (s2 && m.horns.style === 'nub') m.horns.style = 'spike';
    }
    if (m.horns && s2 && GLOWY.has(el) && !m.horns.glow) m.horns = { ...m.horns, tip: 'glow', glow: 0.7 };
  }
  if (m.ears) {
    m.ears = { ...m.ears };
    grow(m.ears, 'size', s2 ? 1.28 : 1.12);
  }

  // a crest of the element along the back
  if (can.back) {
    if (!m.back) m.back = { style: BACK[el2] || BACK[el], count: s2 ? 6 : 4, size: s2 ? 0.7 : 0.46, color: 'accent' };
    else if (!m.back.minStage || m.back.minStage <= stage) {
      grow(m.back, 'size', s2 ? 1.6 : 1.25);
      m.back.count = (m.back.count || 4) + (s2 ? 2 : 1);
    }
  }

  // tails grow longer and fancier
  if (can.tail) {
    if (!m.tail && ['quad', 'biped', 'floater', 'frog'].includes(m.arch)) m.tail = { style: TAIL[el], len: s2 ? 0.6 : 0.44, r: 0.065 };
    else if (m.tail) {
      grow(m.tail, 'len', s2 ? 1.45 : 1.2);
      m.tail.size = (m.tail.size || 1) * (s2 ? 1.45 : 1.2);
    }
  }

  // frogs can't grow horns: they raise a crest instead
  if (m.arch === 'frog' && !m.crest) m.crest = { style: CREST[el], size: s2 ? 0.7 : 0.45, count: 3, color: 'accent', glow: GLOWY.has(el) ? 1 : 0 };

  // heavy body plans can't sprout wings or tails, so they bulk up instead
  const body = (m.body = { ...(m.body || {}) });
  if (m.arch === 'golem') {
    for (const key of ['w', 'h', 'd']) body[key] = (body[key] || { w: 0.4, h: 0.42, d: 0.32 }[key]) * (s2 ? 1.14 : 1.06);
    body.fist = (body.fist || 0.19) * (s2 ? 1.4 : 1.18);
    if (s2) m.rocky = true;
  } else if (m.arch === 'shell') {
    body.r = (body.r || 0.42) * (s2 ? 1.12 : 1.05);
    if (!m.shellTop) m.shellTop = SHELL_TOP[el] || 'spikes';
    if (s2) m.shellGlow = true;
  } else if (m.arch === 'crab') {
    for (const key of ['w', 'd']) body[key] = (body[key] || { w: 0.4, d: 0.3 }[key]) * (s2 ? 1.18 : 1.08);
  }

  // markings of the element appear on the hide
  if (!m.pattern) m.pattern = { type: PATTERN[el], color: 'accent', amount: 0.32 + 0.12 * k };

  if (s2) {
    // final forms take to the skies when their element allows it
    const wingEl = WINGS[el] ? el : WINGS[el2] ? el2 : null;
    if (can.wings && !tw.noWings) {
      if (!m.wings && wingEl && m.arch !== 'golem') m.wings = { style: WINGS[wingEl], size: 0.68, color: wingEl === 'fire' ? 'glow' : 'accent' };
      else if (m.wings && (!m.wings.minStage || m.wings.minStage <= stage)) grow(m.wings, 'size', 1.3);
    }
    // a crowning feature: halo for the radiant, a mane for beasts, a crest otherwise
    const radiant = ['light', 'celestial'].includes(el) || ['light', 'celestial'].includes(el2);
    if (radiant && (can.head || can.dragon) && !m.halo) m.halo = {};
    else if (can.mane && !m.mane && !m.halo) m.mane = { style: MANE[el] || MANE[el2] || 'spike', count: 12, color: 'accent' };
    else if (can.head && !m.crest && !m.crown && !m.halo && !m.headFlames) m.crest = { style: CREST[el], size: 0.75, count: 4, color: 'accent', glow: GLOWY.has(el) ? 1 : 0 };
    if (['legendary', 'mythic', 'ancient'].includes(def.rarity) && !m.crown && (can.head || can.dragon)) m.crown = {};
    if (m.mane) grow(m.mane, 'count', 1.2);
  }

  // faces lose their baby roundness; final forms look fierce or wise
  const f = (m.face = { ...(m.face || {}) });
  f.eyeSize = (f.eyeSize || 0.3) * (s2 ? 0.84 : 0.93);
  if (s2) {
    const bold = ['striker', 'brawler', 'tank'].includes(def.role);
    if (!f.eyes || f.eyes === 'round') f.eyes = bold ? 'fierce' : 'shine';
    if (bold && (!f.mouth || f.mouth === 'smile')) f.mouth = 'fangs';
  }

  // species-specific finishing touches (null removes a part)
  const patch = s2 ? tw.s2 : tw.s1;
  if (patch) {
    for (const [key, v] of Object.entries(patch)) {
      if (v === null) delete m[key];
      else m[key] = { ...(m[key] || {}), ...v };
    }
  }
  return m;
}
