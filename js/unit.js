// A single troop: brain (orders/targeting), body (movement/separation), visuals (anim/hp bar/ring).
import * as THREE from 'three';
import { UNITS, GAME, ITEMS, ABILITIES, DAMAGE_TYPES, defenseMult, attackInterval, canAutocast, abilityText } from './config.js';
import { UPGRADES, STAT_BOOST } from './upgrades.js';
import { NEUTRAL_TEAM, CAMP_RULES } from './neutrals.js';
import { UNIT_BUILDERS, buildZzz, applyLook, animateFx, buildMiniDrone } from './models.js';
import { formDef } from './skilltree.js';
import { buildingDef } from './buildtree.js';
import { settings } from './settings.js';

let UID = 0;
const ringGeo = new THREE.RingGeometry(0.72, 0.92, 4, 1);
const barBgMat = new THREE.MeshBasicMaterial({ color: 0x111111, depthWrite: false, depthTest: false });   // HP bars always draw on top of models
const barMats = {};
function barMat(hex) { return barMats[hex] || (barMats[hex] = new THREE.MeshBasicMaterial({ color: hex, depthWrite: false, depthTest: false })); }
const ringMats = {};
function ringMat(hex) { return ringMats[hex] || (ringMats[hex] = new THREE.MeshBasicMaterial({ color: hex, transparent: true, opacity: 0.9, depthWrite: false })); }
const barGeo = new THREE.PlaneGeometry(1, 1);
const UP = new THREE.Vector3(0, 1, 0);
const yawQ = new THREE.Quaternion();
const shieldGeo = new THREE.IcosahedronGeometry(1.35, 0);
const shieldEdges = new THREE.EdgesGeometry(shieldGeo);

export const ORDER_LABEL = {
  charge: 'Charging enemy base',
  move: 'Moving',
  attackMove: 'Attack-moving',
  pickup: 'Picking up item',
  attack: 'Attacking target',
  idle: 'Holding position',
};

const STAT_KEYS = ['hp', 'hpRegen', 'armor', 'ward', 'evasion', 'missChance', 'damage', 'attackSpeed', 'moveSpeed', 'range'];

export class Unit {
  constructor(game, defId, team) {
    this.id = ++UID;
    this.game = game;
    // skill-tree form: same troop id, evolved numbers/name/look (only troops born after the pick)
    this.def = formDef(defId, game.teams?.[team]?.forms?.[defId]);
    this.form = this.def.form || null;
    this.team = team;
    this.ranged = this.def.type === 'ranged';
    this.family = this.def.family;
    this.radius = this.def.radius;
    this.items = new Array(GAME.invSlots).fill(null); // item ids from ITEMS
    this.itemCd = new Array(GAME.invSlots).fill(0);    // per-slot cooldown of item actives (Javelin...)
    this.stats = {};
    this.bonus = {};
    this.recalcStats();
    this.hp = this.stats.hp;
    // abilities: up to 4 slots (passives + actives). Each slot keeps its own state `st`.
    let nAct = 0;
    this.abil = (this.def.abilities || []).filter((id) => ABILITIES[id] && (ABILITIES[id].kind !== 'active' || ++nAct <= GAME.maxActives)).map((id) => ({
      def: this.abilDef(id),
      st: { active: false, stacks: 0, bonusDamage: 0, bonusAS: 0, bonusRegen: 0, bonusEvasion: 0, target: null, sinceAttack: 99, scanT: Math.random() * 0.2, cd: 0 },
    }));
    this.pas = { bonusDamage: 0, bonusAS: 0, bonusRegen: 0, bonusEvasion: 0, bonusArmor: 0, bonusWard: 0, bonusRange: 0, bonusMS: 0, armorPierce: 0, lifesteal: 0 };   // summed passive bonuses
    this.slows = [];                   // [{ pct, t }] movement slows (strongest applies)
    this.flying = !!this.def.flying;   // flying: hovers, ignores obstacles/terrain for movement & sight, melee can't hit it
    this.mana = this.maxMana;   // maxMana / manaRegen come from recalcStats (definition + Robe)
    this.breakT = 0;                   // Break debuff: passives disabled (except unbreakable ones)
    this.stillT = 0;                   // seconds standing still without attacking (Night Meld)
    this.invisible = false; this._lookInvis = false;
    this.syncAbilities();
    this.invulnT = GAME.spawnInvuln;   // spawn protection
    // deployable building (Cannon / Howitzer): never moves, no spawn shield; Game.placeStructure sets buildT / obstacle
    this.structure = this.def.structure || null;
    if (this.structure) { this.invulnT = 0; this.buildT = this.structure.buildTime; this.recoilT = 0; this.bLevel = 1; this.bPath = null; this.upgrading = null; this.shotIdx = 0; }
    this.lastCrit = false;
    this.pos = new THREE.Vector3();
    this.facing = team === 0 ? Math.PI / 2 : -Math.PI / 2;
    this.order = { type: 'charge' };
    this.target = null;
    this.retarget = 0;
    this.atkCd = Math.random() * 0.3;
    this.swing = 0;
    this.pendingHit = null;
    this.aimT = 0;
    this.muzzleT = 0;
    this.walk = 0;
    this.moving = false;
    this.flash = 0;
    this.dead = false;
    this.deathT = 0;
    this.kills = 0;
    this.damageDealt = 0;
    this.selected = false;

    const rig = applyLook(UNIT_BUILDERS[defId](), this.def.look);
    this.rig = rig;
    rig.root.scale.setScalar(1.25 * (rig.scale || 1));
    if (rig.style === 'rifle') { rig.armR.rotation.x = -1.2; rig.armL.rotation.x = -1.35; rig.armL.rotation.z = 0.35; }
    this.obj = new THREE.Group();
    this.obj.add(rig.root);
    this.levelHeld();

    const isFriendly = game.playerTeam === null ? team === 0 : team === game.playerTeam;
    const isNeutral = team === NEUTRAL_TEAM;
    this.ring = new THREE.Mesh(ringGeo, ringMat(isNeutral ? 0xffd040 : isFriendly ? 0x5dff7a : 0xff4a4a));
    this.ring.rotation.x = -Math.PI / 2; this.ring.rotation.z = Math.PI / 4;
    this.ring.position.y = 0.06; this.ring.visible = false; this.ring.renderOrder = 2;
    this.obj.add(this.ring);

    this.bar = new THREE.Group(); this.bar.position.y = (rig.barY || 2.95) * (rig.scale || 1) + 0.2;
    const bg = new THREE.Mesh(barGeo, barBgMat); bg.scale.set(1.04, 0.16, 1); bg.renderOrder = 30;
    const fillColor = isNeutral ? 0xf2c94c : game.playerTeam === null ? (team === 0 ? 0xe0b040 : 0x4aa3ff) : (isFriendly ? 0x45e06a : 0xe84545);
    this.fill = new THREE.Mesh(barGeo, barMat(fillColor)); this.fill.scale.set(1, 0.11, 1);
    this.fill.position.z = 0.001; this.fill.renderOrder = 31;
    this.bar.add(bg, this.fill);
    this.obj.add(this.bar);

    // white spawn shield: low-poly bubble + bright edges (voxel-friendly)
    const sc = rig.scale || 1;
    this.shield = new THREE.Group();
    this.shieldFill = new THREE.Mesh(shieldGeo, new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.22, depthWrite: false }));
    this.shieldEdge = new THREE.LineSegments(shieldEdges, new THREE.LineBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.75 }));
    this.shield.add(this.shieldFill, this.shieldEdge);
    this.shield.position.y = 1.15 * sc;
    this.shield.scale.setScalar(sc);
    this.shield.renderOrder = 5;
    this.obj.add(this.shield);
    this.shieldPing = 0;
    if (isNeutral) { this.zzz = buildZzz(); this.zzz.visible = false; this.obj.add(this.zzz); }
    if (this.structure) { this.shield.visible = false; this.baseFacing = this.facing; }
  }

  // ---------------- stats & inventory ----------------
  /** Base stats from the unit definition + team family upgrades + flat bonuses from carried items. */
  recalcStats() {
    const oldMax = this.stats.hp;
    const bonus = Object.fromEntries(STAT_KEYS.map((k) => [k, 0]));
    const add = (src) => { if (src) for (const k of STAT_KEYS) bonus[k] += src[k] || 0; };
    const T = this.game.teams?.[this.statTeam];
    add(T?.upgrades?.[this.def.family]);
    add(T?.unitMods?.[this.def.id]);     // Barracks stat upgrades
    for (const id of this.items) { add(id && ITEMS[id]?.stats); if (this.ranged) add(id && ITEMS[id]?.rangedStats); }   // Quiver: ranged carriers only
    // mana: only troops that have mana get item mana (Robe)
    const m0 = this.def.mana || 0;
    let mBonus = 0, mrBonus = 0;
    if (m0) for (const id of this.items) { const M = id && ITEMS[id]?.manaStats; if (M) { mBonus += M.mana || 0; mrBonus += M.manaRegen || 0; } }
    const oldMana = this.maxMana;
    this.maxMana = m0 + mBonus; this.manaRegen = (this.def.manaRegen || 0) + mrBonus;
    if (oldMana !== undefined && this.mana !== undefined) this.mana = Math.min(this.maxMana, this.mana + Math.max(0, this.maxMana - oldMana));
    this.bonus = bonus;
    // BASE stats = definition, scaled by Barracks stat boosts (+10% per level). BONUS stats = items, family/flat upgrades, buffs.
    const mult = this.game.statMult ? this.game.statMult(this.statTeam, this.def.id) : 1;
    this.base = {};
    for (const k of STAT_KEYS) this.base[k] = (this.def[k] || 0) * (STAT_BOOST.stats.includes(k) ? mult : 1);
    for (const k of STAT_KEYS) this.stats[k] = this.base[k] + bonus[k];

    if (oldMax && this.hp !== undefined) this.hp = Math.min(this.stats.hp, this.hp * (this.stats.hp / oldMax));
  }
  get maxHp() { return this.stats.hp; }
  /** Team whose upgrades this troop uses (a brainwashed troop keeps its original side's upgrades). */
  get statTeam() { return this.brainwashed ? this.brainwashed.orig : this.raised ? this.raised.orig : this.team; }
  hasItem(id) { return this.items.includes(id); }
  get disarmed() { return this.disarmT > 0; }
  /** Hostile troop for on-hit effects (cleave, splash): neutrals only count once they're fighting you. */
  isFoe(o) {
    if (!o || o.dead || o.tower || o === this || o.team === this.team) return false;
    if (this.team === NEUTRAL_TEAM) return o.team === this.aggroTeam;
    return o.team !== NEUTRAL_TEAM || o.aggroTeam === this.team;
  }
  /** Add abilities granted by Barracks upgrades (respects the 4-slot cap). */
  syncAbilities() {
    const granted = this.game.teams?.[this.team]?.grants?.[this.def.id] || [];
    for (const id of granted) {
      if (this.ability(id)) continue;
      if (ABILITIES[id].kind === 'active' && this.abil.filter((a) => a.def.kind === 'active').length >= GAME.maxActives) continue;
      this.abil.push({ def: this.abilDef(id), st: { active: false, stacks: 0, bonusDamage: 0, bonusAS: 0, bonusRegen: 0, bonusEvasion: 0, target: null, sinceAttack: 99, scanT: 0, cd: 0, buffT: 0 } });
    }
  }
  /** Ability definition with this troop's form overrides (e.g. Chaotic Viking: Fury without a stack cap). */
  abilDef(id) { const m = this.def.abilityMods?.[id]; return m ? { ...ABILITIES[id], ...m } : ABILITIES[id]; }
  upLevel(id) { return this.game.upLevel && this.statTeam !== NEUTRAL_TEAM ? this.game.upLevel(this.statTeam, id) : 0; }
  /** Movement slow (strongest wins). Invulnerable/tower troops ignore crowd control. */
  /** Burning (Fire Archers): true damage every 0.5s for `t` seconds. Strongest burn wins, re-burning refreshes. */
  addBurn(dps, t, src, type = 'true') {
    if (this.dead || this.tower || this.structure || this.invulnerable) return;
    if (!(this.burnT > 0) || dps >= this.burnDps) { this.burnDps = dps; this.burnSrc = src; this.burnType = type; }
    this.burnT = Math.max(this.burnT || 0, t);
  }
  tickBurn(dt) {
    this.burnT -= dt; this.burnTick = (this.burnTick || 0) - dt;
    if (this.burnTick > 0) return;
    this.burnTick = 0.5;
    const d = this.takeDamage(this.burnDps * 0.5, this.burnSrc, this.burnType || 'true');
    if (this.burnSrc && !this.burnSrc.dead) this.burnSrc.damageDealt += d;
    this.game.burst(this.pos, 2, [0xff6a1a, 0xffb040], 1.2, 0.35, 0.5);
  }
  /** Poison (Arcane Coating): magic damage per second (+ % of max HP) for `t` seconds. Strongest wins, re-poison refreshes. */
  addPoison(dps, t, src, pctMaxHp = 0) {
    if (this.dead || this.tower || this.structure || this.invulnerable) return;
    const tot = dps + pctMaxHp * this.maxHp;
    if (!(this.poisonT > 0) || tot >= this.poisonDps) { this.poisonDps = tot; this.poisonSrc = src; }
    this.poisonT = Math.max(this.poisonT || 0, t);
  }
  tickPoison(dt) {
    this.poisonT -= dt; this.poisonTick = (this.poisonTick || 0) - dt;
    if (this.poisonTick > 0) return;
    this.poisonTick = 0.5;
    const d = this.takeDamage(this.poisonDps * 0.5, this.poisonSrc, 'magic');
    if (this.poisonSrc && !this.poisonSrc.dead) this.poisonSrc.damageDealt += d;
    if (Math.random() < 0.5) this.game.burst(this.pos, 2, [0x7ae85a, 0x3a8a2a], 1, 0.3, 0.5);
  }
  /** Silence (Interrupt): can't cast actives; `spellCut` = its ability damage is reduced meanwhile. */
  addSilence(t, spellCut = 0) {
    if (this.dead || this.tower || this.structure || this.invulnerable) return;
    if (!(this.silenceT > 0) || spellCut >= (this.silenceSpell || 0)) this.silenceSpell = spellCut;
    this.silenceT = Math.max(this.silenceT || 0, t);
  }
  /** Timed ward reduction under `key` (Guardian Aura); same rules as addArmorDebuff. */
  addWardDebuff(key, v, t) {
    if (this.dead || this.tower) return;
    const now = this.game.time || 0, D = (this.wardDebuffs ||= {}), cur = D[key];
    D[key] = { v: cur && cur.until > now ? Math.max(cur.v, v) : v, until: now + t };
  }
  get wardDebuff() {
    const D = this.wardDebuffs; if (!D) return 0;
    const now = this.game.time || 0; let v = 0;
    for (const k in D) { if (D[k].until > now) v += D[k].v; else delete D[k]; }
    return v;
  }
  /** Ranged troops hit flying units; melee and ground-only throwers (Catapult) can't. */
  get hitsAir() { return this.ranged && !this.def.groundOnly; }
  addSlow(pct, t) {
    if (this.invulnerable || this.tower || this.structure || this.dead) return;
    this.slows.push({ pct, t });
  }
  /** Push away from a point (crowd control: ignored by invulnerable/tower/prone-immobile? no — prone gets pushed too). */
  knockback(from, dist) {
    if (this.invulnerable || this.tower || this.structure || this.dead) return;
    const dx = this.pos.x - from.x, dz = this.pos.z - from.z, d = Math.hypot(dx, dz) || 1;
    this.kb = { x: dx / d * dist, z: dz / d * dist, t: 0.15 };
  }
  /** Stun: can't move, attack or cast. Fear: runs away from `from`, can't attack or cast. Strongest duration wins. */
  addStun(t) {
    if (this.dead || this.tower || this.structure || this.invulnerable) return;
    this.stunT = Math.max(this.stunT || 0, t); this.pendingHit = null; this.casting = null;
    this.game.emit('cc', this, 'stun');
  }
  addFear(t, from) {
    if (this.dead || this.tower || this.structure || this.invulnerable) return;
    this.fearT = Math.max(this.fearT || 0, t); this.fearFrom = { x: from.x, z: from.z }; this.pendingHit = null; this.casting = null;
    this.game.emit('cc', this, 'fear');
  }
  get ccd() { return this.stunT > 0 || this.fearT > 0; }
  /** Timed armor reduction under `key` (different keys add up; the same key keeps the strongest / refreshes). */
  addArmorDebuff(key, v, t) {
    if (this.dead || this.tower) return;
    const now = this.game.time || 0, D = (this.armorDebuffs ||= {}), cur = D[key];
    D[key] = { v: cur && cur.until > now ? Math.max(cur.v, v) : v, until: now + t };
  }
  /** Rapid Fire: stacking armor reduction; every stack has its own timer (new hits don't refresh old stacks). */
  addRapidShred(per, t) {
    if (this.dead || this.tower) return;
    const now = this.game.time || 0, D = (this.armorDebuffs ||= {});
    const list = (D.rapid?.list || []).filter((u) => u > now); list.push(now + t);
    D.rapid = { list, per: Math.max(per, D.rapid?.per || 0), stacks: list.length, v: Math.round(list.length * per * 100) / 100, until: now + t };
  }
  get armorDebuff() {
    const D = this.armorDebuffs; if (!D) return 0;
    const now = this.game.time || 0; let v = 0;
    for (const k in D) {
      const d = D[k];
      if (d.list) { d.list = d.list.filter((u) => u > now); d.stacks = d.list.length; d.v = Math.round(d.stacks * d.per * 100) / 100; d.until = d.stacks ? Math.max(...d.list) : 0; }
      if (d.until > now) v += d.v; else delete D[k];
    }
    return v;
  }
  get slowPct() { return this.slows.reduce((m, s) => Math.max(m, s.pct), 0); }
  get armor() { return this.stats.armor + this.pas.bonusArmor - (this.shredT > 0 ? this.shred : 0) - this.armorDebuff; }
  get broken() { return this.breakT > 0; }
  /** Break: disables breakable passives for `t` seconds (Dota-style). */
  applyBreak(t) { if (this.invulnerable || this.tower || this.dead) return; this.breakT = Math.max(this.breakT, t); }
  /** Armor reduction debuff (strongest wins, refreshes). */
  applyShred(v, t) { if (this.tower || this.dead) return; if (!(this.shredT > 0) || v >= this.shred) this.shred = v; this.shredT = t; }
  /** Index of the k-th ACTIVE ability in this.abil (hotkeys Q W E R T map to actives in order). */
  activeSlot(k) { let n = -1; for (let i = 0; i < this.abil.length; i++) if (this.abil[i].def.kind === 'active' && ++n === k) return i; return -1; }
  get ward() { return this.stats.ward + this.pas.bonusWard - this.wardDebuff; }
  /** Invulnerable: takes no damage and (future) can't be crowd-controlled. Can still be targeted. */
  get invulnerable() { return this.invulnT > 0; }
  get effRange() { return this.vendettaT > 0 ? this.ability('vendetta').def.range : this.stats.range + (this.pas.bonusRange || 0) + (this.towerRange || 0); }   // Vendetta: fixed close range
  /** Cast range of a unit-targeted active (Assassinate: attack range + bonus). */
  castRangeOf(A) { return A.castRangeBonus != null ? this.effRange + A.castRangeBonus : A.castRange || 0; }
  /** Vendetta: walks through trees, walls and buildings. */
  get phasing() { return this.vendettaT > 0; }
  get rangeRadius() { return this.effRange + this.radius; }
  /** Snipe Stance state: 'stand' | 'channel' | 'prone' (null if the troop has no stance) */
  /**
   * Buffs & debuffs currently on this unit (Dota-style status row). Each: { id, icon, name, kind: 'buff'|'debuff', t?, stacks?, text }.
   * Add a status: push one entry here, reading whatever field the effect already keeps. Nothing else to wire.
   */
  statusList() {
    const now = this.game.time || 0, L = [], f1 = (x) => Math.round(x * 10) / 10;
    const add = (id, icon, name, kind, text, t, stacks) => L.push({ id, icon, name, kind, text, t: t > 0 ? t : null, stacks: stacks > 1 ? stacks : null });
    // ---- debuffs ----
    if (this.stunT > 0) add('stun', 's-stun', 'Stunned', 'debuff', "Can't move, attack or cast.", this.stunT);
    if (this.fearT > 0) add('fear', 's-fear', 'Feared', 'debuff', "Runs away; can't attack or cast.", this.fearT);
    if (this.silenceT > 0) add('silence', 's-silence', 'Silenced', 'debuff', `Can't cast abilities${this.silenceSpell ? `; deals ${Math.round(this.silenceSpell * 100)}% less spell damage` : ''}.`, this.silenceT);
    if (this.disarmT > 0) add('disarm', 's-disarm', 'Disarmed', 'debuff', "Can't attack.", this.disarmT);
    if (this.breakT > 0) add('break', 's-break', 'Broken', 'debuff', 'Passive abilities are disabled.', this.breakT);
    const sl = this.slows.reduce((m, x) => (x.pct > m.pct ? x : m), { pct: 0, t: 0 });
    if (sl.pct > 0) add('slow', 's-slow', 'Slowed', 'debuff', `Moves ${Math.round(sl.pct)}% slower.`, sl.t);
    if (this.burnT > 0) add('burn', 's-burn', 'Burning', 'debuff', `Takes ${f1(this.burnDps)} ${this.burnType || 'true'} damage per second.`, this.burnT);
    if (this.poisonT > 0) add('poison', 's-poison', 'Poisoned', 'debuff', `Takes ${f1(this.poisonDps)} magic damage per second.`, this.poisonT);
    if (this.acidT > 0) add('acid', 's-poison', 'Acid', 'debuff', 'Standing in acid: magic damage that grows every second.', this.acidT);
    void this.armorDebuff;   // prunes expired Rapid Fire stacks
    const ad = this.armorDebuffs ? Object.values(this.armorDebuffs).filter((d) => d.until > now) : [];
    const shred = (this.shredT > 0 ? this.shred : 0) + ad.reduce((v, d) => v + d.v, 0);
    if (shred > 0) add('armor', 's-armor', 'Armor reduced', 'debuff', `-${f1(shred)} armor.`, Math.max(this.shredT || 0, ...ad.map((d) => d.until - now)), ad.find((d) => d.stacks)?.stacks);
    const wd = this.wardDebuff;
    if (wd > 0) add('ward', 's-armor', 'Ward reduced', 'debuff', `-${f1(wd)} ward.`, 0);
    if (this.fury && this.fury.t > 0 && this.fury.stacks) add('fury', 's-expose', 'Exposed', 'debuff', `Takes ${Math.round(this.fury.stacks * this.fury.per * 100)}% more damage from ${UNITS[this.fury.unit]?.name || 'the attacker'}s.`, this.fury.t, this.fury.stacks);
    if (this.weakenUntil > now) add('weaken', 's-weaken', 'Weakened', 'debuff', `Deals ${Math.round(this.weakenPct * 100)}% less damage.`, this.weakenUntil - now);
    if (this.curse && this.curse.t > 0) add('curse', 's-curse', 'Banshee Curse', 'debuff', 'If it dies while cursed, it rises for the Banshee\'s side.', this.curse.t);
    if (this.dkMark && this.dkMark.until > now) add('dkmark', 's-mark', 'Death Mark', 'debuff', `Enemy attackers heal ${this.dkMark.heal} HP per hit on it.`, this.dkMark.until - now);
    if (this.brainwashed) add('brainwash', 'a-brainwash', 'Brainwashed', 'debuff', 'Fights for the other side, then despawns.', this.brainwashed.t);
    if (this.auraDebuff) for (const [id, a] of Object.entries(this.auraDebuff)) add('aurad-' + id, ABILITIES[id]?.icon || 's-armor', ABILITIES[id]?.name || id, 'debuff', a.text, 0);
    // ---- buffs ----
    if (this.invulnT > 0) add('invuln', 's-shield', 'Invulnerable', 'buff', "Can't be damaged.", this.invulnT);
    if (this.invisible) add('invis', 's-invis', 'Invisible', 'buff', 'Enemies can\'t see it.', 0);
    if (this.trueStrikeT > 0) add('truestrike', 's-strike', 'True Strike', 'buff', 'Next attack can\'t miss or be evaded.', this.trueStrikeT);
    if (this.galeUntil > now) add('gale', 'p-gale', 'Galewinds', 'buff', `+${this.galeBonus} move speed.`, this.galeUntil - now);
    if (this.apBuff && this.apBuff.until > now) add('apbuff', 'u-piercer', 'Arrow Piercer', 'buff', `+${this.apBuff.as} attack speed.`, this.apBuff.until - now, this.apBuff.left);
    if (this.curseHasteT > 0) add('cursehaste', 's-aspd', 'Haunting Haste', 'buff', `+${this.curseHaste} attack speed.`, this.curseHasteT);
    if (this.grudgeT > 0) add('grudge', 's-aspd', 'Grudge', 'buff', `+${this.grudgeAS} attack speed.`, this.grudgeT);
    if (this.helmetT > 0) add('helmet', 's-shield', 'Riot Helmet', 'buff', `+${this.helmetArmor} armor.`, this.helmetT);
    if (this.rallyT > 0) add('rally', 's-haste', 'Barding Rally', 'buff', `+${this.rallyBonus} move speed on the trail.`, 0);
    if (this.vendettaT > 0) add('vendetta', 'a-vendetta', 'Vendetta', 'buff', 'Invisible, walks through terrain; the next attack deals a huge bonus.', this.vendettaT);
    if (this.shieldHp > 0 && this.shieldT > 0) add('shieldhp', 's-shield', 'Shield', 'buff', `Absorbs the next ${Math.ceil(this.shieldHp)} damage.`, this.shieldT);
    if (this.breakerStacks?.length) add('breaker', 'p-breaker', 'Ignited', 'buff', `Heals himself and allies within ${this.ability('breaker')?.def.healRadius || 8} range ${this.breakerStacks.length * (this.ability('breaker')?.def.heal || 4)} HP per second.`, Math.max(...this.breakerStacks), this.breakerStacks.length);
    if (this.giveUpHealT > 0) add('regen', 's-regen', 'Regrouping', 'buff', `Heals ${Math.round(CAMP_RULES.giveUpHeal.pct * 100)}% max HP per second.`, this.giveUpHealT);
    for (const { def: A, st } of this.abil) {
      if (st.buffT > 0 && A.kind === 'active') add('ab-' + A.id, A.icon, A.name, 'buff', abilityText(A), st.buffT);
      if (A.id === 'arcaneCoating' && st.on) add('coating', A.icon, 'Coated', 'buff', abilityText(A), 0);
      if (A.id === 'packBonus' && st.stacks > 0) add('pack', A.icon, A.name, 'buff', `+${f1(st.stacks * A.damage)} damage, +${f1(st.stacks * A.armor)} armor, +${f1(st.stacks * A.moveSpeed)} move speed, +${f1(st.stacks * A.as)} attack speed.`, 0, st.stacks);
      if (A.id === 'combust' && !st.broken) add('combust', A.icon, A.name, 'buff', st.cd > 0 ? 'Recharging.' : `${Math.floor(st.acc || 0)} / ${A.threshold} magic damage stored.`, st.cd, 0);
      if (A.id === 'homingMissile' && !st.broken && !(st.cd > 0)) add('missile', A.icon, 'Missile ready', 'buff', `Next attack: +${A.bonusRange} range missile.`, 0);
      if (A.id === 'fervor' && st.stacks > 0) add('fervor', A.icon, A.name, 'buff', `+${f1(st.bonusAS)} attack speed.`, 0, st.stacks);
      if (A.id === 'blueLine' && st.stacks > 0) add('blueline', A.icon, A.name, 'buff', `+${f1(st.bonusDamage)} damage${st.bonusArmor ? `, +${f1(st.bonusArmor)} armor` : ''} from ${st.stacks} nearby officer${st.stacks > 1 ? 's' : ''}.`, 0, st.stacks);
    }
    for (const id of this.auras || []) {
      const A = ABILITIES[id]; if (!A) continue;
      const parts = Object.entries(this.auraBonus ? (A.aura || {}) : {}).filter(([k]) => k !== 'radius').map(([k, v]) => `+${v} ${k.replace('bonus', '').replace('AS', 'attack speed').toLowerCase()}`);
      add('aura-' + id, A.icon, A.name + ' (aura)', 'buff', parts.join(', ') || 'Aura from a nearby ally.', 0);
    }
    return L;
  }
  get stance() { return this.ability('snipeStance')?.st.mode || null; }
  get immobile() { const m = this.stance; return m === 'channel' || m === 'prone' || m === 'standup' || !!this.casting || !!this.leap || this.stunT > 0; }
  get effMoveSpeed() {
    if (this.immobile) return 0;
    const gale = this.galeUntil > (this.game.time || 0) ? this.galeBonus : 0;   // Galewinds
    const ven = this.vendettaT > 0 ? this.ability('vendetta')?.def.moveSpeed || 0 : 0;   // Vendetta
    return (this.stats.moveSpeed + gale + ven + (this.pas.bonusMS || 0)) * (1 - this.slowPct / 100) * (1 + (this.rallyT > 0 ? this.rallyBonus : 0));
  }
  /** Boomstick (Operator / Shotgunner): damage multiplier vs a target at its current distance. */
  boomMult(t) {
    const b = this.ability('boomstick'); if (!b || b.st.broken || !t || t.isBase) return 1;
    const A = b.def, d = Math.max(0, this.edgeDist(t));
    if (d > A.far) return 1;
    const f = Math.max(0, Math.min(1, (A.far - d) / (A.far - A.near)));
    return 1 + A.minPct + (A.maxPct - A.minPct) * f;
  }
  get damageTakenMult() { return this.stance === 'prone' ? this.ability('snipeStance').def.damageTakenMult : 1; }
  /** Projectile launch height (prone troops shoot from the ground) */
  get muzzleY() { return this.structure ? (this.rig.muzzleY || 1.4) * 1.25 : this.stance === 'prone' ? 0.45 : 1.75; }   // towers shoot from the top

  /** Put an item in the first free slot. Returns slot index or -1 when full. */
  addItem(itemId) {
    const i = this.items.indexOf(null);
    if (i < 0 || !ITEMS[itemId]) return -1;
    this.items[i] = itemId;
    this.recalcStats();
    return i;
  }
  removeItem(slot) {
    const id = this.items[slot];
    this.items[slot] = null; this.itemCd[slot] = 0;
    this.recalcStats();
    return id;
  }

  /** Use the item in `slot` (items with an `active`). Returns an error string, or null when it worked. */
  useItem(slot) {
    const id = this.items[slot], it = id && ITEMS[id], A = it?.active;
    if (!A) return it ? `${it.name} has no active` : 'Empty slot';
    if (this.dead) return 'Dead';
    if (this.itemCd[slot] > 0) return `${it.name} is on cooldown (${Math.ceil(this.itemCd[slot])}s)`;
    if (A.heal) {
      if (this.hp >= this.maxHp) return 'Already at full HP';
      this.hp = Math.min(this.maxHp, this.hp + A.heal);
      this.game.emit('heal', this.pos, A.heal, this.team);
      this.game.burst(this.pos, 6, [0x5ce36f, 0xffffff], 1.6, 0.5);
    }
    if (A.trueStrike) { this.trueStrikeT = A.trueStrike; this.trueStrikeBreak = A.breakT || 0; this.game.burst(this.pos, 5, [0xf2c94c, 0xffffff], 1.5, 0.4, 0.7); }
    this.game.onCast?.(this);   // Breaker
    if (A.consumable) this.removeItem(slot);
    else this.itemCd[slot] = A.cooldown || 0;
    return null;
  }
  /** AI: use item actives (eat when hurt, Javelin when fighting). */
  aiItems() {
    for (let k = 0; k < this.items.length; k++) {
      const A = this.items[k] && ITEMS[this.items[k]]?.active;
      if (!A || this.itemCd[k] > 0) continue;
      if (A.ai === 'lowHp' && this.hp / this.maxHp < 0.45) this.useItem(k);
      else if (A.ai === 'attacking' && this.target && !this.target.dead && this.aimT > 0 && !(this.trueStrikeT > 0)) this.useItem(k);
    }
  }

  // ---------------- lifecycle ----------------
  spawnAt(x, z) { this.pos.set(x, 0, z); this.obj.position.copy(this.pos); this.obj.rotation.y = this.facing; }

  command(order) {
    if (this.dead) return;
    const T = this.game.terrain;
    if (T && order.point) {
      const lim = GAME.baseX - GAME.baseHalfX - this.radius;
      const px = Math.max(-lim, Math.min(lim, order.point.x)), pz = Math.max(-GAME.mapHalfWidth + 0.5, Math.min(GAME.mapHalfWidth - 0.5, order.point.z));
      order = { ...order, point: T.nearestFree(px, pz) };
    }   // can't stand inside a tree
    this.order = order;
    this.target = null;
    this.retarget = 0;
    this.queuedCast = null;
  }

  /**
   * physical -> scaled by armor, magic -> scaled by ward, true -> unchanged (Dota-style curve, see config)
   */
  takeDamage(raw, source, type = 'physical', opts = null) {
    if (this.dead) return 0;
    const def = DAMAGE_TYPES[type]?.defense;
    if (this.tower) return 0;
    if (this.invulnerable) { this.shieldPing = 1; return 0; }
    if (this.game.cheat?.god && this.team === this.game.playerTeam) return 0;
    // Absorb (Dire): the nearest Dire ally within range takes this damage instead, before any mitigation.
    // Dires never pass damage to each other; buildings and towers aren't covered.
    if (!opts?.absorbed && this.team <= 1 && !this.structure && this.game.dires?.length && !this.ability('absorb')) {
      let dire = null, bd = Infinity;
      for (const D of this.game.dires) {
        if (D.dead || D.team !== this.team || D.broken) continue;
        const d = Math.hypot(D.pos.x - this.pos.x, D.pos.z - this.pos.z);
        if (d <= D.ability('absorb').def.radius && d < bd) { bd = d; dire = D; }
      }
      if (dire) return dire.takeDamage(raw, source, type, { ...(opts || {}), absorbed: true });
    }
    if (source && source.team !== undefined) raw *= this.game.dmgMult ? this.game.dmgMult(source.team, this.team) : 1;   // AI difficulty 4+
    if (source && source.weakenUntil > (this.game.time || 0)) raw *= 1 - source.weakenPct;   // Mediator: the attacker deals less
    if (source && source.silenceT > 0 && source.silenceSpell && !opts?.attack) raw *= 1 - source.silenceSpell;   // Silencer: silenced casters' spells hit softer
    if (type === 'physical' && source?.team === NEUTRAL_TEAM) { const ng = this.ability('naturesGrace'); if (ng && !ng.st.broken) raw *= 1 - ng.def.creepPhys; }   // Dryad
    if (source) {   // Warden (Iron Will) / Juggernaut (Gold Will): tanky against one kind of attacker, weak to the other
      const fromStruct = !!(source.structure || source.tower || source.isBase);
      const iw = this.ability('ironWill');
      if (iw && !iw.st.broken) { if (fromStruct) { if (type === 'physical') raw *= 1 - iw.def.structPhys; } else raw *= 1 + iw.def.fromUnits; }
      const gw = this.ability('goldWill');
      if (gw && !gw.st.broken) { if (fromStruct) raw *= 1 + gw.def.fromStructs; else if (type === 'physical') raw *= 1 - gw.def.fromUnits; }
    }
    const fz = this.fury;   // Fury: more damage from the troop type that stacked it (Vikings), any damage type
    if (fz && fz.t > 0 && fz.stacks > 0 && source && source.team === fz.team && source.def?.id === fz.unit) raw *= 1 + fz.stacks * fz.per;
    if (opts?.attack) {
      // Old Man Shield: flat block on basic attacks, before armor
      const sh = ITEMS.oldManShield;
      if (this.hasItem('oldManShield') && Math.random() < sh.blockChance) raw = Math.max(0, raw - (sh.block[0] + Math.random() * (sh.block[1] - sh.block[0])));
      // Bulwark: basic attacks from the front (incl. crits) deal less; on-hit extras are separate damage calls
      const bw = this.ability('bulwark');
      if (bw && source?.pos && !(this.broken && !bw.def.unbreakable)) {
        const ang = Math.atan2(source.pos.x - this.pos.x, source.pos.z - this.pos.z) - this.facing;
        if (Math.abs(Math.atan2(Math.sin(ang), Math.cos(ang))) <= bw.def.arc / 2) raw *= 1 - bw.def.reduction;
      }
      // Riot Helmet: armor burst after being shot (applies from the NEXT hit)
      if (opts.ranged && this.hasItem('riotHelmet')) { this.helmetT = ITEMS.riotHelmet.helmet.duration; this.helmetArmor = ITEMS.riotHelmet.helmet.armor; }
    }
    let d = def ? this[def] : 0;
    // Zealot (Drow): basic attacks ignore the target's BASE armor (bonus armor still counts)
    if (def === 'armor' && opts?.attack && source?.ability) { const z = source.ability('zealot'); if (z && !z.st.broken) d -= Math.max(0, this.base?.armor || 0); }
    const pierce = def === 'armor' ? (source?.pas?.armorPierce || source?.structure?.armorPierce || 0) : 0;   // structure: Twin .50 AP rounds
    if (pierce) d = Math.max(Math.min(d, 0), d - pierce);            // ignores up to N armor, never below 0
    const dmg = Math.max(0, raw * (def ? defenseMult(d) : 1)) * this.damageTakenMult;
    if (dmg <= 0) return 0;
    // Combust (Striker): stores magic damage taken; explodes at the threshold
    if (type === 'magic') { const cb = this.ability('combust'); if (cb && !cb.st.broken && !(cb.st.cd > 0)) { cb.st.acc = (cb.st.acc || 0) + dmg; if (cb.st.acc >= cb.def.threshold) this.combustPending = true; } }
    // Shield (Combust): temporary silver HP, soaks damage first
    let left = dmg;
    if (this.shieldHp > 0 && this.shieldT > 0) { const s = Math.min(this.shieldHp, left); this.shieldHp -= s; left -= s; this.shieldPing = 1; }
    this.hp -= left;
    this.flash = 1;
    // Interrupt (Dryad forms): anything it damages is silenced (refreshes every hit, poison ticks included)
    const si = source?.ability?.('silenceStrike');
    if (si && !si.st.broken && source.team !== this.team) this.addSilence(si.def.silence, si.def.spellCut || 0);
    // Spiked Plating (Catapult upgrade): reflects part of melee attack damage
    if (opts?.attack && !opts.ranged && !opts.reflect && source && !source.isBase && !source.dead && UPGRADES.spikedPlating.unit === this.def.id) {
      const L = this.upLevel('spikedPlating');
      if (L) { const rd = source.takeDamage(dmg * UPGRADES.spikedPlating.values.reflect[L - 1], this, 'physical', { reflect: true }); this.damageDealt += rd; }
    }
    const rs = this.ability('resentment');
    if (rs) { rs.st.acc = (rs.st.acc || 0) + dmg; if (rs.st.acc >= rs.def.threshold) { rs.st.acc = 0; rs.st.buffT = rs.def.duration; } }
    if (this.team === NEUTRAL_TEAM && this.hp > 0) this.game.neutralAggro(this, source);
    if (this.hp <= 0) { this.hp = 0; this.die(source); }
    else if (this.combustPending) { this.combustPending = false; this.game.combust(this); }
    if (this.dead) return dmg;
    else if (opts?.attack && !opts.extra && source && !source.dead && !source.isBase && source.team !== this.team) this.reactToAttack(source);
    return dmg;
  }
  /** Hit by a basic attack: Counterstrike (strike back) and Flick (extra shot) can fire. Extra shots never trigger these. */
  reactToAttack(src) {
    if (this.ccd || this.dead) return;
    const cs = this.ability('counterstrike');
    if (cs && !cs.st.broken && !src.flying && this.edgeDist(src) <= this.effRange + 0.6 && Math.random() < cs.def.chance) {
      const raw = this.rollDamage(true, src), shot = this.lastShot; shot.extra = true;
      const dodge = shot.trueStrike ? null : src.dodgeCheck(this);
      if (dodge) this.game.onDodge(this, src, dodge);
      else {
        const dealt = src.takeDamage(raw, this, this.def.damageType || 'physical', { attack: true, ranged: false, extra: true });
        this.damageDealt += dealt; this.onAttackLanded(src, dealt, raw, this.lastCrit, shot); this.game.onHit(this, src);
        this.game.burst(this.pos, 4, [0xf2c94c, 0xffffff], 2, 0.35, 0.7);
      }
      this.swing = 1;
    }
    const fl = this.ability('flick');
    if (fl && !fl.st.broken && Math.random() < fl.def.chance) this.flickShot(fl.def);
  }
  /** Flick: an extra shot at a random enemy in range that slows it. */
  flickShot(F) {
    if (!this.ranged || !this.def.projectile) return;
    const g = this.game, r = this.effRange + this.radius;
    const pool = g.units.filter((o) => this.isFoe(o) && !o.structure && g.canSee(this.team, o) && Math.hypot(o.pos.x - this.pos.x, o.pos.z - this.pos.z) - o.radius <= r);
    if (!pool.length) return;
    g.fireProjectile(this, pool[Math.floor(Math.random() * pool.length)], true, { extra: true, slow: { pct: F.slow, t: F.slowTime } });
    this.muzzleT = 0.06;
  }

  die(source) {
    this.dead = true;
    if (this.minis) this.clearMiniDrones();
    if (this.obstacle != null) { this.game.terrain?.removeObstacle(this.obstacle); this.obstacle = null; }
    this.deathT = 0;
    this.ring.visible = false; this.bar.visible = false; this.shield.visible = false;
    if (source && source.kills !== undefined) source.kills++;
    this.game.onUnitDeath(this, source);
  }

  // ---------------- abilities ----------------
  get effDamage() { return this.stats.damage + this.pas.bonusDamage; }
  get effAttackSpeed() { return this.stats.attackSpeed + this.pas.bonusAS; }
  /** Evasion sources stack multiplicatively (Dota): 1 - (1-a)(1-b) */
  get effEvasion() { return (1 - (1 - this.stats.evasion / 100) * (1 - this.pas.bonusEvasion / 100)) * 100; }
  ability(id) { return this.abil.find((a) => a.def.id === id); }
  get passive() { return this.abil.find((a) => a.def.kind === 'passive')?.def || null; }   // first passive (UI convenience)

  /** Passive logic + active cooldowns. Aura-style passives rescan 5x/sec. */
  updatePassive(dt) {
    const sum = { bonusDamage: 0, bonusAS: 0, bonusRegen: 0, bonusEvasion: 0, bonusArmor: 0, bonusWard: 0, bonusRange: 0, bonusMS: 0, armorPierce: 0, lifesteal: 0 };
    if (this.vendettaT > 0) this.vendettaT -= dt;
    if (this.shieldT > 0) { this.shieldT -= dt; if (this.shieldT <= 0) this.shieldHp = 0; }
    if (this.maxMana && this.mana < this.maxMana) this.mana = Math.min(this.maxMana, this.mana + (this.manaRegen || 0) * dt);
    for (let k = 0; k < this.itemCd.length; k++) if (this.itemCd[k] > 0) this.itemCd[k] -= dt;
    if (this.breakT > 0) this.breakT -= dt;
    if (this.shredT > 0) this.shredT -= dt;
    if (this.rallyT > 0) this.rallyT -= dt;
    if (this.curse) { this.curse.t -= dt; if (this.curse.t <= 0) this.curse = null; }
    if (this.fury) { this.fury.t -= dt; if (this.fury.t <= 0) this.fury = null; }
    if (this.trueStrikeT > 0) this.trueStrikeT -= dt;
    if (this.curseHasteT > 0) this.curseHasteT -= dt;
    if (this.raised && !this.dead) { this.raised.t -= dt; if (this.raised.t <= 0) { this.game.despawnBrainwashed(this); return; } }
    this.updateCasting(dt);
    // standing still without attacking (Night Meld etc.)
    this.stillT = this.moving || (this.aimT > 0) || this.casting ? 0 : this.stillT + dt;
    let invis = false;
    for (const { def: P, st: s } of this.abil) {
      // Break: breakable passives are switched off entirely
      if (P.kind === 'passive' && this.broken && !P.unbreakable) {
        s.active = false; s.broken = true;
        s.bonusDamage = s.bonusAS = s.bonusRegen = s.bonusEvasion = s.bonusArmor = s.bonusWard = s.bonusRange = s.bonusMS = s.lifesteal = 0;
        continue;
      }
      s.broken = false;
      if (P.kind === 'active') {
        s.cd = Math.max(0, s.cd - dt);
        if (P.id === 'flurry' || P.id === 'suppressiveFire') {
          s.buffT = Math.max(0, (s.buffT || 0) - dt);
          s.active = s.buffT > 0;
          const lvl = Math.max(1, this.upLevel(P.id));
          s.bonusAS = P.id === 'flurry' && s.active ? P.bonusAS[lvl - 1] : 0;
          s.bonusDamage = P.id === 'suppressiveFire' && s.active ? P.bonusDamage[lvl - 1] : 0;
          sum.bonusAS += s.bonusAS; sum.bonusDamage += s.bonusDamage;
        }
        if (P.id === 'snipeStance') {
          s.mode ||= 'stand';
          if (s.mode === 'channel') { s.chT -= dt; if (s.chT <= 0) s.mode = 'prone'; }
          else if (s.mode === 'standup') { s.chT -= dt; if (s.chT <= 0) { s.mode = 'stand'; s.cd = P.standCooldown; } }
          s.active = s.mode === 'prone';
          s.bonusRange = s.active ? P.bonusRange : 0;
          s.bonusDamage = s.active ? P.bonusDamage : 0;
          s.armorPierce = s.active ? P.armorPierce : 0;
          sum.bonusRange += s.bonusRange; sum.bonusDamage += s.bonusDamage; sum.armorPierce += s.armorPierce;
        }
        continue;
      }
      if (P.static) {                       // flat always-on passives (e.g. Nimble)
        s.active = true;
        for (const [k, v] of Object.entries(P.static)) s[k] = v;
      } else if (P.id === 'fervor') {
        s.sinceAttack += dt;
        if (s.stacks && s.sinceAttack > P.resetAfter) { s.stacks = 0; s.target = null; }
        s.bonusAS = this.fervorAS({ def: P, st: s });
        s.active = s.stacks > 0;
      } else if (P.id === 'rapidFire') {
        if (s.charges === undefined) s.charges = P.attacks;
        if (s.charges <= 0) { s.rcd = (s.rcd || 0) - dt; if (s.rcd <= 0) s.charges = P.attacks; }
        s.active = s.charges > 0;
        s.bonusAS = s.active ? P.bonusAS : 0;
      } else if (P.id === 'doubleTap') {
        s.cd = Math.max(0, (s.cd || 0) - dt); s.active = s.cd <= 0;
      } else if (P.id === 'liberation') {   // Ravaging / Draconic Batrider: pulse damage + knockback
        s.active = true; s.cd = (s.cd ?? P.every) - dt;
        if (s.cd <= 0) {
          const hit = this.game.enemiesInRadius(this, P.radius).filter((o) => this.isFoe(o));
          if (hit.length) {
            s.cd = P.every;
            for (const o of hit) {
              const d = o.takeDamage(P.flat + P.adPct * this.effDamage, this, P.damageType || 'magic', { splash: true });
              this.damageDealt += d; if (d > 0) this.game.emit('hitDmg', o.pos, d, false, this.team);
              if (!o.dead && !o.structure) o.knockback(this.pos, P.knockback);
            }
            this.game.ring?.(this.pos, P.radius, P.damageType === 'true' ? 0xffe14a : 0xb07aff);
          } else s.cd = 0.25;   // nothing in reach: check again soon, pulse as soon as something walks in
        }
      } else if (P.id === 'breaker') {   // Breaker: each ignite stack heals him + allies around him, own 8s timer per stack
        const S = (this.breakerStacks ||= []);
        for (let k = S.length - 1; k >= 0; k--) { S[k] -= dt; if (S[k] <= 0) S.splice(k, 1); }
        s.active = S.length > 0; s.stacks = S.length;
        s.tick = (s.tick || 0.5) - dt;
        if (S.length && s.tick <= 0) {
          s.tick = 0.5;
          const h = P.heal * S.length * 0.5, r2 = P.healRadius * P.healRadius;
          for (const o of this.game.units) {
            if (o.dead || o.team !== this.team || o.tower || o.structure || o.hp >= o.maxHp || (o.pos.x - this.pos.x) ** 2 + (o.pos.z - this.pos.z) ** 2 > r2) continue;
            o.hp = Math.min(o.maxHp, o.hp + h);
          }
          if (Math.random() < 0.5) this.game.burst(this.pos, 2, [0xff8a3a, 0xffe14a], 1.2, 0.4, 0.6);
        }
      } else if (P.id === 'combust') {
        s.active = true; if (s.cd > 0) s.cd -= dt;
      } else if (P.id === 'homingMissile') {   // Missile / Barrage Drone: ready = next attack is a long-range missile
        if (s.cd > 0) s.cd -= dt;
        s.active = !(s.cd > 0);
        s.bonusRange = s.active ? P.bonusRange : 0;
      } else if (P.id === 'packBonus') {   // Swarm / Hive: per other pack drone nearby
        s.scanT -= dt;
        if (s.scanT <= 0) {
          s.scanT = 0.25;
          const r2 = P.radius * P.radius; let n = 0;
          for (const o of this.game.units) if (o !== this && !o.dead && o.team === this.team && o.ability?.('packBonus') && (o.pos.x - this.pos.x) ** 2 + (o.pos.z - this.pos.z) ** 2 <= r2) n++;
          s.stacks = Math.min(n, P.maxStacks); s.active = s.stacks > 0;
          s.bonusDamage = s.stacks * P.damage; s.bonusArmor = s.stacks * P.armor; s.bonusAS = s.stacks * P.as; s.bonusMS = Math.round(s.stacks * P.moveSpeed * 100) / 100;
        }
      } else if (P.id === 'steadyAim' || P.id === 'relentless' || P.id === 'execution' || P.id === 'fortress' || P.id === 'ironWill' || P.id === 'absorb' || P.id === 'goldWill' || P.id === 'miniDrones') {
        s.active = true;                    // handled on hit / in takeDamage / in projectiles / updateMiniDrones
      } else if (P.id === 'counterstrike' || P.id === 'dkCurse' || P.id === 'zealot' || P.id === 'galewinds' || P.id === 'disrupt' || P.id === 'flick' || P.id === 'boomstick'
        || P.id === 'naturesGrace' || P.id === 'silenceStrike' || P.id === 'splitshot' || P.id === 'siegeBonus' || P.id === 'homingStone' || P.id === 'grudge') {
        s.active = true;                    // handled on hit / when hit
      } else if (P.id === 'resentment') {
        s.buffT = Math.max(0, (s.buffT || 0) - dt);
        s.active = s.buffT > 0;
        s.bonusDamage = s.active ? P.bonusDamage : 0;
        s.bonusAS = s.active ? P.bonusAS : 0;
      } else if (P.aura || P.id === 'cleave' || P.id === 'bulwark' || P.id === 'critStrike') {
        s.active = true;                    // handled by the receivers / on hit / in takeDamage / rollDamage
      } else if (P.id === 'nightMeld') {
        s.active = !!this.game.dayNight?.night && this.stillT >= P.stillFor && !this.tower;
        if (s.active) invis = true;
      } else if (P.id === 'bardingRally') {
        s.active = this.moving;
        s.dropT = (s.dropT || 0) - dt;
        if (this.moving && s.dropT <= 0) { s.dropT = P.dropEvery; this.game.addTrail?.(this.team, this.pos.x, this.pos.z, P.trailTime, P.speedBonus); }
      } else if (P.id === 'penetration') {
        const L = this.upLevel('penetration');
        s.active = true;
        s.bonusAS = L >= 5 ? P.maxBonusAS : 0;
      } else if (P.id === 'swiftStep') {
        s.active = this.moving;
        s.bonusEvasion = s.active ? P.evasion : 0;
      } else {
        s.scanT -= dt;
        if (s.scanT <= 0) {
          s.scanT = 0.2;
          const r2 = (P.radius || 0) ** 2;
          const sameTypeNear = () => this.game.units.filter((u) => u !== this && !u.dead && u.team === this.team && u.def.id === this.def.id && (u.pos.x - this.pos.x) ** 2 + (u.pos.z - this.pos.z) ** 2 <= r2).length;
          if (P.id === 'loneWolf') {
            // only OTHER Vikings break it, so he still works next to Archers
            s.active = sameTypeNear() === 0;
            const L = this.upLevel('oneManArmy'), V = UPGRADES.oneManArmy.values;   // One Man Army upgrade
            s.bonusDamage = s.active ? P.bonusDamage + (L ? V.damage[L - 1] : 0) : 0;
            s.bonusRegen = s.active ? P.bonusRegen + (L ? V.hpRegen[L - 1] : 0) : 0;
            s.bonusArmor = s.active ? (P.bonusArmor || 0) + (L ? V.armor[L - 1] : 0) : 0;
            s.lifesteal = s.active && L >= UPGRADES.oneManArmy.max ? V.lifestealAtMax : 0;
          } else if (P.id === 'outnumbered') {
            // allies (other troops of ours) vs enemies within the radius
            const r2o = P.radius * P.radius; let al = 0, en = 0;
            for (const o of this.game.units) {
              if (o === this || o.dead || o.tower || o.structure || (o.pos.x - this.pos.x) ** 2 + (o.pos.z - this.pos.z) ** 2 > r2o) continue;
              if (o.team === this.team) al++; else if (this.isFoe(o)) en++;
            }
            s.allies = al; s.enemies = en; s.active = true;
            s.bonusDamage = al >= en ? Math.round(this.stats.damage * P.dmgPct * 100) / 100 : 0;
            s.bonusArmor = en > al ? P.armor : 0; s.bonusWard = en > al ? P.ward : 0;
          } else if (P.id === 'blueLine') {
            let n = sameTypeNear();
            if (P.maxStacks) n = Math.min(n, P.maxStacks);
            s.stacks = n; s.active = n > 0;
            s.bonusDamage = n * P.damagePerAlly;
            const L = this.upLevel('riotTraining');                                  // Riot Training upgrade
            s.bonusArmor = L ? n * UPGRADES.riotTraining.values.armorPerOfficer[L - 1] : 0;
          }
        }
      }
      sum.bonusDamage += s.bonusDamage; sum.bonusAS += s.bonusAS; sum.bonusRegen += s.bonusRegen; sum.bonusEvasion += s.bonusEvasion; sum.bonusArmor += s.bonusArmor || 0; sum.bonusWard += s.bonusWard || 0; sum.bonusRange += s.bonusRange || 0; sum.bonusMS += s.bonusMS || 0; sum.lifesteal += s.lifesteal || 0;
    }
    if (this.vendettaT > 0) invis = true;   // Vendetta
    this.invisible = invis;
    if (this.curseHasteT > 0) sum.bonusAS += this.curseHaste || 0;
    if (this.grudgeT > 0) { this.grudgeT -= dt; sum.bonusAS += this.grudgeAS || 0; }   // Grudge: a Batrider ally fell
    if (this.acidT > 0) { this.acidT -= dt; sum.bonusAS -= this.acidAS || 0; }         // Acid Content max: acid slows attacks
    // Guardian Aura: strips armor and ward from enemies (buildings and the enemy base too) around this troop
    const ea = !this.broken && this.abil.find((a) => a.def.enemyAura)?.def.enemyAura;
    if (ea && (this.eaScan = (this.eaScan || 0) - dt) <= 0) {
      this.eaScan = 0.2;
      for (const o of this.game.units) {
        if (o.dead || o.tower || !this.isFoe(o) || Math.hypot(o.pos.x - this.pos.x, o.pos.z - this.pos.z) - o.radius > ea.radius) continue;
        o.addArmorDebuff('guardian', ea.armor, 0.35); o.addWardDebuff('guardian', ea.ward, 0.35);
      }
      const eb = this.game.bases?.[1 - this.team];
      if (eb && this.team <= 1 && this.game.distToBase(this, 1 - this.team) <= ea.radius) eb.auraDebuff = { v: ea.armor, until: (this.game.time || 0) + 0.35 };
    }
    if (this.apBuff) { if (this.apBuff.until <= (this.game.time || 0)) this.apBuff = null; else sum.bonusAS += this.apBuff.as; }
    // auras received: every aura ability (def.aura) from allies in range. The same aura never stacks (strongest
    // copy wins); different auras add up. A broken aura carrier stops emitting.
    this.auraScan = (this.auraScan || 0) - dt;
    if (this.auraScan <= 0) {
      this.auraScan = 0.2;
      const got = {};
      for (const u of this.game.units) {
        if (u.dead || u.team !== this.team || !u.abil.length) continue;
        for (const { def: A } of u.abil) {
          if (!A.aura || (u.broken && !A.unbreakable) || (A.notSelf && u === this)) continue;
          const r = A.aura.radius;
          if ((u.pos.x - this.pos.x) ** 2 + (u.pos.z - this.pos.z) ** 2 > r * r) continue;
          const cur = (got[A.id] ||= {});
          for (const [k, v] of Object.entries(A.aura)) if (k !== 'radius') cur[k] = Math.max(cur[k] || 0, v);
        }
      }
      this.auraBonus = { bonusArmor: 0, bonusWard: 0, bonusRegen: 0, bonusDamage: 0, bonusAS: 0, bonusRange: 0 };
      for (const a of Object.values(got)) for (const [k, v] of Object.entries(a)) this.auraBonus[k] = (this.auraBonus[k] || 0) + v;
      this.auras = Object.keys(got);
    }
    if (this.auraBonus) for (const [k, v] of Object.entries(this.auraBonus)) sum[k] = (sum[k] || 0) + v;
    if (this.helmetT > 0) { this.helmetT -= dt; sum.bonusArmor += this.helmetArmor || 0; }
    if (this.disarmT > 0) this.disarmT -= dt;
    this.pas = sum;
  }

  /** Called when a swing/shot starts against `tg`. */
  onAttackStart(tg) {
    this.stillT = 0; this.invisible = false;
    if (this.vendettaT > 0) { this.vendettaT = 0; this.vendettaStrike = true; }   // Vendetta: this attack ends it and hits very hard
    if (tg && tg.curse && tg.curse.t > 0) { this.curseHasteT = tg.curse.def.hasteTime; this.curseHaste = tg.curse.def.hasteAS; }
    if (tg && tg.team !== undefined) this.game.vision?.reveal(this, tg.team);   // attacking gives your position away
    const f = this.ability('fervor');
    if (f) { if (f.st.target !== tg) { f.st.target = tg; f.st.stacks = 0; } f.st.sinceAttack = 0; }
  }
  /** Called after the attack has been released (damage dealt / projectile fired). */
  onAttackDone() {
    const f = this.ability('fervor');
    if (f) { f.st.stacks = f.def.maxStacks ? Math.min(f.def.maxStacks, f.st.stacks + 1) : f.st.stacks + 1; f.st.bonusAS = this.fervorAS(f); f.st.active = true; }
    if (this.apBuff && --this.apBuff.left <= 0) this.apBuff = null;   // High Elf: Arrow Piercer burst used up
  }
  /** Fervor bonus: flat per stack, or % of attack speed per stack (Machine Gunner / Mercenary). */
  fervorAS({ def: P, st }) { return P.pctPerStack ? Math.round(st.stacks * P.pctPerStack * this.stats.attackSpeed * 100) / 100 : st.stacks * P.perStack; }

  /** Damage for one hit: base + items + passives, ±variance, maybe a crit. Sets this.lastCrit. */
  rollDamage(extra = false, tg = null) {
    let d = this.effDamage + Math.round((Math.random() * 2 - 1) * GAME.dmgVariance);
    this.lastCrit = false;
    // per-shot extras, carried by the projectile / melee swing: true strike (can't miss/evade), bonus magic, break
    const shot = this.lastShot = { trueStrike: false, magic: 0, breakT: 0, extra };
    // Rapid Fire: each charged attack shreds armor (extra shots don't use charges)
    const rf = !extra && this.ability('rapidFire');
    if (rf && !rf.st.broken && rf.st.charges > 0) {
      shot.rapid = { per: rf.def.shred, t: rf.def.shredTime };
      if (--rf.st.charges <= 0) rf.st.rcd = rf.def.cooldown;
    }
    if (this.trueStrikeT > 0) {   // Javelin: the next attack within the window
      shot.trueStrike = true; shot.breakT = this.trueStrikeBreak || 0; this.trueStrikeT = 0;
    }
    const be = this.ability('bullsEye');
    if (be) {
      const L = this.upLevel('hollowPoints'), HP = UPGRADES.hollowPoints;     // Hollow Points upgrade
      const need = L >= HP.max ? HP.values.fullHpPctAtMax : be.def.fullHpPct;   // crits on (nearly) full-HP targets
      const crit = be.def.critBonus + (L ? HP.values.critBonus[L - 1] : 0);
      if (!be.st.broken && tg && !tg.dead && tg.maxHp > 0 && tg.hp >= tg.maxHp * need - 1e-6) {
        d = Math.round(d * (1 + crit)); this.lastCrit = true;
        if (!be.st.broken && be.def.curHpPct) { shot.curHpPct = be.def.curHpPct; shot.breakT = Math.max(shot.breakT, be.def.breakT || 0); }   // Assassin forms
      }
    }
    const sa = this.ability('steadyAim');           // Marksman forms: shots pierce evasion
    if (sa && !sa.st.broken) shot.trueStrike = true;
    if (!extra && this.vendettaStrike) { this.vendettaStrike = false; shot.vendetta = this.ability('vendetta')?.def || null; }
    const cs = this.ability('critStrike');
    if (cs && !cs.st.broken && Math.random() < cs.def.chance) {
      const L = Math.max(1, this.upLevel('criticalStrike'));
      d = Math.round(d * (1 + cs.def.bonus[L - 1])); this.lastCrit = true;
    }
    const e = this.ability('eagleEye');
    if (e && Math.random() < e.def.chance) {
      d = Math.round((d + (e.def.bonusDamage || 0)) * (1 + (e.def.bonusPct || 0)));
      if (e.def.trueStrike) shot.trueStrike = true;
      shot.magic += e.def.bonusMagic || 0;
      this.lastCrit = true;
    }
    return d;
  }

  /** After an attack's damage lands (melee or projectile): lifesteal, on-hit slows. */
  onAttackLanded(tg, dealt, raw = 0, crit = false, shot = null) {
    if (dealt > 0) this.game.emit('hitDmg', tg.pos, dealt, crit, this.team);
    // Arcane Coating (Dryad): coated hits poison + slow, paying mana per hit (switches off when dry)
    const ac = this.ability('arcaneCoating');
    if (ac && ac.st.on && !tg.dead && !tg.isBase && !tg.structure) {
      const A = ac.def, cost = A.manaPerHit || 0;
      if (this.mana >= cost) {
        if (!(this.game.cheat?.wtf && this.team === this.game.playerTeam)) this.mana -= cost;
        const L = this.upLevel('arcanePotency'), U = UPGRADES.arcanePotency;
        tg.addPoison(L ? U.values.dps[L - 1] : A.dps, A.t, this, L >= U.max ? U.values.pctMaxHpAtMax : 0);
        tg.addSlow(A.slow, A.t);
      } else ac.st.on = false;
    }
    const sup = this.structure?.suppress;   // Machine Gun Nest: every hit slows
    if (sup && !tg.dead) tg.addSlow(sup.pct, sup.t);
    const bh = this.structure?.burnHit;     // Fire Archers: hits set the target on fire
    if (bh && !tg.dead) tg.addBurn(bh.dps, bh.t, this);
    const hs = this.structure?.hitSplash;   // Autocannon Bunker: shells burst around the target
    if (hs && raw > 0) this.game.hitSplash(this, tg, raw * hs.pct, hs.radius);
    if (shot?.magic && !tg.dead) { const m = tg.takeDamage(shot.magic, this, 'magic'); this.damageDealt += m; if (m > 0) this.game.emit('hitDmg', tg.pos, m, false, this.team); }
    // Assassin Bull's Eye: + % of the target's current HP (as it was before this hit) as physical damage
    if (shot?.curHpPct && !tg.dead && !tg.isBase) { const x = tg.takeDamage((tg.hp + dealt) * shot.curHpPct, this, 'physical'); this.damageDealt += x; if (x > 0) this.game.emit('hitDmg', tg.pos, x, true, this.team); }
    if (shot?.breakT && !tg.dead) tg.applyBreak(shot.breakT);
    if (shot?.slow && !tg.dead) tg.addSlow(shot.slow.pct, shot.slow.t);            // Flick
    if (shot?.rapid && !tg.dead) tg.addRapidShred(shot.rapid.per, shot.rapid.t);   // Rapid Fire
    const now = this.game.time || 0;
    // Curse of the Death Knight: slow + mark; anyone on the curser's side heals when hitting a marked unit
    const dk = this.ability('dkCurse');
    if (dk && !dk.st.broken && !tg.dead && !tg.tower) { tg.addSlow(dk.def.slow, dk.def.duration); tg.dkMark = { team: this.team, until: now + dk.def.duration, heal: dk.def.heal }; }
    if (tg.dkMark && tg.dkMark.until > now && tg.dkMark.team === this.team && !this.dead && this.hp < this.maxHp) {
      this.hp = Math.min(this.maxHp, this.hp + tg.dkMark.heal); this.game.emit('heal', this.pos, tg.dkMark.heal, this.team);
    }
    // Galewinds: speed burst on hit
    const gw = this.ability('galewinds');
    if (gw && !gw.st.broken) { this.galeUntil = now + gw.def.duration; this.galeBonus = gw.def.moveSpeed; }
    // Disrupt: every Nth landed attack stuns (extra shots don't count)
    const ds = this.ability('disrupt');
    if (ds && !ds.st.broken && !shot?.extra && !tg.dead) { ds.st.stacks = (ds.st.stacks || 0) + 1; if (ds.st.stacks >= ds.def.every) { ds.st.stacks = 0; tg.addStun(ds.def.stun); } }
    if (this.pas.lifesteal && dealt > 0 && !this.dead) this.hp = Math.min(this.maxHp, this.hp + dealt * this.pas.lifesteal / 100);
    const g = this.game;
    // Banshee Curse: mark the target (rises for our side if it dies while cursed)
    const bc = this.ability('bansheeCurse');
    if (bc && !bc.st.broken && !tg.dead && !tg.tower) tg.curse = { t: bc.def.duration, team: this.team, src: this, def: bc.def };
    // Fury: a Fury carrier adds/refreshes a stack. Each stack makes the target take +perStack (4%) damage from every
    // troop of that type on that team (see takeDamage).
    const fz = tg.fury;
    const fu = this.ability('fury');
    if (fu && !fu.st.broken && !tg.dead && !tg.tower) {
      if (!fz || fz.t <= 0 || fz.team !== this.team || fz.unit !== this.def.id) tg.fury = { team: this.team, unit: this.def.id, stacks: 0, per: fu.def.perStack, t: 0 };
      const F = tg.fury, cap = fu.def.maxStacks;
      F.stacks = cap > 0 ? Math.min(cap, F.stacks + 1) : F.stacks + 1;
      F.t = fu.def.duration; F.per = Math.max(F.per, fu.def.perStack);
    }
    // Chain Lightning: chance to zap the target and jump through nearby enemies
    const cl = this.ability('chainLightning');
    if (cl && !cl.st.broken && !tg.dead && Math.random() < cl.def.chance) g.chainLightning(this, tg, cl.def);
    // Penetration: armor shred on the target
    const pen = this.ability('penetration');
    if (pen && !pen.st.broken && !tg.dead) tg.applyShred(pen.def.shred[this.upLevel('penetration')], pen.def.duration);
    // Shackles (melee carriers): chance to disarm
    if (!this.ranged && this.hasItem('shackles') && !tg.dead && !tg.invulnerable && !tg.tower && !tg.disarmed && Math.random() < ITEMS.shackles.disarm.chance) {
      tg.disarmT = ITEMS.shackles.disarm.duration; tg.pendingHit = null;
      g.emit('disarm', tg);
    }
    // Pocket Knife: small splash around the carrier
    if (this.hasItem('pocketKnife')) {
      const K = ITEMS.pocketKnife.splash;
      for (const o of g.units) if (this.isFoe(o) && Math.hypot(o.pos.x - this.pos.x, o.pos.z - this.pos.z) - o.radius <= K.radius) this.damageDealt += o.takeDamage(K.damage, this, 'physical');
    }
    // Cleave: cone behind the target
    const cv = !this.ranged && this.ability('cleave');
    if (cv && raw > 0) {
      const C = cv.def;
      let dx = tg.pos.x - this.pos.x, dz = tg.pos.z - this.pos.z; const dl = Math.hypot(dx, dz) || 1; dx /= dl; dz /= dl;
      let n = 0;
      for (const o of g.units) {
        if (o === tg || !this.isFoe(o)) continue;
        const vx = o.pos.x - tg.pos.x, vz = o.pos.z - tg.pos.z, vl = Math.hypot(vx, vz);
        if (vl - o.radius > C.radius) continue;
        if (vl > 0.3 && (vx * dx + vz * dz) / vl < Math.cos(C.cone)) continue;
        this.damageDealt += o.takeDamage(raw * C.pct, this, 'physical'); n++;
      }
      if (n) g.burst(tg.pos, 5, [0xb03030, 0xffffff], 2.4, 0.35);
    }
    const sf = this.ability('suppressiveFire');
    if (sf && sf.st.buffT > 0) { const L = Math.max(1, this.upLevel('suppressiveFire')); tg.knockback(this.pos, sf.def.knockback[L - 1]); }
  }

  /** Dota-style hit check for an ATTACK from `attacker`: returns 'miss' | 'evade' | null (hit). */
  dodgeCheck(attacker) {
    if (attacker?.stats?.missChance && Math.random() * 100 < attacker.stats.missChance) return 'miss';
    // flying: ranged attacks miss often (melee can't target flying at all)
    if (this.flying) { if (attacker?.ranged && Math.random() < GAME.flyingMiss) return 'miss'; }
    // high ground: ranged attacks from the river up onto the banks can miss
    else if (attacker?.ranged && !attacker.tower && attacker.groundLevel < this.groundLevel && Math.random() < GAME.highGround.uphillMiss) return 'uphill';
    const ev = this.effEvasion;
    if (ev > 0 && Math.random() * 100 < ev) return 'evade';
    return null;
  }

  /** Activate ability in slot i (0-3). Returns true if it fired. */
  /**
   * Cast ability slot i. `aim` = {x,z} for ground-targeted abilities. Abilities with a castTime wind up first
   * (unit stops; S cancels). Mana and cooldown are spent when the cast goes off.
   */
  castAbility(i, aim = null) {
    const a = this.abil[i];
    if (!a || this.dead || a.def.kind !== 'active' || a.st.cd > 0 || this.casting || this.ccd || this.leap) return false;
    if (this.silenceT > 0) return false;   // Interrupt
    if ((a.def.manaCost || 0) > this.mana) return false;
    if (a.def.id === 'arcaneCoating') {   // toggle: coated hits poison + slow (mana per hit, see onAttackLanded)
      a.st.on = !a.st.on; a.st.cd = a.def.cooldown || 0;
      this.game.burst(this.pos, 5, a.st.on ? [0x7ae85a, 0xd8ffb0] : [0x9aa3ab], 1.5, 0.4, 0.6);
      return true;
    }
    if (a.def.cast === 'unit') {   // needs an enemy troop; out of range -> walk there first (cast fires from update)
      const t = aim?.unit || (this.target && !this.target.isBase ? this.target : null);
      if (!t || t.dead || t.team === this.team || t.tower || t.isBase) return false;
      if (this.edgeDist(t) > this.castRangeOf(a.def)) { this.command({ type: 'attack', target: t }); this.queuedCast = { i, target: t }; return true; }
      aim = { unit: t, x: t.pos.x, z: t.pos.z };
    }
    if (a.def.castTime) {
      this.casting = { i, t: a.def.castTime, aim };
      this.pendingHit = null; this.swing = 0;
      if (aim) this.faceTowards(aim.x - this.pos.x, aim.z - this.pos.z, 1, 1);
      return true;
    }
    return this.finishCast(i, aim);
  }
  finishCast(i, aim) {
    const a = this.abil[i];
    if (!a || this.dead || (a.def.manaCost || 0) > this.mana) return false;
    if (!this.game.castAbility(this, a.def, aim)) return false;
    if (a.def.id !== 'snipeStance') this.game.onCast?.(this);   // Breaker: enemy casts ignite nearby Breakers
    const wtf = this.game.cheat?.wtf && this.team === this.game.playerTeam;   // /wtf: free, instant recasts
    if (!wtf) this.mana -= a.def.manaCost || 0;
    // Snipe Stance: going prone costs the short cooldown; standing up sets its own cooldown when it finishes
    a.st.cd = wtf || (a.def.id === 'snipeStance' && a.st.mode !== 'channel') ? 0 : (a.def.cooldown || 0);
    this.stillT = 0;
    return true;
  }
  updateCasting(dt) {
    const c = this.casting; if (!c) return;
    if (c.aim) this.faceTowards(c.aim.x - this.pos.x, c.aim.z - this.pos.z, dt, 14);
    c.t -= dt;
    if (c.t <= 0) { this.casting = null; this.finishCast(c.i, c.aim); }
  }

  /** Snipe Stance toggle: stand -> channel (immobile) -> prone; recast while channeling/prone -> stand. */
  toggleStance() {
    const a = this.ability('snipeStance');
    if (!a || this.vendettaT > 0) return false;   // no going prone during Vendetta
    const s = a.st;
    if (s.mode === 'stand' || !s.mode) { s.mode = 'channel'; s.chT = a.def.channel; }
    else if (s.mode === 'channel') s.mode = 'stand';                       // recast mid-setup = cancel
    else if (s.mode === 'prone') { s.mode = 'standup'; s.chT = a.def.standUp; }
    else return false;                                                       // already standing up
    this.pendingHit = null;
    return true;
  }

  /** Dota-style S: cancel channels and attack wind-ups (but stay prone if already in stance). */
  interrupt() {
    const a = this.ability('snipeStance');
    let cancelled = false;
    if (a && a.st.mode === 'channel') { a.st.mode = 'stand'; a.st.cd = 0; cancelled = true; }
    if (this.pendingHit) { this.pendingHit = null; this.swing = 0; cancelled = true; }
    if (this.casting) { this.casting = null; cancelled = true; }
    return cancelled;
  }

  /** AI decides whether to use its actives. onlyAuto: a player troop, so only the actives it has on autocast. */
  aiCast(onlyAuto = false) {
    for (let i = 0; i < this.abil.length; i++) {
      const { def: A, st } = this.abil[i];
      if (A.kind !== 'active' || st.cd > 0 || !(A.aiCast || A.ai)) continue;
      if (onlyAuto && !(st.auto && canAutocast(A))) continue;
      if ((A.id === 'flurry' || A.id === 'suppressiveFire') && this.target && !this.target.dead && this.aimT > 0) { this.castAbility(i); continue; }
      if (A.id === 'snipeStance') {
        // go prone when enemies are inside the extended range but nobody is in our face; stand up to advance or flee
        const near = this.game.enemiesInRadius(this, A.ai.dangerRadius).length;
        const inLong = this.game.enemiesInRadius(this, this.stats.range + A.bonusRange).length;
        const baseInLong = this.game.distToBase(this, 1 - this.team) <= this.stats.range + A.bonusRange;
        if (st.mode === 'stand' && !near && (inLong || baseInLong)) this.castAbility(i);
        else if (st.mode === 'prone' && (near || (!inLong && !baseInLong))) {
          st.idleT = (st.idleT || 0) + 0.3;
          if (near || st.idleT > A.ai.standAfter) { st.idleT = 0; this.castAbility(i); }
        } else st.idleT = 0;
        continue;
      }
      if (A.id === 'arrowPiercer' && this.target && !this.target.dead && this.aimT > 0 && this.mana >= (A.manaCost || 0)) { this.castAbility(i, { x: this.target.pos.x, z: this.target.pos.z }); continue; }
      if (A.id === 'tumble') {   // roll away when something melee is on top of us and we're getting hurt
        const close = this.game.units.some((o) => this.isFoe(o) && !o.ranged && this.edgeDist(o) < 1.2);
        if (close && this.hp / this.maxHp < 0.7) this.castAbility(i);
        continue;
      }
      if (A.id === 'flay' && this.game.enemiesInRadius(this, A.radius, A).some((o) => this.isFoe(o))) { this.castAbility(i); continue; }
      if (A.id === 'shieldStomp' && this.aimT > 0 && this.game.enemiesInRadius(this, A.radius + 0.3).length) { this.castAbility(i); continue; }
      if (A.id === 'splatter' && A.leap) {   // Fire Splatter: leap onto the biggest clump in reach
        let best = null, bn = 0;
        for (const o of this.game.units) {
          if (!this.isFoe(o) || o.flying || this.flatDist(o.pos) > A.leap.range) continue;
          const n = this.game.units.filter((e) => this.isFoe(e) && !e.flying && Math.hypot(e.pos.x - o.pos.x, e.pos.z - o.pos.z) <= A.radius).length;
          if (n > bn) { bn = n; best = o; }
        }
        if (best && (bn >= A.aiCast.minTargets || this.hp / this.maxHp < A.aiCast.lowHpPct)) this.castAbility(i, { x: best.pos.x, z: best.pos.z });
        continue;
      }
      if (A.id === 'splatter') {
        const n = this.game.enemiesInRadius(this, A.radius).length;
        if (n >= A.aiCast.minTargets || (n >= 1 && this.hp / this.maxHp < A.aiCast.lowHpPct)) this.castAbility(i);
        continue;
      }
      if ((A.id === 'enforce' || A.id === 'mediator') && this.game.enemiesInRadius(this, A.radius, A).filter((o) => !o.structure).length >= A.ai.minTargets) { this.castAbility(i); continue; }
      if (A.id === 'vendetta' && this.target && !this.target.dead && !this.target.isBase && !this.target.structure && this.hp / this.maxHp > 0.4) { this.castAbility(i); continue; }
      if (A.id === 'assassinate' && this.target && !this.target.dead && !this.target.isBase && !this.target.structure && this.aimT > 0) { this.castAbility(i, { unit: this.target }); continue; }
      if (A.id === 'execute' && this.target && !this.target.dead && !this.target.isBase && this.aimT > 0) { this.castAbility(i, { unit: this.target }); continue; }
      if (A.id === 'arcaneCoating') {   // keep the coating on while there's mana for a few hits
        if (!st.on && this.aimT > 0 && this.mana >= (A.manaPerHit || 0) * 3) this.castAbility(i);
        continue;
      }
      if (A.id === 'acidSpray') {   // the biggest clump of ground enemies within reach
        let best = null, bn = 0;
        for (const o of this.game.units) {
          if (!this.isFoe(o) || o.flying || this.flatDist(o.pos) > A.castRange + A.radius * 0.5) continue;
          const n = this.game.units.filter((e) => this.isFoe(e) && !e.flying && Math.hypot(e.pos.x - o.pos.x, e.pos.z - o.pos.z) <= A.radius).length;
          if (n > bn) { bn = n; best = o; }
        }
        if (best && bn >= A.ai.minTargets) this.castAbility(i, { x: best.pos.x, z: best.pos.z });
        continue;
      }
      if (A.id === 'scattershot' && this.target && !this.target.dead && this.aimT > 0 && this.edgeDist(this.target) <= A.range) { this.castAbility(i, { x: this.target.pos.x, z: this.target.pos.z }); continue; }
    }
  }

  releaseAttack(tg) {
    const g = this.game;
    if (this.ranged) {
      if (this.def.siege) {   // Catapult: a ground-targeted boulder (Game.fireBoulder), can be dodged
        if (tg.isBase || !tg.dead) { g.fireBoulder(this, tg); this.onAttackDone(); }
        return;
      }
      if (tg.isBase || !tg.dead) {
        const hm = this.ability('homingMissile');   // Missile / Barrage Drone: the charged attack is a missile
        if (hm && !hm.st.broken && !(hm.st.cd > 0)) {
          const M = hm.def, r = this.effRange + this.radius + 0.5;
          const others = tg.isBase ? [] : g.units.filter((o) => o !== tg && this.isFoe(o) && g.canSee(this.team, o) && Math.hypot(o.pos.x - this.pos.x, o.pos.z - this.pos.z) - o.radius <= r);
          hm.st.cd = M.cooldown;
          g.fireProjectile(this, tg, false, { missile: { magic: M.magic, radius: M.radius }, mesh: 'rocket' });
          for (let k = 0; k < (M.extra || 0); k++) g.fireProjectile(this, others.length ? others[Math.floor(Math.random() * others.length)] : tg, true, { extra: true, missile: { magic: M.magic, radius: M.radius }, mesh: 'rocket' });
        } else {
          let shotAt = tg;
          const rl = !tg.isBase && this.ability('relentless');   // Mercenary: half the shots spray at someone near the target
          if (rl && !rl.st.broken && Math.random() < rl.def.chance) {
            const near = g.units.filter((o) => o !== tg && this.isFoe(o) && !(o.flying && !this.hitsAir) && g.canSee(this.team, o) && Math.hypot(o.pos.x - tg.pos.x, o.pos.z - tg.pos.z) - o.radius <= rl.def.radius);
            if (near.length) shotAt = near[Math.floor(Math.random() * near.length)];
          }
          g.fireProjectile(this, shotAt);
        }
        this.onAttackDone();
        const sp = this.ability('splitshot');     // Relentless / Split Dryad: extra spears at the nearest other enemies
        if (sp && !sp.st.broken && !tg.isBase) {
          const r = this.effRange + this.radius + 0.5;
          const pool = g.units.filter((o) => o !== tg && this.isFoe(o) && !(o.flying && !this.hitsAir) && g.canSee(this.team, o) && Math.hypot(o.pos.x - this.pos.x, o.pos.z - this.pos.z) - o.radius <= r)
            .sort((a, b) => Math.hypot(a.pos.x - tg.pos.x, a.pos.z - tg.pos.z) - Math.hypot(b.pos.x - tg.pos.x, b.pos.z - tg.pos.z)).slice(0, sp.def.targets);
          for (const o of pool) g.fireProjectile(this, o, true, { extra: true, dmgMult: sp.def.dmgPct });
        }
        const dt2 = this.ability('doubleTap');   // Rambo: the shot fires twice
        if (dt2 && !dt2.st.broken && !(dt2.st.cd > 0)) { dt2.st.cd = dt2.def.cooldown; this.doubleTapQ = { t: dt2.def.delay, target: tg }; }
        const fl = this.ability('flick');         // Desperado: Flick on his own attacks too
        if (fl && fl.def.onAttack && !fl.st.broken && Math.random() < fl.def.chance) this.flickShot(fl.def);
      }
      if (this.rig.muzzle) this.muzzleT = 0.06;
      return;
    }
    if (tg.isBase) g.damageBase(tg.team, this.rollDamage(false, tg), this);
    else if (!tg.dead && this.edgeDist(tg) <= this.effRange + 0.6) {
      const raw = this.rollDamage(false, tg), shot = this.lastShot, crit = this.lastCrit;
      const dodge = shot.trueStrike ? null : tg.dodgeCheck(this);   // true strike: can't miss or be evaded
      if (dodge) { g.onDodge(this, tg, dodge); this.onAttackDone(); return; }
      const dealt = tg.takeDamage(raw, this, this.def.damageType || 'physical', { attack: true, ranged: false });
      this.damageDealt += dealt;
      this.onAttackLanded(tg, dealt, raw, crit, shot);
      g.onHit(this, tg);
      this.onAttackDone();
    }
  }

  // ------------------------------------------------------------
  update(dt, camQuat) {
    if (this.dead) return this.updateDeath(dt);
    if (this.burnT > 0) { this.tickBurn(dt); if (this.dead) return false; }
    if (this.poisonT > 0) { this.tickPoison(dt); if (this.dead) return false; }
    if (this.silenceT > 0) this.silenceT -= dt;
    const g = this.game, s = this.stats;
    if (this.tower) return this.updateTower(dt, camQuat);
    if (this.structure) return this.updateStructure(dt, camQuat);
    if (this.team === NEUTRAL_TEAM) return this.updateNeutral(dt, camQuat);
    this.atkCd -= dt;
    if (this.kb) { const f = Math.min(1, dt / this.kb.t); this.pos.x += this.kb.x * f; this.pos.z += this.kb.z * f; this.kb.x *= 1 - f; this.kb.z *= 1 - f; this.kb.t -= dt; if (this.kb.t <= 0) this.kb = null; }
    if (this.slows.length) { for (const s of this.slows) s.t -= dt; this.slows = this.slows.filter((s) => s.t > 0); }
    if (this.invulnT > 0) this.updateShield(dt);
    else if (this.shield.visible) this.shield.visible = false;
    this.retarget -= dt;
    if (this.brainwashed) {
      this.brainwashed.t -= dt;
      if (this.brainwashed.t <= 0) { g.despawnBrainwashed(this); return false; }
    }
    this.updatePassive(dt);
    if (this.dead) return false;
    if (this.ability('miniDrones')) this.updateMiniDrones(dt);
    if (this.leap) return this.updateLeap(dt, camQuat);
    if (this.stunT > 0 || this.fearT > 0) return this.updateCC(dt, camQuat);
    if (this.doubleTapQ) {
      const Q = this.doubleTapQ; Q.t -= dt;
      if (Q.t <= 0) { this.doubleTapQ = null; if (Q.target.isBase || !Q.target.dead) { g.fireProjectile(this, Q.target, true, { extra: true }); this.onAttackDone(); this.muzzleT = 0.06; this.swing = 1; } }
    }
    if (this.queuedCast) {   // unit-targeted cast (Execute): walk into range, then cast
      const Q = this.queuedCast, a = this.abil[Q.i];
      if (!a || Q.target.dead || !g.canSee(this.team, Q.target) || a.st.cd > 0) this.queuedCast = null;
      else if (this.edgeDist(Q.target) <= this.castRangeOf(a.def)) { this.queuedCast = null; this.castAbility(Q.i, { unit: Q.target, x: Q.target.pos.x, z: Q.target.pos.z }); }
    }
    if (g.teams[this.team].isAI) { this.aiT = (this.aiT || 0) - dt; if (this.aiT <= 0) { this.aiT = 0.3; if (this.abil.length) this.aiCast(); if (this.dead) return false; this.aiItems(); } }
    else if (this.abil.some((a) => a.st.auto)) { this.aiT = (this.aiT || 0) - dt; if (this.aiT <= 0) { this.aiT = 0.3; this.aiCast(true); if (this.dead) return false; } }   // player autocast
    const regen = this.stats.hpRegen + this.pas.bonusRegen;
    if (regen && this.hp < this.maxHp) this.hp = Math.min(this.maxHp, this.hp + regen * dt);

    if (this.pendingHit) {
      this.pendingHit.t -= dt;
      if (this.pendingHit.t <= 0) { this.releaseAttack(this.pendingHit.target); this.pendingHit = null; }
    }

    let goal = null, engage = null;
    const o = this.order;
    if (o.type === 'attack') {
      if (!o.target || o.target.dead) this.order = { type: 'idle' };
      else if (o.target.flying && !this.hitsAir) this.command({ type: 'attackMove', point: { x: o.target.pos.x, z: o.target.pos.z } });   // melee / Catapult can't hit flyers
      else if (!o.target.isBase && !g.canSee(this.team, o.target)) this.command({ type: 'attackMove', point: { x: o.target.pos.x, z: o.target.pos.z } });   // lost in the fog: go to the last seen spot
      else engage = o.target;
    }
    if (this.order.type === 'move') {
      goal = o.point;
      if (this.flatDist(goal) < 0.35) { this.order = { type: 'idle' }; goal = null; }
    } else if (this.order.type === 'pickup') {
      const L = o.loot;
      if (!L || L.taken) this.order = { type: 'idle' };
      else if (this.flatDist(L) < 1.1) { g.pickupLoot(this, L); this.order = { type: 'idle' }; }
      else goal = L;
    } else if (!engage) {
      if (this.target && this.target.dead) this.target = null;
      if (this.retarget <= 0) {
        const see = this.order.type === 'idle' ? Math.max(this.rangeRadius + 1, this.def.aggro * 0.75) : Math.max(this.def.aggro, this.effRange + 2);
        // sticky targeting: keep the current target while it's alive and still in sight (matters for Fervor)
        const keep = this.target && !this.target.dead && this.edgeDist(this.target) <= see + 2 && g.canSee(this.team, this.target);
        if (!keep) this.target = g.findNearestEnemy(this, see);
        this.retarget = 0.25 + Math.random() * 0.1;
      }
      engage = this.target;
      if (!engage) {
        const enemyTeam = 1 - this.team;
        if (g.distToBase(this, enemyTeam) <= this.effRange) engage = g.baseTarget(enemyTeam);
        else if (this.order.type === 'charge') goal = g.baseApproachPoint(this, enemyTeam);
        else if (this.order.type === 'attackMove') {
          goal = this.order.point;
          if (this.flatDist(goal) < 0.4) { this.order = { type: 'idle' }; goal = null; }
        }
      }
    }

    let attacking = false;
    if (this.stance === 'channel' || this.stance === 'standup' || this.casting) { engage = null; goal = null; attacking = true; }   // channeling: can't move or shoot
    if (this.dash) { engage = null; goal = null; }   // Tumble: rolling, no attacks or walking until it ends
    if (engage) {
      const dist = engage.isBase ? g.distToBase(this, engage.team) : this.edgeDist(engage);
      const tooClose = this.def.minRange && !engage.isBase && dist < this.minRange;   // Catapult: can't throw at its own feet
      if (tooClose) {
        // back off from it (and look for something else to shoot meanwhile)
        const dx = this.pos.x - engage.pos.x, dz = this.pos.z - engage.pos.z, d = Math.hypot(dx, dz) || 1;
        goal = { x: this.pos.x + dx / d * 3, z: this.pos.z + dz / d * 3 };
        if (engage === this.target) { this.target = null; this.retarget = 0; }
      } else if (dist <= this.effRange) {
        attacking = true;
        const tp = engage.isBase ? g.baseClosestPoint(this, engage.team) : engage.pos;
        this.faceTowards(tp.x - this.pos.x, tp.z - this.pos.z, dt, 14);
        this.aimT = 0.4;
        if (this.atkCd <= 0 && !this.disarmed) {
          this.onAttackStart(engage);
          this.atkCd = Math.max(this.atkCd, -0.1) + attackInterval(this.effAttackSpeed); // carry remainder: no frame-rate bias
          this.swing = 1;
          this.pendingHit = { t: this.rig.style === 'bow' ? 0.3 : this.rig.style === 'rifle' ? 0.04 : 0.16, target: engage };
        }
      } else {
        goal = engage.isBase ? g.baseClosestPoint(this, engage.team) : engage.pos;
      }
    }

    // movement + separation
    let vx = 0, vz = 0;
    if (goal && !attacking) {
      const wp = this.steer(goal, dt);
      const dx = wp.x - this.pos.x, dz = wp.z - this.pos.z;
      const len = Math.hypot(dx, dz);
      if (len > 0.05) {
        const sp = Math.min(this.effMoveSpeed, len / dt);
        vx = (dx / len) * sp; vz = (dz / len) * sp;
      }
    }
    let sx = 0, sz = 0;
    for (const u of g.units) {
      if (u === this || u.dead || u.flying !== this.flying) continue;   // flyers and walkers don't bump into each other
      const dx = this.pos.x - u.pos.x, dz = this.pos.z - u.pos.z;
      const min = this.radius + u.radius + 0.12;
      const d2 = dx * dx + dz * dz;
      if (d2 < min * min && d2 > 1e-6) {
        const dd = Math.sqrt(d2);
        const push = (min - dd) / min;
        sx += (dx / dd) * push; sz += (dz / dd) * push;
      } else if (d2 <= 1e-6) { sx += Math.random() - 0.5; sz += Math.random() - 0.5; }
    }
    let sepK = attacking ? 3 : 7;
    if (this.immobile) sepK = 0;   // prone troops are planted; others walk around them
    if (this.dash) {   // Tumble roll: fixed distance at a fixed speed, then back to normal
      const D = this.dash, st = Math.min(D.left, D.speed * dt);
      vx = D.dx * D.speed; vz = D.dz * D.speed; sepK = 0;
      this.pos.x += D.dx * st - vx * dt; this.pos.z += D.dz * st - vz * dt;   // cancels the generic step below
      D.left -= st;
      this.facing = Math.atan2(D.dx, D.dz);
      const f = 1 - D.left / D.total;                                        // the roll: duck forward + small hop
      this.rig.root.rotation.x = Math.sin(Math.PI * f) * 0.7; this.rig.root.position.y = Math.sin(Math.PI * f) * 0.35;
      if (D.left <= 1e-3) { this.dash = null; this.rig.root.rotation.x = 0; this.rig.root.position.y = 0; }
    }
    this.pos.x += (vx + sx * sepK) * dt; this.pos.z += (vz + sz * sepK) * dt;
    const lim = GAME.baseX - GAME.baseHalfX - this.radius;
    this.pos.x = Math.max(-lim, Math.min(lim, this.pos.x));
    this.pos.z = Math.max(-GAME.mapHalfWidth, Math.min(GAME.mapHalfWidth, this.pos.z));
    this.groundPos();
    const spd = Math.hypot(vx, vz);
    this.moving = spd > 0.3;
    if (this.moving) this.faceTowards(vx, vz, dt, 10);
    this.obj.position.copy(this.pos);
    this.obj.rotation.y = this.facing;

    this.animate(dt, spd);
    this.updateBar(camQuat);
  }

  /** Stunned (frozen in place) or feared (runs straight away from the source). No attacks, no casts. */
  updateCC(dt, camQuat) {
    const g = this.game;
    this.stunT = Math.max(0, (this.stunT || 0) - dt); this.fearT = Math.max(0, (this.fearT || 0) - dt);
    this.pendingHit = null; this.casting = null; this.swing = 0;
    const regen = this.stats.hpRegen + this.pas.bonusRegen;
    if (regen && this.hp < this.maxHp) this.hp = Math.min(this.maxHp, this.hp + regen * dt);
    let spd = 0;
    if (this.fearT > 0 && !(this.stunT > 0) && this.fearFrom) {
      let dx = this.pos.x - this.fearFrom.x, dz = this.pos.z - this.fearFrom.z; const d = Math.hypot(dx, dz) || 1; dx /= d; dz /= d;
      spd = this.stats.moveSpeed * (1 - this.slowPct / 100);
      this.pos.x += dx * spd * dt; this.pos.z += dz * spd * dt;
      const lim = GAME.baseX - GAME.baseHalfX - this.radius;
      this.pos.x = Math.max(-lim, Math.min(lim, this.pos.x)); this.pos.z = Math.max(-GAME.mapHalfWidth, Math.min(GAME.mapHalfWidth, this.pos.z));
      this.faceTowards(dx, dz, dt, 12);
    }
    this.moving = spd > 0.3;
    this.groundPos();
    this.obj.position.copy(this.pos); this.obj.rotation.y = this.facing;
    this.animate(dt, spd);
    this.updateBar(camQuat);
    return false;
  }
  /** Fire Splatter: arcing leap to the aimed point, then the explosion (Game.landLeap). */
  updateLeap(dt, camQuat) {
    const L = this.leap; L.t += dt;
    const f = Math.min(1, L.t / L.dur);
    this.pos.x = L.sx + (L.ex - L.sx) * f; this.pos.z = L.sz + (L.ez - L.sz) * f;
    this.groundPos();
    this.facing = Math.atan2(L.ex - L.sx, L.ez - L.sz);
    this.obj.position.copy(this.pos); this.obj.position.y += Math.sin(Math.PI * f) * Math.min(3, 0.6 + L.dist * 0.25);
    this.obj.rotation.y = this.facing;
    this.rig.root.rotation.x = -0.6 * Math.sin(Math.PI * f);
    this.updateBar(camQuat);
    if (f >= 1) { this.leap = null; this.rig.root.rotation.x = 0; this.game.landLeap(this, L.A); }
    return false;
  }

  /** Neutral creep brain: home -> chase (leashed) -> return (heals). Simple on purpose. */
  updateNeutral(dt, camQuat) {
    const g = this.game, R = CAMP_RULES;
    this.atkCd -= dt;
    if (this.slows.length) { for (const s of this.slows) s.t -= dt; this.slows = this.slows.filter((s) => s.t > 0); }
    if (this.kb) { const f = Math.min(1, dt / this.kb.t); this.pos.x += this.kb.x * f; this.pos.z += this.kb.z * f; this.kb.x *= 1 - f; this.kb.z *= 1 - f; this.kb.t -= dt; if (this.kb.t <= 0) this.kb = null; }
    this.updatePassive(dt);
    if (this.dead) return false;
    if (this.stunT > 0 || this.fearT > 0) return this.updateCC(dt, camQuat);
    const regen = this.stats.hpRegen + this.pas.bonusRegen;
    if (this.giveUpHealT > 0) this.giveUpHealT -= dt;
    if (this.hp < this.maxHp) this.hp = Math.min(this.maxHp, this.hp + (regen + (this.giveUpHealT > 0 ? this.maxHp * R.giveUpHeal.pct : 0)) * dt);
    if (this.pendingHit) { this.pendingHit.t -= dt; if (this.pendingHit.t <= 0) { this.releaseAttack(this.pendingHit.target); this.pendingHit = null; } }

    const home = this.home, fromHome = Math.hypot(this.pos.x - home.x, this.pos.z - home.z);
    let goal = null, attacking = false, speedMult = 1;
    // spawn box (the camp ring): chasing outside it is only allowed for a short window
    const box = this.camp ? { x: this.camp.x, z: this.camp.z } : home;
    this.inBox = Math.hypot(this.pos.x - box.x, this.pos.z - box.z) <= R.boxRadius;
    this.outT = this.nState === 'chase' && !this.inBox ? (this.outT || 0) + dt : 0;
    const giveUp = () => {
      this.nState = 'return'; this.nTarget = null; this.aggroTeam = null; this.outT = 0;
      this.giveUpHealT = R.giveUpHeal.time;   // neutral-brain only: hired copies of creeps never get this
      for (const x of this.abil) x.st.roll = undefined;
    };
    // day: anyone walking within 2 range wakes the camp. night: asleep until attacked.
    const night = g.dayNight?.night;
    this.sleeping = night && this.nState === 'home';
    if (this.nState === 'home' && !night) {
      this.scanT = (this.scanT || 0) - dt;
      if (this.scanT <= 0) {
        this.scanT = 0.25;
        const near = g.units.find((o) => !o.dead && !o.tower && o.team !== NEUTRAL_TEAM && this.edgeDist(o) <= R.dayAggroRange);
        if (near) g.neutralAggro(this, near);
      }
    }
    if (this.nState === 'chase') {
      let tg = this.nTarget;
      if (!tg || tg.dead || (tg.flying && !this.hitsAir)) {   // look for another enemy of the same team nearby (melee: no flyers)
        tg = this.nTarget = g.units.find((o) => !o.dead && !o.tower && o.team === this.aggroTeam && !(o.flying && !this.hitsAir) && this.edgeDist(o) < 7) || null;
      }
      if (!tg || fromHome > R.leash || this.outT > R.chaseWindow || g.time - this.lastHitT > R.giveUpAfter) giveUp();
      else {
        // actives: cast on their own when useful
        for (let i = 0; i < this.abil.length; i++) {
          const { def: A, st } = this.abil[i];
          if (A.kind !== 'active' || st.cd > 0) continue;
          if (A.id === 'brainwash') {
            // one 25% roll per chance (fight start / cooldown ready); a winning roll casts 1–4s later
            if (st.roll === undefined) { st.roll = Math.random() < A.castChance; st.delay = 1 + Math.random() * 3; }
            if (!st.roll || (st.delay -= dt) > 0) continue;
            const pool = g.units.filter((o) => !o.dead && !o.tower && !o.invulnerable && !o.brainwashed && o.team === this.aggroTeam && this.edgeDist(o) <= A.castRange);
            if (pool.length) { this.bwTarget = pool[Math.floor(Math.random() * pool.length)]; if (this.castAbility(i)) st.roll = undefined; }
          }
        }
        if (this.edgeDist(tg) <= this.effRange) {
          attacking = true;
          this.faceTowards(tg.pos.x - this.pos.x, tg.pos.z - this.pos.z, dt, 12);
          this.aimT = 0.4;
          if (this.atkCd <= 0 && !this.disarmed) {
            this.onAttackStart(tg);
            this.lastHitT = g.time;   // fighting keeps the creep engaged (not only being hit)
            this.atkCd = Math.max(this.atkCd, -0.1) + attackInterval(this.effAttackSpeed);
            this.swing = 1;
            this.pendingHit = { t: this.ranged ? 0.25 : 0.16, target: tg };
          }
        } else goal = tg.pos;
      }
    }
    if (this.nState === 'return') {
      goal = home; speedMult = 1.4;
      if (fromHome < 0.4) { this.nState = 'home'; goal = null; }
      else if (this.inBox && this.aggroTeam != null) this.nState = 'chase';   // hit again once back in the box: fight
    } else if (this.nState === 'home' && fromHome > 0.6) goal = home;

    let vx = 0, vz = 0;
    if (goal && !attacking) {
      const wp = this.steer(goal, dt);
      const dx = wp.x - this.pos.x, dz = wp.z - this.pos.z, len = Math.hypot(dx, dz);
      if (len > 0.05) { const sp = Math.min(this.effMoveSpeed * speedMult, len / dt); vx = dx / len * sp; vz = dz / len * sp; }
    }
    let sx = 0, sz = 0;
    for (const o of g.units) {
      if (o === this || o.dead || o.tower || o.flying !== this.flying) continue;
      const dx = this.pos.x - o.pos.x, dz = this.pos.z - o.pos.z, min = this.radius + o.radius + 0.12, d2 = dx * dx + dz * dz;
      if (d2 < min * min && d2 > 1e-6) { const dd = Math.sqrt(d2), push = (min - dd) / min; sx += dx / dd * push; sz += dz / dd * push; }
    }
    const k = attacking ? 3 : 6;
    this.pos.x += (vx + sx * k) * dt; this.pos.z += (vz + sz * k) * dt;
    this.pos.z = Math.max(-GAME.mapHalfWidth, Math.min(GAME.mapHalfWidth, this.pos.z));
    this.groundPos();
    const spd = Math.hypot(vx, vz);
    this.moving = spd > 0.3;
    if (this.moving) this.faceTowards(vx, vz, dt, 10);
    this.obj.position.copy(this.pos);
    this.obj.rotation.y = this.facing;
    this.animate(dt, spd);
    this.updateBar(camQuat);
    return false;
  }

  // ---------------- deployable buildings (artillery) ----------------
  get built() { return !this.structure || this.buildT >= this.structure.buildTime; }
  /** Barracks tweaks for this building type (minRange / splash), from `structureMods` upgrade effects. */
  get structMods() { return this.game.teams?.[this.team]?.structMods?.[this.def.id] || {}; }
  get minRange() { return Math.max(0, (this.structure?.minRange || this.def.minRange || 0) + (this.structMods.minRange || 0)); }
  get splashRadius() { return (this.structure?.splash || 0) + (this.structMods.splash || 0); }
  /**
   * Turn this building into its (level, path) version from BUILD_TREES: new stat sheet + structure block,
   * new model (same position / facing), HP keeps its percentage. Used by upgrades and the Dev Lab.
   */
  applyBuildLevel(level, path) {
    const id = this.def.id, def = buildingDef(id, level, path);
    this.def = def; this.structure = def.structure; this.bLevel = level; this.bPath = path;
    this.recalcStats();
    const old = this.rig, rig = UNIT_BUILDERS[id](level, path);
    rig.root.scale.setScalar(1.25 * (rig.scale || 1));
    this.obj.remove(old.root); this.obj.add(rig.root);
    old.matList.forEach((m) => m.dispose());
    this.rig = rig; this.shotIdx = 0; this.recoilT = 0;
    this.bar.position.y = (rig.barY || 2.95) * (rig.scale || 1) + 0.2;
    this.target = null;
    if (this.built) this.game.activateStructure?.(this);   // new true sight (Vulcan CIWS), also in the Dev Lab
  }
  /** Can this building fire at `o` right now (alive, visible, not flying, between min and max range)? */
  canShell(o) {
    if (!o || o.dead || o.tower || o.team === this.team) return false;
    if (o.team === NEUTRAL_TEAM && o.aggroTeam !== this.team) return false;
    if (this.structure.groundOnly && o.flying) return false;
    if (!this.game.canSee(this.team, o)) return false;
    const d = this.edgeDist(o);
    return d >= this.minRange && d <= this.effRange;
  }
  /** Artillery picks the target whose splash would hit the most enemies (ties: the closest). */
  pickShellTarget() {
    const g = this.game, r = this.splashRadius;
    let best = null, bs = -1;
    for (const o of g.units) {
      if (!this.canShell(o)) continue;
      let n = 0;
      for (const e of g.units) if (!e.dead && e.team === o.team && !e.tower && !(this.structure.groundOnly && e.flying) && Math.hypot(e.pos.x - o.pos.x, e.pos.z - o.pos.z) <= r) n++;
      const score = n * 100 - this.edgeDist(o);
      if (score > bs) { bs = score; best = o; }
    }
    return best;
  }
  /** Building brain: construction, then turn to the target, elevate, fire a shell (Game.fireShell), recoil. */
  updateStructure(dt, camQuat) {
    const g = this.game, S = this.structure, r = this.rig;
    if (this.flash > 0) { this.flash = Math.max(0, this.flash - dt * 6); const f = this.flash * 0.45; for (const m of r.matList) m.emissive.setRGB(f, f * 0.9, f * 0.9); }
    if (!this.built) {
      this.buildT += dt;
      const f = Math.min(1, this.buildT / S.buildTime);
      this.hp = Math.min(this.maxHp, this.hp + this.maxHp * 0.9 * dt / S.buildTime);   // 10% -> 100% while building
      r.scaffold.visible = true;
      r.yaw.scale.set(1, 0.2 + 0.8 * f, 1);
      if (this.built) { r.scaffold.visible = false; r.yaw.scale.set(1, 1, 1); g.onStructureBuilt(this); }
    } else {
      this.atkCd -= dt; this.retarget -= dt;
      if (this.upgrading) {   // upgrade scaffolding: keeps firing at the old level until it's done
        const U = this.upgrading; U.t += dt; r.scaffold.visible = true;
        if (U.t >= U.total) { this.upgrading = null; this.applyBuildLevel(U.level, U.path); g.onBuildingUpgraded(this); return false; }
      }
      const o = this.order;
      let tg = null;
      if (o.type === 'attack') { if (this.canShell(o.target)) tg = o.target; else if (!o.target || o.target.dead) this.order = { type: 'idle' }; }
      if (!tg) {
        if (this.retarget <= 0) { this.retarget = 0.3; if (!this.canShell(this.target)) this.target = this.pickShellTarget(); }
        tg = this.canShell(this.target) ? this.target : null;
      }
      if (tg) {
        const want = Math.atan2(tg.pos.x - this.pos.x, tg.pos.z - this.pos.z);
        let da = want - this.facing; da = Math.atan2(Math.sin(da), Math.cos(da));
        this.facing += Math.sign(da) * Math.min(Math.abs(da), dt * (S.turnRate || 2.4));   // heavy guns turn slowly
        const frac = Math.min(1, Math.max(0, this.edgeDist(tg) / Math.max(1, this.effRange)));
        if (r.barrel) r.barrel.rotation.x += (r.rest - frac * (S.shell === 'howitzer' ? 0.5 : S.fire === 'direct' ? 0.05 : 0.3) - r.barrel.rotation.x) * Math.min(1, dt * 4);
        this.aimT = 0.4;
        if (S.rain) {   // Arrow Storm Spire: an arrow rain on the target area every few seconds, on its own timer
          this.rainCd = (this.rainCd ?? S.rain.every * 0.5) - dt;
          if (this.rainCd <= 0) { this.rainCd = S.rain.every; g.fireRain(this, tg); }
        }
        if (Math.abs(da) < (S.fire === 'direct' ? 0.15 : 0.08) && this.atkCd <= 0 && !this.disarmed) {
          this.atkCd = Math.max(this.atkCd, -0.1) + attackInterval(this.effAttackSpeed);
          if (S.fire === 'direct') {                                // arrow / bullet like a ranged troop (can miss, hits flying)
            this.releaseAttack(tg);
            if (S.multishot > 1) g.fireExtraShots(this, tg, S.multishot - 1);   // Twin / Fire Archers: more targets per shot
          }
          else if (S.fire === 'volley') {                           // Hwacha / Grapeshot / MLRS: a fan of projectiles
            g.fireVolley(this, tg);
            if (S.volleyTargets > 1) g.fireExtraVolleys(this, tg, S.volleyTargets - 1);   // Whirlwind Battery: more targets per salvo
          }
          else if (S.fire === 'line') g.fireLine(this, tg);       // Railgun: instant piercing slug
          else g.fireShell(this, tg);                              // artillery shell
          this.shotIdx = (this.shotIdx + 1) % Math.max(1, r.muzzles?.length || 1);   // multi-barrel guns fire in turn
          this.recoilT = 1; this.muzzleT = S.fire === 'direct' ? 0.06 : 0.1;
        }
      } else if (r.barrel) r.barrel.rotation.x += (r.rest - r.barrel.rotation.x) * Math.min(1, dt * 2);
    }
    this.animate(dt, 0);   // recoil + muzzle flash
    // emplacement stays put, the gun turns: obj follows `facing` (so the HP bar math matches troops), body counter-rotates
    r.body.rotation.y = this.baseFacing - this.facing;
    r.yaw.rotation.y = this.facing - this.baseFacing;
    this.obj.position.copy(this.pos);
    this.obj.rotation.y = this.facing;
    this.updateBar(camQuat);
    return false;
  }

  /** Wall/roof troops: stand still, shoot anything in (extended) range, never take damage. */
  updateTower(dt, camQuat) {
    const g = this.game;
    this.atkCd -= dt; this.retarget -= dt;
    this.updatePassive(dt);
    if (this.dead) return false;
    if (this.pendingHit) { this.pendingHit.t -= dt; if (this.pendingHit.t <= 0) { this.releaseAttack(this.pendingHit.target); this.pendingHit = null; } }
    if (this.retarget <= 0) {
      this.retarget = 0.3;
      if (!this.target || this.target.dead || this.edgeDist(this.target) > this.effRange) this.target = g.findNearestEnemy(this, this.effRange + this.radius + 0.5);
    }
    const tg = this.target;
    this.moving = false;
    if (tg && !tg.dead && this.edgeDist(tg) <= this.effRange) {
      this.faceTowards(tg.pos.x - this.pos.x, tg.pos.z - this.pos.z, dt, 10);
      this.aimT = 0.4;
      if (this.atkCd <= 0 && !this.disarmed) {
        this.onAttackStart(tg);
        this.atkCd = Math.max(this.atkCd, -0.1) + attackInterval(this.effAttackSpeed);
        this.swing = 1;
        this.pendingHit = { t: this.rig.style === 'bow' ? 0.3 : 0.04, target: tg };
      }
    }
    this.obj.position.set(this.pos.x, this.yOff || 0, this.pos.z);
    this.obj.rotation.y = this.facing;
    this.animate(dt, 0);
    this.bar.visible = false;
    return false;
  }

  updateShield(dt) {
    this.invulnT = Math.max(0, this.invulnT - dt);
    const t = this.invulnT;
    this.shieldPing = Math.max(0, this.shieldPing - dt * 4);
    // steady glow, blinks during the last 1.2s, flashes when hit
    const blink = t < 1.2 ? (Math.floor(t * 8) % 2 ? 0.25 : 1) : 1;
    this.shieldFill.material.opacity = (0.16 + this.shieldPing * 0.35) * blink;
    this.shieldEdge.material.opacity = (0.6 + this.shieldPing * 0.4) * blink;
    this.shield.rotation.y += dt * 0.8;
    const pulse = 1 + Math.sin(performance.now() / 180) * 0.025 + this.shieldPing * 0.08;
    this.shield.scale.setScalar((this.rig.scale || 1) * pulse);
    if (t <= 0) this.shield.visible = false;
  }

  /** Next point to walk toward on the way to `goal`: straight if the line is clear, else an A* path (cached, re-planned when the goal moves or the map changes). */
  steer(goal, dt) {
    const T = this.game.terrain; if (!T || this.flying || this.phasing) return goal;   // flying / Vendetta: straight over everything
    const p = this.pos;
    const nav = this.nav || (this.nav = { gx: 1e9, gz: 1e9, path: null, t: 0, ver: -1, direct: true });
    nav.t -= dt;
    if (Math.hypot(goal.x - nav.gx, goal.z - nav.gz) > 1.2 || nav.t <= 0 || nav.ver !== T.version) {
      nav.gx = goal.x; nav.gz = goal.z; nav.ver = T.version;
      nav.direct = T.clearLine(p.x, p.z, goal.x, goal.z);
      nav.path = nav.direct ? null : T.findPath(p.x, p.z, goal.x, goal.z);
      nav.t = nav.direct ? 0.35 : 0.9 + Math.random() * 0.4;
    }
    if (nav.direct || !nav.path || !nav.path.length) return goal;
    while (nav.path.length > 1 && Math.hypot(nav.path[0].x - p.x, nav.path[0].z - p.z) < 0.7) nav.path.shift();
    if (nav.path.length === 1 && T.clearLine(p.x, p.z, goal.x, goal.z)) return goal;
    return nav.path[0];
  }
  /** Keep out of obstacles and stand on the terrain (river = low ground). */
  groundPos() {
    const T = this.game.terrain; if (!T) return;
    if (!this.flying && !this.phasing) T.resolve(this.pos, this.radius * 0.9);
    this.pos.y = T.heightAt(this.pos.x, this.pos.z) + (this.flying ? GAME.flyHeight : 0);
  }
  /** Vision radius right now (nightF 0 = day, 1 = night). */
  visionRadius(nightF = 0) {
    const v = this.def.vision || GAME.defaultVision;
    let r = v[0] + (v[1] - v[0]) * nightF;
    if (this.stance === 'prone') r += 3;
    if (this.tower) r = Math.max(r, this.effRange + 1);   // towers watch their whole range
    return r;
  }
  /** 0 = low ground (river), 1 = high ground */
  get groundLevel() { return this.flying ? 3 : this.structure?.highGround ? 2 : this.game.terrain ? this.game.terrain.level(this.pos.x, this.pos.z) : 1; }

  faceTowards(dx, dz, dt, rate) {
    if (Math.abs(dx) + Math.abs(dz) < 1e-4) return;
    const want = Math.atan2(dx, dz);
    let diff = want - this.facing;
    diff = Math.atan2(Math.sin(diff), Math.cos(diff));
    this.facing += diff * Math.min(1, rate * dt);
  }

  levelHeld() { const tilt = this.rig.body.rotation.x; for (const l of this.rig.level || []) l.obj.rotation.x = -l.arm.rotation.x - tilt + l.offset; }

  animate(dt, spd) {
    const r = this.rig;
    if (this.structure) {   // buildings: barrel recoil + muzzle flash + physicalized carriage rock & hydraulics
      if (this.swing > 0) { this.swing = 0; this.recoilT = 1; this.muzzleT = 0.12; }
      this.recoilT = Math.max(0, this.recoilT - dt * 2.5);
      const rt = Math.min(1, this.recoilT);

      if (r.rigType === 'cannon') {
        // Medieval Artillery: Physicalized carriage recoil and wheel-rocking
        if (r.recoils?.length > 1) {
          const S = this.structure, isVolley = S?.fire === 'volley' || S?.fire === 'line';
          const activeIdx = (this.shotIdx + r.recoils.length - 1) % r.recoils.length;
          r.recoils.forEach((rec, i) => {
            if (isVolley) {
              const stagger = Math.max(0, Math.min(1, rt * 1.3 - i * 0.08));
              rec.position.z = -0.42 * Math.sin(stagger * Math.PI / 2);
            } else {
              rec.position.z = (i === activeIdx) ? -0.42 * Math.sin(rt * Math.PI / 2) : 0;
            }
          });
        } else if (r.recoil) {
          r.recoil.position.z = -0.42 * Math.sin(rt * Math.PI / 2);
        }
        // Carriage wheel-rocking: chassis pitches up by ~4.3° (-0.075 rad) and rolls back
        if (r.chassisRock) {
          const rockPhase = Math.sin(rt * Math.PI);
          r.chassisRock.rotation.x = -0.075 * rockPhase;
          r.chassisRock.position.z = -0.10 * rockPhase;
        }
      } else if (r.rigType === 'howitzer') {
        // Modern Artillery: Two-stage hydraulic recoil
        // Stroke 1 (Kick): Instant slam back over ~0.04s
        // Stroke 2 (Recovery): Smooth pneumatic push forward with ease-out damping
        const hydr = rt > 0.82 ? 1 : Math.pow(rt / 0.82, 1.8);
        if (r.recoil) r.recoil.position.z = -0.48 * hydr;
        // Ground spade absorption / chassis settling
        if (r.chassisRock) {
          const shockPhase = Math.sin(rt * Math.PI);
          r.chassisRock.rotation.x = -0.025 * shockPhase;
          r.chassisRock.position.z = -0.04 * shockPhase;
        }
      } else {
        // Generic structure recoil
        if (r.recoil) r.recoil.position.z = -(this.structure.fire === 'direct' ? 0.1 : 0.45) * Math.sin(rt * Math.PI / 2);
        if (r.chassisRock) {
          r.chassisRock.rotation.x = 0;
          r.chassisRock.position.z = 0;
        }
      }

      this.muzzleT -= dt;
      const S = this.structure, all = S.fire === 'volley' || S.fire === 'line';   // volleys flash every barrel
      if (r.muzzles?.length > 1) r.muzzles.forEach((mz, i) => (mz.visible = this.muzzleT > 0 && (all || i === (this.shotIdx + r.muzzles.length - 1) % r.muzzles.length)));
      else if (r.muzzle) r.muzzle.visible = this.muzzleT > 0;

      // Auxiliary touchhole / vent smoke flash (independent or all in volley)
      if (r.touchholes?.length > 1) {
        const activeTh = (this.shotIdx + r.touchholes.length - 1) % r.touchholes.length;
        r.touchholes.forEach((th, i) => (th.visible = this.muzzleT > 0 && (all || i === activeTh)));
      } else {
        for (const th of r.touchholes || []) th.visible = this.muzzleT > 0;
      }
      // Auxiliary rocket back-blast exhaust
      if (r.exhaust) r.exhaust.visible = this.muzzleT > 0;
      // Auxiliary rotating drum / radar
      if (r.radar) r.radar.rotation.y += dt * 1.5;
      if (r.drum) r.drum.rotation.z += dt * 2.0;
      for (const sp of r.spins || []) sp.rotation.z += dt * 30 * Math.min(1, this.recoilT * 3);   // Gatling / minigun / CIWS barrels spin while firing
      // Auxiliary railgun capacitor glow pulsing
      if (r.glow) {
        const pulse = this.aimT > 0 ? (0.6 + 0.4 * Math.sin(Date.now() * 0.012)) : 0.25;
        for (const g of r.glow) if (g.material?.emissive) g.material.emissive.setRGB(0, 0.56 * pulse, 0.75 * pulse);
      }

      return;
    }
    this.aimT -= dt;
    if (r.fx) animateFx(r, dt);   // skill-tree form particles
    const lerp = THREE.MathUtils.lerp;
    if (this.moving) {
      this.walk += dt * spd * 3.4;
      const s = Math.sin(this.walk);
      r.legL.rotation.x = s * 0.7; r.legR.rotation.x = -s * 0.7;
      if (r.extraLegs) { r.extraLegs[0].rotation.x = -s * 0.7; r.extraLegs[1].rotation.x = s * 0.7; }
      r.body.position.y = Math.abs(Math.cos(this.walk)) * 0.07;
      if (r.style !== 'rifle') {
        r.armL.rotation.x = -0.5 - s * 0.3;
        if (this.swing <= 0) r.armR.rotation.x = -0.3 + s * 0.5;
      }
    } else {
      r.legL.rotation.x *= 0.8; r.legR.rotation.x *= 0.8;
      if (r.extraLegs) r.extraLegs.forEach((l) => (l.rotation.x *= 0.8));
      r.body.position.y *= 0.8;
    }

    if (r.style === 'bow') {
      const aiming = this.aimT > 0;
      const tgtL = aiming ? -1.5 : (this.moving ? r.armL.rotation.x : -0.5);
      r.armL.rotation.x += (tgtL - r.armL.rotation.x) * Math.min(1, dt * 12);
      if (this.swing > 0) {
        this.swing -= dt / Math.min(0.5, attackInterval(this.effAttackSpeed) * 0.8);
        const t = 1 - Math.max(0, this.swing);
        // draw (pull right hand back), release at ~60%, recover
        r.armR.rotation.x = t < 0.6 ? lerp(-1.5, -1.25, t / 0.6) : lerp(-0.9, -1.5, (t - 0.6) / 0.4);
        r.armR.rotation.z = t < 0.6 ? lerp(0, -0.35, t / 0.6) : 0;
        r.nockedArrow.visible = t < 0.6 || t > 0.95;
      } else if (aiming) { r.armR.rotation.x += (-1.5 - r.armR.rotation.x) * 0.3; r.armR.rotation.z = 0; r.nockedArrow.visible = true; }
      else if (!this.moving) { r.armR.rotation.x += (-0.3 - r.armR.rotation.x) * 0.15; r.armR.rotation.z = 0; }
    } else if (r.style === 'rifle') {
      // Snipe Stance: lerp into a prone pose (lying face-down, rifle forward on the ground)
      const st = this.stance;
      const ss = this.ability('snipeStance');
      const want = st === 'prone' ? 1 : st === 'channel' ? Math.min(1, 1 - ss.st.chT / ss.def.channel) : st === 'standup' ? Math.max(0, ss.st.chT / ss.def.standUp) : 0;
      this.proneT = (this.proneT || 0) + (want - (this.proneT || 0)) * Math.min(1, dt * 6);
      const pr = this.proneT;
      r.body.rotation.x = pr * Math.PI / 2;
      r.head.rotation.x = -pr * Math.PI / 2 * 0.9;   // tilt the head up so he looks down the scope, not into the dirt
      r.body.position.y = pr * 0.32 + (1 - pr) * r.body.position.y;
      if (pr > 0.02) { r.legL.rotation.x *= (1 - pr); r.legR.rotation.x *= (1 - pr); r.legL.rotation.z = -pr * 0.15; r.legR.rotation.z = pr * 0.15; }
      const aiming = this.aimT > 0;
      const base = lerp(aiming ? -1.45 : -1.15, -2.95, pr);
      let kick = 0;
      if (this.swing > 0) { this.swing -= dt / Math.min(0.18, attackInterval(this.effAttackSpeed) * 0.6); kick = Math.max(0, this.swing) * 0.25; }
      r.armR.rotation.x += (base + kick - r.armR.rotation.x) * Math.min(1, dt * 20);
      r.armL.rotation.x += (base - 0.15 + kick - r.armL.rotation.x) * Math.min(1, dt * 20);
      r.torso.position.z = -kick * 0.2;
      this.muzzleT -= dt;
      r.muzzle.visible = this.muzzleT > 0;
      if (r.muzzle.visible) r.muzzle.rotation.z = Math.random() * 3;
    } else {
      if (this.swing > 0) {
        this.swing -= dt / Math.min(0.38, attackInterval(this.effAttackSpeed) * 0.8);
        const t = 1 - Math.max(0, this.swing);
        r.armR.rotation.x = t < 0.4 ? lerp(-0.3, -2.7, t / 0.4) : lerp(-2.7, -0.2, Math.min(1, (t - 0.4) / 0.25));
        r.torso.rotation.y = t < 0.4 ? -0.25 * (t / 0.4) : -0.25 + 0.45 * Math.min(1, (t - 0.4) / 0.25);
        if (this.swing <= 0) r.torso.rotation.y = 0;
      } else if (!this.moving) {
        r.armR.rotation.x += (-0.3 - r.armR.rotation.x) * 0.15;
        r.armL.rotation.x += (-0.5 - r.armL.rotation.x) * 0.2;
      }
    }
    if (r.throwArm) {   // Catapult: wheels roll with movement; the arm flings forward on a throw, then winds back
      for (const w of r.wheels) w.rotation.x += spd * dt / 0.42;
      this.throwT = this.swing > 0 ? 1 - this.swing : Math.min(2, (this.throwT ?? 2) + dt * 0.5);
      const t = this.throwT;
      r.throwArm.rotation.x = t < 0.25 ? lerp(1.0, -0.55, t / 0.25) : t < 1 ? -0.55 : t < 2 ? lerp(-0.55, 1.0, t - 1) : 1.0;
      r.stone.visible = t < 0.2 || t >= 1.8;
    }
    if (r.batWings) {   // Batrider: big slow flaps, faster when moving
      this.animT = (this.animT || 0) + dt * (this.moving ? 9 : 5);
      const f = Math.sin(this.animT);
      r.batWings[0].rotation.z = -0.25 - f * 0.45; r.batWings[1].rotation.z = 0.25 + f * 0.45;
      r.torso.position.y = 0.9 + Math.cos(this.animT) * 0.08;
    }
    if (r.wingL) {   // imp: flapping wings + wagging tail, faster when running
      this.animT = (this.animT || 0) + dt * (this.moving ? 14 : 5);
      const f = Math.sin(this.animT) * (this.moving ? 0.55 : 0.25);
      r.wingL.rotation.y = -0.5 - f; r.wingR.rotation.y = 0.5 + f;
      r.tail.rotation.y = Math.sin(this.animT * 0.5) * 0.5;
    }
    if (r.style === 'beast') {   // bears bite with the head
      const t = this.swing > 0 ? 1 - this.swing : 0;
      const k = this.swing > 0 ? Math.sin(Math.min(1, t) * Math.PI) : 0;
      r.head.rotation.x = -k * 0.6; r.head.position.z = 0.9 + k * 0.3;
    }
    if (r.hover) {   // banshees float and bob
      this.bobT = (this.bobT || 0) + dt * 3;
      r.body.position.y = 0.35 + Math.sin(this.bobT) * 0.12;
    }
    if (this.invisible !== this._lookInvis) {   // own side sees an invisible troop as a ghost
      this._lookInvis = this.invisible;
      for (const m of r.matList) {
        if (m.userData.op0 === undefined) m.userData.op0 = { o: m.opacity, t: m.transparent };
        m.transparent = this.invisible || m.userData.op0.t; m.opacity = this.invisible ? 0.35 * m.userData.op0.o : m.userData.op0.o; m.needsUpdate = true;
      }
    }
    if (this.flying) {   // propellers + gentle bob; selection ring stays on the ground
      this.bobT = (this.bobT || 0) + dt * 2.5;
      r.body.position.y = Math.sin(this.bobT) * 0.15;
      if (r.props) for (const pr of r.props) pr.rotation.y += dt * 40;
      if (r.muzzle && r.style === 'drone') { this.muzzleT -= dt; r.muzzle.visible = this.muzzleT > 0; }
      this.ring.position.y = -GAME.flyHeight + 0.06;
    }
    if (this.curse || this.curseMark) {   // purple wisp over cursed units
      if (!this.curseMark) {
        this.curseMark = new THREE.Mesh(new THREE.OctahedronGeometry(0.18), new THREE.MeshBasicMaterial({ color: 0xb070ff, transparent: true, opacity: 0.85 }));
        this.obj.add(this.curseMark);
      }
      this.curseMark.visible = !!this.curse;
      if (this.curse) { this.curseMark.position.set(0, (r.barY || 2.95) * (r.scale || 1) * 1.25 + 0.55, 0); this.curseMark.rotation.y += dt * 4; }
    }
    if (this.zzz) {
      this.zzz.visible = !!this.sleeping;
      if (this.sleeping) { this.zT = ((this.zT || 0) + dt * 0.6) % 1; this.zzz.position.set(0.3 + this.zT * 0.3, 2.6 * (r.scale || 1) + this.zT * 0.7, 0); this.zzz.material.opacity = 1 - this.zT; }
    }
    this.levelHeld();

    if (this.flash > 0) {
      this.flash = Math.max(0, this.flash - dt * 6);
      const f = this.flash * 0.45;
      for (const m of r.matList) m.emissive.setRGB(f, f * 0.9, f * 0.9);
    }
  }

  updateBar(camQuat) {
    const mode = settings.graphics.hpBars;
    const show = mode === 'always' || (mode === 'damaged' && (this.hp < this.maxHp || this.selected)) || (mode === 'selected' && this.selected);
    this.bar.visible = show;
    if (!show) return;
    this.bar.quaternion.copy(camQuat).premultiply(yawQ.setFromAxisAngle(UP, -this.facing));
    const f = this.hp / this.maxHp;
    this.fill.scale.x = Math.max(0.001, f);
    this.fill.position.x = -(1 - f) / 2;
    // Shield (Combust): a silver segment after the HP (drawn over the end of the bar when HP is near full)
    const sh = this.shieldHp > 0 && this.shieldT > 0 ? Math.min(1, this.shieldHp / this.maxHp) : 0;
    if (sh > 0 && !this.shieldBar) { this.shieldBar = new THREE.Mesh(barGeo, barMat(0xd8dde4)); this.shieldBar.position.z = 0.002; this.shieldBar.renderOrder = 32; this.bar.add(this.shieldBar); }
    if (this.shieldBar) {
      this.shieldBar.visible = sh > 0;
      if (sh > 0) { const x0 = Math.min(f, 1 - sh); this.shieldBar.scale.set(sh, 0.11, 1); this.shieldBar.position.x = -0.5 + x0 + sh / 2; }
    }
  }
  /**
   * Mini Drones (Overseer / Overlord): untargetable pets around the drone. Each picks a random enemy around its
   * owner, flies toward it (never more than `leash` from the owner) and shoots with the owner's range and attack speed
   * for `dmgPct` of its damage (on-hit effects apply). Break grounds them (hidden, no shots) until it ends.
   */
  updateMiniDrones(dt) {
    const a = this.ability('miniDrones'), A = a.def, g = this.game;
    const D = (this.minis ||= []);
    while (D.length < A.count) {
      const mesh = buildMiniDrone(); g.scene.add(mesh);
      const ang = Math.random() * Math.PI * 2;
      D.push({ mesh, x: this.pos.x + Math.cos(ang) * 1.5, z: this.pos.z + Math.sin(ang) * 1.5, ox: Math.cos(ang) * 1.5, oz: Math.sin(ang) * 1.5, wanderT: 0, cd: Math.random() * 0.6, target: null, retT: 0 });
    }
    const grounded = this.broken;
    const interval = attackInterval(this.effAttackSpeed), reach = this.effRange + A.leash;
    for (const m of D) {
      m.mesh.visible = !grounded && this.obj.visible;
      if (grounded) { m.target = null; continue; }
      m.cd -= dt; m.retT -= dt; m.wanderT -= dt;
      if (m.target && (m.target.dead || Math.hypot(m.target.pos.x - this.pos.x, m.target.pos.z - this.pos.z) - m.target.radius > reach + 1 || !g.canSee(this.team, m.target))) m.target = null;
      if (!m.target && m.retT <= 0) {   // a random enemy around the owner
        m.retT = 0.3;
        const pool = g.units.filter((o) => this.isFoe(o) && g.canSee(this.team, o) && Math.hypot(o.pos.x - this.pos.x, o.pos.z - this.pos.z) - o.radius <= reach);
        m.target = pool.length ? pool[Math.floor(Math.random() * pool.length)] : null;
      }
      let gx, gz;
      if (m.target) {   // hover toward the target, leashed to the owner
        let dx = m.target.pos.x - this.pos.x, dz = m.target.pos.z - this.pos.z; const d = Math.hypot(dx, dz) || 1;
        const want = Math.min(A.leash, Math.max(0, d - this.effRange * 0.8));
        gx = this.pos.x + dx / d * want + m.ox * 0.3; gz = this.pos.z + dz / d * want + m.oz * 0.3;
      } else {          // idle: drift around the owner like a pet
        if (m.wanderT <= 0) { m.wanderT = 1 + Math.random() * 1.5; const ang = Math.random() * Math.PI * 2, r = 0.8 + Math.random() * 1.6; m.ox = Math.cos(ang) * r; m.oz = Math.sin(ang) * r; }
        gx = this.pos.x + m.ox; gz = this.pos.z + m.oz;
      }
      const k = Math.min(1, dt * 4); m.x += (gx - m.x) * k; m.z += (gz - m.z) * k;
      if (Math.hypot(m.x - this.pos.x, m.z - this.pos.z) > A.leash) { m.x = this.pos.x + m.ox * 0.5; m.z = this.pos.z + m.oz * 0.5; }   // strayed: snap back to the owner
      const y = (this.pos.y || 0) + 1.6 + Math.sin(g.time * 3 + m.ox) * 0.15;
      m.mesh.position.set(m.x, y, m.z);
      for (const p of m.mesh.userData.props || []) p.rotation.y += dt * 40;
      if (m.target) {
        m.mesh.rotation.y = Math.atan2(m.target.pos.x - m.x, m.target.pos.z - m.z);
        const inR = Math.hypot(m.target.pos.x - m.x, m.target.pos.z - m.z) - m.target.radius <= this.effRange + 0.5;
        if (inR && m.cd <= 0 && !this.disarmed && !this.ccd) {
          m.cd = interval * (0.9 + Math.random() * 0.2);
          g.fireProjectile(this, m.target, true, { extra: true, dmgMult: A.dmgPct, from: { x: m.x, y, z: m.z } });
        }
      }
    }
  }
  clearMiniDrones() { for (const m of this.minis || []) this.game.scene.remove(m.mesh); this.minis = null; }

  updateDeath(dt) {
    this.deathT += dt;
    const r = this.rig;
    const t = Math.min(1, this.deathT / 0.45);
    if (this.structure) { r.root.rotation.z = t * 0.25; this.obj.position.y = -this.deathT * 0.8; return this.deathT > 2.8; }
    r.root.rotation.x = -t * Math.PI / 2 * 0.98;
    r.root.position.y = t * 0.25;
    if (this.deathT > 1.2) this.obj.position.y = -(this.deathT - 1.2) * 0.9;
    if (this.flash > 0) {
      this.flash = Math.max(0, this.flash - dt * 6);
      for (const m of r.matList) m.emissive.setScalar(this.flash * 0.45);
    }
    if (r.muzzle) r.muzzle.visible = false;
    return this.deathT > 2.8; // true => remove
  }

  flatDist(p) { return Math.hypot(p.x - this.pos.x, p.z - this.pos.z); }
  edgeDist(u) { return Math.hypot(u.pos.x - this.pos.x, u.pos.z - this.pos.z) - this.radius - u.radius; }

  dispose() {
    if (this.minis) this.clearMiniDrones();
    this.obj.parent?.remove(this.obj);
    for (const m of this.rig.matList) m.dispose();
    for (const m of this.rig.extraMats || []) m.dispose();
    this.shieldFill.material.dispose(); this.shieldEdge.material.dispose();
  }
}
