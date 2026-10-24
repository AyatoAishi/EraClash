// ============================================================
//  CHAT + ADMIN COMMANDS (Dota-style).
//  Enter opens the chat, Enter sends, Esc closes. Plain messages show in the log (ready for PvP).
//  Messages starting with "/" are commands. Commands are TEST CHEATS: they only work in player-vs-AI
//  matches and only change the current match (game.cheat), never the player's settings.
//  Add a command: one entry in COMMANDS { args, help, run(ctx, args) -> string (shown in the log) }.
// ============================================================
import { UNITS, ITEMS } from './config.js';
import { UPGRADES } from './upgrades.js';
import { NEUTRAL_TEAM, CAMPS } from './neutrals.js';
import { GAME } from './config.js';

const onOff = (arg, cur) => (arg === undefined || arg === '' || arg === 'toggle' ? !cur : /^(on|1|true|yes)$/i.test(arg));
const findId = (table, q) => {
  if (!q) return null;
  const s = q.toLowerCase().replace(/[\s_-]/g, '');
  return Object.keys(table).find((id) => id.toLowerCase() === s || (table[id].name || '').toLowerCase().replace(/[\s_-]/g, '') === s)
    || Object.keys(table).find((id) => id.toLowerCase().startsWith(s) || (table[id].name || '').toLowerCase().replace(/[\s_-]/g, '').startsWith(s)) || null;
};

export const COMMANDS = {
  help: { args: '', help: 'list all commands', run: () => Object.entries(COMMANDS).map(([n, c]) => `/${n} ${c.args}  — ${c.help}`).join('\n') },
  gold: { args: '<amount>', help: 'give yourself gold', run: ({ g, me }, [n]) => { const v = +n || 1000; g.teams[me].gold += v; return `+${v} gold`; } },
  hirespeed: { args: '<multiplier>', help: 'research + training speed (1 = normal)', run: ({ g }, [n]) => { const v = Math.max(0.1, +n || 10); g.cheat.hireSpeed = v; return `research & hiring ${v}x faster`; } },
  fog: { args: '[on|off]', help: 'fog of war on/off for you', run: ({ g }, [a]) => { const on = a === undefined ? !!g.cheat.reveal : onOff(a, !g.cheat.reveal); g.cheat.reveal = !on; return `fog of war ${on ? 'ON' : 'OFF'}`; } },
  reveal: { args: '', help: 'same as /fog off', run: ({ g }) => { g.cheat.reveal = true; return 'map revealed'; } },
  wtf: { args: '[on|off]', help: 'infinite mana, no spell/item cooldowns for your troops', run: ({ g }, [a]) => { g.cheat.wtf = onOff(a, g.cheat.wtf); return `WTF mode ${g.cheat.wtf ? 'ON' : 'OFF'}`; } },
  god: { args: '[on|off]', help: 'your troops and base take no damage', run: ({ g }, [a]) => { g.cheat.god = onOff(a, g.cheat.god); return `god mode ${g.cheat.god ? 'ON' : 'OFF'}`; } },
  spawn: {
    args: '<unit> [count] [me|enemy|neutral]', help: 'spawn units at the camera (any unit, e.g. /spawn direbear 3 enemy)',
    run: ({ g, me, app }, [q, n, side]) => {
      const id = findId(UNITS, q); if (!id) return `unknown unit "${q || ''}" — try: ${Object.keys(UNITS).join(', ')}`;
      const team = side === 'enemy' ? 1 - me : side === 'neutral' ? NEUTRAL_TEAM : me;
      const count = Math.min(40, Math.max(1, +n || 1)), c = app.controls.target;
      for (let k = 0; k < count; k++) {
        const u = g.spawn(team, id);
        const a = (k / count) * Math.PI * 2, r = count > 1 ? 1 + 0.2 * count : 0;
        u.spawnAt(c.x + Math.cos(a) * r, c.z + Math.sin(a) * r);
        if (team === NEUTRAL_TEAM) { u.home = { x: u.pos.x, z: u.pos.z }; u.camp = CAMPS[0]; u.nState = 'home'; u.invulnT = 0; }
        else u.command({ type: 'idle' });
      }
      return `spawned ${count} ${UNITS[id].name} (${team === me ? 'yours' : team === NEUTRAL_TEAM ? 'neutral' : 'enemy'})`;
    },
  },
  kill: {
    args: '[selected|enemies|neutrals|all]', help: 'kill units',
    run: ({ g, me, app }, [w = 'selected']) => {
      const pick = w === 'all' ? (u) => !u.tower : w === 'enemies' ? (u) => !u.tower && u.team !== me && u.team !== NEUTRAL_TEAM
        : w === 'neutrals' ? (u) => u.team === NEUTRAL_TEAM : (u) => app.controls.selection.includes(u);
      const list = g.units.filter((u) => !u.dead && pick(u));
      list.forEach((u) => { u.invulnT = 0; u.hp = 0; u.die(null); });
      return `killed ${list.length} unit(s)`;
    },
  },
  level: {
    args: '<upgrade> <level>', help: 'set a Barracks upgrade level instantly (e.g. /level proteinboost 5)',
    run: ({ g, me }, [q, n]) => {
      const id = findId(UPGRADES, q); if (!id) return `unknown upgrade "${q || ''}"`;
      const want = Math.min(UPGRADES[id].max, Math.max(0, +n || 1));
      let done = 0;
      while (g.upLevel(me, id) < want) { g.applyUpgrade(me, id); done++; }
      return done ? `${UPGRADES[id].name} → Lv ${g.upLevel(me, id)}` : `${UPGRADES[id].name} is already Lv ${g.upLevel(me, id)} (levels can't go down)`;
    },
  },
  item: {
    args: '<item>', help: 'give an item to the selected troop',
    run: ({ app }, [q]) => {
      const id = findId(ITEMS, q); if (!id) return `unknown item — try: ${Object.keys(ITEMS).join(', ')}`;
      const u = app.controls.own()[0]; if (!u) return 'select one of your troops first';
      return u.addItem(id) >= 0 ? `${ITEMS[id].name} → ${u.def.name}` : 'inventory full';
    },
  },
  xp: {
    args: '<unit> <kills>', help: 'add kills to a troop type (skill tree levels), e.g. /xp viking 75',
    run: ({ g, me }, [q, n]) => {
      const id = findId(UNITS, q); if (!id) return `unknown unit "${q || ''}"`;
      const add = Math.max(1, Math.min(10000, +n || 5));
      for (let k = 0; k < add; k++) g.addTroopKill(me, id);
      return `${UNITS[id].name}: ${g.teams[me].troopKills[id]} kills → level ${g.troopLevel(me, id).level}`;
    },
  },
  ai: { args: '', help: "show the enemy AI's difficulty and personality", run: ({ g, me }) => { const T = g.teams[1 - me], P = T.persona; return P ? `AI level ${g.diffId} (${g.diff.name}), ${P.name}: greed ${P.greed.toFixed(2)}, aggro ${P.aggro.toFixed(2)}, caution ${P.caution.toFixed(2)}, smart ${P.smart.toFixed(2)}, sloppy ${P.sloppy.toFixed(2)}` : 'no AI'; } },
  time: {
    args: '<day|night>', help: 'jump to day or night',
    run: ({ g }, [w]) => { const half = GAME.dayNight.half, cyc = Math.floor(g.time / (half * 2)) * half * 2; g.time = w === 'night' ? cyc + half + GAME.dayNight.fade + 1 : cyc + half * 2 + GAME.dayNight.fade + 1; g.nextCampSpawn = Math.ceil(g.time / 60) * 60; return `it is now ${w === 'night' ? 'night' : 'day'}`; },
  },
  speed: { args: '<0.25 – 4>', help: 'game speed', run: ({ app }, [n]) => { app.timeScale = Math.min(4, Math.max(0.25, +n || 1)); return `game speed ${app.timeScale}x`; } },
  camps: { args: '', help: 'spawn every neutral camp right now', run: ({ g }) => { for (const c of CAMPS) g.spawnCamp(c); return `spawned ${CAMPS.length} camps`; } },
  win: { args: '', help: 'destroy the enemy base', run: ({ g, me }) => { g.destroyBase(1 - me); return 'victory!'; } },
  lose: { args: '', help: 'destroy your own base', run: ({ g, me }) => { g.destroyBase(me); return 'defeat.'; } },
};

export class Chat {
  constructor(app) {
    this.app = app;
    this.el = document.getElementById('chat');
    this.log = this.el.querySelector('.chat-log');
    this.input = this.el.querySelector('input');
    this.history = []; this.hIdx = 0;
    this.input.addEventListener('keydown', (e) => {
      e.stopPropagation();
      if (e.key === 'Enter') { e.preventDefault(); this.send(this.input.value); this.close(); }
      else if (e.key === 'Escape') { e.preventDefault(); this.close(); }
      else if (e.key === 'ArrowUp' && this.history.length) { this.hIdx = Math.max(0, this.hIdx - 1); this.input.value = this.history[this.hIdx]; e.preventDefault(); }
      else if (e.key === 'ArrowDown' && this.history.length) { this.hIdx = Math.min(this.history.length, this.hIdx + 1); this.input.value = this.history[this.hIdx] || ''; e.preventDefault(); }
    });
    this.input.addEventListener('blur', () => this.close());
  }
  get isOpen() { return this.el.classList.contains('open'); }
  open() { if (this.app.state !== 'playing') return; this.el.classList.add('open'); this.input.value = ''; this.hIdx = this.history.length; setTimeout(() => this.input.focus(), 0); }
  close() { this.el.classList.remove('open'); this.input.blur(); }
  clear() { this.log.innerHTML = ''; }
  /** Add a line. kind: 'me' | 'sys' | 'err' | 'cheat'. Lines fade after 10s unless the chat is open. */
  line(text, kind = 'sys') {
    for (const t of String(text).split('\n')) {
      const d = document.createElement('div');
      d.className = 'cl ' + kind; d.textContent = t;
      this.log.appendChild(d);
      setTimeout(() => d.classList.add('old'), 10000);
    }
    while (this.log.children.length > 60) this.log.firstChild.remove();
    this.log.scrollTop = this.log.scrollHeight;
  }
  send(raw) {
    const text = raw.trim(); if (!text) return;
    this.history.push(text); this.hIdx = this.history.length;
    if (!text.startsWith('/')) return this.line(`[You]: ${text}`, 'me');
    const g = this.app.game, me = this.app.playerTeam;
    if (!g || me === null || g.over) return this.line('Commands only work during a match.', 'err');
    if (!g.teams.some((T, t) => t !== me && T.isAI)) return this.line('Commands are disabled in matches against other players.', 'err');
    const [name, ...args] = text.slice(1).split(/\s+/);
    const cmd = COMMANDS[name.toLowerCase()];
    if (!cmd) return this.line(`Unknown command /${name}. Type /help.`, 'err');
    try {
      const out = cmd.run({ g, me, app: this.app }, args);
      if (name.toLowerCase() !== 'help') g.cheat.used = true;
      this.line(`> ${text}`, 'me');
      if (out) this.line(out, name.toLowerCase() === 'help' ? 'sys' : 'cheat');
    } catch (err) { this.line(`/${name} failed: ${err.message}`, 'err'); }
  }
}
