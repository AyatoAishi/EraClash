// Persistent settings (localStorage, wrapped so it never crashes)
const KEY = 'eraclash.settings.v1';


/*
  Keybinds are grouped into SCOPES. Two actions only clash (and get swapped on rebind)
  when they share a scope — so the same key can mean different things in different contexts:
    general   : always active in battle
    ability   : QWER slots of the selected troop
    shop      : quick-hire keys for your 3 most recently hired troops, ONLY active while the shop is open
    item      : use the item in inventory slot 1-6 of the selected troop
    group     : unit groups 1-5. The key alone does nothing: Alt + key = set the group, Ctrl + key = select it
                (double-tap Ctrl + key = jump the camera to it)
    formation : Alt + key = put the selected troops into that formation (facing the cursor)
*/
export const ACTIONS = [
  { id: 'attackMove', scope: 'general', label: 'Attack (then left-click target/ground)' },
  { id: 'stop',       scope: 'general', label: 'Stop / cancel action' },
  { id: 'charge',     scope: 'general', label: 'Resume auto-charge' },
  { id: 'shop',       scope: 'general', label: 'Open / close shop' },
  { id: 'barracks',   scope: 'general', label: 'Open / close Barracks' },
  { id: 'skills',     scope: 'general', label: 'Open / close Skill Tree' },
  { id: 'build',      scope: 'general', label: 'Open / close Build menu (artillery)' },
  { id: 'repair',     scope: 'general', label: 'Toggle base Repair' },
  { id: 'chat',       scope: 'general', label: 'Open chat (type /help for test commands vs AI)' },
  { id: 'autoLoot',   scope: 'general', label: 'Toggle Auto-loot (creep drops go straight to the killer)' },
  { id: 'selectAll',  scope: 'general', label: 'Select all my troops' },
  { id: 'centerUnits', scope: 'general', label: 'Camera to selected troops (tap = center, hold = follow)' },
  { id: 'centerBase', scope: 'general', label: 'Camera to your base' },
  { id: 'panLeft',    scope: 'general', label: 'Pan camera left' },
  { id: 'panRight',   scope: 'general', label: 'Pan camera right' },
  { id: 'panUp',      scope: 'general', label: 'Pan camera up' },
  { id: 'panDown',    scope: 'general', label: 'Pan camera down' },
  { id: 'abil1',      scope: 'ability', label: 'Ability slot 1' },
  { id: 'abil2',      scope: 'ability', label: 'Ability slot 2' },
  { id: 'abil3',      scope: 'ability', label: 'Ability slot 3' },
  { id: 'abil4',      scope: 'ability', label: 'Ability slot 4' },
  { id: 'abil5',      scope: 'ability', label: 'Ability slot 5' },
  // quick-hire: the N most recently hired troop types (no per-troop keys — the roster can grow forever)
  ...Array.from({ length: 3 }, (_, i) => ({ id: 'recent' + (i + 1), scope: 'shop', label: `Hire recent troop #${i + 1}` })),
  ...Array.from({ length: 6 }, (_, i) => ({ id: 'item' + (i + 1), scope: 'item', label: `Use item slot ${i + 1}` })),
  ...Array.from({ length: 5 }, (_, i) => ({ id: 'group' + (i + 1), scope: 'group', label: `Unit group ${i + 1} (Alt = set, Ctrl = select)` })),
  ...['Circle', 'Square', 'Line', 'Custom'].map((n, i) => ({ id: 'formation' + (i + 1), scope: 'formation', label: `Formation: ${n} (Alt + key)` })),
];
export const ITEM_SLOTS = ACTIONS.filter((a) => a.scope === 'item').map((a) => a.id);
export const RECENT_SLOTS = ACTIONS.filter((a) => a.scope === 'shop').map((a) => a.id);
export const GROUP_SLOTS = ACTIONS.filter((a) => a.scope === 'group').map((a) => a.id);
export const FORMATION_SLOTS = ACTIONS.filter((a) => a.scope === 'formation').map((a) => a.id);
export const SCOPE_LABEL = { general: 'General', ability: 'Abilities (selected troop)', shop: 'Shop: recent troops (only while the shop is open)', item: 'Items (selected troop)', group: 'Unit groups · Alt + key = set, Ctrl + key = select (double-tap = jump)', formation: 'Formations · Alt + key (faces the cursor)' };
export const scopeOf = (actionId) => ACTIONS.find((a) => a.id === actionId)?.scope;

export const DEFAULTS = {
  keys: {
    attackMove: 'KeyA',
    stop: 'KeyS',
    charge: 'KeyC',
    shop: 'KeyB',
    barracks: 'KeyV',
    skills: 'KeyN',
    build: 'KeyG',
    repair: 'KeyH',
    autoLoot: 'KeyL',
    chat: 'Enter',
    selectAll: 'KeyF',
    centerUnits: 'Space',
    centerBase: 'Backquote',
    panLeft: 'ArrowLeft',
    panRight: 'ArrowRight',
    panUp: 'ArrowUp',
    panDown: 'ArrowDown',
    abil1: 'KeyQ',
    abil2: 'KeyW',
    abil3: 'KeyE',
    abil4: 'KeyR',
    abil5: 'KeyT',
    recent1: 'Digit1',
    recent2: 'Digit2',
    recent3: 'Digit3',
    item1: 'Digit1', item2: 'Digit2', item3: 'Digit3', item4: 'Digit4', item5: 'Digit5', item6: 'Digit6',
    group1: 'KeyZ', group2: 'KeyX', group3: 'KeyC', group4: 'KeyV', group5: 'KeyB',
    formation1: 'Digit1', formation2: 'Digit2', formation3: 'Digit3', formation4: 'Digit4',
  },
  audio: { master: 0.8, music: 0.4, sfx: 0.8, mute: false },
  graphics: { quality: 'medium', pixelated: false, showFps: false, hpBars: 'always', uiScale: 1, damageNumbers: 'crits', critHighlight: true, combatText: true },
  gameplay: { shopView: 'list', edgePan: true, panSpeed: 1.0, zoomSpeed: 1.0, quickCast: false, customFormation: null },
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
    const out = deepMerge(DEFAULTS, raw ? JSON.parse(raw) : null);
    // v0.27: Space moved from "base" to "selected troops"; old saves had the base on Space too
    if (out.keys.centerBase === out.keys.centerUnits) out.keys.centerBase = DEFAULTS.keys.centerBase;
    return out;
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
