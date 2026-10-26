// Voxel connectivity check: finds boxes that float (don't touch the rest of the model).
//   node scripts/check-models.mjs                 -> every building with an upgrade tree, every level
//   node scripts/check-models.mjs howitzer cannon -> just those
// Each design is tested in 5 poses (rest, full elevation, full recoil, both, spinning parts turned) because
// a part can be attached at rest and come loose when the barrel moves. Hidden meshes (muzzle flash, exhaust,
// scaffold) are skipped. Exit code 1 if anything floats or dips below the ground, so it can run in CI.
import { register } from 'node:module';
register('data:text/javascript,' + encodeURIComponent(`
  export async function resolve(s, c, next) {
    return s === 'three' ? { url: new URL('../vendor/three.module.js', ${JSON.stringify(import.meta.url)}).href, shortCircuit: true } : next(s, c);
  }`));
const THREE = await import('three');
const { UNIT_BUILDERS } = await import('../js/models.js');
const { BUILD_TREES } = await import('../js/buildtree.js');

const PAD = 0.015;   // contact tolerance: boxes closer than 1.5 cm count as touching
const POSES = [
  { name: 'rest' }, { name: 'elevated', elev: -0.5 }, { name: 'recoil', recoil: -0.48 },
  { name: 'elevated+recoil', elev: -0.5, recoil: -0.48 }, { name: 'spun', spin: 1 },
];

function obb(mesh) {
  const p = mesh.geometry.parameters, c = new THREE.Vector3(), q = new THREE.Quaternion(), s = new THREE.Vector3();
  mesh.matrixWorld.decompose(c, q, s);
  const ax = [new THREE.Vector3(1, 0, 0), new THREE.Vector3(0, 1, 0), new THREE.Vector3(0, 0, 1)].map((v) => v.applyQuaternion(q));
  return { c, ax, h: [p.width * Math.abs(s.x) / 2 + PAD, p.height * Math.abs(s.y) / 2 + PAD, p.depth * Math.abs(s.z) / 2 + PAD] };
}
/** Separating-axis test for two oriented boxes. */
function touching(a, b) {
  const axes = [...a.ax, ...b.ax];
  for (const u of a.ax) for (const v of b.ax) axes.push(u.clone().cross(v));
  const d = b.c.clone().sub(a.c);
  return !axes.some((L) => {
    if (L.lengthSq() < 1e-10) return false;
    L.normalize();
    const ra = a.h.reduce((t, h, i) => t + h * Math.abs(a.ax[i].dot(L)), 0), rb = b.h.reduce((t, h, i) => t + h * Math.abs(b.ax[i].dot(L)), 0);
    return Math.abs(d.dot(L)) > ra + rb;
  });
}
function visibleMeshes(o, out = []) { if (!o.visible) return out; if (o.isMesh) out.push(o); for (const k of o.children) visibleMeshes(k, out); return out; }

export function check(rig) {
  rig.root.updateMatrixWorld(true);
  const ms = visibleMeshes(rig.root), ob = ms.map(obb);
  const par = ms.map((_, i) => i), find = (i) => (par[i] === i ? i : (par[i] = find(par[i])));
  for (let i = 0; i < ms.length; i++) for (let j = i + 1; j < ms.length; j++) if (touching(ob[i], ob[j])) par[find(i)] = find(j);
  const groups = new Map();
  ms.forEach((_, i) => groups.set(find(i), [...(groups.get(find(i)) || []), i]));
  const parts = [...groups.values()].sort((a, b) => b.length - a.length);
  const minY = new THREE.Box3().setFromObject(rig.root).min.y;
  const floating = parts.slice(1).map((g) => g.map((i) => new THREE.Box3().setFromObject(ms[i]).getCenter(new THREE.Vector3()).toArray().map((v) => +v.toFixed(2))));
  return { boxes: ms.length, floating, minY };
}

const steps = (id) => [[1, null], [2, null], ...['a', 'b'].flatMap((p) => [3, 4, 5].filter((l) => BUILD_TREES[id]?.[p]?.[l]).map((l) => [l, p]))];
const ids = process.argv.slice(2).length ? process.argv.slice(2) : Object.keys(BUILD_TREES);
let bad = 0;
for (const id of ids) {
  for (const [lvl, path] of steps(id)) {
    const label = `${id} ${path ? path.toUpperCase() : ''}${lvl}`;
    const issues = [];
    let boxes = 0;
    for (const pose of POSES) {
      const r = UNIT_BUILDERS[id](lvl, path);
      if (r.barrel) r.barrel.rotation.x = (r.rest || 0) + (pose.elev || 0);
      for (const rc of r.recoils?.length ? r.recoils : r.recoil ? [r.recoil] : []) rc.position.z = pose.recoil || 0;
      if (pose.spin) { if (r.drum) r.drum.rotation.z = pose.spin; if (r.radar) r.radar.rotation.y = pose.spin; for (const s of r.spins || []) s.rotation.z = pose.spin; }
      const res = check(r);
      boxes = Math.max(boxes, res.boxes);
      if (res.floating.length) issues.push(`  ${pose.name}: ${res.floating.length} floating group(s) at ${res.floating.map((g) => JSON.stringify(g[0]) + (g.length > 1 ? `(+${g.length - 1})` : '')).join(' ')}`);
      if (res.minY < -0.02) issues.push(`  ${pose.name}: dips ${(-res.minY).toFixed(2)} below the ground`);
    }
    console.log(`${issues.length ? 'FAIL' : 'ok  '} ${label.padEnd(20)} ${String(boxes).padStart(3)} boxes`);
    for (const l of issues) console.log(l);
    bad += issues.length ? 1 : 0;
  }
}
process.exit(bad ? 1 : 0);
