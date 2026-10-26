// ============================================================
//  PATCH NOTES — newest first. Every update to the game adds an entry here.
//  version: MAJOR.MINOR.PATCH  (minor = new features/troops, patch = balance & small fixes)
//  date: ISO with timezone (Asia/Manila)
//  sections: { title, items: [string] }   — items may contain <b>, <em>
//  author: optional GitHub name (auto entries written by .github/workflows/patch-notes.yml)
// ============================================================
export const PATCH_NOTES = [
  {
    version: '0.31.2', date: '2026-10-26T23:25:00+08:00', title: 'Dev Lab: spawn skill-tree forms', author: 'AyatoAishi',
    sections: [
      { title: 'Dev Lab', items: [
        'Sandbox spawn buttons: <b>right-click</b> a troop that has a skill tree to pick what to spawn: the base troop or any form (Lv 5 and Lv 15 branches, e.g. Lightning or Chaotic Viking). The button then shows that form (purple edge + level) and every spawn uses it until you pick another one. Troops without a tree have no menu.',
      ] },
    ],
  },
  {
    version: '0.31.1', date: '2026-10-26T23:10:00+08:00', title: 'Balance follow-up', author: 'AyatoAishi',
    sections: [
      { title: 'Changes', items: [
        '<b>Bulwark</b> frontal reduction 80% → <b>60%</b>, and it <b>can be Broken</b> now (Break shuts off Bulwark and Gold Will, so Break is the Juggernaut counter).',
        '<b>Gold Will</b> (Juggernaut): the 80% reduction from troops now applies to <b>physical damage only</b>.',
        '<b>Viking Warrior</b> HP 105 → <b>110</b>. Test fights: 5 Police beat 5 Vikings 10/10, but 1 Viking beats 1 Police 10/10, so the Police only win as a pack.',
        '<b>Lightning Viking</b> Chain Lightning 50 → <b>35</b>. <b>Storm Viking</b> 80 + 5% → <b>55 + 3%</b> max HP.',
        '<b>Dual Wielder / Desperado</b> damage +20 → <b>+4</b>.',
        '<b>Boomstick</b> max bonus +300% → <b>+200%</b>.',
        '<b>Mercenary</b> damage -6 → <b>-1</b>.',
        '<b>Rapid Fire</b> armor stacks last 4s → <b>8s</b>.',
        '<b>Rogue</b> attack speed +40 → <b>+50</b> (now wins 1v1 against Hunter 16/16).',
      ] },
      { title: 'Balance watch', items: [
        'Storm Viking still beat 6 Hitmen and 6 Peacekeepers 10/10 in tests. Lightning beat Frenzy 10/10. Chaotic lost to Peacekeeper 10/10. The Lightning line is far ahead of the Frenzy line.',
        'Juggernaut still beats 3x its gold in Vikings with no Break on the field.',
        'Desperado (+4) now loses to Rambo 10/10. Mercenary loses short 2v2 duels to Rambo and Shotgunner (its Fervor needs time to ramp).',
      ] },
    ],
  },
  {
    version: '0.31.0', date: '2026-10-26T22:45:00+08:00', title: 'Big balance pass + Flay and Relentless', author: 'AyatoAishi',
    sections: [
      { title: 'Viking', items: [
        '<b>Viking Warrior</b> HP 115 → <b>105</b>.',
        '<b>Lightning Viking</b>: +0.3 move speed. Chain Lightning 25 → <b>50</b> magic.',
        '<b>Storm Viking</b>: Chain Lightning 40 → <b>80</b>, plus <b>5% of the target\'s max HP</b> per zap.',
        '<b>Chaotic Viking</b>: Fury is capped at <b>20</b> stacks (was unlimited).',
      ] },
      { title: 'Ranger', items: [
        '<b>Ranger</b> damage 16 → <b>14</b>.',
        '<b>Scout Ranger / Stalker</b>: Eagle Eye chance 30% → <b>40%</b>. <b>Stalker</b> loses the +100 mana / +1 mana regen it never used.',
        '<b>Hunter</b> attack speed +20 → <b>+40</b>.',
      ] },
      { title: 'Imp, Lancer, Elf', items: [
        '<b>Imp Warrior</b>: HP 40 → <b>65</b>, armor 2 → <b>3</b>, ward 1 → <b>0</b>, damage 20 → <b>23</b>.',
        '<b>Lancer</b> damage 18 → <b>20</b>.',
        '<b>Crusader</b> (and Legion Commander / Death Knight): new active <b>Flay</b>. Spins the pike for 150% of his attack damage to every ground enemy within 2.5. 3s cooldown, can autocast.',
        '<b>High Elf</b> (and Drow / Eladrin): after Arrow Piercer, +50 → <b>+70</b> attack speed for 3 → <b>5</b> attacks (window 4s → 6s so all 5 fit).',
      ] },
      { title: 'Catapult', items: [
        'Damage 80 → <b>60</b>. Range 16 → <b>14</b>. Boulder splash radius 1 → <b>2.4</b>.',
      ] },
      { title: 'Police & Gunner', items: [
        '<b>Police Officer</b> damage 9 → <b>12</b>. <b>Riot Training</b>: 0.5–2 → <b>0.6–3</b> armor per nearby officer.',
        '<b>Suppressive Fire</b>: bonus damage +2–10 → <b>+4–16</b>, knockback 0.3–0.5 → <b>0.5–0.8</b>.',
        '<b>Mercenary</b>: cost +10, damage -5 → <b>-6</b>, no more 60% miss chance. New passive <b>Relentless</b>: each shot has a 50% chance to fly at a random other enemy within 5 of the target (if the target is alone, every shot hits it).',
        '<b>Rambo</b>: <b>+5 damage</b>. <b>Operator</b>: armor +2 → <b>+4</b>. <b>Boomstick</b>: +10% at 8 range rising to <b>+300%</b> at 1 range (was 5 → 1, +10% → +100%).',
        '<b>Shotgunner</b>: Scattershot 10 + 100% → <b>10 + 250%</b> of his attack damage, and it now gets the Boomstick bonus per target.',
        '<b>Rifleman / Advanced Rifleman</b>: Rapid Fire armor stacks now each have their own timer (new hits no longer refresh old stacks).',
        '<b>Dual Wielder / Desperado</b>: <b>+20 damage</b>.',
      ] },
      { title: 'Sniper', items: [
        '<b>Sniper</b> damage 24 → <b>40</b>.',
        '<b>Bull\'s Eye</b> reworked: instead of every 4th attack, <b>always a critical strike against full-health targets</b>. Hollow Points max level now also crits at 90%+ HP (the old "every 3rd shot" bonus is gone).',
        '<b>Marksman / Sharpshooter / High Marksman</b>: <b>+5 attack speed</b>. <b>Vendetta</b>: damage +15 → <b>+30</b>, and the active gives <b>+5 move speed</b>. <b>Dead Eye</b>: damage +30 → <b>+50</b>.',
      ] },
      { title: 'Riot Skirmisher & Recon Drone', items: [
        '<b>Riot Skirmisher</b> armor 3 → <b>6</b>. <b>Bulwark</b> frontal reduction 30% → <b>80%</b>.',
        '<b>Warden</b>: HP +200 → <b>+300</b>. <b>Iron Will</b>: 80% less physical damage from buildings, towers and bases, but <b>50% more damage from troops</b>.',
        '<b>Juggernaut</b>: HP +200 → <b>+300</b>. <b>Gold Will</b> reworked: <b>80% less damage from troops</b>, but 50% more damage from buildings, towers and bases (the +75% siege damage is gone).',
        '<b>Recon Drone</b>: damage 20 → <b>22</b>, HP 45 → <b>60</b>, ward 0 → <b>1</b>.',
      ] },
      { title: 'Balance watch', items: [
        'In equal-gold test fights: 3 Juggernauts beat 9 Vikings and lost almost no HP. 6 Storm Vikings beat 6 Police without a loss. 2 Desperados beat 2 Hunters in 2.5s. 6 base Police beat 6 base Vikings without a loss. Expect follow-up nerfs/buffs there.',
      ] },
    ],
  },
  {
    version: '0.30.0', date: '2026-10-26T20:20:00+08:00', title: 'Modern skill trees: Sniper, Riot Skirmisher, Recon Drone', author: 'AyatoAishi',
    sections: [
      { title: 'Sniper', items: [
        '<b>Marksman</b> (Lv 5): +1 range. <b>Steady Aim</b>: shots can\'t miss or be evaded.',
        '<b>Sharpshooter</b> (Lv 15): +2 range, +8 day / +4 night vision. <b>Precision Aura</b>: allies within 8 get +1 range and +6 damage (not himself, doesn\'t stack).',
        '<b>High Marksman</b> (Lv 15): +1 range. <b>Execution</b>: a killing bullet bounces to the victim\'s nearest ally within 8 for the same damage, Bull\'s Eye included. Bounce kills bounce again, up to 4 times.',
        '<b>Assassin</b> (Lv 5): +10 damage. Bull\'s Eye also deals 10% of the target\'s current HP and Breaks it for 3s.',
        '<b>Vendetta</b> (Lv 15): +15 damage, keeps the Assassin Bull\'s Eye. New active <b>Vendetta</b> (100s): invisible for 20s, walks through terrain, attack range fixed at 3. The attack that ends it deals +500% (+100% against buildings and bases).',
        '<b>Dead Eye</b> (Lv 15): +30 damage, -10 attack speed, keeps the Assassin Bull\'s Eye. New active <b>Assassinate</b> (60s): 1s aim (works prone), then 100 + 30% missing HP magic damage at attack range +10.',
      ] },
      { title: 'Riot Skirmisher', items: [
        '<b>Fortress</b> (Lv 5): +130 HP, +2 armor. <b>Fortress</b>: enemy shots aimed at an ally behind him that pass through him hit him instead.',
        '<b>Warden</b> (Lv 15): +200 HP, +3 armor, keeps Fortress. <b>Iron Will</b>: 75% less physical damage from buildings, towers and bases.',
        '<b>Dire</b> (Lv 15): +150 HP, +4 armor, loses Fortress. <b>Absorb</b>: damage allies within 10 would take goes to him before mitigation, so his own armor and ward apply. Debuffs still land on the ally. With several Dires the nearest one takes it, and Dires never pass damage to each other.',
        '<b>Breaker</b> (Lv 5): +130 HP, +2 ward. <b>Breaker</b>: each ability or item an enemy uses within 10 gives a stack (8s each, no limit) that heals him and allies within 8 by 4 HP/s.',
        '<b>Juggernaut</b> (Lv 15): +200 HP, +3 ward, keeps Breaker. <b>Gold Will</b>: +75% physical damage to buildings and bases.',
        '<b>Striker</b> (Lv 15): +150 HP, +4 armor, loses Breaker. <b>Combust</b>: after taking 100 magic damage he explodes for 150 magic damage within 10, and he and allies within 10 get a 100 shield for 5s. 20s cooldown.',
        'New: <b>shields</b>. Temporary HP that soaks damage first, shown as a silver segment on the HP bar.',
      ] },
      { title: 'Recon Drone', items: [
        '<b>Overseer</b> (Lv 5): +2 armor. <b>Mini Drones</b>: 2 untargetable pets that fly within 3 of it and shoot random enemies with its range and attack speed for 50% damage. Their hits apply Penetration. Break grounds them.',
        '<b>Overlord</b> (Lv 15): +2 armor, 5 mini drones.',
        '<b>Missile Drone</b> (Lv 5): +10 damage. <b>Homing Missile</b> (10s): the next attack is a +4 range missile that also blasts 80 magic damage within 3.',
        '<b>Barrage Drone</b> (Lv 15): +20 damage. Each missile fires a second one at another random enemy in range, or the same target if there is none.',
        '<b>Swarm</b> (Lv 5): -2 damage. <b>Pack Bonus</b>: for each other Swarm or Hive within 8: +2 damage, +1 armor, +0.1 move speed and +2 attack speed, up to 10.',
        '<b>Hive</b> (Lv 15): -1 damage, Pack Bonus up to 25.',
      ] },
      { title: 'Balance watch', items: [
        'Untested in real matches. Dire and Hive look strongest. A Dire next to a big army takes all its damage, so it either holds a fight or melts fast. 25 Hives each get +50 damage and +25 armor, but they cost over 4,000 gold. Vendetta\'s opener hits about 6x.',
      ] },
    ],
  },
  {
    version: '0.29.2', date: '2026-10-26T19:20:00+08:00', title: 'Catapult and Acid Spray now hurt neutrals', author: 'AyatoAishi',
    sections: [
      { title: 'Bug fixes', items: [
        '<b>Catapult</b> boulders, Advanced/Heavy Catapult <b>fire</b> and Batrider <b>Acid Spray</b> did nothing to a neutral camp that had not been provoked yet. They now damage neutrals and pull the camp onto you like any other hit.',
        'Tower and structure splash (Hwacha, bunkers, etc.) still leaves peaceful camps alone, as before.',
        'Balance note: Catapults can now open camps from 16 range, which makes jungling with them strong. Watch it.',
      ] },
    ],
  },
  {
    version: '0.29.1', date: '2026-10-26T18:08:00+08:00', title: 'Sturdier bases and towers', author: 'AyatoAishi',
    sections: [
      { title: 'Bases', items: [
        'Castle / HQ HP and armor by level: Lv 1 2,500 / 0 → <b>3,000 / 8</b>, Lv 2 3,200 / 0 → <b>4,500 / 10</b>, Lv 3 4,000 / 0 → <b>6,000 / 12</b>, Lv 4 5,000 / 2 → <b>8,000 / 16</b>, Lv 5 6,500 / 4 → <b>12,000 / 20</b>.',
        'Armor now cuts base damage by 32% at Lv 1 up to 55% at Lv 5, so effective HP is about <b>+75%</b> at Lv 1 and over <b>3x</b> at Lv 5. Sieges take much longer, and this reins in the Heavy Catapult from 0.29.0.',
      ] },
      { title: 'Towers', items: [
        '<b>Archer Tower</b> HP 500 → <b>750</b>, armor 3 → <b>4</b>. <b>Sniper Tower</b> HP 450 → <b>600</b>. <b>Hwacha</b> HP 450 → <b>600</b>. <b>Machine Gun Nest</b> HP 550 → <b>700</b>.',
      ] },
      { title: 'General', items: [
        'Damage variance per hit ±1 → <b>±2</b>. Spawn protection 5s → <b>6s</b>.',
      ] },
    ],
  },
  {
    version: '0.29.0', date: '2026-10-26T17:55:00+08:00', title: 'Tier 2 Medieval: Dryad, Catapult, Batrider',
    sections: [
      { title: 'Dryad (Tier 2, 200g, 2 army)', items: [
        '200 HP, 6 armor, 3 ward, 22 damage, 50 attack speed, range 8.5, 3.2 move, 4 regen, 250 mana (+1/s). Throws spears.',
        '<b>Nature\'s Grace</b>: neutral creeps deal 50% less physical damage to her.',
        '<b>Arcane Coating</b> (toggle, Q): coated hits poison for 4s (10 magic/s) and slow 15%, 18 mana per hit; switches off when she runs dry. The AI turns it on when it has mana for a few hits.',
        'Upgrades: <b>Arcane Potency</b> (300 / 600 / 1,200 / 2,400 / 4,800): poison 15 / 20 / 25 / 30 / 35 per second, max level adds 2% of the target\'s max HP per second. <b>Nature\'s Will</b>: stat boost.',
        'Skill tree: Lv 5 <b>Rabble</b> (+20 HP, +2 ward, +0.4 move, <b>Interrupt</b>: anything she damages is silenced 1s) → Lv 15 <b>Silencer</b> (+30 HP, +4 ward, +0.6 move, 2s silence, silenced targets deal 30% less spell damage, coating costs no mana) · Lv 5 <b>Relentless</b> (+10 attack speed, <b>Splitshot</b>: 2 extra spears at the nearest other enemies for 75% damage, on-hit effects included) → Lv 15 <b>Split</b> (+25 attack speed, 4 extra spears).',
      ] },
      { title: 'Catapult (Tier 2, 250g, 2 army)', items: [
        '400 HP, 10 armor, <b>-8 ward</b>, 80 damage, 10 attack speed (one throw every 6s), range 16, <b>can\'t hit anything within 3</b> (it backs off instead) and <b>can\'t hit flying units</b>, 1.8 move.',
        '<b>Siege</b>: +200% damage against buildings and bases. <b>Homing Stone</b>: boulders land where the target was when thrown (a red ring marks the spot, fast troops can walk out), splash 1. Neither can be broken.',
        'Upgrades: <b>Spiked Plating</b> (250 / 500 / 1,000 / 2,000 / 4,000): +2 / 4 / 6 / 8 / 10 armor and reflects 10–50% of <b>melee</b> attack damage. <b>Reinforced Frame</b>: stat boost.',
        'Skill tree: Lv 5 <b>Advanced</b> (+20 damage, +1 range, boulders leave fire for 5s, 30 magic/s, troops only) → Lv 15 <b>Heavy</b> (+30 damage, +20 HP, -0.4 move, +1 range, the fire also burns buildings and the enemy base).',
      ] },
      { title: 'Batrider (Tier 2, 300g, 2 army, flying)', items: [
        '180 HP, 3 armor, 4 ward, 30 damage, 60 attack speed, range 10, 3.3 move, 2 regen. Flies: melee can\'t reach it.',
        '<b>Acid Spray</b> (Q, 30s, range 10, radius 4): an acid pool for 5s, 20 magic/s that grows +20% for every second it lingers. Pools from several Batriders never stack (the strongest counts). New point-target aiming with a landing ring.',
        '<b>Grudge</b>: when it dies, allies within 5 get +50 attack speed for 3s.',
        'Upgrades: <b>Acid Content</b> (300 / 600 / 1,200 / 2,400 / 4,800): +15 / 20 / 25 / 30 / 35 acid damage per second; max level: enemies in the acid lose 20 attack speed and the pool grows 0.3 radius per second. <b>Roost Training</b>: stat boost.',
        'Skill tree: Lv 5 <b>Protector</b> (+5 armor, aura: allies within 5 get +3 armor and +3 ward, doesn\'t stack) → Lv 15 <b>Guardian</b> (+6 armor, the aura also takes 3 armor and 3 ward from enemies, buildings and the enemy base within 5) · Lv 5 <b>Ravaging</b> (+1 move, +30 HP, <b>Liberation</b>: every 2s, 30 + 20% attack damage magic to enemies within 3 and knocks them 2 away) → Lv 15 <b>Draconic</b> (+2 move, +50 HP, 40 + 50% attack damage as <b>true</b> damage).',
      ] },
      { title: 'Also', items: [
        'All three are <b>Tier 2</b>: they unlock at a level 2 castle (Stone Keep) and take 2 army space. The AI hires them once its base allows.',
        'Status row shows the new effects: Poisoned, Silenced, Acid, Coated, Grudge, Ward reduced.',
        'Every new ability and upgrade has its own pixel icon; every form has its own look (Silencer\'s rune halo, Heavy Catapult\'s iron plates and burning bucket, Guardian\'s halo, Draconic\'s horns and embers...).',
      ] },
      { title: 'Balance watch (honest)', items: [
        'In a test a single <b>Heavy Catapult</b> took ~1,900 HP off an undefended level 1 base (2,500 HP) in 25s (330 per boulder vs buildings plus the fire). Wall Rangers outrange it, but an unanswered Heavy Catapult ends games. First thing to tune if it feels bad.',
        'Acid Spray ramps from 20/s to 40/s over a pool\'s 5s (before upgrades); with Acid Content maxed it\'s 55/s rising to 110/s on everything standing in it. Watch it on big fights.',
      ] },
    ],
  },
  {
    version: '0.28.0', date: '2026-10-26T17:40:00+08:00', title: 'Troop tiers & army space',
    sections: [
      { title: 'Tiers (new)', items: [
        'Every troop now has a <b>Tier</b>. All current Medieval and Modern troops are <b>Tier 1</b>: hire them any time, 1 army space each.',
        '<b>Tier 2</b> troops need a <b>level 2 base</b> (Stone Keep / Police Precinct: one Fortify / Expand HQ) and take <b>2 army space</b>. At 39 / 40 you can\'t hire one. The shop shows a T2 badge, the space it takes, and a lock banner until your base is high enough.',
        'Higher tiers level slower on the skill tree (+25% exp per tier above 1, from 0.26).',
      ] },
      { title: 'Barracks Quarters (new upgrade, both sides)', items: [
        '<b>+10 army limit</b> per level, 6 levels: 40 → 100. Price 500 / 1,050 / 2,200 / 4,600 / 9,600 / 20,000 (about x2.1 per level), 15–40s research.',
        'The top bar shows used / limit with Tier 2 troops counted double. The AI only buys Quarters when its army is nearly full, and never queues a troop its base level can\'t hire.',
      ] },
    ],
  },
  {
    version: '0.27.0', date: '2026-10-26T17:36:00+08:00', title: 'Formations, unit groups, camera follow, rally flag',
    sections: [
      { title: 'Formations (new)', items: [
        'Four formations for your selected troops: <b>Circle</b> and <b>Square</b> (hollow), <b>Line</b>, and <b>Custom</b>: a shape you draw yourself on a pad (pencil button). Keys: <b>Alt + 1 / 2 / 3 / 4</b>, or the new buttons at the top left.',
        'The shape forms around the middle of your troops and <b>faces your cursor</b>: cursor to their left = a vertical line. It isn\'t sticky: your next right-click is a normal move (troops have different speeds, so a locked shape would fall apart anyway).',
        'Your custom drawing is saved with your settings. Up on the pad = toward the cursor; troops spread evenly along what you drew.',
      ] },
      { title: 'Unit groups (reworked)', items: [
        '5 groups. <b>Alt + Z / X / C / V / B</b> sets group 1–5 from your selection, <b>Ctrl + same key</b> selects it, double-tap Ctrl + key jumps the camera there. All rebindable in Options (the modifiers stay fixed).',
        'The old Ctrl + 1-9 / Alt + 1-9 control groups are gone: digits are for items (1-6) and Alt + digit is formations now.',
      ] },
      { title: 'Camera', items: [
        '<b>Space</b> centers on your selected troops; <b>hold</b> it to follow them. With nothing selected it goes to your base.',
        'Base camera moved to its own key: <b>`</b> (backquote), rebindable. Old saved settings that had both on Space are fixed automatically.',
      ] },
      { title: 'Rally flag (new)', items: [
        'Select your base and <b>right-click the ground</b>: a red flag goes up and every new troop walks there and waits. Right-click <b>your own base</b>: new troops wait at the gate. Right-click the <b>enemy base</b>: back to the default (they charge).',
        'Only you see the flag, and only while your base is selected.',
      ] },
    ],
  },
  {
    version: '0.26.0', date: '2026-10-26T17:16:00+08:00', title: 'Exp from bounties, autocast, buff bar',
    sections: [
      { title: 'Skill tree exp', items: [
        'Troops now level from <b>exp</b>, not kill count: every kill gives that troop type exp equal to the victim\'s <b>gold bounty</b> (40% of its cost). Killing <b>enemy troops</b> gives <b>+20%</b> on top, creeps give the plain amount.',
        'Exp per level: <b>50</b> for Lv 1, then +20 per level (50, 70, 90…). Lv 5 = 450 exp, Lv 15 = 2850. A Dire Bear (60 exp) is worth far more than a Police Officer (24), so big kills level you fast.',
        'Higher-tier troops need more: Tier 2 +25%, Tier 3 +50%… (all current troops are Tier 1).',
        'AI difficulty exp bonuses still apply. Chat command: <b>/xp</b> &lt;unit&gt; &lt;exp&gt;.',
      ] },
      { title: 'Autocast', items: [
        '<b>Right-click an active ability</b> to toggle autocast: the troop uses it on its own when it would help (same logic as the AI). Applies to every selected troop that has that ability, so select your elves and right-click once.',
        'Autocast slots get a marching gold border. Splatter (all variants) and Snipe Stance can\'t be autocast; their tooltip says so.',
      ] },
      { title: 'Buffs & debuffs', items: [
        'A <b>status row</b> above the selection panel shows everything on the selected troop: stun, fear, slow, burn, break, disarm, armor loss (with stacks), Fury exposure, weaken, curses, Death Mark, plus buffs like invulnerable, true strike, Galewinds, Fervor and Thin Blue Line stacks, item buffs and every aura it\'s standing in.',
        'Green frame = buff, red = debuff; the number is the time left. Hover for exact values.',
      ] },
      { title: 'Balance', items: [
        '<b>Immaterial</b> (Banshee) can now be <b>broken</b> (Javelin and other break effects remove its 30% evasion).',
        '<b>Thin Blue Line</b>: max officers 3 → <b>5</b>, damage per officer 3.5 → <b>2</b> (max +10.5 → +10, but packs need to be bigger to get there).',
        'Brimstone Imp and Boomstick were checked against your notes and already work that way: Brimstone burns harder and its blast deals +30%; Boomstick gives no bonus beyond 5 range.',
      ] },
      { title: 'Fixes', items: [
        '<b>/spawn &lt;unit&gt; &lt;n&gt; neutral</b> crashed the game. Fixed.',
      ] },
    ],
  },
  {
    version: '0.25.1', date: '2026-10-26T15:40:00+08:00', title: 'Howitzer models overhauled',
    sections: [
      { title: 'Howitzer', items: [
        'All 8 Howitzer models are rebuilt with about twice the detail, and no part floats any more (the trail spades, the Guided Shells radar mast, the Autoloader barrel and the Thermobaric hull were all loose before).',
        'Path A stays a fixed gun pit that gets more high-tech: <b>Long Tom</b> on a pedestal with a crew deck, <b>Guided Shells</b> adds a spinning radar and a fire-control computer, <b>Railgun</b> becomes an armoured turret with glowing rails and capacitor banks.',
        'Path B goes mobile: <b>Autoloader</b> gets a drum magazine that turns properly (it used to tumble), the <b>MLRS</b> is a 6-wheel truck and the <b>Thermobaric</b> a tracked launcher. On both, only the launcher turns, and the rockets visibly leave the tubes when it fires, then reload.',
        'Rocket pods no longer dip into the ground at full elevation.',
      ] },
    ],
  },
  {
    version: '0.25.0', date: '2026-10-26T14:07:00+08:00', title: 'Hwacha & Machine Gun Nest upgrade trees',
    sections: [
      { title: 'Two trees, built as a pair', items: [
        'Select a Hwacha or a Machine Gun Nest to upgrade it, like the other buildings: Lv 2, then pick a path at Lv 3. Both towers share the same shape: <b>path A</b> trades many small hits for a few heavy ones that get past armor, <b>path B</b> fires more and slows what it hits. Prices are the same on both sides: 160 / 320 / 520 / 940g.',
        'Every level has its own model. The <b>Rocket Rack</b> and <b>Belt Feed</b> Barracks upgrades are gone: their extra rockets and attack speed now come with path B.',
      ] },
      { title: 'Hwacha', items: [
        'Lv 2 <b>Iron-Banded Hwacha</b>: 600 HP, 12 rockets (16 each), +1 armor.',
        'Path A, Singijeon: <b>Daesingijeon Rack</b> (6 big rockets, 40 each, splash 2, range 15) → <b>Fire Dragon Rack</b> (42 each, every rocket leaves <b>burning ground</b>, 6/s for 3s) → <b>Thunder Rocket Battery</b> (8 rockets, 38 each, splash 2.2, burning ground, <b>stun 0.5s</b>).',
        'Path B, Ripple Fire: <b>Twin Hwacha</b> (16 rockets every 4s, the old Rocket Rack max) → <b>Munjong Hwacha</b> (24 rockets in a wide fan, hits <b>slow 25%</b>, range 15) → <b>Whirlwind Battery</b> (every 3s, 16 rockets at <b>two different groups</b>, slow 35%).',
      ] },
      { title: 'Machine Gun Nest', items: [
        'Lv 2 <b>Fortified Pillbox</b>: 750 HP, 6 damage, +1 armor, range 12.',
        'Path A, Heavy Caliber: <b>Heavy MG Post</b> (.50 cal, 13 damage, range 13) → <b>Twin .50 Bunker</b> (14 damage, AP rounds <b>ignore 4 armor</b>) → <b>Autocannon Bunker</b> (28 per shell, <b>50% splash</b> around the target, +50% vs flying).',
        'Path B, Rotary: <b>Gatling Nest</b> (attack speed 510, the old Belt Feed max, slow 25%) → <b>Minigun Nest</b> (<b>2 targets</b> per shot, slow 30%) → <b>Vulcan CIWS</b> (3 targets, slow 35%, +50% vs flying, <b>true sight 10</b>). The barrels spin while firing.',
      ] },
      { title: 'Balance watch', items: [
        'In test runs against a packed group, the <b>Thunder Rocket Battery</b> dealt the most damage of any tower capstone (burning ground from 8 rockets adds up, plus the stun). It\'s ground-only with a 3 min range, but it\'s the one to watch. The Vulcan CIWS and the Autocannon Bunker landed close to the Sniper and Archer capstones.',
      ] },
    ],
  },
  {
    version: '0.24.0', date: '2026-10-24T22:30:00+08:00', title: 'Five new skill trees, form outfits, item keys & HP bar fix',
    sections: [
      { title: 'Fixes', items: [
        '<b>Base HP bar out of sync</b> (e.g. 11 / 1500 with the bar still 60% full): the top bars had a stepped CSS animation that restarted every frame while HP kept changing (sieging, Repair), so the bar froze. The animation is gone; the bar is exact every frame.',
        'At 1366-wide screens the item grid in the selection panel was cut off (the command card got wider for BUILD). The command card buttons are smaller below 1500 px so both fit.',
      ] },
      { title: 'New skill trees', items: [
        '<b>Imp</b>: Ice Imp (+5 dmg, +2 ward, Ice Splatter stuns 2s) → Cryonic Imp (+10 dmg, +3 ward, stun and +50% Splatter damage) · Sacred Imp (+1 move speed, +2 armor, Sacred Splatter -10 armor 5s) → Cursed Imp (+2 move speed, +3 armor, -12 armor that also hits <b>buildings and the enemy base</b>) · Fire Imp (+30 HP, Fire Splatter <b>leaps</b> up to 12 at speed 18 and burns 4% max HP/s magic for 3s) → Brimstone Imp (+60 HP, burn 5% for 4s, +1 radius, +30% damage). All variants still use Organic Matter, and Death Splatter explodes as the variant.',
        '<b>Lancer</b>: Crusader (+5 dmg, +50 HP, +0.4 move speed) → Legion Commander (+10 / +70 / +0.5, <b>Counterstrike</b>: 30% to hit back when attacked) or Death Knight (+8 / +50 / +0.4, +10 attack speed, <b>Curse of the Death Knight</b>: 20% slow 4s, allies heal 10 per hit on the cursed unit).',
        '<b>Elf</b>: High Elf (+8 dmg; after Arrow Piercer, +50 attack speed for 3 attacks within 4s — only if you own the Arrow Piercer upgrade) → Drow (+10 dmg, <b>Zealot</b>: attacks ignore base armor) or Eladrin (+9 dmg, +5 attack speed, <b>Galewinds</b>: +3 move speed for 1s on hit).',
        '<b>Police Officer</b>: Enforcer (+40 HP, <b>Enforce</b>: fear enemies within 3 for 2s, 60s) → Hitman (+40 HP, +5 dmg, loses Enforce, <b>Execute</b>: unit target, 100% attack damage + 10% missing HP, 0.25s cast, range 6, 20s) or Agent (+30 HP, +5 dmg, keeps Enforce, <b>Disrupt</b>: every 3rd attack stuns 0.8s) · Vanguard (+2 regen, <b>Outnumbered</b>: +15% damage when allies ≥ enemies within 8, else +5 armor and ward) → Peacekeeper (+8 regen, +2 armor, <b>Mediator</b>: enemies within 6 deal 50% less damage for 5s, 50s, doesn\'t stack).',
        '<b>Gunner</b>: Machine Gunner (+20 attack speed, Fervor gives +10% attack speed per stack, 20 stacks) → Mercenary (+100 attack speed, +60% miss, -5 dmg, Fervor uncapped) or Rambo (+20 attack speed, +1 range, <b>Double Tap</b>: next shot fires twice, 6s) · Operator (+5 dmg, +2 armor, <b>Boomstick</b>: +10% damage at 5 range up to +100% at 1) → Shotgunner (+20 dmg, -5 attack speed, +4 armor, +4 ward, <b>Scattershot</b>: line blast 10 + 100% attack damage magic, width 2.4, 8 range, 11s) · Rifleman (+3 dmg, <b>Rapid Fire</b>: 8 attacks with +40 attack speed, each -1 armor 4s stacking, 15s recharge) → Advanced Rifleman (10 attacks, +60, -1.2) · Dual Wielder (-1 range, +20 attack speed, <b>Flick</b>: 30% when attacked to shoot a random enemy, 60% slow 1s) → Desperado (-1 range, +30 attack speed, Flick on attacking too).',
        'As before, a deeper form\'s stats are the <b>totals</b> vs the base troop, not added to the previous form.',
      ] },
      { title: 'Skill tree', items: [
        'Leveling is cheaper: <b>3 kills</b> for Lv 1, then +2 per level (3, 5, 7, 9…). Lv 5 = 35 kills (was 45), Lv 15 = 255 (was 360).',
        'Zoom: mouse wheel or the − / + / FIT buttons; drag to pan. Each tree opens fitted to the view.',
        'Cards are short now: stat chips and ability chips. <b>Hover an ability icon for its exact text</b> with that form\'s real numbers (Scout Ranger\'s Eagle Eye shows 30% true strike, +30% damage and 5 magic instead of the base 20% / +5).',
        'Evolutions change the outfit, not just eyes and hair: e.g. Lightning Viking\'s axe glows and sparks, Storm Viking gets a winged helm, Fire Imp burns, Death Knight goes black with a green visor, Desperado gets a hat and poncho. Every form has its own look and portrait.',
      ] },
      { title: 'Items', items: [
        'Item keys: <b>1–6</b> use the item in that slot of the selected troop (rebindable in Options). Control groups: Ctrl+N saves, <b>Alt+N</b> recalls (plain N still recalls when nothing is selected).',
        'Right-click an item in the inventory: <b>Use</b> / <b>Discard</b> (drops it at the troop\'s feet).',
        'Drops on the ground <b>vanish after 30 seconds</b> (they blink for the last 5).',
      ] },
      { title: 'Balance', items: [
        'Banshee <b>Immaterial</b>: evasion 50% → 30%.',
        '<b>Outlaw</b>: damage 20 → 30. <b>Cleave</b> hits a wider area behind the target (3 deep, ~140° instead of 2.2 / ~90°).',
        'Attack speed is capped at 600 (10 attacks/s) so uncapped stacking can\'t break the game. Honest watch list: Mercenary (uncapped Fervor) and Cursed Imp packs on bases are the most likely to be too strong; Hitman\'s Execute is strong against big HP pools.',
      ] },
    ],
  },
  {
    version: '0.23.0', date: '2026-10-24T20:59:00+08:00', title: 'Sniper Tower upgrade tree',
    sections: [
      { title: 'Sniper Tower upgrades (the Archer Tower\'s counterpart)', items: [
        'Select a Sniper Tower to upgrade it. Lv 2 <b>Reinforced Overwatch</b> (140g): 600 HP, 55 damage, range 19.',
        'Path A, Marksman: <b>Marksman Post</b> (280g: 85 damage, range 22) → <b>Anti-Materiel Nest</b> (500g: rounds <b>pierce everything in a line</b>, 55 each, range 24) → <b>Deadeye Sentinel</b> (900g: 95 piercing, <b>25% headshot for double damage</b>, +50% vs flying).',
        'Path B, Fire Team: <b>Spotter Team</b> (280g: <b>2 targets</b> per shot, true sight 14) → <b>Suppression Team</b> (500g: 3 targets, hits <b>slow 25%</b>) → <b>Drone Command</b> (900g: every 8s a <b>10-missile strike</b> on the target area, true sight 18).',
        'Every level has its own model. The <b>Thermal Scope</b> Barracks upgrade is gone: its range and damage now come with path A.',
      ] },
    ],
  },
  {
    version: '0.22.0', date: '2026-10-24T20:46:00+08:00', title: 'Archer Tower upgrade tree & tougher bases',
    sections: [
      { title: 'Bases', items: [
        'Base HP by level raised: <b>2500 / 3200 / 4000 / 5000 / 6500</b> (was 1500 / 2000 / 2500 / 3500 / 5000). Early rushes ended matches before buildings mattered; in AI tests matches now last about 8 minutes (was about 7) and the AI builds and upgrades far more.',
      ] },
      { title: 'Archer Tower upgrades', items: [
        'Select an Archer Tower to upgrade it. Lv 2 <b>Stone Watchtower</b> (120g): 650 HP, 25 damage, range 16.',
        'Path A, Sharpshooter (blue roofs): <b>Longbow Tower</b> (250g: 38 damage, range 19) → <b>Ballista Tower</b> (450g: bolts <b>pierce everything in a line</b>, 36 each) → <b>Skypiercer</b> (800g: 80 piercing, <b>slows 50%</b>, +50% damage to flying).',
        'Path B, Volley (red roofs): <b>Twin Archers</b> (250g: every shot hits <b>2 targets</b>) → <b>Fire Archers</b> (450g: 3 targets, hits <b>burn</b> 5/s for 3s, ignores armor) → <b>Arrow Storm Spire</b> (800g: 4 archers, every 8s <b>14 arrows rain</b> on the target area).',
        'Every level has its own model. The <b>Fire Arrows</b> Barracks upgrade is gone: fire arrows now come with path B.',
      ] },
    ],
  },
  {
    version: '0.21.0', date: '2026-10-24T20:14:00+08:00', title: 'Building upgrade trees: Cannon & Howitzer',
    sections: [
      { title: 'New: upgrade your buildings', items: [
        'Select one of your Cannons or Howitzers: an <b>upgrade panel</b> appears at the top. Each building upgrades on its own: <b>Lv 1 → 2</b>, then at <b>Lv 3 pick one of two paths</b>, then Lv 4 and 5 down that path. Every level has its own model.',
        'Upgrading puts up scaffolding for 4–12s, and the building <b>keeps firing</b> at its old level until it\'s done. Demolish refunds 50% of everything spent on it, upgrades included.',
        'The enemy AI upgrades its buildings too: against swarms it takes the rapid-fire path, otherwise the heavy one.',
        'Dev Lab: level / path buttons for buildings in the Model Viewer and the Sandbox Inspector.',
      ] },
      { title: 'Cannon', items: [
        'Lv 2 <b>Bronze Cannon</b> (150g): 750 HP, 55 damage, 5 armor.',
        'Path A, heavy shot: <b>Bombard</b> (300g: 85 damage, splash 3.2, every 5s) → <b>Siege Mortar</b> (500g: lobs shells with a landing ring, range 20, 100 damage) → <b>Great Bombard</b> (900g: 150 damage, splash 4.2, <b>stuns 1.2s</b>).',
        'Path B, rapid fire: <b>Twin Cannons</b> (300g: two barrels, about twice the fire rate) → <b>Grapeshot Battery</b> (500g: a cone of 8 iron balls) → <b>Thunder Organ</b> (900g: 12 balls every 2s with knockback).',
      ] },
      { title: 'Howitzer', items: [
        'Lv 2 <b>Heavy Howitzer</b> (180g): 620 HP, 75 damage, 4 armor.',
        'Path A, precision: <b>Long Tom</b> (360g: range 28) → <b>Guided Shells</b> (600g: shells steer onto the target, can\'t be dodged) → <b>Railgun</b> (1080g: an instant slug that pierces everything in a line for 220, <b>hits flying</b>).',
        'Path B, saturation: <b>Autoloader</b> (360g: fires every 3.3s) → <b>MLRS</b> (600g: 6 rockets, splash 2) → <b>Thermobaric</b> (1080g: 8 rockets that leave <b>burning ground</b>, 10 magic damage/s for 4s).',
      ] },
      { title: 'Changes', items: ['The Barracks upgrades <b>Grapeshot</b> and <b>Ballistic Computer</b> are gone: their effects now live in the building paths.'] },
    ],
  },
  {
    version: '0.20.1', date: '2026-10-24T19:59:00+08:00', title: 'Hwacha buff',
    sections: [
      { title: 'Balance', items: [
        '<b>Hwacha</b> was well behind the Machine Gun Nest. Rockets per volley 8 → <b>10</b>, damage per rocket 12 → <b>14</b>, volley every 6s → <b>5s</b>, splash radius 1.2 → <b>1.5</b>. Against a group in a test, damage over 15s went from 167 to 329 (MG Nest: 371).',
        'Rocket Rack now reads 12 / 14 / 16 rockets per volley.',
      ] },
    ],
  },
  {
    version: '0.20.0', date: '2026-10-24T19:35:00+08:00', title: 'Defense towers',
    sections: [
      { title: 'New: Towers (Build menu)', items: [
        'The Build menu now has a <b>Towers</b> section. Towers must stand within 15 of your base. How many you can have depends on your base level: <b>Lv 1–2: 1 · Lv 3–4: 2 · Lv 5: 3</b> (any mix). Fortify / Expand HQ unlocks more.',
        'Towers shoot from the top: they count as <b>high ground</b> (see over trees, uphill advantage).',
        '<b>Archer Tower</b> (Medieval, 200g, 18s): 500 HP, 20 damage every 1s, range 15, <b>hits flying</b>.',
        '<b>Sniper Tower</b> (Modern, 220g, 20s): 450 HP, 45 damage every 2.5s, range 18, hits flying. <b>True sight 10</b>: reveals invisible enemies (Elf Night Meld) around it.',
        '<b>Hwacha</b> (Medieval, 260g, 22s): 450 HP. Every 6s fires a fan of <b>8 rocket-arrows</b> (12 damage each, small splash), range 2–13, ground only.',
        '<b>Machine Gun Nest</b> (Modern, 260g, 22s): 550 HP, 4 armor, 5 damage at 330 attack speed, range 11, hits flying. <b>Every hit slows 20%</b> for 1s.',
        'New Barracks upgrades: <b>Fire Arrows</b> (Archer Tower +5 damage), <b>Thermal Scope</b> (Sniper Tower +2 range, +8 damage), <b>Rocket Rack</b> (Hwacha +2 rockets), <b>Belt Feed</b> (MG Nest +60 attack speed). 3 levels each.',
        'The enemy AI builds towers too.',
      ] },
      { title: 'Testing aids', items: [
        'A selected building shows its range: dots for max range, an <b>orange ring</b> for its minimum range (artillery, Hwacha).',
        'Dev Lab sandbox: select a building to get <b>5 enemies in range</b> and <b>+ flying</b> test buttons in the Inspector.',
      ] },
      { title: 'Balance to watch', items: ['The Machine Gun Nest has the highest damage per second (about 22 against light armor) but the shortest range. Towers that hit flying units are the first real answer to Recon Drones near the base.'] },
    ],
  },
  {
    version: '0.19.1', date: '2026-10-24T19:15:00+08:00', title: 'Fix: command card overflow',
    sections: [
      { title: 'Fix', items: [
        'The command card never got wider when <b>BUILD</b> was added — with 5 buttons now in that row, <b>REPAIR</b> was shoved off the right edge. Widened the card\'s size (regular and narrow-screen layouts) to fit all five.',
      ] },
    ],
  },
  {
    version: '0.19.0', date: '2026-10-24T18:55:00+08:00', title: 'Build menu: Cannon & Howitzer',
    sections: [
      { title: 'New: Build menu', items: [
        'New <b>BUILD</b> button (<b>G</b>). Pick a building, then left-click a spot on your side: a see-through preview shows its footprint (green = OK, red = blocked) and its min / max range. Shift-click places another; right-click or Esc cancels.',
        'Placement: your own side of the river, on flat ground, within 30 of your base, clear of trees, props and other buildings. <b>Max 2</b> of each per side.',
        'Buildings go up under scaffolding (they start at 10% HP and can be attacked while building), don\'t count toward your army limit, and pay the usual 40% bounty when destroyed.',
        'Select one and press <b>Del</b> (or Demolish) to tear it down for a <b>50% refund</b>. Attack / Stop work on buildings too.',
      ] },
      { title: 'New buildings', items: [
        '<b>Cannon</b> (Medieval, 250g, 20s): 600 HP, 4 armor. Fires a low, fast iron ball every 4s: <b>45 splash damage</b> (radius 2.5), small knockback. Range 4–16.',
        '<b>Howitzer</b> (Modern, 300g, 25s): 500 HP, 3 armor. Lobs a shell every 6s: <b>60 splash damage</b> (radius 3.5). A <b>red ring</b> marks the landing spot during the 1.6s flight, so troops can get out of the way. Range 6–22.',
        'Both: splash is 100% at the center and 50% at the edge, ignores evasion, can\'t hit flying units or anything inside the minimum range. They aim at the target whose splash would hit the most enemies.',
        'New Barracks upgrades: <b>Grapeshot</b> (Cannon, +0.5 splash radius per level) and <b>Ballistic Computer</b> (Howitzer, +2 range and -1.5 minimum range per level), 3 levels each.',
        'The enemy AI saves up for artillery after the opening and places it behind its front line.',
        'Dev Lab: both buildings are in the Model Viewer (Buildings) and can be placed in the Sandbox.',
      ] },
      { title: 'Balance to watch', items: ['Splash hits clumps of cheap melee (Vikings, Police) hardest. Artillery competes with Fortify / Expand HQ for early gold.'] },
    ],
  },
  {
    version: '0.18.0', date: '2026-10-24T20:30:00+08:00', title: 'Smarter AI, difficulty 1–10, Ranger tree & new items',
    sections: [
      { title: 'New — AI difficulty 1 to 10', items: [
        'The difficulty pills are now a <b>slider from 1 to 10</b> (remembered). 1–3 are the old Recruit, Veteran and Warlord.',
        '<b>4 Champion</b>: AI takes 20% less damage, +50% gold. <b>5 Conqueror</b>: takes 20% less, deals 20% more, double gold.',
        '<b>6 Tyrant</b> → <b>10 HELL</b>: up to half damage taken, +75% damage dealt, 4x gold, faster training/research/evolutions, extra starting gold and a bigger starting base (level 2 at 8, level 3 at 9–10).',
        'AI "gold" bonuses apply to its income and its kill bounty.',
      ] },
      { title: 'Reworked — AI brain', items: [
        'Every AI rolls a <b>personality</b> each match: <b>Greedy</b> (farms and saves a lot), <b>Defensive</b> (big waves, protects its camps, repairs early), <b>Aggressive</b> (small early waves, sometimes invades your camps), <b>Tactician</b> (reads fights) or <b>Wildcard</b> (changes its mind every minute). Each trait gets a random twist, and low levels play sloppier (odd buys, lone troops wandering off, forgetting to repair).',
        'Junglers now <b>react to invaders</b>: they fight you if they\'re stronger, run home if not, and smart/defensive AIs send their waiting troops to help.',
        'Smart AIs fall back when a push is badly outnumbered and regroup, focus fire on wounded troops, and counter your army mix.',
        'The end screen shows which personality you played against. Test command: <b>/ai</b>.',
      ] },
      { title: 'Skill trees', items: [
        'Kill scaling lowered: <b>3, 6, 9, 12…</b> kills per level (was 5, 10, 15…). Lv 5 = 45 kills, Lv 15 = 360.',
        'Stats in a tree <b>no longer stack</b> with the parent: each evolution\'s numbers are its totals vs the base troop (Chaotic Viking +2 HP regen total, Storm Viking +20 attack speed total). The tree marks these "(total)".',
        '<b>Fury</b> (Frenzy/Chaotic): instead of +2 damage per stack, each stack makes the target take <b>+4% damage from Vikings</b>.',
        '<b>Chain Lightning</b>: now <b>25</b> magic (Storm Viking <b>40</b>), with a crackling lightning tether and a 0.3s delay per bounce.',
      ] },
      { title: 'New — Ranger tree', items: [
        '<b>Lv 5 Scout Ranger</b>: +5 price, +2 damage, Eagle Eye becomes a 30% <b>true strike</b> (can\'t miss or be evaded) for +30% damage and 5 magic.',
        '<b>Lv 15 Stalker</b> (after Scout): +5 price, +2 damage, +1 range, 100 mana, +1 mana regen, same Eagle Eye, new passive <b>Cut Throat</b>: invulnerable for 2s after a kill.',
        '<b>Lv 5 Stray Ranger</b>: +20 attack speed, new passive <b>Bowsling</b>: 40% chance to fire a second arrow at another enemy in range.',
        '<b>Lv 15 Rogue</b> (after Stray): +40 attack speed total, Bowsling, new active <b>Tumble</b> (Q): roll 3.4 toward the cursor at move speed +15, 3s cooldown. Works with quick cast.',
        '<b>Lv 15 Hunter</b> (after Stray): +20 attack speed, +0.5 move speed, Bowsling always fires.',
      ] },
      { title: 'Items', items: [
        'Tier 1 drop chance <b>20% → 50%</b>. Each higher tier drops <b>25%</b> less often.',
        'New Tier 1 items: <b>Well Done Steak</b> (click to eat: +50 HP, used up), <b>Robe</b> (+5 max mana, +1 mana regen, troops with mana only), <b>Broadsword</b> (+15 damage, −20 attack speed), <b>Javelin</b> (+2 damage; click: for 3s your next attack is a true strike and Breaks the target for 3s, 12s cooldown).',
        'Items with an active glow green in the inventory: <b>click to use</b>. The AI uses them too.',
      ] },
      { title: 'Map & visuals', items: [
        'Modern side: a <b>road grid</b> now links the lane to every camp (an avenue to each camp, a cross street between them). Crossing the city jungle is now as quick as the forest: camp-to-camp detours went from about 1.9x to 1.0x the straight line.',
        'Nights are brighter (moonlit), and the fog of war lifts a little at night so it\'s never pitch black.',
      ] },
    ],
  },
  {
    version: '0.17.0', date: '2026-10-24T18:30:00+08:00', title: 'Skill trees & a bigger map',
    sections: [
      { title: 'New — Skill Tree', items: [
        'New <b>Skills</b> button left of the Barracks (<b>N</b>, rebindable). It lists every troop you can hire with its <b>level</b> and kill progress.',
        'Every kill by a troop type (troops <b>and</b> camp creeps) adds to that type\'s level for this match: <b>5</b> kills to Lv 1, then <b>10, 15, 20…</b> more per level. Levels don\'t give stats; they unlock evolutions.',
        'Evolving is <b>free and instant</b>. From then on every troop of that type you hire comes out evolved (new name, new eye and hair color, same price, same Barracks upgrades). Troops already on the field stay as they are.',
        'The AI evolves its troops too.',
        'Test command: <b>/xp</b> &lt;unit&gt; &lt;kills&gt;.',
      ] },
      { title: 'Viking tree', items: [
        '<b>Lv 5 — Frenzy Viking</b>: +1 HP regen, new passive <b>Fury</b>: each hit puts a stack on the target for 5s (max 10, hitting again refreshes and adds one). <b>Every Viking</b> deals +2 damage per stack to that target. Breakable.',
        '<b>Lv 5 — Lightning Viking</b>: +10 attack speed, new passive <b>Chain Lightning</b>: 20% chance on hit to zap the target for 10 magic, jumping to a random enemy within 2 range, up to 4 enemies.',
        '<b>Lv 15 — Chaotic Viking</b> (after Frenzy): +2 more HP regen, Fury stacks without limit.',
        '<b>Lv 15 — Storm Viking</b> (after Lightning): +20 more attack speed, +0.3 move speed, Chain Lightning 20 damage and 30% chance.',
      ] },
      { title: 'Map', items: [
        'The map is wider: it now reaches z ±46 (was ±30).',
        '<b>8 new Tier 1 camps</b> (4 per side): Deep woods, Hillside glade and Woodland glade on the Medieval side; Rail yard, Park lot and Plaza alley on the Modern side. 12 camps in total.',
        'New <b>north hill</b>: high ground (above the normal high ground). Troops on it see down; troops below can\'t see up, and ranged attacks fired uphill can miss. The river now springs from a pond at its top.',
        'New scenery: forest ponds on the Medieval side, a fountain plaza and a park pond on the Modern side, street planters and patches of green between the city blocks, plus many more trees and buildings in the outer areas.',
        'Minimap is taller to fit the new map and shows the hill.',
      ] },
    ],
  },
  {
    version: '0.16.1', date: '2026-10-24T15:10:00+08:00', title: 'Cursor lock removed',
    sections: [
      { title: 'Removed', items: ['The <b>cursor lock</b> from 0.16.0 felt off, so it is gone: the normal cursor and edge-panning are back, and the two cursor options were removed from Options → Gameplay.'] },
    ],
  },
  {
    version: '0.16.0', date: '2026-10-24T16:30:00+08:00', title: 'Fast forward, new shop, cursor lock & camp leash',
    sections: [
      { title: 'New — Fast forward (vs AI)', items: ['Speed buttons at the top left: <b>1×</b>, <b>2×</b>, <b>3×</b>. Only in matches against the AI; every match starts at 1×.'] },
      { title: 'Reworked — Shop', items: [
        'Per-troop buy keys are gone. Instead your <b>3 most recently hired troops</b> get quick-hire keys (<b>1</b> <b>2</b> <b>3</b> by default, rebindable) while the shop is open, shown in a "Recent" strip at the top. Shift still hires 5.',
        'New <b>search box</b> (name, role, family, ability) and a <b>list / card view</b> toggle (remembered). List view shows up to 5 troops and scrolls. In the search box, <b>Enter</b> hires the first match.',
      ] },
      { title: 'New — Cursor lock', items: [
        'During a match the cursor is <b>locked inside the game</b> (no more slipping onto a second monitor, the tab bar or the taskbar, so edge-panning works on every side). Click into the match to lock it; <b>Esc</b> releases it and still does its normal job.',
        'Options → Gameplay: turn it off, and set the cursor speed while locked.',
      ] },
      { title: 'Camera', items: ['<b>Space</b> now alternates: your base, then the middle of your selected troops, then your base again. With nothing selected it always goes to the base.'] },
      { title: 'Neutral camps — no more ranged cheese', items: [
        'A creep that chases outside its camp gets <b>3 seconds</b>, then gives up and walks home. It only chases again once it is back inside its camp.',
        'Giving up heals it <b>5% max HP per second for 4 seconds</b> (neutral camp creeps only, never creeps you hire).',
      ] },
    ],
  },
  {
    version: '0.15.0', date: '2026-10-24T14:30:00+08:00', title: 'Chat, test commands, tiered camps & troop creator',
    sections: [
      { title: 'New — Chat & test commands', items: [
        'Press <b>Enter</b> to chat (rebindable). Plain messages show in the chat log, ready for PvP later.',
        'Commands start with <b>/</b> and only work <b>against the AI</b>, for that match only: <b>/gold</b>, <b>/hirespeed</b>, <b>/fog</b>, <b>/reveal</b>, <b>/wtf</b> (no mana or cooldowns), <b>/god</b>, <b>/spawn</b> &lt;unit&gt; [count] [me|enemy|neutral], <b>/kill</b>, <b>/level</b> &lt;upgrade&gt; &lt;n&gt;, <b>/item</b>, <b>/time</b> day|night, <b>/speed</b>, <b>/camps</b>, <b>/win</b>, <b>/lose</b>. Type <b>/help</b> for the list.',
      ] },
      { title: 'Reworked — Neutral camps', items: [
        'Camps are no longer tied to one creep group or one side of the map. Every camp spot has a <b>tier</b>, and <b>every spawn rolls a random group</b> of that tier (Bear pack, Wraiths, Thug crew, Outlaw gang are all Tier 1). Stacked camps can mix groups.',
        'Loot is by tier too: any Tier 1 creep can drop any Tier 1 item (a Dire Bear can drop Shackles). Drop chance: Tier 1 <b>20%</b>, each tier above 20% less often (16%, 12.8%…).',
      ] },
      { title: 'New — Dev Lab', items: ['<b>[ Create + ]</b> (bottom left): a troop concept form for stats, price, abilities, upgrades, look, lore and skill tree. <b>Copy</b> puts it on your clipboard in the spec format, ready to paste to Claude. "Load existing unit" pre-fills it from any unit in the game.'] },
      { title: 'UI', items: ['Every hotkey label (command card, Barracks, Shop, Repair, Auto-loot, help pages) now follows your key bindings and updates the moment you rebind.'] },
    ],
  },
  {
    version: '0.14.0', date: '2026-10-24T13:26:00+08:00', title: 'Growing bases',
    sections: [
      { title: 'Bases grow during the match', items: [
        'Both bases now <b>start at level 1</b> (Wooden Fort / Field Outpost, 1500 HP, 1 wall spot) instead of level 3.',
        'New base upgrades: <b>Fortify</b> (Medieval) and <b>Expand HQ</b> (Modern). Each level rebuilds your base one level higher, right on the battlefield: Lv 2 300g / 20s, Lv 3 600g / 30s, Lv 4 1200g / 40s, Lv 5 2000g / 50s. The base keeps its HP %, and wall troops move to the new spots.',
        'The enemy AI researches them too, sooner when its base is under attack.',
        'Selecting a base shows its level name and level.',
      ] },
      { title: 'Base stats by level', items: [
        'Each level has its own stats (same for both sides): <b>HP</b> 1500 / 2000 / 2500 / 3500 / 5000, <b>armor</b> 0 / 0 / 0 / 2 / 4, <b>vision</b> 30 / 32 / 35 / 38 / 40 (day), 16 / 18 / 20 / 22 / 24 (night). Reinforce HP stacks on top.',
        'Dev Lab: the viewer shows each level’s stats with the change from the level below, plus <b>wall firepower</b> (spots × the wall troop’s damage per second). In the sandbox, changing a base’s level applies its stats, and clicking a base shows them live in the Inspector.',
      ] },
      { title: 'Balance', items: [
        '<b>Battlement</b> and <b>Rooftop Overwatch</b> are now capped by your base’s troop spots: 1 / 2 / 4 / 6 / 8 by base level (hard max 8). Levels 5–8 cost 1200 / 1600 / 2000 / 2400.',
        'The Barracks shows what a capped upgrade needs, e.g. <em>Needs Fortress (Castle Lv 4) · research Fortify</em>.',
      ] },
    ],
  },
  {
    version: '0.13.0', date: '2026-10-24T12:28:00+08:00', title: 'Dev Lab & base levels',
    sections: [
      { title: 'Dev Lab (main menu, top right)', items: [
        '<b>Model Viewer</b>: every building, troop, creep and prop on a turntable. Orbit camera (drag / right-drag / wheel), wireframe, bounding box, grid, axes, night lighting, a Viking for scale, and the model\'s size and box count.',
        'Troops preview their <b>idle / walk / attack</b> animations with a speed slider.',
        '<b>Sandbox</b>: a live arena on a <b>flat floor</b> or the <b>lane map</b>. Place any unit for any side (Medieval, Modern, Neutral) ×1–10, set any Barracks upgrade level up or down instantly, give items, heal / kill / god-mode a troop, pause, step a frame or run at 0.25×–4×, switch day and night, and turn invulnerable bases and fog of war on or off.',
        'Model list filter: <b>All / Medieval / Modern</b>. City block moved to Props.',
        'The <b>Inspector</b> shows the selected troop\'s base, bonus and current stats live.',
      ] },
      { title: 'Base levels (groundwork for Grow Castle mode)', items: [
        'The castle now has <b>5 levels</b>: Wooden Fort, Stone Keep, Castle (the current look), Fortress (central donjon, gilded spires) and Citadel (taller towers, braziers, royal banners).',
        'Each level has its own <b>wall slots</b> (1 / 2 / 4 / 6 / 8). Battlement Rangers stand on these slots. Matches use the level 3 castle.',
        'Front-wall Rangers now stand <b>behind the battlements</b>, in the gaps between the merlons, instead of on top of them.',
        'The <b>Modern HQ</b> also has <b>5 levels</b>: Field Outpost, Police Precinct, Command HQ (the current look), Military Compound (guard towers with searchlights, razor wire, radar) and Tech Tower (glass tower, parked helicopter, rooftop turret). Rooftop slots: 1 / 2 / 4 / 6 / 8.',
        'The Command HQ roof gets a <b>concrete parapet</b>. Overwatch Gunners stand behind it, in the gaps.',
      ] },
      { title: 'Balance', items: ['<b>Battlement</b> and <b>Rooftop Overwatch</b> max level 5 → <b>4</b> (four troops fit on each base front).'] },
    ],
  },
  {
    version: '0.12.3', date: '2026-10-24T13:28:00+08:00', title: 'Cleaner HUD',
    sections: [ { title: 'UI', items: ['Removed the "Drag a box over your troops…" hint panel. The selection panel now only shows up when something is selected.'] } ],
  },
  {
    version: '0.12.2', date: '2026-10-24T13:19:00+08:00', title: 'Quick cast & aim lines',
    sections: [
      { title: 'New', items: [
        'Options → Gameplay: <b>Quick cast</b>. Aimed abilities (Elf\'s Arrow Piercer) fire at the cursor the moment you press the key.',
        'Normal cast now shows an <b>aim line for every selected caster</b> (5 Elves = 5 lines), since they all fire on the click.',
      ] },
    ],
  },
  {
    version: '0.12.1', date: '2026-10-24T12:59:00+08:00', title: 'Auto-update',
    sections: [
      { title: 'New', items: [
        'The game now <b>updates itself from GitHub</b>: start.bat pulls the latest version before launching, and the running server checks every minute. New builds show an <b>Update downloaded → Reload</b> banner (the main menu just reloads).',
        'Run <b>setup-git.bat</b> once to link your folder; <b>push.bat</b> sends your changes (pulls your teammate\'s first). Your unpushed work is never overwritten.',
      ] },
    ],
  },
  {
    version: '0.12.0', date: '2026-10-24T12:25:00+08:00', title: 'Banshee rework',
    sections: [
      { title: 'Changes', items: [
        '<b>Banshee</b>: attack speed 50 → <b>70</b>. <b>Brainwash removed</b> (too random).',
        'New passive <b>Banshee Curse</b>: attacks curse the target for 4s. Anyone attacking a cursed unit gets <b>+30 attack speed</b> for 1s. A unit that <b>dies while cursed rises as the Banshee\'s ally</b> for 20s (full HP, no items, keeps its upgrades), then fades.',
        'A camp Banshee\'s risen units join her camp (leash, home, sleep). A hired Banshee\'s risen units charge for your side and don\'t count toward the army limit.',
        'Risen units give no bounty and drop nothing, and can\'t rise twice.',
      ] },
      { title: 'Fixes', items: ['See-through parts (riot shields, visors, ghost bodies) no longer turn solid when a unit stops being invisible.'] },
    ],
  },
  {
    version: '0.11.1', date: '2026-10-24T12:02:00+08:00', title: 'New troop tuning',
    sections: [
      { title: 'Balance', items: [
        '<b>Elf</b> HP 100 → <b>120</b>. <b>Arrow Piercer</b> projectile speed 10 → <b>35</b>.',
        '<b>Lancer</b> HP 140 → <b>200</b>.',
        '<b>Recon Drone</b> HP 70 → <b>45</b>.',
        'Abilities now state whether they <b>affect flying</b> units: Arrow Piercer yes; Splatter (and Death Splatter) and Shield Stomp no.',
      ] },
      { title: 'Fixes', items: ['Health bars are always drawn on top of models (the Lancer no longer hides his own bar), and his bar sits above his plume.'] },
    ],
  },
  {
    version: '0.11.0', date: '2026-10-24T11:15:00+08:00', title: 'Lancer, Elf, Riot Skirmisher & Recon Drone',
    sections: [
      { title: 'New troops — Medieval', items: [
        '<b>Lancer</b> (160g): cavalry with a 2.2-reach lance. <b>Courage Aura</b>: allies within 3 get +2 ward and +1 HP regen (doesn\'t stack). <b>Barding Rally</b>: leaves a 2s trail; allies on it move 20% faster.',
        '<b>Elf</b> (120g): ranged, 10 range, 28/20 vision, <b>100 mana</b> (+1/s). <b>Night Meld</b>: at night, standing still 2s without attacking makes her invisible.',
      ] },
      { title: 'New troops — Modern', items: [
        '<b>Riot Skirmisher</b> (150g): shield bearer. <b>Bulwark</b> (unbreakable): basic attacks from the front 120° deal 30% less, crits included.',
        '<b>Recon Drone</b> (160g): <b>flying</b>. <b>Penetration</b>: attacks shred 2 armor for 3s.',
      ] },
      { title: 'New upgrades', items: [
        'Lancer: <b>Critical Strike</b> (5 lv, 250–4000g: 30% for +80–160% damage) and <b>Cavalry Training</b> (stat boost).',
        'Elf: <b>Arrow Piercer</b> (5 lv, 200–3200g): aimed line shot, 25 range, attack + 0/50/100/150/250 magic, 70% slow 1s, 10% weaker per enemy hit, 50 mana, 20s; and <b>Nightreign</b> (stat boost).',
        'Riot Skirmisher: <b>Shield Stomp</b> (5 lv, 250–4000g): 80–240 magic in 2 range + 2.5 knockback, 20s; and <b>Iron Regimen</b> (stat boost).',
        'Recon Drone: <b>Penetration</b> (5 lv, 300–4800g): shred 4–12 armor, max level +20 attack speed; and <b>Firmware Update</b> (stat boost).',
      ] },
      { title: 'New systems', items: [
        '<b>Flying units</b>: hover 3 above the ground, fly over trees and buildings, see over them, can\'t be hit by melee; ranged attacks against them miss 50%.',
        '<b>Break</b> debuff: disables a unit\'s passives for a while (unbreakable: Immaterial, Bulwark). Broken passives show dark with a red slash. Nothing applies Break yet.',
        '<b>Mana</b>: optional per unit (blue bar under HP). Abilities can cost mana.',
        '<b>Invisibility</b>: invisible enemies can\'t be seen or targeted unless detected (detection comes with Sentry Wards later). Your own invisible troops look like ghosts.',
        '<b>Aimed abilities</b>: press the key, a range line follows the cursor, left-click fires, right-click / S / Esc cancels. Some abilities have a short cast time (S interrupts).',
        '<b>Auras</b> are now generic: the same aura never stacks, different auras add up.',
        'Up to <b>5 actives</b> per unit (Q W E R <b>T</b>); passives are unlimited. Hotkeys now map to the 1st, 2nd… <b>active</b> ability (passives no longer take a key slot).',
      ] },
      { title: 'UI', items: ['Selection panel shrinks its stat column so abilities and items always stay visible on smaller screens.', 'Barracks header now explains the research queue.'] },
    ],
  },
  {
    version: '0.10.4', date: '2026-10-24T10:35:00+08:00', title: 'Ranger',
    sections: [ { title: 'Changes', items: ['The <b>Archer</b> is now called the <b>Ranger</b> (stats and upgrades unchanged; Battlement now puts Rangers on the walls).'] } ],
  },
  {
    version: '0.10.3', date: '2026-10-24T03:01:00+08:00', title: 'Emblems & unit-bound upgrades',
    sections: [
      { title: 'Changes', items: [
        'Faction select shows each side\'s <b>emblem</b> instead of troop pictures (rosters of any size no longer overlap): a blue-and-white cross shield for the Medieval Kingdom, a star-and-stripes badge for the Modern Republic.',
        '<b>Troop upgrades now follow the unit, not the faction.</b> Whoever can field a unit gets its upgrades (e.g. a Sniper in the medieval roster brings Hollow Points and Ghillie Conditioning). Abilities always come with the unit.',
        'Base upgrades stay with their faction (Battlement = castle Archers, Overwatch = rooftop Gunners). A tower unit\'s troop upgrades stay available even if that unit isn\'t in the roster, so Battlement archers can still be upgraded.',
      ] },
    ],
  },
  {
    version: '0.10.2', date: '2026-10-24T02:48:00+08:00', title: 'One unit system',
    sections: [
      { title: 'Changes', items: [
        'Every unit — faction troops and neutral creeps — now uses the <b>same stat sheet</b> (cost, train time, vision day/night, stats, abilities). Units no longer belong to a faction: factions just have a hiring roster, and camps have a spawn list. Any unit can fight for the left side, the right side or the neutrals.',
        'Creeps now have a hiring cost and train time (not buyable yet): Dire Bear 150, Blue Bear 75, Banshee 150, Small Banshee 75, Alpha Thug 162.5, Hooligan 75, Outlaw 187.5. Vision 30/16 like everyone else.',
        'Kill bounty is now one rule for everything: <b>40% of the unit\'s cost</b> (what was paid). Creep bounties are unchanged: 60 / 30 / 60 / 30 / 65 / 30 / 75.',
        'Brainwash works for any owner: a hired Banshee can cast it on a random visible enemy troop within 8 range.',
      ] },
    ],
  },
  {
    version: '0.10.1', date: '2026-10-24T02:37:00+08:00', title: 'Stat boost pricing',
    sections: [
      { title: 'Balance', items: [
        'Stat boost upgrades now start at <b>2x the troop\'s base hiring cost</b> (still +10% per level): Protein Boost / Kevlar 100g, Accuracy Training / Drills 150g, Hell Workout 180g, Ghillie Conditioning 240g.',
        'Stat boost research time: <b>2s</b> at Lv 1, <b>+0.2s</b> (+10%) per level.',
      ] },
    ],
  },
  {
    version: '0.10.0', date: '2026-10-24T02:25:00+08:00', title: 'Bulk research & stat boosts',
    sections: [
      { title: 'New — Research queue', items: [
        'The Barracks now queues research like the training queue: up to <b>5</b> (running + queued), paid when queued.',
        'You can queue the <b>same upgrade several times</b> as long as you can afford each next level (each queued level is priced at its own level).',
        'Click a queued icon (or the running bar) to cancel it — refunds it and any later levels of the same upgrade. Right-click an upgrade card to cancel its last queued level.',
      ] },
      { title: 'Reworked — Stat boost upgrades', items: [
        '<b>Protein Boost, Accuracy Training, Hell Workout, Kevlar Program, Marksmanship Drills, Ghillie Conditioning</b> are now <b>stat boosts</b>: each level gives <b>+10% of the troop\'s base</b> HP, armor, ward, damage and HP regen.',
        'Each level also raises that troop\'s hiring cost by 10% of its base price, and the next level of the upgrade costs and takes 10% more (e.g. Protein Boost 100 → 110 → 120g, 6 → 6.6 → 7.2s).',
        '<b>Base stats vs bonus stats:</b> stat boosts change the troop\'s base stats; items and other effects are bonus stats (the green +numbers in the panel) and are not multiplied.',
        'Kill bounty still uses what was actually paid, so boosted troops are worth more to the enemy.',
      ] },
      { title: 'New — Options', items: ['Graphics: <b>Damage numbers</b> (all hits / critical strikes only / off), <b>Highlight critical strikes</b>, and <b>Combat text</b> (MISS / EVADE / DISARMED…).'] },
      { title: 'Balance', items: [
        '<b>Sniper</b>: move speed 1.4 → <b>2</b>, damage 16 → <b>24</b>.',
        '<b>Imp Warrior</b>: damage 12 → <b>20</b>, ward 0 → <b>1</b>.',
      ] },
      { title: 'Fixes', items: ['Right-clicking the enemy base is now a real attack order: troops keep hitting the base instead of switching to freshly spawned (shielded) troops.'] },
    ],
  },
  {
    version: '0.9.1', date: '2026-10-24T01:55:00+08:00', title: 'Vision tuning',
    sections: [
      { title: 'Balance', items: [
        'Base vision 20/12 → <b>35 day / 20 night</b>.',
        'All troops\' vision → <b>30 day / 16 night</b> (Sniper still +3 while prone). Every troop keeps its own value in its stats, so they can be tuned individually later.',
      ] },
      { title: 'UI', items: ['Removed the "Not scouted" text on an unscouted enemy base (the panel just stays empty).'] },
    ],
  },
  {
    version: '0.9.0', date: '2026-10-24T01:24:00+08:00', title: 'Terrain, river & fog of war',
    sections: [
      { title: 'New — Solid terrain', items: [
        'Trees, rocks, buildings, fences, barrels, dumpsters, lamps and torches are now <b>obstacles</b>. Troops walk around them using real pathfinding instead of passing through.',
        'The forest rings around the medieval camps now open toward the lane (they were facing sideways).',
      ] },
      { title: 'New — River & high ground', items: [
        'A shallow <b>river</b> now runs down the middle where the two sides meet. It is <b>low ground</b>.',
        'Ranged attacks from low ground at a target on high ground <b>miss 50%</b> of the time ("MISS ▲"). Melee is unaffected.',
      ] },
      { title: 'New — Fog of war', items: [
        'You only see what your troops and base see. Base vision <b>20 day / 12 night</b>. Viking/Police 10/6, Archer/Gunner 12/7, Imp 11/6, Sniper 14/8 (+3 while prone), creeps 8/4.',
        'Trees and buildings block sight. Troops in the river can\'t see up onto the banks. A troop that attacks is revealed to its victim\'s side for 1.5s.',
        'Troops can\'t auto-target what their side can\'t see; an attack order on a target that disappears into the fog becomes an attack-move to its last seen spot.',
        '<b>Scouting:</b> the enemy base panel shows only what you saw the last time you had vision on it (upgrades, research, towers, repair, income). Never seen = "Not scouted".',
        'The AI plays by the same fog.',
        'Minimap shows the fog and the river.',
      ] },
      { title: 'New — Auto-loot (L)', items: [
        'Floating toggle above the command card. <b>ON</b>: the troop that kills a creep gets its drop straight into a free slot (drops on the ground if full or if a tower got the kill). <b>OFF</b>: drops land on the ground as before.',
      ] },
      { title: 'Fixes', items: [
        'Dropped items are now drawn on top of trees, with a taller beam and a ground marker, so you can always spot them.',
        'Move orders onto a tree or off the map snap to the nearest walkable spot.',
      ] },
    ],
  },
  {
    version: '0.8.2', date: '2026-10-23T23:06:00+08:00', title: 'Jungle balance pass',
    sections: [
      { title: 'Balance', items: [
        '<b>Old Man Shield</b>: block is now a <b>50% chance</b> per basic attack (still 5–7 damage).',
        '<b>Outlaw</b> bounty 60 → <b>75</b> gold.',
        '<b>Quiver</b>: attack speed bonus +30 → <b>+20</b> (range bonus unchanged).',
        '<b>Shackles</b> no longer stacks: a target that is already disarmed can\'t be disarmed again or have the timer refreshed (multiple carriers can\'t chain it). Two Shackles on one troop still roll once.',
        '<b>Brainwash</b> is now a gamble: each fight, the Banshee gets <b>one 25% roll</b> (plus one more each time the 20s cooldown ends mid-fight). A winning roll casts 1–4s into the fight; a losing roll means no Brainwash that fight.',
        '<b>Banshee</b> evasion stays at 50%.',
      ] },
    ],
  },
  {
    version: '0.8.1', date: '2026-10-23T21:36:00+08:00', title: 'The real jungle',
    sections: [
      { title: 'New — Neutral roster (replaces the placeholders)', items: [
        '<b>Bear den</b> (medieval top): <b>Dire Bear</b> + 2 <b>Blue Bears</b>. Dire Bear passive <b>Resentment</b>: after taking 30 damage, +5 damage and +30 attack speed for 3s.',
        '<b>Wraith grove</b> (medieval bottom): <b>Banshee</b> + <b>Small Banshee</b>, ranged. Banshee passive <b>Immaterial</b>: 50% evasion. Active <b>Brainwash</b> (20s cooldown, cast at random while fighting): one troop it is fighting switches sides for 15s, attacks its former allies, then despawns.',
        '<b>Thug corner</b> (modern top): <b>Alpha Thug</b> + 2 <b>Hooligans</b>. Alpha Thug passive <b>Morale Aura</b>: allies (and itself) within 4 range get +2 armor.',
        '<b>Outlaw yard</b> (modern bottom): 2 <b>Outlaws</b>. Passive <b>Cleave</b>: melee attacks also hit enemies in a cone behind the target for 40% of the damage.',
      ] },
      { title: 'New — Camp behaviour', items: [
        '<b>Day:</b> camps attack anyone who walks within <b>2 range</b>, or who attacks them.',
        '<b>Night:</b> camps <b>sleep</b> (Zzz) and ignore passers-by; attacking one wakes the whole camp.',
        'Creeps stay engaged while they are hitting you, not only while being hit.',
      ] },
      { title: 'New — Items', items: [
        'Drop chance raised from 10% to <b>20%</b> per creep. Medieval camps drop medieval items, modern camps drop modern items.',
        'Pick up by <b>selecting a troop and right-clicking the item</b> (closest selected troop with a free slot goes). Hover an item on the ground to see what it is. Items are lost when the carrier dies.',
        'Medieval: <b>Rustic Sword</b> (+6 damage), <b>Old Man Shield</b> (blocks 5–7 damage from every basic attack), <b>Sash</b> (+1 move speed), <b>Quiver</b> (ranged troops only: +1 range, +30 attack speed).',
        'Modern: <b>Shoulder Guard</b> (+2 armor, +2 ward), <b>Shackles</b> (melee: 20% on hit to <b>disarm</b> for 3s), <b>Riot Helmet</b> (+3 armor for 3s after being hit by a ranged attack), <b>Pocket Knife</b> (+4 damage; on hit, 3 damage to every enemy within 3 range).',
        'New debuff <b>Disarm</b>: the troop can\'t start attacks (shown in the selection panel).',
      ] },
      { title: 'New — AI', items: [
        'The AI now <b>farms the camps on its own side</b> now and then with the troops waiting at home, grabs the drops, and walks back. Recalled instantly if its base is threatened.',
      ] },
      { title: 'Balance', items: [
        '<b>Repair Crews</b> is now <b>unlimited</b> (price +100 per level, research time grows to max 30s).',
        'Kill bounty still follows what was actually paid, so troops made pricier by Barracks upgrades give the enemy more gold.',
        'Brainwashed troops give no bounty when they die or when they kill.',
      ] },
    ],
  },
  {
    version: '0.8.0', date: '2026-10-23T21:09:00+08:00', title: 'Jungle, night & repairs',
    sections: [
      { title: 'New — Neutral camps', items: [
        'The map now extends above and below the lane: a <b>forest</b> on the medieval side and <b>back alleys</b> between buildings on the modern side, with 4 neutral camps.',
        'Camps spawn at every full minute if their spawn ring is empty — so you can <b>pull and stack</b> them Dota-style.',
        'Creeps only fight when attacked, chase up to 11 range, then walk home and heal. Some have passives and actives they cast on their own.',
        'Each creep has a <b>10% chance to drop an item</b>; any troop with a free slot that walks over it picks it up.',
        'Placeholder roster: Centaur Scout, Centaur Brute, Street Thug, Gang Boss. Placeholder items: 6.',
        'New Help tab: Neutrals.',
      ] },
      { title: 'New — Day & night', items: [
        '5 minutes of day, then 5 minutes of night, alternating. Sun/moon timer next to the match clock.',
        'Medieval side now has a row of <b>torches</b> matching the modern street lamps; both light up the lane at night.',
      ] },
      { title: 'New — Repair (H)', items: [
        'Toggle button next to the training queue: heals your base <b>+10 HP/s</b> for <b>5 gold/s</b> (only drains while damaged).',
        'Barracks: <b>Repair Crews</b> (5 lv) — +6 HP/s and +3 gold/s drain per level.',
        'Barracks: <b>Logistics</b> (5 lv) — research and troop training 8% faster per level (up to 40%).',
      ] },
      { title: 'New — Selection', items: [
        'Click a <b>base</b> (yours or the enemy\'s) to see its HP, income, towers, repair state, current research and every upgrade it has.',
        'Hovering a troop shows a highlight ring. Bigger click area, including prone Snipers.',
      ] },
      { title: 'Balance', items: [
        'Base HP increased from 1500 to <b>2500</b>.',
        '<b>Riot Training</b>: armor per nearby officer 0.3–1.5 → <b>0.5–2</b>.',
        '<b>Suppressive Fire</b> reworked: no more slow or free Fervor; shots now deal <b>+2–10 damage</b> and <b>knock back 0.3–0.5</b>.',
        '<b>Hollow Points</b> price 80/160/260/400/600 → <b>75/150/250/375/550</b>.',
        'Unlimited upgrades now take longer per level (+1.5s per level, max 30s).',
      ] },
      { title: 'Fixes', items: ['Stats show at most 2 decimals.', 'Long upgrade names in the Barracks no longer overlap.', 'HUD no longer overlaps at smaller window widths.'] },
    ],
  },
  {
    version: '0.7.0', date: '2026-10-23T20:26:00+08:00', title: 'The Barracks',
    sections: [
      { title: 'New — Barracks (V)', items: [
        'New building button next to the Shop. Spend gold on upgrades that last for the current match.',
        'Upgrades have levels (fixed or unlimited), rising prices and a research time. One research at a time; click it again to cancel for a full refund.',
        'Every upgrade has its own pixel icon; hover for every level\'s price and effect.',
        'The AI now saves up for and researches upgrades too.',
      ] },
      { title: 'Medieval upgrades', items: [
        '<b>One Man Army</b> (5 lv): Lone Wolf +1–5 dmg, +0.1–0.5 regen, +0.5–2.5 armor; max: 20% lifesteal.',
        '<b>Protein Boost</b> (∞): Vikings +5 HP, +0.1 armor, +0.3 dmg, +0.1 regen per level; +5g cost.',
        '<b>Flurry</b> (5 lv): Archers gain the active Flurry (+60–180 attack speed for 4s, 14s cooldown).',
        '<b>Accuracy Training</b> (∞): Archers +3 HP, +0.6 dmg, +0.05 regen; +7.5g cost.',
        '<b>Organic Matter</b> (5 lv): Splatter +10–50 dmg and a 10–30% slow; max: Death Splatter.',
        '<b>Hell Workout</b> (∞): Imps +4 HP, +0.4 dmg, +0.15 regen; +9g cost.',
        '<b>Battlement</b> (5 lv): +1 invulnerable archer on the castle wall per level (+15 range).',
      ] },
      { title: 'Modern upgrades', items: [
        '<b>Riot Training</b> (5 lv): Thin Blue Line also gives +0.3–1.5 armor per nearby officer; max: Backup (officers heal 25 when an ally officer dies).',
        '<b>Kevlar Program</b> (∞): Police +6 HP, +0.15 armor, +0.15 dmg, +0.1 regen; +5g cost.',
        '<b>Suppressive Fire</b> (5 lv): Gunners gain an active: 4s of slowing shots (15–35%) + instant Fervor stacks.',
        '<b>Marksmanship Drills</b> (∞): Gunners +3 HP, +0.4 dmg, +0.05 regen; +7.5g cost.',
        '<b>Hollow Points</b> (5 lv): Bull\'s Eye crit +10–50%; max: crits every 3rd shot.',
        '<b>Ghillie Conditioning</b> (∞): Snipers +4 HP, +0.6 dmg, +0.05 regen; +10g cost.',
        '<b>Rooftop Overwatch</b> (5 lv): +1 invulnerable gunner on the HQ roof per level (+15 range).',
      ] },
      { title: 'Both sides', items: ['<b>Reinforce</b> (∞): base +100 max HP.', '<b>Finance</b> (∞): +0.5 gold/s.'] },
      { title: 'New mechanics', items: ['<b>Lifesteal</b>: attacks heal for a % of post-mitigation damage dealt.', '<b>Slows</b>: movement-speed debuffs (strongest applies; spawn-shielded troops are immune).'] },
      { title: 'Balance', items: ['<b>Imp Warrior</b>: Splatter damage 40 → <b>70</b>.', 'Kill bounty now uses what the victim actually cost (includes upgrade cost increases).'] },
    ],
  },
  {
    version: '0.6.2', date: '2026-10-23T18:59:00+08:00', title: 'Balance pass & Patch Notes',
    sections: [
      { title: 'New', items: [
        'Patch Notes screen on the main menu (you are reading it).',
        'Help → Troops: each card has a <b>Matchups</b> button that shows DPS and time-to-kill against every enemy troop (replaces the always-visible lines).',
      ] },
      { title: 'Police Officer', items: ['<b>Thin Blue Line</b>: damage per nearby officer increased from +1 to <b>+3.5</b> (still max 3 officers → up to +10.5).'] },
      { title: 'Imp Warrior', items: [
        'Cost reduced from 100g to <b>90g</b>.',
        '<b>Splatter</b>: damage increased from 20 to <b>40</b>.',
        '<b>Swift Step</b>: evasion while moving increased from 30% to <b>40%</b>.',
      ] },
      { title: 'Sniper', items: [
        'Base range increased from 10 to <b>12</b>.',
        'Damage increased from 15 to <b>16</b>.',
        '<b>Snipe Stance</b>: setup channel 0.8s → <b>1s</b>. Range bonus +5 → <b>+6</b> (18 total).',
        '<b>Snipe Stance</b> NEW: while prone, attacks <b>ignore 2 armor</b>.',
        '<b>Snipe Stance</b>: standing back up is now a <b>1s channel</b> (can\'t move or shoot), then the ability goes on a <b>5s cooldown</b>.',
      ] },
      { title: 'UI', items: ['The Shop window now opens in the center of the screen.'] },
    ],
  },
  {
    version: '0.6.1', date: '2026-10-23T18:37:00+08:00', title: 'Sniper fixes',
    sections: [
      { title: 'Changes', items: [
        '<b>S</b> now interrupts channels and attack wind-ups (Dota-style). Cancelling Snipe Stance setup refunds the cooldown.',
        'Prone Snipers now look down the scope instead of face-planting into the ground.',
        'Snipe Stance setup reduced from 3s to <b>0.8s</b>.',
      ] },
    ],
  },
  {
    version: '0.6.0', date: '2026-10-23T18:21:00+08:00', title: 'The Sniper',
    sections: [
      { title: 'New troop — Sniper (Modern, Marksman)', items: [
        '120g · 40 HP · 15 dmg · 30 attack speed · 1 armor · 1.4 move speed · range 10.',
        '<b>Bull\'s Eye</b> (passive): every 4th attack crits for +70% damage.',
        '<b>Snipe Stance</b> (Q): channel, then lie prone — 0 move speed, +5 range, +3 damage, takes double damage. Recast to stand.',
      ] },
      { title: 'AI', items: [
        'AI Snipers go prone when targets are in long range and nothing is close; they stand up when threatened.',
        'Fix: the AI now saves up for the troop it picked, so expensive troops (Imp, Sniper) actually get bought.',
      ] },
    ],
  },
  {
    version: '0.5.1', date: '2026-10-23T18:07:00+08:00', title: 'Spawn shield',
    sections: [
      { title: 'New', items: ['Every troop is <b>invulnerable for 5s</b> after spawning (white shield bubble). It can be targeted but takes no damage and can\'t be crowd-controlled.'] },
      { title: 'Viking Warrior', items: ['<b>Lone Wolf</b> now also grants <b>+3 armor</b>.'] },
    ],
  },
  {
    version: '0.5.0', date: '2026-10-23T17:44:00+08:00', title: 'Abilities, Imps & bounties',
    sections: [
      { title: 'New troop — Imp Warrior (Medieval, Melee)', items: [
        '100g · 40 HP · 12 dmg · 65 attack speed · 2 armor · 4.5 move speed.',
        '<b>Swift Step</b> (passive): +30% evasion while moving.',
        '<b>Splatter</b> (Q): self-destruct, 20 magic damage in a 2.2 radius.',
      ] },
      { title: 'Systems', items: [
        '<b>Ability system</b>: up to 4 slots per troop (any mix of passives/actives), cast with Q W E R or by clicking.',
        '<b>Evasion & miss</b> (Dota-style). Abilities can\'t be dodged.',
        '<b>Kill bounty</b>: killing a troop pays 40% of its cost. Passive income reduced from 5 to <b>2.5 gold/s</b>.',
        'HP regen added to all troops (Viking 1, Police 1, Archer 0.5, Gunner 0.5, Imp 0.1).',
      ] },
      { title: 'Controls', items: [
        'Buy keys only work while the Shop is open (defaults 1/2/3), per-troop and rebindable. Esc closes the Shop first.',
        'Key bindings split into sections; keys only clash within the same section.',
        'The Army button now tells you when there are no troops to select.',
      ] },
    ],
  },
  {
    version: '0.4.0', date: '2026-10-23T16:43:00+08:00', title: 'Damage types rework',
    sections: [
      { title: 'Systems', items: [
        'Three damage types: <b>Physical</b> (vs Armor), <b>Magic</b> (vs Ward), <b>True</b> (ignores both).',
        'Armor and Ward now use Dota scaling: 2 → 10.7%, 5 → 23%, 10 → 37.5%.',
        'Removed the 5 elemental resistances.',
      ] },
      { title: 'Viking Warrior', items: ['<b>Lone Wolf</b> reworked: +5 damage and +1 HP regen while no other <em>Viking</em> is within 9 range (other troop types no longer break it).'] },
    ],
  },
  {
    version: '0.3.2', date: '2026-10-23T16:36:00+08:00', title: 'HP regen & resistances',
    sections: [
      { title: 'Systems', items: ['Added HP regen stat.', 'Added 5 elemental resistances (later replaced in 0.4.0).'] },
    ],
  },
  {
    version: '0.3.1', date: '2026-10-23T16:29:00+08:00', title: 'Families',
    sections: [
      { title: 'Systems', items: [
        'Every troop belongs to a family: <b>Melee</b> (Viking, Police) or <b>Marksman</b> (Archer, Gunner).',
        'Family-wide upgrade hook for the future Barracks.',
        'Shop renamed to War Camp / Recruitment.',
      ] },
    ],
  },
  {
    version: '0.3.0', date: '2026-10-23T16:05:00+08:00', title: 'Passives',
    sections: [
      { title: 'New passives', items: [
        'Viking — <b>Lone Wolf</b>: +5 damage with no ally within 9 range.',
        'Police — <b>Thin Blue Line</b>: +1 damage per officer within 10 range (max +3).',
        'Archer — <b>Eagle Eye</b>: 20% chance for +5 damage.',
        'Gunner — <b>Fervor</b>: +6 attack speed per consecutive hit on the same target (max 10).',
      ] },
      { title: 'Systems', items: [
        'Attack speed is now in attacks <b>per minute</b>.',
        'Passive icons with hover tooltips, crit damage numbers.',
        'Troops stick to their current target. AI attacks in groups.',
      ] },
      { title: 'Balance', items: ['Police damage 11 → 9. Gunner attack speed 75 → 60, HP 62.'] },
    ],
  },
  {
    version: '0.2.0', date: '2026-10-23T15:36:00+08:00', title: 'Ranged troops & the Shop',
    sections: [
      { title: 'New troops', items: ['<b>Archer</b> (Medieval) and <b>Gunner</b> (Modern) — ranged attackers with projectiles.'] },
      { title: 'New', items: [
        'Shop window (B) for buying troops, training queue with cancel/refund.',
        'Attack-range circle when one troop is selected.',
        '6 item slots per troop (placeholder for future drops).',
        'Semi-pixel UI redesign, bigger main menu, UI scale option.',
      ] },
      { title: 'Fixes', items: ['Dragging on the minimap no longer starts a box selection.'] },
    ],
  },
  {
    version: '0.1.0', date: '2026-10-23T14:36:00+08:00', title: 'First playable',
    sections: [
      { title: 'New', items: [
        'Player vs AI 1v1 lane battle: Medieval (left) vs Modern (right), 3 AI difficulties.',
        'Starter troops: <b>Viking Warrior</b> and <b>Police Officer</b>.',
        'Dota-style controls: box select, right-click move/attack, A-click attack, S stop, edge-pan camera.',
        'Main menu, pause, options (key bindings, audio, graphics), help.',
        'Voxel graphics, procedural sound and music, minimap, selection panel.',
      ] },
    ],
  },
];

export const CURRENT_VERSION = PATCH_NOTES[0].version;

export function formatPatchDate(iso) {
  const d = new Date(iso);
  return d.toLocaleString('en-US', { timeZone: 'Asia/Manila', month: 'short', day: 'numeric', year: 'numeric', hour: 'numeric', minute: '2-digit' }) + ' (PHT)';
}
