// ============================================================
//  PATCH NOTES — newest first. Every update to the game adds an entry here.
//  version: MAJOR.MINOR.PATCH  (minor = new features/troops, patch = balance & small fixes)
//  date: ISO with timezone (Asia/Manila)
//  sections: { title, items: [string] }   — items may contain <b>, <em>
// ============================================================
export const PATCH_NOTES = [
  {
    version: '0.13.0', date: '2026-10-24T13:26:00+08:00', title: 'Growing bases',
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
    version: '0.12.0', date: '2026-10-24T12:28:00+08:00', title: 'Dev Lab & base levels',
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
