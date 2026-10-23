# Era Clash — v0.2 prototype

1v1 lane war. Medieval Kingdom (left) vs Modern Republic (right). Voxel 3D, Dota-style camera & controls. Three.js, no build step.

## Run (localhost)
Double-click **start.bat** → opens http://localhost:8080
(or: `node server.js`, or `python -m http.server 8080` in this folder)

Opening index.html directly via file:// will NOT work (ES modules need a server).

## Controls (rebindable in Options)
| Input | Action |
|---|---|
| LMB / LMB drag | select / box-select (Shift = add) |
| Double-click | select all of that troop type |
| RMB | move (formation) · on enemy/base = attack |
| A then LMB | attack target / attack-move to ground |
| S | stop (hold position) |
| C | resume auto-charge |
| B | open / close Shop (Esc also closes it) |
| V | open / close Barracks |
| H | toggle base Repair |
| 1 / 2 / 3 (shop open) | buy troop 1 / 2 / 3 · Shift = 5 |
| Q W E R | ability slots 1–4 of the selected troop |
| F | select whole army |
| Ctrl+1-9 / 1-9 | control groups (double-tap = jump) |
| Space | camera to base |
| Edge / arrows / middle-drag / wheel | camera |
| Esc | pause |

## Barracks (upgrades)
- Data: `js/upgrades.js` (`UPGRADES`). Fields: `faction` ('medieval' | 'modern' | 'both'), `category` ('troop' | 'base'), `max` (number or Infinity), `price`/`time` (array per level, or `{ base, step }`), `effects`, `values`, `icon`.
- Effect types: `unitStats` (+stats & +cost per level), `grantAbility`, `grantAtMax`, `towers`, `baseHP`, `income`. Passive tweaks read their level via `game.upLevel(team, id)` in unit.js.
- Engine: `Game.research / cancelResearch / applyUpgrade` (game.js). AI: `aiPickUpgrade / aiResearch`.

## Neutral camps
- `js/neutrals.js`: `CAMPS` (position, side, creep list, drop table) and `CAMP_RULES` (spawn timing, leash, drop chance). Creep stats live in `UNITS` (faction 'neutral'), drops in `ITEMS` (config.js).
- Creep brain: `Unit.updateNeutral()`; spawning/aggro/loot: `Game.updateCamps / neutralAggro / updateLoot / pickupLoot`.
- Day: home creeps scan for enemies within `CAMP_RULES.dayAggroRange` (2). Night: `unit.sleeping` (Zzz sprite), aggro only through damage.
- Creep abilities: Resentment (damage counter in `takeDamage`), Immaterial (static evasion), Morale Aura (receivers scan in `updatePassive`), Cleave (`onAttackLanded`), Brainwash (`Game.brainwash` flips `unit.team` for 15s, `unit.brainwashed = {t, orig}`; uncontrollable, no bounty, `despawnBrainwashed` at the end).
- AI jungling: `Game.aiJungle(T, threat)` — waiting troops get `_jungle = campId`, clear it, grab loot (`pickup` order), walk back (`_homing`).

## Patch notes
- `js/patchnotes.js` — newest first. **Every update adds an entry** (version, date/time PHT, sections). The main menu footer shows the latest version.

## Code map
- `js/config.js` — ALL balance numbers (units, gold, base HP, AI difficulty). Add new troops here.
- `js/models.js` — voxel models (every model is boxes). `UNIT_BUILDERS` maps unit id → builder.
- `js/unit.js` — troop AI: orders (charge/move/attackMove/attack/idle), targeting, flat armor, animation.
- `js/game.js` — economy, training queue, enemy AI, particles, win/lose.
- `js/controls.js` — camera + selection + orders.
- `js/ui.js` — menus, options, help, HUD, minimap.
- `js/audio.js` — procedural sounds + music (no audio files).

## Adding a troop (quick)
1. Add a stat block to `UNITS` in config.js (`type: 'ranged'` + a `projectile` block for shooters) and push its id into the faction's `units` array. The Shop lists it automatically.
2. Write `buildXxx()` in models.js and register it in `UNIT_BUILDERS`.
3. Its shop buy key is generated automatically (next number) and is rebindable in Options.

## Damage types, defenses, regen
- `damageType`: `physical` (reduced by **Armor**), `magic` (reduced by **Ward**), `true` (ignores both).
- Armor and Ward use Dota scaling: multiplier = 1 − 0.06·D / (1 + 0.06·|D|). 2 → 10.7%, 5 → 23%, 10 → 37.5%. Negative amplifies.
- Rename Ward in one place: `DEFENSES.ward.name` in config.js.
- `hpRegen`: HP per second. Items and family upgrades can add `armor`, `ward`, `hpRegen`.

## Families
- Every troop has `family:` (`melee` | `marksman`, registry `FAMILIES` in config.js). Add new families there.
- Upgrade hook for the future Barracks: `game.addFamilyUpgrade(team, 'melee', { damage: 2, armor: 1 })` — flat, stacks, hits living troops immediately and every future spawn.
- Test it in the console: `__app.game.addFamilyUpgrade(__app.playerTeam, 'marksman', { range: 1 })`

## Abilities (max 4 per troop)
- `abilities: ['splatter', 'swiftStep']` on a unit — any mix of passives/actives, max `GAME.maxAbilities` (4). Order = slot = Q W E R.
- Registry: `ABILITIES` in config.js (`kind: 'passive' | 'active'`, `cooldown`, `radius`, `damage`, `damageType`, `aiCast`).
- Passive logic: `updatePassive()` in unit.js. Active logic: `castAbility()` in game.js. AI casting rules: `aiCast()` in unit.js.

## Evasion / miss / bounty
- `evasion` (% dodge incoming attacks), `missChance` (% own attacks miss). Abilities can't be dodged. Evasion sources stack multiplicatively.
- Kill bounty: `GAME.bountyPct` (40%) of the victim's cost. Passive income: `GAME.incomePerSec` (2.5).

## Stats & passives
- Attack speed = attacks **per minute** (60 = 1 hit/sec). `attackInterval()` in config.js converts it.
- Every troop has one passive (`passive:` id in its UNITS entry → `PASSIVES` in config.js). Logic: `updatePassive` / `onAttackStart` / `onAttackDone` / `rollDamage` in unit.js.
- Live-tweak balance in the browser console: `__cfg.UNITS.police.damage = 10`, `__cfg.PASSIVES.blueLine.maxStacks = null`.

## Items
- Every troop has `unit.items` (6 slots). `unit.addItem(id)` / `removeItem(slot)` call `recalcStats()`, which adds each item's flat `stats` (and `rangedStats` on ranged troops) to the base def.
- `ITEMS` in config.js: `sprite` = pixel icon id in index.html, `icon` = loot cube color. Passive fields: `block` (Old Man Shield, basic attacks only via `takeDamage(..., {attack})`), `disarm` (Shackles → `unit.disarmT`), `helmet` (Riot Helmet, ranged hits), `splash` (Pocket Knife).
- Player pickup: right-click → `Controls.issuePickup` → `{type:'pickup', loot}` order. AI troops auto-grab loot they walk over. Items vanish when the carrier dies.
