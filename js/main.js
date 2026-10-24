// ERA CLASH — boot + state machine + render loop
import * as THREE from 'three';
import * as CFG from './config.js';
import { FACTIONS, GAME } from './config.js';
import { settings } from './settings.js';
import { createWorld } from './world.js';
import { installFogShader, updateFogTexture, FOW } from './fow.js';
import { Game } from './game.js';
import { Controls } from './controls.js';
import { UI, makePortraits } from './ui.js';
import { sfx, setMusicMood } from './audio.js';
import { DevLab } from './dev/devlab.js';

const app = {
  state: 'menu',          // menu | playing | paused | ended
  game: null,
  playerTeam: null,
  playerFaction: null,
  difficulty: 'normal',
};

// ---------------- renderer / scene ----------------
const view = document.getElementById('view');
const renderer = new THREE.WebGLRenderer({ antialias: true, powerPreference: 'high-performance' });
renderer.shadowMap.type = THREE.PCFSoftShadowMap;
renderer.outputColorSpace = THREE.SRGBColorSpace;
view.appendChild(renderer.domElement);
const scene = new THREE.Scene();
const camera = new THREE.PerspectiveCamera(45, innerWidth / innerHeight, 0.5, 400);
const world = createWorld(scene);
installFogShader(world.terrain.VW, world.terrain.VH);   // fog of war darkening for every material

app.applyGraphics = () => {
  const q = settings.graphics.quality;
  const dpr = window.devicePixelRatio || 1;
  let pr = q === 'low' ? 0.75 : q === 'medium' ? Math.min(dpr, 1.25) : Math.min(dpr, 2);
  if (settings.graphics.pixelated) pr *= 0.4;
  renderer.setPixelRatio(pr);
  renderer.domElement.style.imageRendering = settings.graphics.pixelated ? 'pixelated' : 'auto';
  const shadows = q !== 'low';
  if (renderer.shadowMap.enabled !== shadows) {
    renderer.shadowMap.enabled = shadows;
    scene.traverse((o) => { if (o.material) (Array.isArray(o.material) ? o.material : [o.material]).forEach((m) => (m.needsUpdate = true)); });
  }
  const ms = q === 'high' ? 2048 : 1024;
  if (world.sun.shadow.mapSize.x !== ms) {
    world.sun.shadow.mapSize.set(ms, ms);
    world.sun.shadow.map?.dispose(); world.sun.shadow.map = null;
  }
  world.sun.castShadow = shadows;
  world.setLightsEnabled(q !== 'low');
  resize();
};
function resize() {
  renderer.setSize(innerWidth, innerHeight);
  camera.aspect = innerWidth / innerHeight;
  camera.updateProjectionMatrix();
}
addEventListener('resize', resize);

makePortraits();

app.controls = new Controls(() => renderer.domElement, camera, {
  onSelectionChange: () => (app.state === 'devlab' ? app.devlab?.onSelection() : app.ui?.refreshSelection(true)),
  toast: (m, k) => app.ui.toast(m, k),
  lootHover: (L) => {
    const ui = app.ui, cv = renderer.domElement; if (!ui) return;
    if (L) { cv.dataset.tip = 'item:' + L.id; if (ui.tipEl !== cv || ui._lootId !== L.id) { ui._lootId = L.id; ui.tipEl = cv; ui.renderTip(); } }
    else if (ui.tipEl === cv) { delete cv.dataset.tip; ui._lootId = null; ui.hideTip(); }
  },
  toggleShop: () => app.state === 'playing' && app.ui.toggleShop(),
  toggleBarracks: () => app.state === 'playing' && app.ui.toggleBarracks(),
  toggleRepair: () => app.state === 'playing' && app.ui.toggleRepair(),
  toggleAutoLoot: () => app.state === 'playing' && app.ui.toggleAutoLoot(),
  shopOpen: () => app.ui.shopOpen(),
  roster: () => (app.playerFaction ? FACTIONS[app.playerFaction].units : []),
  buy: (id, many) => { const i = FACTIONS[app.playerFaction].units.indexOf(id); for (let k = 0; k < (many ? 5 : 1); k++) if (!app.trainSlot(i, k > 0)) break; },
  onCenter: () => app.controls.centerOn(app.playerTeam === 0 ? -GAME.baseX + 14 : GAME.baseX - 14),
});
app.ui = new UI(app);
app.devlab = new DevLab(app, { renderer, scene, world, camera });
app.applyGraphics();

// ---------------- match lifecycle ----------------
let demoRestart = 0;
function startDemo() {
  app.game?.dispose();
  app.playerTeam = null;
  app.game = new Game({ scene, playerTeam: null, difficulty: 'normal', world, getViewX: () => app.controls.target.x });
  // pre-fund the demo so the menu has a battle going quickly
  app.game.teams.forEach((t) => (t.gold = 400));
  app.controls.setGame(app.game, -1);
  app.controls.enabled = false;
  app.controls.height = 24;
  app.state = 'menu';
  document.body.classList.remove('ingame');
  setMusicMood('menu');
}

app.startMatch = (faction, difficulty) => {
  app.game?.dispose();
  app.playerFaction = faction;
  app.difficulty = difficulty;
  app.playerTeam = FACTIONS[faction].team;
  const g = new Game({ scene, playerTeam: app.playerTeam, difficulty, world, getViewX: () => app.controls.target.x });
  app.game = g;
  app.controls.setGame(g, app.playerTeam);
  app.controls.height = 34;
  app.controls.centerOn(app.playerTeam === 0 ? -GAME.baseX + 16 : GAME.baseX - 16);
  app.controls.enabled = true;
  app.controls.setArmed(false);
  let lastWarn = -99;
  g.on('baseHit', () => {
    if (g.time - lastWarn > 8) { lastWarn = g.time; app.ui.toast('Your base is under attack!', 'warn'); }
    document.body.classList.remove('hurt'); void document.body.offsetWidth; document.body.classList.add('hurt');
  });
  g.on('repair', (team, on, why) => { if (team === app.playerTeam && why === 'gold') app.ui.toast('Repair stopped: out of gold', 'err'); });
  g.on('upgrade', (team, id, lvl) => { if (team === app.playerTeam) { app.ui.toast(`Upgrade complete: ${app.ui.upgradeName(id)} Lv ${lvl}`); sfx('train'); } });
  g.on('pickup', (u, id) => { if (u.team === app.playerTeam) { app.ui.floatText(u.pos, CFG.ITEMS[id].name, 'gold'); sfx('coin', 80); app.ui.refreshSelection(true); } });
  g.on('invFull', () => app.ui.toast('Inventory full', 'err'));
  g.on('disarm', (u) => { if (settings.graphics.combatText && g.seenByViewer(u.pos)) app.ui.floatText(u.pos, 'DISARMED', 'miss'); });
  g.on('brainwash', (u, orig) => {
    if (settings.graphics.combatText && g.seenByViewer(u.pos)) app.ui.floatText(u.pos, 'BRAINWASHED', 'crit');
    const c = app.controls;
    if (c.selection.includes(u)) { u.selected = false; c.setSelection(c.selection.filter((x) => x !== u)); }
    if (orig === app.playerTeam) app.ui.toast(`A Banshee turned your ${u.def.name} against you!`, 'err');
  });
  // damage numbers (Options > Graphics): all hits / crits only / off, crit highlight on/off
  g.on('crit', (pos, dmg) => {
    const G = settings.graphics; if (G.damageNumbers === 'off' || !g.seenByViewer(pos)) return;
    app.ui.floatText(pos, Math.round(dmg) + (G.critHighlight ? '!' : ''), G.critHighlight ? 'crit' : 'dmg');
  });
  g.on('hitDmg', (pos, dmg, crit, team) => {
    if (crit || settings.graphics.damageNumbers !== 'all' || !g.seenByViewer(pos)) return;
    app.ui.floatText(pos, String(Math.round(dmg)), 'dmg' + (app.playerTeam !== null && team !== app.playerTeam ? ' foe' : ''));
  });
  g.on('dodge', (pos, kind) => { if (settings.graphics.combatText && g.seenByViewer(pos)) app.ui.floatText(pos, kind === 'evade' ? 'EVADE' : kind === 'uphill' ? 'MISS ▲' : 'MISS', 'miss'); });
  g.on('bounty', (pos, gold, team) => { if (team === app.playerTeam) { app.ui.floatText(pos, '+' + gold, 'gold'); sfx('coin', 80); } });
  g.on('baseDestroyed', (team) => {
    app.controls.enabled = false;
    app.controls.setArmed(false);
    const win = team !== app.playerTeam;
    sfx(win ? 'victory' : 'defeat');
    app.controls.centerOn(g.bases[team].x + (team === 0 ? 14 : -14));
    setTimeout(() => { if (app.game === g) { app.state = 'ended'; app.ui.showEnd(win, g); } }, 2600);
  });
  document.body.classList.add('ingame');
  app.ui.setupHUD();
  app.ui.show('hud');
  app.state = 'playing';
  setMusicMood('battle');
};

app.trainSlot = (i, quiet = false) => {
  if (app.state !== 'playing') return false;
  const id = FACTIONS[app.playerFaction].units[i];
  if (!id) return false;
  const err = app.game.train(app.playerTeam, id);
  if (err) { if (!quiet) { app.ui.toast(err, 'err'); sfx('error', 150); } return false; }
  sfx('click');
  return true;
};
app.pause = () => {
  if (app.state !== 'playing') return;
  app.state = 'paused';
  app.controls.enabled = false;
  app.controls.setArmed(false);
  app.ui.show('pause');
};
app.resume = () => {
  if (app.state !== 'paused') return;
  app.state = 'playing';
  app.controls.enabled = true;
  app.ui.show('hud');
};
app.restart = () => app.startMatch(app.playerFaction, app.difficulty);
app.quitToMenu = () => { startDemo(); app.ui.show('main'); };
// Dev Lab (main menu button): model viewer + sandbox. It takes over the frame loop until closed.
app.openDevLab = () => {
  app.game?.dispose(); app.game = null;
  app.state = 'devlab';
  app.ui.show('devlab');
  app.devlab.open();
};
app.closeDevLab = () => { app.devlab.close(); startDemo(); app.ui.show('main'); };

addEventListener('keydown', (e) => {
  if (e.code !== 'Escape') return;
  if (app.state === 'devlab') { app.devlab.onEscape(); return; }
  const s = app.ui.screen;
  if (app.state === 'playing') {
    if (app.controls.cancelTargeting()) { /* aiming cancelled */ }
    else if (app.controls.armed) app.controls.setArmed(false);
    else if (app.ui.shopOpen()) app.ui.toggleShop(false);   // Esc closes the shop before it pauses
    else if (app.ui.barracksOpen()) app.ui.toggleBarracks(false);
    else app.pause();
  } else if (s === 'pause') app.resume();
  else if (s === 'options') app.ui.show(app.ui.optionsReturn);
  else if (s === 'help') app.ui.show(app.ui.helpReturn);
  else if (s === 'patch') app.ui.show('main');
  else if (s === 'mode' || s === 'faction') app.ui.show(s === 'faction' ? 'mode' : 'main');
});

// ---------------- loop ----------------
const clock = new THREE.Clock();
let menuT = 0, fpsAcc = 0, fpsN = 0;
const fpsEl = document.getElementById('fps');
function frame() {
  requestAnimationFrame(frame);
  const dt = Math.min(clock.getDelta(), 0.05);
  const g = app.game;
  if (app.state === 'devlab') {
    app.devlab.update(dt);
    fpsAcc += dt; fpsN++;
    if (fpsAcc > 0.5) { fpsEl.textContent = Math.round(fpsN / fpsAcc) + ' FPS'; fpsAcc = 0; fpsN = 0; }
    return;
  }

  if (app.state === 'menu') {
    menuT += dt;
    const alive = g.units.filter((u) => !u.dead);
    const fx = alive.length ? alive.reduce((a, u) => a + u.pos.x, 0) / alive.length : Math.sin(menuT * 0.06) * 34;
    app.controls.target.x += (fx + Math.sin(menuT * 0.3) * 4 - app.controls.target.x) * Math.min(1, dt * 0.6);
    app.controls.target.z = 2;
    if (g.over) { demoRestart += dt; if (demoRestart > 4) { demoRestart = 0; startDemo(); } }
  }
  if (app.state !== 'paused') g.update(dt, camera.quaternion);
  FOW.on.value = g && g.vision && g.playerTeam !== null ? 1 : 0;
  if (FOW.on.value) updateFogTexture(g.vision.vis[g.playerTeam], dt);
  if (g) world.setNight(g.dayNight.f);
  world.update(dt);
  app.controls.update(dt);
  world.followCamera(app.controls.target);
  app.ui.update(dt);
  renderer.render(scene, camera);

  fpsAcc += dt; fpsN++;
  if (fpsAcc > 0.5) { fpsEl.textContent = Math.round(fpsN / fpsAcc) + ' FPS'; fpsAcc = 0; fpsN = 0; }
}
startDemo();
app.ui.show('main');
frame();
window.__app = app; // handy for debugging in devtools
window.__cfg = CFG;
import('./upgrades.js').then((m) => (window.__up = m));  // live-tweak balance from the console: __cfg.UNITS.police.damage = 9
