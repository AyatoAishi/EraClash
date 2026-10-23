// ============================================================
//  FOG OF WAR (Dota-style) — per-team visibility on the terrain's vision grid.
//
//  Vision sources (anything with a team and a vision radius):
//    - troops: def.vision = [day, night]   (Sniper +3 while prone, towers see their attack range)
//    - bases:  GAME.baseVision
//    - game.structures (future: player-built turrets etc.) — { team, pos:{x,z}, dead, visionRadius(nightF) }
//  Rules:
//    - trees / buildings block line of sight (terrain.visBlocked)
//    - low ground (river) can't see up onto high ground
//    - a troop that attacks is revealed to the victim's team for a moment
//    - towers/bases are always visible (bases are landmarks); everything else needs vision
//  Intel: whenever a team sees the enemy base, it takes a snapshot of that base's upgrades,
//  research, towers and repair. The base panel shows the snapshot, not the live data.
// ============================================================
import { GAME } from './config.js';
import { TERRAIN } from './terrain.js';

export const VISION = {
  tick: 0.1,           // seconds between recomputes (teams alternate, so each team refreshes every 0.2s)
  revealOnAttack: 1.5, // attacker stays visible to the victim's team this long
};

export class Vision {
  constructor(game) {
    this.game = game;
    this.terrain = game.terrain;
    const T = this.terrain;
    this.W = T.VW; this.H = T.VH;
    this.vis = [new Uint8Array(this.W * this.H), new Uint8Array(this.W * this.H)];
    this.t = 0;
    // cell level cache (0 = low ground)
    this.cellLevel = new Uint8Array(this.W * this.H);
    for (let iz = 0; iz < this.H; iz++) for (let ix = 0; ix < this.W; ix++) {
      this.cellLevel[iz * this.W + ix] = T.level(TERRAIN.visMinX + (ix + 0.5) * TERRAIN.visCell);
    }
    game.intel = [{ seen: false }, { seen: false }];     // intel[t] = what team t knows about team 1-t's base
    this.update(0, true);
  }

  idx(x, z) { return this.terrain.visIndex(x, z); }
  /** Is world point (x,z) visible to `team`? null team (spectator) sees everything. */
  seen(team, p) {
    if (team === null || team === undefined || team > 1) return true;
    const i = this.idx(p.x, p.z);
    return i >= 0 && this.vis[team][i] === 1;
  }
  /** Can `team` see unit `u`? */
  canSee(team, u) {
    if (team === null || team === undefined || team > 1) return true;
    if (u.team === team || u.tower) return true;
    if (u.revealT && u.revealT[team] > this.game.time) return true;
    return this.seen(team, u.pos);
  }
  /** Called when `u` attacks something on `victimTeam`. */
  reveal(u, victimTeam) {
    if (victimTeam > 1 || u.team === victimTeam) return;
    (u.revealT ||= [0, 0])[victimTeam] = this.game.time + VISION.revealOnAttack;
  }

  sources(team) {
    const g = this.game, f = g.dayNight?.f || 0, out = [];
    const lerp = (v) => v[0] + (v[1] - v[0]) * f;
    for (const u of g.units) if (!u.dead && u.team === team) out.push({ x: u.pos.x, z: u.pos.z, r: u.visionRadius(f), level: u.groundLevel });
    const b = g.bases[team];
    if (b && !b.dead) out.push({ x: b.x, z: 0, r: lerp(GAME.baseVision), level: 1 });
    for (const s of g.structures || []) if (!s.dead && s.team === team) out.push({ x: s.pos.x, z: s.pos.z, r: s.visionRadius(f), level: this.terrain.level(s.pos.x) });
    return out;
  }

  update(dt, force = false) {
    this.t -= dt;
    if (this.t > 0 && !force) return;
    this.t = VISION.tick;
    if (force) { this.compute(0); this.compute(1); }
    else { this.turn = 1 - (this.turn || 0); this.compute(this.turn); }
    this.updateIntel();
  }

  compute(team) {
    const W = this.W, H = this.H, vc = TERRAIN.visCell, x0 = TERRAIN.visMinX, z0 = TERRAIN.visMinZ;
    const vis = this.vis[team], T = this.terrain, lvl = this.cellLevel;
    vis.fill(0);
    // troops standing in the same cell see the same thing: keep only the biggest radius per cell
    const best = new Map();
    for (const s of this.sources(team)) {
      const k = Math.floor((s.x - x0) / vc) * 4096 + Math.floor((s.z - z0) / vc) * 2 + s.level;
      const b = best.get(k); if (!b || b.r < s.r) best.set(k, s);
    }
    for (const s of best.values()) {
      const sx = (s.x - x0) / vc, sz = (s.z - z0) / vc;
      const rc = s.r / vc;
      const ix0 = Math.max(0, Math.floor(sx - rc)), ix1 = Math.min(W - 1, Math.floor(sx + rc));
      const iz0 = Math.max(0, Math.floor(sz - rc)), iz1 = Math.min(H - 1, Math.floor(sz + rc));
      const si = Math.floor(sz) * W + Math.floor(sx);
      for (let iz = iz0; iz <= iz1; iz++) for (let ix = ix0; ix <= ix1; ix++) {
        const i = iz * W + ix;
        if (vis[i]) continue;
        const cx = ix + 0.5, cz = iz + 0.5, dx = cx - sx, dz = cz - sz;
        if (dx * dx + dz * dz > rc * rc) continue;
        if (s.level < lvl[i]) continue;                      // low ground can't see up
        // line of sight through the blocker grid (the blocker cell itself is visible)
        const n = Math.ceil(Math.hypot(dx, dz) * 2);
        let ok = true;
        for (let k = 1; k < n; k++) {
          const t = k / n, j = Math.floor(sz + dz * t) * W + Math.floor(sx + dx * t);
          if (j !== si && j !== i && T.visCount[j] > 0) { ok = false; break; }
        }
        if (ok) vis[i] = 1;
      }
    }
  }

  baseSeen(team, enemy) {
    const b = this.game.bases[enemy];
    for (let x = b.x - GAME.baseHalfX; x <= b.x + GAME.baseHalfX; x += TERRAIN.visCell)
      for (let z = -GAME.baseHalfZ; z <= GAME.baseHalfZ; z += TERRAIN.visCell)
        if (this.seen(team, { x, z })) return true;
    return false;
  }
  updateIntel() {
    const g = this.game;
    for (const t of [0, 1]) {
      const e = 1 - t;
      if (!this.baseSeen(t, e)) continue;
      const E = g.teams[e];
      g.intel[t] = {
        seen: true, time: g.time,
        upLevels: { ...E.upLevels },
        research: E.research ? { id: E.research.id, level: E.research.level, left: E.research.total - E.research.t } : null,
        towers: E.towers, repairOn: E.repairOn, income: E.income,
      };
    }
  }
}
