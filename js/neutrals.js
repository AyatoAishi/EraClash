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
  returnRegen: 0.15,  // fraction of max HP healed per second while walking home
  dropChance: 0.20,   // per creep killed
  dayAggroRange: 2,   // during the day, enemies this close wake the camp; at night camps sleep
};

export const CAMPS = [
  { id: 'medTop',    name: 'Bear den',     side: 'medieval', x: -36, z: -25, units: ['direBear', 'blueBear', 'blueBear'], drops: ['rusticSword', 'oldManShield', 'sash', 'quiver'] },
  { id: 'medBottom', name: 'Wraith grove', side: 'medieval', x: -36, z: 25,  units: ['banshee', 'smallBanshee'],          drops: ['rusticSword', 'oldManShield', 'sash', 'quiver'] },
  { id: 'modTop',    name: 'Thug corner',  side: 'modern',   x: 36,  z: -25, units: ['alphaThug', 'hooligan', 'hooligan'], drops: ['shoulderGuard', 'shackles', 'riotHelmet', 'pocketKnife'] },
  { id: 'modBottom', name: 'Outlaw yard',  side: 'modern',   x: 36,  z: 25,  units: ['outlaw', 'outlaw'],                  drops: ['shoulderGuard', 'shackles', 'riotHelmet', 'pocketKnife'] },
];
