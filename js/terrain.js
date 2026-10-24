// ============================================================
//  TERRAIN — the single source of truth for the static (and future buildable) map:
//   - ground height + high/low ground level (river in the middle)
//   - obstacles (trees, rocks, buildings, props ... and later player-built structures)
//   - a navigation grid + A* pathfinding + collision push-out
//   - a vision-blocker grid (used by the fog of war)
//
//  Adding something solid later (a turret, a wall):  const id = terrain.addObstacle({...});
//  Removing it (destroyed):                         terrain.removeObstacle(id);
//  Both update the nav + vision grids incrementally, so units re-path automatically.
// ============================================================
import { GAME } from './config.js';

export const TERRAIN = {
  // walkable world bounds (units are clamped to these anyway)
  minX: -64, maxX: 64, minZ: -48, maxZ: 48,
  navCell: 1,                 // nav grid resolution (world units)
  navInflate: 0.45,           // obstacles grow by ~a troop radius in the nav grid
  river: { half: 3.5, ramp: 2, depth: 0.7, fade: 3 },   // low ground: |x| < half (+ ramp up to half+ramp); starts at the hill's foot
  // north hill (high ground, level 2): flat ellipse top (rx, rz) + `ramp` units of slope all around. The river springs from its foot.
  hill: { x: 0, z: -40, rx: 12, rz: 7, ramp: 3.5, height: 2.2 },
  // fog/vision grid covers the whole visible ground (matches the 2x2 voxel tiles)
  visCell: 2, visMinX: -90, visMaxX: 90, visMinZ: -52, visMaxZ: 52,
};

export function createTerrain() {
  const R = TERRAIN.river;
  const nc = TERRAIN.navCell;
  const NW = Math.round((TERRAIN.maxX - TERRAIN.minX) / nc), NH = Math.round((TERRAIN.maxZ - TERRAIN.minZ) / nc);
  const VW = Math.round((TERRAIN.visMaxX - TERRAIN.visMinX) / TERRAIN.visCell), VH = Math.round((TERRAIN.visMaxZ - TERRAIN.visMinZ) / TERRAIN.visCell);
  const navCount = new Uint16Array(NW * NH);     // >0 = blocked (count of obstacles covering the cell)
  const visCount = new Uint16Array(VW * VH);     // >0 = blocks line of sight
  const obstacles = new Map();
  let nextId = 1;
  const buckets = new Map();                     // 4x4 spatial hash for collision queries
  const bkey = (ix, iz) => ix * 1000 + iz;

  // ---------------- height & level ----------------
  // Levels: 0 = low ground (river), 1 = normal ground, 2 = high ground (north hill). Higher sees lower, not the reverse;
  // ranged attacks uphill can miss (GAME.highGround).
  const H = TERRAIN.hill, hillK = Math.min(H.rx, H.rz) / H.ramp;
  /** 0..1: how far up the hill (1 = on the flat top). */
  const hillF = (x, z) => {
    const d = Math.hypot((x - H.x) / H.rx, (z - H.z) / H.rz);
    return d <= 1 ? 1 : Math.max(0, 1 - (d - 1) * hillK);
  };
  /** 0..1: how much river there is at this z (it starts just south of the hill's foot). */
  const riverStart = H.z + H.rz + H.ramp;
  const riverF = (z) => Math.max(0, Math.min(1, (z - riverStart) / R.fade));
  const level = (x, z = 0) => {
    if (hillF(x, z) > 0.5) return 2;
    return Math.abs(x) < R.half + R.ramp * 0.5 && riverF(z) > 0.5 ? 0 : 1;
  };
  const riverH = (x) => {
    const ax = Math.abs(x);
    if (ax <= R.half) return -R.depth;
    if (ax >= R.half + R.ramp) return 0;
    return -R.depth * (1 - (ax - R.half) / R.ramp);
  };
  const heightAt = (x, z = 0) => {
    const h = hillF(x, z);
    if (h > 0) return H.height * h;
    return riverH(x) * riverF(z);
  };

  // ---------------- obstacles ----------------
  /** footprint as AABB in world space (circles use their bounding box for grid marking) */
  function aabb(o) {
    if (o.r !== undefined) return [o.x - o.r, o.z - o.r, o.x + o.r, o.z + o.r];
    return [o.x - o.hw, o.z - o.hd, o.x + o.hw, o.z + o.hd];
  }
  function covers(o, x, z, pad) {
    if (o.r !== undefined) return Math.hypot(x - o.x, z - o.z) <= o.r + pad;
    return Math.abs(x - o.x) <= o.hw + pad && Math.abs(z - o.z) <= o.hd + pad;
  }
  function mark(o, d) {
    const [x0, z0, x1, z1] = aabb(o);
    if (o.blocksMove) {
      const p = TERRAIN.navInflate;
      const ix0 = Math.max(0, Math.floor((x0 - p - TERRAIN.minX) / nc)), ix1 = Math.min(NW - 1, Math.floor((x1 + p - TERRAIN.minX) / nc));
      const iz0 = Math.max(0, Math.floor((z0 - p - TERRAIN.minZ) / nc)), iz1 = Math.min(NH - 1, Math.floor((z1 + p - TERRAIN.minZ) / nc));
      for (let ix = ix0; ix <= ix1; ix++) for (let iz = iz0; iz <= iz1; iz++) {
        const cx = TERRAIN.minX + (ix + 0.5) * nc, cz = TERRAIN.minZ + (iz + 0.5) * nc;
        if (covers(o, cx, cz, p + nc * 0.35)) navCount[iz * NW + ix] += d;
      }
    }
    if (o.blocksVision) {
      const vc = TERRAIN.visCell;
      const ix0 = Math.max(0, Math.floor((x0 - TERRAIN.visMinX) / vc)), ix1 = Math.min(VW - 1, Math.floor((x1 - TERRAIN.visMinX) / vc));
      const iz0 = Math.max(0, Math.floor((z0 - TERRAIN.visMinZ) / vc)), iz1 = Math.min(VH - 1, Math.floor((z1 - TERRAIN.visMinZ) / vc));
      for (let ix = ix0; ix <= ix1; ix++) for (let iz = iz0; iz <= iz1; iz++) {
        const cx = TERRAIN.visMinX + (ix + 0.5) * vc, cz = TERRAIN.visMinZ + (iz + 0.5) * vc;
        if (covers(o, cx, cz, vc * 0.5)) visCount[iz * VW + ix] += d;
      }
    }
    const bx0 = Math.floor(x0 / 4), bx1 = Math.floor(x1 / 4), bz0 = Math.floor(z0 / 4), bz1 = Math.floor(z1 / 4);
    for (let bx = bx0; bx <= bx1; bx++) for (let bz = bz0; bz <= bz1; bz++) {
      const k = bkey(bx, bz);
      if (d > 0) { if (!buckets.has(k)) buckets.set(k, new Set()); buckets.get(k).add(o); }
      else buckets.get(k)?.delete(o);
    }
  }
  /**
   * Register an obstacle. Shape: { x, z, r } (circle) or { x, z, hw, hd } (axis-aligned box).
   * Flags: blocksMove (default true), blocksVision (default false), kind, owner (anything).
   * Returns an id for removeObstacle().
   */
  function addObstacle(spec) {
    const o = { blocksMove: true, blocksVision: false, ...spec, id: nextId++ };
    obstacles.set(o.id, o);
    mark(o, 1);
    version++;
    return o.id;
  }
  function removeObstacle(id) {
    const o = obstacles.get(id); if (!o) return;
    mark(o, -1); obstacles.delete(id);
    version++;
  }
  let version = 0;   // bumps on every change: cached paths re-validate

  // ---------------- nav grid ----------------
  const cellOf = (x, z) => [Math.floor((x - TERRAIN.minX) / nc), Math.floor((z - TERRAIN.minZ) / nc)];
  const inGrid = (ix, iz) => ix >= 0 && iz >= 0 && ix < NW && iz < NH;
  // troops can't walk behind the bases (Unit.command clamps x there), so paths must not route through it either
  const xLim = GAME.baseX - GAME.baseHalfX - 0.5;
  const ixMin = Math.ceil((-xLim - TERRAIN.minX) / nc), ixMax = Math.floor((xLim - TERRAIN.minX) / nc) - 1;
  const blockedCell = (ix, iz) => !inGrid(ix, iz) || ix < ixMin || ix > ixMax || navCount[iz * NW + ix] > 0;
  const blockedAt = (x, z) => { const [ix, iz] = cellOf(x, z); return blockedCell(ix, iz); };
  /** Straight segment walkable? (sampled every half cell) */
  function clearLine(ax, az, bx, bz) {
    const d = Math.hypot(bx - ax, bz - az), n = Math.ceil(d / (nc * 0.5));
    for (let i = 1; i <= n; i++) { const t = i / n; if (blockedAt(ax + (bx - ax) * t, az + (bz - az) * t)) return false; }
    return true;
  }
  /** nearest free cell center (spiral search) */
  function nearestFree(x, z, maxR = 8) {
    const [cx, cz] = cellOf(x, z);
    if (!blockedCell(cx, cz)) return { x, z };
    for (let r = 1; r <= maxR; r++) {
      let best = null, bd = Infinity;
      for (let ix = cx - r; ix <= cx + r; ix++) for (let iz = cz - r; iz <= cz + r; iz++) {
        if (Math.max(Math.abs(ix - cx), Math.abs(iz - cz)) !== r || blockedCell(ix, iz)) continue;
        const wx = TERRAIN.minX + (ix + 0.5) * nc, wz = TERRAIN.minZ + (iz + 0.5) * nc, dd = Math.hypot(wx - x, wz - z);
        if (dd < bd) { bd = dd; best = { x: wx, z: wz }; }
      }
      if (best) return best;
    }
    return { x, z };
  }
  // A* (8-connected, octile, no corner cutting). Binary heap on f.
  const gScore = new Float32Array(NW * NH), came = new Int32Array(NW * NH), stamp = new Uint32Array(NW * NH), closed = new Uint32Array(NW * NH);
  let run = 0;
  function findPath(ax, az, bx, bz, maxNodes = 9000) {
    const s = nearestFree(ax, az), e = nearestFree(bx, bz);
    const [sx, sz] = cellOf(s.x, s.z), [ex, ez] = cellOf(e.x, e.z);
    if (!inGrid(sx, sz) || !inGrid(ex, ez)) return null;
    run++;
    const start = sz * NW + sx, goal = ez * NW + ex;
    const heap = [], h = (i) => { const dx = Math.abs(i % NW - ex), dz = Math.abs(((i / NW) | 0) - ez); return (dx + dz) + (Math.SQRT2 - 2) * Math.min(dx, dz); };
    const push = (i, f) => { heap.push([f, i]); let k = heap.length - 1; while (k) { const p = (k - 1) >> 1; if (heap[p][0] <= heap[k][0]) break; [heap[p], heap[k]] = [heap[k], heap[p]]; k = p; } };
    const pop = () => { const top = heap[0], last = heap.pop(); if (heap.length) { heap[0] = last; let k = 0; for (;;) { const l = 2 * k + 1, r = l + 1; let m = k; if (l < heap.length && heap[l][0] < heap[m][0]) m = l; if (r < heap.length && heap[r][0] < heap[m][0]) m = r; if (m === k) break; [heap[m], heap[k]] = [heap[k], heap[m]]; k = m; } } return top[1]; };
    stamp[start] = run; gScore[start] = 0; came[start] = -1; push(start, h(start));
    let found = false, n = 0, bestI = start, bestH = h(start);
    while (heap.length && n++ < maxNodes) {
      const cur = pop();
      if (closed[cur] === run) continue;
      closed[cur] = run;
      if (cur === goal) { found = true; break; }
      const cx = cur % NW, cz = (cur / NW) | 0;
      const hc = h(cur); if (hc < bestH) { bestH = hc; bestI = cur; }
      for (let dx = -1; dx <= 1; dx++) for (let dz = -1; dz <= 1; dz++) {
        if (!dx && !dz) continue;
        const nx = cx + dx, nz = cz + dz;
        if (blockedCell(nx, nz)) continue;
        if (dx && dz && (blockedCell(cx + dx, cz) || blockedCell(cx, cz + dz))) continue;
        const ni = nz * NW + nx, g = gScore[cur] + (dx && dz ? Math.SQRT2 : 1);
        if (stamp[ni] === run && g >= gScore[ni]) continue;
        stamp[ni] = run; gScore[ni] = g; came[ni] = cur; push(ni, g + h(ni));
      }
    }
    // unreachable / too far: go as close as we got
    let i = found ? goal : bestI;
    const cells = [];
    while (i !== -1) { cells.push(i); i = came[i]; }
    cells.reverse();
    const pts = cells.map((c) => ({ x: TERRAIN.minX + (c % NW + 0.5) * nc, z: TERRAIN.minZ + (((c / NW) | 0) + 0.5) * nc }));
    if (found) pts[pts.length - 1] = { x: e.x, z: e.z };
    // string pulling: keep only the corners we can't see past
    const out = [];
    let a = { x: ax, z: az }, k = 0;
    while (k < pts.length) {
      let far = k;
      for (let j = pts.length - 1; j > k; j--) if (clearLine(a.x, a.z, pts[j].x, pts[j].z)) { far = j; break; }
      out.push(pts[far]); a = pts[far]; k = far + 1;
    }
    return out;
  }

  /** Push a circle (x,z,radius) out of every obstacle it overlaps. Mutates and returns pos. */
  function resolve(pos, radius) {
    const bx0 = Math.floor((pos.x - radius - 2) / 4), bx1 = Math.floor((pos.x + radius + 2) / 4);
    const bz0 = Math.floor((pos.z - radius - 2) / 4), bz1 = Math.floor((pos.z + radius + 2) / 4);
    for (let bx = bx0; bx <= bx1; bx++) for (let bz = bz0; bz <= bz1; bz++) {
      const set = buckets.get(bkey(bx, bz)); if (!set) continue;
      for (const o of set) {
        if (!o.blocksMove) continue;
        if (o.r !== undefined) {
          const dx = pos.x - o.x, dz = pos.z - o.z, d = Math.hypot(dx, dz), min = o.r + radius;
          if (d < min) { const k = d > 1e-4 ? (min - d) / d : 0; if (k) { pos.x += dx * k; pos.z += dz * k; } else pos.x += min; }
        } else {
          const cx = Math.max(o.x - o.hw, Math.min(o.x + o.hw, pos.x)), cz = Math.max(o.z - o.hd, Math.min(o.z + o.hd, pos.z));
          const dx = pos.x - cx, dz = pos.z - cz, d = Math.hypot(dx, dz);
          if (d < radius) {
            if (d > 1e-4) { const k = (radius - d) / d; pos.x += dx * k; pos.z += dz * k; }
            else { // center inside the box: exit along the shallowest axis
              const ox = o.hw + radius - Math.abs(pos.x - o.x), oz = o.hd + radius - Math.abs(pos.z - o.z);
              if (ox < oz) pos.x += Math.sign(pos.x - o.x || 1) * ox; else pos.z += Math.sign(pos.z - o.z || 1) * oz;
            }
          }
        }
      }
    }
    return pos;
  }

  // ---------------- vision blockers ----------------
  const visIndex = (x, z) => {
    const ix = Math.floor((x - TERRAIN.visMinX) / TERRAIN.visCell), iz = Math.floor((z - TERRAIN.visMinZ) / TERRAIN.visCell);
    return ix < 0 || iz < 0 || ix >= VW || iz >= VH ? -1 : iz * VW + ix;
  };

  return {
    NW, NH, VW, VH, navCount, visCount, obstacles,
    get version() { return version; },
    level, heightAt, hillF, riverStart, addObstacle, removeObstacle,
    blockedAt, clearLine, nearestFree, findPath, resolve, visIndex,
    visBlocked: (i) => visCount[i] > 0,
  };
}
