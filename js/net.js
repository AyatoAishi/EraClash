// ============================================================
//  ONLINE 1v1 (host / guest)
//
//  The HOST's browser runs the real match (Game.update, AI-free, both teams human). The GUEST's browser runs a
//  MIRROR: a Game whose simulation is switched off. It shows what the host sends ~10x a second (units, bases,
//  team state, effects) and forwards every order the guest gives (unit commands, casts, hiring, research...) to
//  the host, which checks it belongs to the guest's team and applies it.
//
//  Transport: server.js /ws relay (room codes). Messages are { t: 'relay', d: payload }.
//    host -> guest   { k: 'snap', ... }        world state + effects since the last snapshot
//                    { k: 'err', msg }         an order the host refused (shown as a toast)
//                    { k: 'chat', text }
//    guest -> host   { k: 'u', id, m, a }      unit method (command / castAbility / interrupt / useItem)
//                    { k: 'g', m, a }          game method (train, research, build ...)
//                    { k: 'rally', v } / { k: 'auto', ids, ab, on } / { k: 'chat', text }
// ============================================================
import * as THREE from 'three';
import { Unit } from './unit.js';
import { GAME, ITEMS, UNITS } from './config.js';
import { boxGeo, buildArrow, buildBullet, buildSpear, buildWisp, buildRocket, buildShell, buildCannonball, buildLoot } from './models.js';
import { sfx } from './audio.js';

const SNAP_EVERY = 0.066; // seconds between host snapshots (15/s: the joiner sees the field ~35ms sooner than at 10/s)
const SMOOTH = 14;        // guest position/facing blend rate (per second): higher = tighter to the host, less visual lag
const r1 = (x) => Math.round(x * 10) / 10, r2 = (x) => Math.round(x * 100) / 100;

// ---------------- connection ----------------
export class NetClient {
  constructor() { this.ws = null; this.handlers = {}; this.queue = []; }
  on(t, fn) { this.handlers[t] = fn; }
  connect() {
    if (this.ws && this.ws.readyState <= 1) return Promise.resolve();
    return new Promise((res, rej) => {
      const url = (location.protocol === 'https:' ? 'wss://' : 'ws://') + location.host + '/ws';
      const ws = this.ws = new WebSocket(url);
      ws.onopen = () => { for (const m of this.queue) ws.send(m); this.queue = []; res(); };
      ws.onerror = () => rej(new Error('Could not reach the game server'));
      ws.onclose = () => { this.handlers.closed?.(); };
      ws.onmessage = (e) => {
        let m; try { m = JSON.parse(e.data); } catch { return; }
        if (m.t === 'relay') this.handlers.data?.(m.d);
        else this.handlers[m.t]?.(m);
      };
    });
  }
  raw(obj) { const s = JSON.stringify(obj); if (this.ws?.readyState === 1) this.ws.send(s); else this.queue.push(s); }
  send(d) { this.raw({ t: 'relay', d }); }
  create(faction, name) { this.raw({ t: 'create', faction, name }); }
  join(code, name) { this.raw({ t: 'join', code, name }); }
  leave() { this.raw({ t: 'leave' }); }
  close() { try { this.ws?.close(); } catch {} this.ws = null; }
}

// ---------------- (de)serialising references ----------------
const serArg = (v) => {
  if (v && typeof v === 'object') {
    if (v instanceof Unit) return { $u: v.id };
    if (v.isBase) return { $b: v.team };
    if (v.uid !== undefined && v.mesh) return { $l: v.uid };   // loot
    if (Array.isArray(v)) return v.map(serArg);
    const o = {}; for (const [k, x] of Object.entries(v)) o[k] = serArg(x); return o;
  }
  return v;
};
function deserArg(g, v) {
  if (v && typeof v === 'object') {
    if (v.$u !== undefined) return g.units.find((u) => u.id === v.$u) || null;
    if (v.$b !== undefined) return g.bases[v.$b];
    if (v.$l !== undefined) return g.loot.find((L) => L.uid === v.$l) || null;
    if (Array.isArray(v)) return v.map((x) => deserArg(g, x));
    const o = {}; for (const [k, x] of Object.entries(v)) o[k] = deserArg(g, x); return o;
  }
  return v;
}
const posOf = (p) => (p ? { x: r2(p.x), z: r2(p.z), y: p.y !== undefined ? r2(p.y) : undefined } : null);

// Team fields the guest needs to draw its HUD (gold, queue, research, Barracks, skill trees...)
const TEAM_KEYS = ['gold', 'income', 'queue', 'queuePaid', 'upLevels', 'structMods', 'unitMods', 'costAdd', 'grants', 'troopXp', 'forms',
  'research', 'rqueue', 'towers', 'trainT', 'stats', 'upgrades', 'repairOn', 'rally', 'autoLoot', 'faction'];
// Unit status scalars mirrored for the selection panel / status row
const STATUS_KEYS = ['invulnT', 'stunT', 'fearT', 'silenceT', 'silenceSpell', 'disarmT', 'breakT', 'burnT', 'burnDps', 'burnType', 'poisonT', 'poisonDps', 'acidT',
  'shredT', 'shred', 'trueStrikeT', 'curseHasteT', 'curseHaste', 'grudgeT', 'grudgeAS', 'helmetT', 'helmetArmor', 'rallyT', 'rallyBonus', 'giveUpHealT',
  'vendettaT', 'shieldHp', 'shieldT', 'weakenUntil', 'weakenPct', 'galeUntil', 'galeBonus', 'kills', 'damageDealt', 'invisible', 'bLevel', 'bPath', 'buildT'];
const ABIL_KEYS = ['cd', 'auto', 'on', 'mode', 'stacks', 'buffT', 'active', 'broken', 'charges', 'acc', 'bonusAS', 'bonusDamage'];

// =====================================================================
//  HOST: runs the match, sends snapshots, applies the guest's orders
// =====================================================================
export class NetHost {
  constructor(app, game, net, guestTeam) {
    this.app = app; this.g = game; this.net = net; this.guest = guestTeam;
    this.acc = 0; this.fx = []; this.sent = new WeakSet(); this.last = new Map();   // per unit: last sent static / status JSON
    this.lastLoot = '';
    game.netHost = this;
    const g = game;
    // effects: record the call (before the host's own fog check), then run it normally
    for (const name of ['burst', 'ring', 'tracer']) {
      const orig = g[name].bind(g);
      g[name] = (...a) => { this.fx.push([name, posOf(a[0]), ...(name === 'tracer' ? [posOf(a[1]), a[2], a[3]] : a.slice(1))]); return orig(...a); };
    }
    const tether = g.tether.bind(g);
    g.tether = (a, b, life) => { this.fx.push(['tether', a.id, b.id, life]); return tether(a, b, life); };
    // attacks reveal the attacker to the victim's fog: the joiner's fog runs on its own copy, so replay it there
    if (g.vision) { const reveal = g.vision.reveal.bind(g.vision); g.vision.reveal = (u, t) => { this.fx.push(['reveal', u.id, t]); return reveal(u, t); }; }
    // 'form' / 'troopLevel' / 'baseLevel' drive the joiner's shop, skill tree and HUD: without them the joiner never rebuilds those
    const FWD = new Set(['hitDmg', 'crit', 'heal', 'dodge', 'bounty', 'baseDestroyed', 'upgrade', 'built', 'buildingUpgraded', 'demolish', 'pickup', 'disarm', 'brainwash', 'repair', 'autoLoot', 'cc', 'form', 'troopLevel', 'baseLevel', 'invFull']);
    const emit = g.emit.bind(g);
    g.emit = (evt, ...a) => { if (FWD.has(evt)) this.fx.push(['emit', evt, ...a.map((x) => (x instanceof Unit ? { $u: x.id } : x && typeof x === 'object' && 'x' in x ? posOf(x) : x))]); return emit(evt, ...a); };
    const update = g.update.bind(g);
    g.update = (dt, cq) => { update(dt, cq); this.tick(dt); };
    net.on('data', (d) => this.onData(d));
  }
  /** Every frame: catch new projectiles / shells / beams / skillshots; every SNAP_EVERY: send a snapshot. */
  tick(dt) {
    const g = this.g;
    for (const p of g.projectiles) if (!this.sent.has(p)) {
      this.sent.add(p);
      this.fx.push(['proj', p.src?.id, posOf(p.start), p.target.isBase ? { $b: p.target.team, ...posOf(p.end) } : { $u: p.target.id }, p.speed, p.arc, p.kind, p.crit ? 1 : 0, p.shot?.missile ? 'rocket' : null, p.dist0]);
    }
    for (const s of g.shells) if (!this.sent.has(s)) { this.sent.add(s); this.fx.push(['shell', posOf(s.start), posOf(s.end), s.T, s.apex, -s.t, s.small ? 1 : 0, s.marker ? s.splash : 0, s.mesh.scale.x]); }
    for (const b of g.beams) if (!this.sent.has(b)) { this.sent.add(b); this.fx.push(['beam', posOf(b.from || b.mesh.position), posOf(b.to || b.mesh.position), b.bolt ? 1 : 0, b.mesh.material?.color?.getHex?.() ?? 0x80f0ff, b.mesh.scale.z, b.mesh.rotation.y, posOf(b.mesh.position)]); }
    for (const s of g.skillshots) if (!this.sent.has(s)) { this.sent.add(s); this.fx.push(['shot', r2(s.x), r2(s.z), r2(s.dx), r2(s.dz), s.speed, s.left, s.fx ? 1 : 0]); }
    this.acc += dt;
    if (this.acc < SNAP_EVERY) return;
    this.acc = 0;
    this.net.send(this.snapshot());
  }
  snapshot() {
    const g = this.g, units = [], alive = new Set();
    for (const u of g.units) {
      alive.add(u.id);
      const row = { i: u.id, x: r2(u.pos.x), z: r2(u.pos.z), r: r2(u.facing), h: r1(u.hp), m: u.maxMana ? r1(u.mana) : undefined, mv: u.moving ? 1 : 0, an: u.atkN || 0, d: u.dead ? 1 : 0, ac: u.casting ? 1 : 0, o: u.order?.type };
      if (u.structure) {   // turrets/artillery: turret heading is `r`, the emplacement stays put; these drive the guest's visuals
        const U = u.upgrading;
        row.ug = U ? { t: r1(U.t), total: U.total, level: U.level, path: U.path ?? null, name: U.name } : 0;
        row.si = u.shotIdx || 0;
        if (u.rig?.barrel) row.el = r2(u.rig.barrel.rotation.x);
      }
      // static-ish part: only when it changed
      const k = { d: u.def.id, t: u.team, f: u.form || null, tw: u.tower ? [u.yOff, u.towerRange || 0] : 0, bf: u.structure ? r2(u.baseFacing ?? u.facing) : undefined, it: u.items, s: STAT_ARR(u.stats), b: STAT_ARR(u.base || u.stats),
        p: [u.pas.bonusDamage, u.pas.bonusAS, u.pas.bonusArmor, u.pas.bonusWard, u.pas.bonusRange, u.pas.bonusMS || 0, u.pas.bonusRegen, u.pas.bonusEvasion].map(r2), mm: u.maxMana || 0, bl: u.bLevel || 0, bp: u.bPath || null, fl: u.flying ? 1 : 0, au: u.auras || [] };
      const ks = JSON.stringify(k);
      const st = { a: u.abil.map((A) => [A.def.id, ...ABIL_KEYS.map((key) => { const v = A.st[key]; return typeof v === 'number' ? r1(v) : v ?? null; })]),
        x: STATUS_KEYS.map((key) => { const v = u[key]; return typeof v === 'number' ? r1(v) : v ?? null; }),
        sl: u.slows.length ? u.slows.reduce((m, s) => (s.pct > m[0] ? [s.pct, r1(s.t)] : m), [0, 0]) : 0, bs: u.breakerStacks?.length ? u.breakerStacks.map(r1) : 0,
        ad: u.armorDebuffs ? Object.fromEntries(Object.entries(u.armorDebuffs).map(([key, d]) => [key, { v: d.v, until: r1(d.until), stacks: d.stacks }])) : 0 };
      const ss = JSON.stringify(st);
      const prev = this.last.get(u.id) || {};
      if (prev.k !== ks) { row.k = k; prev.k = ks; }
      if (prev.s !== ss) { row.st = st; prev.s = ss; }
      this.last.set(u.id, prev);
      units.push(row);
    }
    for (const id of this.last.keys()) if (!alive.has(id)) this.last.delete(id);
    const fx = this.fx; this.fx = [];
    return {
      k: 'snap', time: r2(g.time), over: g.over, winner: g.winner,
      bases: g.bases.map((b) => [r1(b.hp), b.maxHp, b.level, b.armor, b.dead ? 1 : 0, b.bonusHp || 0]),
      teams: g.teams.map((T) => Object.fromEntries(TEAM_KEYS.map((key) => [key, T[key]]))),
      units, loot: g.loot.map((L) => [L.uid, L.id, r2(L.x), r2(L.z), L.blinkOff ? 1 : 0]),
      fires: (g.fires || []).map((F) => [r2(F.x), r2(F.z), F.r, 0]).concat((g.acids || []).map((P) => [r2(P.x), r2(P.z), r2(P.r), 1])),
      fx,
    };
  }
  refuse(msg) { if (msg && typeof msg === 'string') this.net.send({ k: 'err', msg }); }
  /** An order from the guest: only for the guest's own troops / team. */
  onData(d) {
    const g = this.g, gt = this.guest;
    if (d.k === 'chat') { this.app.chat?.line(`[Opponent]: ${String(d.text).slice(0, 200)}`, 'me'); return; }
    if (g.over) return;
    if (d.k === 'u') {
      const u = g.units.find((x) => x.id === d.id);
      if (!u || u.dead || u.team !== gt || u.tower) return;
      const a = deserArg(g, d.a || []);
      if (d.m === 'command') { const o = a[0] || {}; if (o.type === 'pickup' && !o.loot) return; u.command(o); }
      else if (d.m === 'castAbility') { const i = u.abil.findIndex((A) => A.def.id === a[0]); if (i >= 0) u.castAbility(i, a[1] || null); }
      else if (d.m === 'interrupt') u.interrupt();
      else if (d.m === 'useItem') this.refuse(u.useItem(a[0]));
      return;
    }
    if (d.k === 'g') {
      const a = deserArg(g, d.a || []);
      const team = ['train', 'research', 'cancelQueue', 'cancelResearch', 'pickForm', 'build', 'setRepair', 'setAutoLoot'];
      const unit = ['demolish', 'upgradeBuilding', 'discardItem'];
      if (team.includes(d.m)) { a[0] = gt; this.refuse(g[d.m](...a)); }
      else if (unit.includes(d.m) && a[0] && a[0].team === gt && !a[0].dead) { const r = g[d.m](...a); if (d.m === 'upgradeBuilding') this.refuse(r); }
      return;
    }
    if (d.k === 'rally') { const v = d.v; g.teams[gt].rally = v && (v.gate || (isFinite(v.x) && isFinite(v.z))) ? (v.gate ? { gate: true } : { x: +v.x, z: +v.z }) : null; return; }
    if (d.k === 'auto') { for (const id of d.ids || []) { const u = g.units.find((x) => x.id === id); const A = u && u.team === gt && u.ability(d.ab); if (A) A.st.auto = !!d.on; } }
  }
  dispose() { this.net.on('data', null); }
}
const STAT_KEYS = ['hp', 'hpRegen', 'armor', 'ward', 'evasion', 'missChance', 'damage', 'attackSpeed', 'moveSpeed', 'range'];
const STAT_ARR = (s) => STAT_KEYS.map((k) => r2(s[k] || 0));

// =====================================================================
//  GUEST: a Game with the simulation off, drawing the host's snapshots
// =====================================================================
const GAME_CMDS = ['train', 'research', 'cancelQueue', 'cancelResearch', 'pickForm', 'build', 'setRepair', 'setAutoLoot', 'demolish', 'upgradeBuilding', 'discardItem'];
const UNIT_CMDS = ['command', 'castAbility', 'interrupt', 'useItem'];
// Unit methods on a mirror game become network orders (installed once; normal games are untouched)
for (const m of UNIT_CMDS) {
  const orig = Unit.prototype[m];
  Unit.prototype[m] = function (...a) {
    const M = this.game?.mirror;
    if (!M) return orig.apply(this, a);
    if (m === 'castAbility') { const A = this.abil[a[0]]; if (!A) return false; M.send({ k: 'u', id: this.id, m, a: [A.def.id, serArg(a[1] || null)] }); return true; }
    M.send({ k: 'u', id: this.id, m, a: serArg(a) });
    if (m === 'command') { this.order = a[0]; this.queuedCast = null; }   // instant feedback in the panel
    return m === 'useItem' ? null : true;
  };
}

export class NetGuest {
  constructor(app, game, net) {
    this.app = app; this.g = game; this.net = net;
    this.vfx = []; this.fireMeshes = []; this.lastBaseHp = null; this.snapT = 0;
    game.mirror = this;
    for (const m of GAME_CMDS) game[m] = (...a) => { this.send({ k: 'g', m, a: serArg(a) }); return m === 'cancelQueue' || m === 'demolish' ? true : null; };
    game.update = (dt, cq) => this.update(dt, cq);
    net.on('data', (d) => this.onData(d));
    // nothing local should exist yet: the host's snapshot creates every unit (towers included)
    for (const u of game.units) u.dispose(); game.units = [];
  }
  send(d) { this.net.send(d); }
  onData(d) {
    if (d.k === 'snap') this.apply(d);
    else if (d.k === 'err') { this.app.ui.toast(d.msg, 'err'); sfx('error', 150); }
    else if (d.k === 'chat') this.app.chat?.line(`[Opponent]: ${String(d.text).slice(0, 200)}`, 'me');
  }
  unitById(id) { return this.g.units.find((u) => u.id === id) || null; }
  apply(S) {
    const g = this.g;
    g.time = S.time; g.winner = S.winner;
    if (S.over && !g.over) g.over = true;
    // teams
    S.teams.forEach((T, t) => { Object.assign(g.teams[t], T); g.teams[t].isAI = false; });
    // bases
    S.bases.forEach(([hp, maxHp, level, armor, dead, bonusHp], t) => {
      const b = g.bases[t];
      if (b.level !== level) { b.level = level; g.swapBaseModel?.(t, level); }
      if (hp < b.hp - 0.5) { b.shake = 0.18; if (t === g.playerTeam) g.emit('baseHit'); }
      b.hp = hp; b.maxHp = maxHp; b.armor = armor; b.bonusHp = bonusHp;
      if (dead) b.dead = true;
    });
    // units
    const seen = new Set();
    for (const R of S.units) {
      seen.add(R.i);
      let u = this.unitById(R.i);
      if (!u && R.k) u = this.makeUnit(R);
      if (!u) continue;
      const hp0 = u.hp, sh0 = u.shieldHp || 0;
      if (R.k) this.applyStatic(u, R.k);
      if (R.st) this.applyStatus(u, R.st);
      // hit flash: the host flashes in takeDamage, which the joiner never runs, so any HP or shield loss flashes here
      if (!u.dead && (R.h < hp0 - 0.05 || (u.shieldHp || 0) < sh0 - 0.05)) u.flash = 1;
      u.netX = R.x; u.netZ = R.z; u.netR = R.r;
      u.hp = R.h; if (R.m !== undefined) u.mana = R.m;
      u.moving = !!R.mv; u.casting = R.ac ? (u.casting || { i: 0, t: 0.3 }) : null;
      if (R.o && u.order?.type !== R.o) u.order = { type: R.o };
      if (u.structure) { u.upgrading = R.ug ? { ...R.ug } : null; u.shotIdx = R.si || 0; u.netEl = R.el; }
      if ((u.atkN || 0) !== R.an) { u.atkN = R.an; u.swing = 1; u.muzzleT = 0.06; }
      if (R.d && !u.dead) { u.dead = true; u.deathT = 0; u.ring.visible = false; u.bar.visible = false; u.shield.visible = false; u.clearMiniDrones?.(); if (g.audible(u.pos.x) && g.seenByViewer(u.pos)) sfx('death', 80); }
    }
    for (let i = g.units.length - 1; i >= 0; i--) if (!seen.has(g.units[i].id)) { const u = g.units[i]; if (u.selected) this.app.controls.setSelection?.(this.app.controls.selection.filter((x) => x !== u)); u.dispose(); g.units.splice(i, 1); }
    // true sight (Sniper Tower / Vulcan CIWS) decides which invisible troops the joiner can see: rebuild it from the synced towers
    g.detectors = g.units.filter((u) => u.structure?.trueSight && u.built && !u.dead).map((u) => ({ team: u.team, pos: u.pos, get radius() { return u.structure?.trueSight || 0; }, get dead() { return u.dead; } }));
    // loot
    const lseen = new Set();
    for (const [uid, id, x, z, blink] of S.loot) {
      lseen.add(uid);
      let L = g.loot.find((l) => l.uid === uid);
      if (!L) { const mesh = buildLoot(ITEMS[id].icon); const y0 = g.terrain?.heightAt(x, z) || 0; mesh.position.set(x, 0.5 + y0, z); g.scene.add(mesh); L = { uid, id, x, z, y0, mesh, t: 0 }; g.loot.push(L); }
      L.blinkOff = !!blink;
    }
    for (let i = g.loot.length - 1; i >= 0; i--) if (!lseen.has(g.loot[i].uid)) { g.scene.remove(g.loot[i].mesh); g.loot.splice(i, 1); }
    // burning ground / acid pools (drawn fresh each snapshot)
    this.drawFires(S.fires);
    // effects
    for (const f of S.fx) this.playFx(f);
  }
  makeUnit(R) {
    const g = this.g, k = R.k;
    if (!UNITS[k.d] && !k.d) return null;
    let u;
    try { u = new Unit(g, k.d, k.t, k.f || null); } catch { return null; }
    u.id = R.i;
    u.spawnAt(R.x, R.z); u.facing = R.r; u.netX = R.x; u.netZ = R.z; u.netR = R.r;
    if (k.bf !== undefined) u.baseFacing = k.bf;
    u.invulnT = 0; u.shield.visible = false;
    if (k.tw) { u.tower = true; u.yOff = k.tw[0]; u.towerRange = k.tw[1]; u.bar.visible = false; u.obj.position.y = u.yOff; }
    if (u.structure) u.buildT = u.structure.buildTime;
    g.units.push(u); g.scene.add(u.obj);
    return u;
  }
  applyStatic(u, k) {
    if (u.team !== k.t) u.team = k.t;
    if (k.bf !== undefined) u.baseFacing = k.bf;
    if (k.bl && u.structure && (u.bLevel !== k.bl || (u.bPath || null) !== k.bp)) u.applyBuildLevel(k.bl, k.bp);
    const itemsChanged = JSON.stringify(u.items) !== JSON.stringify(k.it);
    u.items = k.it.slice();
    if (itemsChanged) u.recalcStats();
    STAT_KEYS.forEach((key, i) => { u.stats[key] = k.s[i]; (u.base ||= {})[key] = k.b[i]; });
    const [bd, bas, ba, bw, br, bms, brg, bev] = k.p;
    u.pas = { ...u.pas, bonusDamage: bd, bonusAS: bas, bonusArmor: ba, bonusWard: bw, bonusRange: br, bonusMS: bms, bonusRegen: brg, bonusEvasion: bev };
    u.maxMana = k.mm; u.auras = k.au;
    u.syncAbilities();   // abilities granted by Barracks upgrades
  }
  applyStatus(u, st) {
    for (const [id, ...vals] of st.a) { const A = u.ability(id); if (A) ABIL_KEYS.forEach((key, i) => { if (vals[i] !== null) A.st[key] = vals[i]; }); }
    STATUS_KEYS.forEach((key, i) => { const v = st.x[i]; u[key] = v === null ? undefined : v; });
    if (u.invulnT > 0) u.shield.visible = true;
    u.slows = st.sl ? [{ pct: st.sl[0], t: st.sl[1] }] : [];
    u.breakerStacks = st.bs || [];
    u.armorDebuffs = st.ad || null;
    if (u.buildT !== undefined && u.structure) u.buildT = Math.min(u.buildT, u.structure.buildTime);
  }
  // ---------------- drawing ----------------
  update(dt, camQuat) {
    const g = this.g;
    if (!g.over) g.time += dt;   // smooth clock between snapshots (snapshot overwrites it)
    const k = Math.min(1, dt * SMOOTH);
    for (let i = g.units.length - 1; i >= 0; i--) {
      const u = g.units[i];
      if (u.dead) { if (u.updateDeath(dt)) { u.dispose(); g.units.splice(i, 1); } continue; }
      if (u.netX !== undefined) {
        const dx = u.netX - u.pos.x, dz = u.netZ - u.pos.z;
        if (dx * dx + dz * dz > 36) { u.pos.x = u.netX; u.pos.z = u.netZ; } else { u.pos.x += dx * k; u.pos.z += dz * k; }
        let dr = u.netR - u.facing; dr = Math.atan2(Math.sin(dr), Math.cos(dr)); u.facing += dr * k;
      }
      u.pos.y = (g.terrain?.heightAt(u.pos.x, u.pos.z) || 0) + (u.flying ? GAME.flyHeight : 0);
      u.obj.position.copy(u.pos); if (u.tower) u.obj.position.y = u.yOff;
      u.obj.rotation.y = u.facing;
      if (u.invulnT > 0) u.updateShield(dt); else if (u.shield.visible) u.shield.visible = false;
      if (u.ability('miniDrones')) u.updateMiniDrones(dt);
      if (u.structure) this.structureVisuals(u, dt, k);
      u.animate(dt, u.moving ? u.stats.moveSpeed || 2 : 0);
      if (!u.tower) u.updateBar(camQuat);
    }
    for (const b of g.bases) {
      if (b.shake > 0) { b.shake -= dt; b.obj.position.x = b.x + (Math.random() - 0.5) * 0.25 * (b.shake / 0.18); } else b.obj.position.x = b.x;
      if (b.dead) { b.obj.position.y = Math.max(-14, b.obj.position.y - dt * 4); }
    }
    for (const L of g.loot) { L.t += dt; L.mesh.position.y = 0.55 + (L.y0 || 0) + Math.sin(L.t * 3) * 0.12; L.mesh.userData.spin?.forEach((m) => (m.rotation.y += dt * 1.6)); L.mesh.visible = g.seenByViewer(L) && !L.blinkOff; }
    this.updateVfx(dt);
    g.updateTethers(dt);
    g.vision?.update(dt);
    g.applyFog();
    for (const F of this.fireMeshes) F.visible = g.seenByViewer(F.position);
    g.updateVisuals(dt);
  }
  /** Turret / artillery visuals the host computes in Unit.updateStructure (never run on the joiner): the emplacement
   *  stays put and the turret turns (body counter-rotates), the barrel elevates, scaffolding shows while building or
   *  upgrading, and the hit flash fades. Animate() returns early for structures, so the flash lives here. */
  structureVisuals(u, dt, blend) {
    const r = u.rig, S = u.structure;
    if (!r || !S) return;
    if (u.baseFacing !== undefined) { r.body.rotation.y = u.baseFacing - u.facing; r.yaw.rotation.y = u.facing - u.baseFacing; }
    const building = !u.built;
    r.scaffold.visible = building || !!u.upgrading;
    r.yaw.scale.set(1, building ? 0.2 + 0.8 * Math.min(1, u.buildT / S.buildTime) : 1, 1);
    if (r.barrel && u.netEl !== undefined) r.barrel.rotation.x += (u.netEl - r.barrel.rotation.x) * blend;
    if (u.flash > 0) { u.flash = Math.max(0, u.flash - dt * 6); const f = u.flash * 0.45; for (const m of r.matList) m.emissive.setRGB(f, f * 0.9, f * 0.9); }
  }
  drawFires(list) {
    const g = this.g;
    while (this.fireMeshes.length > list.length) { const m = this.fireMeshes.pop(); g.scene.remove(m); m.material.dispose(); }
    list.forEach(([x, z, r, acid], i) => {
      let m = this.fireMeshes[i];
      if (!m) { m = new THREE.Mesh(new THREE.CircleGeometry(1, 24), new THREE.MeshBasicMaterial({ transparent: true, opacity: 0.4, depthWrite: false })); m.material.userData.noFow = true; m.rotation.x = -Math.PI / 2; m.renderOrder = 2; g.scene.add(m); this.fireMeshes[i] = m; }
      m.material.color.setHex(acid ? 0x7ae85a : 0xff6a1a);
      m.position.set(x, (g.terrain?.heightAt(x, z) || 0) + 0.08, z); m.scale.setScalar(r);
    });
  }
  playFx(f) {
    const g = this.g, [kind, ...a] = f;
    const P = (p) => p && { x: p.x, z: p.z, y: p.y };
    if (kind === 'burst') return g.burst(P(a[0]), ...a.slice(1));
    if (kind === 'ring') return g.ring(P(a[0]), a[1], a[2]);
    if (kind === 'tracer') return g.tracer?.(P(a[0]), P(a[1]), a[2], a[3]);
    if (kind === 'tether') { const A = this.unitById(a[0]), B = this.unitById(a[1]); if (A && B) g.tether(A, B, a[2]); return; }
    if (kind === 'reveal') { const A = this.unitById(a[0]); if (A && g.vision) g.vision.reveal(A, a[1]); return; }
    if (kind === 'emit') {
      const [evt, ...args] = a;
      const out = args.map((x) => (x && typeof x === 'object' && x.$u !== undefined ? this.unitById(x.$u) : x));
      if (out.some((x, i) => args[i]?.$u !== undefined && !x)) return;   // the unit is already gone
      if (evt === 'invFull' && out[0]?.team !== g.playerTeam) return;    // host-side toast: only for the joiner's own troop
      if (evt === 'pickup' && out[0]?.team === g.playerTeam) { /* refreshed by the snapshot */ }
      return g.emit(evt, ...out);
    }
    if (kind === 'proj') {
      const [srcId, start, tgt, speed, arc, pk, crit, rocket, dist0] = a;
      const mesh = rocket ? buildRocket() : pk === 'arrow' ? buildArrow() : pk === 'spear' ? buildSpear() : pk === 'wisp' ? buildWisp() : buildBullet();
      if (pk === 'sniper' && !rocket) mesh.scale.set(1.4, 1.4, 2.6);
      if (crit) mesh.scale.multiplyScalar(1.6);
      const s = new THREE.Vector3(start.x, start.y ?? 1.4, start.z);
      mesh.position.copy(s); g.scene.add(mesh);
      const target = tgt.$u !== undefined ? this.unitById(tgt.$u) : null;
      const end = target ? new THREE.Vector3(target.pos.x, 1.4 + (target.pos.y || 0), target.pos.z) : new THREE.Vector3(tgt.x, tgt.y ?? 2.2, tgt.z);
      this.vfx.push({ type: 'proj', mesh, start: s, end, target, u: 0, speed, arc, dist0: Math.max(0.5, s.distanceTo(end)) });
      const src = this.unitById(srcId);
      if (src && g.audible(src.pos.x) && g.seenByViewer(src.pos)) sfx(pk === 'arrow' ? 'bow' : pk === 'sniper' ? 'snipe' : 'gun', 35);
      return;
    }
    if (kind === 'shell') {
      const [start, end, T, apex, delay, small, splash, scale] = a;
      const mesh = small ? buildRocket() : apex > 3 ? buildShell() : buildCannonball();
      mesh.scale.setScalar(scale || 1); mesh.visible = !(delay > 0);
      const s = new THREE.Vector3(start.x, start.y ?? 2, start.z), e = new THREE.Vector3(end.x, end.y ?? 0.15, end.z);
      mesh.position.copy(s); g.scene.add(mesh);
      let marker = null;
      if (splash) { marker = new THREE.Mesh(new THREE.RingGeometry(0.85, 1, 24), new THREE.MeshBasicMaterial({ color: 0xff3020, transparent: true, opacity: 0.5, depthWrite: false, side: THREE.DoubleSide })); marker.material.userData.noFow = true; marker.rotation.x = -Math.PI / 2; marker.position.set(e.x, e.y + 0.05, e.z); marker.scale.setScalar(splash); g.scene.add(marker); }
      this.vfx.push({ type: 'shell', mesh, marker, start: s, end: e, t: -(delay || 0), T, apex });
      return;
    }
    if (kind === 'beam') {
      const [from, to, bolt, color, len, rotY, mid] = a;
      if (bolt) { const mesh = buildArrow(); mesh.scale.setScalar(2.6); const s = new THREE.Vector3(from.x, from.y, from.z), e = new THREE.Vector3(to.x, to.y, to.z); mesh.position.copy(s); mesh.lookAt(e); g.scene.add(mesh); this.vfx.push({ type: 'bolt', mesh, start: s, end: e, t: 0.25 }); return; }
      const m = new THREE.Mesh(boxGeo(0.25, 0.25, 1), new THREE.MeshBasicMaterial({ color, transparent: true, opacity: 0.9, depthWrite: false }));
      m.material.userData.noFow = true; m.position.set(mid.x, mid.y, mid.z); m.scale.z = len; m.lookAt(to.x, to.y, to.z); g.scene.add(m);
      this.vfx.push({ type: 'beam', mesh: m, t: 0.35 });
      return;
    }
    if (kind === 'shot') {
      const [x, z, dx, dz, speed, left, scatter] = a;
      const m = new THREE.Mesh(boxGeo(scatter ? 1.6 : 0.3, 0.2, scatter ? 0.4 : 1.6), new THREE.MeshBasicMaterial({ color: scatter ? 0xffd040 : 0x9ad8ff }));
      m.position.set(x, 1.3, z); m.rotation.y = Math.atan2(dx, dz); g.scene.add(m);
      this.vfx.push({ type: 'shot', mesh: m, x, z, dx, dz, speed, left });
    }
  }
  updateVfx(dt) {
    const g = this.g, nxt = new THREE.Vector3();
    for (let i = this.vfx.length - 1; i >= 0; i--) {
      const V = this.vfx[i]; let done = false;
      if (V.type === 'proj') {
        if (V.target && !V.target.dead) V.end.set(V.target.pos.x, 1.4 + (V.target.pos.y || 0), V.target.pos.z);
        V.u = Math.min(1, V.u + (V.speed * dt) / V.dist0);
        const at = (u, out) => out.lerpVectors(V.start, V.end, u).setY(THREE.MathUtils.lerp(V.start.y, V.end.y, u) + V.arc * V.dist0 * 4 * u * (1 - u));
        at(V.u, V.mesh.position); at(Math.min(1, V.u + 0.02), nxt);
        if (nxt.distanceToSquared(V.mesh.position) > 1e-6) V.mesh.lookAt(nxt);
        done = V.u >= 1;
      } else if (V.type === 'shell') {
        V.t += dt; if (V.t < 0) continue;
        V.mesh.visible = true;
        const u = Math.min(1, V.t / V.T);
        V.mesh.position.lerpVectors(V.start, V.end, u); V.mesh.position.y += V.apex * 4 * u * (1 - u);
        if (V.marker) { V.marker.material.opacity = 0.35 + 0.45 * u; V.marker.visible = g.seenByViewer(V.end); }
        done = u >= 1;
      } else if (V.type === 'bolt') { V.t -= dt; V.mesh.position.lerpVectors(V.start, V.end, 1 - Math.max(0, V.t) / 0.25); done = V.t <= 0; }
      else if (V.type === 'beam') { V.t -= dt; V.mesh.material.opacity = Math.max(0, V.t / 0.35) * 0.9; done = V.t <= 0; }
      else if (V.type === 'shot') { const st = Math.min(V.left, V.speed * dt); V.x += V.dx * st; V.z += V.dz * st; V.left -= st; V.mesh.position.x = V.x; V.mesh.position.z = V.z; done = V.left <= 0; }
      if (V.type !== 'shell') V.mesh.visible = g.seenByViewer(V.mesh.position);
      if (done) { g.scene.remove(V.mesh); if (V.marker) { g.scene.remove(V.marker); V.marker.material.dispose(); } this.vfx.splice(i, 1); }
    }
  }
  dispose() {
    const g = this.g;
    for (const V of this.vfx) { g.scene.remove(V.mesh); if (V.marker) g.scene.remove(V.marker); }
    for (const m of this.fireMeshes) g.scene.remove(m);
    this.vfx = []; this.fireMeshes = [];
    this.net.on('data', null);
  }
}
