// Lockdown Escape: the game's data and formulas, shared by the client and the server.
// The loop: every step is +1 Speed and +1 XP, times all your boosts (x5 for everyone to start: the LOCKDOWN x5 event). XP fills your
// Level, and your Level is how fast you can walk. Run the Keyline, a giant keyboard corridor through a research lab in lockdown, cut
// into stages by security doors: rolling eyeballs, laser sweepers, blast doors and falling crates cut across it, goo swallows the
// gaps, stepping keys hop over them in gaps sized for the stage's Recommended Level (too slow and you fall short), and the Stretcher
// comes after you. Get knocked out and Boxity's death screen counts down; then revive to the stage you were in (FREE every 3 minutes,
// a short ad, or Gems) or go back to the Atrium. Every door you pass pays Wins; Wins buy upgrades, trails and Eggs for pets, and the
// Wins you've earned all told open the faster treadmills in the Atrium (+N a step). Rebirth at Level 10 (then 15, 20 ...) for a
// permanent multiplier; clearing the last stage of a sector opens the next.
// And RACE: Purge Run, six lanes, the purge gas rolling in behind, first out wins.
// Everything is bought with Wins or Gems, all earned in the game. There are no in-app purchases.
export const lookup = (o) => Object.assign(Object.create(null), o);

export const CFG = {
    maxPlayers: 16,
    // moving: base walk speed (Level 1), gravity, the fastest fall, a jump's power; the fastest your Level ever makes you walk
    walk: 16, vMax: 92, grav: 110, fallMax: 210, airDash: 46, hopV: 22, power: 58,
    // steps the server counts: this many a second, a couple of seconds' worth saved for a hiccup in the network
    stepRate: 14, stepBurst: 26,
    // on the ground a step is a stride (longer the faster you go, so a step takes at least 1/4 s: about 4 steps a second, the
    // pace the Level curve is made for)
    stride: 4.2, strideHz: 4,
    // a treadmill: steps a second by itself, and sprinting (holding DASH)
    treadRate: 3, treadSprint: 5.5,
    // a stage's gate pays again after this long
    padCool: 30,
    // (unused: kept for callers that still read them)
    megaEvery: 20, megaK: 20,
    // DASH: how much faster, how long, how long before the next
    dashK: 1.65, dashSecs: 0.6, dashCool: 2.4,
    // (unused)
    shadeDelay: 1.3, shadeDelayEarly: 2.6, shadeBack: 14, reviveSecs: 4,
    // knocked out: one FREE revive (back to the stage you were in) every so many seconds, else a rewarded ad or Gems; the offer stays
    // open this long while Boxity's death screen is up (the player picks: nothing respawns them by itself)
    reviveFreeSecs: 180, reviveGems: 5, reviveOffer: 120,
    // a rewarded ad's x2 Speed: this many minutes
    adX2Mins: 10,
    // the server keeps this many bots about when it's quiet (one leaves per player who joins)
    bots: 3,
    boostP2Gems: 25, boostP2Mins: 15, boostW2Gems: 40, boostW2Mins: 10,
    spinMins: 7, spinMax: 3,
    // Purge Run: places, how long the queue stays open, how long the start line waits
    matchSpots: 6, matchQueue: 9, matchFull: 3, matchReady: 6,
    // SKIP: the stage you're in, for Gems (you land just inside the next door; the skipped door pays nothing)
    skipGems: 8,
    // the squad boost: every other real player in your server adds this much Speed a step, up to sqMax
    sqEach: 0.1, sqMax: 0.5,
};

// ----- jump power -> height (studs) -----
export const jumpH = (p) => Math.max(0, p) * Math.max(0, p) / 392;
export const jumpV = (p) => Math.sqrt(2 * CFG.grav * jumpH(p));

export const RARITIES = lookup({
    common: { name: 'Common', color: '#c8d0dc' }, uncommon: { name: 'Uncommon', color: '#7dff6b' }, rare: { name: 'Rare', color: '#3ab4ff' }, epic: { name: 'Epic', color: '#b45aff' },
    legendary: { name: 'Legendary', color: '#ffc42a' }, mythic: { name: 'Mythic', color: '#ff4a8a' },
});

// ----- (footwear: not part of this game; one plain entry so the profile's field and the avatar code have something to read) -----
export const SHOES = [{ id: 'none', name: 'Lab Sneakers', rarity: 'common', add: 0, wins: 0, c1: 0xf4f6fa, c2: 0x2ab8b0, glow: 0, wing: 0 }];
export const shoeOf = () => SHOES[0];

// ----- a step: +1 Speed and +1 XP, times all your boosts. EVENT: the LOCKDOWN x5 boost everyone has -----
export const STEP = 1;
export const EVENT = 5;
// (the name the tests and older callers know it by)
export const X20 = STEP;
export const upLevel = (p, id) => (p && p.ups && p.ups[id]) || 0;
export const rebirthMult = (r) => 1 + 0.5 * (r || 0);
// ----- Level: XP fills it (no cap; XP carries over). Your Level is your top walking speed -----
// the XP a Level wants: 100 at Level 1, then 15% more each Level (115, 132, 152 ... 352 at Level 10, 1,423 at Level 20); past Level
// 20, through the Levels the last stages are laid out for, 6% more again on top each Level (the climb to the end of a world takes a
// treadmill, pets and a rebirth or two)
export const xpNeed = (lv) => { const L = Math.max(1, Math.min(400, lv | 0)) - 1; return Math.max(1, Math.round(100 * Math.pow(1.15, L) * Math.pow(1.06, Math.max(0, L - 19)))); };
// what every Level adds to the XP of a step (a hundredth each)
export const levelK = (lv) => 1 + 0.01 * (Math.max(1, lv | 0) - 1);
// XP a step (before a treadmill's multiplier): the X5 event, rebirths, Ancient Scrolls (+10% each), your Level
export const xpGain = (p) => STEP * EVENT * rebirthMult(p.rebirths) * (1 + 0.1 * upLevel(p, 'scholar')) * levelK(p.lv);
// your top walking speed (studs/s): +2.2 a Level (Warp Strides add Levels' worth, up to the cap), Ion Boosters +2% each on top
export const maxWalk = (p) => Math.min(CFG.vMax, CFG.walk + 2.2 * (Math.max(1, (p && p.lv) | 0) - 1 + upLevel(p, 'reach'))) * (1 + 0.02 * upLevel(p, 'feet'));
// (no Level cap: a big number for anything that still asks)
export const lvCap = () => 999;
// rebirth: Level 10 the first time, 5 more each time after, never more than Level 35; how far you are (0..100). It costs nothing
export const rebirthLv = (r) => Math.min(35, 10 + 5 * (r || 0));
export const rebirthPct = (p) => Math.min(100, Math.floor(((p.lv | 0) || 1) / rebirthLv(p.rebirths) * 100));
export const rebirthCost = () => 0;
// the Upgrades, for Wins (kept when you rebirth). feet: +2% top walk speed each (goes past the cap); reach: a Level's worth of walk
// speed each (+2.2, up to the cap: the early stages' friend); scholar: +10% XP a step
export const UPGRADES = [
    { id: 'soles', name: 'Grip Sneakers', icon: '👟', text: 'More Speed from every step', base: 6, grow: 2.3, max: 18, stat: (n) => '+' + n * 15 + '% Speed a step' },
    { id: 'feet', name: 'Adrenaline Shot', icon: '⚡', text: 'Walk faster', base: 40, grow: 3.4, max: 10, stat: (n) => '+' + n * 2 + '% walk speed' },
    { id: 'scholar', name: 'Research Notes', icon: '📋', text: 'More XP from every step', base: 12, grow: 2.5, max: 10, stat: (n) => '+' + n * 10 + '% XP a step' },
    { id: 'spring', name: 'Jump Boots', icon: '🥾', text: 'You jump higher and further', base: 18, grow: 2.6, max: 6, stat: (n) => '+' + n * 5 + '% jump' },
    { id: 'reach', name: 'Long Strides', icon: '🦿', text: 'Walk faster: a Level\'s worth each', base: 50, grow: 3.5, max: 6, stat: (n) => '+' + (Math.round(n * 22) / 10) + ' walk speed' },
    { id: 'luck', name: 'Lucky Keycard', icon: '🪪', text: 'More Wins from every door', base: 25, grow: 2.6, max: 12, stat: (n) => '+' + n * 10 + '% Wins' },
    { id: 'den', name: 'Pet Crate', icon: '📦', text: 'Room for one more pet on your team', base: 120, grow: 8, max: 3, stat: (n) => (3 + n) + ' on your team' },
];
export const upgradeById = lookup(Object.fromEntries(UPGRADES.map((u) => [u.id, u])));
export const upgradeCost = (u, n) => Math.round(u.base * Math.pow(u.grow, n));
export const jumpPowerOf = (p) => CFG.power * Math.sqrt(1 + 0.05 * upLevel(p, 'spring'));
// (unused: kept so old callers still link)
export const megaEveryOf = () => CFG.megaEvery;
export const isMega = () => false;
export const teamMax = (p) => 3 + upLevel(p, 'den');

// ----- trails and auras: what you wear, and what it's worth. Trails for Wins, auras for Gems. Both more Speed -----
export const TRAILS = [
    { id: 'none', name: 'No Trail', rarity: 'common', wins: 0, gems: 0, c1: 0xffffff, mult: 1 },
    { id: 'dust', name: 'Lab Steam', rarity: 'common', wins: 15, gems: 0, c1: 0xe8f4ff, mult: 1.1 },
    { id: 'ion', name: 'Goo Drips', rarity: 'uncommon', wins: 90, gems: 0, c1: 0x8aff3a, mult: 1.25 },
    { id: 'comet', name: 'Warning Sparks', rarity: 'uncommon', wins: 450, gems: 0, c1: 0xffb020, mult: 1.5 },
    { id: 'solar', name: 'Keycard Glow', rarity: 'rare', wins: 2500, gems: 0, c1: 0xffe03a, mult: 2 },
    { id: 'plasma', name: 'Bio Glow', rarity: 'epic', wins: 15000, gems: 0, c1: 0xff4ad8, mult: 3 },
    { id: 'nebula', name: 'Cryo Mist', rarity: 'epic', wins: 1e5, gems: 0, c1: 0x7ae8ff, mult: 5 },
    { id: 'nova', name: 'Void Wisps', rarity: 'legendary', wins: 8e5, gems: 0, c1: 0xb06aff, mult: 9 },
    { id: 'rainbow', name: 'Rainbow Lockdown', rarity: 'mythic', wins: 1e7, gems: 0, c1: 0xffffff, rainbow: 1, mult: 16 },
];
export const trailById = lookup(Object.fromEntries(TRAILS.map((s) => [s.id, s])));
export const AURAS = [
    { id: 'none', name: 'No Aura', rarity: 'common', wins: 0, gems: 0, c1: 0xffffff, mult: 1 },
    { id: 'ice', name: 'Static Field', rarity: 'uncommon', wins: 0, gems: 20, c1: 0xd0f0ff, mult: 1.25 },
    { id: 'corona', name: 'Alarm Halo', rarity: 'rare', wins: 0, gems: 60, c1: 0xff4a3a, mult: 1.6 },
    { id: 'aurora', name: 'Bio Shield', rarity: 'epic', wins: 0, gems: 150, c1: 0x4aff9a, mult: 2.2 },
    { id: 'pulsar', name: 'Cryo Core', rarity: 'legendary', wins: 0, gems: 350, c1: 0x6ad8ff, mult: 3.2 },
    { id: 'rainbow', name: 'Anomaly Overdrive', rarity: 'mythic', wins: 0, gems: 800, c1: 0xffffff, rainbow: 1, mult: 5 },
];
export const auraById = lookup(Object.fromEntries(AURAS.map((s) => [s.id, s])));

// ----- the treadmills in the Atrium. Run on one and every step counts +N (its sign: "+2 / STEP" is twice a plain step, times all your
// boosts): mult for Speed, xp for XP (less: a treadmill is the steady way up, not a shortcut past the Levels). need: the Wins you've
// earned all told (never spent down) that open it; gems: its price instead -----
export const POSTS = [
    { id: 'moon', name: 'Test Treadmill', mult: 1, xp: 1, need: 0, gems: 0, c: 0xdfe6ee, c2: 0x2ab8b0 },
    { id: 'mars', name: 'Lab Treadmill', mult: 2, xp: 1.25, need: 10, gems: 0, c: 0x2ab8b0, c2: 0xffffff },
    { id: 'venus', name: 'Hazard Treadmill', mult: 3, xp: 1.5, need: 60, gems: 0, c: 0xffc21a, c2: 0x22222c },
    { id: 'jupiter', name: 'Bio Treadmill', mult: 5, xp: 1.75, need: 300, gems: 0, c: 0xff6ab8, c2: 0xfff0f8 },
    { id: 'saturn', name: 'Cryo Treadmill', mult: 8, xp: 2, need: 1500, gems: 0, c: 0x6ad8ff, c2: 0x1e4ab8 },
    { id: 'neptune', name: 'Reactor Treadmill', mult: 12, xp: 2.4, need: 25000, gems: 0, c: 0xff7a1a, c2: 0xfff07a },
    { id: 'pulsar', name: 'Quantum Treadmill', mult: 20, xp: 2.8, need: 1000000, gems: 0, c: 0x3a2a8a, c2: 0x7af0ff },
    { id: 'nebula', name: 'Anomaly Treadmill', mult: 35, xp: 3.2, need: 0, gems: 120, c: 0x8aff3a, c2: 0x1a1a22 },
    { id: 'quasar', name: 'Void Treadmill', mult: 60, xp: 3.6, need: 0, gems: 400, c: 0x6a3ad8, c2: 0xff7af0 },
];
// what a treadmill's sign says: "+2 / STEP"
export const postLabel = (c) => '+' + c.mult + ' / STEP';
export const postXp = (i) => (POSTS[i] && POSTS[i].xp) || 1;
export const postOpen = (p, i) => { const c = POSTS[i]; return !!c && (c.gems ? !!(p.posts && p.posts[c.id]) : (p.totalWins || 0) >= c.need); };
// the next treadmill your Wins will open (or null)
export const nextPost = (p) => POSTS.find((c) => !c.gems && (p.totalWins || 0) < c.need) || null;

// ----- pets: little lab critters and tiny anomalies that follow you. Out of Eggs (eight of them), five in each -----
// ear: 0 none, 1 pointed, 2 floppy, 3 long; horn 0 none, 1 one, 2 antlers; tail 0..2; spike 0/1; ant: 1 a pair of antennae with
// glowing tips (client/src/pals.js builds them all from one model)
// (the eggs are called JAWBREAKERS in the code: the list every system already knows). c1: the shell, c2: the bands, c3: the glow
const PT = ['common', 'uncommon', 'rare', 'epic', 'legendary'], PM = [0.1, 0.18, 0.3, 0.55, 1], ODDS = [50, 30, 14, 5, 1];
const JB = (id, name, wins, c1, c2, c3, list) => ({ id, name, wins, c1, c2, c3, list });
const pal = (name, c1, c2, ear, horn, tail, spike, ant) => ({ name, c1, c2, ear, horn, tail, spike: spike || 0, ant: ant || 0 });
export const JAWBREAKERS = [
    JB('rookie', 'Test Egg', 5, 0xf4f6fa, 0x2ab8b0, 0xe8fffc, [pal('Lab Mouse', 0xf0f0f4, 0xffb8c8, 1, 0, 2), pal('Lab Bunny', 0xfafafa, 0xffb0c8, 3, 0, 0), pal('Hamster', 0xe8b878, 0xfff0d8, 1, 0, 0), pal('Guinea Pig', 0xc89a6a, 0xfff4e8, 2, 0, 0), pal('Lab Gecko', 0x7ae0c8, 0xfff07a, 0, 0, 2, 1)]),
    JB('lunar', 'Goo Egg', 40, 0x8ae83a, 0x2a6a1a, 0xe8ffb0, [pal('Goo Pup', 0x9ae84a, 0xe8ffb0, 2, 0, 1), pal('Slime Cat', 0x6ad83a, 0xd8ff8a, 1, 0, 2), pal('Toxic Toad', 0xb8e83a, 0xffe04a, 0, 0, 0, 1), pal('Gloop Snail', 0x8ac83a, 0xffb0e0, 0, 0, 0, 1, 1), pal('Mutant Mole', 0x7a6a8a, 0xb8ff6a, 0, 0, 1, 0, 1)]),
    JB('comet', 'Bio Egg', 260, 0xff8ac8, 0xfff0f8, 0xffe0f4, [pal('Bio Bunny', 0xffb8dc, 0xffffff, 3, 0, 0), pal('Petri Kitten', 0xffd0e8, 0xff5aa8, 1, 0, 2), pal('Pink Axolotl', 0xff9ac8, 0xff4a8a, 1, 0, 2, 1), pal('Germ Puff', 0xd88aff, 0xfff0ff, 0, 0, 0, 1, 1), pal('Bio Unicorn', 0xfff4ff, 0xff5ac0, 1, 1, 2)]),
    JB('solar', 'Hazard Egg', 1700, 0xffc21a, 0x22222c, 0xfff4c0, [pal('Hazard Hound', 0xffc23a, 0x2a2a34, 1, 0, 2), pal('Caution Cat', 0xffd84a, 0x1a1a22, 1, 0, 2), pal('Spark Ferret', 0xf0b04a, 0xffffff, 0, 0, 2, 0, 1), pal('Bolt Goat', 0xf4f0e8, 0xffc21a, 2, 2, 0), pal('Alarm Lion', 0xff9a2a, 0xff3a2a, 1, 0, 2)]),
    JB('plasma', 'Cryo Egg', 11000, 0x7ae0ff, 0xffffff, 0xe0fbff, [pal('Frost Fox', 0xe8f8ff, 0x6ad8ff, 1, 0, 2), pal('Ice Penguin', 0x2a3a5a, 0xffffff, 0, 0, 0), pal('Cryo Owl', 0xc8ecff, 0x2a6ab8, 1, 0, 0), pal('Snow Yak', 0xf4f8ff, 0x7ab4d8, 2, 2, 1), pal('Glacier Wolf', 0xa8d8f0, 0x1e4ab8, 1, 0, 2, 1)]),
    JB('nebula', 'Reactor Egg', 75000, 0xff7a1a, 0xfff07a, 0xfff4c8, [pal('Reactor Pup', 0xff8a3a, 0xfff07a, 2, 0, 1), pal('Plasma Cat', 0xffa84a, 0x3af0ff, 1, 0, 2, 0, 1), pal('Magma Beetle', 0x8a2a1a, 0xffb43a, 0, 0, 0, 1, 1), pal('Core Ram', 0xffd23a, 0xff5a1a, 2, 2, 0, 1), pal('Nuclear Drake', 0x6ae83a, 0xffe04a, 3, 2, 2, 1)]),
    JB('quantum', 'Void Egg', 500000, 0x6a3ad8, 0x7af4ff, 0xe8e0ff, [pal('Void Fox', 0x4a3a9a, 0x7af4ff, 1, 0, 2), pal('Shadow Cat', 0x2a2440, 0xb48aff, 1, 0, 2), pal('Rift Owl', 0x5a6ad8, 0xfff4c8, 1, 0, 0), pal('Star Stag', 0x3a2a7a, 0xffd23a, 1, 2, 1), pal('Void Wyvern', 0x3ad8ff, 0xd85aff, 3, 2, 2, 1)]),
    JB('galactic', 'Anomaly Egg', 3500000, 0xff4ad8, 0x7af0ff, 0xffffff, [pal('Glitch Kitten', 0xf0f0ff, 0xff4ad8, 1, 0, 2), pal('Prism Jackal', 0x7af0ff, 0xff7af0, 3, 0, 2), pal('Hyper Griffin', 0xffe04a, 0xfff4e0, 1, 0, 1, 1), pal('Quantum Phoenix', 0xff4a8a, 0x7af0ff, 1, 1, 2, 1), pal('Anomaly Dragon', 0x8aff3a, 0xb46aff, 3, 2, 2, 1, 1)]),
];
export const PALS = [];
JAWBREAKERS.forEach((J, j) => J.list.forEach((a, i) => {
    const k = Math.pow(2.3, j);
    PALS.push({ ...a, id: J.id + i, jb: j, tier: i, rarity: PT[i], odds: ODDS[i], mult: Math.round((1 + PM[i] * k) * 100) / 100 });
}));
export const palById = lookup(Object.fromEntries(PALS.map((a) => [a.id, a])));
export const palsOf = (j) => PALS.filter((a) => a.jb === j);
// your team's worth: what each pet adds, together
export function teamMult(team) {
    let m = 1;
    for (const id of team || []) { const a = palById[id]; if (a) m += a.mult - 1; }
    return Math.round(m * 100) / 100;
}
// a finished Egg's collection pays this many Gems
export const jbGems = (j) => 5 + j * 5;

// ----- the Speed a step gives (before a treadmill's +N): +1, times the X5 event, rebirths, pets, trail, aura, Grip Sneakers, the sector,
// x2, and the squad boost (sq: 0..sqMax, from the other players in your server; the server says how much) -----
export function stepGain(p, x2, w, sq) {
    const world = WORLDS[w === undefined ? (p.world || 0) : w] || WORLDS[0];
    return STEP * EVENT * rebirthMult(p.rebirths) * teamMult(p.team) * (TRAILS[p.trail | 0] || TRAILS[0]).mult * (AURAS[p.aura | 0] || AURAS[0]).mult * (1 + 0.15 * upLevel(p, 'soles')) * world.pow * (x2 ? 2 : 1) * (1 + Math.max(0, Math.min(CFG.sqMax, sq || 0)));
}
// "All Your Boosts: x5 Speed": everything that multiplies a step's Speed together
export const allBoosts = (p, x2, w, sq) => stepGain(p, x2, w, sq) / STEP;
// the squad boost for this many other real players in the server
export const squadOf = (others) => Math.min(CFG.sqMax, Math.max(0, others | 0) * CFG.sqEach);
// ----- Speed packs for Gems (the +SPEED buttons): sp is in reward units (100: a whole Level's XP at your Level; it comes with as
// much XP), so a pack is always worth the same few Levels -----
export const SPEED_PACKS = [{ id: 's1', gems: 5, sp: 250 }, { id: 's2', gems: 15, sp: 900 }, { id: 's3', gems: 40, sp: 3000 }];
export const padPay = (p, w, k, first, w2) => Math.max(1, Math.round(padWins(w, k) * (first ? FIRST_PAD : 1) * (1 + 0.1 * upLevel(p, 'luck')) * (w2 ? 2 : 1)));

// ----- the worlds: 15 stages each, every one laid out for a higher Level and paying more than the last. Clearing the last opens the
// next -----
export const WALLS_N = 15;
// keys: the keycap colourway of the keyboard floor (legend: the letters on them, legendGlow 0..1: how much they glow, rgb 0..1: how
// much of a rainbow wave runs through the glow); floor/floor2/path/rim: the Atrium's lab tiles, its guide lines and its edge;
// wall/wall2: the lab walls, light and dark; trim: the painted stripes (hazard stripes in Hazard Halls); moss: what caps the tops of
// things; hazard/hazard2: the pits (toxic goo, bio-ooze, coolant, the void); sea/sea2: the sector's two accent colours (the menus'
// cards use sea); glow: portals and lights; banner: the accent colour (warning flags, stripes, chevrons)
export const WORLDS = [
    {
        id: 'hazard', name: 'Hazard Halls', rank: 'I', icon: '🚧', pow: 1, wins: 1, mood: 'hazard',
        floor: 0xe8e6de, floor2: 0xdcdad0, path: 0xffc21a, rim: 0x34343e, wall: 0xffd23a, wall2: 0x2a2a34, trim: 0x1a1a22, moss: 0xfff6d0, hazard: 0x3aa814, hazard2: 0xb8ff4a, sea: 0xff7a1a, sea2: 0x2ab8b0, glow: 0xffe03a,
        keys: [0xfff6dc, 0xffd23a, 0xf0a020], legend: 0x2a1c08, legendGlow: 0, rgb: 0, banner: 0xff5a1a,
        stages: ['Lockdown Lobby', 'Stretcher Sprint', 'Eyeball Alley', 'Goo Gutter', 'Laser Loop', 'Keycard Hop', 'Flicker Hall', 'Blast Door Row', 'Rolling Gaze', 'Ceiling Drop', 'Catwalk Crossing', 'Night Shift Chase', 'Pad Hopper', 'Glitch Grid', 'The Breach'],
    },
    {
        id: 'biolab', name: 'Bio Lab', rank: 'II', icon: '🧪', pow: 40, wins: 120, mood: 'biolab',
        floor: 0xf6eef4, floor2: 0xeedde8, path: 0xff5aa8, rim: 0x6a2a4a, wall: 0xff8ac4, wall2: 0xb43a7a, trim: 0xffffff, moss: 0xfff0f8, hazard: 0x7a22c8, hazard2: 0xe07aff, sea: 0xff3a8a, sea2: 0x3ad8c8, glow: 0xff7ad8,
        keys: [0xfff4fa, 0xff9ad0, 0xe0408a], legend: 0x4a0a2a, legendGlow: 0, rgb: 0, banner: 0x3ad8c8,
        stages: ['Petri Plaza', 'Eyeball Slope', 'Specimen Chase', 'Ooze Channels', 'Culture Hop', 'Pink Laser', 'Falling Flasks', 'Flicker Lab', 'Gaze Hill', 'Seal Door Row', 'Escaped Specimen', 'Glass Catwalk', 'Glitch Culture', 'Bounce Beakers', 'The Hive Breach'],
    },
    {
        id: 'cryo', name: 'Cryo Vault', rank: 'III', icon: '❄️', pow: 1600, wins: 14000, mood: 'cryo',
        floor: 0xeef6fa, floor2: 0xe0eef4, path: 0x3ab4e8, rim: 0x2a4a6a, wall: 0xcfeeff, wall2: 0x5a8ab0, trim: 0x1e5ad8, moss: 0xffffff, hazard: 0x1e7ad8, hazard2: 0x9af0ff, sea: 0x1e7ad8, sea2: 0x7ae8ff, glow: 0x7af0ff,
        keys: [0xffffff, 0xaee8ff, 0x2a6ab8], legend: 0x0a2a5a, legendGlow: 0, rgb: 0, banner: 0xff5a7a,
        stages: ['Frost Gate', 'Coolant Crossing', 'Cold Pursuit', 'Frozen Gaze', 'Ice Block Hop', 'Flicker Frost', 'Cryo Laser', 'Freezer Doors', 'Glacier Stare', 'Icicle Drop', 'Whiteout Chase', 'Frozen Catwalk', 'Snow Pads', 'Cracking Ice', 'The Deep Freeze'],
    },
    {
        id: 'void', name: 'The Void Wing', rank: 'IV', icon: '🌀', pow: 64000, wins: 1.7e6, mood: 'void',
        floor: 0x5a4a8a, floor2: 0x4e3e7e, path: 0x34285e, rim: 0x1e1638, wall: 0x6a58a0, wall2: 0x2e2458, trim: 0x7af0ff, moss: 0xd8c8ff, hazard: 0x2a0a5a, hazard2: 0xb46aff, sea: 0x6a3ad8, sea2: 0x3af0ff, glow: 0xb48aff,
        keys: [0x241c3a, 0x3a2a62, 0x7af0ff], legend: 0x9af4ff, legendGlow: 1, rgb: 1, banner: 0x3af0ff,
        stages: ['Event Horizon', 'Shadow Stalker', 'Orbiting Eyes', 'Crumbling Reality', 'Flicker Void', 'Rift Laser', 'Star Steps', 'Meteor Drop', 'Watcher Hill', 'The Long Chase', 'Gravity Doors', 'Starlight Catwalk', 'Nebula Pads', 'Fading Keys', 'The Final Breach'],
    },
];
// the Level a stage is laid out for (its "Recommended Level" sign): every sector the same curve (later ones also want the sector open)
const REC = [1, 2, 4, 6, 8, 10, 12, 14, 17, 20, 23, 26, 29, 32, 35];
export const recLevel = (w, k) => REC[Math.max(0, Math.min(WALLS_N - 1, k | 0))];
// what passing a stage's gate pays (x the sector's Wins)
const STAGE_WINS = [1, 1, 2, 3, 5, 7, 10, 14, 19, 26, 35, 47, 63, 84, 112];
export const stageName = (w, k) => WORLDS[w].stages[k];
export const padWins = (w, k) => STAGE_WINS[k] * WORLDS[w].wins;
// the first time through a gate each rebirth pays this much more
export const FIRST_PAD = 3;
// a sector opens when the last gate of the one before is passed and you've been reborn enough times (worldReb)
const WORLD_REB = [0, 1, 4, 8];
export const worldReb = (w) => WORLD_REB[w] || 0;
export const worldOpen = (p, w) => w === 0 || (((p.bests && p.bests[w - 1]) || 0) >= WALLS_N && (p.rebirths || 0) >= worldReb(w));
// (the gates never lock: kept so old callers still link)
export const stageNeed = () => 0;
export function gateLock() { return WALLS_N; }
// how fast you run, studs a second: your top walking speed (the screen's Custom Speed may ask for less: min(custom, this))
export const runSpeed = (p) => maxWalk(p || {});
// a step on the ground: a stride, longer the faster you go
export const strideOf = (v) => Math.max(CFG.stride, v / CFG.strideHz);
// (unused)
export const shadeRel = () => 0;
// how fast the stage is meant to be run (its gaps and layout are sized for this): the top walk speed at its Recommended Level
export const stageV = (k) => Math.min(CFG.vMax, CFG.walk + 2.2 * (recLevel(0, k) - 1));

// ----- a title over your head: how far you've come (stages cleared, all told) -----
const TITLES = [[0, 'Test Subject'], [3, 'Key Tapper'], [8, 'Hall Runner'], [15, 'Door Dasher'], [25, 'Goo Jumper'], [40, 'Lockdown Racer'], [60, 'Anomaly Dodger'], [100, 'Site Legend'], [160, 'Director of Keys']];
export const titleOf = (cleared) => { let t = TITLES[0][1]; for (const [n, name] of TITLES) if ((cleared || 0) >= n) t = name; return t; };

// ----- Purge Run: what a race is like at a Level. Longer and tougher as you level up, and better paid -----
// your Level for this: your Level plus what you've left behind in rebirths
export const matchLv = (p) => (p.lv || 1) + 3 * (p.rebirths || 0);
export function matchInfo(lv) {
    const L = Math.max(1, lv | 0), segs = Math.min(14, 5 + Math.floor(L / 6));
    return {
        segs,
        // the clock runs out long after a good run; that's for the ones who stop
        secs: Math.round(Math.min(150, 24 + segs * 6.5)),
        // what's in the way: goo pits and low barriers from the start, swinging hammers from Level 4, sliding crates from Level 6, pillars
        // from Level 8
        blades: L < 4 ? 0 : Math.min(segs - 1, 1 + Math.floor(L / 7)),
        sliders: L < 6 ? 0 : Math.min(segs - 2, 1 + Math.floor(L / 9)),
        pillars: L < 8 ? 0 : Math.min(segs - 1, 1 + Math.floor(L / 10)),
        // the purge gas behind: when it sets off, how fast, how fast it speeds up
        surgeAt: Math.max(3.5, 6 - L * 0.05), surgeV: Math.min(22, 15 + L * 0.12), surgeA: Math.min(0.55, 0.22 + L * 0.006),
        // how good the bots are: how they run, how often they trip
        botPace: Math.min(1, 0.86 + L * 0.004), botTrip: Math.max(0.12, 0.45 - L * 0.006),
    };
}
// in a race your Speed counts only so much (a log scale): a new player with quick feet can beat a veteran
export const matchPower = (p) => Math.round((1 + Math.min(0.2, Math.log10(1 + (p.speed || 0)) * 0.015)) * 100) / 100;
export const MATCH = { v: 27, boostSecs: 1.6, boostK: 1.45, stunSecs: 0.7, r: 3.2 };
export const PLACES = ['1st', '2nd', '3rd', '4th', '5th', '6th'];
const PLACE_K = [4.5, 3.2, 2.4, 1.8, 1.4, 1.1], PLACE_GEMS = [8, 5, 3, 2, 1, 1];
export function matchPrize(place, segs, lv, p) {
    const best = padWins(p.world || 0, Math.min(WALLS_N - 1, Math.max(0, ((p.bests && p.bests[p.world || 0]) || 1) - 1)));
    const k = PLACE_K[place] ?? 1.1, grow = 1 + Math.min(1.5, (lv | 0) * 0.015);
    return {
        wins: Math.max(1, Math.round((1 + best) * k * grow)),
        gems: (PLACE_GEMS[place] ?? 1) + (place === 0 ? Math.min(12, Math.floor((lv | 0) / 12)) : 0),
        // Speed and as much XP (a quarter of your Level's XP x the place's share x how far you got)
        speed: Math.max(1, Math.round(Math.max(1, xpNeed(p.lv || 1) * 0.25) * k * Math.min(2.5, 0.5 + (segs || 0) / 6))),
    };
}
// everyone's colour in a race: their lane, their lights, their name on the board
export const SPOT_COL = [0xff4a6a, 0x3ab4ff, 0xffd23a, 0x46ec50, 0xc45aff, 0xff8a2a];
export const SPOT_CSS = SPOT_COL.map((c) => '#' + c.toString(16).padStart(6, '0'));

// ----- the wheel: one spin's prizes (weights) -----
export const SPIN = [
    { w: 22, xp: 1, text: 'Speed', color: '#3ad8ff' }, { w: 18, wins: 1, text: 'Wins', color: '#ffd028' }, { w: 14, gems: 5, text: '5 Gems', color: '#b45aff' },
    { w: 12, xp: 3, text: 'Big Speed', color: '#7ae8ff' }, { w: 10, wins: 3, text: 'Big Wins', color: '#ff9a1a' }, { w: 10, x2: 10, text: 'x2 Speed', color: '#46ec50' },
    { w: 8, gems: 15, text: '15 Gems', color: '#7a4aff' }, { w: 6, wins: 10, text: 'Huge Wins', color: '#ff4a8a' },
];
// a spin's prize grows with what you've reached (its Speed comes with as much XP)
export function spinPrize(s, p) {
    const best = padWins(p.world || 0, Math.min(WALLS_N - 1, Math.max(0, ((p.bests && p.bests[p.world || 0]) || 1) - 1)));
    return { speed: s.xp ? Math.max(1, Math.round(s.xp * xpNeed(p.lv || 1) * 0.35)) : 0, wins: s.wins ? Math.round(s.wins * (1 + best)) : 0, gems: s.gems || 0, x2: s.x2 || 0 };
}

// ----- daily tasks -----
// (pads: gates passed from Stage 5 on; tread: steps on a treadmill)
export const TASKS = lookup({
    wins: { text: 'Collect Wins', icon: '🏆', n: 40, gems: 6, wins: 6 },
    steps: { text: 'Take 800 steps', icon: '👟', n: 800, gems: 5, wins: 4 },
    cleared: { text: 'Pass Keyline doors', icon: '🚪', n: 12, gems: 6, wins: 5 },
    levels: { text: 'Level Up', icon: '⭐', n: 15, gems: 6, wins: 5 },
    pads: { text: 'Pass doors from Stage 5 on', icon: '🏁', n: 5, gems: 6, wins: 6 },
    matches: { text: 'Race in Purge Run', icon: '🥇', n: 3, gems: 8, wins: 6 },
    hatch: { text: 'Hatch Eggs', icon: '🥚', n: 5, gems: 5, wins: 4 },
    spins: { text: 'Spin the Wheel', icon: '🎡', n: 2, gems: 5, wins: 3 },
    tread: { text: 'Take 400 steps on a treadmill', icon: '🏃', n: 400, gems: 5, wins: 4 },
    rebirth: { text: 'Rebirth', icon: '🔁', n: 1, gems: 8, wins: 6 },
});
const TASK_POOL = ['steps', 'cleared', 'levels', 'pads', 'matches', 'hatch', 'spins', 'tread', 'rebirth'];
export const dayKey = (ms) => new Date(ms).toISOString().slice(0, 10);
export const dayLeft = (ms) => 86400 - Math.floor(ms / 1000) % 86400;
export function tasksFor(day) {
    let h = 2166136261;
    for (let i = 0; i < day.length; i++) { h ^= day.charCodeAt(i); h = Math.imul(h, 16777619); }
    const r = rngFrom(h >>> 0), pool = TASK_POOL.slice(), out = ['wins'];
    while (out.length < 3) out.push(pool.splice(Math.floor(r() * pool.length), 1)[0]);
    return out;
}

// ----- quests: always a next goal (shown at the top of the screen); they pay as soon as they're done -----
// kind: what's counted (best: stages passed in the sector you're in; pads: gates passed, all told; tread: steps on a treadmill;
// totalWins: Wins earned all told, what opens the treadmills)
export const QUESTS = [
    { kind: 'speed', n: 60, text: 'Take your first steps: reach 60 Speed!', gems: 2 },
    { kind: 'best', n: 1, text: 'Run through the Stage 1 door', wins: 1 },
    { kind: 'lv', n: 5, text: 'Reach Level 5: Levels make you walk faster!', gems: 2 },
    { kind: 'best', n: 2, text: 'Outrun the Stretcher: pass Stage 2', gems: 3 },
    { kind: 'upgrades', n: 1, text: 'Buy an upgrade', gems: 3 },
    { kind: 'best', n: 3, text: 'Dodge the rolling eyeballs: pass Stage 3', wins: 3 },
    { kind: 'totalWins', n: 10, text: 'Earn 10 Wins: the Lab Treadmill opens (+2 / step)!', gems: 3 },
    { kind: 'hatch', n: 1, text: 'Hatch an Egg for a pet', wins: 2 },
    { kind: 'best', n: 4, text: 'Cross the toxic goo: pass Stage 4', gems: 4 },
    { kind: 'lv', n: 10, text: 'Reach Level 10', gems: 3 },
    { kind: 'speed', n: 2500, text: 'Reach 2,500 Speed', wins: 6 },
    { kind: 'best', n: 6, text: 'Pass Stage 6', gems: 4 },
    { kind: 'matches', n: 1, text: 'Press RACE: run Purge Run', gems: 5 },
    { kind: 'totalWins', n: 60, text: 'Earn 60 Wins: the Hazard Treadmill opens (+3 / step)!', gems: 4 },
    { kind: 'lv', n: 20, text: 'Reach Level 20', gems: 5 },
    { kind: 'best', n: 8, text: 'Pass Stage 8', wins: 20 },
    { kind: 'trail', n: 1, text: 'Get a trail', wins: 8 },
    { kind: 'best', n: 10, text: 'Pass Stage 10', gems: 8 },
    { kind: 'totalWins', n: 300, text: 'Earn 300 Wins: the Bio Treadmill opens (+5 / step)!', gems: 6 },
    { kind: 'lv', n: 25, text: 'Reach Level 25', wins: 40 },
    { kind: 'rebirths', n: 1, text: 'Rebirth: x1.5 Speed and XP for good', gems: 10 },
    { kind: 'tread', n: 300, text: 'Take 300 steps on a treadmill', wins: 10 },
    { kind: 'podium', n: 1, text: 'Finish a race in the top 3', gems: 8 },
    { kind: 'best', n: 12, text: 'Pass Stage 12', gems: 12 },
    { kind: 'spins', n: 5, text: 'Spin the wheel 5 times', gems: 6 },
    { kind: 'lv', n: 30, text: 'Reach Level 30', wins: 120 },
    { kind: 'best', n: 15, text: 'Pass all 15 stages: a new sector!', gems: 40 },
    { kind: 'rebirths', n: 2, text: 'Rebirth twice', gems: 12 },
    { kind: 'totalWins', n: 1500, text: 'Earn 1,500 Wins: the Cryo Treadmill opens (+8 / step)!', gems: 12 },
    { kind: 'rebirths', n: 3, text: 'Rebirth 3 times', gems: 15 },
    { kind: 'steps', n: 5000, text: 'Take 5,000 steps', wins: 120 },
    { kind: 'matchWins', n: 1, text: 'Win a race', gems: 15 },
    { kind: 'lv', n: 40, text: 'Reach Level 40', gems: 20 },
    { kind: 'rebirths', n: 5, text: 'Rebirth 5 times', gems: 30 },
    { kind: 'matchWins', n: 5, text: 'Win 5 races', gems: 30 },
    { kind: 'hatch', n: 50, text: 'Hatch 50 Eggs', gems: 40 },
    { kind: 'steps', n: 50000, text: 'Take 50,000 steps', gems: 60 },
];

// ----- rewards: the 7-day daily reward, playtime gifts, codes, the Gem shop -----
export const DAILY = [
    { speed: 40 }, { spins: 2 }, { wins: 15 }, { gems: 10 }, { speed: 400 }, { x2: 30 }, { wins: 150, gems: 30 },
];
export function dailyStatus(d, now) {
    const today = dayKey(now), yest = dayKey(now - 86400000);
    if (!d || !d.last) return { can: true, day: 0, streak: 0 };
    if (d.last === today) return { can: false, day: d.streak % 7, streak: d.streak };
    const streak = d.last === yest ? d.streak : 0;
    return { can: true, day: streak % 7, streak };
}
// FREE gifts for playing (minutes into this session)
export const GIFTS = [
    { min: 2, speed: 150 }, { min: 5, wins: 12 }, { min: 9, spins: 1 }, { min: 14, gems: 8 }, { min: 20, wins: 50 }, { min: 30, x2: 15 }, { min: 45, wins: 200, gems: 10 },
];
export const CODES = lookup({
    LOCKDOWN: { speed: 200 }, ESCAPE: { gems: 5 }, KEYCARD: { wins: 10 }, BLOXITY: { spins: 2 }, LEGION: { gems: 5 }, ANOMALY: { wins: 8, speed: 100 }, X5: { speed: 300 },
});
export const PACKS = [
    { id: 'p1', gems: 10, wins: 20 }, { id: 'p2', gems: 30, wins: 90 }, { id: 'p3', gems: 80, wins: 320 },
];
// a reward's Speed grows with your Level (what the server pays, and what the screen promises): speed 100 is a whole Level's XP.
// It comes with as much XP
export const rewardSpeed = (r, lv) => (r.speed ? Math.max(1, Math.round(r.speed * 0.01 * xpNeed(lv || 1))) : 0);
// HTML: a Win (a trophy) and Speed (a bolt) are drawn (classes "wc", "pc"), Gems are 💎
export function rewardText(r, plain) {
    return [r.speed ? fmt(r.speed) + (plain ? ' Speed' : ' <i class="pc"></i>') : '', r.wins ? fmtComma(r.wins) + (plain ? ' Wins' : ' <i class="wc"></i>') : '', r.gems ? r.gems + ' 💎' : '', r.spins ? r.spins + (r.spins > 1 ? ' spins' : ' spin') : '', r.x2 ? 'x2 Speed ' + r.x2 + ' min' : ''].filter(Boolean).join(' + ');
}

// ----- Boxity leaderboards (declared by the client right after init, reported by the server from server-owned state). The first
// declaration creates a board; later edits happen in the Boxity dashboard, so these ids and settings are permanent -----
export const LEADERBOARDS = [
    { id: 'wins', label: 'Wins', order: 'desc', mode: 'sum', format: 'compact', reset: 'weekly' },
    { id: 'speed', label: 'Top Speed', order: 'desc', mode: 'best', format: 'compact', reset: 'none' },
    { id: 'stage', label: 'Highest Stage', order: 'desc', mode: 'best', format: 'number', reset: 'weekly' },
    { id: 'races', label: 'Races Won', order: 'desc', mode: 'sum', format: 'number', reset: 'weekly' },
];
// the Highest Stage board's score: stages cleared, counted across the sectors (Stage 15 of Hazard Halls is 15, Stage 1 of Bio Lab 16)
export const stageScore = (p) => { let s = 0; for (let w = 0; w < WORLDS.length; w++) s = Math.max(s, w * WALLS_N + (((p && p.bests && p.bests[w]) || 0) | 0)); return s; };

export const BOT_NAMES = [
    'LabLuna', 'GooGus', 'KeycardKai', 'BeakerBo', 'ZapZoe', 'SirenSam', 'CryoCleo', 'VoidVin', 'TestTara', 'HazardHal',
    'PetriPia', 'TurboTess', 'ShiftSid', 'EnterEmi', 'TabTom', 'CapsCal', 'EscEli', 'KeyKiko', 'BlinkBen', 'SparkNed',
];

// ----- helpers -----
export function rngFrom(seed) {
    let s = (seed >>> 0) || 1;
    return () => { s = (s * 1664525 + 1013904223) >>> 0; return s / 4294967296; };
}
export function fmt(v) {
    v = Math.floor(v || 0);
    if (v < 1000) return String(v);
    const u = ['', 'K', 'M', 'B', 'T', 'Qa', 'Qi', 'Sx', 'Sp', 'Oc', 'No', 'Dc'];
    let i = 0, x = v;
    while (x >= 1000 && i < u.length - 1) { x /= 1000; i++; }
    return (x >= 100 ? Math.floor(x) : Math.floor(x * 100) / 100) + u[i];
}
// a small number with a decimal when it has one (a step's "+1.5"), a big one as fmt
export const fmtStep = (v) => (v >= 1000 ? fmt(v) : String(Math.round(v * 10) / 10));
export const fmtComma = (v) => { const s = String(Math.floor(v || 0)); return s.length < 4 || /e/.test(s) ? s : s.replace(/\B(?=(\d{3})+(?!\d))/g, ','); };
export function clock(s) {
    s = Math.max(0, Math.floor(s));
    const h = Math.floor(s / 3600), m = Math.floor((s % 3600) / 60), x = s % 60;
    return (h ? h + ':' + String(m).padStart(2, '0') : String(m)) + ':' + String(x).padStart(2, '0');
}
export const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
