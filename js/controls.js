// Dota-style camera + RTS input: box select, right-click move/attack, A-click attack, S stop.
import * as THREE from 'three';
import { GAME } from './config.js';
import { settings } from './settings.js';
import { sfx } from './audio.js';

const groundPlane = new THREE.Plane(new THREE.Vector3(0, 1, 0), 0);

export class Controls {
  constructor(canvasGetter, camera, hooks) {
    this.getCanvas = canvasGetter;
    this.camera = camera;
    this.hooks = hooks; // { onSelectionChange, toast, trainHotkey, onCenter }
    this.target = new THREE.Vector3(-40, 0, 0);
    this.height = 34;
    this.enabled = false;
    this.game = null;
    this.team = 0;
    this.selection = [];
    this.armed = false;
    this.groups = {};
    this.lastGroupTap = { n: null, t: 0 };
    this.mouse = { x: innerWidth / 2, y: innerHeight / 2, inside: false };
    this.drag = null;
    this.mmDrag = null;
    this.keys = new Set();
    this.ray = new THREE.Raycaster();
    this.selBox = document.getElementById('selbox');
    this.bind();
    this.apply();
  }

  setGame(game, team) {
    this.game = game; this.team = team; this.selection = []; this.groups = {}; this.armed = false; this.selectedBase = null;
    if (this.hoverRing) { this.game.scene.remove(this.hoverRing, this.baseRing); this.hoverRing = null; }
    this.hooks.onSelectionChange?.();
  }

  // ---------------- camera ----------------
  apply() {
    const h = this.height;
    this.camera.position.set(this.target.x, h, this.target.z + h * 0.62);
    this.camera.lookAt(this.target.x, 0, this.target.z - 1.5);
  }
  clampTarget() {
    this.target.x = Math.max(-GAME.laneHalfLen - 4, Math.min(GAME.laneHalfLen + 4, this.target.x));
    this.target.z = Math.max(-26, Math.min(26, this.target.z));
  }
  centerOn(x, z = 0) { this.target.set(x, 0, z); this.clampTarget(); this.apply(); }

  update(dt) {
    if (this.enabled) {
      const k = settings.keys;
      const sp = 38 * settings.gameplay.panSpeed * (this.height / 30);
      let dx = 0, dz = 0;
      if (this.keys.has(k.panLeft)) dx -= 1;
      if (this.keys.has(k.panRight)) dx += 1;
      if (this.keys.has(k.panUp)) dz -= 1;
      if (this.keys.has(k.panDown)) dz += 1;
      if (settings.gameplay.edgePan && this.mouse.inside && !this.drag && !this.mmDrag) {
        const e = 14;
        if (this.mouse.x <= e) dx -= 1;
        if (this.mouse.x >= innerWidth - e) dx += 1;
        if (this.mouse.y <= e) dz -= 1;
        if (this.mouse.y >= innerHeight - e) dz += 1;
      }
      this.target.x += dx * sp * dt;
      this.target.z += dz * sp * dt * 0.7;
      this.clampTarget();
    }
    this.apply();
    this.updateRange(dt);
    this.updateHover();
    this.updateAiming();
    // prune dead units out of selection
    const gone = (u) => u.dead || (u.team !== this.team && !u.obj.visible);   // enemies that slip into the fog drop out of selection
    if (this.selection.some(gone)) {
      this.selection.forEach((u) => { if (gone(u)) u.selected = false; });
      this.selection = this.selection.filter((u) => !gone(u));
      this.hooks.onSelectionChange?.();
    }
  }

  // ---------------- single-unit attack-range circle (pixel dots) ----------------
  updateRange(dt) {
    const one = this.selection.length === 1 && !this.selection[0].dead ? this.selection[0] : null;
    if (!this.rangeMesh) {
      if (!this.game) return;
      const N = 160;
      const mat = new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.7, depthWrite: false });
      this.rangeMesh = new THREE.InstancedMesh(new THREE.BoxGeometry(0.34, 0.06, 0.34), mat, N);
      this.rangeMesh.frustumCulled = false;
      this.rangeMesh.renderOrder = 1;
      this.rangeKey = '';
      this.rangeT = 0;
      this.game.scene.add(this.rangeMesh);
    }
    const m = this.rangeMesh;
    if (!one) { m.visible = false; this.rangeKey = ''; return; }
    const r = one.effRange + one.radius + 0.45; // where an average enemy's center gets hit
    const key = one.id + ':' + r.toFixed(2);
    if (key !== this.rangeKey) {
      this.rangeKey = key;
      const n = Math.max(16, Math.min(m.instanceMatrix.count, Math.round((Math.PI * 2 * r) / 0.7)));
      const mx = new THREE.Matrix4(), q = new THREE.Quaternion();
      for (let i = 0; i < n; i++) {
        const a = (i / n) * Math.PI * 2;
        q.setFromAxisAngle(new THREE.Vector3(0, 1, 0), -a);
        mx.compose(new THREE.Vector3(Math.cos(a) * r, 0, Math.sin(a) * r), q, new THREE.Vector3(1, 1, 1));
        m.setMatrixAt(i, mx);
      }
      m.count = n;
      m.instanceMatrix.needsUpdate = true;
      m.material.color.setHex(one.team === this.team ? 0xb8ffc6 : 0xff8a8a);
    }
    this.rangeT += dt;
    m.material.opacity = 0.55 + Math.sin(this.rangeT * 4) * 0.15;
    m.rotation.y = this.rangeT * 0.15;
    m.position.set(one.pos.x, 0.08, one.pos.z);
    m.visible = true;
  }

  // ---------------- picking helpers ----------------
  groundAt(sx, sy) {
    const c = this.getCanvas();
    const r = c.getBoundingClientRect();
    const ndc = new THREE.Vector2(((sx - r.left) / r.width) * 2 - 1, -((sy - r.top) / r.height) * 2 + 1);
    this.ray.setFromCamera(ndc, this.camera);
    const p = new THREE.Vector3();
    return this.ray.ray.intersectPlane(groundPlane, p) ? p : null;
  }
  toScreen(v3, yOff = 0.9) {
    const v = new THREE.Vector3(v3.x, yOff, v3.z).project(this.camera);
    return { x: (v.x + 1) / 2 * innerWidth, y: (1 - v.y) / 2 * innerHeight, front: v.z < 1 };
  }
  /** Pick the troop under the cursor. Samples several points per troop (feet, body, and along the body when prone). */
  unitAt(sx, sy) {
    if (!this.game) return null;
    let best = null, bd = (36 * 30 / this.height) ** 2;
    for (const u of this.game.units) {
      if (u.dead || u.tower || u.untargetableUI || !u.obj.visible) continue;
      const pts = [[0, 1.0], [0, 0.3]];
      if (u.immobile) pts.push([0.7, 0.35], [1.4, 0.35]);            // prone: body lies forward
      for (const [fwd, y] of pts) {
        const p = { x: u.pos.x + Math.sin(u.facing) * fwd * 1.25, z: u.pos.z + Math.cos(u.facing) * fwd * 1.25 };
        const s = this.toScreen(p, y + (u.flying ? u.pos.y : 0));
        const d2 = (s.x - sx) ** 2 + ((s.y - sy) * 0.75) ** 2;
        if (d2 < bd) { bd = d2; best = u; }
      }
    }
    return best;
  }
  selectBase(b) {
    this.setSelection([]);
    this.selectedBase = b;
    this.hooks.onSelectionChange?.();
  }
  /** Hover feedback: thin ring under the troop (or base) the cursor is over. */
  updateHover() {
    if (!this.game) return;
    if (!this.hoverRing) {
      this.hoverRing = new THREE.Mesh(new THREE.RingGeometry(0.78, 0.9, 4, 1), new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.6, depthWrite: false }));
      this.hoverRing.rotation.x = -Math.PI / 2; this.hoverRing.rotation.z = Math.PI / 4; this.hoverRing.renderOrder = 2;
      this.baseRing = new THREE.Mesh(new THREE.RingGeometry(9.2, 9.8, 4, 1), new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.7, depthWrite: false }));
      this.baseRing.rotation.x = -Math.PI / 2; this.baseRing.rotation.z = Math.PI / 4; this.baseRing.renderOrder = 2;
      this.game.scene.add(this.hoverRing, this.baseRing);
    }
    const over = this.mouse.inside && this.enabled && !this.drag && document.elementFromPoint(this.mouse.x, this.mouse.y) === this.getCanvas();
    const u = over ? this.unitAt(this.mouse.x, this.mouse.y) : null;
    this.hovered = u;
    const hr = this.hoverRing;
    hr.visible = !!u && !u.selected;
    if (u) {
      const sc = 1.25 * (u.rig.scale || 1) * (u.immobile ? 1.5 : 1);
      hr.scale.setScalar(sc);
      hr.position.set(u.pos.x + (u.immobile ? Math.sin(u.facing) * 0.8 : 0), 0.07, u.pos.z + (u.immobile ? Math.cos(u.facing) * 0.8 : 0));
      hr.material.color.setHex(u.team === this.team ? 0xb8ffc6 : u.team === 2 ? 0xffe08a : 0xffa0a0);
    }
    const hb = !u && over ? this.baseAt(this.mouse.x, this.mouse.y) : null;
    const sb = this.selectedBase;
    const showB = sb || hb;
    this.baseRing.visible = !!showB;
    if (showB) {
      this.baseRing.position.set(showB.x, 0.08, 0);
      this.baseRing.material.color.setHex(showB.team === this.team ? 0x5dff7a : 0xff4a4a);
      this.baseRing.material.opacity = sb ? 0.85 : 0.4;
    }
    // loot on the ground: pointer + item tooltip, right-click to pick up
    const gp = over && !u && !hb && this.game.loot.length ? this.groundAt(this.mouse.x, this.mouse.y) : null;
    const L = gp ? this.game.lootNear(gp, 1.1) : null;
    this.hoverLoot = L;
    this.hooks.lootHover?.(L);
    this.getCanvas().style.cursor = this.armed ? 'crosshair' : L ? 'grab' : (u || hb) ? 'pointer' : '';
  }
  baseAt(sx, sy) {
    if (!this.game) return null;
    // ray-test the actual castle / HQ meshes first (clicking the tall walls works), then fall back to the ground footprint
    const c = this.getCanvas().getBoundingClientRect();
    this.ray.setFromCamera(new THREE.Vector2(((sx - c.left) / c.width) * 2 - 1, -((sy - c.top) / c.height) * 2 + 1), this.camera);
    let hit = null, hd = Infinity;
    for (const b of this.game.bases) {
      if (b.dead) continue;
      const h = this.ray.intersectObject(b.obj, true)[0];
      if (h && h.distance < hd) { hd = h.distance; hit = b; }
    }
    if (hit) return hit;
    const p = this.groundAt(sx, sy);
    if (!p) return null;
    for (const b of this.game.bases) {
      if (Math.abs(p.x - b.x) < GAME.baseHalfX + 1 && Math.abs(p.z) < GAME.baseHalfZ + 3) return b;
    }
    return null;
  }

  // ---------------- selection ----------------
  setSelection(list, additive = false) {
    this.selectedBase = null;
    let next = additive ? [...new Set([...this.selection, ...list])] : list;
    this.selection.forEach((u) => (u.selected = false, u.ring.visible = false));
    this.selection = next.filter((u) => !u.dead);
    this.selection.forEach((u) => (u.selected = true, u.ring.visible = true));
    this.hooks.onSelectionChange?.();
  }
  own() { return this.selection.filter((u) => u.team === this.team && !u.brainwashed); }

  // ---------------- orders ----------------
  formation(units, point) {
    const n = units.length;
    if (!n) return [];
    const cols = Math.ceil(Math.sqrt(n * 1.5));
    const sp = 1.35;
    const c = units.reduce((a, u) => (a.x += u.pos.x / n, a.z += u.pos.z / n, a), { x: 0, z: 0 });
    let fx = point.x - c.x, fz = point.z - c.z;
    const fl = Math.hypot(fx, fz);
    if (fl < 0.5) { fx = this.team === 0 ? 1 : -1; fz = 0; } else { fx /= fl; fz /= fl; }
    const rx = -fz, rz = fx;
    // melee fill the front rows, ranged stand behind them
    const sorted = [...units].sort((a, b) => (a.ranged - b.ranged) || ((b.pos.x * fx + b.pos.z * fz) - (a.pos.x * fx + a.pos.z * fz)));
    const out = [];
    for (let row = 0; row * cols < n; row++) {
      const chunk = sorted.slice(row * cols, row * cols + cols)
        .sort((a, b) => (a.pos.x * rx + a.pos.z * rz) - (b.pos.x * rx + b.pos.z * rz));
      const w = chunk.length;
      chunk.forEach((u, i) => {
        const off = (i - (w - 1) / 2) * sp;
        let x = point.x + rx * off - fx * row * sp;
        let z = point.z + rz * off - fz * row * sp;
        const lim = GAME.baseX - GAME.baseHalfX - 0.6;
        x = Math.max(-lim, Math.min(lim, x));
        z = Math.max(-GAME.mapHalfWidth, Math.min(GAME.mapHalfWidth, z));
        out.push([u, { x, z }]);
      });
    }
    return out;
  }

  issueMove(point, type = 'move') {
    const units = this.own();
    if (!units.length) return;
    if (units.some((u) => u.immobile)) this.hooks.toast?.('Prone snipers can\'t move — recast Snipe Stance to stand');
    for (const [u, p] of this.formation(units, point)) u.command({ type, point: p });
    this.game.marker(point, type === 'move' ? 0x5dff7a : 0xff5a3a);
    sfx(type === 'move' ? 'order' : 'attack');
  }
  issueAttack(target) {
    const units = this.own();
    if (!units.length) return;
    units.forEach((u) => u.command({ type: 'attack', target }));
    this.game.marker(target.pos, 0xff3a3a);
    sfx('attack');
  }
  /** Right-click an item on the ground: the closest selected troop with a free slot walks over and takes it. */
  issuePickup(L) {
    const free = this.own().filter((u) => u.items.includes(null));
    if (!free.length) { this.hooks.toast?.('Inventory full', 'err'); sfx('error', 150); return; }
    free.sort((a, b) => Math.hypot(a.pos.x - L.x, a.pos.z - L.z) - Math.hypot(b.pos.x - L.x, b.pos.z - L.z));
    free[0].command({ type: 'pickup', loot: L });
    this.game.marker(L, 0xfff3b0);
    sfx('order');
  }
  issueAttackBase(base) {
    // a real attack order on the base: troops keep hitting it and ignore fresh spawns (attack-move would retarget)
    const units = this.own();
    if (!units.length) return;
    units.forEach((u) => u.command({ type: 'attack', target: base }));
    this.game.marker({ x: base.team === 0 ? base.x + GAME.baseHalfX : base.x - GAME.baseHalfX, z: 0 }, 0xff3a3a);
    sfx('attack');
  }
  stop() {
    const units = this.own();
    if (!units.length) return;
    units.forEach((u) => { u.interrupt(); u.command({ type: 'idle' }); });
    sfx('order');
  }
  charge() {
    const units = this.own();
    if (!units.length) return;
    units.forEach((u) => u.command({ type: 'charge' }));
    sfx('attack');
  }
  /** Hotkey k (Q W E R T) = the k-th ACTIVE ability of the primary selected troop. */
  castActive(k) {
    const units = this.own();
    if (!units.length) return false;
    const i = units[0].activeSlot(k);
    return i >= 0 ? this.castSlot(i) : false;
  }
  /** Cast ability slot i on every selected troop of the primary troop's type. Ground-targeted abilities arm a targeting cursor first. */
  castSlot(i) {
    const units = this.own();
    if (!units.length) return false;
    const type = units[0].def.id;
    const a = units[0].abil[i];
    if (!a) return false;
    if (a.def.kind !== 'active') { this.hooks.toast?.(`${a.def.name} is passive`); return false; }
    const ready = units.filter((u) => u.def.id === type && u.abil[i]?.st.cd <= 0 && (u.abil[i].def.manaCost || 0) <= u.mana && !u.casting);
    if (!ready.length) { this.hooks.toast?.((a.def.manaCost || 0) > units[0].mana ? `Not enough mana for ${a.def.name}` : `${a.def.name} not ready`); return false; }
    if (a.def.cast === 'line') { this.setArmed(false); this.targeting = { slot: i, def: a.def, type }; document.body.classList.add('armed'); return true; }
    let n = 0;
    for (const u of ready) if (u.castAbility(i)) n++;
    return n > 0;
  }
  /** Ground-targeted cast: every ready troop of that type fires toward the clicked point. */
  targetClickAt(sx, sy) {
    const T = this.targeting; this.cancelTargeting();
    const p = this.groundAt(sx, sy); if (!T || !p) return;
    let n = 0;
    for (const u of this.own()) if (u.def.id === T.type && u.castAbility(T.slot, { x: p.x, z: p.z })) n++;
    if (n) sfx('attack');
  }
  cancelTargeting() {
    if (!this.targeting) return false;
    this.targeting = null; document.body.classList.toggle('armed', this.armed);
    if (this.aimMesh) this.aimMesh.visible = false;
    return true;
  }
  /** Line indicator from the primary caster toward the cursor (Dota-style range preview). */
  updateAiming() {
    const T = this.targeting;
    if (!T || !this.game) { if (this.aimMesh) this.aimMesh.visible = false; return; }
    const u = this.own().find((x) => x.def.id === T.type);
    if (!u) return this.cancelTargeting();
    if (!this.aimMesh) {
      this.aimMesh = new THREE.Mesh(new THREE.BoxGeometry(1, 0.05, 1), new THREE.MeshBasicMaterial({ color: 0x9ad8ff, transparent: true, opacity: 0.35, depthWrite: false }));
      this.aimMesh.material.userData.noFow = true; this.aimMesh.renderOrder = 6;
      this.game.scene.add(this.aimMesh);
    }
    const p = this.groundAt(this.mouse.x, this.mouse.y); if (!p) return;
    let dx = p.x - u.pos.x, dz = p.z - u.pos.z; const d = Math.hypot(dx, dz) || 1; dx /= d; dz /= d;
    const L = T.def.range;
    const m = this.aimMesh;
    m.visible = true; m.scale.set(T.def.width, 1, L);
    m.position.set(u.pos.x + dx * L / 2, 0.12 + Math.max(0, u.pos.y || 0), u.pos.z + dz * L / 2);
    m.rotation.y = Math.atan2(dx, dz);
  }
  setArmed(v) {
    this.armed = v && this.own().length > 0;
    document.body.classList.toggle('armed', this.armed);
  }
  selectAll() {
    if (!this.game) return;
    const all = this.game.units.filter((u) => u.team === this.team && !u.dead && !u.tower);
    if (!all.length) { this.hooks.toast?.('No troops on the field yet'); return; }
    this.setSelection(all);
  }
  rightClickAt(sx, sy) {
    if (!this.own().length) return;
    const gp = this.groundAt(sx, sy);
    const L = gp && this.game.lootNear(gp, 1.1);
    if (L) return this.issuePickup(L);
    const u = this.unitAt(sx, sy);
    if (u && u.team !== this.team) return this.issueAttack(u);
    const b = this.baseAt(sx, sy);
    if (b && b.team !== this.team) return this.issueAttackBase(b);
    const p = this.groundAt(sx, sy);
    if (p) this.issueMove(p, 'move');
  }
  armedClickAt(sx, sy) {
    const u = this.unitAt(sx, sy);
    if (u && u.team !== this.team) this.issueAttack(u);
    else {
      const b = this.baseAt(sx, sy);
      if (b && b.team !== this.team) this.issueAttackBase(b);
      else { const p = this.groundAt(sx, sy); if (p) this.issueMove(p, 'attackMove'); }
    }
    this.setArmed(false);
  }

  // ---------------- DOM wiring ----------------
  bind() {
    // only the 3D view counts — the minimap is also a <canvas> and must never start a box select
    const isCanvas = (e) => e.target === this.getCanvas();
    addEventListener('mousemove', (e) => {
      this.mouse.x = e.clientX; this.mouse.y = e.clientY; this.mouse.inside = true;
      if (this.drag) {
        const d = this.drag;
        d.x1 = e.clientX; d.y1 = e.clientY;
        if (Math.abs(d.x1 - d.x0) + Math.abs(d.y1 - d.y0) > 6) d.box = true;
        if (d.box) {
          const s = this.selBox.style;
          s.display = 'block';
          s.left = Math.min(d.x0, d.x1) + 'px'; s.top = Math.min(d.y0, d.y1) + 'px';
          s.width = Math.abs(d.x1 - d.x0) + 'px'; s.height = Math.abs(d.y1 - d.y0) + 'px';
        }
      }
      if (this.mmDrag) {
        const k = 0.06 * (this.height / 30);
        this.target.x -= (e.clientX - this.mmDrag.x) * k;
        this.target.z -= (e.clientY - this.mmDrag.y) * k;
        this.mmDrag = { x: e.clientX, y: e.clientY };
        this.clampTarget();
      }
    });
    document.addEventListener('mouseleave', () => { this.mouse.inside = false; });
    addEventListener('blur', () => { this.mouse.inside = false; this.keys.clear(); });

    addEventListener('mousedown', (e) => {
      if (!this.enabled || !isCanvas(e)) return;
      if (e.button === 0) {
        if (this.targeting) { this.targetClickAt(e.clientX, e.clientY); return; }
        if (this.armed) { this.armedClickAt(e.clientX, e.clientY); return; }
        this.drag = { x0: e.clientX, y0: e.clientY, x1: e.clientX, y1: e.clientY, box: false, shift: e.shiftKey };
      } else if (e.button === 2) {
        if (this.cancelTargeting()) return;
        if (this.armed) { this.setArmed(false); return; }
        this.rightClickAt(e.clientX, e.clientY);
      } else if (e.button === 1) {
        e.preventDefault();
        this.mmDrag = { x: e.clientX, y: e.clientY };
      }
    });
    addEventListener('mouseup', (e) => {
      if (e.button === 1) this.mmDrag = null;
      if (e.button !== 0 || !this.drag) return;
      const d = this.drag; this.drag = null;
      this.selBox.style.display = 'none';
      if (!this.enabled) return;
      if (d.box) {
        const x0 = Math.min(d.x0, d.x1), x1 = Math.max(d.x0, d.x1), y0 = Math.min(d.y0, d.y1), y1 = Math.max(d.y0, d.y1);
        const hits = this.game.units.filter((u) => {
          if (u.dead || u.tower || u.team !== this.team || u.brainwashed) return false;
          const s = this.toScreen(u.pos);
          return s.x >= x0 && s.x <= x1 && s.y >= y0 && s.y <= y1;
        });
        if (hits.length || !d.shift) this.setSelection(hits, d.shift);
      } else {
        const u = this.unitAt(d.x0, d.y0);
        if (u) {
          if (u.team !== this.team || u.brainwashed) this.setSelection([u]); // inspect enemy
          else if (d.shift && u.selected) this.setSelection(this.selection.filter((s) => s !== u));
          else this.setSelection([u], d.shift && this.selection.every((s) => s.team === this.team));
        } else {
          const b = this.baseAt(d.x0, d.y0);
          if (b) this.selectBase(b);
          else if (!d.shift) this.setSelection([]);
        }
      }
    });
    addEventListener('dblclick', (e) => {
      if (!this.enabled || !isCanvas(e)) return;
      const u = this.unitAt(e.clientX, e.clientY);
      if (u && u.team === this.team) this.setSelection(this.game.units.filter((o) => !o.dead && !o.tower && o.team === this.team && o.def.id === u.def.id));
    });
    addEventListener('contextmenu', (e) => e.preventDefault());
    addEventListener('wheel', (e) => {
      if (!this.enabled || !isCanvas(e)) return;
      this.height = Math.max(16, Math.min(56, this.height + Math.sign(e.deltaY) * 2.5 * settings.gameplay.zoomSpeed));
    }, { passive: true });

    addEventListener('keydown', (e) => {
      if (e.target && (e.target.tagName === 'INPUT' || e.target.tagName === 'SELECT')) return;
      this.keys.add(e.code);
      if (!this.enabled || e.repeat) return;
      const k = settings.keys;
      // 1) shop open -> its buy keys win over everything else (control groups, abilities)
      if (!e.ctrlKey && !e.metaKey && this.hooks.shopOpen?.()) {
        const id = (this.hooks.roster?.() || []).find((uid) => k['buy_' + uid] === e.code);
        if (id) { e.preventDefault(); this.hooks.buy?.(id, e.shiftKey); return; }
      }
      // 2) ability slots (Q W E R by default)
      const slot = ['abil1', 'abil2', 'abil3', 'abil4', 'abil5'].findIndex((a) => k[a] === e.code);
      if (slot >= 0 && this.own().length) { e.preventDefault(); this.castActive(slot); return; }
      // 3) control groups
      if (e.code.startsWith('Digit') && e.code !== 'Digit0') {
        const n = e.code.slice(5);
        if (e.ctrlKey || e.metaKey) {
          e.preventDefault();
          this.groups[n] = this.own();
          this.hooks.toast?.(`Group ${n} set (${this.groups[n].length})`);
        } else if (this.groups[n]) {
          const alive = this.groups[n].filter((u) => !u.dead);
          this.setSelection(alive);
          const now = performance.now();
          if (this.lastGroupTap.n === n && now - this.lastGroupTap.t < 350 && alive.length) {
            const cx = alive.reduce((a, u) => a + u.pos.x, 0) / alive.length;
            const cz = alive.reduce((a, u) => a + u.pos.z, 0) / alive.length;
            this.centerOn(cx, cz);
          }
          this.lastGroupTap = { n, t: now };
        }
        return;
      }
      if (e.code === k.attackMove) { e.preventDefault(); this.setArmed(true); }
      else if (e.code === k.stop) { this.cancelTargeting(); this.setArmed(false); this.stop(); }
      else if (e.code === k.charge) this.charge();
      else if (e.code === k.shop) this.hooks.toggleShop?.();
      else if (e.code === k.barracks) this.hooks.toggleBarracks?.();
      else if (e.code === k.repair) this.hooks.toggleRepair?.();
      else if (e.code === k.autoLoot) this.hooks.toggleAutoLoot?.();
      else if (e.code === k.selectAll) this.selectAll();
      else if (e.code === k.centerBase) { e.preventDefault(); this.hooks.onCenter?.(); }
      if (e.code.startsWith('Arrow')) e.preventDefault();
    });
    addEventListener('keyup', (e) => this.keys.delete(e.code));
  }

  // frustum footprint on the ground (for minimap)
  viewFootprint() {
    const c = this.getCanvas().getBoundingClientRect();
    const my = c.top + c.height / 2, mx = c.left + c.width / 2;
    const l = this.groundAt(c.left, my), r = this.groundAt(c.right, my);
    const t = this.groundAt(mx, c.top + 2), b = this.groundAt(mx, c.bottom);
    if (!l || !r || !t || !b) return null;
    return [{ x: l.x, z: t.z }, { x: r.x, z: t.z }, { x: r.x, z: b.z }, { x: l.x, z: b.z }];
  }
}
