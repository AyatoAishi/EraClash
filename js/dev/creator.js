// DEV LAB — "Create +": a troop concept form. Fill it in, press Copy, paste it to Claude (or a teammate).
// Nothing here changes the game; it only builds the text spec in the same format we use in chat.
// "Load existing" pre-fills the form from a unit already in config.js (handy for balance changes).
import { UNITS, ABILITIES, FACTIONS } from '../config.js';
import { UPGRADES } from '../upgrades.js';

const DRAFT_KEY = 'eraclash.creator.draft.v1';
const UNIT_FIELDS = [
  ['name', 'Name'], ['roster', 'Roster', ['medieval', 'modern', 'both', 'none']], ['role', 'Role'],
  ['family', 'Family', ['melee', 'marksman']], ['type', 'Type', ['melee', 'ranged']], ['flying', 'Flying', ['no', 'yes']],
  ['cost', 'Cost', 'n'], ['trainTime', 'Train time (s)', 'n'], ['hp', 'HP', 'n'], ['hpRegen', 'HP regen', 'n'],
  ['damage', 'Damage', 'n'], ['damageType', 'Damage type', ['physical', 'magic', 'true']], ['attackSpeed', 'Attack speed (per min)', 'n'],
  ['armor', 'Armor', 'n'], ['ward', 'Ward', 'n'], ['evasion', 'Evasion %', 'n'], ['missChance', 'Miss %', 'n'],
  ['moveSpeed', 'Move speed', 'n'], ['range', 'Range', 'n'], ['visionDay', 'Vision day', 'n'], ['visionNight', 'Vision night', 'n'],
  ['mana', 'Mana (blank = none)', 'n'], ['manaRegen', 'Mana regen', 'n'], ['projectile', 'Projectile'], ['look', 'Look', 'long'], ['lore', 'Lore', 'long'],
];
const ABIL_FIELDS = [
  ['name', 'Name'], ['kind', 'Kind', ['passive', 'active']], ['breakable', 'Breakable', ['yes', 'no']], ['affectsFlying', 'Affects flying', ['yes', 'no', '-']],
  ['unlock', 'Unlocked by', ['built in', 'Barracks upgrade', 'skill tree']], ['does', 'What it does', 'long'], ['numbers', 'Numbers', 'long'],
  ['cooldown', 'Cooldown (s)', 'n'], ['manaCost', 'Mana cost', 'n'], ['cast', 'Cast', ['-', 'instant', 'target unit', 'target ground (aimed)', 'toggle', 'channel']],
  ['castTime', 'Cast time (s)', 'n'], ['ai', 'AI use'],
];
const UPG_FIELDS = [
  ['name', 'Name'], ['type', 'Type', ['stat boost', 'improves an ability', 'grants an ability', 'other']], ['max', 'Max level'],
  ['effect', 'Effect per level', 'long'], ['prices', 'Prices (e.g. 250/500/1000)'], ['times', 'Times (e.g. 10/15/20)'],
];

function el(tag, props = {}, ...kids) {
  const e = document.createElement(tag);
  for (const [k, v] of Object.entries(props)) {
    if (k === 'class') e.className = v; else if (k.startsWith('on')) e.addEventListener(k.slice(2), v);
    else if (v !== undefined && v !== null && v !== false) e.setAttribute(k, v === true ? '' : v);
  }
  for (const c of kids.flat()) if (c !== null && c !== undefined && c !== false) e.append(c);
  return e;
}
function input(def, val, onInput) {
  const [key, , kind] = def;
  let i;
  if (Array.isArray(kind)) { i = el('select', {}, kind.map((o) => el('option', { value: o }, o))); i.value = val ?? kind[0]; }
  else if (kind === 'long') { i = el('textarea', { rows: 2 }); i.value = val ?? ''; }
  else { i = el('input', { type: 'text', inputmode: kind === 'n' ? 'decimal' : undefined }); i.value = val ?? ''; }
  i.addEventListener('input', () => onInput(key, i.value));
  i.addEventListener('change', () => onInput(key, i.value));
  return i;
}
const blank = () => ({ unit: {}, abilities: [{}], upgrades: [{}, {}], tree: '' });

export class Creator {
  constructor() {
    try { this.data = JSON.parse(localStorage.getItem(DRAFT_KEY)) || blank(); } catch { this.data = blank(); }
    this.root = el('div', { class: 'cr-wrap' });
    this.root.addEventListener('mousedown', (e) => e.stopPropagation());
    this.root.addEventListener('keydown', (e) => { if (e.key === 'Escape') this.close(); e.stopPropagation(); });
    document.body.append(this.root);
  }
  save() { try { localStorage.setItem(DRAFT_KEY, JSON.stringify(this.data)); } catch { /* private mode */ } }
  get isOpen() { return this.root.classList.contains('open'); }
  open() { this.render(); this.root.classList.add('open'); }
  close() { this.root.classList.remove('open'); }

  /** Pre-fill from an existing unit (+ its abilities and the Barracks upgrades that target it). */
  loadUnit(id) {
    const u = UNITS[id]; if (!u) return;
    const roster = Object.values(FACTIONS).filter((f) => f.units.includes(id)).map((f) => f.id);
    this.data.unit = {
      name: u.name, roster: roster.length > 1 ? 'both' : roster[0] || 'none', role: u.role, family: u.family, type: u.type, flying: u.flying ? 'yes' : 'no',
      cost: u.cost, trainTime: u.trainTime, hp: u.hp, hpRegen: u.hpRegen, damage: u.damage, damageType: u.damageType, attackSpeed: u.attackSpeed,
      armor: u.armor, ward: u.ward, evasion: u.evasion, missChance: u.missChance, moveSpeed: u.moveSpeed, range: u.range,
      visionDay: u.vision?.[0], visionNight: u.vision?.[1], mana: u.mana ?? '', manaRegen: u.manaRegen ?? '', projectile: u.projectile?.kind || 'none', lore: u.lore,
    };
    const ups = Object.values(UPGRADES).filter((U) => U.unit === id);
    const granted = ups.flatMap((U) => (U.effects || []).filter((e) => e.ability).map((e) => e.ability));
    this.data.abilities = [...(u.abilities || []), ...granted].filter((a, k, arr) => ABILITIES[a] && arr.indexOf(a) === k).map((a) => {
      const A = ABILITIES[a];
      return { name: A.name, kind: A.kind, breakable: A.unbreakable ? 'no' : 'yes', affectsFlying: A.affectsFlying === undefined ? '-' : A.affectsFlying ? 'yes' : 'no',
        unlock: (u.abilities || []).includes(a) ? 'built in' : 'Barracks upgrade', does: A.desc, cooldown: A.cooldown ?? '', manaCost: A.manaCost ?? '',
        cast: A.kind === 'active' ? (A.cast === 'line' ? 'target ground (aimed)' : 'instant') : '-', castTime: A.castTime ?? '' };
    });
    if (!this.data.abilities.length) this.data.abilities = [{}];
    this.data.upgrades = ups.map((U) => ({
      name: U.name, type: U.kind === 'statBoost' ? 'stat boost' : (U.effects || []).some((e) => e.type === 'grantAbility') ? 'grants an ability' : 'improves an ability',
      max: U.max === Infinity ? 'infinite' : U.max, effect: U.levelText ? U.levelText(1, U) + ' (Lv 1)' : '',
      prices: Array.isArray(U.price) ? U.price.join(' / ') : U.price?.pct !== undefined ? `${U.price.base}, +${U.price.pct * 100}% per level` : '',
      times: Array.isArray(U.time) ? U.time.join(' / ') : U.time?.pct !== undefined ? `${U.time.base}s, +${U.time.pct * 100}% per level` : '',
    }));
    if (!this.data.upgrades.length) this.data.upgrades = [{}];
    this.save(); this.render();
  }

  /** The text spec (same template we use in chat). */
  text() {
    const d = this.data, U = d.unit, v = (x) => (x === undefined || x === null || x === '' ? '' : x);
    const L = ['=== UNIT ==='];
    for (const [k, label] of UNIT_FIELDS) {
      if (k === 'visionNight') continue;
      if (k === 'visionDay') { L.push(`Vision day/night: ${v(U.visionDay)} / ${v(U.visionNight)}`); continue; }
      if ((k === 'mana' || k === 'manaRegen') && !v(U[k])) continue;
      L.push(`${label.replace(/ \(.*\)$/, '')}: ${v(U[k])}`);
    }
    L.push('', '=== ABILITIES ===');
    d.abilities.filter((a) => Object.values(a).some((x) => v(x))).forEach((a) => {
      for (const [k, label] of ABIL_FIELDS) if (v(a[k]) && a[k] !== '-') L.push(`${label.replace(/ \(.*\)$/, '')}: ${a[k]}`);
      L.push('');
    });
    L.push('=== BARRACKS UPGRADES ===');
    const ups = d.upgrades.filter((a) => Object.values(a).some((x) => v(x)));
    if (!ups.length) L.push('none', '');
    ups.forEach((a) => { for (const [k, label] of UPG_FIELDS) if (v(a[k])) L.push(`${label.replace(/ \(.*\)$/, '')}: ${a[k]}`); L.push(''); });
    if (v(d.tree)) L.push('=== SKILL TREE ===', d.tree, '');
    return L.join('\n').replace(/\n{3,}/g, '\n\n').trim() + '\n';
  }

  render() {
    const d = this.data;
    const set = (obj) => (k, val) => { obj[k] = val; this.save(); this.preview.textContent = this.text(); };
    const grid = (fields, obj) => el('div', { class: 'cr-grid' }, fields.map((f) => el('label', { class: f[2] === 'long' ? 'wide' : '' }, el('span', {}, f[1]), input(f, obj[f[0]], set(obj)))));
    const listBlock = (title, arr, fields, what) => el('div', { class: 'cr-sec' },
      el('h4', {}, title, el('button', { class: 'dl-b', onclick: () => { arr.push({}); this.save(); this.render(); } }, `+ ${what}`)),
      arr.map((obj, k) => el('div', { class: 'cr-card' },
        el('div', { class: 'cr-card-h' }, `${what} ${k + 1}`, el('button', { class: 'dl-b', title: 'Remove', onclick: () => { arr.splice(k, 1); this.save(); this.render(); } }, '✕')),
        grid(fields, obj))));
    const pick = el('select', {}, el('option', { value: '' }, 'Load existing unit…'), Object.values(UNITS).map((u) => el('option', { value: u.id }, u.name)));
    pick.addEventListener('change', () => pick.value && this.loadUnit(pick.value));
    const tree = el('textarea', { rows: 6, placeholder: 'e.g.\nLv 5: pick one\n  A) Lightning Viking: attacks chain to 2 enemies for 30%\n     Lv 10: chains to 4\n  B) Blood Viking: 15% lifesteal\n     Lv 10A: ...  Lv 10B: ...' });
    tree.value = d.tree || '';
    tree.addEventListener('input', () => { d.tree = tree.value; this.save(); this.preview.textContent = this.text(); });
    this.preview = el('pre', { class: 'cr-preview' }, this.text());
    const status = el('span', { class: 'cr-status' });
    const copy = async () => {
      const t = this.text();
      try { await navigator.clipboard.writeText(t); status.textContent = 'Copied! Paste it to Claude.'; }
      catch { const ta = el('textarea'); ta.value = t; document.body.append(ta); ta.select(); document.execCommand('copy'); ta.remove(); status.textContent = 'Copied!'; }
      setTimeout(() => (status.textContent = ''), 2500);
    };
    this.root.replaceChildren(el('div', { class: 'cr-modal frame' },
      el('header', {}, el('b', {}, 'CREATE TROOP CONCEPT'), pick,
        el('button', { class: 'dl-b', onclick: () => { if (confirmClear()) { this.data = blank(); this.save(); this.render(); } } }, 'Clear'),
        el('button', { class: 'dl-b', onclick: () => this.close() }, '✕')),
      el('div', { class: 'cr-body' },
        el('div', { class: 'cr-form' },
          el('div', { class: 'cr-sec' }, el('h4', {}, 'Unit'), grid(UNIT_FIELDS, d.unit)),
          listBlock('Abilities', d.abilities, ABIL_FIELDS, 'Ability'),
          listBlock('Barracks upgrades', d.upgrades, UPG_FIELDS, 'Upgrade'),
          el('div', { class: 'cr-sec' }, el('h4', {}, 'Skill tree branches (free text)'), tree)),
        el('div', { class: 'cr-side' }, el('div', { class: 'cr-side-h' }, 'Preview', el('button', { class: 'dl-b cr-copy', onclick: copy }, '⧉ Copy'), status), this.preview))));
    function confirmClear() { return !Object.keys(d.unit).length || window.confirm('Clear the whole form?'); }
  }
}
