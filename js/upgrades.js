import { UNITS, FACTIONS, BASE_LEVELS } from './config.js';
import { CASTLE_TIERS, HQ_TIERS } from './models.js';
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

// Fortify / Expand HQ: upgrade level l = base level 1 + l (matches start at level 1)
const BASE_LEVEL_PRICE = [300, 600, 1200, 2000];
const BASE_LEVEL_TIME = [20, 30, 40, 50];
const baseLevelText = (l, tiers) => {
  const S = BASE_LEVELS[l];
  return `Lv ${l + 1} ${tiers[l].name}: ${S.hp} HP, ${S.armor} armor, ${S.slots} wall spots`;
};

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

  criticalStrike: {
    id: 'criticalStrike', faction: 'medieval', category: 'troop', unit: 'lancer', icon: 'u-crit',
    name: 'Critical Strike', max: 5,
    price: [250, 500, 1000, 2000, 4000], time: [10, 15, 20, 25, 30],
    effects: [{ type: 'grantAbility', unit: 'lancer', ability: 'critStrike' }],
    desc: 'Lancers gain the passive <b>Critical Strike</b>: 30% chance to deal +80/100/120/140/160% damage.',
    levelText: (l) => `Critical Strike: 30% for +${[80, 100, 120, 140, 160][l - 1]}% damage`,
  },
  cavalryTraining: {
    id: 'cavalryTraining', faction: 'medieval', category: 'troop', unit: 'lancer', icon: 'u-cavalry', kind: 'statBoost',
    name: 'Cavalry Training', max: Infinity,
    price: boostPrice('lancer'), time: STAT_BOOST_TIME,
    effects: [{ type: 'statBoost', unit: 'lancer', pct: STAT_BOOST.pct }],
    desc: 'Stat boost: every Lancer gets <b>+10% base HP, armor, ward, damage and HP regen</b> per level. Lv 1 costs 2x the troop\'s base hiring cost. Each level also makes the Lancer cost +10% of its base price, and the next level of this upgrade costs and takes +10% more.',
    levelText: (l) => `+${10 * l}% base HP / armor / ward / damage / regen · cost +${10 * l}%`,
  },
  arrowPiercer: {
    id: 'arrowPiercer', faction: 'medieval', category: 'troop', unit: 'elf', icon: 'u-piercer',
    name: 'Arrow Piercer', max: 5,
    price: [200, 400, 800, 1600, 3200], time: [10, 14, 18, 22, 26],
    effects: [{ type: 'grantAbility', unit: 'elf', ability: 'arrowPiercer' }],
    desc: 'Elves gain the active <b>Arrow Piercer</b>: a 25-range line shot that hits everything on its path for attack damage + 0/50/100/150/250 magic and slows 70% for 1s (50 mana, 20s cooldown).',
    levelText: (l) => `Arrow Piercer: attack + ${[0, 50, 100, 150, 250][l - 1]} magic, 70% slow 1s`,
  },
  nightreign: {
    id: 'nightreign', faction: 'medieval', category: 'troop', unit: 'elf', icon: 'u-nightreign', kind: 'statBoost',
    name: 'Nightreign', max: Infinity,
    price: boostPrice('elf'), time: STAT_BOOST_TIME,
    effects: [{ type: 'statBoost', unit: 'elf', pct: STAT_BOOST.pct }],
    desc: 'Stat boost: every Elf gets <b>+10% base HP, armor, ward, damage and HP regen</b> per level. Lv 1 costs 2x the troop\'s base hiring cost. Each level also makes the Elf cost +10% of its base price, and the next level of this upgrade costs and takes +10% more.',
    levelText: (l) => `+${10 * l}% base HP / armor / ward / damage / regen · cost +${10 * l}%`,
  },
  fortify: {
    id: 'fortify', faction: 'medieval', category: 'base', icon: 'u-fortify',
    name: 'Fortify', max: BASE_LEVELS.length - 1,
    price: BASE_LEVEL_PRICE, time: BASE_LEVEL_TIME,
    effects: [{ type: 'baseLevel' }],
    desc: 'Rebuilds your castle <b>one level higher</b>: more HP, armor and vision, and more wall spots for Battlement Rangers. The castle keeps its HP %.',
    levelText: (l) => baseLevelText(l, CASTLE_TIERS),
  },
  battlement: {
    id: 'battlement', faction: 'medieval', category: 'base', icon: 'u-battlement',
    name: 'Battlement', max: 8,   // also capped by the castle's wall spots (Game.upgradeMax / BASE_LEVELS)
    price: [100, 200, 400, 800, 1200, 1600, 2000, 2400], time: [12, 16, 20, 25, 28, 30, 32, 35],
    effects: [{ type: 'towers', unit: 'archer', rangeBonus: 15 }],
    desc: 'Adds <b>+1 Ranger on the castle walls</b> per level (+15 range, invulnerable, can\'t be selected). Benefits from Ranger upgrades. Max level = the castle\'s wall spots (4 at Castle Lv 3, up to 8).',
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

  shieldStomp: {
    id: 'shieldStomp', faction: 'modern', category: 'troop', unit: 'riotSkirmisher', icon: 'u-stomp',
    name: 'Shield Stomp', max: 5,
    price: [250, 500, 1000, 2000, 4000], time: [10, 15, 20, 25, 30],
    effects: [{ type: 'grantAbility', unit: 'riotSkirmisher', ability: 'shieldStomp' }],
    desc: 'Riot Skirmishers gain the active <b>Shield Stomp</b>: 80/120/160/200/240 magic damage within 2 range and a 2.5 knockback (20s cooldown).',
    levelText: (l) => `Shield Stomp: ${[80, 120, 160, 200, 240][l - 1]} magic dmg, 2.5 knockback`,
  },
  ironRegimen: {
    id: 'ironRegimen', faction: 'modern', category: 'troop', unit: 'riotSkirmisher', icon: 'u-iron', kind: 'statBoost',
    name: 'Iron Regimen', max: Infinity,
    price: boostPrice('riotSkirmisher'), time: STAT_BOOST_TIME,
    effects: [{ type: 'statBoost', unit: 'riotSkirmisher', pct: STAT_BOOST.pct }],
    desc: 'Stat boost: every Riot Skirmisher gets <b>+10% base HP, armor, ward, damage and HP regen</b> per level. Lv 1 costs 2x the troop\'s base hiring cost. Each level also makes the Riot Skirmisher cost +10% of its base price, and the next level of this upgrade costs and takes +10% more.',
    levelText: (l) => `+${10 * l}% base HP / armor / ward / damage / regen · cost +${10 * l}%`,
  },
  penetration: {
    id: 'penetration', faction: 'modern', category: 'troop', unit: 'reconDrone', icon: 'u-penetrate',
    name: 'Penetration', max: 5,
    price: [300, 600, 1200, 2400, 4800], time: [10, 15, 20, 25, 30],
    desc: 'Improves the Drone\'s <b>Penetration</b>: armor reduction 2 → 4/6/8/10/12 for 3s. Max level: <b>+20 attack speed</b>.',
    levelText: (l) => `Penetration: -${[4, 6, 8, 10, 12][l - 1]} armor for 3s${l === 5 ? ', +20 attack speed' : ''}`,
  },
  firmwareUpdate: {
    id: 'firmwareUpdate', faction: 'modern', category: 'troop', unit: 'reconDrone', icon: 'u-firmware', kind: 'statBoost',
    name: 'Firmware Update', max: Infinity,
    price: boostPrice('reconDrone'), time: STAT_BOOST_TIME,
    effects: [{ type: 'statBoost', unit: 'reconDrone', pct: STAT_BOOST.pct }],
    desc: 'Stat boost: every Recon Drone gets <b>+10% base HP, armor, ward, damage and HP regen</b> per level. Lv 1 costs 2x the troop\'s base hiring cost. Each level also makes the Recon Drone cost +10% of its base price, and the next level of this upgrade costs and takes +10% more.',
    levelText: (l) => `+${10 * l}% base HP / armor / ward / damage / regen · cost +${10 * l}%`,
  },
  expandHQ: {
    id: 'expandHQ', faction: 'modern', category: 'base', icon: 'u-expand',
    name: 'Expand HQ', max: BASE_LEVELS.length - 1,
    price: BASE_LEVEL_PRICE, time: BASE_LEVEL_TIME,
    effects: [{ type: 'baseLevel' }],
    desc: 'Rebuilds your HQ <b>one level higher</b>: more HP, armor and vision, and more rooftop spots for Overwatch Gunners. The HQ keeps its HP %.',
    levelText: (l) => baseLevelText(l, HQ_TIERS),
  },
  overwatch: {
    id: 'overwatch', faction: 'modern', category: 'base', icon: 'u-overwatch',
    name: 'Rooftop Overwatch', max: 8,   // also capped by the HQ's rooftop spots
    price: [100, 200, 400, 800, 1200, 1600, 2000, 2400], time: [12, 16, 20, 25, 28, 30, 32, 35],
    effects: [{ type: 'towers', unit: 'gunner', rangeBonus: 15 }],
    desc: 'Adds <b>+1 Gunner on the HQ roof</b> per level (+15 range, invulnerable, can\'t be selected). Benefits from Gunner upgrades. Max level = the HQ\'s rooftop spots (4 at HQ Lv 3, up to 8).',
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
  const units = new Set([...(FACTIONS[factionId]?.units || []), ...(FACTIONS[factionId]?.buildings || [])]);   // buildings get troop-style upgrades too
  for (const U of Object.values(UPGRADES)) if (base(U)) for (const e of U.effects || []) if (e.type === 'towers') units.add(e.unit);
  return Object.values(UPGRADES).filter((U) => base(U) || (U.category === 'troop' && units.has(U.unit)));
};
