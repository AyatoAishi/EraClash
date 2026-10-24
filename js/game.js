// Match state: economy, training queues, AI, combat bookkeeping, particles, win/lose.
import * as THREE from 'three';
import { GAME, FACTIONS, UNITS, DIFFICULTY, defenseMult, baseLevelStats, BASE_LEVELS } from './config.js';
import { Unit } from './unit.js';
import { UPGRADES, STAT_BOOST, upgradePrice, upgradeTime, upgradesFor } from './upgrades.js';
import { ABILITIES, ITEMS } from './config.js';
import { NEUTRAL_TEAM, CAMP_RULES, CAMPS, CREEP_GROUPS, dropChanceForTier, creepTierOf } from './neutrals.js';
import { boxGeo, sharedMat, buildArrow, buildBullet, buildWisp, buildLoot, buildCastle, buildHQ } from './models.js';
import { sfx } from './audio.js';
import { SKILL_TREES, levelInfo, formDef } from './skilltree.js';
import { Vision } from './vision.js';

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
    this.diff = DIFFICULTY[difficulty];
    this.diffId = difficulty;
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
      income: GAME.incomePerSec * (this.isAI(t) ? this.diff.incomeMult : 1),
      queue: [],
      queuePaid: [],
      // Barracks (per match)
      upLevels: {},      // upgradeId -> level
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
    this.skillshots = [];  // line projectiles (Arrow Piercer)
    this.teams.forEach((T) => (T.autoLoot = false));
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
    for (const L of this.loot) L.mesh.visible = this.seenByViewer(L);
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

  pop(team) { return this.units.filter((u) => u.team === team && !u.dead && !u.tower && !u.raised).length + this.teams[team].queue.length; }
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
  /** Logistics: multiplier on research & training durations. */
  speedMult(team) {
    if (!this.teams[team]) return 1; const L = this.upLevel(team, 'logistics');
    const cheat = team === this.playerTeam && this.cheat?.hireSpeed ? 1 / this.cheat.hireSpeed : 1;
    return (L ? 1 - UPGRADES.logistics.values.speed[L - 1] : 1) * cheat; }
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
    T.research = { ...e, t: 0, total: upgradeTime(U, e.level - 1) * this.speedMult(team) };
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
    T.troopKills[unitId] = (T.troopKills[unitId] || 0) + 1;
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

  // ---------------- combat callbacks ----------------
  // ---------------- projectiles ----------------
  fireProjectile(src, target) {
    const pdef = src.def.projectile;
    const mesh = pdef.kind === 'arrow' ? buildArrow() : pdef.kind === 'wisp' ? buildWisp() : buildBullet();
    if (pdef.kind === 'sniper') mesh.scale.set(1.4, 1.4, 2.6);
    const f = src.facing;
    const start = new THREE.Vector3(src.pos.x + Math.sin(f) * 0.9, src.muzzleY + (src.yOff || 0) + (src.pos.y || 0), src.pos.z + Math.cos(f) * 0.9);
    mesh.position.copy(start);
    this.scene.add(mesh);
    const end = this.projectileAim(target, src);
    const dist0 = Math.max(0.5, start.distanceTo(end));
    const dmg = src.rollDamage(), crit = src.lastCrit;
    if (crit) mesh.scale.multiplyScalar(1.6);
    this.projectiles.push({ mesh, src, target, start, end, dist0, u: 0, speed: pdef.speed, arc: pdef.arc, kind: pdef.kind, team: src.team, dmg, crit });
    if (this.audible(src.pos.x)) sfx(pdef.kind === 'arrow' ? 'bow' : pdef.kind === 'sniper' ? 'snipe' : 'gun', 35);
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
        o.addSlow(S.slow, S.slowTime);
        S.mult *= 1 - S.falloff;                       // each enemy hit weakens the arrow by 10% of its current value
        this.burst(o.pos, 5, [0x9ad8ff, 0xffffff], 2, 0.4);
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
      return true;
    }
    if (A.id === 'flurry' || A.id === 'suppressiveFire') {
      const a = u.ability(A.id);
      a.st.buffT = A.duration;
      if (this.audible(u.pos.x)) sfx(A.id === 'flurry' ? 'bow' : 'gun', 40);
      this.burst(u.pos, 8, A.id === 'flurry' ? [0x9ad87a, 0xffffff] : [0xffd040, 0xff7a2e], 2, 0.5, 0.8);
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

  /** Splatter damage + slow (scales with Organic Matter). Used by the active and by Death Splatter. */
  splatterBlast(u, A) {
    const om = UPGRADES.organicMatter, lvl = this.upLevel(u.team, 'organicMatter');
    const dmg = A.damage + (lvl ? om.values.damage[lvl - 1] : 0);
    const hits = this.enemiesInRadius(u, A.radius, A);
    for (const t of hits) {
      const dealt = t.takeDamage(dmg, u, A.damageType);   // abilities can't be evaded
      u.damageDealt += dealt;
      if (lvl) t.addSlow(om.values.slow[lvl - 1], om.values.slowTime);
    }
    for (const b of this.bases) if (b.team !== u.team && this.distToBase(u, b.team) <= A.radius) this.damageBase(b.team, dmg, u, { x: u.pos.x, z: u.pos.z });
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
          const dodge = t.dodgeCheck(p.src);
          if (dodge) { this.onDodge(p.src, t, dodge); this.scene.remove(p.mesh); this.projectiles.splice(i, 1); continue; }
          const dealt = t.takeDamage(p.dmg, p.src, p.src.def.damageType || 'physical', { attack: true, ranged: true });
          p.src.damageDealt += dealt;
          p.src.onAttackLanded(t, dealt, p.dmg, p.crit);
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
    if (killer && !killer.brainwashed && this.teams[killer.team] && killer.team !== u.team) {   // brainwashed killers earn nobody gold
      const T = this.teams[killer.team];
      T.stats.kills++;
      this.addTroopKill(killer.team, killer.def.id);
      // kill bounty: % of what the victim cost (what was paid; camp creeps / free spawns = their listed cost)
      const bounty = Math.round((u.paid ?? u.def.cost) * GAME.bountyPct);
      T.gold += bounty; T.stats.bounty = (T.stats.bounty || 0) + bounty;
      this.emit('bounty', u.pos, bounty, killer.team);
    }
    if (!u._exploded && u.ability('deathSplatter')) {   // Organic Matter max level
      u._exploded = true;
      this.splatterBlast(u, ABILITIES.splatter);
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
    const dmg = raw * defenseMult(b.armor);
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
      if (U.id === 'finance') w = lvl === 0 ? 4 : 0.3;
      if (U.id === 'reinforce') w = (1 - b.hp / b.maxHp) * 6;
      if (U.effects?.[0]?.type === 'towers') w = 1.5;
      const grow = U.effects?.[0]?.type === 'baseLevel';
      if (grow) w = 5 + (1 - b.hp / b.maxHp) * 8;   // growing the base is a priority, more so when it's hurt
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
    if (!T.aiGoal) return false;
    const U = UPGRADES[T.aiGoal];
    const threat = this.units.some((u) => u.team !== T.team && !u.dead && Math.abs(u.pos.x - this.bases[T.team].x) < 25);
    // under attack: spend on troops — unless saving for a base level with a few defenders already up
    if (threat && !(U.effects?.[0]?.type === 'baseLevel' && this.pop(T.team) >= 3)) return false;
    return T.gold - unitCost < upgradePrice(U, this.upLevel(T.team, U.id));
  }

  aiRepair(T) {
    const B = this.bases[T.team], f = B.hp / B.maxHp;
    if (!T.repairOn && f < 0.65 && T.gold > 40) T.repairOn = true;
    else if (T.repairOn && (f > 0.95 || T.gold < 15)) T.repairOn = false;
  }

  updateAI(T, dt) {
    T.aiT -= dt;
    if (T.aiT > 0) return;
    T.aiT = this.diff.thinkEvery * (0.7 + Math.random() * 0.6);
    if (Math.random() < this.diff.hesitate) return;
    const roster = FACTIONS[T.faction].units.map((id) => UNITS[id]);
    const melees = roster.filter((d) => d.type === 'melee').sort((a, b) => a.cost - b.cost);
    const rangeds = roster.filter((d) => d.type === 'ranged').sort((a, b) => a.cost - b.cost);
    const ranged = rangeds.length > 1 && Math.random() < 0.25 ? rangeds[1 + Math.floor(Math.random() * (rangeds.length - 1))] : rangeds[0];
    // mostly the cheap core melee, sometimes a specialist (e.g. Imp)
    const melee = melees.length > 1 && Math.random() < 0.2 ? melees[1 + Math.floor(Math.random() * (melees.length - 1))] : melees[0];
    const mine = [...this.units.filter((u) => u.team === T.team && !u.dead).map((u) => u.def), ...T.queue.map((id) => UNITS[id])];
    const nM = mine.filter((d) => d.type === 'melee').length, nR = mine.length - nM;
    // keep roughly 1 ranged per 2 melee, always open with a melee body in front
    // commit to a pick until it's affordable (otherwise expensive specialists never get saved up for)
    T.aiNext ||= (ranged && nM >= 2 && nR < nM / 2 ? ranged : melee).id;
    this.aiResearch(T, this.diff.thinkEvery);
    for (const id of FACTIONS[T.faction].units) {   // evolutions are free: take one as soon as it unlocks
      const opts = Object.keys(SKILL_TREES[id] || {}).filter((f) => !this.formBlock(T.team, id, f));
      if (opts.length) this.pickForm(T.team, id, opts[Math.floor(Math.random() * opts.length)]);
    }
    this.aiRepair(T);
    const uc = this.unitCost(T.team, T.aiNext);
    if (T.gold >= uc && T.queue.length < 2 && !this.aiSaving(T, uc) && !this.train(T.team, T.aiNext)) T.aiNext = null;

    // AI groups up at home and launches waves (wave size per difficulty) — lets packs/auras work
    const threat = this.units.some((u) => u.team !== T.team && u.team !== NEUTRAL_TEAM && !u.dead && !u.tower && Math.abs(u.pos.x - this.bases[T.team].x) < 25 && this.canSee(T.team, u));
    if (this.diff.waveSize > 1) {
      const home = this.units.filter((u) => u.team === T.team && !u.dead && u.order.type === 'idle' && u._waiting);
      if (home.length >= this.diff.waveSize || (threat && home.length)) home.forEach((u) => { u._waiting = false; u.command({ type: 'charge' }); });
    }
    this.aiJungle(T, threat);
  }

  /**
   * AI jungling: now and then the troops waiting at home go clear a camp on their own side,
   * grab any drop, and walk back. Recalled instantly if the base is threatened.
   */
  aiJungle(T, threat) {
    const mine = this.units.filter((u) => u.team === T.team && !u.dead && !u.tower && !u.brainwashed);
    const dir = T.team === 0 ? 1 : -1;
    const rally = { x: this.bases[T.team].x + dir * (GAME.baseHalfX + 3), z: 0 };
    const campAlive = (c) => this.units.filter((n) => !n.dead && n.team === NEUTRAL_TEAM && n.camp === c);
    for (const u of mine) {
      if (u._jungle) {
        const c = CAMPS.find((k) => k.id === u._jungle);
        if (threat) { u._jungle = null; u.command({ type: 'charge' }); continue; }
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
        u._jungle = null; u._homing = true;
        u.command({ type: 'move', point: { x: rally.x + (Math.random() - 0.5) * 2, z: (Math.random() - 0.5) * 6 } });
      } else if (u._homing && u.order.type === 'idle') { u._homing = false; u._waiting = this.diff.waveSize > 1; if (!u._waiting) u.command({ type: 'charge' }); }
    }
    if (threat || this.time - (T.jungleT ?? -999) < 20) return;
    T.jungleT = this.time;
    if (Math.random() > 0.6) return;                                   // not every chance: keeps it unpredictable
    const waiting = mine.filter((u) => u._waiting && u.order.type === 'idle');
    // easy AI (waveSize 1) never waits at home, so it pulls a couple of fresh troops instead
    const crew = waiting.length >= 2 ? waiting : (this.diff.waveSize <= 1 ? mine.filter((u) => !u._jungle && !u._homing && Math.abs(u.pos.x - this.bases[T.team].x) < 18).slice(0, 2) : []);
    if (crew.length < 2) return;
    const camps = CAMPS.filter((c) => c.side === T.faction && campAlive(c).length);
    if (!camps.length) return;
    const c = camps[Math.floor(Math.random() * camps.length)];
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

  /** Chain Lightning: hit `first`, then jump to a random enemy within def.jump of the last one (no repeats). */
  chainLightning(src, first, def) {
    const hit = [first];
    let cur = first;
    for (;;) {
      const dmg = cur.takeDamage(def.damage, src, def.damageType || 'magic');
      src.damageDealt += dmg;
      if (dmg > 0) this.emit('hitDmg', cur.pos, dmg, false, src.team);
      if (hit.length >= def.targets) break;
      const near = this.units.filter((o) => !hit.includes(o) && src.isFoe(o) && Math.hypot(o.pos.x - cur.pos.x, o.pos.z - cur.pos.z) - o.radius <= def.jump);
      if (!near.length) break;
      const nxt = near[Math.floor(Math.random() * near.length)];
      this.bolt(cur.pos, nxt.pos);
      hit.push(nxt); cur = nxt;
    }
    this.bolt(src.pos, first.pos, true);
    this.burst(first.pos, 4, [0x9ad8ff, 0xffffff], 2, 0.3, 0.7);
    if (this.audible(first.pos.x)) sfx('zap', 60);
  }
  /** A jagged, fading lightning line between two points. */
  bolt(a, b, short = false) {
    if (!this.seenByViewer(a) && !this.seenByViewer(b)) return;
    const pts = [], n = 6, y0 = short ? 1.6 : 1.1;
    for (let i = 0; i <= n; i++) {
      const f = i / n, j = i === 0 || i === n ? 0 : 0.35;
      pts.push(new THREE.Vector3(a.x + (b.x - a.x) * f + (Math.random() - 0.5) * j, y0 + (Math.random() - 0.5) * j, a.z + (b.z - a.z) * f + (Math.random() - 0.5) * j));
    }
    const g = new THREE.Group();
    for (const [c, off] of [[0x6fe3ff, 0], [0xffffff, 0.04]]) {
      const l = new THREE.Line(new THREE.BufferGeometry().setFromPoints(pts.map((p) => p.clone().setY(p.y + off))), new THREE.LineBasicMaterial({ color: c, transparent: true, depthWrite: false }));
      g.add(l);
    }
    this.scene.add(g);
    this.decals.push({ g, t: 0, life: 0.3, lines: true });
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
    this.updateTrails(dt);
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
      k.m.scale.setScalar(1.4 - k.t * 1.5);
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
