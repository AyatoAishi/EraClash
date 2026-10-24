import { UNITS, FACTIONS } from './config.js';
// ============================================================
//  BARRACKS UPGRADES — per match only (reset every game).
//  max: number of levels (Infinity = unlimited)
//  price / time: array (per level) or { base, step } (base + step * currentLevel)
//  effects: declarative, applied by Game.applyUpgrade(). Passive tweaks read their level
//           at runtime through game.upLevel(team, id) (see unit.js).
//  icon: SVG symbol id in index.html (every upgrade has its own)
// ============================================================

const BASE_TIME = { base: 6, step: 1.5, cap: 30 };   // unlimited upgrades: 6s, +1.5s per level, max 30s
/** Stat boost upgrades: base + 10% per level on the troop's BASE stats, its hiring cost, the upgrade price and research time. */
export const STAT_BOOST = {
  pct: 0.10,                                       // +10% per level (stats, troop cost, upgrade price, research time)
  stats: ['hp', 'armor', 'ward', 'damage', 'hpRegen'],
  priceMult: 2,                                    // Lv 1 price = troop's base hiring cost x this (set 3 for pricier boosts)
  baseTime: 2,                                     // Lv 1 research time (s); +10% (0.2s) per level
};
const STAT_BOOST_TIME = { base: STAT_BOOST.baseTime, pct: STAT_BOOST.pct };
const boostPrice = (unitId) => ({ base: UNITS[unitId].cost * STAT_BOOST.priceMult, pct: STAT_BOOST.pct });

export const UPGRADES = {
  // ===================== MEDIEVAL =====================
  oneManArmy: {
    id: 'oneManArmy', faction: 'medieval', category: 'troop', unit: 'viking', icon: 'u-onemanarmy',
    name: 'One Man Army', max: 5,
    price: [50, 100, 200, 400, 600], time: [8, 12, 16, 20, 25],
    values: { damage: [1, 2, 3, 4, 5], hpRegen: [0.1, 0.2, 0.3, 0.4, 0.5], armor: [0.5, 1, 1.5, 2, 2.5], lifestealAtMax: 20 },
    desc: 'Improves <b>Lone Wolf</b>: extra damage, HP regen and armor while it\'s active. Max level: Lone Wolf also grants <b>20% lifesteal</b>.',
    levelText: (l, U) => `Lone Wolf +${U.values.damage[l - 1]} dmg, +${U.values.hpRegen[l - 1]} regen, +${U.values.armor[l - 1]} armor${l === 5 ? ', 20% lifesteal' : ''}`,
  },
  proteinBoost: {
    id: 'proteinBoost', faction: 'medieval', category: 'troop', unit: 'viking', icon: 'u-protein', kind: 'statBoost',
    name: 'Protein Boost', max: Infinity,
    price: boostPrice('viking'), time: STAT_BOOST_TIME,
    effects: [{ type: 'statBoost', unit: 'viking', pct: STAT_BOOST.pct }],
    desc: 'Stat boost: every Viking gets <b>+10% base HP, armor, ward, damage and HP regen</b> per level. Lv 1 costs 2x the troop\'s base hiring cost. Each level also makes the Viking cost +10% of its base price, and the next level of this upgrade costs and takes +10% more.',
    levelText: (l) => `+${10 * l}% base HP / armor / ward / damage / regen · cost +${10 * l}%`,
  },

  flurry: {
    id: 'flurry', faction: 'medieval', category: 'troop', unit: 'archer', icon: 'u-flurry',
    name: 'Flurry', max: 5,
    price: [100, 250, 400, 550, 700], time: [10, 14, 18, 22, 26],
    effects: [{ type: 'grantAbility', unit: 'archer', ability: 'flurry' }],
    desc: 'Rangers gain the active <b>Flurry</b> (Q-slot after their passive): +60/90/120/150/180 attack speed for 4s.',
    levelText: (l) => `Flurry: +${[60, 90, 120, 150, 180][l - 1]} attack speed for 4s`,
  },
  accuracyTraining: {
    id: 'accuracyTraining', faction: 'medieval', category: 'troop', unit: 'archer', icon: 'u-accuracy', kind: 'statBoost',
    name: 'Accuracy Training', max: Infinity,
    price: boostPrice('archer'), time: STAT_BOOST_TIME,
    effects: [{ type: 'statBoost', unit: 'archer', pct: STAT_BOOST.pct }],
    desc: 'Stat boost: every Ranger (incl. Battlement rangers) gets <b>+10% base HP, armor, ward, damage and HP regen</b> per level. Lv 1 costs 2x the troop\'s base hiring cost. Each level also makes the Ranger cost +10% of its base price, and the next level of this upgrade costs and takes +10% more.',
    levelText: (l) => `+${10 * l}% base HP / armor / ward / damage / regen · cost +${10 * l}%`,
  },

  organicMatter: {
    id: 'organicMatter', faction: 'medieval', category: 'troop', unit: 'imp', icon: 'u-organic',
    name: 'Organic Matter', max: 5,
    price: [80, 160, 260, 400, 600], time: [10, 14, 18, 22, 28],
    values: { damage: [10, 20, 30, 40, 50], slow: [10, 15, 20, 25, 30], slowTime: 3 },
    effects: [{ type: 'grantAtMax', unit: 'imp', ability: 'deathSplatter' }],
    desc: 'Improves <b>Splatter</b>: +10–50 damage and a 10–30% slow for 3s. Max level: Imps gain <b>Death Splatter</b> (auto-explode on death).',
    levelText: (l, U) => `Splatter +${U.values.damage[l - 1]} dmg, ${U.values.slow[l - 1]}% slow 3s${l === 5 ? ', Death Splatter' : ''}`,
  },
  hellWorkout: {
    id: 'hellWorkout', faction: 'medieval', category: 'troop', unit: 'imp', icon: 'u-hellwork', kind: 'statBoost',
    name: 'Hell Workout', max: Infinity,
    price: boostPrice('imp'), time: STAT_BOOST_TIME,
    effects: [{ type: 'statBoost', unit: 'imp', pct: STAT_BOOST.pct }],
    desc: 'Stat boost: every Imp gets <b>+10% base HP, armor, ward, damage and HP regen</b> per level. Lv 1 costs 2x the troop\'s base hiring cost. Each level also makes the Imp cost +10% of its base price, and the next level of this upgrade costs and takes +10% more.',
    levelText: (l) => `+${10 * l}% base HP / armor / ward / damage / regen · cost +${10 * l}%`,
  },

  battlement: {
    id: 'battlement', faction: 'medieval', category: 'base', icon: 'u-battlement',
    name: 'Battlement', max: 5,
    price: [100, 200, 400, 800, 1600], time: [12, 16, 20, 25, 30],
    effects: [{ type: 'towers', unit: 'archer', rangeBonus: 15 }],
    desc: 'Adds <b>+1 Ranger on the castle walls</b> per level (+15 range, invulnerable, can\'t be selected). Benefits from Ranger upgrades.',
    levelText: (l) => `${l} wall ranger${l > 1 ? 's' : ''}`,
  },

  // ===================== MODERN =====================
  riotTraining: {
    id: 'riotTraining', faction: 'modern', category: 'troop', unit: 'police', icon: 'u-riot',
    name: 'Riot Training', max: 5,
    price: [60, 120, 220, 400, 600], time: [8, 12, 16, 20, 25],
    values: { armorPerOfficer: [0.5, 0.875, 1.25, 1.625, 2], backupHeal: 25 },
    desc: 'Improves <b>Thin Blue Line</b>: each nearby officer also gives +0.5–2 armor. Max level: <b>Backup</b> — when an officer dies, officers within 10 range heal 25 HP.',
    levelText: (l, U) => `+${U.values.armorPerOfficer[l - 1]} armor per nearby officer${l === 5 ? ', Backup heal' : ''}`,
  },
  kevlar: {
    id: 'kevlar', faction: 'modern', category: 'troop', unit: 'police', icon: 'u-kevlar', kind: 'statBoost',
    name: 'Kevlar Program', max: Infinity,
    price: boostPrice('police'), time: STAT_BOOST_TIME,
    effects: [{ type: 'statBoost', unit: 'police', pct: STAT_BOOST.pct }],
    desc: 'Stat boost: every Police Officer gets <b>+10% base HP, armor, ward, damage and HP regen</b> per level. Lv 1 costs 2x the troop\'s base hiring cost. Each level also makes the Police Officer cost +10% of its base price, and the next level of this upgrade costs and takes +10% more.',
    levelText: (l) => `+${10 * l}% base HP / armor / ward / damage / regen · cost +${10 * l}%`,
  },

  suppressiveFire: {
    id: 'suppressiveFire', faction: 'modern', category: 'troop', unit: 'gunner', icon: 'u-suppress',
    name: 'Suppressive Fire', max: 5,
    price: [100, 250, 400, 550, 700], time: [10, 14, 18, 22, 26],
    effects: [{ type: 'grantAbility', unit: 'gunner', ability: 'suppressiveFire' }],
    desc: 'Gunners gain the active <b>Suppressive Fire</b>: for 4s their shots deal +2–10 damage and knock the target back 0.3–0.5.',
    levelText: (l) => `Suppressive Fire: +${[2, 4, 6, 8, 10][l - 1]} dmg, ${[0.3, 0.35, 0.4, 0.45, 0.5][l - 1]} knockback`,
  },
  drills: {
    id: 'drills', faction: 'modern', category: 'troop', unit: 'gunner', icon: 'u-drills', kind: 'statBoost',
    name: 'Marksmanship Drills', max: Infinity,
    price: boostPrice('gunner'), time: STAT_BOOST_TIME,
    effects: [{ type: 'statBoost', unit: 'gunner', pct: STAT_BOOST.pct }],
    desc: 'Stat boost: every Gunner (incl. Overwatch gunners) gets <b>+10% base HP, armor, ward, damage and HP regen</b> per level. Lv 1 costs 2x the troop\'s base hiring cost. Each level also makes the Gunner cost +10% of its base price, and the next level of this upgrade costs and takes +10% more.',
    levelText: (l) => `+${10 * l}% base HP / armor / ward / damage / regen · cost +${10 * l}%`,
  },

  hollowPoints: {
    id: 'hollowPoints', faction: 'modern', category: 'troop', unit: 'sniper', icon: 'u-hollow',
    name: 'Hollow Points', max: 5,
    price: [75, 150, 250, 375, 550], time: [10, 14, 18, 22, 28],
    values: { critBonus: [0.1, 0.2, 0.3, 0.4, 0.5] },
    desc: 'Improves <b>Bull\'s Eye</b>: crit damage +10–50% (up to +120%). Max level: crits every <b>3rd</b> attack instead of 4th.',
    levelText: (l, U) => `Bull's Eye crit +${70 + U.values.critBonus[l - 1] * 100}%${l === 5 ? ', every 3rd shot' : ''}`,
  },
  ghillie: {
    id: 'ghillie', faction: 'modern', category: 'troop', unit: 'sniper', icon: 'u-ghillie', kind: 'statBoost',
    name: 'Ghillie Conditioning', max: Infinity,
    price: boostPrice('sniper'), time: STAT_BOOST_TIME,
    effects: [{ type: 'statBoost', unit: 'sniper', pct: STAT_BOOST.pct }],
    desc: 'Stat boost: every Sniper gets <b>+10% base HP, armor, ward, damage and HP regen</b> per level. Lv 1 costs 2x the troop\'s base hiring cost. Each level also makes the Sniper cost +10% of its base price, and the next level of this upgrade costs and takes +10% more.',
    levelText: (l) => `+${10 * l}% base HP / armor / ward / damage / regen · cost +${10 * l}%`,
  },

  overwatch: {
    id: 'overwatch', faction: 'modern', category: 'base', icon: 'u-overwatch',
    name: 'Rooftop Overwatch', max: 5,
    price: [100, 200, 400, 800, 1600], time: [12, 16, 20, 25, 30],
    effects: [{ type: 'towers', unit: 'gunner', rangeBonus: 15 }],
    desc: 'Adds <b>+1 Gunner on the HQ roof</b> per level (+15 range, invulnerable, can\'t be selected). Benefits from Gunner upgrades.',
    levelText: (l) => `${l} rooftop gunner${l > 1 ? 's' : ''}`,
  },

  // ===================== SHARED (both factions) =====================
  repairCrews: {
    id: 'repairCrews', faction: 'both', category: 'base', icon: 'u-repair',
    name: 'Repair Crews', max: Infinity,
    price: { base: 100, step: 100 }, time: { base: 8, step: 2, cap: 30 },
    desc: 'Base <b>Repair</b> heals +6 HP/s more per level, but drains +3 gold/s more.',
    levelText: (l) => `Repair: ${10 + 6 * l} HP/s for ${5 + 3 * l} gold/s`,
  },
  logistics: {
    id: 'logistics', faction: 'both', category: 'base', icon: 'u-logistics',
    name: 'Logistics', max: 5,
    price: [150, 300, 500, 750, 1000], time: [15, 20, 25, 32, 40],
    values: { speed: [0.08, 0.16, 0.24, 0.32, 0.4] },
    desc: '<b>Research and troop training</b> are 8% faster per level (up to 40%).',
    levelText: (l) => `Research & training ${8 * l}% faster`,
  },
  reinforce: {
    id: 'reinforce', faction: 'both', category: 'base', icon: 'u-reinforce',
    name: 'Reinforce', max: Infinity,
    price: { base: 200, step: 100 }, time: { base: 8, step: 2, cap: 30 },
    effects: [{ type: 'baseHP', perLevel: 100 }],
    desc: 'Your base gains <b>+100 max HP</b> (and is healed by 100).',
    levelText: (l) => `+${100 * l} base HP`,
  },
  finance: {
    id: 'finance', faction: 'both', category: 'base', icon: 'u-finance',
    name: 'Finance', max: Infinity,
    price: { base: 100, step: 400 }, time: { base: 10, step: 5, cap: 30 },
    effects: [{ type: 'income', perLevel: 0.5 }],
    desc: 'Passive income <b>+0.5 gold per second</b>.',
    levelText: (l) => `+${(0.5 * l).toFixed(1)} gold/s`,
  },
};

const r2 = (n) => Math.round(n * 100) / 100;
// array (per level) | { base, step, cap } (linear add) | { base, pct } (base + pct of base per level)
const pick = (v, lvl) => (Array.isArray(v) ? v[lvl] : v.pct !== undefined ? r2(v.base * (1 + v.pct * lvl)) : Math.min(v.cap ?? Infinity, v.base + v.step * lvl));
/** Price of the NEXT level when the current level is `lvl` (0 = not bought). */
export const upgradePrice = (U, lvl) => pick(U.price, lvl);
export const upgradeTime = (U, lvl) => pick(U.time, lvl);
/**
 * What a faction can research:
 *  - BASE upgrades: the faction's own (faction: id) + shared ones (faction: 'both'). These stay faction-bound
 *    (Battlement always puts Rangers on the castle, Overwatch always Gunners on the HQ).
 *  - TROOP upgrades follow the UNIT, not the faction: available for every unit the faction can field —
 *    its hiring roster AND the units its base upgrades spawn (so Battlement archers can still get
 *    Accuracy Training even if Rangers are removed from the roster). The troop upgrade's `faction` field is ignored.
 */
export const upgradesFor = (factionId) => {
  const base = (u) => u.category === 'base' && (u.faction === factionId || u.faction === 'both');
  const units = new Set(FACTIONS[factionId]?.units || []);
  for (const U of Object.values(UPGRADES)) if (base(U)) for (const e of U.effects || []) if (e.type === 'towers') units.add(e.unit);
  return Object.values(UPGRADES).filter((U) => base(U) || (U.category === 'troop' && units.has(U.unit)));
};
