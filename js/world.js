// Battlefield: lighting + day/night, voxel ground, bases, lane props, jungle & city neutral camps.
import * as THREE from 'three';
import { GAME } from './config.js';
import { CAMPS } from './neutrals.js';
import * as M from './models.js';
import { createTerrain, TERRAIN } from './terrain.js';

function rand(seed) { // deterministic so the map looks the same every match
  let s = seed;
  return () => { s = (s * 16807) % 2147483647; return (s - 1) / 2147483646; };
}

const DAY = { sky: new THREE.Color(0x9cc4e4), hemiSky: new THREE.Color(0xdfefff), hemiGround: new THREE.Color(0x4a5a3a), sun: new THREE.Color(0xfff1d6), sunI: 1.6, hemiI: 0.9 };
const NIGHT = { sky: new THREE.Color(0x1c2850), hemiSky: new THREE.Color(0x6a80c0), hemiGround: new THREE.Color(0x2a3242), sun: new THREE.Color(0xa8bcff), sunI: 0.75, hemiI: 0.78 };   // moonlit, still readable

export function createWorld(scene) {
  const r = rand(1337);
  const terrain = createTerrain();
  const RV = TERRAIN.river, riverW = RV.half + RV.ramp;
  scene.background = DAY.sky.clone();
  scene.fog = new THREE.Fog(DAY.sky.clone(), 75, 160);

  const hemi = new THREE.HemisphereLight(DAY.hemiSky, DAY.hemiGround, DAY.hemiI);
  scene.add(hemi);
  const sun = new THREE.DirectionalLight(DAY.sun, DAY.sunI);
  sun.position.set(-20, 45, 30);
  sun.castShadow = true;
  const sc = sun.shadow.camera;
  sc.left = -45; sc.right = 45; sc.top = 40; sc.bottom = -40; sc.near = 1; sc.far = 130;
  sun.shadow.bias = -0.0005;
  scene.add(sun); scene.add(sun.target);

  // ---------- scenery spots (kept clear of trees / buildings) ----------
  const FEATURES = [
    { kind: 'pond', x: -21, z: -23, rx: 3.2, rz: 2.3 },
    { kind: 'pond', x: -21, z: 23, rx: 3.6, rz: 2.6 },
    { kind: 'plaza', x: 21, z: -23, r: 5 },
    { kind: 'park', x: 21, z: 23, r: 5 },
  ];
  // Modern side road grid: an avenue up to every camp and a cross street joining them, so the city jungle is as
  // quick to cross as the forest. Kept clear of buildings. { x0, x1, z0, z1 } boxes, mirrored on both sides.
  const ROADS = [];
  for (const sg of [-1, 1]) {
    for (const ax of [27.5, 36, 48]) ROADS.push({ x0: ax - 2, x1: ax + 2, z0: Math.min(sg * 14, sg * 46), z1: Math.max(sg * 14, sg * 46), dir: 'z' });
    ROADS.push({ x0: 7, x1: 56, z0: sg * 31.5 - 2, z1: sg * 31.5 + 2, dir: 'x' });
  }
  const onRoad = (x, z, hw = 0, hd = hw) => ROADS.some((R) => x + hw > R.x0 && x - hw < R.x1 && z + hd > R.z0 && z - hd < R.z1);
  const inFeature = (x, z, pad = 0) => FEATURES.some((f) => Math.hypot(x - f.x, z - f.z) < (f.r || Math.max(f.rx, f.rz)) + pad);
  const onHill = (x, z, pad = 0) => terrain.hillF(x, z) > 0 || Math.hypot((x - TERRAIN.hill.x) / (TERRAIN.hill.rx + pad + 7), (z - TERRAIN.hill.z) / (TERRAIN.hill.rz + pad + 3.5)) < 1;

  // ---------- voxel ground tiles (map extended to |z| ~ 52: jungle, city, north hill) ----------
  const T = 2, nx = 90, nz = 52;
  const tiles = new THREE.InstancedMesh(new THREE.BoxGeometry(T, 1, T), new THREE.MeshLambertMaterial(), nx * nz);
  tiles.receiveShadow = true;
  const mtx = new THREE.Matrix4(), col = new THREE.Color();
  const grass = [0x5c8a3a, 0x669540, 0x547f35, 0x6a9a44];
  const jungle = [0x3f6a2a, 0x46752e, 0x386026, 0x4d7d33];
  const dirt = [0x8a6a42, 0x7f6140, 0x94744a];
  const asphalt = [0x4a4d52, 0x45484d, 0x505358];
  const concrete = [0x9a9da2, 0xa3a6ab, 0x8f9297];
  const darkLot = [0x3a3d42, 0x34373c, 0x404348];
  const road = [0x3f4247, 0x3b3e43, 0x43464b];
  let i = 0;
  for (let ix = 0; ix < nx; ix++) {
    for (let iz = 0; iz < nz; iz++) {
      const x = (ix - nx / 2) * T + T / 2, z = (iz - nz / 2) * T + T / 2;
      const inLane = Math.abs(z) < GAME.laneHalfWidth + 1;
      const camp = CAMPS.find((c) => Math.hypot(c.x - x, c.z - z) < 7);
      const edge = (x + (r() - 0.5) * 10) > 0;
      const hillF = terrain.hillF(x, z), feat = FEATURES.find((f) => Math.hypot(x - f.x, z - f.z) < (f.r || Math.max(f.rx, f.rz)) + 1.5);
      let palette;
      const riverbed = [0x6b5a3a, 0x5f5234, 0x75633f];
      const hillGrass = [0x6f9e47, 0x78a84e, 0x679440], hillTop = [0x86b558, 0x7fae52, 0x8dbc5f], hillRock = [0x8a8c86, 0x7d7f78];
      const plazaStone = [0xc9c2b4, 0xbdb6a8, 0xd2cbbd];
      if (hillF > 0) palette = hillF > 0.95 ? (r() < 0.05 ? hillRock : hillTop) : (r() < 0.12 ? hillRock : hillGrass);
      else if (Math.abs(x) < riverW && z > terrain.riverStart) palette = riverbed;
      else if (feat) palette = feat.kind === 'plaza' ? plazaStone : feat.kind === 'park' ? grass : jungle;
      else if (camp) palette = camp.side === 'medieval' ? dirt : darkLot;
      else if (x > 0 && onRoad(x, z, 0.9)) palette = road;
      else if (!edge) palette = inLane ? (r() < 0.75 ? dirt : grass) : (Math.abs(z) > 18 ? jungle : grass);
      else palette = inLane ? asphalt : (Math.abs(z) > 30 && r() < 0.35 ? grass : concrete);   // city with patches of green
      col.setHex(palette[Math.floor(r() * palette.length)]);
      const walkable = Math.abs(z) < GAME.mapHalfWidth + 2;
      let top = inLane || camp ? r() * 0.05 : r() * (walkable ? 0.08 : 0.35);
      const gh = terrain.heightAt(x, z);
      if (gh !== 0) top = gh + (gh > 0 ? r() * 0.06 : 0);      // river bed / hill
      const sy = 1 + Math.max(0, top);                           // tall tiles on the hill so no gaps show
      mtx.makeScale(1, sy, 1).setPosition(x, top - sy / 2, z);
      tiles.setMatrixAt(i, mtx); tiles.setColorAt(i, col); i++;
    }
  }
  scene.add(tiles);
  for (let x = 4; x < 50; x += 4) {
    const d = new THREE.Mesh(M.boxGeo(1.8, 0.05, 0.3), M.sharedMat(0xf2c94c));
    d.position.set(x, 0.03, 0); d.receiveShadow = true; scene.add(d);
  }
  for (const R of ROADS) {   // dashed white center lines on the city roads
    const cx = (R.x0 + R.x1) / 2, cz = (R.z0 + R.z1) / 2;
    if (R.dir === 'z') for (let z = R.z0 + 1.5; z < R.z1 - 1; z += 3.5) { if (CAMPS.some((c) => Math.hypot(c.x - cx, c.z - z) < 5)) continue; const d = new THREE.Mesh(M.boxGeo(0.25, 0.05, 1.4), M.sharedMat(0xe8e8e8)); d.position.set(cx, 0.03, z); scene.add(d); }
    else for (let x = R.x0 + 1.5; x < R.x1 - 1; x += 3.5) { if (CAMPS.some((c) => Math.hypot(c.x - x, c.z - cz) < 5)) continue; const d = new THREE.Mesh(M.boxGeo(1.4, 0.05, 0.25), M.sharedMat(0xe8e8e8)); d.position.set(x, 0.03, cz); scene.add(d); }
  }
  // shallow water over the river bed (walkable, purely visual)
  // the river springs from the foot of the north hill
  const wz0 = terrain.riverStart + 1, wz1 = nz;
  const water = new THREE.Mesh(new THREE.BoxGeometry(RV.half * 2 - 0.6, 0.3, wz1 - wz0), new THREE.MeshLambertMaterial({ color: 0x3a7ab8, transparent: true, opacity: 0.55, depthWrite: false }));
  water.position.set(0, -RV.depth + 0.12, (wz0 + wz1) / 2); water.renderOrder = 1; scene.add(water);
  const far = new THREE.Mesh(new THREE.PlaneGeometry(600, 400), new THREE.MeshLambertMaterial({ color: 0x3f6a2a }));
  far.rotation.x = -Math.PI / 2; far.position.y = -0.6; scene.add(far);

  // ---------- bases ----------
  let castle = M.buildCastle(GAME.baseLevel);
  castle.position.set(-GAME.baseX, 0, 0); scene.add(castle);
  let hq = M.buildHQ(GAME.baseLevel);
  hq.position.set(GAME.baseX, 0, 0); scene.add(hq);

  // ---------- props ----------
  const place = (obj, x, z, ry = r() * Math.PI * 2, solid = null) => {
    obj.position.set(x, terrain.heightAt(x, z), z); obj.rotation.y = ry; scene.add(obj);
    if (solid) {   // register as an obstacle (boxes follow 90° rotations)
      const q = Math.round(ry / (Math.PI / 2)) % 2 !== 0;
      const shape = solid.r !== undefined ? { r: solid.r } : { hw: q ? solid.hd : solid.hw, hd: q ? solid.hw : solid.hd };
      obj.userData.obstacle = terrain.addObstacle({ x, z, ...shape, blocksVision: !!solid.vision, kind: solid.kind });
    }
    return obj;
  };
  const inRiver = (x, pad = 0) => Math.abs(x) < riverW + pad;
  const TREE = (s) => ({ r: 0.7 * s, vision: true, kind: 'tree' });
  const nearCamp = (x, z, d) => CAMPS.some((c) => Math.hypot(c.x - x, c.z - z) < d);
  // a walkable corridor from each camp to the lane (kept free of obstacles)
  const inCorridor = (x, z) => CAMPS.some((c) => Math.abs(x - c.x) < 4 && Math.sign(z) === Math.sign(c.z) && Math.abs(z) < Math.abs(c.z));
  const blockedSpot = (x, z, campPad = 8.5) => nearCamp(x, z, campPad) || inCorridor(x, z) || inRiver(x, 1) || inFeature(x, z, 2) || onHill(x, z);

  // medieval-side forest (outer ring + jungle around the camps)
  for (let k = 0; k < 170; k++) {
    const side = r() < 0.5 ? -1 : 1;
    const z = side * (GAME.laneHalfWidth + 3 + r() * 33);
    const x = -78 + r() * 76;
    if (blockedSpot(x, z)) continue;
    const ts = r() < 0.5 ? ['t', 0.8 + r() * 0.6] : ['p', 0.9 + r() * 0.7];
    place(ts[0] === 't' ? M.buildTree(ts[1], k) : M.buildPine(ts[1]), x, z, Math.floor(r() * 4) * Math.PI / 2, TREE(ts[1] * (ts[0] === 'p' ? 0.85 : 1)));
  }
  // dense tree ring around medieval camps, open toward the lane
  for (const c of CAMPS.filter((c) => c.side === 'medieval')) {
    const open = Math.atan2(0, -Math.sign(c.z));   // ring angle (x = sin a, z = cos a) pointing at the lane
    for (let a = 0; a < Math.PI * 2; a += 0.42) {
      let da = Math.atan2(Math.sin(a - open), Math.cos(a - open));
      if (Math.abs(da) < 0.75) continue;
      const rr = 8.5 + r() * 2.5;
      const pine = r() < 0.6, sc = pine ? 1 + r() * 0.5 : 0.9 + r() * 0.5;
      const tx = c.x + Math.sin(a) * rr, tz = c.z + Math.cos(a) * rr;
      if (inCorridor(tx, tz) || inFeature(tx, tz, 1.5) || terrain.hillF(tx, tz) > 0 || CAMPS.some((o) => o !== c && Math.hypot(o.x - tx, o.z - tz) < 7)) continue;
      place(pine ? M.buildPine(sc) : M.buildTree(sc, Math.floor(r() * 4)), c.x + Math.sin(a) * rr, c.z + Math.cos(a) * rr, Math.floor(r() * 4) * Math.PI / 2, TREE(sc * (pine ? 0.85 : 1)));
    }
    for (let k = 0; k < 5; k++) {
      const sc = 0.5 + r() * 0.7, rx = c.x + (r() - 0.5) * 10, rz = c.z + (r() - 0.5) * 10 * 0.6 + Math.sign(c.z) * 3;
      if (Math.hypot(rx - c.x, rz - c.z) < 3.2) continue;      // keep the spawn ring itself free
      place(M.buildRock(sc), rx, rz, undefined, { r: 0.65 * sc, kind: 'rock' });
    }
    // stone circle marks the spawn box
    for (let a = 0; a < Math.PI * 2; a += Math.PI / 5) {
      const s = new THREE.Mesh(M.boxGeo(0.5, 0.3, 0.5), M.sharedMat(0x7d7f84));
      s.position.set(c.x + Math.cos(a) * 4, 0.15, c.z + Math.sin(a) * 4); s.castShadow = true; scene.add(s);
    }
  }
  for (let k = 0; k < 10; k++) {
    const sc = 0.6 + r(), x = -50 + r() * 48, z = (r() < 0.5 ? -1 : 1) * (GAME.laneHalfWidth + 1 + r() * 3);
    if (inRiver(x, 1)) continue;
    place(M.buildRock(sc), x, z, undefined, { r: 0.65 * sc, kind: 'rock' });
  }

  // ---------- light sources: modern street lamps + medieval torches in mirrored rows ----------
  const glowSources = [];   // { lightPos, flames? }
  const fountains = [];
  for (let x = 8; x < 52; x += 9) {
    place(M.buildLamp(), x, -(GAME.laneHalfWidth + 1.5), 0, { r: 0.3, kind: 'lamp' });
    glowSources.push({ x: x + 1, y: 4.1, z: -(GAME.laneHalfWidth + 1.5), color: 0xffd98a });
    place(M.buildLamp(), x + 4.5, GAME.laneHalfWidth + 1.5, Math.PI, { r: 0.3, kind: 'lamp' });
    glowSources.push({ x: x + 3.5, y: 4.1, z: GAME.laneHalfWidth + 1.5, color: 0xffd98a });
  }
  let flames = [...castle.userData.torches];
  for (let x = -8; x > -54; x -= 9) {
    for (const [zz, off] of [[-(GAME.laneHalfWidth + 1.5), 0], [GAME.laneHalfWidth + 1.5, -4.5]]) {
      const t = place(M.buildTorch(), x + off, zz, 0, { r: 0.3, kind: 'torch' });
      flames.push(...t.userData.flames);
      glowSources.push({ x: x + off, y: 3.4, z: zz, color: 0xff9a40, flicker: true });
    }
  }

  // ---------- modern city blocks + gang hideouts ----------
  for (let k = 0; k < 8; k++) { const bx = 10 + r() * 40, bz = (r() < 0.5 ? -1 : 1) * (GAME.laneHalfWidth + 3 + r() * 2), ry = Math.floor(r() * 2) * Math.PI / 2; if (!onRoad(bx, bz, 1.3)) place(M.buildBarrier(), bx, bz, ry, { hw: 1.2, hd: 0.35, kind: 'barrier' }); }
  const bcols = [0x7d8794, 0x9a8f86, 0x6f7a86, 0xb0a99f, 0x8a7f78];
  for (let k = 0; k < 40; k++) {
    const side = k % 2 ? -1 : 1;
    const x = 4 + ((k >> 1) % 10) * 7 + r() * 2, z = side * (GAME.laneHalfWidth + 8 + r() * 26);
    const bw = 4 + Math.floor(r() * 4), bh = 6 + Math.floor(r() * 12), bd = 4 + Math.floor(r() * 3);
    if (nearCamp(x, z, 9.5) || inCorridor(x, z) || x - bw / 2 < riverW + 1 || inFeature(x, z, 4) || onHill(x, z, 3) || onRoad(x, z, bw / 2 + 0.6, bd / 2 + 0.6)) continue;
    const b = M.buildBuilding(bw, bh, bd, bcols[k % 5]);
    place(b, x, z, side > 0 ? Math.PI : 0, { hw: bw / 2, hd: bd / 2, vision: true, kind: 'building' });
  }
  for (const c of CAMPS.filter((c) => c.side === 'modern')) {
    const s = -Math.sign(c.z);   // toward lane
    // a building on each side of the lot where it doesn't block a road or sit on the hill (roads run through the lots)
    const BLD = (w, d) => ({ hw: w / 2, hd: d / 2, vision: true, kind: 'building' });
    if (!onRoad(c.x, c.z - s * 9.5, 3.4, 2.9)) place(M.buildBuilding(6, 10, 5, 0x6f6660), c.x, c.z - s * 9.5, s > 0 ? 0 : Math.PI, BLD(6, 5));
    for (const sx of [-1, 1]) {
      const bx = c.x + sx * 9.5, bz = c.z - s * 3;
      if (!onHill(bx, bz, -6) && !onRoad(bx, bz, 3.4, 3.4)) place(M.buildBuilding(5, sx < 0 ? 8 : 12, 6, sx < 0 ? 0x7d8794 : 0x8a7f78), bx, bz, -sx * Math.PI / 2, BLD(5, 6));
    }
    const prop = (fn, x, z, ry, solid, pad = 1.2) => (onRoad(x, z, pad) ? null : place(fn(), x, z, ry, solid));
    prop(M.buildDumpster, c.x - 5, c.z - s * 5.5, 0, { hw: 1.15, hd: 0.65, kind: 'dumpster' });
    const bf = prop(() => M.buildBarrel(true), c.x + 4.5, c.z - s * 5.5, 0, { r: 0.45, kind: 'barrel' });
    if (bf) { flames.push(...bf.userData.flames); glowSources.push({ x: c.x + 4.5, y: 1.6, z: c.z - s * 5.5, color: 0xff7a2e, flicker: true }); }
    prop(M.buildBarrel, c.x + 5.6, c.z - s * 4.6, 0, { r: 0.45, kind: 'barrel' });
    prop(M.buildCrate, c.x - 6.5, c.z - s * 3.5, 0.3, { r: 0.55, kind: 'crate' });
    for (let a = 0; a < Math.PI * 2; a += Math.PI / 5) {     // painted spawn-box ring
      const m = new THREE.Mesh(M.boxGeo(0.7, 0.04, 0.25), M.sharedMat(0xf2c94c));
      m.position.set(c.x + Math.cos(a) * 4, 0.03, c.z + Math.sin(a) * 4); m.rotation.y = -a; scene.add(m);
    }
  }

  // ---------- north hill: open grassy top with a spring, rocks and a few trees on the slopes ----------
  const H = TERRAIN.hill;
  const spring = place(M.buildPond(3, 2, 7), H.x, H.z - 1, 0, { hw: 3, hd: 2, kind: 'pond' });
  spring.userData.isWater = true;
  for (let k = 0; k < 4; k++) {   // the stream tumbling down the south slope into the river
    const z = H.z + H.rz - 1 + k * 1.6, y = terrain.heightAt(0, z);
    const st = new THREE.Mesh(M.boxGeo(1.6, 0.12, 1.7), new THREE.MeshLambertMaterial({ color: 0x4a8ac8, transparent: true, opacity: 0.8 }));
    st.position.set(0, y + 0.07, z); scene.add(st);
  }
  for (let k = 0; k < 26; k++) {
    const a = r() * Math.PI * 2, d = 0.55 + r() * 0.75;
    const x = H.x + Math.cos(a) * H.rx * d, z = H.z + Math.sin(a) * H.rz * d;
    if (Math.abs(x) < 3 && z > H.z) continue;                          // keep the stream clear
    if (Math.hypot(x - H.x, z - (H.z - 1)) < 4.5) continue;            // and the spring
    const kind = r();
    if (kind < 0.35) place(M.buildRock(0.6 + r() * 0.7), x, z, undefined, { r: 0.6, kind: 'rock' });
    else if (kind < 0.55 && d > 0.95) place(M.buildPine(0.9 + r() * 0.4), x, z, 0, TREE(0.9));
    else if (kind < 0.75) place(M.buildBush(0.7 + r() * 0.4, r() < 0.5), x, z, r() * 3, { r: 0.5, kind: 'bush' });
    else { const f = M.buildFlowers(k + 3); f.position.set(x, terrain.heightAt(x, z), z); scene.add(f); }
  }
  // ---------- ponds, plaza, park ----------
  for (const f of FEATURES) {
    if (f.kind === 'pond') {
      place(M.buildPond(f.rx, f.rz, Math.round(f.x * 7 + f.z)), f.x, f.z, 0, { hw: f.rx, hd: f.rz, kind: 'pond' });
      for (let k = 0; k < 5; k++) { const a = r() * Math.PI * 2, d = Math.max(f.rx, f.rz) + 1.5 + r() * 1.5; place(M.buildBush(0.6 + r() * 0.4, r() < 0.4), f.x + Math.cos(a) * d, f.z + Math.sin(a) * d, r() * 3, { r: 0.45, kind: 'bush' }); }
      for (let k = 0; k < 3; k++) { const fl = M.buildFlowers(k + Math.round(f.x)); fl.position.set(f.x + (r() - 0.5) * 10, 0, f.z + (r() < 0.5 ? -1 : 1) * (f.rz + 2 + r())); scene.add(fl); }
    } else if (f.kind === 'plaza') {
      const fo = place(M.buildFountain(), f.x, f.z, 0, { hw: 2.6, hd: 2.6, kind: 'fountain' });
      fountains.push(fo);
      for (const [dx, dz, ry] of [[-4, 0, Math.PI / 2], [4, 0, -Math.PI / 2], [0, -4, 0], [0, 4, Math.PI]]) place(M.buildBench(), f.x + dx, f.z + dz, ry, { hw: 0.9, hd: 0.3, kind: 'bench' });
      for (const [dx, dz] of [[-4, -4], [4, -4], [-4, 4], [4, 4]]) place(M.buildPlanter(), f.x + dx, f.z + dz, 0, { hw: 0.8, hd: 0.8, kind: 'planter' });
      place(M.buildLamp(), f.x - 5.5, f.z + 2, 0, { r: 0.3, kind: 'lamp' }); glowSources.push({ x: f.x - 4.5, y: 4.1, z: f.z + 2, color: 0xffd98a });
    } else if (f.kind === 'park') {
      place(M.buildPond(2.6, 1.8, 11), f.x, f.z, 0, { hw: 2.6, hd: 1.8, kind: 'pond' });
      for (let k = 0; k < 7; k++) { const a = (k / 7) * Math.PI * 2 + r() * 0.3, d = 4 + r() * 1.5; place(M.buildTree(0.75 + r() * 0.3, k), f.x + Math.cos(a) * d, f.z + Math.sin(a) * d * 0.8, Math.floor(r() * 4) * Math.PI / 2, TREE(0.75)); }
      place(M.buildBench(), f.x, f.z - 3, 0, { hw: 0.9, hd: 0.3, kind: 'bench' });
      for (let k = 0; k < 3; k++) { const fl = M.buildFlowers(20 + k); fl.position.set(f.x - 3 + k * 3, 0, f.z + 3.2); scene.add(fl); }
    }
  }
  // street trees in planters along the city side of the lane (a bit of green between the blocks)
  for (let x = 12; x < 52; x += 13) for (const sz of [-1, 1]) {
    const z = sz * (GAME.laneHalfWidth + 5.5);
    if (!blockedSpot(x, z, 9) && !onRoad(x, z, 1.2)) place(M.buildPlanter(r() < 0.5), x, z, 0, { hw: 0.8, hd: 0.8, kind: 'planter' });
  }

  // ---------- night lights (point lights, faded in at night) ----------
  // one real light per two light sources (performance); every source still glows visually
  const lights = glowSources.filter((gs, k) => gs.flicker && gs.y < 2 ? true : k % 2 === 0).map((gsrc) => {
    const L = new THREE.PointLight(gsrc.color, 0, 14, 1.4);
    L.position.set(gsrc.x, gsrc.y, gsrc.z);
    L.userData = gsrc;
    scene.add(L);
    return L;
  });
  let lightsEnabled = true;

  let t = 0, nightF = 0;
  const tmpC = new THREE.Color();
  return {
    sun, tiles, terrain,
    get castle() { return castle; },
    get hq() { return hq; },
    /** A base leveled up (Game.swapBaseModel): animate the new model instead (flag, torches, blinker). */
    setBaseModel(team, obj) {
      if (team === 0) {
        const old = new Set(castle.userData.torches);
        flames = flames.filter((f) => !old.has(f)).concat(obj.userData.torches || []);
        castle = obj;
      } else hq = obj;
    },
    get night() { return nightF; },
    /** 0 = full day, 1 = full night */
    setNight(f) {
      nightF = f;
      scene.background.copy(DAY.sky).lerp(NIGHT.sky, f);
      scene.fog.color.copy(scene.background);
      hemi.color.copy(DAY.hemiSky).lerp(NIGHT.hemiSky, f);
      hemi.groundColor.copy(DAY.hemiGround).lerp(NIGHT.hemiGround, f);
      hemi.intensity = DAY.hemiI + (NIGHT.hemiI - DAY.hemiI) * f;
      sun.color.copy(DAY.sun).lerp(NIGHT.sun, f);
      sun.intensity = DAY.sunI + (NIGHT.sunI - DAY.sunI) * f;
    },
    setLightsEnabled(on) { lightsEnabled = on; lights.forEach((L) => (L.visible = on)); },
    update(dt) {
      t += dt;
      flames.forEach((f, idx) => { f.scale.setScalar(0.85 + Math.sin(t * 13 + idx * 2) * 0.12 + Math.random() * 0.06); });
      hq.userData.blink.visible = (t % 1.2) < 0.5;
      for (const fo of fountains) { const j = fo.userData.jet; if (j) j.scale.y = 1 + Math.sin(t * 6) * 0.25; }
      castle.userData.flag.rotation.y = Math.sin(t * 2.2) * 0.15;
      hq.userData.flag.rotation.y = Math.sin(t * 2.6 + 1) * 0.15;
      if (lightsEnabled) {
        for (const L of lights) {
          const fl = L.userData.flicker ? 0.85 + Math.sin(t * 11 + L.position.x) * 0.1 + Math.random() * 0.08 : 1;
          L.intensity = nightF * 9 * fl;
        }
      }
    },
    followCamera(target) { // keep the shadow frustum centered on what you're looking at
      sun.position.set(target.x - 20, 45, target.z + 30);
      sun.target.position.set(target.x, 0, target.z);
    },
  };
}
