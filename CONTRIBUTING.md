# Working on Era Clash together

These are the rules for everyone pushing to this repo, people and Claude alike. Read them once; most are habits.

## 1. Pull before you touch anything

```bash
git pull --rebase origin main
```

Do this **every time** before you start, and again right before you push. Two people plus Claude push to `main`, so anything you haven't pulled is something you might overwrite.

- Never `git push --force` on `main`.
- If a pull gives you a conflict, fix it or ask. Don't delete the other person's lines to make it go away.
- Tell each other what you're working on ("I'm editing the Lancer"), especially in `js/config.js` and `js/upgrades.js`. Almost every change goes through those two files, so that's where conflicts happen.

## 2. Commit messages = patch notes

Every push to `main` runs a GitHub Action (`.github/workflows/patch-notes.yml`). It **writes the in-game patch notes for you** from your commit message, so write the message for the players:

```
Buff Viking damage
- Viking damage 15 → 17
- Lone Wolf armor 3 → 4
```

- **First line** becomes the patch title.
- **Each `- ` line** becomes one bullet in the patch notes. Without bullets, the title is used.
- **Version:** a normal commit bumps the patch number (0.11.1 → 0.11.2). Start the title with `feat:` for a new feature or troop and it bumps the minor number (0.11.x → 0.12.0). To choose the version yourself, start with it: `v0.12.0: Bounty Hunter`.
- **No patch note:** add `[skip notes]` to the message. Commits that only touch docs (README, this file) are skipped automatically.
- **Wrote the notes by hand?** If your commit edits `js/patchnotes.js` itself, the Action leaves it alone.

The Action pushes a small "Patch notes: auto entry" commit right after yours. That's why you **pull again before your next push**.

Date and time are written in PHT, and your GitHub name shows as "by …" in the patch notes screen.

## 3. Versions

`MAJOR.MINOR.PATCH`

| Change | Bump | Example |
|---|---|---|
| Balance numbers, bug fix, small UI tweak | PATCH | 0.11.1 → 0.11.2 |
| New troop, ability, item, system, screen | MINOR | 0.11.2 → 0.12.0 |
| Huge milestone (e.g. multiplayer, Roblox port) | MAJOR | agree first |

## 4. Where things live

| File | What's in it |
|---|---|
| `js/config.js` | **All units** (troops and creeps share one schema), abilities, items, factions/rosters, global numbers (`GAME`) |
| `js/upgrades.js` | Barracks upgrades. Troop upgrades follow the **unit**, base upgrades follow the **faction** |
| `js/neutrals.js` | Neutral camps: positions, what spawns, drop tables |
| `js/unit.js` | One troop's brain: movement, attacks, passives, casting |
| `js/game.js` | Match state: economy, research, AI, active abilities, projectiles, loot |
| `js/terrain.js` | Obstacles, pathfinding, river high/low ground |
| `js/vision.js` · `js/fow.js` | Fog of war logic · fog rendering |
| `js/models.js` | Voxel models (one `buildX()` per unit, registered in `UNIT_BUILDERS`) |
| `js/ui.js` · `index.html` · `css/style.css` | HUD, menus, tooltips, pixel icons (SVG `<symbol>`s in index.html) |
| `js/patchnotes.js` | Patch notes, newest first |

## 5. House rules for the game itself

- **No hard-coding.** Units don't belong to a faction (rosters decide who hires them). Upgrades point at a unit id. Abilities are data in `ABILITIES`. If you write `if (unit.id === 'viking')` in game logic, there's probably a better way.
- **Every unit uses the full stat sheet:** cost, trainTime, hp, hpRegen, damage, damageType, attackSpeed (per minute), armor, ward, evasion, missChance, moveSpeed, range, vision `[day, night]`, aggro, radius, abilities, lore. Kill bounty is always 40% of cost.
- **Every upgrade and ability gets its own pixel icon** (8×8 SVG symbol in `index.html`).
- **Pixel-style UI.** Fonts are Pixelify Sans, VT323 and Press Start 2P (bundled in `vendor/fonts`).
- **Numbers on screen show at most 2 decimals** (use `fmt()` in ui.js).
- **Barracks upgrades last one match only.**
- **Flag balance honestly.** If a change makes something obviously too strong or weak, say so in the commit or the chat.

## 6. Test before you push

1. Run `start.bat` (or `node server.js`) and open http://localhost:8080.
2. Hard-refresh with **Ctrl+F5**.
3. Play the thing you changed, and keep the browser console (F12) open. **No red errors.**
4. If you touched a shared system (combat, vision, pathing), start one AI vs AI match and watch it for a minute.

## 7. Working with Claude

Claude pulls `main` before every change, never force-pushes, writes its own patch notes (so the Action skips its commits), and stops to ask when your change and its change hit the same lines.
