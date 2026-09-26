// Illustrated SVG icon library. Consistent style: 64x64 viewBox, ink outline,
// flat base color, one shade shape and one highlight (light from top-left).

const INK = '#2a1a2f';
const S = `stroke="${INK}" stroke-width="3.5" stroke-linejoin="round" stroke-linecap="round"`;
const S2 = `stroke="${INK}" stroke-width="2.5" stroke-linejoin="round" stroke-linecap="round"`;
const HL = 'fill="#fff" opacity=".55"';

const star5 = (cx, cy, R, r) => {
  let p = '';
  for (let i = 0; i < 10; i++) {
    const a = (i / 10) * Math.PI * 2 - Math.PI / 2;
    const rr = i % 2 ? r : R;
    p += `${(cx + Math.cos(a) * rr).toFixed(1)},${(cy + Math.sin(a) * rr).toFixed(1)} `;
  }
  return p.trim();
};

const flameP = 'M32 8c6 10 16 14 16 28a16 16 0 0 1-32 0c0-8 5-12 8-18 1 5 3 7 5 8 0-7 1-12 3-18z';
const leafP = 'M14 50C12 30 26 12 52 12c0 24-14 40-38 38z';
const dropP = 'M32 8c10 14 18 22 18 32a18 18 0 0 1-36 0c0-10 8-18 18-32z';
const boltP = 'M36 6 14 36h14l-6 22 24-32H32l4-20z';

// Element glyphs drawn inside a round badge (white glyph with ink outline)
const EL_GLYPH = {
  fire: `<path d="M32 13c4 7 11 10 11 20a11 11 0 0 1-22 0c0-6 3-8 6-12 1 3 2 5 3 5 0-5 1-8 2-13z" fill="#fff" ${S2}/><path d="M32 30c2 3 5 5 5 9a5 5 0 0 1-10 0c0-3 3-5 5-9z" fill="#ffd23f"/>`,
  nature: `<path d="M18 46c-1-14 9-27 28-27 0 17-10 29-28 27z" fill="#fff" ${S2}/><path d="M20 44 38 26" stroke="#5dbf3c" stroke-width="3" stroke-linecap="round"/>`,
  water: `<path d="M32 13c7 10 13 15 13 22a13 13 0 0 1-26 0c0-7 6-12 13-22z" fill="#fff" ${S2}/><path d="M27 36a6 6 0 0 0 5 6" fill="none" stroke="#2fa6ee" stroke-width="3" stroke-linecap="round"/>`,
  earth: `<path d="M12 44 25 22l7 10 6-7 14 19z" fill="#fff" ${S2}/><path d="M21 44l4-8 4 8z" fill="#b8834f"/>`,
  electric: `<path d="M35 12 20 34h10l-4 18 17-23H33l2-17z" fill="#fff" ${S2}/>`,
  ice: `<g stroke="${INK}" stroke-width="7" stroke-linecap="round"><path d="M32 14v36M16 23l32 18M48 23 16 41"/></g><g stroke="#fff" stroke-width="3.5" stroke-linecap="round"><path d="M32 14v36M16 23l32 18M48 23 16 41"/></g>`,
  light: `<circle cx="32" cy="32" r="9" fill="#fff" ${S2}/><g stroke="${INK}" stroke-width="6" stroke-linecap="round"><path d="M32 12v5M32 47v5M12 32h5M47 32h5M18 18l3.5 3.5M42.5 42.5 46 46M46 18l-3.5 3.5M21.5 42.5 18 46"/></g><g stroke="#fff" stroke-width="2.5" stroke-linecap="round"><path d="M32 12v5M32 47v5M12 32h5M47 32h5M18 18l3.5 3.5M42.5 42.5 46 46M46 18l-3.5 3.5M21.5 42.5 18 46"/></g>`,
  dark: `<path d="M38 14a18 18 0 1 0 12 30 15 15 0 0 1-12-30z" fill="#fff" ${S2}/><circle cx="44" cy="20" r="2.5" fill="#fff"/>`,
  metal: `<path d="M32 13l16 9v20l-16 9-16-9V22z" fill="#fff" ${S2}/><circle cx="32" cy="32" r="6" fill="#9aa9bd" ${S2}/>`,
  magic: `<path d="M32 11c2 12 9 19 21 21-12 2-19 9-21 21-2-12-9-19-21-21 12-2 19-9 21-21z" fill="#fff" ${S2}/>`,
  ancient: `<path d="M20 14h24l-8 18 8 18H20l8-18z" fill="#fff" ${S2}/><path d="M28 21h8M28 43h8" stroke="#37c9a8" stroke-width="3" stroke-linecap="round"/>`,
  void: `<path d="M32 32m-4 0a4 4 0 1 1 8 0a8 8 0 1 1-16 0a12 12 0 1 1 24 0a16 16 0 1 1-32 0" fill="none" stroke="${INK}" stroke-width="7" stroke-linecap="round"/><path d="M32 32m-4 0a4 4 0 1 1 8 0a8 8 0 1 1-16 0a12 12 0 1 1 24 0a16 16 0 1 1-32 0" fill="none" stroke="#fff" stroke-width="3" stroke-linecap="round"/>`,
  celestial: `<circle cx="32" cy="32" r="10" fill="#fff" ${S2}/><ellipse cx="32" cy="32" rx="20" ry="6" fill="none" stroke="${INK}" stroke-width="6" transform="rotate(-20 32 32)"/><ellipse cx="32" cy="32" rx="20" ry="6" fill="none" stroke="#fff" stroke-width="2.5" transform="rotate(-20 32 32)"/>`,
};

export const ELEMENT_COLORS = {
  fire: ['#ff6a2b', '#c7401a'],
  nature: ['#5dbf3c', '#3c8a26'],
  water: ['#2fa6ee', '#1a6fb3'],
  earth: ['#c08a52', '#80552f'],
  electric: ['#ffc93a', '#d19a0a'],
  ice: ['#6fd4fb', '#3b9ccc'],
  light: ['#ffd84a', '#d9a82a'],
  dark: ['#7a4fc9', '#4a2a86'],
  metal: ['#9aa9bd', '#5f6d82'],
  magic: ['#ff5fcf', '#b8309a'],
  ancient: ['#37c9a8', '#1d8a72'],
  void: ['#4a3a8a', '#1d1238'],
  celestial: ['#8fb4ff', '#4f6fd0'],
};

function elementBadge(el) {
  const [c, d] = ELEMENT_COLORS[el] || ['#999', '#666'];
  return `<circle cx="32" cy="33.5" r="27" fill="${d}"/><circle cx="32" cy="32" r="26" fill="${c}" ${S}/><path d="M13 26a20 20 0 0 1 24-16" fill="none" stroke="#fff" stroke-width="4" stroke-linecap="round" opacity=".45"/>${EL_GLYPH[el] || ''}`;
}

// Treasure chest in tier colours: box, lid, metal bands, lock gem.
function chestSvg(box, lid, band, gem, sparkle = false) {
  return `<path d="M8 28h48v24a4 4 0 0 1-4 4H12a4 4 0 0 1-4-4z" fill="${box}" ${S}/><path d="M8 28c0-12 8-18 24-18s24 6 24 18z" fill="${lid}" ${S}/><path d="M12 22c2-5 8-8 14-8" fill="none" stroke="#fff" stroke-width="3" stroke-linecap="round" opacity=".45"/><path d="M8 28h48" ${S}/><path d="M20 12v44M44 12v44" stroke="${band}" stroke-width="5"/><path d="M20 12v44M44 12v44" stroke="${INK}" stroke-width="1.5" opacity=".45"/><rect x="26" y="24" width="12" height="12" rx="3" fill="${gem}" ${S2}/><circle cx="30" cy="28" r="1.8" fill="#fff" opacity=".8"/>${sparkle ? `<path d="M54 4c1 5 3 7 8 8-5 1-7 3-8 8-1-5-3-7-8-8 5-1 7-3 8-8z" fill="#fff" ${S2}/>` : ''}`;
}

const ICONS = {
  // ---------------- resources
  gold: `<ellipse cx="32" cy="37" rx="23" ry="21" fill="#d98a14" ${S}/><circle cx="32" cy="31" r="22" fill="#ffc83d" ${S}/><circle cx="32" cy="31" r="14.5" fill="none" stroke="#e39b1c" stroke-width="3"/><polygon points="${star5(32, 31.5, 9, 4.2)}" fill="#e39b1c"/><path d="M17 24a16 16 0 0 1 12-9" fill="none" stroke="#fff" stroke-width="4" stroke-linecap="round" opacity=".7"/>`,
  food: `<path d="M33 18c-2-6 0-10 4-12" fill="none" ${S}/><path d="M34 15c6-6 14-6 18-2-5 6-12 6-18 2z" fill="#5fc43d" ${S2}/><circle cx="31" cy="37" r="20" fill="#ff4f6d" ${S}/><path d="M43 50a20 20 0 0 1-26-3 20 20 0 0 0 30-18c0 8-1 16-4 21z" fill="#d42f4f"/><ellipse cx="23" cy="29" rx="5" ry="7" transform="rotate(35 23 29)" ${HL}/>`,
  gems: `<path d="M18 16h28l12 14-26 28L6 30z" fill="#2fc6e0" ${S}/><path d="M18 16l6 14h16l6-14M6 30h52M24 30l8 28 8-28" fill="none" stroke="${INK}" stroke-width="2.5" stroke-linejoin="round"/><path d="M18 16l6 14H6z" fill="#9af0ff"/><path d="M46 16l12 14H40z" fill="#1a9ab8"/><path d="M40 30h18L32 58z" fill="#1a9ab8" opacity=".7"/><path d="M24 30l8-14 8 14z" fill="#c8f8ff"/>`,
  xp: `<polygon points="${star5(32, 33, 25, 11)}" fill="#ffd23f" ${S}/><polygon points="${star5(32, 33, 25, 11)}" fill="none"/><path d="M26 22l3-8" stroke="#fff" stroke-width="4" stroke-linecap="round" opacity=".7"/>`,
  energy: `<path d="${boltP}" fill="#ffcf3a" ${S}/><path d="M28 36l-6 22 24-32H36z" fill="#f0a012"/><path d="M33 10 21 30" stroke="#fff" stroke-width="3.5" stroke-linecap="round" opacity=".7"/>`,
  tokens: `<circle cx="32" cy="34" r="24" fill="#c83a7a"/><circle cx="32" cy="31" r="23" fill="#ff6aa0" ${S}/><path d="M32 45S19 37 19 28a7 7 0 0 1 13-3 7 7 0 0 1 13 3c0 9-13 17-13 17z" fill="#fff" ${S2}/>`,
  shards: `<path d="M22 8l14 6 8 22-10 22-14-8-6-24z" fill="#b58cff" ${S}/><path d="M36 14l8 22-10 22" fill="#8a5ad8"/><path d="M22 8l-8 18" stroke="#fff" stroke-width="4" stroke-linecap="round" opacity=".6"/>`,
  relicFrags: `<path d="M32 8l20 12v24L32 56 12 44V20z" fill="#37c9a8" ${S}/><path d="M32 8v48M12 20l40 24M52 20 12 44" stroke="${INK}" stroke-width="2" opacity=".35"/>`,
  runeDust: `<circle cx="22" cy="40" r="12" fill="#ff8fe0" ${S}/><circle cx="40" cy="28" r="14" fill="#c8a8ff" ${S}/><circle cx="44" cy="46" r="8" fill="#ffd98a" ${S}/>`,
  event: `<circle cx="32" cy="32" r="24" fill="#ff8a3a" ${S}/><polygon points="${star5(32, 32, 15, 7)}" fill="#fff" ${S2}/>`,
  // ---------------- nav
  island: `<path d="M8 34c0-5 11-9 24-9s24 4 24 9c0 4-4 6-6 7L36 58l-4-9-6 5-8-12c-5-2-10-4-10-8z" fill="#b8834f" ${S}/><ellipse cx="32" cy="33" rx="24" ry="8" fill="#6fcf4a" ${S}/><path d="M30 30V18" ${S}/><circle cx="30" cy="15" r="9" fill="#4fae3a" ${S}/><circle cx="38" cy="19" r="7" fill="#5fc43d" ${S}/><circle cx="27" cy="12" r="3" ${HL}/>`,
  monsters: `<ellipse cx="32" cy="41" rx="14" ry="12" fill="#ff8a3a" ${S}/><ellipse cx="15" cy="27" rx="6" ry="8" transform="rotate(-20 15 27)" fill="#ff8a3a" ${S}/><ellipse cx="25" cy="16" rx="6" ry="8" transform="rotate(-8 25 16)" fill="#ff8a3a" ${S}/><ellipse cx="39" cy="16" rx="6" ry="8" transform="rotate(8 39 16)" fill="#ff8a3a" ${S}/><ellipse cx="49" cy="27" rx="6" ry="8" transform="rotate(20 49 27)" fill="#ff8a3a" ${S}/><ellipse cx="27" cy="37" rx="4" ry="3" ${HL}/>`,
  battle: `<path d="M12 10l24 24-4 4L8 14V10z" fill="#e8eef8" ${S}/><path d="M52 10 28 34l4 4 24-24V10z" fill="#e8eef8" ${S}/><path d="M22 36l-8 8 6 6 8-8M42 36l8 8-6 6-8-8" fill="#c8402a" ${S}/><path d="M18 41l-6 6M46 41l6 6" ${S}/><circle cx="12" cy="52" r="4" fill="#ffc83d" ${S}/><circle cx="52" cy="52" r="4" fill="#ffc83d" ${S}/>`,
  breed: `<path d="M24 50S8 40 8 28a9 9 0 0 1 16-5 9 9 0 0 1 16 5c0 12-16 22-16 22z" fill="#ff6aa0" ${S}/><path d="M42 44S30 36 30 27a7 7 0 0 1 12-4 7 7 0 0 1 12 4c0 9-12 17-12 17z" fill="#ff9ac8" ${S}/><circle cx="16" cy="26" r="3" ${HL}/>`,
  shop: `<path d="M12 30h40v24H12z" fill="#f4e3c2" ${S}/><path d="M26 54V40h12v14" fill="#9a6238" ${S}/><path d="M8 18l6-10h36l6 10v6a6 6 0 0 1-12 0 6 6 0 0 1-12 0 6 6 0 0 1-12 0 6 6 0 0 1-12 0z" fill="#ff5a4a" ${S}/><path d="M20 18v6a6 6 0 0 1-12 0v-6M44 18v6a6 6 0 0 0 12 0" fill="#fff"/><path d="M32 8v16" ${S2}/>`,
  // ---------------- side / menus
  quests: `<path d="M16 12h30a6 6 0 0 1 6 6v34a6 6 0 0 1-6 6H22a6 6 0 0 1-6-6z" fill="#fff6e3" ${S}/><path d="M10 12a6 6 0 0 1 12 0v8H10z" fill="#e9d2a6" ${S}/><path d="M26 26h18M26 34h18M26 42h12" stroke="#c8a878" stroke-width="3.5" stroke-linecap="round"/><path d="M40 48l4 4 8-10" fill="none" stroke="#5dbf3c" stroke-width="4" stroke-linecap="round" stroke-linejoin="round"/>`,
  events: `<path d="M18 58V8" ${S}/><path d="M18 10h30l-6 10 6 10H18z" fill="#ff5f8f" ${S}/><circle cx="18" cy="8" r="4" fill="#ffc83d" ${S2}/><polygon points="${star5(31, 20, 5, 2.4)}" fill="#fff"/>`,
  dex: `<path d="M10 14c8-4 16-4 22 2v40c-6-6-14-6-22-2z" fill="#3fa9f5" ${S}/><path d="M54 14c-8-4-16-4-22 2v40c6-6 14-6 22-2z" fill="#2f8ad8" ${S}/><path d="M16 22c4-1 8-1 11 1M16 29c4-1 8-1 11 1" stroke="#fff" stroke-width="3" stroke-linecap="round" opacity=".7"/><circle cx="43" cy="27" r="6" fill="#ffd23f" ${S2}/>`,
  settings: `<path d="M28 6h8l2 7 6 3 7-3 5 6-4 6 1 7 7 3v8l-7 2-2 6 3 7-6 5-6-4-7 1-3 7h-8l-2-7-6-3-7 4-5-6 4-6-1-7-7-2v-8l7-2 2-6-3-7 6-5 6 4 7-1z" fill="#b8c4d4" ${S}/><circle cx="32" cy="32" r="9" fill="#6a7a92" ${S}/>`,
  daily: `<path d="M10 26h44v28H10z" fill="#ff5a4a" ${S}/><path d="M6 18h52v10H6z" fill="#ff7a5a" ${S}/><path d="M32 18v36" stroke="#ffc83d" stroke-width="7"/><path d="M32 18v36" ${S2} fill="none"/><path d="M32 17c-6-12-18-10-14-2 3 4 14 2 14 2zM32 17c6-12 18-10 14-2-3 4-14 2-14 2z" fill="#ffc83d" ${S}/>`,
  wheel: `<circle cx="32" cy="32" r="25" fill="#fff6e3" ${S}/><path d="M32 32 32 7a25 25 0 0 1 21.6 12.5z" fill="#ff5a4a"/><path d="M32 32l21.6-12.5a25 25 0 0 1 0 25z" fill="#ffc83d"/><path d="M32 32l21.6 12.5A25 25 0 0 1 32 57z" fill="#3fa9f5"/><path d="M32 32 32 57a25 25 0 0 1-21.6-12.5z" fill="#5dbf3c"/><path d="M32 32 10.4 44.5a25 25 0 0 1 0-25z" fill="#ff8fd8"/><path d="M32 32 10.4 19.5A25 25 0 0 1 32 7z" fill="#b58cff"/><circle cx="32" cy="32" r="25" fill="none" ${S}/><circle cx="32" cy="32" r="6" fill="#ffc83d" ${S}/><path d="M28 2h8l-4 9z" fill="#ff5a4a" ${S2}/>`,
  trophy: `<path d="M20 8h24v14a12 12 0 0 1-24 0z" fill="#ffc83d" ${S}/><path d="M20 12H10c0 10 6 14 12 14M44 12h10c0 10-6 14-12 14" fill="none" ${S}/><path d="M28 34h8v10h-8z" fill="#e39b1c" ${S}/><path d="M18 56h28v-6a6 6 0 0 0-6-6H24a6 6 0 0 0-6 6z" fill="#9a6238" ${S}/><path d="M25 12v10" stroke="#fff" stroke-width="3.5" stroke-linecap="round" opacity=".7"/>`,
  // ---------------- actions
  close: `<path d="M17 17l30 30M47 17 17 47" stroke="${INK}" stroke-width="12" stroke-linecap="round"/><path d="M17 17l30 30M47 17 17 47" stroke="#fff" stroke-width="6" stroke-linecap="round"/>`,
  check: `<path d="M12 34l13 13 27-29" fill="none" stroke="${INK}" stroke-width="13" stroke-linecap="round" stroke-linejoin="round"/><path d="M12 34l13 13 27-29" fill="none" stroke="#fff" stroke-width="6.5" stroke-linecap="round" stroke-linejoin="round"/>`,
  plus: `<path d="M32 12v40M12 32h40" stroke="${INK}" stroke-width="13" stroke-linecap="round"/><path d="M32 12v40M12 32h40" stroke="#fff" stroke-width="6.5" stroke-linecap="round"/>`,
  arrowL: `<path d="M40 10 18 32l22 22" fill="none" stroke="${INK}" stroke-width="13" stroke-linecap="round" stroke-linejoin="round"/><path d="M40 10 18 32l22 22" fill="none" stroke="#fff" stroke-width="6.5" stroke-linecap="round" stroke-linejoin="round"/>`,
  arrowR: `<path d="M24 10l22 22-22 22" fill="none" stroke="${INK}" stroke-width="13" stroke-linecap="round" stroke-linejoin="round"/><path d="M24 10l22 22-22 22" fill="none" stroke="#fff" stroke-width="6.5" stroke-linecap="round" stroke-linejoin="round"/>`,
  up: `<path d="M32 8 10 32h13v22h18V32h13z" fill="#5dd66a" ${S}/><path d="M32 14 20 28" stroke="#fff" stroke-width="3.5" stroke-linecap="round" opacity=".7"/>`,
  lock: `<path d="M20 28v-8a12 12 0 0 1 24 0v8" fill="none" stroke="${INK}" stroke-width="9"/><path d="M20 28v-8a12 12 0 0 1 24 0v8" fill="none" stroke="#b8c4d4" stroke-width="4"/><rect x="12" y="27" width="40" height="30" rx="6" fill="#ffc83d" ${S}/><path d="M32 38v8" ${S}/><circle cx="32" cy="38" r="3" fill="${INK}"/>`,
  timer: `<path d="M18 8h28M18 56h28" ${S}/><path d="M20 8c0 12 10 16 10 24S20 44 20 56h24c0-12-10-16-10-24s10-12 10-24z" fill="#bfe8ff" ${S}/><path d="M24 50c2-6 8-8 8-12 0 4 6 6 8 12z" fill="#ffc83d"/>`,
  info: `<circle cx="32" cy="32" r="24" fill="#3fa9f5" ${S}/><path d="M32 29v15" stroke="#fff" stroke-width="7" stroke-linecap="round"/><circle cx="32" cy="20" r="4" fill="#fff"/>`,
  move: `<path d="M32 6l8 10h-5v11h11v-5l10 8-10 8v-5H35v11h5l-8 10-8-10h5V37H18v5L8 34l10-8v5h11V16h-5z" fill="#fff" ${S}/>`,
  pencil: `<path d="M44 8l12 12-30 30-16 4 4-16z" fill="#ffc83d" ${S}/><path d="M38 14l12 12" ${S} fill="none"/><path d="M14 38l12 12" ${S} fill="none"/><path d="M10 54l4-16 12 12z" fill="#f4e3c2" ${S}/><path d="M42 12l10 10" stroke="#fff" stroke-width="3" stroke-linecap="round" opacity=".6"/>`,
  hammer: `<path d="M26 26 50 50a4 4 0 0 1-6 6L20 32" fill="#9a6238" ${S}/><path d="M8 22l12-12 6 2 10 10-12 12-10-10z" fill="#9aa9bd" ${S}/><path d="M12 22l8-8" stroke="#fff" stroke-width="3" stroke-linecap="round" opacity=".6"/>`,
  feed: `<path d="M8 30h48a24 24 0 0 1-48 0z" fill="#3fa9f5" ${S}/><path d="M8 30h48" ${S}/><circle cx="22" cy="24" r="7" fill="#ff4f6d" ${S2}/><circle cx="34" cy="21" r="8" fill="#ff9a3a" ${S2}/><circle cx="45" cy="25" r="6" fill="#ffd23f" ${S2}/><path d="M14 38a18 12 0 0 0 10 8" stroke="#fff" stroke-width="3.5" stroke-linecap="round" opacity=".6" fill="none"/>`,
  search: `<circle cx="27" cy="27" r="16" fill="#bfe8ff" ${S}/><path d="M39 39l14 14" stroke="${INK}" stroke-width="10" stroke-linecap="round"/><path d="M39 39l14 14" stroke="#9a6238" stroke-width="5" stroke-linecap="round"/><path d="M19 22a9 9 0 0 1 7-6" stroke="#fff" stroke-width="3.5" stroke-linecap="round" fill="none"/>`,
  play: `<path d="M20 10l32 22-32 22z" fill="#5dd66a" ${S}/>`,
  speed: `<path d="M8 14l22 18L8 50zM32 14l22 18-22 18z" fill="#fff" ${S}/>`,
  auto: `<path d="M50 30a18 18 0 0 0-32-10M14 34a18 18 0 0 0 32 10" fill="none" stroke="${INK}" stroke-width="10" stroke-linecap="round"/><path d="M50 30a18 18 0 0 0-32-10M14 34a18 18 0 0 0 32 10" fill="none" stroke="#fff" stroke-width="5" stroke-linecap="round"/><path d="M10 14l8 8 4-12zM54 50l-8-8-4 12z" fill="#fff" ${S2}/>`,
  film: `<rect x="6" y="14" width="40" height="36" rx="6" fill="#b58cff" ${S}/><path d="M46 26l12-8v28l-12-8z" fill="#8a5ad8" ${S}/><path d="M22 24l12 8-12 8z" fill="#fff" ${S2}/>`,
  music: `<path d="M24 46V14l28-6v32" fill="none" stroke="${INK}" stroke-width="8" stroke-linejoin="round"/><path d="M24 46V14l28-6v32" fill="none" stroke="#fff" stroke-width="3" stroke-linejoin="round"/><ellipse cx="18" cy="47" rx="8" ry="6" fill="#ff8fd8" ${S}/><ellipse cx="46" cy="41" rx="8" ry="6" fill="#ff8fd8" ${S}/>`,
  sound: `<path d="M8 24h10l14-12v40L18 40H8z" fill="#fff" ${S}/><path d="M40 22a14 14 0 0 1 0 20M46 14a24 24 0 0 1 0 36" fill="none" stroke="${INK}" stroke-width="8" stroke-linecap="round"/><path d="M40 22a14 14 0 0 1 0 20M46 14a24 24 0 0 1 0 36" fill="none" stroke="#fff" stroke-width="3.5" stroke-linecap="round"/>`,
  mute: `<path d="M8 24h10l14-12v40L18 40H8z" fill="#fff" ${S}/><path d="M40 24l14 16M54 24 40 40" stroke="${INK}" stroke-width="9" stroke-linecap="round"/><path d="M40 24l14 16M54 24 40 40" stroke="#ff5a4a" stroke-width="4" stroke-linecap="round"/>`,
  star: `<polygon points="${star5(32, 34, 26, 12)}" fill="#ffd23f" ${S}/><path d="M26 22l3-8" stroke="#fff" stroke-width="4" stroke-linecap="round" opacity=".7"/>`,
  starEmpty: `<polygon points="${star5(32, 34, 26, 12)}" fill="#5a4a5e" ${S}/>`,
  heart: `<path d="M32 54S8 40 8 24a12 12 0 0 1 24-4 12 12 0 0 1 24 4c0 16-24 30-24 30z" fill="#ff5a6e" ${S}/><ellipse cx="19" cy="22" rx="5" ry="4" ${HL}/>`,
  egg: `<path d="M32 6c12 0 22 20 22 32a22 22 0 0 1-44 0C10 26 20 6 32 6z" fill="#fff6e3" ${S}/><path d="M14 40c8 4 14-4 18 0s10 4 18 0" fill="none" stroke="#ff8fb8" stroke-width="4" stroke-linecap="round"/><circle cx="24" cy="24" r="4" fill="#8fd8ff"/><circle cx="40" cy="30" r="3" fill="#ffd23f"/><ellipse cx="22" cy="16" rx="4" ry="6" transform="rotate(25 22 16)" ${HL}/>`,
  chest: chestSvg('#b8783a', '#d8904a', '#ffc83d', '#ffc83d'),
  chest_wooden: chestSvg('#b8783a', '#d8904a', '#8a5a2a', '#ffc83d'),
  chest_silver: chestSvg('#8ea2bc', '#b8c8dc', '#e8eef8', '#5fb8f8'),
  chest_gold: chestSvg('#e8a526', '#ffc83d', '#fff1a8', '#ff5a6e'),
  chest_mythic: chestSvg('#c04aa8', '#ff6fc0', '#ffd23f', '#6ff0e0', true),
  crown: `<path d="M8 46 12 18l12 12 8-18 8 18 12-12 4 28z" fill="#ffc83d" ${S}/><path d="M10 46h44v8H10z" fill="#e39b1c" ${S}/><circle cx="32" cy="36" r="4" fill="#ff4f7b" ${S2}/>`,
  skull: `<path d="M32 6c14 0 24 9 24 22 0 7-4 11-8 13v9H16v-9c-4-2-8-6-8-13C8 15 18 6 32 6z" fill="#f4ecdc" ${S}/><circle cx="22" cy="28" r="6" fill="${INK}"/><circle cx="42" cy="28" r="6" fill="${INK}"/><path d="M30 38h4l-2-5z" fill="${INK}"/><path d="M24 50v6M32 50v6M40 50v6" ${S2}/>`,
  question: `<circle cx="32" cy="32" r="24" fill="#b58cff" ${S}/><path d="M24 24a8 8 0 1 1 11 8c-2 1-3 2-3 5" fill="none" stroke="#fff" stroke-width="6" stroke-linecap="round"/><circle cx="32" cy="46" r="3.5" fill="#fff"/>`,
  sword: `<path d="M48 8h8v8L28 44l-8-8z" fill="#e8eef8" ${S}/><path d="M16 32l16 16-4 4-16-16z" fill="#c8402a" ${S}/><path d="M18 46l-8 8" stroke="${INK}" stroke-width="7" stroke-linecap="round"/><path d="M18 46l-8 8" stroke="#9a6238" stroke-width="3" stroke-linecap="round"/>`,
  shield: `<path d="M32 6l22 8v14c0 14-10 24-22 30C20 52 10 42 10 28V14z" fill="#3fa9f5" ${S}/><path d="M32 6v52c12-6 22-16 22-30V14z" fill="#2f8ad8"/><path d="M32 6l22 8v14c0 14-10 24-22 30C20 52 10 42 10 28V14z" fill="none" ${S}/><path d="M18 18v10" stroke="#fff" stroke-width="4" stroke-linecap="round" opacity=".6"/>`,
  boot: `<path d="M16 8h18v22l16 8a8 8 0 0 1 4 7v5H10V26z" fill="#ffd23f" ${S}/><path d="M10 50h44v6H10z" fill="#9a6238" ${S}/><path d="M22 14v14" stroke="#fff" stroke-width="3.5" stroke-linecap="round" opacity=".6"/>`,
  target: `<circle cx="32" cy="32" r="24" fill="#fff" ${S}/><circle cx="32" cy="32" r="16" fill="#ff5a4a" ${S2}/><circle cx="32" cy="32" r="8" fill="#fff" ${S2}/><circle cx="32" cy="32" r="3" fill="#ff5a4a"/>`,
  gift: `<path d="M10 26h44v28H10z" fill="#3fa9f5" ${S}/><path d="M6 18h52v10H6z" fill="#5fb8f8" ${S}/><path d="M32 18v36" stroke="#ffc83d" stroke-width="7"/><path d="M32 17c-6-12-18-10-14-2 3 4 14 2 14 2zM32 17c6-12 18-10 14-2-3 4-14 2-14 2z" fill="#ffc83d" ${S}/>`,
  sparkle: `<path d="M32 4c3 16 12 25 28 28-16 3-25 12-28 28-3-16-12-25-28-28 16-3 25-12 28-28z" fill="#ffe27a" ${S}/>`,
  rune: `<path d="M32 6l20 14-6 30H18l-6-30z" fill="#6a5aa8" ${S}/><path d="M26 22l12 8-12 8M38 20v24" fill="none" stroke="#ff9ae6" stroke-width="4" stroke-linecap="round" stroke-linejoin="round"/>`,
  relic: `<circle cx="32" cy="36" r="14" fill="#37c9a8" ${S}/><path d="M18 30 12 10l12 8 8-12 8 12 12-8-6 20" fill="#ffc83d" ${S}/><circle cx="32" cy="36" r="5" fill="#fff" opacity=".7"/>`,
  tower: `<path d="M20 58V22h24v36z" fill="#d8cfbf" ${S}/><path d="M16 22h32l-16-16z" fill="#c8402a" ${S}/><path d="M28 58V46a4 4 0 0 1 8 0v12" fill="#9a6238" ${S2}/><rect x="28" y="28" width="8" height="10" rx="3" fill="#ffe9a8" ${S2}/>`,
  flame: `<path d="${flameP}" fill="#ff6a2b" ${S}/><path d="M32 30c4 5 8 8 8 14a8 8 0 0 1-16 0c0-5 4-8 8-14z" fill="#ffd23f"/>`,
  home: `<path d="M8 30 32 8l24 22" fill="none" stroke="${INK}" stroke-width="7" stroke-linecap="round" stroke-linejoin="round"/><path d="M14 28v26h36V28L32 12z" fill="#fff6e3" ${S}/><path d="M26 54V40h12v14" fill="#9a6238" ${S}/>`,
  map: `<path d="M6 14l16-6 20 6 16-6v42l-16 6-20-6-16 6z" fill="#fff6e3" ${S}/><path d="M22 8v42M42 14v42" stroke="${INK}" stroke-width="2.5"/><path d="M14 38c6-4 10 4 16-2s10-12 18-8" fill="none" stroke="#ff5a4a" stroke-width="3.5" stroke-linecap="round" stroke-dasharray="1 6"/><path d="M48 22l-4 4M44 22l4 4" stroke="#ff5a4a" stroke-width="3.5" stroke-linecap="round"/>`,
  paw: `<ellipse cx="32" cy="41" rx="13" ry="11" fill="#fff" ${S}/><circle cx="15" cy="28" r="6" fill="#fff" ${S}/><circle cx="25" cy="17" r="6" fill="#fff" ${S}/><circle cx="39" cy="17" r="6" fill="#fff" ${S}/><circle cx="49" cy="28" r="6" fill="#fff" ${S}/>`,
  sort: `<path d="M18 10v44M10 44l8 10 8-10" fill="none" stroke="${INK}" stroke-width="9" stroke-linecap="round" stroke-linejoin="round"/><path d="M18 10v44M10 44l8 10 8-10" fill="none" stroke="#fff" stroke-width="4" stroke-linecap="round" stroke-linejoin="round"/><path d="M34 16h20M34 28h14M34 40h8" stroke="${INK}" stroke-width="9" stroke-linecap="round"/><path d="M34 16h20M34 28h14M34 40h8" stroke="#fff" stroke-width="4" stroke-linecap="round"/>`,
  habitat: `<ellipse cx="32" cy="44" rx="26" ry="12" fill="#a89a86" ${S}/><ellipse cx="32" cy="40" rx="26" ry="12" fill="#79c451" ${S}/><path d="M26 38V26" ${S}/><circle cx="26" cy="22" r="8" fill="#4fae3a" ${S}/><path d="M40 40a8 8 0 0 1 12-4" fill="#5fc43d" ${S}/>`,
  farm: `<path d="M6 40l26-12 26 12-26 12z" fill="#8a5a3a" ${S}/><path d="M16 40l10-4M24 44l10-4M32 48l10-4M24 36l10-4" stroke="#6a4228" stroke-width="3"/><path d="M28 30c-2-8 2-14 8-16 0 8-4 12-8 16z" fill="#5fc43d" ${S2}/><circle cx="40" cy="34" r="5" fill="#ff4f6d" ${S2}/>`,
  deco: `<path d="M32 58V30" ${S}/><circle cx="32" cy="22" r="14" fill="#ffb8e0" ${S}/><circle cx="24" cy="18" r="4" fill="#fff" opacity=".7"/><path d="M16 58h32" ${S}/>`,
  building: `<path d="M10 56V26l22-16 22 16v30z" fill="#fff6e3" ${S}/><path d="M6 28 32 8l26 20" fill="none" stroke="${INK}" stroke-width="7" stroke-linecap="round" stroke-linejoin="round"/><path d="M8 28 32 10l24 18" fill="none" stroke="#e0553a" stroke-width="3.5" stroke-linecap="round"/><rect x="26" y="38" width="12" height="18" fill="#9a6238" ${S2}/>`,
  resources: `<ellipse cx="24" cy="40" rx="16" ry="14" fill="#d98a14" ${S}/><circle cx="24" cy="36" r="15" fill="#ffc83d" ${S}/><path d="M38 22l10-12 10 12-10 14z" fill="#2fc6e0" ${S}/>`,
  hp: `<path d="M32 54S8 40 8 24a12 12 0 0 1 24-4 12 12 0 0 1 24 4c0 16-24 30-24 30z" fill="#5dd66a" ${S}/><path d="M32 22v18M23 31h18" stroke="#fff" stroke-width="5" stroke-linecap="round"/>`,
  atk: `<path d="M48 8h8v8L28 44l-8-8z" fill="#ff7a3a" ${S}/><path d="M16 32l16 16-4 4-16-16z" fill="#c8402a" ${S}/><path d="M18 46l-8 8" stroke="${INK}" stroke-width="7" stroke-linecap="round"/>`,
  def: `<path d="M32 6l22 8v14c0 14-10 24-22 30C20 52 10 42 10 28V14z" fill="#5aa8ff" ${S}/>`,
  spd: `<path d="M54 12C40 12 22 20 12 44c10-6 18-8 26-8-6 4-10 8-12 14 12-4 22-12 28-24-4 2-8 2-12 2 8-4 12-10 12-16z" fill="#ffd23f" ${S}/><path d="M20 38c6-10 14-16 26-20" stroke="#fff" stroke-width="3" stroke-linecap="round" fill="none" opacity=".6"/>`,
  crit: `<circle cx="32" cy="32" r="22" fill="#fff" ${S}/><circle cx="32" cy="32" r="12" fill="#ff5a4a" ${S2}/><path d="M32 4v12M32 48v12M4 32h12M48 32h12" stroke="${INK}" stroke-width="5" stroke-linecap="round"/>`,
  res: `<path d="M32 6l22 8v14c0 14-10 24-22 30C20 52 10 42 10 28V14z" fill="#c8a8ff" ${S}/><path d="M32 18c1 7 5 10 11 11-6 1-10 4-11 11-1-7-5-10-11-11 6-1 10-4 11-11z" fill="#fff"/>`,
  // crops
  crop_berries: `<path d="M32 16c-2-6 0-10 4-12" fill="none" ${S}/><circle cx="24" cy="34" r="12" fill="#ff4f6d" ${S}/><circle cx="40" cy="34" r="12" fill="#ff4f6d" ${S}/><circle cx="32" cy="46" r="12" fill="#ff4f6d" ${S}/><circle cx="20" cy="30" r="3" ${HL}/><path d="M34 14c6-6 14-4 16 0-6 4-12 4-16 0z" fill="#5fc43d" ${S2}/>`,
  crop_roots: `<path d="M24 20l16 0-6 36c-1 3-3 3-4 0z" fill="#ff9a3a" ${S}/><path d="M28 30h8M28 40h6" stroke="#d8702a" stroke-width="3" stroke-linecap="round"/><path d="M32 20c-6-8-10-12-12-16M32 20c0-8 2-12 4-16M32 20c6-6 10-8 14-10" fill="none" stroke="${INK}" stroke-width="7" stroke-linecap="round"/><path d="M32 20c-6-8-10-12-12-16M32 20c0-8 2-12 4-16M32 20c6-6 10-8 14-10" fill="none" stroke="#5fc43d" stroke-width="3.5" stroke-linecap="round"/>`,
  crop_melons: `<ellipse cx="32" cy="36" rx="24" ry="20" fill="#5fd0f0" ${S}/><path d="M16 26c4 8 4 16 0 24M32 16c4 10 4 30 0 40M48 26c-4 8-4 16 0 24" stroke="#2f9ac8" stroke-width="3.5" fill="none"/><ellipse cx="22" cy="26" rx="6" ry="4" ${HL}/>`,
  crop_pumpkins: `<ellipse cx="32" cy="38" rx="24" ry="18" fill="#ffc02a" ${S}/><path d="M32 20c-8 6-8 30 0 36M32 20c8 6 8 30 0 36" stroke="${INK}" stroke-width="2.5" fill="none"/><path d="M30 20c0-6 2-10 6-12" fill="none" stroke="#5a8a3a" stroke-width="6" stroke-linecap="round"/><ellipse cx="20" cy="30" rx="5" ry="4" ${HL}/>`,
  crop_starfruit: `<polygon points="${star5(32, 34, 26, 12)}" fill="#ffe45a" ${S}/><polygon points="${star5(32, 34, 13, 6)}" fill="#fff6b0"/>`,
  crop_peppers: `<path d="M36 12c14 4 20 20 12 34-6 10-18 12-24 8 10-4 14-12 12-20s-4-14 0-22z" fill="#e8303a" ${S}/><path d="M36 14c0-4 2-6 6-8" fill="none" stroke="#3f8a2e" stroke-width="6" stroke-linecap="round"/><path d="M40 22c2 6 2 12-2 18" stroke="#fff" stroke-width="3" fill="none" stroke-linecap="round" opacity=".6"/>`,
  crop_grain: `<path d="M32 60V18" ${S}/><path d="M32 18c-6-2-8-8-6-14 6 2 8 8 6 14zM32 28c-8-2-10-8-8-14 6 2 10 8 8 14zM32 28c8-2 10-8 8-14-6 2-10 8-8 14zM32 40c-8-2-10-8-8-14 6 2 10 8 8 14zM32 40c8-2 10-8 8-14-6 2-10 8-8 14z" fill="#37c9a8" ${S2}/>`,
};

// Status effect badges: colored round badge with a small glyph.
const STATUS_GLYPH = {
  burn: `<path d="M32 14c4 7 10 10 10 19a10 10 0 0 1-20 0c0-6 3-8 5-12 1 3 2 5 3 5 0-5 1-8 2-12z" fill="#fff"/>`,
  poison: `<circle cx="26" cy="36" r="8" fill="#fff"/><circle cx="38" cy="26" r="6" fill="#fff"/><circle cx="40" cy="42" r="4" fill="#fff"/>`,
  freeze: `<g stroke="#fff" stroke-width="5" stroke-linecap="round"><path d="M32 14v36M16 23l32 18M48 23 16 41"/></g>`,
  stun: `<polygon points="${star5(24, 26, 9, 4)}" fill="#fff"/><polygon points="${star5(40, 38, 9, 4)}" fill="#fff"/>`,
  bleed: `<path d="M32 12c6 10 12 16 12 24a12 12 0 0 1-24 0c0-8 6-14 12-24z" fill="#fff"/>`,
  regen: `<path d="M32 16v32M16 32h32" stroke="#fff" stroke-width="8" stroke-linecap="round"/>`,
  shield: `<path d="M32 12l16 6v10c0 10-7 17-16 22-9-5-16-12-16-22V18z" fill="#fff"/>`,
  atkUp: `<path d="M32 12 18 30h8v20h12V30h8z" fill="#fff"/>`,
  atkDown: `<path d="M32 52 18 34h8V14h12v20h8z" fill="#fff"/>`,
  defUp: `<path d="M32 12 18 30h8v20h12V30h8z" fill="#fff"/>`,
  defDown: `<path d="M32 52 18 34h8V14h12v20h8z" fill="#fff"/>`,
  spdUp: `<path d="M12 18l16 14-16 14zM32 18l16 14-16 14z" fill="#fff"/>`,
  spdDown: `<path d="M52 18 36 32l16 14zM32 18 16 32l16 14z" fill="#fff"/>`,
  taunt: `<path d="M16 26h10l16-10v32L26 38H16z" fill="#fff"/>`,
  rage: `<path d="M20 20l8 10M44 20l-8 10M22 44c6-6 14-6 20 0" stroke="#fff" stroke-width="6" stroke-linecap="round" fill="none"/>`,
};
const STATUS_COLOR = {
  burn: '#ff6a2b', poison: '#7fc43a', freeze: '#5fcff8', stun: '#ffc93a', bleed: '#e0334f', regen: '#4fcf6a', shield: '#5ab0ff',
  atkUp: '#ff7a3a', atkDown: '#9a6a5a', defUp: '#3f9ae8', defDown: '#6a7ab8', spdUp: '#f0b020', spdDown: '#8a8aa8', taunt: '#ff9a3a', rage: '#e8303a',
};

for (const el of Object.keys(ELEMENT_COLORS)) ICONS[`el_${el}`] = elementBadge(el);
for (const [k, g] of Object.entries(STATUS_GLYPH)) {
  const c = STATUS_COLOR[k];
  ICONS[`st_${k}`] = `<circle cx="32" cy="32" r="27" fill="${c}" ${S}/>${g}`;
}

export function iconSvg(name, cls = '') {
  const body = ICONS[name] || ICONS.question;
  return `<svg class="ico ${cls}" viewBox="0 0 64 64" aria-hidden="true">${body}</svg>`;
}

export function hasIcon(name) {
  return !!ICONS[name];
}

// Rasterize an icon to an <img>-able data URL (for canvas/3D use).
export function iconDataUrl(name, size = 64) {
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 64 64">${ICONS[name] || ICONS.question}</svg>`;
  return `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`;
}

export const ICON_NAMES = Object.keys(ICONS);
