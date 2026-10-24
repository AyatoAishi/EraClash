// ============================================================
//  ERA CLASH — static game data
//  Attack Speed is attacks PER MINUTE (60 = 1 hit/sec).
//  Armor/Ward use Dota scaling, Evasion/Miss are % chances (Dota style).
// ============================================================

export const GAME = {
  startGold: 100,
  incomePerSec: 2.5,
  bountyPct: 0.4,        // killing any unit (troop or creep) pays 40% of its hiring cost (what was paid)
  baseLevel: 1,          // castle / HQ level every match starts at (stats: BASE_LEVELS); Fortify / Expand HQ raise it
  repair: { heal: 10, drain: 5, healPerLevel: 6, drainPerLevel: 3 },   // base repair toggle
  popCap: 40,
  queueMax: 5,
  laneHalfLen: 60,       // bases sit at +/- 58
  laneHalfWidth: 14,     // the lane itself
  mapHalfWidth: 30,      // walkable z range incl. the jungle / back alleys (neutral camps)
  dayNight: { half: 300, fade: 20 },   // 5 min day, 5 min night, 20s dusk/dawn
  baseX: 58,
  baseHalfX: 6,          // base footprint (AABB)
  baseHalfZ: 7,
  highGround: { uphillMiss: 0.5 },
  researchQueueMax: 5,               // Barracks: running research + queued, like the training queue   // ranged attack from low ground (river) at a target on high ground
  defaultVision: [30, 16],
  dmgVariance: 1,        // each hit rolls damage +/- this much
  invSlots: 6,           // item slots per troop
  maxActives: 5,         // active abilities per unit (hotkeys Q W E R T); passives are unlimited
  flyHeight: 3,          // flying units hover this far above the ground
  flyingMiss: 0.5,       // ranged attacks against flying units miss this often (melee can't hit them at all)
  spawnInvuln: 5,        // seconds of invulnerability (no damage, no CC) after spawning
};

// Base levels — castle and HQ use the same numbers. Matches start at GAME.baseLevel and level up through the
// Fortify / Expand HQ upgrades (upgrades.js). Level 3 = the classic base (2500 HP).
// slots = wall troop spots (models.js castleSlots / hqSlots) = how many Battlement / Overwatch levels the base can hold.
export const BASE_LEVELS = [
  { level: 1, hp: 1500, armor: 0, vision: [30, 16], slots: 1 },
  { level: 2, hp: 2000, armor: 0, vision: [32, 18], slots: 2 },
  { level: 3, hp: 2500, armor: 0, vision: [35, 20], slots: 4 },
  { level: 4, hp: 3500, armor: 2, vision: [38, 22], slots: 6 },
  { level: 5, hp: 5000, armor: 4, vision: [40, 24], slots: 8 },
];
export const baseLevelStats = (L) => BASE_LEVELS[Math.max(1, Math.min(BASE_LEVELS.length, L)) - 1];

// team 0 = LEFT  (always Medieval)
// team 1 = RIGHT (always Modern)
export const FACTIONS = {
  medieval: {
    id: 'medieval',
    team: 0,
    name: 'Medieval Kingdom',
    tagline: 'Steel, fury and old magic.',
    baseName: 'Stone Keep',
    emblem: 'em-medieval',                // pixel symbol id in index.html
    color: '#d9a441',
    units: ['viking', 'archer', 'imp', 'lancer', 'elf'],   // shop order = default buy key order (1, 2, 3...)
  },
  modern: {
    id: 'modern',
    team: 1,
    name: 'Modern Republic',
    tagline: 'Discipline, tech and firepower.',
    baseName: 'Command HQ',
    emblem: 'em-modern',
    color: '#4aa3ff',
    units: ['police', 'gunner', 'sniper', 'riotSkirmisher', 'reconDrone'],
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
  UNIT TEMPLATE — every unit (faction troops AND neutral creeps) uses the same schema.
  Units don't belong to anyone: who can hire them is decided by FACTIONS[x].units (rosters),
  who spawns them as creeps by CAMPS in neutrals.js. Any unit can be on team 0, 1 or 2 (neutral).
  theme      = 'medieval' | 'modern' (visual/UI flavour only)
  cost       = hiring cost; kill bounty is always GAME.bountyPct (40%) of what was paid (creeps: of cost)
  vision     = [day, night]
  range      = reach measured edge-to-edge (melee ~1.2-1.3)
  aggro      = how far the troop "sees" enemies while charging
  evasion    = % chance to dodge an incoming ATTACK (abilities can't be evaded)
  missChance = % chance this troop's own attacks miss
  abilities  = up to 4 ids from ABILITIES (passives + actives combined).
               Order = slot order = hotkeys Q W E R.
*/
export const UNITS = {
  viking: {
    id: 'viking', name: 'Viking Warrior', theme: 'medieval', family: 'melee', role: 'Melee bruiser', type: 'melee',
    cost: 50, trainTime: 1.5,
    hp: 115, hpRegen: 1, damage: 15, damageType: 'physical', attackSpeed: 54,
    armor: 2, ward: 0, evasion: 0, missChance: 0,
    moveSpeed: 3.0, range: 1.3, vision: [30, 16], aggro: 9, radius: 0.5,
    abilities: ['loneWolf'],
    lore: 'A horned raider from the frozen north. Hits hard, swings slow, and refuses to share the spotlight with another Viking.',
  },
  archer: {
    id: 'archer', name: 'Ranger', theme: 'medieval', family: 'marksman', role: 'Ranged marksman', type: 'ranged',
    cost: 75, trainTime: 2.0,
    hp: 70, hpRegen: 0.5, damage: 16, damageType: 'physical', attackSpeed: 45,
    armor: 0, ward: 0, evasion: 0, missChance: 0,
    moveSpeed: 3.0, range: 9, vision: [30, 16], aggro: 12, radius: 0.45,
    projectile: { kind: 'arrow', speed: 20, arc: 0.18 },
    abilities: ['eagleEye'],
    lore: 'Longbow, green hood, steady hands. Big slow arrows that punch through armor better than fast weapons do. Dies fast if anything reaches her.',
  },
  imp: {
    id: 'imp', name: 'Imp Warrior', theme: 'medieval', family: 'melee', role: 'Suicide skirmisher', type: 'melee',
    cost: 90, trainTime: 1,
    hp: 40, hpRegen: 0.1, damage: 20, damageType: 'physical', attackSpeed: 65,
    armor: 2, ward: 1, evasion: 0, missChance: 0,
    moveSpeed: 4.5, range: 1.2, vision: [30, 16], aggro: 9, radius: 0.4,
    abilities: ['splatter', 'swiftStep'],          // Splatter first -> Q
    lore: 'A cackling little demon bound to the Keep. Fast, slippery while it runs, and more than happy to pop itself over a crowd.',
  },
  police: {
    id: 'police', name: 'Police Officer', theme: 'modern', family: 'melee', role: 'Melee skirmisher', type: 'melee',
    cost: 50, trainTime: 1.5,
    hp: 117, hpRegen: 1, damage: 9, damageType: 'physical', attackSpeed: 81,
    armor: 2, ward: 0, evasion: 0, missChance: 0,
    moveSpeed: 3.3, range: 1.3, vision: [30, 16], aggro: 9, radius: 0.5,
    abilities: ['blueLine'],
    lore: 'Standard-issue riot officer. Faster on foot and quicker with the baton. Alone he hits like a wet towel; in a squad he hits like a truck.',
  },
  gunner: {
    id: 'gunner', name: 'Gunner', theme: 'modern', family: 'marksman', role: 'Ranged rifleman', type: 'ranged',
    cost: 75, trainTime: 2.0,
    hp: 62, hpRegen: 0.5, damage: 9, damageType: 'physical', attackSpeed: 60,
    armor: 1, ward: 0, evasion: 0, missChance: 0,
    moveSpeed: 3.1, range: 10, vision: [30, 16], aggro: 13, radius: 0.45,
    projectile: { kind: 'bullet', speed: 60, arc: 0 },
    abilities: ['fervor'],
    lore: 'Tactical rifleman in a light vest. Out-ranges the archer. Starts slow, but the longer he holds one target the faster he fires.',
  },
  sniper: {
    id: 'sniper', name: 'Sniper', theme: 'modern', family: 'marksman', role: 'Long-range specialist', type: 'ranged',
    cost: 120, trainTime: 2.5,
    hp: 40, hpRegen: 0.1, damage: 24, damageType: 'physical', attackSpeed: 30,
    armor: 1, ward: 0, evasion: 0, missChance: 0,
    moveSpeed: 2, range: 12, vision: [30, 16], aggro: 14, radius: 0.45,
    projectile: { kind: 'sniper', speed: 90, arc: 0 },
    abilities: ['snipeStance', 'bullsEye'],        // Snipe Stance first -> Q
    lore: 'Ghillie hood, long rifle, zero patience for close quarters. Lies down, waits, and deletes whatever wanders into the crosshair.',
  },
};

// ---------- v0.11.0 troops ----------
Object.assign(UNITS, {
  lancer: {
    id: 'lancer', name: 'Lancer', theme: 'medieval', family: 'melee', role: 'Cavalry lancer', type: 'melee',
    cost: 160, trainTime: 5,
    hp: 200, hpRegen: 1.2, damage: 18, damageType: 'physical', attackSpeed: 45,
    armor: 4, ward: 1, evasion: 0, missChance: 0,
    moveSpeed: 4.1, range: 2.2, vision: [30, 16], aggro: 10, radius: 0.7,
    abilities: ['courageAura', 'bardingRally'],
    lore: 'A knight of the Keep on a barded warhorse, banner on his back. Where he rides, the army follows a little braver and a little faster.',
  },
  elf: {
    id: 'elf', name: 'Elf', theme: 'medieval', family: 'marksman', role: 'Night ranger', type: 'ranged',
    cost: 120, trainTime: 3,
    hp: 120, hpRegen: 0.6, damage: 19, damageType: 'physical', attackSpeed: 55,
    armor: 1, ward: 3, evasion: 0, missChance: 0,
    moveSpeed: 3.2, range: 10, vision: [28, 20], aggro: 13, radius: 0.45,
    mana: 100, manaRegen: 1,
    projectile: { kind: 'arrow', speed: 20, arc: 0.18 },
    abilities: ['nightMeld'],
    lore: 'Long hair, blue eyes, armor of woven leaves. Sees farther in the dark than any human, and when the moon is up she simply stops being there.',
  },
  riotSkirmisher: {
    id: 'riotSkirmisher', name: 'Riot Skirmisher', theme: 'modern', family: 'melee', role: 'Shield bearer', type: 'melee',
    cost: 150, trainTime: 2.5,
    hp: 120, hpRegen: 1, damage: 19, damageType: 'physical', attackSpeed: 45,
    armor: 3, ward: 4, evasion: 0, missChance: 0,
    moveSpeed: 2.9, range: 2, vision: [30, 16], aggro: 9, radius: 0.55,
    abilities: ['bulwark'],
    lore: 'Heavier than a patrol officer and twice as stubborn. The riot shield never drops: whatever comes from the front hits the polycarbonate first.',
  },
  reconDrone: {
    id: 'reconDrone', name: 'Recon Drone', theme: 'modern', family: 'marksman', role: 'Flying harasser', type: 'ranged', flying: true,
    cost: 160, trainTime: 4.5,
    hp: 45, hpRegen: 0.1, damage: 20, damageType: 'physical', attackSpeed: 40,
    armor: 2, ward: 0, evasion: 0, missChance: 0,
    moveSpeed: 3.3, range: 2, vision: [30, 16], aggro: 10, radius: 0.5,
    projectile: { kind: 'bullet', speed: 60, arc: 0 },
    abilities: ['penetration'],
    lore: 'A quad-rotor with two carbines bolted underneath. Flies over walls and trees, sees everything, and chews through armor. Swords can\'t reach it.',
  },
});

// ---------- creeps: ordinary units too (hireable by any roster, spawned by camps in neutrals.js) ----------
Object.assign(UNITS, {
  direBear: {
    id: 'direBear', name: 'Dire Bear', theme: 'medieval', family: 'melee', role: 'Forest brute', type: 'melee',
    cost: 150, trainTime: 2.5,
    hp: 120, hpRegen: 2, damage: 16, damageType: 'physical', attackSpeed: 45,
    armor: 3, ward: 4, evasion: 0, missChance: 0,
    moveSpeed: 3.4, range: 1.4, vision: [30, 16], aggro: 8, radius: 0.75,
    abilities: ['resentment'],
    lore: 'The old bear of the pack. The more it bleeds, the angrier it swings.',
  },
  blueBear: {
    id: 'blueBear', name: 'Blue Bear', theme: 'medieval', family: 'melee', role: 'Forest cub', type: 'melee',
    cost: 75, trainTime: 1.5,
    hp: 70, hpRegen: 1, damage: 8, damageType: 'physical', attackSpeed: 30,
    armor: 2, ward: 1, evasion: 0, missChance: 0,
    moveSpeed: 3.1, range: 1.2, vision: [30, 16], aggro: 8, radius: 0.55,
    abilities: [],
    lore: 'Smaller, bluer, and very loyal to the Dire Bear.',
  },
  banshee: {
    id: 'banshee', name: 'Banshee', theme: 'medieval', family: 'marksman', role: 'Wraith caster', type: 'ranged',
    cost: 150, trainTime: 2.5,
    hp: 90, hpRegen: 2, damage: 20, damageType: 'physical', attackSpeed: 70,
    armor: 4, ward: -1, evasion: 0, missChance: 0,
    moveSpeed: 3, range: 8, vision: [30, 16], aggro: 8, radius: 0.5,
    projectile: { kind: 'wisp', speed: 16, arc: 0.05 },
    abilities: ['immaterial', 'bansheeCurse'],
    lore: 'A wailing spirit. Blades pass straight through it, and its whisper turns soldiers against their own.',
  },
  smallBanshee: {
    id: 'smallBanshee', name: 'Small Banshee', theme: 'medieval', family: 'marksman', role: 'Wraith', type: 'ranged',
    cost: 75, trainTime: 1.5,
    hp: 45, hpRegen: 1, damage: 10, damageType: 'physical', attackSpeed: 40,
    armor: 4, ward: -1, evasion: 0, missChance: 0,
    moveSpeed: 3, range: 6, vision: [30, 16], aggro: 8, radius: 0.4,
    projectile: { kind: 'wisp', speed: 16, arc: 0.05 },
    abilities: [],
    lore: 'A younger wraith, still learning how to haunt.',
  },
  alphaThug: {
    id: 'alphaThug', name: 'Alpha Thug', theme: 'modern', family: 'melee', role: 'Gang leader', type: 'melee',
    cost: 162.5, trainTime: 2.5,
    hp: 90, hpRegen: 2, damage: 17, damageType: 'physical', attackSpeed: 60,
    armor: 4, ward: 1, evasion: 0, missChance: 0,
    moveSpeed: 2.8, range: 1.3, vision: [30, 16], aggro: 8, radius: 0.6,
    abilities: ['moraleAura'],
    lore: 'Runs the block. His crew fights harder when he is watching.',
  },
  hooligan: {
    id: 'hooligan', name: 'Hooligan', theme: 'modern', family: 'melee', role: 'Gang member', type: 'melee',
    cost: 75, trainTime: 1.5,
    hp: 80, hpRegen: 1.2, damage: 15, damageType: 'physical', attackSpeed: 50,
    armor: 3, ward: 0, evasion: 0, missChance: 0,
    moveSpeed: 2.2, range: 1.3, vision: [30, 16], aggro: 8, radius: 0.5,
    abilities: [],
    lore: 'Track suit, broken bottle, short temper.',
  },
  outlaw: {
    id: 'outlaw', name: 'Outlaw', theme: 'modern', family: 'melee', role: 'Biker outlaw', type: 'melee',
    cost: 187.5, trainTime: 2.5,
    hp: 120, hpRegen: 1.5, damage: 20, damageType: 'physical', attackSpeed: 70,
    armor: 5, ward: 2, evasion: 0, missChance: 0,
    moveSpeed: 2.7, range: 1.4, vision: [30, 16], aggro: 8, radius: 0.6,
    abilities: ['cleave'],
    lore: 'Leather, chains and a crowbar that hits everyone standing behind you too.',
  },
});
/*
  ABILITIES — modular. kind: 'passive' | 'active'. A unit may have up to GAME.maxActives (5) actives
  and any number of passives. affectsFlying: false = can't hit flying units (default: it can). Logic lives in unit.js (passives) and game.js (actives: castAbility).
  `icon` = SVG symbol id in index.html.
*/
export const ABILITIES = {
  // ---------- passives ----------
  loneWolf: {
    id: 'loneWolf', kind: 'passive', name: 'Lone Wolf', icon: 'p-wolf',
    radius: 9, bonusDamage: 5, bonusRegen: 1, bonusArmor: 3,
    desc: 'If he is the only Viking within 9 range, gains +5 damage, +1 HP regen and +3 armor. Other troop types don\'t count — pair him with Rangers.',
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
    id: 'splatter', kind: 'active', affectsFlying: false, name: 'Splatter', icon: 'a-splatter',
    cooldown: 0, radius: 2.2, damage: 70, damageType: 'magic', selfDestruct: true,
    aiCast: { minTargets: 2, lowHpPct: 0.35 },          // when the AI uses it
    desc: 'Sacrifices itself in an organic explosion, dealing 70 magic damage to every enemy within 2.2 range (bases included). Can\'t be evaded.',
  },
  // ---------- neutral creep abilities ----------
  resentment: { id: 'resentment', kind: 'passive', name: 'Resentment', icon: 'a-resent', threshold: 30, bonusDamage: 5, bonusAS: 30, duration: 3,
    desc: 'After taking 30 damage, gains +5 damage and +30 attack speed for 3 seconds.' },
  immaterial: { id: 'immaterial', kind: 'passive', name: 'Immaterial', icon: 'a-immaterial', unbreakable: true, static: { bonusEvasion: 50 }, desc: '50% chance to evade attacks. Can\'t be broken.' },
  brainwash: { id: 'brainwash', kind: 'active', name: 'Brainwash', icon: 'a-brainwash', cooldown: 20, castRange: 8, duration: 15, castChance: 0.25,
    desc: 'Each fight (and each time the 20s cooldown ends mid-fight) the Banshee has a 25% chance to cast it, a few seconds in: one enemy troop it is fighting loses its will for 15s — it switches sides, attacks its former allies, then despawns (no bounty).' },
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
  bansheeCurse: { id: 'bansheeCurse', kind: 'passive', name: 'Banshee Curse', icon: 'a-curse', duration: 4, hasteAS: 30, hasteTime: 1, raiseTime: 20,
    desc: 'Attacks curse the target for 4s. Anyone attacking a cursed unit gains +30 attack speed for 1s. A unit that dies while cursed rises as the Banshee\'s ally for 20s (full HP, no items, keeps its upgrades), then fades.' },
  // ---------- v0.11.0 ----------
  courageAura: { id: 'courageAura', kind: 'passive', name: 'Courage Aura', icon: 'a-courage', aura: { radius: 3, bonusWard: 2, bonusRegen: 1 },
    desc: 'Allies (and itself) within 3 range gain +2 ward and +1 HP regen. Doesn\'t stack with other Courage Auras.' },
  bardingRally: { id: 'bardingRally', kind: 'passive', name: 'Barding Rally', icon: 'a-rally', dropEvery: 0.25, trailTime: 2, speedBonus: 0.2,
    desc: 'While moving, leaves a trail that lasts 2s. Allies walking on it move 20% faster.' },
  critStrike: { id: 'critStrike', kind: 'passive', name: 'Critical Strike', icon: 'u-crit', granted: true, chance: 0.3, bonus: [0.8, 1.0, 1.2, 1.4, 1.6],
    desc: '30% chance on attack to deal +80/100/120/140/160% damage (by Critical Strike level).' },
  arrowPiercer: { id: 'arrowPiercer', kind: 'active', name: 'Arrow Piercer', icon: 'u-piercer', granted: true, cast: 'line',
    castTime: 0.4, cooldown: 20, manaCost: 50, speed: 35, range: 25, affectsFlying: true, width: 1, bonusMagic: [0, 50, 100, 150, 250], falloff: 0.1, slow: 70, slowTime: 1,
    ai: { whenAttacking: true },
    desc: 'Aim a piercing arrow in a line (25 range). Hits every enemy on its path for the Elf\'s attack damage + 0/50/100/150/250 magic and slows 70% for 1s. Each enemy hit weakens it by 10%. Costs 50 mana.' },
  nightMeld: { id: 'nightMeld', kind: 'passive', name: 'Night Meld', icon: 'a-nightmeld', stillFor: 2,
    desc: 'At night, standing still for 2s without attacking makes the Elf invisible. Moving or attacking breaks it.' },
  shieldStomp: { id: 'shieldStomp', kind: 'active', name: 'Shield Stomp', icon: 'u-stomp', granted: true,
    castTime: 0.3, cooldown: 20, radius: 2, damage: [80, 120, 160, 200, 240], damageType: 'magic', knockback: 2.5, affectsFlying: false,
    ai: { whenAttacking: true },
    desc: 'Slams the shield down: 80/120/160/200/240 magic damage to enemies within 2 range and knocks them 2.5 away.' },
  bulwark: { id: 'bulwark', kind: 'passive', name: 'Bulwark', icon: 'a-bulwark', unbreakable: true, reduction: 0.3, arc: Math.PI * 2 / 3,
    desc: 'Basic attacks from the front (120°) deal 30% less damage, crits included. On-hit extras are not reduced. Can\'t be broken.' },
  penetration: { id: 'penetration', kind: 'passive', name: 'Penetration', icon: 'a-penetration', shred: [2, 4, 6, 8, 10, 12], duration: 3, maxBonusAS: 20,
    desc: 'Attacks reduce the target\'s armor by 2 (4–12 with the Penetration upgrade) for 3s. Max upgrade: +20 attack speed.' },
};
export const PASSIVES = ABILITIES;   // back-compat alias

// sanity check: no troop may exceed the ability cap
for (const u of Object.values(UNITS)) {
  if ((u.abilities || []).filter((a) => ABILITIES[a]?.kind === 'active').length > GAME.maxActives) console.warn(`${u.id} has more than ${GAME.maxActives} actives`);
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
  oldManShield: { id: 'oldManShield', sprite: 'it-shield', name: 'Old Man Shield', icon: '#8a5a2b', desc: 'Passive: 50% chance to block a random 5–7 damage from a basic attack you take.', block: [5, 7], blockChance: 0.5 },
  sash:         { id: 'sash', sprite: 'it-sash',         name: 'Sash',           icon: '#c0392b', desc: '+1 move speed', stats: { moveSpeed: 1 } },
  quiver:       { id: 'quiver', sprite: 'it-quiver',       name: 'Quiver',         icon: '#6b4423', desc: 'Passive: on a ranged troop, +1 attack range and +20 attack speed (no effect on melee).', rangedStats: { range: 1, attackSpeed: 20 } },
  // --- modern camp drops ---
  shoulderGuard:{ id: 'shoulderGuard', sprite: 'it-shoulder',name: 'Shoulder Guard', icon: '#3b4652', desc: '+2 armor, +2 ward', stats: { armor: 2, ward: 2 } },
  shackles:     { id: 'shackles', sprite: 'it-shackles',     name: 'Shackles',       icon: '#5a5f69', desc: 'Passive: on a melee troop, 20% chance on hit to DISARM the target for 3s (it can\'t start attacks). Doesn\'t stack: an already-disarmed target can\'t be disarmed again or refreshed.', disarm: { chance: 0.2, duration: 3 } },
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
