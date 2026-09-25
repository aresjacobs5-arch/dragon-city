import { G, SAVE_VERSION, createNewState } from '../game/G.js';

// Persistent, versioned, checksummed saves with a rolling backup.
// Storage order of preference: CrazyGames data module (cloud for logged-in
// players) when available, always mirrored to localStorage.

const KEY = 'beasthaven.save';
const BACKUP_KEY = 'beasthaven.save.bak';
let lastBackupAt = 0;
let lastSdkWrite = 0;
let sdkPending = null;

function fnv(str) {
  let h = 2166136261 >>> 0;
  for (let i = 0; i < str.length; i++) {
    h ^= str.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return (h >>> 0).toString(36);
}

function ls() {
  try {
    const t = '__bh_test__';
    window.localStorage.setItem(t, '1');
    window.localStorage.removeItem(t);
    return window.localStorage;
  } catch {
    return null;
  }
}
const storage = ls();
const memory = new Map(); // fallback when storage is blocked

function read(key) {
  if (storage) return storage.getItem(key);
  return memory.get(key) ?? null;
}
function write(key, value) {
  try {
    if (storage) storage.setItem(key, value);
    else memory.set(key, value);
    return true;
  } catch (e) {
    console.warn('[save] write failed', e);
    return false;
  }
}

export function encode(state) {
  const data = JSON.stringify(state);
  return JSON.stringify({ v: SAVE_VERSION, t: Date.now(), sum: fnv(data), data });
}

// Returns { state, t } or throws.
export function decode(str) {
  if (!str || typeof str !== 'string') throw new Error('empty');
  const w = JSON.parse(str);
  if (!w || typeof w.data !== 'string') throw new Error('bad wrapper');
  if (fnv(w.data) !== w.sum) throw new Error('checksum mismatch');
  const state = JSON.parse(w.data);
  if (!state || typeof state !== 'object' || !state.player || !Array.isArray(state.monsters)) throw new Error('bad state');
  return { state: migrate(state), t: w.t || 0 };
}

// Version migrations. Each step upgrades from version k to k+1.
const MIGRATIONS = {
  1: (s) => {
    s.inventory = s.inventory || { chests: {}, runes: [], relics: {} };
  },
  2: (s) => {
    s.shards = s.shards || {};
    s.tower = s.tower || { floor: 0 };
  },
};

function migrate(state) {
  let v = state.v || 1;
  while (v < SAVE_VERSION) {
    if (MIGRATIONS[v]) MIGRATIONS[v](state);
    v++;
  }
  state.v = SAVE_VERSION;
  return repair(state);
}

// Fill any missing fields with defaults (forward compatible, never destructive).
function repair(state) {
  const def = createNewState(state.created || Date.now());
  const isObj = (v) => v && typeof v === 'object' && !Array.isArray(v);
  const fill = (target, source) => {
    for (const k of Object.keys(source)) {
      const sv = source[k];
      if (!(k in target) || target[k] === undefined) target[k] = sv;
      else if (isObj(sv) && isObj(target[k])) fill(target[k], sv);
    }
  };
  fill(state, def);
  // sanitize numbers
  for (const k of Object.keys(state.res)) if (!Number.isFinite(state.res[k])) state.res[k] = def.res[k] ?? 0;
  state.monsters = state.monsters.filter((m) => m && m.sp);
  state.buildings = state.buildings.filter((b) => b && b.type);
  return state;
}

export function loadGame() {
  const primary = read(KEY);
  const backup = read(BACKUP_KEY);
  let result = null;
  let corrupted = false;
  if (primary) {
    try {
      result = decode(primary);
    } catch (e) {
      console.warn('[save] primary save invalid:', e.message);
      corrupted = true;
    }
  }
  if (!result && backup) {
    try {
      result = decode(backup);
      console.warn('[save] restored from backup');
    } catch (e) {
      console.warn('[save] backup invalid:', e.message);
    }
  }
  if (corrupted && primary) write(`beasthaven.corrupt.${Date.now()}`, primary);
  if (result) return { state: result.state, t: result.t, fresh: false, recovered: corrupted };
  return { state: null, fresh: true, recovered: false, corrupted };
}

// Merge a cloud save (CrazyGames data module) if it is newer than local.
export function pickNewest(local, cloudStr) {
  if (!cloudStr) return local;
  try {
    const cloud = decode(cloudStr);
    if (!local || !local.state || (cloud.t || 0) > (local.t || 0)) return { state: cloud.state, t: cloud.t, fresh: false, recovered: false, fromCloud: true };
  } catch (e) {
    console.warn('[save] cloud save invalid:', e.message);
  }
  return local;
}

export function saveGame(force = false) {
  if (!G.state) return false;
  G.state.lastTick = G.now();
  const str = encode(G.state);
  const now = Date.now();
  if (force || now - lastBackupAt > 30000) {
    const prev = read(KEY);
    if (prev) write(BACKUP_KEY, prev);
    lastBackupAt = now;
  }
  const ok = write(KEY, str);
  G.dirty = false;
  // cloud mirror, throttled
  if (G.sdk && G.sdk.dataAvailable) {
    sdkPending = str;
    if (force || now - lastSdkWrite > 20000) flushCloud();
  }
  return ok;
}

function flushCloud() {
  if (!sdkPending || !G.sdk) return;
  try {
    G.sdk.setData(KEY, sdkPending);
    lastSdkWrite = Date.now();
    sdkPending = null;
  } catch (e) {
    console.warn('[save] cloud write failed', e);
  }
}

export function wipeSave() {
  try {
    if (storage) {
      storage.removeItem(KEY);
      storage.removeItem(BACKUP_KEY);
    }
    memory.clear();
    if (G.sdk && G.sdk.dataAvailable) G.sdk.setData(KEY, '');
  } catch (e) {
    console.warn(e);
  }
}

export function readCloud() {
  if (!G.sdk || !G.sdk.dataAvailable) return null;
  try {
    return G.sdk.getData(KEY);
  } catch {
    return null;
  }
}

export function startAutosave() {
  setInterval(() => {
    if (G.dirty) saveGame();
  }, 4000);
  setInterval(() => flushCloud(), 25000);
  const flush = () => saveGame(true);
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'hidden') flush();
  });
  window.addEventListener('pagehide', flush);
  window.addEventListener('beforeunload', flush);
}
