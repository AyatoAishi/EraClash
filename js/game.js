// Match state: economy, training queues, AI, combat bookkeeping, particles, win/lose.
import * as THREE from 'three';
import { GAME, FACTIONS, UNITS, DIFFICULTY, AI_PERSONALITIES, defenseMult, baseLevelStats, BASE_LEVELS } from './config.js';
import { Unit } from './unit.js';
import { UPGRADES, STAT_BOOST, upgradePrice, upgradeTime, upgradesFor } from './upgrades.js';
import { ABILITIES, ITEMS } from './config.js';
import { NEUTRAL_TEAM, CAMP_RULES, CAMPS, CREEP_GROUPS, dropChanceForTier, creepTierOf } from './neutrals.js';
import { boxGeo, sharedMat, buildArrow, buildBullet, buildWisp, buildLoot, buildCastle, buildHQ, buildCannonball, buildShell, buildRocket, CASTLE_TIERS, HQ_TIERS } from './models.js';
import { sfx } from './audio.js';
import { SKILL_TREES, levelInfo, formDef } from './skilltree.js';
import { Vision } from './vision.js';
import { nextSteps } from './buildtree.js';

const FACTION_BY_TEAM = ['medieval', 'modern'];

export class Game {
  /**
   * @param {object} o
   * @param {THREE.Scene} o.scene
   * @param {number|null} o.playerTeam  0 / 1, or null for AI-vs-AI demo
   * @param {string} o.difficulty
   * @param {object} o.world
   * @param {function} o.getViewX  returns camera x (for audio culling)
   * @param {boolean} o.sandbox  Dev Lab arena: no AI, no neutral camps (js/dev/devlab.js drives it)
   */
  constructor({ scene, playerTeam, difficulty = 'normal', world, getViewX = () => 0, sandbox = false }) {
    this.scene = scene;
    this.sandbox = sandbox;
    this.world = world;
    this.playerTeam = playerTeam;
    this.diff = DIFFICULTY[difficulty] || DIFFICULTY[2];
    this.diffId = DIFFICULTY[difficulty] ? difficulty : 2;
    this.getViewX = getViewX;
    this.time = 0;
    this.over = false;
    this.winner = null;
    this.overT = 0;
    this.units = [];
    this.particles = [];
    this.projectiles = [];
    this.markers = [];
    this.decals = [];
    this.loot = [];
    this.nextCampSpawn = CAMP_RULES.firstSpawn;
    this.listeners = {};
    this.cheat = {};   // admin/test commands from the chat (js/chat.js), this match only
    this.teams = [0, 1].map((t) => ({
      team: t,
      faction: FACTION_BY_TEAM[t],
      gold: GAME.startGold,
      income: GAME.incomePerSec * (this.isAI(t) ? this.diff.goldMult : 1),
      queue: [],
      queuePaid: [],
      // Barracks (per match)
      upLevels: {},      // upgradeId -> level
      structMods: {},    // buildingId -> { minRange, splash } from `structureMods` upgrade effects
      unitMods: {},      // unitId -> flat stat bonuses from stat upgrades
      costAdd: {},       // unitId -> extra hiring cost
      grants: {},        // unitId -> [abilityId] added by upgrades
      troopKills: {},    // unitId -> kills by that troop type this match (skill tree level, js/skilltree.js)
      forms: {},         // unitId -> picked skill-tree form (new hires come out as it)
      research: null,    // { id, t, total, price, level } — the one running now
      rqueue: [],        // queued research: [{ id, price, level }] (paid up front, like training)
      towers: 0,
      trainT: 0,
      isAI: this.isAI(t),
      aiT: 0,
      stats: { trained: 0, kills: 0, lost: 0, baseDamage: 0, goldSpent: 0 },
      upgrades: {},   // familyId -> { damage, armor, ward, hp, hpRegen, attackSpeed, moveSpeed, range } (flat, stacked)
    }));
    this.bases = [0, 1].map((t) => ({
      isBase: true, team: t,
      level: GAME.baseLevel, bonusHp: 0,   // bonusHp = Reinforce; the rest comes from the level (setBaseLevel)
      x: t === 0 ? -GAME.baseX : GAME.baseX,
      pos: new THREE.Vector3(t === 0 ? -GAME.baseX : GAME.baseX, 0, 0),
      shake: 0,
      obj: t === 0 ? world.castle : world.hq,
      dead: false,
    }));
    this.baseOrig = this.bases.map((b) => b.obj);   // the world's own models: put back on dispose()
    this.bases.forEach((b) => {
      b.obj.position.set(b.x, 0, 0); b.obj.rotation.set(0, 0, 0);
      const S = baseLevelStats(b.level);
      b.maxHp = b.hp = S.hp; b.armor = S.armor; b.vision = S.vision;
      if (b.obj.userData.level !== undefined && b.obj.userData.level !== b.level) this.swapBaseModel(b.team, b.level);
    });
    // map / systems (modular): terrain = obstacles + nav + height, structures = future buildables, vision = fog of war
    this.terrain = world?.terrain || null;
    this.structures = [];
    this.detectors = [];   // true-sight sources (future Sentry Wards): { team, pos, radius, dead }
    this.trails = [];      // Barding Rally: { team, x, z, t, bonus, mesh }
    this.shells = [];      // artillery shells in flight (Cannon / Howitzer): Game.fireShell / updateShells
    this.fires = [];       // burning ground (Thermobaric): Game.addFire / updateFires
    this.beams = [];       // railgun trails: Game.fireLine / updateBeams
    this.skillshots = [];  // line projectiles (Arrow Piercer)
    this.teams.forEach((T) => (T.autoLoot = false));
    // AI teams: difficulty head start + a personality for this match
    this.teams.forEach((T) => {
      if (!T.isAI || sandbox) return;
      T.gold += this.diff.startGold || 0;
      T.persona = this.rollPersona();
      if (this.diff.baseLevel > 1) { this.setBaseLevel(T.team, this.diff.baseLevel); if (world?.castle) this.swapBaseModel(T.team, this.diff.baseLevel); }
    });
    this.vision = this.terrain ? new Vision(this) : null;
  }
  /** Can the local viewer see world point p? (spectator sees everything) */
  seenByViewer(p) { return !this.vision || this.vision.seen(this.playerTeam, p); }
  canSee(team, u) { return !this.vision || this.vision.canSee(team, u); }
  /** Hide whatever the viewer can't see (enemy troops, creeps, projectiles, loot). */
  applyFog() {
    const v = this.playerTeam;
    for (const u of this.units) {
      if (u.hideModel) { u.obj.visible = false; continue; }
      u.obj.visible = u.team === v || this.canSee(v, u);
    }
    for (const p of this.projectiles) p.mesh.visible = p.team === v || this.seenByViewer(p.mesh.position);
    for (const L of this.loot) L.mesh.visible = this.seenByViewer(L) && !L.blinkOff;
  }

  /** Day/night: 5 min day then 5 min night, alternating, with a short fade. */
  get dayNight() {
    const { half, fade } = GAME.dayNight;
    const t = this.time % (half * 2);
    const night = t >= half;
    const into = night ? t - half : t;            // seconds into the current phase
    const ramp = Math.min(1, into / fade);
    const f = night ? ramp : 1 - ramp;            // fades over the first `fade` seconds of each phase
    return { night, f: this.time < fade && !night ? 0 : f, left: half - into, cycle: Math.floor(this.time / (half * 2)) + 1 };
  }
  isAI(t) { return !this.sandbox && (this.playerTeam === null || t !== this.playerTeam); }
  on(evt, fn) { (this.listeners[evt] ||= []).push(fn); }
  emit(evt, ...a) { (this.listeners[evt] || []).forEach((fn) => fn(...a)); }

  pop(team) { return this.units.filter((u) => u.team === team && !u.dead && !u.tower && !u.raised && !u.structure).length + this.teams[team].queue.length; }
  unitCost(team, unitId) { return Math.round((formDef(unitId, this.teams[team]?.forms[unitId]).cost * this.statMult(team, unitId) + (this.teams[team]?.costAdd[unitId] || 0)) * 100) / 100; }
  /** Stat boost multiplier for a troop type: 1 + 10% per level of every statBoost upgrade that targets it. */
  statMult(team, unitId) {
    const T = this.teams[team]; if (!T) return 1;
    let m = 1;
    for (const [id, L] of Object.entries(T.upLevels)) {
      for (const e of UPGRADES[id]?.effects || []) if (e.type === 'statBoost' && e.unit === unitId) m += e.pct * L;
    }
    return m;
  }
  /** Level an upgrade will have once everything already running/queued finishes. */
  pendingLevel(team, id) {
    const T = this.teams[team];
    return this.upLevel(team, id) + (T.research?.id === id ? 1 : 0) + T.rqueue.filter((q) => q.id === id).length;
  }
  researchCount(team) { const T = this.teams[team]; return (T.research ? 1 : 0) + T.rqueue.length; }
  upLevel(team, id) { return this.teams[team]?.upLevels[id] || 0; }
  /** Wall troop spots on a base = cap for tower upgrades (Battlement / Overwatch). */
  baseSlots(team) { return baseLevelStats(this.bases[team].level).slots; }
  /** Effective max level: tower upgrades are capped by the base's spots, everything else by U.max. */
  upgradeMax(team, U) {
    if (U.effects?.some((e) => e.type === 'towers')) return Math.min(U.max, this.baseSlots(team));
    if (U.effects?.some((e) => e.type === 'baseLevel')) return Math.min(U.max, this.upLevel(team, U.id) + BASE_LEVELS.length - this.bases[team].level);
    return U.max;
  }
  /**
   * Change a base's level: new HP / armor / vision (HP keeps its %), and wall troops beyond the new
   * spot count are removed (their upgrade level drops with them). The model swap is the caller's job.
   */
  setBaseLevel(team, L) {
    const b = this.bases[team], T = this.teams[team], S = baseLevelStats(L);
    const frac = b.hp / b.maxHp;
    b.level = S.level; b.maxHp = S.hp + b.bonusHp; b.hp = Math.max(1, frac * b.maxHp); b.armor = S.armor; b.vision = S.vision;
    const towers = this.units.filter((u) => u.tower && u.team === team);
    if (towers.length > S.slots) {
      for (const u of towers.slice(S.slots)) { u.dispose(); this.units.splice(this.units.indexOf(u), 1); }
      T.towers = S.slots;
      for (const U of Object.values(UPGRADES)) if (T.upLevels[U.id] > S.slots && U.effects?.some((e) => e.type === 'towers')) T.upLevels[U.id] = S.slots;
    }
    this.emit('baseLevel', team, S.level);
  }
  /** Rebuild a base's model at level L (castle / HQ), in place; wall troops move to the new level's spots. */
  swapBaseModel(team, L) {
    const b = this.bases[team], old = b.obj;
    const nw = (team === 0 ? buildCastle : buildHQ)(L);
    nw.position.copy(old.position); nw.rotation.copy(old.rotation);
    (old.parent || this.scene).add(nw); old.parent?.remove(old);
    b.obj = nw;
    if (this.world?.castle === old || this.world?.hq === old) this.world.setBaseModel?.(team, nw);
    this.units.filter((u) => u.tower && u.team === team).forEach((u, i) => {
      const s = nw.userData.slots?.[i]; if (!s) return;
      u.pos.set(b.x + s.x, 0, s.z); u.yOff = s.y; u.obj.position.set(u.pos.x, s.y, s.z);
    });
    return nw;
  }
  /** Fortify / Expand HQ finished: one level up, new model, a puff of dust. */
  raiseBase(team) {
    const b = this.bases[team], L = b.level + 1;
    if (L > BASE_LEVELS.length) return;
    this.setBaseLevel(team, L);
    this.swapBaseModel(team, L);
    const cols = team === 0 ? [0x8d8f93, 0xe0b040, 0xffffff] : [0xb8bcc2, 0x4fa8e0, 0xffffff];
    for (let k = 0; k < 4; k++) this.burst({ x: b.x + (Math.random() - 0.5) * 8, z: (Math.random() - 0.5) * 10 }, 14, cols, 5, 1.4, 3);
    if (this.audible(b.x)) sfx('train');
  }
  /** Logistics: multiplier on research & training durations (kind 'train' | 'research': high AI difficulties are faster). */
  speedMult(team, kind = 'train') {
    if (!this.teams[team]) return 1; const L = this.upLevel(team, 'logistics');
    const cheat = team === this.playerTeam && this.cheat?.hireSpeed ? 1 / this.cheat.hireSpeed : 1;
    const ai = this.teams[team].isAI && !this.sandbox ? (kind === 'research' ? this.diff.researchMult : this.diff.trainMult) || 1 : 1;
    return (L ? 1 - UPGRADES.logistics.values.speed[L - 1] : 1) * cheat * ai; }
  /** Difficulty 4+: AI troops/base take less damage and deal more (only vs a different team). */
  dmgMult(srcTeam, victimTeam) {
    if (this.sandbox || srcTeam === victimTeam) return 1;
    let m = 1;
    if (this.teams[victimTeam]?.isAI) m *= this.diff.dmgTaken || 1;
    if (this.teams[srcTeam]?.isAI) m *= this.diff.dmgDealt || 1;
    return m;
  }
  repairRates(team) { const L = this.upLevel(team, 'repairCrews'), R = GAME.repair; return { heal: R.heal + R.healPerLevel * L, drain: R.drain + R.drainPerLevel * L }; }
  setAutoLoot(team, on) { const T = this.teams[team]; if (T) { T.autoLoot = !!on; this.emit('autoLoot', team, T.autoLoot); } }
  setRepair(team, on) {
    const T = this.teams[team];
    if (on && T.gold < 1) return 'Not enough gold';
    T.repairOn = !!on;
    this.emit('repair', team, T.repairOn);
    return null;
  }

  // ---------------- Barracks research ----------------
  /** Start researching the next level of an upgrade. Returns error string or null. */
  research(team, id) {
    const T = this.teams[team], U = UPGRADES[id];
    if (!U || !upgradesFor(T.faction).includes(U)) return 'Not available';
    if (this.over) return 'Match is over';
    const lvl = this.pendingLevel(team, id);            // queued levels count: you can stack the same upgrade
    if (lvl >= this.upgradeMax(team, U)) return lvl < U.max ? 'Needs a higher base level' : T.research || T.rqueue.length ? 'Max level already queued' : 'Already maxed';
    if (this.researchCount(team) >= GAME.researchQueueMax) return 'Research queue full';
    const price = upgradePrice(U, lvl);
    if (T.gold < price) return 'Not enough gold';
    T.gold -= price; T.stats.goldSpent += price;
    const entry = { id, price, level: lvl + 1 };
    if (T.research) T.rqueue.push(entry); else this.startResearch(team, entry);
    this.emit('researchStart', team, id);
    return null;
  }
  startResearch(team, e) {
    const T = this.teams[team], U = UPGRADES[e.id];
    T.research = { ...e, t: 0, total: upgradeTime(U, e.level - 1) * this.speedMult(team, 'research') };
  }
  /**
   * Cancel research: slot -1 = the running one, 0.. = queued entry. Refunds it and any later
   * levels of the same upgrade (they depend on it). The next queued research starts.
   */
  cancelResearch(team, slot = -1) {
    const T = this.teams[team];
    const target = slot < 0 ? T.research : T.rqueue[slot];
    if (!target) return false;
    const drop = (e) => e === target || (e.id === target.id && e.level > target.level);
    const refund = (e) => { T.gold += e.price; T.stats.goldSpent -= e.price; };
    if (T.research && drop(T.research)) { refund(T.research); T.research = null; }
    T.rqueue = T.rqueue.filter((e) => { if (drop(e)) { refund(e); return false; } return true; });
    if (!T.research && T.rqueue.length) this.startResearch(team, T.rqueue.shift());
    return true;
  }
  /** Apply one level of an upgrade (called when research finishes). */
  applyUpgrade(team, id) {
    const T = this.teams[team], U = UPGRADES[id];
    const lvl = (T.upLevels[id] = (T.upLevels[id] || 0) + 1);
    for (const e of U.effects || []) {
      if (e.type === 'statBoost') {
        // nothing stored: Unit.recalcStats / Game.unitCost read the level through statMult()
      } else if (e.type === 'unitStats') {
        const m = (T.unitMods[e.unit] ||= {});
        for (const [k, v] of Object.entries(e.perLevel)) m[k] = (m[k] || 0) + v;
        T.costAdd[e.unit] = (T.costAdd[e.unit] || 0) + (e.costPerLevel || 0);
      } else if (e.type === 'grantAbility' || (e.type === 'grantAtMax' && lvl === U.max)) {
        const list = (T.grants[e.unit] ||= []);
        if (!list.includes(e.ability)) list.push(e.ability);
      } else if (e.type === 'towers') {
        this.spawnTower(team, e.unit, T.towers++, e.rangeBonus);
      } else if (e.type === 'baseHP') {
        const b = this.bases[team]; b.bonusHp += e.perLevel; b.maxHp += e.perLevel; b.hp += e.perLevel;
      } else if (e.type === 'income') {
        T.income += e.perLevel;
      } else if (e.type === 'baseLevel') {
        this.raiseBase(team);
      } else if (e.type === 'structureMods') {
        const m = (T.structMods[e.unit] ||= {});
        for (const [k, v] of Object.entries(e.perLevel)) m[k] = (m[k] || 0) + v;
      }
    }
    for (const u of this.units) if (!u.dead && u.team === team) { u.syncAbilities(); u.recalcStats(); }
    this.emit('upgrade', team, id, lvl);
  }

  /** Invulnerable, unselectable archer/gunner standing on the base. */
  spawnTower(team, unitId, idx, rangeBonus) {
    const u = new Unit(this, unitId, team);
    u.tower = true;
    u.towerRange = rangeBonus;
    u.invulnT = 0; u.shield.visible = false; u.bar.visible = false;
    const b = this.bases[team];
    const zs = [0, -3.2, 3.2, -1.6, 1.6, -4.6, 4.6];
    const slot = b.obj.userData.slots?.[idx];   // castle levels define their own wall spots (models.js castleSlots)
    const front = slot ? b.x + slot.x : team === 0 ? b.x + 4.2 : b.x - 4.4;
    const y = slot ? slot.y : team === 0 ? 9.9 : 10.5;
    u.spawnAt(front, slot ? slot.z : zs[idx % zs.length]);
    u.yOff = y;
    u.obj.position.y = y;
    u.order = { type: 'idle' };
    u.recalcStats();
    this.units.push(u);
    this.scene.add(u.obj);
    this.burst({ x: front, z: u.pos.z }, 10, [0xffffff, 0xf7c948], 2, 0.6);
    return u;
  }

  // ---------------- economy / training ----------------
  train(team, unitId) {
    const T = this.teams[team], def = UNITS[unitId];
    if (this.over) return 'Match is over';
    if (FACTIONS[T.faction].units.indexOf(unitId) < 0) return 'Wrong faction';
    if (T.queue.length >= GAME.queueMax) return 'Training queue full';
    if (this.pop(team) >= GAME.popCap) return `Army limit reached (${GAME.popCap})`;
    const cost = this.unitCost(team, unitId);
    if (T.gold < cost) return 'Not enough gold';
    T.gold -= cost;
    T.stats.goldSpent += cost;
    T.queue.push(unitId);
    T.queuePaid.push(cost);
    return null;
  }

  /** Cancel a queued troop and refund it in full. */
  cancelQueue(team, index) {
    const T = this.teams[team];
    const id = T.queue[index];
    if (!id) return false;
    T.queue.splice(index, 1);
    const paid = T.queuePaid.splice(index, 1)[0] ?? UNITS[id].cost;
    T.gold += paid;
    T.stats.goldSpent -= paid;
    if (index === 0) T.trainT = 0;
    return true;
  }

  spawn(team, unitId) {
    const u = new Unit(this, unitId, team);
    const sx = team === 0 ? -GAME.baseX + GAME.baseHalfX + 1.2 : GAME.baseX - GAME.baseHalfX - 1.2;
    u.spawnAt(sx, (Math.random() - 0.5) * 6);
    this.units.push(u);
    this.scene.add(u.obj);
    this.teams[team].stats.trained++;
    if (team === this.playerTeam) sfx('train');
    this.emit('spawn', u);
    return u;
  }

  // ---------------- family upgrades (Barracks hook) ----------------
  /** Add flat stats to a whole family on one team. Applies to living troops now and all future spawns. */
  addFamilyUpgrade(team, familyId, stats) {
    const ups = this.teams[team].upgrades;
    const cur = (ups[familyId] ||= {});
    for (const [k, v] of Object.entries(stats)) {
      cur[k] = (cur[k] || 0) + v;
    }
    for (const u of this.units) if (!u.dead && u.team === team && u.family === familyId) u.recalcStats();
    this.emit('upgrade', team, familyId, cur);
  }

  // ---------------- skill trees (js/skilltree.js) ----------------
  troopLevel(team, unitId) { return levelInfo(this.teams[team]?.troopKills[unitId] || 0); }
  addTroopKill(team, unitId) {
    const T = this.teams[team]; if (!T) return;
    const before = this.troopLevel(team, unitId).level;
    T.troopKills[unitId] = (T.troopKills[unitId] || 0) + (T.isAI && !this.sandbox ? this.diff.xpMult || 1 : 1);
    const now = this.troopLevel(team, unitId).level;
    if (now > before) this.emit('troopLevel', team, unitId, now);
  }
  /** Why `formId` can't be picked right now (null = it can). */
  formBlock(team, unitId, formId) {
    const n = SKILL_TREES[unitId]?.[formId], T = this.teams[team];
    if (!n || !T) return 'Unknown evolution';
    if ((n.from ?? null) !== (T.forms[unitId] ?? null)) return T.forms[unitId] === formId ? 'Already picked' : 'Not on your path';
    if (this.troopLevel(team, unitId).level < n.level) return `Needs ${UNITS[unitId].name} level ${n.level}`;
    return null;
  }
  /** Free and instant: troops hired from now on come out in this form. Troops on the field keep theirs. */
  pickForm(team, unitId, formId) {
    const err = this.formBlock(team, unitId, formId);
    if (err) return err;
    this.teams[team].forms[unitId] = formId;
    this.emit('form', team, unitId, formId);
    return null;
  }

  // ---------------- neutral camps ----------------
  campBoxEmpty(c) {
    return !this.units.some((u) => !u.dead && !u.tower && Math.hypot(u.pos.x - c.x, u.pos.z - c.z) < CAMP_RULES.boxRadius);
  }
  spawnCamp(c) {
    const groups = CREEP_GROUPS[c.tier || 1] || CREEP_GROUPS[1];
    const group = groups[Math.floor(Math.random() * groups.length)];   // a fresh random group of the camp's tier every spawn
    group.units.forEach((id, k) => {
      const u = new Unit(this, id, NEUTRAL_TEAM);
      const a = (k / group.units.length) * Math.PI * 2;
      const hx = c.x + Math.cos(a) * 1.4, hz = c.z + Math.sin(a) * 1.4;
      u.spawnAt(hx, hz);
      u.home = { x: hx, z: hz };
      u.camp = c; u.creepTier = c.tier || 1; u.group = group.id;
      u.invulnT = 0; u.shield.visible = false;
      u.nState = 'home';
      u.facing = Math.atan2(-Math.cos(a), -Math.sin(a));
      this.units.push(u);
      this.scene.add(u.obj);
    });
    this.burst({ x: c.x, z: c.z }, 10, c.side === 'medieval' ? [0x7fbf3a, 0xffffff] : [0xf2c94c, 0x9aa3ab], 2.5, 0.6);
    this.emit('campSpawn', c);
  }
  updateCamps() {
    if (this.time < this.nextCampSpawn) return;
    this.nextCampSpawn += CAMP_RULES.interval;
    for (const c of CAMPS) if (this.campBoxEmpty(c)) this.spawnCamp(c);
  }
  /** A neutral got hit: its whole camp group joins the fight against the attacker's team. */
  neutralAggro(n, src) {
    if (!src || src.team === undefined || src.team === NEUTRAL_TEAM) return;
    for (const c of this.units) {
      if (c.dead || c.team !== NEUTRAL_TEAM || c.camp !== n.camp) continue;
      if (Math.hypot(c.pos.x - n.pos.x, c.pos.z - n.pos.z) > 9 && c !== n) continue;
      if (c.nState === 'return' && !c.inBox) continue;   // anti-cheese: a creep walking home only re-aggros once back inside its box
      if (c.nState !== 'chase' || !c.nTarget || c.nTarget.dead) c.nTarget = src;
      c.nState = 'chase';
      c.aggroTeam = src.team;
      c.lastHitT = this.time;
    }
  }
  spawnLoot(itemId, p) {
    const it = ITEMS[itemId]; if (!it) return;
    const mesh = buildLoot(it.icon);
    const y0 = this.terrain?.heightAt(p.x, p.z) || 0;
    mesh.position.set(p.x, 0.5 + y0, p.z);
    this.scene.add(mesh);
    this.loot.push({ id: itemId, x: p.x, z: p.z, y0, mesh, t: 0 });
    this.emit('lootDrop', itemId, p);
  }
  updateLoot(dt) {
    for (let i = this.loot.length - 1; i >= 0; i--) {
      const L = this.loot[i];
      L.t += dt;
      // unclaimed drops vanish after GAME.lootLife seconds (blinking for the last 5)
      const left = GAME.lootLife - L.t;
      if (left <= 0) { this.scene.remove(L.mesh); this.loot.splice(i, 1); continue; }
      L.blinkOff = left < 5 && Math.floor(L.t * (left < 2 ? 8 : 4)) % 2 === 1;
      if (L.blinkOff) L.mesh.visible = false;
      L.mesh.position.y = 0.55 + (L.y0 || 0) + Math.sin(L.t * 3) * 0.12;
      L.mesh.userData.spin.forEach((m) => (m.rotation.y += dt * 1.6));
      // AI troops grab loot they walk over; the player picks up with right-click (pickup order)
      const taker = this.units.find((u) => !u.dead && !u.tower && !u.brainwashed && this.teams[u.team]?.isAI && u.items.includes(null) && Math.hypot(u.pos.x - L.x, u.pos.z - L.z) < 1.2);
      if (taker) this.pickupLoot(taker, L);
    }
  }
  /** `u` takes loot `L`. Returns false if its inventory is full. */
  pickupLoot(u, L) {
    if (L.taken || u.dead) return false;
    if (u.addItem(L.id) < 0) { if (u.team === this.playerTeam) this.emit('invFull', u); return false; }
    L.taken = true;
    this.scene.remove(L.mesh);
    this.loot.splice(this.loot.indexOf(L), 1);
    this.burst({ x: L.x, z: L.z }, 8, [0xffffff, 0xfff3b0], 2, 0.5);
    this.emit('pickup', u, L.id);
    return true;
  }
  /** Throw away the item in `slot`: it drops at the troop's feet (anyone can pick it up; it vanishes after GAME.lootLife). */
  discardItem(u, slot) {
    const id = u.items[slot]; if (!id) return false;
    u.removeItem(slot);
    const a = Math.random() * Math.PI * 2;
    this.spawnLoot(id, { x: u.pos.x + Math.cos(a) * 0.9, z: u.pos.z + Math.sin(a) * 0.9 });
    return true;
  }
  lootNear(p, r = 1.3) {
    let best = null, bd = r;
    for (const L of this.loot) { const d = Math.hypot(L.x - p.x, L.z - p.z); if (d < bd) { bd = d; best = L; } }
    return best;
  }
  /** Banshee's Brainwash: the troop switches sides for a while, attacks its former allies, then despawns. */
  brainwash(caster, t, A) {
    const orig = t.team;
    t.brainwashed = { t: A.duration, orig };
    t.team = 1 - orig;
    t._waiting = false; t._jungle = null; t._homing = false;
    t.pendingHit = null; t.target = null; t.selected = false;
    t.interrupt?.();
    t.command({ type: 'charge' });
    const purple = 0xb070ff;
    t.ring.material = new THREE.MeshBasicMaterial({ color: purple, transparent: true, opacity: 0.9, depthWrite: false });
    t.fill.material = new THREE.MeshBasicMaterial({ color: purple, depthWrite: false, depthTest: false });
    t.ring.visible = false;
    this.burst(t.pos, 16, [0x9a6ad8, 0xd8c8ff, 0x5a3aa0], 3, 0.8);
    if (this.audible(t.pos.x)) sfx('whiff', 40);
    this.emit('brainwash', t, orig);
  }
  /** Raise a dead unit as an ally of `curse.team` for curse.def.raiseTime seconds (full HP, no items, keeps original upgrades). */
  raiseUnit(dead, curse) {
    const team = curse.team, A = curse.def;
    const r = new Unit(this, dead.def.id, team);
    r.raised = { t: A.raiseTime, orig: dead.statTeam };
    r.recalcStats(); r.hp = r.maxHp;
    r.invulnT = 0; r.shield.visible = false;
    r.spawnAt(dead.pos.x, dead.pos.z);
    r.facing = dead.facing;
    for (const m of r.rig.matList) { m.transparent = true; m.opacity = 0.7; m.color.lerp(new THREE.Color(0xb070ff), 0.35); }
    r.ring.material = new THREE.MeshBasicMaterial({ color: 0xb070ff, transparent: true, opacity: 0.9, depthWrite: false });
    r.fill.material = new THREE.MeshBasicMaterial({ color: 0xb070ff, depthWrite: false, depthTest: false });
    if (team === NEUTRAL_TEAM) {
      // joins the Banshee's camp: same leash/home/sleep rules, already fighting whoever the camp is fighting
      const src = curse.src;
      r.camp = src?.camp || null;
      r.home = src?.home ? { x: src.home.x + (Math.random() - 0.5) * 2, z: src.home.z + (Math.random() - 0.5) * 2 } : { x: dead.pos.x, z: dead.pos.z };
      r.nState = src?.nState === 'chase' ? 'chase' : 'home';
      r.aggroTeam = src?.aggroTeam ?? dead.team; r.lastHitT = this.time; r.nTarget = null;
    } else {
      r.command({ type: 'charge' });
      if (!r.zzz) { /* team units: normal brain */ }
    }
    this.units.push(r);
    this.scene.add(r.obj);
    this.burst(dead.pos, 14, [0xb070ff, 0xd8c8ff, 0x3a2a5a], 3, 0.9);
    if (this.audible(dead.pos.x)) sfx('whiff', 50);
    this.emit('raise', r, dead);
    return r;
  }
  despawnBrainwashed(u) {
    u.hp = 0;
    u.die(null);
    u.obj.visible = false; u.hideModel = true; u.deathT = 2.6;
  }

  // ---------------- queries ----------------
  findNearestEnemy(u, range) {
    let best = null, bd = range * range;
    for (const o of this.units) {
      if (o.dead || o.team === u.team || o.tower) continue;
      if (o.team === NEUTRAL_TEAM && o.aggroTeam !== u.team) continue;   // leave peaceful camps alone
      if (u.team <= 1 && !this.canSee(u.team, o)) continue;              // fog of war: can't target what you can't see
      if (o.flying && !u.ranged) continue;                                // melee can't hit flying units
      const dx = o.pos.x - u.pos.x, dz = o.pos.z - u.pos.z;
      const d2 = dx * dx + dz * dz;
      if (d2 < bd) { bd = d2; best = o; }
    }
    return best;
  }
  baseTarget(team) { return this.bases[team]; }
  baseClosestPoint(u, team) {
    const b = this.bases[team];
    return {
      x: Math.max(b.x - GAME.baseHalfX, Math.min(b.x + GAME.baseHalfX, u.pos.x)),
      z: Math.max(-GAME.baseHalfZ, Math.min(GAME.baseHalfZ, u.pos.z)),
    };
  }
  distToBase(u, team) {
    const p = this.baseClosestPoint(u, team);
    return Math.hypot(p.x - u.pos.x, p.z - u.pos.z) - u.radius;
  }
  baseApproachPoint(u, team) {
    const b = this.bases[team];
    const faceX = team === 0 ? b.x + GAME.baseHalfX : b.x - GAME.baseHalfX;
    return { x: faceX + (team === 0 ? 0.6 : -0.6), z: Math.max(-GAME.baseHalfZ + 0.8, Math.min(GAME.baseHalfZ - 0.8, u.pos.z * 0.98)) };
  }

  audible(x) { return Math.abs(x - this.getViewX()) < 34; }

  // ---------------- deployable buildings (Build menu) ----------------
  /** Living buildings of a team (built or under construction). */
  buildingsOf(team) { return this.units.filter((u) => u.structure && !u.dead && u.team === team); }
  /** Towers allowed right now (GAME.build.towersByLevel by base level) and how many stand. */
  towerCap(team) { return GAME.build.towersByLevel[this.bases[team].level - 1] ?? 0; }
  towerCount(team) { return this.buildingsOf(team).filter((u) => u.structure.tower).length; }
  /** Why `team` can't add another `id` (limit reached), or null. Towers: shared cap by base level; artillery: per type. */
  buildLimit(team, id) {
    const def = UNITS[id];
    if (def.structure.tower) {
      const cap = this.towerCap(team);
      if (this.towerCount(team) < cap) return null;
      const next = GAME.build.towersByLevel.findIndex((n) => n > cap) + 1;
      if (!next) return `Tower limit reached (${cap})`;
      const tiers = team === 0 ? CASTLE_TIERS : HQ_TIERS;
      return `Tower limit ${cap}: raise your ${team === 0 ? 'castle' : 'HQ'} to Lv ${next} (${tiers[next - 1].name})`;
    }
    return this.buildingsOf(team).filter((u) => u.def.id === id).length >= GAME.build.maxPerSide ? `Max ${GAME.build.maxPerSide} ${def.name}s` : null;
  }
  /**
   * Can `team` put building `id` at (x, z)? Returns an error message, or null when the spot is fine.
   * Rules (GAME.build): your own side of the river, on normal ground, within maxDist of your base front,
   * clear of trees/props/buildings (footprint + clearance), and not inside the base.
   */
  canPlace(team, id, x, z) {
    const def = UNITS[id], S = def?.structure, B = GAME.build, b = this.bases[team];
    if (!S || !(FACTIONS[this.teams[team].faction].buildings || []).includes(id)) return 'Not available';
    const fp = S.footprint, side = team === 0 ? -1 : 1;
    if (Math.sign(x) !== side) return 'Build on your own side';
    const fromBase = Math.abs(x - b.x);
    if (fromBase < GAME.baseHalfX + fp + 1) return 'Too close to the base';
    if (fromBase > GAME.baseHalfX + (S.tower ? B.towerMaxDist : B.maxDist)) return S.tower ? 'Towers must stay close to your base' : 'Too far from your base';
    if (Math.abs(z) > GAME.mapHalfWidth - fp - 1) return 'Out of bounds';
    const T = this.terrain;
    if (T) {
      if (T.level(x, z) !== 1) return 'Needs flat ground (not the river or hill)';
      const r = fp + B.clearance;
      for (let a = 0; a < 8; a++) if (T.blockedAt(x + Math.cos(a * Math.PI / 4) * r, z + Math.sin(a * Math.PI / 4) * r)) return 'Blocked';
      if (T.blockedAt(x, z)) return 'Blocked';
    }
    for (const o of this.units) if (o.structure && !o.dead && Math.hypot(o.pos.x - x, o.pos.z - z) < fp + o.structure.footprint + B.clearance) return 'Too close to another building';
    return null;
  }
  /** Player / AI order: pay and start constructing. Returns an error message or null. */
  build(team, id, x, z) {
    const T = this.teams[team], def = UNITS[id];
    if (this.over) return 'Match is over';
    const lim = this.buildLimit(team, id); if (lim) return lim;
    const err = this.canPlace(team, id, x, z); if (err) return err;
    if (T.gold < def.cost) return 'Not enough gold';
    T.gold -= def.cost; T.stats.goldSpent += def.cost;
    const u = this.placeStructure(team, id, x, z, false);
    u.paid = def.cost;
    this.emit('buildStart', u);
    return null;
  }
  /** Put a building on the map (instant = already built: Dev Lab). Registers its footprint as an obstacle. */
  placeStructure(team, id, x, z, instant = false) {
    const u = new Unit(this, id, team), S = u.structure;
    u.spawnAt(x, z);
    u.groundPos?.();
    u.order = { type: 'idle' };
    u.obstacle = this.terrain ? this.terrain.addObstacle({ x, z, r: S.footprint, kind: 'structure' }) : null;
    if (!instant) { u.buildT = 0; u.hp = u.maxHp * 0.1; u.rig.scaffold.visible = true; u.rig.yaw.scale.set(1, 0.2, 1); }
    else this.activateStructure(u);
    this.units.push(u);
    this.scene.add(u.obj);
    this.burst({ x, z }, 12, [0x9a7a4c, 0xd8c8a0, 0xffffff], 2.5, 0.8);
    if (this.audible(x)) sfx('train');
    return u;
  }
  onStructureBuilt(u) {
    this.activateStructure(u);
    this.burst(u.pos, 14, [0xffffff, 0xf7c948], 3, 0.8);
    this.emit('built', u);
  }
  /** A building came online (or was upgraded): true-sight towers (Sniper Tower, Vulcan CIWS) start revealing invisible enemies around them. */
  activateStructure(u) {
    const r = u.structure.trueSight;
    if (r && !u.detecting) { u.detecting = true; this.detectors.push({ team: u.team, pos: u.pos, get radius() { return u.structure.trueSight || 0; }, get dead() { return u.dead; } }); }   // radius follows upgrades
  }
  /** Tear down your own building: refunds GAME.build.refund of what you paid. */
  demolish(u) {
    if (!u?.structure || u.dead) return false;
    const refund = Math.round((u.paid ?? u.def.cost) * GAME.build.refund);
    this.teams[u.team].gold += refund;
    if (u.obstacle != null) { this.terrain?.removeObstacle(u.obstacle); u.obstacle = null; }
    u.dead = true; u.dispose();
    this.units.splice(this.units.indexOf(u), 1);
    this.burst(u.pos, 16, [0x9a7a4c, 0x8d8f93, 0xd8c8a0], 3, 0.9);
    this.emit('demolish', u, refund);
    return true;
  }
  /**
   * AI: after the opening it decides to save up for a building (aiSaving holds troop buys meanwhile, gives up
   * after 150s), then puts it down behind its own front line. Never spends gold saved for an upgrade.
   */
  aiBuild(T) {
    const ids = FACTIONS[T.faction].buildings || [];
    if (!ids.length || this.time < 90) return;
    if (!T.aiBuildGoal) {
      const open = ids.filter((id) => !this.buildLimit(T.team, id));
      if (!open.length || Math.random() > 0.08) return;
      T.aiBuildGoal = open[Math.floor(Math.random() * open.length)]; T.aiBuildT = 0;
      return;
    }
    const id = T.aiBuildGoal, def = UNITS[id];
    T.aiBuildT += this.diff.thinkEvery;
    if (T.aiBuildT > 150) { T.aiBuildGoal = null; return; }
    const saving = T.aiGoal ? upgradePrice(UPGRADES[T.aiGoal], this.pendingLevel(T.team, T.aiGoal)) : 0;
    if (T.gold < def.cost + Math.min(saving, 100)) return;
    const b = this.bases[T.team], dir = T.team === 0 ? 1 : -1;
    for (let k = 0; k < 14; k++) {
      const reach = def.structure.tower ? GAME.build.towerMaxDist - def.structure.footprint - 4 : 14;
      const x = b.x + dir * (GAME.baseHalfX + def.structure.footprint + 3 + Math.random() * reach), z = (Math.random() - 0.5) * 22;
      if (!this.canPlace(T.team, id, x, z)) { if (!this.build(T.team, id, x, z)) T.aiBuildGoal = null; return; }
    }
  }

  // ---------------- artillery shells ----------------
  /** Fire a shell from building `src` at `target`'s current spot (no leading: moving out of the way works). */
  fireShell(src, target, o = {}) {
    const S = src.structure, howitzer = S.shell === 'howitzer';
    const kind = o.kind || (o.rocket ? (S.pellet ? 'pellet' : S.rocketKind || 'rocket') : howitzer ? 'shell' : 'ball');
    const mesh = kind === 'arrow' ? buildArrow() : kind === 'rocket' ? buildRocket() : kind === 'shell' || kind === 'missile' ? buildShell() : buildCannonball();
    if (kind === 'pellet') mesh.scale.setScalar(0.55);
    if (kind === 'missile') mesh.scale.set(1.3, 1.3, 1.6);
    const start = new THREE.Vector3();
    (o.muzzle || src.rig.muzzles?.[src.shotIdx] || src.rig.muzzle).getWorldPosition(start);
    const end = new THREE.Vector3(target.pos.x, (this.terrain?.heightAt(target.pos.x, target.pos.z) || 0) + 0.15, target.pos.z);
    const dist = Math.hypot(end.x - start.x, end.z - start.z);
    mesh.position.copy(start);
    mesh.visible = !o.delay;
    this.scene.add(mesh);
    let marker = null;
    if ((howitzer || S.marker) && !o.rocket) {   // landing warning: a red ring that tightens until impact
      marker = new THREE.Mesh(new THREE.RingGeometry(0.85, 1, 24), new THREE.MeshBasicMaterial({ color: 0xff3020, transparent: true, opacity: 0.5, depthWrite: false, side: THREE.DoubleSide }));
      marker.material.userData.noFow = true;
      marker.rotation.x = -Math.PI / 2; marker.position.set(end.x, end.y + 0.05, end.z); marker.renderOrder = 3;
      marker.scale.setScalar(src.splashRadius);
      this.scene.add(marker);
    }
    this.shells.push({ mesh, marker, src, team: src.team, start, end, t: -(o.delay || 0), T: o.flight ?? S.flight, apex: dist * (o.arc ?? S.arc ?? (howitzer ? 0.45 : 0.06)),
      dmg: o.dmg ?? src.rollDamage(), splash: o.splash ?? src.splashRadius, kb: o.rocket && !S.pellet ? 0 : S.knockback || 0, groundOnly: S.groundOnly, small: !!o.rocket,
      guided: S.guided && target.dead === false ? target : null, stun: S.stun || 0, burn: S.burn || null, slow: o.slow || null });
    if (o.rocket) return;
    if (this.audible(src.pos.x)) sfx('snipe', 60);
    this.burst(start, 6, [0xd8d8d8, 0x9a9a9a, 0xffb040], 2, 0.6, 1.2);   // muzzle smoke
  }
  /**
   * Hwacha: `volley.count` (+ upgrades) rocket-arrows fanned over `volley.cone` around the target, landing at
   * slightly different depths; each splashes (structure.splash) for the tower's damage. Ground only.
   */
  fireVolley(src, target) {
    const S = src.structure, n = S.volley.count + (src.structMods.rockets || 0);
    const base = Math.atan2(target.pos.x - src.pos.x, target.pos.z - src.pos.z);
    const d0 = Math.hypot(target.pos.x - src.pos.x, target.pos.z - src.pos.z);
    for (let k = 0; k < n; k++) {
      const a = base + (k / Math.max(1, n - 1) - 0.5) * S.volley.cone + (Math.random() - 0.5) * 0.08;
      const d = Math.max(src.minRange + src.radius, Math.min(src.effRange + src.radius, d0 + (Math.random() - 0.5) * 4));
      const mz = src.rig.muzzles?.length ? src.rig.muzzles[k % src.rig.muzzles.length] : src.rig.muzzle;
      this.fireShell(src, { pos: { x: src.pos.x + Math.sin(a) * d, z: src.pos.z + Math.cos(a) * d } },
        { rocket: true, muzzle: mz, delay: k * (S.pellet ? 0.01 : 0.05), flight: S.flight + Math.random() * 0.2, arc: S.arc ?? (S.pellet ? 0.03 : 0.12), slow: S.suppress });
    }
    if (this.audible(src.pos.x)) sfx(S.pellet ? 'snipe' : 'zap', 60);
    const mp = new THREE.Vector3(); src.rig.muzzle.getWorldPosition(mp);
    this.burst(mp, 10, [0xffb040, 0xff6a00, 0xd8d8d8], 2.5, 0.7, 1);
  }
  updateShells(dt) {
    const prev = new THREE.Vector3();
    for (let i = this.shells.length - 1; i >= 0; i--) {
      const p = this.shells[i];
      p.t += dt;
      if (p.t < 0) continue;            // staggered volley: not launched yet
      p.mesh.visible = true;
      if (p.guided && !p.guided.dead) {   // Guided Shells: the landing point follows the target (can't be dodged)
        p.end.x = p.guided.pos.x; p.end.z = p.guided.pos.z;
        if (p.marker) p.marker.position.set(p.end.x, p.marker.position.y, p.end.z);
      }
      const u = Math.min(1, p.t / p.T);
      prev.copy(p.mesh.position);
      p.mesh.position.lerpVectors(p.start, p.end, u);
      p.mesh.position.y += p.apex * 4 * u * (1 - u);
      if (prev.distanceToSquared(p.mesh.position) > 1e-6) p.mesh.lookAt(prev.lerp(p.mesh.position, 2));
      p.mesh.visible = p.team === this.playerTeam || this.seenByViewer(p.mesh.position);
      if (p.marker) {
        p.marker.scale.setScalar(p.splash * (1.25 - 0.25 * u));
        p.marker.material.opacity = 0.35 + 0.45 * u;
        p.marker.visible = p.team === this.playerTeam || this.seenByViewer(p.end);
      }
      if (u < 1) continue;
      this.explodeShell(p);
      this.scene.remove(p.mesh);
      if (p.marker) { this.scene.remove(p.marker); p.marker.geometry.dispose(); p.marker.material.dispose(); }
      this.shells.splice(i, 1);
    }
  }
  /** Splash: 100% damage at the center, 50% at the edge. Ground troops only (flying units are safe). Ignores evasion. */
  explodeShell(p) {
    const src = p.src, R = p.splash;
    for (const o of this.units) {
      if (o.dead || o.tower || o.team === p.team || (p.groundOnly && o.flying)) continue;
      if (o.team === NEUTRAL_TEAM && o.aggroTeam !== p.team) continue;   // artillery leaves peaceful camps alone
      const d = Math.max(0, Math.hypot(o.pos.x - p.end.x, o.pos.z - p.end.z) - o.radius);
      if (d > R) continue;
      const f = 1 - 0.5 * (d / R);
      const dealt = o.takeDamage(p.dmg * f, src, 'physical', { ranged: true, splash: true });
      if (src && !src.dead) src.damageDealt += dealt;
      if (p.kb && !o.dead) o.knockback(p.end, p.kb * f);
      if (p.slow && !o.dead) o.addSlow(p.slow.pct, p.slow.t);   // Munjong / Whirlwind: volley rockets slow (structure.suppress)
      if (p.stun && !o.dead && !o.structure) { o.disarmT = Math.max(o.disarmT || 0, p.stun); o.pendingHit = null; o.addSlow(100, p.stun); }   // stun = can't attack or move
      if (dealt > 0) this.emit('hitDmg', o.pos, dealt, false, o.team);
    }
    if (p.burn) this.addFire(p.team, src, p.end.x, p.end.z, p.burn);
    if (p.small) { this.burst(p.end, 5, [0xffb040, 0xff6a00, 0x5a4a3a], 2.5, 0.5, 0.8); return; }
    this.burst(p.end, 18, [0x5a4a3a, 0x8a7a6a, 0xffb040, 0x3a3a3a], 5, 0.9, 1.5);
    if (this.audible(p.end.x)) sfx('baseHit', 90);
  }

  /** Burning ground (Thermobaric): damages ground enemies standing in it every second. */
  addFire(team, src, x, z, B) {
    const mesh = new THREE.Mesh(new THREE.CircleGeometry(B.radius, 20), new THREE.MeshBasicMaterial({ color: 0xff6a1a, transparent: true, opacity: 0.45, depthWrite: false }));
    mesh.material.userData.noFow = true;
    mesh.rotation.x = -Math.PI / 2; mesh.position.set(x, (this.terrain?.heightAt(x, z) || 0) + 0.07, z); mesh.renderOrder = 2;
    this.scene.add(mesh);
    this.fires.push({ team, src, x, z, r: B.radius, dps: B.dps, t: B.t, life: B.t, tick: 0, mesh });
  }
  updateFires(dt) {
    for (let i = this.fires.length - 1; i >= 0; i--) {
      const F = this.fires[i];
      F.t -= dt; F.tick -= dt;
      F.mesh.material.opacity = 0.25 + 0.2 * Math.sin(this.time * 20 + i) + 0.15 * (F.t / F.life);
      F.mesh.visible = F.team === this.playerTeam || this.seenByViewer(F);
      if (F.tick <= 0) {
        F.tick = 0.5;
        for (const o of this.units) {
          if (o.dead || o.tower || o.flying || o.team === F.team || (o.team === NEUTRAL_TEAM && o.aggroTeam !== F.team)) continue;
          if (Math.hypot(o.pos.x - F.x, o.pos.z - F.z) - o.radius > F.r) continue;
          const dealt = o.takeDamage(F.dps * 0.5, F.src, 'magic', { splash: true });
          if (F.src && !F.src.dead) F.src.damageDealt += dealt;
        }
        if (Math.random() < 0.6) this.burst({ x: F.x + (Math.random() - 0.5) * F.r, z: F.z + (Math.random() - 0.5) * F.r }, 2, [0xff6a1a, 0xffb040], 1.5, 0.4, 0.6);
      }
      if (F.t <= 0) { this.scene.remove(F.mesh); F.mesh.geometry.dispose(); F.mesh.material.dispose(); this.fires.splice(i, 1); }
    }
  }
  /** Whirlwind Battery: `n` more volleys, each at the biggest group outside the splash of the ones already aimed. */
  fireExtraVolleys(src, main, n) {
    const aimed = [main], R = src.splashRadius, dist = (a, b) => Math.hypot(a.pos.x - b.pos.x, a.pos.z - b.pos.z);
    const pool = this.units.filter((o) => o !== main && src.canShell(o));
    for (let k = 0; k < n; k++) {
      let best = null, bs = -Infinity;
      for (const o of pool) {
        if (aimed.some((a) => dist(a, o) <= R * 2)) continue;
        const score = pool.filter((e) => dist(e, o) <= R).length * 100 - src.edgeDist(o);
        if (score > bs) { bs = score; best = o; }
      }
      if (!best) return;
      aimed.push(best); this.fireVolley(src, best);
    }
  }
  /** Autocannon Bunker: `dmg` splash (100% → 50% at the edge) to other enemies within `R` of the target (flying too). */
  hitSplash(src, main, dmg, R) {
    for (const o of this.units) {
      if (o === main || o.dead || o.tower || o.team === src.team || (o.team === NEUTRAL_TEAM && o.aggroTeam !== src.team)) continue;
      const d = Math.max(0, Math.hypot(o.pos.x - main.pos.x, o.pos.z - main.pos.z) - o.radius);
      if (d > R) continue;
      const dealt = o.takeDamage(dmg * (1 - 0.5 * d / R), src, 'physical', { ranged: true, splash: true });
      src.damageDealt += dealt;
      if (dealt > 0) this.emit('hitDmg', o.pos, dealt, false, o.team);
    }
    this.burst(main.pos, 4, [0xffb040, 0x8a7a6a], 2, 0.4, 0.7);
  }
  /** Twin / Fire Archers: extra arrows at other targets in range (nearest first), on top of the main shot. */
  fireExtraShots(src, main, n) {
    const pool = this.units.filter((o) => o !== main && src.canShell(o)).sort((a, b) => src.edgeDist(a) - src.edgeDist(b));
    for (const o of pool.slice(0, n)) this.fireProjectile(src, o, true);
  }
  /** Arrow Storm Spire: `rain.count` arrows dropped around the target over ~1s, each with a small splash. */
  fireRain(src, target) {
    const R = src.structure.rain;
    for (let k = 0; k < R.count; k++) {
      const a = Math.random() * Math.PI * 2, d = Math.sqrt(Math.random()) * R.radius;
      this.fireShell(src, { pos: { x: target.pos.x + Math.cos(a) * d, z: target.pos.z + Math.sin(a) * d } },
        { rocket: true, kind: R.kind || 'arrow', dmg: R.damage, splash: R.splash, delay: k * 0.05, flight: 0.9 + Math.random() * 0.3, arc: 0.6 });
    }
    if (this.audible(src.pos.x)) sfx(R.kind === 'missile' ? 'zap' : 'bow', 40);
  }
  /** Railgun: an instant slug along the line to the target, out to full range. Hits everything on it (flying too). */
  fireLine(src, target) {
    const S = src.structure, start = new THREE.Vector3();
    src.rig.muzzle.getWorldPosition(start);
    const dx = target.pos.x - src.pos.x, dz = target.pos.z - src.pos.z, len = Math.hypot(dx, dz) || 1, ux = dx / len, uz = dz / len;
    const reach = src.effRange + src.radius;
    let dmg = src.rollDamage();
    const crit = S.critChance && Math.random() < S.critChance;   // Deadeye Sentinel headshot
    if (crit) dmg *= S.critMult || 2;
    for (const o of this.units) {
      if (o.dead || o.tower || o.team === src.team || (o.team === NEUTRAL_TEAM && o.aggroTeam !== src.team)) continue;
      const rx = o.pos.x - src.pos.x, rz = o.pos.z - src.pos.z, along = rx * ux + rz * uz;
      if (along < 0 || along > reach + o.radius) continue;
      if (Math.abs(rx * uz - rz * ux) > (S.lineWidth || 0.8) + o.radius) continue;
      const dealt = o.takeDamage(dmg * (o.flying && S.flyingBonus ? 1 + S.flyingBonus : 1), src, 'physical', { ranged: true });
      src.damageDealt += dealt;
      if (S.pierceSlow && !o.dead) o.addSlow(S.pierceSlow.pct, S.pierceSlow.t);   // Skypiercer pins its targets
      if (dealt > 0) this.emit(crit ? 'crit' : 'hitDmg', o.pos, dealt, false, o.team);
      this.burst(o.pos, 5, S.bolt ? [0xd8c8a0, 0xffffff] : [0xa0f0ff, 0xffffff], 2.5, 0.4, 0.8);
    }
    if (S.bolt) {   // ballista: a big bolt flies the line instead of a glowing beam
      const end = new THREE.Vector3(src.pos.x + ux * reach, start.y - 0.6, src.pos.z + uz * reach);
      const mesh = buildArrow(); mesh.scale.setScalar(2.6); mesh.position.copy(start); mesh.lookAt(end);
      this.scene.add(mesh);
      this.beams.push({ mesh, t: 0.25, total: 0.25, from: start.clone(), to: end, bolt: true });
      if (this.audible(src.pos.x)) sfx('bow', 60);
      return;
    }
    // the slug's trail: a thin glowing beam that fades
    const beam = new THREE.Mesh(boxGeo(0.25, 0.25, 1), new THREE.MeshBasicMaterial({ color: S.beamColor || 0x80f0ff, transparent: true, opacity: 0.9, depthWrite: false }));
    beam.material.userData.noFow = true;
    const end = new THREE.Vector3(src.pos.x + ux * reach, start.y - 0.4, src.pos.z + uz * reach);
    beam.position.lerpVectors(start, end, 0.5); beam.scale.z = start.distanceTo(end); beam.lookAt(end);
    this.scene.add(beam);
    this.beams.push({ mesh: beam, t: 0.35 });
    if (this.audible(src.pos.x)) sfx('snipe', 40);
  }
  updateBeams(dt) {
    for (let i = this.beams.length - 1; i >= 0; i--) {
      const b = this.beams[i]; b.t -= dt;
      if (b.bolt) {   // flying ballista bolt
        b.mesh.position.lerpVectors(b.from, b.to, 1 - Math.max(0, b.t) / b.total);
        if (b.t <= 0) { this.scene.remove(b.mesh); this.beams.splice(i, 1); }
        continue;
      }
      b.mesh.material.opacity = Math.max(0, b.t / 0.35) * 0.9; b.mesh.scale.x = b.mesh.scale.y = 1 + (0.35 - b.t) * 3;
      if (b.t <= 0) { this.scene.remove(b.mesh); b.mesh.material.dispose(); this.beams.splice(i, 1); }
    }
  }

  // ---------------- building upgrades (js/buildtree.js) ----------------
  /**
   * Upgrade building `u` one step (`path` 'a' | 'b' needed at the Lv 2 → 3 fork). Pays now; scaffolding for the
   * step's time while it keeps firing at its old level. Returns an error message or null.
   */
  upgradeBuilding(u, path = null) {
    if (!u?.structure || u.dead) return 'Not a building';
    if (!u.built) return 'Still under construction';
    if (u.upgrading) return 'Already upgrading';
    const steps = nextSteps(u.def.id, u.bLevel, u.bPath);
    if (!steps.length) return 'Max level';
    const st = steps.length > 1 ? steps.find((x) => x.path === path) : steps[0];
    if (!st) return 'Pick a path';
    const T = this.teams[u.team];
    if (T.gold < st.node.cost) return 'Not enough gold';
    T.gold -= st.node.cost; T.stats.goldSpent += st.node.cost;
    u.paid = (u.paid ?? u.def.cost) + st.node.cost;
    u.upgrading = { t: 0, total: st.node.time, level: st.level, path: st.path, name: st.node.name };
    u.rig.scaffold.visible = true;
    this.burst(u.pos, 8, [0x9a7a4c, 0xd8c8a0], 2, 0.6);
    this.emit('buildingUpgradeStart', u);
    return null;
  }
  onBuildingUpgraded(u) {
    this.burst(u.pos, 16, [0xffffff, 0xf7c948, 0x9a7a4c], 3, 0.9);
    if (this.audible(u.pos.x)) sfx('evolve', 80);
    this.emit('buildingUpgraded', u);
  }
  /** AI: upgrade its built buildings when it has spare gold; at the fork, swarms → path b, otherwise path a. */
  aiUpgradeBuildings(T) {
    if (Math.random() > 0.25) return;
    const saving = T.aiGoal ? upgradePrice(UPGRADES[T.aiGoal], this.pendingLevel(T.team, T.aiGoal)) : 0;
    for (const u of this.buildingsOf(T.team)) {
      if (!u.built || u.upgrading) continue;
      const steps = nextSteps(u.def.id, u.bLevel, u.bPath); if (!steps.length) continue;
      let st = steps[0];
      if (steps.length > 1) {
        const foes = this.units.filter((o) => !o.dead && !o.structure && !o.tower && o.team !== T.team && o.team !== NEUTRAL_TEAM);
        const swarm = foes.length >= 8 || foes.filter((o) => o.def.cost <= 75).length >= 5;
        st = steps.find((x) => x.path === (swarm ? 'b' : 'a')) || steps[0];
      }
      if (T.gold >= st.node.cost + 40 + Math.min(saving, 150)) { this.upgradeBuilding(u, st.path); return; }
    }
  }

  // ---------------- combat callbacks ----------------
  // ---------------- projectiles ----------------
  fireProjectile(src, target, extra = false, mods = null) {
    const pdef = src.def.projectile;
    const mesh = pdef.kind === 'arrow' ? buildArrow() : pdef.kind === 'wisp' ? buildWisp() : buildBullet();
    if (pdef.kind === 'sniper') mesh.scale.set(1.4, 1.4, 2.6);
    const f = src.facing;
    const start = new THREE.Vector3(src.pos.x + Math.sin(f) * 0.9, src.muzzleY + (src.yOff || 0) + (src.pos.y || 0), src.pos.z + Math.cos(f) * 0.9);
    mesh.position.copy(start);
    this.scene.add(mesh);
    const end = this.projectileAim(target, src);
    const dist0 = Math.max(0.5, start.distanceTo(end));
    let dmg = src.rollDamage(extra); const crit = src.lastCrit, shot = src.lastShot;
    if (mods) Object.assign(shot, mods);                                               // Flick slow / extra-shot flag
    if (src.structure?.flyingBonus && target.flying) dmg *= 1 + src.structure.flyingBonus;   // Skypiercer
    if (src.boomMult) dmg *= src.boomMult(target);                                      // Boomstick: closer = harder
    if (crit) mesh.scale.multiplyScalar(1.6);
    this.projectiles.push({ mesh, src, target, start, end, dist0, u: 0, speed: pdef.speed, arc: pdef.arc, kind: pdef.kind, team: src.team, dmg, crit, shot });
    if (this.audible(src.pos.x)) sfx(pdef.kind === 'arrow' ? 'bow' : pdef.kind === 'sniper' ? 'snipe' : 'gun', 35);
    // Bowsling: a second arrow at ANOTHER enemy in attack range (never chains off itself)
    const bs = !extra && src.ability('bowsling');
    if (bs && !bs.st.broken && !target.isBase && Math.random() < bs.def.chance) {
      const r = src.effRange + src.radius + 0.5;
      const pool = this.units.filter((o) => o !== target && src.isFoe(o) && !o.tower && this.canSee(src.team, o) && Math.hypot(o.pos.x - src.pos.x, o.pos.z - src.pos.z) - o.radius <= r);
      if (pool.length) this.fireProjectile(src, pool[Math.floor(Math.random() * pool.length)], true);
    }
  }
  projectileAim(target, src) {
    if (target.isBase) { const p = this.baseClosestPoint(src, target.team); return new THREE.Vector3(p.x, 2.2, p.z); }
    return new THREE.Vector3(target.pos.x, 1.4 + (target.pos.y || 0), target.pos.z);
  }
  // ---------------- evasion / abilities ----------------
  onDodge(attacker, victim, kind) {
    this.emit('dodge', victim.pos, kind, victim.team);
    if (this.audible(victim.pos.x)) sfx('whiff', 60);
  }

  enemiesInRadius(src, r, A = null) {
    return this.units.filter((o) => !o.dead && !o.tower && o.team !== src.team && !(o.flying && A?.affectsFlying === false) && Math.hypot(o.pos.x - src.pos.x, o.pos.z - src.pos.z) - o.radius <= r);
  }

  // ---------------- trails (Barding Rally) & line projectiles ----------------
  addTrail(team, x, z, life, bonus) {
    const m = new THREE.Mesh(boxGeo(0.9, 0.04, 0.9), new THREE.MeshBasicMaterial({ color: 0xf2c94c, transparent: true, opacity: 0.45, depthWrite: false }));
    m.position.set(x, 0.05 + (this.terrain?.heightAt(x, z) || 0), z); m.rotation.y = Math.random() * 3;
    this.scene.add(m);
    this.trails.push({ team, x, z, t: life, life, bonus, mesh: m });
  }
  updateTrails(dt) {
    for (let i = this.trails.length - 1; i >= 0; i--) {
      const T = this.trails[i];
      T.t -= dt; T.mesh.material.opacity = 0.45 * Math.max(0, T.t / T.life);
      T.mesh.visible = T.team === this.playerTeam || this.seenByViewer(T);
      if (T.t <= 0) { this.scene.remove(T.mesh); T.mesh.material.dispose(); this.trails.splice(i, 1); continue; }
      for (const u of this.units) {
        if (u.dead || u.team !== T.team || u.flying || u.tower) continue;
        if (Math.abs(u.pos.x - T.x) < 0.8 && Math.abs(u.pos.z - T.z) < 0.8) { u.rallyT = 0.35; u.rallyBonus = T.bonus; }
      }
    }
  }
  updateSkillshots(dt) {
    for (let i = this.skillshots.length - 1; i >= 0; i--) {
      const S = this.skillshots[i];
      const step = Math.min(S.left, S.speed * dt);
      const x0 = S.x, z0 = S.z;
      S.x += S.dx * step; S.z += S.dz * step; S.left -= step;
      S.mesh.position.x = S.x; S.mesh.position.z = S.z;
      S.mesh.visible = S.team === this.playerTeam || this.seenByViewer(S);
      for (const o of this.units) {
        if (o.dead || o.tower || o.team === S.team || S.hit.has(o) || (o.flying && !S.air)) continue;
        // distance from o to the swept segment
        const vx = o.pos.x - x0, vz = o.pos.z - z0, t = Math.max(0, Math.min(step, vx * S.dx + vz * S.dz));
        if (Math.hypot(o.pos.x - (x0 + S.dx * t), o.pos.z - (z0 + S.dz * t)) > S.width / 2 + o.radius) continue;
        S.hit.add(o);
        const src = S.src.dead ? null : S.src;
        let dealt = o.takeDamage(S.phys * S.mult, src, 'physical');
        dealt += o.takeDamage(S.magic * S.mult, src, 'magic');
        if (src) src.damageDealt += dealt;
        if (S.slow) o.addSlow(S.slow, S.slowTime);
        S.mult *= 1 - S.falloff;                       // each enemy hit weakens the arrow by 10% of its current value
        this.burst(o.pos, 5, S.fx || [0x9ad8ff, 0xffffff], 2, 0.4);
      }
      if (S.left <= 0) { this.scene.remove(S.mesh); this.skillshots.splice(i, 1); }
    }
  }

  /** Execute an active ability. Returns false if it couldn't be cast. */
  castAbility(u, A, aim = null) {
    if (A.id === 'snipeStance') {
      const ok = u.toggleStance();
      if (ok && u.team === this.playerTeam) sfx(u.stance === 'stand' ? 'click' : 'order');
      return ok;
    }
    if (A.id === 'brainwash') {
      // works for any caster: neutral creeps pick their target in their brain; hired casters pick a random visible enemy troop in range
      let t = u.bwTarget; u.bwTarget = null;
      if (!t) {
        const pool = this.units.filter((o) => !o.dead && !o.tower && !o.invulnerable && !o.brainwashed && o.team <= 1 && o.team !== u.team && this.canSee(u.team, o) && u.edgeDist(o) <= A.castRange);
        t = pool[Math.floor(Math.random() * pool.length)];
      }
      if (!t || t.dead || t.brainwashed || t.tower || t.invulnerable) return false;
      this.brainwash(u, t, A);
      return true;
    }
    if (A.id === 'shieldStomp') {
      const L = Math.max(1, this.upLevel(u.statTeam, 'shieldStomp'));
      const hits = this.enemiesInRadius(u, A.radius, A);
      for (const t of hits) { u.damageDealt += t.takeDamage(A.damage[L - 1], u, A.damageType); t.knockback(u.pos, A.knockback); }
      this.burst(u.pos, 20, [0x9aa3ab, 0xcdd3da, 0x5a6470], 5, 0.6, 1.1);
      if (this.audible(u.pos.x)) sfx('baseHit', 120);
      this.emit('ability', u, A, hits.length);
      return true;
    }
    if (A.id === 'arrowPiercer') {
      aim ||= u.target && !u.target.dead ? { x: u.target.pos.x, z: u.target.pos.z } : null;
      if (!aim) return false;
      const L = Math.max(1, this.upLevel(u.statTeam, 'arrowPiercer'));
      let dx = aim.x - u.pos.x, dz = aim.z - u.pos.z; const d = Math.hypot(dx, dz) || 1; dx /= d; dz /= d;
      const mesh = new THREE.Group();
      const shaft = new THREE.Mesh(boxGeo(0.12, 0.12, 1.6), sharedMat(0xd8f0ff, { emissive: 0x4a8ac0 }));
      const glow = new THREE.Mesh(boxGeo(0.5, 0.5, 0.5), sharedMat(0x9ad8ff, { emissive: 0x3a7ab8 }));
      glow.position.z = 0.8; mesh.add(shaft, glow);
      mesh.position.set(u.pos.x, 1.3 + (u.pos.y || 0), u.pos.z); mesh.rotation.y = Math.atan2(dx, dz);
      this.scene.add(mesh);
      this.skillshots.push({ src: u, team: u.team, x: u.pos.x, z: u.pos.z, dx, dz, speed: A.speed, left: A.range, width: A.width,
        phys: u.effDamage, magic: A.bonusMagic[L - 1], mult: 1, falloff: A.falloff, slow: A.slow, slowTime: A.slowTime, air: A.affectsFlying !== false, hit: new Set(), mesh });
      if (this.audible(u.pos.x)) sfx('bow', 40);
      if (A.postBuff) u.apBuff = { as: A.postBuff.as, left: A.postBuff.attacks, until: this.time + A.postBuff.t };   // High Elf
      return true;
    }
    if (A.id === 'scattershot') {
      aim ||= u.target && !u.target.dead ? { x: u.target.pos.x, z: u.target.pos.z } : null;
      if (!aim) return false;
      let dx = aim.x - u.pos.x, dz = aim.z - u.pos.z; const d = Math.hypot(dx, dz) || 1; dx /= d; dz /= d;
      const mesh = new THREE.Group();
      for (let k = 0; k < 7; k++) { const b = new THREE.Mesh(boxGeo(0.16, 0.16, 0.16), sharedMat(0xffd040, { emissive: 0xff8a20 })); b.position.set((k - 3) * A.width / 7, (k % 2) * 0.12, (k % 3) * 0.15); mesh.add(b); }
      mesh.position.set(u.pos.x, 1.3 + (u.pos.y || 0), u.pos.z); mesh.rotation.y = Math.atan2(dx, dz);
      this.scene.add(mesh);
      this.skillshots.push({ src: u, team: u.team, x: u.pos.x, z: u.pos.z, dx, dz, speed: A.speed, left: A.range, width: A.width,
        phys: 0, magic: A.flat + A.adPct * u.effDamage, mult: 1, falloff: 0, slow: 0, slowTime: 0, air: A.affectsFlying !== false, hit: new Set(), mesh, fx: [0xffd040, 0xff8a20] });
      u.muzzleT = 0.1; u.swing = 1;
      this.burst({ x: u.pos.x + dx, z: u.pos.z + dz }, 10, [0xffd040, 0xffffff, 0x8a8a8a], 4, 0.4, 0.8);
      if (this.audible(u.pos.x)) sfx('gun', 30);
      return true;
    }
    if (A.id === 'enforce') {   // fear everything close
      const hits = this.enemiesInRadius(u, A.radius, A).filter((o) => !o.structure);
      for (const t of hits) t.addFear(A.fear, u.pos);
      this.ring(u.pos, A.radius, 0x4aa3ff);
      this.burst(u.pos, 14, [0x4aa3ff, 0xffffff, 0xff3b3b], 4, 0.6, 1);
      if (this.audible(u.pos.x)) sfx('baseHit', 120);
      this.emit('ability', u, A, hits.length);
      return true;
    }
    if (A.id === 'mediator') {   // enemies nearby deal less damage (doesn't stack: strongest / longest wins)
      const hits = this.enemiesInRadius(u, A.radius, A).filter((o) => !o.structure);
      for (const t of hits) { t.weakenUntil = Math.max(t.weakenUntil || 0, this.time + A.duration); t.weakenPct = Math.max(t.weakenUntil > this.time && t.weakenPct ? t.weakenPct : 0, A.weaken); }
      this.ring(u.pos, A.radius, 0xf2f2f2);
      this.burst(u.pos, 12, [0xffffff, 0x9ad0ff], 3, 0.6, 1);
      if (this.audible(u.pos.x)) sfx('order', 60);
      this.emit('ability', u, A, hits.length);
      return true;
    }
    if (A.id === 'execute') {   // unit-targeted finisher
      const t = aim?.unit;
      if (!t || t.dead || t.tower || u.edgeDist(t) > A.castRange + 1) return false;
      const dmg = u.effDamage + A.missingPct * Math.max(0, t.maxHp - t.hp);
      const dealt = t.takeDamage(dmg, u, 'physical');
      u.damageDealt += dealt; u.swing = 1; u.faceTowards(t.pos.x - u.pos.x, t.pos.z - u.pos.z, 1, 1);
      this.emit('hitDmg', t.pos, dealt, true, u.team);
      this.burst(t.pos, 12, [0xa01a1a, 0xffffff, 0x1a1a1a], 3, 0.5, 1);
      if (this.audible(u.pos.x)) sfx('snipe', 40);
      return true;
    }
    if (A.id === 'flurry' || A.id === 'suppressiveFire') {
      const a = u.ability(A.id);
      a.st.buffT = A.duration;
      if (this.audible(u.pos.x)) sfx(A.id === 'flurry' ? 'bow' : 'gun', 40);
      this.burst(u.pos, 8, A.id === 'flurry' ? [0x9ad87a, 0xffffff] : [0xffd040, 0xff7a2e], 2, 0.5, 0.8);
      return true;
    }
    if (A.id === 'tumble') {
      // roll toward the aim point (or away from the nearest threat when the AI casts without one)
      let dx, dz;
      if (aim) { dx = aim.x - u.pos.x; dz = aim.z - u.pos.z; }
      else { const t = this.findNearestEnemy(u, 6); if (!t) return false; dx = u.pos.x - t.pos.x; dz = u.pos.z - t.pos.z; }
      const d = Math.hypot(dx, dz); if (d < 0.01) return false;
      const speed = u.effMoveSpeed + A.speedBonus;
      u.dash = { dx: dx / d, dz: dz / d, left: A.range, total: A.range, speed };
      u.pendingHit = null; u.swing = 0;
      this.burst(u.pos, 6, [0xb8a070, 0x8a6a42], 2, 0.4, 0.7);
      if (this.audible(u.pos.x)) sfx('whiff', 40);
      return true;
    }
    if (A.id === 'splatter' && A.leap) {   // Fire Splatter: leap to the aimed point, explode on landing
      aim ||= u.target && !u.target.dead ? { x: u.target.pos.x, z: u.target.pos.z } : null;
      if (!aim) return false;
      let dx = aim.x - u.pos.x, dz = aim.z - u.pos.z; let d = Math.hypot(dx, dz);
      if (d > A.leap.range) { dx *= A.leap.range / d; dz *= A.leap.range / d; d = A.leap.range; }
      const lim = GAME.baseX - GAME.baseHalfX - u.radius;
      const ex = Math.max(-lim, Math.min(lim, u.pos.x + dx)), ez = Math.max(-GAME.mapHalfWidth, Math.min(GAME.mapHalfWidth, u.pos.z + dz));
      u.leap = { sx: u.pos.x, sz: u.pos.z, ex, ez, t: 0, dur: Math.max(0.15, d / A.leap.speed), dist: d, A };
      u.pendingHit = null; u.swing = 0;
      this.burst(u.pos, 8, [0xff6a1a, 0xffd23a], 3, 0.4, 0.8);
      if (this.audible(u.pos.x)) sfx('whiff', 40);
      return true;
    }
    if (A.id === 'splatter') {
      this.splatterBlast(u, A);
      // self-destruct: no bounty for the enemy, model vanishes instantly
      u._exploded = true;
      u.hp = 0;
      u.die(null);
      u.obj.visible = false; u.hideModel = true;
      u.deathT = 2.6;
      return true;
    }
    return false;
  }

  /** Fire Splatter landed: explode there and die (same as a normal Splatter from that spot). */
  landLeap(u, A) {
    if (u.dead) return;
    this.splatterBlast(u, A);
    u._exploded = true; u.hp = 0; u.die(null);
    u.obj.visible = false; u.hideModel = true; u.deathT = 2.6;
  }
  /**
   * Splatter damage + slow (scales with Organic Matter). Used by the active and by Death Splatter.
   * Imp-tree variants (ability mods): dmgMult, stun, shred { armor, t, buildings }, burn { pct, t }.
   */
  splatterBlast(u, A) {
    const om = UPGRADES.organicMatter, lvl = this.upLevel(u.team, 'organicMatter');
    const dmg = (A.damage + (lvl ? om.values.damage[lvl - 1] : 0)) * (A.dmgMult || 1);
    const hits = this.enemiesInRadius(u, A.radius, A);
    for (const t of hits) {
      const dealt = t.takeDamage(dmg, u, A.damageType);   // abilities can't be evaded
      u.damageDealt += dealt;
      if (t.dead) continue;
      if (lvl) t.addSlow(om.values.slow[lvl - 1], om.values.slowTime);
      if (A.stun) t.addStun(A.stun);
      if (A.shred && (!t.structure || A.shred.buildings)) t.addArmorDebuff('splatter', A.shred.armor, A.shred.t);
      if (A.burn) t.addBurn(A.burn.pct * t.maxHp, A.burn.t, u, 'magic');
    }
    for (const b of this.bases) if (b.team !== u.team && this.distToBase(u, b.team) <= A.radius) {
      this.damageBase(b.team, dmg, u, { x: u.pos.x, z: u.pos.z });
      if (A.shred?.buildings) b.armorDebuff = { v: Math.max(A.shred.armor, b.armorDebuff?.until > this.time ? b.armorDebuff.v : 0), until: this.time + A.shred.t };
    }
    if (A.stun) this.burst(u.pos, 26, [0x9af0ff, 0xffffff, 0x4a8ad8], 5, 0.9, 1.2);
    if (A.shred) this.burst(u.pos, 22, A.shred.buildings ? [0x9a3ad8, 0x2a0a3a, 0xc070ff] : [0xfff3a0, 0xffffff, 0xf2c94c], 5, 0.9, 1.1);
    if (A.burn) this.burst(u.pos, 26, [0xff6a1a, 0xffd23a, 0x3a1a0a], 5, 1, 1.3);
    this.splatFX(u.pos, A.radius);
    if (this.audible(u.pos.x)) sfx('splat', 30);
    this.emit('ability', u, A, hits.length);
    return hits.length;
  }

  /** Organic explosion: goo chunks + a gore splat on the ground that fades out. */
  splatFX(p, r) {
    const goo = [0x8a1c1c, 0xb8342a, 0x5c0f14, 0x7fbf3a, 0x4e7a1e, 0xd9c23a];
    this.burst(p, 46, goo, 7, 1.4, 1.5);
    this.burst(p, 18, [0xff4a2e, 0xffd23a], 4, 0.5, 0.9);
    const g = new THREE.Group();
    const n = Math.round(r * 9);
    for (let i = 0; i < n; i++) {
      const a = Math.random() * Math.PI * 2, d = Math.sqrt(Math.random()) * r;
      const s = 0.25 + Math.random() * 0.55;
      const m = new THREE.Mesh(boxGeo(1, 1, 1), new THREE.MeshLambertMaterial({ color: goo[i % 4], transparent: true }));
      m.scale.set(s, 0.04, s);
      m.position.set(Math.cos(a) * d, 0.04 + i * 0.001, Math.sin(a) * d);
      m.rotation.y = Math.random() * Math.PI;
      g.add(m);
    }
    g.position.set(p.x, 0, p.z);
    this.scene.add(g);
    this.decals.push({ g, t: 0, life: 6 });
  }

  updateProjectiles(dt) {
    const nxt = new THREE.Vector3();
    for (let i = this.projectiles.length - 1; i >= 0; i--) {
      const p = this.projectiles[i];
      const t = p.target;
      if (!t.isBase && !t.dead) p.end.copy(this.projectileAim(t, p.src)); // homing until impact
      p.u = Math.min(1, p.u + (p.speed * dt) / p.dist0);
      const at = (u, out) => out.lerpVectors(p.start, p.end, u).setY(THREE.MathUtils.lerp(p.start.y, p.end.y, u) + p.arc * p.dist0 * 4 * u * (1 - u));
      at(p.u, p.mesh.position);
      at(Math.min(1, p.u + 0.02), nxt);
      if (nxt.distanceToSquared(p.mesh.position) > 1e-6) p.mesh.lookAt(nxt);
      if (p.u >= 1) {
        if (t.isBase) { this.damageBase(t.team, p.dmg, p.src.dead ? null : p.src, p.end); if (p.crit) this.emit('crit', p.end, p.dmg); }
        else if (!t.dead) {
          const dodge = p.shot?.trueStrike ? null : t.dodgeCheck(p.src);   // true strike: can't miss or be evaded
          if (dodge) { this.onDodge(p.src, t, dodge); this.scene.remove(p.mesh); this.projectiles.splice(i, 1); continue; }
          const dealt = t.takeDamage(p.dmg, p.src, p.src.def.damageType || 'physical', { attack: true, ranged: true, extra: !!p.shot?.extra });
          p.src.damageDealt += dealt;
          p.src.onAttackLanded(t, dealt, p.dmg, p.crit, p.shot);
          this.onHit(p.src, t);
          if (p.crit) { this.emit('crit', t.pos, dealt); this.burst(t.pos, 6, [0xf7c948, 0xffe27a], 2.5, 0.5); }
        }
        this.scene.remove(p.mesh);
        this.projectiles.splice(i, 1);
      }
    }
  }

  onHit(attacker, victim) {
    const hs = { viking: 'hitAxe', police: 'hitBaton', archer: 'hitArrow', gunner: 'hitBullet', sniper: 'hitBullet', imp: 'hitAxe' };
    if (this.audible(victim.pos.x)) sfx(hs[attacker.def.id] || 'hitAxe', 45);
    this.burst(victim.pos, 3, [0xffffff, 0xffd0a0], 1.4, 0.35);
  }

  onUnitDeath(u, killer) {
    // Banshee Curse: a cursed unit rises for the curse owner's side (not towers, not raised/brainwashed ones, not exploded Imps)
    if (u.curse && u.curse.t > 0 && !u.tower && !u.raised && !u.brainwashed && !u._exploded && u.curse.team !== u.team) this.raiseUnit(u, u.curse);
    if (u.brainwashed || u.raised) {   // no bounty, no drops, no stats: it was never really theirs
      if (!u._exploded) { this.burst(u.pos, 14, [0x9a6ad8, 0xd8c8ff, 0x3a2a5a], 4, 1.1); if (this.audible(u.pos.x)) sfx('death', 80); }
      this.emit('death', u); return;
    }
    if (this.teams[u.team]) this.teams[u.team].stats.lost++;
    const tier = u.creepTier || creepTierOf(u.def.id);
    if (u.team === NEUTRAL_TEAM && Math.random() < dropChanceForTier(tier)) {
      const pool = Object.keys(ITEMS).filter((id) => (ITEMS[id].tier || 1) === tier);   // any item of the creep's tier
      const id = pool[Math.floor(Math.random() * pool.length)];
      // Auto-loot (per team toggle): the troop that landed the kill gets it straight into a free slot
      if (killer && !killer.dead && !killer.tower && !killer.brainwashed && this.teams[killer.team]?.autoLoot && killer.addItem(id) >= 0) this.emit('pickup', killer, id);
      else this.spawnLoot(id, u.pos);
    }
    // Cut Throat (Stalker): a kill makes the killer untouchable for a moment
    const ct = killer && !killer.dead && killer.ability?.('cutThroat');
    if (ct && !ct.st.broken && killer.team !== u.team) { killer.invulnT = Math.max(killer.invulnT, ct.def.duration); this.burst(killer.pos, 6, [0xff3b2f, 0x1e1e26], 2, 0.5, 0.7); }
    if (killer && !killer.brainwashed && this.teams[killer.team] && killer.team !== u.team) {   // brainwashed killers earn nobody gold
      const T = this.teams[killer.team];
      T.stats.kills++;
      this.addTroopKill(killer.team, killer.def.id);
      // kill bounty: % of what the victim cost (what was paid; camp creeps / free spawns = their listed cost)
      const bounty = Math.round((u.paid ?? u.def.cost) * GAME.bountyPct * (T.isAI && !this.sandbox ? this.diff.goldMult : 1));
      T.gold += bounty; T.stats.bounty = (T.stats.bounty || 0) + bounty;
      this.emit('bounty', u.pos, bounty, killer.team);
    }
    if (!u._exploded && u.ability('deathSplatter')) {   // Organic Matter max level
      u._exploded = true;
      this.splatterBlast(u, u.abilDef('splatter'));   // form variant (Ice / Sacred / Fire...) explodes in place
      u.obj.visible = false; u.hideModel = true; u.deathT = 2.6;
    }
    if (u.def.id === 'police' && this.upLevel(u.team, 'riotTraining') >= UPGRADES.riotTraining.max) {
      for (const o of this.units) if (!o.dead && o !== u && o.team === u.team && o.def.id === 'police' && Math.hypot(o.pos.x - u.pos.x, o.pos.z - u.pos.z) <= 10) {
        o.hp = Math.min(o.maxHp, o.hp + UPGRADES.riotTraining.values.backupHeal);
        this.burst(o.pos, 4, [0x5ce36f, 0xffffff], 1.5, 0.5);
      }
    }
    if (u._exploded) { this.emit('death', u); return; }   // Splatter handles its own FX
    if (this.audible(u.pos.x)) sfx('death', 80);
    const cols = { viking: [0x7a2e22, 0xc8642a, 0x9aa3ab, 0xcdb995], police: [0x22325c, 0x1a2440, 0xf2c94c, 0x9ad0ff],
      archer: [0x4e6b2e, 0x3d5a24, 0x7a5532, 0x8a5a2b], gunner: [0x3b4652, 0x1d2329, 0x4a5560, 0x7fd4ff],
      imp: [0xb8342a, 0x7a1f1a, 0x3a2a2a, 0xffd23a], sniper: [0x4a5a3a, 0x2f3a26, 0x1a1d22, 0x6b7b4a],
      direBear: [0x5a3a22, 0x3a2414, 0x8a6a4a], blueBear: [0x4a6a9a, 0x2f4a70, 0x9ab0d0],
      banshee: [0x8a7ab8, 0xd8d0f0, 0x9af0ff], smallBanshee: [0xa89ad0, 0xd8d0f0, 0x9af0ff],
      alphaThug: [0xa02a2a, 0xf2c94c, 0x1a1a22], lancer: [0xb8c0c8, 0x2f62b8, 0x6b4a2a], elf: [0x4c8c36, 0xe8e2c8, 0x9ad8ff],
      riotSkirmisher: [0x232c40, 0x9ad0ff, 0x111111], reconDrone: [0x3b4652, 0x9aa3ab, 0x4aa3ff], hooligan: [0x2f6b3a, 0xf0f0f0, 0x2f2f2f], outlaw: [0x2a1a10, 0x8a2a2a, 0x9aa3ab] }[u.def.id] || [0x888888];
    this.burst(u.pos, 14, cols, 4, 1.1);
    this.emit('death', u);
  }

  damageBase(team, raw, src, at = null) {
    const b = this.bases[team];
    if (b.dead || this.over || b.invulnerable) return;
    if (this.cheat?.god && team === this.playerTeam) return;
    const debuff = b.armorDebuff && b.armorDebuff.until > this.time ? b.armorDebuff.v : 0;   // Cursed Splatter
    const dmg = raw * defenseMult(b.armor - debuff) * this.dmgMult(src?.team, team);
    b.hp = Math.max(0, b.hp - dmg);
    b.shake = 0.18;
    if (src) { src.damageDealt += dmg; this.teams[src.team].stats.baseDamage += dmg; }
    if (this.audible(b.x)) sfx('baseHit', 220);
    this.burst(at || { x: src ? src.pos.x + (team === 0 ? -0.6 : 0.6) : b.x, z: src ? src.pos.z : 0 }, 4,
      team === 0 ? [0x8d8f93, 0x6e7075] : [0xb8bcc2, 0x4fa8e0], 2.5, 0.7, 1.3);
    if (team === this.playerTeam) this.emit('baseHit');
    if (b.hp <= 0) this.destroyBase(team);
  }

  destroyBase(team) {
    const b = this.bases[team];
    b.dead = true;
    this.over = true;
    for (const u of this.units) if (u.tower && u.team === team) { u.obj.visible = false; u.hideModel = true; }
    this.winner = 1 - team;
    const cols = team === 0 ? [0x8d8f93, 0x6b2a24, 0x7a7c80] : [0xb8bcc2, 0x4fa8e0, 0x9ea2a8];
    for (let k = 0; k < 6; k++) this.burst({ x: b.x + (Math.random() - 0.5) * 8, z: (Math.random() - 0.5) * 10 }, 20, cols, 7, 2.2, 6);
    this.emit('baseDestroyed', team);
  }

  // ---------------- AI ----------------
  /** AI Barracks: occasionally picks an upgrade goal and saves gold for it (max ~30s), weighted by usefulness. */
  aiPickUpgrade(T) {
    const myUnits = this.units.filter((u) => u.team === T.team && !u.dead && !u.tower);
    const b = this.bases[T.team];
    const opts = upgradesFor(T.faction).map((U) => {
      const lvl = this.upLevel(T.team, U.id);
      if (lvl >= this.upgradeMax(T.team, U)) return null;
      const price = upgradePrice(U, lvl);
      let w = 1;
      if (U.unit) w = 0.4 + myUnits.filter((u) => u.def.id === U.unit).length * 0.6;
      const P = T.persona || {};
      if (U.id === 'finance') w = (lvl === 0 ? 4 : 0.3) * (0.5 + (P.greed ?? 0.5) * 1.5);   // greedy AIs love economy
      if (U.id === 'reinforce') w = (1 - b.hp / b.maxHp) * 6;
      if (U.effects?.[0]?.type === 'towers') w = 1.5;
      const grow = U.effects?.[0]?.type === 'baseLevel';
      if (grow) w = (5 + (1 - b.hp / b.maxHp) * 8) * (0.7 + (P.caution ?? 0.5) * 0.6);   // growing the base is a priority, more so when it's hurt
      w /= 1 + price / (grow ? 1200 : 300);          // prefer cheaper steps (base levels are pricey by design)
      return w > 0 ? { U, w } : null;
    }).filter(Boolean);
    if (!opts.length) return null;
    let r = Math.random() * opts.reduce((a, o) => a + o.w, 0);
    for (const o of opts) { r -= o.w; if (r <= 0) return o.U.id; }
    return opts[0].U.id;
  }
  aiResearch(T, think) {
    if (T.research) return;
    // grow the base on a schedule (~45s per current level), on top of the random upgrade picks
    const grow = upgradesFor(T.faction).find((U) => U.effects?.some((e) => e.type === 'baseLevel'));
    const L = this.bases[T.team].level;
    if (grow && T.aiGoal !== grow.id && this.time > 45 * L && this.upLevel(T.team, grow.id) < this.upgradeMax(T.team, grow)) { T.aiGoal = grow.id; T.aiGoalT = 0; }
    if (!T.aiGoal) {
      if (Math.random() < this.diff.researchRate * 0.25) { T.aiGoal = this.aiPickUpgrade(T); T.aiGoalT = 0; }
      return;
    }
    const U = UPGRADES[T.aiGoal];
    T.aiGoalT += think;
    if (T.gold >= upgradePrice(U, this.pendingLevel(T.team, U.id))) { this.research(T.team, U.id); T.aiGoal = null; }
    else if (T.aiGoalT > (U.effects?.[0]?.type === 'baseLevel' ? 90 : 30)) T.aiGoal = null;   // base levels are worth saving up for
  }
  /** True while the AI is saving for an upgrade and buying this troop would break the plan. */
  aiSaving(T, unitCost) {
    // saving up for a building (aiBuild): hold troop purchases unless the base is threatened
    if (T.aiBuildGoal && !this.units.some((u) => u.team !== T.team && !u.dead && Math.abs(u.pos.x - this.bases[T.team].x) < 25) && T.gold - unitCost < UNITS[T.aiBuildGoal].cost) return true;
    if (!T.aiGoal) return false;
    const U = UPGRADES[T.aiGoal];
    const threat = this.units.some((u) => u.team !== T.team && !u.dead && Math.abs(u.pos.x - this.bases[T.team].x) < 25);
    // under attack: spend on troops — unless saving for a base level with a few defenders already up
    if (threat && !(U.effects?.[0]?.type === 'baseLevel' && this.pop(T.team) >= 3)) return false;
    return T.gold - unitCost < upgradePrice(U, this.upLevel(T.team, U.id));
  }

  aiRepair(T, P = T.persona) {
    const B = this.bases[T.team], f = B.hp / B.maxHp;
    if (!T.repairOn && f < 0.5 + (P?.caution || 0.3) * 0.35 && T.gold > 40) T.repairOn = true;
    else if (T.repairOn && (f > 0.95 || T.gold < 15)) T.repairOn = false;
  }

  // ---------- personality ----------
  /** Roll an AI personality for this match: a base archetype + random jitter on every trait. Low levels play sloppier. */
  rollPersona() {
    const ids = Object.keys(AI_PERSONALITIES);
    const id = ids[Math.floor(Math.random() * ids.length)], P = AI_PERSONALITIES[id];
    const j = (v) => Math.max(0, Math.min(1, v + (Math.random() - 0.5) * 0.3));
    return { id, name: P.name, greed: j(P.greed), aggro: j(P.aggro), caution: j(P.caution), smart: j(P.smart), chaos: !!P.chaos,
      sloppy: Math.max(0, Math.min(1, (this.diff.sloppy ?? 0.3) + (Math.random() - 0.5) * 0.2)) };
  }
  /** Rough fighting strength of a group: HP x damage per second (enough to compare two sides). */
  power(list) { return list.reduce((a, u) => a + u.hp * Math.max(1, u.effDamage) * u.effAttackSpeed / 60, 0); }
  /** Visible enemy troops (not neutrals) of team T within r of point p. */
  foesNear(T, p, r) {
    return this.units.filter((u) => !u.dead && !u.tower && u.team !== T.team && u.team !== NEUTRAL_TEAM && this.canSee(T.team, u) && Math.hypot(u.pos.x - p.x, u.pos.z - p.z) < r);
  }
  center(list) { const n = list.length || 1; return { x: list.reduce((a, u) => a + u.pos.x, 0) / n, z: list.reduce((a, u) => a + u.pos.z, 0) / n }; }

  updateAI(T, dt) {
    T.aiT -= dt;
    if (T.aiT > 0) return;
    T.persona ||= this.rollPersona();
    const P = T.persona;
    T.aiT = this.diff.thinkEvery * (0.7 + Math.random() * 0.6) * (1 + P.sloppy * 0.5);
    if (Math.random() < this.diff.hesitate) return;
    // Wildcard: changes its mind about who it is every ~minute
    if (P.chaos && this.time - (T.personaT || 0) > 50 + Math.random() * 30) {
      T.personaT = this.time;
      for (const k of ['greed', 'aggro', 'caution', 'smart']) P[k] = Math.random();
    }
    const roster = FACTIONS[T.faction].units.map((id) => UNITS[id]);
    const melees = roster.filter((d) => d.type === 'melee').sort((a, b) => a.cost - b.cost);
    const rangeds = roster.filter((d) => d.type === 'ranged').sort((a, b) => a.cost - b.cost);
    const mine = [...this.units.filter((u) => u.team === T.team && !u.dead && !u.tower).map((u) => u.def), ...T.queue.map((id) => UNITS[id])];
    const nM = mine.filter((d) => d.type === 'melee').length, nR = mine.length - nM;
    // smart AIs counter what they see: lots of enemy melee -> more ranged behind a wall; lots of ranged -> more bodies
    const seen = this.units.filter((u) => !u.dead && !u.tower && u.team !== T.team && u.team !== NEUTRAL_TEAM && this.canSee(T.team, u));
    const eR = seen.filter((u) => u.ranged).length, eM = seen.length - eR;
    let rangedShare = 1 / 3;
    if (P.smart > 0.6 && seen.length >= 3) rangedShare = eM > eR * 2 ? 0.5 : eR > eM ? 0.25 : rangedShare;
    const specialist = 0.15 + P.aggro * 0.15 + (P.chaos ? 0.3 : 0);
    const pickOf = (list) => list.length > 1 && Math.random() < specialist ? list[1 + Math.floor(Math.random() * (list.length - 1))] : list[0];
    const ranged = pickOf(rangeds), melee = pickOf(melees);
    // sloppy: sometimes just buys whatever
    if (!T.aiNext && Math.random() < P.sloppy * 0.15) T.aiNext = roster[Math.floor(Math.random() * roster.length)].id;
    T.aiNext ||= (ranged && nM >= 2 && nR < (nM + nR) * rangedShare ? ranged : melee).id;
    this.aiResearch(T, this.diff.thinkEvery);
    this.aiBuild(T);
    this.aiUpgradeBuildings(T);
    for (const id of FACTIONS[T.faction].units) {   // evolutions are free: take one as soon as it unlocks
      const opts = Object.keys(SKILL_TREES[id] || {}).filter((f) => !this.formBlock(T.team, id, f));
      if (opts.length) this.pickForm(T.team, id, opts[Math.floor(Math.random() * opts.length)]);
    }
    if (Math.random() > P.sloppy * 0.4) this.aiRepair(T, P);   // sloppy AIs forget to repair now and then
    const uc = this.unitCost(T.team, T.aiNext);
    if (T.gold >= uc && T.queue.length < 2 && !this.aiSaving(T, uc) && !this.train(T.team, T.aiNext)) T.aiNext = null;

    // ---- army ----
    const base = this.bases[T.team];
    const threats = this.units.filter((u) => u.team !== T.team && u.team !== NEUTRAL_TEAM && !u.dead && !u.tower && Math.abs(u.pos.x - base.x) < 25 && this.canSee(T.team, u));
    const threat = threats.length > 0;
    // wave size: aggressive AIs go early with small groups, cautious ones wait for a big push
    const W = this.diff.waveSize > 1 ? Math.max(3, Math.round(this.diff.waveSize + P.caution * 2 - P.aggro * 2)) : 1;
    T.waveNow = W;
    const home = this.units.filter((u) => u.team === T.team && !u.dead && u.order.type === 'idle' && u._waiting);
    if (this.diff.waveSize > 1 && (home.length >= W || (threat && home.length))) home.forEach((u) => { u._waiting = false; u.command({ type: 'charge' }); });
    // sloppy: a lone troop wanders off early
    if (home.length && Math.random() < P.sloppy * 0.05) { const u = home[0]; u._waiting = false; u.command({ type: 'charge' }); }
    this.aiFights(T, P);
    this.aiJungle(T, threat, P);
  }

  /**
   * Reading fights (scaled by `smart`): fall back when a push is badly outnumbered, regroup, and push again;
   * focus wounded enemies in range.
   */
  aiFights(T, P) {
    if (P.smart < 0.35 || this.time - (T.fightT || 0) < 1.5) return;
    T.fightT = this.time;
    const army = this.units.filter((u) => u.team === T.team && !u.dead && !u.tower && !u._jungle && !u._waiting && (u.order.type === 'charge' || u.order.type === 'attackMove'));
    if (!army.length) return;
    const base = this.bases[T.team], dir = T.team === 0 ? 1 : -1;
    const c = this.center(army);
    const foes = this.foesNear(T, c, 14);
    if (foes.length) {
      const ours = this.power(army.filter((u) => Math.hypot(u.pos.x - c.x, u.pos.z - c.z) < 14)), theirs = this.power(foes);
      const far = Math.abs(c.x - base.x) > 30;            // only retreat from forward fights (at home: hold the line)
      if (far && theirs > ours * (1.4 + (1 - P.caution) * 0.8 + P.aggro * 0.6) && Math.random() < P.smart) {
        for (const u of army) { u._waiting = true; u.command({ type: 'move', point: { x: base.x + dir * (GAME.baseHalfX + 4 + Math.random() * 3), z: (Math.random() - 0.5) * 8 } }); u._regroup = true; }
        this.emit('aiRetreat', T.team);
        return;
      }
      // focus fire: ranged troops pick the most wounded enemy they can reach
      if (P.smart > 0.6) for (const u of army) if (u.ranged && Math.random() < 0.5) {
        const inR = foes.filter((f) => u.edgeDist(f) <= u.effRange);
        if (inR.length > 1) { inR.sort((a, b) => a.hp / a.maxHp - b.hp / b.maxHp); u.target = inR[0]; u.retarget = 1; }
      }
    }
  }

  /**
   * Jungling (scaled by `greed`): troops waiting at home clear a camp, grab drops and walk back.
   * They now REACT to invaders: fight if they're stronger, run home if not (smart AIs also send help),
   * and an aggressive AI sometimes invades your camps instead of farming its own.
   */
  aiJungle(T, threat, P = T.persona) {
    const mine = this.units.filter((u) => u.team === T.team && !u.dead && !u.tower && !u.brainwashed);
    const dir = T.team === 0 ? 1 : -1;
    const rally = { x: this.bases[T.team].x + dir * (GAME.baseHalfX + 3), z: 0 };
    const campAlive = (c) => this.units.filter((n) => !n.dead && n.team === NEUTRAL_TEAM && n.camp === c);
    // enemy troops on OUR half of the map: the troops waiting at home stay home to guard the base
    const bx = this.bases[T.team].x;
    const pushing = this.units.some((u) => u.team !== T.team && u.team !== NEUTRAL_TEAM && !u.dead && !u.tower && Math.abs(u.pos.x - bx) < 50 && Math.abs(u.pos.z) < GAME.laneHalfWidth + 2 && this.canSee(T.team, u));
    const spareHome = () => { const h = mine.filter((u) => u._waiting && u.order.type === 'idle'); return pushing ? [] : h; };
    const goHome = (u) => { u._jungle = null; u._homing = true; u.command({ type: 'move', point: { x: rally.x + (Math.random() - 0.5) * 2, z: (Math.random() - 0.5) * 6 } }); };
    // ---- crews out in the jungle: check for invaders first ----
    const crews = {};
    for (const u of mine) if (u._jungle) (crews[u._jungle] ||= []).push(u);
    for (const [cid, crew] of Object.entries(crews)) {
      const c = CAMPS.find((k) => k.id === cid);
      const cc = this.center(crew);
      const foes = this.foesNear(T, cc, 13);
      if (threat && P.caution > 0.3) { crew.forEach((u) => { u._jungle = null; u.command({ type: 'charge' }); }); continue; }   // base first
      if (foes.length) {
        const ours = this.power(crew), theirs = this.power(foes);
        const brave = 0.8 + P.aggro * 0.8 - P.caution * 0.4;                       // how much stronger they may be before we run
        if (ours * brave >= theirs || Math.random() < P.sloppy * 0.3) {            // fight the invaders (sloppy: sometimes a bad fight)
          for (const u of crew) {
            const tgt = foes.slice().sort((a, b) => Math.hypot(a.pos.x - u.pos.x, a.pos.z - u.pos.z) - Math.hypot(b.pos.x - u.pos.x, b.pos.z - u.pos.z))[0];
            if (u.order.type !== 'attack' || u.order.target?.team === NEUTRAL_TEAM || u.order.target?.dead) u.command({ type: 'attack', target: tgt });
          }
        } else crew.forEach(goHome);
        // smart / cautious AIs send the troops waiting at home to help
        if ((P.smart + P.caution) / 2 > 0.45 && this.time - (T.helpT || 0) > 8) {
          const helpers = spareHome();
          if (helpers.length) { T.helpT = this.time; helpers.forEach((u) => { u._waiting = false; u.command({ type: 'attackMove', point: { x: cc.x, z: cc.z } }); }); this.emit('aiHelp', T.team, c); }
        }
        continue;
      }
      // no invaders: keep clearing the camp
      for (const u of crew) {
        if (u.order.type === 'attack' && u.order.target && !u.order.target.dead && u.order.target.team !== NEUTRAL_TEAM) u.command({ type: 'idle' });   // invaders gone/out of sight
        const alive = campAlive(c);
        if (alive.length) {
          if (u.order.type !== 'attack' || u.order.target?.dead) {
            alive.sort((a, b) => Math.hypot(a.pos.x - u.pos.x, a.pos.z - u.pos.z) - Math.hypot(b.pos.x - u.pos.x, b.pos.z - u.pos.z));
            u.command({ type: 'attack', target: alive[0] });
          }
          continue;
        }
        if (u.order.type === 'pickup') continue;
        const L = u.items.includes(null) && this.loot.find((l) => !l.taken && Math.hypot(l.x - c.x, l.z - c.z) < 9 && !mine.some((o) => o.order.type === 'pickup' && o.order.loot === l));
        if (L) { u.command({ type: 'pickup', loot: L }); continue; }
        goHome(u);
      }
    }
    for (const u of mine) if (!u._jungle && u._homing && u.order.type === 'idle') { u._homing = false; u._waiting = this.diff.waveSize > 1; if (!u._waiting) u.command({ type: 'charge' }); }
    for (const u of mine) if (u._regroup && u.order.type === 'idle') u._regroup = false;   // back home after a retreat: waits for the next wave

    // ---- defend our camps from enemy junglers (cautious/smart AIs) ----
    if (!threat && this.time - (T.defendT || 0) > 12) {
      const ownCamps = CAMPS.filter((c) => c.side === T.faction);
      for (const c of ownCamps) {
        const inv = this.foesNear(T, c, 11);
        if (!inv.length || Math.random() > (P.caution + P.smart) / 2) continue;
        const helpers = spareHome();
        if (helpers.length && this.power(helpers) > this.power(inv) * 0.8) {
          T.defendT = this.time;
          helpers.forEach((u) => { u._waiting = false; u.command({ type: 'attackMove', point: { x: c.x, z: c.z } }); });
          this.emit('aiDefendCamp', T.team, c);
        }
        break;
      }
    }

    // ---- start a new jungle trip ----
    const every = 32 - P.greed * 22;                                    // greedy AIs farm a lot more often
    if (threat || this.time - (T.jungleT ?? -999) < every) return;
    T.jungleT = this.time;
    if (Math.random() > 0.3 + P.greed * 0.6) return;
    if (pushing) return;
    const waiting = mine.filter((u) => u._waiting && u.order.type === 'idle');
    const crew = waiting.length >= 2 ? waiting : (this.diff.waveSize <= 1 ? mine.filter((u) => !u._jungle && !u._homing && Math.abs(u.pos.x - this.bases[T.team].x) < 18).slice(0, 2) : []);
    if (crew.length < 2) return;
    // aggressive: sometimes invade the enemy's camps instead (steal farm, pick fights)
    const invade = P.aggro > 0.55 && Math.random() < P.aggro * 0.45;
    const camps = CAMPS.filter((c) => (invade ? c.side !== T.faction : c.side === T.faction) && campAlive(c).length);
    if (!camps.length) return;
    // smart: closest camp; others: random
    const c = P.smart > 0.6 ? camps.slice().sort((a, b) => Math.abs(a.x - bx) + Math.abs(a.z) * 0.5 - (Math.abs(b.x - bx) + Math.abs(b.z) * 0.5))[0] : camps[Math.floor(Math.random() * camps.length)];
    crew.forEach((u) => { u._waiting = false; u._jungle = c.id; u.command({ type: 'idle' }); });
    this.emit('aiJungle', T.team, c);
  }

  // ---------------- FX ----------------
  burst(p, n, colors, speed = 3, life = 1, size = 1) {
    if (!this.seenByViewer(p)) return;   // no free intel through the fog
    for (let i = 0; i < n; i++) {
      const s = (0.12 + Math.random() * 0.14) * size;
      const m = new THREE.Mesh(boxGeo(1, 1, 1), sharedMat(colors[i % colors.length]));
      m.scale.setScalar(s);
      m.position.set(p.x, 0.8 + Math.random() * 0.8, p.z);
      this.scene.add(m);
      this.particles.push({
        m, s, life, max: life,
        v: new THREE.Vector3((Math.random() - 0.5) * speed, Math.random() * speed * 0.9 + 1, (Math.random() - 0.5) * speed),
        spin: new THREE.Vector3(Math.random() * 8, Math.random() * 8, 0),
      });
    }
  }

  /**
   * Chain Lightning: hit `first` now, then every def.bounceDelay seconds jump to a random enemy within def.jump of the
   * last one (no repeats), up to def.targets. Each jump draws a crackling tether between the two troops.
   */
  chainLightning(src, first, def) {
    const c = { src, def, team: src.team, hit: [first], cur: first, t: 0 };
    this.zap(c, first);
    this.tether(src, first, def.bounceDelay || 0.3);
    if (this.audible(first.pos.x)) sfx('zap', 60);
    (this.chains ||= []).push(c);
  }
  zap(c, t) {
    const dmg = t.takeDamage(c.def.damage, c.src.dead ? null : c.src, c.def.damageType || 'magic');
    if (!c.src.dead) c.src.damageDealt += dmg;
    if (dmg > 0) this.emit('hitDmg', t.pos, dmg, false, c.team);
    this.burst(t.pos, 4, [0x9ad8ff, 0xffffff], 2, 0.3, 0.7);
  }
  updateChains(dt) {
    if (!this.chains?.length) return;
    for (let i = this.chains.length - 1; i >= 0; i--) {
      const c = this.chains[i];
      c.t += dt;
      if (c.t < (c.def.bounceDelay || 0.3)) continue;
      c.t = 0;
      const foe = (o) => !o.dead && !o.tower && o.team !== c.team && (o.team !== NEUTRAL_TEAM || c.src.dead || c.src.isFoe(o));
      const near = c.hit.length >= c.def.targets ? [] : this.units.filter((o) => !c.hit.includes(o) && foe(o) && Math.hypot(o.pos.x - c.cur.pos.x, o.pos.z - c.cur.pos.z) - o.radius <= c.def.jump);
      if (!near.length) { this.chains.splice(i, 1); continue; }
      const nxt = near[Math.floor(Math.random() * near.length)];
      this.tether(c.cur, nxt, (c.def.bounceDelay || 0.3) + 0.05);
      this.zap(c, nxt);
      if (this.audible(nxt.pos.x)) sfx('zap', 60);
      c.hit.push(nxt); c.cur = nxt;
    }
  }
  /** A crackling lightning tether that follows two units (re-jagged every frame) and fades out. */
  tether(a, b, life) {
    const mats = [0x6fe3ff, 0xffffff].map((c) => new THREE.LineBasicMaterial({ color: c, transparent: true, depthWrite: false }));
    const g = new THREE.Group();
    const lines = mats.map((m) => { const l = new THREE.Line(new THREE.BufferGeometry().setFromPoints(Array.from({ length: 8 }, () => new THREE.Vector3())), m); l.frustumCulled = false; g.add(l); return l; });
    this.scene.add(g);
    (this.tethers ||= []).push({ a, b, g, lines, t: 0, life });
  }
  updateTethers(dt) {
    if (!this.tethers?.length) return;
    for (let i = this.tethers.length - 1; i >= 0; i--) {
      const T = this.tethers[i];
      T.t += dt;
      if (T.t >= T.life) { this.scene.remove(T.g); T.lines.forEach((l) => { l.geometry.dispose(); l.material.dispose(); }); this.tethers.splice(i, 1); continue; }
      const A = T.a.pos, B = T.b.pos, ya = 1.2 + (A.y || 0), yb = 1.2 + (B.y || 0);
      T.g.visible = this.seenByViewer(A) || this.seenByViewer(B);
      const f = 1 - T.t / T.life;
      T.lines.forEach((l, k) => {
        const pos = l.geometry.attributes.position, n = pos.count;
        for (let j = 0; j < n; j++) {
          const u = j / (n - 1), jit = j === 0 || j === n - 1 ? 0 : (k ? 0.18 : 0.38);
          pos.setXYZ(j, A.x + (B.x - A.x) * u + (Math.random() - 0.5) * jit, ya + (yb - ya) * u + (Math.random() - 0.5) * jit, A.z + (B.z - A.z) * u + (Math.random() - 0.5) * jit);
        }
        pos.needsUpdate = true;
        l.material.opacity = f;
      });
    }
  }

  /** Expanding shockwave ring on the ground (Enforce / Mediator). */
  ring(p, r, color) {
    const m = new THREE.Mesh(new THREE.RingGeometry(0.85, 1, 48, 1), new THREE.MeshBasicMaterial({ color, transparent: true, depthWrite: false, side: THREE.DoubleSide }));
    m.rotation.x = -Math.PI / 2; m.position.set(p.x, 0.1 + (this.terrain?.heightAt(p.x, p.z) || 0), p.z);
    m.visible = this.seenByViewer({ x: p.x, z: p.z, pos: p });
    this.scene.add(m);
    this.markers.push({ m, t: 0, wave: r });
  }
  marker(point, color) {
    const m = new THREE.Mesh(new THREE.RingGeometry(0.5, 0.7, 4, 1), new THREE.MeshBasicMaterial({ color, transparent: true, depthWrite: false }));
    m.rotation.x = -Math.PI / 2; m.rotation.z = Math.PI / 4;
    m.position.set(point.x, 0.08, point.z);
    this.scene.add(m);
    this.markers.push({ m, t: 0 });
  }

  // ---------------- main tick ----------------
  update(dt, camQuat) {
    this.time += this.over ? 0 : dt;

    if (!this.over) {
      for (const T of this.teams) {
        T.gold += T.income * dt;
        // base repair toggle: heal for gold, only drains while the base is damaged
        const B = this.bases[T.team];
        if (T.repairOn && B.hp < B.maxHp && !B.dead) {
          const r = this.repairRates(T.team);
          if (T.gold >= r.drain * dt) { T.gold -= r.drain * dt; B.hp = Math.min(B.maxHp, B.hp + r.heal * dt); T.stats.repaired = (T.stats.repaired || 0) + r.heal * dt; }
          else { T.repairOn = false; this.emit('repair', T.team, false, 'gold'); }
        }
        if (T.queue.length) {
          const def = UNITS[T.queue[0]];
          T.trainT += dt;
          if (T.trainT >= def.trainTime * this.speedMult(T.team)) {
            T.trainT = 0;
            const u = this.spawn(T.team, T.queue.shift());
            u.paid = T.queuePaid.shift() ?? u.def.cost;
            if (T.isAI && this.diff.waveSize > 1) { u._waiting = true; u.command({ type: 'idle' }); }
          }
        } else T.trainT = 0;
        if (T.research) {
          T.research.t += dt;
          if (T.research.t >= T.research.total) {
            const id = T.research.id; T.research = null; this.applyUpgrade(T.team, id);
            if (T.rqueue.length) this.startResearch(T.team, T.rqueue.shift());
          }
        }
        if (T.isAI) this.updateAI(T, dt);
      }
    } else this.overT += dt;

    for (let i = this.units.length - 1; i >= 0; i--) {
      const u = this.units[i];
      const remove = u.update(dt, camQuat);
      if (u.dead && remove) { u.dispose(); this.units.splice(i, 1); }
    }

    // base shake + collapse
    for (const b of this.bases) {
      if (b.shake > 0) {
        b.shake -= dt;
        b.obj.position.x = b.x + (Math.random() - 0.5) * 0.25 * (b.shake / 0.18);
      } else b.obj.position.x = b.x;
      if (b.dead) {
        b.obj.position.y = Math.max(-14, b.obj.position.y - dt * 4);
        b.obj.rotation.z = Math.sin(this.overT * 30) * 0.01;
      }
    }

    this.updateProjectiles(dt);
    this.updateSkillshots(dt);
    this.updateShells(dt);
    this.updateFires(dt);
    this.updateBeams(dt);
    this.updateTrails(dt);
    this.updateChains(dt);
    this.updateTethers(dt);
    if (!this.over) { if (!this.sandbox) this.updateCamps(); this.updateLoot(dt); }
    this.vision?.update(dt);
    this.applyFog();
    for (let i = this.particles.length - 1; i >= 0; i--) {
      const p = this.particles[i];
      p.life -= dt;
      p.v.y -= 14 * dt;
      p.m.position.addScaledVector(p.v, dt);
      if (p.m.position.y < 0.08) { p.m.position.y = 0.08; p.v.y *= -0.3; p.v.x *= 0.6; p.v.z *= 0.6; }
      p.m.rotation.x += p.spin.x * dt; p.m.rotation.y += p.spin.y * dt;
      p.m.scale.setScalar(p.s * Math.max(0, p.life / p.max));
      if (p.life <= 0) { this.scene.remove(p.m); this.particles.splice(i, 1); }
    }
    for (let i = this.decals.length - 1; i >= 0; i--) {
      const d = this.decals[i];
      d.t += dt;
      const f = Math.max(0, 1 - Math.max(0, d.t - d.life * 0.5) / (d.life * 0.5));
      d.g.children.forEach((m) => (m.material.opacity = f));
      if (d.t > d.life) { this.scene.remove(d.g); d.g.children.forEach((m) => { m.material.dispose(); if (d.lines) m.geometry.dispose(); }); this.decals.splice(i, 1); }
    }
    for (let i = this.markers.length - 1; i >= 0; i--) {
      const k = this.markers[i];
      k.t += dt;
      if (k.wave) k.m.scale.setScalar(Math.max(0.1, k.wave * Math.min(1, k.t / 0.35)));
      else k.m.scale.setScalar(1.4 - k.t * 1.5);
      k.m.material.opacity = 1 - k.t / 0.6;
      if (k.t > 0.6) { this.scene.remove(k.m); k.m.geometry.dispose(); k.m.material.dispose(); this.markers.splice(i, 1); }
    }
  }

  dispose() {
    this.units.forEach((u) => u.dispose());
    this.particles.forEach((p) => this.scene.remove(p.m));
    this.decals.forEach((d) => this.scene.remove(d.g)); this.decals = [];
    this.loot.forEach((L) => this.scene.remove(L.mesh)); this.loot = [];
    this.markers.forEach((k) => this.scene.remove(k.m));
    this.projectiles.forEach((p) => this.scene.remove(p.mesh));
    this.shells.forEach((p) => { this.scene.remove(p.mesh); if (p.marker) this.scene.remove(p.marker); }); this.shells = [];
    this.fires.forEach((F) => this.scene.remove(F.mesh)); this.fires = [];
    this.beams.forEach((b) => this.scene.remove(b.mesh)); this.beams = [];
    (this.tethers || []).forEach((T) => this.scene.remove(T.g)); this.tethers = []; this.chains = [];
    this.units = []; this.particles = []; this.markers = []; this.projectiles = [];
    this.bases.forEach((b, t) => {
      const orig = this.baseOrig[t];
      if (b.obj !== orig) {
        b.obj.parent?.remove(b.obj);
        if (!orig.parent) this.scene.add(orig);
        if (this.world?.castle === b.obj || this.world?.hq === b.obj) this.world.setBaseModel?.(t, orig);
        b.obj = orig;
      }
      b.obj.position.set(b.x, 0, 0); b.obj.rotation.set(0, 0, 0);
    });
  }
}
