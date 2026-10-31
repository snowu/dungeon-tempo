# Dungeon Tempo

**Play:** https://snowu.github.io/dungeon-tempo/

A rhythm roguelike about a dungeon band fighting its way down to the Hollow Conductor.

## How it plays

**You are the band.** Each lane is a bandmate playing one part of the soundtrack: knight = drums (kick and snare), mage = melody, rogue = bass, ghost = chords. Charts are generated from the arrangement itself (`roomChart` in `dist/expedition.js` reads `compose()`), so every gem is a real note. Each bar spotlights one bandmate, and the first bar is always drums. Every hit fires a bolt up its lane into the enemy. Missing a note drops that part out of the mix (`Music.setLane`) until you hit its lane again; band misses cost no health.

**Enemies fight back in rhythm.** The enemy stands in the arena above the lanes (`dist/arena.js`). Each room is a song plan of attack bars and call → guard pairs. On a call the enemy winds up, growls a rhythm and beams red at the lanes it targets; one bar later red shields echo that rhythm exactly. Each missed shield lands a hit on the bandmate in that lane (−1, −2 from room 5 on Normal and Hard, −2 from the boss).

**Enemies** (Kenney sprite in brackets): Moss slime (108) heals 3 on every miss, Crypt bat (120) attacks off the beat, Crypt spider (122) webs a lane each bar so its gems show up late, Shell crawler (123) is armored (Good hits glance off), Cyclops brute (109) slams two lanes at once, Ember imp (110) attacks in frenzied bursts. Tier-2 foes appear from room 4 and behind elite doors. The Hollow Conductor (111) plays three 8-bar movements: armored, then webs, then frenzy.

**A run** is eight rooms; the eighth is the boss. Rooms are 16 bars (about 35–40 s at Normal), the boss 24. Enemy health is a share of what a flawless band (no relics) deals to that exact chart, from 55% in room 1 to 75% in room 7. Combo adds damage (+1 per 10, up to +3).

**One decision per level.** After a win you get the relic named on the door you came through, then pick one of three doors: a crypt (names the foe and its relic), an elite room (tougher, faster, more attacks; its relic plus 3 healing), or a campfire (heal 5, no fight, no relic). If the song ends first, an ordinary enemy strikes as it flees (−2, elites −3) and takes the reward; the Conductor ends the run.

**Relics** (12): War drum, Arcane echo, Backstab and Ghost choir each empower one bandmate; Crescendo, Parry blade, Iron buckler, Encore, Pocket hourglass, Heart of the crypt, Phoenix feather and Metronome fang bend rules. When a relic triggers, its name pops over the enemy.

**Controls.** A/S/D/F by default, or arrows, or D/F/J/K, or touch the keycaps. Early, late and wrong-key taps are free and explained. First-time players get an eight-note practice that never costs health (`tempo-learned` in `localStorage`); after it the pace defaults to Normal (108 BPM), or Beginner (72 BPM, 16 health, gentler rooms) if practice went badly. The pace choice is saved (`tempo-pace`). Timing offset can be set by hand or with ◎ Calibrate: tap along to 12 audio-only clicks and the median error becomes the offset (`tempo-offset`).

**Music.** Three original soundtracks synthesized in `dist/music.js`: Neon Catacombs (synthwave), Graveyard Shift (dungeon funk), 8-Bit Afterlife (chiptune). Per-soundtrack lane levels keep every part audible. Audio runs on the Web Audio clock; pausing suspends it and hiding the tab auto-pauses.

## Development

Run `npm run dev`, then open http://localhost:8087. Deployable files are in `dist/`. Pushing to `main` runs `npm test` and deploys `dist/` to GitHub Pages (`.github/workflows/pages.yml`).

`npm test` covers the run structure and doors, enemy health tuning, every trait, every relic effect, call/guard echoes, music-derived charts, fleeing, death, key layouts, practice, calibration maths, and a full eight-room run through the game engine with a fake DOM.

Browser tests need a running local server and Playwright (`PLAYWRIGHT_PATH`, optional `CHROME_PATH`); they skip practice and use Normal + D/F/J/K. `node tests/browser.cjs` plays a whole run on the real audio clock (elite door, campfire, boss, keyboard and touch input, pause, mobile doors screen, then an idle run that dies) in about 3.5 minutes. `node tests/audio-browser.cjs` renders all three arrangements, checks mix headroom, previews, and that keycaps sit exactly on their lanes at three widths. `node tests/calibration-browser.cjs` checks calibration against a simulated 60 ms-late player.

## Credits

Art: **Kenney — Tiny Dungeon**, CC0, https://kenney.nl/assets/tiny-dungeon. The original license is at `dist/assets/Kenney-License.txt`. The packed sprite sheet was obtained unchanged from the public mirror https://github.com/chaewonkong/tiny_dungeon/tree/main/assets/kenney_tiny-dungeon after the original download failed. Music is composed and synthesized in code, with no recordings. Fonts are optional Google Fonts with system fallbacks.
