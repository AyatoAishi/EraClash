// ============================================================
//  NEUTRAL CAMPS (Dota-style). Team 2 = neutral.
//  - Camps spawn at every full minute (1:00, 2:00 ...) IF their spawn box is empty
//    (no living unit of any team inside). Pull creeps out of the box right before
//    the minute mark and a fresh set spawns -> stacking.
//  - Creeps only fight when attacked; they chase up to `leash` from home, then walk back
//    and regenerate.
// ============================================================

export const NEUTRAL_TEAM = 2;
export const CAMP_RULES = {
  firstSpawn: 60,     // seconds
  interval: 60,
  boxRadius: 4,       // spawn box (must be empty to spawn)
  leash: 11,          // max chase distance from home
  giveUpAfter: 5,     // seconds without being hit -> go home
  chaseWindow: 3,     // seconds a creep may chase OUTSIDE its spawn box before it gives up
  giveUpHeal: { pct: 0.05, time: 4 },   // on giving up: heal 5% max HP/s for 4s (camp creeps only)
  dropChance: 0.50,   // per creep killed, Tier 1
  dropFalloff: 0.25,  // each tier up drops 25% less often (T2 37.5%, T3 28.13%...)
  dayAggroRange: 2,   // during the day, enemies this close wake the camp; at night camps sleep
};

// ---------- tiers ----------
// A camp spot has a TIER. Every spawn rolls a random creep GROUP of that tier (nothing is tied to a map side),
// and its creeps drop random ITEMS of that tier (ITEMS[x].tier in config.js).
// Drop chance: Tier 1 = 20%, each tier above is 20% lower than the one below it (16%, 12.8%, ...).
export const CREEP_GROUPS = {
  1: [
    { id: 'bears',   name: 'Bear pack',   units: ['direBear', 'blueBear', 'blueBear'] },
    { id: 'wraiths', name: 'Wraiths',     units: ['banshee', 'smallBanshee'] },
    { id: 'thugs',   name: 'Thug crew',   units: ['alphaThug', 'hooligan', 'hooligan'] },
    { id: 'outlaws', name: 'Outlaw gang', units: ['outlaw', 'outlaw'] },
  ],
  // 2: [ ...stronger groups later ],
};
export const dropChanceForTier = (tier) => CAMP_RULES.dropChance * Math.pow(1 - CAMP_RULES.dropFalloff, Math.max(0, tier - 1));
export const creepTierOf = (unitId) => {
  for (const [t, groups] of Object.entries(CREEP_GROUPS)) if (groups.some((g) => g.units.includes(unitId))) return +t;
  return 1;
};

// Camp spots: position + tier. `side` / `name` only decide the scenery around it (forest vs back alley).
export const CAMPS = [
  { id: 'medTop',    name: 'Forest camp (top)',    side: 'medieval', x: -36, z: -25, tier: 1 },
  { id: 'medBottom', name: 'Forest camp (bottom)', side: 'medieval', x: -36, z: 25,  tier: 1 },
  { id: 'modTop',    name: 'Alley camp (top)',     side: 'modern',   x: 36,  z: -25, tier: 1 },
  { id: 'modBottom', name: 'Alley camp (bottom)',  side: 'modern',   x: 36,  z: 25,  tier: 1 },
  // outer ring (added with the bigger map): two deep in each corner, two flanking the north hill / south woods
  { id: 'medFarTop',    name: 'Deep woods (top)',      side: 'medieval', x: -48, z: -38, tier: 1 },
  { id: 'medFarBottom', name: 'Deep woods (bottom)',   side: 'medieval', x: -48, z: 38,  tier: 1 },
  { id: 'medHillTop',   name: 'Hillside glade (top)',  side: 'medieval', x: -28, z: -39, tier: 1 },
  { id: 'medMidBottom', name: 'Woodland glade (bottom)', side: 'medieval', x: -27, z: 39, tier: 1 },
  { id: 'modFarTop',    name: 'Rail yard (top)',       side: 'modern',   x: 48,  z: -38, tier: 1 },
  { id: 'modFarBottom', name: 'Rail yard (bottom)',    side: 'modern',   x: 48,  z: 38,  tier: 1 },
  { id: 'modHillTop',   name: 'Park lot (top)',        side: 'modern',   x: 28,  z: -39, tier: 1 },
  { id: 'modMidBottom', name: 'Plaza alley (bottom)',  side: 'modern',   x: 27,  z: 39,  tier: 1 },
];
