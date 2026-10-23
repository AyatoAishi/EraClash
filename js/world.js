// Battlefield: lighting + day/night, voxel ground, bases, lane props, jungle & city neutral camps.
import * as THREE from 'three';
import { GAME } from './config.js';
import { CAMPS } from './neutrals.js';
import * as M from './models.js';

function rand(seed) { // deterministic so the map looks the same every match
  let s = seed;
  return () => { s = (s * 16807) % 2147483647; return (s - 1) / 2147483646; };
}

const DAY = { sky: new THREE.Color(0x9cc4e4), hemiSky: new THREE.Color(0xdfefff), hemiGround: new THREE.Color(0x4a5a3a), sun: new THREE.Color(0xfff1d6), sunI: 1.6, hemiI: 0.9 };
const NIGHT = { sky: new THREE.Color(0x0d1530), hemiSky: new THREE.Color(0x3a4f8a), hemiGround: new THREE.Color(0x141a24), sun: new THREE.Color(0x8fa8ff), sunI: 0.35, hemiI: 0.42 };

export function createWorld(scene) {
  const r = rand(1337);
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
      if (camp) palette = camp.side === 'medieval' ? dirt : darkLot;
      else if (!edge) palette = inLane ? (r() < 0.75 ? dirt : grass) : (Math.abs(z) > 18 ? jungle : grass);
      else palette = inLane ? asphalt : concrete;
      col.setHex(palette[Math.floor(r() * palette.length)]);
      const walkable = Math.abs(z) < GAME.mapHalfWidth + 2;
      const h = inLane || camp ? -0.5 + r() * 0.05 : -0.5 + r() * (walkable ? 0.08 : 0.35);
      mtx.makeTranslation(x, h, z);
      tiles.setMatrixAt(i, mtx); tiles.setColorAt(i, col); i++;
    }
  }
  scene.add(tiles);
  for (let x = 4; x < 50; x += 4) {
    const d = new THREE.Mesh(M.boxGeo(1.8, 0.05, 0.3), M.sharedMat(0xf2c94c));
    d.position.set(x, 0.03, 0); d.receiveShadow = true; scene.add(d);
  }
  const far = new THREE.Mesh(new THREE.PlaneGeometry(600, 400), new THREE.MeshLambertMaterial({ color: 0x3f6a2a }));
  far.rotation.x = -Math.PI / 2; far.position.y = -0.6; scene.add(far);

  // ---------- bases ----------
  const castle = M.buildCastle();
  castle.position.set(-GAME.baseX, 0, 0); scene.add(castle);
  const hq = M.buildHQ();
  hq.position.set(GAME.baseX, 0, 0); scene.add(hq);

  // ---------- props ----------
  const place = (obj, x, z, ry = r() * Math.PI * 2) => { obj.position.set(x, 0, z); obj.rotation.y = ry; scene.add(obj); return obj; };
  const nearCamp = (x, z, d) => CAMPS.some((c) => Math.hypot(c.x - x, c.z - z) < d);
  // a walkable corridor from each camp to the lane (kept free of obstacles)
  const inCorridor = (x, z) => CAMPS.some((c) => Math.abs(x - c.x) < 4 && Math.sign(z) === Math.sign(c.z) && Math.abs(z) < Math.abs(c.z));

  // medieval-side forest (outer ring + jungle around the camps)
  for (let k = 0; k < 90; k++) {
    const side = r() < 0.5 ? -1 : 1;
    const z = side * (GAME.laneHalfWidth + 3 + r() * 20);
    const x = -78 + r() * 76;
    if (nearCamp(x, z, 8.5) || inCorridor(x, z)) continue;
    place(r() < 0.5 ? M.buildTree(0.8 + r() * 0.6, k) : M.buildPine(0.9 + r() * 0.7), x, z, Math.floor(r() * 4) * Math.PI / 2);
  }
  // dense tree ring around medieval camps, open toward the lane
  for (const c of CAMPS.filter((c) => c.side === 'medieval')) {
    const open = Math.atan2(-Math.sign(c.z), 0);   // direction pointing at the lane
    for (let a = 0; a < Math.PI * 2; a += 0.42) {
      let da = Math.atan2(Math.sin(a - open), Math.cos(a - open));
      if (Math.abs(da) < 0.75) continue;
      const rr = 8.5 + r() * 2.5;
      place(r() < 0.6 ? M.buildPine(1 + r() * 0.5) : M.buildTree(0.9 + r() * 0.5, Math.floor(r() * 4)), c.x + Math.sin(a) * rr, c.z + Math.cos(a) * rr, Math.floor(r() * 4) * Math.PI / 2);
    }
    for (let k = 0; k < 5; k++) place(M.buildRock(0.5 + r() * 0.7), c.x + (r() - 0.5) * 10, c.z + (r() - 0.5) * 10 * 0.6 + Math.sign(c.z) * 3);
    // stone circle marks the spawn box
    for (let a = 0; a < Math.PI * 2; a += Math.PI / 5) {
      const s = new THREE.Mesh(M.boxGeo(0.5, 0.3, 0.5), M.sharedMat(0x7d7f84));
      s.position.set(c.x + Math.cos(a) * 4, 0.15, c.z + Math.sin(a) * 4); s.castShadow = true; scene.add(s);
    }
  }
  for (let k = 0; k < 10; k++) place(M.buildRock(0.6 + r()), -50 + r() * 48, (r() < 0.5 ? -1 : 1) * (GAME.laneHalfWidth + 1 + r() * 3));

  // ---------- light sources: modern street lamps + medieval torches in mirrored rows ----------
  const glowSources = [];   // { lightPos, flames? }
  for (let x = 8; x < 52; x += 9) {
    place(M.buildLamp(), x, -(GAME.laneHalfWidth + 1.5), 0);
    glowSources.push({ x: x + 1, y: 4.1, z: -(GAME.laneHalfWidth + 1.5), color: 0xffd98a });
    place(M.buildLamp(), x + 4.5, GAME.laneHalfWidth + 1.5, Math.PI);
    glowSources.push({ x: x + 3.5, y: 4.1, z: GAME.laneHalfWidth + 1.5, color: 0xffd98a });
  }
  const flames = [...castle.userData.torches];
  for (let x = -8; x > -54; x -= 9) {
    for (const [zz, off] of [[-(GAME.laneHalfWidth + 1.5), 0], [GAME.laneHalfWidth + 1.5, -4.5]]) {
      const t = place(M.buildTorch(), x + off, zz, 0);
      flames.push(...t.userData.flames);
      glowSources.push({ x: x + off, y: 3.4, z: zz, color: 0xff9a40, flicker: true });
    }
  }

  // ---------- modern city blocks + gang hideouts ----------
  for (let k = 0; k < 8; k++) place(M.buildBarrier(), 10 + r() * 40, (r() < 0.5 ? -1 : 1) * (GAME.laneHalfWidth + 3 + r() * 2), Math.floor(r() * 2) * Math.PI / 2);
  const bcols = [0x7d8794, 0x9a8f86, 0x6f7a86, 0xb0a99f, 0x8a7f78];
  for (let k = 0; k < 22; k++) {
    const side = k % 2 ? -1 : 1;
    const x = 4 + (k >> 1) * 7 + r() * 2, z = side * (GAME.laneHalfWidth + 8 + r() * 16);
    if (nearCamp(x, z, 9.5) || inCorridor(x, z)) continue;
    const b = M.buildBuilding(4 + Math.floor(r() * 4), 6 + Math.floor(r() * 12), 4 + Math.floor(r() * 3), bcols[k % 5]);
    place(b, x, z, side > 0 ? Math.PI : 0);
  }
  for (const c of CAMPS.filter((c) => c.side === 'modern')) {
    const s = -Math.sign(c.z);   // toward lane
    // buildings walling the alley on three sides, open toward the lane
    place(M.buildBuilding(6, 10, 5, 0x6f6660), c.x, c.z - s * 9.5, s > 0 ? 0 : Math.PI);
    place(M.buildBuilding(5, 8, 6, 0x7d8794), c.x - 9.5, c.z - s * 3, Math.PI / 2);
    place(M.buildBuilding(5, 12, 6, 0x8a7f78), c.x + 9.5, c.z - s * 3, -Math.PI / 2);
    place(M.buildDumpster(), c.x - 5, c.z - s * 5.5, 0);
    const bf = place(M.buildBarrel(true), c.x + 4.5, c.z - s * 5.5, 0); flames.push(...bf.userData.flames);
    glowSources.push({ x: c.x + 4.5, y: 1.6, z: c.z - s * 5.5, color: 0xff7a2e, flicker: true });
    place(M.buildBarrel(), c.x + 5.6, c.z - s * 4.6, 0);
    place(M.buildCrate(), c.x - 6.5, c.z - s * 3.5, 0.3);
    place(M.buildFence(5), c.x - 6.5, c.z + s * 1.5, Math.PI / 2);
    place(M.buildFence(5), c.x + 6.5, c.z + s * 1.5, Math.PI / 2);
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
    sun, tiles, castle, hq,
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
