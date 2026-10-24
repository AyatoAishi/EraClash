// Voxel model factory — everything is boxes.
import * as THREE from 'three';

const geoCache = new Map();
export function boxGeo(w, h, d) {
  const k = `${w}|${h}|${d}`;
  if (!geoCache.has(k)) geoCache.set(k, new THREE.BoxGeometry(w, h, d));
  return geoCache.get(k);
}
const sharedMats = new Map();
export function sharedMat(color, extra = {}) {
  const k = color + JSON.stringify(extra);
  if (!sharedMats.has(k)) sharedMats.set(k, new THREE.MeshLambertMaterial({ color, ...extra }));
  return sharedMats.get(k);
}

// Builds a box into `parent`. `mats` = per-model material map (for hit flash) or null for shared.
function B(parent, w, h, d, color, x, y, z, mats, extra) {
  let m;
  if (mats) {
    const k = color + (extra ? JSON.stringify(extra) : '');
    if (!mats.has(k)) mats.set(k, new THREE.MeshLambertMaterial({ color, ...(extra || {}) }));
    m = mats.get(k);
  } else m = sharedMat(color, extra);
  const mesh = new THREE.Mesh(boxGeo(w, h, d), m);
  mesh.position.set(x, y, z);
  mesh.castShadow = true;
  mesh.receiveShadow = true;
  parent.add(mesh);
  return mesh;
}

function pivot(parent, x, y, z) {
  const g = new THREE.Group(); g.position.set(x, y, z); parent.add(g); return g;
}

// ----- shared humanoid skeleton -----
function humanoid(p) {
  const root = new THREE.Group();
  const body = new THREE.Group(); root.add(body);
  const mats = new Map();
  const rig = { root, body, mats };

  // legs
  rig.legL = pivot(body, -0.17, 0.75, 0);
  rig.legR = pivot(body, 0.17, 0.75, 0);
  for (const leg of [rig.legL, rig.legR]) {
    B(leg, 0.26, 0.6, 0.3, p.pants, 0, -0.3, 0, mats);
    B(leg, 0.3, 0.2, 0.36, p.boots, 0, -0.66, 0.03, mats);
  }
  // torso
  rig.torso = pivot(body, 0, 1.12, 0);
  B(rig.torso, 0.66, 0.72, 0.4, p.shirt, 0, 0, 0, mats);
  B(rig.torso, 0.68, 0.1, 0.42, p.belt, 0, -0.28, 0, mats);
  // head
  rig.head = pivot(body, 0, 1.73, 0);
  B(rig.head, 0.5, 0.5, 0.5, p.skin, 0, 0, 0, mats);
  rig.eyes = [B(rig.head, 0.08, 0.08, 0.02, 0x111111, -0.12, 0.04, 0.255, mats), B(rig.head, 0.08, 0.08, 0.02, 0x111111, 0.12, 0.04, 0.255, mats)];
  // arms (pivot at shoulder)
  rig.armL = pivot(body, -0.45, 1.42, 0);
  rig.armR = pivot(body, 0.45, 1.42, 0);
  for (const arm of [rig.armL, rig.armR]) {
    B(arm, 0.22, 0.52, 0.24, p.sleeve, 0, -0.24, 0, mats);
    B(arm, 0.22, 0.16, 0.24, p.skin, 0, -0.58, 0, mats);
  }
  rig.handR = pivot(rig.armR, 0, -0.6, 0.02);
  rig.handL = pivot(rig.armL, 0, -0.45, 0.0);
  return rig;
}

export function buildViking() {
  const p = { skin: 0xe8b48a, pants: 0x5a3b22, boots: 0x33210f, shirt: 0x7a2e22, sleeve: 0x7a2e22, belt: 0x2a1a0e };
  const r = humanoid(p); const m = r.mats;
  // bare forearms + bracers
  B(r.armL, 0.24, 0.12, 0.26, 0x3d2a17, 0, -0.42, 0, m);
  B(r.armR, 0.24, 0.12, 0.26, 0x3d2a17, 0, -0.42, 0, m);
  // fur mantle
  B(r.torso, 0.9, 0.18, 0.5, 0xcdb995, 0, 0.34, 0, m);
  B(r.torso, 0.5, 0.12, 0.1, 0xb9a47e, 0, 0.24, 0.22, m);
  B(r.torso, 0.12, 0.12, 0.04, 0xe0b040, 0, -0.28, 0.22, m); // buckle
  // beard + braids
  B(r.head, 0.52, 0.26, 0.12, 0xc8642a, 0, -0.17, 0.25, m);
  B(r.head, 0.1, 0.22, 0.1, 0xc8642a, -0.13, -0.38, 0.27, m);
  B(r.head, 0.1, 0.22, 0.1, 0xc8642a, 0.13, -0.38, 0.27, m);
  B(r.head, 0.3, 0.06, 0.04, 0xa84f1e, 0, -0.06, 0.27, m); // moustache
  // helmet
  B(r.head, 0.56, 0.2, 0.56, 0x9aa3ab, 0, 0.24, 0, m);
  B(r.head, 0.36, 0.1, 0.36, 0x9aa3ab, 0, 0.38, 0, m);
  B(r.head, 0.08, 0.22, 0.04, 0x8a929a, 0, 0.06, 0.28, m); // nose guard
  // horns (stepped voxels)
  for (const s of [-1, 1]) {
    B(r.head, 0.14, 0.12, 0.14, 0xf1e4c3, s * 0.34, 0.24, 0, m);
    B(r.head, 0.12, 0.14, 0.12, 0xf1e4c3, s * 0.44, 0.34, 0, m);
    B(r.head, 0.1, 0.14, 0.1, 0xe5d4ad, s * 0.5, 0.46, 0, m);
    B(r.head, 0.08, 0.1, 0.08, 0xd8c497, s * 0.5, 0.56, 0.02, m);
  }
  // axe in right hand (handle points forward)
  const axe = pivot(r.handR, 0, 0, 0);
  B(axe, 0.08, 0.08, 0.95, 0x7b5130, 0, 0, 0.3, m);
  B(axe, 0.06, 0.38, 0.22, 0xc9d1d8, 0, 0.12, 0.7, m);
  B(axe, 0.06, 0.14, 0.08, 0xc9d1d8, 0, 0.0, 0.62, m);
  B(axe, 0.07, 0.42, 0.05, 0xeef2f5, 0, 0.12, 0.82, m); // edge
  r.weapon = axe;
  // round-ish voxel shield on left arm
  const sh = pivot(r.handL, -0.16, 0.05, 0.05);
  B(sh, 0.06, 0.62, 0.62, 0x8a5a2b, 0, 0, 0, m);
  B(sh, 0.07, 0.62, 0.08, 0x6b6b6b, 0, 0, 0, m);
  B(sh, 0.07, 0.08, 0.62, 0x6b6b6b, 0, 0, 0, m);
  B(sh, 0.1, 0.16, 0.16, 0xb8b8b8, -0.03, 0, 0, m);
  return finalize(r);
}

export function buildPolice() {
  const p = { skin: 0xe2a982, pants: 0x1a2440, boots: 0x111111, shirt: 0x22325c, sleeve: 0x22325c, belt: 0x151515 };
  const r = humanoid(p); const m = r.mats;
  // collar, badge, radio, tie
  B(r.torso, 0.4, 0.1, 0.42, 0x8fb8e8, 0, 0.32, 0, m);
  B(r.torso, 0.08, 0.3, 0.03, 0x0f162b, 0, 0.12, 0.21, m);
  B(r.torso, 0.12, 0.14, 0.04, 0xf2c94c, -0.18, 0.14, 0.21, m);
  B(r.torso, 0.1, 0.16, 0.06, 0x333333, 0.2, 0.18, 0.22, m);
  B(r.torso, 0.1, 0.1, 0.1, 0x2b2b2b, -0.26, -0.28, 0.16, m); // holster
  // shoulder patches
  B(r.armL, 0.24, 0.1, 0.26, 0x4a6fb0, 0, -0.06, 0, m);
  B(r.armR, 0.24, 0.1, 0.26, 0x4a6fb0, 0, -0.06, 0, m);
  // hair, cap, shades
  B(r.head, 0.52, 0.1, 0.52, 0x2b1d14, 0, 0.2, 0, m);
  B(r.head, 0.56, 0.16, 0.56, 0x1c2a50, 0, 0.3, 0, m);
  B(r.head, 0.5, 0.06, 0.22, 0x0d0d0d, 0, 0.22, 0.34, m); // brim
  B(r.head, 0.12, 0.12, 0.04, 0xf2c94c, 0, 0.32, 0.29, m);
  B(r.head, 0.42, 0.1, 0.03, 0x0a0a0a, 0, 0.05, 0.265, m); // sunglasses
  B(r.head, 0.2, 0.04, 0.02, 0x9a5a4a, 0, -0.14, 0.255, m); // mouth
  // baton
  const bat = pivot(r.handR, 0, 0, 0);
  B(bat, 0.08, 0.08, 0.9, 0x111111, 0, 0, 0.32, m);
  B(bat, 0.08, 0.2, 0.08, 0x1a1a1a, 0, -0.06, 0.12, m);
  r.weapon = bat;
  // riot shield
  const sh = pivot(r.handL, -0.16, 0.12, 0.05);
  B(sh, 0.05, 0.9, 0.55, 0x9ad0ff, 0, 0, 0, m, { transparent: true, opacity: 0.45 });
  B(sh, 0.06, 0.1, 0.55, 0x2a2a2a, 0, 0.42, 0, m);
  B(sh, 0.06, 0.08, 0.3, 0xffffff, 0, 0.15, 0, m); // POLICE stripe
  return finalize(r);
}

/**
 * Skill-tree forms: recolor a built model. look = { eyes: 0xRRGGBB (glowing), hair: { fromColor: toColor } }.
 * Hair colors are swapped on this model's own materials, so other troops of the same type are untouched.
 */
export function applyLook(r, look) {
  if (!look) return r;
  for (const [from, to] of Object.entries(look.hair || {})) r.mats.get(String(from))?.color.setHex(to);
  if (look.eyes != null && r.eyes) {
    const m = new THREE.MeshBasicMaterial({ color: look.eyes });   // unlit = glows, and the hit flash leaves it alone
    for (const e of r.eyes) { e.material = m; e.scale.set(1.15, 1.15, 1); }
  }
  return r;
}

function finalize(r) {
  r.matList = [...r.mats.values()];
  for (const mt of r.matList) mt.emissive = new THREE.Color(0x000000);
  // rest pose: arms slightly forward holding gear
  r.armL.rotation.x = -0.5; r.armR.rotation.x = -0.3;
  return r;
}

export function buildArcher() {
  const p = { skin: 0xe9b995, pants: 0x5a4630, boots: 0x3a2a18, shirt: 0x4e6b2e, sleeve: 0x4e6b2e, belt: 0x3b2a17 };
  const r = humanoid(p); const m = r.mats;
  // leather jerkin + bracer
  B(r.torso, 0.5, 0.5, 0.06, 0x7a5532, 0, 0.02, 0.21, m);
  B(r.torso, 0.08, 0.08, 0.04, 0xc9a050, 0, -0.28, 0.22, m);
  B(r.armL, 0.24, 0.2, 0.26, 0x7a5532, 0, -0.4, 0, m);
  // hood (stepped) + cape
  B(r.head, 0.58, 0.18, 0.58, 0x3d5a24, 0, 0.26, -0.02, m);
  B(r.head, 0.58, 0.4, 0.12, 0x3d5a24, 0, 0.0, -0.26, m);
  B(r.head, 0.1, 0.44, 0.5, 0x3d5a24, -0.28, 0.02, -0.02, m);
  B(r.head, 0.1, 0.44, 0.5, 0x3d5a24, 0.28, 0.02, -0.02, m);
  B(r.head, 0.3, 0.14, 0.2, 0x3d5a24, 0, 0.4, -0.2, m);
  B(r.head, 0.12, 0.12, 0.14, 0x34501f, 0, 0.46, -0.34, m);
  B(r.head, 0.5, 0.06, 0.04, 0x2a1d14, 0, 0.12, 0.255, m); // fringe
  B(r.head, 0.12, 0.3, 0.1, 0x8a3b1e, 0.1, -0.3, -0.3, m); // braid
  B(r.torso, 0.62, 0.7, 0.06, 0x34501f, 0, -0.05, -0.23, m); // cape
  // quiver on back
  const q = pivot(r.torso, 0.15, 0.12, -0.3);
  q.rotation.z = -0.35;
  B(q, 0.2, 0.62, 0.2, 0x6b4423, 0, 0, 0, m);
  for (const [x, c] of [[-0.05, 0xf2f2f2], [0.05, 0xc0392b], [0, 0xf2f2f2]]) {
    B(q, 0.04, 0.18, 0.04, 0x8a6a42, x, 0.38, 0, m);
    B(q, 0.07, 0.1, 0.03, c, x, 0.45, 0, m);
  }
  // bow (built upright along Y, bulging forward on +Z; kept level by animation)
  const bow = pivot(r.handL, 0, -0.02, 0.04);
  const seg = [[-0.6, 0.0], [-0.45, 0.1], [-0.28, 0.16], [-0.1, 0.19], [0.1, 0.19], [0.28, 0.16], [0.45, 0.1], [0.6, 0.0]];
  seg.forEach(([y, z]) => B(bow, 0.07, 0.2, 0.07, 0x8a5a2b, 0, y, z, m));
  B(bow, 0.09, 0.16, 0.1, 0x3b2a17, 0, 0, 0.19, m); // grip
  const str = B(bow, 0.02, 1.2, 0.02, 0xeeeeee, 0, 0, -0.02, m);
  str.castShadow = false;
  const nock = pivot(bow, 0, 0, 0);
  B(nock, 0.035, 0.035, 0.75, 0x8a6a42, 0, 0.0, 0.3, m);
  B(nock, 0.06, 0.06, 0.08, 0x9aa3ab, 0, 0.0, 0.68, m);
  r.level = [{ obj: bow, arm: r.armL, offset: 0 }];
  r.nockedArrow = nock;
  r.style = 'bow';
  return finalize(r);
}

export function buildGunner() {
  const p = { skin: 0xd99a74, pants: 0x4a5560, boots: 0x1a1a1a, shirt: 0x3b4652, sleeve: 0x3b4652, belt: 0x1a1d22 };
  const r = humanoid(p); const m = r.mats;
  // plate carrier + pouches
  B(r.torso, 0.72, 0.56, 0.48, 0x1d2329, 0, 0.06, 0, m);
  for (const x of [-0.2, 0, 0.2]) B(r.torso, 0.14, 0.16, 0.06, 0x2a3138, x, -0.1, 0.26, m);
  B(r.torso, 0.3, 0.08, 0.02, 0x4aa3ff, -0.1, 0.22, 0.25, m); // blue patch
  B(r.armL, 0.24, 0.12, 0.26, 0x1d2329, 0, -0.06, 0, m);
  B(r.armR, 0.24, 0.12, 0.26, 0x1d2329, 0, -0.06, 0, m);
  // knee pads
  B(r.legL, 0.28, 0.14, 0.08, 0x1d2329, 0, -0.42, 0.16, m);
  B(r.legR, 0.28, 0.14, 0.08, 0x1d2329, 0, -0.42, 0.16, m);
  // helmet + goggles + mask
  B(r.head, 0.58, 0.22, 0.58, 0x2b3540, 0, 0.24, 0, m);
  B(r.head, 0.62, 0.08, 0.62, 0x26303a, 0, 0.14, 0, m);
  B(r.head, 0.46, 0.12, 0.05, 0x7fd4ff, 0, 0.04, 0.27, m);
  B(r.head, 0.52, 0.18, 0.05, 0x23282e, 0, -0.14, 0.255, m);
  B(r.head, 0.1, 0.1, 0.1, 0x3a4450, 0.24, 0.32, -0.12, m); // helmet light mount
  // rifle in right hand (built along +Z, kept level by animation)
  const gun = pivot(r.handR, -0.08, 0.02, 0.0);
  B(gun, 0.1, 0.14, 0.9, 0x15181c, 0, 0.0, 0.3, m);          // body
  B(gun, 0.06, 0.06, 0.38, 0x0d0f12, 0, 0.03, 0.92, m);      // barrel
  B(gun, 0.08, 0.24, 0.12, 0x23282e, 0, -0.17, 0.42, m);     // magazine
  B(gun, 0.08, 0.18, 0.1, 0x23282e, 0, -0.12, 0.08, m);      // grip
  B(gun, 0.1, 0.16, 0.28, 0x15181c, 0, -0.02, -0.22, m);     // stock
  B(gun, 0.06, 0.08, 0.2, 0x3a4450, 0, 0.12, 0.3, m);        // optic
  const flash = B(gun, 0.2, 0.2, 0.22, 0xfff0a0, 0, 0.03, 1.2, null, { emissive: 0xffc030 });
  flash.castShadow = false; flash.visible = false;
  r.muzzle = flash;
  r.level = [{ obj: gun, arm: r.armR, offset: 0 }];
  r.style = 'rifle';
  return finalize(r);
}

export function buildImp() {
  const p = { skin: 0xb8342a, pants: 0x3a2418, boots: 0x7a1f1a, shirt: 0xb8342a, sleeve: 0xb8342a, belt: 0x2a1a10 };
  const r = humanoid(p); const m = r.mats;
  // pot belly + loincloth
  B(r.torso, 0.5, 0.36, 0.12, 0xd0503e, 0, -0.08, 0.2, m);
  B(r.torso, 0.4, 0.3, 0.06, 0x5a3420, 0, -0.42, 0.21, m);
  // big head features: yellow eyes, grin, horns, ears
  B(r.head, 0.14, 0.12, 0.03, 0xffd23a, -0.12, 0.05, 0.26, m);
  B(r.head, 0.14, 0.12, 0.03, 0xffd23a, 0.12, 0.05, 0.26, m);
  B(r.head, 0.05, 0.08, 0.04, 0x111111, -0.12, 0.05, 0.27, m);
  B(r.head, 0.05, 0.08, 0.04, 0x111111, 0.12, 0.05, 0.27, m);
  B(r.head, 0.3, 0.06, 0.03, 0x3a0a0a, 0, -0.13, 0.26, m);
  for (const x of [-0.1, 0, 0.1]) B(r.head, 0.05, 0.05, 0.03, 0xf4f0e0, x, -0.1, 0.27, m);
  for (const s of [-1, 1]) {
    B(r.head, 0.1, 0.16, 0.1, 0x2a1a1a, s * 0.16, 0.32, 0, m);
    B(r.head, 0.08, 0.14, 0.08, 0x1a1010, s * 0.2, 0.44, -0.03, m);
    B(r.head, 0.06, 0.08, 0.06, 0xe8d8b0, s * 0.22, 0.54, -0.06, m);
    B(r.head, 0.18, 0.1, 0.06, 0xa02a22, s * 0.32, 0.06, 0, m);   // pointy ears
    B(r.head, 0.1, 0.08, 0.05, 0xa02a22, s * 0.42, 0.12, 0, m);
  }
  // bat wings
  for (const s of [-1, 1]) {
    const w = pivot(r.torso, s * 0.2, 0.25, -0.22);
    w.rotation.y = s * 0.5;
    B(w, 0.06, 0.08, 0.5, 0x3a0f12, 0, 0.18, -0.2, m);
    B(w, 0.05, 0.36, 0.4, 0x6a1a20, 0, 0.0, -0.22, m);
    B(w, 0.05, 0.22, 0.22, 0x6a1a20, 0, -0.22, -0.32, m);
    r['wing' + (s > 0 ? 'R' : 'L')] = w;
  }
  // spade tail
  const tail = pivot(r.torso, 0, -0.32, -0.2);
  B(tail, 0.08, 0.08, 0.36, 0xb8342a, 0, -0.04, -0.18, m);
  B(tail, 0.08, 0.08, 0.2, 0xb8342a, 0, 0.06, -0.38, m);
  B(tail, 0.18, 0.16, 0.06, 0x2a1a1a, 0, 0.12, -0.48, m);
  r.tail = tail;
  // claws on both hands + small bone dagger
  B(r.armL, 0.24, 0.06, 0.26, 0xe8d8b0, 0, -0.68, 0.04, m);
  B(r.armR, 0.24, 0.06, 0.26, 0xe8d8b0, 0, -0.68, 0.04, m);
  const dag = pivot(r.handR, 0, 0, 0);
  B(dag, 0.06, 0.08, 0.2, 0x3a2418, 0, 0, 0.1, m);
  B(dag, 0.04, 0.1, 0.4, 0xe8d8b0, 0, 0, 0.38, m);
  r.weapon = dag;
  r.scale = 0.78;          // imps are small
  r.style = 'imp';
  return finalize(r);
}

export function buildSniper() {
  const p = { skin: 0xd9a07a, pants: 0x3a4630, boots: 0x1a1a1a, shirt: 0x4a5a3a, sleeve: 0x4a5a3a, belt: 0x1d2329 };
  const r = humanoid(p); const m = r.mats;
  // ghillie scraps on shoulders/back
  for (const [x, y, z, c] of [[-0.3, 0.32, -0.1, 0x5c6b3e], [0.3, 0.3, -0.05, 0x3f4d2a], [0, 0.2, -0.24, 0x6b7b4a], [-0.15, -0.05, -0.23, 0x4a5a3a], [0.2, 0.05, -0.23, 0x2f3a26]])
    B(r.torso, 0.24, 0.2, 0.08, c, x, y, z, m);
  B(r.torso, 0.7, 0.14, 0.46, 0x2f3a26, 0, 0.3, 0, m);
  // hood + face wrap + scope eye
  B(r.head, 0.58, 0.24, 0.58, 0x3f4d2a, 0, 0.24, -0.02, m);
  B(r.head, 0.58, 0.44, 0.1, 0x3f4d2a, 0, 0.02, -0.26, m);
  B(r.head, 0.5, 0.18, 0.04, 0x2f3a26, 0, -0.14, 0.26, m);
  B(r.head, 0.08, 0.08, 0.06, 0x6b7b4a, 0.22, 0.38, -0.12, m);
  // long rifle with scope + bipod (built along +Z, kept level)
  const gun = pivot(r.handR, -0.08, 0.02, 0.0);
  B(gun, 0.1, 0.14, 1.0, 0x23282e, 0, 0, 0.32, m);
  B(gun, 0.06, 0.06, 0.8, 0x15181c, 0, 0.03, 1.2, m);
  B(gun, 0.08, 0.1, 0.06, 0x15181c, 0, 0.03, 1.62, m);        // muzzle brake
  B(gun, 0.1, 0.1, 0.42, 0x111111, 0, 0.16, 0.38, m);         // scope
  B(gun, 0.12, 0.12, 0.05, 0x7fd4ff, 0, 0.16, 0.6, m);
  B(gun, 0.1, 0.18, 0.3, 0x3a4630, 0, -0.04, -0.24, m);       // stock
  B(gun, 0.03, 0.24, 0.03, 0x15181c, -0.05, -0.14, 1.0, m);   // bipod
  B(gun, 0.03, 0.24, 0.03, 0x15181c, 0.05, -0.14, 1.0, m);
  const flash = B(gun, 0.26, 0.26, 0.3, 0xfff0a0, 0, 0.03, 1.8, null, { emissive: 0xffc030 });
  flash.castShadow = false; flash.visible = false;
  r.muzzle = flash;
  r.level = [{ obj: gun, arm: r.armR, offset: 0 }];
  r.style = 'rifle';
  return finalize(r);
}

// ---------- neutral creeps ----------

// ---------- v0.11.0 troops ----------
export function buildLancer() {
  // rider (humanoid) on a barded warhorse: horse legs drive the walk cycle
  const p = { skin: 0xe2b08a, pants: 0x5a6470, boots: 0x3a3f46, shirt: 0x8a939c, sleeve: 0x8a939c, belt: 0x4a2f1a };
  const r = humanoid(p); const m = r.mats;
  r.legL.parent.remove(r.legL); r.legR.parent.remove(r.legR);
  const up = 1.05;
  for (const part of [r.torso, r.head, r.armL, r.armR]) part.position.y += up;
  // rider legs hanging over the saddle
  for (const sx of [-1, 1]) { B(r.body, 0.22, 0.5, 0.3, 0x5a6470, sx * 0.38, 1.55, 0.1, m); B(r.body, 0.24, 0.16, 0.34, 0x3a3f46, sx * 0.4, 1.28, 0.14, m); }
  // armor + helmet with plume
  B(r.torso, 0.7, 0.6, 0.46, 0xb8c0c8, 0, 0.05, 0, m);
  B(r.torso, 0.3, 0.3, 0.05, 0x2f62b8, 0, 0.05, 0.24, m);           // blue tabard
  B(r.torso, 0.1, 0.3, 0.05, 0xffffff, 0, 0.05, 0.265, m);          // white cross
  B(r.torso, 0.3, 0.1, 0.05, 0xffffff, 0, 0.1, 0.265, m);
  B(r.head, 0.58, 0.56, 0.58, 0xb8c0c8, 0, 0.04, 0, m);
  B(r.head, 0.44, 0.06, 0.04, 0x111111, 0, 0.06, 0.3, m);           // visor slit
  B(r.head, 0.12, 0.26, 0.4, 0xc0392b, 0, 0.42, -0.04, m);          // plume
  // banner on the back
  const flag = pivot(r.torso, 0.2, 0.2, -0.28);
  B(flag, 0.05, 1.6, 0.05, 0x5b3d22, 0, 0.7, 0, m);
  B(flag, 0.04, 0.5, 0.6, 0x2f62b8, 0, 1.25, -0.32, m);
  B(flag, 0.045, 0.1, 0.6, 0xffffff, 0, 1.25, -0.32, m);
  // lance
  const lance = pivot(r.handR, 0, 0, 0);
  B(lance, 0.1, 0.1, 2.4, 0x7b5130, 0, 0, 0.9, m);
  B(lance, 0.2, 0.2, 0.3, 0xc9d1d8, 0, 0, 2.2, m);
  B(lance, 0.26, 0.26, 0.12, 0xb8c0c8, 0, 0, 0.1, m);              // vamplate
  r.weapon = lance;
  // horse with barding
  const horse = 0x6b4a2a, bard = 0x2f62b8;
  B(r.body, 0.8, 0.7, 1.7, horse, 0, 1.05, -0.05, m);
  B(r.body, 0.86, 0.5, 1.2, bard, 0, 1.05, -0.05, m);               // caparison
  B(r.body, 0.88, 0.08, 1.22, 0xffffff, 0, 0.82, -0.05, m);
  B(r.body, 0.36, 0.7, 0.4, horse, 0, 1.55, 0.75, m);               // neck
  B(r.body, 0.32, 0.36, 0.7, horse, 0, 1.85, 1.0, m);               // head
  B(r.body, 0.34, 0.2, 0.3, 0x9aa3ab, 0, 1.95, 1.05, m);            // chanfron
  B(r.body, 0.1, 0.5, 0.3, 0x2a1a10, 0, 1.6, 0.55, m);              // mane
  B(r.body, 0.18, 0.6, 0.18, 0x2a1a10, 0, 1.0, -0.95, m);           // tail
  const legs = [];
  for (const [x, z] of [[-0.26, 0.5], [0.26, 0.5], [-0.26, -0.6], [0.26, -0.6]]) {
    const leg = pivot(r.body, x, 0.75, z);
    B(leg, 0.2, 0.62, 0.22, horse, 0, -0.32, 0, m);
    B(leg, 0.24, 0.14, 0.26, 0x2a1a10, 0, -0.68, 0, m);
    legs.push(leg);
  }
  r.legL = legs[0]; r.legR = legs[1]; r.extraLegs = [legs[2], legs[3]];
  r.scale = 1.05;
  r.barY = 3.9;   // rider sits high: bar above the plume
  return finalize(r);
}

export function buildElf() {
  const p = { skin: 0xf2d6be, pants: 0x3f6a2a, boots: 0x5a4630, shirt: 0x4c8c36, sleeve: 0x4c8c36, belt: 0x6b4423 };
  const r = humanoid(p); const m = r.mats;
  // leaf armor plates
  for (const [x, y, c] of [[-0.18, 0.18, 0x5aa040], [0.18, 0.18, 0x3f7a2e], [-0.18, -0.08, 0x3f7a2e], [0.18, -0.08, 0x5aa040]]) B(r.torso, 0.26, 0.22, 0.06, c, x, y, 0.22, m);
  B(r.armL, 0.26, 0.14, 0.28, 0x5aa040, 0, -0.08, 0, m); B(r.armR, 0.26, 0.14, 0.28, 0x5aa040, 0, -0.08, 0, m);
  // long silver hair, pointed ears, blue eyes
  B(r.head, 0.56, 0.14, 0.56, 0xe8e2c8, 0, 0.27, -0.02, m);
  B(r.head, 0.56, 0.75, 0.14, 0xe8e2c8, 0, -0.12, -0.28, m);
  B(r.head, 0.1, 0.5, 0.4, 0xe8e2c8, -0.27, 0.0, -0.08, m); B(r.head, 0.1, 0.5, 0.4, 0xe8e2c8, 0.27, 0.0, -0.08, m);
  B(r.head, 0.08, 0.18, 0.08, 0xf2d6be, -0.31, 0.12, 0, m); B(r.head, 0.08, 0.18, 0.08, 0xf2d6be, 0.31, 0.12, 0, m);
  B(r.head, 0.09, 0.09, 0.02, 0x4aa3ff, -0.12, 0.04, 0.258, m); B(r.head, 0.09, 0.09, 0.02, 0x4aa3ff, 0.12, 0.04, 0.258, m);
  B(r.head, 0.3, 0.06, 0.04, 0xc9a050, 0, 0.22, 0.27, m);            // circlet
  // quiver
  const q = pivot(r.torso, 0.15, 0.12, -0.3); q.rotation.z = -0.35;
  B(q, 0.2, 0.62, 0.2, 0x4a6a2a, 0, 0, 0, m);
  for (const x of [-0.05, 0.05]) B(q, 0.06, 0.14, 0.03, 0x9ad8ff, x, 0.42, 0, m);
  // elegant longbow
  const bow = pivot(r.handL, 0, -0.02, 0.04);
  const seg = [[-0.7, -0.02], [-0.55, 0.1], [-0.36, 0.18], [-0.12, 0.2], [0.12, 0.2], [0.36, 0.18], [0.55, 0.1], [0.7, -0.02]];
  seg.forEach(([y, z]) => B(bow, 0.06, 0.2, 0.06, 0xd8c890, 0, y, z, m));
  B(bow, 0.08, 0.16, 0.1, 0x3f7a2e, 0, 0, 0.2, m);
  const str = B(bow, 0.02, 1.4, 0.02, 0xeeeeee, 0, 0, -0.02, m); str.castShadow = false;
  const nock = pivot(bow, 0, 0, 0);
  B(nock, 0.035, 0.035, 0.75, 0xd8c890, 0, 0.0, 0.3, m);
  B(nock, 0.06, 0.06, 0.08, 0x9ad8ff, 0, 0.0, 0.68, m);
  r.level = [{ obj: bow, arm: r.armL, offset: 0 }];
  r.nockedArrow = nock;
  r.style = 'bow';
  return finalize(r);
}

export function buildRiotSkirmisher() {
  const p = { skin: 0xd09a74, pants: 0x161c2a, boots: 0x0d0d0d, shirt: 0x1c2436, sleeve: 0x1c2436, belt: 0x0d0d0d };
  const r = humanoid(p); const m = r.mats;
  // bulky body armor + pads
  B(r.torso, 0.84, 0.66, 0.54, 0x232c40, 0, 0.04, 0, m);
  B(r.armL, 0.3, 0.18, 0.32, 0x232c40, 0, -0.06, 0, m); B(r.armR, 0.3, 0.18, 0.32, 0x232c40, 0, -0.06, 0, m);
  B(r.legL, 0.3, 0.16, 0.1, 0x232c40, 0, -0.4, 0.17, m); B(r.legR, 0.3, 0.16, 0.1, 0x232c40, 0, -0.4, 0.17, m);
  B(r.torso, 0.5, 0.1, 0.04, 0xf2f2f2, 0, 0.2, 0.28, m);            // RIOT stripe
  // full helmet with visor
  B(r.head, 0.6, 0.58, 0.6, 0x1a1f2a, 0, 0.04, 0, m);
  B(r.head, 0.5, 0.26, 0.04, 0x9ad0ff, 0, 0.02, 0.31, m, { transparent: true, opacity: 0.6 });
  // tonfa
  const tonfa = pivot(r.handR, 0, 0, 0);
  B(tonfa, 0.09, 0.09, 0.85, 0x111111, 0, 0, 0.3, m); B(tonfa, 0.08, 0.22, 0.08, 0x111111, 0, -0.08, 0.1, m);
  r.weapon = tonfa;
  // big riot shield held in front (always on guard)
  const sh = pivot(r.body, -0.12, 1.05, 0.55);
  B(sh, 0.9, 1.5, 0.08, 0x9ad0ff, 0, 0, 0, m, { transparent: true, opacity: 0.5 });
  B(sh, 0.94, 0.08, 0.1, 0x2a2a2a, 0, 0.74, 0, m); B(sh, 0.94, 0.08, 0.1, 0x2a2a2a, 0, -0.74, 0, m);
  B(sh, 0.6, 0.12, 0.1, 0xffffff, 0, 0.3, 0.01, m);
  r.shield = sh;
  r.armL.rotation.x = -1.2;
  r.scale = 1.12;
  const out = finalize(r);
  out.armL.rotation.x = -1.2;
  return out;
}

export function buildReconDrone() {
  const root = new THREE.Group(); const body = new THREE.Group(); root.add(body);
  const m = new Map(); const r = { root, body, mats: m };
  r.torso = pivot(body, 0, 0.6, 0);
  B(r.torso, 0.9, 0.3, 0.9, 0x3b4652, 0, 0, 0, m);
  B(r.torso, 0.5, 0.2, 0.5, 0x23282e, 0, 0.22, 0, m);
  B(r.torso, 0.16, 0.12, 0.08, 0x4aa3ff, 0, 0, 0.47, m, { emissive: 0x2a6ab0 });   // camera eye
  r.props = [];
  for (const [x, z] of [[-0.6, 0.6], [0.6, 0.6], [-0.6, -0.6], [0.6, -0.6]]) {
    B(r.torso, 0.5, 0.08, 0.1, 0x23282e, x / 2, 0.05, z / 2, m).rotation.y = Math.atan2(x, z);
    B(r.torso, 0.14, 0.18, 0.14, 0x15181c, x, 0.12, z, m);
    const pr = pivot(r.torso, x, 0.24, z);
    B(pr, 0.7, 0.03, 0.1, 0x9aa3ab, 0, 0, 0, m); B(pr, 0.1, 0.03, 0.7, 0x9aa3ab, 0, 0, 0, m);
    r.props.push(pr);
  }
  // twin carbines underneath
  for (const x of [-0.22, 0.22]) { B(r.torso, 0.1, 0.12, 0.7, 0x15181c, x, -0.24, 0.2, m); B(r.torso, 0.05, 0.05, 0.3, 0x0d0f12, x, -0.22, 0.65, m); }
  const flash = B(r.torso, 0.25, 0.15, 0.2, 0xfff0a0, 0, -0.22, 0.85, null, { emissive: 0xffc030 });
  flash.castShadow = false; flash.visible = false;
  r.muzzle = flash;
  // dummy limbs so the shared animator works
  r.head = pivot(r.torso, 0, 0, 0);
  r.legL = pivot(body, 0, 0, 0); r.legR = pivot(body, 0, 0, 0);
  r.armL = pivot(body, 0, 0, 0); r.armR = pivot(body, 0, 0, 0);
  r.handL = pivot(r.armL, 0, 0, 0); r.handR = pivot(r.armR, 0, 0, 0);
  r.style = 'drone';
  return finalize(r);
}

/** Floating loot cube on the ground. */
export function buildLoot(color) {
  // drawn on top of everything (depthTest off) so drops stay visible under tree canopies
  const g = new THREE.Group();
  const top = { depthTest: false, depthWrite: false, transparent: true };
  const core = new THREE.Mesh(boxGeo(0.45, 0.45, 0.45), new THREE.MeshBasicMaterial({ color, ...top, opacity: 0.95 }));
  const edge = new THREE.LineSegments(new THREE.EdgesGeometry(boxGeo(0.55, 0.55, 0.55)), new THREE.LineBasicMaterial({ color: 0xffffff, ...top }));
  const beam = new THREE.Mesh(boxGeo(0.14, 5, 0.14), new THREE.MeshBasicMaterial({ color: 0xfff3b0, ...top, opacity: 0.45 }));
  beam.position.y = 2.5;
  const ring = new THREE.Mesh(new THREE.RingGeometry(0.55, 0.75, 4, 1), new THREE.MeshBasicMaterial({ color: 0xfff3b0, ...top, opacity: 0.8 }));
  ring.rotation.x = -Math.PI / 2; ring.rotation.z = Math.PI / 4; ring.position.y = -0.45;
  for (const m of [core, edge, beam, ring]) { m.renderOrder = 20; m.castShadow = false; }
  g.add(core, edge, beam, ring);
  g.userData.spin = [core, edge];
  return g;
}

/** Four-legged rig (bears). Provides the same rig fields the animator expects (dummy arms). */
function quadruped(p) {
  const root = new THREE.Group(); const body = new THREE.Group(); root.add(body);
  const m = new Map(); const r = { root, body, mats: m };
  r.torso = pivot(body, 0, 0.95, 0);
  B(r.torso, 0.95, 0.75, 1.55, p.fur, 0, 0, 0, m);              // body
  B(r.torso, 0.85, 0.3, 1.2, p.dark, 0, 0.42, -0.1, m);         // back hump
  B(r.torso, 0.25, 0.25, 0.2, p.dark, 0, 0.15, -0.85, m);       // tail
  r.head = pivot(body, 0, 1.15, 0.9);
  B(r.head, 0.62, 0.55, 0.55, p.fur, 0, 0, 0, m);
  B(r.head, 0.36, 0.28, 0.3, p.snout, 0, -0.1, 0.38, m);        // snout
  B(r.head, 0.12, 0.1, 0.06, 0x111111, 0, -0.02, 0.54, m);      // nose
  for (const sx of [-1, 1]) {
    B(r.head, 0.16, 0.16, 0.1, p.dark, sx * 0.24, 0.32, -0.05, m); // ears
    B(r.head, 0.08, 0.08, 0.03, p.eye, sx * 0.15, 0.1, 0.28, m);    // eyes
  }
  const legs = [];
  for (const [x, z] of [[-0.3, 0.55], [0.3, 0.55], [-0.3, -0.55], [0.3, -0.55]]) {
    const leg = pivot(body, x, 0.65, z);
    B(leg, 0.28, 0.6, 0.32, p.fur, 0, -0.3, 0, m);
    B(leg, 0.3, 0.12, 0.36, p.dark, 0, -0.6, 0.03, m);
    legs.push(leg);
  }
  r.legL = legs[0]; r.legR = legs[1]; r.extraLegs = [legs[2], legs[3]];
  r.armL = pivot(body, 0, 0, 0); r.armR = pivot(body, 0, 0, 0);    // dummies (bears bite with the head)
  r.handL = pivot(r.armL, 0, 0, 0); r.handR = pivot(r.armR, 0, 0, 0);
  r.style = 'beast';
  return r;
}
export function buildDireBear() {
  const r = quadruped({ fur: 0x5a3a22, dark: 0x3a2414, snout: 0x8a6a4a, eye: 0xff3a2a });
  B(r.head, 0.1, 0.16, 0.06, 0xf2ead6, -0.1, -0.28, 0.48, r.mats); B(r.head, 0.1, 0.16, 0.06, 0xf2ead6, 0.1, -0.28, 0.48, r.mats); // fangs
  B(r.torso, 1.0, 0.18, 0.4, 0x2a1a10, 0, 0.5, 0.55, r.mats);   // shaggy mane
  r.scale = 1.35;
  return finalize(r);
}
export function buildBlueBear() {
  const r = quadruped({ fur: 0x4a6a9a, dark: 0x2f4a70, snout: 0x9ab0d0, eye: 0x111111 });
  r.scale = 0.95;
  return finalize(r);
}
function ghost(p) {
  const r = humanoid({ skin: p.skin, pants: p.robe, boots: p.robe, shirt: p.robe, sleeve: p.robe, belt: p.dark });
  const m = r.mats, ex = { transparent: true, opacity: 0.78 };
  r.legL.parent.remove(r.legL); r.legR.parent.remove(r.legR);
  for (const [w, y, d] of [[0.7, 0.62, 0.45], [0.6, 0.36, 0.38], [0.44, 0.16, 0.3]]) B(r.body, w, 0.26, d, p.robe, 0, y, 0, m, ex);   // tapered wisp tail
  B(r.head, 0.6, 0.6, 0.6, p.robe, 0, 0.05, -0.04, m, ex);     // hood
  B(r.head, 0.42, 0.4, 0.06, 0x0a0614, 0, 0, 0.26, m);           // dark face
  B(r.head, 0.1, 0.06, 0.03, p.eye, -0.1, 0.04, 0.3, m, { emissive: p.eye });
  B(r.head, 0.1, 0.06, 0.03, p.eye, 0.1, 0.04, 0.3, m, { emissive: p.eye });
  r.hover = true;
  return r;
}
export function buildBanshee() { const r = ghost({ skin: 0xd8d0f0, robe: 0x8a7ab8, dark: 0x4a3a78, eye: 0x9af0ff }); r.scale = 1.15; return finalize(r); }
export function buildSmallBanshee() { const r = ghost({ skin: 0xd8d0f0, robe: 0xa89ad0, dark: 0x5a4a88, eye: 0x9af0ff }); r.scale = 0.85; return finalize(r); }
export function buildAlphaThug() {
  const p = { skin: 0x8a5a40, pants: 0x1a1a22, boots: 0xf0f0f0, shirt: 0xb83a3a, sleeve: 0xb83a3a, belt: 0x111111 };
  const r = humanoid(p); const m = r.mats;
  B(r.torso, 0.74, 0.62, 0.46, 0xa02a2a, 0, 0.05, 0, m);         // red varsity jacket
  B(r.torso, 0.4, 0.06, 0.05, 0xf2c94c, 0, 0.2, 0.25, m);        // chain
  B(r.head, 0.56, 0.12, 0.56, 0x111111, 0, 0.26, 0, m);          // snapback
  B(r.head, 0.5, 0.05, 0.24, 0x111111, 0, 0.21, 0.32, m);
  B(r.head, 0.44, 0.1, 0.03, 0x050505, 0, 0.05, 0.265, m);       // shades
  const bat = pivot(r.handR, 0, 0, 0);
  B(bat, 0.08, 0.08, 0.5, 0x2a2a2a, 0, 0, 0.2, m); B(bat, 0.14, 0.14, 0.55, 0x9aa3ab, 0, 0, 0.68, m);   // metal bat
  r.weapon = bat; r.scale = 1.15;
  return finalize(r);
}
export function buildHooligan() {
  const p = { skin: 0xd09a74, pants: 0x2f6b3a, boots: 0x111111, shirt: 0x2f6b3a, sleeve: 0x2f6b3a, belt: 0x1a1a1a };
  const r = humanoid(p); const m = r.mats;
  B(r.torso, 0.06, 0.6, 0.44, 0xf0f0f0, -0.34, 0.02, 0, m); B(r.torso, 0.06, 0.6, 0.44, 0xf0f0f0, 0.34, 0.02, 0, m);   // track-suit stripes
  B(r.head, 0.56, 0.14, 0.56, 0x2f2f2f, 0, 0.24, 0, m);          // beanie
  const bot = pivot(r.handR, 0, 0, 0);
  B(bot, 0.12, 0.12, 0.3, 0x2f6b3a, 0, 0, 0.2, m, { transparent: true, opacity: 0.8 }); B(bot, 0.06, 0.06, 0.16, 0x2f6b3a, 0, 0, 0.42, m);
  r.weapon = bot;
  return finalize(r);
}
export function buildOutlaw() {
  const p = { skin: 0xb07a58, pants: 0x2a2a30, boots: 0x3a2414, shirt: 0x3a2a1a, sleeve: 0x3a2a1a, belt: 0x111111 };
  const r = humanoid(p); const m = r.mats;
  B(r.torso, 0.76, 0.6, 0.46, 0x2a1a10, 0, 0.05, 0, m);          // leather vest
  B(r.torso, 0.5, 0.1, 0.05, 0x9aa3ab, 0, -0.1, 0.25, m);        // chain belt
  B(r.head, 0.44, 0.2, 0.04, 0x8a2a2a, 0, -0.12, 0.26, m);       // bandana mask
  B(r.head, 0.7, 0.06, 0.7, 0x3a2414, 0, 0.26, 0, m);            // hat brim
  B(r.head, 0.44, 0.22, 0.44, 0x3a2414, 0, 0.38, 0, m);
  const bar = pivot(r.handR, 0, 0, 0);
  B(bar, 0.08, 0.08, 0.95, 0xb03030, 0, 0, 0.35, m); B(bar, 0.08, 0.22, 0.08, 0xb03030, 0, 0.08, 0.82, m);    // crowbar
  r.weapon = bar; r.scale = 1.1;
  return finalize(r);
}
export function buildWisp() {
  const g = new THREE.Group();
  const c = B(g, 0.3, 0.3, 0.3, 0xb89af0, 0, 0, 0, null, { emissive: 0x7a4ad0 });
  const t = B(g, 0.16, 0.16, 0.5, 0xd8c8ff, 0, 0, -0.35, null, { emissive: 0x5a3aa0, transparent: true, opacity: 0.6 });
  c.castShadow = t.castShadow = false;
  return g;
}
/** Sleeping "Z" sprite (shared texture). */
let zTex = null;
export function buildZzz() {
  if (!zTex) {
    const cv = document.createElement('canvas'); cv.width = cv.height = 16;
    const c = cv.getContext('2d'); c.fillStyle = '#e8f0ff';
    for (const [x, y, w] of [[3, 3, 10], [9, 5, 2], [7, 7, 2], [5, 9, 2], [3, 11, 10]]) c.fillRect(x, y, w, 2);
    zTex = new THREE.CanvasTexture(cv); zTex.magFilter = THREE.NearestFilter; zTex.minFilter = THREE.NearestFilter;
  }
  const s = new THREE.Sprite(new THREE.SpriteMaterial({ map: zTex, transparent: true, depthWrite: false }));
  s.scale.setScalar(0.45);
  return s;
}

// ======================= DEPLOYABLE BUILDINGS (artillery) =======================
// Same rig contract as troops (root/body/matList/barY) plus: yaw (turns to aim), barrel (pivot, x = elevation),
// recoil (slides back on firing), muzzle (flash), scaffold (shown while under construction). Forward = +z.
function structureRig() {
  const root = new THREE.Group(), body = new THREE.Group(); root.add(body);
  return { root, body, mats: new Map(), style: 'structure' };
}
function finishStructure(r) {
  r.matList = [...r.mats.values()];
  for (const mt of r.matList) mt.emissive = new THREE.Color(0x000000);
  r.muzzle.visible = false; r.scaffold.visible = false;
  if (r.crew?.muzzle) r.crew.muzzle.visible = false;   // the crew's own rifle flash: the tower draws its own
  return r;
}
/** Wooden scaffold poles + planks around a building site (hidden once built). */
function scaffold(parent, half, h, mats) {
  const g = pivot(parent, 0, 0, 0);
  for (const [x, z] of [[-half, -half], [-half, half], [half, -half], [half, half]]) B(g, 0.16, h, 0.16, 0x8a6a42, x, h / 2, z, mats);
  for (const y of [h * 0.45, h]) { B(g, half * 2 + 0.2, 0.1, 0.25, 0x9a7a4c, 0, y, -half, mats); B(g, half * 2 + 0.2, 0.1, 0.25, 0x9a7a4c, 0, y, half, mats); }
  B(g, 0.12, h * 1.1, 0.12, 0x6b4a2b, -half + 0.2, h * 0.55, 0, mats).rotation.z = 0.5;   // diagonal brace
  return g;
}

export function buildCannon() {
  const r = structureRig(), m = r.mats;
  // low stone emplacement (gap at the front for the muzzle)
  for (const [x, z, w, d] of [[-1.15, 0, 0.4, 2.7], [1.15, 0, 0.4, 2.7], [0, -1.15, 1.9, 0.4], [-0.75, 1.15, 0.5, 0.4], [0.75, 1.15, 0.5, 0.4]]) B(r.body, w, 0.45, d, 0x8d8f93, x, 0.22, z, m);
  B(r.body, 2.3, 0.08, 2.3, 0x6e6252, 0, 0.04, 0, m);
  r.yaw = pivot(r.body, 0, 0, 0);
  // carriage: wooden cheeks, axle, two wheels, trail
  for (const x of [-0.42, 0.42]) B(r.yaw, 0.22, 0.6, 1.5, 0x6b4a2b, x, 0.75, -0.05, m);
  B(r.yaw, 1.3, 0.16, 0.16, 0x3a3a3a, 0, 0.55, 0.25, m);
  for (const x of [-0.68, 0.68]) {
    B(r.yaw, 0.16, 1.1, 1.1, 0x5e4026, x, 0.55, 0.25, m);
    B(r.yaw, 0.18, 0.3, 0.3, 0x4a4a4a, x, 0.55, 0.25, m);       // iron hub
    B(r.yaw, 0.17, 1.12, 0.12, 0x4a3520, x, 0.55, 0.25, m);      // spoke
  }
  B(r.yaw, 0.4, 0.18, 1.2, 0x6b4a2b, 0, 0.4, -0.9, m);           // trail
  // barrel (pivot at the trunnions): black iron, reinforcing rings, cascabel knob
  r.barrel = pivot(r.yaw, 0, 1.05, 0.05);
  r.recoil = pivot(r.barrel, 0, 0, 0);
  B(r.recoil, 0.44, 0.44, 1.9, 0x26282c, 0, 0, 0.45, m);
  for (const z of [-0.3, 0.55, 1.3]) B(r.recoil, 0.52, 0.52, 0.14, 0x34363b, 0, 0, z, m);
  B(r.recoil, 0.22, 0.22, 0.22, 0x34363b, 0, 0, -0.6, m);
  r.muzzle = B(r.recoil, 0.5, 0.5, 0.5, 0xffb040, 0, 0, 1.6, m, { emissive: 0xff7a00 });
  r.muzzle.castShadow = false;
  r.barrel.rotation.x = -0.12;
  r.rest = -0.12;
  r.scaffold = scaffold(r.body, 1.35, 2.2, m);
  r.barY = 2.3;
  return finishStructure(r);
}

export function buildHowitzer() {
  const r = structureRig(), m = r.mats;
  const OL = 0x5b6b3a, DK = 0x46552c, ST = 0x4a4e54;
  // concrete pad + sandbag lip
  B(r.body, 3, 0.2, 3, 0x9a9da2, 0, 0.1, 0, m);
  for (let k = -1; k <= 1; k++) { B(r.body, 0.9, 0.35, 0.5, 0xa8956a, k * 0.95, 0.37, -1.3, m); B(r.body, 0.5, 0.35, 0.9, 0xa8956a, -1.3, 0.37, k * 0.95, m); B(r.body, 0.5, 0.35, 0.9, 0xa8956a, 1.3, 0.37, k * 0.95, m); }
  r.yaw = pivot(r.body, 0, 0.2, 0);
  // split trail legs, wheels, gun shield
  for (const s of [-1, 1]) { const leg = B(r.yaw, 0.22, 0.2, 1.7, DK, s * 0.45, 0.35, -0.85, m); leg.rotation.y = s * 0.32; B(r.yaw, 0.3, 0.12, 0.3, ST, s * 0.75, 0.25, -1.6, m); }
  for (const s of [-1, 1]) { B(r.yaw, 0.28, 0.9, 0.9, 0x222428, s * 0.82, 0.45, 0.15, m); B(r.yaw, 0.3, 0.3, 0.3, OL, s * 0.82, 0.45, 0.15, m); }
  B(r.yaw, 1.4, 0.3, 0.6, OL, 0, 0.75, 0.1, m);                  // cradle / axle housing
  const shield = B(r.yaw, 1.9, 0.95, 0.1, OL, 0, 1.25, 0.55, m); shield.rotation.x = -0.12;
  B(r.yaw, 0.6, 0.25, 0.12, DK, 0, 1.55, 0.6, m);                 // sight window frame
  // long barrel with recuperator + muzzle brake
  r.barrel = pivot(r.yaw, 0, 1.15, 0.15);
  r.recoil = pivot(r.barrel, 0, 0, 0);
  B(r.recoil, 0.5, 0.45, 0.9, DK, 0, 0, -0.2, m);                // breech
  B(r.recoil, 0.26, 0.26, 2.9, OL, 0, 0, 1.4, m);
  B(r.recoil, 0.18, 0.18, 1.3, ST, 0, 0.25, 0.55, m);            // recuperator
  B(r.recoil, 0.42, 0.34, 0.36, ST, 0, 0, 2.9, m);               // muzzle brake
  r.muzzle = B(r.recoil, 0.6, 0.6, 0.6, 0xffc060, 0, 0, 3.2, m, { emissive: 0xff8a00 });
  r.muzzle.castShadow = false;
  r.barrel.rotation.x = -0.45;
  r.rest = -0.45;
  r.scaffold = scaffold(r.body, 1.55, 2.4, m);
  r.barY = 2.6;
  return finishStructure(r);
}

// ----- defense towers (direct fire / rocket volley). Same rig contract; `crew` = a troop rig standing on top -----
/** Put a troop rig (Ranger / Sniper / Gunner) on a tower and share its materials for the hit flash. */
function addCrew(r, crewRig, y, z = 0, s = 0.85) {
  crewRig.root.scale.setScalar(s); crewRig.root.position.set(0, y, z);
  r.yaw.add(crewRig.root);
  crewRig.matList.forEach((m, i) => r.mats.set('crew' + i, m));
  r.crew = crewRig;
  return crewRig;
}
/** Level the crew's held weapons after posing the arms (troops do this every frame in Unit.levelHeld). */
function levelCrew(rig) { for (const l of rig.level || []) l.obj.rotation.x = -l.arm.rotation.x + l.offset; }
export function buildArcherTower() {
  const r = structureRig(), m = r.mats;
  B(r.body, 2.4, 0.9, 2.4, 0x8d8f93, 0, 0.45, 0, m);                                  // stone footing
  for (const [x, z] of [[-0.95, -0.95], [-0.95, 0.95], [0.95, -0.95], [0.95, 0.95]]) B(r.body, 0.32, 3.4, 0.32, 0x6b4a2b, x, 2.6, z, m);
  for (const y of [1.6, 3]) for (const s of [-1, 1]) { B(r.body, 2.2, 0.14, 0.14, 0x5e4026, 0, y, s * 0.95, m); B(r.body, 0.14, 0.14, 2.2, 0x5e4026, s * 0.95, y, 0, m); }
  B(r.body, 2.7, 0.25, 2.7, 0x7a5532, 0, 4.4, 0, m);                                    // platform
  for (const s of [-1, 1]) { B(r.body, 2.7, 0.55, 0.14, 0x6b4a2b, 0, 4.8, s * 1.28, m); B(r.body, 0.14, 0.55, 2.7, 0x6b4a2b, s * 1.28, 4.8, 0, m); }
  for (const [x, z] of [[-1.2, -1.2], [-1.2, 1.2], [1.2, -1.2], [1.2, 1.2]]) B(r.body, 0.18, 1.6, 0.18, 0x5e4026, x, 5.3, z, m);
  B(r.body, 3, 0.25, 3, 0x6b2a24, 0, 6.2, 0, m); B(r.body, 2, 0.35, 2, 0x7d3129, 0, 6.5, 0, m); B(r.body, 0.9, 0.35, 0.9, 0x8e3a30, 0, 6.85, 0, m);
  r.yaw = pivot(r.body, 0, 4.52, 0);
  addCrew(r, buildArcher(), 0, 0, 0.85);
  r.crew.armL.rotation.x = -1.4; r.crew.armR.rotation.x = -1.3; levelCrew(r.crew);
  r.muzzle = B(r.yaw, 0.1, 0.1, 0.1, 0xffffff, 0, 1.4, 0.6, m); r.muzzle.castShadow = false;
  r.muzzleY = 4.52 + 1.4;
  r.scaffold = scaffold(r.body, 1.4, 4.6, m);
  r.barY = 7.4;
  return finishStructure(r);
}
export function buildSniperTower() {
  const r = structureRig(), m = r.mats, ST = 0x4a4e54, DK = 0x34373c;
  B(r.body, 2.4, 0.3, 2.4, 0x9a9da2, 0, 0.15, 0, m);                                   // concrete pad
  for (const [x, z] of [[-0.9, -0.9], [-0.9, 0.9], [0.9, -0.9], [0.9, 0.9]]) B(r.body, 0.22, 5, 0.22, ST, x, 2.7, z, m);
  for (const y of [1.4, 2.8, 4.1]) for (const s of [-1, 1]) { B(r.body, 2, 0.1, 0.1, DK, 0, y, s * 0.9, m); B(r.body, 0.1, 0.1, 2, DK, s * 0.9, y, 0, m); }
  B(r.body, 0.12, 4.6, 0.5, DK, -0.9, 2.5, 0, m);                                         // ladder rail
  B(r.body, 2.6, 0.25, 2.6, 0x5a5e64, 0, 5.2, 0, m);                                      // deck
  for (const s of [-1, 1]) { B(r.body, 2.6, 0.7, 0.1, 0x3a3d42, 0, 5.65, s * 1.25, m); B(r.body, 0.1, 0.7, 2.6, 0x3a3d42, s * 1.25, 5.65, 0, m); }
  B(r.body, 2.8, 0.15, 2.8, 0x4a5a3a, 0, 7.2, 0, m);                                      // camo net roof
  for (const [x, z] of [[-1.2, -1.2], [-1.2, 1.2], [1.2, -1.2], [1.2, 1.2]]) B(r.body, 0.1, 1.9, 0.1, ST, x, 6.2, z, m);
  r.yaw = pivot(r.body, 0, 5.33, 0);
  const sn = addCrew(r, buildSniper(), 0, -0.1, 0.85);
  sn.armR.rotation.x = -1.35; sn.armL.rotation.x = -1.45; sn.armL.rotation.z = 0.35; levelCrew(sn);
  r.muzzle = B(r.yaw, 0.35, 0.35, 0.35, 0xfff0b0, 0, 1.45, 1.5, m, { emissive: 0xffd040 }); r.muzzle.castShadow = false;
  r.muzzleY = 5.33 + 1.45;
  r.scaffold = scaffold(r.body, 1.4, 5.3, m);
  r.barY = 8.2;
  return finishStructure(r);
}
export function buildHwacha() {
  const r = structureRig(), m = r.mats;
  B(r.body, 2.6, 0.9, 2.6, 0x7a5532, 0, 0.45, 0, m);                                   // raised wooden firing platform
  for (const s of [-1, 1]) B(r.body, 2.6, 0.18, 0.18, 0x5e4026, 0, 0.95, s * 1.22, m);
  r.yaw = pivot(r.body, 0, 0.9, 0);
  B(r.yaw, 0.9, 0.18, 2.2, 0x6b4a2b, 0, 0.45, -0.2, m);                                  // cart bed + shafts
  for (const s of [-1, 1]) { B(r.yaw, 0.12, 0.12, 1.6, 0x5e4026, s * 0.35, 0.4, -1.3, m); B(r.yaw, 0.14, 0.9, 0.9, 0x4a3520, s * 0.6, 0.45, 0, m); }
  // launcher frame: a grid of rocket tubes, tilted up
  r.barrel = pivot(r.yaw, 0, 0.75, 0);
  r.recoil = pivot(r.barrel, 0, 0, 0);
  B(r.recoil, 1.3, 0.95, 0.9, 0x7a5532, 0, 0.45, 0.1, m);
  for (let i = 0; i < 5; i++) for (let j = 0; j < 4; j++) {
    B(r.recoil, 0.16, 0.16, 0.35, 0x2a1d12, -0.5 + i * 0.25, 0.1 + j * 0.24, 0.6, m);     // tube mouths
    B(r.recoil, 0.07, 0.07, 0.12, 0xc9a050, -0.5 + i * 0.25, 0.1 + j * 0.24, 0.8, m);      // arrow tips
  }
  r.muzzle = B(r.recoil, 1.3, 1, 0.3, 0xffb040, 0, 0.45, 0.9, m, { emissive: 0xff6a00 }); r.muzzle.castShadow = false;
  r.barrel.rotation.x = -0.55; r.rest = -0.55;
  r.muzzleY = 2.2;
  r.scaffold = scaffold(r.body, 1.45, 2.4, m);
  r.barY = 3.1;
  return finishStructure(r);
}
export function buildMgNest() {
  const r = structureRig(), m = r.mats, OL = 0x5b6b3a;
  B(r.body, 2.8, 2.2, 2.8, 0x9a9da2, 0, 1.1, 0, m);                                     // concrete bunker
  B(r.body, 2.9, 0.15, 2.9, 0x7a7e84, 0, 2.27, 0, m);
  B(r.body, 0.1, 0.35, 1.6, 0x1a1a22, 1.42, 1.5, 0, m);                                   // firing slit
  for (const [x, z, w, d] of [[0, 1.2, 2.6, 0.5], [0, -1.2, 2.6, 0.5], [1.2, 0, 0.5, 1.4], [-1.2, 0, 0.5, 1.4]]) B(r.body, w, 0.45, d, 0xa8956a, x, 2.57, z, m);
  r.yaw = pivot(r.body, 0, 2.35, 0);
  B(r.yaw, 0.12, 0.7, 0.12, 0x34373c, 0, 0.35, 0.4, m);                                   // tripod post
  r.barrel = pivot(r.yaw, 0, 0.8, 0.4);
  r.recoil = pivot(r.barrel, 0, 0, 0);
  B(r.recoil, 0.3, 0.28, 0.7, 0x2a2d32, 0, 0, 0, m);
  B(r.recoil, 0.12, 0.12, 1.1, 0x1e2024, 0, 0, 0.85, m);
  B(r.recoil, 0.18, 0.2, 0.25, OL, 0.2, -0.05, 0.1, m);                                   // ammo box
  r.muzzle = B(r.recoil, 0.32, 0.32, 0.32, 0xfff3b0, 0, 0, 1.5, m, { emissive: 0xffd040 }); r.muzzle.castShadow = false;
  r.barrel.rotation.x = -0.05; r.rest = -0.05;
  const gn = addCrew(r, buildGunner(), 0, -0.55, 0.8);
  gn.armR.rotation.x = -1.3; gn.armL.rotation.x = -1.35; levelCrew(gn);
  r.muzzleY = 2.35 + 0.8;
  r.scaffold = scaffold(r.body, 1.5, 2.8, m);
  r.barY = 4.3;
  return finishStructure(r);
}
/** Hwacha rocket-arrow (Game.fireShell volley). */
export function buildRocket() {
  const g = new THREE.Group();
  B(g, 0.08, 0.08, 0.7, 0x6b4a2b, 0, 0, 0, null);
  B(g, 0.14, 0.14, 0.22, 0x8a2a1c, 0, 0, -0.1, null);
  const f = B(g, 0.16, 0.16, 0.2, 0xffb040, 0, 0, -0.38, null, { emissive: 0xff6a00 }); f.castShadow = false;
  return g;
}

export const UNIT_BUILDERS = { cannon: buildCannon, howitzer: buildHowitzer, archerTower: buildArcherTower, sniperTower: buildSniperTower, hwacha: buildHwacha, mgNest: buildMgNest, lancer: buildLancer, elf: buildElf, riotSkirmisher: buildRiotSkirmisher, reconDrone: buildReconDrone, direBear: buildDireBear, blueBear: buildBlueBear, banshee: buildBanshee, smallBanshee: buildSmallBanshee, alphaThug: buildAlphaThug, hooligan: buildHooligan, outlaw: buildOutlaw,  sniper: buildSniper,  viking: buildViking, police: buildPolice, archer: buildArcher, gunner: buildGunner, imp: buildImp };

// projectiles — built along +Z so lookAt() aims them
export function buildArrow() {
  const g = new THREE.Group();
  B(g, 0.05, 0.05, 0.85, 0x8a6a42, 0, 0, 0, null);
  B(g, 0.09, 0.09, 0.12, 0x9aa3ab, 0, 0, 0.46, null);
  B(g, 0.12, 0.02, 0.14, 0xf2f2f2, 0, 0, -0.36, null);
  B(g, 0.02, 0.12, 0.14, 0xc0392b, 0, 0, -0.36, null);
  g.children.forEach((c) => (c.castShadow = false));
  return g;
}
/** Cannonball (black iron) and howitzer shell (olive, pointed): ArtilleryShell projectiles in game.js. */
export function buildCannonball() {
  const g = new THREE.Group();
  B(g, 0.34, 0.34, 0.34, 0x1e2024, 0, 0, 0, null);
  return g;
}
export function buildShell() {
  const g = new THREE.Group();
  B(g, 0.22, 0.22, 0.6, 0x5b6b3a, 0, 0, 0, null);
  B(g, 0.14, 0.14, 0.2, 0xc9a050, 0, 0, 0.38, null);
  return g;
}

export function buildBullet() {
  const g = new THREE.Group();
  const t = B(g, 0.07, 0.07, 0.9, 0xfff3b0, 0, 0, 0, null, { emissive: 0xffd040 });
  t.castShadow = false;
  return g;
}

// ======================= STRUCTURES & PROPS =======================

// Castle tiers (Grow Castle-style growth). Level 3 is the classic castle the lane map uses.
export const CASTLE_TIERS = [
  { name: 'Wooden Fort', desc: 'Small stone keep behind a wooden palisade.' },
  { name: 'Stone Keep', desc: 'Full-size keep with two gate towers.' },
  { name: 'Castle', desc: 'Four corner towers and full battlements.' },
  { name: 'Fortress', desc: 'Adds a central donjon (watchtower) and gilded spires.' },
  { name: 'Citadel', desc: 'Taller towers, braziers at the gate and royal banners.' },
];
const TOWER_SPOTS = [[-4.5, -6], [-4.5, 6], [4.5, -6], [4.5, 6]];
/**
 * Where wall troops stand at each castle level (local coords, gate faces +x). Front-wall troops stand on
 * the roof behind the battlements, in the gaps between the merlons (merlons sit at z = 0, ±2, ±4).
 * Filled center-out, so the first Battlement level takes the middle gap.
 */
export function castleSlots(level = 3) {
  const L = Math.max(1, Math.min(CASTLE_TIERS.length, level));
  if (L === 1) return [{ x: 1.9, y: 7, z: 0 }];
  const wall = (L === 2 ? [-1, 1] : [-1, 1, -3, 3]).map((z) => ({ x: 3.4, y: 9, z }));
  const th = L >= 5 ? 16 : 13;
  if (L >= 4) wall.push({ x: 4.5, y: th, z: -6 }, { x: 4.5, y: th, z: 6 });
  if (L >= 5) wall.push({ x: -1.5, y: 17, z: -1.2 }, { x: -1.5, y: 17, z: 1.2 });
  return wall;
}

export function buildCastle(level = 3) {
  const L = Math.max(1, Math.min(CASTLE_TIERS.length, level));
  const g = new THREE.Group();
  const stone = [0x8d8f93, 0x7f8186, 0x9a9ca0, 0x74767b];
  const pick = (i) => stone[i % stone.length];
  const GOLD = 0xe0b040;
  // main keep: half sizes + height
  const [hx, hz, kh] = L === 1 ? [3, 4, 7] : [4.5, 6, 9];
  B(g, hx * 2, kh, hz * 2, 0x86888d, 0, kh / 2, 0, null);
  // corner towers
  const th = L >= 5 ? 16 : 13;
  const towers = L === 1 ? [] : L === 2 ? TOWER_SPOTS.slice(2) : TOWER_SPOTS;
  towers.forEach(([x, z], i) => {
    B(g, 3.2, th, 3.2, pick(i), x, th / 2, z, null);
    for (let a = 0; a < 4; a++) {
      const ox = [-1.2, 1.2][a % 2], oz = [-1.2, 1.2][a >> 1];
      B(g, 0.9, 0.9, 0.9, 0x7a7c80, x + ox, th + 0.45, z + oz, null);
    }
    B(g, 3.6, 0.4, 3.6, 0x6e7075, x, th - 0.8, z, null);
    // Fortress+: front towers lose their roofs so wall troops can stand on them
    if (L >= 4 && x > 0) return;
    // pointed roof (stacked)
    B(g, 2.4, 1, 2.4, 0x6b2a24, x, th + 1.4, z, null);
    B(g, 1.6, 1, 1.6, 0x7d3129, x, th + 2.4, z, null);
    B(g, 0.8, 1, 0.8, 0x8e3a30, x, th + 3.4, z, null);
    if (L >= 4) B(g, 0.3, 0.9, 0.3, GOLD, x, th + 4.35, z, null, { emissive: 0x3a2800 });
  });
  // wall crenellations
  // (the small Wooden Fort keep leaves a gap in the middle for its one wall troop)
  for (const z of L === 1 ? [-3, -1.2, 1.2, 3] : [-4, -2, 0, 2, 4]) {
    B(g, 0.9, 0.9, 0.9, 0x7a7c80, hx - 0.4, kh + 0.45, z, null);
    B(g, 0.9, 0.9, 0.9, 0x7a7c80, -(hx - 0.4), kh + 0.45, z, null);
  }
  for (let x = -(hx - 2); x <= hx - 2 + 1e-6; x += hx - 2) {
    B(g, 0.9, 0.9, 0.9, 0x7a7c80, x, kh + 0.45, hz - 0.4, null);
    B(g, 0.9, 0.9, 0.9, 0x7a7c80, x, kh + 0.45, -(hz - 0.4), null);
  }
  // brick accents
  if (L >= 2) {
    for (let i = 0; i < 70; i++) {
      const face = i % 3;
      const y = 0.6 + ((i * 37) % 80) / 10;
      if (face === 0) B(g, 0.15, 0.5, 1, pick(i + 1), 4.55, y, -5 + ((i * 53) % 100) / 10, null);
      else if (face === 1) B(g, 1, 0.5, 0.15, pick(i + 2), -4 + ((i * 29) % 80) / 10, y, 6.05, null);
      else B(g, 1, 0.5, 0.15, pick(i + 3), -4 + ((i * 41) % 80) / 10, y, -6.05, null);
    }
  }
  // Wooden Fort: palisade of sharpened logs around the keep, open at the gate
  if (L === 1) {
    const log = [0x6b4a2b, 0x5e4026, 0x7a5532];
    let k = 0;
    const post = (x, z) => {
      const h = 2.4 + ((k * 7) % 5) / 10;
      B(g, 0.5, h, 0.5, log[k++ % 3], x, h / 2, z, null);
      B(g, 0.3, 0.35, 0.3, 0x8a6a42, x, h + 0.17, z, null);
    };
    for (let z = -5.2; z <= 5.21; z += 0.6) if (Math.abs(z) > 2) post(hx + 1.6, z);
    for (let x = -4; x <= hx + 1.01; x += 0.6) { post(x, -5.5); post(x, 5.5); }
    for (const z of [-2, 2]) B(g, 0.6, 3.6, 0.6, 0x4a3520, hx + 1.6, 1.8, z, null);   // gate posts
  }
  // Fortress+: central donjon (flat top, troops stand on it at Citadel)
  const dh = L >= 5 ? 17 : 15;
  if (L >= 4) {
    B(g, 5, dh, 5, 0x7f8186, -1.5, dh / 2, 0, null);
    B(g, 5.6, 0.4, 5.6, 0x6e7075, -1.5, dh - 0.8, 0, null);
    for (const [ox, oz] of [[-2, -2], [-2, 2], [2, -2], [2, 2], [-2, 0], [2, 0], [0, -2], [0, 2]]) B(g, 0.8, 0.8, 0.8, 0x7a7c80, -1.5 + ox, dh + 0.4, oz, null);
    for (const y of [kh + 1.5, kh + 3.5]) for (const z of [-2.52, 2.52]) B(g, 0.6, 0.9, 0.1, 0x1a1a22, -1.5, y, z, null);   // arrow slits
  }
  // gate facing +x
  B(g, 0.3, 4.4, 3.4, 0x2a1d12, hx + 0.05, 2.2, 0, null);
  for (let z = -1.2; z <= 1.2; z += 0.6) B(g, 0.2, 4.2, 0.12, 0x3a3a3a, hx + 0.25, 2.1, z, null);
  B(g, 0.4, 0.6, 4.2, 0x6e7075, hx + 0.1, 4.6, 0, null);
  // banners
  if (L >= 2) {
    for (const z of [-2.6, 2.6]) {
      B(g, 0.1, 3.2, 1.4, 0xa3221c, 4.6, 6.5, z, null);
      B(g, 0.12, 0.8, 0.6, GOLD, 4.62, 6.8, z, null);
    }
  }
  if (L >= 5) {   // royal banners hanging from the gate towers
    for (const z of [-6, 6]) {
      B(g, 0.1, 5, 1.8, 0x7a1a8a, 6.15, th - 4, z, null);
      B(g, 0.12, 1, 0.8, GOLD, 6.17, th - 3.4, z, null);
      B(g, 0.12, 0.2, 1.8, GOLD, 6.17, th - 6.4, z, null);
    }
  }
  // flag on top (on the donjon from Fortress up)
  const fx = L >= 4 ? -1.5 : 0, fy = L >= 4 ? dh : kh;
  B(g, 0.15, 4, 0.15, 0x4a3520, fx, fy + 2, 0, null);
  const flag = B(g, 0.1, 1.2, 2, 0xa3221c, fx, fy + 3.3, 1.05, null);
  g.userData.flag = flag;
  // torches (emissive, flicker)
  const torches = [];
  for (const z of [-2, 2]) {
    B(g, 0.2, 0.6, 0.2, 0x4a3520, hx + 0.25, 3.6, z * 1.1, null);
    const fl = B(g, 0.3, 0.3, 0.3, 0xffa030, hx + 0.25, 4.05, z * 1.1, null, { emissive: 0xff7a00 });
    fl.castShadow = false; torches.push(fl);
  }
  if (L >= 5) {   // big braziers either side of the gate
    for (const z of [-3.6, 3.6]) {
      B(g, 0.4, 1.6, 0.4, 0x3a3a3a, hx + 1.2, 0.8, z, null);
      B(g, 1, 0.4, 1, 0x4a4a4a, hx + 1.2, 1.8, z, null);
      const fl = B(g, 0.7, 0.7, 0.7, 0xffb040, hx + 1.2, 2.35, z, null, { emissive: 0xff7a00 });
      fl.castShadow = false; torches.push(fl);
    }
  }
  g.userData.torches = torches;
  g.userData.level = L;
  g.userData.slots = castleSlots(L);
  return g;
}

// HQ tiers — the Modern side's mirror of CASTLE_TIERS. Level 3 is the classic HQ the lane map uses. Front faces -x.
export const HQ_TIERS = [
  { name: 'Field Outpost', desc: 'Shipping-container office behind a sandbag ring, with a radio mast.' },
  { name: 'Police Precinct', desc: 'Two-story station with front steps, a light bar and a flagpole.' },
  { name: 'Command HQ', desc: 'Office block with a helipad and a concrete rooftop parapet.' },
  { name: 'Military Compound', desc: 'Adds two guard towers with searchlights, razor wire and a radar dish.' },
  { name: 'Tech Tower', desc: 'A glass tower on the roof, a helicopter on the pad and a rooftop turret.' },
];
/** Where Overwatch gunners stand at each HQ level (local coords). Roof gunners stand behind the parapet, in its gaps. */
export function hqSlots(level = 3) {
  const L = Math.max(1, Math.min(HQ_TIERS.length, level));
  if (L === 1) return [{ x: -1.5, y: 3, z: 0 }];
  if (L === 2) return [-1, 1].map((z) => ({ x: -3.1, y: 6, z }));
  const roof = [-1, 1, -3, 3].map((z) => ({ x: -4, y: 10.5, z }));
  if (L >= 4) roof.push({ x: -5, y: 11.15, z: -6 }, { x: -5, y: 11.15, z: 6 });
  if (L >= 5) roof.push({ x: 1.1, y: 18.5, z: -2 }, { x: 1.1, y: 18.5, z: -4 });
  return roof;
}
const CONCRETE = 0x9a9da2;
/** Concrete parapet blocks along a roof's front edge (the gaps between them are the gunner slots). */
function parapet(g, x, y, zs) { for (const z of zs) B(g, 0.5, 0.8, 1.2, CONCRETE, x, y + 0.4, z, null); }
function sandbag(g, x, y, z, rot = false) { B(g, rot ? 1.1 : 1, 0.45, rot ? 1 : 1.1, 0xa8956a, x, y + 0.23, z, null); }

export function buildHQ(level = 3) {
  const L = Math.max(1, Math.min(HQ_TIERS.length, level));
  const g = new THREE.Group();
  if (L === 1) buildOutpost(g);
  else if (L === 2) buildPrecinct(g);
  else {
    B(g, 10, 10, 12, 0xb8bcc2, 0, 5, 0, null);
    B(g, 10.4, 0.5, 12.4, 0x9ea2a8, 0, 10.25, 0, null);
    B(g, 10.4, 0.4, 12.4, 0x9ea2a8, 0, 0.2, 0, null);
    // window strips on all faces
    const glass = { emissive: 0x0b2a44 };
    for (let y = 2.5; y <= 8.5; y += 2) {
      B(g, 0.1, 0.9, 10.5, 0x4fa8e0, -5.03, y, 0, null, glass);
      B(g, 0.1, 0.9, 10.5, 0x4fa8e0, 5.03, y, 0, null, glass);
      B(g, 8.5, 0.9, 0.1, 0x4fa8e0, 0, y, 6.03, null, glass);
      B(g, 8.5, 0.9, 0.1, 0x4fa8e0, 0, y, -6.03, null, glass);
    }
    // entrance facing -x
    B(g, 0.2, 2.6, 3.2, 0x7fc4f0, -5.1, 1.5, 0, null, { emissive: 0x123a5a });
    B(g, 2, 0.3, 4.4, 0x5a5e64, -6, 3, 0, null);
    for (const z of [-1.9, 1.9]) B(g, 0.25, 2.8, 0.25, 0x5a5e64, -6.8, 1.5, z, null);
    B(g, 0.15, 0.6, 3.6, 0x1c2a50, -5.12, 3.6, 0, null);
    // rooftop
    B(g, 3, 1.4, 3, 0x8a8e94, 2.5, 11.2, -3, null);
    B(g, 1.4, 0.6, 1.4, 0x5a5e64, 2.5, 12.2, -3, null);
    // helipad
    B(g, 5, 0.1, 5, 0x3a3d42, -1.5, 10.55, 2, null);
    B(g, 0.5, 0.12, 2.6, 0xf2c94c, -2.4, 10.62, 2, null);
    B(g, 0.5, 0.12, 2.6, 0xf2c94c, -0.6, 10.62, 2, null);
    B(g, 1.6, 0.12, 0.5, 0xf2c94c, -1.5, 10.62, 2, null);
    // antenna + blinker
    B(g, 0.2, 5, 0.2, 0x6a6e74, 3.5, 13, 3.5, null);
    B(g, 0.9, 0.12, 0.12, 0x6a6e74, 3.5, 14.2, 3.5, null);
    const blink = B(g, 0.35, 0.35, 0.35, 0xff2020, 3.5, 15.6, 3.5, null, { emissive: 0xff0000 });
    blink.castShadow = false;
    g.userData.blink = blink;
    // flag
    B(g, 0.15, 5, 0.15, 0xcccccc, -6.2, 2.5, 5.2, null);
    const flag = B(g, 0.1, 1.1, 1.8, 0x2f6fd6, -6.2, 4.4, 6.1, null);
    B(g, 0.12, 0.3, 1.8, 0xffffff, -6.2, 4.4, 6.1, null);
    g.userData.flag = flag;
    // sandbags / barriers out front
    for (let z = -5; z <= 5; z += 1.2) {
      if (Math.abs(z) < 2.2) continue;
      B(g, 1, 0.5, 1.1, 0xa8956a, -7.6, 0.25, z, null);
      B(g, 1, 0.45, 1.1, 0x9a8760, -7.6, 0.72, z + 0.3, null);
    }
    parapet(g, -4.75, 10.5, [0, -2, 2, -4, 4]);
  }
  if (L >= 4) {
    // guard towers at the front corners: steel legs, platform, railing, searchlight
    const lights = [];
    for (const z of [-6, 6]) {
      for (const [ox, oz] of [[-1, -1], [-1, 1], [1, -1], [1, 1]]) B(g, 0.3, 11, 0.3, 0x4a4e54, -5 + ox, 5.5, z + oz, null);
      for (const y of [3.5, 7]) { B(g, 2.3, 0.15, 0.15, 0x4a4e54, -5, y, z - 1, null); B(g, 2.3, 0.15, 0.15, 0x4a4e54, -5, y, z + 1, null); }
      B(g, 2.8, 0.3, 2.8, 0x5a5e64, -5, 11, z, null);
      for (const oz of [-1.3, 1.3]) B(g, 2.8, 0.6, 0.12, 0x3a3d42, -5, 11.45, z + oz, null);
      B(g, 0.12, 0.6, 2.8, 0x3a3d42, -3.65, 11.45, z, null);
      const sl = B(g, 0.5, 0.4, 0.5, 0xfff4c0, -6.1, 11.6, z, null, { emissive: 0xfff0a0 });
      sl.castShadow = false; lights.push(sl);
    }
    g.userData.searchlights = lights;
    // razor wire along the front
    for (let z = -5; z <= 5.01; z += 1) if (Math.abs(z) > 2) { B(g, 0.6, 0.5, 0.9, 0x7a7e84, -8.6, 0.3, z, null); B(g, 0.15, 0.6, 0.15, 0x4a4e54, -8.6, 0.3, z + 0.45, null); }
    // radar dish on the rooftop unit (Tech Tower: on the upper deck)
    const radar = new THREE.Group();
    B(radar, 0.25, 1, 0.25, 0x6a6e74, 0, 0.5, 0, null);
    const dish = B(radar, 0.25, 1.4, 2.2, 0xd8dce2, 0.2, 1.2, 0, null);
    dish.rotation.z = 0.35;
    if (L >= 5) radar.position.set(3.8, 18.5, -4.6); else radar.position.set(2.5, 12.5, -3);
    g.add(radar);
    g.userData.radar = radar;
  }
  if (L >= 5) {
    // glass tower on the roof (back half, beside the helipad)
    const glass = { emissive: 0x0b2a44 };
    B(g, 4.5, 8, 5, 0x8fa4b8, 2.5, 14.5, -3, null);
    for (let y = 11.5; y <= 17.5; y += 1.5) {
      B(g, 0.1, 0.8, 4.4, 0x4fa8e0, 0.22, y, -3, null, glass);
      B(g, 4, 0.8, 0.1, 0x4fa8e0, 2.5, y, -0.47, null, glass);
      B(g, 4, 0.8, 0.1, 0x4fa8e0, 2.5, y, -5.53, null, glass);
    }
    B(g, 4.9, 0.3, 5.4, 0x6a6e74, 2.5, 18.35, -3, null);
    parapet(g, 0.5, 18.5, [-1, -3, -5]);
    // rooftop turret on the upper deck
    B(g, 1.2, 0.6, 1.2, 0x3a3d42, 3.6, 18.8, -1.8, null);
    B(g, 1.6, 0.25, 0.25, 0x2a2d32, 2.6, 19.2, -1.8, null);
    // helicopter parked on the helipad
    const heli = new THREE.Group();
    B(heli, 2.4, 1.1, 1.2, 0x2f5f3a, 0, 0.75, 0, null);
    B(heli, 0.8, 0.7, 1.1, 0x9ad8ff, -1.4, 0.8, 0, null, { emissive: 0x123a5a });
    B(heli, 2.6, 0.35, 0.35, 0x2f5f3a, 2.3, 0.95, 0, null);
    B(heli, 0.3, 0.8, 0.12, 0x2f5f3a, 3.5, 1.3, 0, null);
    for (const z of [-0.55, 0.55]) B(heli, 2.4, 0.1, 0.1, 0x2a2d32, 0, 0.1, z, null);
    const rotor = new THREE.Group(); rotor.position.set(0, 1.45, 0); heli.add(rotor);
    B(rotor, 4.6, 0.06, 0.25, 0x2a2d32, 0, 0, 0, null);
    B(rotor, 0.25, 0.06, 4.6, 0x2a2d32, 0, 0, 0, null);
    heli.position.set(-1.5, 10.6, 2); heli.rotation.y = 0.5;
    g.add(heli);
    g.userData.rotor = rotor;
  }
  g.userData.level = L;
  g.userData.slots = hqSlots(L);
  return g;
}

/** HQ Lv 1: a container office inside a sandbag ring. */
function buildOutpost(g) {
  B(g, 5, 3, 8, 0x5a6b4a, 0, 1.5, 0, null);
  for (let z = -3.6; z <= 3.61; z += 0.6) { B(g, 0.08, 2.8, 0.2, 0x4e5e40, -2.53, 1.5, z, null); B(g, 0.08, 2.8, 0.2, 0x4e5e40, 2.53, 1.5, z, null); }
  B(g, 5.1, 0.15, 8.1, 0x4e5e40, 0, 3.05, 0, null);
  B(g, 0.12, 2.2, 1.2, 0x3a3d42, -2.56, 1.1, 0, null);                                    // door
  B(g, 0.1, 0.8, 1.6, 0x4fa8e0, -2.56, 1.9, -2.4, null, { emissive: 0x0b2a44 });          // window
  for (const z of [-2.6, -1.1, 1.1, 2.6]) sandbag(g, -2.2, 3.1, z, true);                // roof sandbags (slot gap in the middle)
  // sandbag ring, open at the door
  for (let z = -4.6; z <= 4.61; z += 1.15) if (Math.abs(z) > 1.5) { sandbag(g, -4.6, 0, z); sandbag(g, -4.6, 0.45, z + 0.3); }
  for (let x = -3.4; x <= 3.4; x += 1.15) { sandbag(g, x, 0, -5.2, true); sandbag(g, x, 0, 5.2, true); }
  // radio mast + blinker
  B(g, 0.15, 6, 0.15, 0x6a6e74, 1.6, 6, 3.2, null);
  B(g, 1, 0.1, 0.1, 0x6a6e74, 1.6, 7.6, 3.2, null);
  const blink = B(g, 0.3, 0.3, 0.3, 0xff2020, 1.6, 9.1, 3.2, null, { emissive: 0xff0000 });
  blink.castShadow = false; g.userData.blink = blink;
  B(g, 0.12, 4, 0.12, 0xcccccc, -3.6, 2, 3.8, null);
  const flag = B(g, 0.1, 0.9, 1.5, 0x2f6fd6, -3.6, 3.5, 4.55, null);
  B(g, 0.12, 0.25, 1.5, 0xffffff, -3.6, 3.5, 4.55, null);
  g.userData.flag = flag;
}

/** HQ Lv 2: a two-story police precinct. */
function buildPrecinct(g) {
  B(g, 8, 6, 10, 0xa88c6a, 0, 3, 0, null);
  B(g, 8.3, 0.4, 10.3, 0x8a7458, 0, 6.05, 0, null);
  B(g, 8.1, 0.5, 10.1, 0x2a4a8a, 0, 3.1, 0, null);                                       // blue band between floors
  const glass = { emissive: 0x0b2a44 };
  for (const y of [1.6, 4.6]) for (const z of [-3.6, -2, 2, 3.6]) B(g, 0.1, 1.1, 1, 0x4fa8e0, -4.03, y, z, null, glass);
  for (const y of [1.6, 4.6]) for (const x of [-2.5, 0, 2.5]) { B(g, 1, 1.1, 0.1, 0x4fa8e0, x, y, 5.03, null, glass); B(g, 1, 1.1, 0.1, 0x4fa8e0, x, y, -5.03, null, glass); }
  // entrance: double door, steps, sign
  B(g, 0.15, 2.4, 2.2, 0x3a3d42, -4.05, 1.2, 0, null);
  B(g, 0.2, 2.4, 0.08, 0x9aa3ab, -4.12, 1.2, 0, null);
  for (let k = 0; k < 3; k++) B(g, 0.6, 0.2, 3.4 - k * 0.3, 0x9a9da2, -4.6 - (2 - k) * 0.5, 0.1 + k * 0.2, 0, null);
  B(g, 0.15, 0.6, 3, 0x1c2a50, -4.1, 2.8, 0, null);
  B(g, 0.17, 0.2, 2.4, 0xffffff, -4.12, 2.8, 0, null);
  parapet(g, -3.75, 6.25, [0, -2, 2, -4, 4]);
  // light bar + antenna
  B(g, 0.4, 0.3, 1.6, 0x2a2d32, 2, 6.4, -2.5, null);
  B(g, 0.4, 0.3, 0.7, 0xff2020, 2, 6.7, -2.9, null, { emissive: 0xaa0000 });
  const blink = B(g, 0.4, 0.3, 0.7, 0x2060ff, 2, 6.7, -2.1, null, { emissive: 0x0030cc });
  blink.castShadow = false; g.userData.blink = blink;
  B(g, 0.15, 3, 0.15, 0x6a6e74, 2.5, 7.75, 3.5, null);
  // flagpole out front
  B(g, 0.15, 6, 0.15, 0xcccccc, -6, 3, 4, null);
  const flag = B(g, 0.1, 1.1, 1.8, 0x2f6fd6, -6, 5.4, 4.9, null);
  B(g, 0.12, 0.3, 1.8, 0xffffff, -6, 5.4, 4.9, null);
  g.userData.flag = flag;
}

export function buildTree(scale = 1, hue = 0) {
  const g = new THREE.Group();
  const leaf = [0x3f7a2e, 0x4c8c36, 0x356a27, 0x5a9a3e][hue % 4];
  B(g, 0.6, 2.2, 0.6, 0x5b3d22, 0, 1.1, 0, null);
  B(g, 2.4, 1.2, 2.4, leaf, 0, 2.6, 0, null);
  B(g, 1.8, 1.0, 1.8, leaf, 0, 3.6, 0, null);
  B(g, 1.0, 0.8, 1.0, leaf, 0, 4.4, 0, null);
  B(g, 0.6, 0.6, 0.6, leaf, 0.9, 2.3, 0.9, null);
  g.scale.setScalar(scale);
  return g;
}
export function buildPine(scale = 1) {
  const g = new THREE.Group();
  B(g, 0.5, 1.4, 0.5, 0x4a311b, 0, 0.7, 0, null);
  const c = 0x2e5e2a;
  B(g, 2.4, 0.8, 2.4, c, 0, 1.6, 0, null);
  B(g, 1.8, 0.8, 1.8, 0x356b30, 0, 2.4, 0, null);
  B(g, 1.2, 0.8, 1.2, c, 0, 3.2, 0, null);
  B(g, 0.6, 0.8, 0.6, 0x356b30, 0, 4.0, 0, null);
  g.scale.setScalar(scale);
  return g;
}
export function buildRock(scale = 1) {
  const g = new THREE.Group();
  B(g, 1.4, 0.8, 1.1, 0x7d7f84, 0, 0.4, 0, null);
  B(g, 0.8, 0.6, 0.7, 0x8e9095, 0.3, 0.9, 0.1, null);
  B(g, 0.6, 0.4, 0.6, 0x6e7075, -0.6, 0.2, 0.4, null);
  g.scale.setScalar(scale);
  return g;
}
export function buildLamp() {
  const g = new THREE.Group();
  B(g, 0.25, 4.5, 0.25, 0x55595f, 0, 2.25, 0, null);
  B(g, 1.2, 0.15, 0.2, 0x55595f, 0.5, 4.4, 0, null);
  const l = B(g, 0.5, 0.2, 0.4, 0xfff3c0, 1.0, 4.25, 0, null, { emissive: 0xffd770 });
  l.castShadow = false;
  return g;
}
export function buildTorch() {
  const g = new THREE.Group();
  B(g, 0.22, 3.0, 0.22, 0x5b3d22, 0, 1.5, 0, null);
  B(g, 0.5, 0.12, 0.5, 0x3a3a3a, 0, 3.0, 0, null);
  for (const [x, z] of [[-0.2, -0.2], [0.2, -0.2], [-0.2, 0.2], [0.2, 0.2]]) B(g, 0.08, 0.35, 0.08, 0x3a3a3a, x, 3.2, z, null);
  const fl = B(g, 0.34, 0.34, 0.34, 0xffa030, 0, 3.32, 0, null, { emissive: 0xff7a00 });
  const fl2 = B(g, 0.2, 0.22, 0.2, 0xffe070, 0, 3.58, 0, null, { emissive: 0xffc040 });
  fl.castShadow = fl2.castShadow = false;
  g.userData.flames = [fl, fl2];
  return g;
}
export function buildBarrel(fire = false) {
  const g = new THREE.Group();
  B(g, 0.8, 1.1, 0.8, 0x4a5560, 0, 0.55, 0, null);
  B(g, 0.84, 0.1, 0.84, 0x2f363d, 0, 0.3, 0, null);
  B(g, 0.84, 0.1, 0.84, 0x2f363d, 0, 0.85, 0, null);
  if (fire) {
    const f = B(g, 0.5, 0.4, 0.5, 0xff7a2e, 0, 1.25, 0, null, { emissive: 0xff5a00 });
    f.castShadow = false; g.userData.flames = [f];
  }
  return g;
}
export function buildDumpster() {
  const g = new THREE.Group();
  B(g, 2.2, 1.2, 1.2, 0x2f6b3a, 0, 0.6, 0, null);
  B(g, 2.3, 0.12, 1.3, 0x24502c, 0, 1.25, -0.05, null);
  B(g, 0.3, 0.2, 0.3, 0x111111, -0.8, 0.1, 0.4, null);
  B(g, 0.3, 0.2, 0.3, 0x111111, 0.8, 0.1, 0.4, null);
  return g;
}
export function buildFence(len = 4) {
  const g = new THREE.Group();
  for (let x = -len / 2; x <= len / 2; x += 0.5) B(g, 0.06, 1.8, 0.06, 0x8a9096, x, 0.9, 0, null);
  B(g, len, 0.06, 0.06, 0x8a9096, 0, 1.75, 0, null);
  B(g, len, 0.06, 0.06, 0x8a9096, 0, 0.1, 0, null);
  return g;
}

export function buildBarrier() {
  const g = new THREE.Group();
  B(g, 2.2, 0.8, 0.5, 0xd9d9d9, 0, 0.4, 0, null);
  B(g, 2.4, 0.2, 0.7, 0xc4c4c4, 0, 0.1, 0, null);
  for (let i = -0.8; i <= 0.8; i += 0.8) B(g, 0.35, 0.5, 0.52, 0xd03030, i, 0.45, 0, null);
  return g;
}
export function buildBuilding(w, h, d, color) {
  const g = new THREE.Group();
  B(g, w, h, d, color, 0, h / 2, 0, null);
  for (let y = 1.5; y < h - 0.5; y += 1.8)
    for (let x = -w / 2 + 1; x <= w / 2 - 1; x += 1.5)
      B(g, 0.8, 0.9, 0.05, (Math.random() < 0.3 ? 0xffe9a0 : 0x5c84a8), x, y, d / 2 + 0.03, null,
        Math.random() < 0.3 ? { emissive: 0x6a5520 } : undefined);
  return g;
}
export function buildCrate() {
  const g = new THREE.Group();
  B(g, 0.9, 0.9, 0.9, 0x9a6b3a, 0, 0.45, 0, null);
  B(g, 0.95, 0.12, 0.95, 0x6e4a26, 0, 0.85, 0, null);
  B(g, 0.95, 0.12, 0.95, 0x6e4a26, 0, 0.06, 0, null);
  return g;
}

// ---------- nature / park props (bigger map) ----------
/** A voxel pond: water surface + stone rim + reeds and lily pads. rx/rz = half size. */
export function buildPond(rx = 3, rz = 2.2, seed = 1) {
  const g = new THREE.Group();
  let k = seed;
  const rr = () => { k = (k * 16807) % 2147483647; return (k - 1) / 2147483646; };
  const water = new THREE.Mesh(boxGeo(1, 1, 1), new THREE.MeshLambertMaterial({ color: 0x3a7ab8, transparent: true, opacity: 0.85 }));
  water.scale.set(rx * 2, 0.08, rz * 2); water.position.y = 0.06; water.receiveShadow = true; g.add(water);
  // rounded corners: cut with darker shallows
  for (const sx of [-1, 1]) for (const sz of [-1, 1]) B(g, 0.9, 0.1, 0.9, 0x4a6a3a, sx * (rx - 0.4), 0.07, sz * (rz - 0.4), null);
  const n = Math.round((rx + rz) * 2.2);
  for (let i = 0; i < n; i++) {
    const a = (i / n) * Math.PI * 2, s = 0.35 + rr() * 0.3;
    B(g, s * 1.3, s * 0.7, s, [0x7d7f84, 0x8e9095, 0x6e7075][i % 3], Math.cos(a) * (rx + 0.2), s * 0.3, Math.sin(a) * (rz + 0.2), null);
  }
  for (let i = 0; i < 4; i++) B(g, 0.45, 0.04, 0.45, 0x4c9a3c, (rr() - 0.5) * rx * 1.2, 0.12, (rr() - 0.5) * rz * 1.2, null);   // lily pads
  B(g, 0.14, 0.06, 0.14, 0xf2a0c8, (rr() - 0.5) * rx, 0.15, (rr() - 0.5) * rz, null);
  for (let i = 0; i < 6; i++) {   // reeds
    const a = rr() * Math.PI * 2, h = 0.6 + rr() * 0.6, x = Math.cos(a) * (rx - 0.3), z = Math.sin(a) * (rz - 0.3);
    B(g, 0.08, h, 0.08, 0x5a7a2a, x, h / 2, z, null); B(g, 0.12, 0.25, 0.12, 0x6b4a2a, x, h, z, null);
  }
  return g;
}
export function buildBush(scale = 1, flowers = false) {
  const g = new THREE.Group();
  B(g, 1.2, 0.8, 1.1, 0x3f7a2e, 0, 0.4, 0, null);
  B(g, 0.8, 0.5, 0.8, 0x4c8c36, 0.15, 0.95, -0.1, null);
  if (flowers) for (const [x, z, c] of [[0.4, 0.5, 0xf2c94c], [-0.45, 0.3, 0xf26a6a], [0.1, -0.5, 0xffffff]]) B(g, 0.16, 0.16, 0.16, c, x, 0.85, z, null);
  g.scale.setScalar(scale);
  return g;
}
export function buildFlowers(seed = 1) {
  const g = new THREE.Group();
  let k = seed;
  const rr = () => { k = (k * 16807) % 2147483647; return (k - 1) / 2147483646; };
  const cols = [0xf2c94c, 0xf26a6a, 0xffffff, 0xb08af0, 0x6fb8ff];
  for (let i = 0; i < 7; i++) {
    const x = (rr() - 0.5) * 2.2, z = (rr() - 0.5) * 2.2;
    B(g, 0.06, 0.3, 0.06, 0x3f7a2e, x, 0.15, z, null);
    B(g, 0.18, 0.14, 0.18, cols[i % cols.length], x, 0.34, z, null);
  }
  return g;
}
export function buildFountain() {
  const g = new THREE.Group();
  const stone = 0xb8b4ac, dark = 0x8e8a83;
  B(g, 5.2, 0.6, 5.2, stone, 0, 0.3, 0, null);
  const water = new THREE.Mesh(boxGeo(4.4, 0.1, 4.4), new THREE.MeshLambertMaterial({ color: 0x4a9ad8, transparent: true, opacity: 0.85 }));
  water.position.y = 0.62; g.add(water);
  B(g, 1.0, 1.6, 1.0, dark, 0, 1.2, 0, null);
  B(g, 2.0, 0.3, 2.0, stone, 0, 2.0, 0, null);
  B(g, 0.5, 0.8, 0.5, dark, 0, 2.5, 0, null);
  const jet = B(g, 0.3, 0.6, 0.3, 0xbfe6ff, 0, 3.1, 0, null, { emissive: 0x3a6a8a });
  g.userData.jet = jet;
  return g;
}
export function buildBench() {
  const g = new THREE.Group();
  B(g, 1.8, 0.12, 0.55, 0x8a5a2b, 0, 0.5, 0, null);
  B(g, 1.8, 0.45, 0.1, 0x8a5a2b, 0, 0.8, -0.25, null);
  for (const x of [-0.75, 0.75]) B(g, 0.12, 0.5, 0.5, 0x3a3d42, x, 0.25, 0, null);
  return g;
}
export function buildPlanter(flowers = true) {
  const g = new THREE.Group();
  B(g, 1.6, 0.6, 1.6, 0x9a9da2, 0, 0.3, 0, null);
  B(g, 1.4, 0.1, 1.4, 0x5a3b22, 0, 0.62, 0, null);
  const b = buildBush(0.85, flowers); b.position.y = 0.6; g.add(b);
  return g;
}
