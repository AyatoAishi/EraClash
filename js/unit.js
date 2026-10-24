// A single troop: brain (orders/targeting), body (movement/separation), visuals (anim/hp bar/ring).
import * as THREE from 'three';
import { UNITS, GAME, ITEMS, ABILITIES, DAMAGE_TYPES, defenseMult, attackInterval } from './config.js';
import { UPGRADES, STAT_BOOST } from './upgrades.js';
import { NEUTRAL_TEAM, CAMP_RULES } from './neutrals.js';
import { UNIT_BUILDERS, buildZzz, applyLook } from './models.js';
import { formDef } from './skilltree.js';
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
    this.items = new Array(GAME.invSlots).fill(null); // future: item ids from ITEMS
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
    this.pas = { bonusDamage: 0, bonusAS: 0, bonusRegen: 0, bonusEvasion: 0, bonusArmor: 0, bonusWard: 0, bonusRange: 0, armorPierce: 0, lifesteal: 0 };   // summed passive bonuses
    this.slows = [];                   // [{ pct, t }] movement slows (strongest applies)
    this.flying = !!this.def.flying;   // flying: hovers, ignores obstacles/terrain for movement & sight, melee can't hit it
    this.maxMana = this.def.mana || 0; this.mana = this.maxMana;
    this.breakT = 0;                   // Break debuff: passives disabled (except unbreakable ones)
    this.stillT = 0;                   // seconds standing still without attacking (Night Meld)
    this.invisible = false; this._lookInvis = false;
    this.syncAbilities();
    this.invulnT = GAME.spawnInvuln;   // spawn protection
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
  addSlow(pct, t) {
    if (this.invulnerable || this.tower || this.dead) return;
    this.slows.push({ pct, t });
  }
  /** Push away from a point (crowd control: ignored by invulnerable/tower/prone-immobile? no — prone gets pushed too). */
  knockback(from, dist) {
    if (this.invulnerable || this.tower || this.dead) return;
    const dx = this.pos.x - from.x, dz = this.pos.z - from.z, d = Math.hypot(dx, dz) || 1;
    this.kb = { x: dx / d * dist, z: dz / d * dist, t: 0.15 };
  }
  get slowPct() { return this.slows.reduce((m, s) => Math.max(m, s.pct), 0); }
  get armor() { return this.stats.armor + this.pas.bonusArmor - (this.shredT > 0 ? this.shred : 0); }
  get broken() { return this.breakT > 0; }
  /** Break: disables breakable passives for `t` seconds (Dota-style). */
  applyBreak(t) { if (this.invulnerable || this.tower || this.dead) return; this.breakT = Math.max(this.breakT, t); }
  /** Armor reduction debuff (strongest wins, refreshes). */
  applyShred(v, t) { if (this.tower || this.dead) return; if (!(this.shredT > 0) || v >= this.shred) this.shred = v; this.shredT = t; }
  /** Index of the k-th ACTIVE ability in this.abil (hotkeys Q W E R T map to actives in order). */
  activeSlot(k) { let n = -1; for (let i = 0; i < this.abil.length; i++) if (this.abil[i].def.kind === 'active' && ++n === k) return i; return -1; }
  get ward() { return this.stats.ward + this.pas.bonusWard; }
  /** Invulnerable: takes no damage and (future) can't be crowd-controlled. Can still be targeted. */
  get invulnerable() { return this.invulnT > 0; }
  get effRange() { return this.stats.range + (this.pas.bonusRange || 0) + (this.towerRange || 0); }
  get rangeRadius() { return this.effRange + this.radius; }
  /** Snipe Stance state: 'stand' | 'channel' | 'prone' (null if the troop has no stance) */
  get stance() { return this.ability('snipeStance')?.st.mode || null; }
  get immobile() { const m = this.stance; return m === 'channel' || m === 'prone' || m === 'standup' || !!this.casting; }
  get effMoveSpeed() { return this.immobile ? 0 : this.stats.moveSpeed * (1 - this.slowPct / 100) * (1 + (this.rallyT > 0 ? this.rallyBonus : 0)); }
  get damageTakenMult() { return this.stance === 'prone' ? this.ability('snipeStance').def.damageTakenMult : 1; }
  /** Projectile launch height (prone troops shoot from the ground) */
  get muzzleY() { return this.stance === 'prone' ? 0.45 : 1.75; }

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
    this.items[slot] = null;
    this.recalcStats();
    return id;
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
    const pierce = def === 'armor' ? (source?.pas?.armorPierce || 0) : 0;
    if (pierce) d = Math.max(Math.min(d, 0), d - pierce);            // ignores up to N armor, never below 0
    const dmg = Math.max(0, raw * (def ? defenseMult(d) : 1)) * this.damageTakenMult;
    if (dmg <= 0) return 0;
    this.hp -= dmg;
    this.flash = 1;
    const rs = this.ability('resentment');
    if (rs) { rs.st.acc = (rs.st.acc || 0) + dmg; if (rs.st.acc >= rs.def.threshold) { rs.st.acc = 0; rs.st.buffT = rs.def.duration; } }
    if (this.team === NEUTRAL_TEAM && this.hp > 0) this.game.neutralAggro(this, source);
    if (this.hp <= 0) { this.hp = 0; this.die(source); }
    return dmg;
  }

  die(source) {
    this.dead = true;
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
    const sum = { bonusDamage: 0, bonusAS: 0, bonusRegen: 0, bonusEvasion: 0, bonusArmor: 0, bonusWard: 0, bonusRange: 0, armorPierce: 0, lifesteal: 0 };
    if (this.maxMana && this.mana < this.maxMana) this.mana = Math.min(this.maxMana, this.mana + (this.def.manaRegen || 0) * dt);
    if (this.breakT > 0) this.breakT -= dt;
    if (this.shredT > 0) this.shredT -= dt;
    if (this.rallyT > 0) this.rallyT -= dt;
    if (this.curse) { this.curse.t -= dt; if (this.curse.t <= 0) this.curse = null; }
    if (this.fury) { this.fury.t -= dt; if (this.fury.t <= 0) this.fury = null; }
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
        s.bonusDamage = s.bonusAS = s.bonusRegen = s.bonusEvasion = s.bonusArmor = s.bonusWard = s.bonusRange = s.lifesteal = 0;
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
        s.bonusAS = s.stacks * P.perStack;
        s.active = s.stacks > 0;
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
      sum.bonusDamage += s.bonusDamage; sum.bonusAS += s.bonusAS; sum.bonusRegen += s.bonusRegen; sum.bonusEvasion += s.bonusEvasion; sum.bonusArmor += s.bonusArmor || 0; sum.bonusWard += s.bonusWard || 0; sum.bonusRange += s.bonusRange || 0; sum.lifesteal += s.lifesteal || 0;
    }
    this.invisible = invis;
    if (this.curseHasteT > 0) sum.bonusAS += this.curseHaste || 0;
    // auras received: every aura ability (def.aura) from allies in range. The same aura never stacks (strongest
    // copy wins); different auras add up. A broken aura carrier stops emitting.
    this.auraScan = (this.auraScan || 0) - dt;
    if (this.auraScan <= 0) {
      this.auraScan = 0.2;
      const got = {};
      for (const u of this.game.units) {
        if (u.dead || u.team !== this.team || !u.abil.length) continue;
        for (const { def: A } of u.abil) {
          if (!A.aura || (u.broken && !A.unbreakable)) continue;
          const r = A.aura.radius;
          if ((u.pos.x - this.pos.x) ** 2 + (u.pos.z - this.pos.z) ** 2 > r * r) continue;
          const cur = (got[A.id] ||= {});
          for (const [k, v] of Object.entries(A.aura)) if (k !== 'radius') cur[k] = Math.max(cur[k] || 0, v);
        }
      }
      this.auraBonus = { bonusArmor: 0, bonusWard: 0, bonusRegen: 0, bonusDamage: 0, bonusAS: 0 };
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
    if (tg && tg.curse && tg.curse.t > 0) { this.curseHasteT = tg.curse.def.hasteTime; this.curseHaste = tg.curse.def.hasteAS; }
    if (tg && tg.team !== undefined) this.game.vision?.reveal(this, tg.team);   // attacking gives your position away
    const f = this.ability('fervor');
    if (f) { if (f.st.target !== tg) { f.st.target = tg; f.st.stacks = 0; } f.st.sinceAttack = 0; }
  }
  /** Called after the attack has been released (damage dealt / projectile fired). */
  onAttackDone() {
    const f = this.ability('fervor');
    if (f) { f.st.stacks = Math.min(f.def.maxStacks, f.st.stacks + 1); f.st.bonusAS = f.st.stacks * f.def.perStack; f.st.active = true; }
  }

  /** Damage for one hit: base + items + passives, ±variance, maybe a crit. Sets this.lastCrit. */
  rollDamage() {
    let d = this.effDamage + Math.round((Math.random() * 2 - 1) * GAME.dmgVariance);
    this.lastCrit = false;
    const be = this.ability('bullsEye');
    if (be) {
      const L = this.upLevel('hollowPoints'), HP = UPGRADES.hollowPoints;     // Hollow Points upgrade
      const every = L >= HP.max ? 3 : be.def.every;
      const crit = be.def.critBonus + (L ? HP.values.critBonus[L - 1] : 0);
      be.st.stacks = (be.st.stacks || 0) + 1;
      if (be.st.stacks >= every) { be.st.stacks = 0; d = Math.round(d * (1 + crit)); this.lastCrit = true; }
    }
    const cs = this.ability('critStrike');
    if (cs && !cs.st.broken && Math.random() < cs.def.chance) {
      const L = Math.max(1, this.upLevel('criticalStrike'));
      d = Math.round(d * (1 + cs.def.bonus[L - 1])); this.lastCrit = true;
    }
    const e = this.ability('eagleEye');
    if (e && Math.random() < e.def.chance) { d += e.def.bonusDamage; this.lastCrit = true; }
    return d;
  }

  /** After an attack's damage lands (melee or projectile): lifesteal, on-hit slows. */
  onAttackLanded(tg, dealt, raw = 0, crit = false) {
    if (dealt > 0) this.game.emit('hitDmg', tg.pos, dealt, crit, this.team);
    if (this.pas.lifesteal && dealt > 0 && !this.dead) this.hp = Math.min(this.maxHp, this.hp + dealt * this.pas.lifesteal / 100);
    const g = this.game;
    // Banshee Curse: mark the target (rises for our side if it dies while cursed)
    const bc = this.ability('bansheeCurse');
    if (bc && !bc.st.broken && !tg.dead && !tg.tower) tg.curse = { t: bc.def.duration, team: this.team, src: this, def: bc.def };
    // Fury stacks on the target (any Frenzy line Viking put them there): every troop of that type on that
    // team deals +perStack damage per stack. Then a Fury carrier adds/refreshes a stack.
    const fz = tg.fury;
    if (fz && fz.t > 0 && fz.team === this.team && fz.unit === this.def.id && !tg.dead && fz.stacks > 0) this.damageDealt += tg.takeDamage(fz.stacks * fz.per, this, 'physical');
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
    if (!a || this.dead || a.def.kind !== 'active' || a.st.cd > 0 || this.casting) return false;
    if ((a.def.manaCost || 0) > this.mana) return false;
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
    if (!a) return false;
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

  /** AI decides whether to use its actives. */
  aiCast() {
    for (let i = 0; i < this.abil.length; i++) {
      const { def: A, st } = this.abil[i];
      if (A.kind !== 'active' || st.cd > 0 || !(A.aiCast || A.ai)) continue;
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
      if (A.id === 'shieldStomp' && this.aimT > 0 && this.game.enemiesInRadius(this, A.radius + 0.3).length) { this.castAbility(i); continue; }
      if (A.id === 'splatter') {
        const n = this.game.enemiesInRadius(this, A.radius).length;
        if (n >= A.aiCast.minTargets || (n >= 1 && this.hp / this.maxHp < A.aiCast.lowHpPct)) this.castAbility(i);
      }
    }
  }

  releaseAttack(tg) {
    const g = this.game;
    if (this.ranged) {
      if (tg.isBase || !tg.dead) { g.fireProjectile(this, tg); this.onAttackDone(); }
      if (this.rig.muzzle) this.muzzleT = 0.06;
      return;
    }
    if (tg.isBase) g.damageBase(tg.team, this.rollDamage(), this);
    else if (!tg.dead && this.edgeDist(tg) <= this.effRange + 0.6) {
      const dodge = tg.dodgeCheck(this);
      if (dodge) { g.onDodge(this, tg, dodge); this.onAttackDone(); return; }
      const raw = this.rollDamage();
      const dealt = tg.takeDamage(raw, this, this.def.damageType || 'physical', { attack: true, ranged: false });
      this.damageDealt += dealt;
      this.onAttackLanded(tg, dealt, raw, this.lastCrit);
      g.onHit(this, tg);
      this.onAttackDone();
    }
  }

  // ------------------------------------------------------------
  update(dt, camQuat) {
    if (this.dead) return this.updateDeath(dt);
    const g = this.game, s = this.stats;
    if (this.tower) return this.updateTower(dt, camQuat);
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
    if (g.teams[this.team].isAI && this.abil.length) { this.aiT = (this.aiT || 0) - dt; if (this.aiT <= 0) { this.aiT = 0.3; this.aiCast(); if (this.dead) return false; } }
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
      else if (o.target.flying && !this.ranged) this.command({ type: 'attackMove', point: { x: o.target.pos.x, z: o.target.pos.z } });   // melee can't hit flyers
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
    if (engage) {
      const dist = engage.isBase ? g.distToBase(this, engage.team) : this.edgeDist(engage);
      if (dist <= this.effRange) {
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

  /** Neutral creep brain: home -> chase (leashed) -> return (heals). Simple on purpose. */
  updateNeutral(dt, camQuat) {
    const g = this.game, R = CAMP_RULES;
    this.atkCd -= dt;
    if (this.slows.length) { for (const s of this.slows) s.t -= dt; this.slows = this.slows.filter((s) => s.t > 0); }
    if (this.kb) { const f = Math.min(1, dt / this.kb.t); this.pos.x += this.kb.x * f; this.pos.z += this.kb.z * f; this.kb.x *= 1 - f; this.kb.z *= 1 - f; this.kb.t -= dt; if (this.kb.t <= 0) this.kb = null; }
    this.updatePassive(dt);
    if (this.dead) return false;
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
      if (!tg || tg.dead || (tg.flying && !this.ranged)) {   // look for another enemy of the same team nearby (melee: no flyers)
        tg = this.nTarget = g.units.find((o) => !o.dead && !o.tower && o.team === this.aggroTeam && !(o.flying && !this.ranged) && this.edgeDist(o) < 7) || null;
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
    const T = this.game.terrain; if (!T || this.flying) return goal;   // flying: straight over everything
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
    if (!this.flying) T.resolve(this.pos, this.radius * 0.9);
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
  get groundLevel() { return this.flying ? 3 : this.game.terrain ? this.game.terrain.level(this.pos.x, this.pos.z) : 1; }

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
    this.aimT -= dt;
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
  }

  updateDeath(dt) {
    this.deathT += dt;
    const r = this.rig;
    const t = Math.min(1, this.deathT / 0.45);
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
    this.obj.parent?.remove(this.obj);
    for (const m of this.rig.matList) m.dispose();
    this.shieldFill.material.dispose(); this.shieldEdge.material.dispose();
  }
}
