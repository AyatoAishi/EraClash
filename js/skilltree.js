// ============================================================
//  SKILL TREES — troop evolutions (per match).
//
//  Every troop TYPE on a team has one kill pool: any Viking (whatever its form) that kills a unit adds 1.
//  Kills turn into a level (LEVELING). A level does nothing by itself — it only unlocks tree nodes.
//
//  A node is a FORM of the same troop (not a new unit): same id, same price, same Barracks upgrades.
//  Picking one is free and instant, and from then on every troop you hire of that type comes out in
//  that form. Troops already on the field keep the form they were born with.
//
//  Node fields:
//    name        shown everywhere instead of the base name
//    from        parent node id (null = picked from the base troop)
//    level       troop level needed to pick it
//    stats       BASE stat changes, on top of the parent node's (so a tier-2 form keeps tier-1 bonuses)
//    cost        optional price change (+/- gold), also stacks with the parent
//    abilities   passives/actives added (kept by children)
//    abilityMods { abilityId: { field: value } } overrides for an ability's numbers (children inherit)
//    look        { eyes: 0xRRGGBB, hair: { fromColor: toColor } }  -> model recolor (eyes glow)
//    desc        one line for the tree card
//  Add a tree: one entry in SKILL_TREES keyed by the unit id. Nothing else to wire.
// ============================================================
import { UNITS, ABILITIES } from './config.js';

export const LEVELING = {
  // kills needed to go from level L-1 to L: 5, 10, 15, 20 ... (Lv 5 = 75 kills, Lv 15 = 600)
  killsFor: (L) => 5 * L,
  maxLevel: 30,
};

/** Level reached with `kills` kills, plus progress toward the next one. */
export function levelInfo(kills) {
  let L = 0, spent = 0;
  while (L < LEVELING.maxLevel && kills >= spent + LEVELING.killsFor(L + 1)) { spent += LEVELING.killsFor(L + 1); L++; }
  const need = L >= LEVELING.maxLevel ? 0 : LEVELING.killsFor(L + 1);
  return { level: L, into: kills - spent, need, max: L >= LEVELING.maxLevel };
}

export const SKILL_TREES = {
  viking: {
    frenzy: {
      name: 'Frenzy Viking', from: null, level: 5,
      stats: { hpRegen: 1 }, abilities: ['fury'],
      look: { eyes: 0xff3b2f, hair: { 0xc8642a: 0x8e1b1b, 0xa84f1e: 0x6a1010 } },
      desc: 'Stacks Fury on what he hits: every Viking deals +2 damage per stack to it.',
    },
    lightning: {
      name: 'Lightning Viking', from: null, level: 5,
      stats: { attackSpeed: 10 }, abilities: ['chainLightning'],
      look: { eyes: 0x6fe3ff, hair: { 0xc8642a: 0xe8e2c8, 0xa84f1e: 0xc9c2a2 } },
      desc: 'Faster swings, and his hits can arc lightning through a crowd.',
    },
    chaotic: {
      name: 'Chaotic Viking', from: 'frenzy', level: 15,
      stats: { hpRegen: 2 }, abilityMods: { fury: { maxStacks: 0 } },
      look: { eyes: 0xffe14a, hair: { 0xc8642a: 0x2a0a0a, 0xa84f1e: 0x1a0505 } },
      desc: 'Fury stacks without limit.',
    },
    storm: {
      name: 'Storm Viking', from: 'lightning', level: 15,
      stats: { attackSpeed: 20, moveSpeed: 0.3 }, abilityMods: { chainLightning: { damage: 20, chance: 0.3 } },
      look: { eyes: 0xffffff, hair: { 0xc8642a: 0x5a7bd8, 0xa84f1e: 0x3e5ab0 } },
      desc: 'Chain Lightning hits for 20 and fires 30% of the time.',
    },
  },
};

export const treeOf = (unitId) => SKILL_TREES[unitId] || null;
export const hasTree = (unitId) => !!SKILL_TREES[unitId];
/** Path from the base troop to `formId` (root first). */
export function formPath(unitId, formId) {
  const t = SKILL_TREES[unitId], path = [];
  for (let f = formId; f && t?.[f]; f = t[f].from) path.unshift(f);
  return path;
}
/** Nodes you could pick next from `formId` (null = base). */
export const nextForms = (unitId, formId) => Object.entries(SKILL_TREES[unitId] || {}).filter(([, n]) => (n.from ?? null) === (formId ?? null)).map(([id]) => id);

const cache = new Map();
/**
 * The unit definition for a form: base def + every node on the path (stats add up, abilities and mods
 * accumulate, the last node's name and look win). Same `id`, so upgrades, rosters and stats keep working.
 */
export function formDef(unitId, formId) {
  const base = UNITS[unitId];
  if (!formId || !SKILL_TREES[unitId]?.[formId]) return base;
  const key = unitId + ':' + formId;
  if (cache.has(key)) return cache.get(key);
  const d = { ...base, abilities: [...(base.abilities || [])], form: formId, baseName: base.name, abilityMods: {} };
  for (const f of formPath(unitId, formId)) {
    const n = SKILL_TREES[unitId][f];
    for (const [k, v] of Object.entries(n.stats || {})) d[k] = Math.round(((d[k] || 0) + v) * 100) / 100;
    if (n.cost) d.cost += n.cost;
    for (const a of n.abilities || []) if (!d.abilities.includes(a) && ABILITIES[a]) d.abilities.push(a);
    for (const [a, m] of Object.entries(n.abilityMods || {})) d.abilityMods[a] = { ...(d.abilityMods[a] || {}), ...m };
    d.name = n.name;
    if (n.look) d.look = n.look;
  }
  cache.set(key, d);
  return d;
}
