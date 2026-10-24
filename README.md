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

## Terrain, vision & extending the map (v0.9.0)
Systems are split so new features plug in without touching each other:
- `js/terrain.js` — `createTerrain()` (owned by the world): height/level (`heightAt`, `level` → river = low ground), obstacles (`addObstacle({x,z,r}|{x,z,hw,hd}, blocksMove, blocksVision)` / `removeObstacle(id)`), nav grid + A* (`findPath`, `clearLine`, `nearestFree`), collision push-out (`resolve`). Every change bumps `terrain.version`, so cached unit paths re-plan automatically.
- `Unit.steer(goal, dt)` — all movement goes through it (straight line if clear, else cached A* path). `Unit.groundPos()` resolves collisions + sets height.
- `js/vision.js` — `Vision` per match: per-team visibility grid from `sources(team)` = troops (`def.vision`), bases (`GAME.baseVision`) and `game.structures`. Trees/buildings block LOS, low ground can't see high ground, attackers get revealed (`reveal`). `game.intel[team]` = last-seen snapshot of the enemy base.
- `js/fow.js` — fog rendering, injected into every material via `Material.prototype.onBeforeCompile` (opt-out: `material.userData.noFow = true`).
- **Future buildings / turrets:** push into `game.structures` an object `{ team, pos:{x,z}, dead, visionRadius(nightF) }` and register its footprint with `terrain.addObstacle(...)` (remove on death). Pathing, collision and fog pick it up with no other changes. Turrets that shoot can reuse the tower path (`unit.tower = true`).
- Uphill miss: `GAME.highGround.uphillMiss` (checked in `Unit.dodgeCheck`).
- Auto-loot: `team.autoLoot` / `Game.setAutoLoot(team, on)`; handled in `Game.onUnitDeath`.

## Research queue & stat boosts (v0.10.0)
- `team.research` = running entry, `team.rqueue` = queued `{id, price, level}` (max `GAME.researchQueueMax`). `Game.pendingLevel(team,id)` counts queued levels; `cancelResearch(team, slot)` (-1 = running) refunds that entry and later levels of the same upgrade.
- Stat boost upgrades: `kind: 'statBoost'`, effect `{ type: 'statBoost', unit, pct }`. `Game.statMult(team, unitId)` = 1 + pct x level; `Unit.recalcStats()` multiplies the def's base stats in `STAT_BOOST.stats` (hp, armor, ward, damage, hpRegen) and stores them in `unit.base`; items/other flat effects go to `unit.bonus`. Price/time use `{ base, pct }` in `upgradePrice/upgradeTime`.

## Units are ownerless (v0.10.2)
- `UNITS` holds every unit with one schema (no `faction` field; `theme` is cosmetic). Who can hire what = `FACTIONS[x].units`; what camps spawn = `CAMPS[i].units`. A future card mini-game / Enchantress-style recruit just picks unit ids and calls `game.spawn(team, id)` (any team 0/1/2).
- Bounty = `GAME.bountyPct x (unit.paid ?? def.cost)` for every kill.

## v0.11.0 systems
- Flying: `def.flying` → `unit.flying` (hover `GAME.flyHeight`, no obstacle collision, no separation with walkers, vision ignores LOS/level, melee can't target, ranged miss `GAME.flyingMiss`).
- Break: `unit.applyBreak(t)`; passives with `unbreakable: true` keep working. Mana: `def.mana / manaRegen`, ability `manaCost`.
- Invisibility: `unit.invisible` (set by passives, e.g. Night Meld); `Vision.detects(team,p)` reads `game.detectors` (future Sentry Wards).
- Casting: ability `castTime`, `cast: 'line'` (aimed). `Unit.castAbility(i, aim)` → `finishCast`. Controls `targeting` mode draws the line.
- Auras: any passive with `aura: { radius, bonusX... }` is applied by `Unit.updatePassive` to allies (same aura = max, different auras add).
- Trails: `Game.addTrail` / `updateTrails` (Barding Rally). Line projectiles: `Game.skillshots` (Arrow Piercer).

## Dev Lab (v0.12.0)
- Main menu → **DEV LAB** (top right). `js/dev/devlab.js` + `js/dev/orbit.js`, styles in `css/devlab.css`. While `app.state === 'devlab'` the frame loop calls `DevLab.update()` instead of the match loop (`app.openDevLab / closeDevLab` in main.js).
- **Model Viewer**: entries carry a `theme` ('medieval' | 'modern' | 'any') for the All / Medieval / Modern filter. Catalog is built from `UNIT_BUILDERS` + the building/prop builders (`buildCatalog()`). Troops are real `Unit`s (from a never-updated sandbox `Game`), animated by calling `unit.animate()`. New models show up automatically once they're in `UNIT_BUILDERS`; add props/buildings to `buildCatalog()`.
- **Sandbox**: `new Game({ ..., sandbox: true })` = no AI, no neutral camp spawns; `base.invulnerable` blocks base damage. Flat floor = the lab's own scene with `world = { terrain: null, castle, hq }` (no pathing/vision); "Lane map" uses the real world, terrain and fog. Upgrade "−" rebuilds the team's upgrades from scratch (`setUpgradeLevels`).
- **Base levels**: `buildCastle(level)` / `buildHQ(level)` (1–5, default 3 = the classic look), tiers in `CASTLE_TIERS` / `HQ_TIERS`, troop spots in `castleSlots(level)` / `hqSlots(level)` (also on `obj.userData.slots`, local coords, HQ front = -x). `Game.spawnTower` uses the base's slots when it has them. Dev Lab's `BASES` table ties each base to its builder, tiers and wall troop.
- **Base stats by level**: `BASE_LEVELS` in config.js (hp, armor, vision, slots), `baseLevelStats(L)`. Matches start at `GAME.baseLevel` (1); the **Fortify / Expand HQ** upgrades (effect `baseLevel`) call `Game.raiseBase`, which applies the next level's stats and `swapBaseModel` (rebuilds the model in place, tells the world via `world.setBaseModel`, moves wall troops). `Game.dispose` puts the world's own models back. `Game.setBaseLevel(team, L)` applies stats (HP keeps its %, Reinforce stays as `base.bonusHp`) and removes wall troops beyond the new spot count. `Game.upgradeMax(team, U)` caps `towers` upgrades (Battlement / Overwatch) at the base's slots; research, AI and the Barracks UI all use it.

## Deployable buildings (v0.19.0)
- **Build menu** (`G`, `#build` panel in ui.js): `FACTIONS[x].buildings` lists what a side can build. Placement mode lives in `Controls.startBuild / updateBuildGhost / placeAt / cancelBuild` (ghost model + footprint / range rings); Del or the Demolish command calls `Game.demolish` (refund `GAME.build.refund`).
- **A building is a unit** with a `structure` block in `UNITS` (cannon, howitzer): `buildTime, footprint, minRange, splash, shell, flight, knockback, groundOnly`. It never moves, doesn't count toward pop, registers its footprint with `terrain.addObstacle` (removed on death), and runs `Unit.updateStructure` (construction → aim → `Game.fireShell`).
- **Rules** in `GAME.build` (maxPerSide, maxDist, clearance, refund) and `Game.canPlace(team, id, x, z)` (returns an error string or null). `Game.build` pays and starts construction; `Game.placeStructure(..., instant)` is also used by the Dev Lab sandbox.
- **Shells**: `Game.fireShell / updateShells / explodeShell` — arc from the muzzle to the target's spot (no leading), splash 100% → 50% at the edge, howitzer shows a landing ring.
- **Upgrades** tweak buildings through the `structureMods` effect (`{ unit, perLevel: { minRange, splash } }` → `team.structMods`), plus normal `unitStats` (range). Buildings are included in `upgradesFor` like roster troops.
- **AI**: `Game.aiBuild` sets `T.aiBuildGoal`, `aiSaving` holds troop purchases while it saves (unless threatened), then it places the building behind its front line.

## Defense towers (v0.20.0)
- Towers are buildings with `structure.tower: true` (archerTower, sniperTower, hwacha, mgNest in config.js). They share a cap by base level, `GAME.build.towersByLevel`, and must stay within `GAME.build.towerMaxDist`. `Game.buildLimit(team, id)` gives the reason a building can't be added (also shown on the Build menu cards).
- `structure.fire`: `'direct'` = shoots its `projectile` through `Unit.releaseAttack` like a ranged troop (misses / evasion apply, hits flying unless `groundOnly`); `'volley'` = `Game.fireVolley` (Hwacha rockets through the shell system, `fireShell(src, target, { rocket, delay, flight, arc })`); otherwise artillery shells.
- `structure.highGround` makes `Unit.groundLevel` 2 (vision over trees, uphill rules). `structure.trueSight` registers a detector in `game.detectors` when the building comes online (`Game.activateStructure`). `structure.suppress` slows on every hit (`Unit.onAttackLanded`).
- Tower models carry a crew rig (`addCrew` / `levelCrew` in models.js); `rig.muzzleY` is the shot height.
- Testing: a selected building shows its min range ring (`Controls.updateMinRange`); the Dev Lab Inspector has "5 enemies in range" / "+ flying" (`DevLab.spawnTargets`).

## Building upgrade trees (v0.21.0)
- `js/buildtree.js`: `BUILD_TREES[id]` = `{ 2: step, a: { name, desc, 3, 4, 5 }, b: {...} }`. Each step: `name, cost, time, stats` (absolute values replacing the stat sheet), `structure` (fields replacing the structure block), `desc`. Later steps inherit earlier ones. `buildingDef(id, level, path)` merges them (cached); `nextSteps(id, level, path)` lists the next option(s) (two at the Lv 2 → 3 fork).
- Each building instance has `bLevel / bPath / upgrading`. `Game.upgradeBuilding(u, path)` pays and starts scaffolding (it keeps firing); `Unit.applyBuildLevel(level, path)` swaps the def, stats and model (`UNIT_BUILDERS[id](level, path)`), keeping HP %. `u.paid` accumulates for the demolish refund. `Game.aiUpgradeBuildings` picks path b against swarms, a otherwise.
- New structure fields: `marker` / `arc` (landing ring, lob height), `stun` (disarm + 100% slow), `guided` (shell follows its target), `fire: 'line'` + `lineWidth` (Railgun, `Game.fireLine`), `burn: { radius, dps, t }` (Thermobaric, `Game.addFire`), `pellet` / `rocketKind` (volley projectile look). Multi-barrel models expose `rig.muzzles`; shots cycle through them (`unit.shotIdx`).
- UI: `#bup` panel (`UI.renderBuildingUpgrade`), shown while one of your buildings with a tree is selected.
- v0.22.0 adds the Archer Tower tree and these structure fields: `multishot` (extra arrows at other targets, `Game.fireExtraShots`), `burnHit: { dps, t }` (on-hit burn, `Unit.addBurn` / `tickBurn`, true damage), `rain: { every, count, radius, damage, splash }` (`Game.fireRain`, its own timer), `bolt` (line shots shown as a flying bolt), `pierceSlow`, `flyingBonus` (extra damage vs flying, projectiles and line shots).
