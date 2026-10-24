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
const NIGHT = { sky: new THREE.Color(0x0d1530), hemiSky: new THREE.Color(0x3a4f8a), hemiGround: new THREE.Color(0x141a24), sun: new THREE.Color(0x8fa8ff), sunI: 0.35, hemiI: 0.42 };

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

  // ---------- voxel ground tiles (map extended to |z| ~ 34 for the jungle) ----------
  const T = 2, nx = 90, nz = 36;
  const tiles = new THREE.InstancedMesh(new THREE.BoxGeometry(T, 1, T), new THREE.MeshLambertMaterial(), nx * nz);
  tiles.receiveShadow = true;
  const mtx = new THREE.Matrix4(), col = new THREE.Color();
  const grass = [0x5c8a3a, 0x669540, 0x547f35, 0x6a9a44];
  const jungle = [0x3f6a2a, 0x46752e, 0x386026, 0x4d7d33];
  const dirt = [0x8a6a42, 0x7f6140, 0x94744a];
  const asphalt = [0x4a4d52, 0x45484d, 0x505358];
  const concrete = [0x9a9da2, 0xa3a6ab, 0x8f9297];
  const darkLot = [0x3a3d42, 0x34373c, 0x404348];
  let i = 0;
  for (let ix = 0; ix < nx; ix++) {
    for (let iz = 0; iz < nz; iz++) {
      const x = (ix - nx / 2) * T + T / 2, z = (iz - nz / 2) * T + T / 2;
      const inLane = Math.abs(z) < GAME.laneHalfWidth + 1;
      const camp = CAMPS.find((c) => Math.hypot(c.x - x, c.z - z) < 7);
      const edge = (x + (r() - 0.5) * 10) > 0;
      let palette;
      const riverbed = [0x6b5a3a, 0x5f5234, 0x75633f];
      if (Math.abs(x) < riverW) palette = riverbed;
      else if (camp) palette = camp.side === 'medieval' ? dirt : darkLot;
      else if (!edge) palette = inLane ? (r() < 0.75 ? dirt : grass) : (Math.abs(z) > 18 ? jungle : grass);
      else palette = inLane ? asphalt : concrete;
      col.setHex(palette[Math.floor(r() * palette.length)]);
      const walkable = Math.abs(z) < GAME.mapHalfWidth + 2;
      let h = inLane || camp ? -0.5 + r() * 0.05 : -0.5 + r() * (walkable ? 0.08 : 0.35);
      if (Math.abs(x) < riverW) h = -0.5 + terrain.heightAt(x);      // low ground: the river bed
      mtx.makeTranslation(x, h, z);
      tiles.setMatrixAt(i, mtx); tiles.setColorAt(i, col); i++;
    }
  }
  scene.add(tiles);
  for (let x = 4; x < 50; x += 4) {
    const d = new THREE.Mesh(M.boxGeo(1.8, 0.05, 0.3), M.sharedMat(0xf2c94c));
    d.position.set(x, 0.03, 0); d.receiveShadow = true; scene.add(d);
  }
  // shallow water over the river bed (walkable, purely visual)
  const water = new THREE.Mesh(new THREE.BoxGeometry(RV.half * 2 - 0.6, 0.3, nz * T), new THREE.MeshLambertMaterial({ color: 0x3a7ab8, transparent: true, opacity: 0.55, depthWrite: false }));
  water.position.set(0, -RV.depth + 0.12, 0); water.renderOrder = 1; scene.add(water);
  const far = new THREE.Mesh(new THREE.PlaneGeometry(600, 400), new THREE.MeshLambertMaterial({ color: 0x3f6a2a }));
  far.rotation.x = -Math.PI / 2; far.position.y = -0.6; scene.add(far);

  // ---------- bases ----------
  let castle = M.buildCastle(GAME.baseLevel);
  castle.position.set(-GAME.baseX, 0, 0); scene.add(castle);
  let hq = M.buildHQ(GAME.baseLevel);
  hq.position.set(GAME.baseX, 0, 0); scene.add(hq);

  // ---------- props ----------
  const place = (obj, x, z, ry = r() * Math.PI * 2, solid = null) => {
    obj.position.set(x, 0, z); obj.rotation.y = ry; scene.add(obj);
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

  // medieval-side forest (outer ring + jungle around the camps)
  for (let k = 0; k < 90; k++) {
    const side = r() < 0.5 ? -1 : 1;
    const z = side * (GAME.laneHalfWidth + 3 + r() * 20);
    const x = -78 + r() * 76;
    if (nearCamp(x, z, 8.5) || inCorridor(x, z) || inRiver(x, 1)) continue;
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
  for (let k = 0; k < 8; k++) place(M.buildBarrier(), 10 + r() * 40, (r() < 0.5 ? -1 : 1) * (GAME.laneHalfWidth + 3 + r() * 2), Math.floor(r() * 2) * Math.PI / 2, { hw: 1.2, hd: 0.35, kind: 'barrier' });
  const bcols = [0x7d8794, 0x9a8f86, 0x6f7a86, 0xb0a99f, 0x8a7f78];
  for (let k = 0; k < 22; k++) {
    const side = k % 2 ? -1 : 1;
    const x = 4 + (k >> 1) * 7 + r() * 2, z = side * (GAME.laneHalfWidth + 8 + r() * 16);
    const bw = 4 + Math.floor(r() * 4), bh = 6 + Math.floor(r() * 12), bd = 4 + Math.floor(r() * 3);
    if (nearCamp(x, z, 9.5) || inCorridor(x, z) || x - bw / 2 < riverW + 1) continue;
    const b = M.buildBuilding(bw, bh, bd, bcols[k % 5]);
    place(b, x, z, side > 0 ? Math.PI : 0, { hw: bw / 2, hd: bd / 2, vision: true, kind: 'building' });
  }
  for (const c of CAMPS.filter((c) => c.side === 'modern')) {
    const s = -Math.sign(c.z);   // toward lane
    // buildings walling the alley on three sides, open toward the lane
    const BLD = (w, d) => ({ hw: w / 2, hd: d / 2, vision: true, kind: 'building' });
    place(M.buildBuilding(6, 10, 5, 0x6f6660), c.x, c.z - s * 9.5, s > 0 ? 0 : Math.PI, BLD(6, 5));
    place(M.buildBuilding(5, 8, 6, 0x7d8794), c.x - 9.5, c.z - s * 3, Math.PI / 2, BLD(5, 6));
    place(M.buildBuilding(5, 12, 6, 0x8a7f78), c.x + 9.5, c.z - s * 3, -Math.PI / 2, BLD(5, 6));
    place(M.buildDumpster(), c.x - 5, c.z - s * 5.5, 0, { hw: 1.15, hd: 0.65, kind: 'dumpster' });
    const bf = place(M.buildBarrel(true), c.x + 4.5, c.z - s * 5.5, 0, { r: 0.45, kind: 'barrel' }); flames.push(...bf.userData.flames);
    glowSources.push({ x: c.x + 4.5, y: 1.6, z: c.z - s * 5.5, color: 0xff7a2e, flicker: true });
    place(M.buildBarrel(), c.x + 5.6, c.z - s * 4.6, 0, { r: 0.45, kind: 'barrel' });
    place(M.buildCrate(), c.x - 6.5, c.z - s * 3.5, 0.3, { r: 0.55, kind: 'crate' });
    place(M.buildFence(5), c.x - 6.5, c.z + s * 1.5, Math.PI / 2, { hw: 2.5, hd: 0.12, kind: 'fence' });
    place(M.buildFence(5), c.x + 6.5, c.z + s * 1.5, Math.PI / 2, { hw: 2.5, hd: 0.12, kind: 'fence' });
    for (let a = 0; a < Math.PI * 2; a += Math.PI / 5) {     // painted spawn-box ring
      const m = new THREE.Mesh(M.boxGeo(0.7, 0.04, 0.25), M.sharedMat(0xf2c94c));
      m.position.set(c.x + Math.cos(a) * 4, 0.03, c.z + Math.sin(a) * 4); m.rotation.y = -a; scene.add(m);
    }
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
