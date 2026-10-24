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
