// Persistent settings (localStorage, wrapped so it never crashes)
const KEY = 'eraclash.settings.v1';

import { UNITS, FACTIONS } from './config.js';

/*
  Keybinds are grouped into SCOPES. Two actions only clash (and get swapped on rebind)
  when they share a scope — so the same key can mean different things in different contexts:
    general   : always active in battle
    ability   : QWER slots of the selected troop
    shop:<faction> : buy keys, ONLY active while the shop is open (beat control groups / abilities then)
*/
export const ACTIONS = [
  { id: 'attackMove', scope: 'general', label: 'Attack (then left-click target/ground)' },
  { id: 'stop',       scope: 'general', label: 'Stop / cancel action' },
  { id: 'charge',     scope: 'general', label: 'Resume auto-charge' },
  { id: 'shop',       scope: 'general', label: 'Open / close shop' },
  { id: 'barracks',   scope: 'general', label: 'Open / close Barracks' },
  { id: 'repair',     scope: 'general', label: 'Toggle base Repair' },
  { id: 'autoLoot',   scope: 'general', label: 'Toggle Auto-loot (creep drops go straight to the killer)' },
  { id: 'selectAll',  scope: 'general', label: 'Select all my troops' },
  { id: 'centerBase', scope: 'general', label: 'Center camera on your base' },
  { id: 'panLeft',    scope: 'general', label: 'Pan camera left' },
  { id: 'panRight',   scope: 'general', label: 'Pan camera right' },
  { id: 'panUp',      scope: 'general', label: 'Pan camera up' },
  { id: 'panDown',    scope: 'general', label: 'Pan camera down' },
  { id: 'abil1',      scope: 'ability', label: 'Ability slot 1' },
  { id: 'abil2',      scope: 'ability', label: 'Ability slot 2' },
  { id: 'abil3',      scope: 'ability', label: 'Ability slot 3' },
  { id: 'abil4',      scope: 'ability', label: 'Ability slot 4' },
  // one buy key per troop, generated from the roster
  ...Object.values(FACTIONS).flatMap((f) => f.units.map((id) => ({
    id: 'buy_' + id, scope: 'shop:' + f.id, label: `Buy ${UNITS[id].name}`, faction: f.id,
  }))),
];
export const SCOPE_LABEL = { general: 'General', ability: 'Abilities (selected troop)' };
export const scopeOf = (actionId) => ACTIONS.find((a) => a.id === actionId)?.scope;

export const DEFAULTS = {
  keys: {
    attackMove: 'KeyA',
    stop: 'KeyS',
    charge: 'KeyC',
    shop: 'KeyB',
    barracks: 'KeyV',
    repair: 'KeyH',
    autoLoot: 'KeyL',
    selectAll: 'KeyF',
    centerBase: 'Space',
    panLeft: 'ArrowLeft',
    panRight: 'ArrowRight',
    panUp: 'ArrowUp',
    panDown: 'ArrowDown',
    abil1: 'KeyQ',
    abil2: 'KeyW',
    abil3: 'KeyE',
    abil4: 'KeyR',
    // shop: troop #1 = 1, #2 = 2, ... per faction
    ...Object.fromEntries(Object.values(FACTIONS).flatMap((f) => f.units.map((id, i) => ['buy_' + id, 'Digit' + (i + 1)]))),
  },
  audio: { master: 0.8, music: 0.4, sfx: 0.8, mute: false },
  graphics: { quality: 'medium', pixelated: false, showFps: false, hpBars: 'always', uiScale: 1 },
  gameplay: { edgePan: true, panSpeed: 1.0, zoomSpeed: 1.0 },
};

function deepMerge(base, over) {
  const out = structuredClone(base);
  if (!over || typeof over !== 'object') return out;
  for (const k of Object.keys(out)) {
    if (over[k] === undefined) continue;
    if (typeof out[k] === 'object' && out[k] !== null) out[k] = deepMerge(out[k], over[k]);
    else out[k] = over[k];
  }
  return out;
}

function load() {
  try {
    const raw = localStorage.getItem(KEY);
    return deepMerge(DEFAULTS, raw ? JSON.parse(raw) : null);
  } catch { return structuredClone(DEFAULTS); }
}

export const settings = load();
const listeners = new Set();

export function saveSettings() {
  try { localStorage.setItem(KEY, JSON.stringify(settings)); } catch { /* private mode etc */ }
  listeners.forEach((fn) => fn(settings));
}
export function onSettingsChange(fn) { listeners.add(fn); }

export function resetKeys() {
  settings.keys = structuredClone(DEFAULTS.keys);
  saveSettings();
}

export function keyLabel(code) {
  if (!code) return '—';
  if (code.startsWith('Key')) return code.slice(3);
  if (code.startsWith('Digit')) return code.slice(5);
  const map = { ArrowLeft: '←', ArrowRight: '→', ArrowUp: '↑', ArrowDown: '↓', Space: 'Space', Backquote: '`' };
  return map[code] || code;
}
