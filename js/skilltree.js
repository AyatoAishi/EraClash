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
//    stats       BASE stat changes vs the BASE troop. They do NOT stack with the parent node: the deepest node's
//                numbers are the totals (Stray Ranger +20 AS -> Hunter +20 AS = still +20 in total)
//    cost        optional price change vs the base troop (+/- gold), same rule (not stacked)
//    abilities   passives/actives added (children keep them)
//    removes     abilities the form loses (Hitman drops Enforce)
//    abilityMods { abilityId: { field: value } } overrides for an ability's numbers (children inherit). Can rename / re-icon it too.
//    look        { eyes: 0xRRGGBB, hair|colors: { fromColor: toColor }, gear: ['gearId'] }  -> model recolor (eyes glow) +
//                extra pieces / particles from FORM_GEAR in models.js (only the deepest node's gear is used)
//    desc        a few words for the tree card (exact numbers live in the ability tooltips)
//  Add a tree: one entry in SKILL_TREES keyed by the unit id. Nothing else to wire.
// ============================================================
import { UNITS, ABILITIES } from './config.js';

export const LEVELING = {
  // Exp: a kill gives exp equal to the victim's gold bounty (enemy troops x enemyMult, creeps x1).
  // Exp needed to go from level L-1 to L: 50, 70, 90 ... (+20 per level; Lv 5 = 450, Lv 15 = 2850),
  // times (1 + tierStep x (tier - 1)): Tier 2 troops need 25% more, Tier 3 50% more...
  xpFor: (L, tier = 1) => Math.round((50 + 20 * (L - 1)) * (1 + LEVELING.tierStep * (tier - 1))),
  enemyMult: 1.2,
  tierStep: 0.25,
  maxLevel: 30,
};

/** Level reached with `xp` exp (for a troop of `tier`), plus progress toward the next one. */
export function levelInfo(xp, tier = 1) {
  let L = 0, spent = 0;
  while (L < LEVELING.maxLevel && xp >= spent + LEVELING.xpFor(L + 1, tier)) { spent += LEVELING.xpFor(L + 1, tier); L++; }
  const need = L >= LEVELING.maxLevel ? 0 : LEVELING.xpFor(L + 1, tier);
  return { level: L, into: Math.floor(xp - spent), need, max: L >= LEVELING.maxLevel };
}

// Scout Ranger / Stalker: Eagle Eye becomes 30% chance for a TRUE STRIKE (can't miss or be evaded) with +30% damage + 5 magic
const EAGLE_EYE_SCOUT = { chance: 0.3, bonusDamage: 0, bonusPct: 0.3, bonusMagic: 5, trueStrike: true,
  desc: '30% chance on each shot to be a true strike (can\'t miss or be evaded) that deals +30% damage and 5 bonus magic damage.' };

// Imp recolors: skin, belly, ears, wings
const IMP_SKIN = (skin, belly, ears, wing) => ({ 0xb8342a: skin, 0xd0503e: belly, 0xa02a22: ears, 0x6a1a20: wing });
const ICE_SPLATTER = { name: 'Ice Splatter', icon: 'a-icesplat', stun: 2 };
const FIRE_SPLATTER = { name: 'Fire Splatter', icon: 'a-firesplat', cast: 'line', leap: { range: 12, speed: 18 }, burn: { pct: 0.04, t: 3 } };

export const SKILL_TREES = {
  viking: {
    frenzy: {
      name: 'Frenzy Viking', from: null, level: 5,
      stats: { hpRegen: 1 }, abilities: ['fury'],
      look: { eyes: 0xff3b2f, hair: { 0xc8642a: 0x8e1b1b, 0xa84f1e: 0x6a1010 }, gear: ['warpaint', 'bloodAxe'] },
      desc: 'Stacks Fury: Vikings hit harder.',
    },
    lightning: {
      name: 'Lightning Viking', from: null, level: 5,
      stats: { attackSpeed: 10 }, abilities: ['chainLightning'],
      look: { eyes: 0x6fe3ff, hair: { 0xc8642a: 0xe8e2c8, 0xa84f1e: 0xc9c2a2 }, gear: ['stormAxe'] },
      desc: 'Hits arc lightning through crowds.',
    },
    chaotic: {
      name: 'Chaotic Viking', from: 'frenzy', level: 15,
      stats: { hpRegen: 2 }, abilityMods: { fury: { maxStacks: 0 } },
      look: { eyes: 0xffe14a, hair: { 0xc8642a: 0x2a0a0a, 0xa84f1e: 0x1a0505 }, gear: ['warpaint', 'chaosAxe', 'spikedHelm', 'embers'] },
      desc: 'Fury without a cap.',
    },
    storm: {
      name: 'Storm Viking', from: 'lightning', level: 15,
      stats: { attackSpeed: 20, moveSpeed: 0.3 }, abilityMods: { chainLightning: { damage: 40, chance: 0.3 } },
      look: { eyes: 0xffffff, hair: { 0xc8642a: 0x5a7bd8, 0xa84f1e: 0x3e5ab0 }, colors: { 0x7a2e22: 0x24345e }, gear: ['stormAxe', 'wingHelm', 'sparks'] },
      desc: 'Stronger, more frequent lightning.',
    },
  },
  archer: {   // Ranger
    scout: {
      name: 'Scout Ranger', from: null, level: 5,
      cost: 5, stats: { damage: 2 }, abilityMods: { eagleEye: EAGLE_EYE_SCOUT },
      look: { eyes: 0xffe14a, hair: { 0x2a1d14: 0xd8c070, 0x8a3b1e: 0xe8d890 }, gear: ['feather', 'spyglass'] },
      desc: 'Eagle Eye: true-strike shots.',
    },
    stalker: {
      name: 'Stalker', from: 'scout', level: 15,
      cost: 5, stats: { damage: 2, range: 1, mana: 100, manaRegen: 1 }, abilities: ['cutThroat'], abilityMods: { eagleEye: EAGLE_EYE_SCOUT },
      look: { eyes: 0xff3b2f, hair: { 0x2a1d14: 0x14141a, 0x8a3b1e: 0x24242e }, colors: { 0x3d5a24: 0x1e1e26, 0x34501f: 0x16161c, 0x4e6b2e: 0x2a2a34 }, gear: ['faceMask', 'backDaggers'] },
      desc: 'Longer reach, untouchable after kills.',
    },
    stray: {
      name: 'Stray Ranger', from: null, level: 5,
      stats: { attackSpeed: 20 }, abilities: ['bowsling'],
      look: { eyes: 0x8ef0a0, hair: { 0x2a1d14: 0xb04a1a, 0x8a3b1e: 0xd86a2a }, gear: ['patchCloak'] },
      desc: 'Faster draw, sometimes a 2nd arrow.',
    },
    rogue: {
      name: 'Rogue', from: 'stray', level: 15,
      stats: { attackSpeed: 40 }, abilities: ['tumble'],
      look: { eyes: 0xd070ff, hair: { 0x2a1d14: 0x5a2a7a, 0x8a3b1e: 0x7a3aa0 }, colors: { 0x3d5a24: 0x3a2050, 0x34501f: 0x2a1840 }, gear: ['faceMask', 'beltDaggers'] },
      desc: 'Very fast draw + Tumble roll.',
    },
    hunter: {
      name: 'Hunter', from: 'stray', level: 15,
      stats: { attackSpeed: 20, moveSpeed: 0.5 }, abilityMods: { bowsling: { chance: 1 } },
      look: { eyes: 0xff9a2a, hair: { 0x2a1d14: 0xe8e8e8, 0x8a3b1e: 0xc8c8c8 }, gear: ['wolfPelt'] },
      desc: 'Every shot is a double shot.',
    },
  },
  imp: {
    ice: {
      name: 'Ice Imp', from: null, level: 5,
      stats: { damage: 5, ward: 2 }, abilityMods: { splatter: ICE_SPLATTER },
      look: { colors: IMP_SKIN(0x4a8ad8, 0x6aa8f0, 0x3a6ab0, 0x1a3a70), eyes: 0x9af0ff, gear: ['iceShards'] },
      desc: 'Splatter stuns.',
    },
    cryonic: {
      name: 'Cryonic Imp', from: 'ice', level: 15,
      stats: { damage: 10, ward: 3 }, abilityMods: { splatter: { ...ICE_SPLATTER, name: 'Cryonic Splatter', icon: 'a-cryosplat', dmgMult: 1.5 } },
      look: { colors: IMP_SKIN(0xbfe6ff, 0xe0f4ff, 0x8ac8f0, 0x3a7ab0), eyes: 0x2a8aff, gear: ['iceShards', 'iceCrown', 'frost'] },
      desc: 'Stun + 50% more Splatter damage.',
    },
    sacred: {
      name: 'Sacred Imp', from: null, level: 5,
      stats: { moveSpeed: 1, armor: 2 }, abilityMods: { splatter: { name: 'Sacred Splatter', icon: 'a-sacredsplat', shred: { armor: 10, t: 5 } } },
      look: { colors: IMP_SKIN(0xe8d8a8, 0xf4ecd0, 0xd0b878, 0xf0f0f0), eyes: 0xfff3a0, gear: ['halo'] },
      desc: 'Splatter melts armor.',
    },
    cursed: {
      name: 'Cursed Imp', from: 'sacred', level: 15,
      stats: { moveSpeed: 2, armor: 3 }, abilityMods: { splatter: { name: 'Cursed Splatter', icon: 'a-cursedsplat', shred: { armor: 12, t: 5, buildings: true } } },
      look: { colors: IMP_SKIN(0x4a2a5a, 0x6a3a7a, 0x3a1a4a, 0x1a0a20), eyes: 0xc070ff, gear: ['brokenHalo', 'curseWisps'] },
      desc: 'Armor melt hits buildings too.',
    },
    fire: {
      name: 'Fire Imp', from: null, level: 5,
      stats: { hp: 30 }, abilityMods: { splatter: FIRE_SPLATTER },
      look: { colors: IMP_SKIN(0xe85a1a, 0xff8a3a, 0xc8401a, 0x5a1a0a), eyes: 0xffe14a, gear: ['flameCrest', 'flames'] },
      desc: 'Splatter leaps and burns.',
    },
    brimstone: {
      name: 'Brimstone Imp', from: 'fire', level: 15,
      stats: { hp: 60 }, abilityMods: { splatter: { ...FIRE_SPLATTER, name: 'Brimstone Splatter', icon: 'a-brimsplat', dmgMult: 1.3, radius: 3.2, burn: { pct: 0.05, t: 4 } } },
      look: { colors: IMP_SKIN(0x2a1a1a, 0x5a2a1a, 0x1a1010, 0x0a0505), eyes: 0xff6a1a, gear: ['magmaCracks', 'flameCrest', 'flames'] },
      desc: 'Bigger, hotter leap blast.',
    },
  },
  lancer: {
    crusader: {
      name: 'Crusader', from: null, level: 5,
      stats: { damage: 5, hp: 50, moveSpeed: 0.4 },
      look: { colors: { 0x2f62b8: 0xf0f0f0, 0xffffff: 0xc0392b, 0xc0392b: 0xf0f0f0 }, gear: ['crusaderCross'] },
      desc: 'Tougher, harder, faster.',
    },
    legion: {
      name: 'Legion Commander', from: 'crusader', level: 15,
      stats: { damage: 10, hp: 70, moveSpeed: 0.5 }, abilities: ['counterstrike'],
      look: { colors: { 0x2f62b8: 0xa02020, 0xb8c0c8: 0xe0b040, 0xc0392b: 0xf2c94c, 0xffffff: 0xf2c94c }, gear: ['goldCrest', 'bigCape'] },
      desc: 'Strikes back when hit.',
    },
    deathKnight: {
      name: 'Death Knight', from: 'crusader', level: 15,
      stats: { damage: 8, hp: 50, moveSpeed: 0.4, attackSpeed: 10 }, abilities: ['dkCurse'],
      look: { colors: { 0x2f62b8: 0x1a1a22, 0xb8c0c8: 0x2a2a32, 0x8a939c: 0x1e1e26, 0xc0392b: 0x3a8a3a, 0xffffff: 0x5cff7a, 0x6b4a2a: 0x1a1a1a, 0x9aa3ab: 0x3a3a44 }, gear: ['deathVisor', 'skullLance', 'soulWisps'] },
      desc: 'Curses targets: slow + ally heals.',
    },
  },
  elf: {
    highElf: {
      name: 'High Elf', from: null, level: 5,
      stats: { damage: 8 }, abilityMods: { arrowPiercer: { postBuff: { as: 50, attacks: 3, t: 4 } } },
      look: { colors: { 0xe8e2c8: 0xf7e7a0, 0x4aa3ff: 0xf2c94c, 0xd8c890: 0xf2c94c }, gear: ['goldCrown'] },
      desc: 'Arrow Piercer speeds up her draw.',
      needs: { grant: 'arrowPiercer', text: 'The Arrow Piercer boost needs the Arrow Piercer Barracks upgrade' },
    },
    drow: {
      name: 'Drow', from: 'highElf', level: 15,
      stats: { damage: 10 }, abilities: ['zealot'],
      look: { colors: { 0xf2d6be: 0x6a5a7a, 0xe8e2c8: 0xf4f4f4, 0x4aa3ff: 0xff3b2f, 0x4c8c36: 0x3a2a4a, 0x5aa040: 0x5a3a7a, 0x3f7a2e: 0x2a1a3a, 0xd8c890: 0x4a3a5a }, gear: ['drowBlades'] },
      desc: 'Shots ignore base armor.',
    },
    eladrin: {
      name: 'Eladrin', from: 'highElf', level: 15,
      stats: { damage: 9, attackSpeed: 5 }, abilities: ['galewinds'],
      look: { colors: { 0xe8e2c8: 0x9af0e0, 0x4aa3ff: 0x5cffd0, 0x4c8c36: 0x2a8a7a, 0x5aa040: 0x5ad0b0, 0x3f7a2e: 0x2a7a6a }, gear: ['windSwirl'] },
      desc: 'Speeds up on every hit.',
    },
  },
  police: {
    enforcer: {
      name: 'Enforcer', from: null, level: 5,
      stats: { hp: 40 }, abilities: ['enforce'],
      look: { colors: { 0x1c2a50: 0x111111 }, gear: ['riotVisor'] },
      desc: 'Fear nearby enemies.',
    },
    hitman: {
      name: 'Hitman', from: 'enforcer', level: 15,
      stats: { hp: 40, damage: 5 }, removes: ['enforce'], abilities: ['execute'],
      look: { colors: { 0x22325c: 0x16161a, 0x1a2440: 0x16161a, 0x8fb8e8: 0xf0f0f0, 0x0f162b: 0xa01a1a, 0x4a6fb0: 0x16161a }, eyes: 0xff3b2f, gear: ['fedora'] },
      desc: 'Execute: finisher on a target.',
    },
    agent: {
      name: 'Agent', from: 'enforcer', level: 15,
      stats: { hp: 30, damage: 5 }, abilities: ['disrupt'],
      look: { colors: { 0x22325c: 0x1a1a1e, 0x1a2440: 0x1a1a1e, 0x8fb8e8: 0xf0f0f0, 0x0f162b: 0x111111, 0x4a6fb0: 0x1a1a1e }, gear: ['earpiece'] },
      desc: 'Keeps Enforce, every 3rd hit stuns.',
    },
    vanguard: {
      name: 'Vanguard', from: null, level: 5,
      stats: { hpRegen: 2 }, abilities: ['outnumbered'],
      look: { colors: { 0x4a6fb0: 0x2a2a2a }, gear: ['shoulderPlates'] },
      desc: 'Adapts to who has the numbers.',
    },
    peacekeeper: {
      name: 'Peacekeeper', from: 'vanguard', level: 15,
      stats: { hpRegen: 8, armor: 2 }, abilities: ['mediator'],
      look: { colors: { 0x1c2a50: 0x4a9ae8, 0x22325c: 0x2a3a5a }, gear: ['shoulderPlates', 'megaphone'] },
      desc: 'Mediator: enemies deal half damage.',
    },
  },
  // ---------- Tier 2 (v0.29) ----------
  dryad: {
    rabble: {
      name: 'Rabble Dryad', from: null, level: 5,
      stats: { hp: 20, ward: 2, moveSpeed: 0.4 }, abilities: ['silenceStrike'],
      look: { colors: { 0x7ac04a: 0x9a6ad8, 0x4a8a2a: 0x6a3aa8 }, eyes: 0xd8a8ff, gear: ['hushVeil'] },
      desc: 'Hits silence for 1s.',
    },
    silencer: {
      name: 'Silencer Dryad', from: 'rabble', level: 15,
      stats: { hp: 30, ward: 4, moveSpeed: 0.6 }, abilities: ['silenceStrike'],
      abilityMods: { silenceStrike: { silence: 2, spellCut: 0.3 }, arcaneCoating: { manaPerHit: 0 } },
      look: { colors: { 0x7ac04a: 0x3a2a5a, 0x4a8a2a: 0x22183a, 0xc8a070: 0x6a5a8a }, eyes: 0xff4ad8, gear: ['hushVeil', 'runeHalo'] },
      desc: '2s silence, -30% spell damage, free coating.',
    },
    relentless: {
      name: 'Relentless Dryad', from: null, level: 5,
      stats: { attackSpeed: 10 }, abilities: ['splitshot'],
      look: { colors: { 0x7ac04a: 0xd8902a, 0x4a8a2a: 0xa0601a }, eyes: 0xffe14a, gear: ['spearFan'] },
      desc: 'Spears split to 2 more targets.',
    },
    split: {
      name: 'Split Dryad', from: 'relentless', level: 15,
      stats: { attackSpeed: 25 }, abilities: ['splitshot'], abilityMods: { splitshot: { targets: 4 } },
      look: { colors: { 0x7ac04a: 0xc83a2a, 0x4a8a2a: 0x8a1a1a, 0xc8a070: 0xe8d0a0 }, eyes: 0xffffff, gear: ['spearFan', 'thornCrown'] },
      desc: 'Splits to 4 targets.',
    },
  },
  catapult: {
    advanced: {
      name: 'Advanced Catapult', from: null, level: 5,
      stats: { damage: 20, range: 1 }, abilityMods: { homingStone: { fire: { radius: 1.2, dps: 30, t: 5 } } },
      look: { colors: { 0x8a6a42: 0x5a4a3a }, gear: ['ironBands', 'fireBucket'] },
      desc: 'Boulders leave burning ground.',
    },
    heavy: {
      name: 'Heavy Catapult', from: 'advanced', level: 15,
      stats: { damage: 30, hp: 20, moveSpeed: -0.4, range: 1 }, abilityMods: { homingStone: { fire: { radius: 1.2, dps: 30, t: 5, buildings: true } } },
      look: { colors: { 0x8a6a42: 0x3a2e24, 0x6b4a2a: 0x2a221a }, gear: ['ironBands', 'fireBucket', 'heavyPlates'] },
      desc: 'Fire burns buildings and bases too.',
    },
  },
  batrider: {
    protector: {
      name: 'Protector Batrider', from: null, level: 5,
      stats: { armor: 5 }, abilities: ['protectorAura'],
      look: { colors: { 0x5a3a4a: 0x3a4a6a, 0x8a4a3a: 0x2f62b8 }, eyes: 0x9ad8ff, gear: ['batShield'] },
      desc: 'Aura: allies +3 armor, +3 ward.',
    },
    guardian: {
      name: 'Guardian Batrider', from: 'protector', level: 15,
      stats: { armor: 6 }, abilities: ['protectorAura'], abilityMods: { protectorAura: { name: 'Guardian Aura', enemyAura: { radius: 5, armor: 3, ward: 3 } } },
      look: { colors: { 0x5a3a4a: 0xc8b070, 0x8a4a3a: 0xf2c94c }, eyes: 0xffffff, gear: ['batShield', 'batHalo'] },
      desc: 'Aura also strips enemies (and buildings).',
    },
    ravaging: {
      name: 'Ravaging Batrider', from: null, level: 5,
      stats: { moveSpeed: 1, hp: 30 }, abilities: ['liberation'],
      look: { colors: { 0x5a3a4a: 0x6a1a1a, 0x8a4a3a: 0x3a0a0a }, eyes: 0xff3b2f, gear: ['batSpikes'] },
      desc: 'Pulses damage + knockback every 2s.',
    },
    draconic: {
      name: 'Draconic Batrider', from: 'ravaging', level: 15,
      stats: { moveSpeed: 2, hp: 50 }, abilities: ['liberation'], abilityMods: { liberation: { flat: 40, adPct: 0.5, damageType: 'true' } },
      look: { colors: { 0x5a3a4a: 0x2a5a2a, 0x8a4a3a: 0x1a3a1a, 0x3a2a30: 0x1a2a1a }, eyes: 0xffe14a, gear: ['batSpikes', 'dragonHorns', 'emberTrail'] },
      desc: 'Bigger pulse, true damage.',
    },
  },
  gunner: {
    machineGunner: {
      name: 'Machine Gunner', from: null, level: 5,
      stats: { attackSpeed: 20 }, abilityMods: { fervor: { pctPerStack: 0.1, maxStacks: 20 } },
      look: { colors: { 0x7fd4ff: 0xffb040 }, gear: ['lmg'] },
      desc: 'Fervor: % attack speed, 20 stacks.',
    },
    mercenary: {
      name: 'Mercenary', from: 'machineGunner', level: 15,
      stats: { attackSpeed: 100, missChance: 60, damage: -5 }, abilityMods: { fervor: { pctPerStack: 0.1, maxStacks: 0 } },
      look: { colors: { 0x7fd4ff: 0xff3b2f, 0x3b4652: 0x5a4a2a, 0x2b3540: 0x8a1a1a }, gear: ['lmg', 'bandolier'] },
      desc: 'Bullet hose: endless Fervor, poor aim.',
    },
    rambo: {
      name: 'Rambo', from: 'machineGunner', level: 15,
      stats: { attackSpeed: 20, range: 1 }, abilities: ['doubleTap'],
      look: { colors: { 0x7fd4ff: 0xff3b2f, 0x3b4652: 0x4a5a30 }, gear: ['lmg', 'headband', 'bandolier'] },
      desc: 'Double Tap every 6s.',
    },
    operator: {
      name: 'Operator', from: null, level: 5,
      stats: { damage: 5, armor: 2 }, abilities: ['boomstick'],
      look: { colors: { 0x7fd4ff: 0x5cff7a }, gear: ['shotgun'] },
      desc: 'Close shots hit harder.',
    },
    shotgunner: {
      name: 'Shotgunner', from: 'operator', level: 15,
      stats: { damage: 20, attackSpeed: -5, armor: 4, ward: 4 }, abilities: ['scattershot'],
      look: { colors: { 0x7fd4ff: 0x5cff7a, 0x3b4652: 0x3a3a2a, 0x1d2329: 0x2a2a20 }, gear: ['shotgun', 'heavyPlate'] },
      desc: 'Armored + Scattershot blast.',
    },
    rifleman: {
      name: 'Rifleman', from: null, level: 5,
      stats: { damage: 3 }, abilities: ['rapidFire'],
      look: { colors: { 0x7fd4ff: 0xf2c94c }, gear: ['longScope'] },
      desc: 'Rapid Fire bursts shred armor.',
    },
    advRifleman: {
      name: 'Advanced Rifleman', from: 'rifleman', level: 15,
      stats: { damage: 3 }, abilityMods: { rapidFire: { attacks: 10, bonusAS: 60, shred: 1.2 } },
      look: { colors: { 0x7fd4ff: 0xff3b2f, 0x3b4652: 0x3a4a3a, 0x4a5560: 0x4a5a3a }, gear: ['longScope', 'laser'] },
      desc: 'Longer, faster Rapid Fire.',
    },
    dualWielder: {
      name: 'Dual Wielder', from: null, level: 5,
      stats: { range: -1, attackSpeed: 20 }, abilities: ['flick'],
      look: { colors: { 0x7fd4ff: 0xd070ff }, gear: ['pistols'] },
      desc: 'Flick back when attacked.',
    },
    desperado: {
      name: 'Desperado', from: 'dualWielder', level: 15,
      stats: { range: -1, attackSpeed: 30 }, abilityMods: { flick: { onAttack: true } },
      look: { colors: { 0x7fd4ff: 0xd070ff, 0x3b4652: 0x8a5a2b }, gear: ['pistols', 'cowboyHat', 'poncho'] },
      desc: 'Flick when attacking too.',
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
  const path = formPath(unitId, formId), last = SKILL_TREES[unitId][formId];
  // stats + cost: the picked node's numbers only (totals vs the base troop, never stacked with the parent)
  for (const [k, v] of Object.entries(last.stats || {})) d[k] = Math.round(((d[k] || 0) + v) * 100) / 100;
  if (last.cost) d.cost += last.cost;
  for (const f of path) {
    const n = SKILL_TREES[unitId][f];
    for (const a of n.removes || []) d.abilities = d.abilities.filter((x) => x !== a);
    for (const a of n.abilities || []) if (!d.abilities.includes(a) && ABILITIES[a]) d.abilities.push(a);
    for (const [a, m] of Object.entries(n.abilityMods || {})) d.abilityMods[a] = { ...(d.abilityMods[a] || {}), ...m };
    d.name = n.name;
    if (n.look) d.look = n.look;
  }
  cache.set(key, d);
  return d;
}
