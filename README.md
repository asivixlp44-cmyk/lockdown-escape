# Lockdown Escape

A multiplayer "+1 Speed" keyboard runner for the browser, built with **Three.js** and **Colyseus** for Bloxity. It is listed as **[🚨LOCKDOWN] +1 Speed Anomaly Keyboard Escape**, slug `lockdown-escape`.

The lab is in **LOCKDOWN** and the anomalies are loose.

- **Speed and Levels.** Every step is **+1 Speed and +1 XP, times all your boosts**, and everyone starts with x5. Every step clacks a giant keycap. XP fills your Level, and your **Level sets how fast you can walk**.
- **The Atrium.** You start here, in the lab's big lobby floored with keycaps. Train on its treadmills ("+2 / STEP", "+5 / STEP" ...).
- **The Keyline.** A giant keyboard corridor between tall hazard-striped lab walls. Security doors marked "STAGE N" cut it into fifteen stages per sector, and it climbs higher and higher. In the way:
  - **the Stretcher**, a lanky one-eyed anomaly that bursts out of a floor vent and chases you;
  - giant **rolling eyeballs**, **laser sweepers** and sliding **blast doors**;
  - **supply crates** dropping where their shadows grow;
  - **flicker keys** and **glitch keys** that vanish under your feet;
  - **toxic goo** in the gaps between stepping keys.
- **Knocked out.** Get hit or fall in and Boxity's death screen counts down. Then **REVIVE** straight back into the stage (FREE every 3 minutes, for a short ad, or 5 Gems), or go **BACK TO the Atrium**.
- **Wins.** Every door you pass pays Wins. The Wins you earn open faster treadmills. Spend them on upgrades and Eggs for lab pets.
- **Rebirth and sectors.** Rebirth for a multiplier. Clear a sector's fifteen stages to open the next.
- **Purge Run.** Press **RACE** to run five others with a wall of purge gas rolling in behind.

**Reference.** The genre, the core loop and the numbers' feel follow the Roblox game *[WORLD 3] +1 Verity Keyboard Escape [SCP]*, studied from its page and the developer's screenshots:
- x5 boosts on every step;
- the XP bar filling 0 / 100 at Level 1;
- Levels as walking speed, and Custom Speed;
- "+N / step" treadmills that open with Wins;
- a keycap corridor under stage frames, with obstacles and a monster chasing you;
- SKIP, rebirth and worlds.

**Our own.** Everything players see and hear, per the house rules in `NEW_GAME_PROMPT.md`:
- the name, the lab setting, the four sectors and their sixty stages;
- the Stretcher and every hazard;
- the Atrium, the treadmills, the pets and eggs;
- the HUD and its art, the icons, the text, the sounds and the music.

Nothing of the reference's world, worlds or creatures (no "Verity", no SCP creatures, no smiley keycaps or balloons) is used.

**There are no in-app purchases.** Everything costs Wins or Gems earned in the game, and three things can also be had for a rewarded ad: a revive, a skip, x2 Speed. No Bux are spent anywhere.

It is forked from Sandstorm Escape (the Desert keyboard escape, the same genre), so it shares the engine with the other Legion games:
- the server and its race queue with bot takeover;
- the camera and lighting rig, the quality system;
- profiles, saves and play stats;
- the test suite.

The Bloxity integration is the newest one, from Clackstack (Infinite Keyboard Tower). It is described in `BLOXITY_CODE_METADATA.md` and below.

## Project layout

| Folder | What it is |
|---|---|
| `client/` | Vite + Three.js client. See the file list below. |
| `server/` | Colyseus 0.18 server. See the file list below. |
| `shared/` | `config.js`: the economy, sectors, pets, treadmills, quests, codes and the four `LEADERBOARDS`. `stages.js`: the kinds of stage and each sector's order. `world.js`: where everything stands. `arena.js`: a race's course. `physics.js`. |
| `tests/` | Server, economy and browser test scripts, the cover renderer, the setup-page generator. |
| `tools/` | `local-port.mjs`: the port picker `start-local.bat` uses. |

The client's files:

| File | What it holds |
|---|---|
| `main.js` | Boot, your runner, the hazards and the death screen, the network (Boxity matchmaker, `?roomId=`), races, the camera, input |
| `world.js` | The Atrium and the Keyline |
| `engine.js` | The renderer, the light rig, the sector skies and ground |
| `keycaps.js` | The instanced keycap floor |
| `stagefx.js` | Lasers, blast doors, eyeballs, crates, glitch and flicker keys |
| `monster.js` | The Stretcher, one draw animated in its vertex shader |
| `arenaview.js` | Purge Run's lanes and the purge gas |
| `bloxity.js` | Every Boxity SDK call |
| `avatar.js`, `chars.js` | Bloxity avatars, the character kit, custom characters |
| `pals.js` | The pets |
| `ui.js`, `index.html` | The HUD, the panels, the death card |
| `icons.js` | The drawn HUD icons, pets and eggs |
| `asmr.js` | The key clacks and effects, synthesised in a worker |
| `audio.js` | The mixer and both songs |

The server's files:

| File | What it holds |
|---|---|
| `RunRoom.js` | The `run` room: steps and their guards, doors and Wins, knock-outs and revives (FREE, Gems, a verified rewarded ad), skips, purchases, rebirths, sectors, tasks, quests, rewards, codes, bots |
| `Match.js` | Purge Run |
| `bloxity.js` | Token verify with `carriedFrom`, rewarded-ad verify, the leaderboards report, profile stats |
| `legion-room-reporter.js` | Open Rooms |
| `profiles.js` | Profiles in MongoDB on Legion, guest progress adoption |

## Run it locally

Needs Node 20 or newer. Double-click `start-local.bat` (it picks port 3191, or the next free one up to 3197). Or run:

```sh
npm install          # installs client and server too
npm run build        # builds the client into client/dist
npm start            # server + game on http://localhost:3191
```

For development:
- Run `npm run dev:server` and `npm run dev:client`, then open http://localhost:5719.
- The dev server injects `window.BLOXITY_ENV = { env: 'local', ... }` before the game's code (`client/vite.config.js`, serve only). A production build is told nothing and Boxity tells it where it runs.
- Dev builds, or a build with `VITE_QA=1`, expose `window.__qa`. `QA=1` on the server lets the client give itself Speed, Wins and so on; it is refused on Legion.

## Gameplay

- **Steps.**
  - Run (WASD, the stick, the left stick), and every stride is **+1 Speed and +1 XP times all your boosts**.
  - The boosts:
    - the LOCKDOWN x5 event;
    - rebirths, pets, your trail and aura;
    - Grip Sneakers, the sector you're in, the treadmill you're on;
    - x2 Speed and the squad boost.
  - "ALL YOUR BOOSTS: x5 SPEED" over the Level bar shows them together, and STATS lists each one.
- **Level is your walking speed.** Level 2 needs 100 XP, then each Level 15% more (Level 10 needs 352). Every Level adds 2.2 to your top walking speed: 16 studs a second at Level 1, up to 92. The **CUSTOM SPEED** card lets you walk slower.
- **Treadmills in the Atrium.** They open with the Wins you've earned in all:
  - Test +1, Lab +2 (10 Wins), Hazard +3 (60), Bio +5 (300), Cryo +8 (1,500), Reactor +12 (25,000), Quantum +20 (1,000,000);
  - Anomaly +35 (120 Gems) and Void +60 (400 Gems).

  Hold **DASH** on a belt to sprint.
- **The Keyline.** Fifteen stages in each of four sectors, between security doors marked "STAGE N". A **Recommended Level** wall monitor stands before each one; gaps are sized to that Level's walking speed. Every stage is its own challenge, and each sector runs through them in its own order:
  - **Open Keys**: barriers to hop, chemical tanks to weave round, goo to jump.
  - **Goo Pools**: key bridges over the goo; further in, a blast door and a single stepping key.
  - **Eyeball Hill**: the stage is a climb, and giant eyeballs roll down its lanes at you.
  - **Stretcher Chase**: the Stretcher bursts from its vent behind the door and comes after you.
  - **Flicker Keys**: a wave of vanishing keys rolls at you; jump it.
  - **Laser Sweeper**: a laser bar on a hazard-striped emitter; jump it as it comes round.
  - **Blast Doors**: steel doors sliding wall to wall.
  - **Falling Crates**: supply crates drop where their shadows grow.
  - **Catwalk**: one narrow walkway over the goo.
  - **Stepping Keys**: keys on steel pillars, too far apart if you're slow.
  - **Glitch Keys**: a bridge of keys that blink out behind you.
  - **Jump Pads**: pads that launch you across goo too wide to jump.
  - **The Breach** (every 15th): everything at once.

  The pits are toxic goo in Hazard Halls, bio-ooze in Bio Lab, freezing coolant in Cryo Vault and the starry void in The Void Wing.
- **Knocked out (the death screen).** A flash, then Boxity's death screen (Boxity shows ads round the game while you're down) and our card in the middle of the screen: what got you, the stage, and three buttons.
  - **REVIVE at Stage N**: FREE once every 3 minutes, else 5 Gems.
  - **▶ WATCH AD**: a FREE revive for a rewarded ad, shown only while Boxity has one.
  - **BACK TO the Atrium**.

  The buttons wait for Boxity's countdown (at least 4 s on Boxity, none outside it), and nothing ever respawns you by itself. The revive stays on offer for 2 minutes; the server decides which stage it is (never further than you got in that life).
- **SKIP.** In a stage, SKIP moves you just inside the next door, for 8 Gems or a rewarded ad. The skipped door pays nothing.
- **Wins.**
  - Passing a stage's end door pays its Wins: x3 the first time each rebirth, and again every 30 seconds.
  - **TO STAGE** (B) and the **Teleport** panel take you back to any stage you've reached this rebirth.
- **Rebirth.** It's free:
  - At Level 10, then 15, 20 ... up to 35.
  - You go back to Level 1 and 0 Speed.
  - In return every step gives x1.5, x2 ... for good.
- **Eggs and pets.** Eight Eggs, from 5 Wins to 3.5M: Test, Goo, Bio, Hazard, Cryo, Reactor, Void and Anomaly. Each holds five pets (50 / 30 / 14 / 5 / 1%), forty in all: a Lab Mouse, a Goo Pup, a Pink Axolotl, a Caution Cat, a Glacier Wolf, a Nuclear Drake, a Void Wyvern, an Anomaly Dragon and more. Each follows you and multiplies your Speed.
- **Upgrades, for Wins:**
  - Grip Sneakers (more Speed a step), Adrenaline Shot (walk faster), Research Notes (more XP);
  - Jump Boots, Long Strides, Lucky Keycard (more Wins), Pet Crate (room for another pet).
- **Trails and auras.** Eight trails for Wins (Lab Steam to Rainbow Lockdown) and five auras for Gems (Static Field to Anomaly Overdrive).
- **Gems buy time and Speed.**
  - **x2 SPEED** and **x2 WINS**; x2 Speed can also be had for 10 minutes for a rewarded ad.
  - Three **+SPEED** packs under the Level bar.
- **The squad boost.** Every other real player in your server adds +10% Speed a step for everyone, up to +50%.
- **The four sectors**, each multiplying Speed and Wins:
  - **Hazard Halls**: a bright blue day, yellow walls, lime goo.
  - **Bio Lab**: a candy-pink sunset, pink and white, violet ooze.
  - **Cryo Vault**: an icy haze, white and ice blue, coolant with ice.
  - **The Void Wing**: night, a nebula and a giant planet, glowing keys, the void.

  The second, third and fourth open at 1, 4 and 8 rebirths, once the last stage before them is passed.
- **Purge Run** (RACE on the right, or V):
  - Everyone who presses RACE at about the same time goes in one race. Bots fill only the empty places and take over for a player who leaves.
  - Six keycap lanes, with goo, barriers, swinging hammers, sliding crates and chemical tanks.
  - The purge gas rolls in behind, faster and faster. First through the gate wins.
- **The rest of a session.** A chain of 37 quests, 3 daily tasks a day, the Lucky Wheel, a 7-day daily reward, playtime gifts at 2 to 45 minutes, leaderboards, titles and a guide of chevrons on the ground.
- **Codes:** `LOCKDOWN`, `ESCAPE`, `KEYCARD`, `BLOXITY`, `LEGION`, `ANOMALY`, `X5`.
- **Pacing.** `tests/economy.mjs` simulated a brand-new player on the real formulas and stages, 25 runs of 30 minutes, on 18 November 2026. Medians:

  | When | What |
  |---|---|
  | 0:13 | Stage 1 passed |
  | 0:31 | Stage 2 passed: away from the Stretcher |
  | 0:57 | the Lab Treadmill (+2) opens; Stage 3 (Eyeball Hill) climbed |
  | 1:47 | Stage 5 passed |
  | 2:27 | the Hazard Treadmill (+3) opens |
  | 4:34 | Stage 10 passed; the Bio Treadmill (+5) opens |
  | 7:12 | Level 20 |
  | 10:49 | First rebirth |
  | 14:27 | the Cryo Treadmill (+8) opens |
  | 19:56 | Stage 15 passed |
  | 20:57 | Bio Lab opens |

  It's a simulation, not a playtest.

## Bloxity integration

Everything goes through `client/src/bloxity.js`. Its one `onUserChanged` subscription is the source of truth for who the player is. `BLOXITY_CODE_METADATA.md` has the developer's answers (canDie, hasScore, the boards, gameplay ads off).

- **Environment.** `env()` returns what Boxity told the page (`Legion.SDK.environment()` / `window.BLOXITY_ENV`), prod when nothing was told. The server reads `BLOXITY_ENV`, `BLOXITY_API_URL`, `BLOXITY_MATCHMAKER_URL`, `BLOXITY_PORTAL_URL` and `BLOXITY_STATIC_URL`. No Boxity host is worked out from the page's own address, and no `api.` / `play.` / `static.bloxity.io` is written anywhere but the two prod fallbacks.
- **Connecting.** Every connect calls `Legion.SDK.net.resolveEndpoint('lockdown-escape')` and makes a new Colyseus Client on that endpoint. While a server wakes up, it retries with a backoff for a minute. **Nothing ever opens a socket to `lockdown-escape.host.bloxity.io`**, which is for HTTP only (`/health`, `/api/stats`).
- **Rooms.**
  - `?roomId=` (Open Rooms, invites, CrazyGames invites) joins that room through its pod first, else matchmaking. The room id is reported with `game.updateRoom`.
  - The room's `maxClients` is 16 (`roomSize` in the deploy).
  - `server/src/legion-room-reporter.js` fills Open Rooms.
- **Identity.**
  - The join options carry `auth.getToken()`. The server verifies it with `POST {BLOXITY_API_URL}/v1/auth/game-token/verify` and uses only the returned `user._id`. Without a token or with a refused one, the player is a guest with a server-made id.
  - A sign-in mid-game is verified on the same connection, so nobody leaves their room.
  - `carriedFrom` guest progress is copied into an account that has none here yet, once only.
- **Avatars** (`avatar.js`). The platform character kit dresses the rig when `character.canDress` says it can. Otherwise:
  - every accessory slot from `getAccessorySlots()`;
  - skins with pants, shirt and face from `getSkinTextureUrlFor`;
  - proportions;
  - custom uploaded characters.

  Only ids are replicated.
- **Death screen.** `deathScreen.show()` on every knock-out on the Keyline:
  - The card's buttons wait for `onCountdown` to reach 0, and respawn only when `respawn()` is true.
  - A race, a rebirth or a world switch while down calls `deathScreen.hide()`.
  - Boxity's "Reset Character" (`respawn_request`) is still instant for a living player.
- **Ads.**
  - `ads.onBreakStart` / `onBreakEnd` stop and restart the frame loop and the sound.
  - `declareScreens` lists `panel`, `lobby` (Purge Run's start line), `results` and `gameplay` (no banners in play, the developer's choice). `ads.screen()` is reported as each opens.
  - Rewarded ads `revive`, `skip-stage` and `x2-speed` show only while `isAvailable()`, and are granted only after the server verifies the token (`POST /v1/ads/reward/verify`).
- **Leaderboards.** The client calls `leaderboard.define()` right after init. The server reports from its own state, batched every 15 s and only for `legion_` ids:
  - **Wins**: sum, weekly;
  - **Top Speed**: best, all time;
  - **Highest Stage**: best, weekly, counted across sectors;
  - **Races Won**: sum, weekly.

  The Leaderboards panel opens Boxity's own (`leaderboard.open`).
- **Also wired:**
  - **Chat:** Boxity chat bubbles over heads, found by the Boxity id in `PlayerState.bx`.
  - **Emotes:** `registerFeature('emotes')` at boot; `play_emote` is played and relayed.
  - **Settings:** `master_volume`, `music_volume`, `graphics_quality`, `camera_sensitivity` and `show_fps`.
  - **Lifecycle:** `loadingStep` and `loadingEnd`, with no start menu.
  - **ESC** opens Boxity's menu.
  - **CrazyGames:** P is never bound (race is V), and there is no fullscreen button of the game's own.

## Controls

| Action | Keyboard / mouse | Controller | Touch |
|---|---|---|---|
| Run | WASD / arrows | Left stick | The stick |
| Jump | Space | A | JUMP |
| Dash / sprint on a treadmill (hold) | Shift, F, Enter | RT, LT or X | DASH |
| Revive (death card) / use | E | Y | The card's buttons |
| Back to the Atrium (death card) / home | R | L3 | The card's button |
| Camera | Drag, wheel | Right stick | Drag, pinch |
| Race | V | LB | RACE |
| Pets / Upgrades / Teleport / Wheel / Quests / Shop / Sound | J / U / T / C / Q / G / M | D-pad to the HUD, A to press | The buttons |

## Sound

- **Key clacks and effects**: synthesised sample by sample in a worker while the world builds.
  - Each key press is a click, a clack and a thock.
  - Footsteps on lab tiles are sneaker taps that sometimes squeak.
  - The other effects: a gloopy goo splash, a crate thud, a blast door's beeps and hydraulics, the Stretcher's screech and growl, the purge gas hiss, and an alarm.
- **Music**, all our own, each rendered once into loops by an OfflineAudioContext behind the loading screen (never note by note in play):
  - **"Lab Rat Shuffle"**, the Atrium song: swung, E harmonic minor, 112 BPM, with marimba, woodblock, a theremin-like voice, bouncing bass and glockenspiel.
  - **"Red Alert Run"**, the Keyline and race song: D minor, 160 BPM, with a driving bass, four-on-the-floor, a two-tone siren every four bars, and bells and toms at full intensity.

## Graphics and performance

- **Lighting and materials:**
  - The top games' lighting: hemisphere 1.1, ambient 0.45, sun 1.5, PCF shadows, no tone mapping.
  - **Only matte Lambert and unlit materials.** No reflections, environment maps, bloom or post-processing.
  - Each sector's mood tints the rig and sets its sky: blue day, pink sunset with a pale moon, icy haze, or night with stars, nebula and a giant planet.
- **Our own art, all built in code:**
  - **The Atrium:** a decon spawn pad, the KEYLINE gate towers, lab treadmills, the Upgrade Lab and Rebirth Reactor booths, Eggs in cages, the vault-door Worlds portal, the PURGE RUN gate, wall-monitor leaderboards, specimen tanks and server racks, two giant smiling flask mascots, and the Stretcher asleep in its glass cell ("DO NOT WAKE").
  - **The Keyline:** tall lab walls with hazard stripes, pipes and observation windows, X-braced trusses with warning-light cables, security doors with keypads and blast-door edges.
  - **Beyond the walls:** lab buildings, silos and cooling towers.
  - **The Stretcher:** one geometry, one draw, animated in its vertex shader (loping run, reaching bite, head twitch, burst from its vent, sleeping pose), with fewer parts on Low.
- **Keeping it fast:**
  - The keycap floor is instanced in chunks (sculpted near, plain far), with the press and ripple in the vertex shader.
  - Static things are merged per stage into BatchedMeshes culled per stage; hazards and props are instanced.
  - Every shader, panel and emoji is warmed up behind the loading screen.
  - The HUD writes only on change and moves its bars with transforms.
- **Weak devices start on Low:** phones, and PCs with 4 cores or fewer, 4 GB or less, or an older Intel or small Radeon GPU. Below 54 FPS the resolution steps down first, then the quality.

- **Measured** on this PC on 18 November 2026 (`LOW_GPU=1 node tests/perf.mjs`). Setup:
  - Intel UHD Graphics on ANGLE D3D11, Chrome headless, a 144 Hz display.
  - The automatic resolution step-down was switched off, so these are the worst case.
  - Frames drawn per second, with the 95th percentile frame interval in brackets. *Paced* means the game drew every other refresh of the fast screen, by design when frames are uneven.

  | Device | Running the Keyline (autopilot) | Sprinting on a treadmill | At a door | In a Stretcher Chase | At the spawn | In a race | Load + join (dev build) |
  |---|---|---|---|---|---|---|---|
  | Desktop, 1920x1080, High | 57 (35.8 ms) | 56 (27.8 ms) | 70 paced (20.9 ms) | 52 (41.6 ms) | 68 (21 ms) | 71 (21 ms) | 9.2 s |
  | Desktop, 1600x900, Medium | 73 (41.6 ms) | 60 (27.8 ms) | 74 paced (13.7 ms) | 60 paced (13.9 ms) | 81 paced (19.5 ms) | 139 (8.3 ms) | 5.3 s |
  | **Weak laptop**: CPU throttled 4x, 1366x768, Low | 51 (34.8 ms) | 55 (27.8 ms) | 75 paced (20.8 ms) | 61 (27.7 ms) | 70 paced (20.4 ms) | 65 (27.8 ms) | 18.9 s |
  | **Phone**: 844x390 @2x, touch, Low, CPU 4x | 56 (34.6 ms) | 69 (27.9 ms) | 68 (27.8 ms) | 48 (41.7 ms) | 76 (20.9 ms) | 62 (27.8 ms) | 14.4 s |
  | **Phone**: 390x844 @2x, touch, Low, CPU 4x | 59 (31.3 ms) | 76 (27.7 ms) | 60 paced (14 ms) | 65 (27.9 ms) | 78 paced (20.7 ms) | 67 paced (13.9 ms) | 13.2 s |

- **Against the game it was forked from**, the same day on the same PC (weak laptop, the same autopilot scenario, three 6-second windows each):
  - Sandstorm Escape: 74, 62 and 74 FPS.
  - Lockdown Escape: 63, 56 and 70 FPS.
  - At a fresh spawn both run at about 105 FPS with about 5.5 ms of work a frame.

  The new lab art costs roughly 10% on the course.
- **The CPU profile** (`tests/perf.mjs profile`: unminified dev build, weak laptop, Low, CPU 4x, running the Keyline):
  - Self time: 34.1% `(program)` (the browser's and the driver's own work), 4.9% idle, 4.3% Three.js `setProgram`; no function of the game's own over 1.1%.
  - Layout and style reads in the frame loop: 0.00%. Audio-node calls: 0.33%.
  - A frame's work: about 2.6 ms update, 0.8 ms camera and sky, 7.3 ms render.
- **No GPU leak**: sixteen sector switches with runs down the course leave the GPU's geometries, textures and shaders where they were (38 / 24 / 38).
- **Caveats**:
  - Frames over 50 ms: 3 to 7 in a 6-second window on the weak laptop and the phones while running (a single hitch when a stage first comes into view). Only a rare one at a door, at the spawn or in a race.
  - Numbers move between runs on this PC.
  - The phones are simulated (a desktop chip and a throttled CPU). Nothing has been measured on a real phone or on the Legion servers yet.

## Testing

Test tools install on their own: `npm --prefix tests install`. Browser runs need Chrome. Their own ports (3198 / 5719; `TEST_PORT` and `VITE_PORT` move them) leave a running game on 3191 alone. Run browser suites one at a time.

- **`tests/server.test.mjs`**: the whole loop and its guards, headless. 112 checks, all passing on 18 November 2026. Among them:
  - steps, treadmills and the move guard;
  - doors and Wins;
  - knock-outs and revives: FREE, then Gems, one at a time; **the revive open for the death screen's 2 minutes; a made-up rewarded-ad token granting no revive, skip or x2; BACK TO THE ATRIUM**;
  - spending, rewards, SKIP, rebirth and sectors, the squad boost;
  - Purge Run's queue, bots, the gas and prizes;
  - nonsense messages, saves.
- **`tests/smoke.mjs`**: the page loads and joins, music loops, steps count x5, a Speed pack, SKIP, and the death card (revive into the stage, back to the Atrium, a revive nobody answers). Then a **stand-in Boxity SDK** whose death screen counts down 4 to 0 checks:
  - `init` with the slug, emotes registered, the four boards declared;
  - screens declared and `gameplay` reported, `loadingEnd` once;
  - pressing a button during the countdown does nothing, and REVIVE respawns only on `respawn() === true`;
  - an ad break pauses the frame loop and resumes it.
- **`tests/autopilot.mjs`**: the autopilot plays the whole loop (doors, a knock-out and revive, treadmills, Custom Speed), full Purge Runs on all four maps, and a run in each other sector. No snaps, no console errors.
- **`tests/passable.mjs`**: every stage of every sector is passed at its Recommended Level.
- **`tests/hazards.mjs`**: standing still, the Stretcher catches you, the flicker wave takes your key and an eyeball flattens you; Eyeball Hill is a climb you never fall through.
- **`tests/latency.mjs`**: two players through a 350 ms round trip. Speed never jumps back and no step is lost; a door is paid by the server; a knock-out and revive happen with no snap; one race for both.
- **`tests/reconnect.mjs`**: a dropped connection in the Atrium and in a race, short and long.
- **`tests/gamepad.mjs`**: the whole game on a controller, the death card's revive with Y included.
- **`tests/prod.mjs`**: the production build with real input only, a portrait phone by touch included.
- **`tests/economy.mjs`**: the pacing above.
- **`tests/screens.mjs`**: every screen at 390x844, 360x800, 375x667, a landscape phone and desktop.
- **`tests/perf.mjs`**: frame rates.
- **`tests/look.mjs`**, **`lobby-look.mjs`**, **`chase-look.mjs`**, **`race-look.mjs`**, **`stages.mjs`**: screenshots.
- **`tests/covers.mjs`**: renders the two store covers from the game. **`tests/setup-page.mjs`**: writes `bloxity-setup.html`.

**Last full run, 18 November 2026:**

| Suite | Result |
|---|---|
| Server | 112 / 112 |
| Smoke | 16 / 16, the stand-in SDK's death screen included |
| Autopilot | all good: three full races, every sector, no snaps |
| Every stage passable | 60 / 60, at most 2 knock-outs on any stage |
| Hazards | 5 / 5 |
| Latency (350 ms) | all good |
| Reconnect | all good |
| Controller | all good |
| Production build, real input | 55 / 55 |
| Screens | 0 problems at 13 sizes |

Fixed along the way:
- The screens suite's first run caught toasts over the death card on short landscape phones; it was fixed and re-checked.
- A revive the server never answers now gets asked again once and then goes back to the Atrium. Before, the card could wait for ever; `smoke.mjs` checks it.

Things to know about this PC:
- **Its network adapter flaps.** Chrome fires a window `offline` event about every half minute even on a blank page. The Colyseus SDK closed the game's socket on each one, which cost an occasional door's Wins in long runs. The page now ignores that hint (`client/index.html`), and a connection that really drops still reconnects.
- **One long all-stages run crashed its headless page** after about 35 minutes. The rerun passed every stage, and the GPU objects stay flat across sector switches, so the cause is unconfirmed.

## Deploying (prod + stage)

`.github/workflows/deploy.yml` deploys every push.

- **Platforms.** `main` goes to the production channel and `dev` to the playtest channel, on **prod always**, and on **stage too** once the repo has `LEGION_DEPLOY_TOKEN_STAGE`. A manual run (Actions → Run workflow, `target`: staging or prod) deploys any branch to one platform.
- **Isolation.**
  - The platforms are separate matrix jobs (`fail-fast: false`), so a stage failure never blocks prod.
  - A staging job reads only the stage token and fails clearly when it's missing.
  - There is one client build for both, with no environment baked in.
  - Server images are tagged per platform (`stage-<channel>-<sha>` on stage).

Repository secrets to add:
- **`LEGION_DEPLOY_TOKEN`**, from hosting.bloxity.io.
- **`LEGION_DEPLOY_TOKEN_STAGE`**, from hosting.stage.bloxity.io, to ship to stage too. See docs.bloxity.io › Environments › Getting your game onto stage.

The game is **not hosted yet**: the folder is not a git repository and nothing has been pushed. When it is:
- The repo is `LEGiON-Platforms/lockdown-escape`, pushed as `asivixlp44-cmyk`.
- Every push to `main` deploys to https://lockdown-escape.play.bloxity.io.
- `node tests/live-smoke.mjs` checks the live game.

`bloxity-setup.html` has every field of Bloxity's Create New Game form with copy buttons, and the two covers.

Play stats are at `GET /api/stats?key=<stats key>&days=7` on the host. The key is in `server/STATS_KEY.local.txt` (git-ignored); only its SHA-256 is in the code.
