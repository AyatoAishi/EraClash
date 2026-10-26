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
  // deployable buildings (Build menu): per side at once, placement within maxDist of your base on your own side,
  // `clearance` = free space needed around the footprint, demolish refund
  build: { maxPerSide: 2, maxDist: 30, clearance: 0.6, refund: 0.5,
    towerMaxDist: 15,                   // towers (structure.tower) stay close to home
    towersByLevel: [1, 1, 2, 2, 3] },   // towers allowed at base level 1..5 (any mix of types)
  queueMax: 5,
  laneHalfLen: 60,       // bases sit at +/- 58
  laneHalfWidth: 14,     // the lane itself
  mapHalfWidth: 46,      // walkable z range incl. the jungle / back alleys (neutral camps) and the north hill
  dayNight: { half: 300, fade: 20 },   // 5 min day, 5 min night, 20s dusk/dawn
  baseX: 58,
  baseHalfX: 6,          // base footprint (AABB)
  baseHalfZ: 7,
  highGround: { uphillMiss: 0.5 },
  researchQueueMax: 5,               // Barracks: running research + queued, like the training queue   // ranged attack from low ground (river) at a target on high ground
  defaultVision: [30, 16],
  dmgVariance: 2,        // each hit rolls damage +/- this much
  invSlots: 6,           // item slots per troop
  lootLife: 30,          // seconds an item drop stays on the ground before it vanishes (blinks for the last 5)
  maxAttackSpeed: 600,   // attacks per minute hard cap (10/s)
  maxActives: 5,         // active abilities per unit (hotkeys Q W E R T); passives are unlimited
  flyHeight: 3,          // flying units hover this far above the ground
  flyingMiss: 0.5,       // ranged attacks against flying units miss this often (melee can't hit them at all)
  spawnInvuln: 6,        // seconds of invulnerability (no damage, no CC) after spawning
};

// Base levels — castle and HQ use the same numbers. Matches start at GAME.baseLevel and level up through the
// Fortify / Expand HQ upgrades (upgrades.js). HP raised in v0.22.0 (Lv 1 = 2500) so early matches last long enough for buildings.
// slots = wall troop spots (models.js castleSlots / hqSlots) = how many Battlement / Overwatch levels the base can hold.
export const BASE_LEVELS = [
  { level: 1, hp: 3000, armor: 8, vision: [30, 16], slots: 1 },
  { level: 2, hp: 4500, armor: 10, vision: [32, 18], slots: 2 },
  { level: 3, hp: 6000, armor: 12, vision: [35, 20], slots: 4 },
  { level: 4, hp: 8000, armor: 16, vision: [38, 22], slots: 6 },
  { level: 5, hp: 12000, armor: 20, vision: [40, 24], slots: 8 },
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
    units: ['viking', 'archer', 'imp', 'lancer', 'elf', 'dryad', 'catapult', 'batrider'],   // shop order
    buildings: ['cannon', 'archerTower', 'hwacha'],         // Build menu (deployable structures, UNITS entries with `structure`)
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
    buildings: ['howitzer', 'sniperTower', 'mgNest'],
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
  siege:    { id: 'siege',    name: 'Siege',    icon: 'i-siege', desc: 'Buildings from the Build menu: long-range splash, cannot move, cannot hit flying units or anything too close.' },
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
    hp: 110, hpRegen: 1, damage: 15, damageType: 'physical', attackSpeed: 54,
    armor: 2, ward: 0, evasion: 0, missChance: 0,
    moveSpeed: 3.0, range: 1.3, vision: [30, 16], aggro: 9, radius: 0.5,
    abilities: ['loneWolf'],
    lore: 'A horned raider from the frozen north. Hits hard, swings slow, and refuses to share the spotlight with another Viking.',
  },
  archer: {
    id: 'archer', name: 'Ranger', theme: 'medieval', family: 'marksman', role: 'Ranged marksman', type: 'ranged',
    cost: 75, trainTime: 2.0,
    hp: 70, hpRegen: 0.5, damage: 14, damageType: 'physical', attackSpeed: 45,
    armor: 0, ward: 0, evasion: 0, missChance: 0,
    moveSpeed: 3.0, range: 9, vision: [30, 16], aggro: 12, radius: 0.45,
    projectile: { kind: 'arrow', speed: 20, arc: 0.18 },
    abilities: ['eagleEye'],
    lore: 'Longbow, green hood, steady hands. Big slow arrows that punch through armor better than fast weapons do. Dies fast if anything reaches her.',
  },
  imp: {
    id: 'imp', name: 'Imp Warrior', theme: 'medieval', family: 'melee', role: 'Suicide skirmisher', type: 'melee',
    cost: 90, trainTime: 1,
    hp: 65, hpRegen: 0.1, damage: 23, damageType: 'physical', attackSpeed: 65,
    armor: 3, ward: 0, evasion: 0, missChance: 0,
    moveSpeed: 4.5, range: 1.2, vision: [30, 16], aggro: 9, radius: 0.4,
    abilities: ['splatter', 'swiftStep'],          // Splatter first -> Q
    lore: 'A cackling little demon bound to the Keep. Fast, slippery while it runs, and more than happy to pop itself over a crowd.',
  },
  police: {
    id: 'police', name: 'Police Officer', theme: 'modern', family: 'melee', role: 'Melee skirmisher', type: 'melee',
    cost: 50, trainTime: 1.5,
    hp: 117, hpRegen: 1, damage: 12, damageType: 'physical', attackSpeed: 81,
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
    hp: 40, hpRegen: 0.1, damage: 40, damageType: 'physical', attackSpeed: 30,
    armor: 1, ward: 0, evasion: 0, missChance: 0,
    moveSpeed: 2, range: 12, vision: [30, 16], aggro: 14, radius: 0.45,
    projectile: { kind: 'sniper', speed: 90, arc: 0 },
    abilities: ['snipeStance', 'bullsEye'],        // Snipe Stance first -> Q
    lore: 'Ghillie hood, long rifle, zero patience for close quarters. Lies down, waits, and deletes whatever wanders into the crosshair.',
  },
};

// ---------- deployable buildings (Build menu) ----------
// A building is a unit that never moves: same stat sheet, plus `structure`:
//   buildTime (s, under construction it can't fire and its HP fills up), footprint (obstacle radius),
//   minRange (can't hit anything closer), splash (radius; 100% at the center -> 50% at the edge),
//   shell: 'cannon' (low, fast) | 'howitzer' (high arc, landing marker), flight (s), knockback (units), groundOnly.
Object.assign(UNITS, {
  cannon: {
    id: 'cannon', name: 'Cannon', theme: 'medieval', family: 'siege', role: 'Artillery (building)', type: 'ranged',
    cost: 250, trainTime: 0,
    hp: 600, hpRegen: 0, damage: 45, damageType: 'physical', attackSpeed: 15,
    armor: 4, ward: 0, evasion: 0, missChance: 0,
    moveSpeed: 0, range: 16, vision: [20, 12], aggro: 16, radius: 1.6,
    structure: { buildTime: 20, footprint: 1.6, minRange: 4, splash: 2.5, shell: 'cannon', flight: 0.55, knockback: 0.8, groundOnly: true },
    abilities: [],
    lore: 'Two wheels, one iron barrel and a pile of round shot behind a low stone wall. Turns a packed front line into loose change.',
  },
  howitzer: {
    id: 'howitzer', name: 'Howitzer', theme: 'modern', family: 'siege', role: 'Artillery (building)', type: 'ranged',
    cost: 300, trainTime: 0,
    hp: 500, hpRegen: 0, damage: 60, damageType: 'physical', attackSpeed: 10,
    armor: 3, ward: 0, evasion: 0, missChance: 0,
    moveSpeed: 0, range: 22, vision: [20, 12], aggro: 22, radius: 1.9,
    structure: { buildTime: 25, footprint: 1.9, minRange: 6, splash: 3.5, shell: 'howitzer', flight: 1.6, knockback: 0, groundOnly: true },
    abilities: [],
    lore: 'Sandbagged field gun on split trails. Lobs a shell high over the lane; a red ring on the ground is the only warning.',
  },
});

// ---------- defense towers (Build menu) ----------
// structure.tower = counts toward the tower limit (GAME.build.towersByLevel) and must stay within towerMaxDist.
// fire: 'direct' shoots its `projectile` like a ranged troop (can miss / be evaded, hits flying),
//       'volley' fires `volley.count` rockets in a `volley.cone` (radians) that splash where they land.
// highGround: shoots / sees from the top (high ground level). trueSight: reveals invisible enemies within that radius.
// suppress: { pct, t } slow on every hit. muzzleY / turnRate: shot height (model units) / turning speed (rad/s).
Object.assign(UNITS, {
  archerTower: {
    id: 'archerTower', name: 'Archer Tower', theme: 'medieval', family: 'siege', role: 'Defense tower', type: 'ranged',
    cost: 200, trainTime: 0,
    hp: 750, hpRegen: 0, damage: 20, damageType: 'physical', attackSpeed: 60,
    armor: 4, ward: 0, evasion: 0, missChance: 0,
    moveSpeed: 0, range: 15, vision: [26, 16], aggro: 15, radius: 1.5,
    projectile: { kind: 'arrow', speed: 26, arc: 0.12 },
    structure: { tower: true, fire: 'direct', buildTime: 18, footprint: 1.5, minRange: 0, highGround: true, turnRate: 6 },
    abilities: [],
    lore: 'A Ranger on a timber platform with a good roof and a better view. Cheap, quick, and it shoots at anything that flies.',
  },
  sniperTower: {
    id: 'sniperTower', name: 'Sniper Tower', theme: 'modern', family: 'siege', role: 'Defense tower', type: 'ranged',
    cost: 220, trainTime: 0,
    hp: 600, hpRegen: 0, damage: 45, damageType: 'physical', attackSpeed: 24,
    armor: 3, ward: 0, evasion: 0, missChance: 0,
    moveSpeed: 0, range: 18, vision: [28, 18], aggro: 18, radius: 1.5,
    projectile: { kind: 'sniper', speed: 90, arc: 0 },
    structure: { tower: true, fire: 'direct', buildTime: 20, footprint: 1.5, minRange: 0, highGround: true, turnRate: 4, trueSight: 10 },
    abilities: [],
    lore: 'Steel watchtower, camo net, one patient marksman. Spots what hides in the dark (true sight) and picks it off.',
  },
  hwacha: {
    id: 'hwacha', name: 'Hwacha', theme: 'medieval', family: 'siege', role: 'Barrage tower', type: 'ranged',
    cost: 260, trainTime: 0,
    hp: 600, hpRegen: 0, damage: 14, damageType: 'physical', attackSpeed: 12,
    armor: 2, ward: 0, evasion: 0, missChance: 0,
    moveSpeed: 0, range: 13, vision: [22, 14], aggro: 13, radius: 1.6,
    structure: { tower: true, fire: 'volley', volley: { count: 10, cone: 0.5 }, buildTime: 22, footprint: 1.6, minRange: 2, splash: 1.5, flight: 0.7,
      groundOnly: true, turnRate: 3 },
    abilities: [],
    lore: 'A cart of rocket-arrows on a raised platform. Every five seconds the whole rack goes up in a hissing, fiery fan.',
  },
  mgNest: {
    id: 'mgNest', name: 'Machine Gun Nest', theme: 'modern', family: 'siege', role: 'Barrage tower', type: 'ranged',
    cost: 260, trainTime: 0,
    hp: 700, hpRegen: 0, damage: 5, damageType: 'physical', attackSpeed: 330,
    armor: 4, ward: 0, evasion: 0, missChance: 0,
    moveSpeed: 0, range: 11, vision: [24, 14], aggro: 11, radius: 1.6,
    projectile: { kind: 'bullet', speed: 60, arc: 0 },
    structure: { tower: true, fire: 'direct', buildTime: 22, footprint: 1.6, minRange: 0, highGround: true, turnRate: 5, suppress: { pct: 20, t: 1 } },
    abilities: [],
    lore: 'Sandbags on a concrete bunker and a belt-fed gun that never seems to stop. Anything it hits slows down.',
  },
});

// ---------- v0.11.0 troops ----------
Object.assign(UNITS, {
  lancer: {
    id: 'lancer', name: 'Lancer', theme: 'medieval', family: 'melee', role: 'Cavalry lancer', type: 'melee',
    cost: 160, trainTime: 5,
    hp: 200, hpRegen: 1.2, damage: 20, damageType: 'physical', attackSpeed: 45,
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
    armor: 6, ward: 4, evasion: 0, missChance: 0,
    moveSpeed: 2.9, range: 2, vision: [30, 16], aggro: 9, radius: 0.55,
    abilities: ['bulwark'],
    lore: 'Heavier than a patrol officer and twice as stubborn. The riot shield never drops: whatever comes from the front hits the polycarbonate first.',
  },
  reconDrone: {
    id: 'reconDrone', name: 'Recon Drone', theme: 'modern', family: 'marksman', role: 'Flying harasser', type: 'ranged', flying: true,
    cost: 160, trainTime: 4.5,
    hp: 60, hpRegen: 0.1, damage: 22, damageType: 'physical', attackSpeed: 40,
    armor: 2, ward: 1, evasion: 0, missChance: 0,
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
    hp: 120, hpRegen: 1.5, damage: 30, damageType: 'physical', attackSpeed: 70,
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
    radius: 10, damagePerAlly: 2, maxStacks: 5,           // capped: uncapped made 6+ officer packs unbeatable. null = uncapped
    text: (A) => `Gains +${A.damagePerAlly} damage for every other Police Officer within ${A.radius} range (max ${A.maxStacks} officers, +${A.damagePerAlly * A.maxStacks}). Weak alone, dangerous as a pack.`,
    desc: 'Gains +2 damage for every other Police Officer within 10 range (max 5 officers, +10). Weak alone, dangerous as a pack.',
  },
  eagleEye: {
    id: 'eagleEye', kind: 'passive', name: 'Eagle Eye', icon: 'p-eye',
    chance: 0.2, bonusDamage: 5, bonusPct: 0, bonusMagic: 0, trueStrike: false,   // skill-tree forms change these (Scout Ranger)
    desc: '20% chance on each shot to deal +5 bonus damage (critical shot).',
    text: (A, P) => `${P(A.chance)} chance on each shot to be a critical shot${A.trueStrike ? ' and a <b>true strike</b> (can\'t miss or be evaded)' : ''}: ${[A.bonusDamage ? `+${A.bonusDamage} damage` : '', A.bonusPct ? `+${P(A.bonusPct)} damage` : '', A.bonusMagic ? `+${A.bonusMagic} magic damage` : ''].filter(Boolean).join(', ')}.`,
  },
  cutThroat: {
    id: 'cutThroat', kind: 'passive', name: 'Cut Throat', icon: 'p-cutthroat', duration: 2,
    desc: 'After killing an enemy, becomes invulnerable for 2 seconds.',
  },
  bowsling: {
    id: 'bowsling', kind: 'passive', name: 'Bowsling', icon: 'p-bowsling', chance: 0.4,
    desc: '40% chance on each shot to fire a second arrow at another enemy within attack range.',
    text: (A, P) => `${A.chance >= 1 ? 'Every shot fires' : `${P(A.chance)} chance on each shot to fire`} a second arrow at another enemy within attack range.`,
  },
  tumble: {
    id: 'tumble', kind: 'active', name: 'Tumble', icon: 'a-tumble', cast: 'line', range: 3.4, width: 1.2, cooldown: 3,
    speedBonus: 15,                              // roll speed = current move speed + 15
    ai: { whenThreatened: true },
    desc: 'Roll 3.4 range toward the cursor at move speed +15. Cooldown 3s.',
  },
  fervor: {
    id: 'fervor', kind: 'passive', name: 'Fervor', icon: 'p-fervor',
    perStack: 6, maxStacks: 10, resetAfter: 2.5, pctPerStack: 0,   // pctPerStack: % of attack speed per stack instead of flat (Machine Gunner)
    desc: 'Each consecutive attack on the same target grants +6 attack speed, stacking up to 10 times (+60). Switching targets, or not attacking for 2.5s, resets the stacks.',
    text: (A, P) => `Each consecutive attack on the same target grants ${A.pctPerStack ? `+${P(A.pctPerStack)} bonus attack speed` : `+${A.perStack} attack speed`}, stacking ${A.maxStacks ? `up to ${A.maxStacks} times (max ${A.pctPerStack ? '+' + P(A.pctPerStack * A.maxStacks) : '+' + A.perStack * A.maxStacks})` : '<b>with no limit</b>'}. Switching targets, or not attacking for ${A.resetAfter}s, resets the stacks.`,
  },
  swiftStep: {
    id: 'swiftStep', kind: 'passive', name: 'Swift Step', icon: 'a-swift',
    evasion: 40,
    desc: 'Gains 40% evasion while moving.',
  },
  bullsEye: {
    id: 'bullsEye', kind: 'passive', name: "Bull's Eye", icon: 'p-bullseye',
    critBonus: 0.7, fullHpPct: 1,   // crits on targets at (or above) this fraction of max HP
    desc: 'Always a critical strike (+70% damage) against targets at full health.',
  },
  // ---------- actives ----------
  snipeStance: {
    id: 'snipeStance', kind: 'active', autocast: false, name: 'Snipe Stance', icon: 'a-scope', toggle: true,
    cooldown: 1, channel: 1, standUp: 1, standCooldown: 5, bonusRange: 6, bonusDamage: 3, armorPierce: 2, damageTakenMult: 2,
    ai: { dangerRadius: 5, standAfter: 3 },
    desc: 'Channels for 1s (S cancels), then lies prone: move speed 0, +6 range, +3 damage and attacks ignore 2 armor — but takes DOUBLE damage. Recast to stand up (1s channel), then 5s cooldown.',
  },
  splatter: {
    id: 'splatter', kind: 'active', autocast: false, affectsFlying: false, name: 'Splatter', icon: 'a-splatter',
    cooldown: 0, radius: 2.2, damage: 70, damageType: 'magic', selfDestruct: true,
    aiCast: { minTargets: 2, lowHpPct: 0.35 },          // when the AI uses it
    desc: 'Sacrifices itself in an organic explosion, dealing 70 magic damage to every enemy within 2.2 range (bases included). Can\'t be evaded.',
    // skill-tree variants (Imp tree) set: stun (s), shred { armor, t, buildings }, dmgMult, leap { range, speed }, burn { pct, t }
    text: (A, P) => [
      A.leap ? `Leaps up to ${A.leap.range} range toward the target point (speed ${A.leap.speed}) and explodes where it lands` : 'Sacrifices itself in an organic explosion',
      `: ${fmtN(A.damage * (A.dmgMult || 1))} magic damage to every enemy within ${A.radius} range (bases included)${A.dmgMult > 1 ? ` (+${P(A.dmgMult - 1)})` : ''}.`,
      A.stun ? ` Stuns them for ${A.stun}s.` : '',
      A.shred ? ` Reduces their armor by ${A.shred.armor} for ${A.shred.t}s${A.shred.buildings ? ' — buildings and the enemy base too' : ''}.` : '',
      A.burn ? ` Burns them for ${P(A.burn.pct)} of their max HP as magic damage per second for ${A.burn.t}s.` : '',
      ' Can\'t be evaded. Benefits from Organic Matter.',
    ].join(''),
  },
  // ---------- neutral creep abilities ----------
  resentment: { id: 'resentment', kind: 'passive', name: 'Resentment', icon: 'a-resent', threshold: 30, bonusDamage: 5, bonusAS: 30, duration: 3,
    desc: 'After taking 30 damage, gains +5 damage and +30 attack speed for 3 seconds.' },
  immaterial: { id: 'immaterial', kind: 'passive', name: 'Immaterial', icon: 'a-immaterial', static: { bonusEvasion: 30 }, desc: '30% chance to evade attacks.' },
  brainwash: { id: 'brainwash', kind: 'active', autocast: false, name: 'Brainwash', icon: 'a-brainwash', cooldown: 20, castRange: 8, duration: 15, castChance: 0.25,
    desc: 'Each fight (and each time the 20s cooldown ends mid-fight) the Banshee has a 25% chance to cast it, a few seconds in: one enemy troop it is fighting loses its will for 15s — it switches sides, attacks its former allies, then despawns (no bounty).' },
  moraleAura: { id: 'moraleAura', kind: 'passive', name: 'Morale Aura', icon: 'a-morale', aura: { radius: 4, bonusArmor: 2 },
    desc: 'Allies within 4 range (including itself) gain +2 armor.' },
  cleave: { id: 'cleave', kind: 'passive', name: 'Cleave', icon: 'a-cleave', pct: 0.4, radius: 3, cone: 1.2,   // cone = half-angle (rad), ~70°
    desc: 'Melee attacks also hit enemies in a wide cone (3 deep, ~140°) behind the target for 40% of the damage.' },
  // ---------- skill-tree passives (js/skilltree.js) ----------
  fury: {
    id: 'fury', kind: 'passive', name: 'Fury', icon: 'p-fury',
    duration: 5, maxStacks: 10, perStack: 0.04,   // +4% damage taken from Vikings per stack; maxStacks 0 = no limit (Chaotic Viking)
    desc: 'Each hit puts 1 Fury stack on the target for 5s (hitting again refreshes it and adds 1, max 10). The target takes +4% damage from every Viking per stack.',
    text: (A, P) => `Each hit puts 1 Fury stack on the target for ${A.duration}s (hitting again refreshes it and adds 1, ${A.maxStacks ? `max ${A.maxStacks}` : '<b>no limit</b>'}). The target takes +${P(A.perStack)} damage from every Viking per stack.`,
  },
  chainLightning: {
    id: 'chainLightning', kind: 'passive', name: 'Chain Lightning', icon: 'p-chain',
    chance: 0.2, damage: 35, pctMaxHp: 0, damageType: 'magic', jump: 2, targets: 4, bounceDelay: 0.3,
    desc: '20% chance on hit to zap the target with lightning for 35 magic damage. Every 0.3s it jumps to a random enemy within 2 range of the last one, up to 4 enemies.',
    text: (A, P) => `${P(A.chance)} chance on hit to zap the target with lightning for ${A.damage}${A.pctMaxHp ? ` + ${P(A.pctMaxHp)} of its max HP as` : ''} magic damage (each enemy it jumps to takes the same). Every ${A.bounceDelay}s it jumps to a random enemy within ${A.jump} range of the last one, up to ${A.targets} enemies.`,
  },
  // ---------- granted by Barracks upgrades (not on any troop by default) ----------
  flurry: {
    id: 'flurry', kind: 'active', name: 'Flurry', icon: 'u-flurry', granted: true,
    cooldown: 14, duration: 4, bonusAS: [60, 90, 120, 150, 180],          // by Flurry upgrade level 1-5
    ai: { whenAttacking: true },
    desc: 'Gain bonus attack speed for 4 seconds (scales with the Flurry upgrade). 14s cooldown.',
  },
  suppressiveFire: {
    id: 'suppressiveFire', kind: 'active', name: 'Suppressive Fire', icon: 'u-suppress', granted: true,
    cooldown: 16, duration: 4, bonusDamage: [4, 7, 10, 13, 16], knockback: [0.5, 0.575, 0.65, 0.725, 0.8],
    ai: { whenAttacking: true },
    desc: 'For 4 seconds, shots deal +4/7/10/13/16 bonus damage and knock the target back 0.5–0.8 (by upgrade level). 16s cooldown.',
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
    postBuff: null,   // High Elf: { as, attacks, t } attack-speed burst after casting
    desc: 'Aim a piercing arrow in a line (25 range). Hits every enemy on its path for the Elf\'s attack damage + 0/50/100/150/250 magic and slows 70% for 1s. Each enemy hit weakens it by 10%. Costs 50 mana.',
    text: (A) => `Aim a piercing arrow in a line (${A.range} range). Hits every enemy on its path for the Elf's attack damage + ${A.bonusMagic.join('/')} magic (by upgrade level) and slows ${A.slow}% for ${A.slowTime}s. Each enemy hit weakens it by ${Math.round(A.falloff * 100)}%. Costs ${A.manaCost} mana.${A.postBuff ? ` <b>After casting:</b> +${A.postBuff.as} attack speed for the next ${A.postBuff.attacks} attacks (within ${A.postBuff.t}s).` : ''}` },
  nightMeld: { id: 'nightMeld', kind: 'passive', name: 'Night Meld', icon: 'a-nightmeld', stillFor: 2,
    desc: 'At night, standing still for 2s without attacking makes the Elf invisible. Moving or attacking breaks it.' },
  shieldStomp: { id: 'shieldStomp', kind: 'active', name: 'Shield Stomp', icon: 'u-stomp', granted: true,
    castTime: 0.3, cooldown: 20, radius: 2, damage: [80, 120, 160, 200, 240], damageType: 'magic', knockback: 2.5, affectsFlying: false,
    ai: { whenAttacking: true },
    desc: 'Slams the shield down: 80/120/160/200/240 magic damage to enemies within 2 range and knocks them 2.5 away.' },
  bulwark: { id: 'bulwark', kind: 'passive', name: 'Bulwark', icon: 'a-bulwark', reduction: 0.6, arc: Math.PI * 2 / 3,
    text: (A, P) => `Basic attacks from the front (120°) deal ${P(A.reduction)} less damage, crits included. On-hit extras are not reduced.` },
  penetration: { id: 'penetration', kind: 'passive', name: 'Penetration', icon: 'a-penetration', shred: [2, 4, 6, 8, 10, 12], duration: 3, maxBonusAS: 20,
    desc: 'Attacks reduce the target\'s armor by 2 (4–12 with the Penetration upgrade) for 3s. Max upgrade: +20 attack speed.' },
  // ---------- skill-tree abilities, v0.23 (Imp, Lancer, Elf, Police, Gunner trees) ----------
  counterstrike: { id: 'counterstrike', kind: 'passive', name: 'Counterstrike', icon: 'p-counter', chance: 0.3,
    text: (A, P) => `When a basic attack hits him, ${P(A.chance)} chance to strike back at the attacker at once (if it is within his attack range). Doesn't use up his own attack.` },
  dkCurse: { id: 'dkCurse', kind: 'passive', name: 'Curse of the Death Knight', icon: 'p-dkcurse', slow: 20, duration: 4, heal: 10,
    text: (A) => `Attacks curse the target for ${A.duration}s: ${A.slow}% slower, and every ally that hits it heals ${A.heal} HP per hit.` },
  zealot: { id: 'zealot', kind: 'passive', name: 'Zealot', icon: 'p-zealot',
    text: () => 'Basic attacks ignore the target\'s <b>base</b> armor (armor from items, auras and buffs still counts).' },
  galewinds: { id: 'galewinds', kind: 'passive', name: 'Galewinds', icon: 'p-gale', moveSpeed: 3, duration: 1,
    text: (A) => `On hit, gains +${A.moveSpeed} move speed for ${A.duration}s (refreshes, doesn't stack).` },
  enforce: { id: 'enforce', kind: 'active', name: 'Enforce', icon: 'a-enforce', cooldown: 60, radius: 3, fear: 2, affectsFlying: true,
    ai: { minTargets: 2 },
    text: (A) => `Fears every enemy troop within ${A.radius} range for ${A.fear}s: they run away from him and can't attack or cast. ${A.cooldown}s cooldown.` },
  execute: { id: 'execute', kind: 'active', name: 'Execute', icon: 'a-execute', cast: 'unit', castRange: 6, castTime: 0.25, cooldown: 20, missingPct: 0.1,
    ai: { whenAttacking: true },
    text: (A, P) => `Target an enemy troop within ${A.castRange} range (walks closer if needed): after a ${A.castTime}s wind-up, instantly deals 100% of his attack damage + ${P(A.missingPct)} of the target's missing HP as physical damage. Can't be evaded. ${A.cooldown}s cooldown.` },
  disrupt: { id: 'disrupt', kind: 'passive', name: 'Disrupt', icon: 'p-disrupt', every: 3, stun: 0.8,
    text: (A) => `Every ${A.every}rd attack stuns the target for ${A.stun}s.` },
  outnumbered: { id: 'outnumbered', kind: 'passive', name: 'Outnumbered', icon: 'p-outnumbered', radius: 8, dmgPct: 0.15, armor: 5, ward: 5,
    text: (A, P) => `Counts troops within ${A.radius} range. As many or more allies than enemies: <b>+${P(A.dmgPct)} damage</b>. More enemies than allies: <b>+${A.armor} armor and +${A.ward} ward</b>.` },
  mediator: { id: 'mediator', kind: 'active', name: 'Mediator', icon: 'a-mediator', cooldown: 50, radius: 6, weaken: 0.5, duration: 5, affectsFlying: true,
    ai: { minTargets: 2 },
    text: (A, P) => `Screams: enemy troops within ${A.radius} range deal ${P(A.weaken)} less damage for ${A.duration}s. Several Mediators don't stack (it only refreshes). ${A.cooldown}s cooldown.` },
  doubleTap: { id: 'doubleTap', kind: 'passive', name: 'Double Tap', icon: 'p-doubletap', cooldown: 6, delay: 0.12,
    text: (A) => `His next attack fires twice in quick succession. Recharges ${A.cooldown}s after it triggers.` },
  boomstick: { id: 'boomstick', kind: 'passive', name: 'Boomstick', icon: 'p-boomstick', far: 8, near: 1, minPct: 0.1, maxPct: 2,
    text: (A, P) => `Shots hit harder the closer the target is: +${P(A.minPct)} damage at ${A.far} range, rising to +${P(A.maxPct)} at ${A.near} range or closer. No bonus beyond ${A.far}.` },
  scattershot: { id: 'scattershot', kind: 'active', name: 'Scattershot', icon: 'a-scatter', cast: 'line', cooldown: 11, flat: 10, adPct: 2.5, boom: true,
    width: 2.4, speed: 20, range: 8, affectsFlying: true, ai: { whenAttacking: true },
    text: (A, P) => `Fires a wide blast in a straight line (${A.range} range, ${A.width} wide): ${A.flat} + ${P(A.adPct)} of his attack damage as magic damage to every enemy it passes. ${A.cooldown}s cooldown.` },
  rapidFire: { id: 'rapidFire', kind: 'passive', name: 'Rapid Fire', icon: 'p-rapid', attacks: 8, bonusAS: 40, shred: 1, shredTime: 8, cooldown: 15,
    text: (A) => `His next ${A.attacks} attacks get +${A.bonusAS} attack speed and each one lowers the target's armor by ${A.shred} for ${A.shredTime}s (stacks; each stack has its own timer). Recharges ${A.cooldown}s after the last of them.` },
  relentless: { id: 'relentless', kind: 'passive', name: 'Relentless', icon: 'p-relentless', chance: 0.5, radius: 5,
    text: (A, P) => `Each shot has a ${P(A.chance)} chance to fly at a random other enemy within ${A.radius} range of his target instead. If the target is alone, every shot goes to it.` },
  flay: { id: 'flay', kind: 'active', name: 'Flay', icon: 'a-flay', cooldown: 3, radius: 2.5, adPct: 1.5, damageType: 'physical', affectsFlying: false,
    ai: { minTargets: 1 },
    text: (A, P) => `Swings his pike all around him: ${P(A.adPct)} of his attack damage as physical damage to every ground enemy within ${A.radius} range. ${A.cooldown}s cooldown.` },
  flick: { id: 'flick', kind: 'passive', name: 'Flick', icon: 'p-flick', chance: 0.3, slow: 60, slowTime: 1, onAttack: false,
    text: (A, P) => `When ${A.onAttack ? 'he attacks or is attacked' : 'he is attacked'}, ${P(A.chance)} chance to fire an extra shot at a random enemy in range that slows it by ${A.slow}% for ${A.slowTime}s.` },
};export const PASSIVES = ABILITIES;   // back-compat alias

/** Exact, current text for an ability definition (form overrides already merged in): `text(A, pct)` if it has one, else `desc`. */
const fmtN = (x) => Math.round(x * 100) / 100;
const pct = (x) => fmtN(x * 100) + '%';
// ---------- v0.29 Tier 2 troops (Medieval): Dryad, Catapult, Batrider ----------
Object.assign(UNITS, {
  dryad: {
    id: 'dryad', name: 'Dryad', theme: 'medieval', family: 'marksman', role: 'Spear-throwing spirit', type: 'ranged', tier: 2,
    cost: 200, trainTime: 6,
    hp: 200, hpRegen: 4, damage: 22, damageType: 'physical', attackSpeed: 50,
    armor: 6, ward: 3, evasion: 0, missChance: 0,
    moveSpeed: 3.2, range: 8.5, vision: [28, 18], aggro: 12, radius: 0.45,
    mana: 250, manaRegen: 1,
    projectile: { kind: 'spear', speed: 18, arc: 0.12 },
    abilities: ['naturesGrace', 'arcaneCoating'],
    lore: 'A small forest spirit with bark for skin and a bundle of thorn spears on her back. Creeps barely bruise her; whatever she coats keeps hurting long after she\'s gone.',
  },
  catapult: {
    id: 'catapult', name: 'Catapult', theme: 'medieval', family: 'marksman', role: 'Mobile siege', type: 'ranged', tier: 2,
    cost: 250, trainTime: 8,
    hp: 400, hpRegen: 0, damage: 60, damageType: 'physical', attackSpeed: 10,
    armor: 10, ward: -8, evasion: 0, missChance: 0,
    moveSpeed: 1.8, range: 14, minRange: 3, groundOnly: true, vision: [22, 14], aggro: 17, radius: 0.85,
    // ground-targeted boulder (Game.fireShell): lands where the target WAS, splash 1, can be dodged
    siege: { shell: 'ball', flight: 1.6, arc: 0.35, splash: 2.4, groundOnly: true, marker: true },
    abilities: ['siegeBonus', 'homingStone'],
    lore: 'A wheeled throwing-arm with one very brave operator. Slow, blind up close and helpless against anything that flies, but walls hate it.',
  },
  batrider: {
    id: 'batrider', name: 'Batrider', theme: 'medieval', family: 'marksman', role: 'Flying skirmisher', type: 'ranged', tier: 2, flying: true,
    cost: 300, trainTime: 7,
    hp: 180, hpRegen: 2, damage: 30, damageType: 'physical', attackSpeed: 60,
    armor: 3, ward: 4, evasion: 0, missChance: 0,
    moveSpeed: 3.3, range: 10, vision: [30, 20], aggro: 13, radius: 0.6,
    projectile: { kind: 'arrow', speed: 22, arc: 0.1 },
    abilities: ['acidSpray', 'grudge'],
    lore: 'An archer strapped to a giant bat. Swords can\'t reach them, the acid flask hurts more the longer you stand in it, and when one falls the rest get very angry.',
  },
});

Object.assign(ABILITIES, {
  // ----- Dryad -----
  naturesGrace: { id: 'naturesGrace', kind: 'passive', name: 'Nature\'s Grace', icon: 'p-grace', creepPhys: 0.5,
    text: (A, P) => `Neutral creeps deal ${P(A.creepPhys)} less physical damage to her.` },
  arcaneCoating: { id: 'arcaneCoating', kind: 'active', name: 'Arcane Coating', icon: 'a-coating', toggle: true, autocast: false, cooldown: 0.5,
    manaPerHit: 18, dps: 10, t: 4, slow: 15, ai: { toggle: true },
    text: (A, P) => `Toggle. While coated, every hit poisons the target for ${A.t}s: ${A.dps} magic damage per second${A.pctMaxHp ? ` + ${P(A.pctMaxHp)} of its max HP` : ''} and ${A.slow}% slow. ${A.manaPerHit ? `Costs ${A.manaPerHit} mana per hit; switches off when she runs dry.` : 'No mana cost.'}` },
  silenceStrike: { id: 'silenceStrike', kind: 'passive', name: 'Interrupt', icon: 'p-interrupt', silence: 1, spellCut: 0,
    text: (A, P) => `Anything she damages is <b>silenced</b> for ${A.silence}s (can't cast), refreshed on every hit${A.spellCut ? ` and deals ${P(A.spellCut)} less spell damage while silenced` : ''}. Counters casters.` },
  splitshot: { id: 'splitshot', kind: 'passive', name: 'Splitshot', icon: 'p-split', targets: 2, dmgPct: 0.75,
    text: (A, P) => `Every attack also throws a spear at the ${A.targets} nearest other enemies in range for ${P(A.dmgPct)} damage. On-hit effects apply (coated spears cost mana each).` },
  // ----- Catapult -----
  siegeBonus: { id: 'siegeBonus', kind: 'passive', name: 'Siege', icon: 'p-siege', unbreakable: true, vsBuildings: 2,
    text: (A, P) => `All of its damage is +${P(A.vsBuildings)} against buildings and bases.` },
  homingStone: { id: 'homingStone', kind: 'passive', name: 'Homing Stone', icon: 'p-stone', unbreakable: true, splash: 2.4,
    text: (A) => `Boulders land where the target was when thrown (fast troops can dodge) and splash ${A.splash} around the impact. Can't hit flying units or anything within 3 range.${A.fire ? ` Leaves fire for ${A.fire.t}s: ${A.fire.dps} magic damage per second${A.fire.buildings ? ', burning buildings and bases too' : ''}.` : ''} Can't be broken.` },
  // ----- Batrider -----
  acidSpray: { id: 'acidSpray', kind: 'active', name: 'Acid Spray', icon: 'a-acid', cast: 'point', cooldown: 30, castRange: 10, radius: 4,
    duration: 5, dps: 20, ramp: 0.2, affectsFlying: false, ai: { minTargets: 2 },
    text: (A, P) => `Soaks a ${A.radius}-radius area within ${A.castRange} range in acid for ${A.duration}s: enemies inside take ${A.dps} magic damage per second, +${P(A.ramp)} for every second the pool has lingered. Several pools don't stack (the strongest counts).` },
  grudge: { id: 'grudge', kind: 'passive', name: 'Grudge', icon: 'p-grudge', radius: 5, as: 50, t: 3,
    text: (A) => `When it dies, allies within ${A.radius} gain +${A.as} attack speed for ${A.t}s.` },
  protectorAura: { id: 'protectorAura', kind: 'passive', name: 'Protector Aura', icon: 'p-protector', aura: { radius: 5, bonusArmor: 3, bonusWard: 3 },
    text: (A) => `Allies within ${A.aura.radius} gain +${A.aura.bonusArmor} armor and +${A.aura.bonusWard} ward. Several Batriders don't stack.${A.enemyAura ? ` Enemies (buildings and bases too) within ${A.enemyAura.radius} lose ${A.enemyAura.armor} armor and ${A.enemyAura.ward} ward.` : ''}` },
  liberation: { id: 'liberation', kind: 'passive', name: 'Liberation', icon: 'p-liberation', every: 2, radius: 3, knockback: 2, flat: 30, adPct: 0.2, damageType: 'magic',
    text: (A, P) => `Every ${A.every}s blasts enemies within ${A.radius}: ${A.flat} + ${P(A.adPct)} of its attack damage as ${A.damageType} damage, knocking them ${A.knockback} away.` },
});

// ---------- v0.30 Modern skill trees: Sniper, Riot Skirmisher, Recon Drone ----------
Object.assign(ABILITIES, {
  // ----- Sniper -----
  steadyAim: { id: 'steadyAim', kind: 'passive', name: 'Steady Aim', icon: 'p-steady',
    text: () => 'Attacks <b>pierce evasion</b>: they can\'t miss or be evaded (flying and uphill misses included).' },
  precisionAura: { id: 'precisionAura', kind: 'passive', name: 'Precision Aura', icon: 'p-precision', notSelf: true, aura: { radius: 8, bonusRange: 1, bonusDamage: 6 },
    text: (A) => `Allies within ${A.aura.radius} range gain +${A.aura.bonusRange} attack range and +${A.aura.bonusDamage} attack damage. Doesn't affect the Sharpshooter himself; several auras don't stack.` },
  execution: { id: 'execution', kind: 'passive', name: 'Execution', icon: 'p-execution', radius: 8, maxBounces: 4,
    text: (A) => `When his bullet kills a unit, it bounces to the nearest ally of the victim within ${A.radius} range for the same damage (a Bull's Eye stays a Bull's Eye). Bounce kills bounce again, up to ${A.maxBounces} times.` },
  vendetta: { id: 'vendetta', kind: 'active', name: 'Vendetta', icon: 'a-vendetta', cooldown: 100, duration: 20, range: 3, moveSpeed: 5, bonusPct: 5, structPct: 1,
    ai: { whenAttacking: true },
    text: (A, P) => `Turns <b>invisible</b> for ${A.duration}s with +${A.moveSpeed} move speed, walks through trees and walls, and fights up close (attack range fixed at ${A.range}). His next attack ends it and deals <b>+${P(A.bonusPct)}</b> physical damage (+${P(A.structPct)} against buildings and bases). ${A.cooldown}s cooldown.` },
  assassinate: { id: 'assassinate', kind: 'active', name: 'Assassinate', icon: 'a-assassinate', cast: 'unit', castTime: 1, castRange: 22, castRangeBonus: 10, cooldown: 60,
    flat: 100, missingPct: 0.3, damageType: 'magic', ai: { whenAttacking: true },
    text: (A, P) => `Target an enemy within his attack range +${A.castRangeBonus}. Aims for ${A.castTime}s (works prone), then fires a deadly shot: ${A.flat} + ${P(A.missingPct)} of the target's missing HP as magic damage. Can't be evaded. ${A.cooldown}s cooldown.` },
  // ----- Riot Skirmisher -----
  fortress: { id: 'fortress', kind: 'passive', name: 'Fortress', icon: 'p-fortress',
    text: () => 'Enemy ranged attacks aimed at an ally behind him that pass through him are redirected into him instead.' },
  ironWill: { id: 'ironWill', kind: 'passive', name: 'Iron Will', icon: 'p-ironwill', structPhys: 0.8, fromUnits: 0.5,
    text: (A, P) => `Takes ${P(A.structPhys)} less physical damage from buildings, towers and bases, but ${P(A.fromUnits)} more damage from troops.` },
  absorb: { id: 'absorb', kind: 'passive', name: 'Absorb', icon: 'p-absorb', radius: 10,
    text: (A) => `Damage that allies within ${A.radius} range would take goes to him instead (their debuffs still land on them). He takes it before mitigation, so his own armor and ward apply. With several Dires, the nearest one takes it; Dires never pass damage to each other.` },
  breaker: { id: 'breaker', kind: 'passive', name: 'Breaker', icon: 'p-breaker', radius: 10, healRadius: 8, heal: 4, t: 8,
    text: (A) => `Every time an enemy within ${A.radius} range casts an ability or uses an item, he ignites: +1 stack for ${A.t}s that heals him and allies within ${A.healRadius} range ${A.heal} HP per second. Stacks without limit; each stack has its own timer.` },
  goldWill: { id: 'goldWill', kind: 'passive', name: 'Gold Will', icon: 'p-goldwill', fromUnits: 0.8, fromStructs: 0.5,
    text: (A, P) => `Takes ${P(A.fromUnits)} less <b>magic</b> damage from troops, but ${P(A.fromStructs)} more damage from buildings, towers and bases.` },
  combust: { id: 'combust', kind: 'passive', name: 'Combust', icon: 'p-combust', threshold: 100, damage: 150, radius: 10, shield: 100, shieldT: 5, cooldown: 20,
    text: (A) => `Stores the magic damage he takes. At ${A.threshold} stored he explodes: ${A.damage} magic damage to enemies within ${A.radius} range, and he and allies within ${A.radius} range get a <b>${A.shield} shield</b> for ${A.shieldT}s (absorbs damage before HP). ${A.cooldown}s cooldown after it goes off.` },
  // ----- Recon Drone -----
  miniDrones: { id: 'miniDrones', kind: 'passive', name: 'Mini Drones', icon: 'p-minidrone', count: 2, dmgPct: 0.5, leash: 3,
    text: (A, P) => `${A.count} mini drones follow him. They can't be targeted or hurt, fly up to ${A.leash} range from him and shoot random enemies around him with his range and attack speed for ${P(A.dmgPct)} of his damage. Their hits apply on-hit effects (Penetration). Break grounds them until it ends.` },
  homingMissile: { id: 'homingMissile', kind: 'passive', name: 'Homing Missile', icon: 'p-missile', cooldown: 10, magic: 80, radius: 3, bonusRange: 4, extra: 0,
    text: (A) => `Every ${A.cooldown}s his next attack is a missile with +${A.bonusRange} range that also blasts ${A.magic} magic damage to enemies within ${A.radius} of the impact.${A.extra ? ` Fires ${A.extra} more missile at another random enemy in range (or the same target if there is none).` : ''}` },
  packBonus: { id: 'packBonus', kind: 'passive', name: 'Pack Bonus', icon: 'p-pack', radius: 8, damage: 2, armor: 1, moveSpeed: 0.1, as: 2, maxStacks: 10,
    text: (A) => `For every other Swarm or Hive drone within ${A.radius} range: +${A.damage} damage, +${A.armor} armor, +${A.moveSpeed} move speed and +${A.as} attack speed, up to ${A.maxStacks} drones.` },
});
// Bull's Eye text (Assassin forms add % current HP + Break)
ABILITIES.bullsEye.text = (A, P) => `Always a critical strike dealing ${P(A.critBonus)} bonus damage against targets at full health${A.curHpPct ? `, plus <b>${P(A.curHpPct)} of the target's current HP</b> as physical damage, and Breaks it for ${A.breakT}s` : ''}.`;

/** Troop tier (UNITS[id].tier, default 1). Tier N needs a level N base to hire. */
export const tierOf = (id) => UNITS[id]?.tier || 1;
/** Army space a troop takes (UNITS[id].housing, default = its tier: Tier 1 = 1, Tier 2 = 2...). */
export const housingOf = (id) => UNITS[id]?.housing ?? tierOf(id);
/** Player autocast (right-click an active): only actives the AI knows how to use, minus the ones opted out (autocast: false). */
export const canAutocast = (A) => !!A && A.kind === 'active' && !!(A.ai || A.aiCast) && A.autocast !== false;
export function abilityText(A) { try { return typeof A.text === 'function' ? A.text(A, pct) : A.desc; } catch { return A.desc || ''; } }

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
  rusticSword:  { id: 'rusticSword', sprite: 'it-sword', tier: 1,  name: 'Rustic Sword',   icon: '#9aa3ab', desc: '+6 damage', stats: { damage: 6 } },
  oldManShield: { id: 'oldManShield', sprite: 'it-shield', tier: 1, name: 'Old Man Shield', icon: '#8a5a2b', desc: 'Passive: 50% chance to block a random 5–7 damage from a basic attack you take.', block: [5, 7], blockChance: 0.5 },
  sash:         { id: 'sash', sprite: 'it-sash', tier: 1,         name: 'Sash',           icon: '#c0392b', desc: '+1 move speed', stats: { moveSpeed: 1 } },
  quiver:       { id: 'quiver', sprite: 'it-quiver', tier: 1,       name: 'Quiver',         icon: '#6b4423', desc: 'Passive: on a ranged troop, +1 attack range and +20 attack speed (no effect on melee).', rangedStats: { range: 1, attackSpeed: 20 } },
  // --- modern camp drops ---
  shoulderGuard:{ id: 'shoulderGuard', sprite: 'it-shoulder', tier: 1,name: 'Shoulder Guard', icon: '#3b4652', desc: '+2 armor, +2 ward', stats: { armor: 2, ward: 2 } },
  shackles:     { id: 'shackles', sprite: 'it-shackles', tier: 1,     name: 'Shackles',       icon: '#5a5f69', desc: 'Passive: on a melee troop, 20% chance on hit to DISARM the target for 3s (it can\'t start attacks). Doesn\'t stack: an already-disarmed target can\'t be disarmed again or refreshed.', disarm: { chance: 0.2, duration: 3 } },
  riotHelmet:   { id: 'riotHelmet', sprite: 'it-helmet', tier: 1,   name: 'Riot Helmet',    icon: '#2f4a8a', desc: 'Passive: gain +3 armor for 3s after being hit by a ranged attack.', helmet: { armor: 3, duration: 3 } },
  wellDoneSteak:{ id: 'wellDoneSteak', sprite: 'it-steak', tier: 1, name: 'Well Done Steak', icon: '#a8502a', desc: 'Active: eat it to heal 50 HP. Used up.',
    active: { heal: 50, consumable: true, cooldown: 0, ai: 'lowHp' } },
  robe:         { id: 'robe', sprite: 'it-robe', tier: 1,          name: 'Robe',           icon: '#4a3aa0', desc: '+5 max mana and +1 mana regen (only on troops that have mana).', manaStats: { mana: 5, manaRegen: 1 } },
  broadsword:   { id: 'broadsword', sprite: 'it-broadsword', tier: 1, name: 'Broadsword',   icon: '#c9d1d8', desc: '+15 damage, -20 attack speed.', stats: { damage: 15, attackSpeed: -20 } },
  javelin:      { id: 'javelin', sprite: 'it-javelin', tier: 1,     name: 'Javelin',        icon: '#a07040', desc: '+2 damage. Active: for 3s your next attack is a true strike (can\'t miss or be evaded) and Breaks the target for 3s. Cooldown 12s.',
    stats: { damage: 2 }, active: { trueStrike: 3, breakT: 3, cooldown: 12, ai: 'attacking' } },
  pocketKnife:  { id: 'pocketKnife', sprite: 'it-knife', tier: 1,  name: 'Pocket Knife',   icon: '#c9d1d8', desc: '+4 damage. On hit, deals +3 damage to every enemy within 3 range of you.', stats: { damage: 4 }, splash: { damage: 3, radius: 3 } },
};

// AI difficulty 1-10. Levels 1-3 = the original Recruit / Veteran / Warlord brains. From 4 up the AI also gets cheats:
//   dmgTaken / dmgDealt: multipliers on damage its troops and base take / its troops deal
//   goldMult: income AND kill bounty; trainMult / researchMult: time multipliers; startGold: extra gold at 0:00
//   baseLevel: its base starts at this level; xpMult: its troops level up (skill tree) this much faster
//   brain: thinkEvery (s between decisions), hesitate (chance to skip a decision), waveSize, researchRate, sloppy (0-1)
const BRAIN = {
  recruit: { thinkEvery: 1.6, hesitate: 0.35, waveSize: 1, researchRate: 0.15, sloppy: 0.6 },
  veteran: { thinkEvery: 0.8, hesitate: 0.1, waveSize: 4, researchRate: 0.35, sloppy: 0.3 },
  warlord: { thinkEvery: 0.4, hesitate: 0, waveSize: 5, researchRate: 0.6, sloppy: 0.1 },
  hell:    { thinkEvery: 0.3, hesitate: 0, waveSize: 5, researchRate: 0.8, sloppy: 0 },
};
export const DIFFICULTY = {
  1:  { name: 'Recruit',    ...BRAIN.recruit, goldMult: 0.8,  hint: 'Earns 20% less gold and second-guesses itself.' },
  2:  { name: 'Veteran',    ...BRAIN.veteran, goldMult: 1.0,  hint: 'Fair fight: same income as you, attacks in groups of 4.' },
  3:  { name: 'Warlord',    ...BRAIN.warlord, goldMult: 1.25, hint: '25% more gold, attacks in waves of 5.' },
  4:  { name: 'Champion',   ...BRAIN.warlord, goldMult: 1.5,  dmgTaken: 0.8, hint: 'Its troops take 20% less damage. 50% more gold.' },
  5:  { name: 'Conqueror',  ...BRAIN.warlord, goldMult: 2.0,  dmgTaken: 0.8, dmgDealt: 1.2, hint: 'Takes 20% less damage, deals 20% more. Double gold.' },
  6:  { name: 'Tyrant',     ...BRAIN.warlord, goldMult: 2.25, dmgTaken: 0.75, dmgDealt: 1.3, trainMult: 0.85, startGold: 100, hint: 'Takes 25% less, deals 30% more, 2.25x gold, trains 15% faster.' },
  7:  { name: 'Overlord',   ...BRAIN.hell,    goldMult: 2.5,  dmgTaken: 0.7, dmgDealt: 1.4, trainMult: 0.75, researchMult: 0.75, startGold: 200, xpMult: 1.5, hint: 'Takes 30% less, deals 40% more, 2.5x gold, faster training, research and evolutions.' },
  8:  { name: 'Nightmare',  ...BRAIN.hell,    goldMult: 3.0,  dmgTaken: 0.65, dmgDealt: 1.5, trainMult: 0.65, researchMult: 0.6, startGold: 300, xpMult: 2, baseLevel: 2, hint: 'Takes 35% less, deals 50% more, triple gold, starts with a level 2 base.' },
  9:  { name: 'Apocalypse', ...BRAIN.hell,    goldMult: 3.5,  dmgTaken: 0.6, dmgDealt: 1.6, trainMult: 0.55, researchMult: 0.5, startGold: 400, xpMult: 2.5, baseLevel: 3, hint: 'Takes 40% less, deals 60% more, 3.5x gold, starts with a level 3 base.' },
  10: { name: 'HELL',       ...BRAIN.hell,    goldMult: 4.0,  dmgTaken: 0.5, dmgDealt: 1.75, trainMult: 0.5, researchMult: 0.4, startGold: 600, xpMult: 3, baseLevel: 3, hint: 'Takes half damage, deals 75% more, 4x gold, everything faster. Good luck.' },
};
// old names still work (saved links, Dev Lab, the demo match)
DIFFICULTY.easy = DIFFICULTY[1]; DIFFICULTY.normal = DIFFICULTY[2]; DIFFICULTY.hard = DIFFICULTY[3];

// AI personalities: every AI rolls one per match (weighted by difficulty), so no two matches feel the same.
//   greed: jungles/saves more, defends less · aggro: smaller, earlier waves and invades · caution: bigger waves, defends,
//   repairs early · smart: reads fights (retreats when outmatched, rescues its junglers, focuses) · sloppy comes from the level
export const AI_PERSONALITIES = {
  greedy:    { name: 'Greedy',     greed: 0.9, aggro: 0.3, caution: 0.3, smart: 0.5 },
  defensive: { name: 'Defensive',  greed: 0.4, aggro: 0.2, caution: 0.9, smart: 0.6 },
  aggressive:{ name: 'Aggressive', greed: 0.2, aggro: 0.9, caution: 0.2, smart: 0.4 },
  tactician: { name: 'Tactician',  greed: 0.5, aggro: 0.5, caution: 0.5, smart: 1.0 },
  wildcard:  { name: 'Wildcard',   greed: 0.5, aggro: 0.6, caution: 0.3, smart: 0.3, chaos: 1 },
};

/** attacks per minute -> seconds between attacks */
export const attackInterval = (aps) => 60 / Math.max(1, Math.min(GAME.maxAttackSpeed, aps));   // capped: uncapped stacking (Mercenary) can't break the sim

/** Damage per second vs a target's defenses (base stats, passives excluded). */
export function dps(stats, target = { armor: 0, ward: 0 }) {
  const def = DAMAGE_TYPES[stats.damageType || 'physical'].defense;
  return stats.damage * (def ? defenseMult(target[def] || 0) : 1) * stats.attackSpeed / 60;
}
