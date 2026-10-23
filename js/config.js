// ============================================================
//  ERA CLASH — static game data
//  Attack Speed is attacks PER MINUTE (60 = 1 hit/sec).
//  Armor/Ward use Dota scaling, Evasion/Miss are % chances (Dota style).
// ============================================================

export const GAME = {
  startGold: 100,
  incomePerSec: 2.5,
  bountyPct: 0.4,        // killing an enemy troop pays 40% of its hiring cost
  baseHP: 2500,
  repair: { heal: 10, drain: 5, healPerLevel: 6, drainPerLevel: 3 },   // base repair toggle
  baseArmor: 0,
  popCap: 40,
  queueMax: 5,
  laneHalfLen: 60,       // bases sit at +/- 58
  laneHalfWidth: 14,     // the lane itself
  mapHalfWidth: 30,      // walkable z range incl. the jungle / back alleys (neutral camps)
  dayNight: { half: 300, fade: 20 },   // 5 min day, 5 min night, 20s dusk/dawn
  baseX: 58,
  baseHalfX: 6,          // base footprint (AABB)
  baseHalfZ: 7,
  dmgVariance: 1,        // each hit rolls damage +/- this much
  invSlots: 6,           // item slots per troop
  maxAbilities: 4,       // passives + actives combined, per troop
  spawnInvuln: 5,        // seconds of invulnerability (no damage, no CC) after spawning
};

// team 0 = LEFT  (always Medieval)
// team 1 = RIGHT (always Modern)
export const FACTIONS = {
  medieval: {
    id: 'medieval',
    team: 0,
    name: 'Medieval Kingdom',
    tagline: 'Steel, fury and old magic.',
    baseName: 'Stone Keep',
    color: '#d9a441',
    units: ['viking', 'archer', 'imp'],   // shop order = default buy key order (1, 2, 3...)
  },
  modern: {
    id: 'modern',
    team: 1,
    name: 'Modern Republic',
    tagline: 'Discipline, tech and firepower.',
    baseName: 'Command HQ',
    color: '#4aa3ff',
    units: ['police', 'gunner', 'sniper'],
  },
};

/*
  DAMAGE TYPES (League-style trio)
  - physical : reduced by ARMOR
  - magic    : reduced by WARD
  - true     : ignores both
  Both defenses use Dota-style scaling:
      damage multiplier = 1 - (0.06 * D) / (1 + 0.06 * |D|)
      D=1 -> 5.7%   D=2 -> 10.7%   D=5 -> 23.1%   D=10 -> 37.5%   D=20 -> 54.5%
      negative D amplifies damage (D=-5 -> +30%)
*/
export const DEFENSE_K = 0.06;
export const defenseMult = (d) => 1 - (DEFENSE_K * d) / (1 + DEFENSE_K * Math.abs(d));
export const reductionPct = (d) => (1 - defenseMult(d)) * 100;

export const DEFENSES = {
  armor: { id: 'armor', name: 'Armor', short: 'ARMOR', vs: 'physical' },
  ward:  { id: 'ward',  name: 'Ward',  short: 'WARD',  vs: 'magic' },   // rename here only (UI reads this)
};
export const DAMAGE_TYPES = {
  physical: { id: 'physical', name: 'Physical', defense: 'armor', color: '#ff9a7a' },
  magic:    { id: 'magic',    name: 'Magic',    defense: 'ward',  color: '#b98cff' },
  true:     { id: 'true',     name: 'True',     defense: null,    color: '#ffffff' },
};

/*
  FAMILIES — every troop belongs to one. Used for grouping in the UI and for
  family-wide upgrades (future Barracks): Game.addFamilyUpgrade(team, 'melee', { damage: 2 })
  buffs every current AND future troop of that family on that team.
*/
export const FAMILIES = {
  melee:    { id: 'melee',    name: 'Melee',    icon: 'i-sword', desc: 'Front-line fighters that must reach their target.' },
  marksman: { id: 'marksman', name: 'Marksman', icon: 'i-bow',   desc: 'Ranged attackers that shoot from behind the front line.' },
};

/*
  UNIT TEMPLATE
  range      = reach measured edge-to-edge (melee ~1.2-1.3)
  aggro      = how far the troop "sees" enemies while charging
  evasion    = % chance to dodge an incoming ATTACK (abilities can't be evaded)
  missChance = % chance this troop's own attacks miss
  abilities  = up to 4 ids from ABILITIES (passives + actives combined).
               Order = slot order = hotkeys Q W E R.
*/
export const UNITS = {
  viking: {
    id: 'viking', name: 'Viking Warrior', faction: 'medieval', family: 'melee', role: 'Melee bruiser', type: 'melee',
    cost: 50, trainTime: 1.5,
    hp: 115, hpRegen: 1, damage: 15, damageType: 'physical', attackSpeed: 54,
    armor: 2, ward: 0, evasion: 0, missChance: 0,
    moveSpeed: 3.0, range: 1.3, aggro: 9, radius: 0.5,
    abilities: ['loneWolf'],
    lore: 'A horned raider from the frozen north. Hits hard, swings slow, and refuses to share the spotlight with another Viking.',
  },
  archer: {
    id: 'archer', name: 'Archer', faction: 'medieval', family: 'marksman', role: 'Ranged marksman', type: 'ranged',
    cost: 75, trainTime: 2.0,
    hp: 70, hpRegen: 0.5, damage: 16, damageType: 'physical', attackSpeed: 45,
    armor: 0, ward: 0, evasion: 0, missChance: 0,
    moveSpeed: 3.0, range: 9, aggro: 12, radius: 0.45,
    projectile: { kind: 'arrow', speed: 20, arc: 0.18 },
    abilities: ['eagleEye'],
    lore: 'Longbow, green hood, steady hands. Big slow arrows that punch through armor better than fast weapons do. Dies fast if anything reaches her.',
  },
  imp: {
    id: 'imp', name: 'Imp Warrior', faction: 'medieval', family: 'melee', role: 'Suicide skirmisher', type: 'melee',
    cost: 90, trainTime: 1,
    hp: 40, hpRegen: 0.1, damage: 12, damageType: 'physical', attackSpeed: 65,
    armor: 2, ward: 0, evasion: 0, missChance: 0,
    moveSpeed: 4.5, range: 1.2, aggro: 9, radius: 0.4,
    abilities: ['splatter', 'swiftStep'],          // Splatter first -> Q
    lore: 'A cackling little demon bound to the Keep. Fast, slippery while it runs, and more than happy to pop itself over a crowd.',
  },
  police: {
    id: 'police', name: 'Police Officer', faction: 'modern', family: 'melee', role: 'Melee skirmisher', type: 'melee',
    cost: 50, trainTime: 1.5,
    hp: 117, hpRegen: 1, damage: 9, damageType: 'physical', attackSpeed: 81,
    armor: 2, ward: 0, evasion: 0, missChance: 0,
    moveSpeed: 3.3, range: 1.3, aggro: 9, radius: 0.5,
    abilities: ['blueLine'],
    lore: 'Standard-issue riot officer. Faster on foot and quicker with the baton. Alone he hits like a wet towel; in a squad he hits like a truck.',
  },
  gunner: {
    id: 'gunner', name: 'Gunner', faction: 'modern', family: 'marksman', role: 'Ranged rifleman', type: 'ranged',
    cost: 75, trainTime: 2.0,
    hp: 62, hpRegen: 0.5, damage: 9, damageType: 'physical', attackSpeed: 60,
    armor: 1, ward: 0, evasion: 0, missChance: 0,
    moveSpeed: 3.1, range: 10, aggro: 13, radius: 0.45,
    projectile: { kind: 'bullet', speed: 60, arc: 0 },
    abilities: ['fervor'],
    lore: 'Tactical rifleman in a light vest. Out-ranges the archer. Starts slow, but the longer he holds one target the faster he fires.',
  },
  sniper: {
    id: 'sniper', name: 'Sniper', faction: 'modern', family: 'marksman', role: 'Long-range specialist', type: 'ranged',
    cost: 120, trainTime: 2.5,
    hp: 40, hpRegen: 0.1, damage: 16, damageType: 'physical', attackSpeed: 30,
    armor: 1, ward: 0, evasion: 0, missChance: 0,
    moveSpeed: 1.4, range: 12, aggro: 14, radius: 0.45,
    projectile: { kind: 'sniper', speed: 90, arc: 0 },
    abilities: ['snipeStance', 'bullsEye'],        // Snipe Stance first -> Q
    lore: 'Ghillie hood, long rifle, zero patience for close quarters. Lies down, waits, and deletes whatever wanders into the crosshair.',
  },
};

// ---------- NEUTRAL CREEPS (team 2) ----------
const NEU = (o) => ({ faction: 'neutral', cost: 0, trainTime: 0, damageType: 'physical', evasion: 0, missChance: 0, aggro: 8, ...o });
Object.assign(UNITS, {
  // --- medieval forest ---
  direBear: NEU({ id: 'direBear', name: 'Dire Bear', family: 'melee', role: 'Forest brute', type: 'melee', bounty: 60,
    hp: 120, hpRegen: 2, damage: 16, attackSpeed: 45, armor: 3, ward: 4, moveSpeed: 3.4, range: 1.4, radius: 0.75,
    abilities: ['resentment'], lore: 'The old bear of the pack. The more it bleeds, the angrier it swings.' }),
  blueBear: NEU({ id: 'blueBear', name: 'Blue Bear', family: 'melee', role: 'Forest cub', type: 'melee', bounty: 30,
    hp: 70, hpRegen: 1, damage: 8, attackSpeed: 30, armor: 2, ward: 1, moveSpeed: 3.1, range: 1.2, radius: 0.55,
    abilities: [], lore: 'Smaller, bluer, and very loyal to the Dire Bear.' }),
  banshee: NEU({ id: 'banshee', name: 'Banshee', family: 'marksman', role: 'Wraith caster', type: 'ranged', bounty: 60,
    hp: 90, hpRegen: 2, damage: 20, attackSpeed: 50, armor: 4, ward: -1, moveSpeed: 3, range: 8, radius: 0.5,
    projectile: { kind: 'wisp', speed: 16, arc: 0.05 }, abilities: ['immaterial', 'brainwash'],
    lore: 'A wailing spirit. Blades pass straight through it, and its whisper turns soldiers against their own.' }),
  smallBanshee: NEU({ id: 'smallBanshee', name: 'Small Banshee', family: 'marksman', role: 'Wraith', type: 'ranged', bounty: 30,
    hp: 45, hpRegen: 1, damage: 10, attackSpeed: 40, armor: 4, ward: -1, moveSpeed: 3, range: 6, radius: 0.4,
    projectile: { kind: 'wisp', speed: 16, arc: 0.05 }, abilities: [], lore: 'A younger wraith, still learning how to haunt.' }),
  // --- modern back alleys ---
  alphaThug: NEU({ id: 'alphaThug', name: 'Alpha Thug', family: 'melee', role: 'Gang leader', type: 'melee', bounty: 65,
    hp: 90, hpRegen: 2, damage: 17, attackSpeed: 60, armor: 4, ward: 1, moveSpeed: 2.8, range: 1.3, radius: 0.6,
    abilities: ['moraleAura'], lore: 'Runs the block. His crew fights harder when he is watching.' }),
  hooligan: NEU({ id: 'hooligan', name: 'Hooligan', family: 'melee', role: 'Gang member', type: 'melee', bounty: 30,
    hp: 80, hpRegen: 1.2, damage: 15, attackSpeed: 50, armor: 3, ward: 0, moveSpeed: 2.2, range: 1.3, radius: 0.5,
    abilities: [], lore: 'Track suit, broken bottle, short temper.' }),
  outlaw: NEU({ id: 'outlaw', name: 'Outlaw', family: 'melee', role: 'Biker outlaw', type: 'melee', bounty: 60,
    hp: 120, hpRegen: 1.5, damage: 20, attackSpeed: 70, armor: 5, ward: 2, moveSpeed: 2.7, range: 1.4, radius: 0.6,
    abilities: ['cleave'], lore: 'Leather, chains and a crowbar that hits everyone standing behind you too.' }),
});

/*
  ABILITIES — modular. kind: 'passive' | 'active'. A troop may have up to GAME.maxAbilities (4)
  in any mix (4 actives, 2+2, 1+3 ...). Logic lives in unit.js (passives) and game.js (actives: castAbility).
  `icon` = SVG symbol id in index.html.
*/
export const ABILITIES = {
  // ---------- passives ----------
  loneWolf: {
    id: 'loneWolf', kind: 'passive', name: 'Lone Wolf', icon: 'p-wolf',
    radius: 9, bonusDamage: 5, bonusRegen: 1, bonusArmor: 3,
    desc: 'If he is the only Viking within 9 range, gains +5 damage, +1 HP regen and +3 armor. Other troop types don\'t count — pair him with Archers.',
  },
  blueLine: {
    id: 'blueLine', kind: 'passive', name: 'Thin Blue Line', icon: 'p-blueline',
    radius: 10, damagePerAlly: 3.5, maxStacks: 3,         // capped: uncapped made 6+ officer packs unbeatable. null = uncapped
    desc: 'Gains +3.5 damage for every other Police Officer within 10 range (max 3 officers, +10.5). Weak alone, dangerous as a pack.',
  },
  eagleEye: {
    id: 'eagleEye', kind: 'passive', name: 'Eagle Eye', icon: 'p-eye',
    chance: 0.2, bonusDamage: 5,
    desc: '20% chance on each shot to deal +5 bonus damage (critical shot).',
  },
  fervor: {
    id: 'fervor', kind: 'passive', name: 'Fervor', icon: 'p-fervor',
    perStack: 6, maxStacks: 10, resetAfter: 2.5,
    desc: 'Each consecutive attack on the same target grants +6 attack speed, stacking up to 10 times (+60). Switching targets, or not attacking for 2.5s, resets the stacks.',
  },
  swiftStep: {
    id: 'swiftStep', kind: 'passive', name: 'Swift Step', icon: 'a-swift',
    evasion: 40,
    desc: 'Gains 40% evasion while moving.',
  },
  bullsEye: {
    id: 'bullsEye', kind: 'passive', name: "Bull's Eye", icon: 'p-bullseye',
    every: 4, critBonus: 0.7,
    desc: 'Every 4th attack is a critical strike dealing 70% bonus damage.',
  },
  // ---------- actives ----------
  snipeStance: {
    id: 'snipeStance', kind: 'active', name: 'Snipe Stance', icon: 'a-scope', toggle: true,
    cooldown: 1, channel: 1, standUp: 1, standCooldown: 5, bonusRange: 6, bonusDamage: 3, armorPierce: 2, damageTakenMult: 2,
    ai: { dangerRadius: 5, standAfter: 3 },
    desc: 'Channels for 1s (S cancels), then lies prone: move speed 0, +6 range, +3 damage and attacks ignore 2 armor — but takes DOUBLE damage. Recast to stand up (1s channel), then 5s cooldown.',
  },
  splatter: {
    id: 'splatter', kind: 'active', name: 'Splatter', icon: 'a-splatter',
    cooldown: 0, radius: 2.2, damage: 70, damageType: 'magic', selfDestruct: true,
    aiCast: { minTargets: 2, lowHpPct: 0.35 },          // when the AI uses it
    desc: 'Sacrifices itself in an organic explosion, dealing 70 magic damage to every enemy within 2.2 range (bases included). Can\'t be evaded.',
  },
  // ---------- neutral creep abilities ----------
  resentment: { id: 'resentment', kind: 'passive', name: 'Resentment', icon: 'a-resent', threshold: 30, bonusDamage: 5, bonusAS: 30, duration: 3,
    desc: 'After taking 30 damage, gains +5 damage and +30 attack speed for 3 seconds.' },
  immaterial: { id: 'immaterial', kind: 'passive', name: 'Immaterial', icon: 'a-immaterial', static: { bonusEvasion: 50 }, desc: '50% chance to evade attacks.' },
  brainwash: { id: 'brainwash', kind: 'active', name: 'Brainwash', icon: 'a-brainwash', cooldown: 20, castRange: 8, duration: 15, castChance: 0.12,
    desc: 'Randomly while fighting (20s cooldown): one enemy troop it is fighting loses its will for 15s — it switches sides, attacks its former allies, then despawns (no bounty).' },
  moraleAura: { id: 'moraleAura', kind: 'passive', name: 'Morale Aura', icon: 'a-morale', aura: { radius: 4, bonusArmor: 2 },
    desc: 'Allies within 4 range (including itself) gain +2 armor.' },
  cleave: { id: 'cleave', kind: 'passive', name: 'Cleave', icon: 'a-cleave', pct: 0.4, radius: 2.2, cone: 0.8,
    desc: 'Melee attacks also hit enemies in a cone behind the target for 40% of the damage.' },
  // ---------- granted by Barracks upgrades (not on any troop by default) ----------
  flurry: {
    id: 'flurry', kind: 'active', name: 'Flurry', icon: 'u-flurry', granted: true,
    cooldown: 14, duration: 4, bonusAS: [60, 90, 120, 150, 180],          // by Flurry upgrade level 1-5
    ai: { whenAttacking: true },
    desc: 'Gain bonus attack speed for 4 seconds (scales with the Flurry upgrade). 14s cooldown.',
  },
  suppressiveFire: {
    id: 'suppressiveFire', kind: 'active', name: 'Suppressive Fire', icon: 'u-suppress', granted: true,
    cooldown: 16, duration: 4, bonusDamage: [2, 4, 6, 8, 10], knockback: [0.3, 0.35, 0.4, 0.45, 0.5],
    ai: { whenAttacking: true },
    desc: 'For 4 seconds, shots deal bonus damage and knock the target back (both scale with the upgrade). 16s cooldown.',
  },
  deathSplatter: {
    id: 'deathSplatter', kind: 'passive', name: 'Death Splatter', icon: 'u-deathsplat', granted: true,
    desc: 'When this Imp dies, it automatically triggers Splatter.',
  },
};
export const PASSIVES = ABILITIES;   // back-compat alias

// sanity check: no troop may exceed the ability cap
for (const u of Object.values(UNITS)) {
  if ((u.abilities || []).length > GAME.maxAbilities) console.warn(`${u.id} has more than ${GAME.maxAbilities} abilities`);
  for (const a of u.abilities || []) if (!ABILITIES[a]) console.warn(`${u.id}: unknown ability ${a}`);
}

/*
  ITEMS — placeholder registry for future drops (neutral camps, bosses).
  Each item: { id, name, icon (css color for now), desc, stats: { damage, armor, ward, hp, hpRegen, evasion, missChance, attackSpeed, moveSpeed, range } }
  Stats are flat additions. Unit.recalcStats() already applies them.
  Example (disabled):
  iron_ring: { id: 'iron_ring', name: 'Iron Ring', icon: '#9aa3ab', desc: '+1 armor', stats: { armor: 1 } },
*/
export const ITEMS = {
  // --- medieval camp drops ---
  rusticSword:  { id: 'rusticSword', sprite: 'it-sword',  name: 'Rustic Sword',   icon: '#9aa3ab', desc: '+6 damage', stats: { damage: 6 } },
  oldManShield: { id: 'oldManShield', sprite: 'it-shield', name: 'Old Man Shield', icon: '#8a5a2b', desc: 'Passive: blocks a random 5–7 damage from every basic attack you take.', block: [5, 7] },
  sash:         { id: 'sash', sprite: 'it-sash',         name: 'Sash',           icon: '#c0392b', desc: '+1 move speed', stats: { moveSpeed: 1 } },
  quiver:       { id: 'quiver', sprite: 'it-quiver',       name: 'Quiver',         icon: '#6b4423', desc: 'Passive: on a ranged troop, +1 attack range and +30 attack speed (no effect on melee).', rangedStats: { range: 1, attackSpeed: 30 } },
  // --- modern camp drops ---
  shoulderGuard:{ id: 'shoulderGuard', sprite: 'it-shoulder',name: 'Shoulder Guard', icon: '#3b4652', desc: '+2 armor, +2 ward', stats: { armor: 2, ward: 2 } },
  shackles:     { id: 'shackles', sprite: 'it-shackles',     name: 'Shackles',       icon: '#5a5f69', desc: 'Passive: on a melee troop, 20% chance on hit to DISARM the target for 3s (it can\'t start attacks).', disarm: { chance: 0.2, duration: 3 } },
  riotHelmet:   { id: 'riotHelmet', sprite: 'it-helmet',   name: 'Riot Helmet',    icon: '#2f4a8a', desc: 'Passive: gain +3 armor for 3s after being hit by a ranged attack.', helmet: { armor: 3, duration: 3 } },
  pocketKnife:  { id: 'pocketKnife', sprite: 'it-knife',  name: 'Pocket Knife',   icon: '#c9d1d8', desc: '+4 damage. On hit, deals +3 damage to every enemy within 3 range of you.', stats: { damage: 4 }, splash: { damage: 3, radius: 3 } },
};

export const DIFFICULTY = {
  easy:   { name: 'Recruit',  incomeMult: 0.8,  thinkEvery: 1.6, hesitate: 0.35, waveSize: 1, researchRate: 0.15 },
  normal: { name: 'Veteran',  incomeMult: 1.0,  thinkEvery: 0.8, hesitate: 0.1,  waveSize: 4, researchRate: 0.35 },
  hard:   { name: 'Warlord',  incomeMult: 1.25, thinkEvery: 0.4, hesitate: 0,    waveSize: 5, researchRate: 0.6 },
};

/** attacks per minute -> seconds between attacks */
export const attackInterval = (aps) => 60 / Math.max(1, aps);

/** Damage per second vs a target's defenses (base stats, passives excluded). */
export function dps(stats, target = { armor: 0, ward: 0 }) {
  const def = DAMAGE_TYPES[stats.damageType || 'physical'].defense;
  return stats.damage * (def ? defenseMult(target[def] || 0) : 1) * stats.attackSpeed / 60;
}
