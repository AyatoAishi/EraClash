// All DOM UI: menus, options, help, HUD, shop, selection panel + inventory, minimap, toasts.
import * as THREE from 'three';
import { UNITS, FACTIONS, GAME, DIFFICULTY, ITEMS, ABILITIES, FAMILIES, DEFENSES, DAMAGE_TYPES, reductionPct, dps, BASE_LEVELS, abilityText, canAutocast, tierOf, housingOf } from './config.js';
import { UNIT_BUILDERS, buildCastle, buildHQ, CASTLE_TIERS, HQ_TIERS, applyLook, animateFx } from './models.js';
import { TERRAIN } from './terrain.js';
import { SKILL_TREES, formDef, levelInfo, nextForms, formPath } from './skilltree.js';
import { settings, saveSettings, onSettingsChange, ACTIONS, SCOPE_LABEL, scopeOf, keyLabel, resetKeys, ITEM_SLOTS } from './settings.js';
import { sfx, applyAudioSettings, initAudio } from './audio.js';
import { ORDER_LABEL } from './unit.js';
import { PATCH_NOTES, CURRENT_VERSION, formatPatchDate } from './patchnotes.js';
import { UPGRADES, upgradePrice, upgradeTime, upgradesFor } from './upgrades.js';
import { BUILD_TREES, nextSteps } from './buildtree.js';
import { CAMPS, CAMP_RULES, CREEP_GROUPS, dropChanceForTier } from './neutrals.js';

const $ = (s, r = document) => r.querySelector(s);
const $$ = (s, r = document) => [...r.querySelectorAll(s)];
const SLOT_KEYS = ['abil1', 'abil2', 'abil3', 'abil4', 'abil5'];   // k-th ACTIVE ability -> hotkey
/** Display numbers with at most 2 decimals (3.9499999 -> 3.95, 4 -> 4). Strings pass through. */
export const fmt = (n) => (typeof n === 'number' ? +n.toFixed(2) : n);

// ---------- portraits: rendered small from the real voxel models, shown pixelated ----------
export const PORTRAITS = {};
export function makePortraits() {
  const r = new THREE.WebGLRenderer({ antialias: false, alpha: true, preserveDrawingBuffer: true });
  const sc = new THREE.Scene();
  sc.add(new THREE.HemisphereLight(0xffffff, 0x445566, 1.4));
  const dl = new THREE.DirectionalLight(0xffffff, 1.6); dl.position.set(2, 4, 5); sc.add(dl);
  const cam = new THREE.PerspectiveCamera(30, 1, 0.1, 50);
  const looks = [...Object.keys(UNITS).map((id) => [id, null]), ...Object.entries(SKILL_TREES).flatMap(([id, t]) => Object.keys(t).map((f) => [id, f]))];
  for (const [id, form] of looks) {
    const rig = applyLook(UNIT_BUILDERS[id](), form ? formDef(id, form).look : null);
    rig.root.rotation.y = -0.45;
    if (rig.style === 'bow') rig.armL.rotation.x = -1.2;
    if (rig.style === 'rifle') { rig.armR.rotation.x = -1.3; rig.armL.rotation.x = -1.4; rig.armL.rotation.z = 0.35; }
    for (const l of rig.level || []) l.obj.rotation.x = -l.arm.rotation.x;
    if (rig.fx) for (const f of rig.fx) { f.ph = Math.random(); } if (rig.fx) animateFx(rig, 0.01);   // spread form particles
    sc.add(rig.root);
    // buildings (towers / artillery) are bigger than troops: frame the whole model instead of a face
    const big = UNITS[id]?.structure ? new THREE.Box3().setFromObject(rig.root) : null;
    const bs = big ? big.getSize(new THREE.Vector3()) : null, bc = big ? big.getCenter(new THREE.Vector3()) : null, bd = big ? Math.max(bs.x, bs.y, bs.z) : 0;
    r.setSize(56, 56, false);
    if (big) { cam.position.set(bc.x + bd * 1.1, bc.y + bd * 0.7, bc.z + bd * 1.9); cam.lookAt(bc); }
    else { cam.position.set(0.9, 1.85, 2.5); cam.lookAt(0, 1.55, 0); }
    cam.aspect = 1; cam.fov = 30; cam.updateProjectionMatrix();
    r.render(sc, cam);
    const face = r.domElement.toDataURL();
    r.setSize(72, 96, false);
    if (big) { cam.position.set(bc.x + bd * 1.3, bc.y + bd * 0.6, bc.z + bd * 2.6); cam.lookAt(bc); }
    else { cam.position.set(1.7, 1.5, 5.6); cam.lookAt(0, 1.05, 0); }
    cam.aspect = 0.75; cam.fov = 30; cam.updateProjectionMatrix();
    r.render(sc, cam);
    const full = r.domElement.toDataURL();
    PORTRAITS[form ? id + ':' + form : id] = { face, full };
    sc.remove(rig.root);
    rig.matList.forEach((m) => m.dispose()); (rig.extraMats || []).forEach((m) => m.dispose());
  }
  // base portraits
  for (const [key, build] of [['base0', buildCastle], ['base1', buildHQ]]) {
    const obj = build(); obj.rotation.y = key === 'base0' ? -0.6 : Math.PI + 0.6;
    sc.add(obj);
    r.setSize(64, 64, false);
    cam.aspect = 1; cam.fov = 40; cam.position.set(22, 18, 22); cam.lookAt(0, 5, 0); cam.updateProjectionMatrix();
    r.render(sc, cam);
    PORTRAITS[key] = { face: r.domElement.toDataURL(), full: r.domElement.toDataURL() };
    sc.remove(obj);
  }
  r.dispose(); r.forceContextLoss?.();
}

/** Portrait of a unit definition (skill-tree forms have their own, e.g. 'viking:frenzy'). */
export const portraitOf = (def) => PORTRAITS[def.form ? def.id + ':' + def.form : def.id] || PORTRAITS[def.id];

function fmtTime(t) { const m = Math.floor(t / 60), s = Math.floor(t % 60); return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`; }
/** Ability icon. Pass a (form) unit definition `d` so the tooltip shows that form's exact numbers. */
const pIcon = (pid, extra = '', d = null) => {
  const A = d?.abilityMods?.[pid] ? { ...ABILITIES[pid], ...d.abilityMods[pid] } : ABILITIES[pid];
  return `<span class="pico ${A.kind}" data-tip="ability:${pid}${d?.form ? `:${d.id}:${d.form}` : ''}" ${extra}><svg><use href="#${A.icon}"/></svg></span>`;
};
/** Defense chips: Armor / Ward with their % reduction, plus the unit's damage type. */
const pct = (d) => { const r = reductionPct(d); if (Math.abs(r) < 0.05) return '0%'; return (r >= 0 ? '-' : '+') + Math.abs(r).toFixed(1) + '%'; };
const defRow = (armor, ward, dmgType, bonus = {}) => {
  const chip = (id, v, b) => `<span class="dchip ${id}" data-tip="defense:${id}:${fmt(v)}"><svg><use href="#i-${id}"/></svg>${DEFENSES[id].short} <b>${fmt(v)}</b>${b ? `<em>+${fmt(b)}</em>` : ''}<small>${pct(v)}</small></span>`;
  const T = DAMAGE_TYPES[dmgType || 'physical'];
  return chip('armor', armor, bonus.armor) + chip('ward', ward, bonus.ward) +
    `<span class="dchip dtype" data-tip="dtype:${T.id}" style="color:${T.color}">${T.name.toUpperCase()} DMG</span>`;
};
const typeIcon = (u) => `<svg class="ico"><use href="#${FAMILIES[u.family].icon}"/></svg>`;
const famTag = (u) => `<span class="fam ${u.family}" data-tip="family:${u.family}">${typeIcon(u)}${FAMILIES[u.family].name}</span>`;

export function applyUiScale() { document.documentElement.style.setProperty('--uis', settings.graphics.uiScale ?? 1); }

export class UI {
  constructor(app) {
    onSettingsChange(() => this.refreshKeyLabels());   // rebinding a key updates every label right away
    this.app = app;
    this.screen = 'main';
    this.optionsReturn = 'main';
    this.helpReturn = 'main';
    this.pickFaction = 'medieval';
    this.pickDiff = 2;
    this.panelT = 0;
    this.lastSelKey = '';
    this.lastQueueKey = '';
    this.mm = $('#minimap');
    this.mmCtx = this.mm.getContext('2d');
    applyUiScale();
    this.wire();
    this.buildFactionCards();
    this.buildOptions();
    this.buildHelp();
    this.buildCommandCard();
    this.buildPatchNotes();
  }

  // ======================= screens =======================
  show(id) {
    this.screen = id;
    $$('.screen').forEach((s) => s.classList.toggle('active', s.id === 'scr-' + id));
    document.body.dataset.screen = id;
  }

  wire() {
    document.addEventListener('pointerdown', () => initAudio());
    document.addEventListener('mouseover', (e) => { if (e.target.closest?.('button:not(:disabled)')) sfx('hover', 60); });
    document.addEventListener('click', (e) => {
      const b = e.target.closest('[data-go]');
      if (!b) return;
      sfx('click');
      const go = b.dataset.go;
      if (go === 'options') { this.optionsReturn = this.screen; this.show('options'); }
      else if (go === 'help') { this.helpReturn = this.screen; this.show('help'); }
      else if (go === 'back-options') { this.show(this.optionsReturn); }
      else if (go === 'back-help') { this.show(this.helpReturn); }
      else if (go === 'start') this.app.startMatch(this.pickFaction, this.pickDiff);
      else if (go === 'resume') this.app.resume();
      else if (go === 'restart') this.app.restart();
      else if (go === 'quit') this.app.quitToMenu();
      else if (go === 'devlab') this.app.openDevLab();
      else this.show(go);
    });
    $('#btn-pause').addEventListener('click', () => { sfx('click'); this.app.pause(); });
    $('#btn-help').addEventListener('click', () => { sfx('click'); this.app.pause(); this.helpReturn = 'pause'; this.show('help'); });
    $('#btn-shop').addEventListener('click', () => this.toggleShop());

    // ---- hover tooltips (anything with data-tip) ----
    this.tip = $('#tip');
    this.tipEl = null;
    document.addEventListener('mouseover', (e) => {
      const el = e.target.closest?.('[data-tip]');
      if (el) { this.tipEl = el; this.renderTip(); } else this.hideTip();
    });
    addEventListener('mousemove', (e) => {
      if (!this.tipEl) return;
      const t = this.tip, pad = 16;
      let x = e.clientX + pad, y = e.clientY - t.offsetHeight - pad;
      if (x + t.offsetWidth > innerWidth - 8) x = e.clientX - t.offsetWidth - pad;
      if (y < 8) y = e.clientY + pad;
      t.style.left = x + 'px'; t.style.top = y + 'px';
    });
    $('#shop-close').addEventListener('click', () => this.toggleShop(false));
    $('#btn-barracks').addEventListener('click', () => this.toggleBarracks());
    $('#btn-build').addEventListener('click', () => this.toggleBuild());
    $('#build-close').addEventListener('click', () => this.toggleBuild(false));
    $('#barracks-close').addEventListener('click', () => this.toggleBarracks(false));
    $('#btn-skills').addEventListener('click', () => this.toggleSkills());
    $('#skills-close').addEventListener('click', () => this.toggleSkills(false));
    $$('#sk-zoom button').forEach((b) => (b.onclick = () => { sfx('click'); this.skillZoom(b.dataset.z); }));
    // wheel zooms the tree; drag pans it
    const pan = $('#sk-pan');
    pan.addEventListener('wheel', (e) => { e.preventDefault(); this.skillZoom(e.deltaY < 0 ? '+' : '-'); }, { passive: false });
    let drag = null;
    pan.addEventListener('pointerdown', (e) => { if (e.button !== 0 || e.target.closest('button')) return; drag = { x: e.clientX, y: e.clientY, sl: pan.scrollLeft, st: pan.scrollTop }; pan.classList.add('drag'); });
    addEventListener('pointermove', (e) => { if (drag) { pan.scrollLeft = drag.sl - (e.clientX - drag.x); pan.scrollTop = drag.st - (e.clientY - drag.y); } });
    addEventListener('pointerup', () => { drag = null; pan.classList.remove('drag'); });
    $('#btn-repair').addEventListener('click', () => this.toggleRepair());
    $('#btn-autoloot').addEventListener('click', () => this.toggleAutoLoot());
    // formations (top-left): click = same as Alt + key; pencil = draw the custom shape
    $$('#formctl button').forEach((b) => b.addEventListener('click', () => {
      sfx('click');
      if (b.dataset.form === 'edit') this.openFormationEditor();
      else this.app.controls.applyFormation(b.dataset.form);
    }));
    this.bindFormationEditor();
    // fast forward (vs AI only): 1x / 2x / 3x
    $$('#speedctl button').forEach((b) => b.addEventListener('click', () => {
      const g = this.app.game;
      if (!g || !g.teams.some((T, t) => t !== this.app.playerTeam && T.isAI)) return;
      this.app.timeScale = +b.dataset.speed; sfx('click');
    }));

    $$('.tabs').forEach((tabs) => {
      tabs.addEventListener('click', (e) => {
        const t = e.target.closest('[data-tab]'); if (!t) return;
        sfx('click');
        const panel = tabs.closest('.panel');
        $$('[data-tab]', tabs).forEach((x) => x.classList.toggle('on', x === t));
        $$('.tabpage', panel).forEach((p) => p.classList.toggle('on', p.dataset.page === t.dataset.tab));
      });
    });

    // minimap: its own drag, fully isolated from the 3D box-select
    const mmToWorld = (e) => {
      const r = this.mm.getBoundingClientRect();
      const u = Math.max(0, Math.min(1, (e.clientX - r.left) / r.width)), v = Math.max(0, Math.min(1, (e.clientY - r.top) / r.height));
      return { x: TERRAIN.minX + u * (TERRAIN.maxX - TERRAIN.minX), z: TERRAIN.minZ + v * (TERRAIN.maxZ - TERRAIN.minZ) };
    };
    let mmDown = false;
    this.mm.addEventListener('mousedown', (e) => {
      e.preventDefault(); e.stopPropagation();
      const p = mmToWorld(e);
      if (e.button === 0) { mmDown = true; this.app.controls.centerOn(p.x, p.z); }
      else if (e.button === 2 && this.app.controls.own().length) {
        this.app.controls.issueMove({ x: p.x, z: Math.max(-GAME.mapHalfWidth, Math.min(GAME.mapHalfWidth, p.z)) }, 'move');
      }
    });
    addEventListener('mousemove', (e) => { if (mmDown) { const p = mmToWorld(e); this.app.controls.centerOn(p.x, p.z); } });
    addEventListener('mouseup', () => (mmDown = false));
  }

  // ======================= tooltips =======================
  hideTip() { this.tipEl = null; this.tip.classList.remove('on'); }
  renderTip() {
    const el = this.tipEl;
    if (!el || !document.body.contains(el)) return this.hideTip();
    const [kind, id] = el.dataset.tip.split(':');
    let html = '';
    if (kind === 'ability') {
      // exact numbers: the hovered troop's own definition, or the skill-tree form named in the tip (ability:id:unit:form)
      const [, , tu, tf] = el.dataset.tip.split(':');
      const u = el._unit, entry = u && u.ability(id);
      const A = entry?.def || (u?.abilDef ? u.abilDef(id) : null) || (tu && tf ? { ...ABILITIES[id], ...(formDef(tu, tf).abilityMods?.[id] || {}) } : ABILITIES[id]);
      const status = entry && !u.dead ? this.abilityStatus(u, entry) : null;
      const dmg = typeof A.damage === 'number' ? fmt(A.damage * (A.dmgMult || 1)) : null;
      const meta = A.kind === 'active'
        ? `<div class="tip-m">${A.cooldown ? `Cooldown ${A.cooldown}s` : 'No cooldown'}${A.radius ? ` · Radius ${A.radius}` : ''}${A.castRange ? ` · Cast range ${A.castRange}` : ''}${A.leap ? ` · Leap range ${A.leap.range}` : ''}${dmg ? ` · ${dmg} ${DAMAGE_TYPES[A.damageType].name.toLowerCase()} dmg` : ''}${A.affectsFlying !== undefined ? ` · Affects flying: ${A.affectsFlying ? 'yes' : 'no'}` : ''}${A.manaCost ? ` · ${A.manaCost} mana` : ''}${el.dataset.key ? ` · Key <kbd>${el.dataset.key}</kbd>` : ''}</div>${el.dataset.key ? `<div class="tip-m">${canAutocast(A) ? `Right-click: autocast ${entry?.st.auto ? '<b>ON</b>' : 'off'}` : 'No autocast'}</div>` : ''}` : '';
      html = `<div class="tip-h"><svg class="ico"><use href="#${A.icon}"/></svg><b>${A.name}</b><small class="${A.kind}">${A.kind.toUpperCase()}</small></div>
        <p>${abilityText(A)}</p>${meta}${status ? `<div class="tip-s ${status.on ? 'on' : ''}">${status.text}</div>` : ''}`;
    } else if (kind === 'formation') {
      const N = { circle: ['Circle', 'Hollow ring around the middle of your troops.'], square: ['Square', 'Hollow square around the middle of your troops.'], line: ['Line', 'One line across the direction of your cursor.'], custom: ['Custom', 'The shape you drew (pencil button). Up on your drawing = toward the cursor.'], edit: ['Draw custom formation', 'Open the drawing pad for your custom shape. Saved with your settings.'] }[id];
      const ak = { circle: 'formation1', square: 'formation2', line: 'formation3', custom: 'formation4' }[id];
      html = `<div class="tip-h"><svg class="ico"><use href="#f-${id === 'edit' ? 'draw' : id}"/></svg><b>${N[0]}</b></div><p>${N[1]}</p>${ak ? `<div class="tip-m">Key <kbd>Alt+${keyLabel(settings.keys[ak])}</kbd> · faces your cursor · not sticky</div>` : ''}`;
    } else if (kind === 'status') {
      const x = el._st; if (!x) return this.hideTip();
      html = `<div class="tip-h"><svg class="ico"><use href="#${x.icon}"/></svg><b>${x.name}</b><small class="${x.kind === 'buff' ? 'passive' : 'active'}">${x.kind.toUpperCase()}</small></div>
        <p>${x.text}</p>${x.t || x.stacks ? `<div class="tip-m">${x.t ? `${fmt(x.t)}s left` : ''}${x.t && x.stacks ? ' · ' : ''}${x.stacks ? `${x.stacks} stacks` : ''}</div>` : ''}`;
    } else if (kind === 'autoloot') {
      const on = this.app.game?.teams[this.app.playerTeam]?.autoLoot;
      html = `<div class="tip-h"><svg class="ico"><use href="#i-autoloot"/></svg><b>Auto-loot</b><small>TOGGLE</small></div>
        <p><b>ON:</b> when one of your troops kills a creep that drops an item, the item goes straight into that troop's inventory. If its slots are full (or a tower got the kill) the item drops on the ground as usual.</p>
        <p><b>OFF:</b> items drop on the ground; select a troop and right-click the item to pick it up.</p><div class="tip-s ${on ? 'on' : ''}">${on ? 'ON' : 'OFF'}</div>`;
    } else if (kind === 'repair') {
      const g = this.app.game, t = this.app.playerTeam;
      const r = g ? g.repairRates(t) : { heal: 10, drain: 5 };
      const T = g?.teams[t], B = g?.bases[t];
      const state = !T ? '' : !T.repairOn ? 'OFF' : B.hp >= B.maxHp ? 'ON · base is full (not draining)' : `ON · repairing`;
      html = `<div class="tip-h"><svg class="ico"><use href="#u-repair"/></svg><b>Repair</b><small>BASE</small></div>
        <p>Toggle: heals your base <b>+${r.heal} HP/s</b> and drains <b>${r.drain} gold/s</b>. Only drains while the base is damaged; turns off when you run out of gold. Upgrade with Repair Crews.</p>
        <div class="tip-s ${T?.repairOn ? 'on' : ''}">${state}</div>`;
    } else if (kind === 'upgrade') {
      const U = UPGRADES[id], g = this.app.game;
      const tt = el.dataset.tip.split(':')[2];
      const team = tt !== undefined ? +tt : this.app.playerTeam;
      const lv4 = el.dataset.tip.split(':')[3];
      const lvl = lv4 !== undefined ? +lv4 : g && team !== null ? g.upLevel(team, id) : 0;
      const rows = U.max === Infinity
        ? `<div class="tip-m">Unlimited levels · current: ${lvl ? U.levelText(lvl, U) : 'none'}</div>`
        : `<div class="tip-m">${Array.from({ length: U.max }, (_, k) => `<div class="${k < lvl ? 'on' : ''}">Lv ${k + 1} · ${upgradePrice(U, k)}g · ${U.levelText(k + 1, U)}</div>`).join('')}</div>`;
      html = `<div class="tip-h"><svg class="ico"><use href="#${U.icon}"/></svg><b>${U.name}</b><small>${U.category === 'base' ? 'BASE' : 'TROOP'} UPGRADE</small></div><p>${U.desc}</p>${rows}`;
    } else if (kind === 'family') {
      const F = FAMILIES[id];
      const members = Object.values(UNITS).filter((u) => u.family === id).map((u) => u.name).join(', ');
      html = `<div class="tip-h"><svg class="ico"><use href="#${F.icon}"/></svg><b>${F.name}</b><small>FAMILY</small></div><p>${F.desc}</p><div class="tip-s">Members: ${members}</div>`;
    } else if (kind === 'defense') {
      const D = DEFENSES[id], v = +el.dataset.tip.split(':')[2] || 0;
      html = `<div class="tip-h"><svg class="ico"><use href="#i-${id}"/></svg><b>${D.name}</b><small>DEFENSE</small></div>
        <p>Reduces incoming <b>${D.vs}</b> damage. Diminishing returns: 2 → 10.7%, 5 → 23%, 10 → 37.5%, 20 → 54.5%. Negative values make the troop take extra damage.</p>
        <div class="tip-s on">${D.name} ${v} → takes ${Math.abs(reductionPct(v)).toFixed(1)}% ${reductionPct(v) >= 0 ? 'less' : 'more'} ${D.vs} damage</div>`;
    } else if (kind === 'dtype') {
      const T = DAMAGE_TYPES[id];
      const line = { physical: 'Reduced by the target\'s Armor.', magic: `Reduced by the target's ${DEFENSES.ward.name}.`, true: 'Ignores Armor and Ward completely.' }[id];
      html = `<div class="tip-h"><b style="color:${T.color}">${T.name} damage</b><small>DAMAGE TYPE</small></div><p>${line}</p>`;
    } else if (kind === 'item') {
      const it = ITEMS[id];
      html = `<div class="tip-h"><svg class="ico"><use href="#${it.sprite}"/></svg><b>${it.name}</b><small>ITEM</small></div><p>${it.desc}</p><div class="tip-m">${it.active ? '<b>Click it in the inventory to use.</b> · ' : ''}Dropped by neutral camps · kept until the carrier dies</div>`;
    } else if (kind === 'daynight') {
      const dn = this.app.game?.dayNight;
      html = `<div class="tip-h"><b>${dn?.night ? 'Night' : 'Day'}</b><small>CYCLE</small></div><p>Day and night alternate every 5 minutes. Torches and street lamps light up the lane at night. (Future troops will get day/night bonuses.)</p>${dn ? `<div class="tip-s on">${dn.night ? 'Day' : 'Night'} in ${Math.floor(dn.left / 60)}:${String(Math.floor(dn.left % 60)).padStart(2, '0')}</div>` : ''}`;
    } else if (kind === 'slot') {
      html = `<div class="tip-h"><b>Empty slot</b></div><p>Neutral creeps drop items. Right-click one on the ground to pick it up.</p>`;
    } else html = el.dataset.tipText || '';
    this.tip.innerHTML = html;
    this.tip.classList.add('on');
  }
  abilityStatus(u, { def: P, st: s }) {
    switch (P.id) {
      case 'loneWolf': return s.active ? { on: true, text: `ACTIVE · +${P.bonusDamage} damage, +${P.bonusRegen} HP regen, +${P.bonusArmor} armor` } : { on: false, text: `Inactive · another Viking is within ${P.radius} range` };
      case 'blueLine': return s.stacks ? { on: true, text: `${s.stacks} officer${s.stacks > 1 ? 's' : ''} nearby · +${s.bonusDamage} damage` } : { on: false, text: 'No other officers within 10 range' };
      case 'eagleEye': return { on: true, text: `Ready · ${Math.round(P.chance * 100)}% chance per shot` };
      case 'fervor': return s.stacks ? { on: true, text: `${s.stacks}/${P.maxStacks} stacks · +${s.bonusAS} attack speed` } : { on: false, text: `0/${P.maxStacks} stacks` };
      case 'bullsEye': return { on: s.stacks === P.every - 1, text: `Attack ${s.stacks || 0}/${P.every} · ${s.stacks === P.every - 1 ? 'NEXT SHOT CRITS' : `crit in ${P.every - (s.stacks || 0)}`}` };
      case 'snipeStance':
        if (s.mode === 'channel') return { on: false, text: `Setting up · ${s.chT.toFixed(1)}s (can't move or shoot, S cancels)` };
        if (s.mode === 'standup') return { on: false, text: `Standing up · ${s.chT.toFixed(1)}s, then ${P.standCooldown}s cooldown` };
        if (s.mode === 'prone') return { on: true, text: `PRONE · +${P.bonusRange} range, +${P.bonusDamage} dmg, ignores ${P.armorPierce} armor · takes ${P.damageTakenMult}× damage · recast to stand` };
        return { on: false, text: s.cd > 0 ? `Standing · cooldown ${s.cd.toFixed(1)}s` : 'Standing · ready to go prone' };
      case 'flurry': case 'suppressiveFire': {
        const L = Math.max(1, u.upLevel(P.id));
        const extra = P.id === 'flurry' ? `+${P.bonusAS[L - 1]} attack speed` : `+${P.bonusDamage[L - 1]} dmg, ${P.knockback[L - 1]} knockback`;
        if (s.buffT > 0) return { on: true, text: `ACTIVE ${s.buffT.toFixed(1)}s · ${extra}` };
        return s.cd > 0 ? { on: false, text: `Cooldown ${s.cd.toFixed(1)}s · Lv ${L}: ${extra}` } : { on: true, text: `Ready · Lv ${L}: ${extra}` };
      }
      case 'deathSplatter': return { on: true, text: 'Armed — explodes on death' };
      case 'swiftStep': return s.active ? { on: true, text: `Moving · ${P.evasion}% evasion` } : { on: false, text: 'Standing still · no bonus evasion' };
      case 'outnumbered': return { on: true, text: `${s.allies ?? 0} allies vs ${s.enemies ?? 0} enemies · ${s.bonusArmor ? `+${P.armor} armor, +${P.ward} ward` : `+${fmt(s.bonusDamage || 0)} damage`}` };
      case 'rapidFire': return s.charges > 0 ? { on: true, text: `${s.charges}/${P.attacks} charged attacks left` } : { on: false, text: `Recharging · ${Math.max(0, s.rcd || 0).toFixed(1)}s` };
      case 'doubleTap': return s.cd > 0 ? { on: false, text: `Recharging · ${s.cd.toFixed(1)}s` } : { on: true, text: 'Ready · next shot fires twice' };
      case 'disrupt': return { on: (s.stacks || 0) === P.every - 1, text: `Attack ${s.stacks || 0}/${P.every}` };
    }
    if (P.kind === 'active') return s.cd > 0 ? { on: false, text: `On cooldown · ${s.cd.toFixed(1)}s` } : { on: true, text: 'Ready' };
    return null;
  }
  /** Badge text for an ability slot (stacks, +5, cooldown...). */
  abilityBadge(u, { def: P, st: s }) {
    if (P.id === 'snipeStance') return (s.mode === 'channel' || s.mode === 'standup') ? s.chT.toFixed(1) : s.mode === 'prone' ? 'ON' : s.cd > 0 ? Math.ceil(s.cd) + '' : '';
    if (P.kind === 'active') return s.cd > 0 ? Math.ceil(s.cd) + '' : '';
    if (P.id === 'bullsEye') return `${s.stacks || 0}/${P.every}`;
    if (P.id === 'loneWolf') return s.active ? '+' + P.bonusDamage : '';
    if (P.id === 'eagleEye') return Math.round(P.chance * 100) + '%';
    if (P.id === 'swiftStep') return s.active ? P.evasion + '%' : '';
    if (P.id === 'nightMeld') return s.active ? 'INV' : '';
    if (P.id === 'critStrike') return Math.round(P.chance * 100) + '%';
    if (P.id === 'penetration') return '-' + P.shred[u.upLevel('penetration')];
    return s.stacks || '';
  }

  /** Floating text over the battlefield: kind = crit | miss | gold */
  floatText(pos, text, kind = 'crit') {
    const sc = this.app.controls.toScreen(pos, 3.2);
    if (sc.x < -50 || sc.x > innerWidth + 50 || sc.y < -50 || sc.y > innerHeight + 50) return;
    const d = document.createElement('div');
    d.className = 'floater ' + kind;
    d.textContent = text;
    d.style.left = sc.x + (kind === 'gold' ? 18 : 0) + 'px'; d.style.top = sc.y + 'px';
    $('#floaters').appendChild(d);
    setTimeout(() => d.remove(), 900);
  }
  shopOpen() { return $('#shop').classList.contains('open'); }

  // ======================= faction select =======================
  buildFactionCards() {
    const wrap = $('#faction-cards');
    wrap.innerHTML = '';
    for (const f of Object.values(FACTIONS)) {
      const roster = f.units.map((id) => UNITS[id]);
      const card = document.createElement('button');
      card.className = 'fcard frame ' + f.id;
      card.innerHTML = `
        <div class="fside">${f.team === 0 ? '◀ LEFT SIDE' : 'RIGHT SIDE ▶'}</div>
        <div class="emblem"><svg><use href="#${f.emblem}"/></svg></div>
        <h3>${f.name}</h3>
        <p class="tag">${f.tagline}</p>
        <div class="frow"><span>Base</span><b>${f.baseName}</b></div>
        ${roster.map((u) => `<div class="frow"><span>${u.role}</span><b>${u.name} · ${u.cost}g</b></div>`).join('')}`;
      card.addEventListener('click', () => { sfx('click'); this.pickFaction = f.id; this.refreshFaction(); });
      wrap.appendChild(card);
    }
    const dr = $('#diff-range');
    try { const saved = +localStorage.getItem('eraclash.diff'); if (saved >= 1 && saved <= 10) this.pickDiff = saved; } catch { /* storage off */ }
    dr.value = this.pickDiff;
    dr.addEventListener('input', () => { this.pickDiff = +dr.value; try { localStorage.setItem('eraclash.diff', dr.value); } catch { /* storage off */ } this.refreshFaction(); });
    dr.addEventListener('change', () => sfx('click'));
    this.refreshFaction();
  }
  refreshFaction() {
    $$('.fcard').forEach((c) => c.classList.toggle('on', c.classList.contains(this.pickFaction)));
    const d = DIFFICULTY[this.pickDiff];
    $('#diff-name').textContent = `${this.pickDiff} · ${d.name}`;
    $('#diff-name').className = this.pickDiff >= 8 ? 'hell' : this.pickDiff >= 4 ? 'hard' : '';
    $('#diff-hint').textContent = `${d.hint} Every AI also rolls a random personality (greedy, defensive, aggressive, tactician or wildcard).`;
  }

  // ======================= options =======================
  buildOptions() {
    const list = $('#keybinds');
    const render = () => {
      list.innerHTML = '';
      const groups = [
        ['general', SCOPE_LABEL.general, null],
        ['ability', SCOPE_LABEL.ability, null],
        ['shop', SCOPE_LABEL.shop, null],
        ['item', SCOPE_LABEL.item, null],
        ['group', SCOPE_LABEL.group, null],
        ['formation', SCOPE_LABEL.formation, null],
      ];
      for (const [scope, title] of groups) {
        list.insertAdjacentHTML('beforeend', `<div class="kb-head">${title}</div>`);
        for (const a of ACTIONS.filter((x) => x.scope === scope)) {
          const row = document.createElement('div');
          row.className = 'kb-row';
          row.innerHTML = `<span>${a.label}</span><button class="key" data-act="${a.id}">${keyLabel(settings.keys[a.id])}</button>`;
          list.appendChild(row);
        }
      }
      list.insertAdjacentHTML('beforeend', `<div class="kb-head">Fixed</div>`);
      const fixed = [
        ['Select unit / box select', 'LMB / drag'], ['Add to selection', 'Shift+LMB'],
        ['Select all of type', 'Dbl-click'], ['Move / attack target', 'RMB'],
        ['Ability: autocast on / off', 'RMB icon'], ['Base selected: rally flag / gate / charge', 'RMB ground / own / enemy base'], ['Item: use / discard', 'LMB / RMB slot'], ['Zoom', 'Wheel'], ['Drag camera', 'MMB'], ['Close shop / pause', 'Esc'],
      ];
      for (const [l, k] of fixed) {
        const row = document.createElement('div');
        row.className = 'kb-row fixed';
        row.innerHTML = `<span>${l}</span><span class="key static">${k}</span>`;
        list.appendChild(row);
      }
    };
    render();
    let waiting = null;
    list.addEventListener('click', (e) => {
      const b = e.target.closest('button.key'); if (!b) return;
      sfx('click');
      $$('button.key', list).forEach((x) => x.classList.remove('wait'));
      waiting = b.dataset.act; b.classList.add('wait'); b.textContent = 'press…';
    });
    addEventListener('keydown', (e) => {
      if (!waiting) return;
      e.preventDefault(); e.stopImmediatePropagation();
      if (e.code !== 'Escape') {
        // only actions in the SAME scope clash (a shop key may reuse a general key — the shop wins while open)
        const sc = scopeOf(waiting);
        const clash = Object.keys(settings.keys).find((k) => settings.keys[k] === e.code && k !== waiting && scopeOf(k) === sc);
        if (clash) { settings.keys[clash] = settings.keys[waiting]; this.toast(`Swapped with "${ACTIONS.find((x) => x.id === clash).label}"`); }
        settings.keys[waiting] = e.code;
        saveSettings(); this.buildCommandCard(); this.buildShop();
      }
      waiting = null; render(); this.renderHelpControls();
    }, true);
    $('#kb-reset').addEventListener('click', () => { sfx('click'); resetKeys(); render(); this.buildCommandCard(); this.buildShop(); this.renderHelpControls(); });

    const bindRange = (sel, get, set, fmt = (v) => Math.round(v * 100) + '%') => {
      const el = $(sel), out = $(sel + '-v');
      el.value = get(); out.textContent = fmt(+el.value);
      el.addEventListener('input', () => { set(+el.value); out.textContent = fmt(+el.value); saveSettings(); });
    };
    bindRange('#o-master', () => settings.audio.master, (v) => { settings.audio.master = v; applyAudioSettings(); });
    bindRange('#o-music', () => settings.audio.music, (v) => { settings.audio.music = v; applyAudioSettings(); });
    bindRange('#o-sfx', () => settings.audio.sfx, (v) => { settings.audio.sfx = v; applyAudioSettings(); sfx('click', 120); });
    const mute = $('#o-mute'); mute.checked = settings.audio.mute;
    mute.addEventListener('change', () => { settings.audio.mute = mute.checked; applyAudioSettings(); saveSettings(); });

    $$('#o-quality button').forEach((b) => {
      b.classList.toggle('on', b.dataset.q === settings.graphics.quality);
      b.addEventListener('click', () => {
        sfx('click'); settings.graphics.quality = b.dataset.q; saveSettings();
        $$('#o-quality button').forEach((x) => x.classList.toggle('on', x === b));
        this.app.applyGraphics();
      });
    });
    const pix = $('#o-pixel'); pix.checked = settings.graphics.pixelated;
    pix.addEventListener('change', () => { settings.graphics.pixelated = pix.checked; saveSettings(); this.app.applyGraphics(); });
    const fps = $('#o-fps'); fps.checked = settings.graphics.showFps;
    fps.addEventListener('change', () => { settings.graphics.showFps = fps.checked; saveSettings(); $('#fps').style.display = fps.checked ? 'block' : 'none'; });
    $('#fps').style.display = settings.graphics.showFps ? 'block' : 'none';
    const hb = $('#o-hpbars'); hb.value = settings.graphics.hpBars;
    hb.addEventListener('change', () => { settings.graphics.hpBars = hb.value; saveSettings(); });
    // UI scale applies on release so the slider doesn't jump under the cursor
    const us = $('#o-uiscale'), usv = $('#o-uiscale-v');
    us.value = settings.graphics.uiScale; usv.textContent = (+us.value).toFixed(2) + 'x';
    us.addEventListener('input', () => { usv.textContent = (+us.value).toFixed(2) + 'x'; });
    us.addEventListener('change', () => { settings.graphics.uiScale = +us.value; saveSettings(); applyUiScale(); });

    const dn = $('#o-dmgnum'); dn.value = settings.graphics.damageNumbers;
    dn.addEventListener('change', () => { settings.graphics.damageNumbers = dn.value; saveSettings(); });
    const ch = $('#o-crithl'); ch.checked = settings.graphics.critHighlight;
    ch.addEventListener('change', () => { settings.graphics.critHighlight = ch.checked; saveSettings(); });
    const ct = $('#o-ctext'); ct.checked = settings.graphics.combatText;
    ct.addEventListener('change', () => { settings.graphics.combatText = ct.checked; saveSettings(); });
    const qc = $('#o-quickcast'); qc.checked = !!settings.gameplay.quickCast;
    qc.addEventListener('change', () => { settings.gameplay.quickCast = qc.checked; saveSettings(); });
    const ep = $('#o-edge'); ep.checked = settings.gameplay.edgePan;
    ep.addEventListener('change', () => { settings.gameplay.edgePan = ep.checked; saveSettings(); });
    bindRange('#o-pan', () => settings.gameplay.panSpeed, (v) => (settings.gameplay.panSpeed = v), (v) => v.toFixed(1) + 'x');
    bindRange('#o-zoom', () => settings.gameplay.zoomSpeed, (v) => (settings.gameplay.zoomSpeed = v), (v) => v.toFixed(1) + 'x');
  }

  // ======================= patch notes =======================
  buildPatchNotes() {
    $('#ver').textContent = 'v' + CURRENT_VERSION;
    $('#patch-list').innerHTML = PATCH_NOTES.map((p, k) => `
      <article class="patch${k === 0 ? ' latest' : ''}">
        <header><span class="pv">v${p.version}</span><b>${p.title}</b>${k === 0 ? '<em>LATEST</em>' : ''}${p.author ? `<small class="pa">by ${p.author}</small>` : ''}<time>${formatPatchDate(p.date)}</time></header>
        ${p.sections.map((s) => `<h4>${s.title}</h4><ul>${s.items.map((it) => `<li>${it}</li>`).join('')}</ul>`).join('')}
      </article>`).join('');
  }

  // ======================= help =======================
  buildHelp() {
    const troops = $('#help-troops');
    troops.innerHTML = '';
    // troops tab = every faction's hiring roster (units themselves don't belong to a faction)
    const entries = Object.values(FACTIONS).flatMap((f) => f.units.map((id) => [UNITS[id], f]));
    for (const [u, f] of entries) {
      const enemies = Object.values(FACTIONS).filter((o) => o.id !== f.id).flatMap((o) => o.units.map((id) => UNITS[id]));
      // matchup table (hidden behind a button): your DPS/TTK vs theirs, base stats
      const rows = enemies.map((en) => {
        const mine = dps(u, en), theirs = dps(en, u);
        const win = en.hp / mine < u.hp / theirs;
        return `<tr><td>${en.name}</td><td>${mine.toFixed(1)}</td><td class="${win ? 'good' : ''}">${(en.hp / mine).toFixed(1)}s</td><td>${theirs.toFixed(1)}</td><td class="${win ? '' : 'bad'}">${(u.hp / theirs).toFixed(1)}s</td></tr>`;
      }).join('');
      const vs = `<button class="btn ghost small mu-btn">Matchups ▾</button>
        <div class="mu"><table><tr><th>vs</th><th>Your DPS</th><th>You kill it</th><th>Its DPS</th><th>It kills you</th></tr>${rows}</table>
        <div class="muted">Base stats only — abilities, passives and upgrades not included.</div></div>`;
      const c = document.createElement('div');
      c.className = 'tcard ' + f.id;
      c.innerHTML = `
        <img src="${PORTRAITS[u.id].full}" alt="">
        <div class="tbody">
          <div class="tfac">${f.name}</div>
          <h3>${u.name} <small>${u.role}</small></h3>
          <div class="famrow">${famTag(u)}</div>
          <p>${u.lore}</p>
          <div class="stats">
            <div><span>Cost</span><b>${u.cost}g</b></div>
            <div><span>HP</span><b>${u.hp}</b></div>
            <div><span>Armor</span><b>${u.armor}</b></div>
            <div><span>${DEFENSES.ward.name}</span><b>${u.ward}</b></div>
            <div><span>Damage</span><b>${u.damage}</b></div>
            <div><span>Atk spd</span><b>${u.attackSpeed}/min</b></div>
            <div><span>Move</span><b>${u.moveSpeed}</b></div>
            <div><span>Range</span><b>${u.type === 'ranged' ? u.range : 'Melee'}</b></div>
            <div><span>Train</span><b>${u.trainTime}s</b></div>
            <div><span>HP regen</span><b>${u.hpRegen}/s</b></div>
          </div>
          <div class="resrow">${defRow(u.armor, u.ward, u.damageType)}</div>
          ${(() => { let na = -1; return u.abilities.map((id) => { const A = ABILITIES[id]; if (A.kind === 'active') na++; return `<div class="tpass">${pIcon(id)}<div><b>${A.name} <small class="${A.kind}">${A.kind}${A.kind === 'active' && SLOT_KEYS[na] ? ' · ' + keyLabel(settings.keys[SLOT_KEYS[na]]) : ''}${A.unbreakable ? ' · unbreakable' : ''}</small></b><span>${abilityText(A)}</span></div></div>`; }).join(''); })()}
          <div class="tnote">${vs}</div>
        </div>`;
      troops.appendChild(c);
      const mb = $('.mu-btn', c);
      mb.onclick = () => { sfx('click'); const open = c.classList.toggle('mu-open'); mb.textContent = open ? 'Matchups ▴' : 'Matchups ▾'; };
    }
    this.renderHelpControls();
    this.buildHelpNeutrals();
  }
  buildHelpNeutrals() {
    const box = $('#help-neutrals');
    const itemChip = (d) => `<span class="hitem" data-tip="item:${d}"><svg class="ico"><use href="#${ITEMS[d].sprite}"/></svg>${ITEMS[d].name}</span>`;
    const tiers = Object.entries(CREEP_GROUPS).map(([t, groups]) => `<div><b>Tier ${t} camps</b> (${CAMPS.filter((c) => (c.tier || 1) === +t).length} on the map) roll one of these groups every spawn: ${groups.map((gr) => `<b>${gr.name}</b> (${gr.units.map((id) => UNITS[id].name).join(' + ')})`).join(', ')}.
      Each Tier ${t} creep has a <b>${fmt(dropChanceForTier(+t) * 100)}%</b> chance to drop a Tier ${t} item: ${Object.keys(ITEMS).filter((d) => (ITEMS[d].tier || 1) === +t).map(itemChip).join(', ')}</div>`).join('');
    const camps = tiers;
    const creeps = [...new Set(Object.values(CREEP_GROUPS).flat().flatMap((g) => g.units))].map((id) => {
      const u = UNITS[id];
      return `<div class="tcard neutral"><img src="${PORTRAITS[id].full}" alt=""><div class="tbody"><div class="tfac">Neutral · ${fmt(u.cost * GAME.bountyPct)}g bounty</div><h3>${u.name} <small>${u.role}</small></h3><p>${u.lore}</p>
        <div class="stats"><div><span>HP</span><b>${u.hp}</b></div><div><span>Regen</span><b>${fmt(u.hpRegen)}/s</b></div><div><span>Damage</span><b>${u.damage}</b></div><div><span>Atk spd</span><b>${u.attackSpeed}/min</b></div><div><span>Armor</span><b>${u.armor}</b></div><div><span>Ward</span><b>${u.ward}</b></div><div><span>Move</span><b>${fmt(u.moveSpeed)}</b></div><div><span>Range</span><b>${u.type === 'ranged' ? u.range : 'Melee'}</b></div></div>
        ${u.abilities.map((a) => `<div class="tpass">${pIcon(a)}<div><b>${ABILITIES[a].name} <small class="${ABILITIES[a].kind}">${ABILITIES[a].kind}</small></b><span>${abilityText(ABILITIES[a])}</span></div></div>`).join('')}</div></div>`;
    }).join('');
    box.innerHTML = `<div class="hgrid">
      <div><b>Camps</b> spawn at every full minute (from 1:00) if their spawn ring is empty. They chase up to ${CAMP_RULES.leash} range, then walk home and heal.</div>
      <div><b>Day:</b> a camp attacks anyone who walks within ${CAMP_RULES.dayAggroRange} range of it, or who attacks it. <b>Night:</b> camps sleep (Zzz) and ignore passers-by — but attacking one wakes the whole camp.</div>
      <div><b>Stacking.</b> Hit a camp just before the minute mark and pull it out of its ring: the ring is empty when the timer hits, so a second group spawns, and the first one walks back — now there are two.</div>
      <div><b>Loot.</b> Creeps drop items of their tier (Tier 1: ${Math.round(CAMP_RULES.dropChance * 100)}%, each higher tier ${Math.round(CAMP_RULES.dropFalloff * 100)}% less often). Select a troop and <kbd>RMB</kbd> the item: the closest selected troop with a free slot walks over and picks it up. Items are kept until the carrier dies — then they're gone. The AI also farms its own side's camps now and then.</div>
      ${camps}</div><div id="help-creeps">${creeps}</div>`;
  }
  renderHelpControls() {
    const k = settings.keys;
    $('#help-controls').innerHTML = `
      <div class="hgrid">
        <div><kbd>LMB</kbd> click a troop to select it. Click an enemy to inspect it. One selected troop shows its <b>attack-range circle</b> and <b>6 item slots</b>.</div>
        <div><kbd>LMB drag</kbd> box-select your troops. <kbd>Shift</kbd> adds to selection.</div>
        <div><kbd>RMB</kbd> on ground = move (melee in front, ranged behind). On an enemy/base = attack it. On a dropped item = pick it up.</div>
        <div><kbd>${keyLabel(k.attackMove)}</kbd> then <kbd>LMB</kbd> = attack. Click an enemy to focus it, or ground to attack-move.</div>
        <div><kbd>${keyLabel(k.stop)}</kbd> stop: cancel the current action and hold position. <kbd>${keyLabel(k.charge)}</kbd> charge: back to auto-attacking the enemy base.</div>
        <div><kbd>${keyLabel(k.shop)}</kbd> open the Shop. Click a troop to hire it (search + list/card view at the top); your 3 most recent hires get quick keys <kbd>${keyLabel(k.recent1)}</kbd> <kbd>${keyLabel(k.recent2)}</kbd> <kbd>${keyLabel(k.recent3)}</kbd> while it's open, <kbd>Shift</kbd> hires 5, <kbd>Esc</kbd> closes it. <kbd>${keyLabel(k.selectAll)}</kbd> selects all your troops.</div>
        <div><kbd>${keyLabel(k.abil1)}</kbd> <kbd>${keyLabel(k.abil2)}</kbd> <kbd>${keyLabel(k.abil3)}</kbd> <kbd>${keyLabel(k.abil4)}</kbd> use the selected troop's 1st–4th <b>active</b> ability (5th: <kbd>${keyLabel(k.abil5)}</kbd>) (every selected troop of that type casts). You can also click the ability icon.</div>
        <div><kbd>RMB</kbd> on a dropped item = closest selected troop picks it up. <kbd>${keyLabel(k.autoLoot)}</kbd> toggles <b>Auto-loot</b> (creep drops go straight to the killer's inventory).</div>
        <div><b>Groups</b>: <kbd>Alt+${keyLabel(k.group1)}</kbd>…<kbd>Alt+${keyLabel(k.group5)}</kbd> sets group 1–5 from your selection, <kbd>Ctrl+${keyLabel(k.group1)}</kbd>… selects it, double-tap to jump the camera there. <kbd>1-6</kbd> use the selected troop's items; right-click an item to discard it.</div>
        <div><b>Formations</b>: <kbd>Alt+${keyLabel(k.formation1)}</kbd> circle, <kbd>Alt+${keyLabel(k.formation2)}</kbd> square, <kbd>Alt+${keyLabel(k.formation3)}</kbd> line, <kbd>Alt+${keyLabel(k.formation4)}</kbd> your own drawn shape (or the FORM buttons, top-left). The shape faces your cursor; your next right-click is a normal move.</div>
        <div><b>Rally</b>: select your base and right-click the ground to plant a flag — new troops walk there. Right-click your own base = they wait at the gate, the enemy base = they charge (default).</div>
        <div>Push the mouse against a screen edge or use the arrow keys to scroll. <kbd>${keyLabel(k.centerUnits)}</kbd> centers on your selected troops (hold to follow them), <kbd>${keyLabel(k.centerBase)}</kbd> jumps home. Minimap: <kbd>LMB</kbd> jump/drag camera, <kbd>RMB</kbd> move troops.</div>
      </div>`;
  }

  // ======================= HUD: command card + shop =======================
  roster() { return FACTIONS[this.app.playerFaction || 'medieval'].units; }

  /** Every hotkey label in the HUD and help reads the CURRENT binding (elements tagged data-keyof="<action>"). */
  refreshKeyLabels() {
    for (const el of document.querySelectorAll('[data-keyof]')) el.textContent = keyLabel(settings.keys[el.dataset.keyof]);
  }
  buildCommandCard() {
    this.refreshKeyLabels();
    const k = settings.keys;
    $('#shop-kbd').textContent = keyLabel(k.shop);
    $('#shop-key').textContent = keyLabel(k.shop);
    $('#cmds').innerHTML = `
      <button class="frame" data-cmd="attack">Attack<kbd data-keyof="attackMove">${keyLabel(k.attackMove)}</kbd></button>
      <button class="frame" data-cmd="stop">Stop<kbd data-keyof="stop">${keyLabel(k.stop)}</kbd></button>
      <button class="frame" data-cmd="charge">Charge<kbd data-keyof="charge">${keyLabel(k.charge)}</kbd></button>
      <button class="frame" data-cmd="all">Army<kbd data-keyof="selectAll">${keyLabel(k.selectAll)}</kbd></button>
      <button class="frame" data-cmd="demolish" hidden title="Tear down the selected building (50% refund)">Demolish<kbd>Del</kbd></button>`;
    $$('#cmds button').forEach((b) => b.onclick = () => {
      sfx('click');
      const c = this.app.controls;
      ({ attack: () => c.setArmed(true), stop: () => c.stop(), charge: () => c.charge(), all: () => c.selectAll(), demolish: () => c.demolishSelected() })[b.dataset.cmd]();
    });
    this.lastQueueKey = '#';
  }

  buildShop() {
    const box = $('#shop-items');
    if (!box) return;
    const f = FACTIONS[this.app.playerFaction || 'medieval'];
    $('#shop-title').textContent = f.team === 0 ? 'War Camp' : 'Recruitment';  // 'Barracks' is reserved for the upgrade building
    this.wireShopTools();
    box.innerHTML = '';
    for (const id of this.roster()) {
      const u = this.formDefOf(id);   // your picked skill-tree form (name, look, stats)
      const b = document.createElement('button');
      b.className = 'sitem frame';
      b.dataset.id = id;
      // what the search box matches: name, role, family, attack type, ability names
      b.dataset.q = [u.name, u.baseName || '', u.role, FAMILIES[u.family]?.name, u.type, ...u.abilities.map((a) => ABILITIES[a]?.name || a)].join(' ').toLowerCase();
      b.innerHTML = `
        <img src="${portraitOf(u).face}" alt="">
        <div>
          <div class="nm">${typeIcon(u)}${u.name}${tierOf(id) > 1 ? `<em class="tier" title="Tier ${tierOf(id)}: needs a level ${tierOf(id)} base, takes ${housingOf(id)} army space">T${tierOf(id)}</em>` : ''}${u.abilities.map((a) => pIcon(a, 'class="pico sm"')).join('')}</div>
          <div class="ln role">${famTag(u)} ${u.role}</div>
          <div class="ln st">HP <b>${u.hp}</b> · ARM <b>${u.armor}</b> · DMG <b>${u.damage}</b> · RNG <b>${u.type === 'ranged' ? u.range : 'melee'}</b></div>
          <div class="ln cs">HP <b>${u.hp}</b> · DMG <b>${u.damage}</b></div>
        </div>
        <div class="price"><svg class="ico"><use href="#i-coin"/></svg><b>${fmt(this.app.game ? this.app.game.unitCost(this.app.playerTeam, id) : u.cost)}</b>${housingOf(id) > 1 ? `<small class="hs">${housingOf(id)} army</small>` : ''}</div><div class="lock"></div>`;
      b.onclick = (e) => this.app.hire(id, e.shiftKey ? 5 : 1);
      box.appendChild(b);
    }
    $('#shop-search').value = '';
    this.applyShopView();
    this.filterShop();
    this.renderRecent();
  }
  wireShopTools() {
    if (this._shopWired) return;
    this._shopWired = true;
    const input = $('#shop-search');
    input.addEventListener('input', () => this.filterShop());
    input.addEventListener('keydown', (e) => {
      e.stopPropagation();   // typing never triggers hotkeys
      if (e.key === 'Escape') { e.preventDefault(); if (input.value) { input.value = ''; this.filterShop(); } else input.blur(); }
      else if (e.key === 'Enter') {   // Enter hires the first match (Shift+Enter = 5)
        e.preventDefault();
        const first = [...$('#shop-items').children].find((b) => !b.classList.contains('hidden'));
        if (first) this.app.hire(first.dataset.id, e.shiftKey ? 5 : 1);
      }
    });
    for (const b of document.querySelectorAll('.shop-view button')) {
      b.addEventListener('click', () => { sfx('click'); settings.gameplay.shopView = b.dataset.view; saveSettings(); this.applyShopView(); });
    }
  }
  applyShopView() {
    const v = settings.gameplay.shopView === 'card' ? 'card' : 'list';
    const box = $('#shop-items');
    box.className = v;
    for (const b of document.querySelectorAll('.shop-view button')) b.classList.toggle('on', b.dataset.view === v);
    this.fitShopList();
  }
  /** List view shows at most 5 rows, then scrolls (row height depends on UI scale, so measure it). */
  fitShopList() {
    const box = $('#shop-items');
    if (box.className !== 'list' || !this.shopOpen()) { box.style.maxHeight = ''; return; }
    const row = [...box.children].find((b) => !b.classList.contains('hidden'));
    const gap = parseFloat(getComputedStyle(box).rowGap) || 0;
    box.style.maxHeight = row ? `${row.offsetHeight * 5 + gap * 4 + 2}px` : '';
  }
  filterShop() {
    const words = $('#shop-search').value.toLowerCase().trim().split(/\s+/).filter(Boolean);
    let shown = 0;
    for (const b of $('#shop-items').children) {
      const hit = words.every((w) => b.dataset.q.includes(w));
      b.classList.toggle('hidden', !hit); shown += hit;
    }
    $('#shop-empty').classList.toggle('hidden', shown > 0);
  }
  /** The quick-hire strip: your 3 most recently hired troops and their keys (only work while the shop is open). */
  renderRecent() {
    const el = $('#shop-recent'); if (!el) return;
    const ids = this.app.recentHires || [];
    if (!ids.length) { el.innerHTML = `Recent: hire a troop and it gets a quick key (<kbd>${keyLabel(settings.keys.recent1)}</kbd> <kbd>${keyLabel(settings.keys.recent2)}</kbd> <kbd>${keyLabel(settings.keys.recent3)}</kbd>)`; return; }
    el.innerHTML = 'Recent:';
    ids.forEach((id, i) => {
      const b = document.createElement('button');
      b.className = 'rh frame';
      const d = this.formDefOf(id);
      b.innerHTML = `<kbd>${keyLabel(settings.keys['recent' + (i + 1)])}</kbd><img src="${portraitOf(d).face}" alt="">${d.name}`;
      b.onclick = (e) => this.app.hire(id, e.shiftKey ? 5 : 1);
      el.appendChild(b);
    });
  }

  // ======================= SKILL TREE (js/skilltree.js) =======================
  /** The definition a troop type is hired as right now (its picked form, or the base troop). */
  formDefOf(id) { const T = this.app.game?.teams[this.app.playerTeam]; return formDef(id, T?.forms[id]); }
  skillsOpen() { return $('#skills').classList.contains('open'); }
  toggleSkills(force) {
    const el = $('#skills');
    const open = force ?? !el.classList.contains('open');
    if (open === el.classList.contains('open')) return;
    if (open) { this.toggleShop(false); this.toggleBarracks(false); }
    el.classList.toggle('open', open);
    $('#btn-skills').classList.toggle('on', open);
    sfx(open ? 'shop' : 'click');
    if (open) this.renderSkills();
  }
  /** Any evolution you could pick right now (drives the dot on the HUD button). */
  evolutionsReady() {
    const g = this.app.game, pt = this.app.playerTeam;
    if (!g || pt === null) return 0;
    return this.roster().filter((id) => Object.keys(SKILL_TREES[id] || {}).some((f) => !g.formBlock(pt, id, f))).length;
  }
  renderSkills() {
    const g = this.app.game, pt = this.app.playerTeam;
    if (!g || pt === null) return;
    $('#btn-skills').classList.toggle('ready', this.evolutionsReady() > 0);
    if (!this.skillsOpen()) return;
    const T = g.teams[pt], roster = this.roster();
    if (!roster.includes(this.skillSel)) this.skillSel = roster.find((id) => SKILL_TREES[id]) || roster[0];
    // left: every troop you can hire, its level and kill progress
    $('#sk-troops').innerHTML = roster.map((id) => {
      const d = formDef(id, T.forms[id]), L = g.troopLevel(this.app.playerTeam, id);
      const ready = Object.keys(SKILL_TREES[id] || {}).some((f) => !g.formBlock(pt, id, f));
      return `<button class="sk-t frame${id === this.skillSel ? ' on' : ''}${SKILL_TREES[id] ? '' : ' none'}${ready ? ' ready' : ''}" data-id="${id}">
        <img src="${portraitOf(d).face}" alt=""><span class="sk-lv">Lv ${L.level}</span>
        <span class="sk-tn"><b>${d.name}</b><small>${L.max ? 'max level' : `${L.into} / ${L.need} exp`}${SKILL_TREES[id] ? '' : ' · no tree yet'}</small>
        <i class="sk-xp"><i style="width:${L.max ? 100 : (L.into / L.need * 100)}%"></i></i></span>${ready ? '<em>!</em>' : ''}</button>`;
    }).join('');
    $$('#sk-troops .sk-t').forEach((b) => (b.onclick = () => { sfx('click'); this.skillSel = b.dataset.id; this.renderSkills(); }));
    // right: the selected troop's tree, base on the left, branches to the right
    const id = this.skillSel, tree = SKILL_TREES[id], cur = T.forms[id] || null, L = g.troopLevel(this.app.playerTeam, id);
    const box = $('#sk-pan');
    $('#sk-tree').classList.toggle('empty', !tree);
    if (!tree) { box.innerHTML = `<div class="sk-empty">${UNITS[id].name} has no skill tree yet. It still earns exp from kills, so it's ready when one is added.</div>`; return; }
    const path = formPath(id, cur);
    const card = (formId) => {
      const d = formDef(id, formId), n = formId ? tree[formId] : null;
      const picked = formId === null ? true : path.includes(formId);
      const err = formId ? g.formBlock(pt, id, formId) : null;
      const state = picked ? (formId === cur ? 'current' : 'done') : !err ? 'open' : (n && (n.from ?? null) === cur) ? 'locked' : 'off';
      const lines = formId ? this.formLines(id, formId) : [`<span class="sk-l">${d.role}</span>`, `<span class="sk-chips">${(d.abilities || []).filter((a) => ABILITIES[a]).map((a) => `<span class="sk-ab">${pIcon(a, 'class="pico sm"', d)}${ABILITIES[a].name}</span>`).join('')}</span>`];
      const btn = state === 'open' ? `<button class="btn sk-go" data-form="${formId}">EVOLVE</button>`
        : state === 'current' ? '<span class="sk-st cur">HIRING THIS</span>'
        : state === 'done' ? '<span class="sk-st">PICKED</span>'
        : state === 'locked' ? `<span class="sk-st lock">Needs Lv ${n.level} (${L.level})</span>`
        : `<span class="sk-st lock">${this.offReason(id, formId, path)}</span>`;
      return `<div class="sk-node ${state}"><div class="sk-card frame">
        <div class="sk-h"><img src="${portraitOf(d).face}" alt=""><div><b>${d.name}</b><small>${n ? 'Level ' + n.level : 'Base troop'}</small></div></div>
        <div class="sk-lines">${lines.join('')}</div>${n?.desc ? `<p>${n.desc}</p>` : ''}${n?.needs?.grant && !T.grants?.[id]?.includes(n.needs.grant) ? `<p class="sk-need">${n.needs.text}</p>` : ''}${btn}</div>${branch(formId)}</div>`;
    };
    const branch = (formId) => {
      const kids = nextForms(id, formId);
      return kids.length ? `<div class="sk-kids">${kids.map(card).join('')}</div>` : '';
    };
    const fresh = this._skZoomFor !== id;
    box.innerHTML = `<div class="sk-root">${card(null)}</div>`;
    if (fresh) { this._skZoomFor = id; this.skillZoom('open'); } else this.skillZoom(this.skZoom || 1);
    $$('.sk-go', box).forEach((b) => (b.onclick = () => {
      const err = g.pickForm(pt, id, b.dataset.form);
      if (err) { this.toast(err, 'err'); sfx('error', 150); return; }
      sfx('evolve');
      this.toast(`Evolved: new ${UNITS[id].name}s come out as ${formDef(id, b.dataset.form).name}. The ones on the field stay as they are.`);
    }));
  }
  /** Why a node isn't on your current path: you went the other way, or its parent isn't picked yet. */
  offReason(id, formId, path) {
    const mine = formPath(id, formId), n = SKILL_TREES[id][formId];
    for (let k = 0; k < Math.min(mine.length, path.length); k++) if (mine[k] !== path[k]) return 'Other path';
    return `Lv ${n.level} · after ${SKILL_TREES[id][n.from].name}`;
  }
  /** What a node changes, compact: stat chips + ability chips (hover an icon for its exact text). */
  formLines(id, formId) {
    const n = SKILL_TREES[id][formId], d = formDef(id, formId), parent = formDef(id, n.from), out = [];
    const label = { hp: 'HP', hpRegen: 'REGEN', damage: 'DMG', attackSpeed: 'AS', moveSpeed: 'MS', armor: 'ARMOR', ward: 'WARD', range: 'RANGE', evasion: 'EVA', missChance: 'MISS', mana: 'MANA', manaRegen: 'MANA REGEN' };
    // stats are totals vs the base troop (not added to the parent's)
    const chips = Object.entries(n.stats || {}).map(([k, v]) => `<span class="sk-stat${v < 0 ? ' neg' : ''}">${v > 0 ? '+' : ''}${fmt(v)}${k === 'missChance' ? '%' : ''} ${label[k] || k}</span>`);
    if (n.cost) chips.push(`<span class="sk-stat${n.cost > 0 ? ' neg' : ''}">${n.cost > 0 ? '+' : ''}${fmt(n.cost)}g</span>`);
    if (chips.length) out.push(`<span class="sk-chips" title="${n.from ? 'Totals vs the base troop (not added to the previous form)' : 'Vs the base troop'}">${chips.join('')}</span>`);
    const ab = [];
    for (const a of n.removes || []) ab.push(`<span class="sk-ab lost">${pIcon(a, 'class="pico sm"')}<s>${ABILITIES[a].name}</s></span>`);
    for (const a of n.abilities || []) ab.push(`<span class="sk-ab new">${pIcon(a, 'class="pico sm"', d)}${ABILITIES[a].name}<em>NEW</em></span>`);
    for (const a of Object.keys(n.abilityMods || {})) {
      const now = { ...ABILITIES[a], ...(d.abilityMods?.[a] || {}) }, was = { ...ABILITIES[a], ...(parent.abilityMods?.[a] || {}) };
      if (abilityText(now) === abilityText(was) && now.name === was.name) continue;
      ab.push(`<span class="sk-ab up">${pIcon(a, 'class="pico sm"', d)}${now.name}<em>${now.name !== was.name ? 'NEW' : 'UP'}</em></span>`);
    }
    if (ab.length) out.push(`<span class="sk-chips">${ab.join('')}</span>`);
    return out;
  }
  /** Skill tree zoom: a number (scale), '+', '-' or 'fit' (whole tree in view, never above 100%). */
  skillZoom(z) {
    const pan = $('#sk-pan'), root = $('.sk-root', pan);
    if (!root) return;
    let k = this.skZoom || 1;
    if (z === '+') k *= 1.2; else if (z === '-') k /= 1.2;
    else if (z === 'fit' || z === 'open') {   // fit the whole tree; on open, never below 70% so the text stays readable (wheel / − zooms out further)
      root.style.zoom = 1; const w = root.scrollWidth, h = root.scrollHeight; k = Math.min(1, (pan.clientWidth - 12) / w, (pan.clientHeight - 12) / h);
      if (z === 'open') k = Math.max(0.7, k);
    }
    else k = +z || 1;
    this.skZoom = k = Math.max(0.35, Math.min(1.6, k));
    root.style.zoom = k;
    $('#sk-zoom-v').textContent = Math.round(k * 100) + '%';
  }

  // ======================= REPAIR =======================
  toggleAutoLoot() {
    const g = this.app.game, pt = this.app.playerTeam;
    if (!g || pt === null) return;
    g.setAutoLoot(pt, !g.teams[pt].autoLoot);
    sfx(g.teams[pt].autoLoot ? 'order' : 'click');
    this.toast(`Auto-loot ${g.teams[pt].autoLoot ? 'ON — kills put drops straight in the killer\'s bag' : 'OFF — drops land on the ground'}`);
    this.renderAutoLoot();
  }
  renderAutoLoot() {
    const T = this.app.game?.teams[this.app.playerTeam];
    const on = !!T?.autoLoot;
    $('#btn-autoloot').classList.toggle('on', on);
    $('#autoloot-state').textContent = on ? 'ON' : 'OFF';
    $('#autoloot-kbd').textContent = keyLabel(settings.keys.autoLoot);
    if (this._alOn !== on) { this._alOn = on; if (this.tipEl?.id === 'btn-autoloot') this.renderTip(); }
  }
  toggleRepair() {
    const g = this.app.game; if (!g || this.app.playerTeam === null) return;
    const T = g.teams[this.app.playerTeam];
    const err = g.setRepair(this.app.playerTeam, !T.repairOn);
    if (err) { this.toast(err, 'err'); sfx('error', 150); return; }
    sfx(T.repairOn ? 'order' : 'click');
  }
  renderRepair() {
    const g = this.app.game, t = this.app.playerTeam, T = g.teams[t], B = g.bases[t];
    const r = g.repairRates(t);
    const el = $('#btn-repair');
    el.classList.toggle('on', !!T.repairOn);
    el.classList.toggle('idle', !!T.repairOn && B.hp >= B.maxHp);
    $('#repair-rate').textContent = `+${r.heal}/s · -${r.drain}g`;
    $('#repair-kbd').textContent = keyLabel(settings.keys.repair);
    if (this.tipEl === el) this.renderTip();
  }

  // ======================= BARRACKS =======================
  upgradeName(id) { return UPGRADES[id]?.name || id; }
  barracksOpen() { return $('#barracks').classList.contains('open'); }
  buildOpen() { return $('#build').classList.contains('open'); }
  /**
   * Building upgrade panel: shows while exactly one of your buildings with an upgrade tree is selected.
   * Lv 1 → 2 is one card, Lv 2 → 3 shows both paths side by side, then the chosen path continues to Lv 5.
   * Re-rendered only when something it shows changes (level, upgrade progress step, affordability).
   */
  renderBuildingUpgrade() {
    const el = $('#bup'), g = this.app.game, team = this.app.playerTeam;
    const sel = this.app.controls.selection;
    const u = sel.length === 1 && sel[0].structure && sel[0].team === team && !sel[0].dead && BUILD_TREES[sel[0].def.id] ? sel[0] : null;
    if (!u) { if (el.classList.contains('open')) { el.classList.remove('open'); this._bupKey = ''; } return; }
    const T = g.teams[team], U = u.upgrading, steps = U ? [] : nextSteps(u.def.id, u.bLevel, u.bPath);
    const key = [u.id, u.bLevel, u.bPath, u.built, U ? Math.floor(U.t / U.total * 20) : -1, steps.map((st) => T.gold >= st.node.cost).join()].join('|');
    el.classList.add('open');
    if (key === this._bupKey) return;
    this._bupKey = key;
    const tree = BUILD_TREES[u.def.id];
    const pathName = u.bPath ? tree[u.bPath].name : '';
    const head = `<div class="bu-head"><h4>${u.def.name}</h4><small>Lv ${u.bLevel}${pathName ? ' · ' + pathName : ''}</small>
      <span class="bu-pips">${[1, 2, 3, 4, 5].map((l) => `<i class="${l <= u.bLevel ? 'on' : ''}"></i>`).join('')}</span></div>`;
    let body;
    if (!u.built) body = '<div class="bu-max">Finish construction to upgrade.</div>';
    else if (U) body = `<div class="bu-max">Upgrading to <b>${U.name}</b> (Lv ${U.level}) · ${Math.ceil(U.total - U.t)}s · still firing</div><div class="bu-prog"><i style="width:${(U.t / U.total * 100).toFixed(0)}%"></i></div>`;
    else if (!steps.length) body = '<div class="bu-max">Max level.</div>';
    else body = `<div class="bu-steps">${steps.map((st) => `<button class="bu-step frame${T.gold < st.node.cost ? ' off' : ''}" data-path="${st.path || ''}">
        <span class="bu-cost"><svg class="ico"><use href="#i-coin"/></svg>${st.node.cost} · ${st.node.time}s</span>
        <b>Lv ${st.level} · ${st.node.name}</b>${steps.length > 1 ? `<span class="bu-path">Path ${st.path.toUpperCase()}: ${tree[st.path].name} — ${tree[st.path].desc}</span>` : ''}
        <div>${st.node.desc}</div></button>`).join('')}</div>`;
    el.innerHTML = head + body;
    $$('#bup .bu-step').forEach((b) => (b.onclick = () => {
      const err = g.upgradeBuilding(u, b.dataset.path || null);
      if (err) { this.toast(err, 'err'); sfx('error', 150); } else { sfx('click'); this._bupKey = ''; }
    }));
  }
  /** Build menu: one card per faction building; clicking one starts placement (Controls.startBuild). */
  toggleBuild(force) {
    const el = $('#build');
    const open = force ?? !el.classList.contains('open');
    if (open === el.classList.contains('open')) return;
    if (open) { this.toggleShop(false); this.toggleBarracks(false); this.toggleSkills(false); }
    el.classList.toggle('open', open);
    $('#btn-build').classList.toggle('on', open);
    sfx(open ? 'shop' : 'click');
    if (open) this.renderBuild();
  }
  renderBuild() {
    const g = this.app.game, team = this.app.playerTeam; if (!g || team === null) return;
    const T = g.teams[team], ids = FACTIONS[T.faction].buildings || [];
    // one line of what the building does, by fire type
    const stats = (d) => {
      const S = d.structure, every = `every ${fmt(60 / d.attackSpeed)}s`, air = S.groundOnly ? 'ground only' : 'hits flying';
      const atk = S.fire === 'volley' ? `${S.volley.count} rockets × ${d.damage} (r ${S.splash})`
        : S.fire === 'direct' ? `${d.damage} dmg` : `${d.damage} splash dmg (r ${S.splash})`;
      const extra = [S.trueSight && `true sight ${S.trueSight}`, S.suppress && `hits slow ${S.suppress.pct}%`].filter(Boolean).join(' · ');
      return `${d.hp} HP · ${d.armor} armor · ${atk}<br>range ${S.minRange ? S.minRange + '–' : ''}${d.range} · ${every} · ${air}${extra ? '<br>' + extra : ''}`;
    };
    const card = (id) => {
      const d = UNITS[id], S = d.structure, lim = g.buildLimit(team, id);
      const have = S.tower ? '' : `<small>${g.buildingsOf(team).filter((u) => u.def.id === id).length}/${GAME.build.maxPerSide}</small>`;
      const off = !!lim || T.gold < d.cost;
      return `<button class="bcard frame${off ? ' off' : ''}" data-build="${id}" title="${lim || ''}">
        <img src="${PORTRAITS[id]?.full || ''}" alt="">
        <div><h4>${d.name} ${have}</h4>
          <div class="bcost"><svg class="ico"><use href="#i-coin"/></svg>${d.cost} · ${S.buildTime}s to build</div>
          <div class="bstats">${stats(d)}</div>${lim ? `<div class="blim">${lim}</div>` : ''}</div>
      </button>`;
    };
    const arty = ids.filter((id) => !UNITS[id].structure.tower), towers = ids.filter((id) => UNITS[id].structure.tower);
    const cap = g.towerCap(team);
    $('#build-items').innerHTML = (arty.length ? `<div class="bsec">Artillery <small>max ${GAME.build.maxPerSide} of each · within ${GAME.build.maxDist} of your base</small></div>${arty.map(card).join('')}` : '')
      + (towers.length ? `<div class="bsec">Towers <small>${g.towerCount(team)}/${cap} by base level (Lv 1–2: 1 · Lv 3–4: 2 · Lv 5: 3) · within ${GAME.build.towerMaxDist} of your base</small></div>${towers.map(card).join('')}` : '')
      || '<div class="more">Nothing to build.</div>';
    $$('#build-items .bcard').forEach((b) => (b.onclick = () => {
      const id = b.dataset.build, d = UNITS[id], lim = g.buildLimit(team, id);
      if (lim) { this.toast(lim, 'err'); sfx('error', 150); return; }
      if (T.gold < d.cost) { this.toast('Not enough gold', 'err'); sfx('error', 150); return; }
      sfx('click');
      this.toggleBuild(false);
      this.app.controls.startBuild(id);
    }));
  }
  toggleBarracks(force) {
    const el = $('#barracks');
    const open = force ?? !el.classList.contains('open');
    if (open === el.classList.contains('open')) return;
    if (open) { this.toggleShop(false); this.toggleSkills(false); }
    el.classList.toggle('open', open);
    $('#btn-barracks').classList.toggle('on', open);
    sfx(open ? 'shop' : 'click');
    if (open) this.renderBarracks(true);
  }
  buildBarracks() {
    const box = $('#barracks-items');
    const f = this.app.playerFaction || 'medieval';
    const list = upgradesFor(f);
    const group = (cat, title) => `<div class="bgroup"><div class="bg-h">${title}</div><div class="bgrid">${list.filter((U) => U.category === cat).map((U) => `
      <button class="bitem frame" data-id="${U.id}">
        <span class="bicon"><svg><use href="#${U.icon}"/></svg></span>
        <span class="bmain"><b>${U.name}</b><small class="blvl"></small><span class="bnext"></span></span>
        <span class="bcost"><span class="bprice"></span><small class="btime"></small></span>
        <i class="bprog"></i>
      </button>`).join('')}</div></div>`;
    box.innerHTML = group('troop', 'Troops') + group('base', 'Base');
    $$('.bitem', box).forEach((el) => {
      const U = UPGRADES[el.dataset.id];
      el.dataset.tip = 'upgrade:' + U.id;
      // LMB: research / queue another level (same upgrade can be stacked). RMB: cancel its last queued level.
      el.onclick = () => {
        const g = this.app.game;
        const err = g.research(this.app.playerTeam, U.id);
        if (err) { this.toast(err, 'err'); sfx('error', 150); } else sfx('train');
        this.renderBarracks(true);
      };
      el.oncontextmenu = (e) => {
        e.preventDefault();
        const g = this.app.game, T = g.teams[this.app.playerTeam];
        let slot = -2;
        for (let k = T.rqueue.length - 1; k >= 0; k--) if (T.rqueue[k].id === U.id) { slot = k; break; }
        if (slot === -2 && T.research?.id === U.id) slot = -1;
        if (slot === -2) return;
        g.cancelResearch(this.app.playerTeam, slot); sfx('click'); this.toast('Research cancelled (refunded)');
        this.renderBarracks(true);
      };
    });
    $('#barracks-kbd').textContent = keyLabel(settings.keys.barracks);
    $('#barracks-key').textContent = keyLabel(settings.keys.barracks);
  }
  renderBarracks(force = false) {
    const g = this.app.game;
    if (!g || this.app.playerTeam === null) return;
    const T = g.teams[this.app.playerTeam], R = T.research;
    // HUD button progress
    const bp = $('#btn-barracks .rprog');
    bp.style.width = R ? (R.t / R.total * 100) + '%' : '0';
    $('#btn-barracks').classList.toggle('busy', !!R);
    if (!this.barracksOpen() && !force) return;
    const qkey = T.rqueue.map((e) => e.id + e.level).join(',') + '|' + (R ? R.id + R.level : '');
    if (qkey !== this.rqKey || force || !$('#research-bar .rbar')) {
      this.rqKey = qkey;
      const qi = (e, k) => `<button class="rq" data-slot="${k}" data-tip="upgrade:${e.id}"><svg><use href="#${UPGRADES[e.id].icon}"/></svg><em>${e.level}</em></button>`;
      $('#research-bar').innerHTML = (R
        ? `<div class="rbar"><svg class="ico"><use href="#${UPGRADES[R.id].icon}"/></svg><span>Researching <b>${UPGRADES[R.id].name} Lv ${R.level}</b></span><i></i><em></em></div>`
        : `<div class="rbar idle"><span>No research running — pick an upgrade.</span></div>`) +
        `<div class="rqueue"><span>QUEUE ${g.researchCount(this.app.playerTeam)}/${GAME.researchQueueMax}</span>${T.rqueue.map(qi).join('')}${'<i class="rqe"></i>'.repeat(Math.max(0, GAME.researchQueueMax - 1 - T.rqueue.length))}</div>`;
      $$('#research-bar .rq').forEach((b) => (b.onclick = () => { g.cancelResearch(this.app.playerTeam, +b.dataset.slot); sfx('click'); this.toast('Research cancelled (refunded)'); this.renderBarracks(true); }));
      const rb = $('#research-bar .rbar');
      if (R) rb.onclick = () => { g.cancelResearch(this.app.playerTeam, -1); sfx('click'); this.toast('Research cancelled (refunded)'); this.renderBarracks(true); };
    }
    if (R) { $('#research-bar .rbar i').style.width = (R.t / R.total * 100) + '%'; $('#research-bar .rbar em').textContent = Math.ceil(R.total - R.t) + 's · click to cancel'; }
    $$('#barracks-items .bitem').forEach((el) => {
      const U = UPGRADES[el.dataset.id];
      const done = g.upLevel(this.app.playerTeam, U.id);
      const lvl = g.pendingLevel(this.app.playerTeam, U.id);      // next level to queue (after running + queued)
      const queued = lvl - done;
      const cap = g.upgradeMax(this.app.playerTeam, U);
      const maxed = lvl >= cap;
      const locked = maxed && lvl < U.max;      // tower upgrade waiting on a higher base level
      const price = maxed ? 0 : upgradePrice(U, lvl);
      const mine = R?.id === U.id;
      const full = g.researchCount(this.app.playerTeam) >= GAME.researchQueueMax;
      $('.blvl', el).textContent = (U.max === Infinity ? `Lv ${done}` : `Lv ${done}/${cap}`) + (queued ? ` (+${queued} queued)` : '');
      $('.bnext', el).innerHTML = locked ? this.baseLevelNeed(lvl) : maxed ? (queued ? 'Max level queued' : 'MAXED') : `Lv ${lvl + 1}: ` + U.levelText(lvl + 1, U);
      $('.bprice', el).innerHTML = maxed ? '' : `<svg class="ico"><use href="#i-coin"/></svg>${price}`;
      $('.btime', el).textContent = maxed ? '' : `${fmt(upgradeTime(U, lvl) * g.speedMult(this.app.playerTeam))}s`;
      $('.bprog', el).style.width = mine ? (R.t / R.total * 100) + '%' : '0';
      el.classList.toggle('maxed', maxed);
      el.classList.toggle('poor', !maxed && T.gold < price);
      el.classList.toggle('busy', !maxed && full);
      el.classList.toggle('mine', mine || queued > 0);
    });
    if (this.tipEl && this.tipEl.closest?.('#barracks')) this.renderTip();
  }

  toggleShop(force) {
    const el = $('#shop');
    const open = force ?? !el.classList.contains('open');
    if (open && this.barracksOpen()) this.toggleBarracks(false);
    if (open && this.skillsOpen()) this.toggleSkills(false);
    if (open === el.classList.contains('open')) return;
    el.classList.toggle('open', open);
    $('#btn-shop').classList.toggle('on', open);
    if (open) this.fitShopList();
    sfx(open ? 'shop' : 'click');
  }

  renderQueue() {
    const T = this.app.game.teams[this.app.playerTeam];
    const key = T.queue.join(',') + JSON.stringify(T.forms);
    const q = $('#queue');
    if (key !== this.lastQueueKey) {
      this.lastQueueKey = key;
      q.innerHTML = `<div class="qhead">TRAINING ${T.queue.length}/${GAME.queueMax}</div>`;
      for (let i = 0; i < GAME.queueMax; i++) {
        const id = T.queue[i];
        if (!id) { q.insertAdjacentHTML('beforeend', '<div class="qe"></div>'); continue; }
        const b = document.createElement('button');
        b.className = 'qi';
        const qd = this.formDefOf(id);
        b.title = `${qd.name} — click to cancel (refund ${fmt(T.queuePaid[i] ?? qd.cost)}g)`;
        b.innerHTML = `<img src="${portraitOf(qd).face}" alt="">${i === 0 ? '<i></i>' : ''}`;
        b.onclick = () => { if (this.app.game.cancelQueue(this.app.playerTeam, i)) sfx('click'); };
        q.appendChild(b);
      }
    }
    const bar = $('#queue .qi i');
    if (bar) bar.style.width = (T.trainT / (UNITS[T.queue[0]].trainTime * this.app.game.speedMult(this.app.playerTeam)) * 100) + '%';
  }

  setupHUD() {
    const g = this.app.game, pt = this.app.playerTeam;
    for (const t of [0, 1]) {
      const f = FACTIONS[g.teams[t].faction];
      const el = $(`#base-${t}`);
      el.className = 'basebar ' + f.id + (t === pt ? ' you' : '');
    }
    this.renderBaseNames();
    g.on('baseLevel', () => this.renderBaseNames());
    this.buildCommandCard();
    this.buildShop();
    this.buildBarracks();
    this.skillSel = null;
    this.toggleSkills(false);
    g.on('form', (team) => { if (team === pt) { this.buildShop(); this.renderSkills(); } });
    g.on('troopLevel', (team, id, L) => {
      if (team !== pt) return;
      // only speak up when a level actually unlocks something (the HUD button dot covers the rest)
      const unlocked = Object.entries(SKILL_TREES[id] || {}).filter(([f, n]) => n.level === L && !g.formBlock(pt, id, f));
      if (unlocked.length) { this.toast(`${this.formDefOf(id).name} reached level ${L}: evolution ready! Open the Skill Tree (${keyLabel(settings.keys.skills)})`); sfx('evolve'); }
      this.renderSkills();
    });
    this.toggleShop(false);
    this.toggleBarracks(false);
    this.lastSelKey = '#';
    this.refreshSelection(true);
  }

  /** Top bar base names follow the base level (Wooden Fort → … → Citadel). */
  renderBaseNames() {
    const g = this.app.game, pt = this.app.playerTeam;
    for (const t of [0, 1]) {
      const name = `${(t === 0 ? CASTLE_TIERS : HQ_TIERS)[g.bases[t].level - 1].name} <small>Lv ${g.bases[t].level}</small>`;
      const tag = t === pt ? '<em>YOU</em>' : '<em class="ai">AI</em>';
      $('.bname', $(`#base-${t}`)).innerHTML = t === 0 ? name + tag : tag + name;
    }
  }

  update(dt) {
    const g = this.app.game;
    if (!g || this.app.playerTeam === null) return;
    const T = g.teams[this.app.playerTeam];
    this.renderBuildingUpgrade();
    const demo = $('#cmds [data-cmd="demolish"]');   // Demolish shows only while one of your buildings is selected
    if (demo) demo.hidden = !this.app.controls.selection.some((u) => u.structure && u.team === this.app.playerTeam);
    $('#gold').textContent = Math.floor(T.gold);
    $('#income').textContent = `+${T.income}/s`;
    $('#clock').textContent = fmtTime(g.time);
    const dn = g.dayNight, dnEl = $('#daynight');
    if (dnEl._n !== dn.night) { dnEl._n = dn.night; $('use', dnEl).setAttribute('href', dn.night ? '#i-moon' : '#i-sun'); dnEl.classList.toggle('night', dn.night); }
    $('b', dnEl).textContent = fmtTime(dn.left);
    $('#pop').textContent = `${g.pop(this.app.playerTeam)}/${g.popCap(this.app.playerTeam)}`;
    for (const b of g.bases) {
      const el = $(`#base-${b.team}`);
      // no CSS transition here: HP changes every frame while sieging/repairing, and a restarting stepped transition froze the bar
      const w = Math.max(0, Math.min(100, b.hp / b.maxHp * 100)).toFixed(2) + '%', txt = `${Math.ceil(b.hp)} / ${Math.round(b.maxHp)}`;
      const bi = $('i', el), bs = $('span', el);
      if (bi.style.width !== w) bi.style.width = w;
      if (bs.textContent !== txt) bs.textContent = txt;
    }
    const cheapest = Math.min(...this.roster().map((id) => UNITS[id].cost));
    $$('#shop-items .sitem').forEach((el) => {
      const cost = g.unitCost(this.app.playerTeam, el.dataset.id);
      el.classList.toggle('poor', T.gold < cost);
      const tb = g.tierBlock(this.app.playerTeam, el.dataset.id);
      el.classList.toggle('locked', !!tb);
      const lk = $('.lock', el); if (lk && lk.textContent !== (tb || '')) lk.textContent = tb || '';
      const pe = $('.price b', el); if (pe) pe.textContent = Math.round(cost * 10) / 10;
    });
    this.renderBarracks();
    { const T = this.app.game.teams[this.app.playerTeam], k = JSON.stringify(T.troopXp, (_, v) => typeof v === 'number' ? Math.floor(v) : v) + JSON.stringify(T.forms);   // kills/forms changed -> refresh the tree
      if (k !== this._skKey) { this._skKey = k; this.renderSkills(); } }
    this.renderRepair();
    this.renderAutoLoot();
    const vsAI = g.teams.some((T2, t) => t !== this.app.playerTeam && T2.isAI);
    $('#speedctl').classList.toggle('hidden', !vsAI);
    $$('#speedctl button').forEach((b) => b.classList.toggle('on', +b.dataset.speed === (this.app.timeScale || 1)));
    // nudge: idle gold piling up and shop closed -> pulse the shop button
    $('#btn-shop').classList.toggle('pulse', T.gold >= cheapest * 3 && !$('#shop').classList.contains('open') && !T.queue.length);
    this.renderQueue();
    $('#cmds').classList.toggle('dim', !this.app.controls.own().length);
    this.panelT -= dt;
    if (this.panelT <= 0) { this.panelT = 0.1; this.refreshSelection(); this.drawMinimap(); }
  }

  // ======================= selection panel + inventory =======================
  /** "Needs Fortress (Castle Lv 4)": the first base level with more wall spots than `lvl`. */
  baseLevelNeed(lvl) {
    const L = BASE_LEVELS.find((s) => s.slots > lvl)?.level; if (!L) return 'MAXED';
    const castle = this.app.playerFaction !== 'modern';
    return `Needs ${(castle ? CASTLE_TIERS : HQ_TIERS)[L - 1].name} (${castle ? 'Castle' : 'HQ'} Lv ${L}) · research ${castle ? 'Fortify' : 'Expand HQ'}`;
  }
  /** Base selected: HP, defenses, economy, towers and every researched upgrade (own or enemy). */
  renderBaseSelection(b, force) {
    const g = this.app.game, T = g.teams[b.team], pt = this.app.playerTeam;
    const enemy = pt !== null && b.team !== pt;
    // enemy base: only what you last saw (fog of war intel); your own base: live
    const I = enemy ? g.intel?.[pt] || { seen: false } : { seen: true, live: true, upLevels: T.upLevels, research: T.research ? { id: T.research.id, level: T.research.level, left: T.research.total - T.research.t } : null, towers: T.towers, repairOn: T.repairOn, income: T.income };
    const panel = $('#selpanel');
    panel.classList.remove('empty');
    panel.classList.toggle('enemy', enemy);
    const f = FACTIONS[T.faction];
    const key = 'base' + b.team + ':' + b.level + ':' + I.seen + ':' + JSON.stringify(I.upLevels || {}) + (I.research?.id || '');
    if (key !== this.lastSelKey || force) {
      this.lastSelKey = key;
      $('#sp-portrait').src = PORTRAITS['base' + b.team].face;
      $('#sp-name').textContent = (b.team === 0 ? CASTLE_TIERS : HQ_TIERS)[b.level - 1].name + (enemy ? ' (enemy)' : '');
      const ups = Object.entries(I.upLevels || {}).filter(([, l]) => l > 0);
      const grid = $('#sp-grid');
      grid.style.display = 'grid';
      grid.classList.add('basegrid');
      grid.innerHTML = !I.seen ? ''
        : ups.length ? ups.map(([id, l]) => `<div class="cell upcell" data-tip="upgrade:${id}:${b.team}:${l}"><svg><use href="#${UPGRADES[id].icon}"/></svg><em>${l}</em></div>`).join('')
        : '<div class="more" style="grid-column:1/-1">No upgrades researched yet</div>';
      $('#sp-abil').innerHTML = ''; $('#sp-inv').classList.remove('on'); $('#sp-inv').innerHTML = '';
      $('#sp-res').innerHTML = '';
    }
    const fr = b.hp / b.maxHp;
    $('#sp-hpfill').style.width = (fr * 100) + '%';
    $('#sp-hpfill').style.background = fr > 0.5 ? 'var(--hp)' : fr > 0.25 ? 'var(--gold)' : 'var(--bad)';
    $('#sp-hptext').textContent = `${Math.ceil(b.hp)} / ${Math.round(b.maxHp)}`;
    const ago = enemy && I.seen ? (g.time - I.time < 1 ? ' · in vision' : ` · last seen ${fmtTime(g.time - I.time)} ago`) : '';
    const R = I.research;
    $('#sp-order').textContent = 'Base' + ago + ' · ' + (!I.seen ? 'Unknown' : R ? `Researching ${UPGRADES[R.id].name} Lv ${R.level}` + (enemy && g.time - I.time >= 1 ? '' : ` (${Math.ceil(R.left)}s)`) : 'No research running');
    const rr = g.repairRates(b.team);
    const stat = (label, val) => `<div><span>${label}</span><b>${val}</b></div>`;
    const q = (v) => (I.seen ? v : '?');
    $('#sp-stats').innerHTML = stat('LEVEL', b.level) + stat('ARMOR', fmt(b.armor)) + stat('INCOME', q(fmt(I.income) + '/s')) + stat('TOWERS', q(I.towers)) +
      stat('REPAIR', q(I.repairOn ? `ON +${rr.heal}/s` : 'off')) + (enemy ? '' : stat('ARMY', g.pop(b.team))) + stat('UPGRADES', q(Object.values(I.upLevels || {}).reduce((a, l) => a + l, 0)));
  }

  refreshSelection(force = false) {
    const ctl = this.app.controls;
    if (ctl.selectedBase) { this.renderStatus(null); return this.renderBaseSelection(ctl.selectedBase, force); }
    const sel = this.app.controls.selection;
    const key = sel.map((u) => u.id).join(',');
    const panel = $('#selpanel');
    if (!sel.length) {
      panel.classList.add('empty'); this.renderStatus(null);
      $('#sp-hint').innerHTML = `Drag a box over your troops to select them · <kbd>${keyLabel(settings.keys.selectAll)}</kbd> selects your whole army`;
      this.lastSelKey = key;
      return;
    }
    panel.classList.remove('empty');
    const p = sel[0];
    const isEnemy = p.team !== this.app.playerTeam;
    panel.classList.toggle('enemy', isEnemy);
    const single = sel.length === 1;
    if (key !== this.lastSelKey || force) {
      this.lastSelKey = key;
      $('#sp-portrait').src = portraitOf(p.def).face;
      $('#sp-name').textContent = p.def.name + (p.brainwashed ? ' (brainwashed)' : p.team === 2 ? ' (neutral)' : isEnemy ? ' (enemy)' : '');
      const grid = $('#sp-grid');
      grid.classList.remove('basegrid');
      grid.innerHTML = '';
      grid.style.display = single ? 'none' : 'grid';
      sel.slice(0, 24).forEach((u, i) => {
        const c = document.createElement('button');
        c.className = 'cell' + (i === 0 ? ' primary' : '');
        c.innerHTML = `<img src="${portraitOf(u.def).face}" alt=""><i><b></b></i>`;
        c.onclick = (e) => {
          sfx('click');
          const ctl = this.app.controls;
          if (e.shiftKey) ctl.setSelection(ctl.selection.filter((s) => s !== u));
          else ctl.setSelection([u]);
        };
        c._u = u;
        grid.appendChild(c);
      });
      if (sel.length > 24) grid.insertAdjacentHTML('beforeend', `<div class="more">+${sel.length - 24}</div>`);
      this._invKey = '';
      this.renderInventory(single ? p : null);
      this.renderAbilityBar(p, isEnemy);
    }
    this.updateAbilityBar(p);
    this.renderStatus(p);
    if (single) this.renderInventory(p);   // item cooldowns / used-up items
    const f = p.hp / p.maxHp;
    $('#sp-hpfill').style.width = (f * 100) + '%';
    $('#sp-hpfill').style.background = f > 0.5 ? 'var(--hp)' : f > 0.25 ? 'var(--gold)' : 'var(--bad)';
    $('#sp-hptext').textContent = `${Math.ceil(p.hp)} / ${Math.round(p.maxHp)}`;
    $('#sp-mana').style.display = p.maxMana ? '' : 'none';
    if (p.maxMana) { $('#sp-manafill').style.width = (p.mana / p.maxMana * 100) + '%'; $('#sp-manatext').textContent = `${Math.floor(p.mana)} / ${p.maxMana}`; }
    $('#sp-order').textContent = `${FAMILIES[p.family].name} · ` + (p.invulnerable ? `SHIELDED ${p.invulnT.toFixed(1)}s · ` : '') + (p.disarmed ? `DISARMED ${p.disarmT.toFixed(1)}s · ` : '') + (p.broken ? `BROKEN ${p.breakT.toFixed(1)}s · ` : '') + (p.invisible ? 'INVISIBLE · ' : '') + (p.flying ? 'FLYING · ' : '') + (p.structure && !p.built ? `BUILDING ${Math.floor(p.buildT / p.structure.buildTime * 100)}% · ` : '') + (p.casting ? 'CASTING · ' : '') + (p.brainwashed ? `BRAINWASHED ${p.brainwashed.t.toFixed(1)}s · ` : '') + (p.sleeping ? 'SLEEPING · ' : '') + (p.stance === 'prone' ? 'PRONE · ' : p.stance === 'channel' ? 'SETTING UP · ' : p.stance === 'standup' ? 'STANDING UP · ' : '') + (single ? ORDER_LABEL[p.order.type] : `${sel.length} units · ${ORDER_LABEL[p.order.type]}`);
    const s = p.stats, bn = p.bonus;
    const stat = (label, val, bonus) => `<div><span>${label}</span><b>${fmt(val)}</b>${bonus ? `<em>+${fmt(bonus)}</em>` : ''}</div>`;
    $('#sp-stats').innerHTML =
      stat('DMG', p.effDamage, bn.damage + p.pas.bonusDamage) + stat('ATK SPD', p.effAttackSpeed, bn.attackSpeed + p.pas.bonusAS) +
      stat('MOVE', p.effMoveSpeed, bn.moveSpeed) + stat('RANGE', p.ranged ? p.effRange : 'melee', bn.range + (p.pas.bonusRange || 0)) +
      stat('REGEN', fmt(s.hpRegen + p.pas.bonusRegen) + '/s', bn.hpRegen + p.pas.bonusRegen) +
      stat('EVADE', Math.round(p.effEvasion) + '%', Math.round(p.effEvasion - s.evasion)) + stat('KILLS', p.kills);
    const rk = [p.id, p.armor, p.ward].join(',');
    if ($('#sp-res')._k !== rk) {
      $('#sp-res')._k = rk;
      $('#sp-res').innerHTML = defRow(p.armor, p.ward, p.def.damageType, { armor: bn.armor + p.pas.bonusArmor, ward: bn.ward + p.pas.bonusWard });
    }
    $$('#sp-grid .cell').forEach((c) => {
      const u = c._u; const fr = u.hp / u.maxHp;
      const b = $('b', c); b.style.width = (fr * 100) + '%';
      b.style.background = fr > 0.5 ? 'var(--hp)' : fr > 0.25 ? 'var(--gold)' : 'var(--bad)';
    });
  }

  // ---------------- custom formation drawing pad ----------------
  openFormationEditor() {
    this._fePts = (settings.gameplay.customFormation || []).map((p) => [...p]);
    $('#formedit').classList.remove('hidden');
    this.drawFormationPad();
  }
  drawFormationPad() {
    const c = $('#formpad'), x = c.getContext('2d'), W = c.width, P = this._fePts || [];
    x.fillStyle = '#07090d'; x.fillRect(0, 0, W, W);
    x.fillStyle = '#1e2632'; for (let i = 1; i < 8; i++) { x.fillRect(i * W / 8, 0, 1, W); x.fillRect(0, i * W / 8, W, 1); }
    x.fillStyle = '#ffe14a'; x.fillRect(W / 2 - 6, 6, 12, 4); x.fillRect(W / 2 - 3, 2, 6, 4);   // "forward" marker
    const toPx = (p) => [(p[0] + 1) / 2 * W, (1 - p[1]) / 2 * W];
    x.fillStyle = '#5ce36f';
    for (let i = 1; i < P.length; i++) {   // chunky pixel stroke
      const [ax, ay] = toPx(P[i - 1]), [bx, by] = toPx(P[i]), n = Math.max(1, Math.ceil(Math.hypot(bx - ax, by - ay) / 3));
      for (let k = 0; k <= n; k++) x.fillRect(Math.round((ax + (bx - ax) * k / n) / 4) * 4 - 2, Math.round((ay + (by - ay) * k / n) / 4) * 4 - 2, 5, 5);
    }
    if (P.length === 1) { const [a, b] = toPx(P[0]); x.fillRect(a - 2, b - 2, 5, 5); }
  }
  bindFormationEditor() {
    const c = $('#formpad'); let down = false;
    const at = (e) => { const r = c.getBoundingClientRect(); return [Math.max(-1, Math.min(1, ((e.clientX - r.left) / r.width) * 2 - 1)), Math.max(-1, Math.min(1, 1 - ((e.clientY - r.top) / r.height) * 2))]; };
    c.addEventListener('pointerdown', (e) => { down = true; c.setPointerCapture(e.pointerId); this._fePts = [at(e)]; this.drawFormationPad(); });
    c.addEventListener('pointermove', (e) => {
      if (!down) return;
      const p = at(e), L = this._fePts[this._fePts.length - 1];
      if (Math.hypot(p[0] - L[0], p[1] - L[1]) > 0.04) { this._fePts.push(p); this.drawFormationPad(); }
    });
    c.addEventListener('pointerup', () => (down = false));
    $('#fe-clear').onclick = () => { sfx('click'); this._fePts = []; this.drawFormationPad(); };
    $('#fe-cancel').onclick = () => { sfx('click'); $('#formedit').classList.add('hidden'); };
    $('#fe-save').onclick = () => {
      if ((this._fePts || []).length < 2) { this.toast('Draw a shape first', 'err'); return; }
      settings.gameplay.customFormation = this._fePts.slice(0, 200).map(([a, b]) => [Math.round(a * 1000) / 1000, Math.round(b * 1000) / 1000]);
      saveSettings(); sfx('click'); $('#formedit').classList.add('hidden');
      this.toast(`Custom formation saved (Alt+${keyLabel(settings.keys.formation4)})`);
    };
  }

  /** Buff / debuff row above the selection panel (Unit.statusList). Rebuilt only when the set changes; timers tick in place. */
  renderStatus(p) {
    const box = $('#sp-buffs'); if (!box) return;
    const L = p && !p.dead ? p.statusList() : [];
    const key = (p?.id ?? '') + '|' + L.map((x) => x.id + ':' + (x.stacks || '')).join(',');
    if (box._k !== key) {
      box._k = key;
      box.innerHTML = L.map((x, i) => `<div class="buff ${x.kind}" data-tip="status:${i}"><svg><use href="#${x.icon}"/></svg><i class="bt"></i>${x.stacks ? `<em>${x.stacks}</em>` : ''}</div>`).join('');
    }
    box._list = L;
    const sp = $('#selpanel');   // sits just above the selection panel (outside it: the panel clips its overflow)
    box.style.left = (sp.offsetLeft + 6) + 'px'; box.style.bottom = (sp.offsetHeight + 6) + 'px';
    $$('.buff', box).forEach((el, i) => { const x = L[i]; if (!x) return; el._st = x; $('.bt', el).textContent = x.t ? (x.t >= 10 ? Math.ceil(x.t) : x.t.toFixed(1)) : ''; });
    if (this.tipEl && this.tipEl.parentNode === box) this.renderTip();
  }
  /** Up to 4 ability slots (Dota-style). Actives are clickable and show their hotkey. */
  renderAbilityBar(p, isEnemy) {
    const bar = $('#sp-abil');
    if (!p.abil.length) { bar.innerHTML = ''; return; }
    let nAct = -1;
    bar.innerHTML = `<div class="lbl">ABILITIES</div><div class="aslots">${p.abil.map(({ def: A }, k) => {
      const key = A.kind === 'active' && !isEnemy && SLOT_KEYS[++nAct] ? keyLabel(settings.keys[SLOT_KEYS[nAct]]) : '';
      return `<div class="aslot ${A.kind}" data-slot="${k}" data-tip="ability:${A.id}" data-key="${key}"><svg><use href="#${A.icon}"/></svg>${key ? `<kbd>${key}</kbd>` : ''}<i class="cdv"></i><i class="badge"></i></div>`;
    }).join('')}</div>`;
    $$('.aslot', bar).forEach((el) => {
      el._unit = p;
      if (el.classList.contains('active') && !isEnemy) el.onclick = () => { sfx('click'); this.app.controls.castSlot(+el.dataset.slot); };
      // right-click: toggle autocast for every selected troop of ours that has this ability
      el.oncontextmenu = (e) => {
        e.preventDefault(); e.stopPropagation();
        const A = p.abil[+el.dataset.slot]?.def;
        if (isEnemy || !A) return;
        if (!canAutocast(A)) { this.toast(`${A.name} can't be autocast`, 'err'); return; }
        const pt = this.app.playerTeam, sel = this.app.controls.selection.filter((u) => !u.dead && u.team === pt && u.ability(A.id));
        const list = sel.length ? sel : [p], on = !list[0].ability(A.id).st.auto;
        for (const u of list) u.ability(A.id).st.auto = on;
        sfx('click');
        this.toast(`${A.name} autocast ${on ? 'ON' : 'OFF'} (${list.length} troop${list.length > 1 ? 's' : ''})`);
        this.updateAbilityBar(p);
      };
    });
  }
  updateAbilityBar(p) {
    $$('#sp-abil .aslot').forEach((el) => {
      const entry = p.abil[+el.dataset.slot];
      if (!entry) return;
      const { def: A, st } = entry;
      const on = A.id === 'snipeStance' ? ((st.mode === 'stand' || st.mode === 'prone' || !st.mode) && st.cd <= 0) : A.kind === 'active' ? st.cd <= 0 : (A.id === 'eagleEye' || A.id === 'bullsEye' || st.active);
      el.classList.toggle('toggled', A.id === 'snipeStance' && st.mode === 'prone');
      el.classList.toggle('auto', !!st.auto);
      el.classList.toggle('on', on && !st.broken);
      el.classList.toggle('broken', !!st.broken);
      el.classList.toggle('nomana', A.kind === 'active' && (A.manaCost || 0) > p.mana);
      $('.badge', el).textContent = st.broken ? 'X' : this.abilityBadge(p, entry);
      const cdMax = Math.max(A.cooldown || 0, A.standCooldown || 0);
      $('.cdv', el).style.height = A.kind === 'active' && cdMax && st.cd > 0 ? Math.min(100, st.cd / (st.cd > (A.cooldown || 0) ? cdMax : A.cooldown) * 100) + '%' : '0';
      if (this.tipEl === el) this.renderTip();
    });
  }

  /** 6-slot inventory (3x2, Dota-style). Left-click / item key (1-6) = use the active. Right-click = menu (Use / Discard). */
  renderInventory(u) {
    const inv = $('#sp-inv');
    inv.classList.toggle('on', !!u);
    this.invUnit = u || null;
    if (!u) { inv.innerHTML = ''; this._invKey = ''; this.closeItemMenu(); return; }
    const mine = u.team === this.app.playerTeam;
    // only rebuild when items / cooldowns / keybinds change (cheap, and clicks don't get eaten by a rebuild)
    const keys = ITEM_SLOTS.map((a) => settings.keys[a]).join(',');
    const key = u.id + ':' + u.items.join(',') + ':' + u.itemCd.map((c) => Math.ceil(Math.max(0, c))).join(',') + ':' + keys;
    if (key === this._invKey) return;
    this._invKey = key;
    inv.innerHTML = `<div class="lbl">ITEMS</div><div class="slots">${u.items.map((id, i) => {
      const it = id && ITEMS[id], kb = mine ? `<kbd class="ik">${keyLabel(settings.keys[ITEM_SLOTS[i]])}</kbd>` : '';
      if (!it) return `<div class="slot empty" data-tip="slot:${i}">${kb}</div>`;
      const act = it.active && mine, cd = u.itemCd[i] > 0 ? Math.ceil(u.itemCd[i]) : 0;
      return `<div class="slot${act ? ' act' : ''}${mine ? ' mine' : ''}" data-tip="item:${id}" data-slot="${i}"><svg class="it"><use href="#${it.sprite}"/></svg>${kb}${cd ? `<span class="icd">${cd}</span>` : ''}</div>`;
    }).join('')}</div>`;
    $$('.slot.act', inv).forEach((el) => (el.onclick = () => this.useItemSlot(+el.dataset.slot, u)));
    $$('.slot.mine', inv).forEach((el) => (el.oncontextmenu = (e) => { e.preventDefault(); e.stopPropagation(); this.openItemMenu(u, +el.dataset.slot, el); }));
  }

  /** Item key / click: use slot `slot` of `u` (default: the troop in the panel, else the first selected troop with an active there). */
  useItemSlot(slot, u = null) {
    const g = this.app.game, sel = this.app.controls.own().filter((o) => !o.dead);
    u ||= (this.invUnit && sel.includes(this.invUnit) ? this.invUnit : null)
      || sel.find((o) => ITEMS[o.items[slot]]?.active && !(o.itemCd[slot] > 0))
      || sel.find((o) => o.items[slot]);
    if (!u || u.team !== this.app.playerTeam || !g) return false;
    const err = u.useItem(slot);
    if (err) { this.toast(err, 'err'); sfx('error', 150); } else sfx('order');
    this._invKey = ''; if (this.invUnit === u) this.renderInventory(u);
    return !err;
  }

  /** Right-click menu on an item slot: Use (if it has an active) / Discard (drops it on the ground). */
  openItemMenu(u, slot, anchor) {
    this.closeItemMenu();
    const it = ITEMS[u.items[slot]]; if (!it) return;
    const m = document.createElement('div');
    m.id = 'item-menu'; m.className = 'frame';
    m.innerHTML = `<div class="im-h">${it.name}</div>${it.active ? '<button data-a="use">Use</button>' : ''}<button data-a="drop" class="bad">Discard</button>`;
    document.body.appendChild(m);
    const r = anchor.getBoundingClientRect();
    m.style.left = Math.min(innerWidth - m.offsetWidth - 8, r.left) + 'px';
    m.style.top = Math.max(8, r.top - m.offsetHeight - 6) + 'px';
    m.onclick = (e) => {
      const a = e.target.dataset?.a; if (!a) return;
      if (a === 'use') this.useItemSlot(slot, u);
      else if (a === 'drop' && u.items[slot]) { this.app.game.discardItem(u, slot); sfx('order'); this._invKey = ''; this.renderInventory(u); }
      this.closeItemMenu();
    };
    m.oncontextmenu = (e) => e.preventDefault();
    setTimeout(() => { this._imClose = (e) => { if (!m.contains(e.target)) this.closeItemMenu(); }; addEventListener('pointerdown', this._imClose, true); }, 0);
  }
  closeItemMenu() {
    document.getElementById('item-menu')?.remove();
    if (this._imClose) { removeEventListener('pointerdown', this._imClose, true); this._imClose = null; }
  }

  drawMinimap() {
    const g = this.app.game; if (!g) return;
    const c = this.mmCtx, W = this.mm.width, H = this.mm.height;
    const TR = TERRAIN, X = (x) => Math.round((x - TR.minX) / (TR.maxX - TR.minX) * W), Z = (z) => Math.round((z - TR.minZ) / (TR.maxZ - TR.minZ) * H);
    c.clearRect(0, 0, W, H);
    c.fillStyle = '#2f4a25'; c.fillRect(0, 0, W / 2, H);
    c.fillStyle = '#34373c'; c.fillRect(W / 2, 0, W / 2, H);
    c.fillStyle = 'rgba(255,255,255,0.08)'; c.fillRect(X(-52), Z(-14), X(52) - X(-52), Z(14) - Z(-14));
    const HL = TR.hill;   // north hill (high ground)
    c.fillStyle = 'rgba(150,200,100,0.55)'; c.beginPath(); c.ellipse(X(HL.x), Z(HL.z), (X(HL.rx * 1.5) - X(0)), (Z(HL.rz * 1.5) - Z(0)), 0, 0, Math.PI * 2); c.fill();
    c.fillStyle = 'rgba(58,122,184,0.7)'; c.fillRect(X(-3.5), Z(this.app.game.terrain.riverStart), X(3.5) - X(-3.5), H);          // river (low ground)
    const pt0 = this.app.playerTeam, V = g.vision;
    if (V && pt0 !== null) {   // fog of war
      const vis = V.vis[pt0], vc = 2;
      c.fillStyle = 'rgba(0,0,0,0.45)';
      for (let iz = 0; iz < V.H; iz++) for (let ix = 0; ix < V.W; ix++) {
        if (vis[iz * V.W + ix]) continue;
        const x = TR.visMinX + ix * vc, z = TR.visMinZ + iz * vc;
        if (x + vc < TR.minX || x > TR.maxX || z + vc < TR.minZ || z > TR.maxZ) continue;
        c.fillRect(X(x), Z(z), Math.ceil(X(x + vc) - X(x)), Math.ceil(Z(z + vc) - Z(z)));
      }
    }
    for (const b of g.bases) {
      c.fillStyle = b.dead ? '#555' : (b.team === 0 ? '#e8a83c' : '#4ea8ff');
      c.fillRect(X(b.x - 6), Z(-7), X(6) - X(0), Z(7) - Z(-7));
    }
    const pt = this.app.playerTeam;
    for (const u of g.units) {
      if (u.dead || !g.canSee(pt, u)) continue;
      c.fillStyle = u.selected ? '#ffffff' : u.team === 2 ? '#f2c94c' : (u.team === pt ? '#5ce36f' : '#ff5252');
      const s = u.ranged ? 3 : 4;
      c.fillRect(X(u.pos.x) - s / 2, Z(u.pos.z) - s / 2, s, s);
    }
    for (const L of g.loot) { if (!g.seenByViewer(L)) continue; c.fillStyle = '#ffffff'; c.fillRect(X(L.x) - 1, Z(L.z) - 1, 2, 2); }
    c.strokeStyle = 'rgba(242,201,76,0.55)'; c.lineWidth = 1;
    for (const cp of CAMPS) c.strokeRect(X(cp.x) - 3, Z(cp.z) - 3, 6, 6);
    const fp = this.app.controls.viewFootprint();
    if (fp) {
      c.strokeStyle = '#fff'; c.lineWidth = 2;
      c.strokeRect(X(fp[0].x), Z(fp[0].z), X(fp[1].x) - X(fp[0].x), Z(fp[2].z) - Z(fp[0].z));
    }
  }

  toast(msg, kind = '') {
    const t = document.createElement('div');
    t.className = 'toast ' + kind; t.textContent = msg;
    $('#toasts').appendChild(t);
    setTimeout(() => t.classList.add('out'), 1400);
    setTimeout(() => t.remove(), 1800);
    while ($('#toasts').children.length > 3) $('#toasts').firstChild.remove();
  }

  showEnd(win, g) {
    const me = g.teams[this.app.playerTeam], ai = g.teams[1 - this.app.playerTeam];
    $('#end-title').textContent = win ? 'VICTORY' : 'DEFEAT';
    $('#end-title').className = win ? 'win' : 'lose';
    $('#end-sub').textContent = win ? `The ${FACTIONS[ai.faction].baseName} has fallen.` : `Your ${FACTIONS[me.faction].baseName} was destroyed.`;
    $('#end-stats').innerHTML = `
      <tr><th></th><th>You</th><th>AI (${g.diffId} · ${DIFFICULTY[g.diffId].name})</th></tr>
      <tr><td>AI personality</td><td colspan="2">${ai.persona?.name || '—'}</td></tr>
      <tr><td>Match time</td><td colspan="2">${fmtTime(g.time)}</td></tr>
      <tr><td>Troops trained</td><td>${me.stats.trained}</td><td>${ai.stats.trained}</td></tr>
      <tr><td>Kills</td><td>${me.stats.kills}</td><td>${ai.stats.kills}</td></tr>
      <tr><td>Troops lost</td><td>${me.stats.lost}</td><td>${ai.stats.lost}</td></tr>
      <tr><td>Base damage dealt</td><td>${Math.round(me.stats.baseDamage)}</td><td>${Math.round(ai.stats.baseDamage)}</td></tr>
      <tr><td>Kill bounty earned</td><td>${me.stats.bounty || 0}</td><td>${ai.stats.bounty || 0}</td></tr>
      <tr><td>Gold spent</td><td>${me.stats.goldSpent}</td><td>${ai.stats.goldSpent}</td></tr>`;
    this.show('end');
  }
}
