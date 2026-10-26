// BUILDING UPGRADE TREES — every deployable building upgrades on its own (select it → upgrade panel).
// Lv 1 = the UNITS entry. Lv 2 is linear, then the owner picks path 'a' or 'b' at Lv 3 and follows it to Lv 5.
// Each step: name, cost (gold), time (s of scaffolding; the building keeps firing at its old level meanwhile),
//   stats (absolute values that replace the base stat sheet: hp, damage, attackSpeed, range, armor...),
//   structure (fields that replace the base `structure` block: splash, minRange, fire, volley, stun, guided...),
//   desc (one line for the panel). The model comes from UNIT_BUILDERS[id](level, path).
// Later steps inherit everything set by earlier ones (Lv2 → A3 → A4 → A5).
import { UNITS } from './config.js';

export const BUILD_TREES = {
  cannon: {
    2: { name: 'Bronze Cannon', cost: 150, time: 4, stats: { hp: 750, damage: 55, armor: 5 },
      desc: 'Bronze barrel on an iron-banded carriage: +150 HP, +10 damage, +1 armor.' },
    a: {
      name: 'Heavy shot', desc: 'One big hit: more damage and splash, slower.',
      3: { name: 'Bombard', cost: 300, time: 6, stats: { hp: 850, damage: 85, attackSpeed: 12 }, structure: { splash: 3.2, knockback: 1.2 },
        desc: 'Huge stubby barrel: 85 damage, splash 3.2, fires every 5s.' },
      4: { name: 'Siege Mortar', cost: 500, time: 9, stats: { damage: 100, range: 20 }, structure: { minRange: 6, splash: 3.5, arc: 0.45, flight: 1.3, marker: true },
        desc: 'Lobs shells high over walls: range 20 (min 6), 100 damage, landing ring.' },
      5: { name: 'Great Bombard', cost: 900, time: 12, stats: { hp: 1100, damage: 150, attackSpeed: 10 }, structure: { splash: 4.2, stun: 1.2 },
        desc: 'Dragon-mouthed monster gun: 150 damage, splash 4.2, stuns 1.2s.' },
    },
    b: {
      name: 'Rapid fire', desc: 'More barrels, more shots: shreds groups up close.',
      3: { name: 'Twin Cannons', cost: 300, time: 6, stats: { hp: 800, damage: 50, attackSpeed: 28 },
        desc: 'Two barrels firing in turn: about twice the fire rate.' },
      4: { name: 'Grapeshot Battery', cost: 500, time: 9, stats: { damage: 24, attackSpeed: 26, range: 12 },
        structure: { fire: 'volley', volley: { count: 8, cone: 0.4 }, pellet: true, splash: 1.2, flight: 0.3, minRange: 2, knockback: 0 },
        desc: 'Flared barrels spray a cone of 8 iron balls (24 each), range 12.' },
      5: { name: 'Thunder Organ', cost: 900, time: 12, stats: { hp: 1000, damage: 28, attackSpeed: 30, range: 13 },
        structure: { volley: { count: 12, cone: 0.45 }, splash: 1.4, knockback: 0.5 },
        desc: 'Rack of five barrels: 12 balls (28 each) every 2s, with knockback.' },
    },
  },
  howitzer: {
    2: { name: 'Heavy Howitzer', cost: 180, time: 4, stats: { hp: 620, damage: 75, armor: 4 },
      desc: 'Longer barrel, armored shield: +120 HP, +15 damage, +1 armor.' },
    a: {
      name: 'Precision', desc: 'Longer reach, shells that can’t be dodged, then a railgun.',
      3: { name: 'Long Tom', cost: 360, time: 6, stats: { damage: 90, range: 28 }, desc: 'Very long barrel on a turntable: range 28, 90 damage.' },
      4: { name: 'Guided Shells', cost: 600, time: 9, stats: { damage: 100 }, structure: { guided: true },
        desc: 'Fire-control radar: shells steer onto the target (can’t be dodged).' },
      5: { name: 'Railgun', cost: 1080, time: 12, stats: { hp: 700, damage: 220, attackSpeed: 8, range: 30 },
        structure: { fire: 'line', lineWidth: 0.9, minRange: 3, groundOnly: false },
        desc: 'Magnetic rails: an instant slug pierces everything in a line (220, hits flying).' },
    },
    b: {
      name: 'Saturation', desc: 'Faster, then rockets, then fire on the ground.',
      3: { name: 'Autoloader', cost: 360, time: 6, stats: { damage: 65, attackSpeed: 18 }, desc: 'Ammo carousel: fires every 3.3s.' },
      4: { name: 'MLRS', cost: 600, time: 9, stats: { damage: 40, attackSpeed: 9 },
        structure: { fire: 'volley', volley: { count: 6, cone: 0.35 }, splash: 2, flight: 1.2, arc: 0.3, rocketKind: 'missile' },
        desc: 'Truck-bed rocket pods: 6 rockets (40 each, splash 2) every 6.7s.' },
      5: { name: 'Thermobaric', cost: 1080, time: 12, stats: { hp: 650, damage: 45, attackSpeed: 9 },
        structure: { volley: { count: 8, cone: 0.4 }, burn: { radius: 2, dps: 10, t: 4 } },
        desc: '8 thermobaric rockets: each leaves burning ground (10/s for 4s).' },
    },
  },
  archerTower: {
    2: { name: 'Stone Watchtower', cost: 120, time: 4, stats: { hp: 650, damage: 25, range: 16, armor: 4 },
      desc: 'Stone shaft and battlements: +150 HP, 25 damage, range 16, +1 armor.' },
    a: {
      name: 'Sharpshooter', desc: 'Heavy, piercing shots: tough targets and flyers.',
      3: { name: 'Longbow Tower', cost: 250, time: 6, stats: { damage: 38, attackSpeed: 45, range: 19 },
        desc: 'A taller tower and a longbow: 38 damage, range 19.' },
      4: { name: 'Ballista Tower', cost: 450, time: 9, stats: { damage: 36, attackSpeed: 30, range: 20 },
        structure: { fire: 'line', lineWidth: 0.25, bolt: true, turnRate: 4 },
        desc: 'A ballista: bolts pierce everything in a line (36 each), range 20.' },
      5: { name: 'Skypiercer', cost: 800, time: 12, stats: { hp: 900, damage: 80, attackSpeed: 26, range: 22 },
        structure: { pierceSlow: { pct: 50, t: 1.5 }, flyingBonus: 0.5 },
        desc: 'Giant iron ballista: 80 piercing, slows 50%, +50% vs flying.' },
    },
    b: {
      name: 'Volley', desc: 'More archers, more targets: shreds groups.',
      3: { name: 'Twin Archers', cost: 250, time: 6, stats: { damage: 22, attackSpeed: 70 }, structure: { multishot: 2 },
        desc: 'Two archers: every shot hits 2 targets.' },
      4: { name: 'Fire Archers', cost: 450, time: 9, stats: { damage: 20, attackSpeed: 70 }, structure: { multishot: 3, burnHit: { dps: 5, t: 3 } },
        desc: '3 targets per shot; hits burn 5/s for 3s (ignores armor).' },
      5: { name: 'Arrow Storm Spire', cost: 800, time: 12, stats: { hp: 850, damage: 22, attackSpeed: 75, range: 17 },
        structure: { rain: { every: 8, count: 14, radius: 3, damage: 22, splash: 1 } },
        desc: 'Four archers; every 8s 14 arrows rain on the target area.' },
    },
  },
  sniperTower: {
    2: { name: 'Reinforced Overwatch', cost: 140, time: 4, stats: { hp: 600, damage: 55, range: 19, armor: 4 },
      desc: 'Armored skirt, sandbags, a searchlight: +150 HP, 55 damage, range 19.' },
    a: {
      name: 'Marksman', desc: 'Heavier rifles: pierce lines, headshots, flyers.',
      3: { name: 'Marksman Post', cost: 280, time: 6, stats: { damage: 85, attackSpeed: 22, range: 22 },
        desc: 'Thermal scope and a ghillie net: 85 damage, range 22.' },
      4: { name: 'Anti-Materiel Nest', cost: 500, time: 9, stats: { damage: 55, range: 24 },
        structure: { fire: 'line', lineWidth: 0.25, beamColor: 0xfff0a0, turnRate: 3 },
        desc: 'A .50 cal on a mount: rounds pierce everything in a line (55 each), range 24.' },
      5: { name: 'Deadeye Sentinel', cost: 900, time: 12, stats: { hp: 800, damage: 95, range: 26 },
        structure: { critChance: 0.25, critMult: 2, flyingBonus: 0.5 },
        desc: 'Concrete sentinel: 95 piercing, 25% headshot (x2), +50% vs flying.' },
    },
    b: {
      name: 'Fire Team', desc: 'More shooters, more targets, wider true sight.',
      3: { name: 'Spotter Team', cost: 280, time: 6, stats: { damage: 42, attackSpeed: 30 }, structure: { multishot: 2, trueSight: 14 },
        desc: 'A spotter calls targets: 2 targets per shot, true sight 14.' },
      4: { name: 'Suppression Team', cost: 500, time: 9, stats: { damage: 34, attackSpeed: 36 }, structure: { multishot: 3, suppress: { pct: 25, t: 1.5 } },
        desc: '3 targets per shot; hits slow 25% for 1.5s.' },
      5: { name: 'Drone Command', cost: 900, time: 12, stats: { hp: 750, damage: 38, attackSpeed: 38, range: 19 },
        structure: { trueSight: 18, rain: { every: 8, count: 10, radius: 3, damage: 30, splash: 1.4, kind: 'missile' } },
        desc: 'A drone pad: every 8s a 10-missile strike on the target area; true sight 18.' },
    },
  },
  // Hwacha & Machine Gun Nest: paired trees. Path A = fewer, heavier hits that beat armor (fire / AP rounds),
  // path B = more shots that slow (it absorbs the old Rocket Rack / Belt Feed Barracks upgrades).
  hwacha: {
    2: { name: 'Iron-Banded Hwacha', cost: 160, time: 4, stats: { hp: 600, damage: 16, armor: 3 }, structure: { volley: { count: 12, cone: 0.5 } },
      desc: 'Iron-banded cart and wooden mantlets: +150 HP, 12 rockets (16 each), +1 armor.' },
    a: {
      name: 'Singijeon', desc: 'Fewer, heavier fire-arrows: big splash, burning ground, then a stun.',
      3: { name: 'Daesingijeon Rack', cost: 320, time: 6, stats: { damage: 40, range: 15 }, structure: { volley: { count: 6, cone: 0.35 }, splash: 2, flight: 0.9, minRange: 3 },
        desc: 'Six big rocket-arrows: 40 each, splash 2, range 15.' },
      4: { name: 'Fire Dragon Rack', cost: 520, time: 9, stats: { damage: 42 }, structure: { burn: { radius: 1.5, dps: 6, t: 3 } },
        desc: 'Incendiary warheads: 42 each, and every rocket leaves burning ground (6/s for 3s, magic).' },
      5: { name: 'Thunder Rocket Battery', cost: 940, time: 12, stats: { hp: 900, damage: 38, range: 16 }, structure: { volley: { count: 8, cone: 0.4 }, splash: 2.2, stun: 0.5 },
        desc: '8 thunder rockets: 38 each, splash 2.2, burning ground, stun 0.5s.' },
    },
    b: {
      name: 'Ripple Fire', desc: 'More rockets, faster, and they slow: blankets wide areas.',
      3: { name: 'Twin Hwacha', cost: 320, time: 6, stats: { damage: 15, attackSpeed: 15 }, structure: { volley: { count: 16, cone: 0.6 } },
        desc: 'Two carts side by side: 16 rockets (15 each) every 4s.' },
      4: { name: 'Munjong Hwacha', cost: 520, time: 9, stats: { damage: 14, range: 15 }, structure: { volley: { count: 24, cone: 0.75 }, suppress: { pct: 25, t: 1.5 } },
        desc: 'A hundred-arrow frame: 24 rockets in a wide fan, hits slow 25%, range 15.' },
      5: { name: 'Whirlwind Battery', cost: 940, time: 12, stats: { hp: 850, damage: 16, attackSpeed: 20, range: 16 },
        structure: { volley: { count: 16, cone: 0.6 }, volleyTargets: 2, splash: 1.8, suppress: { pct: 35, t: 2 } },
        desc: 'Two launchers on a turntable: every 3s, 16 rockets (16 each, splash 1.8) at <b>two</b> groups; hits slow 35%.' },
    },
  },
  mgNest: {
    2: { name: 'Fortified Pillbox', cost: 160, time: 4, stats: { hp: 750, damage: 6, armor: 5, range: 12 },
      desc: 'Thicker concrete, armored vision slits: +200 HP, 6 damage, +1 armor, range 12.' },
    a: {
      name: 'Heavy Caliber', desc: 'Bigger rounds: pierce armor, then explode and swat flyers.',
      3: { name: 'Heavy MG Post', cost: 320, time: 6, stats: { damage: 13, attackSpeed: 210, range: 13 },
        desc: 'A .50 cal on a pintle: 13 damage, range 13.' },
      4: { name: 'Twin .50 Bunker', cost: 520, time: 9, stats: { damage: 14, attackSpeed: 240 }, structure: { armorPierce: 4 },
        desc: 'Twin .50s with AP rounds: 14 damage, shots ignore 4 armor.' },
      5: { name: 'Autocannon Bunker', cost: 940, time: 12, stats: { hp: 1000, damage: 28, attackSpeed: 150, range: 14 },
        structure: { hitSplash: { radius: 1.4, pct: 0.5 }, flyingBonus: 0.5 },
        desc: 'A 20mm autocannon: 28 per shell, 50% splash around the target, +50% vs flying.' },
    },
    b: {
      name: 'Rotary', desc: 'Spinning barrels: more bullets, more targets, heavier slows.',
      3: { name: 'Gatling Nest', cost: 320, time: 6, stats: { attackSpeed: 510 }, structure: { suppress: { pct: 25, t: 1 } },
        desc: 'A crank Gatling: attack speed 510, hits slow 25%.' },
      4: { name: 'Minigun Nest', cost: 520, time: 9, stats: { damage: 5, attackSpeed: 480 }, structure: { multishot: 2, suppress: { pct: 30, t: 1.5 } },
        desc: 'Twin electric miniguns: 2 targets per shot, hits slow 30%.' },
      5: { name: 'Vulcan CIWS', cost: 940, time: 12, stats: { hp: 900, damage: 5, attackSpeed: 540, range: 13 },
        structure: { multishot: 3, suppress: { pct: 35, t: 1.5 }, flyingBonus: 0.5, trueSight: 10 },
        desc: 'Radar-guided rotary cannon: 3 targets, slow 35%, +50% vs flying, true sight 10.' },
    },
  },
};

/** The step a building would take next: { level, path, node } list (one entry, or two at the Lv 2 → 3 fork). */
export function nextSteps(id, level, path) {
  const T = BUILD_TREES[id]; if (!T) return [];
  if (level === 1) return T[2] ? [{ level: 2, path: null, node: T[2] }] : [];
  if (level === 2) return ['a', 'b'].filter((p) => T[p]?.[3]).map((p) => ({ level: 3, path: p, node: T[p][3] }));
  const n = T[path]?.[level + 1];
  return n ? [{ level: level + 1, path, node: n }] : [];
}

/** All steps from Lv 2 up to (level, path), in order. */
function stepsTo(id, level, path) {
  const T = BUILD_TREES[id], out = [];
  if (level >= 2 && T?.[2]) out.push(T[2]);
  for (let l = 3; l <= level; l++) if (T?.[path]?.[l]) out.push(T[path][l]);
  return out;
}

const cache = new Map();
/** Unit definition of building `id` at (level, path): the base sheet with every step's stats / structure applied. */
export function buildingDef(id, level = 1, path = null) {
  const base = UNITS[id];
  if (level <= 1 || !BUILD_TREES[id]) return base;
  const key = `${id}:${level}:${path}`;
  if (cache.has(key)) return cache.get(key);
  const d = { ...base, structure: { ...base.structure }, baseName: base.name, bLevel: level, bPath: path };
  for (const s of stepsTo(id, level, path)) {
    Object.assign(d, s.stats || {});
    Object.assign(d.structure, s.structure || {});
    d.name = s.name;
  }
  cache.set(key, d);
  return d;
}

/** Gold spent on upgrades to reach (level, path) — for refunds and the panel. */
export const upgradeSpent = (id, level, path) => stepsTo(id, level, path).reduce((a, s) => a + s.cost, 0);
