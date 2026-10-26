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
 * Skill-tree forms: restyle a built model.
 *   look = { eyes: 0xRRGGBB (glowing), hair|colors: { fromColor: toColor }, gear: ['gearId', ...] }
 * Colors are swapped on this model's own materials (other troops of the same type are untouched).
 * Gear = extra voxel pieces and particle effects from FORM_GEAR (modular: add an entry, list it in a look).
 */
export function applyLook(r, look) {
  if (!look) return r;
  for (const map of [look.hair, look.colors]) for (const [from, to] of Object.entries(map || {})) r.mats.get(String(from))?.color.setHex(to);
  if (look.eyes != null && r.eyes) {
    const m = new THREE.MeshBasicMaterial({ color: look.eyes });   // unlit = glows, and the hit flash leaves it alone
    for (const e of r.eyes) { e.material = m; e.scale.set(1.15, 1.15, 1); }
  }
  for (const id of look.gear || []) FORM_GEAR[id]?.(r, gearKit(r));
  return r;
}

/** Helpers for gear builders: solid boxes (flash on hit like the rest of the model), glowing boxes, particles. */
function gearKit(r) {
  r.extraMats ||= [];
  const glowMats = new Map();
  const solid = (parent, w, h, d, color, x, y, z) => {
    const had = r.mats.has(String(color));
    const mesh = B(parent, w, h, d, color, x, y, z, r.mats);
    if (!had) { const m = r.mats.get(String(color)); m.emissive = new THREE.Color(0); r.matList.push(m); }
    return mesh;
  };
  const glow = (parent, w, h, d, color, x, y, z, opacity = 1) => {
    const k = color + ':' + opacity;
    if (!glowMats.has(k)) { const m = new THREE.MeshBasicMaterial({ color, transparent: opacity < 1, opacity }); glowMats.set(k, m); r.extraMats.push(m); }
    const mesh = new THREE.Mesh(boxGeo(w, h, d), glowMats.get(k)); mesh.position.set(x, y, z); mesh.castShadow = false; parent.add(mesh); return mesh;
  };
  /** n particles of `kind` ('rise' | 'orbit' | 'spark') around (x,y,z) of `parent`, radius rad, colors cols. */
  const fx = (parent, kind, n, cols, x, y, z, rad = 0.5, size = 0.07, h = 1) => {
    r.fx ||= [];
    for (let i = 0; i < n; i++) {
      const m = glow(parent, size, size, size, cols[i % cols.length], x, y, z, 0.9);
      r.fx.push({ m, kind, x, y, z, rad, h, ph: Math.random(), sp: 0.6 + Math.random() * 0.8, a: Math.random() * Math.PI * 2 });
    }
  };
  return { solid, glow, fx, pivot };
}
/** Animate gear particles (called from Unit.animate). */
export function animateFx(r, dt) {
  for (const f of r.fx || []) {
    f.ph += dt * f.sp;
    const t = f.ph % 1, m = f.m;
    if (f.kind === 'rise') { m.position.set(f.x + Math.cos(f.a) * f.rad * (1 - t * 0.5), f.y + t * f.h, f.z + Math.sin(f.a) * f.rad * (1 - t * 0.5)); m.scale.setScalar(1 - t * 0.7); if (t < dt * f.sp * 1.5) f.a = Math.random() * Math.PI * 2; }
    else if (f.kind === 'orbit') { const a = f.a + f.ph * 3; m.position.set(f.x + Math.cos(a) * f.rad, f.y + Math.sin(f.ph * 2.3) * f.h * 0.5, f.z + Math.sin(a) * f.rad); }
    else { m.visible = Math.random() < 0.55; m.position.set(f.x + (Math.random() - 0.5) * f.rad * 2, f.y + (Math.random() - 0.5) * f.h, f.z + (Math.random() - 0.5) * f.rad * 2); }
  }
}

/** Gear pieces for skill-tree forms. Each gets the rig and the kit; positions follow the humanoid skeleton. */
export const FORM_GEAR = {
  // ---- Viking ----
  warpaint: (r, { glow }) => { glow(r.head, 0.5, 0.05, 0.02, 0xc0141a, 0, 0.0, 0.262); glow(r.head, 0.05, 0.22, 0.02, 0xc0141a, 0, 0.06, 0.263); },
  bloodAxe: (r, { glow }) => { glow(r.weapon, 0.075, 0.44, 0.06, 0xff2a1a, 0, 0.12, 0.84); },
  chaosAxe: (r, { solid, glow }) => {   // second blade (double-bit) + spike
    solid(r.weapon, 0.06, 0.38, 0.22, 0x3a1010, 0, 0.12, 0.7); solid(r.weapon, 0.06, 0.4, 0.2, 0x2a0a0a, 0, -0.18, 0.7);
    glow(r.weapon, 0.07, 0.42, 0.05, 0xff3b2f, 0, -0.18, 0.6); solid(r.weapon, 0.05, 0.05, 0.22, 0x8a8a8a, 0, 0, 0.9);
  },
  spikedHelm: (r, { solid }) => { for (const [x, z] of [[0, 0], [-0.15, 0.1], [0.15, 0.1], [0, -0.15]]) { solid(r.head, 0.07, 0.18, 0.07, 0x5a5a5a, x, 0.48, z); solid(r.head, 0.04, 0.08, 0.04, 0xd8d8d8, x, 0.6, z); } },
  embers: (r, { fx }) => fx(r.body, 'rise', 7, [0xff6a1a, 0xffb040, 0xff2a1a], 0, 0.5, 0, 0.55, 0.07, 1.8),
  stormAxe: (r, { glow, fx }) => { glow(r.weapon, 0.075, 0.46, 0.06, 0x9af0ff, 0, 0.12, 0.84); glow(r.weapon, 0.065, 0.1, 0.24, 0x4aa3ff, 0, 0.34, 0.7); fx(r.weapon, 'spark', 4, [0xffffff, 0x9af0ff, 0x4aa3ff], 0, 0.12, 0.74, 0.18, 0.06, 0.5); },
  wingHelm: (r, { solid }) => { for (const s of [-1, 1]) { solid(r.head, 0.06, 0.24, 0.16, 0xf0f0f0, s * 0.32, 0.36, -0.04); solid(r.head, 0.05, 0.18, 0.12, 0xd8e8ff, s * 0.38, 0.52, -0.1); } },
  sparks: (r, { fx }) => fx(r.body, 'spark', 5, [0x9af0ff, 0xffffff], 0, 1.4, 0, 0.6, 0.06, 1.6),
  // ---- Ranger ----
  feather: (r, { solid }) => { solid(r.head, 0.04, 0.4, 0.08, 0xf2f2f2, 0.24, 0.48, -0.14); solid(r.head, 0.045, 0.12, 0.09, 0xc0392b, 0.24, 0.66, -0.14); },
  spyglass: (r, { solid }) => { solid(r.torso, 0.08, 0.08, 0.32, 0xc9a050, -0.3, -0.3, 0.1); solid(r.torso, 0.1, 0.1, 0.05, 0x3b2a17, -0.3, -0.3, 0.28); },
  faceMask: (r, { solid }) => { solid(r.head, 0.52, 0.2, 0.04, 0x16161c, 0, -0.12, 0.258); },
  backDaggers: (r, { solid, pivot: pv }) => { for (const s of [-1, 1]) { const p = pv(r.torso, s * 0.12, 0.05, -0.26); p.rotation.z = s * 0.6; solid(p, 0.06, 0.5, 0.04, 0xc9d1d8, 0, 0.12, 0); solid(p, 0.1, 0.06, 0.06, 0x2a1d14, 0, -0.14, 0); } },
  patchCloak: (r, { solid }) => { for (const [x, y, c] of [[-0.15, 0.1, 0x8a5a2b], [0.18, -0.15, 0xb04a1a], [0.05, -0.28, 0x6b4423]]) solid(r.torso, 0.18, 0.16, 0.03, c, x, y, -0.27); },
  beltDaggers: (r, { solid }) => { for (const s of [-1, 1]) { solid(r.torso, 0.06, 0.32, 0.05, 0xc9d1d8, s * 0.36, -0.4, 0.05); solid(r.torso, 0.1, 0.08, 0.07, 0x5a2a7a, s * 0.36, -0.24, 0.05); } },
  wolfPelt: (r, { solid, glow }) => {
    solid(r.torso, 0.84, 0.16, 0.5, 0x8a8a8a, 0, 0.36, 0); solid(r.torso, 0.6, 0.4, 0.06, 0x7a7a7a, 0, 0.12, -0.24);
    solid(r.head, 0.5, 0.16, 0.5, 0x8a8a8a, 0, 0.36, -0.04); solid(r.head, 0.24, 0.14, 0.2, 0x6a6a6a, 0, 0.36, 0.28);   // wolf head + snout
    for (const s of [-1, 1]) { solid(r.head, 0.08, 0.12, 0.06, 0x6a6a6a, s * 0.16, 0.5, 0.0); glow(r.head, 0.05, 0.04, 0.02, 0xff9a2a, s * 0.08, 0.42, 0.262); }
  },
  // ---- Imp ----
  iceShards: (r, { glow }) => { for (const [x, y, z, h] of [[-0.3, 0.35, -0.1, 0.3], [0.3, 0.35, -0.1, 0.24], [0, 0.3, -0.3, 0.34], [-0.15, 0.1, -0.3, 0.2]]) glow(r.torso, 0.1, h, 0.1, 0x9af0ff, x, y + h / 2, z, 0.85); },
  iceCrown: (r, { glow }) => { for (const [x, z, h] of [[0, 0.18, 0.34], [-0.18, 0.1, 0.26], [0.18, 0.1, 0.26], [-0.2, -0.12, 0.2], [0.2, -0.12, 0.2]]) glow(r.head, 0.08, h, 0.08, 0xd8f4ff, x, 0.3 + h / 2, z, 0.9); },
  frost: (r, { fx }) => fx(r.body, 'orbit', 6, [0xd8f4ff, 0x9af0ff, 0xffffff], 0, 1.1, 0, 0.6, 0.06, 0.8),
  halo: (r, { glow }) => { for (const [x, z, w, d] of [[0, 0.2, 0.44, 0.06], [0, -0.2, 0.44, 0.06], [0.2, 0, 0.06, 0.34], [-0.2, 0, 0.06, 0.34]]) glow(r.head, w, 0.05, d, 0xfff3a0, x, 0.72, z); },
  brokenHalo: (r, { glow, pivot: pv }) => { const h = pv(r.head, 0, 0.72, 0); h.rotation.z = 0.35; for (const [x, z, w, d] of [[0, 0.2, 0.3, 0.06], [0.2, 0, 0.06, 0.34], [-0.2, -0.1, 0.06, 0.16]]) glow(h, w, 0.05, d, 0xc070ff, x, 0, z); },
  curseWisps: (r, { fx }) => fx(r.body, 'rise', 6, [0x9a3ad8, 0xc070ff, 0x3a1a4a], 0, 0.4, 0, 0.45, 0.07, 1.4),
  flameCrest: (r, { glow }) => { for (const [x, z, h, c] of [[0, 0.05, 0.4, 0xffd23a], [-0.12, -0.05, 0.3, 0xff8a3a], [0.12, -0.05, 0.3, 0xff8a3a], [0, -0.16, 0.26, 0xff5a1a]]) glow(r.head, 0.12, h, 0.12, c, x, 0.3 + h / 2, z); },
  flames: (r, { fx }) => fx(r.body, 'rise', 7, [0xffd23a, 0xff8a3a, 0xff3a1a], 0, 0.3, 0, 0.4, 0.08, 1.5),
  magmaCracks: (r, { glow }) => {
    for (const [x, y, w, h] of [[-0.1, 0.1, 0.05, 0.4], [0.12, -0.05, 0.3, 0.05], [0.18, 0.15, 0.05, 0.25]]) glow(r.torso, w, h, 0.02, 0xff6a1a, x, y, 0.262);
    for (const arm of [r.armL, r.armR]) glow(arm, 0.04, 0.3, 0.02, 0xff6a1a, 0, -0.3, 0.13);
  },
  // ---- Lancer ----
  crusaderCross: (r, { solid }) => { solid(r.torso, 0.1, 0.36, 0.03, 0xc0392b, 0, 0.05, 0.28); solid(r.torso, 0.32, 0.1, 0.03, 0xc0392b, 0, 0.12, 0.28); solid(r.head, 0.1, 0.1, 0.04, 0xc0392b, 0, 0.3, 0.3); },
  goldCrest: (r, { solid }) => { solid(r.head, 0.5, 0.08, 0.5, 0xf2c94c, 0, 0.3, 0); for (const x of [-0.18, 0, 0.18]) solid(r.head, 0.08, 0.16, 0.08, 0xf2c94c, x, 0.4, 0.22); },
  bigCape: (r, { solid }) => { solid(r.torso, 0.74, 1.0, 0.06, 0xa02020, 0, -0.25, -0.27); solid(r.torso, 0.78, 0.1, 0.1, 0xf2c94c, 0, 0.28, -0.25); },
  deathVisor: (r, { glow }) => { glow(r.head, 0.46, 0.07, 0.04, 0x5cff7a, 0, 0.06, 0.305); },
  skullLance: (r, { solid, glow }) => { solid(r.weapon, 0.26, 0.24, 0.24, 0xd8d8c8, 0, 0, 1.75); for (const x of [-0.06, 0.06]) glow(r.weapon, 0.06, 0.06, 0.02, 0x5cff7a, x, 0.03, 1.875); },
  soulWisps: (r, { fx }) => fx(r.body, 'orbit', 5, [0x5cff7a, 0x2a8a3a, 0xd8ffd8], 0, 2.0, 0, 0.9, 0.08, 1),
  // ---- Elf ----
  goldCrown: (r, { solid, glow }) => { solid(r.head, 0.56, 0.08, 0.56, 0xf2c94c, 0, 0.32, -0.02); for (const [x, h] of [[-0.18, 0.12], [0, 0.22], [0.18, 0.12]]) solid(r.head, 0.07, h, 0.07, 0xf2c94c, x, 0.36 + h / 2, 0.24); glow(r.head, 0.07, 0.07, 0.03, 0x9af0ff, 0, 0.42, 0.28); },
  drowBlades: (r, { solid, pivot: pv }) => { for (const s of [-1, 1]) { const p = pv(r.torso, s * 0.14, 0.1, -0.3); p.rotation.z = s * 0.5; solid(p, 0.06, 0.62, 0.04, 0xb090d8, 0, 0.18, 0); solid(p, 0.14, 0.05, 0.06, 0x3a2a4a, 0, -0.14, 0); } },
  windSwirl: (r, { fx }) => fx(r.body, 'orbit', 8, [0x9af0e0, 0xffffff, 0x5cffd0], 0, 0.9, 0, 0.75, 0.06, 1.4),
  // ---- Police ----
  riotVisor: (r, { solid, glow }) => { glow(r.head, 0.52, 0.3, 0.04, 0x9ad0ff, 0, 0.02, 0.3, 0.45); solid(r.head, 0.6, 0.06, 0.6, 0x111111, 0, 0.18, 0); },
  fedora: (r, { solid }) => { solid(r.head, 0.74, 0.05, 0.74, 0x111111, 0, 0.34, 0); solid(r.head, 0.5, 0.22, 0.5, 0x16161a, 0, 0.47, 0); solid(r.head, 0.52, 0.06, 0.52, 0xa01a1a, 0, 0.39, 0); },
  earpiece: (r, { solid }) => { solid(r.head, 0.04, 0.06, 0.04, 0xf0f0f0, 0.27, 0.0, 0.05); solid(r.head, 0.03, 0.3, 0.03, 0xf0f0f0, 0.27, -0.2, 0.0); },
  shoulderPlates: (r, { solid }) => {   // riot armor: shoulder plates, chest plate, helmet
    for (const arm of [r.armL, r.armR]) { solid(arm, 0.34, 0.18, 0.36, 0x2a2a2a, 0, 0.02, 0); solid(arm, 0.3, 0.06, 0.32, 0x4a6fb0, 0, 0.13, 0); }
    solid(r.torso, 0.6, 0.4, 0.06, 0x2a2a2a, 0, 0.1, 0.23); solid(r.torso, 0.14, 0.14, 0.04, 0xf2c94c, 0, 0.15, 0.265);
    solid(r.head, 0.62, 0.3, 0.62, 0x2a2a2a, 0, 0.28, -0.02);
  },
  megaphone: (r, { solid }) => { solid(r.torso, 0.14, 0.14, 0.2, 0xf2f2f2, 0.38, -0.25, 0.1); solid(r.torso, 0.22, 0.22, 0.08, 0xf2c94c, 0.38, -0.25, 0.22); },
  // ---- Gunner ----
  lmg: (r, { solid }) => {   // heavy barrel with shroud, big ammo box + belt, bipod
    const g = r.level[0].obj;
    solid(g, 0.14, 0.14, 0.6, 0x2a3138, 0, 0.03, 1.05); solid(g, 0.08, 0.08, 0.45, 0x0d0f12, 0, 0.03, 1.5);
    solid(g, 0.26, 0.3, 0.3, 0x4a5a30, 0.12, -0.24, 0.42); for (let k = 0; k < 4; k++) solid(g, 0.06, 0.06, 0.06, 0xf2c94c, 0.12, -0.08 - k * 0.07, 0.6 + k * 0.04);
    solid(g, 0.03, 0.3, 0.03, 0x15181c, -0.05, -0.17, 1.4); solid(g, 0.03, 0.3, 0.03, 0x15181c, 0.05, -0.17, 1.4);
    solid(r.head, 0.6, 0.08, 0.6, 0x8a7a5a, 0, 0.3, 0);   // helmet cover
    if (r.muzzle) r.muzzle.position.z = 1.8;
  },
  bandolier: (r, { solid, pivot: pv }) => { const b = pv(r.torso, 0, 0.05, 0.26); b.rotation.z = 0.75; solid(b, 0.12, 0.95, 0.04, 0x5a4a2a, 0, 0, 0); for (let k = -3; k <= 3; k++) solid(b, 0.08, 0.06, 0.06, 0xf2c94c, 0, k * 0.12, 0.02); },
  headband: (r, { solid }) => { solid(r.head, 0.56, 0.08, 0.56, 0xc0141a, 0, 0.14, 0); solid(r.head, 0.06, 0.24, 0.06, 0xc0141a, 0.12, 0.02, -0.3); solid(r.head, 0.06, 0.2, 0.06, 0xc0141a, 0.2, 0.0, -0.3); },
  shotgun: (r, { solid }) => { const g = r.level[0].obj; solid(g, 0.13, 0.13, 0.5, 0x2a2a2a, 0, 0.03, 0.95); solid(g, 0.12, 0.1, 0.3, 0x8a5a2b, 0, -0.08, 0.7); solid(g, 0.1, 0.16, 0.3, 0x8a5a2b, 0, -0.02, -0.22); if (r.muzzle) r.muzzle.position.z = 1.3; },
  heavyPlate: (r, { solid }) => { solid(r.torso, 0.8, 0.62, 0.54, 0x2a2a20, 0, 0.06, 0); for (const arm of [r.armL, r.armR]) solid(arm, 0.32, 0.2, 0.34, 0x2a2a20, 0, 0.0, 0); },
  longScope: (r, { solid, glow }) => {   // marksman rifle: long scope, longer barrel, boonie hat
    const g = r.level[0].obj; solid(g, 0.11, 0.11, 0.56, 0x111111, 0, 0.19, 0.32); glow(g, 0.12, 0.12, 0.03, 0xf2c94c, 0, 0.19, 0.61); solid(g, 0.06, 0.06, 0.4, 0x0d0f12, 0, 0.03, 1.25);
    solid(r.head, 0.78, 0.05, 0.78, 0x4a5a30, 0, 0.3, 0); solid(r.head, 0.52, 0.16, 0.52, 0x5a6a3a, 0, 0.4, 0);
    if (r.muzzle) r.muzzle.position.z = 1.5;
  },
  laser: (r, { glow }) => { const g = r.level[0].obj; glow(g, 0.05, 0.05, 0.08, 0xff2020, 0.07, -0.02, 0.9); glow(g, 0.015, 0.015, 3, 0xff2020, 0.07, -0.02, 2.4, 0.35); },
  pistols: (r, { solid }) => {   // the rifle becomes a revolver, plus a second one in the off hand
    const g = r.level[0].obj;
    for (const c of g.children) if (c !== r.muzzle) c.visible = false;
    for (const h of [g, pivot(r.armL, 0.0, -0.62, 0.05)]) { solid(h, 0.09, 0.12, 0.42, 0x2a2a2e, 0, 0.02, 0.24); solid(h, 0.08, 0.2, 0.09, 0x8a5a2b, 0, -0.1, 0.04); solid(h, 0.11, 0.11, 0.12, 0x5a5a60, 0, 0.02, 0.12); }
    if (r.muzzle) { r.muzzle.position.z = 0.5; r.muzzle.scale.setScalar(0.6); }
  },
  cowboyHat: (r, { solid }) => { solid(r.head, 0.8, 0.05, 0.8, 0x6b4423, 0, 0.36, 0); solid(r.head, 0.48, 0.22, 0.48, 0x7b5130, 0, 0.48, 0); solid(r.head, 0.5, 0.05, 0.5, 0x2a1a10, 0, 0.4, 0); },
  poncho: (r, { solid }) => { solid(r.torso, 0.86, 0.5, 0.56, 0xb04a1a, 0, 0.1, 0); for (const y of [0.0, 0.2]) solid(r.torso, 0.88, 0.05, 0.58, 0xf2c94c, 0, y, 0); },
};

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
// Extended artillery architecture: chassisRock (suspension/recoil pitch), recoils/muzzles arrays, auxiliary hooks.
function structureRig() {
  const root = new THREE.Group();
  const chassisRock = new THREE.Group();
  root.add(chassisRock);
  const body = new THREE.Group();
  chassisRock.add(body);
  return {
    root,
    chassisRock,
    body,
    mats: new Map(),
    style: 'structure',
    recoils: [],
    muzzles: [],
    recoil: null,
    muzzle: null,
    drum: null,
    glow: null,
    exhaust: null,
    touchholes: []
  };
}
function finishStructure(r) {
  r.matList = [...r.mats.values()];
  for (const mt of r.matList) mt.emissive = new THREE.Color(0x000000);
  if (!r.recoil && r.recoils.length > 0) r.recoil = r.recoils[0];
  if (!r.muzzle && r.muzzles.length > 0) r.muzzle = r.muzzles[0];
  if (r.muzzle) r.muzzle.visible = false;
  if (r.muzzles) for (const mz of r.muzzles) mz.visible = false;
  if (r.exhaust) r.exhaust.visible = false;
  for (const th of r.touchholes || []) th.visible = false;
  if (r.scaffold) r.scaffold.visible = false;
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

// Cannon: 8 looks — Lv1 Field Cannon, Lv2 Bronze, A3 Bombard, A4 Siege Mortar, A5 Great Bombard,
// B3 Twin Cannons, B4 Grapeshot Battery, B5 Thunder Organ. `muzzles` = every barrel tip (multi-barrel guns fire in turn).
export function buildCannon(level = 1, path = null) {
  const r = structureRig(), m = r.mats;
  r.rigType = 'cannon';
  const L = level, A = L >= 3 && path === 'a', Bp = L >= 3 && path === 'b';
  if (L === 1) return buildFieldCannon(r, m);
  if (L === 2) return buildBronzeCannon(r, m);
  if (L === 3 && A) return buildBombard(r, m);
  if (L === 4 && A) return buildSiegeMortar(r, m);
  if (L >= 5 && A) return buildGreatBombard(r, m);
  if (L === 3 && Bp) return buildTwinCannons(r, m);
  if (L === 4 && Bp) return buildGrapeshotBattery(r, m);
  if (L >= 5 && Bp) return buildThunderOrgan(r, m);
  return buildFieldCannon(r, m);
}

// Spoked Wheel helper for Medieval artillery carriages (8-faceted wheel with felloes and cross/diagonal spokes)
function addSpokedWheel(parent, x, z, r, tireW, m, OAK, DARK_OAK, IRON, hubCapColor = null) {
  const wh = pivot(parent, x, r, z);
  // Hub
  B(wh, tireW + 0.04, 0.30, 0.30, IRON, 0, 0, 0, m);
  if (hubCapColor) B(wh, tireW + 0.08, 0.16, 0.16, hubCapColor, 0, 0, 0, m);

  // 4 spokes (0, 90, 45, 135 deg) with mortise stepping to prevent coplanar Z-fighting
  B(wh, 0.104, r * 2 - 0.16, 0.10, OAK, 0, 0, 0, m);
  B(wh, 0.094, 0.10, r * 2 - 0.16, OAK, 0, 0, 0, m);
  const d1 = B(wh, 0.082, r * 2 - 0.18, 0.082, DARK_OAK, 0, 0, 0, m); d1.rotation.x = Math.PI / 4;
  const d2 = B(wh, 0.076, 0.076, r * 2 - 0.18, DARK_OAK, 0, 0, 0, m); d2.rotation.x = Math.PI / 4;

  // 4 outer rim felloes with iron tire finish
  const segL = r * 0.90;
  B(wh, tireW, 0.10, segL, IRON, 0, r - 0.05, 0, m);
  B(wh, tireW, 0.10, segL, IRON, 0, -(r - 0.05), 0, m);
  B(wh, tireW, segL, 0.10, IRON, 0, 0, r - 0.05, m);
  B(wh, tireW, segL, 0.10, IRON, 0, 0, -(r - 0.05), m);
  return wh;
}

/** Cannon A3: Bombard - Stubby, massive-bore iron barrel with hoop reinforcing rings. */
function buildBombard(r, m) {
  const OAK = 0x4a321e, DARK_OAK = 0x342112, IRON = 0x242528, BAND = 0x36383c, STONE = 0xb4b6ba;
  B(r.body, 2.8, 0.16, 2.8, 0x6e6252, 0, 0.08, 0, m);
  for (const s of [-1.25, 1.25]) B(r.body, 2.8, 0.28, 0.28, 0x4a3a2a, 0, 0.22, s, m);
  r.yaw = pivot(r.body, 0, 0.22, 0);

  const wheelX = 0.95, wheelR = 0.7;
  for (const sx of [-wheelX, wheelX]) addSpokedWheel(r.yaw, sx, 0, wheelR, 0.22, m, OAK, DARK_OAK, IRON);
  B(r.yaw, wheelX * 2, 0.22, 0.22, IRON, 0, wheelR, 0, m);

  for (const sx of [-0.55, 0.55]) {
    B(r.yaw, 0.24, 0.8, 1.6, OAK, sx, wheelR + 0.15, -0.05, m);
    B(r.yaw, 0.26, 0.14, 1.62, IRON, sx, wheelR + 0.48, -0.05, m);
    B(r.yaw, 0.28, 0.22, 0.28, BAND, sx, wheelR + 0.45, 0.05, m);
  }
  const trail = B(r.yaw, 0.5, 0.26, 1.8, OAK, 0, 0.38, -1.05, m);
  trail.rotation.x = 0.15;
  B(r.yaw, 0.54, 0.14, 0.42, IRON, 0, 0.14, -1.85, m);

  // Stepped elevation bed
  B(r.yaw, 0.52, 0.3, 0.65, DARK_OAK, 0, wheelR + 0.15, -0.32, m);
  B(r.yaw, 0.42, 0.16, 0.45, OAK, 0, wheelR + 0.3, -0.35, m);

  // Short, massive-bore iron barrel with thick welded hoop rings (Mons Meg style)
  r.barrel = pivot(r.yaw, 0, wheelR + 0.48, 0.05);
  r.recoil = pivot(r.barrel, 0, 0, 0);
  r.recoils = [r.recoil];

  B(r.recoil, 0.3, 0.3, 0.28, BAND, 0, 0, -1.05, m); // cascabel
  B(r.recoil, 0.72, 0.72, 0.7, IRON, 0, 0, -0.65, m); // massive powder chamber
  const th = B(r.recoil, 0.14, 0.2, 0.14, 0xb8860b, 0, 0.42, -0.65, m, { emissive: 0xffa030 });
  th.castShadow = false;
  r.touchholes = [th];
  B(r.recoil, 0.85, 0.85, 1.5, IRON, 0, 0, 0.35, m); // huge main bore
  for (const z of [-0.25, 0.15, 0.55, 0.95]) B(r.recoil, 0.95, 0.95, 0.16, BAND, 0, 0, z, m);
  B(r.recoil, 1.0, 1.0, 0.22, BAND, 0, 0, 1.15, m);
  const mz = B(r.recoil, 0.88, 0.88, 0.4, 0xffb040, 0, 0, 1.35, m, { emissive: 0xff7a00 });
  mz.castShadow = false;
  r.muzzle = mz; r.muzzles = [mz];

  // Huge stone cannonballs
  B(r.yaw, 0.8, 0.08, 0.8, 0x8a7a58, -1.1, 0.04, -0.9, m);
  for (const [bx, bz] of [[-1.25, -1.05], [-0.95, -1.05], [-1.1, -0.75]]) B(r.yaw, 0.34, 0.34, 0.34, STONE, bx, 0.22, bz, m);
  B(r.yaw, 0.34, 0.34, 0.34, STONE, -1.1, 0.48, -0.92, m);

  r.rest = -0.14; r.barrel.rotation.x = r.rest;
  r.scaffold = scaffold(r.body, 1.55, 2.3, m);
  r.barY = 2.6;
  return finishStructure(r);
}

/** Cannon A4: Siege Mortar - High-angle heavy timber firing bed, no front wheels, massive bowl mortar. */
function buildSiegeMortar(r, m) {
  const OAK = 0x422d1b, DARK_OAK = 0x2e1e12, IRON = 0x222428, BAND = 0x36383c, BRONZE = 0x9a6828, STONE = 0xb4b6ba;
  // Sits flat on heavy timber baulks with iron ground anchor spikes
  B(r.body, 2.8, 0.25, 2.8, 0x6e6252, 0, 0.12, 0, m);
  for (const [x, z] of [[-1.1, -1.1], [1.1, -1.1], [-1.1, 1.1], [1.1, 1.1]]) B(r.body, 0.2, 0.5, 0.2, IRON, x, 0.35, z, m);
  r.yaw = pivot(r.body, 0, 0.25, 0);

  // Massive timber bed / ramp carriage
  B(r.yaw, 2.0, 0.55, 2.2, OAK, 0, 0.4, 0, m);
  for (const sx of [-0.85, 0.85]) {
    B(r.yaw, 0.3, 0.9, 2.0, DARK_OAK, sx, 0.75, 0, m);
    B(r.yaw, 0.32, 0.14, 2.04, IRON, sx, 1.22, 0, m);
    B(r.yaw, 0.34, 0.26, 0.34, BRONZE, sx, 1.15, 0.05, m);
  }
  const ramp = B(r.yaw, 1.2, 0.5, 1.2, DARK_OAK, 0, 0.7, -0.3, m);
  ramp.rotation.x = 0.45;

  // Squat wide-mouth bowl mortar tilted at 60 deg
  r.barrel = pivot(r.yaw, 0, 1.15, 0.05);
  r.recoil = pivot(r.barrel, 0, 0, 0);
  r.recoils = [r.recoil];

  B(r.recoil, 1.1, 1.1, 0.8, BRONZE, 0, 0, -0.2, m);
  const th = B(r.recoil, 0.16, 0.22, 0.16, 0xd4a038, 0, 0.6, -0.2, m, { emissive: 0xffa030 });
  th.castShadow = false;
  r.touchholes = [th];
  B(r.recoil, 1.3, 1.3, 1.2, IRON, 0, 0, 0.65, m);
  B(r.recoil, 1.45, 1.45, 0.3, BAND, 0, 0, 0.3, m);
  B(r.recoil, 1.5, 1.5, 0.35, BAND, 0, 0, 1.15, m);
  const mz = B(r.recoil, 1.35, 1.35, 0.4, 0xffa030, 0, 0, 1.35, m, { emissive: 0xff7000 });
  mz.castShadow = false;
  r.muzzle = mz; r.muzzles = [mz];

  // Heavy mortar bomb pile in timber trough & powder shovel
  B(r.yaw, 0.9, 0.2, 0.6, OAK, -1.0, 0.3, -0.85, m);
  B(r.yaw, 0.42, 0.42, 0.42, IRON, -1.0, 0.55, -0.85, m);
  B(r.yaw, 0.42, 0.42, 0.42, IRON, -0.65, 0.55, -0.85, m);
  const shovel = B(r.yaw, 0.08, 0.08, 1.8, 0x8a6a42, 1.05, 0.6, -0.1, m);
  shovel.rotation.x = 0.2;
  B(shovel, 0.3, 0.04, 0.35, IRON, 0, 0, 0.85, m);

  r.rest = -0.9; r.barrel.rotation.x = r.rest;
  r.scaffold = scaffold(r.body, 1.6, 2.4, m);
  r.barY = 2.7;
  return finishStructure(r);
}

/** Cannon A5: Great Bombard - Monster dragon-head muzzle, faction banners, 4-wheel carriage. */
function buildGreatBombard(r, m) {
  const OAK = 0x3d2714, DARK_OAK = 0x28180c, IRON = 0x222428, BRONZE = 0x8c5e28, GOLD = 0xd4a038, CRIMSON = 0x9e1e1e;
  B(r.body, 3.2, 0.2, 3.2, 0x585a60, 0, 0.1, 0, m);
  for (const s of [-1.45, 1.45]) B(r.body, 3.2, 0.35, 0.3, 0x3d2714, 0, 0.25, s, m);
  r.yaw = pivot(r.body, 0, 0.25, 0);

  // Double-axle 4-wheel carriage with heavy bronze hub studs
  const wheelX = 1.15;
  for (const sx of [-wheelX, wheelX]) {
    for (const sz of [-0.65, 0.65]) addSpokedWheel(r.yaw, sx, sz, 0.72, 0.24, m, OAK, DARK_OAK, IRON, GOLD);
  }
  B(r.yaw, wheelX * 2, 0.24, 0.24, IRON, 0, 0.72, -0.65, m);
  B(r.yaw, wheelX * 2, 0.24, 0.24, IRON, 0, 0.72, 0.65, m);

  for (const sx of [-0.65, 0.65]) {
    B(r.yaw, 0.26, 0.95, 2.4, OAK, sx, 0.88, 0, m);
    B(r.yaw, 0.28, 0.16, 2.42, IRON, sx, 1.38, 0, m);
    B(r.yaw, 0.32, 0.26, 0.32, GOLD, sx, 1.35, 0.15, m);
  }
  const trail = B(r.yaw, 0.6, 0.3, 2.2, OAK, 0, 0.45, -1.3, m);
  trail.rotation.x = 0.14;
  B(r.yaw, 0.65, 0.16, 0.5, IRON, 0, 0.16, -2.25, m);
  B(r.yaw, 0.2, 0.2, 0.4, GOLD, 0, 0.4, -2.4, m);

  // Twin Crimson Faction Banners on wrought iron poles
  for (const sx of [-1.2, 1.2]) {
    B(r.yaw, 0.1, 2.8, 0.1, IRON, sx, 1.5, -1.3, m);
    B(r.yaw, 0.12, 0.12, 0.8, GOLD, sx + (sx > 0 ? -0.35 : 0.35), 2.8, -1.3, m);
    B(r.yaw, 0.06, 1.6, 0.7, CRIMSON, sx + (sx > 0 ? -0.35 : 0.35), 2.0, -1.3, m);
  }

  // Dragon-head monster cannon
  r.barrel = pivot(r.yaw, 0, 1.38, 0.15);
  r.recoil = pivot(r.barrel, 0, 0, 0);
  r.recoils = [r.recoil];

  B(r.recoil, 0.4, 0.4, 0.4, GOLD, 0, 0, -1.4, m);
  B(r.recoil, 0.9, 0.9, 0.9, BRONZE, 0, 0, -0.85, m);
  const th = B(r.recoil, 0.18, 0.25, 0.18, GOLD, 0, 0.52, -0.85, m, { emissive: 0xffa030 });
  th.castShadow = false;
  r.touchholes = [th];
  B(r.recoil, 0.8, 0.8, 2.8, IRON, 0, 0, 0.9, m);
  for (const z of [-0.2, 0.6, 1.4, 2.0]) B(r.recoil, 0.92, 0.92, 0.16, GOLD, 0, 0, z, m);

  // Dragon Muzzle Sculpture
  B(r.recoil, 1.15, 0.3, 0.9, GOLD, 0, 0.55, 2.1, m);
  for (const s of [-1, 1]) {
    B(r.recoil, 0.2, 0.32, 0.14, 0xffffff, s * 0.36, 0.5, 2.35, m);
    B(r.recoil, 0.16, 0.16, 0.12, 0xff1010, s * 0.32, 0.68, 2.2, m, { emissive: 0xcc0000 });
  }
  B(r.recoil, 1.05, 1.05, 0.4, BRONZE, 0, 0, 2.45, m);
  const mz = B(r.recoil, 0.95, 0.95, 0.5, 0xffc050, 0, 0, 2.75, m, { emissive: 0xff8a00 });
  mz.castShadow = false;
  r.muzzle = mz; r.muzzles = [mz];

  r.rest = -0.08; r.barrel.rotation.x = r.rest;
  r.scaffold = scaffold(r.body, 1.7, 2.6, m);
  r.barY = 3.0;
  return finishStructure(r);
}

/** Cannon B3: Twin Cannons - Dual side-by-side barrels with independent firing recoil. */
function buildTwinCannons(r, m) {
  const OAK = 0x4a321e, DARK_OAK = 0x362314, IRON = 0x242528, BAND = 0x383a3e;
  B(r.body, 2.8, 0.16, 2.8, 0x6e6252, 0, 0.08, 0, m);
  r.yaw = pivot(r.body, 0, 0.22, 0);

  const wheelX = 1.05, wheelR = 0.72;
  for (const sx of [-wheelX, wheelX]) addSpokedWheel(r.yaw, sx, 0, wheelR, 0.2, m, OAK, DARK_OAK, IRON);
  B(r.yaw, wheelX * 2, 0.2, 0.2, IRON, 0, wheelR, 0, m);

  // Triple cheeks (left, center dividing cheek, right)
  for (const sx of [-0.65, 0, 0.65]) {
    B(r.yaw, 0.18, 0.72, 1.6, OAK, sx, wheelR + 0.14, -0.05, m);
    B(r.yaw, 0.20, 0.14, 1.62, IRON, sx, wheelR + 0.44, -0.05, m);
  }
  const trail = B(r.yaw, 0.55, 0.22, 1.8, OAK, 0, 0.38, -1.05, m);
  trail.rotation.x = 0.14;
  B(r.yaw, 0.58, 0.12, 0.4, IRON, 0, 0.14, -1.85, m);

  r.barrel = pivot(r.yaw, 0, wheelR + 0.44, 0.05);
  r.recoils = [];
  r.muzzles = [];
  r.touchholes = [];

  for (const sx of [-0.34, 0.34]) {
    const rec = pivot(r.barrel, sx, 0, 0);
    r.recoils.push(rec);
    B(rec, 0.2, 0.2, 0.2, BAND, 0, 0, -0.9, m);
    B(rec, 0.44, 0.44, 0.5, IRON, 0, 0, -0.55, m);
    const th = B(rec, 0.12, 0.16, 0.12, 0xb8860b, 0, 0.26, -0.55, m, { emissive: 0xffa030 });
    th.castShadow = false;
    r.touchholes.push(th);
    B(rec, 0.38, 0.38, 0.65, IRON, 0, 0, 0.05, m);
    B(rec, 0.42, 0.42, 0.08, BAND, 0, 0, 0.4, m);
    B(rec, 0.32, 0.32, 0.9, IRON, 0, 0, 0.85, m);
    B(rec, 0.38, 0.38, 0.18, BAND, 0, 0, 1.35, m);
    const mz = B(rec, 0.36, 0.36, 0.35, 0xffc050, 0, 0, 1.55, m, { emissive: 0xff8a00 });
    mz.castShadow = false;
    r.muzzles.push(mz);
  }

  r.rest = -0.12; r.barrel.rotation.x = r.rest;
  r.scaffold = scaffold(r.body, 1.5, 2.3, m);
  r.barY = 2.5;
  return finishStructure(r);
}

/** Cannon B4: Grapeshot Battery - Triple radial fanned blunderbuss barrels, embrasured timber mantlet, canister chest & quilted grapeshot. */
function buildGrapeshotBattery(r, m) {
  const OAK = 0x543a24, DARK_OAK = 0x3a2616, IRON = 0x242629, BAND = 0x36383c, BRONZE = 0x9c6a2e, BRASS = 0xd4a840, TIN = 0xb4b8c0;

  // 1. Timber Ground Emplacement Pad
  B(r.body, 2.8, 0.14, 2.8, 0x6e6252, 0, 0.07, 0, m);
  for (const s of [-1.2, 1.2]) {
    B(r.body, 2.8, 0.22, 0.22, 0x483422, 0, 0.18, s, m); // guide timbers
  }

  // 2. Traversal Turntable Mount
  r.yaw = pivot(r.body, 0, 0.20, 0);

  // 3. Faceted Spoked Wheels (left and right)
  const wheelX = 1.05, wheelR = 0.72;
  for (const sx of [-wheelX, wheelX]) {
    addSpokedWheel(r.yaw, sx, 0, wheelR, 0.20, m, OAK, DARK_OAK, IRON, BRASS);
  }
  // Iron transit axle
  B(r.yaw, wheelX * 2, 0.20, 0.20, IRON, 0, wheelR, 0, m);

  // 4. Carriage Cheeks (Left and Right) with stepped 3D relief (no coplanar tops)
  for (const sx of [-0.64, 0.64]) {
    // Oak cheek: top is at wheelR + 0.44
    B(r.yaw, 0.18, 0.64, 1.56, OAK, sx, wheelR + 0.12, -0.05, m);
    // Iron top plate sits on top of oak cheek: bottom at wheelR + 0.44, top at wheelR + 0.50
    B(r.yaw, 0.20, 0.06, 1.58, IRON, sx, wheelR + 0.47, -0.05, m);
    // Bronze trunnion cap sits on top of iron plate: bottom at wheelR + 0.48, top at wheelR + 0.58
    B(r.yaw, 0.22, 0.10, 0.22, BRONZE, sx, wheelR + 0.53, 0.05, m);
  }

  // Sloping wooden trail beam with parented iron trail shoe (shared rotation, zero angle Z-fight)
  const trail = pivot(r.yaw, 0, 0.36, -1.05);
  trail.rotation.x = 0.14;
  B(trail, 0.46, 0.20, 1.80, OAK, 0, 0, 0, m);
  B(trail, 0.50, 0.12, 0.36, IRON, 0, -0.08, -0.75, m); // trail shoe parented to trail
  B(trail, 0.14, 0.14, 0.16, IRON, 0, 0.10, -0.85, m); // towing lunette ring

  // Transverse spreader transom between cheeks (non-overlapping with elevation bed)
  B(r.yaw, 1.08, 0.12, 0.12, DARK_OAK, 0, wheelR + 0.05, -0.62, m);

  // Elevation screw mechanism beneath breeches
  B(r.yaw, 0.46, 0.16, 0.36, DARK_OAK, 0, wheelR + 0.10, -0.28, m);
  B(r.yaw, 0.12, 0.22, 0.12, BRASS, 0, wheelR + 0.27, -0.28, m); // elevation screw post
  B(r.yaw, 0.32, 0.05, 0.05, BRASS, 0, wheelR + 0.38, -0.28, m); // turning crank

  // 5. Fortified Splinter Mantlet (unified rotation group, zero clipping with barrels or cheeks)
  const mantlet = pivot(r.yaw, 0, wheelR + 0.40, 0.26);
  mantlet.rotation.x = -0.12;
  // Side wings mounted outside the cheeks (x <= -0.67 and x >= +0.67)
  for (const sx of [-0.80, 0.80]) {
    B(mantlet, 0.26, 0.80, 0.08, OAK, sx, 0, 0, m);
    B(mantlet, 0.28, 0.06, 0.10, IRON, sx, 0.43, 0, m); // top iron cap parented to mantlet
  }
  // Bottom apron shield below barrel line (width 1.08, non-overlapping with wings)
  B(mantlet, 1.08, 0.26, 0.08, OAK, 0, -0.22, 0, m);
  // Top lintel arch above barrel line (width 1.34, spans cleanly between wings)
  B(mantlet, 1.34, 0.14, 0.08, OAK, 0, 0.36, 0, m);
  B(mantlet, 1.36, 0.05, 0.10, IRON, 0, 0.44, 0, m); // top iron reinforcing strap

  // 6. Triple Scatter Barrels (Radial Fan Layout)
  r.barrel = pivot(r.yaw, 0, wheelR + 0.42, 0.05);
  r.recoils = [];
  r.muzzles = [];
  r.touchholes = [];

  const barrelConfigs = [
    { x: -0.42, rotY: -0.06 },
    { x:  0.00, rotY:  0.00 },
    { x:  0.42, rotY:  0.06 },
  ];

  for (const cfg of barrelConfigs) {
    const rec = pivot(r.barrel, cfg.x, 0, 0);
    rec.rotation.y = cfg.rotY;
    r.recoils.push(rec);

    // Cascabel knob at breech
    B(rec, 0.16, 0.16, 0.16, BRASS, 0, 0, -0.85, m);
    // Heavy reinforced powder chamber
    B(rec, 0.28, 0.28, 0.48, IRON, 0, 0, -0.50, m);
    // Drilled touchhole with brass flashpan
    const th = B(rec, 0.10, 0.12, 0.10, BRASS, 0, 0.19, -0.50, m, { emissive: 0xffa030 });
    th.castShadow = false;
    r.touchholes.push(th);

    // Tapered forward barrel tube
    B(rec, 0.22, 0.22, 0.82, IRON, 0, 0, 0.13, m);
    // Bronze astragal reinforcing ring
    B(rec, 0.26, 0.26, 0.08, BRONZE, 0, 0, 0.24, m);

    // Flared Blunderbuss Muzzle Assembly
    B(rec, 0.32, 0.32, 0.20, BRONZE, 0, 0, 0.62, m); // flared bell
    B(rec, 0.36, 0.36, 0.06, BRASS, 0, 0, 0.73, m);  // polished brass mouth rim
    B(rec, 0.20, 0.20, 0.04, 0x141518, 0, 0, 0.77, m); // hollow dark bore opening (protrudes 0.01 beyond rim face)

    // Muzzle flash mesh
    const mz = B(rec, 0.30, 0.30, 0.28, 0xffc050, 0, 0, 0.92, m, { emissive: 0xff8a00 });
    mz.castShadow = false;
    r.muzzles.push(mz);
  }

  // 7. Tactical Grapeshot Field Clutter (no coplanar faces)
  // Left: Open wooden ammunition chest with tin canister rounds
  B(r.yaw, 0.52, 0.28, 0.52, DARK_OAK, -1.05, 0.18, -0.85, m);
  const lid = B(r.yaw, 0.52, 0.05, 0.52, OAK, -1.05, 0.38, -1.02, m);
  lid.rotation.x = -0.65;
  // 2 cylindrical tin canister shot rounds inside with wooden sabots
  for (const [cx, cz] of [[-1.12, -0.88], [-0.96, -0.88]]) {
    B(r.yaw, 0.14, 0.18, 0.14, TIN, cx, 0.30, cz, m);
    B(r.yaw, 0.12, 0.04, 0.12, OAK, cx, 0.41, cz, m);
  }

  // Quilted grapeshot stand beside ammo chest (0.005 clearance between balls and base)
  B(r.yaw, 0.26, 0.05, 0.26, OAK, -0.70, 0.08, -0.55, m); // wooden base sabot (top at 0.105)
  for (const [bx, bz] of [[-0.75, -0.60], [-0.65, -0.60], [-0.70, -0.50]]) {
    B(r.yaw, 0.10, 0.10, 0.10, IRON, bx, 0.16, bz, m); // iron shot (bottom at 0.11, clearance +0.005)
  }
  B(r.yaw, 0.10, 0.10, 0.10, IRON, -0.70, 0.24, -0.55, m);

  // Right: Water wash bucket & carriage-mounted rammer/sponge swab
  B(r.yaw, 0.34, 0.28, 0.34, DARK_OAK, 1.05, 0.18, -0.75, m);
  const rammer = B(r.yaw, 0.06, 0.06, 1.8, 0x8a6a42, 0.78, wheelR + 0.34, -0.05, m);
  rammer.rotation.x = 0.14;
  B(rammer, 0.12, 0.12, 0.22, 0xd0c4a8, 0, 0, 0.85, m);

  r.rest = -0.12; r.barrel.rotation.x = r.rest;
  r.scaffold = scaffold(r.body, 1.55, 2.3, m);
  r.barY = 2.5;
  return finishStructure(r);
}

/** Cannon B5: Thunder Organ - 7-barrel ribauldequin spread across an armored cart with fortified steel pavise mantlet. */
function buildThunderOrgan(r, m) {
  const OAK = 0x48321e, DARK_OAK = 0x2e1e12, TIMBER = 0x5a3e26;
  const IRON = 0x242629, STEEL = 0x4c525a;
  const BRONZE = 0x9c6a2e, BRASS = 0xd4a840, GUNPOWDER = 0x18191c, TIN = 0xb4b8c0;

  // 1. Timber & Stone Emplacement Pad
  B(r.body, 3.2, 0.14, 3.2, 0x5e5a54, 0, 0.07, 0, m); // stone/gravel pad
  // Side timber baulks (length 2.9, inset inside pad length 3.2 to prevent X-plane collision)
  for (const s of [-1.45, 1.45]) {
    B(r.body, 2.9, 0.22, 0.24, TIMBER, 0, 0.18, s, m);
  }

  // 2. Traversal Turntable Mount
  r.yaw = pivot(r.body, 0, 0.20, 0);

  // 3. Heavy Artillery Spoked Wheels & Transit Axle
  const wheelX = 1.30, wheelR = 0.75;
  for (const sx of [-wheelX, wheelX]) {
    addSpokedWheel(r.yaw, sx, 0, wheelR, 0.24, m, OAK, DARK_OAK, IRON, BRASS);
  }
  // Square forged iron transit axle
  B(r.yaw, wheelX * 2, 0.20, 0.20, IRON, 0, wheelR, 0, m);

  // 4. Heavy Broad Carriage Frame & Cheeks
  // Outer Cheeks (Left and Right)
  for (const sx of [-1.12, 1.12]) {
    B(r.yaw, 0.20, 0.60, 1.76, OAK, sx, wheelR + 0.10, -0.08, m); // oak cheek beam
    B(r.yaw, 0.22, 0.06, 1.78, IRON, sx, wheelR + 0.43, -0.08, m); // iron top coping strap
    B(r.yaw, 0.24, 0.10, 0.26, BRONZE, sx, wheelR + 0.51, 0.05, m); // bronze trunnion cap
  }

  // Sloping Broad Carriage Trail (Unified rotation pivot, zero Z-fighting with trail shoe)
  const trail = pivot(r.yaw, 0, 0.38, -1.05);
  trail.rotation.x = 0.14;
  B(trail, 0.72, 0.22, 1.95, OAK, 0, 0, 0, m);
  B(trail, 0.76, 0.14, 0.40, IRON, 0, -0.08, -0.80, m); // heavy iron recoil spade shoe
  B(trail, 0.16, 0.16, 0.18, IRON, 0, 0.10, -0.92, m); // towing lunette ring

  // Transverse spreader transom between cheeks
  B(r.yaw, 1.96, 0.12, 0.14, DARK_OAK, 0, wheelR + 0.06, -0.66, m);

  // Elevation Screw Mechanism (below firing bed)
  B(r.yaw, 1.40, 0.14, 0.32, DARK_OAK, 0, wheelR + 0.08, -0.28, m); // screw support bed
  B(r.yaw, 0.16, 0.24, 0.16, BRASS, 0, wheelR + 0.27, -0.28, m); // heavy threaded screw post
  B(r.yaw, 0.36, 0.05, 0.36, BRASS, 0, wheelR + 0.36, -0.28, m); // central elevation handwheel

  // 5. Fortified Steel Pavise Mantlet (Shield with open central embrasure for barrels)
  const mantlet = pivot(r.yaw, 0, wheelR + 0.42, 0.30);
  mantlet.rotation.x = -0.10;
  // Side armored wings (flanking the barrel span)
  for (const sx of [-1.16, 1.16]) {
    B(mantlet, 0.24, 0.88, 0.10, STEEL, sx, 0.06, 0, m);
    B(mantlet, 0.26, 0.06, 0.12, IRON, sx, 0.53, 0, m); // top iron cap
  }
  // Lower Mantlet Apron (below barrel line, width 2.00 leaves clearance to wings at ±1.04)
  B(mantlet, 2.00, 0.28, 0.10, STEEL, 0, -0.27, 0, m);
  B(mantlet, 2.02, 0.05, 0.12, IRON, 0, -0.42, 0, m); // bottom reinforcing strip

  // Upper Mantlet Visor (above barrel line, width 2.00)
  B(mantlet, 2.00, 0.30, 0.10, STEEL, 0, 0.32, 0, m);
  B(mantlet, 2.02, 0.05, 0.12, IRON, 0, 0.48, 0, m); // top iron strap
  // Wide central observation vision slit in upper mantlet
  B(mantlet, 0.44, 0.05, 0.12, 0x141518, 0, 0.28, 0.01, m);

  // 6. Adjustable Steel Firing Rack
  r.barrel = pivot(r.yaw, 0, wheelR + 0.42, 0.05);
  r.recoils = [];
  r.muzzles = [];
  r.touchholes = [];

  // Firing Bed (cradle sitting underneath the barrels, bottom at -0.22, top at -0.12)
  B(r.barrel, 2.22, 0.10, 0.80, STEEL, 0, -0.17, -0.20, m);
  // Heavy side cheeks on rack (flanking barrel 0 and barrel 6 at X = ±1.11)
  for (const sx of [-1.11, 1.11]) {
    B(r.barrel, 0.06, 0.24, 0.82, IRON, sx, -0.06, -0.20, m);
  }
  // Front transverse clamping strap over barrels (bottom at +0.13, top at +0.18)
  B(r.barrel, 2.24, 0.05, 0.08, IRON, 0, 0.155, 0.10, m);

  // 7. Seven Independent Recoil Barrels
  for (let k = 0; k < 7; k++) {
    const x = -0.96 + k * 0.32;
    const rec = pivot(r.barrel, x, 0, 0);
    r.recoils.push(rec);

    // Cascabel knob at rear
    B(rec, 0.14, 0.14, 0.14, BRONZE, 0, 0, -0.66, m);

    // Octagonal powder chamber / breech (Y from -0.11 to +0.11, Z from -0.59 to -0.13)
    B(rec, 0.22, 0.22, 0.46, IRON, 0, 0, -0.36, m);

    // Drilled touchhole with spark emissive mesh (at Z = -0.32)
    const th = B(rec, 0.08, 0.06, 0.08, BRASS, 0, 0.14, -0.32, m, { emissive: 0xffa030 });
    th.castShadow = false;
    r.touchholes.push(th);

    // Breech astragal ring
    B(rec, 0.24, 0.24, 0.06, BRONZE, 0, 0, -0.10, m);

    // Tapered long iron barrel tube (Y from -0.09 to +0.09, length 1.22)
    B(rec, 0.18, 0.18, 1.22, STEEL, 0, 0, 0.54, m);

    // Mid-barrel reinforcing ring
    B(rec, 0.22, 0.22, 0.06, BRONZE, 0, 0, 0.48, m);

    // Polished brass muzzle mouth collar
    B(rec, 0.22, 0.22, 0.08, BRASS, 0, 0, 1.18, m);

    // Hollow dark bore opening (protrudes 0.01 beyond brass collar)
    B(rec, 0.14, 0.14, 0.04, 0x141518, 0, 0, 1.23, m);

    // Muzzle flash mesh
    const mz = B(rec, 0.24, 0.24, 0.30, 0xffc050, 0, 0, 1.40, m, { emissive: 0xff8a00 });
    mz.castShadow = false;
    r.muzzles.push(mz);
  }

  // 8. Continuous Powder Train Ignition Trough across all 7 breeches (at Z = -0.46, clear of touchholes at -0.32)
  // Trough base plate seated cleanly on top of breeches (center Y = 0.130, height 0.030, bottom at 0.115, top at 0.145)
  B(r.barrel, 2.04, 0.030, 0.10, BRASS, 0, 0.130, -0.46, m);
  // Front and rear raised brass lips forming genuine trough channel
  B(r.barrel, 2.08, 0.034, 0.02, BRASS, 0, 0.155, -0.50, m);
  B(r.barrel, 2.08, 0.034, 0.02, BRASS, 0, 0.155, -0.42, m);
  // Dark black gunpowder line in trough
  B(r.barrel, 2.00, 0.014, 0.05, GUNPOWDER, 0, 0.148, -0.46, m);

  // 9. Authentic Siege Artillery Field Clutter
  // Left: Open wooden ammunition chest with canister shot round and powder cartridge
  B(r.yaw, 0.52, 0.28, 0.48, DARK_OAK, -1.20, 0.18, -0.90, m);
  const chestLid = B(r.yaw, 0.56, 0.04, 0.48, OAK, -1.20, 0.37, -1.08, m);
  chestLid.rotation.x = -0.65;
  // Tin canister round with oak sabot inside chest
  B(r.yaw, 0.12, 0.18, 0.12, TIN, -1.20, 0.30, -0.88, m);
  B(r.yaw, 0.10, 0.04, 0.10, OAK, -1.20, 0.40, -0.88, m);
  // Paper powder charge bundle
  B(r.yaw, 0.14, 0.10, 0.14, 0xc4b492, -1.20, 0.26, -0.74, m);

  // Right: Spiked black powder keg behind wheel
  B(r.yaw, 0.36, 0.42, 0.36, OAK, 1.20, 0.25, -1.35, m);
  B(r.yaw, 0.38, 0.10, 0.38, IRON, 1.20, 0.25, -1.35, m); // heavy forged iron girdle band
  B(r.yaw, 0.08, 0.04, 0.08, 0xaa2222, 1.20, 0.48, -1.35, m); // red sealing bung

  // Gunner's linstock staff with glowing slow-match cord
  const linstock = B(r.yaw, 0.06, 1.40, 0.06, 0x8a6a42, 1.22, 0.74, -0.75, m);
  linstock.rotation.z = -0.10;
  B(linstock, 0.14, 0.12, 0.09, IRON, 0, 0.68, 0, m); // serpent fork
  const ember = B(linstock, 0.08, 0.08, 0.08, 0xff3300, 0.04, 0.74, 0, m, { emissive: 0xff2200 });
  ember.castShadow = false;

  r.rest = -0.10;
  r.barrel.rotation.x = r.rest;
  r.scaffold = scaffold(r.body, 1.65, 2.4, m);
  r.barY = 2.6;
  return finishStructure(r);
}

/** Cannon Lv 1: Light 2-wheel wooden cart with single tapered iron barrel and field clutter. */
function buildFieldCannon(r, m) {
  const OAK = 0x5a3e26, DARK_OAK = 0x422d1b, IRON = 0x2b2b2e, BAND = 0x383a3e, HEMP = 0x8a7a58;
  // 1. Emplacement / Timber Ground Pad (within 3x3 footprint)
  B(r.body, 2.6, 0.12, 2.6, 0x6e6252, 0, 0.06, 0, m);
  for (const s of [-1.15, 1.15]) {
    B(r.body, 2.6, 0.22, 0.25, 0x5a4832, 0, 0.17, s, m); // timber guide rails
  }
  
  // 2. Traversal Turntable on the deck
  r.yaw = pivot(r.body, 0, 0.18, 0);

  // 3. Faceted Spoked Wheels (left and right)
  const wheelX = 0.85;
  const wheelR = 0.65;
  for (const sx of [-wheelX, wheelX]) {
    // Wheel hub
    B(r.yaw, 0.22, 0.3, 0.3, IRON, sx, wheelR, 0, m);
    B(r.yaw, 0.26, 0.14, 0.14, 0x1e1e20, sx, wheelR, 0, m); // linchpin
    // Cross Spokes
    B(r.yaw, 0.14, wheelR * 2 - 0.12, 0.14, OAK, sx, wheelR, 0, m);
    B(r.yaw, 0.14, 0.14, wheelR * 2 - 0.12, OAK, sx, wheelR, 0, m);
    // Outer wooden rim felloes
    B(r.yaw, 0.16, wheelR * 2, 0.16, DARK_OAK, sx, wheelR, 0, m);
    B(r.yaw, 0.16, 0.16, wheelR * 2, DARK_OAK, sx, wheelR, 0, m);
    // Iron rim tire
    B(r.yaw, 0.18, wheelR * 2 + 0.04, 0.08, IRON, sx, wheelR, 0, m);
    B(r.yaw, 0.18, 0.08, wheelR * 2 + 0.04, IRON, sx, wheelR, 0, m);
  }

  // 4. Carriage: Cheeks, Axle, and Trail
  B(r.yaw, wheelX * 2, 0.18, 0.18, IRON, 0, wheelR, 0, m); // axle
  for (const sx of [-0.48, 0.48]) {
    B(r.yaw, 0.18, 0.65, 1.4, OAK, sx, wheelR + 0.12, -0.05, m);
    B(r.yaw, 0.20, 0.12, 1.42, IRON, sx, wheelR + 0.4, -0.05, m); // iron top strapping
    // Trunnion caps
    B(r.yaw, 0.22, 0.18, 0.22, BAND, sx, wheelR + 0.38, 0.05, m);
  }
  // Central Trail Beam sloping to the ground
  const trail = B(r.yaw, 0.38, 0.22, 1.6, OAK, 0, 0.36, -0.95, m);
  trail.rotation.x = 0.15;
  B(r.yaw, 0.42, 0.1, 0.35, IRON, 0, 0.14, -1.65, m); // iron trail shoe digging into dirt
  // Transverse spreader bolts
  B(r.yaw, 0.82, 0.1, 0.1, IRON, 0, wheelR + 0.05, -0.5, m);

  // 5. Elevation Quoin (stepped wedge under barrel)
  B(r.yaw, 0.45, 0.22, 0.55, DARK_OAK, 0, wheelR + 0.12, -0.3, m);
  B(r.yaw, 0.35, 0.12, 0.35, OAK, 0, wheelR + 0.24, -0.35, m);

  // 6. Barrel Assembly mounted on recoil pivot
  r.barrel = pivot(r.yaw, 0, wheelR + 0.42, 0.05);
  r.recoil = pivot(r.barrel, 0, 0, 0);
  r.recoils = [r.recoil];

  // Cascabel knob at rear
  B(r.recoil, 0.22, 0.22, 0.22, BAND, 0, 0, -0.9, m);
  // Breech / Vent field
  B(r.recoil, 0.52, 0.52, 0.55, IRON, 0, 0, -0.55, m);
  // Touchhole / Vent on top
  const th = B(r.recoil, 0.12, 0.18, 0.12, 0xb8860b, 0, 0.28, -0.55, m, { emissive: 0xffa030 });
  th.castShadow = false;
  r.touchholes = [th];
  // First reinforce
  B(r.recoil, 0.46, 0.46, 0.7, IRON, 0, 0, 0.05, m);
  // Astragal ring
  B(r.recoil, 0.5, 0.5, 0.08, BAND, 0, 0, 0.42, m);
  // Second reinforce / Chase (tapered forward)
  B(r.recoil, 0.4, 0.4, 0.9, IRON, 0, 0, 0.85, m);
  // Muzzle swell & astragal
  B(r.recoil, 0.46, 0.46, 0.18, BAND, 0, 0, 1.35, m);
  // Muzzle flash plane inside bore
  const mz = B(r.recoil, 0.45, 0.45, 0.4, 0xffc050, 0, 0, 1.55, m, { emissive: 0xff8a00 });
  mz.castShadow = false;
  r.muzzle = mz;
  r.muzzles = [mz];

  // 7. Field Clutter (within footprint)
  B(r.yaw, 0.55, 0.08, 0.55, HEMP, -0.95, 0.04, -0.85, m);
  B(r.yaw, 0.24, 0.24, 0.24, 0x222226, -1.05, 0.16, -0.95, m);
  B(r.yaw, 0.24, 0.24, 0.24, 0x222226, -0.85, 0.16, -0.95, m);
  B(r.yaw, 0.24, 0.24, 0.24, 0x222226, -0.95, 0.32, -0.95, m);
  B(r.yaw, 0.32, 0.38, 0.32, OAK, 0.95, 0.19, -0.75, m);
  B(r.yaw, 0.34, 0.06, 0.34, IRON, 0.95, 0.1, -0.75, m);
  B(r.yaw, 0.34, 0.06, 0.34, IRON, 0.95, 0.32, -0.75, m);
  const ram = B(r.yaw, 0.06, 0.06, 1.7, 0x8a6a42, 0.62, wheelR + 0.3, -0.1, m);
  ram.rotation.x = 0.1;
  B(ram, 0.14, 0.14, 0.28, 0xd0c4a8, 0, 0, 0.8, m);

  r.rest = -0.12;
  r.barrel.rotation.x = r.rest;
  r.scaffold = scaffold(r.body, 1.4, 2.2, m);
  r.barY = 2.4;
  return finishStructure(r);
}

/** Cannon Lv 2: Reinforced iron-banded oak chassis with cast bronze barrel and extra field clutter. */
function buildBronzeCannon(r, m) {
  const OAK = 0x4a321e, DARK_OAK = 0x362314, IRON = 0x242528, BRONZE = 0xa87428, GOLD = 0xd4a038, HEMP = 0x8a7a58;
  // 1. Reinforced stone/timber platform with iron angle plates
  B(r.body, 2.8, 0.16, 2.8, 0x6e6252, 0, 0.08, 0, m);
  for (const s of [-1.25, 1.25]) {
    B(r.body, 2.8, 0.28, 0.28, 0x4a3a2a, 0, 0.22, s, m);
    B(r.body, 2.82, 0.06, 0.3, IRON, 0, 0.38, s, m); // iron coping
  }
  
  // 2. Traversal Turntable
  r.yaw = pivot(r.body, 0, 0.22, 0);

  // 3. Faceted Spoked Wheels with bronze hubcaps & reinforced iron tires
  const wheelX = 0.95;
  const wheelR = 0.72;
  for (const sx of [-wheelX, wheelX]) {
    B(r.yaw, 0.24, 0.34, 0.34, IRON, sx, wheelR, 0, m);
    B(r.yaw, 0.28, 0.18, 0.18, GOLD, sx, wheelR, 0, m); // polished bronze/brass hubcap
    B(r.yaw, 0.14, wheelR * 2 - 0.14, 0.14, OAK, sx, wheelR, 0, m);
    B(r.yaw, 0.14, 0.14, wheelR * 2 - 0.14, OAK, sx, wheelR, 0, m);
    B(r.yaw, 0.18, wheelR * 2, 0.18, DARK_OAK, sx, wheelR, 0, m);
    B(r.yaw, 0.18, 0.18, wheelR * 2, DARK_OAK, sx, wheelR, 0, m);
    B(r.yaw, 0.20, wheelR * 2 + 0.06, 0.10, IRON, sx, wheelR, 0, m);
    B(r.yaw, 0.20, 0.10, wheelR * 2 + 0.06, IRON, sx, wheelR, 0, m);
  }

  // 4. Heavy banded oak chassis
  B(r.yaw, wheelX * 2, 0.20, 0.20, IRON, 0, wheelR, 0, m); // axle
  for (const sx of [-0.52, 0.52]) {
    B(r.yaw, 0.20, 0.72, 1.55, OAK, sx, wheelR + 0.14, -0.05, m);
    B(r.yaw, 0.22, 0.14, 1.57, IRON, sx, wheelR + 0.44, -0.05, m); // top iron strap
    B(r.yaw, 0.24, 0.20, 0.24, BRONZE, sx, wheelR + 0.42, 0.05, m);
  }
  const trail = B(r.yaw, 0.44, 0.24, 1.8, OAK, 0, 0.38, -1.05, m);
  trail.rotation.x = 0.14;
  B(r.yaw, 0.48, 0.12, 0.42, IRON, 0, 0.14, -1.85, m); // heavy spade skid
  B(r.yaw, 0.14, 0.14, 0.35, BRONZE, 0, 0.32, -1.95, m); // bronze towing pintle ring

  // 5. Screw elevation mechanism with brass quoin & crank
  B(r.yaw, 0.48, 0.24, 0.6, DARK_OAK, 0, wheelR + 0.14, -0.32, m);
  B(r.yaw, 0.12, 0.35, 0.12, BRONZE, 0, wheelR + 0.28, -0.32, m); // elevating screw
  B(r.yaw, 0.32, 0.08, 0.08, GOLD, 0, wheelR + 0.42, -0.42, m); // adjustment crank

  // 6. Polished Cast Bronze Barrel (stepped, ornate rings, cascabel button)
  r.barrel = pivot(r.yaw, 0, wheelR + 0.46, 0.05);
  r.recoil = pivot(r.barrel, 0, 0, 0);
  r.recoils = [r.recoil];

  B(r.recoil, 0.26, 0.26, 0.26, GOLD, 0, 0, -1.0, m);
  B(r.recoil, 0.58, 0.58, 0.6, BRONZE, 0, 0, -0.6, m);
  const th = B(r.recoil, 0.14, 0.20, 0.14, GOLD, 0, 0.32, -0.6, m, { emissive: 0xffa030 });
  th.castShadow = false;
  r.touchholes = [th];
  B(r.recoil, 0.62, 0.62, 0.10, GOLD, 0, 0, -0.28, m);
  B(r.recoil, 0.50, 0.50, 0.75, BRONZE, 0, 0, 0.1, m);
  B(r.recoil, 1.25, 0.22, 0.22, BRONZE, 0, 0, 0.05, m);
  B(r.recoil, 0.54, 0.54, 0.10, GOLD, 0, 0, 0.5, m);
  B(r.recoil, 0.44, 0.44, 1.0, BRONZE, 0, 0, 1.0, m);
  B(r.recoil, 0.54, 0.54, 0.22, GOLD, 0, 0, 1.55, m);
  const mz = B(r.recoil, 0.52, 0.52, 0.45, 0xffd060, 0, 0, 1.8, m, { emissive: 0xff9000 });
  mz.castShadow = false;
  r.muzzle = mz;
  r.muzzles = [mz];

  // 7. Field Clutter (Lv 2 additions: powder keg, stacked balls, dual swabs)
  B(r.yaw, 0.65, 0.08, 0.65, HEMP, -1.05, 0.04, -0.9, m);
  for (const [bx, bz] of [[-1.18, -1.02], [-0.92, -1.02], [-1.05, -0.78]]) {
    B(r.yaw, 0.24, 0.24, 0.24, 0x1e2024, bx, 0.16, bz, m);
  }
  B(r.yaw, 0.24, 0.24, 0.24, 0x1e2024, -1.05, 0.32, -0.92, m);
  B(r.yaw, 0.38, 0.48, 0.38, 0x5a3d24, 1.05, 0.24, -0.85, m);
  B(r.yaw, 0.40, 0.06, 0.40, IRON, 1.05, 0.10, -0.85, m);
  B(r.yaw, 0.40, 0.06, 0.40, IRON, 1.05, 0.38, -0.85, m);
  B(r.yaw, 0.12, 0.06, 0.12, 0x8a2c20, 1.05, 0.49, -0.85, m);
  const ram = B(r.yaw, 0.06, 0.06, 1.8, 0x8a6a42, 0.68, wheelR + 0.32, -0.12, m);
  ram.rotation.x = 0.12;
  B(ram, 0.14, 0.14, 0.3, 0xd0c4a8, 0, 0, 0.85, m);
  const worm = B(r.yaw, 0.06, 0.06, 1.8, 0x8a6a42, -0.68, wheelR + 0.32, -0.12, m);
  worm.rotation.x = 0.12;
  B(worm, 0.12, 0.12, 0.25, IRON, 0, 0, 0.85, m);

  r.rest = -0.12;
  r.barrel.rotation.x = r.rest;
  r.scaffold = scaffold(r.body, 1.5, 2.3, m);
  r.barY = 2.5;
  return finishStructure(r);
}

// Howitzer: Lv1 Field, Lv2 Heavy, A3 Long Tom, A4 Guided Shells, A5 Railgun, B3 Autoloader, B4 MLRS, B5 Thermobaric.
export function buildHowitzer(level = 1, path = null) {
  const r = structureRig(), m = r.mats;
  r.rigType = 'howitzer';
  const L = level, A = L >= 3 && path === 'a', Bp = L >= 3 && path === 'b';
  if (L === 1) return buildFieldHowitzer(r, m);
  if (L === 2) return buildHeavyHowitzer(r, m);
  if (L === 3 && A) return buildLongTom(r, m);
  if (L === 4 && A) return buildGuidedShells(r, m);
  if (L >= 5 && A) return buildRailgun(r, m);
  if (L === 3 && Bp) return buildAutoloader(r, m);
  if (L === 4 && Bp) return buildMLRS(r, m);
  if (L >= 5 && Bp) return buildThermobaric(r, m);
  return buildFieldHowitzer(r, m);
}

/** Howitzer A3: Long Tom - Ultra-long 4.4m barrel, counterweight stanchions, traverse gear, and periscope. */
function buildLongTom(r, m) {
  const OLIVE = 0x3d4b30, DARK_OLIVE = 0x2a3520, STEEL = 0x34373d, GUNMETAL = 0x1e2024, CHROME = 0x9aa2ac, BRASS = 0xc9a050;
  B(r.body, 3.2, 0.16, 3.2, 0x82868c, 0, 0.08, 0, m);
  r.yaw = pivot(r.body, 0, 0.16, 0);
  B(r.yaw, 2.4, 0.16, 2.4, GUNMETAL, 0, 0.08, 0, m);
  B(r.yaw, 2.5, 0.06, 2.5, STEEL, 0, 0.16, 0, m);

  // Split-trail legs with wide spade outriggers
  for (const s of [-1, 1]) {
    const leg = B(r.yaw, 0.22, 0.2, 2.1, DARK_OLIVE, s * 0.55, 0.34, -1.05, m);
    leg.rotation.y = s * 0.32;
    B(r.yaw, 0.44, 0.24, 0.32, STEEL, s * 0.92, 0.18, -2.0, m);
  }
  // Heavy road wheels
  B(r.yaw, 2.1, 0.18, 0.18, GUNMETAL, 0, 0.45, 0.1, m);
  for (const s of [-1, 1]) {
    B(r.yaw, 0.24, 0.9, 0.9, 0x1c1e22, s * 1.1, 0.45, 0.1, m);
    B(r.yaw, 0.26, 0.45, 0.45, STEEL, s * 1.1, 0.45, 0.1, m);
  }

  // Turntable stanchions & Counterweight block
  for (const s of [-1, 1]) B(r.yaw, 0.26, 0.9, 0.6, GUNMETAL, s * 0.55, 0.7, 0, m);
  B(r.yaw, 1.2, 0.6, 1.1, DARK_OLIVE, 0, 0.55, -1.2, m);
  // Traverse gear & periscope
  B(r.yaw, 0.16, 0.28, 0.28, STEEL, 0.65, 0.8, 0.1, m);
  B(r.yaw, 0.18, 0.4, 0.18, GUNMETAL, -0.65, 1.1, 0.15, m);
  B(r.yaw, 0.14, 0.08, 0.08, 0x4fa8e0, -0.65, 1.25, 0.24, m, { emissive: 0x0b2a44 });

  r.barrel = pivot(r.yaw, 0, 1.15, 0.1);
  r.recoil = pivot(r.barrel, 0, 0, 0);
  r.recoils = [r.recoil];

  B(r.recoil, 0.6, 0.56, 1.0, GUNMETAL, 0, 0, -0.4, m);
  B(r.recoil, 0.42, 0.24, 2.0, STEEL, 0, 0.36, 0.8, m);
  B(r.recoil, 0.32, 0.18, 0.8, CHROME, 0, 0.36, 1.9, m);
  B(r.recoil, 0.32, 0.32, 4.4, OLIVE, 0, 0, 2.2, m);
  B(r.recoil, 0.48, 0.38, 0.6, STEEL, 0, 0, 4.4, m);
  const mz = B(r.recoil, 0.65, 0.65, 0.65, 0xffc860, 0, 0, 4.75, m, { emissive: 0xff8a00 });
  mz.castShadow = false;
  r.muzzle = mz; r.muzzles = [mz];

  // Spent brass casing on deck
  B(r.yaw, 0.14, 0.14, 0.55, BRASS, 0.35, 0.24, -0.7, m);

  r.rest = -0.3; r.barrel.rotation.x = r.rest;
  r.scaffold = scaffold(r.body, 1.65, 2.5, m);
  r.barY = 2.6;
  return finishStructure(r);
}

/** Howitzer A4: Guided Shells - Radar mast + rotating dish, ballistic computer, and optical laser sensor. */
function buildGuidedShells(r, m) {
  const OLIVE = 0x3d4b30, DARK_OLIVE = 0x2a3520, STEEL = 0x34373d, GUNMETAL = 0x1e2024;
  B(r.body, 3.2, 0.16, 3.2, 0x82868c, 0, 0.08, 0, m);
  r.yaw = pivot(r.body, 0, 0.16, 0);
  B(r.yaw, 2.4, 0.16, 2.4, GUNMETAL, 0, 0.08, 0, m);

  for (const s of [-1, 1]) {
    const leg = B(r.yaw, 0.24, 0.22, 1.9, OLIVE, s * 0.5, 0.32, -0.9, m);
    leg.rotation.y = s * 0.3;
    B(r.yaw, 0.42, 0.24, 0.3, STEEL, s * 0.82, 0.16, -1.8, m);
  }
  B(r.yaw, 2.0, 0.18, 0.18, GUNMETAL, 0, 0.44, 0.1, m);
  for (const s of [-1, 1]) {
    B(r.yaw, 0.24, 0.9, 0.9, 0x1c1e22, s * 1.05, 0.44, 0.1, m);
    B(r.yaw, 0.26, 0.45, 0.45, STEEL, s * 1.05, 0.44, 0.1, m);
  }

  // Splinter shield with optic laser sensor box
  const sh = B(r.yaw, 2.0, 1.1, 0.14, OLIVE, 0, 1.15, 0.5, m);
  sh.rotation.x = -0.14;
  B(r.yaw, 0.3, 0.2, 0.2, GUNMETAL, 0.55, 1.35, 0.55, m);
  B(r.yaw, 0.14, 0.14, 0.06, 0xff2020, 0.55, 1.35, 0.65, m, { emissive: 0xaa0000 });

  // Rotating fire-control radar mast + dish
  const mast = pivot(r.yaw, -1.05, 0.2, -0.7);
  B(mast, 0.14, 2.4, 0.14, STEEL, 0, 1.2, 0, m);
  const dish = B(mast, 0.18, 0.9, 1.3, 0xd8dce2, 0.1, 2.4, 0, m);
  dish.rotation.z = 0.28;
  r.radar = mast;

  // Ballistic computer cabinet
  B(r.yaw, 0.7, 0.7, 0.5, 0x22252a, 1.05, 0.55, -0.7, m);
  B(r.yaw, 0.5, 0.35, 0.06, 0x4fa8e0, 1.05, 0.65, -0.44, m, { emissive: 0x0b2a44 });
  B(r.yaw, 0.12, 0.12, 0.06, 0x3ae35f, 1.05, 0.35, -0.44, m, { emissive: 0x168a28 });

  r.barrel = pivot(r.yaw, 0, 1.15, 0.1);
  r.recoil = pivot(r.barrel, 0, 0, 0);
  r.recoils = [r.recoil];

  B(r.recoil, 0.58, 0.52, 0.95, GUNMETAL, 0, 0, -0.35, m);
  B(r.recoil, 0.38, 0.24, 1.8, STEEL, 0, 0.34, 0.7, m);
  B(r.recoil, 0.32, 0.32, 4.0, OLIVE, 0, 0, 2.0, m);
  // Velocity radar measurement coils on muzzle
  B(r.recoil, 0.44, 0.44, 0.25, 0x2a2d32, 0, 0, 3.5, m);
  B(r.recoil, 0.46, 0.36, 0.55, STEEL, 0, 0, 4.05, m);
  const mz = B(r.recoil, 0.65, 0.65, 0.65, 0xffc860, 0, 0, 4.35, m, { emissive: 0xff8a00 });
  mz.castShadow = false;
  r.muzzle = mz; r.muzzles = [mz];

  r.rest = -0.3; r.barrel.rotation.x = r.rest;
  r.scaffold = scaffold(r.body, 1.65, 2.5, m);
  r.barY = 2.6;
  return finishStructure(r);
}

/** Howitzer A5: Railgun - Twin magnetic rails, capacitor banks, power cables, and glowing capacitive coils. */
function buildRailgun(r, m) {
  const DK = 0x22252a, STEEL = 0x34373d, CYAN = 0x40e8ff, GLOW_CYAN = 0x0090c0;
  B(r.body, 3.4, 0.18, 3.4, 0x82868c, 0, 0.09, 0, m);
  r.yaw = pivot(r.body, 0, 0.18, 0);

  // Turntable and heavy capacitor housing
  B(r.yaw, 2.6, 0.3, 2.6, STEEL, 0, 0.15, 0, m);
  B(r.yaw, 1.6, 1.0, 1.8, DK, 0, 0.8, -0.4, m);
  for (const s of [-0.4, 0.4]) B(r.yaw, 0.15, 0.5, 0.04, CYAN, s, 0.85, 0.52, m, { emissive: GLOW_CYAN });
  for (const s of [-1, 1]) {
    B(r.yaw, 0.4, 0.7, 1.4, 0x2a2d32, s * 1.1, 0.65, -0.7, m);
    B(r.yaw, 0.12, 0.12, 1.2, 0x181a1e, s * 0.85, 0.4, 0.2, m);
  }

  r.barrel = pivot(r.yaw, 0, 1.3, 0.2);
  r.recoil = pivot(r.barrel, 0, 0, 0);
  r.recoils = [r.recoil];

  for (const s of [-1, 1]) B(r.recoil, 0.2, 0.45, 4.8, 0x8a8f96, s * 0.24, 0, 2.1, m);
  const glowCoils = [];
  for (let k = 0; k < 6; k++) {
    B(r.recoil, 0.82, 0.82, 0.18, 0x1e2024, 0, 0, 0.3 + k * 0.75, m);
    const coil = B(r.recoil, 0.65, 0.14, 0.2, CYAN, 0, 0.4, 0.3 + k * 0.75, m, { emissive: GLOW_CYAN });
    coil.castShadow = false;
    glowCoils.push(coil);
  }
  r.glow = glowCoils;

  const mz = B(r.recoil, 0.8, 0.8, 0.8, 0xa0f0ff, 0, 0, 4.6, m, { emissive: 0x60d0ff });
  mz.castShadow = false;
  r.muzzle = mz; r.muzzles = [mz];

  r.rest = -0.04; r.barrel.rotation.x = r.rest;
  r.scaffold = scaffold(r.body, 1.7, 2.6, m);
  r.barY = 2.8;
  return finishStructure(r);
}

/** Howitzer B3: Autoloader - Revolving 6-round ammo drum magazine beside breech. */
function buildAutoloader(r, m) {
  const OLIVE = 0x3d4b30, STEEL = 0x34373d, GUNMETAL = 0x1e2024, BRASS = 0xc9a050;
  B(r.body, 3.2, 0.16, 3.2, 0x82868c, 0, 0.08, 0, m);
  r.yaw = pivot(r.body, 0, 0.16, 0);

  for (const s of [-1, 1]) {
    const leg = B(r.yaw, 0.24, 0.22, 1.9, OLIVE, s * 0.5, 0.32, -0.9, m);
    leg.rotation.y = s * 0.3;
    B(r.yaw, 0.42, 0.24, 0.3, STEEL, s * 0.82, 0.16, -1.8, m);
  }
  B(r.yaw, 1.9, 0.16, 0.16, GUNMETAL, 0, 0.42, 0.1, m);
  for (const s of [-1, 1]) B(r.yaw, 0.24, 0.9, 0.9, 0x1c1e22, s * 1.05, 0.42, 0.1, m);

  // Side-mounted revolving cylinder drum (6 rounds)
  const drum = pivot(r.yaw, 0.82, 1.1, -0.35);
  B(drum, 0.75, 0.75, 0.75, STEEL, 0, 0, 0, m);
  for (let k = 0; k < 6; k++) {
    const a = k / 6 * Math.PI * 2;
    B(drum, 0.15, 0.15, 0.85, BRASS, Math.cos(a) * 0.32, Math.sin(a) * 0.32, 0, m);
  }
  r.drum = drum;
  r.radar = drum;

  r.barrel = pivot(r.yaw, 0, 1.15, 0.15);
  r.recoil = pivot(r.barrel, 0, 0, 0);
  r.recoils = [r.recoil];

  B(r.recoil, 0.54, 0.5, 0.9, GUNMETAL, 0, 0, -0.25, m);
  B(r.recoil, 0.36, 0.24, 1.6, STEEL, 0, 0.3, 0.6, m);
  B(r.recoil, 0.3, 0.3, 3.4, OLIVE, 0, 0, 1.7, m);
  B(r.recoil, 0.45, 0.35, 0.5, STEEL, 0, 0, 3.4, m);
  const mz = B(r.recoil, 0.6, 0.6, 0.6, 0xffc860, 0, 0, 3.7, m, { emissive: 0xff8a00 });
  mz.castShadow = false;
  r.muzzle = mz; r.muzzles = [mz];

  r.rest = -0.45; r.barrel.rotation.x = r.rest;
  r.scaffold = scaffold(r.body, 1.65, 2.5, m);
  r.barY = 2.6;
  return finishStructure(r);
}

/** Howitzer B4: MLRS - 6-wheel mobile artillery truck chassis with 6-tube rocket pod and rear back-blast. */
function buildMLRS(r, m) {
  const OLIVE = 0x485834, DK = 0x303c22;
  B(r.body, 3.2, 0.16, 3.2, 0x82868c, 0, 0.08, 0, m);
  r.yaw = pivot(r.body, 0, 0.16, 0);

  // Heavy 6-wheel chassis
  B(r.yaw, 1.8, 0.55, 3.3, OLIVE, 0, 0.55, -0.2, m);
  for (const z of [-1.3, -0.3, 0.8]) {
    for (const s of [-1, 1]) B(r.yaw, 0.3, 0.65, 0.65, 0x222428, s * 0.95, 0.32, z, m);
  }
  // Armored cab with tinted windows
  B(r.yaw, 1.6, 0.85, 1.0, DK, 0, 1.25, 1.15, m);
  B(r.yaw, 1.4, 0.32, 0.1, 0x4fa8e0, 0, 1.4, 1.66, m, { emissive: 0x0b2a44 });

  // Boxed 6-tube rocket pod assembly (3x2)
  r.barrel = pivot(r.yaw, 0, 1.25, -0.6);
  r.recoil = pivot(r.barrel, 0, 0, 0);
  r.recoils = [r.recoil];

  B(r.recoil, 1.5, 1.05, 2.2, OLIVE, 0, 0.35, 0.2, m);
  for (let i = 0; i < 3; i++) {
    for (let j = 0; j < 2; j++) {
      const x = (i - 1) * 0.45, y = 0.35 + (j - 0.5) * 0.45;
      B(r.recoil, 0.38, 0.38, 0.1, 0x1a1a1e, x, y, 1.32, m);
      B(r.recoil, 0.24, 0.24, 0.12, 0xd8d8d8, x, y, 1.28, m);
    }
  }
  const mz = B(r.recoil, 1.4, 0.9, 0.5, 0xffb040, 0, 0.35, 1.55, m, { emissive: 0xff7a00 });
  mz.castShadow = false;
  r.muzzle = mz; r.muzzles = [mz];

  // Rear back-blast exhaust vent
  const ex = B(r.recoil, 1.4, 0.9, 0.5, 0xff7020, 0, 0.35, -1.15, m, { emissive: 0xdd4000 });
  ex.castShadow = false;
  r.exhaust = ex;

  r.rest = -0.5; r.barrel.rotation.x = r.rest;
  r.scaffold = scaffold(r.body, 1.65, 2.5, m);
  r.barY = 2.9;
  return finishStructure(r);
}

/** Howitzer B5: Thermobaric - Heavy tracked vehicle chassis with quad thermobaric missile pod and hazard chevrons. */
function buildThermobaric(r, m) {
  const DK = 0x2e3034, STEEL = 0x42464c, HAZARD_Y = 0xf2c94c, HAZARD_B = 0x1a1a1a, RED = 0xd03020;
  B(r.body, 3.4, 0.18, 3.4, 0x82868c, 0, 0.09, 0, m);
  r.yaw = pivot(r.body, 0, 0.18, 0);

  // Heavy tracked chassis
  B(r.yaw, 1.9, 0.6, 3.4, DK, 0, 0.6, -0.2, m);
  for (const s of [-1, 1]) {
    B(r.yaw, 0.4, 0.55, 3.5, 0x202226, s * 1.05, 0.38, -0.2, m);
    for (let z = -1.4; z <= 1.4; z += 0.7) B(r.yaw, 0.44, 0.35, 0.35, STEEL, s * 1.05, 0.38, z, m);
  }
  // Heavy armored cab with blast deflection shield
  B(r.yaw, 1.7, 0.9, 1.1, 0x24262a, 0, 1.35, 1.15, m);
  B(r.yaw, 1.4, 0.32, 0.1, 0x4fa8e0, 0, 1.5, 1.72, m, { emissive: 0x0b2a44 });

  // Armored quad-missile silo pod (2x2 massive tubes)
  r.barrel = pivot(r.yaw, 0, 1.35, -0.6);
  r.recoil = pivot(r.barrel, 0, 0, 0);
  r.recoils = [r.recoil];

  B(r.recoil, 1.7, 1.25, 2.3, DK, 0, 0.4, 0.2, m);
  for (let i = 0; i < 2; i++) {
    for (let j = 0; j < 2; j++) {
      const x = (i - 0.5) * 0.72, y = 0.4 + (j - 0.5) * 0.72;
      B(r.recoil, 0.6, 0.6, 0.12, 0x161618, x, y, 1.36, m);
      B(r.recoil, 0.42, 0.42, 0.15, RED, x, y, 1.32, m);
    }
  }
  // Black and yellow hazard chevron stripes across launcher face
  for (let k = 0; k < 6; k++) {
    B(r.recoil, 0.28, 0.08, 2.32, k % 2 ? HAZARD_B : HAZARD_Y, -0.7 + k * 0.28, 0.4 + 0.68, 0.2, m);
  }
  const mz = B(r.recoil, 1.6, 1.1, 0.6, 0xffa030, 0, 0.4, 1.65, m, { emissive: 0xff6000 });
  mz.castShadow = false;
  r.muzzle = mz; r.muzzles = [mz];

  // Heavy rear flame exhaust
  const ex = B(r.recoil, 1.6, 1.1, 0.6, 0xff5010, 0, 0.4, -1.2, m, { emissive: 0xee3000 });
  ex.castShadow = false;
  r.exhaust = ex;

  r.rest = -0.5; r.barrel.rotation.x = r.rest;
  r.scaffold = scaffold(r.body, 1.7, 2.6, m);
  r.barY = 3.0;
  return finishStructure(r);
}

/** Howitzer Lv 1: Field Howitzer with split-trail carriage, spade outriggers, hydraulic recuperator, and ammo box. */
function buildFieldHowitzer(r, m) {
  const OLIVE = 0x425232, DARK_OLIVE = 0x303d24, STEEL = 0x383c44, GUNMETAL = 0x222428, SAND = 0xa8956a, CHROME = 0x88929e;
  // 1. Concrete Firing Pad (within 3x3 footprint)
  B(r.body, 2.8, 0.14, 2.8, 0x8a8e94, 0, 0.07, 0, m);
  for (const [bx, bz] of [[-1.1, -1.1], [1.1, -1.1], [-1.1, 1.1], [1.1, 1.1]]) {
    B(r.body, 0.65, 0.28, 0.45, SAND, bx, 0.21, bz, m);
  }

  // 2. Turntable Mount
  r.yaw = pivot(r.body, 0, 0.14, 0);
  B(r.yaw, 1.6, 0.14, 1.6, GUNMETAL, 0, 0.07, 0, m);

  // 3. Split-trail tubular legs with triangular ground spades
  for (const s of [-1, 1]) {
    const leg = B(r.yaw, 0.18, 0.18, 1.8, DARK_OLIVE, s * 0.45, 0.32, -0.9, m);
    leg.rotation.y = s * 0.28;
    B(r.yaw, 0.38, 0.22, 0.28, STEEL, s * 0.78, 0.16, -1.75, m);
  }

  // 4. Wheels on transit axle
  B(r.yaw, 1.9, 0.16, 0.16, GUNMETAL, 0, 0.42, 0.1, m);
  for (const s of [-1, 1]) {
    B(r.yaw, 0.22, 0.85, 0.85, 0x1c1e22, s * 0.98, 0.42, 0.1, m);
    B(r.yaw, 0.24, 0.42, 0.42, STEEL, s * 0.98, 0.42, 0.1, m);
  }

  // 5. Trunnion stanchions & Angled Armor Splinter Shield
  for (const s of [-1, 1]) {
    B(r.yaw, 0.18, 0.75, 0.45, GUNMETAL, s * 0.42, 0.65, 0.1, m);
  }
  const sh = B(r.yaw, 1.85, 1.0, 0.12, OLIVE, 0, 1.05, 0.48, m);
  sh.rotation.x = -0.15;
  B(r.yaw, 0.22, 0.12, 0.16, GUNMETAL, -0.42, 1.25, 0.52, m);
  B(r.yaw, 0.18, 0.06, 0.08, 0x4fa8e0, -0.42, 1.25, 0.58, m, { emissive: 0x0b2a44 });
  B(r.yaw, 0.16, 0.28, 0.28, GUNMETAL, 0.46, 0.75, 0.18, m);

  // 6. Barrel, Recuperator & Muzzle Assembly on recoil pivot
  r.barrel = pivot(r.yaw, 0, 0.95, 0.1);
  r.recoil = pivot(r.barrel, 0, 0, 0);
  r.recoils = [r.recoil];

  B(r.recoil, 0.48, 0.44, 0.7, GUNMETAL, 0, 0, -0.25, m);
  B(r.recoil, 0.38, 0.22, 1.4, STEEL, 0, 0.24, 0.5, m);
  B(r.recoil, 0.32, 0.16, 0.6, CHROME, 0, 0.24, 1.3, m);
  B(r.recoil, 0.26, 0.26, 2.7, OLIVE, 0, 0, 1.2, m);
  B(r.recoil, 0.42, 0.34, 0.45, STEEL, 0, 0, 2.65, m);
  const mz = B(r.recoil, 0.55, 0.55, 0.55, 0xffc860, 0, 0, 2.95, m, { emissive: 0xff8a00 });
  mz.castShadow = false;
  r.muzzle = mz;
  r.muzzles = [mz];

  // 7. Field Clutter: Open ammo box with ready shell
  B(r.yaw, 0.45, 0.25, 0.6, DARK_OLIVE, -0.75, 0.22, -0.45, m);
  B(r.yaw, 0.12, 0.12, 0.45, 0xc9a050, -0.75, 0.32, -0.45, m);

  r.rest = -0.45;
  r.barrel.rotation.x = r.rest;
  r.scaffold = scaffold(r.body, 1.45, 2.3, m);
  r.barY = 2.4;
  return finishStructure(r);
}

/** Howitzer Lv 2: Heavy Howitzer with reinforced shield wings, dual hydraulic buffers, and ready shell rack. */
function buildHeavyHowitzer(r, m) {
  const OLIVE = 0x3d4b30, DARK_OLIVE = 0x2a3520, STEEL = 0x34373d, GUNMETAL = 0x1e2024, SAND = 0xa8956a, CHROME = 0x9aa2ac, BRASS = 0xc9a050;
  // 1. Reinforced concrete pad with corner sandbag bastions
  B(r.body, 3.2, 0.16, 3.2, 0x82868c, 0, 0.08, 0, m);
  for (let k = -1; k <= 1; k += 2) {
    B(r.body, 0.8, 0.4, 0.5, SAND, k * 1.25, 0.28, -1.25, m);
    B(r.body, 0.5, 0.4, 0.8, SAND, -1.25, 0.28, k * 1.25, m);
    B(r.body, 0.5, 0.4, 0.8, SAND, 1.25, 0.28, k * 1.25, m);
  }

  // 2. Heavy Turntable Bearing Ring
  r.yaw = pivot(r.body, 0, 0.16, 0);
  B(r.yaw, 1.9, 0.16, 1.9, GUNMETAL, 0, 0.08, 0, m);
  B(r.yaw, 2.0, 0.06, 2.0, STEEL, 0, 0.16, 0, m);

  // 3. Heavy Box-Girder Split Trail with Serrated Outrigger Spades
  for (const s of [-1, 1]) {
    const leg = B(r.yaw, 0.24, 0.22, 2.0, DARK_OLIVE, s * 0.52, 0.34, -0.95, m);
    leg.rotation.y = s * 0.32;
    B(r.yaw, 0.46, 0.26, 0.34, STEEL, s * 0.88, 0.18, -1.9, m);
    B(r.yaw, 0.12, 0.42, 0.12, GUNMETAL, s * 0.88, 0.28, -1.9, m);
  }

  // 4. Heavy military run-flat wheels with lug hubs
  B(r.yaw, 2.1, 0.18, 0.18, GUNMETAL, 0, 0.46, 0.1, m);
  for (const s of [-1, 1]) {
    B(r.yaw, 0.26, 0.95, 0.95, 0x181a1d, s * 1.1, 0.46, 0.1, m);
    B(r.yaw, 0.28, 0.48, 0.48, STEEL, s * 1.1, 0.46, 0.1, m);
    B(r.yaw, 0.30, 0.20, 0.20, DARK_OLIVE, s * 1.1, 0.46, 0.1, m);
  }

  // 5. Heavy Armored Crew Splinter Shield with Side Wing Mantlets
  for (const s of [-1, 1]) {
    B(r.yaw, 0.22, 0.85, 0.5, GUNMETAL, s * 0.45, 0.72, 0.1, m);
  }
  const sh = B(r.yaw, 2.1, 1.15, 0.16, OLIVE, 0, 1.2, 0.55, m);
  sh.rotation.x = -0.14;
  for (const s of [-1, 1]) {
    const wing = B(r.yaw, 0.48, 0.95, 0.12, DARK_OLIVE, s * 1.22, 1.15, 0.45, m);
    wing.rotation.y = -s * 0.45;
  }
  B(r.yaw, 0.26, 0.16, 0.2, GUNMETAL, -0.5, 1.38, 0.58, m);
  B(r.yaw, 0.20, 0.08, 0.08, 0x4fa8e0, -0.5, 1.38, 0.66, m, { emissive: 0x0b2a44 });
  B(r.yaw, 0.38, 0.32, 0.18, 0x22252a, 0.55, 0.9, 0.25, m);
  B(r.yaw, 0.28, 0.18, 0.04, 0x3ae35f, 0.55, 0.92, 0.35, m, { emissive: 0x168a28 });

  // 6. Heavy Barrel, Dual-Cylinder Recuperator & Double-Baffle Muzzle Brake
  r.barrel = pivot(r.yaw, 0, 1.05, 0.15);
  r.recoil = pivot(r.barrel, 0, 0, 0);
  r.recoils = [r.recoil];

  B(r.recoil, 0.56, 0.52, 0.85, GUNMETAL, 0, 0, -0.28, m);
  B(r.recoil, 0.38, 0.24, 1.6, STEEL, 0, 0.32, 0.6, m);
  B(r.recoil, 0.30, 0.18, 0.7, CHROME, 0, 0.32, 1.5, m);
  B(r.recoil, 0.34, 0.20, 1.4, STEEL, 0, -0.30, 0.5, m);
  B(r.recoil, 0.34, 0.34, 1.2, DARK_OLIVE, 0, 0, 0.5, m);
  B(r.recoil, 0.30, 0.30, 2.6, OLIVE, 0, 0, 1.8, m);
  B(r.recoil, 0.50, 0.38, 0.55, STEEL, 0, 0, 3.2, m);
  const mz = B(r.recoil, 0.65, 0.65, 0.65, 0xffc860, 0, 0, 3.55, m, { emissive: 0xff8a00 });
  mz.castShadow = false;
  r.muzzle = mz;
  r.muzzles = [mz];

  // 7. Tactical Ready-Use Shell Carrier with 2 brass shells
  B(r.yaw, 0.35, 0.45, 0.7, DARK_OLIVE, -0.85, 0.32, -0.4, m);
  for (const z of [-0.55, -0.25]) {
    B(r.yaw, 0.14, 0.14, 0.5, BRASS, -0.85, 0.46, z, m);
    B(r.yaw, 0.12, 0.12, 0.15, STEEL, -0.85, 0.46, z + 0.26, m);
  }

  r.rest = -0.45;
  r.barrel.rotation.x = r.rest;
  r.scaffold = scaffold(r.body, 1.65, 2.5, m);
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
// Archer Tower: 8 looks — Lv1 timber tower, Lv2 Stone Watchtower, A3 Longbow Tower, A4 Ballista Tower, A5 Skypiercer,
// B3 Twin Archers, B4 Fire Archers, B5 Arrow Storm Spire.
export function buildArcherTower(level = 1, path = null) {
  const r = structureRig(), m = r.mats;
  const L = level, A = L >= 3 && path === 'a', Bp = L >= 3 && path === 'b';
  const STONE = 0x8d8f93, DSTONE = 0x74767b, WOOD = 0x6b4a2b, DWOOD = 0x5e4026, ROOF = [0x6b2a24, 0x7d3129, 0x8e3a30];
  // platform height and half-width per design
  const top = A ? (L >= 5 ? 6.2 : L >= 4 ? 5.2 : 5.8) : Bp ? (L >= 5 ? 6.6 : 4.8) : L >= 2 ? 4.6 : 4.4;
  const hw = Bp ? (L >= 5 ? 1.5 : 1.55) : A && L >= 5 ? 1.5 : 1.35;
  B(r.body, hw * 2 - 0.3, 0.9, hw * 2 - 0.3, STONE, 0, 0.45, 0, m);                                   // footing
  if (L === 1) {   // timber legs + cross braces
    for (const [x, z] of [[-0.95, -0.95], [-0.95, 0.95], [0.95, -0.95], [0.95, 0.95]]) B(r.body, 0.32, top - 1, 0.32, WOOD, x, (top - 1) / 2 + 0.9, z, m);
    for (const y of [1.6, 3]) for (const s of [-1, 1]) { B(r.body, 2.2, 0.14, 0.14, DWOOD, 0, y, s * 0.95, m); B(r.body, 0.14, 0.14, 2.2, DWOOD, s * 0.95, y, 0, m); }
  } else {         // stone shaft (Lv2+): taller designs get a tapering keep
    const sw = A && L >= 5 ? 2.6 : Bp && L >= 5 ? 2.2 : 2.1;
    B(r.body, sw, top - 0.9, sw, A && L >= 5 ? DSTONE : STONE, 0, (top - 0.9) / 2 + 0.9, 0, m);
    for (let y = 1.4; y < top - 0.4; y += 0.9) for (const s of [-1, 1]) { B(r.body, sw + 0.02, 0.1, 0.5, DSTONE, 0, y, s * 0.4, m); }   // brick lines
    B(r.body, 0.5, 0.9, 0.1, 0x1a1a22, 0, top * 0.55, sw / 2 + 0.02, m);                                  // arrow slit
    if (Bp && L >= 5) for (const s of [-1, 1]) B(r.body, 0.25, top - 1.2, 0.25, 0xa3221c, s * (sw / 2 + 0.1), (top - 1.2) / 2 + 1, sw / 2 + 0.1, m);   // crimson pilasters
  }
  B(r.body, hw * 2, 0.25, hw * 2, L >= 2 ? DSTONE : 0x7a5532, 0, top, 0, m);                          // platform
  // parapet: wooden rail (Lv1), stone merlons (Lv2+)
  if (L === 1) for (const s of [-1, 1]) { B(r.body, hw * 2, 0.55, 0.14, WOOD, 0, top + 0.4, s * (hw - 0.07), m); B(r.body, 0.14, 0.55, hw * 2, WOOD, s * (hw - 0.07), top + 0.4, 0, m); }
  else for (let k = -1; k <= 1; k += 2) for (const t of [-0.66, 0.66]) {
    B(r.body, 0.5, 0.6, 0.3, STONE, t * hw, top + 0.42, k * (hw - 0.15), m);
    B(r.body, 0.3, 0.6, 0.5, STONE, k * (hw - 0.15), top + 0.42, t * hw, m);
  }
  // roof (not on ballista designs: the bolt needs the sky)
  const roofY = top + (Bp && L >= 5 ? 2.4 : 1.8);
  if (!(A && L >= 4)) {
    for (const [x, z] of [[-hw + 0.15, -hw + 0.15], [-hw + 0.15, hw - 0.15], [hw - 0.15, -hw + 0.15], [hw - 0.15, hw - 0.15]]) B(r.body, 0.18, roofY - top, 0.18, DWOOD, x, (roofY + top) / 2, z, m);
    const rc = Bp && L >= 4 ? [0x8a1a1a, 0xa3221c, 0xc0302a] : A ? [0x2a3a5a, 0x34486e, 0x3e5682] : ROOF;   // path A: blue slate
    B(r.body, hw * 2 + 0.3, 0.25, hw * 2 + 0.3, rc[0], 0, roofY, 0, m);
    B(r.body, hw * 1.4, 0.35, hw * 1.4, rc[1], 0, roofY + 0.3, 0, m);
    B(r.body, hw * 0.6, 0.35, hw * 0.6, rc[2], 0, roofY + 0.65, 0, m);
    if ((Bp && L >= 5) || A) { B(r.body, hw * 0.3, 1.2, hw * 0.3, rc[2], 0, roofY + 1.4, 0, m); B(r.body, 0.12, 0.8, 0.12, 0xe0b040, 0, roofY + 2.4, 0, m, { emissive: 0x3a2800 }); }   // spire
  }
  if (L >= 2) {   // banner on the shaft
    const bc = Bp ? 0xa3221c : A ? 0x2a4a8a : 0xa3221c;
    B(r.body, 0.08, 1.4, 0.8, bc, (A && L >= 5 ? 1.32 : 1.07), top - 1.2, 0, m);
    B(r.body, 0.1, 0.4, 0.3, 0xe0b040, (A && L >= 5 ? 1.34 : 1.09), top - 1, 0, m);
  }
  if (Bp && L >= 4) for (const [sx, sz] of [[-1, -1], [1, -1], [-1, 1], [1, 1]]) {   // Fire Archers: a big brazier on every corner
    B(r.body, 0.45, 0.6, 0.45, 0x3a3a3a, sx * (hw - 0.05), top + 0.42, sz * (hw - 0.05), m);
    B(r.body, 0.6, 0.12, 0.6, 0x4a4a4a, sx * (hw - 0.05), top + 0.75, sz * (hw - 0.05), m);
    const f = B(r.body, 0.5, 0.45, 0.5, 0xffb040, sx * (hw - 0.05), top + 1, sz * (hw - 0.05), m, { emissive: 0xff6a00 }); f.castShadow = false;
  }
  r.yaw = pivot(r.body, 0, top + 0.12, 0);
  // crew: archers (or a ballista)
  const archers = (n) => {
    const spots = n === 1 ? [[0, 0]] : n === 2 ? [[-0.5, 0]] : n === 3 ? [[-0.65, -0.2], [0.65, -0.2]] : [[-0.7, -0.35], [0.7, -0.35], [0, -0.7]];
    addCrew(r, buildArcher(), 0, n === 1 ? 0 : 0.25, 0.85);
    if (n > 1) r.crew.root.position.x = n === 2 ? 0.5 : 0;
    r.crew.armL.rotation.x = -1.4; r.crew.armR.rotation.x = -1.3; levelCrew(r.crew);
    for (const [x, z] of n > 1 ? spots : []) {
      const c = buildArcher(); c.root.scale.setScalar(0.85); c.root.position.set(x, 0, z); r.yaw.add(c.root);
      c.armL.rotation.x = -1.4; c.armR.rotation.x = -1.3; levelCrew(c);
      c.matList.forEach((mt, i) => r.mats.set('crew' + x + z + i, mt));
    }
    if (A && L === 3) { r.crew.root.scale.setScalar(0.95); B(r.yaw, 0.08, 2.2, 0.08, 0x5e4026, 0.42, 1.3, 0.35, m); }   // longbow: a tall bow stave
  };
  if (A && L >= 4) {   // ballista: frame, bow arms, a bolt; the barrel pivot elevates it
    const big = L >= 5;
    B(r.yaw, big ? 1.4 : 1, 0.5, big ? 1.4 : 1, big ? 0x3a3d42 : DWOOD, 0, 0.25, 0, m);                  // turntable
    r.barrel = pivot(r.yaw, 0, big ? 1 : 0.8, 0); r.recoil = pivot(r.barrel, 0, 0, 0);
    const len = big ? 3 : 2.2, metal = big ? 0x4a4e54 : WOOD;
    B(r.recoil, big ? 0.5 : 0.35, big ? 0.35 : 0.25, len, metal, 0, 0, len / 2 - 0.6, m);                // stock
    for (const s of [-1, 1]) {
      const arm = B(r.recoil, big ? 1.6 : 1.1, big ? 0.2 : 0.14, 0.18, big ? 0x2a2d32 : DWOOD, s * (big ? 0.85 : 0.6), 0.05, len - 1, m); arm.rotation.y = -s * 0.35;   // bow arms
    }
    B(r.recoil, 0.05, 0.05, big ? 1.4 : 1, 0xd8d8d0, 0, 0.12, len - 1.5, m);                            // string
    B(r.recoil, 0.12, 0.12, len + 0.3, 0x8a6a42, 0, 0.22, len / 2 - 0.4, m);                            // bolt shaft
    B(r.recoil, 0.22, 0.22, 0.35, big ? 0xc9a050 : 0x9aa3ab, 0, 0.22, len - 0.15, m);                 // bolt head
    if (big) for (const s of [-1, 1]) B(r.recoil, 0.12, 0.6, 0.6, 0xc9a050, s * 0.3, -0.1, -0.3, m);   // gold winch plates
    r.muzzle = B(r.recoil, 0.2, 0.2, 0.2, 0xffffff, 0, 0.22, len, m);
    r.rest = -0.08;
    r.muzzleY = top + 0.12 + (big ? 1 : 0.8);
  } else {
    archers(Bp ? (L >= 5 ? 4 : L >= 4 ? 3 : 2) : 1);
    r.muzzle = B(r.yaw, 0.1, 0.1, 0.1, 0xffffff, 0, 1.4, 0.6, m);
    r.muzzleY = top + 0.12 + 1.4;
  }
  r.muzzle.castShadow = false;
  r.scaffold = scaffold(r.body, hw + 0.05, top + 0.2, m);
  r.barY = roofY + (Bp && L >= 5 ? 3 : 1.2);
  return finishStructure(r);
}
// Sniper Tower: 8 looks — Lv1 steel watchtower, Lv2 Reinforced Overwatch, A3 Marksman Post, A4 Anti-Materiel Nest,
// A5 Deadeye Sentinel, B3 Spotter Team, B4 Suppression Team, B5 Drone Command.
export function buildSniperTower(level = 1, path = null) {
  const r = structureRig(), m = r.mats, ST = 0x4a4e54, DK = 0x34373c, OL = 0x5b6b3a, SAND = 0xa8956a;
  const L = level, A = L >= 3 && path === 'a', Bp = L >= 3 && path === 'b';
  const deck = A ? (L >= 5 ? 6.6 : 6.2) : Bp ? 5.4 : 5.2, hw = Bp ? 1.6 : A && L >= 5 ? 1.45 : 1.3;
  B(r.body, hw * 2 - 0.2, 0.3, hw * 2 - 0.2, 0x9a9da2, 0, 0.15, 0, m);                                  // pad
  if (A && L >= 5) {   // Deadeye Sentinel: a concrete column
    B(r.body, 2, deck - 0.3, 2, 0x8a8e94, 0, (deck - 0.3) / 2 + 0.3, 0, m);
    for (let y = 1.2; y < deck - 0.5; y += 1.1) B(r.body, 2.04, 0.08, 2.04, 0x6a6e74, 0, y, 0, m);
  } else {
    const leg = hw - 0.4;
    for (const [x, z] of [[-leg, -leg], [-leg, leg], [leg, -leg], [leg, leg]]) B(r.body, 0.22, deck - 0.2, 0.22, ST, x, deck / 2, z, m);
    for (let y = 1.4; y < deck - 0.6; y += 1.35) for (const s of [-1, 1]) { B(r.body, leg * 2 + 0.2, 0.1, 0.1, DK, 0, y, s * leg, m); B(r.body, 0.1, 0.1, leg * 2 + 0.2, DK, s * leg, y, 0, m); }
    B(r.body, 0.12, deck - 0.6, 0.5, DK, -leg, deck / 2 - 0.2, 0, m);                                       // ladder rail
    if (L >= 2) for (const s of [-1, 1]) B(r.body, leg * 2 + 0.3, 1.6, 0.08, OL, 0, 1.2, s * (leg + 0.1), m);   // armored skirt
  }
  B(r.body, hw * 2, 0.25, hw * 2, 0x5a5e64, 0, deck, 0, m);                                                 // deck
  // parapet: thin steel (Lv1), sandbags (Lv2+), heavy plates (path A 4+)
  for (const s of [-1, 1]) {
    if (L === 1) { B(r.body, hw * 2, 0.7, 0.1, 0x3a3d42, 0, deck + 0.45, s * (hw - 0.05), m); B(r.body, 0.1, 0.7, hw * 2, 0x3a3d42, s * (hw - 0.05), deck + 0.45, 0, m); }
    else if (A && L >= 4) { B(r.body, hw * 2, 0.9, 0.18, DK, 0, deck + 0.55, s * (hw - 0.09), m); B(r.body, 0.18, 0.9, hw * 2, DK, s * (hw - 0.09), deck + 0.55, 0, m); }
    else for (let k = -1; k <= 1; k++) { B(r.body, hw * 0.62, 0.4, 0.45, SAND, k * hw * 0.64, deck + 0.33, s * (hw - 0.22), m); B(r.body, 0.45, 0.4, hw * 0.62, SAND, s * (hw - 0.22), deck + 0.33, k * hw * 0.64, m); }
  }
  // roof: camo net (A), steel canopy (B), plain net (Lv1-2)
  const roofY = deck + (A && L >= 5 ? 2.1 : 1.9);
  for (const [x, z] of [[-hw + 0.1, -hw + 0.1], [-hw + 0.1, hw - 0.1], [hw - 0.1, -hw + 0.1], [hw - 0.1, hw - 0.1]]) B(r.body, 0.1, roofY - deck, 0.1, ST, x, (roofY + deck) / 2, z, m);
  B(r.body, hw * 2 + 0.3, 0.15, hw * 2 + 0.3, A ? 0x3e4a2c : Bp ? 0x3a3d42 : 0x4a5a3a, 0, roofY, 0, m);
  if (A) for (let k = 0; k < 6; k++) B(r.body, 0.5, 0.3, 0.5, [0x4a5a3a, 0x5b6b3a, 0x3a4a2a][k % 3], -hw + 0.4 + (k % 3) * hw * 0.7, roofY + 0.18, (k < 3 ? -1 : 1) * hw * 0.45, m);   // ghillie tufts
  if (L >= 2 && !(A && L >= 4)) {   // searchlight on the roof edge
    B(r.body, 0.35, 0.35, 0.45, DK, hw - 0.2, roofY + 0.25, hw - 0.2, m);
    const sl = B(r.body, 0.28, 0.28, 0.06, 0xfff4c0, hw - 0.2, roofY + 0.25, hw + 0.04, m, { emissive: 0xfff0a0 }); sl.castShadow = false;
  }
  if (Bp && L >= 5) {   // Drone Command: radio mast + drone pad with a parked drone
    B(r.body, 0.12, 3.2, 0.12, ST, -hw + 0.2, roofY + 1.6, -hw + 0.2, m);
    B(r.body, 0.8, 0.08, 0.08, ST, -hw + 0.2, roofY + 2.6, -hw + 0.2, m);
    const blink = B(r.body, 0.2, 0.2, 0.2, 0xff2020, -hw + 0.2, roofY + 3.25, -hw + 0.2, m, { emissive: 0xff0000 }); blink.castShadow = false; r.blink = blink;
    B(r.body, 1.3, 0.08, 1.3, 0x2a2d32, 0.1, roofY + 0.12, 0.1, m);
    B(r.body, 0.9, 0.06, 0.12, 0xf2c94c, 0.1, roofY + 0.18, 0.1, m);
    const dr = pivot(r.body, 0.1, roofY + 0.3, 0.1);
    B(dr, 0.5, 0.2, 0.5, 0x3a3d42, 0, 0, 0, m);
    for (const [x, z] of [[-0.4, -0.4], [-0.4, 0.4], [0.4, -0.4], [0.4, 0.4]]) { B(dr, 0.05, 0.05, 0.3, ST, x / 2, 0, z / 2, m); B(dr, 0.4, 0.03, 0.08, 0x8a8f96, x, 0.12, z, m); }
  }
  r.yaw = pivot(r.body, 0, deck + 0.13, 0);
  const crewPose = (c) => { c.armR.rotation.x = -1.35; c.armL.rotation.x = -1.45; c.armL.rotation.z = 0.35; levelCrew(c); };
  if (A && L >= 4) {   // mounted heavy rifle (+ gunner behind it)
    const big = L >= 5;
    B(r.yaw, 0.5, 0.6, 0.5, DK, 0, 0.3, 0.3, m);
    r.barrel = pivot(r.yaw, 0, 0.75, 0.3); r.recoil = pivot(r.barrel, 0, 0, 0);
    B(r.recoil, 0.32, 0.32, 1.1, 0x2a2d32, 0, 0, -0.1, m);                                               // receiver
    B(r.recoil, 0.12, 0.12, big ? 2.6 : 2, 0x1e2024, 0, 0, big ? 1.5 : 1.2, m);                           // barrel
    B(r.recoil, 0.28, 0.22, 0.3, ST, 0, 0, big ? 2.85 : 2.25, m);                                         // muzzle brake
    B(r.recoil, 0.16, 0.16, 0.6, 0x1a1a22, 0, 0.27, 0.1, m);                                              // scope
    const lens = B(r.recoil, 0.12, 0.12, 0.04, big ? 0xff3020 : 0x4fa8e0, 0, 0.27, 0.42, m, { emissive: big ? 0xaa1000 : 0x0b2a44 }); lens.castShadow = false;
    for (const s of [-1, 1]) { const bp = B(r.recoil, 0.06, 0.5, 0.06, ST, s * 0.15, -0.25, 1, m); bp.rotation.z = s * 0.3; }   // bipod
    r.muzzle = B(r.recoil, 0.4, 0.4, 0.4, 0xfff0b0, 0, 0, big ? 3.15 : 2.55, m, { emissive: 0xffd040 });
    const gn = addCrew(r, buildSniper(), 0, -0.75, 0.85); crewPose(gn);
    r.rest = -0.03;
    r.muzzleY = deck + 0.13 + 0.75;
  } else {
    const n = Bp ? (L >= 4 ? 3 : 2) : 1;
    const sn = addCrew(r, buildSniper(), 0, -0.1, 0.85); crewPose(sn);
    if (n >= 2) { sn.root.position.x = 0.45; const sp = buildPolice(); sp.root.scale.setScalar(0.85); sp.root.position.set(-0.55, 0, -0.2); r.yaw.add(sp.root); sp.armR.rotation.x = -1.6; sp.armL.rotation.x = -1.6; sp.matList.forEach((mt, i) => r.mats.set('spot' + i, mt));
      B(sp.armR, 0.35, 0.18, 0.2, 0x1a1a22, -0.1, -0.62, 0.15, m); }                                        // spotter with binoculars
    if (n >= 3) { const g2 = buildGunner(); g2.root.scale.setScalar(0.85); g2.root.position.set(0, 0, -0.75); r.yaw.add(g2.root); g2.armR.rotation.x = -1.3; g2.armL.rotation.x = -1.35; levelCrew(g2); g2.matList.forEach((mt, i) => r.mats.set('g2' + i, mt)); }
    r.muzzle = B(r.yaw, 0.35, 0.35, 0.35, 0xfff0b0, n >= 2 ? 0.45 : 0, 1.45, 1.5, m, { emissive: 0xffd040 });
    r.muzzleY = deck + 0.13 + 1.45;
    if (Bp && L >= 4) {   // Suppression Team / Drone Command: tripod machine gun up front, a second sandbag course, striped canopy edge
      B(r.yaw, 0.1, 0.6, 0.1, DK, -0.3, 0.3, 0.9, m);
      B(r.yaw, 0.26, 0.22, 0.7, 0x2a2d32, -0.3, 0.68, 1.05, m);
      B(r.yaw, 0.1, 0.1, 0.9, 0x1e2024, -0.3, 0.68, 1.75, m);
      B(r.yaw, 0.16, 0.2, 0.25, OL, -0.12, 0.62, 0.95, m);
      for (const s2 of [-1, 1]) B(r.body, hw * 2, 0.35, 0.45, SAND, 0, deck + 0.7, s2 * (hw - 0.22), m);
      for (let k = 0; k < 8; k++) B(r.body, hw * 2 / 8, 0.1, 0.06, k % 2 ? 0x1a1a1a : 0xf2c94c, -hw + (k + 0.5) * hw * 2 / 8, roofY - 0.1, hw + 0.16, m);
    }
  }
  r.muzzle.castShadow = false;
  r.scaffold = scaffold(r.body, hw + 0.05, deck + 0.1, m);
  r.barY = roofY + (Bp && L >= 5 ? 3.6 : 1);
  return finishStructure(r);
}
// Hwacha: 8 looks — Lv1 rocket cart, Lv2 Iron-Banded Hwacha, A3 Daesingijeon Rack, A4 Fire Dragon Rack,
// A5 Thunder Rocket Battery, B3 Twin Hwacha, B4 Munjong Hwacha, B5 Whirlwind Battery.
// Every launcher frame sits in the one `barrel` pivot (they tilt together); each frame has its own flash in `muzzles`.
export function buildHwacha(level = 1, path = null) {
  const r = structureRig(), m = r.mats;
  const L = level, A = L >= 3 && path === 'a', Bp = L >= 3 && path === 'b';
  const WOOD = 0x7a5532, DWOOD = 0x5e4026, CART = 0x6b4a2b, WHEEL = 0x4a3520, IRON = 0x3a3d42, BRONZE = 0xb08a3a, RED = 0x8a2a1c, TUBE = 0x2a1d12, TIP = 0xc9a050;
  const stone = A && L >= 5, ph = stone ? 1.2 : 0.9, pw = Bp ? 3.2 : L >= 2 ? 2.8 : 2.6;
  B(r.body, pw, ph, pw, stone ? 0x8d8f93 : WOOD, 0, ph / 2, 0, m);                                     // firing platform
  if (stone) for (let y = 0.35; y < ph - 0.1; y += 0.4) B(r.body, pw + 0.02, 0.06, pw + 0.02, 0x74767b, 0, y, 0, m);   // stone courses
  for (const s of [-1, 1]) {
    B(r.body, pw, 0.18, 0.18, L >= 2 ? IRON : DWOOD, 0, ph + 0.05, s * (pw / 2 - 0.1), m);            // rails (iron-banded from Lv 2)
    if (L >= 2) B(r.body, 0.18, 0.18, pw, IRON, s * (pw / 2 - 0.1), ph + 0.05, 0, m);
  }
  if (A && L >= 4) for (const [sx, sz] of [[-1, -1], [1, -1]]) {   // Fire Dragon / Thunder: braziers on the back corners
    B(r.body, 0.4, 0.5, 0.4, IRON, sx * (pw / 2 - 0.3), ph + 0.25, sz * (pw / 2 - 0.3), m);
    const f = B(r.body, 0.34, 0.35, 0.34, 0xffb040, sx * (pw / 2 - 0.3), ph + 0.62, sz * (pw / 2 - 0.3), m, { emissive: 0xff6a00 }); f.castShadow = false;
  }
  if (stone) for (const sx of [-1, 1]) {   // Thunder Rocket Battery: war banners
    B(r.body, 0.1, 2.6, 0.1, DWOOD, sx * (pw / 2 - 0.2), ph + 1.3, pw / 2 - 0.2, m);
    B(r.body, 0.06, 0.9, 0.7, sx < 0 ? 0x2a4a8a : RED, sx * (pw / 2 - 0.2), ph + 2.1, pw / 2 - 0.6, m);
  }
  if (Bp && L >= 5) {   // Whirlwind Battery: two launchers on an iron turntable
    r.yaw = pivot(r.body, 0, ph, 0);
    B(r.yaw, 2.4, 0.22, 2.4, IRON, 0, 0.11, 0, m); B(r.yaw, 2.4, 0.22, 2.4, IRON, 0, 0.11, 0, m).rotation.y = Math.PI / 4;   // octagonal plate
    r.radar = pivot(r.yaw, 0, 0.22, -0.9);   // spinning pennant mast between the launchers
    B(r.radar, 0.1, 2.2, 0.1, DWOOD, 0, 1.1, 0, m);
    B(r.radar, 0.7, 0.4, 0.05, RED, 0.38, 1.9, 0, m);
    B(r.radar, 0.05, 0.4, 0.7, 0xe0b040, 0, 1.5, 0.38, m);
    B(r.yaw, 0.45, 0.8, 0.45, IRON, 0, 0.6, 0, m); B(r.yaw, 2.4, 0.2, 0.3, DWOOD, 0, 0.92, 0, m);   // launcher post + cross beam
  } else r.yaw = pivot(r.body, 0, ph, 0);
  r.barrel = pivot(r.yaw, 0, Bp && L >= 5 ? 0.95 : 0.75, 0);
  r.recoil = pivot(r.barrel, 0, 0, 0);
  /** One cart (on the yaw) + its tube frame (in the recoil). big = Singijeon tubes. */
  const launcher = (x, cols, rows, o = {}) => {
    const big = o.big, sp = big ? 0.42 : 0.25, sz = big ? 0.3 : 0.16, fw = cols * sp + 0.3, fh = rows * sp + 0.15, len = big ? 1.3 : 0.9;
    if (!o.noCart) {
      B(r.yaw, Math.max(0.9, fw * 0.7), 0.18, 2.2, CART, x, 0.45, -0.2, m);                                // cart bed
      for (const s of [-1, 1]) {
        B(r.yaw, 0.12, 0.12, 1.6, DWOOD, x + s * 0.35, 0.4, -1.3, m);                                        // shafts
        B(r.yaw, 0.14, 0.9, 0.9, L >= 2 ? IRON : WHEEL, x + s * (Math.max(0.45, fw * 0.35) + 0.12), 0.45, 0, m);   // wheels
      }
    }
    const front = 0.1 + len / 2;
    B(r.recoil, fw, fh, len, o.frame || WOOD, x, fh / 2, 0.1, m);                                           // tube frame
    if (L >= 2) for (const y of [0.05, fh - 0.05]) B(r.recoil, fw + 0.04, 0.08, len + 0.04, o.band || IRON, x, y, 0.1, m);   // iron bands
    for (let i = 0; i < cols; i++) for (let j = 0; j < rows; j++) {
      const tx = x - (cols - 1) * sp / 2 + i * sp, ty = 0.1 + sp / 2 + j * sp;
      B(r.recoil, sz, sz, 0.35, TUBE, tx, ty, front + 0.05, m);                                               // tube mouths
      if (cols * rows <= 32) B(r.recoil, sz * 0.45, sz * 0.45, 0.14, o.tip || TIP, tx, ty, front + 0.26, m, o.tip ? { emissive: 0xff5a00 } : undefined);   // arrow tips
    }
    if (cols * rows > 32) for (let j = 0; j < rows; j++) B(r.recoil, fw - 0.2, 0.05, 0.12, TIP, x, 0.1 + sp / 2 + j * sp, front + 0.24, m);   // a row of tips
    const mz = B(r.recoil, fw, fh, 0.3, 0xffb040, x, fh / 2, front + 0.4, m, { emissive: 0xff6a00 }); mz.castShadow = false;
    r.muzzles.push(mz);
    return { fw, fh, front };
  };
  if (Bp && L >= 5) { launcher(-0.75, 4, 4, { noCart: true, frame: RED }); launcher(0.75, 4, 4, { noCart: true, frame: RED }); }
  else if (Bp && L >= 4) {   // Munjong Hwacha: one wide hundred-arrow frame on a long cart
    const f = launcher(0, 10, 5, { frame: 0x6b2a24, band: BRONZE });
    for (const s of [-1, 1]) B(r.yaw, 0.14, 0.9, 0.9, IRON, s * 0.75, 0.45, -1, m);                        // second axle
    B(r.recoil, f.fw + 0.3, 0.12, 0.3, BRONZE, 0, f.fh + 0.06, f.front - 0.1, m);                             // bronze cap
  } else if (Bp) { launcher(-0.75, 4, 4); launcher(0.75, 4, 4); }                                             // Twin Hwacha
  else if (A) {
    const f = launcher(0, L >= 5 ? 4 : 3, 2, { big: true, frame: L >= 4 ? RED : WOOD, band: L >= 5 ? BRONZE : IRON, tip: L >= 4 ? 0xff8a2a : null });
    if (L >= 4) {   // Fire Dragon: a dragon head on the front of the cart
      B(r.yaw, 0.55, 0.45, 0.55, RED, 0, 0.6, 1.15, m);
      B(r.yaw, 0.4, 0.22, 0.4, RED, 0, 0.5, 1.55, m);                                                          // snout
      for (const s of [-1, 1]) {
        B(r.yaw, 0.1, 0.1, 0.06, 0xffe27a, s * 0.18, 0.72, 1.44, m, { emissive: 0xaa6a00 });                 // eyes
        B(r.yaw, 0.08, 0.35, 0.08, TIP, s * 0.2, 0.95, 1.0, m).rotation.x = -0.5;                              // horns
      }
    }
    if (L >= 5) B(r.recoil, f.fw + 0.2, 0.15, f.front + 0.6, BRONZE, 0, f.fh + 0.08, 0.1, m);               // bronze lid
  } else {
    launcher(0, L >= 2 ? 6 : 5, 4);
    if (L >= 2) for (const s of [-1, 1]) B(r.yaw, 0.12, 1, 1, DWOOD, s * 1.05, 0.95, 0.35, m);              // wooden mantlets
  }
  r.muzzle = r.muzzles[0];
  r.barrel.rotation.x = -0.55; r.rest = -0.55;
  r.muzzleY = (Bp && L >= 5 ? 2.4 : 2.2) + (stone ? 0.3 : 0);
  r.scaffold = scaffold(r.body, pw / 2 + 0.15, 2.4 + (stone ? 0.3 : 0), m);
  r.barY = 3.1 + (A ? 0.3 : 0) + (stone ? 0.6 : 0);
  return finishStructure(r);
}
// Machine Gun Nest: 8 looks — Lv1 sandbag bunker, Lv2 Fortified Pillbox, A3 Heavy MG Post, A4 Twin .50 Bunker,
// A5 Autocannon Bunker, B3 Gatling Nest, B4 Minigun Nest, B5 Vulcan CIWS. Rotary barrels spin while firing (`spins`).
export function buildMgNest(level = 1, path = null) {
  const r = structureRig(), m = r.mats, OL = 0x5b6b3a, SAND = 0xa8956a, GUN = 0x2a2d32, DGUN = 0x1e2024, STEEL = 0x4a4e54;
  const L = level, A = L >= 3 && path === 'a', Bp = L >= 3 && path === 'b', ciws = Bp && L >= 5, auto = A && L >= 5;
  const w = L >= 2 ? 3 : 2.8, h = auto ? 2.5 : L >= 2 ? 2.3 : 2.2, CON = ciws ? 0xb8bcc2 : 0x9a9da2;
  B(r.body, w, h, w, CON, 0, h / 2, 0, m);                                                                    // bunker
  B(r.body, w + 0.1, 0.15, w + 0.1, ciws ? 0x9a9ea4 : 0x7a7e84, 0, h + 0.07, 0, m);                          // roof slab
  B(r.body, 0.1, 0.35, 1.6, 0x1a1a22, w / 2 + 0.02, h * 0.68, 0, m);                                          // firing slit
  if (L >= 2) {
    for (const [x, z, sw, sd] of [[-(w / 2 + 0.02), 0, 0.1, 1.2], [0, w / 2 + 0.02, 1.2, 0.1], [0, -(w / 2 + 0.02), 1.2, 0.1]]) B(r.body, sw, 0.3, sd, 0x1a1a22, x, h * 0.68, z, m);
    const gl = B(r.body, 0.06, 0.18, 1.3, 0x4fa8e0, w / 2 + 0.06, h * 0.68, 0, m, { emissive: 0x0b2a44 }); gl.castShadow = false;   // ballistic glass
    for (const s of [-1, 1]) {   // sloped armor skirts
      B(r.body, w + 0.4, 0.7, 0.3, 0x8a8e94, 0, 0.3, s * (w / 2 + 0.1), m).rotation.x = s * 0.35;
      B(r.body, 0.3, 0.7, w + 0.4, 0x8a8e94, s * (w / 2 + 0.1), 0.3, 0, m).rotation.z = -s * 0.35;
    }
  }
  if (auto) for (const s of [-1, 1]) for (const [y, c] of [[0.9, OL], [1.6, 0x3a4a2a]]) B(r.body, w + 0.04, 0.35, 0.8, c, 0, y, s * 0.6, m);   // camo bands
  if (Bp && L >= 4) for (let k = 0; k < 8; k++) B(r.body, w / 8, 0.12, w + 0.06, k % 2 ? 0x1a1a1a : 0xf2c94c, -w / 2 + (k + 0.5) * w / 8, h - 0.12, 0, m);   // hazard stripes
  if (ciws) for (const s of [-1, 1]) { B(r.body, w, 0.08, 0.08, 0xd8dce0, 0, h + 0.55, s * (w / 2 - 0.05), m); B(r.body, 0.08, 0.08, w, 0xd8dce0, s * (w / 2 - 0.05), h + 0.55, 0, m); }   // railing
  else if (auto) for (const s of [-1, 1]) { B(r.body, w, 0.3, 0.2, STEEL, 0, h + 0.3, s * (w / 2 - 0.1), m); B(r.body, 0.2, 0.3, w, STEEL, s * (w / 2 - 0.1), h + 0.3, 0, m); }   // steel rim
  else for (const [x, z, sw, sd] of [[0, w / 2 - 0.2, w - 0.2, 0.5], [0, -(w / 2 - 0.2), w - 0.2, 0.5], [w / 2 - 0.2, 0, 0.5, w - 1.2], [-(w / 2 - 0.2), 0, 0.5, w - 1.2]]) B(r.body, sw, 0.45, sd, SAND, x, h + 0.37, z, m);   // sandbag ring
  if (Bp && L >= 4) { B(r.body, 0.7, 0.55, 0.5, OL, -0.6, h + 0.42, -0.8, m); B(r.body, 0.3, 0.12, 0.2, 0xf2c94c, -0.6, h + 0.75, -0.8, m); }   // minigun battery pack
  const yawY = h + 0.15;
  r.yaw = pivot(r.body, 0, yawY, 0);
  r.spins = [];
  /** A rotary barrel cluster (n barrels around radius `rad`) on the recoil; spins while firing. */
  const rotary = (x, y, z, n, rad, len, thick) => {
    const sp = pivot(r.recoil, x, y, z);
    for (let k = 0; k < n; k++) { const a = k / n * Math.PI * 2; B(sp, thick, thick, len, DGUN, Math.cos(a) * rad, Math.sin(a) * rad, len / 2, m); }
    for (const zz of [0.1, len * 0.6, len - 0.05]) B(sp, rad * 2 + thick + 0.04, rad * 2 + thick + 0.04, 0.08, GUN, 0, 0, zz, m);   // clamps
    r.spins.push(sp);
    return z + len;
  };
  const flash = (x, y, z, s = 0.32) => { const f = B(r.recoil, s, s, s, 0xfff3b0, x, y, z, m, { emissive: 0xffd040 }); f.castShadow = false; r.muzzles.push(f); };
  let gunY = 0.8, crew = !(auto || ciws);
  if (ciws) {   // radar dome over a 6-barrel cannon on a white mount
    B(r.yaw, 1.3, 0.5, 1.3, 0xd8dce0, 0, 0.25, 0, m);
    B(r.yaw, 1, 1.1, 1, 0xe8ecf0, 0, 1.3, -0.15, m);                                                          // radome
    B(r.yaw, 0.7, 0.3, 0.7, 0xe8ecf0, 0, 2, -0.15, m);
    r.radar = pivot(r.yaw, 0, 2.15, -0.15);
    B(r.radar, 0.9, 0.35, 0.08, 0x9a9ea4, 0, 0.2, 0.2, m); B(r.radar, 0.08, 0.3, 0.3, 0x9a9ea4, 0, 0.1, 0.05, m);   // spinning search antenna
    gunY = 0.75;
    r.barrel = pivot(r.yaw, 0, gunY, 0.3); r.recoil = pivot(r.barrel, 0, 0, 0);
    B(r.recoil, 0.6, 0.5, 0.6, 0xd8dce0, 0, 0, 0, m);
    const end = rotary(0, 0, 0.3, 6, 0.15, 1.9, 0.08); flash(0, 0, end + 0.15, 0.45);
  } else if (auto) {   // enclosed turret, one thick 20mm barrel
    B(r.yaw, 1.5, 0.9, 1.6, STEEL, 0, 0.45, -0.1, m);
    B(r.yaw, 1.2, 0.2, 1.2, 0x3a3d42, 0, 1, -0.2, m);
    B(r.yaw, 0.3, 0.3, 0.2, 0x4fa8e0, 0.45, 0.75, 0.72, m, { emissive: 0x0b2a44 }).castShadow = false;         // sight
    gunY = 0.5;
    r.barrel = pivot(r.yaw, 0, gunY, 0.7); r.recoil = pivot(r.barrel, 0, 0, 0);
    B(r.recoil, 0.6, 0.55, 0.4, GUN, 0, 0, 0.1, m);                                                            // mantlet
    B(r.recoil, 0.3, 0.3, 0.8, GUN, 0, 0, 0.6, m);                                                             // recoil sleeve
    B(r.recoil, 0.2, 0.2, 2, DGUN, 0, 0, 1.6, m);
    B(r.recoil, 0.36, 0.3, 0.35, STEEL, 0, 0, 2.6, m);                                                         // muzzle brake
    flash(0, 0, 2.95, 0.5);
    for (const s of [-1, 1]) B(r.yaw, 0.35, 0.35, 0.5, OL, s * 0.95, 0.2, -0.6, m);                           // ammo bins
  } else {
    B(r.yaw, L >= 3 ? 0.18 : 0.12, 0.7, L >= 3 ? 0.18 : 0.12, 0x34373c, 0, 0.35, 0.4, m);                    // post
    r.barrel = pivot(r.yaw, 0, gunY, 0.4); r.recoil = pivot(r.barrel, 0, 0, 0);
    if (Bp && L >= 4) {   // twin electric miniguns
      B(r.recoil, 0.9, 0.3, 0.5, GUN, 0, 0, 0, m);
      for (const s of [-1, 1]) { const e = rotary(s * 0.32, 0, 0.2, 6, 0.09, 1.2, 0.05); flash(s * 0.32, 0, e + 0.12); }
      B(r.recoil, 0.25, 0.4, 0.3, OL, 0, -0.3, -0.1, m);                                                       // feed box
    } else if (Bp) {      // crank Gatling
      B(r.recoil, 0.4, 0.34, 0.6, GUN, 0, 0, 0, m);
      const e = rotary(0, 0, 0.3, 6, 0.11, 1.3, 0.06); flash(0, 0, e + 0.15);
      B(r.recoil, 0.06, 0.06, 0.3, STEEL, 0.28, 0, -0.1, m); B(r.recoil, 0.06, 0.25, 0.06, STEEL, 0.32, -0.12, -0.2, m);   // crank
      B(r.recoil, 0.22, 0.3, 0.3, OL, -0.3, 0.05, 0, m);                                                       // ammo can
    } else if (A && L >= 4) {   // twin .50s behind a steel shield
      B(r.recoil, 0.8, 0.34, 0.8, GUN, 0, 0, 0, m);
      for (const s of [-1, 1]) {
        B(r.recoil, 0.15, 0.15, 1.6, DGUN, s * 0.22, 0, 1.15, m);
        B(r.recoil, 0.22, 0.22, 0.3, STEEL, s * 0.22, 0, 0.7, m);                                              // barrel jackets
        flash(s * 0.22, 0, 2.05);
        B(r.recoil, 0.25, 0.3, 0.35, OL, s * 0.55, -0.05, 0, m);                                               // ammo cans
      }
      B(r.yaw, 1.7, 0.8, 0.12, STEEL, 0, 0.95, 0.95, m); for (const s of [-1, 1]) B(r.yaw, 0.12, 0.8, 0.6, STEEL, s * 0.85, 0.95, 0.7, m);   // shield + cheeks
    } else {
      const heavy = A, len = heavy ? 1.6 : 1.1;
      B(r.recoil, heavy ? 0.36 : 0.3, heavy ? 0.34 : 0.28, heavy ? 0.8 : 0.7, GUN, 0, 0, 0, m);               // receiver
      B(r.recoil, heavy ? 0.14 : 0.12, heavy ? 0.14 : 0.12, len, DGUN, 0, 0, 0.3 + len / 2, m);
      if (heavy) { B(r.recoil, 0.22, 0.22, 0.4, STEEL, 0, 0, 0.6, m); B(r.recoil, 0.2, 0.2, 0.15, STEEL, 0, 0, 0.3 + len, m); }   // jacket, flash hider
      B(r.recoil, 0.18, 0.2, 0.25, OL, 0.2, -0.05, 0.1, m);                                                    // ammo box
      if (heavy) B(r.recoil, 0.25, 0.3, 0.35, OL, -0.3, -0.05, 0, m);
      flash(0, 0, 0.45 + len);
      if (L >= 2) B(r.yaw, heavy ? 1.3 : 1, heavy ? 0.7 : 0.5, 0.1, STEEL, 0, heavy ? 0.95 : 0.85, 0.9, m);   // gun shield
    }
  }
  if (crew) { const gn = addCrew(r, buildGunner(), 0, -0.55, 0.8); gn.armR.rotation.x = -1.3; gn.armL.rotation.x = -1.35; levelCrew(gn); }
  r.muzzle = r.muzzles[0];
  r.barrel.rotation.x = -0.05; r.rest = -0.05;
  r.muzzleY = yawY + gunY;
  r.scaffold = scaffold(r.body, w / 2 + 0.1, h + 0.6, m);
  r.barY = ciws ? h + 3 : h + 2.1;
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

/**
 * Creates an animated faction flag with the cloth banner and emblem/stripe grouped together
 * and pivoted directly at the flagpole, so they flap in lockstep without separating.
 */
function addFactionFlag(g, poleX, poleY, poleZ, poleH, flagW, flagH, color, stripeColor = 0xffffff, poleColor = 0xcccccc) {
  B(g, 0.14, poleH, 0.14, poleColor, poleX, poleY + poleH / 2, poleZ, null);
  B(g, 0.22, 0.22, 0.22, 0xe0b040, poleX, poleY + poleH + 0.08, poleZ, null);

  const flagGroup = new THREE.Group();
  const topY = poleY + poleH - 0.2;
  flagGroup.position.set(poleX, topY - flagH / 2, poleZ);

  B(flagGroup, 0.06, flagH, flagW, color, 0, 0, flagW / 2, null);
  if (stripeColor !== null) {
    B(flagGroup, 0.08, flagH * 0.3, flagW, stripeColor, 0, 0, flagW / 2, null);
  }

  g.add(flagGroup);
  g.userData.flag = flagGroup;
  return flagGroup;
}

// Castle tiers (Grow Castle-style growth). Level 3 is the classic castle the lane map uses.
export const CASTLE_TIERS = [
  { name: 'Wooden Fort', desc: 'Frontier log blockhouse and timber palisade with a raised archer watch.' },
  { name: 'Stone Keep', desc: 'Fortified stone masonry keep with timber hoardings and battlements (no towers).' },
  { name: 'Castle', desc: 'Four fortified corner towers with red conical spires and crenellated battlements.' },
  { name: 'Fortress', desc: 'Concentric citadel with massive central Great Donjon and heraldic shields.' },
  { name: 'Royal Citadel', desc: 'Soaring imperial spires with gold trim, grand braziers, and royal banners.' },
];
const TOWER_SPOTS = [[-4.5, -6], [-4.5, 6], [4.5, -6], [4.5, 6]];

/**
 * Where wall troops stand at each castle level (local coords, gate faces +x). Front-wall troops stand on
 * the roof behind the battlements, in the gaps between the merlons (merlons sit at z = 0, ±2, ±4).
 * Filled center-out, so the first Battlement level takes the middle gap.
 */
export function castleSlots(level = 3) {
  const L = Math.max(1, Math.min(CASTLE_TIERS.length, level));
  if (L === 1) return [{ x: 1.9, y: 7.0, z: 0 }];
  if (L === 2) return [-1.2, 1.2].map((z) => ({ x: 3.2, y: 8.5, z }));
  const wall = [-1.1, 1.1, -3.3, 3.3].map((z) => ({ x: 3.4, y: 9.0, z }));
  const th = L >= 5 ? 16 : 13;
  if (L >= 4) wall.push({ x: 4.5, y: th, z: -6.0 }, { x: 4.5, y: th, z: 6.0 });
  if (L >= 5) wall.push({ x: -1.5, y: 17.0, z: -1.2 }, { x: -1.5, y: 17.0, z: 1.2 });
  return wall;
}

export function buildCastle(level = 3) {
  const L = Math.max(1, Math.min(CASTLE_TIERS.length, level));
  const g = new THREE.Group();
  if (L === 1) {
    buildWoodenFort(g);
    return g;
  }
  if (L === 2) {
    buildStoneKeep(g);
    return g;
  }

  const stone = [0x8c8e93, 0x7c7e84, 0x989aa0, 0x72747a];
  const pick = (i) => stone[i % stone.length];
  const GOLD = 0xe0b040;
  const RED_ROOF = 0x8a2c24;
  const PURPLE_ROOF = 0x6a167d;
  const DARK_WOOD = 0x4a3520;
  const torches = [];

  // Foundation stone plinth with flared corners
  B(g, 9.8, 0.5, 12.8, 0x5c5e64, 0, 0.25, 0, null);
  // Main stone keep
  const kh = 9.0;
  B(g, 9.0, kh, 12.0, 0x84868c, 0, kh / 2, 0, null);

  // Corbelled machicolation cornice below battlements
  B(g, 9.6, 0.45, 12.6, 0x64666c, 0, kh - 0.7, 0, null);

  // 4 Grand Corner Towers (Levels 3, 4, 5)
  const th = L >= 5 ? 16.0 : 13.0;
  TOWER_SPOTS.forEach(([x, z], i) => {
    B(g, 3.4, th, 3.4, pick(i), x, th / 2, z, null);
    B(g, 3.8, 0.45, 3.8, 0x5e6066, x, th - 0.7, z, null);
    for (const ox of [-1.3, 1.3]) {
      for (const oz of [-1.3, 1.3]) {
        B(g, 0.85, 0.85, 0.85, 0x72747a, x + ox, th + 0.42, z + oz, null);
      }
    }

    // Fortress+ (L >= 4): front towers lose roofs for open archery/artillery fighting platforms
    if (L >= 4 && x > 0) return;

    const roofCol = (L >= 5 && x < 0) ? PURPLE_ROOF : RED_ROOF;
    B(g, 2.6, 1.1, 2.6, roofCol, x, th + 1.45, z, null);
    B(g, 1.8, 1.1, 1.8, roofCol + 0x080808, x, th + 2.55, z, null);
    B(g, 1.0, 1.1, 1.0, roofCol + 0x101010, x, th + 3.65, z, null);
    if (L >= 4) {
      B(g, 0.3, 1.0, 0.3, GOLD, x, th + 4.65, z, null, { emissive: 0x3a2800 });
    }
  });

  // Battlements & parapet along the front (+x):
  // Wooden chemin de ronde (patrol walkway) sitting slightly above keep roof (y = kh + 0.04)
  B(g, 1.8, 0.08, 11.2, 0x583a1e, 3.2, kh + 0.04, 0, null);
  // Merlons along front wall edge (x = 4.1)
  for (const z of [-4.4, -2.2, 0, 2.2, 4.4]) {
    B(g, 0.55, 0.9, 1.1, 0x76787e, 4.1, kh + 0.45, z, null);
  }
  // Side & rear parapet merlons
  for (const x of [-3.5, 0, 3.5]) {
    B(g, 0.9, 0.9, 0.55, 0x76787e, x, kh + 0.45, 5.7, null);
    B(g, 0.9, 0.9, 0.55, 0x76787e, x, kh + 0.45, -5.7, null);
  }

  // Stone Quoins and Masonry Accents on outer corners
  for (let k = 0; k < 30; k++) {
    const y = 1.0 + ((k * 31) % 75) / 10;
    const side = k % 2 === 0 ? 1 : -1;
    B(g, 0.14, 0.5, 0.8, pick(k + 1), 4.56, y, side * (4.0 + ((k * 13) % 18) / 10), null);
  }

  // Fortified Arched Gatehouse (+x) - Clean 3D separation without coplanar z-fighting
  // Side stone arch pillars
  B(g, 0.6, 5.0, 0.6, 0x62646a, 4.8, 2.5, -2.1, null);
  B(g, 0.6, 5.0, 0.6, 0x62646a, 4.8, 2.5, 2.1, null);
  // Heavy stone lintel above portal
  B(g, 0.7, 0.8, 4.8, 0x585a60, 4.8, 5.2, 0, null);

  // Recessed oak gate doors
  B(g, 0.14, 4.2, 3.4, 0x3d2714, 4.56, 2.1, 0, null);
  for (const y of [1.2, 2.5, 3.8]) {
    B(g, 0.16, 0.14, 3.4, 0x222426, 4.58, y, 0, null);
  }
  // Iron Portcullis with vertical bars & spike tips
  for (let z = -1.2; z <= 1.21; z += 0.48) {
    B(g, 0.12, 4.3, 0.12, 0x2a2c30, 4.75, 2.15, z, null);
    B(g, 0.16, 0.25, 0.16, 0x1e2022, 4.75, 0.15, z, null);
  }

  // Torches flanking the gate (wall sconces)
  for (const sz of [-2.8, 2.8]) {
    B(g, 0.25, 0.65, 0.25, DARK_WOOD, 4.9, 3.6, sz, null);
    B(g, 0.35, 0.15, 0.35, 0x2a2c30, 4.9, 3.95, sz, null);
    const fl = B(g, 0.35, 0.35, 0.35, 0xffa030, 4.9, 4.25, sz, null, { emissive: 0xff7a00 });
    fl.castShadow = false;
    torches.push(fl);
  }

  // Crimson Faction Banners flanking the gate
  for (const sz of [-2.8, 2.8]) {
    B(g, 0.06, 3.4, 1.4, 0xa3221c, 4.92, 6.5, sz, null);
    B(g, 0.08, 0.85, 0.7, GOLD, 4.94, 6.8, sz, null);
  }

  // =========================================================================
  // LEVEL 4 & 5: FORTRESS & CITADEL
  // =========================================================================
  const dh = L >= 5 ? 17.5 : 15.5;
  if (L >= 4) {
    B(g, 5.4, dh, 5.4, 0x7c7e84, -1.5, dh / 2, 0, null);
    B(g, 5.9, 0.5, 5.9, 0x606268, -1.5, dh - 0.7, 0, null);
    for (const [ox, oz] of [[-2.2, -2.2], [-2.2, 2.2], [2.2, -2.2], [2.2, 2.2], [-2.2, 0], [2.2, 0], [0, -2.2], [0, 2.2]]) {
      B(g, 0.8, 0.85, 0.8, 0x72747a, -1.5 + ox, dh + 0.42, oz, null);
    }
    for (const y of [kh + 1.8, kh + 4.2]) {
      for (const z of [-2.72, 2.72]) {
        B(g, 0.5, 1.0, 0.08, 0x181a1e, -1.5, y, z, null);
      }
    }
    const shieldCols = [0xa3221c, 0xe0b040, 0x254e8c];
    for (let k = 0; k < 4; k++) {
      const sz = -3.0 + k * 2.0;
      B(g, 0.1, 0.8, 0.6, shieldCols[k % 3], 4.42, kh + 0.4, sz, null);
    }
  }

  // LEVEL 5: CITADEL
  if (L >= 5) {
    B(g, 0.08, 2.2, 1.4, 0x4080e0, 1.22, dh - 2.8, 0, null, { emissive: 0x182850 });
    for (const sz of [-6.0, 6.0]) {
      B(g, 0.08, 5.8, 1.8, PURPLE_ROOF, 6.22, th - 4.5, sz, null);
      B(g, 0.1, 1.2, 0.9, GOLD, 6.24, th - 3.8, sz, null);
      B(g, 0.1, 0.25, 1.8, GOLD, 6.24, th - 7.1, sz, null);
    }
    for (const sz of [-3.8, 3.8]) {
      B(g, 0.9, 0.5, 0.9, 0x4e5056, 5.6, 0.25, sz, null);
      B(g, 0.5, 1.2, 0.5, 0x3e4044, 5.6, 1.1, sz, null);
      B(g, 1.2, 0.45, 1.2, 0x8a6026, 5.6, 1.85, sz, null);
      const fl = B(g, 0.8, 0.8, 0.8, 0xffb040, 5.6, 2.45, sz, null, { emissive: 0xff7a00 });
      fl.castShadow = false;
      torches.push(fl);
    }
  }

  // Flag on Donjon / Keep
  const fx = L >= 4 ? -1.5 : 0;
  const fy = L >= 4 ? dh : kh;
  addFactionFlag(g, fx, fy, 0, 4.5, 2.2, 1.2, 0xa3221c, GOLD, DARK_WOOD);

  g.userData.torches = torches;
  g.userData.level = L;
  g.userData.slots = castleSlots(L);
  return g;
}

/** Castle Lv 2: Fortified Norman Stone Keep without corner towers. */
function buildStoneKeep(g) {
  const torches = [];
  const stone = [0x8c8e93, 0x7c7e84, 0x989aa0, 0x72747a];
  const pick = (i) => stone[i % stone.length];
  const GOLD = 0xe0b040;
  const DARK_WOOD = 0x4a3520;

  const hx = 4.2, hz = 5.2, kh = 8.5;

  // Foundation stone plinth with corner buttress spurs
  B(g, hx * 2 + 0.8, 0.5, hz * 2 + 0.8, 0x585a60, 0, 0.25, 0, null);
  // Main solid stone masonry keep
  B(g, hx * 2, kh, hz * 2, 0x82848a, 0, kh / 2, 0, null);

  // Stepped corner buttresses (adds heavy Norman architectural weight without towers)
  for (const sx of [-1, 1]) {
    for (const sz of [-1, 1]) {
      B(g, 1.2, 5.0, 1.2, pick(sx + sz + 3), sx * (hx + 0.2), 2.5, sz * (hz + 0.2), null);
      B(g, 0.8, 3.2, 0.8, pick(sx + sz + 4), sx * (hx + 0.1), 6.6, sz * (hz + 0.1), null);
    }
  }

  // Corbelled stone machicolation cornice under battlements
  B(g, hx * 2 + 0.6, 0.45, hz * 2 + 0.6, 0x62646a, 0, kh - 0.7, 0, null);
  for (let z = -hz + 0.8; z <= hz - 0.7; z += 1.4) {
    B(g, 0.4, 0.35, 0.2, 0x3d2714, hx + 0.15, kh - 1.0, z, null);
    B(g, 0.4, 0.35, 0.2, 0x3d2714, -(hx + 0.15), kh - 1.0, z, null);
  }

  // Wooden chemin de ronde (patrol walkway) on the roof (sitting slightly above stone deck)
  B(g, 1.6, 0.08, hz * 2 - 1.2, 0x583a1e, 3.0, kh + 0.04, 0, null);

  // Stone battlements along all 4 sides (merlons):
  // Front wall (+x): 2 archer slots at z = ±1.2 (standing at x = 3.2, y = 8.5)
  for (const z of [-3.8, -2.4, 0, 2.4, 3.8]) {
    B(g, 0.55, 0.9, 0.9, 0x72747a, hx - 0.35, kh + 0.45, z, null);
  }
  // Side and rear parapets
  for (const x of [-3.0, -1.5, 0, 1.5, 3.0]) {
    B(g, 0.9, 0.9, 0.55, 0x72747a, x, kh + 0.45, hz - 0.35, null);
    B(g, 0.9, 0.9, 0.55, 0x72747a, x, kh + 0.45, -(hz - 0.35), null);
  }
  for (const z of [-3.8, -1.9, 0, 1.9, 3.8]) {
    B(g, 0.55, 0.9, 0.9, 0x72747a, -(hx - 0.35), kh + 0.45, z, null);
  }

  // Corner watch posts on the roof
  for (const sx of [-1, 1]) {
    for (const sz of [-1, 1]) {
      B(g, 1.1, 1.2, 1.1, 0x6e7076, sx * (hx - 0.35), kh + 0.6, sz * (hz - 0.35), null);
    }
  }

  // Arched Stone Portal (+x) - separate 3D pillars & lintel (no coplanar box fighting)
  B(g, 0.5, 4.4, 0.6, 0x5e6066, hx + 0.25, 2.2, -1.8, null);
  B(g, 0.5, 4.4, 0.6, 0x5e6066, hx + 0.25, 2.2, 1.8, null);
  B(g, 0.6, 0.8, 4.2, 0x54565c, hx + 0.25, 4.6, 0, null);

  // Recessed oak gate doors
  B(g, 0.12, 4.0, 2.8, 0x3d2714, hx + 0.05, 2.0, 0, null);
  for (const y of [1.1, 2.4, 3.6]) {
    B(g, 0.14, 0.12, 2.8, 0x222426, hx + 0.07, y, 0, null);
  }
  // Iron Portcullis bars
  for (let z = -1.1; z <= 1.11; z += 0.44) {
    B(g, 0.1, 4.1, 0.1, 0x2a2c30, hx + 0.2, 2.05, z, null);
    B(g, 0.14, 0.22, 0.14, 0x1e2022, hx + 0.2, 0.11, z, null);
  }

  // Wall Torches flanking entrance
  for (const sz of [-2.4, 2.4]) {
    B(g, 0.2, 0.6, 0.2, DARK_WOOD, hx + 0.35, 3.4, sz, null);
    B(g, 0.3, 0.12, 0.3, 0x242628, hx + 0.35, 3.7, sz, null);
    const fl = B(g, 0.32, 0.32, 0.32, 0xffa030, hx + 0.35, 3.96, sz, null, { emissive: 0xff7a00 });
    fl.castShadow = false;
    torches.push(fl);
  }

  // Crimson Faction Banners flanking portal
  for (const sz of [-2.4, 2.4]) {
    B(g, 0.06, 2.8, 1.2, 0xa3221c, hx + 0.38, 5.8, sz, null);
    B(g, 0.08, 0.7, 0.6, GOLD, hx + 0.40, 6.0, sz, null);
  }

  // Faction flag on roof
  addFactionFlag(g, -2.5, kh, 3.2, 4.2, 1.8, 1.0, 0xa3221c, GOLD, DARK_WOOD);

  g.userData.torches = torches;
  g.userData.level = 2;
  g.userData.slots = castleSlots(2);
}

/** Castle Lv 1: Authentic Motte & Bailey Frontier Wooden Fort. */
function buildWoodenFort(g) {
  const torches = [];
  const log = [0x6b4a2b, 0x5e4026, 0x7a5532];
  const pickLog = (i) => log[i % log.length];

  // Interlocking timber log blockhouse
  for (let y = 0.4; y <= 6.8; y += 0.8) {
    const idx = Math.floor(y);
    B(g, 7.0, 0.75, 0.6, pickLog(idx), 0, y, -4.2, null);
    B(g, 7.0, 0.75, 0.6, pickLog(idx + 1), 0, y, 4.2, null);
    B(g, 0.6, 0.75, 8.0, pickLog(idx + 2), -3.2, y, 0, null);
    B(g, 0.6, 0.75, 8.0, pickLog(idx + 3), 3.2, y, 0, null);
  }

  for (const sx of [-3.2, 3.2]) {
    for (const sz of [-4.2, 4.2]) {
      B(g, 0.85, 7.2, 0.85, 0x48321c, sx, 3.6, sz, null);
    }
  }

  // Raised timber combat watch platform at y = 7.0
  B(g, 6.8, 0.25, 8.8, 0x55381d, 0, 6.9, 0, null);

  // Front log parapet (archer slot 1 at x = 1.9, y = 7.0, z = 0)
  B(g, 0.5, 0.85, 3.2, 0x5e4026, 3.2, 7.45, -2.4, null);
  B(g, 0.5, 0.85, 3.2, 0x5e4026, 3.2, 7.45, 2.4, null);
  B(g, 0.5, 0.35, 1.6, 0x5e4026, 3.2, 7.2, 0, null);
  B(g, 6.4, 0.8, 0.4, 0x5e4026, 0, 7.45, -4.2, null);
  B(g, 6.4, 0.8, 0.4, 0x5e4026, 0, 7.45, 4.2, null);

  // Weathered wooden plank roof shelter over rear half
  for (const sz of [-4.0, 4.0]) {
    B(g, 0.15, 2.2, 0.15, 0x422d19, -3.0, 8.0, sz, null);
    B(g, 0.15, 2.4, 0.15, 0x422d19, 0, 8.1, sz, null);
  }
  const shelterRoof = B(g, 3.8, 0.1, 8.6, 0x4e331b, -1.5, 9.25, 0, null);
  shelterRoof.rotation.z = 0.08;

  // Outer Sharpened Log Palisade Perimeter
  let k = 0;
  const post = (x, z) => {
    const h = 2.4 + ((k * 7) % 5) / 10;
    B(g, 0.5, h, 0.5, log[k++ % 3], x, h / 2, z, null);
    B(g, 0.32, 0.4, 0.32, 0x8a6a42, x, h + 0.18, z, null);
  };
  for (let z = -5.6; z <= 5.61; z += 0.6) {
    if (Math.abs(z) > 1.8) post(5.2, z);
  }
  for (let x = -4.6; x <= 4.8; x += 0.6) {
    post(x, -5.8);
    post(x, 5.8);
  }
  B(g, 0.7, 3.8, 0.7, 0x3d2714, 5.2, 1.9, -1.8, null);
  B(g, 0.7, 3.8, 0.7, 0x3d2714, 5.2, 1.9, 1.8, null);
  B(g, 0.6, 0.5, 4.2, 0x3d2714, 5.2, 3.75, 0, null);

  // Pitch Brazier on oak post beside the entrance
  B(g, 0.3, 1.8, 0.3, 0x3d2714, 5.8, 0.9, 2.4, null);
  B(g, 0.7, 0.25, 0.7, 0x2a2c30, 5.8, 1.85, 2.4, null);
  const fl = B(g, 0.45, 0.45, 0.45, 0xffa030, 5.8, 2.2, 2.4, null, { emissive: 0xff7a00 });
  fl.castShadow = false;
  torches.push(fl);

  // Red Medieval Faction Flag
  addFactionFlag(g, -3.2, 0, 4.6, 6.2, 2.0, 1.1, 0xa3221c, 0xe0b040, 0x4a3520);

  g.userData.torches = torches;
  g.userData.level = 1;
  g.userData.slots = castleSlots(1);
}

// HQ tiers — the Modern side's mirror of CASTLE_TIERS. Level 3 is the classic HQ the lane map uses. Front faces -x.
export const HQ_TIERS = [
  { name: 'Field Outpost', desc: 'Tactical shipping-container FOB behind sandbag revetments, with generator and radio mast.' },
  { name: 'Forward Command', desc: 'Reinforced two-story command bunker with blast barriers, satcom dish, and observation catwalk.' },
  { name: 'Command HQ', desc: 'Brutalist fortified operations center with helipad, HVAC chillers, and blast gate.' },
  { name: 'Military Compound', desc: 'Twin fortified guard towers with searchlights, razor-wire Hesco barriers, and rotating radar dish.' },
  { name: 'Tech Tower', desc: 'Cyber-command citadel with stealth armor, CIWS defense turret, active radar, and attack gunship.' },
];

/** Where Overwatch gunners stand at each HQ level (local coords). Roof gunners stand behind the parapet, in its gaps. */
export function hqSlots(level = 3) {
  const L = Math.max(1, Math.min(HQ_TIERS.length, level));
  if (L === 1) return [{ x: -1.5, y: 2.95, z: 0 }];
  if (L === 2) return [-1.2, 1.2].map((z) => ({ x: -3.2, y: 6.2, z }));
  const roof = [-1.1, 1.1, -3.3, 3.3].map((z) => ({ x: -4.1, y: 10.5, z }));
  if (L >= 4) roof.push({ x: -5.0, y: 11.2, z: -6.2 }, { x: -5.0, y: 11.2, z: 6.2 });
  if (L >= 5) roof.push({ x: 1.0, y: 18.5, z: -2.0 }, { x: 1.0, y: 18.5, z: -4.0 });
  return roof;
}

const CONCRETE = 0x6c7078;
/** Concrete parapet blocks along a roof's front edge (the gaps between them are the gunner slots). */
function parapet(g, x, y, zs) { for (const z of zs) B(g, 0.55, 0.85, 1.1, CONCRETE, x, y + 0.42, z, null); }
function sandbag(g, x, y, z, rot = false) { B(g, rot ? 1.15 : 0.95, 0.42, rot ? 0.95 : 1.15, 0xa49268, x, y + 0.21, z, null); }

export function buildHQ(level = 3) {
  const L = Math.max(1, Math.min(HQ_TIERS.length, level));
  const g = new THREE.Group();
  if (L === 1) {
    buildOutpost(g);
  } else if (L === 2) {
    buildForwardCommand(g);
  } else {
    const blinks = [];
    const fans = [];

    // Heavy Brutalist foundation plinth with blast skirts
    B(g, 10.6, 0.5, 12.6, 0x50545c, 0, 0.25, 0, null);
    // Main Operations Center Block
    B(g, 10.0, 9.8, 12.0, 0x828790, 0, 5.2, 0, null);
    // Perimeter cornice slab below roof deck
    B(g, 10.5, 0.45, 12.5, 0x666a72, 0, 10.25, 0, null);

    // Vertical structural pilasters / buttresses along facades
    for (const z of [-5.0, -2.5, 2.5, 5.0]) {
      B(g, 0.35, 9.8, 0.5, 0x5a5e66, -5.1, 5.2, z, null);
      B(g, 0.35, 9.8, 0.5, 0x5a5e66, 5.1, 5.2, z, null);
    }
    for (const x of [-3.0, 0, 3.0]) {
      B(g, 0.5, 9.8, 0.35, 0x5a5e66, x, 5.2, -6.1, null);
      B(g, 0.5, 9.8, 0.35, 0x5a5e66, x, 5.2, 6.1, null);
    }

    // Ribbon windows with dividing mullions
    const glass = { emissive: 0x092238 };
    for (let y = 2.8; y <= 8.8; y += 2.2) {
      B(g, 0.08, 0.85, 10.5, 0x3a82ba, -5.04, y, 0, null, glass);
      B(g, 0.08, 0.85, 10.5, 0x3a82ba, 5.04, y, 0, null, glass);
      B(g, 8.5, 0.85, 0.08, 0x3a82ba, 0, y, 6.04, null, glass);
      B(g, 8.5, 0.85, 0.08, 0x3a82ba, 0, y, -6.04, null, glass);
      for (let z = -4; z <= 4.01; z += 2) {
        B(g, 0.12, 0.85, 0.12, 0x282c32, -5.06, y, z, null);
        B(g, 0.12, 0.85, 0.12, 0x282c32, 5.06, y, z, null);
      }
    }

    // Fortified Ground Entrance (faces -x)
    B(g, 0.3, 3.2, 4.2, 0x22252a, -5.08, 1.6, 0, null);
    B(g, 0.15, 2.7, 3.4, 0x2e333a, -5.15, 1.5, 0, null);
    B(g, 0.17, 0.15, 3.4, 0xf2c94c, -5.16, 2.7, 0, null);
    B(g, 0.17, 0.15, 3.4, 0xf2c94c, -5.16, 0.3, 0, null);

    // Cantilevered entrance canopy
    B(g, 2.4, 0.4, 5.4, 0x3a3f46, -6.2, 3.4, 0, null);
    for (const sz of [-2.4, 2.4]) {
      B(g, 0.3, 3.2, 0.3, 0x3a3f46, -7.1, 1.6, sz, null);
    }
    // Security bollards out front
    for (const z of [-1.5, -0.5, 0.5, 1.5]) {
      B(g, 0.28, 0.9, 0.28, 0xf2c94c, -7.8, 0.45, z, null);
      B(g, 0.3, 0.18, 0.3, 0x222222, -7.8, 0.65, z, null);
    }

    // Flanking sandbags / blast barricades
    for (let z = -5.4; z <= 5.41; z += 1.2) {
      if (Math.abs(z) < 2.5) continue;
      B(g, 1.0, 0.5, 1.1, 0xa49268, -7.6, 0.25, z, null);
      B(g, 1.0, 0.45, 1.1, 0x928056, -7.6, 0.72, z + 0.25, null);
    }

    // Front parapet blocks on roof (embrasures for 4 wall gunners at z = -3.3, -1.1, 1.1, 3.3)
    parapet(g, -4.75, 10.5, [0, -2.2, 2.2, -4.4, 4.4]);

    // Helipad on the roof
    B(g, 5.2, 0.1, 5.2, 0x282b30, -1.4, 10.55, 2.0, null);
    B(g, 5.0, 0.12, 0.2, 0xf2c94c, -1.4, 10.6, -0.45, null);
    B(g, 5.0, 0.12, 0.2, 0xf2c94c, -1.4, 10.6, 4.45, null);
    B(g, 0.2, 0.12, 5.0, 0xf2c94c, -3.85, 10.6, 2.0, null);
    B(g, 0.2, 0.12, 5.0, 0xf2c94c, 1.05, 10.6, 2.0, null);
    B(g, 0.45, 0.12, 2.4, 0xf2c94c, -2.2, 10.61, 2.0, null);
    B(g, 0.45, 0.12, 2.4, 0xf2c94c, -0.6, 10.61, 2.0, null);
    B(g, 1.4, 0.12, 0.45, 0xf2c94c, -1.4, 10.61, 2.0, null);
    for (const ox of [-3.8, 1.0]) {
      for (const oz of [-0.4, 4.4]) {
        const navL = B(g, 0.2, 0.18, 0.2, 0xffe070, ox, 10.65, oz, null, { emissive: 0xffa020 });
        navL.castShadow = false;
      }
    }

    // Mechanical Penthouse & Spinning HVAC Chiller Fan
    B(g, 3.4, 1.8, 3.4, 0x585c64, 2.4, 11.4, -2.8, null);
    B(g, 1.8, 0.35, 1.8, 0x2c3036, 2.4, 12.45, -2.8, null);
    const fan = new THREE.Group();
    fan.position.set(2.4, 12.5, -2.8);
    B(fan, 1.4, 0.04, 0.22, 0x181a1c, 0, 0, 0, null);
    B(fan, 0.22, 0.04, 1.4, 0x181a1c, 0, 0, 0, null);
    B(fan, 0.35, 0.08, 0.35, 0x282c32, 0, 0, 0, null);
    g.add(fan);
    fans.push(fan);

    // Heavy Communications Lattice Mast
    B(g, 0.22, 6.5, 0.22, 0x50555e, 3.4, 13.75, 3.6, null);
    B(g, 1.0, 0.12, 0.12, 0x50555e, 3.4, 15.2, 3.6, null);
    B(g, 0.12, 0.12, 1.0, 0x50555e, 3.4, 16.0, 3.6, null);
    B(g, 0.45, 0.5, 0.5, 0xd4d8de, 3.1, 14.5, 3.6, null);
    const blink = B(g, 0.35, 0.35, 0.35, 0xff2020, 3.4, 17.2, 3.6, null, { emissive: 0xff0000 });
    blink.castShadow = false;
    blinks.push(blink);

    // Faction Flag (rotates anchored to pole, stripe stays locked)
    addFactionFlag(g, -6.5, 0, 5.4, 6.5, 2.2, 1.2, 0x2f6fd6, 0xffffff);

    g.userData.fans = fans;
    g.userData.blink = blink;
    g.userData.blinks = blinks;

    // =========================================================================
    // LEVEL 4: MILITARY COMPOUND
    // =========================================================================
    if (L >= 4) {
      const searchlights = [];
      for (const z of [-6.2, 6.2]) {
        for (const [ox, oz] of [[-1.1, -1.1], [-1.1, 1.1], [1.1, -1.1], [1.1, 1.1]]) {
          B(g, 0.35, 11.2, 0.35, 0x363a40, -5.0 + ox, 5.6, z + oz, null);
        }
        for (const y of [3.6, 7.4]) {
          B(g, 2.4, 0.18, 0.18, 0x363a40, -5.0, y, z - 1.1, null);
          B(g, 2.4, 0.18, 0.18, 0x363a40, -5.0, y, z + 1.1, null);
          B(g, 0.18, 0.18, 2.4, 0x363a40, -6.1, y, z, null);
          B(g, 0.18, 0.18, 2.4, 0x363a40, -3.9, y, z, null);
        }
        B(g, 3.2, 0.35, 3.2, 0x484d54, -5.0, 11.0, z, null);
        B(g, 0.15, 0.85, 2.8, 0x2c3036, -6.45, 11.55, z, null);
        B(g, 2.8, 0.65, 0.1, 0x34383e, -5.0, 11.5, z - 1.45, null);
        B(g, 2.8, 0.65, 0.1, 0x34383e, -5.0, 11.5, z + 1.45, null);
        B(g, 0.1, 0.65, 2.8, 0x34383e, -3.55, 11.5, z, null);

        const slGroup = new THREE.Group();
        slGroup.position.set(-6.3, 11.6, z);
        B(slGroup, 0.2, 0.35, 0.35, 0x24272a, 0, 0, 0, null);
        B(slGroup, 0.55, 0.5, 0.55, 0x30353c, -0.2, 0.1, 0, null);
        const lens = B(slGroup, 0.08, 0.42, 0.46, 0xfff6c8, -0.5, 0.1, 0, null, { emissive: 0xfff0a0 });
        lens.castShadow = false;
        g.add(slGroup);
        searchlights.push(slGroup);
      }
      g.userData.searchlights = searchlights;

      for (let z = -5.4; z <= 5.41; z += 1.35) {
        if (Math.abs(z) < 2.2) continue;
        B(g, 1.2, 1.1, 1.2, 0x9e8c68, -8.7, 0.55, z, null);
        B(g, 1.25, 0.12, 1.25, 0x40444a, -8.7, 1.12, z, null);
        B(g, 0.65, 0.55, 0.95, 0x7a8088, -9.6, 0.3, z, null);
      }

      const radar = new THREE.Group();
      B(radar, 0.35, 1.2, 0.35, 0x4a4f56, 0, 0.6, 0, null);
      const head = new THREE.Group();
      head.position.set(0, 1.2, 0);
      radar.add(head);
      const dish = B(head, 0.25, 1.6, 2.6, 0xd8dce4, 0.2, 0.6, 0, null);
      dish.rotation.z = 0.35;
      B(head, 0.8, 0.1, 0.1, 0x383c42, -0.3, 0.6, 0, null);
      B(head, 0.2, 0.22, 0.22, 0x282c32, -0.7, 0.6, 0, null);
      radar.position.set(2.4, 12.8, -2.8);
      g.add(radar);
      g.userData.radar = head;
    }

    // =========================================================================
    // LEVEL 5: TECH TOWER
    // =========================================================================
    if (L >= 5) {
      const cyberGlass = { emissive: 0x06283d };
      const cyanGlow = { emissive: 0x00d4ff };

      B(g, 5.0, 8.5, 5.6, 0x22262e, 2.4, 14.75, -2.8, null);
      B(g, 5.4, 0.4, 6.0, 0x343a44, 2.4, 18.35, -2.8, null);

      for (const sx of [-1, 1]) {
        for (const sz of [-1, 1]) {
          const seam = B(g, 0.12, 8.5, 0.12, 0x00e5ff, 2.4 + sx * 2.52, 14.75, -2.8 + sz * 2.82, null, cyanGlow);
          seam.castShadow = false;
        }
      }

      for (let y = 12.0; y <= 17.5; y += 1.6) {
        B(g, 0.1, 0.9, 4.8, 0x1a455c, -0.12, y, -2.8, null, cyberGlass);
        B(g, 4.4, 0.9, 0.1, 0x1a455c, 2.4, y, -0.02, null, cyberGlass);
        B(g, 4.4, 0.9, 0.1, 0x1a455c, 2.4, y, -5.58, null, cyberGlass);
      }

      parapet(g, 0.1, 18.5, [-1.0, -2.8, -4.8]);

      const turret = new THREE.Group();
      turret.position.set(3.6, 18.8, -1.6);
      B(turret, 1.3, 0.45, 1.3, 0x2b3038, 0, 0.22, 0, null);
      B(turret, 1.6, 0.14, 0.14, 0x181a1d, -0.8, 0.28, -0.16, null);
      B(turret, 1.6, 0.14, 0.14, 0x181a1d, -0.8, 0.28, 0.16, null);
      B(turret, 0.7, 0.55, 0.85, 0x383e46, 0.4, 0.3, 0, null);
      B(turret, 0.5, 0.5, 0.5, 0xd8dee6, 0, 0.65, 0, null);
      g.add(turret);
      g.userData.turret = turret;

      if (g.userData.radar) {
        g.userData.radar.parent.position.set(3.8, 18.8, -4.6);
      }

      const heli = new THREE.Group();
      B(heli, 3.2, 1.1, 1.2, 0x28322c, 0, 0.85, 0, null);
      B(heli, 1.3, 0.75, 1.0, 0x4fa8e0, -1.4, 0.95, 0, null, { emissive: 0x0d3856 });
      B(heli, 0.35, 0.35, 0.35, 0x181b1d, -1.8, 0.45, 0, null);
      B(heli, 3.0, 0.35, 0.35, 0x28322c, 2.5, 1.1, 0, null);
      B(heli, 0.4, 0.9, 0.1, 0x28322c, 3.8, 1.5, 0, null);
      B(heli, 0.08, 0.7, 0.12, 0x181a1d, 3.85, 1.5, 0.15, null);
      B(heli, 0.6, 0.12, 2.4, 0x28322c, -0.2, 0.85, 0, null);
      for (const sz of [-1.1, 1.1]) {
        B(heli, 0.8, 0.32, 0.32, 0x384038, -0.2, 0.65, sz, null);
        B(heli, 0.05, 0.28, 0.28, 0x1a1c1e, -0.62, 0.65, sz, null);
      }
      for (const sz of [-0.65, 0.65]) {
        B(heli, 2.6, 0.1, 0.1, 0x1f2224, 0, 0.1, sz, null);
        B(heli, 0.1, 0.45, 0.1, 0x1f2224, -0.8, 0.3, sz, null);
        B(heli, 0.1, 0.45, 0.1, 0x1f2224, 0.8, 0.3, sz, null);
      }
      const rotorMast = new THREE.Group();
      rotorMast.position.set(-0.2, 1.55, 0);
      heli.add(rotorMast);
      B(rotorMast, 0.25, 0.2, 0.25, 0x1f2224, 0, 0, 0, null);
      B(rotorMast, 5.0, 0.05, 0.24, 0x1e2024, 0, 0.08, 0, null);
      B(rotorMast, 0.24, 0.05, 5.0, 0x1e2024, 0, 0.08, 0, null);
      for (const s of [-2.35, 2.35]) {
        B(rotorMast, 0.3, 0.06, 0.24, 0xf2c94c, s, 0.08, 0, null);
        B(rotorMast, 0.24, 0.06, 0.3, 0xf2c94c, 0, 0.08, s, null);
      }

      heli.position.set(-1.4, 10.6, 2.0);
      heli.rotation.y = 0.35;
      g.add(heli);
      g.userData.rotor = rotorMast;
    }
  }

  g.userData.level = L;
  g.userData.slots = hqSlots(L);
  return g;
}

/** HQ Lv 1: Tactical Forward Operating Base (FOB) shipping container & sandbag perimeter. */
function buildOutpost(g) {
  const blinks = [];
  // Main container body (olive-drab steel)
  B(g, 4.8, 2.8, 7.6, 0x44503c, 0, 1.4, 0, null);
  // Heavy corner casting posts
  for (const sx of [-1, 1]) {
    for (const sz of [-1, 1]) {
      B(g, 0.35, 2.85, 0.35, 0x242822, sx * 2.3, 1.42, sz * 3.7, null);
    }
  }
  // Peripheral top & bottom framing rails
  B(g, 0.3, 0.2, 7.6, 0x242822, -2.3, 2.75, 0, null);
  B(g, 0.3, 0.2, 7.6, 0x242822, 2.3, 2.75, 0, null);
  B(g, 0.3, 0.2, 7.6, 0x242822, -2.3, 0.1, 0, null);
  B(g, 0.3, 0.2, 7.6, 0x242822, 2.3, 0.1, 0, null);
  B(g, 4.8, 0.2, 0.3, 0x242822, 0, 2.75, -3.7, null);
  B(g, 4.8, 0.2, 0.3, 0x242822, 0, 2.75, 3.7, null);

  // Corrugation ribs:
  // Back wall (x = +2.43) gets full ribs
  for (let z = -3.3; z <= 3.31; z += 0.55) {
    B(g, 0.08, 2.5, 0.18, 0x364030, 2.43, 1.4, z, null);
  }
  // Front wall (x = -2.43): skip ribs where door (z in [0.1, 1.5]) and window (z in [-2.3, -0.9]) are located
  for (let z = -3.3; z <= 3.31; z += 0.55) {
    if ((z >= -2.3 && z <= -0.9) || (z >= 0.1 && z <= 1.5)) continue;
    B(g, 0.08, 2.5, 0.18, 0x364030, -2.43, 1.4, z, null);
  }

  // Personnel door with frame, latch & warning plate
  B(g, 0.12, 2.1, 1.1, 0x282c26, -2.44, 1.05, 0.8, null);
  B(g, 0.14, 0.1, 0.2, 0xd4a024, -2.46, 1.05, 0.45, null);
  B(g, 0.6, 0.12, 1.3, 0x323830, -2.72, 0.06, 0.8, null);

  // Front slit window with protective sun visor (clean and unobstructed)
  B(g, 0.1, 0.65, 1.2, 0x4fa8e0, -2.44, 1.8, -1.6, null, { emissive: 0x092238 });
  B(g, 0.35, 0.08, 1.4, 0x242822, -2.58, 2.18, -1.6, null);

  // Flush, structurally sound Camouflage Awning over entrance:
  B(g, 0.08, 2.15, 0.08, 0x242822, -3.9, 1.08, 0.0, null);
  B(g, 0.08, 2.15, 0.08, 0x242822, -3.9, 1.08, 1.6, null);
  B(g, 0.08, 0.08, 1.7, 0x242822, -3.9, 2.15, 0.8, null);
  for (const rz of [0.0, 1.6]) {
    const rafter = B(g, 1.62, 0.07, 0.07, 0x242822, -3.15, 2.45, rz, null);
    rafter.rotation.z = 0.38;
  }
  const tarp = B(g, 1.65, 0.05, 1.8, 0x4e5842, -3.15, 2.50, 0.8, null);
  tarp.rotation.z = 0.38;

  // Tactical Field Diesel Generator
  B(g, 1.4, 0.15, 1.4, 0x222524, 0.6, 0.08, -4.8, null);
  B(g, 1.1, 0.85, 1.1, 0x3b4735, 0.6, 0.58, -4.8, null);
  B(g, 0.08, 0.45, 0.8, 0x16181a, 0.03, 0.6, -4.8, null);
  B(g, 0.1, 0.9, 0.1, 0x202224, 0.8, 1.1, -4.5, null);
  B(g, 0.25, 0.4, 0.35, 0xd49b20, -0.2, 0.25, -4.5, null);

  // Tactical Comms Mast & Satcom Dish
  B(g, 0.6, 0.15, 0.6, 0x2c3028, 1.8, 2.85, 3.2, null);
  B(g, 0.14, 6.5, 0.14, 0x585e66, 1.8, 6.1, 3.2, null);
  B(g, 0.1, 0.1, 1.2, 0x585e66, 1.8, 7.8, 3.2, null);
  const satDish = B(g, 0.15, 0.9, 0.9, 0xc8ccd2, 1.6, 5.2, 3.2, null);
  satDish.rotation.z = 0.4;
  const blink = B(g, 0.3, 0.3, 0.3, 0xff2525, 1.8, 9.45, 3.2, null, { emissive: 0xff0000 });
  blink.castShadow = false;
  blinks.push(blink);

  // Munition crates & oil drums
  B(g, 0.8, 0.6, 0.8, 0x8a633a, 2.2, 0.3, -4.2, null);
  B(g, 0.7, 0.5, 0.7, 0x44503c, 2.2, 0.85, -4.2, null);
  B(g, 0.65, 0.95, 0.65, 0x2e3b2b, -1.3, 0.48, -4.6, null);
  B(g, 0.65, 0.95, 0.65, 0x942e28, -2.0, 0.48, -4.6, null);

  // Ground perimeter sandbag revetment
  for (let z = -4.6; z <= 4.61; z += 1.15) {
    if (z > 0.1 && z < 1.7) continue;
    sandbag(g, -4.6, 0, z);
    sandbag(g, -4.6, 0.42, z + 0.28);
  }
  for (let x = -3.4; x <= 3.4; x += 1.15) {
    sandbag(g, x, 0, -5.2, true);
    sandbag(g, x, 0, 5.2, true);
  }

  // Rooftop Sandbag Nest (Gunner Slot 1 at x = -1.5, y = 2.95, z = 0)
  B(g, 1.3, 0.1, 1.3, 0x6a4e2e, -1.5, 2.85, 0, null);
  sandbag(g, -2.3, 2.85, -0.85, true);
  sandbag(g, -2.3, 2.85, 0, true);
  sandbag(g, -2.3, 2.85, 0.85, true);
  sandbag(g, -1.5, 2.85, -0.95);
  sandbag(g, -1.5, 2.85, 0.95);
  sandbag(g, -0.7, 2.85, -0.85, true);
  sandbag(g, -0.7, 2.85, 0.85, true);

  // Faction Flag (rotates anchored to pole, stripe stays locked)
  addFactionFlag(g, -4.2, 0, 3.8, 4.5, 1.8, 1.0, 0x2f6fd6, 0xffffff);

  g.userData.flag = g.userData.flag;
  g.userData.blink = blink;
  g.userData.blinks = blinks;
}

/** HQ Lv 2: Reinforced Forward Command Post (2-story tactical bunker with blast barriers & catwalk). */
function buildForwardCommand(g) {
  const blinks = [];
  // Reinforced foundation plinth
  B(g, 8.4, 0.4, 10.8, 0x3e423d, 0, 0.2, 0, null);
  // Ground floor bunker
  B(g, 8.0, 3.0, 10.4, 0x555e52, 0, 1.8, 0, null);
  // Mid-floor steel belt & tactical blue trim
  B(g, 8.2, 0.35, 10.6, 0x223e72, 0, 3.2, 0, null);

  // Upper Command Floor (step-back cabin at rear)
  B(g, 5.6, 2.8, 7.6, 0x5f685c, 1.0, 4.7, 0, null);
  B(g, 5.8, 0.3, 7.8, 0x383e36, 1.0, 6.2, 0, null);

  // Front Observation Catwalk (y = 6.2, matching hqSlots)
  B(g, 2.6, 0.3, 10.4, 0x363b40, -2.7, 6.05, 0, null);
  for (const z of [-4.2, -2.7, 0, 2.7, 4.2]) {
    B(g, 0.45, 0.85, 1.1, 0x2d3238, -3.85, 6.6, z, null);
  }
  for (const sz of [-1, 1]) {
    B(g, 2.4, 0.7, 0.08, 0x282c30, -2.7, 6.55, sz * 5.15, null);
  }

  // Ground Floor Front Blast Entrance (-x)
  B(g, 0.2, 2.5, 2.4, 0x22262a, -4.05, 1.3, 0, null);
  B(g, 0.15, 2.2, 1.8, 0x2e3338, -4.12, 1.3, 0, null);
  B(g, 0.08, 0.1, 0.1, 0x00ff66, -4.22, 1.3, 0.8, null, { emissive: 0x00dd55 });
  B(g, 1.8, 0.25, 3.6, 0x363b42, -4.9, 2.7, 0, null);
  for (const sz of [-1.6, 1.6]) {
    B(g, 0.2, 2.6, 0.2, 0x363b42, -5.6, 1.3, sz, null);
  }

  // Concrete Jersey Barriers
  for (const sz of [-2.4, 2.4]) {
    B(g, 0.55, 0.9, 2.4, 0x888c92, -6.4, 0.45, sz, null);
    B(g, 0.57, 0.18, 2.4, 0xf2c94c, -6.4, 0.7, sz, null);
  }

  // Windows
  const glass = { emissive: 0x092238 };
  for (const z of [-3.6, 3.6]) {
    B(g, 0.1, 0.8, 1.4, 0x4fa8e0, -4.03, 1.6, z, null, glass);
    B(g, 0.25, 0.08, 1.5, 0x22262a, -4.1, 2.05, z, null);
  }
  B(g, 0.1, 0.9, 4.4, 0x4fa8e0, -1.82, 4.8, 0, null, glass);
  for (const sz of [-1, 1]) {
    B(g, 2.6, 0.9, 0.1, 0x4fa8e0, 1.0, 4.8, sz * 3.82, null, glass);
  }

  // Satcom Uplink Dish
  const satPod = new THREE.Group();
  satPod.position.set(1.8, 6.35, -2.4);
  B(satPod, 0.35, 0.8, 0.35, 0x444950, 0, 0.4, 0, null);
  const dishMesh = B(satPod, 0.2, 1.4, 1.4, 0xd0d4da, 0.1, 0.9, 0, null);
  dishMesh.rotation.z = 0.45;
  g.add(satPod);

  // Dual whip antennas
  for (const z of [2.2, 3.0]) {
    B(g, 0.08, 3.0, 0.08, 0x686e76, 2.4, 7.8, z, null);
  }

  // Rooftop HVAC
  B(g, 1.8, 0.9, 1.4, 0x363c35, 2.0, 6.8, 0, null);
  B(g, 0.08, 0.5, 1.0, 0x181a1c, 1.08, 6.8, 0, null);

  // Dual Tactical Warning Beacon Light Bar
  B(g, 0.35, 0.25, 1.5, 0x24282c, 0.8, 6.45, -2.5, null);
  const blinkRed = B(g, 0.35, 0.25, 0.65, 0xff2020, 0.8, 6.7, -2.9, null, { emissive: 0xcc0000 });
  const blinkBlue = B(g, 0.35, 0.25, 0.65, 0x2060ff, 0.8, 6.7, -2.1, null, { emissive: 0x0040ee });
  blinkRed.castShadow = false;
  blinkBlue.castShadow = false;
  blinks.push(blinkRed, blinkBlue);

  // Faction Flag (rotates anchored to pole, stripe stays locked)
  addFactionFlag(g, -6.0, 0, 4.2, 6.2, 2.0, 1.1, 0x2f6fd6, 0xffffff);

  g.userData.flag = g.userData.flag;
  g.userData.blink = blinkBlue;
  g.userData.blinks = blinks;
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
