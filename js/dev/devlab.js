// DEV LAB — model viewer + sandbox arena (main menu > DEV LAB). Lives outside the match flow:
// main.js hands the frame loop to DevLab.update() while app.state === 'devlab'.
//  - Viewer: any model on a turntable (orbit camera), animation preview, base level buttons, wall slots.
//  - Sandbox: a real Game ({ sandbox: true }) on a flat floor or the lane map. Spawn anything, set any
//    upgrade level instantly, inspect stats, change time speed. Uses the normal RTS controls for team 0.
import * as THREE from 'three';
import { UNITS, ITEMS, GAME, FACTIONS, ABILITIES, attackInterval, dps, baseLevelStats, reductionPct } from '../config.js';
import { UPGRADES, upgradesFor } from '../upgrades.js';
import { CAMPS, NEUTRAL_TEAM } from '../neutrals.js';
import * as M from '../models.js';
import { Game } from '../game.js';
import { Unit } from '../unit.js';
import { FOW, updateFogTexture } from '../fow.js';
import { OrbitCam } from './orbit.js';

const TEAM_NAMES = ['Medieval (you)', 'Modern', 'Neutral'];
const SPEEDS = [0, 0.25, 0.5, 1, 2, 4];
const STAT_ROWS = [['hp', 'HP'], ['damage', 'Damage'], ['attackSpeed', 'Atk speed'], ['range', 'Range'], ['armor', 'Armor'], ['ward', 'Ward'],
  ['moveSpeed', 'Move'], ['hpRegen', 'Regen'], ['evasion', 'Evasion %'], ['missChance', 'Miss %']];

// ---------- tiny DOM helper ----------
function h(tag, props = {}, ...kids) {
  const el = document.createElement(tag);
  for (const [k, v] of Object.entries(props)) {
    if (k === 'class') el.className = v;
    else if (k.startsWith('on')) el.addEventListener(k.slice(2), v);
    else if (k === 'html') el.innerHTML = v;
    else if (v !== false && v !== null && v !== undefined) el.setAttribute(k, v === true ? '' : v);
  }
  for (const c of kids.flat(Infinity)) if (c !== null && c !== undefined && c !== false) el.append(c);
  return el;
}
/** replaceChildren that flattens arrays and skips null/false. */
const fill = (el, ...kids) => el.replaceChildren(...kids.flat(Infinity).filter((k) => k !== null && k !== undefined && k !== false));
// The two bases and how they grow (models.js). `wallUnit` = the troop the base upgrade puts on its slots.
const BASES = [
  { key: 'castle', name: 'Castle', tiers: M.CASTLE_TIERS, build: M.buildCastle, slots: M.castleSlots, wallUnit: 'archer', facing: Math.PI / 2, upgrade: 'Battlement' },
  { key: 'hq', name: 'HQ', tiers: M.HQ_TIERS, build: M.buildHQ, slots: M.hqSlots, wallUnit: 'gunner', facing: -Math.PI / 2, upgrade: 'Overwatch' },
];
const fmt = (n) => (Math.abs(n - Math.round(n)) < 0.01 ? String(Math.round(n)) : n.toFixed(1));

// ---------- what the viewer can show ----------
const roster = new Set(Object.values(FACTIONS).flatMap((f) => f.units));
const creeps = new Set(CAMPS.flatMap((c) => c.units));
function unitGroup(id) { return roster.has(id) ? 'Troops' : creeps.has(id) ? 'Creeps' : 'Other units'; }
// theme: 'medieval' | 'modern' | 'any' (drives the viewer's All / Medieval / Modern filter; 'any' shows under both)
function buildCatalog() {
  const list = [
    { group: 'Buildings', theme: 'medieval', id: 'castle', name: 'Castle', build: (lv) => M.buildCastle(lv), tiers: M.CASTLE_TIERS, slots: true, wallUnit: 'archer', facing: Math.PI / 2 },
    { group: 'Buildings', theme: 'modern', id: 'hq', name: 'Modern HQ', build: (lv) => M.buildHQ(lv), tiers: M.HQ_TIERS, slots: true, wallUnit: 'gunner', facing: -Math.PI / 2 },
  ];
  for (const id of Object.keys(M.UNIT_BUILDERS)) list.push({ group: unitGroup(id), theme: UNITS[id]?.theme || 'any', id, name: UNITS[id]?.name || id, unit: id });
  const props = [['tree', 'Tree', 'medieval', () => M.buildTree(1, 0)], ['pine', 'Pine', 'medieval', () => M.buildPine(1)], ['rock', 'Rock', 'medieval', () => M.buildRock(1)],
    ['torch', 'Torch', 'medieval', M.buildTorch], ['arrow', 'Arrow', 'medieval', M.buildArrow],
    ['building', 'City block', 'modern', () => M.buildBuilding(6, 10, 5, 0x7d8794)], ['lamp', 'Street lamp', 'modern', M.buildLamp],
    ['barrel', 'Fire barrel', 'modern', () => M.buildBarrel(true)], ['dumpster', 'Dumpster', 'modern', M.buildDumpster], ['fence', 'Fence', 'modern', () => M.buildFence(4)],
    ['barrier', 'Barrier', 'modern', M.buildBarrier], ['bullet', 'Bullet', 'modern', M.buildBullet],
    ['crate', 'Crate', 'any', M.buildCrate], ['loot', 'Loot cube', 'any', () => M.buildLoot(0xf7c948)]];
  for (const [id, name, theme, build] of props) list.push({ group: 'Props & projectiles', theme, id, name, build });
  const order = ['Buildings', 'Troops', 'Creeps', 'Other units', 'Props & projectiles'];
  return list.sort((a, b) => order.indexOf(a.group) - order.indexOf(b.group));
}

/** Hemisphere + sun with a day/night blend (same palette idea as world.js). */
function addLights(scene, shadowHalf) {
  const hemi = new THREE.HemisphereLight(0xdfefff, 0x4a5a3a, 0.9);
  const sun = new THREE.DirectionalLight(0xfff1d6, 1.6);
  sun.position.set(-20, 45, 30); sun.castShadow = true;
  const sc = sun.shadow.camera;
  sc.left = -shadowHalf; sc.right = shadowHalf; sc.top = shadowHalf; sc.bottom = -shadowHalf; sc.near = 1; sc.far = 140;
  sun.shadow.bias = -0.0005; sun.shadow.mapSize.set(2048, 2048);
  scene.add(hemi, sun, sun.target);
  const day = { sky: new THREE.Color(0x9cc4e4), hs: new THREE.Color(0xdfefff), hg: new THREE.Color(0x4a5a3a), s: new THREE.Color(0xfff1d6) };
  const night = { sky: new THREE.Color(0x0d1530), hs: new THREE.Color(0x3a4f8a), hg: new THREE.Color(0x141a24), s: new THREE.Color(0x8fa8ff) };
  scene.background = day.sky.clone();
  return {
    sun,
    setNight(f) {
      scene.background.copy(day.sky).lerp(night.sky, f);
      hemi.color.copy(day.hs).lerp(night.hs, f); hemi.groundColor.copy(day.hg).lerp(night.hg, f);
      hemi.intensity = 0.9 - 0.48 * f;
      sun.color.copy(day.s).lerp(night.s, f); sun.intensity = 1.6 - 1.25 * f;
    },
    follow(x, z) { sun.position.set(x - 20, 45, z + 30); sun.target.position.set(x, 0, z); },
  };
}

export class DevLab {
  constructor(app, { renderer, scene, world, camera }) {
    this.app = app;
    this.renderer = renderer;
    this.mainScene = scene;
    this.world = world;
    this.mainCamera = camera;
    this.mode = 'viewer';
    this.catalog = buildCatalog();

    // ----- viewer scene -----
    this.vScene = new THREE.Scene();
    this.vLights = addLights(this.vScene, 20);
    const vFloor = new THREE.Mesh(new THREE.PlaneGeometry(80, 80), new THREE.MeshLambertMaterial({ color: 0x55703f }));
    vFloor.rotation.x = -Math.PI / 2; vFloor.position.y = -0.01; vFloor.receiveShadow = true;
    this.vGrid = new THREE.GridHelper(40, 40, 0x2a3a20, 0x3e5530); this.vGrid.position.y = 0.005;
    this.vAxes = new THREE.AxesHelper(3); this.vAxes.position.y = 0.02; this.vAxes.visible = false;
    this.vScene.add(vFloor, this.vGrid, this.vAxes);
    this.vCamera = new THREE.PerspectiveCamera(40, innerWidth / innerHeight, 0.05, 500);
    this.orbit = new OrbitCam(this.vCamera, renderer.domElement);
    // a sandbox game only used to build Unit instances for the viewer (never updated)
    this.vGame = new Game({ scene: this.vScene, playerTeam: 0, world: { terrain: null, castle: new THREE.Group(), hq: new THREE.Group() }, sandbox: true });
    this.view = { entry: null, filter: 'all', level: 3, anim: 'idle', animSpeed: 1, spin: true, wire: false, bounds: false, grid: true, axes: false,
      night: false, scaleRef: false, slots: true, wallTroops: false };
    this.wired = new Set();

    // ----- flat arena scene -----
    this.aScene = new THREE.Scene();
    this.aLights = addLights(this.aScene, 45);
    this.aScene.fog = new THREE.Fog(0x9cc4e4, 110, 200);
    const aFloor = new THREE.Mesh(new THREE.PlaneGeometry(400, 200), new THREE.MeshLambertMaterial({ color: 0x5c8a3a }));
    aFloor.rotation.x = -Math.PI / 2; aFloor.position.y = -0.02; aFloor.receiveShadow = true;
    const aGrid = new THREE.GridHelper(140, 70, 0x456a2c, 0x4f7a34); aGrid.scale.z = 0.5; aGrid.position.y = 0.002;
    const lane = new THREE.Mesh(new THREE.PlaneGeometry(GAME.baseX * 2, GAME.laneHalfWidth * 2), new THREE.MeshLambertMaterial({ color: 0x8a6a42 }));
    lane.rotation.x = -Math.PI / 2; lane.position.y = -0.01; lane.receiveShadow = true;
    this.aScene.add(aFloor, aGrid, lane);
    this.aWorld = { terrain: null, castle: M.buildCastle(3), hq: M.buildHQ() };
    this.aScene.add(this.aWorld.castle, this.aWorld.hq);
    this.arena = { map: 'flat', speed: 1, step: 0, invulnBases: true, fog: false, team: 0, count: 1, hold: true, baseLevels: [GAME.baseLevel, GAME.baseLevel], upTeam: 0 };
    this.placing = null;
    this.t = 0;

    this.buildDOM();
    this.bindPlacement();
  }

  // ======================= lifecycle =======================
  open() {
    document.body.classList.add('devlab');
    this.setMode(this.mode);
  }
  close() {
    this.setPlacing(null);
    this.clearViewer();
    this.disposeArena();
    FOW.on.value = 0;
    this.orbit.enabled = false;
    this.app.controls.enabled = false;
    document.body.classList.remove('devlab');
  }
  setMode(mode) {
    this.mode = mode;
    this.root.dataset.mode = mode;
    this.tabs.forEach((b) => b.classList.toggle('on', b.dataset.mode === mode));
    this.setPlacing(null);
    if (mode === 'viewer') {
      this.disposeArena();
      this.app.controls.enabled = false;
      this.orbit.enabled = true;
      if (!this.view.entry) this.pick(this.catalog.find((e) => e.id === 'castle'));
      else this.renderViewerPanel();
    } else {
      this.clearViewer(); this.view.entry = null;
      this.orbit.enabled = false;
      this.startArena(this.arena.map);
    }
  }
  onEscape() {
    if (this.placing) { this.setPlacing(null); return; }
    if (this.app.controls.cancelTargeting?.()) return;
    this.app.closeDevLab();
  }

  // ======================= frame =======================
  update(dt) {
    this.t += dt;
    const r = this.renderer;
    if (this.mode === 'viewer') {
      FOW.on.value = 0;
      this.updateViewer(dt);
      this.vCamera.aspect = innerWidth / innerHeight; this.vCamera.updateProjectionMatrix();
      this.orbit.apply();
      r.render(this.vScene, this.vCamera);
      return;
    }
    const g = this.game; if (!g) return;
    const A = this.arena;
    const sdt = A.speed > 0 ? dt * A.speed : A.step;
    A.step = 0;
    if (sdt > 0) g.update(sdt, this.mainCamera.quaternion);
    if (!A.fog) this.revealAll(g);
    FOW.on.value = A.fog && g.vision ? 1 : 0;
    if (FOW.on.value) updateFogTexture(g.vision.vis[0], dt);
    const target = this.app.controls.target;
    if (A.map === 'flat') {
      this.aLights.setNight(g.dayNight.f);
      this.aLights.follow(target.x, target.z);
      this.aScene.fog.color.copy(this.aScene.background);
      g.bases.forEach((b) => this.animateBase(b.obj, dt));
    } else {
      this.world.setNight(g.dayNight.f);
      this.world.update(dt);
      this.world.followCamera(target);
      g.bases.forEach((b) => { if (b.obj !== this.world.castle && b.obj !== this.world.hq) this.animateBase(b.obj, dt); });
    }
    this.app.controls.update(dt);
    r.render(A.map === 'flat' ? this.aScene : this.mainScene, this.mainCamera);
    this.inspT = (this.inspT || 0) - dt;
    if (this.inspT <= 0) { this.inspT = 0.2; this.renderInspectorStats(); this.renderArenaStatus(); }
  }
  /** Torches, flags, blinkers, radar, rotor — whatever the base model has (world.js only animates the lane map's own bases). */
  animateBase(o, dt) {
    const d = o.userData;
    d.torches?.forEach((f, i) => f.scale.setScalar(0.85 + Math.sin(this.t * 13 + i * 2) * 0.12 + Math.random() * 0.06));
    if (d.flag) d.flag.rotation.y = Math.sin(this.t * 2.2) * 0.15;
    if (d.blink) d.blink.visible = (this.t % 1.2) < 0.5;
    if (d.radar) d.radar.rotation.y += dt * 1.2;
    if (d.rotor) d.rotor.rotation.y += dt * 0.6;
  }
  /** Sandbox default: everything visible (the fog toggle turns the normal line-of-sight rules back on). */
  revealAll(g) {
    for (const u of g.units) u.obj.visible = !u.hideModel;
    for (const p of g.projectiles) p.mesh.visible = true;
    for (const L of g.loot) L.mesh.visible = true;
  }

  // ======================= viewer =======================
  pick(entry) {
    this.clearViewer();
    this.view.entry = entry;
    const V = this.view;
    const holder = new THREE.Group();
    let model, unit = null;
    if (entry.unit) {
      unit = new Unit(this.vGame, entry.unit, 0);
      unit.ring.visible = false; unit.bar.visible = false; unit.shield.visible = false;
      unit.facing = 0; unit.obj.rotation.y = 0;
      if (unit.flying) unit.obj.position.y = GAME.flyHeight;
      model = unit.obj;
    } else model = entry.build(V.level);
    holder.add(model);
    holder.updateMatrixWorld(true);
    // measure the model in its rest pose (unit: just the rig, not ring/bar/shield)
    const box = new THREE.Box3().setFromObject(unit ? unit.rig.root : model);
    let meshes = 0, tris = 0; const mats = new Set();
    (unit ? unit.rig.root : model).traverse((o) => {
      if (!o.isMesh) return;
      meshes++; mats.add(o.material);
      const geo = o.geometry; tris += (geo.index ? geo.index.count : geo.attributes.position.count) / 3;
    });
    this.vModel = { holder, model, unit, box, meshes, tris, mats: mats.size, extras: [] };
    this.vScene.add(holder);
    this.orbit.frame(box);
    this.addViewerExtras();
    this.applyViewerToggles();
    this.renderViewerPanel();
    this.renderList();
  }
  /** Wall slot markers / wall troops on a base, scale reference troop, bounding box. */
  addViewerExtras() {
    const vm = this.vModel, V = this.view, E = V.entry;
    for (const x of vm.extras) { x.parent?.remove(x); x.userData.unit?.dispose(); }
    vm.extras = [];
    const add = (o) => { vm.holder.add(o); vm.extras.push(o); return o; };
    if (E.slots && V.slots) {
      for (const s of vm.model.userData.slots || []) {
        const m = add(new THREE.Mesh(M.boxGeo(0.8, 0.12, 0.8), new THREE.MeshBasicMaterial({ color: 0x5dff7a, transparent: true, opacity: 0.85 })));
        m.position.set(s.x, s.y + 0.06, s.z);
      }
    }
    if (E.slots && V.wallTroops) {
      for (const s of vm.model.userData.slots || []) {
        const u = new Unit(this.vGame, E.wallUnit, 0);
        u.ring.visible = false; u.bar.visible = false; u.shield.visible = false;
        u.obj.position.set(s.x, s.y, s.z); u.obj.rotation.y = E.facing;
        add(u.obj).userData.unit = u;
      }
    }
    if (V.scaleRef && E.id !== 'viking') {
      const u = new Unit(this.vGame, 'viking', 0);
      u.ring.visible = false; u.bar.visible = false; u.shield.visible = false;
      u.obj.position.set(vm.box.max.x + 1.2, 0, 0);
      add(u.obj).userData.unit = u;
    }
    if (V.bounds) {
      const helper = add(new THREE.Box3Helper(vm.box, 0xffd040));
      helper.userData.noSpin = true;
    }
  }
  applyViewerToggles() {
    const V = this.view, vm = this.vModel;
    this.vGrid.visible = V.grid;
    this.vAxes.visible = V.axes;
    this.vLights.setNight(V.night ? 1 : 0);
    this.restoreWire();
    if (V.wire && vm) {
      vm.holder.traverse((o) => {
        if (!o.isMesh) return;
        for (const m of Array.isArray(o.material) ? o.material : [o.material]) { if (!m.wireframe) { m.wireframe = true; this.wired.add(m); } }
      });
    }
  }
  restoreWire() { for (const m of this.wired) m.wireframe = false; this.wired.clear(); }
  clearViewer() {
    this.restoreWire();
    const vm = this.vModel; if (!vm) return;
    for (const x of vm.extras) x.userData.unit?.dispose();
    vm.unit?.dispose();
    this.vScene.remove(vm.holder);
    this.vModel = null;
  }
  updateViewer(dt) {
    const vm = this.vModel; if (!vm) return;
    const V = this.view;
    if (V.spin) vm.holder.rotation.y += dt * 0.5;
    this.animateBase(vm.model, dt);
    const u = vm.unit; if (!u) return;
    const adt = dt * V.animSpeed;
    u.moving = V.anim === 'walk';
    if (V.anim === 'attack') {
      this.atkT = (this.atkT || 0) - adt;
      if (this.atkT <= 0) { this.atkT = attackInterval(u.effAttackSpeed); u.swing = 1; u.aimT = 0.6; u.muzzleT = 0.06; }
    }
    u.animate(adt, u.stats.moveSpeed || 3);
  }

  renderViewerPanel() {
    const E = this.view.entry, vm = this.vModel, V = this.view; if (!E || !vm) return;
    const size = vm.box.getSize(new THREE.Vector3());
    const out = [];
    const p = { append: (...k) => out.push(...k) };
    p.append(h('h3', {}, E.name), h('div', { class: 'dl-muted' }, E.group + (E.unit ? ` · id ${E.unit}` : ` · ${E.id}`)));
    if (E.tiers) {
      const T = E.tiers[V.level - 1];
      p.append(h('div', { class: 'dl-sec' }, 'Level'),
        h('div', { class: 'dl-row dl-levels' }, E.tiers.map((t, i) => h('button', { class: 'dl-b' + (V.level === i + 1 ? ' on' : ''), title: t.name,
          onclick: () => { V.level = i + 1; this.pick(E); } }, String(i + 1)))),
        h('div', { class: 'dl-tier' }, h('b', {}, `Lv ${V.level} · ${T.name}`), h('div', {}, T.desc)),
        h('div', { class: 'dl-sec' }, 'Level stats'), this.baseStatsTable(E.wallUnit, V.level));
    }
    if (vm.unit) {
      const d = UNITS[E.unit], s = vm.unit.stats;
      p.append(h('div', { class: 'dl-sec' }, 'Animation'),
        h('div', { class: 'dl-row' }, ['idle', 'walk', 'attack'].map((a) => h('button', { class: 'dl-b' + (V.anim === a ? ' on' : ''),
          onclick: () => { V.anim = a; this.atkT = 0; this.renderViewerPanel(); } }, a))),
        this.slider('Speed', 0.1, 2, 0.05, V.animSpeed, (v) => (V.animSpeed = v), (v) => v.toFixed(2) + 'x'));
      if (d) {
        p.append(h('div', { class: 'dl-sec' }, 'Stats'), h('table', { class: 'dl-stats' },
          [['Cost', d.cost], ['Family', d.family], ['Type', d.type + (d.flying ? ' · flying' : '')], ...STAT_ROWS.map(([k, n]) => [n, fmt(s[k] || 0)])]
            .map(([a, b]) => h('tr', {}, h('td', {}, a), h('td', {}, String(b ?? '—'))))));
        const ab = (d.abilities || []).map((id) => ABILITIES[id]?.name || id);
        if (ab.length) p.append(h('div', { class: 'dl-muted' }, 'Abilities: ' + ab.join(', ')));
      }
    }
    p.append(h('div', { class: 'dl-sec' }, 'Display'),
      this.check('Turntable', 'spin'), this.check('Wireframe', 'wire'), this.check('Bounding box', 'bounds', true), this.check('Grid', 'grid'),
      this.check('Axes', 'axes'), this.check('Night lighting', 'night'), this.check('Scale reference (Viking)', 'scaleRef', true),
      E.slots ? this.check('Wall slots', 'slots', true) : null, E.slots ? this.check(`${UNITS[E.wallUnit].name}s on wall slots`, 'wallTroops', true) : null,
      h('div', { class: 'dl-sec' }, 'Model'),
      h('table', { class: 'dl-stats' }, [['Size (w×h×d)', `${size.x.toFixed(1)} × ${size.y.toFixed(1)} × ${size.z.toFixed(1)}`], ['Boxes', vm.meshes], ['Triangles', vm.tris], ['Materials', vm.mats]]
        .map(([a, b]) => h('tr', {}, h('td', {}, a), h('td', {}, String(b))))),
      h('button', { class: 'dl-b wide', onclick: () => this.orbit.frame(vm.box) }, 'Re-frame camera'));
    fill(this.rightEl, out);
  }
  /**
   * Base stats at a level, with the change from the level below. Firepower = spots x the wall troop's
   * damage per second (unupgraded) — what a full Battlement / Overwatch adds at that level.
   */
  baseStatsTable(wallUnit, L) {
    const S = baseLevelStats(L), P = L > 1 ? baseLevelStats(L - 1) : null, W = UNITS[wallUnit];
    const fire = (X) => X.slots * dps(W);
    const row = (name, val, prev, show = fmt) => h('tr', {}, h('td', {}, name),
      h('td', {}, show(val), prev !== null && val !== prev ? h('em', { class: val > prev ? 'up' : 'down' }, ` ${val > prev ? '+' : ''}${show(val - prev)}`) : null));
    return h('table', { class: 'dl-stats' },
      row('HP', S.hp, P?.hp ?? null),
      row('Armor', S.armor, P?.armor ?? null),
      row('Damage reduction', reductionPct(S.armor), P ? reductionPct(P.armor) : null, (v) => v.toFixed(1) + '%'),
      row('Vision (day)', S.vision[0], P?.vision[0] ?? null),
      row('Vision (night)', S.vision[1], P?.vision[1] ?? null),
      row(`${W.name} spots`, S.slots, P?.slots ?? null),
      row('Wall firepower', fire(S), P ? fire(P) : null, (v) => v.toFixed(1) + '/s'));
  }
  check(label, key, rebuildExtras = false) {
    const V = this.view;
    return h('label', { class: 'dl-check' }, h('input', { type: 'checkbox', checked: V[key], onchange: (e) => {
      V[key] = e.target.checked;
      if (rebuildExtras) this.addViewerExtras();
      this.applyViewerToggles();
    } }), label);
  }
  slider(label, min, max, step, val, set, show = String) {
    const out = h('span', {}, show(val));
    return h('label', { class: 'dl-slider' }, label,
      h('input', { type: 'range', min, max, step, value: val, oninput: (e) => { const v = Number(e.target.value); set(v); out.textContent = show(v); } }), out);
  }

  // ======================= sandbox arena =======================
  startArena(map) {
    this.disposeArena();
    const A = this.arena; A.map = map;
    const flat = map === 'flat';
    const world = flat ? this.aWorld : this.world;
    const scene = flat ? this.aScene : this.mainScene;
    const g = new Game({ scene, playerTeam: 0, world, sandbox: true, getViewX: () => this.app.controls.target.x });
    this.game = g;
    g.teams.forEach((T) => { T.gold = 1e6; T.income = 0; });
    g.bases.forEach((b) => (b.invulnerable = A.invulnBases));
    g.time = GAME.dayNight.fade + 1;
    A.baseLevels.forEach((L, team) => this.setBaseLevel(team, L));
    const c = this.app.controls;
    c.setGame(g, 0);
    c.enabled = true; c.setArmed(false);
    c.height = 30;
    c.centerOn(-GAME.baseX + 22, 0);
    this.renderArenaPanels();
  }
  disposeArena() {
    if (!this.game) return;
    this.game.dispose();
    this.game = null;
    this.app.controls.setSelection?.([]);
  }
  /**
   * Set a base's level directly (stats + model; Game.dispose puts the world's own models back).
   * Keeps the Fortify / Expand HQ level in step so the upgrade panel matches.
   */
  setBaseLevel(team, L) {
    const g = this.game; if (!g) return;
    this.arena.baseLevels[team] = L;
    g.setBaseLevel(team, L);
    g.swapBaseModel(team, L);
    const up = Object.values(UPGRADES).find((U) => U.faction === g.teams[team].faction && U.effects?.some((e) => e.type === 'baseLevel'));
    if (up) g.teams[team].upLevels[up.id] = Math.max(0, L - GAME.baseLevel);
  }
  /** Rebuild a team's upgrades from scratch at the given levels (lets the panel go down a level too). */
  setUpgradeLevels(team, levels) {
    const g = this.game, T = g.teams[team];
    for (let i = g.units.length - 1; i >= 0; i--) {
      const u = g.units[i];
      if (u.tower && u.team === team) { u.dispose(); g.units.splice(i, 1); }
    }
    T.upLevels = {}; T.unitMods = {}; T.costAdd = {}; T.grants = {}; T.towers = 0; T.income = 0;
    const b = g.bases[team]; b.bonusHp = 0;
    g.setBaseLevel(team, GAME.baseLevel); g.swapBaseModel(team, GAME.baseLevel);
    b.maxHp = b.hp = baseLevelStats(b.level).hp;
    for (const u of g.units) if (u.team === team) u.abil = u.abil.filter((a) => !a.def.granted);
    const baseFirst = (U) => (UPGRADES[U[0]]?.effects?.some((e) => e.type === 'baseLevel') ? 0 : 1);   // base level first: it decides wall spots
    for (const [id, n] of Object.entries(levels).sort((a, b) => baseFirst(a) - baseFirst(b))) for (let k = 0; k < Math.min(n, g.upgradeMax(team, UPGRADES[id])); k++) g.applyUpgrade(team, id);
    for (const u of g.units) if (!u.dead && u.team === team) { u.syncAbilities(); u.recalcStats(); }
    this.renderUpgrades();
  }
  bumpUpgrade(team, id, d) {
    const T = this.game.teams[team], U = UPGRADES[id];
    const cap = this.game.upgradeMax(team, U);
    const cur = T.upLevels[id] || 0, next = Math.max(0, Math.min(cap === Infinity ? 99 : cap, cur + d));
    if (next === cur) return;
    if (d > 0 && next === cur + 1) { this.game.applyUpgrade(team, id); this.syncBaseLevels(); this.renderArenaPanels(); return; }
    this.setUpgradeLevels(team, { ...T.upLevels, [id]: next });
    this.syncBaseLevels(); this.renderArenaPanels();
  }
  syncBaseLevels() { this.game.bases.forEach((b, t) => (this.arena.baseLevels[t] = b.level)); }
  spawnAt(id, x, z) {
    const g = this.game, A = this.arena; if (!g) return;
    const team = A.team;
    for (let k = 0; k < A.count; k++) {
      const a = (k / A.count) * Math.PI * 2, r = A.count > 1 ? 0.8 + 0.25 * A.count : 0;
      const u = new Unit(g, id, team);
      u.spawnAt(x + Math.cos(a) * r, z + Math.sin(a) * r);
      if (team === NEUTRAL_TEAM) {
        u.home = { x: u.pos.x, z: u.pos.z };
        u.camp = CAMPS.find((c) => c.units.includes(id)) || CAMPS[0];
        u.nState = 'home';
      } else if (A.hold) u.command({ type: 'idle' });
      u.invulnT = 0; u.shield.visible = false;
      g.units.push(u); g.scene.add(u.obj);
    }
    g.burst({ x, z }, 8, [0xffffff, 0x9ad8ff], 2, 0.5);
  }
  setPlacing(id) {
    this.placing = id;
    document.body.classList.toggle('dl-placing', !!id);
    this.spawnEl?.querySelectorAll('button[data-unit]').forEach((b) => b.classList.toggle('on', b.dataset.unit === id));
    if (this.hintEl) this.hintEl.textContent = id ? `Placing ${UNITS[id].name} — left-click the ground (Shift = keep placing), right-click / Esc to stop`
      : this.mode === 'viewer' ? 'Drag = rotate · Right/Shift-drag = pan · Wheel = zoom · Esc = back to menu'
        : 'Normal RTS controls for your (Medieval) troops · pick a unit on the left to place it · Esc = back to menu';
  }
  /** Runs before Controls (window capture) so a placement click doesn't also select/box-drag. */
  bindPlacement() {
    const canvas = this.renderer.domElement;
    addEventListener('mousedown', (e) => {
      if (this.app.state !== 'devlab' || this.mode !== 'sandbox' || !this.placing || e.target !== canvas) return;
      e.stopImmediatePropagation(); e.preventDefault();
      if (e.button === 2) { this.setPlacing(null); return; }
      if (e.button !== 0) return;
      const p = this.app.controls.groundAt(e.clientX, e.clientY);
      if (p) this.spawnAt(this.placing, p.x, p.z);
      if (!e.shiftKey) this.setPlacing(null);
    }, true);
  }
  onSelection() { this.renderInspector(); }

  // ----- sandbox panels -----
  renderArenaPanels() {
    const A = this.arena;
    // LEFT: spawn + upgrades
    const groups = { Medieval: FACTIONS.medieval.units, Modern: FACTIONS.modern.units,
      Creeps: [...creeps], Other: Object.keys(UNITS).filter((id) => !roster.has(id) && !creeps.has(id)) };
    this.spawnEl = h('div', {},
      h('div', { class: 'dl-sec' }, 'Spawn'),
      h('div', { class: 'dl-row' }, TEAM_NAMES.map((n, t) => h('button', { class: 'dl-b team' + t + (A.team === t ? ' on' : ''), onclick: () => { A.team = t; this.renderArenaPanels(); } }, n.split(' ')[0]))),
      h('div', { class: 'dl-row' }, [1, 3, 5, 10].map((n) => h('button', { class: 'dl-b' + (A.count === n ? ' on' : ''), onclick: () => { A.count = n; this.renderArenaPanels(); } }, '×' + n)),
        h('label', { class: 'dl-check inline', title: 'Spawned troops hold position instead of charging the enemy base' },
          h('input', { type: 'checkbox', checked: A.hold, onchange: (e) => (A.hold = e.target.checked) }), 'Hold')),
      Object.entries(groups).filter(([, ids]) => ids.length).map(([gname, ids]) => [
        h('div', { class: 'dl-sub' }, gname),
        h('div', { class: 'dl-grid' }, ids.filter((id) => UNITS[id]).map((id) => h('button', { class: 'dl-b', 'data-unit': id, onclick: () => this.setPlacing(this.placing === id ? null : id) }, UNITS[id].name))),
      ]));
    this.upEl = h('div');
    fill(this.leftEl, this.spawnEl, this.upEl);
    this.renderUpgrades();
    // RIGHT: arena + castle + inspector
    this.statusEl = h('div', { class: 'dl-muted' });
    fill(this.rightEl, 
      h('div', { class: 'dl-sec' }, 'Arena'),
      h('div', { class: 'dl-row' }, [['flat', 'Flat floor'], ['main', 'Lane map']].map(([m, n]) => h('button', { class: 'dl-b' + (A.map === m ? ' on' : ''), onclick: () => { if (A.map !== m) this.startArena(m); } }, n))),
      h('div', { class: 'dl-row' }, SPEEDS.map((s) => h('button', { class: 'dl-b' + (A.speed === s ? ' on' : ''), onclick: () => { A.speed = s; this.renderArenaPanels(); } }, s === 0 ? '❚❚' : s + 'x')),
        h('button', { class: 'dl-b', title: 'Advance one frame (while paused)', onclick: () => { A.speed = 0; A.step = 1 / 30; this.renderArenaPanels(); } }, 'Step')),
      h('div', { class: 'dl-row' },
        h('button', { class: 'dl-b', onclick: () => (this.game.time = GAME.dayNight.fade + 1) }, 'Day'),
        h('button', { class: 'dl-b', onclick: () => (this.game.time = GAME.dayNight.half + GAME.dayNight.fade + 1) }, 'Night'),
        h('button', { class: 'dl-b', onclick: () => this.clearUnits() }, 'Clear troops'),
        h('button', { class: 'dl-b', onclick: () => this.startArena(A.map) }, 'Reset')),
      h('label', { class: 'dl-check' }, h('input', { type: 'checkbox', checked: A.invulnBases, onchange: (e) => { A.invulnBases = e.target.checked; this.game.bases.forEach((b) => (b.invulnerable = A.invulnBases)); } }), 'Bases invulnerable'),
      A.map === 'main' ? h('label', { class: 'dl-check' }, h('input', { type: 'checkbox', checked: A.fog, onchange: (e) => (A.fog = e.target.checked) }), 'Fog of war (your side)') : null,
      this.statusEl,
      h('div', { class: 'dl-sec' }, 'Base levels'),
      BASES.map((D, team) => [
        h('div', { class: 'dl-row dl-levels' }, h('span', { class: 'dl-base-n' }, D.name),
          D.tiers.map((t, i) => h('button', { class: 'dl-b team' + team + (A.baseLevels[team] === i + 1 ? ' on' : ''), title: t.name,
            onclick: () => { this.setBaseLevel(team, i + 1); this.renderArenaPanels(); } }, String(i + 1)))),
        h('div', { class: 'dl-muted' }, `${D.tiers[A.baseLevels[team] - 1].name} · ${D.slots(A.baseLevels[team]).length} slots (${D.upgrade} fills them)`),
      ]),
      this.inspEl = h('div'));
    this.renderInspector();
    this.setPlacing(this.placing);
  }
  renderUpgrades() {
    const g = this.game, A = this.arena; if (!g || !this.upEl) return;
    const T = g.teams[A.upTeam];
    const list = upgradesFor(T.faction);
    fill(this.upEl, 
      h('div', { class: 'dl-sec' }, 'Upgrades'),
      h('div', { class: 'dl-row' }, [0, 1].map((t) => h('button', { class: 'dl-b team' + t + (A.upTeam === t ? ' on' : ''), onclick: () => { A.upTeam = t; this.renderUpgrades(); } }, TEAM_NAMES[t].split(' ')[0])),
        h('button', { class: 'dl-b', onclick: () => this.setUpgradeLevels(A.upTeam, Object.fromEntries(list.map((U) => { const c = g.upgradeMax(A.upTeam, U); return [U.id, c === Infinity ? 5 : c]; }))) }, 'Max'),
        h('button', { class: 'dl-b', onclick: () => this.setUpgradeLevels(A.upTeam, {}) }, 'Reset')),
      list.map((U) => {
        const lvl = T.upLevels[U.id] || 0;
        return h('div', { class: 'dl-up' + (lvl ? ' has' : '') },
          h('div', { class: 'dl-up-n' }, h('b', {}, U.name), h('span', {}, ` ${lvl}/${U.max === Infinity ? '∞' : g.upgradeMax(A.upTeam, U)}`),
            g.upgradeMax(A.upTeam, U) < U.max ? h('span', { class: 'dl-muted', title: 'Raise the base level for more spots' }, ` (base cap, max ${U.max})`) : null,
            h('div', { class: 'dl-muted' }, lvl && U.levelText ? U.levelText(lvl, U) : U.category + (U.unit ? ' · ' + (UNITS[U.unit]?.name || U.unit) : ''))),
          h('button', { class: 'dl-b sq', onclick: () => this.bumpUpgrade(A.upTeam, U.id, -1) }, '−'),
          h('button', { class: 'dl-b sq', onclick: () => this.bumpUpgrade(A.upTeam, U.id, 1) }, '+'));
      }));
  }
  clearUnits() {
    const g = this.game;
    for (let i = g.units.length - 1; i >= 0; i--) { const u = g.units[i]; if (!u.tower) { u.dispose(); g.units.splice(i, 1); } }
    this.app.controls.setSelection?.([]);
    this.renderInspector();
  }
  renderArenaStatus() {
    const g = this.game; if (!g || !this.statusEl) return;
    const n = [0, 1, 2].map((t) => g.units.filter((u) => !u.dead && !u.tower && u.team === t).length);
    const dn = g.dayNight;
    this.statusEl.textContent = `Troops ${n[0]} vs ${n[1]} · creeps ${n[2]} · ${dn.night ? 'night' : 'day'} · bases ${g.bases.map((b) => Math.round(b.hp)).join(' / ')}`;
  }
  // ----- unit inspector -----
  get inspected() { const s = this.app.controls.selection; return s?.length ? s[0] : null; }
  renderInspector() {
    if (!this.inspEl) return;
    const u = this.inspected;
    if (!u && this.app.controls.selectedBase) return this.renderBaseInspector(this.app.controls.selectedBase);
    if (!u) { fill(this.inspEl, h('div', { class: 'dl-sec' }, 'Inspector'), h('div', { class: 'dl-muted' }, 'Select a troop (click it) to inspect it. Enemy and creep troops can be selected too.')); this.inspStats = null; return; }
    const sel = this.app.controls.selection.length;
    this.inspStats = h('table', { class: 'dl-stats wide' });
    const itemSel = h('select', { class: 'dl-sel' }, h('option', { value: '' }, '+ give item…'), Object.values(ITEMS).map((it) => h('option', { value: it.id }, it.name)));
    itemSel.addEventListener('change', () => { if (itemSel.value) { u.addItem(itemSel.value); this.renderInspector(); } });
    fill(this.inspEl,
      h('div', { class: 'dl-sec' }, 'Inspector' + (sel > 1 ? ` (1 of ${sel})` : '')),
      h('h3', {}, u.def.name), h('div', { class: 'dl-muted' }, `${TEAM_NAMES[u.team]} · ${u.def.family || '—'} · ${u.ranged ? 'ranged' : 'melee'}${u.flying ? ' · flying' : ''}`),
      this.inspStats,
      h('div', { class: 'dl-muted' }, 'Abilities: ' + (u.abil.map((a) => a.def.name + (a.def.granted ? '*' : '')).join(', ') || '—')),
      h('div', { class: 'dl-sub' }, 'Items'),
      h('div', { class: 'dl-items' }, u.items.map((id, i) => h('button', { class: 'dl-b' + (id ? '' : ' empty'), title: id ? 'Remove' : '', onclick: () => { if (id) { u.removeItem(i); this.renderInspector(); } } }, id ? ITEMS[id].name + ' ×' : '—'))),
      itemSel,
      h('div', { class: 'dl-row' },
        h('button', { class: 'dl-b', onclick: () => (u.hp = u.maxHp) }, 'Heal'),
        h('button', { class: 'dl-b', onclick: () => (u.invulnT = u.invulnT > 1000 ? 0 : 1e9) }, 'God mode'),
        h('button', { class: 'dl-b', onclick: () => { if (!u.dead) { u.hp = 0; u.die(null); } } }, 'Kill')));
    this.renderInspectorStats();
  }
  renderBaseInspector(b) {
    const D = BASES[b.team];
    this.inspStats = h('table', { class: 'dl-stats wide' });
    this.inspStats.dataset.base = b.team;
    fill(this.inspEl,
      h('div', { class: 'dl-sec' }, 'Inspector'),
      h('h3', {}, `${D.tiers[b.level - 1].name}`), h('div', { class: 'dl-muted' }, `${TEAM_NAMES[b.team]} ${D.name} · level ${b.level}`),
      this.inspStats,
      h('div', { class: 'dl-row' },
        h('button', { class: 'dl-b', onclick: () => (b.hp = b.maxHp) }, 'Repair'),
        h('button', { class: 'dl-b', onclick: () => (b.hp = Math.max(1, b.hp - b.maxHp * 0.25)) }, '−25% HP')));
    this.renderInspectorStats();
  }
  renderInspectorStats() {
    const sb = this.app.controls.selectedBase;
    if (!this.inspected && sb && this.inspStats?.dataset.base == sb.team) {
      const g = this.game, S = baseLevelStats(sb.level), towers = g.units.filter((u) => u.tower && u.team === sb.team);
      fill(this.inspStats,
        h('tr', {}, h('td', {}, 'HP'), h('td', {}, `${Math.ceil(sb.hp)} / ${Math.round(sb.maxHp)}` + (sb.bonusHp ? ` (+${sb.bonusHp} Reinforce)` : ''))),
        h('tr', {}, h('td', {}, 'Armor'), h('td', {}, fmt(sb.armor))),
        h('tr', {}, h('td', {}, 'Vision'), h('td', {}, `${S.vision[0]} day / ${S.vision[1]} night`)),
        h('tr', {}, h('td', {}, 'Wall troops'), h('td', {}, `${towers.length} / ${S.slots} spots`)),
        h('tr', {}, h('td', {}, 'Wall firepower'), h('td', {}, towers.reduce((a, u) => a + dps(u.stats), 0).toFixed(1) + '/s')),
        h('tr', {}, h('td', {}, 'Invulnerable'), h('td', {}, sb.invulnerable ? 'yes' : 'no')));
      return;
    }
    const u = this.inspected, t = this.inspStats; if (!u || !t) return;
    if (u.dead) { fill(t, h('tr', {}, h('td', {}, 'Dead'))); return; }
    const eff = { damage: u.effDamage, attackSpeed: u.effAttackSpeed, range: u.effRange, moveSpeed: u.effMoveSpeed, evasion: u.effEvasion };
    fill(t,
      h('tr', { class: 'hd' }, h('td', {}, ''), h('td', {}, 'base'), h('td', {}, 'bonus'), h('td', {}, 'now')),
      h('tr', {}, h('td', {}, 'HP'), h('td', {}, fmt(u.base.hp)), h('td', {}, fmt(u.bonus.hp)), h('td', {}, `${fmt(u.hp)}/${fmt(u.maxHp)}`)),
      STAT_ROWS.slice(1).map(([k, n]) => h('tr', {}, h('td', {}, n), h('td', {}, fmt(u.base[k] || 0)), h('td', {}, fmt(u.bonus[k] || 0)), h('td', {}, fmt(eff[k] ?? u.stats[k] ?? 0)))),
      u.maxMana ? h('tr', {}, h('td', {}, 'Mana'), h('td', {}), h('td', {}), h('td', {}, `${fmt(u.mana)}/${fmt(u.maxMana)}`)) : null,
      h('tr', {}, h('td', {}, 'Kills / dealt'), h('td', {}), h('td', {}), h('td', {}, `${u.kills} / ${fmt(u.damageDealt)}`)));
  }

  /** Viewer catalog with the All / Medieval / Modern filter on top. */
  renderList() {
    const V = this.view, cur = V.entry?.id;
    const shown = this.catalog.filter((e) => V.filter === 'all' || e.theme === V.filter || e.theme === 'any');
    let last = null;
    fill(this.listEl,
      h('div', { class: 'dl-row dl-filter' }, [['all', 'All'], ['medieval', 'Medieval'], ['modern', 'Modern']].map(([f, n]) =>
        h('button', { class: 'dl-b' + (V.filter === f ? ' on' : '') + (f === 'medieval' ? ' team0' : f === 'modern' ? ' team1' : ''), onclick: () => { V.filter = f; this.renderList(); } }, n))),
      shown.map((e) => [
        e.group !== last ? h('div', { class: 'dl-sub' }, (last = e.group)) : null,
        h('button', { class: 'dl-b item' + (e.id === cur ? ' on' : ''), 'data-id': e.id, onclick: () => this.pick(e) }, e.name),
      ]));
  }

  // ======================= DOM =======================
  buildDOM() {
    this.tabs = [['viewer', 'Model Viewer'], ['sandbox', 'Sandbox']].map(([m, n]) => h('button', { class: 'dl-tab', 'data-mode': m, onclick: () => this.setMode(m) }, n));
    this.listEl = h('div', { class: 'dl-list' });
    this.renderList();
    this.leftEl = h('div', { class: 'dl-arena-left' });
    this.rightEl = h('div', { class: 'dl-right-body' });
    this.hintEl = h('div', { class: 'dl-hint' });
    this.root = h('section', { id: 'scr-devlab', class: 'screen' },
      h('header', { class: 'dl-top' }, h('b', { class: 'dl-title' }, 'DEV LAB'), h('nav', {}, this.tabs),
        h('button', { class: 'dl-b', onclick: () => this.app.closeDevLab() }, '✕ Menu')),
      h('aside', { class: 'dl-panel dl-left' }, h('div', { class: 'dl-viewer-only' }, this.listEl), h('div', { class: 'dl-sandbox-only' }, this.leftEl)),
      h('aside', { class: 'dl-panel dl-right' }, this.rightEl),
      this.hintEl);
    document.body.append(this.root);
    this.root.addEventListener('mousedown', (e) => e.stopPropagation());   // panel clicks never reach the RTS controls
    this.setPlacing(null);
  }
}
